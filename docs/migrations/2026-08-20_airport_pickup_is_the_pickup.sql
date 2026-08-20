-- 2026-08-20 — a flight number alone is not an airport PICKUP
--
-- THE BUG. `mission_is_airport` answered true for any trip carrying a flight number. That
-- is right for an arrival and wrong for a DEPARTURE — a hotel → airport run carries the
-- number of the flight the Guest is catching, and its pickup is a hotel door. Every one of
-- those was getting the airport courtesy wait: 60 free minutes instead of 20, and a money
-- ceiling of 120 minutes instead of 60. The Driver waited 40 extra minutes unpaid.
--
-- Measured on the live data the day this was written: of 89 missions carrying a flight
-- number, 37 were arrivals (pickup at the airport) and **52 were departures**. The majority
-- of the affected trips were being priced on the wrong side of the rule.
--
-- THE RULE, in order. The flight number still has to count for something, because an
-- arrival's pickup address is frequently "Terminal 2, 06200 Nice" with no airport word in
-- it at all:
--   1. the PICKUP says airport                          → true  (an arrival)
--   2. the DROP-OFF says airport and the pickup does not → false (a departure)
--   3. a flight number and neither end named             → true  (an unlabelled terminal)
--
-- ⚑ `(roport|airport)` and not `(aéroport|airport)` — deliberately. The accent is a
-- multibyte character whose normalisation (NFC vs NFD) differs by source, and a bracket
-- expression over it silently failed inside Postgres. See 2026-07-22_airport_accent_fix.sql.
--
-- ⚑ MIRRORED in `isAirportPickup` in lib/cancellation.ts. Two copies on purpose.
--
-- ⚑ NOTHING ALREADY SETTLED CHANGES. waiting_from / waiting_to / waiting_minutes /
-- waiting_rate / waiting_fee are stamped onto the row when a trip settles, and this function
-- is only consulted while a meter is live. A trip that has already run keeps its figures.
--
--   Run in the Supabase SQL editor. One function, no schema change, no rows written.

create or replace function mission_is_airport(p_mission mission)
returns boolean
language sql immutable set search_path = public as $$
  select case
    when p_mission.pickup_address            ~* '(roport|airport)'
      or coalesce(p_mission.pickup_label,'')  ~* '(roport|airport)' then true
    when p_mission.dropoff_address           ~* '(roport|airport)'
      or coalesce(p_mission.dropoff_label,'') ~* '(roport|airport)' then false
    else nullif(p_mission.flight_number, '') is not null
  end;
$$;

-- ---------------------------------------------------------------------------
-- Verify (read-only)
-- ---------------------------------------------------------------------------
--
-- -- 1. How the flight-number trips split now. Expect the departures to read false:
-- select mission_is_airport(m) as airport_pickup, count(*)
--   from mission m
--  where nullif(m.flight_number, '') is not null
--  group by 1;
--
-- -- 2. Spot-check a departure — expect false:
-- select m.pickup_address, m.dropoff_address, mission_is_airport(m)
--   from mission m
--  where nullif(m.flight_number,'') is not null
--    and m.pickup_address !~* '(roport|airport)'
--  limit 5;
--
-- -- 3. Nothing settled moved:
-- select count(*) from mission where waiting_fee is not null;   -- unchanged
