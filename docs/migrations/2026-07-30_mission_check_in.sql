-- 2026-07-30 — CHECK-IN (D61). Additive, nullable. Safe to re-run.
--
-- WHY THIS EXISTS. The O7 design (D45) had a Driver confirm at T-180 that they
-- would be there. Two thirds of it shipped: `accept_mission` parked a far-out
-- trip in `accepted`, and the Business side got a red "Not confirmed" pill
-- (lib/dispatch-status.ts) plus a red row wash (.dx-trip--alert). The missing
-- third was the part that asks the Driver — no reminder, no button, nothing.
-- So a trip accepted 4h out sat in `accepted` limbo forever, and D55 (S46)
-- fixed that by making accept confirm immediately and backfilling every
-- `accepted` row. Correct fix, but it made `accepted` unreachable — so the
-- pill and the wash have rendered for nobody since. This column gives that
-- machinery a condition it can actually reach.
--
-- NULL = not checked in. There is no driver UPDATE policy on `mission`, so the
-- write goes through the service role in a server action (mirrors advanceStatus
-- in app/(app)/rides/actions.ts) — no new grant, no new policy.
--
-- NOT in scope, deliberately: the T-180 reminder itself and the Business's
-- T-60 take-back. Both need Web Push, which does not exist yet (no service
-- worker, no subscriptions). Until a Driver is actually *asked*, nothing
-- punishing may hang off a missed check-in — see BACKLOG § N / D61.

alter table mission add column if not exists checked_in_at timestamptz;

comment on column mission.checked_in_at is
  'When the assigned Driver checked in. Opens 3h before pickup. NULL = not yet. Set implicitly when they go en_route — starting the trip is a stronger signal than the button.';
