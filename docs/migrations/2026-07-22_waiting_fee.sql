-- 2026-07-22 — Waiting fees (D48): pay the Driver to wait, and freeze a booked trip's time
--
-- THE MODEL (founder, D48). A Guest who is late is charged for the waiting — the Driver has
-- a reason to wait because he is paid for it. If the Business or Guest needs a different
-- time, that is a NEW trip: cancel, rebook, post it to the Pool.
--
--   courtesy wait   20 min city / 60 min airport      (unchanged, free)
--   then            €1 per minute STARTED, Business → Driver
--   ceiling         total 60 min city / 120 min airport from clock start
--                   → so the PAID portion caps at 40 min (€40) / 60 min (€60)
--
-- THE CEILING STOPS THE MONEY, NOT THE TRIP. At the cap the meter simply stops; the mission
-- is NOT auto-terminated. The Driver may keep waiting (unpaid) and reports when ready. This
-- is why no scheduled job is needed anywhere — the cap is a least() clamp, not an event.
--
-- CLOCK ORIGIN is D47's, unchanged: coalesce(guest_ready_at, pickup_at). For an airport that
-- means ACTUAL LANDING once flight tracking lands; a plane still in the air cannot burn
-- anyone's courtesy wait. guest_ready_at is NULL today, so the origin falls back to the
-- booked time in the interim.
--
-- TWO EXITS, both human: the Driver reports a no-show (already live), or the Business
-- declares one ("stop waiting, the Guest isn't coming" — net-new here).
--
-- ⚠️ WHY business_cancel_mission CHANGES TOO. It already accepts status='arrived' and
-- charges a flat 100% past pickup, so today the Business's Cancel button costs exactly what
-- a no-show costs MINUS the waiting. Without settling waiting on that path too, "stop
-- waiting" would be the strictly dearer door — growing €1/min worse — and every Dispatcher
-- would learn to press Cancel while the Driver never saw his waiting money. Both doors must
-- cost the same; they are the same economic event, differently declared.
--
-- ⚠️ THE RATE IS PROVISIONAL. €1/min is the founder's placeholder to unblock the build;
-- proper research is owed (BACKLOG § N). waiting_rate is therefore stored PER ROW so
-- historical settlements don't re-price when the constant moves.
--
-- NOTE ON SHAPE: every other fee in mission_cancellation is a penalty owed to
-- PickUp-the-intermediary (Doc 01). The waiting fee is NOT that — it is a Business → Driver
-- pass-through that PickUp merely intermediates. It is recorded here for MANUAL settlement;
-- when ledger_transaction gets its first writer, that is its structurally correct home.
--
-- Additive + idempotent. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. The settled waiting outcome, on the mission (both parties read it under
--    the existing RLS — the Driver's read policy is driver_id-scoped and still
--    matches after status → 'completed').
-- ---------------------------------------------------------------------------
alter table mission add column if not exists waiting_from    timestamptz;
alter table mission add column if not exists waiting_to      timestamptz;
alter table mission add column if not exists waiting_minutes int;
alter table mission add column if not exists waiting_rate    numeric(10,2);
alter table mission add column if not exists waiting_fee     numeric(10,2);
alter table mission add column if not exists no_show_by      cancellation_party;

comment on column mission.waiting_from is
  'When the paid meter started = guest_due + courtesy wait. NULL if it never ran.';
comment on column mission.waiting_to is
  'When the meter stopped = least(settlement time, guest_due + ceiling).';
comment on column mission.waiting_minutes is
  'Minutes STARTED (ceil), already clamped by the ceiling. 0 when the Guest was on time.';
comment on column mission.waiting_rate is
  'EUR per minute in force for THIS row. Pinned so historical rows do not re-price. PROVISIONAL (D48).';
comment on column mission.waiting_fee is
  'waiting_minutes * waiting_rate. Business owes it, Driver is paid it. MANUAL settlement in beta.';
comment on column mission.no_show_by is
  'Who declared the no-show: driver (reported on site) or business (stop waiting).';

-- ---------------------------------------------------------------------------
-- 2. The same three figures on the settlement row. NULLABLE with no default —
--    all existing INSERTs use explicit column lists, so NOT NULL would break
--    every cancel RPC.
-- ---------------------------------------------------------------------------
alter table mission_cancellation add column if not exists waiting_minutes int;
alter table mission_cancellation add column if not exists waiting_rate    numeric(10,2);
alter table mission_cancellation add column if not exists waiting_fee     numeric(10,2);

-- 3. Widen `kind` for the Business-declared no-show.
alter table mission_cancellation drop constraint if exists mission_cancellation_kind_check;
alter table mission_cancellation add  constraint mission_cancellation_kind_check
  check (kind in ('driver_cancel','business_cancel','no_show','business_no_show',
                  't60_reclaim','agreed_release'));

-- ---------------------------------------------------------------------------
-- 4. Shared helper: how much waiting is owed on this mission right now.
--    ONE definition, used by all three settlement paths so they cannot drift.
--    Mirrored in lib/cancellation.ts for display.
-- ---------------------------------------------------------------------------
create or replace function mission_waiting(p_mission mission, p_at timestamptz)
returns table (w_from timestamptz, w_to timestamptz, w_min int, w_rate numeric, w_fee numeric)
language plpgsql immutable set search_path = public as $$
declare
  v_rate      constant numeric(10,2) := 1.00;  -- D48 — PROVISIONAL, research owed
  v_airport   boolean;
  v_wait      interval;
  v_ceiling   interval;
  v_guest_due timestamptz;
begin
  -- Airport = flight number OR an airport-looking address OR place label (the autocomplete
  -- puts the POI name in pickup_label and the street address in pickup_address).
  v_airport := nullif(p_mission.flight_number, '') is not null
            or p_mission.pickup_address ~* '(a[eé]roport|airport)'
            or coalesce(p_mission.pickup_label, '') ~* '(a[eé]roport|airport)';

  v_wait    := case when v_airport then interval '60 minutes' else interval '20 minutes' end;
  v_ceiling := case when v_airport then interval '120 minutes' else interval '60 minutes' end;

  v_guest_due := coalesce(p_mission.guest_ready_at, p_mission.pickup_at);

  w_from := v_guest_due + v_wait;
  w_to   := least(p_at, v_guest_due + v_ceiling);   -- the ceiling clamps the MONEY only
  w_rate := v_rate;
  w_min  := greatest(0, ceil(extract(epoch from (w_to - w_from)) / 60.0))::int;
  w_fee  := round(w_min * v_rate, 2);
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. mark_no_show — unchanged gates, now also settles the waiting.
-- ---------------------------------------------------------------------------
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

  v_wait := case
              when nullif(v_mission.flight_number, '') is not null
                or v_mission.pickup_address ~* '(a[eé]roport|airport)'
                or coalesce(v_mission.pickup_label, '') ~* '(a[eé]roport|airport)'
              then interval '60 minutes'
              else interval '20 minutes'
            end;
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

  -- A terminal path must clear any pending negotiation artifact (mark_no_show was the only
  -- one that superseded neither — the other terminal RPCs already do this).
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

-- ---------------------------------------------------------------------------
-- 6. NET-NEW — the Business declares the no-show ("stop waiting").
--    Mirrors mark_no_show: same outcome, different declarer. Requires the Driver
--    to actually be on site, and the courtesy wait to have elapsed, so a Business
--    cannot use it to end a trip early and dodge the cancel ramp.
-- ---------------------------------------------------------------------------
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

  v_wait := case
              when nullif(v_mission.flight_number, '') is not null
                or v_mission.pickup_address ~* '(a[eé]roport|airport)'
                or coalesce(v_mission.pickup_label, '') ~* '(a[eé]roport|airport)'
              then interval '60 minutes'
              else interval '20 minutes'
            end;
  v_guest_due := coalesce(v_mission.guest_ready_at, v_mission.pickup_at);

  -- Not before the courtesy wait is over: otherwise this becomes a cheap early cancel.
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

-- ---------------------------------------------------------------------------
-- 7. business_cancel_mission — settle any accrued waiting on this path too, so
--    cancelling is never cheaper than declaring. Everything else is unchanged
--    from 2026-07-19_repool_speedwin_window.sql.
-- ---------------------------------------------------------------------------
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
    v_pct := least(100, greatest(50, 50 + 10 * (5 - v_hours)));
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

-- ---------------------------------------------------------------------------
-- 8. Freeze pickup_at once the trip leaves 'draft' (D48: a booked trip's time
--    never moves — a real change is cancel + rebook). A blanket block is safe
--    here precisely BECAUSE time is never amendable: the only legitimate writer
--    is draft resume, which runs while status='draft'.
--    SECURITY INVOKER (not DEFINER) so current_user is the CALLING role —
--    getting this wrong is what made the guest_ready_at guard a no-op twice.
-- ---------------------------------------------------------------------------
create or replace function mission_guard_pickup_at()
returns trigger
language plpgsql as $$
begin
  if new.pickup_at is distinct from old.pickup_at
     and old.status <> 'draft'
     and current_user in ('anon', 'authenticated') then
    raise exception
      'A booked trip''s pickup time cannot be changed — cancel and post a new trip'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mission_guard_pickup_at on mission;

create trigger trg_mission_guard_pickup_at
  before update on mission
  for each row
  execute function mission_guard_pickup_at();
