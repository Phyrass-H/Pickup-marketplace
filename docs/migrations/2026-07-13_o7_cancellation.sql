-- O7 — PHASE 1: the cancellation spine (D45).
--   • Driver cancel  → always 100%; re-pools the mission as a SPEED WIN.
--   • Business cancel → free >5h; 50% at −5h; +10%/h → 100% at pickup. Terminal.
--   • No-show         → Driver on-site ('arrived') + wait window elapsed; Business
--                       charged full, Driver paid like a completed mission. Terminal.
--   • T-60 reclaim    → the assigned Driver accepted but never confirmed the Lock-in;
--                       the Business takes it back → re-pool as SPEED WIN (penalty-free).
--
-- All fees are penalties owed to PickUp-the-INTERMEDIARY, never a transport charge
-- (agent position, Doc 01). EURO amounts settle MANUAL in beta — the RPCs record the
-- policy % + a server-computed fare snapshot so a human can settle. Copilote hand-over
-- (a full transfer to another Driver) = Phase 2, not in this migration.
--
-- ADDITIVE ONLY. Never re-runs or drops the base schema (hard-rule #4). Mirrors the
-- mission_amendment pattern: an audit table + SECURITY DEFINER atomic RPCs that
-- resolve the caller via current_driver_id()/current_business_id(), row-lock, verify,
-- and mutate in one transaction. Base schema uses Supabase default privileges, so the
-- new table/functions inherit access the same way; we only add RLS + policies.
--
-- Run once in the Supabase SQL editor (Claude's app keys can't run DDL).

-- ---------------------------------------------------------------------------
-- 1. New mission columns (fee record + no-show + a re-pool climb origin).
-- ---------------------------------------------------------------------------
alter table mission add column if not exists cancellation_fee    numeric(10,2); -- euro basis at cancel (MANUAL settle)
alter table mission add column if not exists cancellation_reason text;
alter table mission add column if not exists pooled_at           timestamptz;   -- PDP climb origin for a RE-POOLED mission
alter table mission add column if not exists no_show             boolean not null default false;
alter table mission add column if not exists no_show_at          timestamptz;

-- Driver reliability: a running count of "marks" (driver cancel / T-60 reclaim).
alter table driver  add column if not exists reliability_marks   int not null default 0;

-- ---------------------------------------------------------------------------
-- 2. Widen the status_event timeline so cancel / no-show / re-pool are loggable.
-- ---------------------------------------------------------------------------
alter table status_event drop constraint if exists status_event_status_check;
alter table status_event add  constraint status_event_status_check
  check (status in ('en_route','arrived','on_board','completed','cancelled','no_show','repooled'));

-- Tighten the Driver's direct-insert policy to the execution steps ONLY: the new O7
-- statuses (cancelled / no_show / repooled) must be written by the SECURITY DEFINER RPCs,
-- never spoofed by a Driver inserting a status_event row directly. The app already
-- advances status via the service role, so this restricts only the attack surface. (O7 review fix.)
drop policy if exists p_statusevent_driver_write on status_event;
create policy p_statusevent_driver_write on status_event for insert with check (
  status in ('en_route','arrived','on_board','completed')
  and exists (select 1 from mission m where m.id = mission_id and m.driver_id = current_driver_id())
);

-- ---------------------------------------------------------------------------
-- 3. Cancellation / reclaim / no-show audit (one row per event; the fee record).
--    A driver cancel RE-POOLS the mission (it lives on under a new Driver), so the
--    penalty record can't live on mission.cancelled_by — that's for a TERMINAL
--    business cancel only. This table is also where the Phase-2 "passed on" trace
--    (copilote hand-over) will land.
-- ---------------------------------------------------------------------------
create table if not exists mission_cancellation (
  id                  uuid primary key default gen_random_uuid(),
  mission_id          uuid not null references mission(id) on delete cascade,
  business_id         uuid not null references business(id),   -- denormalised for RLS
  party               cancellation_party not null,             -- driver | business | system
  actor_driver_id     uuid references driver(id),              -- the Driver who cancelled / flaked / reported
  kind                text not null check (kind in ('driver_cancel','business_cancel','no_show','t60_reclaim')),
  reason              text,
  fee_pct             numeric,                                 -- policy % (100 driver; business curve; 100 no-show; 0 reclaim)
  fee_amount          numeric(10,2),                           -- fare_snapshot * fee_pct (euro basis; MANUAL settle)
  fare_snapshot       numeric(10,2),                           -- the computed fare at the moment (server-passed)
  hours_before_pickup numeric,
  resulted_in         text not null check (resulted_in in ('repooled','terminal')),
  created_at          timestamptz not null default now()
);
create index if not exists mission_cancellation_mission_idx  on mission_cancellation (mission_id);
create index if not exists mission_cancellation_business_idx on mission_cancellation (business_id);
create index if not exists mission_cancellation_driver_idx   on mission_cancellation (actor_driver_id);

alter table mission_cancellation enable row level security;

-- Business reads its own events; a Driver reads events where they were the actor
-- (their own cancel history + the future "passed on" trace). Writes go through the
-- SECURITY DEFINER RPCs only → no client INSERT/UPDATE policy = deny by default.
drop policy if exists p_cancellation_business_read on mission_cancellation;
create policy p_cancellation_business_read on mission_cancellation for select using (
  business_id = current_business_id() or app_role() = 'admin'
);
drop policy if exists p_cancellation_driver_read on mission_cancellation;
create policy p_cancellation_driver_read on mission_cancellation for select using (
  actor_driver_id = current_driver_id()
);

-- ---------------------------------------------------------------------------
-- 4. DRIVER cancel — always 100%; re-pools the mission as a SPEED WIN.
--    The 100% fee is a penalty owed to PickUp (not a transport charge). The
--    escape valves that AVOID it (Business-agreed release; copilote hand-over)
--    are separate flows; this is the plain "I'm cancelling" path.
-- ---------------------------------------------------------------------------
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
begin
  if v_driver_id is null then raise exception 'Not a driver'; end if;

  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.driver_id is distinct from v_driver_id then
    raise exception 'Not your mission';
  end if;
  -- Anytime before the Guest is aboard. (Not on_board / completed / cancelled.)
  if v_mission.status not in ('accepted','confirmed','en_route','arrived') then
    raise exception 'This trip can no longer be cancelled';
  end if;

  v_hours := extract(epoch from (v_mission.pickup_at - now())) / 3600.0;

  insert into mission_cancellation
    (mission_id, business_id, party, actor_driver_id, kind, reason,
     fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in)
  values
    (v_mission.id, v_mission.business_id, 'driver', v_driver_id, 'driver_cancel', p_reason,
     100, p_fare_snapshot, p_fare_snapshot, v_hours, 'repooled');

  update driver set reliability_marks = reliability_marks + 1 where id = v_driver_id;

  -- Any change the Business was negotiating with THIS Driver dies with the re-pool —
  -- it must not survive to the next Driver who accepts the re-pooled trip (O7 review fix).
  update mission_amendment set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';

  -- Re-pool as a SPEED WIN: the climb restarts from pooled_at at 70% of the ceiling.
  update mission set
    status       = 'pooled',
    driver_id    = null,
    accepted_at  = null,
    confirmed_at = null,
    pooled_at    = now(),
    speed_win    = true,
    pdp_start    = round(v_mission.ceiling * 0.7, 2),
    pdp_step     = greatest(1, round(v_mission.ceiling * 0.05, 2)),
    pdp_interval = 5
  where id = v_mission.id;

  insert into status_event (mission_id, status) values (v_mission.id, 'repooled');

  select * into v_mission from mission where id = p_mission_id;
  return v_mission;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. BUSINESS cancel — FREE while still pooled (no Driver committed); once a Driver
--    holds it: free >5h; 50% at −5h; +10%/h (5% / 30 min) → 100% at pickup. Terminal.
--    Linear ramp (equals the per-hour steps at every whole hour; fairer in between).
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
  -- No Driver has committed yet → free (nobody to protect; PickUp's commission is
  -- only taken at completion, so there is no cut to refund either).
  if v_mission.status = 'pooled' or v_mission.driver_id is null then
    v_pct := 0;
  elsif v_hours > 5 then
    v_pct := 0;                                              -- free until 5h out
  elsif v_hours < 0 then
    v_pct := 100;                                            -- past the pickup time
  else
    v_pct := least(100, greatest(50, 50 + 10 * (5 - v_hours)));  -- 50% at −5h, +5% / 30 min → 100%
  end if;

  insert into mission_cancellation
    (mission_id, business_id, party, actor_driver_id, kind, reason,
     fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in)
  values
    -- actor_driver_id = null: on a Business cancel the Driver is the passive party, not the
    -- actor — and the driver read policy is scoped to actor_driver_id, so this keeps the
    -- Business's free-text reason unreadable to the released Driver (O7 review fix).
    (v_mission.id, v_business_id, 'business', null, 'business_cancel', p_reason,
     v_pct, round(coalesce(p_fare_snapshot, 0) * v_pct / 100, 2), p_fare_snapshot, v_hours, 'terminal');

  update mission set
    status              = 'cancelled',
    cancelled_by        = 'business',
    cancelled_at        = now(),
    cancellation_reason = p_reason,
    cancellation_fee    = round(coalesce(p_fare_snapshot, 0) * v_pct / 100, 2)
  where id = v_mission.id;

  insert into status_event (mission_id, status) values (v_mission.id, 'cancelled');

  select * into v_mission from mission where id = p_mission_id;
  return v_mission;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. T-60 Business reclaim — ONLY when the Driver accepted but never confirmed the
--    Lock-in (status is still 'accepted') and pickup is within 60 min. Re-pools as
--    SPEED WIN, penalty-free for the Business; the Driver takes a reliability mark.
--    (The "unreachable by phone" check is the human step before the tap; the app
--    gates the button to the objective non-confirmation signal so it can't be abused.)
-- ---------------------------------------------------------------------------
create or replace function reclaim_mission(p_mission_id uuid)
returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid := current_business_id();
  v_mission     mission;
  v_driver_id   uuid;
begin
  if v_business_id is null then raise exception 'Not a dispatcher'; end if;

  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.business_id is distinct from v_business_id then
    raise exception 'Not your mission';
  end if;
  -- Eligibility: accepted (NOT confirmed → the Driver never locked in) and inside T-60.
  if v_mission.status <> 'accepted' or now() < v_mission.pickup_at - interval '60 minutes' then
    raise exception 'Not eligible for reclaim';
  end if;

  v_driver_id := v_mission.driver_id;

  insert into mission_cancellation
    (mission_id, business_id, party, actor_driver_id, kind, reason,
     fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in)
  values
    (v_mission.id, v_business_id, 'business', v_driver_id, 't60_reclaim',
     'Driver did not confirm within the Lock-in window',
     0, 0, null, extract(epoch from (v_mission.pickup_at - now())) / 3600.0, 'repooled');

  if v_driver_id is not null then
    update driver set reliability_marks = reliability_marks + 1 where id = v_driver_id;
  end if;

  -- Kill any pending amendment negotiated with the reclaimed Driver (O7 review fix).
  update mission_amendment set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';

  update mission set
    status       = 'pooled',
    driver_id    = null,
    accepted_at  = null,
    confirmed_at = null,
    pooled_at    = now(),
    speed_win    = true,
    pdp_start    = round(v_mission.ceiling * 0.7, 2),
    pdp_step     = greatest(1, round(v_mission.ceiling * 0.05, 2)),
    pdp_interval = 5
  where id = v_mission.id;

  insert into status_event (mission_id, status) values (v_mission.id, 'repooled');

  select * into v_mission from mission where id = p_mission_id;
  return v_mission;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. NO-SHOW — Driver on-site ('arrived') and the Guest didn't appear within the
--    wait window (airport = 60 min / city = 20 min, from arrival). Business charged
--    full; Driver paid like a completed mission. Terminal (status → 'completed',
--    no_show = true). Airport = a flight number OR an airport-looking pickup address.
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
  -- Airport pickup = 60 min wait; city = 20 min. Airport is inferred from a flight
  -- number OR an airport-looking pickup address (Businesses don't always give a flight #).
  v_wait := case
              when v_mission.flight_number is not null
                or v_mission.pickup_address ~* '(a[eé]roport|airport)'
              then interval '60 minutes'
              else interval '20 minutes'
            end;
  if v_arrived is null or now() < v_arrived + v_wait then
    raise exception 'The wait window has not elapsed yet';
  end if;

  insert into mission_cancellation
    (mission_id, business_id, party, actor_driver_id, kind, reason,
     fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in)
  values
    (v_mission.id, v_mission.business_id, 'driver', v_driver_id, 'no_show', 'Guest did not show',
     100, p_fare_snapshot, p_fare_snapshot, 0, 'terminal');

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
