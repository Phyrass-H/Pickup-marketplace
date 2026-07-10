-- Detail-edit change-log (D40 follow-up): records WHAT a Business changed on a
-- posted trip's INFO (guests, flight, luggage, reference, Driver & service) via
-- "Edit details". Rendered as a "what changed" trail in the schedule trip detail.
--
-- PRIVACY: a detail-edit diff can contain Business-private data (the reference tag,
-- guest names), so it must NOT sit on the mission row that Pool Drivers can read.
-- It lives in this Business-only side table with deny-by-default RLS — exactly the
-- model mission_guest_contact + mission_amendment already use. No Driver policy →
-- Drivers can't read the change-log at all.
--
-- ADDITIVE ONLY. Never re-runs or drops the base schema (hard-rule #4). The base
-- schema uses Supabase DEFAULT PRIVILEGES (no explicit GRANTs), so a table created
-- here inherits access the same way; we only enable RLS + policies.
--
-- Run once in the Supabase SQL editor (Claude's app keys can't run DDL).

-- One row per detail-edit (an append-only trail; the schedule shows the latest).
create table if not exists mission_info_change (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references mission(id) on delete cascade,
  -- Denormalised from the mission so RLS filters cheaply (like mission_amendment).
  business_id uuid not null references business(id),
  edited_by   uuid references dispatcher(id),
  -- The human-readable change phrases, e.g. ["Flight BA342 → BA118",
  -- "Added guest Eleanor Whitmore"]. Computed server-side at edit time.
  items       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists mission_info_change_mission_idx
  on mission_info_change (mission_id, created_at desc);

alter table mission_info_change enable row level security;

-- Business (Dispatcher of the business) reads / inserts change rows for its OWN
-- missions. INSERT additionally checks the target mission is theirs. There is NO
-- Driver policy, so RLS denies Drivers by default (the log stays Business-private).
drop policy if exists p_info_change_business_read on mission_info_change;
create policy p_info_change_business_read on mission_info_change for select using (
  business_id = current_business_id() or app_role() = 'admin'
);

drop policy if exists p_info_change_business_insert on mission_info_change;
create policy p_info_change_business_insert on mission_info_change for insert with check (
  business_id = current_business_id()
  and mission_id in (select id from mission where business_id = current_business_id())
);
