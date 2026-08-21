-- 2026-08-22 — THE §6 CURVE: stop the re-pool from overwriting the opening price.
--
-- WHAT CHANGED IN THE APP (lib/pdp.ts). The PDP no longer climbs in fixed steps
-- from a fraction of the Ceiling. It opens at the trip's FLOOR, moves by an equal
-- amount every time the time remaining to the PICKUP halves, and lands exactly on
-- the Ceiling at T−5h (docs/06 §6). Step times are log-spaced then jittered from a
-- seed made of the mission id, so the schedule is unguessable but replayable.
--
-- WHAT THAT MEANS FOR THIS FILE. `mission.pdp_start` keeps its exact meaning — the
-- price the auction opens at — but the number in it is now the RATE-CARD FLOOR in
-- Course space, snapshot by createMission from the same mission_price() call that
-- enforces the floor guard. It is written once, at creation, and must survive
-- everything that happens afterwards.
--
--   ⚑ THE THREE RE-POOL RPCs BELOW USED TO OVERWRITE IT with round(ceiling * 0.7)
--     or round(ceiling * 0.5). Under the old curve that WAS the opening price, so
--     rewriting it was the whole mechanism. Under the §6 curve it would erase the
--     floor the first time a Driver walked away from a trip, and the re-pooled trip
--     would open at half its Ceiling instead of at its floor — permanently, since
--     nothing recomputes it. That is the only defect this migration fixes.
--
-- SPEED WIN is unaffected and still flips here: under 24h to pickup it goes on, at
-- 24h or more it goes off (§6). Its hotter 70%-of-Ceiling opening is DERIVED on read
-- from `speed_win`, never stored, which is precisely what lets it be turned on and
-- off without losing the floor underneath.
--
-- `pdp_step` and `pdp_interval` are dead: the step COUNT now falls out of the gap
-- (~one step per €2, 8..60) and the step TIMES out of the mission id. The columns
-- are LEFT IN PLACE, holding whatever the archive already holds, and are no longer
-- written by anything. Nothing reads them.
--
-- ⚑ NOT TOUCHED, ON PURPOSE:
--   • The fee-basis band `least(coalesce(pdp_start, ceiling * 0.5), ceiling)`
--     (2026-08-11_fee_basis_band.sql) is byte-identical here. It still describes the
--     legitimate range of a fare — it just describes it more accurately now, because
--     pdp_start is a real floor rather than a flat 50%. The `coalesce` is what keeps
--     every pre-curve row reading exactly as it always did.
--   • `respond_to_amendment` still freezes an agreed fare by collapsing the curve
--     (ceiling = base_fare = pdp_start = new_fare). Zero gap, nothing to climb —
--     currentFare() returns the agreed total unchanged. Verified by
--     tests/money-invariants.test.ts.
--
-- The three functions are reproduced VERBATIM from their live definitions —
-- driver_cancel_mission from 2026-08-11_fee_basis_band.sql, reclaim_mission and
-- respond_to_release from 2026-08-10_repool_clears_check_in.sql — with only the
-- three pdp_* assignments removed from each re-pool UPDATE. Nothing else moved.
--
-- Additive and idempotent. Run in the Supabase SQL editor.

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
  -- 2026-08-11 — the clamped fee basis. See the header.
  v_floor     numeric;
  v_basis     numeric(10,2);
begin
  if v_driver_id is null then raise exception 'Not a driver'; end if;

  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.driver_id is distinct from v_driver_id then
    raise exception 'Not your mission';
  end if;
  if v_mission.status not in ('accepted','confirmed','en_route','arrived') then
    raise exception 'This trip can no longer be cancelled';
  end if;

  -- Same clamp as business_cancel_mission, and here the caller is the party the 100%
  -- penalty is charged TO. As of the §6 curve the re-pool below no longer touches
  -- pdp_start, so the band describes the same floor before and after — but it is still
  -- read from v_mission, taken under the row lock, so the ordering cannot drift.
  v_floor := least(coalesce(v_mission.pdp_start, v_mission.ceiling * 0.5), v_mission.ceiling);
  v_basis := round(least(greatest(coalesce(p_fare_snapshot, 0), v_floor), v_mission.ceiling), 2);

  v_hours := extract(epoch from (v_mission.pickup_at - now())) / 3600.0;

  insert into mission_cancellation
    (mission_id, business_id, party, actor_driver_id, kind, reason,
     fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in)
  values
    (v_mission.id, v_mission.business_id, 'driver', v_driver_id, 'driver_cancel', p_reason,
     100, v_basis, v_basis, v_hours, 'repooled');

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
      stops_reached = 0, pooled_at = now(), speed_win = true
    where id = v_mission.id;
  else
    update mission set
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
      stops_reached = 0, pooled_at = now(), speed_win = false
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
      stops_reached = 0, pooled_at = now(), speed_win = true
    where id = v_mission.id;
  else
    update mission set
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
      stops_reached = 0, pooled_at = now(), speed_win = false
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
        stops_reached = 0, pooled_at = now(), speed_win = true
      where id = v_mission.id;
    else
      update mission set
        status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
        stops_reached = 0, pooled_at = now(), speed_win = false
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
