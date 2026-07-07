-- Mission edit — PHASE 2: the amendment / consent flow (D39).
-- Once a Driver has ACCEPTED a mission, PickUp is the AGENT between two parties,
-- so a MATERIAL change (route / fare) can't be applied silently — it's a
-- proposed amendment the Driver accepts or declines. This is the audit trail +
-- the atomic, consented apply (a mini accept_mission).
--
-- ADDITIVE ONLY. Never re-runs or drops the base schema (hard-rule #4). The base
-- schema uses Supabase's DEFAULT PRIVILEGES for anon/authenticated (no explicit
-- GRANTs), so a table/function created here inherits access the same way; we only
-- enable RLS + policies, exactly like every other table.
--
-- Run once in the Supabase SQL editor (Claude's app keys can't run DDL).

-- ---------------------------------------------------------------------------
-- 1. The amendment record (one row per proposal; an immutable audit trail).
-- ---------------------------------------------------------------------------
create table if not exists mission_amendment (
  id            uuid primary key default gen_random_uuid(),
  mission_id    uuid not null references mission(id) on delete cascade,
  -- Denormalised from the mission so RLS + the Business dashboard filter cheaply.
  business_id   uuid not null references business(id),
  proposed_by   uuid references dispatcher(id),
  status        text not null default 'proposed'
                  check (status in ('proposed','accepted','declined','superseded')),

  -- The proposed NEW terms (applied to the mission atomically on accept). Route =
  -- pickup + stops + destination (v1 scope); fare = the new agreed TOTAL (manual —
  -- today's fare isn't distance-based, so the Dispatcher types it; auto-delta waits
  -- on the pricing engine, [[d37]]). pickup_at (time) is NOT amended in v1.
  new_pickup_address   text not null,
  new_pickup_lat       double precision,
  new_pickup_lng       double precision,
  new_pickup_label     text,
  new_dropoff_address  text,
  new_dropoff_lat      double precision,
  new_dropoff_lng      double precision,
  new_dropoff_label    text,
  new_waypoints        jsonb,
  new_distance_km      numeric(6,1),
  new_duration_min     int,
  new_fare             numeric(10,2) not null,

  -- The trip AS AGREED at propose-time (for the "was …" display + the record).
  -- { pickup_address, dropoff_address, waypoints, distance_km, duration_min, fare,
  --   pickup_label, dropoff_label }
  from_snapshot  jsonb not null,

  note           text,           -- optional message from the Dispatcher
  decline_reason text,           -- optional short reason the Driver gives on decline
  created_at     timestamptz not null default now(),
  responded_at   timestamptz     -- when the Driver accepted / declined
);

create index if not exists mission_amendment_mission_status_idx
  on mission_amendment (mission_id, status);
create index if not exists mission_amendment_business_idx
  on mission_amendment (business_id);

alter table mission_amendment enable row level security;

-- Business (Dispatcher of the business) reads / writes amendments for its own
-- missions. INSERT additionally checks the target mission is theirs, so a business
-- can't attach a proposal to someone else's trip. No Driver INSERT/UPDATE — the
-- Driver's response goes through respond_to_amendment (SECURITY DEFINER) below.
drop policy if exists p_amendment_business_read on mission_amendment;
create policy p_amendment_business_read on mission_amendment for select using (
  business_id = current_business_id() or app_role() = 'admin'
);

drop policy if exists p_amendment_business_insert on mission_amendment;
create policy p_amendment_business_insert on mission_amendment for insert with check (
  business_id = current_business_id()
  and mission_id in (select id from mission where business_id = current_business_id())
);

drop policy if exists p_amendment_business_update on mission_amendment;
create policy p_amendment_business_update on mission_amendment for update using (
  business_id = current_business_id()
);

-- Driver reads amendments on missions assigned to them (so the accept/decline
-- card can load the pending proposal under RLS).
drop policy if exists p_amendment_driver_read on mission_amendment;
create policy p_amendment_driver_read on mission_amendment for select using (
  mission_id in (select id from mission where driver_id = current_driver_id())
);

-- ---------------------------------------------------------------------------
-- 2. The atomic, consented apply — a mini accept_mission for the Driver's answer.
-- ---------------------------------------------------------------------------
-- Mirrors accept_mission: SECURITY DEFINER (Drivers have no mission UPDATE policy),
-- resolves the caller via current_driver_id(), row-locks + verifies, and applies
-- the swap in ONE transaction so the terms can never half-change. Accept → the new
-- route + fare land on the mission and the amendment is marked accepted; decline →
-- nothing on the mission moves, the amendment is marked declined (+ reason).
create or replace function respond_to_amendment(
  p_amendment_id uuid,
  p_accept       boolean,
  p_reason       text default null
) returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_driver_id uuid := current_driver_id();
  v_am        mission_amendment;
  v_mission   mission;
begin
  if v_driver_id is null then
    raise exception 'Not a driver';
  end if;

  -- Lock the amendment; must still be pending (serialises concurrent responses).
  select * into v_am from mission_amendment where id = p_amendment_id for update;
  if not found or v_am.status <> 'proposed' then
    raise exception 'This change is no longer pending';
  end if;

  -- Lock the mission; must be THIS Driver's and still amendable (pre-execution).
  select * into v_mission from mission where id = v_am.mission_id for update;
  if not found or v_mission.driver_id is distinct from v_driver_id then
    raise exception 'Not your mission';
  end if;
  if v_mission.status not in ('accepted','confirmed') then
    raise exception 'This trip can no longer be changed';
  end if;

  if p_accept then
    -- Apply the NEW terms. The fare is frozen at new_fare by collapsing the PDP
    -- curve (start = ceiling = new_fare, flat step/interval, no SPEED WIN) so
    -- currentFare() reads exactly the agreed total. stops_reached resets (the trip
    -- hasn't started — status is accepted/confirmed).
    update mission set
      pickup_address  = v_am.new_pickup_address,
      pickup_lat      = v_am.new_pickup_lat,
      pickup_lng      = v_am.new_pickup_lng,
      pickup_label    = v_am.new_pickup_label,
      dropoff_address = v_am.new_dropoff_address,
      dropoff_lat     = v_am.new_dropoff_lat,
      dropoff_lng     = v_am.new_dropoff_lng,
      dropoff_label   = v_am.new_dropoff_label,
      waypoints       = v_am.new_waypoints,
      distance_km     = v_am.new_distance_km,
      duration_min    = v_am.new_duration_min,
      stops_reached   = 0,
      ceiling         = v_am.new_fare,
      base_fare       = v_am.new_fare,
      pdp_start       = v_am.new_fare,
      pdp_step        = 0,
      pdp_interval    = 0,
      speed_win       = false
    where id = v_mission.id;

    update mission_amendment
      set status = 'accepted', responded_at = now()
      where id = p_amendment_id and status = 'proposed';
  else
    update mission_amendment
      set status = 'declined', decline_reason = p_reason, responded_at = now()
      where id = p_amendment_id and status = 'proposed';
  end if;

  -- Someone else already resolved it between our lock and update → abort clean.
  if not found then
    raise exception 'This change is no longer pending';
  end if;

  select * into v_mission from mission where id = v_am.mission_id;
  return v_mission;
end;
$$;
