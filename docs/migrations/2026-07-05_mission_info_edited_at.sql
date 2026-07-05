-- Mission info-edit timestamp (Session 34, edit-info Phase 1).
--
-- Set by the updateMissionInfo server action when a Business edits a POSTED
-- mission's info (guests / flight / luggage / reference / Driver & service) —
-- NOT by any price, route or status change. Shown as "Edited · <time>" in the
-- Dispatch trip detail (never on the collapsed schedule row).
--
-- Additive + nullable, so existing rows are untouched (null = never edited).

alter table mission
  add column if not exists info_edited_at timestamptz;
