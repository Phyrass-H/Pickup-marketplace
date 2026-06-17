-- ============================================================
-- PickUp · additive migration — Driver service area (radius from a base)
-- Approved by founder 2026-06-17 (Session 8). Replaces the fixed town-list
-- "operational zones" with a base location + service radius (geofence).
--
-- SAFE: this only ADDS columns. It touches no existing data, drops nothing,
-- and does NOT re-run docs/pickup_schema.sql (hard-rule #4). `if not exists`
-- makes it idempotent — running it twice is harmless.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → New query → paste → Run.
-- (Same place the base schema was applied.)
-- ============================================================

alter table driver
  add column if not exists base_label        text,              -- human-readable, e.g. "Cannes, France"
  add column if not exists base_lat          double precision,  -- geocoded base latitude
  add column if not exists base_lng          double precision,  -- geocoded base longitude
  add column if not exists service_radius_km integer not null default 50;  -- willing-to-serve radius

-- NOTE: driver.operational_zones (text[]) is kept for now but is no longer used
-- for Pool matching once the radius model ships. Matching becomes:
--   a mission is in a driver's Pool when its category matches AND
--   (pickup OR dropoff) is within service_radius_km of (base_lat, base_lng).
-- mission.pickup_lat/lng + dropoff_lat/lng already exist — they get populated
-- by Mapbox geocoding on mission creation.
