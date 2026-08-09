-- 2026-08-09 — The Business cancellation fee moves in HALF-HOUR STEPS, not on a slope.
--
-- WHY. The ramp was continuous: pct = 50 + 10 * (5 - hours_to_pickup), recomputed from
-- now() at execution. Two problems, both found by the § H2 write test on 2026-08-09.
--
--   1. The quote was never the charge. The cancel modal reads the CLIENT clock (and only
--      re-ticked every 30 s); this function reads the SERVER clock when it runs. Measured
--      live against the real RPC: over a 30-second dwell the charge exceeded the quoted
--      figure by 0,06 € on a 70 € trip and 0,41 € on a 480 € one. Always upward — the
--      slope only climbs — so the Business is always charged more than the screen said.
--
--   2. A slope cannot be explained. "Cancel before 14:30 and it is 60%" fits on a card.
--      "The fee rises at ten points an hour" does not, and the modal's own reference row
--      has always DRAWN the rule as steps while the maths was a line.
--
-- THE RULE NOW. Free while pooled or more than 5 h out. From T−5h: 50%, then +5 points
-- every half hour, reaching 100% at pickup. Rounding is in the BUSINESS's favour — the
-- cheaper rate holds until the boundary is genuinely crossed, so 50% runs all the way to
-- T−4h30 rather than expiring at T−4h59. Inside a tread the fee is CONSTANT, which is
-- what makes the quoted number and the charged number the same number.
--
-- The half-hour landmarks are unchanged from the old slope — 5h → 50, 4h30 → 55, 4h → 60,
-- … 0h30 → 95, pickup → 100 — so nothing that ever sat on a boundary changes value. Only
-- the points BETWEEN boundaries change, and they now round down to the Business's benefit.
--
-- COST, stated plainly: a cliff of 5 points at each boundary (24 € on a 480 € trip). That
-- is why components/dispatch-cancel.tsx now shows the next raise and counts down to it —
-- a deadline you can see is not a trap. Founder's call, 2026-08-09: they preferred a rule
-- people can plan around over a slope nobody can perceive.
--
-- MIRRORED IN lib/cancellation.ts (businessCancelPct / CANCEL_STEP_HOURS). The two are
-- pinned together by tests/cancellation.test.ts. Change one, change the other.
--
-- This is a `create or replace` of ONE function. Nothing else in the O7 spine moves:
-- the status guard, the waiting settlement, the supersede rules, the audit insert and the
-- 24 h re-pool window are all byte-identical to 2026-07-22_waiting_fee.sql.
--
-- Idempotent. Safe to re-run.

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
     v_pct, round(coalesce(p_fare_snapshot, 0) * v_pct / 100, 2), p_fare_snapshot,
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
    cancellation_fee    = round(coalesce(p_fare_snapshot, 0) * v_pct / 100, 2),
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
