-- Phase 2 of the schedule "glance label": store a short, human place label for
-- the pickup + dropoff, captured from Mapbox Search Box's structured POI/place
-- data at pick-time (the POI name for hotels / airports / venues, else street +
-- town). The schedule line renders this label when present, otherwise derives one
-- from the address string at render time (lib/format.ts shortPlaceLabel — phase 1).
--
-- Additive + nullable, so existing missions stay valid and simply fall back to the
-- derived label. The exact address is unchanged (mission.pickup_address) and still
-- shown in the expanded trip detail + the Driver's navigation.
alter table public.mission
  add column if not exists pickup_label  text,
  add column if not exists dropoff_label text;
