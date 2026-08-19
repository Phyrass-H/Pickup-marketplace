-- 2026-08-18 — the waiting rate is PER SERVICE CLASS (docs/06 §10, S62)
--
-- THE CHANGE. `mission_waiting()` charged a flat 1,00 €/min whatever was booked. It now
-- charges 0,50 on Eco, 0,75 on Business and 1,00 on First. Nothing else about the meter
-- moves: the courtesy wait (20 min city / 60 min airport), the money ceiling (60 / 120 min
-- from when the Guest was due) and "per minute STARTED" are all untouched.
--
-- WHY NOT A PERCENTAGE OF THE FARE. The founder's objection to the flat rate was that 1 €/min
-- is punishing on a 40 € trip and trivial on a 500 € one. A market scan (docs/06 §10 records
-- it with sources) found that NO operator anywhere scales waiting with the fare — every one
-- that publishes a rate tiers it by vehicle class, which is the same lever, because a 40 €
-- trip is an Eco job and a 500 € trip is a First one. Uber holds its wait rate out of surge
-- for exactly this reason. Calibrated against the French regulated taxi tariff — the only
-- legally fixed number in this market, 42,15 €/h nationally and 34,55 €/h (0,58 €/min) in the
-- Alpes-Maritimes — and against FREE NOW, which charges precisely 0,50 and 0,75.
--
-- ⚑ THESE ARE COURSE-SIDE NUMBERS. `mission.waiting_rate` is numeric(10,2). The
-- Business-facing figure deliberately is NOT the round one: showing a Business "0,50 €/min"
-- would mean storing 0,43, which displays 0,49 and bills 9,89 € for twenty minutes. Stored
-- this way the arithmetic is exact at every duration — 20 min → 10,00 course, 11,50 to the
-- Business, 8,80 to the Driver.
--
-- ⚑ THE CAP IS IN MINUTES, NOT EUROS, and always was: 40 paid minutes in the city, 60 at an
-- airport. So the euro ceiling now follows the class down — Eco tops out at 20,00 (23,00 to
-- the Business) where it used to reach 40,00. That is the point of the change, not a
-- side-effect. Most of the market caps the same way, in minutes rather than money.
--
-- ⚑ NO ROW IS RE-PRICED. Every settlement path stamps `waiting_rate` onto the row it writes
-- (mission.waiting_rate, mission_cancellation.waiting_rate), so a trip that has already run
-- keeps the rate that applied on its day. This function only prices trips settled from now on.
--
-- ⚑ MIRRORED IN `lib/cancellation.ts` — `WAITING_RATE_PER_MIN` holds the same three numbers.
-- The display and the charge are two copies on purpose (docs/06 §13). Change one, change the
-- other, or a Business is quoted a rate it is not billed.
--
-- ⚠️ THE RATES ARE STILL PROVISIONAL (D48 · BACKLOG § N) pending the founder's sign-off.
--
-- Supersedes the definition in docs/migrations/2026-07-22_airport_accent_fix.sql, which is
-- otherwise reproduced verbatim — only `v_rate` changes.
--
--   Run in the Supabase SQL editor. Additive to behaviour, no schema change, no data written.

create or replace function mission_waiting(p_mission mission, p_at timestamptz)
returns table (w_from timestamptz, w_to timestamptz, w_min int, w_rate numeric, w_fee numeric)
language plpgsql immutable set search_path = public as $$
declare
  -- Per class since S62. `van` is vestigial in the taxonomy (body type moved to
  -- required_body_type; BACKLOG § X retires the enum value) and falls to the Business rate
  -- with everything else, so an unexpected row is never charged nothing.
  v_rate      constant numeric(10,2) := case p_mission.category
                                          when 'eco'    then 0.50
                                          when 'luxury' then 1.00
                                          else 0.75
                                        end;
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

-- ---------------------------------------------------------------------------
-- Verify (read-only — run these after, nothing is written)
-- ---------------------------------------------------------------------------
--
-- -- 1. The three rates on 40 paid minutes in the city. One real mission per class:
-- select distinct on (m.category)
--        m.category, w.w_min, w.w_rate, w.w_fee
--   from mission m
--   cross join lateral mission_waiting(m, m.pickup_at + interval '60 minutes') w
--  where nullif(m.flight_number, '') is null
--  order by m.category, m.created_at desc;
-- -- expect w_min 40, and w_rate/w_fee = 0.50/20.00 (eco) · 0.75/30.00 (business)
-- --        · 1.00/40.00 (luxury = First)
--
-- -- 2. Nothing already settled moved — every stamped row keeps its own rate:
-- select waiting_rate, count(*) from mission where waiting_fee is not null group by 1;
-- -- expect the pre-existing rows to still read 1.00
--
-- -- 3. Still IMMUTABLE and still not security definer:
-- select provolatile, prosecdef from pg_proc where proname = 'mission_waiting';
-- -- expect 'i' and false
