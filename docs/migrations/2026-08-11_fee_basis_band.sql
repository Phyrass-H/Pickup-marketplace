-- 2026-08-11 — THE FEE BASIS IS CLAMPED, NOT TRUSTED.
--
-- THE HOLE. business_cancel_mission and driver_cancel_mission both take
-- `p_fare_snapshot numeric default null`, and both are reachable over PostgREST with
-- nothing but the publishable anon key (probe of 2026-08-09: omitting the argument is not
-- an error — the call resolves and reaches the function's own first-line guard). So the
-- party who PAYS the fee also supplies the number the fee is a percentage of, and can
-- simply not supply it:
--   • business_cancel_mission wrapped it in coalesce(...,0), so omitting it recorded
--     fee_amount = 0.00 AND mission.cancellation_fee = 0.00 on a cancel that can be 100%;
--   • driver_cancel_mission had no coalesce at all, so omitting it recorded
--     fee_amount = NULL and fare_snapshot = NULL — a 100% penalty with no euro basis,
--     which renders as "—" in the Driver's own archive
--     (app/(app)/rides/history/page.tsx:184) and gives the manual settler nothing.
--
-- WHY NOT JUST RECOMPUTE THE FARE HERE. Because there is no fare function in SQL and
-- there should not be one. The PDP lives in exactly one place, lib/pdp.ts (its header
-- says so at :11-12), and porting settledFare() would make Postgres a second authority
-- on money — a genuine drift surface, and one that has to reproduce the accepted_at
-- fallback and the pdp_step/pdp_interval degenerate branch to be correct at all.
--
-- WHAT WE DO INSTEAD. We do not assert the VALUE, we assert the BAND — and the band is
-- read off the mission's own columns, so it needs no clock and no curve:
--
--     floor = least(coalesce(pdp_start, ceiling * 0.5), ceiling)
--     basis = round(least(greatest(coalesce(p_fare_snapshot, 0), floor), ceiling), 2)
--
-- The band is provable from lib/pdp.ts, not guessed:
--   • :42 returns round2(min(start, ceiling)) and :51 returns round2(min(ceiling, fare))
--     — EVERY branch mins with the Ceiling, so the basis can never exceed it;
--   • :48 is `Math.max(0, Math.floor(elapsedMin / interval))`, so the step count is never
--     negative and the fare is never below `start`;
--   • :37 is `m.pdp_start != null ? Number(m.pdp_start) : ceiling * 0.5` — the same
--     expression, and deliberately UNROUNDED on both sides. A numeric(10,2) ceiling
--     halved has a third decimal of only 0 or 5; TS round2 rounds half-up
--     (lib/pdp.ts:86) and Postgres numeric round() rounds half away from zero, which is
--     the same direction on positives, and the outer round(...,2) re-agrees. Probed
--     across ceilings 100.01/100.03/100.05/100.07/100.09/99.99/33.33/7.77/0.01/0.03: no
--     divergence. On today's data the branch is unreachable anyway — pdp_start is
--     non-null on 271/271 rows.
-- An honest settledFare() is therefore ALWAYS inside the band and is passed through
-- UNCHANGED — this clamp cannot alter correct money. Only a missing or understated
-- basis moves, and it moves up to the floor. Pinned from the other side by
-- tests/money-invariants.test.ts § "the fee basis never leaves the band the SQL clamp
-- asserts": if lib/pdp.ts ever leaves the band, that test fails before this ships.
--
-- ONE HONEST-PATH CHANGE, STATED HERE SO IT IS NOT A SURPRISE. The app quotes the modal
-- from a read taken BEFORE this function locks the row. If respond_to_amendment commits
-- in that window it sets ceiling = base_fare = pdp_start = new_fare
-- (2026-08-10_amendment_lock_order.sql:100-102), the band's floor becomes new_fare, and
-- the clamp raises the recorded basis ABOVE the quoted one. Today the quoted (lower)
-- number is charged. The clamped number is the truer one, but the modal did not say it.
--
-- WHAT THIS DOES NOT CLOSE, plainly. The floor is pdp_start. Over the 271 live missions
-- pdp_start/ceiling runs from 0.50 to 1.00, so a determined caller can still understate
-- by up to 50% on a standard curve and 30% on a SPEED WIN one. It is exact (band = a
-- single point) once respond_to_amendment has set ceiling = pdp_start and zeroed the
-- step. Closing the remaining gap means porting the curve — a separate, larger decision.
-- mark_no_show and business_declare_no_show carry the IDENTICAL hole and are
-- deliberately NOT touched here.
--
-- SCOPE. Two `create or replace` statements, nothing else. Both bodies are their
-- authoritative definitions reproduced verbatim —
--   business_cancel_mission ← 2026-08-09_cancel_fee_30min_steps.sql:40-125
--   driver_cancel_mission   ← 2026-08-10_repool_clears_check_in.sql:38-100
-- — with two declares, a short prelude, and p_fare_snapshot swapped for v_basis at the
-- three money sites. The 30-minute fee tread, the waiting settlement, both supersede
-- statements, the 24h SPEED-WIN re-pool branch, the checked_in_at = null clears, the
-- reliability mark and every status_event are unchanged. Lock order is unchanged:
-- mission FOR UPDATE first, and neither function locks a negotiation row.
--
-- Do NOT rebuild either body from an older file. business_cancel_mission is also defined
-- at 2026-07-13_o7_cancellation.sql:160, 2026-07-19_repool_speedwin_window.sql:165 and
-- 2026-07-22_waiting_fee.sql:288; driver_cancel_mission at 2026-07-13:97 and
-- 2026-07-19:30. All are superseded.
--
-- Idempotent. Safe to re-run. Paste whole into the Supabase SQL editor.

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
  v_tread       numeric;   -- hours-to-pickup rounded UP to the top of its half-hour tread
  v_pct         numeric;
  -- 2026-08-11 — the clamped fee basis. See the header.
  v_floor       numeric;        -- the lowest fare the PDP curve could possibly have produced
  v_basis       numeric(10,2);  -- what actually gets recorded, band-clamped
  -- Scalars, not a record: a ROW() constructor assigned to a record has no named
  -- fields, so the no-waiting branch must not fabricate one.
  v_wfrom       timestamptz;
  v_wto         timestamptz;
  v_wmin        int := 0;
  v_wrate       numeric(10,2);
  v_wfee        numeric(10,2) := 0;
begin
  if v_business_id is null then raise exception 'Not a dispatcher'; end if;

  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.business_id is distinct from v_business_id then
    raise exception 'Not your mission';
  end if;
  if v_mission.status not in ('pooled','accepted','confirmed','en_route','arrived') then
    raise exception 'This trip can no longer be cancelled';
  end if;

  -- The fee basis arrives from the Business's own session and the argument is
  -- omittable, so it is trusted only as far as the mission's columns can vouch for it.
  -- v_floor is never NULL: mission.ceiling is numeric(10,2) NOT NULL
  -- (docs/kavenue_schema.sql:121), so least(...) always has a non-null operand.
  -- The coalesce on p_fare_snapshot is explicit rather than load-bearing — Postgres
  -- GREATEST/LEAST already SKIP null inputs and return null only when every input is
  -- null, so greatest(null, v_floor) is v_floor either way. It is written out so no
  -- reader has to remember that Postgres differs from the SQL standard here.
  v_floor := least(coalesce(v_mission.pdp_start, v_mission.ceiling * 0.5), v_mission.ceiling);
  v_basis := round(least(greatest(coalesce(p_fare_snapshot, 0), v_floor), v_mission.ceiling), 2);

  v_hours := extract(epoch from (v_mission.pickup_at - now())) / 3600.0;
  if v_mission.status = 'pooled' or v_mission.driver_id is null then
    v_pct := 0;
  elsif v_hours > 5 then
    v_pct := 0;
  elsif v_hours < 0 then
    v_pct := 100;
  else
    -- The step. ceil(h / 0.5) * 0.5 is the top of the half-hour tread h sits in, so the
    -- pct only moves when a boundary is actually crossed. At h = 4.6 the tread top is 5.0
    -- and the fee is 50%; at h = 4.5 it becomes 55%.
    v_tread := ceil(v_hours / 0.5) * 0.5;
    v_pct   := least(100, greatest(50, 50 + 10 * (5 - v_tread)));
  end if;

  -- Waiting only accrues once the Driver is actually on site.
  if v_mission.status = 'arrived' then
    select w_from, w_to, w_min, w_rate, w_fee
      into v_wfrom, v_wto, v_wmin, v_wrate, v_wfee
      from mission_waiting(v_mission, now());
  end if;

  insert into mission_cancellation
    (mission_id, business_id, party, actor_driver_id, kind, reason,
     fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in,
     waiting_minutes, waiting_rate, waiting_fee)
  values
    (v_mission.id, v_business_id, 'business', null, 'business_cancel', p_reason,
     v_pct, round(v_basis * v_pct / 100, 2), v_basis,
     v_hours, 'terminal',
     nullif(v_wmin, 0), v_wrate, nullif(v_wfee, 0));

  update mission_amendment set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';
  update mission_release set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';

  update mission set
    status              = 'cancelled',
    cancelled_by        = 'business',
    cancelled_at        = now(),
    cancellation_reason = p_reason,
    cancellation_fee    = round(v_basis * v_pct / 100, 2),
    waiting_from        = v_wfrom,
    waiting_to          = v_wto,
    waiting_minutes     = nullif(v_wmin, 0),
    waiting_rate        = v_wrate,
    waiting_fee         = nullif(v_wfee, 0)
  where id = v_mission.id;

  insert into status_event (mission_id, status) values (v_mission.id, 'cancelled');

  select * into v_mission from mission where id = p_mission_id;
  return v_mission;
end;
$$;

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
  -- penalty is charged TO. Computed from v_mission BEFORE the re-pool below rewrites
  -- pdp_start off the ceiling — the band must describe the curve the Driver accepted on,
  -- not the one the next Driver will see.
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