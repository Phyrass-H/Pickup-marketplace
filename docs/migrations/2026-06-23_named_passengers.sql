-- =====================================================================
-- 2026-06-23 — Named passengers (first name + surname), multiple per
--              mission, capacity-aware in the UI.
--
-- ADDITIVE ONLY. No DROP, no destructive ALTER, no re-run of the base
-- schema (respects CLAUDE.md hard-rule #4). Apply once in the Supabase
-- SQL editor. Idempotent (IF NOT EXISTS guard).
--
-- Model: a mission can name 1..N Guests, each { "first", "last" }. In the
-- form the list IS the headcount (rows = pax_count, set by the app), and
-- it is capped by the chosen Body type (Sedan up to 4, Van up to 7). The
-- existing `passenger_name` text column is kept as a DENORMALISED display
-- string (the first named Guest) so the schedule line, the Driver contact
-- reveal and the mission detail keep reading it unchanged. `pax_count`
-- continues to hold the count.
-- =====================================================================

alter table mission
  add column if not exists passenger_names jsonb;   -- [{ "first": "Jean", "last": "Dupont" }, ...]
