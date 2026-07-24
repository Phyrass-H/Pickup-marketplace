# PickUp — Session Log

> Append-only, newest at top. One entry per working session. Keep it short:
> what changed, what was decided, what's next.

---

## 2026-07-24 — Session 43 — Driver Pool redesign + bottom tab bar (Pool-first)
**Branch:** `main`. **No migration** — `mission_type` (`'transfer'|'hourly'`, hourly = at-disposal) and a nullable
`dropoff_address` already exist in the schema. Design decided via the **D25 preview loop** (v1→v9 inline mockups, founder
sign-off each round), then built to match.

**The Driver app finally gets a layout redesign — Pool first.** It had inherited the navy palette (D24) but never a
structural redesign the way Dispatch did. This session: the shell + the Pool card.
- **Bottom tab bar** (`components/driver-tabbar.tsx`) replaces the old top text-nav (`components/app-header.tsx`, now
  unused): Pool (stack / Lucide `Layers`) · My Rides (`Car`) · Earnings (`Wallet`) · Settings (`Settings`). Fixed,
  safe-area aware, active-state by pathname (Pool stays active on `/missions/*`). Content moved into
  `<main class="dapp-main">` (bottom padding clears the bar). **Sign out** moved from the header into Settings
  (`components/driver-signout.tsx`).
- **Pool card** (`components/mission-card.tsx`, full rewrite) to the approved v9 mockup — uniform, quiet, refined weights
  (nothing 700):
  * head: fare (left) + when (right: day "Today · 24 Jul" / "Sun · 26 Jul" + time; today accented navy), a **gentle
    divider**, then **mission-only badges** — Transfer OR "At disposal" (`mission_type='hourly'`), SPEED WIN, Luggage run.
    The vehicle class is NOT a badge — it's the Driver's own car (the Pool is filtered to it), so it's redundant → demoted.
  * **route rail** (Dispatch-style): navy dot (pickup) → line → grey mid-dot with "+N" (waypoint count) → line → hollow
    ring (drop-off). Full **2-line** addresses (`addressLine()` + `-webkit-line-clamp:2`). An at-disposal (hourly) trip
    has no drop-off → pickup alone; the facts line shows "Flexible route" instead of distance.
  * **one-line footer**: trip facts (distance·duration) + a **discreet vehicle** (Car icon + class, muted, truncates
    first) | service-request icons **capped at 3 by priority** (child seat > pets > luggage > meet&greet > greeter >
    dress > language > quiet > flight) then "+N".
- **Earnings** = the new 4th tab (`app/(app)/earnings/page.tsx`) — honest "coming soon" placeholder; its own screen gets
  a D25 pass later (payouts settle manually in beta, Stripe deferred).
- **CSS** (`app/globals.css`): new `.dtabbar/.dtab`, `.dapp-main`, `.pool-head`, `.pcard/.proute/.pbadge`. The shared
  `.card/.route/.badge` are UNTOUCHED (still used by My Rides / mission detail — those screens redesign in a later pass).
- **`lib/format.ts`**: new `formatPoolWhen()` (Paris-tz relative Today/Tomorrow else weekday + "D Mon" + time).

**Verified** in-browser vs the real Supabase DB (Pool · My Rides · Earnings render, no console errors; 2-line wrap, route
rail, badges, capped icons, Luggage-run badge all correct). **3-lens adversarial review (13 agents) → 6 confirmed (0
high), ALL FIXED:** the "Tomorrow" **DST drift** (now Paris-calendar arithmetic, not +24h), `viewportFit:'cover'` for the
iOS safe-area, `.ac-list` z-index raised above the tab bar, `role="img"` on the service icons + an aria-label on "+N",
muted-grey **contrast** darkened to `--text-muted` (was failing WCAG AA on white), and real `<h1>`s for the Pool/Earnings
titles. `tsc` clean.

**Locked via the preview loop:** uniform cards; badges = mission-only; the route rail with a mid-dot "+N"; full 2-line
addresses (no truncated titles); one-line footer; icons capped 3 + N by priority; Pool tab icon = stack; 4 tabs (Earnings
added). **Not exercised by seed data (code-reviewed only):** SPEED WIN badge, the +N stop marker, the at-disposal card,
the Today/Tomorrow accent.

**⚑ Parked (founder to decide):** the **discreet vehicle** in the footer — keep (it truncates to "Business · Se…" on a
narrow card) or drop it (it's redundant); the **"Both"** mission type (needs a new enum value + the model). **Not yet
redesigned:** My Rides / mission detail / Settings cards (Pool-first); the Earnings screen; the Pool empty + loading
states. **Next:** founder tests on phone (deploy `main`), then the follow-ons.

## 2026-07-23 — Session 42 — Waiting fees + a hard end-to-end stress test ([[d48]])
**Branch:** `main`. **Migrations (founder RAN all):** `2026-07-22_waiting_fee.sql`, `2026-07-22_airport_accent_fix.sql`,
`2026-07-22_guest_ready_at_guard_fix.sql`. Continues Session 41; the founder chose waiting fees over reschedulable time.

**D48 waiting model, SHIPPED + DEPLOYED (`0aed706`).** Courtesy wait (renamed from "free wait") 20 city / 60 airport,
then **€1/min started** Business→Driver, ceiling **€40 city / €60 airport** — the ceiling stops the MONEY not the trip
(no cron; a `least()` clamp). Two exits, both with a confirm: the Driver reports, or the Business declares via the
net-new **`business_declare_no_show`**. **`business_cancel_mission` now settles accrued waiting too** — it already
accepted `arrived` and charged a flat 100% past pickup, so without this "Cancel" was strictly cheaper than "stop
waiting" by the whole waiting amount (the loophole the pre-build review caught). A booked trip's **`pickup_at` is frozen
after draft** (blanket trigger, safe because time is never amendable) — this dissolves the postpone-then-cancel dodge.
- **Files.** SQL: the three migrations + one shared `mission_waiting()` / `mission_is_airport()` so the three settlement
  paths can't drift. App: `lib/cancellation.ts` (`waitingAt`, `WAITING_RATE_PER_MIN`, widened `isAirportPickup`),
  `rides/cancel-noshow.tsx` (the Driver meter states), `components/dispatch-waiting.tsx` (net-new Business meter +
  "stop waiting" confirm), `dispatch/actions.ts` (`businessDeclareNoShow`), `trip-row.tsx` (mount), `database.types.ts`.
- **THE BUG OF THE SESSION — found by probing, not reading.** The airport predicate `a[eé]roport` used a bracket
  expression with a multibyte char; **Postgres `~*` does not reliably match it**, so `"Aéroport Nice Côte d'Azur"` — the
  exact Mapbox string for the region's main airport — was classified CITY. Every accented airport pickup without a flight
  number had been getting a 20-min courtesy wait instead of 60 (a no-show fileable 40 min early). Latent since the O7
  spine (2026-07-13); the 07-19 label fix reused the same broken expression so didn't cure it. Proven with 3 identical
  missions differing only in the label; fixed by matching the ASCII substring `roport` (accent/case/NFC-NFD immune).
- **The guest_ready_at guard finally works (3rd try).** Two earlier attempts were no-ops (a column REVOKE against a
  table-level grant; a SECURITY DEFINER trigger where `current_user` is the owner). Fixed by dropping `security definer`.
  Live: Business PATCH → 403 unchanged; service role → 204. `pickup_at` still Business-writable (deferred, § H2).

**THE HARD END-TO-END STRESS TEST (founder-requested session close).** A tagged 14-driver / 3-business fleet provisioned
with real auth (`scratchpad/fleet.mjs`), then a **12-battery workflow** exercised the whole RPC + RLS + trigger layer
against the LIVE DB, each battery on dedicated drivers, each self-cleaning: **49/49 cases GREEN, 0 real bugs, 0 test
artifacts.** Batteries: accept_mission (atomic first-wins + lock-in) · driver-cancel + re-pool SPEED-WIN window ·
business-cancel ramp (fee_pct 0/50.83/80/90/100) · no-show clock D47 (incl. the accent regression as a discriminator) ·
waiting math + ceiling · money conservation across all 3 doors (identical totals, Business charged == Driver paid) ·
**concurrency race x5 (exactly one winner, RPC winner == DB driver_id)** + slot conflict · agreed release + supersede ·
amendment accept/decline · T-60 reclaim · RLS/privacy (cross-driver read denial, guest-contact side table, both column
guards) · state-machine guards. Fleet torn down; **DB verified back to baseline 34 missions**, no leftovers. Test scripts
live in the session scratchpad only (never the repo). Earlier the same paths were proven 13/13 + a 3-door settlement proof.

**Next:** the **Driver app redesign** (v2 preview approved in principle; the `arrived` screen needs a v3 drawn against the
now-shipped running meter, and the Pool filter chips are still an open keep/drop). Pricing-model research owed on the
€1/min rate + the caps. § H2 still holds: `pickup_at` freeze needs the column-grant audit; automated tests (this session
made the case — 3 of the session's bugs looked correct in code and only fell to live probing).

## 2026-07-22 — Session 41 — No-show clock origin: the Guest's due time, not the Driver's arrival ([[d47]])
**Branch:** `main`. **Migrations (founder RAN all three):** `2026-07-19_no_show_clock_origin.sql`,
`2026-07-19_no_show_airport_label.sql`, `2026-07-19_guest_ready_at_guard.sql` (the third is a **no-op** — see Failures).
Started as the Driver-app redesign; the founder corrected the no-show model mid-preview and the fix took the session.

**The correction (founder).** The free-wait countdown was anchored to the Driver's `arrived` tap in BOTH engines
(`mark_no_show` line ~310 and `rides/page.tsx` → `NoShowControl`). Wrong party: the free wait is the **Guest's** grace
period. Origin is now `coalesce(guest_ready_at, pickup_at)`; reporting unlocks at
`greatest(guest_due + wait, arrived_at + 5 min)`. Durations unchanged (60 airport / 20 city). `arrived` stays a
**precondition**, not the origin.

**It was a live exploit, not just a model error.** `advanceStatus` (`rides/actions.ts:76-79`) checks sequencing only — no
time guard — so a Driver could walk to `arrived` ~33h early, wait out the 20-min city window, and file: Business charged
100%, mission `completed`+`no_show`, Guest stranded. `pickup_at` anchoring closes it structurally.

**Second bug found by the review (pre-existing, from `2026-07-13_o7_cancellation.sql`).** Airport detection read only
`pickup_address`, but `address-autocomplete.tsx:235` writes `full_address` there and the POI name to `pickup_label`
(`2026-06-27_mission_place_labels`). So an autocomplete airport pickup **with no flight number** got the 20-min city
window. Hidden because `api/seed` writes "Aéroport" into `pickup_address`. Now tests both + `nullif(flight_number,'')`.

- **Files.** DB: the three migrations (`mission.guest_ready_at` nullable = the flight-tracking hook; deliberately NOT
  `flight_eta`, which is display-only). App: `lib/cancellation.ts` (new `guestDueAt` / `noShowAvailableAt` /
  `NO_SHOW_ON_SITE_FLOOR_MIN`, widened `isAirportPickup`), `rides/page.tsx` (passes `guestDueIso`+`availableAtIso`; stops
  swallowing the `status_event` query error), `rides/cancel-noshow.tsx` (separate `waitEnds` for the header chip so a
  floor-gated countdown can't claim the free wait is running; new "Starts HH:MM" state; `formatTime` instead of a
  per-tick `Intl` formatter), `rides/actions.ts` (comment), `lib/database.types.ts`.
- **Verification: 9/9 live** vs the real DB (scratchpad harness, real Driver JWT for `demo.driver@pickup.local` → Marc
  Dubois; creates disposable missions, exercises `mark_no_show`, deletes everything, `leftover=0`). The autocomplete-airport
  case was **demonstrated failing (ALLOWED) before the 2nd migration and passing (BLOCKED) after** — a genuine red→green.
  A city POI stays on 20 min, guarding against over-match. Two adversarial workflows ran (46 + 30 agents).

**The `guest_ready_at` guard took THREE attempts — two failed silently, both my error.** Worth recording as Postgres
gotchas, because each one *looked* applied and neither protected anything:
1. `revoke update (guest_ready_at) … from authenticated` — **no-op**: column privileges are only consulted when the role
   lacks **table-level** UPDATE, which `authenticated` has (via `p_mission_business_update`).
2. A `before update` trigger declared **`security definer`** — **no-op**: inside SECURITY DEFINER, `current_user` is the
   function OWNER, never the caller, so `current_user in ('anon','authenticated')` was never true.
3. ✅ **Same trigger, `security definer` removed** (`2026-07-22_guest_ready_at_guard_fix.sql`) — SECURITY INVOKER makes
   `current_user` the role PostgREST switched to. **Verified live: Business PATCH → 403 + value unchanged; normal Business
   column edit → 204; service role (the future tracking feed) → 204; no-show suite still 9/9.**
Each failure was caught only because the guard was **tested**, not assumed — migrations 1 and 2 both returned "success".
Test writes reverted (0 rows non-null). One live pooled mission (`2dd71a4d`, Antibes) had `luggage_count` set to 2 during
the "normal edits still work" check; prior value not recorded, founder chose to **leave it at 2**.

**Still open (BACKLOG § H2):** `pickup_at` has the same exposure and additionally feeds `business_cancel_mission`'s fee
tier, but it has a legitimate client writer (draft resume), so it needs a status-aware rule — folded into the
column-grant audit with the `p_mission_business_update` flag.

**Also logged to § H2:** negative `hours_before_pickup` on no-show rows (opposite sign to the other 4 kinds); the
`advanceStatus` early-tap (now data-quality, not money); device-clock vs Postgres-clock countdown skew (fails safe).

**Next:** back to the **Driver app redesign** — v2 preview approved in principle, two opens: (1) do the Pool filter chips
stay (they are a NEW feature I invented, not in the app today)? (2) the `arrived` screen still needs a v3 drawn against
the corrected model, since the "Starts HH:MM" state didn't exist when v2 was drawn.

## 2026-07-19 — Session 40 — O7 agreed release (Business-initiated) + the 24h re-pool SPEED-WIN window
**Branch:** `main`. **Migrations (founder RAN both):** `docs/migrations/2026-07-19_agreed_release.sql` (new `mission_release`
evidence table + `propose_release` / `respond_to_release` / `close_release` RPCs + widened `mission_cancellation.kind`) and
`docs/migrations/2026-07-19_repool_speedwin_window.sql` (the 24h re-pool window + review fixes; `create or replace` of the
four O7 RPCs). Both additive. **Decision [[d46]].** Finishes the actionable half of O7 (the copilote hand-over stays Phase 2 —
needs the community layer).

**The agreed release — the D45 mutual-consent "agreed cancellation".** A free, no-fee release that BOTH sides confirm.
**Direction = Business-initiated ONLY** (founder chose this over bidirectional, after seeing the D25 preview): the Business
taps a dedicated **"Agreed release · free"** button (distinct from the fee-paying Cancel) → the assigned Driver gets an
accept/decline card and **must accept** → the trip releases **free (no fee, no reliability mark)** and re-pools; decline →
the trip stays exactly as agreed. Eligible only while `accepted`/`confirmed`. The Driver's cancel-sheet escape valve ("Ask
the Business to release it — free") is the phone trigger; there is no Driver-initiated in-app proposal. Mirrors the amendment
pattern almost exactly (propose record + Driver accept/decline + atomic SECURITY DEFINER RPC).
- **Files.** DB: the two migrations. Driver: `components/release-card.tsx` (the card, with the safe-decline reassurance),
  `respondToRelease` in `rides/actions.ts`, loader + gate in `rides/page.tsx`, escape-valve copy in `rides/cancel-noshow.tsx`.
  Business: `components/dispatch-release.tsx` (`AgreedRelease` button + confirm modal), `proposeRelease`/`closeRelease` in
  `dispatch/actions.ts`, schedule states + button wiring + gates in `trip-row.tsx`, loader in `dispatch/page.tsx`. Types in
  `lib/database.types.ts`; CSS in `globals.css` (`.amc__lead`/`.amc__safe`/`.dx-amend--neutral`, else reuses the amendment classes).

**Dispute-ready evidence (founder's explicit concern — a Business coercing a committed Driver into a free release).** The
platform can't police the phone call, so it owns the defaults + the receipts: (1) declining is framed as **free, mark-free,
the Driver's choice** on the card, and the Business-side decline state is **calm, not alarmist**; (2) `mission_release` is
**append-only** — declines are retained; a Business only HIDES a resolved request (`dismissed_at`), never deletes/rewrites;
each row stores who/when/note/decision/`from_fare`/**`hours_before_pickup`** so "a free release proposed inside the fee
window, repeatedly declined" is legible and **per-Business counts are a query**. ALL writes go through the SECURITY DEFINER
RPCs (no client INSERT/UPDATE policy) → tamper-resistant (stronger than the amendment table; closes the class of gap the O7
review flagged). Abuse dashboard = deferred Admin workspace (BACKLOG F2); the data is ready for it. Logged the
review-weaponisation constraint (completed-trip + double-blind reviews) for whenever a Business→Driver review system is built.

**Re-pool pricing — the 24h SPEED-WIN window (founder decision; supersedes D45 "re-pool = always SPEED WIN at 70%").** A
re-pooled mission (driver cancel · T-60 reclaim · agreed release — ALL re-pool paths) now prices by time-to-pickup: **<24h →
SPEED WIN** (start 70% of ceiling, climb 5%/5 min); **≥24h → NORMAL Pool** (start 50% of ceiling, climb 5%/10 min, SPEED WIN
off) — the exact curves a fresh posting uses (`dispatch/new/actions.ts`). Re-pool re-bases the climb to `pooled_at`.

**Adversarial 3-lens review (SQL-security / TS-integration / UX-policy) → 6 confirmed of 10, ALL fixed** (2 verified-REJECTED:
client-forgeable `p_proposed_by` — tenant security holds; a hedged "24h" copy nuance). Fixes folded into the repool migration
+ UI: the cancel/reclaim/business-cancel RPCs now **supersede a pending `mission_release`** (business-cancel gained the
amendment supersede it was missing too); the release cards/briefs are **gated to a still-releasable trip** (no dead card past
accepted/confirmed; no stale "back in the Pool" once a new Driver re-accepts); `respond_to_release` locks **mission → release**
(matching `propose_release`) to kill a deadlock inversion.

**Verified live vs the real Supabase DB** — a self-contained script (`scratchpad/verify-release.mjs`) that creates a throwaway
tenant + missions, signs in as real Business + Driver auth users (the exact SECURITY DEFINER path), exercises the loop, and
cleans up: **28/28 assertions pass** — Test A (≥24h → normal 50%/int10/speed-off), B (<24h → SPEED WIN 70%/int5), C (decline
untouched + reason retained), D (business-cancel supersedes pending release), E (status guard blocks a stale accept), F
(deny-by-default writes: Business/Driver can't INSERT or rewrite a declined `mission_release`). `tsc` + `next build` green.
Founder ran migration #2 (a first-paste "syntax error" then a clean "success" — an incomplete `$$…$$` paste; the successful
idempotent re-run applied all four functions, confirmed by the 28 live checks). **Deployed to `main`.**

**Next here:** the **copilote hand-over** (O7 Phase 2 — needs the community/registration layer) is the last O7 piece. The
§ H2 review-flags remain (the Business-UPDATE RLS WITH CHECK; the fee basis freeze at `accepted_at`).

## 2026-07-13 — Session 39 — O7 cancellation: research + full ruleset decided + documented (no code yet)
**Branch:** `main`. **No code / no schema change this session — design + decisions only.** Founder chose to work on **O7
(cancellation)** and gave the full policy context; I ran a **4-agent research workflow** (canonical docs sweep · schema/code
sweep · global web benchmarks · French VTC + hand-over legal angle) to ground it, then captured the settled ruleset.

**Research highlights (fed the decisions):**
- Founder's model largely matches the market: **no-show → Driver paid after a wait** is universal; the **1h airport / ~20min
  city** split is the industry norm (Blacklane/Wheely/Uber Black/Welcome all = 60min from landing; city ~20–30min); an
  **escalating % as pickup nears** is validated (a Côte d'Azur operator publishes >24h 0% / 24–12h 50% / 12–6h 70% / <6h 100%).
- PickUp-specific (not a market norm, flagged): a **Driver fined ≈ the trip amount** (elsewhere a bailing driver is just
  re-dispatched, not fined) — must live in the Driver↔PickUp contract as an intermediary penalty, never a transport charge.
- **Copilote hand-over legal answer:** the founder's framing (full **transfer/novation** — original Driver drops out with
  zero pay/invoice/liability, copilote re-accepts on his own account) is **the clean, lawful structure** — cleaner than
  classic *sous-traitance* (which would make the original a "mini-principal" with URSSAF requalification risk). Guardrails:
  credential-gate to active same-category verified Drivers (2026 made *sous-traitance illicite* a named REVTC offence), own
  account, no money through the original, Business consent via terms. Precedent exists (Drivalty, iaDriver, WAY-Partner, VTC
  coops). Confirmed viable; **Phase 2, later.**
- Docs already encode part of it (driver-cancel-re-pools / business-cancel-terminal, dormant `cancelled_by`/`cancelled_at`,
  Lock-in = "T-180"). **Gaps O7 must invent:** no-show (entirely undefined), the **T-60 reclaim**, the hour-based business
  curve, the copilote layer, disputes, a fee/reliability data model, mid-trip cancel window (`arrived`), re-pool pricing.

**Decided ruleset (→ [[d45]]).** Driver voluntary cancel = **always 100%** (re-pools). Business cancel = **free >5h · 50% at
−5h · +10%/h → 100%** at pickup. No-show fires at status **`arrived`** (**1h airport / 20min city**) → **Business charged full,
Driver paid full like a completed mission**, PickUp keeps commission, Business settles with its own Guest. **T-60 Business
reclaim** (NOT a cancel) only when the assigned Driver **hasn't confirmed the Lock-in AND is unreachable** → reclaim button →
re-pool as SPEED WIN, penalty-free for the Business, Driver takes a **reliability mark** (gated to non-confirmation = anti-
abuse). Re-pool re-enters the Pool as **SPEED WIN at 70% of ceiling** (needs a `pooled_at` climb-origin). **Copilote hand-over
= Phase 2.** **NEW: SPEED WIN reachability gate** — geolocate the Driver, GPS-ETA to pickup, **block accept with a popup** if
they'd be late (build later). **Disputes = deferred, documented.** Euro *amounts* stay MANUAL in beta; the *rules* are fixed.

**Documented in:** `project/DECISIONS.md` **D45** (authoritative + the legal confirmation) · `docs/05_Roadmap_Backlog_TODOs.md`
(Cancellation & conflict section rewritten to the decided rules; copilote + SPEED WIN gate added) · `docs/PickUp_Phase0_Data_
Spine.md` (the "Cancellation %s" open decision resolved) · `project/BACKLOG.md` (new **§ N** with the full Phase 1 spine +
Phase 2 copilote + SPEED WIN gate + disputes; § B and § K O7 lines updated) · `project/IDEAS.md` (parked detail for the
copilote model, SPEED WIN gate, disputes).

**Phase 1 CODE BUILT (tsc + next build green; migration pending).** After the D25 previews were signed off (driver cancel
sheet + amber no-show + "be sure" nudge; dispatch live-% cancel modal + T-60 reclaim), implemented the cancellation spine.
- **Migration** `docs/migrations/2026-07-13_o7_cancellation.sql` (additive, founder-run): mission `cancellation_fee` /
  `cancellation_reason` / `pooled_at` / `no_show` / `no_show_at`; `driver.reliability_marks`; a widened `status_event`
  CHECK (adds cancelled/no_show/repooled); a `mission_cancellation` audit table (deny-by-default RLS, holds the fee record
  even for re-pooled trips); and 4 SECURITY DEFINER RPCs — `driver_cancel_mission` (100% → re-pool as SPEED WIN),
  `business_cancel_mission` (free while pooled / >5h, then 50%@−5h +10%/h → 100%; terminal), `reclaim_mission` (T-60,
  gated to accepted-but-unconfirmed), `mark_no_show` (from `arrived`, 60/20-min window, → completed + no_show) — all
  mirroring `accept_mission`.
- **Code:** `lib/pdp.ts` now climbs from `pooled_at ?? created_at`; `lib/cancellation.ts` (shared % ramp + airport
  heuristic, mirrors the SQL); driver `app/(app)/rides/cancel-noshow.tsx` (`DriverCancel` sheet + `NoShowControl` amber
  countdown) + 2 actions in `rides/actions.ts`; dispatch `app/(dispatch)/dispatch/actions.ts` + `components/dispatch-cancel.tsx`
  (`BusinessCancel` live-% modal + `ReclaimCard`) wired into `trip-row.tsx`; `missionTone` gained a "No-show" state;
  `lib/database.types.ts` extended (columns + table + 4 RPCs + `MissionCancellationRow`).
**Verified + reviewed (2026-07-13).** Migration applied by the founder. Ran a full end-to-end check via REAL authenticated
sessions (the browser pane was flaky, so signed in as the demo Driver/Business with the anon key — the exact SECURITY
DEFINER auth path the UI uses): all **5 money paths + 5 adversarial guards** pass against the live DB (business cancel
free / 70.02%, reclaim→SPEED WIN at 0.7×ceiling, driver cancel 100%, no-show→completed+charged; guards: reclaim-ineligible,
cross-tenant, no-show-too-early, role-mismatch ×2). UI rendering confirmed both sides via the a11y tree; airport heuristic
confirmed (flight OR airport address → 60 m). tsc + next build green. Test artifacts cleaned off the demo DB.
Then a **3-lens adversarial review** (correctness / security / integration) found 6 issues:
- **FIXED in the migration** (re-run the file — every statement is idempotent): (a) **HIGH** the re-pool RPCs
  (driver_cancel / reclaim) left a pending `mission_amendment` 'proposed', which could leak to the next Driver → now
  supersede it on re-pool; (b) **LOW** the widened `status_event` CHECK let a Driver spoof no_show/repooled rows → tightened
  `p_statusevent_driver_write` to the execution steps; (c) **LOW** a Business cancel's private `reason` was readable by the
  released Driver → `actor_driver_id` set null on business_cancel rows.
- **FLAGGED** (→ BACKLOG H2; not O7 regressions / beta-mitigated): **#1** `currentFare` doesn't freeze at `accepted_at`, so
  the recorded fee BASIS inflates toward the ceiling (pre-existing pricing behaviour; MANUAL settlement backstops it — a
  pricing-engine decision); **#2 (HIGH for prod)** `p_mission_business_update` has no WITH CHECK, so a Business could bypass
  the fee/reclaim gates via a direct PostgREST UPDATE (pre-existing RLS gap; ~nil risk in beta — key-gated, no payments;
  needs column-level grants before real Business users); **#3** `p_fare_snapshot` is client-supplied/forgeable → recompute
  in SQL when the pricing engine lands; **#6b** a mid-run Business cancel makes the trip vanish from the Driver's My Rides
  (visibility gap — pairs with notifications).
**Next:** founder re-runs the updated migration → re-verify the amendment fix → deploy. Then the immediate follow-ups:
the mutual-consent "agreed release" + the copilote hand-over (both reuse the amendment pattern).

## 2026-07-10 — Session 38 — Address search: Riviera-first ranking + narrower countries (Mapbox cleanup, Google deferred)
**Branch:** `main`. **No schema change.** **Touched:** `components/address-autocomplete.tsx` only. Founder flagged bad
autocomplete: typing "aéroport t2" returned a Roissy CDG Fnac #1, Barcelona/Geneva/Lisbon, with the Nice result buried at
#3. Asked whether to switch to Google.

**Diagnosis (tested the live Mapbox Search Box API directly):** two problems. (1) The country allowlist was a broad 12-
country EU list, so Spain/Portugal/etc. leaked in for vague queries. (2) Mapbox's POI ranking is genuinely weak for
prominent places — `proximity=Nice` only *nudges*, so a literal "T2" name match (CDG Fnac, a Barcelona parking) outranks
the local airport; `bbox`, `poi_category=airport`, tighter proximity all failed to float the real "Terminal 2, Aéroport
Nice-Côte d'Azur (NCE)" (it exists in Mapbox but ranks below shops/kiss-and-fly/Airbnbs). **Google Places weights
*prominence* and would genuinely rank major airports/hotels/stations first** — so the founder's instinct is sound.

**Decision (founder):** *Mapbox cleanup now (free, no new integration), Google later.* Google needs a Google Cloud
project + Places API key + billing the founder sets up (deferred to the integration phase, like the other third-party
integrations). Logged as the future fix for true POI precision.
**UPDATE (2026-07-10, later):** founder explicitly **deferred the Google swap until the final domain is registered** — so
the browser API key gets restricted to the *right* domains ONCE (avoids redoing it after the rebrand DNS move). The brand
name is now **RED Executive** (Riviera Executive Driver) and a Google Cloud project "RED Executive" exists, but the key/
switch waits. **For now: stay on Mapbox** (the Riviera-first cleanup above is the current state). When the switch happens
it's ~1 session, one file (`address-autocomplete.tsx`), Mapbox kept for routing. Related: the domain migration
(pickupbedriven.com → a RED domain) is its own separate ~1-session task (DNS + Vercel + Supabase redirect allowlist +
`lib/hosts.ts` + the key restriction), also waiting on the founder registering the name/domain.

**Shipped (Mapbox cleanup):** (1) `DEFAULT_COUNTRIES` narrowed `fr,mc,it,ch,de,es,be,lu,nl,gb,at,pt` → **`fr,mc,it,ch`**
(France + the only neighbours a Riviera VTC actually DRIVES to: Monaco, Italy, Switzerland/Geneva). (2) A **Riviera-first
re-rank** — `isRiviera()` tests each suggestion's formatted address for a Côte d'Azur marker (postcodes 06/83/98000 or the
towns we serve) and a stable sort floats local hits to the top *without hiding* far destinations (they still show, below).
Verified live vs the real Mapbox API + in the browser field: "aéroport t2" now returns **"Kiss and Fly - Terminal 2, 06200
Nice" at #1** (Barcelona/Lisbon gone). Known limit: the exact NCE terminal still won't surface for that vague query — that's
the Google-later fix. `tsc` clean, no console errors. Deployed.

## 2026-07-10 — Session 37 — Mission-form polish: review card, capitalised names, numeric-only fields, trail time, pricing vehicle chip
**Branch:** `main`. **No schema change.** Five founder-requested tweaks; the two visual ones (review card + pricing chip)
went through a D25 preview (signed off "go"). **Touched:** `app/(dispatch)/dispatch/new/mission-form.tsx`,
`components/passenger-list.tsx`, `components/trip-row.tsx`, `app/(dispatch)/dispatch/[id]/edit/edit-form.tsx`,
`app/globals.css`.

1. **Review-before-posting card — lightly polished** (`mission-form.tsx`): the flat `.kv` + old `.route` swapped for the
   S36 detail vocabulary — the `.dx-rte` route rail (dot-to-dot connector), `.dx-srow` rows, and **chips** for Languages /
   Dress / Requests (`.dx-chip`). Guest + pax + bags collapse to one line; reference marked "· your team only". Same card,
   just coherent with the trip detail. Verified live (fare 65 €, connector route with a stop, all chips render).
2. **Names auto-capitalise** (`passenger-list.tsx`, shared by new + edit): a `capitalizeFirst` on the Guest first/surname
   `onChange` — first letter only (safe for "Al Souad"/"de la Croix") + `autoCapitalize="words"`. Verified: james→James.
3. **Numeric-only fields** (`mission-form.tsx` + `edit-form.tsx`): `luggage_count` (integer), `base_fare` + `ceiling`
   (money) switched from `type=number` to `type=text` + `inputMode` + a controlled sanitize (`digitsOnly` / `decimalOnly`
   — strips letters, `e`, `+`/`-`, extra dots; comma→dot). Reliable vs `type=number`'s quirks. Verified: `12ab.3cd9`→
   `12.39`, `9.9.9xx`→`9.99`, `3a4b`→`34`. Phone left flexible (needs `+`/spaces). (Amend-form fare left for later.)
4. **Edit trail shows the time** (`trip-row.tsx`): the `.dx-trail` now leads with the bold edit time
   (`formatDateTime(infoChange.at)`) then the changes; the separate top "Edited ·" stamp is suppressed when a trail is
   present (no double time). Verified live on trip `d6f7c70a`.
5. **Pricing card vehicle reminder** (`mission-form.tsx`, `.mx-vehiclechip`): a live accent-soft chip in the Pricing card
   head showing the class·body you're pricing (`serviceClassLabel(tier, body)`; "Business · Van" in luggage-only mode). The
   specific car isn't lifted from ServiceClassFields, so the chip is class·body only (the specific car is already in the
   review card) — a small follow-up could add `onCarChange` to include it. Verified: renders "Business" + accent-soft bg.

**Verified** on localhost vs the real Supabase DB: `tsc` clean, no console errors on the form or schedule. Deployed.

## 2026-07-10 — Session 36 — Expanded trip-row redesign + a "what changed" trail (detail-edit change-log)
**Branch:** `main`. **Migration (founder RUNS it):** `docs/migrations/2026-07-10_mission_info_change.sql` — a **new
`mission_info_change` table** (+ RLS, deny-by-default for Drivers). Additive only; base schema untouched (hard-rule #4).
**New files:** `lib/info-changes.ts`. **Touched:** `components/trip-row.tsx` (the detail rewrite), `app/globals.css`,
`app/(dispatch)/dispatch/page.tsx`, `app/(dispatch)/dispatch/[id]/edit/actions.ts`, `lib/database.types.ts`.
**D25 previews** (v1→v5 visualize mockups) all signed off ("that way better!!"). Founder decisions folded in below.

**Why:** the expanded `.dx-trip__detail` was one flat 15-row `.kv` definition list (When/Fare/Vehicle/Specific car/
Trip/Guest/Reference/Languages/Dress/Requests/Board/Message/Pax/Flight/Driver/Car) — equal weight, no grouping, and it
re-showed the collapsed row (When/Guest/Ref/Flight + the route drawn twice). Hard to scan across many trips. Founder
ask: "easy on the eyes, fast, efficient."

**The redesign (`.dx-trip__detail`, `.dx-*` classes; the flat `.kv`/`.route` kept for other pages — rides, missions,
new-mission form):** meta line (private **Reference lock-chip** "· your team only" + the detail-only "Edited ·" stamp)
→ **two edit-action tiles, each with a one-line helper** (Edit details = "Update guest, flight & service info · applies
now"; Propose a change = "New route or fare · the Driver must agree") so the two aren't confused (founder Q) → the
**"what changed" trail** → amendment state → hint → **scan-strip** (Pickup left · Vehicle · Flight · **Fare now right**,
per founder; the Flight tile drops out with no flight number) → **Route card** (full addresses + trip **distance·duration
in the header** beside the route, per founder; a **dot-to-dot connector that STOPS at the drop-off dot** — the old rail
overshot; live stop check-off preserved) → **slim single-line Driver bar** (avatar · name · tappable phone · car·plate;
"No Driver yet · in the Pool" when unassigned — was a stretched half-empty panel, per founder) → **Service · Guests
side-by-side** (`.dx-pgrid`; languages/dress/requests as **chips**; pax/bags shown **once**, in the Guests header, not
duplicated in the scan-strip per founder). Every variant handled: no driver, luggage-only, in-progress, no flight/guests/
service, and the amendment pending/declined/accepted states.

**"Can we see what a Business changed?" (founder Q) — two levels, both built:**
1. **Route/fare change (amendment) — no schema.** The "Change accepted" state now shows the **diff**: `Fare <s>120 €</s>
   → 140 € · Add a stop at 3 Bd de la Ferrage` (data already in `AmendmentBrief` — fareOld/fareNew/summary).
2. **Detail edit (guest/flight/service) — new migration.** `updateMissionInfo` now snapshots the info **before** the
   write, computes a human-readable diff (`lib/info-changes.ts` `diffMissionInfo` → phrases like "Flight BA342 → BA118",
   "Added guest X", "Dress Smart casual → Business formal"), and appends a row to **`mission_info_change`**. The schedule
   loads the **latest** row per mission (RLS-scoped) → a `.dx-trail` line under the actions. **Privacy:** the diff can
   contain the private reference tag / guest names, so it CAN'T sit on the mission row Drivers read — it's a **Business-
   only side table, deny-by-default RLS** (mirrors `mission_guest_contact` / `mission_amendment`). Founder chose the
   fuller "add the detail change-log too" option (vs amendment-diff-only). Both degrade gracefully pre-migration
   (missing-table query → empty; the insert logs + is non-fatal).

**Verified (localhost, real Supabase DB — `mission_info_change` NOT yet applied, so the trail degrades to empty):** `tsc`
clean. Dispatch schedule renders (27 real trips). Expanded a real Confirmed trip w/ an accepted amendment
(`d6f7c70a`, Jason Statham · Marc Dubois): the **whole redesign renders** — lock ref-chip, both action tiles w/ helpers,
the **enriched "Change accepted — Fare 120 → 140 € · Add a stop"**, scan-strip in order (Pickup·Vehicle·Flight·Fare-right),
route card w/ the connector **confirmed stopping at the drop-off dot** (`::before content:none` on the last leg), slim
driver bar, Guests panel "2 passengers · 2 bags". **No console errors.** Screenshot matches the approved v5 mockup.

**PENDING:** founder RUNS `2026-07-10_mission_info_change.sql` in Supabase → then deploy. (Redesign + amendment diff are
migration-independent; only the detail-edit trail waits on the table.) **Next:** the detail-edit change-log field-level
history is per-field human phrases stored at edit time (latest edit shown); a multi-edit visible history is a later
extension. Founder's other named items remain: Driver app redesign, the pricing-engine-dependent items.

## 2026-07-07 — Session 35 — Mission edit PHASE 2: the amendment / consent flow (propose → accept/decline)
**Branch:** `main`. **Migration (founder RUNS it):** `docs/migrations/2026-07-07_mission_amendment.sql` — a **new
`mission_amendment` table** (+ RLS + 2 indexes) and the atomic **`respond_to_amendment` RPC**. Additive only; the base
schema is untouched (hard-rule #4). **New files:** `lib/amendments.ts`, `app/(dispatch)/dispatch/[id]/amend/{page.tsx,
amend-form.tsx,actions.ts}`, `components/amendment-card.tsx`. **Touched:** `lib/database.types.ts`,
`components/{route-stops,trip-row}.tsx`, `app/(dispatch)/dispatch/{new/mission-form.tsx,page.tsx}`,
`app/(app)/rides/{page.tsx,actions.ts}`, `app/globals.css`. **D25 previews** (4 driver-card iterations → the muted-ends
route-diff card; the propose screen; the decline path) all signed off ("agreed go"). [[d40]]

**Why (D39 Phase 2):** once a Driver has ACCEPTED, PickUp is the AGENT between two parties, so a **material change
(route / fare)** can't be applied silently — it's a **proposed amendment the Driver accepts or declines**, recorded
in-app even if they agreed by phone. Phase 1 (info-only edit, no consent) shipped S34; this is the consent flow.

**Data model (greenfield — nothing existed):** `mission_amendment` = the audit trail. Columns: the proposed NEW route
(`new_pickup_*`, `new_dropoff_*`, `new_waypoints`, `new_distance_km`, `new_duration_min`) + `new_fare` (the new agreed
TOTAL), a `from_snapshot jsonb` (the trip AS AGREED at propose-time incl. the current fare, for the "was …" display +
record), `note`, `decline_reason`, `status` (`proposed→accepted|declined|superseded`), timestamps, `business_id`
(denormalised for RLS), `proposed_by`. RLS: Business select/insert/update on its own missions (INSERT also checks the
mission is theirs); Driver select on missions assigned to them; **no Driver INSERT/UPDATE** — the response goes through
the RPC. Supabase default privileges cover the new table (base schema has no explicit grants).

**The atomic apply — `respond_to_amendment(p_amendment_id, p_accept, p_reason)` RPC** — a faithful **mirror of
`accept_mission`**: `SECURITY DEFINER`, resolves `current_driver_id()`, row-locks the amendment + mission, verifies the
mission is this Driver's and still `accepted/confirmed`, then in ONE transaction: **accept** → swaps the new route + fare
onto the mission and marks the amendment accepted; **decline** → leaves the mission untouched, marks it declined (+
reason). The fare is **frozen at `new_fare`** by collapsing the PDP curve (`ceiling = pdp_start = new_fare`, flat
step/interval, `speed_win=false`) so `currentFare()` reads exactly the agreed total (there's no stored "agreed fare"
today — the PDP climbs from `created_at`; this is the clean way to pin it). `stops_reached` resets. Conditional
`where … status='proposed'` → atomic first-wins (concurrent double-accept / accept-vs-decline can't half-apply).

**Business — propose screen (`/dispatch/[id]/amend`):** a locked "trip as agreed" header (route · time · assigned
Driver + car · agreed fare) + a two-pane form mirroring the new-mission layout: left = the exact `RouteStops` editor
(pickup + stops + destination **all editable** — founder asked to allow pickup) + a manual "New agreed fare" field
(shows the live delta) + an optional note; right = a **live "what the Driver will see" preview** (change summary +
fare/distance/drop-off deltas) + the send button. `proposeMissionAmendment` (USER session, RLS) verifies ownership +
`accepted/confirmed`, recomputes the ETA server-side (traffic-aware), snapshots the from-state (incl. `currentFare`),
**supersedes any still-pending proposal**, and inserts the new one. Redirects to `/dispatch?open=<id>` (the S33 deep
link) — the trip now reads "Change pending". `closeAmendment` withdraws a pending / dismisses a declined one.

**Driver — accept/decline card (`components/amendment-card.tsx`, in My Rides):** the approved v4 card — the change reads
**inside the route** (unchanged legs muted grey, the changed leg highlighted with a "New stop / New destination / New
pickup" badge; removed stops struck), a "was …" line, the Dispatcher's note, then **what it means for you** (fare
old→new + delta, distance·time, **Drop-off** [finish-flag icon, not a plane — founder's call]), an amber **slot heads-up**
(reuses the ±90-min idea: computes the trip's new end vs the Driver's next pickup — "tighter" or "overlaps"), and the
binding **Accept the change / Decline**. Decline opens an **optional one-tap reason** (Schedule too tight / Too far /
Timing / Other) — softens the rejection for the Business (founder ask). `respondToAmendment` calls the RPC via the USER
session (must NOT be service role — the RPC reads `auth.uid()`, like `accept_mission`, D6). Slot warning computed in
`rides/page.tsx` (`SLOT_TIGHT_MIN=30`).

**Business — schedule states (`trip-row.tsx` + `dispatch/page.tsx`):** the expanded detail gains a **"Propose a change"**
entry (accepted/confirmed only, next to "Edit details"), and renders the amendment state: **Change pending** (navy chip
+ summary + Withdraw), **declined** (a calm reassurance — "declines are normal in busy periods, not personal" — + the
reason + trip-stays-as-agreed + **Call / Adjust and re-send / Dismiss**), or a subtle **Change accepted · <time>**. The
dispatch page loads the latest non-superseded amendment per mission (RLS-scoped) → a compact `AmendmentBrief`.

**Founder feedback folded in (from the preview loop):** (1) enable **pickup edit** (not just destination + stops); (2)
the **decline reassurance** for the Business (busy-season scheduling, not personal) + the Driver's optional reason; (3)
fixed the send-rail copy — after sending you **leave for the schedule**, so it now says the answer shows there as
"Change pending" (was the wrong "you'll see his answer here"). Earlier: the driver card went through 4 iterations — the
change must read **in-context inside the route** (not an abstract hero banner), with the two unchanged ends muted so the
new stop stands out; and the drop-off row uses a **finish-flag**, not a landing-plane (a plane = a pickup to a Driver).

**Reused `RouteStops` (the most-worked component) safely:** added 3 additive fields to its `RouteSummary`
(`pickupText/dropoffText/stops`) so the amend preview can diff the live route; the new-mission rail ignores them (its
initial literal was updated to satisfy the type). Pure diff/summary helpers live in `lib/amendments.ts` (`routeDiff`,
`changeSummary`, `parseFromSnapshot`, `buildFromSnapshot`, `dropoffInstants`, `DECLINE_REASONS`), shared client + server.

**Verified (localhost, real Supabase DB — the mission_amendment table NOT yet applied, so the flow degrades gracefully):**
`tsc` clean. Dispatch schedule renders (27 real trips; the amendments query returns nothing without the table — no
crash). **Propose screen renders end-to-end** for a real Confirmed trip (locked header "Marc Dubois · Mercedes Classe E
· Agreed fare 130,00 €", RouteStops editor, live ETA, fare field) and the **live delta reacts** (145 € → "Current 130,00
€ · +15,00 €" green, and the preview rail "130,00 € → 145,00 € +15,00 €"); the empty-route-diff path shows "Fare change
only" (exercises `routeDiff`/`changeSummaryParts`). Driver rides page renders. **No console errors on any surface.** The
two-pane collapses to stacked under the narrow preview panel (correct; side-by-side ≥ ~600px content).
**Then the founder RAN the migration** (2026-07-07) and the FULL loop was **verified live vs the real DB**: (1) a
fare-only **propose → decline** (RPC decline branch; trip fare untouched; Business sees the reason + reassurance state);
(2) a fare-only **propose → accept** (RPC accept branch; fare swapped 55→70 €, frozen; "Change accepted"); (3) a real
**add-a-stop route change** — Business added "3 Bd de la Ferrage" (ETA recomputed 57 km · 1h13, fare 120→140 €) → the
Driver card rendered the **highlighted new stop + badge** with the deltas → accept → the **mission genuinely swapped**
(route now pickup → 3 Bd de la Ferrage → Pl. du Casino Monaco, Trip 57 km · 1h13, Fare 140 €). RLS (business insert +
driver read), the atomic RPC (both branches), and the fare-freeze all confirmed. No console errors. **Pushed + deployed**
(`fc63a37` — Vercel deployment SHA + build status verified `success`).

**Deploy note:** the follow-up **docs-only** commit `51784d8` hit a **transient Vercel build flake** (`failure`), even
though its app code is byte-identical to the successful `fc63a37`. Reproduced `next build` **locally → clean** (all
routes compile, incl. `/dispatch/[id]/amend`), confirming it was infra, not code; production was never down (Vercel keeps
the last successful deploy live). Re-triggered with an empty commit → **`ddeadf5` deployed `success`**. Lesson added to
the WORKFLOW note in `NEXT_SESSION.md` (a transient BUILD FAILURE, not just a dropped commit, also happens — reproduce
with `next build`, re-trigger if it passes). **Test artifacts left on the shared demo DB** (visible on prod too, all
revertible): trip `00a5e67b` fare 55→70 € (accepted), `d6f7c70a` +stop "3 Bd de la Ferrage" & 120→140 € (accepted),
`1b8a1444` a declined-change example.

**Next:** **Phase 3** (auto price-delta via the pricing engine + notifications so the Driver is alerted without watching the
app + an in-app "could we add a stop? +€X" note) — both wait on deferred integrations. Also queued: O7 cancel/re-pool
(the decline "or Business cancels" path), the unfolded-trip-row redesign (founder's other named item), Driver app redesign.

## 2026-07-05 — Session 34 — Edit a posted trip's INFO without touching price (mission edit, Phase 1)
**Branch:** `main`. **No schema change.** New: `app/(dispatch)/dispatch/[id]/edit/{page.tsx,edit-form.tsx,actions.ts}`.
Touched: `components/trip-row.tsx` ("Edit details" link + `editable` flag), `app/globals.css` (`.ex-*` / `.dx-editlink`).
**D25 preview** signed off ("ok"). First slice of the KEEP "limited edit" feature (Doc 02); design phased with the
founder — Phase 2 (amendment/consent for material changes) + Phase 3 (auto-delta + notifications) are in IDEAS.

**Shipped:** a Business can edit the **info a Driver sees** on a posted mission — Guest names + phones (+ share),
flight number, luggage, reference, and the whole Driver & service card (languages, dress, request flags, meet &
greet board + file, private message) — **without changing the price, route, or time.**
- **New route `/dispatch/[id]/edit`** (server `page.tsx`): loads the one mission + its `mission_guest_contact` phones
  (RLS-scoped), renders a **read-only "locked" header** (route rail · time · `Fare (now)` · ceiling · status pill,
  via `missionTone`) with a note that route/price changes are the Phase-2 amendment flow, then the editable form. If
  the trip isn't editable it shows a "frozen" notice instead of the form.
- **`edit-form.tsx`** (client) **reuses the exact new-mission components** — `PassengerList`, `ReferenceField`,
  `DriverServiceFields` — pre-filled the SAME way the form seeds a resumed draft (`mergeContacts` + `splitFullName`
  fallback + pad to `pax_count` bounded `VAN_SEATS`; `parseLanguages`/`parseDriverFlags`/`hasBoardFile`). Tier for the
  dress-code default derives from `mission.category` (SERVICE_TIERS, legacy `van`→business fallback). A luggage-only
  run hides the Guests card. `useFormStatus` Save button ("Saving…"), multipart for the board file.
- **`actions.ts` `updateMissionInfo(id, formData)`** — the safety core. **Whitelists ONLY info columns**; the UPDATE
  object literal can't receive price/route fields, so `base_fare/ceiling/pdp_*/speed_win/created_at/category/pickup*/
  dropoff*/waypoints/distance_km/duration_min/zone/status/luggage_only/required_*` are all untouched → the PDP curve
  and Pool matching can't move. **Atomic status guard** via `.in("status",["pooled","accepted","confirmed"])` on the
  update (+ `business_id` eq + RLS) — no TOCTOU with a mid-edit accept; 0 rows → `?error=locked`. Mirrors createMission
  for passenger parsing, the board-file upload/clear conditional-spread (keeps an existing board when no new file), and
  the `mission_guest_contact` upsert-else-delete (only after the row update matched — no orphan). Redirects to
  `/dispatch?open=<id>` (reuses the Session-33 deep link → row expands + scrolls). `revalidatePath` schedule/calendar/history.
- **Entry point:** an "Edit details" link in the expanded schedule trip detail, shown only while `pooled/accepted/confirmed`.

**Verified live** (localhost, real Supabase DB): edit link appears on an editable trip → edit page renders (locked
header Eco·Van €67.50/ceiling €90, all 3 cards) → set reference + driver message → save → redirected to `?open=` with
the row expanded; **reference + message persisted, and Fare 67,50 € · ceiling 90,00 € · route 9.7 km/18 min · status
"In the Pool" ALL UNCHANGED.** `tsc` clean; no console errors. **Adversarial 2-lens review (security + parity, Opus,
51 tool calls) → 0 findings** (price-safety invariant + createMission parity both hold).

**Follow-up (founder feedback, same day):** two polish asks on the edit feature.
- **Edit button placement** — it was at the BOTTOM of the expanded trip detail (expand + scroll = unintuitive). Moved
  it to the **TOP-right of the detail** as a filled navy button (first thing you see on expand). D25 mockup: founder
  picked "top of detail only" (declined a row-level pencil). No schema — shipped first (`5e6a0cb`).
- **"Edited" mention** — founder wanted a simple edited indicator **in the trip detail only, NOT on the collapsed row**
  (declined per-item "what changed" — that's really a Driver-notification feature, deferred to the edit Phase 3).
  Migration `docs/migrations/2026-07-05_mission_info_edited_at.sql` (`mission.info_edited_at timestamptz`, founder RAN
  it live). `updateMissionInfo` stamps `info_edited_at = now()` on every info edit (never on price/route/status).
  `trip-row.tsx` shows **"Edited · <time>"** (via `formatDateTime`) at the top-left of the detail edit bar, kept even
  after the trip is frozen; **never rendered on the collapsed `<summary>` row.** `lib/database.types.ts` updated (Row +
  Insert). Verified live: edit → "Edited · dim. 05 juil., 18:51" shows in the detail, absent from the row, ceiling
  unchanged. `tsc` clean.


---

## Older sessions (1–33) — archived
Sessions 1–33 (2026-06-16 → 2026-07-05) live in **`project/SESSION_LOG_ARCHIVE.md`** to keep this file — and
session startup — light. Read the archive only if you need that deep history; `project/CHANGELOG.md` has the
plain-language big picture.
