-- 2026-06-28 — Generalize the saved address + add a pre-fill opt-out.
--
-- The saved place is the BUSINESS's own address (used on EITHER end of a trip —
-- pickup for a departure, drop-off for an arrival), not a "pickup" per se. Rename
-- the columns to say so. Add prefill_pickup: whether to auto-fill that address into
-- the pickup on a new mission — ON for businesses whose address is usually an
-- endpoint (a hotel), which they can switch OFF (a concierge whose address is never
-- an endpoint). The rename keeps any value already entered. Idempotent.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'business'
      and column_name = 'default_pickup_address'
  ) then
    alter table business rename column default_pickup_address to business_address;
    alter table business rename column default_pickup_lat     to business_address_lat;
    alter table business rename column default_pickup_lng     to business_address_lng;
    alter table business rename column default_pickup_label   to business_address_label;
  end if;
end $$;

alter table business
  add column if not exists prefill_pickup boolean not null default true;
