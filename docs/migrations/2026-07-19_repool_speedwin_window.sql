-- O7 re-pool pricing (24h SPEED-WIN window) + cancel-path hardening (D45 refinement).
--
-- TWO changes, both create-or-replace of existing SECURITY DEFINER RPCs (additive;
-- nothing dropped; signatures unchanged). Run once in the Supabase SQL editor, AFTER
-- 2026-07-19_agreed_release.sql (this references mission_release).
--
-- (A) THE 24h SPEED-WIN WINDOW. Previously every re-pool (driver cancel / T-60 reclaim /
--     agreed release) re-entered the Pool as a SPEED WIN at 70% of the ceiling regardless
--     of timing. New rule (founder decision), applied to ALL re-pool paths:
--       • < 24h before pickup → SPEED WIN  (start 70% of ceiling, climb 5% / 5 min) — urgent.
--       • ≥ 24h before pickup → NORMAL Pool (start 50% of ceiling, climb 5% / 10 min, no
--                                SPEED WIN) — there's time to fill it without burning margin.
--     These are exactly the curves a fresh posting uses (dispatch/new/actions.ts:198-200);
--     step = max(1, 5% of ceiling) for both. The climb re-bases to pooled_at. T-60 reclaim
--     is structurally always < 24h, so it always takes the SPEED-WIN branch (kept uniform).
--
-- (B) SUPERSEDE A PENDING mission_release ON CANCEL/RECLAIM (review fix). mission_release
--     was added after the O7 cancel RPCs, so those RPCs never cleared a pending release the
--     way they clear a pending mission_amendment. Without this, a 'proposed' release could
--     outlive the mission leaving the Driver (re-pool or terminal cancel) and re-surface as
--     a stale/actionable card. Each cancel/reclaim/business-cancel now supersedes BOTH a
--     pending amendment AND a pending release. business_cancel also gains the amendment
--     supersede it was missing (a terminal cancel must clear both negotiation artifacts).
--     respond_to_release additionally locks mission → release (matching propose_release) to
--     remove a lock-order inversion that could deadlock a concurrent propose-vs-respond.

-- ---------------------------------------------------------------------------
-- 1. DRIVER cancel — always 100%; supersede pending release; 24h re-pool window.
-- ---------------------------------------------------------------------------
create or replace function driver_cancel_mission(
  p_mission_id    uuid,
  p_reason        text    default null,
  p_fare_snapshot numeric default null
) returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_driver_id uuid := current_driver_id();
  v_mission   mission;
  v_hours     numeric;
begin
  if v_driver_id is null then raise exception 'Not a driver'; end if;

  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.driver_id is distinct from v_driver_id then
    raise exception 'Not your mission';
  end if;
  if v_mission.status not in ('accepted','confirmed','en_route','arrived') then
    raise exception 'This trip can no longer be cancelled';
  end if;

  v_hours := extract(epoch from (v_mission.pickup_at - now())) / 3600.0;

  insert into mission_cancellation
    (mission_id, business_id, party, actor_driver_id, kind, reason,
     fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in)
  values
    (v_mission.id, v_mission.business_id, 'driver', v_driver_id, 'driver_cancel', p_reason,
     100, p_fare_snapshot, p_fare_snapshot, v_hours, 'repooled');

  update driver set reliability_marks = reliability_marks + 1 where id = v_driver_id;

  -- Any negotiation artifact with THIS Driver dies with the re-pool — it must not
  -- survive to the next Driver who accepts the re-pooled trip.
  update mission_amendment set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';
  update mission_release set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';

  if v_hours < 24 then
    update mission set
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null,
      stops_reached = 0, pooled_at = now(), speed_win = true,
      pdp_start = round(v_mission.ceiling * 0.7, 2),
      pdp_step = greatest(1, round(v_mission.ceiling * 0.05, 2)),
      pdp_interval = 5
    where id = v_mission.id;
  else
    update mission set
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null,
      stops_reached = 0, pooled_at = now(), speed_win = false,
      pdp_start = round(v_mission.ceiling * 0.5, 2),
      pdp_step = greatest(1, round(v_mission.ceiling * 0.05, 2)),
      pdp_interval = 10
    where id = v_mission.id;
  end if;

  insert into status_event (mission_id, status) values (v_mission.id, 'repooled');

  select * into v_mission from mission where id = p_mission_id;
  return v_mission;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. T-60 reclaim — penalty-free; supersede pending release; 24h re-pool window.
-- ---------------------------------------------------------------------------
create or replace function reclaim_mission(p_mission_id uuid)
returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid := current_business_id();
  v_mission     mission;
  v_driver_id   uuid;
  v_hours       numeric;
begin
  if v_business_id is null then raise exception 'Not a dispatcher'; end if;

  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.business_id is distinct from v_business_id then
    raise exception 'Not your mission';
  end if;
  if v_mission.status <> 'accepted' or now() < v_mission.pickup_at - interval '60 minutes' then
    raise exception 'Not eligible for reclaim';
  end if;

  v_driver_id := v_mission.driver_id;
  v_hours := extract(epoch from (v_mission.pickup_at - now())) / 3600.0;

  insert into mission_cancellation
    (mission_id, business_id, party, actor_driver_id, kind, reason,
     fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in)
  values
    (v_mission.id, v_business_id, 'business', v_driver_id, 't60_reclaim',
     'Driver did not confirm within the Lock-in window',
     0, 0, null, v_hours, 'repooled');

  if v_driver_id is not null then
    update driver set reliability_marks = reliability_marks + 1 where id = v_driver_id;
  end if;

  update mission_amendment set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';
  update mission_release set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';

  if v_hours < 24 then
    update mission set
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null,
      stops_reached = 0, pooled_at = now(), speed_win = true,
      pdp_start = round(v_mission.ceiling * 0.7, 2),
      pdp_step = greatest(1, round(v_mission.ceiling * 0.05, 2)),
      pdp_interval = 5
    where id = v_mission.id;
  else
    update mission set
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null,
      stops_reached = 0, pooled_at = now(), speed_win = false,
      pdp_start = round(v_mission.ceiling * 0.5, 2),
      pdp_step = greatest(1, round(v_mission.ceiling * 0.05, 2)),
      pdp_interval = 10
    where id = v_mission.id;
  end if;

  insert into status_event (mission_id, status) values (v_mission.id, 'repooled');

  select * into v_mission from mission where id = p_mission_id;
  return v_mission;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. BUSINESS cancel — terminal; supersede pending amendment + release (review fix).
--    (No re-pool, so no 24h window here — this is the fee ramp path, unchanged.)
-- ---------------------------------------------------------------------------
create or replace function business_cancel_mission(
  p_mission_id    uuid,
  p_reason        text    default null,
  p_fare_snapshot numeric default null
) returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid := current_business_id();
  v_mission     mission;
  v_hours       numeric;
  v_pct         numeric;
begin
  if v_business_id is null then raise exception 'Not a dispatcher'; end if;

  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.business_id is distinct from v_business_id then
    raise exception 'Not your mission';
  end if;
  if v_mission.status not in ('pooled','accepted','confirmed','en_route','arrived') then
    raise exception 'This trip can no longer be cancelled';
  end if;

  v_hours := extract(epoch from (v_mission.pickup_at - now())) / 3600.0;
  if v_mission.status = 'pooled' or v_mission.driver_id is null then
    v_pct := 0;
  elsif v_hours > 5 then
    v_pct := 0;
  elsif v_hours < 0 then
    v_pct := 100;
  else
    v_pct := least(100, greatest(50, 50 + 10 * (5 - v_hours)));
  end if;

  insert into mission_cancellation
    (mission_id, business_id, party, actor_driver_id, kind, reason,
     fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in)
  values
    (v_mission.id, v_business_id, 'business', null, 'business_cancel', p_reason,
     v_pct, round(coalesce(p_fare_snapshot, 0) * v_pct / 100, 2), p_fare_snapshot, v_hours, 'terminal');

  -- A terminal cancel must clear any pending negotiation artifact so it can't linger on
  -- a cancelled trip (review fix — business_cancel previously superseded neither).
  update mission_amendment set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';
  update mission_release set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';

  update mission set
    status              = 'cancelled',
    cancelled_by        = 'business',
    cancelled_at        = now(),
    cancellation_reason = p_reason,
    cancellation_fee    = round(coalesce(p_fare_snapshot, 0) * v_pct / 100, 2)
  where id = v_mission.id;

  insert into status_event (mission_id, status) values (v_mission.id, 'cancelled');

  select * into v_mission from mission where id = p_mission_id;
  return v_mission;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. AGREED RELEASE (Driver accepts) — free; 24h re-pool window + lock-order fix.
--    Locks mission → release (matching propose_release) to avoid a deadlock inversion.
-- ---------------------------------------------------------------------------
create or replace function respond_to_release(
  p_release_id uuid,
  p_accept     boolean,
  p_reason     text default null
) returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_driver_id uuid := current_driver_id();
  v_rel       mission_release;
  v_mission   mission;
  v_mid       uuid;
  v_hours     numeric;
begin
  if v_driver_id is null then raise exception 'Not a driver'; end if;

  -- Resolve the target mission WITHOUT locking, then lock mission → release (the same
  -- order propose_release uses) so a concurrent propose-vs-respond can't deadlock.
  select mission_id into v_mid from mission_release where id = p_release_id;
  if v_mid is null then raise exception 'This release request is no longer pending'; end if;

  select * into v_mission from mission where id = v_mid for update;
  if not found or v_mission.driver_id is distinct from v_driver_id then
    raise exception 'Not your mission';
  end if;

  select * into v_rel from mission_release where id = p_release_id for update;
  if not found or v_rel.status <> 'proposed' then
    raise exception 'This release request is no longer pending';
  end if;

  if v_mission.status not in ('accepted','confirmed') then
    raise exception 'This trip can no longer be released';
  end if;

  if p_accept then
    v_hours := extract(epoch from (v_mission.pickup_at - now())) / 3600.0;

    insert into mission_cancellation
      (mission_id, business_id, party, actor_driver_id, kind, reason,
       fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in)
    values
      (v_mission.id, v_mission.business_id, 'business', v_driver_id, 'agreed_release',
       'Released by mutual agreement', 0, 0, v_rel.from_fare, v_hours, 'repooled');

    update mission_amendment set status = 'superseded', responded_at = now()
      where mission_id = v_mission.id and status = 'proposed';

    if v_hours < 24 then
      update mission set
        status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null,
        stops_reached = 0, pooled_at = now(), speed_win = true,
        pdp_start = round(v_mission.ceiling * 0.7, 2),
        pdp_step = greatest(1, round(v_mission.ceiling * 0.05, 2)),
        pdp_interval = 5
      where id = v_mission.id;
    else
      update mission set
        status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null,
        stops_reached = 0, pooled_at = now(), speed_win = false,
        pdp_start = round(v_mission.ceiling * 0.5, 2),
        pdp_step = greatest(1, round(v_mission.ceiling * 0.05, 2)),
        pdp_interval = 10
      where id = v_mission.id;
    end if;

    insert into status_event (mission_id, status) values (v_mission.id, 'repooled');

    update mission_release set status = 'accepted', responded_at = now()
      where id = p_release_id and status = 'proposed';
  else
    update mission_release set status = 'declined', decline_reason = p_reason, responded_at = now()
      where id = p_release_id and status = 'proposed';
  end if;

  if not found then
    raise exception 'This release request is no longer pending';
  end if;

  select * into v_mission from mission where id = v_rel.mission_id;
  return v_mission;
end;
$$;
