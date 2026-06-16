-- ============================================================
-- PickUp · V1 Supabase schema  (Phase 0 data spine → SQL)
-- Run this in: Supabase → SQL Editor → New query → paste → Run.
-- Safe to run once on a fresh project. Order matters; keep it as-is.
--
-- Security model for the BETA:
--   • Your app SERVER (Next.js) talks to Supabase with the SERVICE ROLE key
--     for writes/admin work — it BYPASSES the RLS policies below.
--   • RLS below protects what a logged-in BROWSER/PWA client can READ/do
--     directly. We'll tighten policies as features land.
-- ============================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------- ENUMS ----------
-- (type names slightly renamed where they'd clash with Postgres built-ins:
--  user_role instead of "role")
create type user_role          as enum ('driver','dispatcher','admin');
create type vehicle_category   as enum ('eco','business','van','luxury');
create type mission_type       as enum ('transfer','hourly');  -- hourly = at-disposal (V2 hook)
create type mission_status     as enum ('draft','pooled','accepted','confirmed','en_route','arrived','on_board','completed','cancelled','expired');
create type cancellation_party as enum ('driver','business','system');
create type document_type      as enum ('drivers_licence','vtc_card','revtc','insurance','rc_pro','vehicle_registration','company_registration');
create type document_status    as enum ('pending','verified','rejected');
create type payment_status     as enum ('requires_capture','captured','refunded','failed');

-- ---------- IDENTITY / ROLE ----------
create table profile (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  role         user_role not null,
  created_at   timestamptz not null default now()
);

-- ---------- BUSINESS SIDE ----------
create table business (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  field_of_activity  text,
  logo_url           text,
  stripe_customer_id text,
  created_at         timestamptz not null default now()
);

create table dispatcher (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name         text not null,
  email        text,
  phone        text,
  created_at   timestamptz not null default now()
);

-- ---------- DRIVER SIDE ----------
create table driver (
  id                uuid primary key default gen_random_uuid(),
  auth_user_id      uuid not null unique references auth.users(id) on delete cascade,
  first_name        text not null,
  last_name         text not null,
  phone             text,
  email             text,
  profile_photo_url text,
  languages         text[] not null default '{}',
  operational_zones text[] not null default '{}',
  preferred_gps     text check (preferred_gps in ('waze','google','apple')),
  stripe_account_id text,                       -- Stripe Connect
  verified          boolean not null default false,  -- set MANUAL in beta
  created_at        timestamptz not null default now()
);

create table vehicle (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references driver(id) on delete cascade,
  category   vehicle_category not null,
  make       text,
  model      text,
  colour     text,
  plate      text,
  seats      int,
  created_at timestamptz not null default now()
);

-- proofs for a driver OR a business (owner_id is polymorphic → no FK)
create table document (
  id          uuid primary key default gen_random_uuid(),
  owner_type  text not null check (owner_type in ('driver','business')),
  owner_id    uuid not null,
  type        document_type not null,
  file_url    text not null,
  status      document_status not null default 'pending',
  expires_at  timestamptz,
  uploaded_at timestamptz not null default now()
);

-- ---------- THE CORE: MISSION ----------
create table mission (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references business(id) on delete cascade,
  dispatcher_id uuid not null references dispatcher(id),
  driver_id     uuid references driver(id),          -- null until accept
  status        mission_status not null default 'draft',
  mission_type  mission_type   not null default 'transfer',
  group_id      uuid,                                -- nullable hook (V2 grouped missions)
  category      vehicle_category not null,
  zone          text,
  pickup_address  text not null,
  pickup_lat      double precision,
  pickup_lng      double precision,
  dropoff_address text,
  dropoff_lat     double precision,
  dropoff_lng     double precision,
  waypoints       jsonb,                             -- intermediate stops
  pickup_at       timestamptz not null,              -- booked / original time
  flight_number   text,
  flight_eta      timestamptz,                        -- updated landing, display-only
  passenger_name  text,
  pax_count       int,
  luggage_count   int,
  comment         text,
  base_fare    numeric(10,2),
  ceiling      numeric(10,2) not null,               -- Business's max
  pdp_start    numeric(10,2),
  pdp_step     numeric(10,2),
  pdp_interval int,                                  -- minutes between PDP steps
  speed_win    boolean not null default false,
  cancelled_by cancellation_party,
  cancelled_at timestamptz,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  confirmed_at timestamptz
);

create index idx_mission_pool     on mission (status, category, zone);  -- the Pool query
create index idx_mission_driver   on mission (driver_id);
create index idx_mission_business on mission (business_id);
create index idx_mission_group    on mission (group_id);

-- one row per status-button tap → streamed to Dispatcher
create table status_event (
  id         uuid primary key default gen_random_uuid(),
  mission_id uuid not null references mission(id) on delete cascade,
  status     text not null check (status in ('en_route','arrived','on_board','completed')),
  created_at timestamptz not null default now()
);

-- ---------- MONEY ----------
create table payment (
  id                       uuid primary key default gen_random_uuid(),
  mission_id               uuid not null unique references mission(id) on delete cascade,
  stripe_payment_intent_id text,
  amount                   numeric(10,2),
  status                   payment_status not null default 'requires_capture',
  captured_at              timestamptz
);

-- immutable; written at completion
create table ledger_transaction (
  id                uuid primary key default gen_random_uuid(),
  mission_id        uuid not null unique references mission(id),
  gross_fare        numeric(10,2) not null,
  commission_pct    numeric(5,2)  not null,
  commission_amount numeric(10,2) not null,
  driver_net        numeric(10,2) not null,
  currency          text not null default 'EUR',
  created_at        timestamptz not null default now()
);

create table payout (
  id                uuid primary key default gen_random_uuid(),
  driver_id         uuid not null references driver(id),
  period_start      date not null,
  period_end        date not null,
  amount            numeric(10,2) not null,
  status            text not null default 'pending',
  stripe_transfer_id text,
  created_at        timestamptz not null default now()
);

-- justificatif de réservation (7 legal fields, Doc 01)
create table booking_voucher (
  id             uuid primary key default gen_random_uuid(),
  mission_id     uuid not null unique references mission(id),
  voucher_number text not null unique,
  pdf_url        text,
  generated_at   timestamptz not null default now()
);

-- ============================================================
-- HELPER FUNCTIONS  (security definer → can look past RLS safely)
-- ============================================================
create or replace function app_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from profile where auth_user_id = auth.uid()
$$;

create or replace function current_driver_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from driver where auth_user_id = auth.uid()
$$;

create or replace function current_business_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select business_id from dispatcher where auth_user_id = auth.uid() limit 1
$$;

-- ============================================================
-- ATOMIC ACCEPT  (this is "atomic accept" + slot-conflict + Lock-in, in one call)
-- The Driver PWA calls: select * from accept_mission('<mission-uuid>');
-- ============================================================
create or replace function accept_mission(p_mission_id uuid)
returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_driver_id uuid := current_driver_id();
  v_mission   mission;
  v_status    mission_status;
begin
  if v_driver_id is null then
    raise exception 'Not a driver';
  end if;

  -- lock the row; must still be pooled
  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.status <> 'pooled' then
    raise exception 'Mission no longer available';
  end if;

  -- slot-conflict: block another active mission within ±90 min of this pickup.
  -- NOTE: crude time buffer for now; refine once we store an estimated trip duration.
  if exists (
    select 1 from mission m
    where m.driver_id = v_driver_id
      and m.status in ('accepted','confirmed','en_route','arrived','on_board')
      and m.pickup_at between v_mission.pickup_at - interval '90 minutes'
                          and v_mission.pickup_at + interval '90 minutes'
  ) then
    raise exception 'Slot conflict with another mission';
  end if;

  -- LOCK-IN rule: pickup <3h away → auto-confirm; otherwise accepted (awaits Lock-in at T-180)
  if v_mission.pickup_at <= now() + interval '3 hours' then
    v_status := 'confirmed';
  else
    v_status := 'accepted';
  end if;

  update mission
     set driver_id    = v_driver_id,
         status       = v_status,
         accepted_at  = now(),
         confirmed_at = case when v_status = 'confirmed' then now() else null end
   where id = p_mission_id and status = 'pooled'   -- conditional → atomic, first wins
   returning * into v_mission;

  if not found then
    raise exception 'Mission no longer available';
  end if;

  return v_mission;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- Reads/own-data for browser clients; writes/admin via service role (server).
-- ============================================================
alter table profile            enable row level security;
alter table business           enable row level security;
alter table dispatcher         enable row level security;
alter table driver             enable row level security;
alter table vehicle            enable row level security;
alter table document           enable row level security;
alter table mission            enable row level security;
alter table status_event       enable row level security;
alter table payment            enable row level security;
alter table ledger_transaction enable row level security;
alter table payout             enable row level security;
alter table booking_voucher    enable row level security;

-- profile: read your own
create policy p_profile_self on profile for select using (auth_user_id = auth.uid());

-- driver: read + update your own row
create policy p_driver_self_read   on driver for select using (auth_user_id = auth.uid() or app_role()='admin');
create policy p_driver_self_update on driver for update using (auth_user_id = auth.uid());

-- vehicle: your own
create policy p_vehicle_owner on vehicle for all
  using (driver_id = current_driver_id() or app_role()='admin')
  with check (driver_id = current_driver_id());

-- business: dispatcher of that business can read; admin all
create policy p_business_read on business for select
  using (id = current_business_id() or app_role()='admin');

-- dispatcher: read your own seat / your business's seats
create policy p_dispatcher_read on dispatcher for select
  using (auth_user_id = auth.uid() or business_id = current_business_id() or app_role()='admin');

-- document: owner reads own (driver docs / business docs)
create policy p_document_owner on document for select using (
  app_role()='admin'
  or (owner_type='driver'   and owner_id = current_driver_id())
  or (owner_type='business' and owner_id = current_business_id())
);

-- MISSION:
--  driver  → sees the Pool (any pooled mission) + missions assigned to them
--  dispatcher → sees their business's missions, and can create/edit them
create policy p_mission_driver_read on mission for select using (
  (app_role()='driver' and status='pooled')
  or driver_id = current_driver_id()
);
create policy p_mission_business_read on mission for select using (
  business_id = current_business_id() or app_role()='admin'
);
create policy p_mission_business_insert on mission for insert with check (
  business_id = current_business_id()
);
create policy p_mission_business_update on mission for update using (
  business_id = current_business_id()
);

-- STATUS EVENT: driver writes events for their own mission; both sides read
create policy p_statusevent_driver_write on status_event for insert with check (
  exists (select 1 from mission m where m.id = mission_id and m.driver_id = current_driver_id())
);
create policy p_statusevent_read on status_event for select using (
  exists (select 1 from mission m where m.id = mission_id
          and (m.driver_id = current_driver_id() or m.business_id = current_business_id()))
  or app_role()='admin'
);

-- MONEY tables: read-only for the relevant party; writes happen server-side (service role)
create policy p_payment_read on payment for select using (
  exists (select 1 from mission m where m.id = mission_id
          and (m.driver_id = current_driver_id() or m.business_id = current_business_id()))
  or app_role()='admin'
);
create policy p_ledger_read on ledger_transaction for select using (
  exists (select 1 from mission m where m.id = mission_id
          and (m.driver_id = current_driver_id() or m.business_id = current_business_id()))
  or app_role()='admin'
);
create policy p_payout_read on payout for select using (
  driver_id = current_driver_id() or app_role()='admin'
);
create policy p_voucher_read on booking_voucher for select using (
  exists (select 1 from mission m where m.id = mission_id
          and (m.driver_id = current_driver_id() or m.business_id = current_business_id()))
  or app_role()='admin'
);

-- ============================================================
-- END. Next layers (later): voucher 7-field template, PDP fare function,
-- completion trigger (capture + ledger + voucher), payout batch job.
-- ============================================================
