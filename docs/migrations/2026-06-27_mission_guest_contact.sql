-- 2026-06-27 — Guest phone numbers in a Driver-unreadable side table.
--
-- A Business can capture a phone per passenger, but a number is shared with the
-- Driver only when the Business explicitly toggles "Share" (now, or later from the
-- schedule). To make that gate AIRTIGHT, the actual numbers do NOT live on the
-- mission row (which every Pool Driver can read while a trip is pooled) — they live
-- here, where Drivers have NO read policy at all. A shared number is revealed to the
-- ASSIGNED Driver server-side via the service role (same pattern as the Dispatcher
-- contact unlock in /rides). mission.passenger_names keeps only names + the main flag.
--
-- `contacts` is a jsonb array aligned by index to passenger_names:
--   [{ "phone": "+33…", "shared": true }, { "phone": "", "shared": false }, …]
--
-- Additive + idempotent. The founder runs this in the Supabase SQL editor.

create table if not exists mission_guest_contact (
  mission_id uuid primary key references mission(id) on delete cascade,
  contacts   jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table mission_guest_contact enable row level security;

-- The Business that owns the mission can read + write its guest phones. Drivers get
-- NO policy here, so RLS denies them every access — they can never read a number,
-- shared or not. The assigned Driver is shown a SHARED number server-side via the
-- service role (which bypasses RLS), gated in code to their own accepted missions.
drop policy if exists p_guestcontact_business_all on mission_guest_contact;
create policy p_guestcontact_business_all on mission_guest_contact
  for all
  using (
    app_role() = 'admin'
    or exists (
      select 1 from mission m
      where m.id = mission_id and m.business_id = current_business_id()
    )
  )
  with check (
    app_role() = 'admin'
    or exists (
      select 1 from mission m
      where m.id = mission_id and m.business_id = current_business_id()
    )
  );
