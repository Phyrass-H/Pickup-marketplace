-- 2026-06-27 — Promote the per-booking reference (room / event) to a dedicated column.
--
-- Additive: adds mission.reference, a SHORT (≤20-char) booking tag the Business
-- types for its own schedule line ("Room 312", "FIF 2026 Chopard"). It is shown
-- on the Dispatch schedule + Review preview ONLY — never to the Driver. Driver-
-- facing instructions now live in driver_message (S19).
--
-- Until S19 the legacy `comment` column doubled as reference + notes. We backfill
-- reference from it so existing missions keep their schedule tag. The legacy
-- `comment` column is LEFT IN PLACE (dropping a column is non-additive, against
-- hard-rule #4) — the app no longer reads or writes it.
--
-- Safe to run more than once (idempotent: ADD COLUMN IF NOT EXISTS; the backfill
-- only touches rows whose reference is still null).

alter table mission add column if not exists reference text;

-- Truncate the backfill to the same 20-char cap the new field enforces, so a
-- legacy free-text comment can't render an over-long tag on the schedule line.
update mission
   set reference = left(nullif(btrim(comment), ''), 20)
 where reference is null
   and nullif(btrim(comment), '') is not null;
