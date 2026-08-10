-- 2026-08-10 — § Q SLICE 2: the Driver answers "what happened to this trip?".
-- Additive, nullable, two columns. Safe to re-run. No behaviour changes on its own.
--
-- WHY THIS EXISTS. Slice 1 (S58) made an unclosed trip visible on both sides but
-- deliberately shipped no way to answer it: a trip past its expected end shows a
-- "Needs closing" card to the Driver and a "Not closed" row to the Business, and
-- there it stops. This is the answer.
--
-- TWO ANSWERS, AND ONLY ONE OF THEM IS A STATUS CHANGE.
--   'driven'     → the trip ran. It goes to `completed` through the normal path
--                  and settles exactly as any other completed trip would. Nothing
--                  is stored here that `status` doesn't already say; it is written
--                  anyway so the trail records that the trip was closed BY ANSWERING
--                  the question rather than by the Driver tapping through at the time.
--   'not_driven' → the Driver says it never happened. **Settles nothing, charges
--                  nobody, moves no money.** It clears the Driver's flag and hands
--                  the question to the Business, who phones. In beta the founder
--                  settles it by hand — which is what happens today, minus anything
--                  telling them it is there.
--
-- ⚑ WHY 'not_driven' IS NOT A CANCELLATION. A cancellation names a party at fault
-- and carries a fee (O7/D45: 100% for a Driver cancel, a ramped % for a Business
-- one). Nobody knows yet who is at fault here — that is the entire point of asking.
-- Writing `cancelled` would pick a side and a price on the strength of one tap.
--
-- ⚑ WHY THERE IS NO no-show BRANCH. `mark_no_show` / `business_declare_no_show`
-- assume the Driver is standing at the pickup with a courtesy-wait clock running
-- (D47/D48). A no-show reported three days later cannot pass those guards and must
-- not be made to — BACKLOG § Q flags this, and it stays flagged.
--
-- ⚑ COLUMNS, NOT AN EVIDENCE TABLE — and the condition on that choice. The
-- append-only tables (mission_cancellation, mission_release) exist because their
-- rows are dispute proof over money that moved. Nothing moves here: this is one
-- statement, from one party, that a human then resolves off-platform. If the
-- Business is ever given a way to CONTEST it in-app, that is the moment this wants
-- to become `mission_close_answer` in the mission_release idiom (read-only RLS,
-- writes via SECURITY DEFINER) rather than a mutable column.
--
-- There is no driver UPDATE policy on `mission`, so the write goes through the
-- service role in a server action — mirroring advanceStatus and checkIn
-- (app/(app)/rides/actions.ts). No new grant, no new policy, no new RPC.

alter table mission add column if not exists close_answer text;
alter table mission add column if not exists close_answered_at timestamptz;

-- Constrained rather than free text: these two values are read by
-- lib/dispatch-status.ts to decide a tone, and a third value appearing without
-- the code knowing about it would render as an unhandled state.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mission_close_answer_check'
  ) then
    alter table mission
      add constraint mission_close_answer_check
      check (close_answer is null or close_answer in ('driven', 'not_driven'));
  end if;
end $$;

comment on column mission.close_answer is
  '§ Q — the Driver''s answer to "what happened to this trip?", asked once it is past its expected end and still open. ''driven'' = it ran (status also goes to completed). ''not_driven'' = the Driver says it never happened: settles NOTHING, charges nobody, and hands the question to the Business. NULL = never asked or never answered.';

comment on column mission.close_answered_at is
  '§ Q — when the Driver answered. Also the flag that clears the "Needs closing" card and the My Rides badge, so an answered trip stops nagging whichever way it was answered.';
