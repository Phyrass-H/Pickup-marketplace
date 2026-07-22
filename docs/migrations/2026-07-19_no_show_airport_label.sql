-- 2026-07-19 — No-show airport detection: also read pickup_label (+ lock guest_ready_at)
--
-- Follow-up to 2026-07-19_no_show_clock_origin.sql. Found by the post-fix adversarial
-- review; the defect PRE-DATES that migration (it is in the original
-- 2026-07-13_o7_cancellation.sql) and was simply carried forward.
--
-- THE BUG. Airport pickups were being given the CITY wait window (20 min) instead of the
-- airport one (60 min).
--
-- The airport test read only `pickup_address`. But when a Dispatcher picks an airport from
-- the Mapbox Search Box autocomplete, the POI NAME and the navigable ADDRESS are stored in
-- DIFFERENT columns (2026-06-27_mission_place_labels.sql):
--
--   pickup_address = "19 Rue Costes Et Bellonte, 06200 Nice, France"   ← no keyword
--   pickup_label   = "Aéroport Nice Côte d'Azur, Nice"                 ← keyword, unread
--
-- components/address-autocomplete.tsx prefers `full_address` for the address and derives
-- the short label from the POI name (its own comment uses the airport as the example).
--
-- Concrete failure: Business books an airport pickup from autocomplete and leaves the
-- flight number blank (the form marks it optional). The mission classifies as CITY, so the
-- Driver may report a no-show 40 minutes early — Business charged 100%, mission driven
-- terminal, Guest still at baggage reclaim.
--
-- Why it stayed hidden: app/api/seed writes the keyword straight into pickup_address, so
-- every SEEDED airport mission classifies correctly. Only the real autocomplete path fails.
--
-- Fix: test the label as well. The address disjunct is retained — pickup_label is NULL for
-- seeded, legacy and hand-typed rows. Do NOT "fix" this by writing the POI name into
-- pickup_address; that column is deliberately the navigable address.
--
-- Also hardens the new clock: `guest_ready_at` is a billing-gate input with no client
-- writer (it is written by the flight-tracking feed only), so UPDATE on it is revoked from
-- the browser roles. Without this a Business could PATCH it forward via PostgREST and hold
-- the no-show gate shut indefinitely, leaving the Driver only the 100%-fee cancel.
--
-- Additive + idempotent. Safe to re-run.

-- 1. No browser role may write the clock input. (SECURITY DEFINER RPCs and the service
--    role are unaffected; nothing in app/ or lib/ writes this column.)
revoke update (guest_ready_at) on mission from anon, authenticated;

-- 2. mark_no_show — identical to 2026-07-19_no_show_clock_origin.sql except the airport
--    predicate now also reads pickup_label, and an empty-string flight_number no longer
--    counts as a flight (matching the TS `!!m.flight_number`).
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

  -- Airport pickup = 60 min wait; city = 20 min. Airport is inferred from a flight number
  -- OR an airport-looking pickup address OR the short place label (the autocomplete puts
  -- the POI name there and the street address in pickup_address).
  v_wait := case
              when nullif(v_mission.flight_number, '') is not null
                or v_mission.pickup_address ~* '(a[eé]roport|airport)'
                or coalesce(v_mission.pickup_label, '') ~* '(a[eé]roport|airport)'
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
