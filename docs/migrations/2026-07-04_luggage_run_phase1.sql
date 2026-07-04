-- 2026-07-04 — Luggage-vehicle Phase 1 ("van for luggage")
-- Additive, idempotent. Applied to the live Supabase DB by the founder (2026-07-04).
--
-- A luggage-only mission is a normal mission with no passengers, carried in a Van:
--   mission.luggage_only = true, required_body_type = 'van', category = 'business'
--   (catalog vans classify as the business tier), pax_count = 0, bags in luggage_count.
-- Van Drivers opt in to receive these (off by default — explicit consent, so a
-- Driver who doesn't want bags-only jobs in their van is never offered them).
-- Volume/m³ bands + real cargo/truck classes are Phase 2.

alter table mission add column if not exists luggage_only boolean not null default false;
alter table driver  add column if not exists accepts_luggage_runs boolean not null default false;
