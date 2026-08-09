-- Re-pool clears the previous Driver's check-in (§ H2 drift audit, 2026-08-09).
--
-- THE BUG. Three RPCs hand a trip back to the Pool — driver_cancel_mission,
-- reclaim_mission and respond_to_release (accept) — and all six of their re-pool
-- UPDATEs null out accepted_at / confirmed_at / stops_reached but never
-- checked_in_at. So Driver B accepts a trip that already carries Driver A's D61
-- check-in, and:
--   • lib/dispatch-status.ts:124 returns "Checked in" for the Business, and
--     because that branch returns first it also suppresses the red "Not checked
--     in" wash — the exact D61 signal the founder asked for;
--   • checkInOpen() is false, so Driver B is never shown the check-in button;
--   • the My Rides count badge (app/(app)/layout.tsx) filters on checked_in_at
--     is null, so the trip never appears in it.
-- Net: the Business is told a Driver confirmed when nobody has, and the new
-- Driver is never asked to.
--
-- THE FIX. A create-or-replace of the three functions exactly as they stand in
-- 2026-07-19_repool_speedwin_window.sql (their authoritative definition — nothing
-- later redefines them) with ONE token added to each of the six re-pool UPDATEs:
--   "accepted_at = null, confirmed_at = null,"
--     becomes
--   "accepted_at = null, confirmed_at = null, checked_in_at = null,"
-- Nothing else differs. The bodies below were extracted mechanically from that
-- file, so the 24h SPEED-WIN branches, the fee arithmetic, the supersede rules
-- and the audit inserts are byte-identical.
--
-- business_cancel_mission is deliberately NOT here: it is terminal (no re-pool),
-- and it now lives in 2026-08-09_cancel_fee_30min_steps.sql — re-creating the
-- 2026-07-19 copy would roll back the 30-minute fee step.
--
-- accept_mission is deliberately NOT touched either: clearing on the way OUT is
-- both earlier and sufficient, and re-creating it would mean copying its whole
-- expiry-guarded body for no gain.
--
-- Additive and idempotent: three `create or replace` statements plus one scoped
-- data repair. Safe to re-run. Run once in the Supabase SQL editor.

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
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
      stops_reached = 0, pooled_at = now(), speed_win = true,
      pdp_start = round(v_mission.ceiling * 0.7, 2),
      pdp_step = greatest(1, round(v_mission.ceiling * 0.05, 2)),
      pdp_interval = 5
    where id = v_mission.id;
  else
    update mission set
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
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
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
      stops_reached = 0, pooled_at = now(), speed_win = true,
      pdp_start = round(v_mission.ceiling * 0.7, 2),
      pdp_step = greatest(1, round(v_mission.ceiling * 0.05, 2)),
      pdp_interval = 5
    where id = v_mission.id;
  else
    update mission set
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
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
        status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
        stops_reached = 0, pooled_at = now(), speed_win = true,
        pdp_start = round(v_mission.ceiling * 0.7, 2),
        pdp_step = greatest(1, round(v_mission.ceiling * 0.05, 2)),
        pdp_interval = 5
      where id = v_mission.id;
    else
      update mission set
        status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
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
-- ---------------------------------------------------------------------------
-- One-shot repair for rows already corrupted by the old behaviour.
-- ---------------------------------------------------------------------------
-- Precise, because status_event('repooled') is written in the SAME transaction
-- as the re-pool: a check-in older than the last repool event belongs to the
-- Driver who left. A Driver who has legitimately checked in SINCE the re-pool
-- has a later timestamp and is left alone, so no status filter is needed.
update mission m set checked_in_at = null
where m.checked_in_at is not null
  and exists (
    select 1 from status_event e
    where e.mission_id = m.id
      and e.status = 'repooled'
      and e.created_at > m.checked_in_at
  );
