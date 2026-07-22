-- 2026-07-19 — No-show clock origin correction (O7 / D45 amendment)
--
-- THE BUG. The free-wait countdown was anchored to the DRIVER's arrival — the latest
-- status_event('arrived') — in both the client and mark_no_show(). That is the wrong
-- party. The free wait is the GUEST's grace period, so it must run from when the Guest
-- was due to be available, never from when the Driver happened to tap "I've arrived".
--
-- Because advanceStatus() gates the confirmed → en_route → arrived walk on SEQUENCING
-- ONLY (no time check), a Driver could tap through ~33h before pickup, wait out the 20
-- minute city window, and file a no-show: the Business charged the full fare a day and a
-- half early, the mission driven terminal, the Guest stranded. Anchoring the clock to the
-- pickup time closes that, because the window can no longer elapse before the trip.
--
-- THE RULE (founder, 2026-07-19):
--   guest_due  := coalesce(mission.guest_ready_at, mission.pickup_at)
--   eligible   := greatest(guest_due + wait, arrived_at + 5 min)
--   wait        = 60 min airport / 20 min city   (UNCHANGED — only the origin moves)
--
--   · Driver arrives EARLY  → the clock still starts at the ordered pickup time.
--   · Airport               → guest_ready_at (a tracked landing-derived instant) overrides
--                             pickup_at once flight tracking lands. Always NULL until then,
--                             so behaviour today is pure pickup_at.
--   · Driver arrives LATE   → the 5-minute on-site floor stops an instant filing. It never
--                             binds for an on-time Driver.
--
-- 'arrived' remains a PRECONDITION to report (a timestamped on-site attestation, and the
-- dispute trail per D45) — it is simply no longer the clock ORIGIN. Gate ≠ origin.
--
-- Also fixes hours_before_pickup, which was hardcoded to 0 on no-show rows while all four
-- other cancellation kinds computed it — blanking the audit trail exactly where it is
-- needed to police this rule.
--
-- Additive + idempotent. Safe to re-run.

-- 1. The flight-tracking hook. NULL until a landing feed writes it; deliberately NOT
--    mission.flight_eta, which is documented display-only — wiring a billing gate to a
--    display column is how this bug happens a second time.
alter table mission
  add column if not exists guest_ready_at timestamptz;

comment on column mission.guest_ready_at is
  'Tracked instant the Guest actually became available (e.g. flight landed + deplaning). '
  'Overrides pickup_at as the no-show free-wait origin when set. NULL until flight '
  'tracking is integrated. Written by the tracking feed only — never by the Business.';

-- 2. mark_no_show — same signature, same preconditions, corrected clock.
create or replace function mark_no_show(
  p_mission_id    uuid,
  p_fare_snapshot numeric default null
) returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_driver_id uuid := current_driver_id();
  v_mission   mission;
  v_arrived   timestamptz;
  v_wait      interval;
  v_guest_due timestamptz;
  v_floor     constant interval := interval '5 minutes';
begin
  if v_driver_id is null then raise exception 'Not a driver'; end if;

  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.driver_id is distinct from v_driver_id then
    raise exception 'Not your mission';
  end if;
  if v_mission.status <> 'arrived' then
    raise exception 'You can only report a no-show once you have arrived at the pickup';
  end if;

  select max(created_at) into v_arrived
    from status_event where mission_id = p_mission_id and status = 'arrived';
  if v_arrived is null then
    raise exception 'You can only report a no-show once you have arrived at the pickup';
  end if;

  -- Airport pickup = 60 min wait; city = 20 min. Airport is inferred from a flight
  -- number OR an airport-looking pickup address (Businesses don't always give a flight #).
  v_wait := case
              when v_mission.flight_number is not null
                or v_mission.pickup_address ~* '(a[eé]roport|airport)'
              then interval '60 minutes'
              else interval '20 minutes'
            end;

  -- The Guest's grace period runs from when the GUEST was due, not from the Driver.
  v_guest_due := coalesce(v_mission.guest_ready_at, v_mission.pickup_at);

  if now() < v_guest_due + v_wait then
    raise exception 'The free wait window has not elapsed yet';
  end if;

  -- On-site floor: a Driver arriving after the window already closed still has to be
  -- present for a few minutes before filing.
  if now() < v_arrived + v_floor then
    raise exception 'Give it a few minutes on site before reporting a no-show';
  end if;

  insert into mission_cancellation
    (mission_id, business_id, party, actor_driver_id, kind, reason,
     fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in)
  values
    (v_mission.id, v_mission.business_id, 'driver', v_driver_id, 'no_show', 'Guest did not show',
     100, p_fare_snapshot, p_fare_snapshot,
     extract(epoch from (v_mission.pickup_at - now())) / 3600.0,
     'terminal');

  update mission set
    status     = 'completed',
    no_show    = true,
    no_show_at = now()
  where id = v_mission.id;

  insert into status_event (mission_id, status) values (v_mission.id, 'no_show');

  select * into v_mission from mission where id = p_mission_id;
  return v_mission;
end;
$$;
