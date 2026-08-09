-- 2026-08-09 — Waiting is settled when the trip ACTUALLY HAPPENS, not only when it fails.
--
-- THE HOLE. Only mark_no_show, business_declare_no_show and business_cancel_mission ever
-- wrote mission.waiting_fee. `advanceStatus` writes `status` (plus checked_in_at on
-- en_route) through the service role and computes nothing, and no TypeScript path anywhere
-- writes a waiting column. So a Guest 45 minutes late at an airport, with both apps showing
-- a meter running at 1,00 €/min, cost NOBODY ANYTHING the moment they got in the car.
--
-- That inverted the incentive D48 exists to create: a Driver on site was €1/min better off
-- filing a no-show than driving the Guest they had waited for.
--
-- FOUNDER'S RULING (2026-08-09): *"the driver is paid the extra time by the business, and
-- the business will charge the guest"* — waiting is owed whenever it happened, and the trip
-- going ahead does not cancel it. Kavenue bills the Business; what the Business recovers
-- from its own Guest is the Business's side of the arrangement (Kavenue stays the agent).
--
-- WHY on_board, AND WHY A NEW RPC.
-- `on_board` is the moment the waiting provably ENDED, it is the Driver's own action, and it
-- is the only transition between the meter starting and the trip finishing. FLOW in
-- lib/mission-flow.ts makes it mandatory — 'completed' is unreachable from 'arrived' — so
-- the step cannot be skipped. The write is a SECURITY DEFINER RPC rather than an extension
-- of advanceStatus because advanceStatus writes through the service role and computes
-- nothing: putting the meter there would be a FOURTH hand-written copy of the arithmetic, on
-- the one path with no SQL guard. `mission_waiting()` is the single definition the three
-- failure doors already share, and this door calls the same one, off the same `now()`.
--
-- NULL, NOT ZERO, when the Guest was on time: mission.waiting_from is documented as "NULL if
-- it never ran", and a 0,00 € row on every completed trip would drown the ones that mean
-- something. Same nullif() shape business_cancel_mission already uses.
--
-- NO DOUBLE SETTLEMENT IS POSSIBLE. Once status='on_board': mark_no_show and
-- business_declare_no_show both require 'arrived', and business_cancel_mission's guard list
-- (2026-08-09_cancel_fee_30min_steps.sql) excludes 'on_board'. No re-pool path can inherit a
-- stale fee either — driver_cancel_mission, reclaim_mission and respond_to_release all act
-- at or before 'arrived', where these columns are still NULL.
--
-- ⚑ KNOWN, UNCHANGED, NOT WIDENED HERE: a mission abandoned at 'arrived' forever settles
-- nothing. That is today's behaviour (BACKLOG § Q), and expire_stale_missions deliberately
-- touches only status='pooled'.
--
-- ⚑ RESIDUAL, ACCEPTED BY THE FOUNDER: the settlement is timed off the Driver's own tap, so
-- a Driver who boards an on-time Guest and taps twenty minutes later bills twenty minutes
-- the Guest never caused. The Business watches the same meter live and can call; the ceiling
-- caps it at 40 € city / 60 € airport; and in beta every euro settles by hand, so a dispute
-- is a phone call. There is deliberately NO waive button (founder, 2026-08-09).
--
-- Adds ONE function. Nothing existing is modified. Idempotent. Safe to re-run.

create or replace function board_guest(p_mission_id uuid)
returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_driver_id uuid := current_driver_id();
  v_mission   mission;
  v_w         record;
begin
  if v_driver_id is null then raise exception 'Not a driver'; end if;

  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.driver_id is distinct from v_driver_id then
    raise exception 'Not your mission';
  end if;
  if v_mission.status <> 'arrived' then
    raise exception 'You can only board the Guest once you have arrived at the pickup';
  end if;

  -- The same helper, and the same clock, as the three settlement doors.
  select * into v_w from mission_waiting(v_mission, now());

  update mission set
    status          = 'on_board',
    waiting_from    = case when v_w.w_min > 0 then v_w.w_from end,
    waiting_to      = case when v_w.w_min > 0 then v_w.w_to   end,
    waiting_minutes = nullif(v_w.w_min, 0),
    waiting_rate    = case when v_w.w_min > 0 then v_w.w_rate end,
    waiting_fee     = nullif(v_w.w_fee, 0)
  where id = v_mission.id;

  insert into status_event (mission_id, status) values (v_mission.id, 'on_board');

  select * into v_mission from mission where id = p_mission_id;
  return v_mission;
end;
$$;
