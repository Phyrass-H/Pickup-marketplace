-- 2026-07-22 — Airport detection must survive the accent in "Aéroport"
--
-- THE BUG (found by a controlled live probe, not by reading). The airport predicate used a
-- bracket expression with a multibyte character:
--
--     pickup_label ~* '(a[eé]roport|airport)'
--
-- Postgres' case-insensitive regex does NOT reliably match a multibyte character inside a
-- bracket expression. Proven against the live DB with three identical missions, due 30 min
-- ago, differing only in the label:
--
--     "Aéroport Nice Côte d'Azur, Nice"  → NOT detected → city 20 min   ← WRONG
--     null                                → not detected → city 20 min   (control)
--     "Nice Airport, Nice"                → detected     → airport 60 min ✓
--
-- The é was sent PRECOMPOSED (U+00E9) — the same JS regex matches it fine — so this is a
-- Postgres regex behaviour, not an encoding problem in the caller.
--
-- WHY IT MATTERS. "Aéroport Nice Côte d'Azur" is exactly what the Mapbox autocomplete
-- returns for the region's main airport, so in practice EVERY accented airport pickup
-- without a flight number has been getting the 20-minute city courtesy wait instead of 60.
-- A Driver could report a no-show 40 minutes early while the Guest was still in baggage
-- reclaim. Latent since 2026-07-13; the pickup_label fix on 2026-07-19 did not cure it
-- because it reused the same bracket expression.
--
-- THE FIX. Drop the bracket expression and match the ASCII substring 'roport', which is
-- present in aéroport / aeroport / Aéroport / Aeroporto (IT) regardless of accent, case or
-- Unicode normalisation (NFC vs NFD) — plus 'airport' for English. No extension, no
-- normalize() call, nothing locale-dependent.
--
-- Mirrored in lib/cancellation.ts (AIRPORT_RE).
--
-- Idempotent. Safe to re-run.

-- The single source of the rule. Everything else calls this so the three settlement paths
-- and the waiting helper cannot drift apart again.
create or replace function mission_is_airport(p_mission mission)
returns boolean
language sql immutable set search_path = public as $$
  select nullif(p_mission.flight_number, '') is not null
      or p_mission.pickup_address           ~* '(roport|airport)'
      or coalesce(p_mission.pickup_label,'') ~* '(roport|airport)';
$$;

-- mission_waiting — same as 2026-07-22_waiting_fee.sql, now delegating the predicate.
create or replace function mission_waiting(p_mission mission, p_at timestamptz)
returns table (w_from timestamptz, w_to timestamptz, w_min int, w_rate numeric, w_fee numeric)
language plpgsql immutable set search_path = public as $$
declare
  v_rate      constant numeric(10,2) := 1.00;  -- D48 — PROVISIONAL, research owed
  v_airport   boolean := mission_is_airport(p_mission);
  v_wait      interval;
  v_ceiling   interval;
  v_guest_due timestamptz;
begin
  v_wait    := case when v_airport then interval '60 minutes' else interval '20 minutes' end;
  v_ceiling := case when v_airport then interval '120 minutes' else interval '60 minutes' end;
  v_guest_due := coalesce(p_mission.guest_ready_at, p_mission.pickup_at);

  w_from := v_guest_due + v_wait;
  w_to   := least(p_at, v_guest_due + v_ceiling);
  w_rate := v_rate;
  w_min  := greatest(0, ceil(extract(epoch from (w_to - w_from)) / 60.0))::int;
  w_fee  := round(w_min * v_rate, 2);
  return next;
end;
$$;

-- mark_no_show — identical to 2026-07-22_waiting_fee.sql except the predicate.
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
  v_w         record;
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

  v_wait := case when mission_is_airport(v_mission)
                 then interval '60 minutes' else interval '20 minutes' end;
  v_guest_due := coalesce(v_mission.guest_ready_at, v_mission.pickup_at);

  if now() < v_guest_due + v_wait then
    raise exception 'The courtesy wait has not elapsed yet';
  end if;
  if now() < v_arrived + v_floor then
    raise exception 'Give it a few minutes on site before reporting a no-show';
  end if;

  select * into v_w from mission_waiting(v_mission, now());

  insert into mission_cancellation
    (mission_id, business_id, party, actor_driver_id, kind, reason,
     fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in,
     waiting_minutes, waiting_rate, waiting_fee)
  values
    (v_mission.id, v_mission.business_id, 'driver', v_driver_id, 'no_show', 'Guest did not show',
     100, p_fare_snapshot, p_fare_snapshot,
     extract(epoch from (v_mission.pickup_at - now())) / 3600.0, 'terminal',
     v_w.w_min, v_w.w_rate, v_w.w_fee);

  update mission_amendment set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';
  update mission_release set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';

  update mission set
    status          = 'completed',
    no_show         = true,
    no_show_at      = now(),
    no_show_by      = 'driver',
    waiting_from    = v_w.w_from,
    waiting_to      = v_w.w_to,
    waiting_minutes = v_w.w_min,
    waiting_rate    = v_w.w_rate,
    waiting_fee     = v_w.w_fee
  where id = v_mission.id;

  insert into status_event (mission_id, status) values (v_mission.id, 'no_show');

  select * into v_mission from mission where id = p_mission_id;
  return v_mission;
end;
$$;

-- business_declare_no_show — identical except the predicate.
create or replace function business_declare_no_show(
  p_mission_id    uuid,
  p_fare_snapshot numeric default null
) returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid := current_business_id();
  v_mission     mission;
  v_wait        interval;
  v_guest_due   timestamptz;
  v_w           record;
begin
  if v_business_id is null then raise exception 'Not a dispatcher'; end if;

  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.business_id is distinct from v_business_id then
    raise exception 'Not your mission';
  end if;
  if v_mission.status <> 'arrived' then
    raise exception 'You can only stop the wait once the Driver is at the pickup';
  end if;

  v_wait := case when mission_is_airport(v_mission)
                 then interval '60 minutes' else interval '20 minutes' end;
  v_guest_due := coalesce(v_mission.guest_ready_at, v_mission.pickup_at);

  if now() < v_guest_due + v_wait then
    raise exception 'The courtesy wait has not elapsed yet';
  end if;

  select * into v_w from mission_waiting(v_mission, now());

  insert into mission_cancellation
    (mission_id, business_id, party, actor_driver_id, kind, reason,
     fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in,
     waiting_minutes, waiting_rate, waiting_fee)
  values
    (v_mission.id, v_business_id, 'business', v_mission.driver_id, 'business_no_show',
     'Business stopped the wait — Guest not coming',
     100, p_fare_snapshot, p_fare_snapshot,
     extract(epoch from (v_mission.pickup_at - now())) / 3600.0, 'terminal',
     v_w.w_min, v_w.w_rate, v_w.w_fee);

  update mission_amendment set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';
  update mission_release set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';

  update mission set
    status          = 'completed',
    no_show         = true,
    no_show_at      = now(),
    no_show_by      = 'business',
    waiting_from    = v_w.w_from,
    waiting_to      = v_w.w_to,
    waiting_minutes = v_w.w_min,
    waiting_rate    = v_w.w_rate,
    waiting_fee     = v_w.w_fee
  where id = v_mission.id;

  insert into status_event (mission_id, status) values (v_mission.id, 'no_show');

  select * into v_mission from mission where id = p_mission_id;
  return v_mission;
end;
$$;
