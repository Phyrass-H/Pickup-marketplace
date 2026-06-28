-- 2026-06-28 — Per-stop trip progress (additive, non-breaking).
--
-- Adds a single counter: how many of a mission's intermediate stops (mission.waypoints)
-- the assigned Driver has marked "reached". The mission_status enum is UNTOUCHED — stops
-- are tracked alongside it, not as new statuses:
--
--   0                              -> none reached yet (just boarded, or trip not started)
--   jsonb_array_length(waypoints)  -> all stops done; the next/last action is the drop-off
--
-- Drives: the Driver's "Reached — <stop>" button (one tap per stop, between "Guest on board"
-- and "Complete ride"), the stops-aware progress bar, and the Dispatch route-rail check-off +
-- the "On board · k/N" pill counter. Safe to run more than once.

alter table mission
  add column if not exists stops_reached int not null default 0;
