-- 2026-08-22 (third migration of the day) — THE FEE-BASIS BAND MUST CLAMP TO THE
-- PRICE THE CURVE CAN ACTUALLY PRODUCE, NOT TO THE STORED FLOOR.
--
-- ⚑ APPLY 2026-08-22_pdp_curve.sql AND 2026-08-22_accepted_fare.sql FIRST.
--
-- THE DEFECT, found by an adversarial review of the curve diff. Since the §6
-- curve, SPEED WIN's hotter opening is DERIVED on read rather than stored:
--
--     openingPrice(m) = m.speed_win ? max(pdp_start, ceiling × 0.70) : pdp_start
--
-- That is deliberate — it is what lets a re-pool turn SPEED WIN on and off
-- without ever losing the floor underneath ([[d79]]). But the SQL fee-basis band
-- was left reading the STORED number:
--
--     v_floor := least(coalesce(pdp_start, ceiling * 0.5), ceiling)
--
-- On a SPEED WIN trip those two now disagree. The curve can never produce a fare
-- below 70 % of the Ceiling, yet the band went on accepting anything above the
-- floor — so the guard stopped guarding the gap between them.
--
--   Worked example. SPEED WIN trip, Ceiling 100 Course, stored floor 30.
--   The curve's lowest possible fare is 70. A Business cancelling at T−2h owes
--   75 % of its fare. Honest basis 80 → fee 60,00. A forged basis of 30 is
--   clamped to… 30, and the fee becomes 22,50. Before the curve shipped,
--   pdp_start held 70 on a SPEED WIN trip and the same forgery was clamped to
--   70 → 52,50. The band lost 30 € of protection on that one trip.
--
-- THE FIX. One `immutable` function, `mission_opening_price(mission)`, that is a
-- line-for-line mirror of `openingPrice()` in lib/pdp.ts, and the band calls it.
-- Deliberately a FUNCTION and not an inlined expression: it takes a `mission`
-- composite, so PostgREST can call it, and .local/probe/diff-sql-vs-lib.ts checks
-- it against the TypeScript on every run — the same treatment mission_is_airport
-- and mission_waiting already get. The two halves cannot drift silently again.
--
-- ⚑ The `coalesce(pdp_start, ceiling * 0.5)` fallback is preserved exactly, so
-- every pre-curve row still reads precisely as it always did.
--
-- NOT TOUCHED: mark_no_show, which has never clamped (its basis comes from a
-- different path) and keeps a `v_floor` of its own meaning FIVE ON-SITE MINUTES —
-- an unrelated variable that happens to share the name. Do not "unify" them.
--
-- Additive and idempotent. Run in the Supabase SQL editor.

begin;

-- Mirrors openingPrice() in lib/pdp.ts. Keep the two in step; the probe checks it.
create or replace function mission_opening_price(p_mission mission)
returns numeric
language sql
immutable
as $$
  select least(
    case
      when p_mission.speed_win
        then greatest(coalesce(p_mission.pdp_start, p_mission.ceiling * 0.5),
                      p_mission.ceiling * 0.70)
      else coalesce(p_mission.pdp_start, p_mission.ceiling * 0.5)
    end,
    p_mission.ceiling)
$$;

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
  v_floor := mission_opening_price(v_mission);
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
  -- penalty is charged TO. As of the §6 curve the re-pool below no longer touches
  -- pdp_start, so the band describes the same floor before and after — but it is still
  -- read from v_mission, taken under the row lock, so the ordering cannot drift.
  v_floor := mission_opening_price(v_mission);
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
      pdp_start = greatest(v_mission.pdp_start, v_mission.accepted_fare),
      accepted_fare = null
    where id = v_mission.id;
  else
    update mission set
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
      stops_reached = 0, pooled_at = now(), speed_win = false,
      pdp_start = greatest(v_mission.pdp_start, v_mission.accepted_fare),
      accepted_fare = null
    where id = v_mission.id;
  end if;

  insert into status_event (mission_id, status) values (v_mission.id, 'repooled');

  select * into v_mission from mission where id = p_mission_id;
  return v_mission;
end;
$$;

commit;
