-- =====================================================================
-- 2026-06-19 — Vehicle taxonomy (service tier × body) + specific-car
--              request + cached trip ETA (road distance + duration).
--
-- ADDITIVE ONLY. No DROP, no destructive ALTER, no re-run of the base
-- schema (respects CLAUDE.md hard-rule #4). Apply once in the Supabase
-- SQL editor. Idempotent (IF NOT EXISTS guards).
--
-- Model: the existing `vehicle_category` enum becomes the SERVICE TIER
-- (eco / business / luxury). Body (sedan / van) is a new dimension, so a
-- "luxury van", "eco van", etc. are now expressible. The legacy `van`
-- category value is migrated to (tier=business, body=van) — beta data only.
-- A specific car can be required per mission (required_make/_model). Trip
-- distance + duration are cached on the mission (computed once via Mapbox
-- Directions at creation) so cards can show an accurate ETA cheaply.
-- =====================================================================

-- 1) Body type dimension.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'body_type') then
    create type body_type as enum ('sedan', 'van');
  end if;
end $$;

-- 2) Each vehicle has a body type (defaults to sedan).
alter table vehicle add column if not exists body_type body_type not null default 'sedan';

-- 3) Mission: required body (null = any), an optional specific car, and the
--    cached road distance (km) + duration (minutes) for the ETA.
alter table mission add column if not exists required_body_type body_type;          -- null = any body
alter table mission add column if not exists required_make text;                     -- null = any make
alter table mission add column if not exists required_model text;                    -- null = any model
alter table mission add column if not exists distance_km numeric(6,1);               -- road distance, cached
alter table mission add column if not exists duration_min integer;                   -- road travel time, cached

-- 4) Migrate the legacy single `van` category to the new tier×body model.
--    (Beta data only; the tier is a best guess — vans were not tier-tagged.)
update vehicle set category = 'business', body_type = 'van' where category = 'van';
update mission
   set category = 'business',
       required_body_type = coalesce(required_body_type, 'van')
 where category = 'van';

-- Note: the enum value 'van' remains defined (enum values can't be dropped),
-- but no rows use it after this migration and the UI no longer offers it as a
-- tier. Tiers offered going forward: eco / business / luxury.
