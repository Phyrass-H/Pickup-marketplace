# PickUp — Session Log

> Append-only, newest at top. One entry per working session. Keep it short:
> what changed, what was decided, what's next.

---

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

## 2026-07-05 — Session 33 — Calendar redesign (month load-map + week time-grid + trip-focused day panel)
**Branch:** `main`. **No schema change.** Files: `components/dispatch-calendar.tsx` (full rewrite),
`app/(dispatch)/dispatch/calendar/page.tsx`, `app/(dispatch)/dispatch/calendar/loading.tsx` (new),
`components/scroll-to-trip.tsx` (new), `app/(dispatch)/dispatch/page.tsx`, `components/trip-row.tsx`,
`app/globals.css`. **D25 loop:** 4 inline mockups → founder picked **month Option A (chips, no summary bar)**,
**week = vertical time-grid** (rejected the hotel-style horizontal tape chart — "trips aren't about how long they
run like hotel rooms"), **uniform card heights** (not duration-scaled — "it's about the pickup moment"). Founder
also ruled OUT any luggage/night labelling in the overview (neutral: time · guest · status only).

**Shipped:**
- **Month = a load-map.** Chips are readable (mono time + guest, a status rail on the left instead of the old
  near-white pastel tints); past days dimmed; a compact **status legend** on the page; chips capped (~5) then a
  "+N more" that opens the day panel. KPI chips are now honest **month totals** (label "Assigned", not the old
  filtered "Confirmed") and stay as click-filters.
- **Week = a real time grid.** Hours down the left (06:00–22:00, auto-stretched to fit early/late pickups + the
  last card's full height), proper "lun 29" day headers, each trip a **uniform card at its pickup time**,
  overlapping pickups split into side-by-side lanes (`layoutDay`), a navy **"now" line** on today (client-only,
  re-ticks each minute). No day/duration or night shading — neutral overview.
- **Trip-focused day panel.** Clicking any chip/card **anywhere** opens the panel with **that trip expanded**
  (mini Schedule-style rows: rail · time · route · pill; fare · ceiling · driver · pax/bags · flight · ref).
  **"Open in Schedule"** deep-links `/dispatch?open=<id>` → the row expands + scrolls into view (opens the
  "Earlier trips" fold for past days); **"Open day in Schedule"** → `/dispatch?day=<key>` scrolls to the day band.
- **Polish/fixes:** view + week persist in the URL (reload/Back-Forward land where you were); a `useTransition`
  busy-dim on month/week nav (route `loading.tsx` never fires for same-segment param nav); vehicle filter fixed
  (matches raw category/body — `Business · Van` no longer vanishes); side-scroll < 880px; "+" quick-add visible on
  touch; a11y (`aria-pressed` on view/KPI toggles, focus-trap in the panel).

**Review (13-agent adversarial workflow) → 7 confirmed findings, ALL fixed + re-verified live:** (1) week-view
late cards stacked because the bottom clamp ran AFTER lane layout → moved the clamp into `layoutDay` + grow the
hour range to fit the last card; (2) Back/Forward showed the wrong week + the persist effect overwrote it → resync
view/week from the server payload in a `useLayoutEffect` (deps `[data.ym, data.landWeek]`); (3) transient stale
`?wk=` on cross-month hops — same fix; (4) Enter/Space on a nested chip ran the cell's action → `onActivate`
ignores bubbled events; (5) "Open day" dead-ended in the collapsed fold → deep link opens ancestor `<details>`;
(6) no focus trap in the aria-modal panel → added; (7) no `aria-pressed` on the toggles → added. **Plus a real
hydration mismatch** the review surfaced live: the now-line's `top` came from `new Date()` at render → gated it
client-only (SSR emits no now-line; confirmed `ssrHasNow:false`).

**Verified live** (localhost, real Supabase DB): month + week render; day panel opens focused on the clicked trip;
both deep links land correctly (incl. past-day fold); Back/Forward restores the right week both directions; now-line
renders in today's column at the correct minute; `tsc` clean. **Next:** founder to click the full loop on real data;
Driver-app redesign + saved-addresses book still queued.

**Post-review follow-ups (same session, founder feedback 2026-07-05):** calendar approved ("works fine"). Shipped:
(1) **moved the night-pickup nudge from the Schedule card to the Pricing card** on `/dispatch/new` — it's pricing
advice ("raise ceiling / SPEED WIN"), so it now sits under the SPEED WIN control it references; pure JSX relocation,
logic unchanged (`components`… `mission-form.tsx`). Verified live: nudge renders in the Pricing card, Schedule card
cleared. (2) **Dev-only Pool "see all"** — `app/(app)/pool/page.tsx` now takes `?all=1` (gated by the existing
`NODE_ENV/VERCEL` hosted-check, same idiom as dev-login/seed, so it NEVER ships to real drivers): bypasses the
tier/zone/body/luggage/specific-car filters so one demo Driver can test the whole Pool. The Class-E sedan demo driver
now sees van/luxury/eco **and the luggage run** — unblocks pool testing. A dev-only banner links between "my matches"
and "show all". Captured to IDEAS: (a) **edit a posted mission's INFO without touching price** (the founder's ask —
first slice of the KEEP "limited edit" feature; info fields only, addresses/waypoints are the price-hazard to gate;
note `currentFare` doesn't read distance today so info edits are price-safe now, but gate for future distance pricing);
(b) **midnight-edge date ambiguity** ("Monday 00h15" = the Sun→Mon night — a Driver could misread it) → a "nuit de X à
Y" disambiguation safeguard. Neither built yet.

## 2026-07-04 — Session 32 — Luggage-vehicle Phase 1 ("van for luggage": trip-type toggle · Driver opt-in · Pool label)
**Branch:** `main`. **Migration (founder RAN it live 2026-07-04):** `docs/migrations/2026-07-04_luggage_run_phase1.sql`
— 2 additive columns: `mission.luggage_only boolean default false`, `driver.accepts_luggage_runs boolean default false`.
Files: `lib/database.types.ts`, `app/(dispatch)/dispatch/new/{mission-form.tsx,actions.ts}`,
`components/{driver-vehicle-fields,mission-card,trip-row}.tsx`, `app/(app)/pool/page.tsx`, `app/onboarding/actions.ts`,
`app/(app)/settings/{page.tsx,actions.ts}`, `app/(app)/missions/[id]/page.tsx`, `app/globals.css`. Preview (D25) signed
off (founder ran the migration = go).

**Why (founder, Sujet B):** "sometimes we just hire an additional Van for luggages and it's enough." Phase 1 models a
**van used for luggage** — NOT a new truck class (that + volume/m³ bands = Phase 2), and NOT a grouped car+van mission
(that's the CUT grouped-mission feature). Boundary: a **standalone luggage run is its own mission**; grouping comes later.

**Shipped:**
- **Data:** `mission.luggage_only` + `driver.accepts_luggage_runs` (both default false).
- **Business new-mission:** a **"Trip type: Passengers | Luggage only"** segmented toggle atop Vehicle & class. "Luggage
  only" → **forces Van + category Business** (catalog vans are business-tier, so this is how it matches Van Drivers),
  **hides passengers**, keeps the bags field, submits `luggage_only=1`. `actions.ts` re-forces category=business /
  body=van / pax=null / no passenger_names when luggage_only (tamper-proof). The S31 luggage nudge is suppressed here.
- **Driver enrollment/settings:** an **"Available for luggage-only runs"** checkbox in `DriverVehicleFields`, shown
  **only for Van** drivers, **off by default** (explicit consent → a Driver who won't carry bags in their van is never
  offered one). Persisted by `onboarding/actions.ts` and driver `settings/actions.ts` (both gated to van).
- **Pool matching:** `if (m.luggage_only && !driver.accepts_luggage_runs) return false;` — luggage runs reach only
  opted-in Van Drivers (body=van + category=business already scope to Van Drivers; this is the willingness gate).
- **Labels:** a navy **"Luggage run"** badge (new `.badge.luggage`) on the Pool card + Driver mission detail; both show
  **"no passengers · N bags"**; the Business schedule row shows **"Luggage"** in the guest cell and **"No passengers ·
  N bags"** + "· Luggage run" in the expanded detail.

**Verified:** `tsc` clean (12 files). Drove it live (localhost, dev-login): Business form — toggle → van/business forced,
passengers hidden, bags kept, `luggage_only=1`, S31 nudge suppressed, toggle-back fully restores passenger mode. Driver
settings — opt-in **hidden for the Sedan** demo driver, **appears when body=Van**, off by default, correct copy. Pool
still loads cleanly with the new filter (regression). No console errors. **Not fully e2e** (creating a geocoded luggage
mission + a van-driver accept needs the Mapbox flow) — founder to click the full create→pool→accept loop on real data.

**Next:** pricing (in progress, founder). Then Phase 2 (volume/m³ bands + real cargo/truck classes; grouped car+van),
Tier-2 guidance (glossary tooltip + status legend), Driver app redesign. **Not pushed** — awaiting founder's go.

---

## 2026-07-04 — Session 31 — Mission-form guidance: input-driven nudges (luggage / night) + a full guidance audit
**Branch:** `main`. No migration. Files: `app/(dispatch)/dispatch/new/mission-form.tsx`. New reference doc:
`project/GUIDANCE_AUDIT.md`. Idea captured: `project/IDEAS.md` (smart Pool / no empty-return charge).

**Why (founder):** the recurring "very guided page" ask. Ran a **full guidance audit** (4-way parallel workflow:
new-mission form · rest of Dispatch · Driver app · whole-app grep) → `project/GUIDANCE_AUDIT.md` (inventory +
gaps + roadmap). Finding: the app is **already substantially guided** (~50+ point-of-use items; the amber
`.notice.warn` soft-warn style already matches Doc 02); the real missing piece is **input-driven** reactive
guidance + pricing help. Founder felt the roadmap was a lot → chose to start with the smallest non-invasive win.

**Shipped — 2 input-driven nudges on `/dispatch/new`,** same calm amber `.notice.warn` style as the existing
below-recommended-fare warning; **display-only, never gate posting; appear only when their trigger fires:**
- **Luggage vs vehicle** (Trip details, under Luggage): Sedan/"Any" ≥ 4 bags → "consider a Van"; Van ≥ 8 →
  "consider a dedicated luggage vehicle" (the on-ramp to the future luggage-vehicle class / Sujet B). The luggage
  input is now **controlled** (`luggage` state) so it reacts live; still submits via `name="luggage_count"`
  (server reads FormData — `review()`/`createMission` unchanged).
- **Night pickup** (Schedule, under the pretty-time line): Paris-local pickup hour ≥ 22:00 or < 06:00 →
  "late trips can be harder to fill; a higher ceiling or SPEED WIN helps."
- Thresholds are tunable module consts (`LUGGAGE_SEDAN_HINT=4`, `LUGGAGE_VAN_HINT=8`, `NIGHT_START_HOUR=22`,
  `NIGHT_END_HOUR=6`).
- **Dropped before building:** the originally-proposed long-distance nudge — it told the Business to price in the
  "empty return leg", which contradicts the founder's no-empty-return model (below).

**Founder decisions captured (`project/IDEAS.md`):**
- **No empty-return charge** — the Business is never charged for the Driver's *retour à vide*. Instead a **smart
  Pool** prioritises Drivers by **trajectory** (a Driver finishing Cannes→Saint-Tropez is bumped up for missions
  departing Saint-Tropez when timing matches). A V2 matching upgrade; captured, not built.
- **Deferred:** the suggested Ceiling/base-fare range (highest-leverage form win) — waits on the pricing rule
  ("we'll talk about pricing" next). Concept teaching (Ceiling/Pool/SPEED WIN/Lock-in) is the standalone
  **tutorial's** job + a future small in-app glossary tooltip.

**Verified:** `tsc` clean. Drove the live form (localhost, dev-login Business): luggage 6 + body "Any" →
"…a Van will fit them more comfortably"; body Sedan → "…for a Sedan's boot — consider a Van" (live switch on body
change); pickup 09:00 → no night hint; 01:30 → night hint. `.notice.warn` computed style = `rgb(255,251,235)` /
`rgb(217,119,6)` (exact `#fffbeb`/`#d97706` amber), matching the approved D25 preview. No console errors.
(Browser screenshots glitched blank this session — verified via `preview_inspect` + DOM reads instead.)

**Next:** the **pricing** discussion (suggested Ceiling/base-fare range; how one-way vs round-trip + the
no-empty-return principle feed it). Then Tier 2 guidance (the "?" glossary tooltip + status legend) and Sujet B
(the luggage-vehicle class). **Not pushed** — awaiting founder's go to deploy.

---

## 2026-07-03 — Session 30 — Dispatch: business identity → account chip in the top-right topbar
**Branch:** `main`. No migration (CSS + client component only). Files: `components/dispatch-shell.tsx`, `app/globals.css`.

**Why (founder):** on the Dispatch dashboard the business was "en bas à gauche avec settings" — a cramped 30px
avatar + name + a "Sign out" text link tucked under the Settings item at the bottom of the sidebar, reading like a
footnote instead of the account identity. Showed 3 directions in a visualize mockup (D25 loop): A = polished account
card at the bottom with a click menu · B = business identity at the TOP of the sidebar as a workspace header · C =
account chip in the top-right of the topbar. Founder first picked B; on seeing it live, corrected to **C** — keep
"PickUp Dispatch" in the top-left of the sidebar exactly as before, and put the business name **top-right**.

**Shipped (Option C — the standard SaaS top-right account menu):**
- **Account chip in the topbar (top-right)** (`.dx-acctchip` in `.dx-topbar`, now `justify-content: space-between`):
  a 26px logo tile (the `logo_url` image, or a navy monogram of up-to-two initials), the **business name** (13px/600,
  truncates), and a chevron. Uses the previously-empty right side of the topbar.
- **Click opens a dropdown** (`.dx-acctpop`, `role="menu"`): a header showing the business name + "Business account",
  a divider, then **Sign out** (calls the existing `signOut`; "Signing out…" while pending). Dismisses on
  outside-click, on Escape, and on navigation (three `useEffect`s + a `menuRef`; chevron rotates while open).
- **Sidebar reverted to "as before":** the top-left is the original `brand-logo` + "PickUp Dispatch" wordmark again;
  the footer is just the **Settings** nav item. The old bottom `.dx-acct` block (avatar + name + inline Sign out) is
  gone — its identity moved to the chip, its Sign out into the dropdown. Collapse/expand unchanged.
- **CSS:** added `.dx-acctmenu/.dx-acctchip*/.dx-acctpop*`; restored `.dx-brandname` + the sidebar `.brand-logo`
  rules (incl. the collapsed hide); removed the S30-interim `.dx-workspace*` classes and the dead `.dx-acct*`. Base
  `.brand-logo` kept (also used by the Driver `app-header.tsx`); `.dx-link` kept (still used elsewhere). Chip name
  hides < 560px (logo + chevron remain).

**Verified:** `tsc` clean. Drove it live on `localhost:3000` (dev-login as the demo Business, seeded): top-left shows
"PickUp Dispatch" as before; top-right chip = "LG" monogram + "Le Grand Hôtel (demo)" + chevron; the menu opens
(header + Sign out), closes on outside-click; collapse still works (chip stays put, sidebar → icons); no console errors.

**Next:** unchanged queue — mission-form guidance (BACKLOG §L), the saved-addresses address book, Driver app redesign.
**Not yet pushed** — awaiting founder's go to deploy.

---

## 2026-06-28 — Session 29 — Saved address generalized ("Your address", either end) + pickup pre-fill toggle + route swap
**Branch:** `main`. **Migration (founder runs):** `docs/migrations/2026-06-28_business_address_and_prefill.sql` —
renames `default_pickup_*` → `business_address_*` (idempotent DO block, keeps values) + adds `prefill_pickup boolean
default true`. Files: `lib/database.types.ts`, `app/(dispatch)/dispatch/settings/page.tsx` + `actions.ts`,
`app/(dispatch)/dispatch/new/page.tsx` + `mission-form.tsx`, `components/route-stops.tsx`, `app/globals.css`.

**Why (founder feedback on S28):** (1) "Default Guest instructions" is case-by-case → remove. (2) **Not all
Businesses are hotels** — a Business is a fixed point that can be the pickup (departure) OR the drop-off (arrival),
and for a concierge it may be **neither**. So a single "default pickup" was wrong-headed.

**Shipped:**
- **Removed** the Guest-instructions field (the `default_booking_notes` column is left vestigial).
- **Generalized the saved place** to **"Your address"** (`business_address_*`) — neutral, no "hotel" wording (also
  scrubbed the reception helper + the pickup placeholder "From — address, airport, station…").
- **Pre-fill toggle** (`prefill_pickup`, default on): on a NEW mission the pickup starts with the saved address; a
  Business whose address is never an endpoint (concierge) switches it off. A resumed **draft keeps its own pickup**;
  the prefill is always **fully editable/clearable**.
- **Pickup ⇄ drop-off swap button** in the Route card (`route-stops.tsx`): for an arrival (move the address to the
  drop-off) or to fix a reversed entry without retyping. Implemented by tracking each end as `{text, place}` and
  **remounting the two uncontrolled `AddressAutocomplete`s via a `swapNonce` key** (they submit via their own hidden
  inputs, so a key-bump is what flips the displayed + submitted values); text is preserved even when unpicked.
- Wiring: `/dispatch/new` loads `ctx.business` always, computes `pickupPrefill` (address × toggle), passes it to
  `MissionForm`, which uses it only for new missions.

**Verified:** `tsc` clean; static harness on the real `globals.css` (swap button centred on the route card; the
"Your address" + toggle layout; Guest-instructions gone); isolated worktree production build [pending at log-time].
Swap logic reasoned through (closure-swap + key remount; onChange doesn't fire on mount, so no loop). Could not drive
the live form (another session holds :3000) — founder to run the migration then click through on localhost.

**Next:** unchanged — mission-form guidance (BACKLOG §L), the **saved-addresses address book** (this is its first
saved place), Driver app redesign.

---

## 2026-06-28 — Session 28 — Business settings rebuilt (left-nav account area: Company / Contact / Branding / Booking defaults + Billing/Notifications stubs)
**Branch:** `main`. **Migration (founder runs):** `docs/migrations/2026-06-28_business_profile_fields.sql` — 13 additive
nullable columns on `business`. Files: `lib/database.types.ts`, `app/(dispatch)/dispatch/settings/page.tsx` (rewrite),
`app/(dispatch)/dispatch/settings/actions.ts` (rewrite), `components/settings-tabs.tsx` (new), `app/globals.css`.

**Why (founder):** the Business account was "very poor" — only 4 editable fields (business name, field of activity,
contact name, phone). Asked for a solid account modelled on Booking/Airbnb. Ran a research workflow (audit + data-model
map + competitor study + IA synthesis + adversarial critique); founder signed off the IA + an inline mockup (D25), chose
"4 real sections + deferred stubs" and "include a geocoded default pickup".

**Shipped — a left-nav settings shell (`SettingsTabs` client component) with 7 sections; each real section is its own
server-action form so they save independently (the action echoes `?s=<key>` so the saved section re-opens):**
- **Company** (the credibility jump): business name, **business type** (select, replaces free-text field_of_activity),
  legal entity name, **SIRET**, **VAT (TVA)**, registered address + the existing Kbis `DocumentSection`. → `updateCompany`.
- **Contact**: Dispatcher name + mobile (revealed to Driver) + **reception/switchboard**; **account email now shown**
  (read-only, "contact support to change"). → `updateContact`.
- **Branding**: relocated `AvatarEditor` (logo). No new code.
- **Booking defaults**: **geocoded default pickup** (reuses `AddressAutocomplete` — pre-fills the new-mission form),
  default vehicle class, default Guest instructions. → `updateBookingDefaults`.
- **Billing** (deferred stub): saveable **billing email** now; payment-method + invoices are clearly-flagged "coming
  soon". Agent-positioned copy — fare *collected on the Driver's behalf*, PickUp service fee + 20% VAT on the fee a
  separate line, never PickUp-as-seller; **no derived VAT / invoice preview**. → `updateBillingEmail`.
- **Notifications** (deferred stub): single "coming soon" card — NO inert toggles (per the critique).
- **Help & legal**: existing `HelpLegalCard` + an account/data line + history link.
- **Migration columns:** business_type, legal_name, siret, vat_number, registered_address, reception_phone,
  default_pickup_address/_lat/_lng/_label, default_vehicle_category, default_booking_notes, billing_email (all nullable,
  IF NOT EXISTS). `getAppContext` already `select("*")`s business, so they flow through; `?? ""`/`null` degrade safely
  pre-migration (page RENDERS; only the new-field SAVES need the column).

**Deliberately CUT (per Doc 02, even though competitors show them):** team/multi-seat, roles, financial dashboard,
multi-property, PO/cost-centre field, legal-form field (trimmed by the critic).

**Verified:** `tsc` clean; static harness on the **real** `globals.css` confirms the layout (left nav, Company section
2-col field grids, Documents card, "soon" tags) wide + responsive (nav → scrollable row < 720px); production build in an
isolated worktree [pending result at log-time]. Could not drive the live form (another session holds :3000) — founder to
run the migration then click through on localhost.

**Next:** unchanged — mission-form guidance (BACKLOG §L), saved base addresses (this lays groundwork via default pickup),
Driver app redesign.

---

## 2026-06-28 — Session 27 — New-mission validation: honest message, located-pickup bug, drop-off required to post
**Branch:** `main`. No migration. Files: `app/(dispatch)/dispatch/new/mission-form.tsx`,
`app/(dispatch)/dispatch/new/actions.ts`.

**Why (founder bug report):** leaving drop-off + ceiling empty and clicking "Review mission" showed a **fixed
catch-all** message ("Please choose a vehicle category, a pickup picked from the suggestions, a pickup time, and a
ceiling") that listed fields the founder HAD filled (category), and the mission then **posted with no drop-off**.
Three real problems.

**Fixed:**
1. **Honest, dynamic message.** `review()` now names ONLY the missing fields, e.g. "Before posting, add a drop-off
   address and a ceiling price." (`joinAnd()` helper for the "a, b, and c" list). Wording is plain — "a pickup
   **chosen from the address suggestions**" instead of jargon.
2. **Latent located-pickup bug.** `review()` read coords with `Number()` — `Number("")` is `0`, which is "finite",
   so an un-geocoded pickup slipped past the Review gate (only the server caught it). Switched to `toNum` + the
   shared `isValidLatLng`, so an address that wasn't picked from suggestions is correctly flagged client-side.
3. **Drop-off required to POST (founder decision).** A live mission now needs a **located** drop-off (picked from
   suggestions, like pickup) — enforced in `review()` AND server-side in `createMission` (`!asDraft && (!dropoffAddress
   || !dropoffValid)` → `redirect(backTo("nodrop"))`, new `error="nodrop"` notice). **Drafts stay lenient** — you can
   still park an incomplete one from the edit view. The server `error="missing"` fallback copy was clarified too.

**Verified:** `tsc` clean; the exact missing-field + `joinAnd` logic unit-tested in node across six scenarios
(founder's case, typed-but-unpicked pickup, only-ceiling, all-present→preview, empty form, the coord-0 edge) — all
correct. Couldn't drive the live form (another session holds :3000) but the change is hot-reloaded on the founder's
`localhost:3000` to confirm. No new CSS (reuses `.notice.error`).

**Next:** unchanged queue — mission-form guidance (BACKLOG §L), saved base addresses, Driver app redesign.

---

## 2026-06-28 — Session 26 — Per-stop trip progress (Driver "Reached" tap + Business rail check-off)
**Branch:** `main`. **Migration (founder runs):** `docs/migrations/2026-06-28_mission_stops_reached.sql` —
`alter table mission add column if not exists stops_reached int not null default 0;`. Files: `lib/database.types.ts`,
`lib/mission-flow.ts`, `app/(app)/rides/actions.ts`, `app/(app)/rides/status-control.tsx`,
`app/(app)/rides/page.tsx`, `components/status-steps.tsx`, `components/trip-row.tsx`, `app/globals.css`.

**Why:** founder asked how a multi-stop trip should update visually — the Driver had no "stop" button (only en
route/arrived/on board/completed) and the Business had no way to see stop progress. Investigation confirmed a real
gap: stops live in `mission.waypoints` but had **no per-stop state**, the status machine jumped `on_board →
completed`, and the **Driver never even saw the stops mid-trip** (`rides/page.tsx` rendered pickup→drop-off only).
Two visualize mockups signed off (D25); founder chose **one "Reached" tap per stop**.

**Model (status enum UNTOUCHED — hard rule):** a single additive counter `mission.stops_reached`. A trip with N
stops runs en_route → arrived → on_board → [reach stop 1 … reach stop N] → completed; while passing stops the
status stays `on_board` and the counter climbs.

**Shipped:**
- **Flow helpers (`lib/mission-flow.ts`):** `nextDriverAction(status, stopsCount, stopsReached)` returns the one
  next thing to tap — a status step OR `{kind:"stop", stopIndex}`; `progressSegments()` / `progressDone()` build a
  stops-aware bar (one segment per stop, "Drop-off" as the final label when stops exist).
- **Driver (`status-control.tsx` + `actions.ts`):** between "Guest on board" and "Complete ride" the primary button
  becomes **"Reached — ⟨stop⟩"** (first address segment), one tap each, via a new **`reachStop(missionId, stopIndex)`**
  server action (same RLS-verify-then-service-role trust model as `advanceStatus`; only the next stop in order, only
  while `on_board`). `advanceStatus → completed` now **guards** that all stops are reached first. The Driver card now
  **renders the full route** (pickup → stops → drop-off) with reached/next states + tags + a stops-aware bar.
- **Business (`trip-row.tsx`):** the dense summary **route rail checks off live** — reached stops go green
  (`.dx-route__node--reached`), the next one gets an accent halo (`--current`); the status pill gains a quiet
  counter **"On board · k/N"** (`.status-pill__sub`). The expanded detail rail mirrors it with "reached" / "next
  stop" tags. The summary stays text-tag-free to protect the S25 width work — the pill carries the textual signal.
- **Graceful pre-migration:** `stops_reached ?? 0` everywhere, and `select("*")` simply omits the column until the
  ALTER runs (no check-offs, no counter) — but the `reachStop` write needs the column, so **run the migration before
  any live multi-stop on-board trip**.

**Verified:** `tsc` clean. Static harness on the **real** `globals.css` + actual class markup, three states — heading
to stop 2 (stop 1 green "reached", stop 2 accent "next stop", bar 4/6, button "Reached — Galeries Lafayette",
Business pill "On board · 1/2"); all stops reached (both green, bar 5/6, green "Complete ride"); both rails + pill
correct. History shares `TripRow`, so covered.

**Next:** founder to **run the migration**, then push + verify live (held the push for that). Then back to the
features queue — mission-form guidance (BACKLOG §L), saved base addresses, Driver app redesign.

---

## 2026-06-28 — Session 25 — Schedule rows shrink as one (responsive grid + minimum + side-scroll)
**Branch:** `main`. No migration. CSS-only — file: `app/globals.css` (shared schedule **and** history grid).

**Why:** founder narrowed the Schedule window and the addresses **vanished** while the `Route` / `Flight` column
headers visually **collided**. Root cause: the dense 7-col grid had **4 rigid pixel tracks** (time `56px`, flight
`104px`, ref `120px`, status `150px`); when width ran out the only flexible track — route `minmax(0,1.9fr)` —
absorbed all the loss and collapsed to `0` (addresses clipped to nothing), and the un-clipped header cells spilled
into each other. Founder's words: *"I'd like the whole trip card to equally shrink horizontally"* + *"fix a minimum
limit to keep it clean and avoid colliding rows."* (Two visualize mockups signed off before coding — D25 loop.)

**Shipped (`app/globals.css`):**
- **Every column is now flexible** — `grid-template-columns` is seven `minmax(<floor>, <fr>)` tracks (time `.5fr`,
  **route `4fr`** so it stays widest at rest, flight `.95`, guest `1.15`, ref `.75`, driver `1.15`, status `1.1fr`).
  The whole row scales down together as the window narrows; addresses/guest/driver truncate with `…` instead of one
  column collapsing. Gap `16px` → `12px`.
- **Anti-collision belt-and-braces:** `.dx-colhead > span` now clips (`nowrap`+`ellipsis`) so the header labels can
  never overlap at any width; the **flight badge** (`.dx-flight`) and the **ref pill** (`.dx-trip__ref .ref`) now
  truncate on one line instead of hard-clipping / wrapping to two lines.
- **Minimum limit + side-scroll** (`@media (max-width: 880px)`): below the summed floors the table holds a
  `min-width: 572px` and the `.dx-sched` becomes its own horizontal scroller (`overflow-x:auto; overflow-y:hidden`),
  so rows keep their shape and nothing collides — you side-scroll to reach Status. In that regime the column header
  drops its `top:57` sticky offset (`position:static`) so it rides with the scroll instead of leaving a gap.
  Breakpoint clears the squeeze even with the sidebar expanded (236px, user-toggled, doesn't auto-collapse).
- **Status floor `116px`** fits the longest pill ("Not confirmed" incl. the `!`) so the at-a-glance signal never
  truncates.

**Verified** (static harness linking the **real** `globals.css` + the actual schedule DOM, Node server on :4612,
since another session held the Next dev server on :3000): **1440px** full addresses + route-dominant, no bloat;
**1040px** uniform shrink, single-line truncation everywhere (ref no longer wraps); **800px** holds 572px min and
side-scrolls — scrolled right, Status fully reachable, header+rows aligned, zero overlap. History shares the grid,
so fixed there too. Calendar untouched (own `.dx-peektrip`/fixed drawer — deliberately not made a CSS container).

**Tradeoff flagged:** in the <880px scroll regime the column header isn't viewport-pinned (rides the scroll). If the
founder wants it always pinned at narrow widths, the upgrade is an internal-scroll table pane — offered, not built.

**Next:** unchanged — mission-form guidance (BACKLOG §L), saved base addresses, Driver app redesign. **Not yet
pushed** — awaiting founder's go to deploy.

---

## 2026-06-27 — Session 24 — Schedule route → stacked rail (pickup → stops → drop-off)
**Branch:** `main`. No migration. Files: `lib/format.ts`, `components/trip-row.tsx`, `app/globals.css`,
`app/(dispatch)/dispatch/page.tsx` + `history/page.tsx`.

**Why:** founder reworked the route line through many D25 mockups (all Geist-loaded so the font matched). Rejected:
S22 POI labels, S23 pickup-only, an edge **fade-out** mask, and a side-by-side 2-line layout. **Chosen:** a vertical
**route rail** — pickup over stop(s) over drop-off — so each address gets the full column width on its own line
(long addresses fit; no truncation games), with the drop-off in a light-grey "shade".

**Shipped:**
- **`addressLine()` (`lib/format.ts`)** — the full address **minus the trailing country** ("…, Nice, France" → "…,
  Nice"); keeps house number / street / postcode / city. (Distinct from `shortPlaceLabel`, now unused but kept.)
- **Stacked rail in `trip-row.tsx`**: `.dx-trip__route` is now `flex-column`; each leg is a `.dx-route__node` = a dot
  + the `addressLine`. **Dots:** `--pk` solid `var(--text)`, `--via` solid `#cbd2dd`, `--dp` hollow ring `#98a2b3`;
  a `::before` connector links each node to the one above. **Text tones:** pickup `var(--text)`/500, via `#8a94a6`,
  drop-off `#98a2b3`. Stops come from `parseWaypoints(mission.waypoints)` (already parsed) — each waypoint is a via
  node. Empty drop-off → "—". Exact address on `title` hover + in the detail.
- Column header `Pickup` → **`Route`** (schedule + history); route grid track widened to `minmax(0,1.9fr)` for the
  full addresses.

**Verified vs the REAL DB:** Schedule + History render the rail; a genuine existing 1-stop trip (M. Dupont, "Hôtel
Martinez, Cannes") shows **pk → via → dp** with the right dot types and the country stripped; missing drop-off shows
"—"; `tsc` clean; no console errors. (A DB write to fabricate stops for testing was correctly auto-blocked — used the
real stop trip instead.)

**Next:** unchanged — mission-form guidance (BACKLOG §L), saved base addresses, Driver app redesign. **Deployed**
(supersedes the S23 pickup-only line on the live site). Optional follow-up offered: rip out the now-unused POI-name
capture from the form.

---

## 2026-06-27 — Session 23 — Schedule line → pickup only (POI names rolled back)
**Branch:** `main`. No migration. Files: `components/trip-row.tsx`, `app/(dispatch)/dispatch/page.tsx` +
`history/page.tsx`, `app/globals.css`.

**Why:** founder found the S22 **phase-2 POI labels "weird"** — Mapbox's POI names are unreliable (vacation-rental
listings, "CITY-LOCKER — Gare de Cannes", marketing suffixes "a Regent Hotel"). Offered three clean (non-POI)
alternatives via a Geist-loaded mockup; founder picked **"Pickup only"** (AskUserQuestion).

**Shipped:** the schedule line now shows **only the pickup**, as the clean string-derived `shortPlaceLabel(pickup_address)`
(street + town) — no destination, no arrow, no POI name. Column header `Route` → **`Pickup`** (schedule + history). The
destination + exact address remain in the expanded detail + the `title` hover. Grid rebalanced to spread the freed width
(`56px minmax(0,1.5fr) 104px minmax(150px,1.1fr) 120px minmax(140px,0.9fr) 150px`) so pickup-only doesn't reopen the old
dead-space gap. **`pickup_label`/`dropoff_label` capture is left in place** (harmless, additive; the columns stay) but is
no longer read in the line — can be ripped out later if the founder wants.

**Verified vs the REAL DB:** header reads `Time · Pickup · Flight · Guest · Ref · Driver · Status`; rows show clean
pickups ("Bd de la Croisette Cs 40052, Cannes", "Chemin De Rabiac-Estagnol, Antibes"); `tsc` clean; no console errors.

**Next:** unchanged — mission-form guidance (BACKLOG §L), saved base addresses, Driver app redesign.

---

## 2026-06-27 — Session 22 — Schedule redesign: a framed, sticky, zebra-striped table that scans at a glance
**Branch:** `main`. **No migration, no APIs.** Files: `app/globals.css`, `app/(dispatch)/dispatch/page.tsx`,
`app/(dispatch)/dispatch/history/page.tsx`.

**Why:** founder ask — the schedule "bars" needed to *separate things properly, align, and stay readable at 30 trips*.
The old layout flung 6 columns across 1520px with **oceans of dead gap** (yet the route still truncated), weak 6px
row gaps, and the status pill marooned at the far right from a faint 4px edge. Designed via the D25 loop (visualize
mockup → founder approved **zebra + full-width** via a one-tap AskUserQuestion).

**Scope shipped (all KEEP):**
- **Grid rebalanced** on the shared `.dx-colhead` + `.dx-trip > summary`: `56px minmax(0,1fr) 104px 200px 156px 150px`,
  gap 16 — the **ROUTE track takes the slack** so addresses show in full instead of gaps; **Status right-aligned**
  (`justify-self:end` + colhead last-span `text-align:right`).
- **New `.dx-sched` framed table card** (border + `radius-lg` + `overflow:clip`) wraps each list. `overflow:clip`
  (NOT `hidden`) is deliberate — it clips to the radius **without** becoming a scroll container, so the sticky header
  still works.
- **`.dx-colhead` is now `position:sticky; top:57px`** (clears the 57px sticky topbar) — column labels stay pinned
  through a long scroll. Verified pinned at exactly 57px.
- **Flush table rows:** removed per-row border/radius/margin; kept the **4px colored status rail** (`--edge` = tone
  colour); 1px hairline between rows; **zebra** (`.dx-trip:nth-of-type(even) > summary` tint `#fafbfc`, resets per day
  group); `[open]`→navy-soft; alert rows keep the red wash; hover `#f0f3f8`.
- **`.dx-day` is now a full-width tinted band** (`--tone-neutral-bg`) with the date (navy) + trip count — a strong
  day/month separator.
- **Same treatment on History** (each month `<section>` got `className="dx-sched"`; the schedule's "Earlier trips"
  table also got a `ColumnHead`). The **Calendar is untouched** (shares `.status-pill` only — left as-is).
- **Glance labels (phase 1) + Reference its own column** (founder-approved follow-on, same session, via the Geist-in-mockup
  D25 loop):
  - **`shortPlaceLabel()` in `lib/format.ts`** — renders a short, scannable route label in the line instead of the full
    postal address: drops the country + postcode, keeps the place name (minus a leading house number) + town. e.g.
    `1055 Chemin De Rabiac-Estagnol, 06600 Antibes, France` → **Chemin De Rabiac-Estagnol, Antibes**;
    `6 Av. Jean Médecin, 06000 Nice, France` → **Av. Jean Médecin, Nice**. The **exact address is preserved** in the
    expanded detail + Driver nav, and on a `title=` hover over the line. (Phase 2, deferred: an additive migration to
    capture Mapbox's structured POI fields → the prettier `Nice Airport · T1` form.)
  - **Reference split into its own column.** `.dx-trip__meta` (guest + ref chip) → two cells `.dx-trip__guest` +
    `.dx-trip__ref`; the shared grid is now **7-col** `56px minmax(0,1fr) 104px 176px 116px 150px 150px`; both
    `ColumnHead`s changed `Guest / ref` → `Guest` + `Ref`; the `.ref` chip's inline `margin-left` is reset in the new
    column. Empty ref shows a faint "—".

**Verification:** `tsc` clean, no console errors. **Browser-verified vs the REAL Supabase DB at 1600px:** Schedule
(23 rows / 9 days) + History (20 rows) both render framed / striped / aligned; the dense **10-trip "jeudi 25 juin"**
day shows zebra clearly; status pills + left rails **colour-match by tone** (grey Completed/Pooled, steel
Confirmed/Accepted, amber Unfilled, red Not confirmed); the sticky colhead **pins at 57px** on a long scroll.

**Phase 2 — structured POI glance labels (BUILT, migration-gated, NOT yet deployed):** capture a clean place label at
address-pick-time from Mapbox Search Box's structured `retrieve` data (the POI name for hotels/airports/venues, else
street + town), store it on the mission, and prefer it in the schedule line over the string-derived phase-1 label.
- **Migration (founder runs):** `docs/migrations/2026-06-27_mission_place_labels.sql` — `add column pickup_label`,
  `dropoff_label text` (additive, nullable). Mirrored in `lib/database.types.ts`.
- **`address-autocomplete.tsx`:** new `placeLabelName` hidden-input prop + `glanceLabelFromProps()` (POI name / street,
  minus house number, + `context.place`/`locality` town, skipping a town already in the name). Captured on pick; cleared
  when the text is edited (so a resumed draft that isn't re-picked submits "" and the server keeps the stored label).
- **`route-stops.tsx`:** pickup/dropoff fields pass `placeLabelName="pickup_label"` / `"dropoff_label"`.
- **`actions.ts`:** reads both, **conditional-spread** (`...labels`) into insert + update so an empty submit never wipes a
  stored label.
- **`trip-row.tsx`:** renders `mission.pickup_label || shortPlaceLabel(pickup_address)` (graceful fallback for old rows).
- **Migration applied by the founder; verified end-to-end vs the REAL Supabase DB + deployed.** Posted a real mission
  through the form (real picks): pickup → **"Carlton Cannes, a Regent Hotel"**, dropoff → **"Nice-Côte d'Azur Airport"**
  — both written to the new columns and rendered in the schedule line; older rows fall back to the phase-1 label. The
  verification mission was then deleted. `tsc` clean, no console errors.

**Next:** unchanged — mission-form guidance (BACKLOG §L), saved base addresses, Driver app redesign. The S21 popup +
S22 schedule redesign / phase-1 labels / Ref column / phase-2 POI labels are all **deployed**.

---

## 2026-06-27 — Session 21 — "This is final" moved off the review rail into a Post-to-Pool confirm popup
**Branch:** `main`. **No migration, no third-party APIs** — pure client UI on the new-mission form.

**Why:** founder ask — the "This is final. Posting sends the mission live… can't be un-posted…" notice sat permanently
in the **review Summary rail** (`mode === "preview"`), where it read as alarming *before* any post intent ("confusing
to have that message for no reason"). The founder also asked whether the app could use a **popup** (it never had one
for a confirmation — only inline confirms like discard-draft). Answer: yes, and the existing `.modal-overlay`/
`.modal-card` infra (avatar cropper) was reused. Designed via the D25 preview loop (visualize mockup → founder
approved → "improve text size and go").

**Scope shipped (KEEP, no schema change):** all in `app/(dispatch)/dispatch/new/mission-form.tsx`.
- **Removed** the always-on `mode === "preview"` "This is final" `.notice.warn` from the Summary rail. The rail now
  goes straight from the fare block → the action buttons.
- The rail's **"Post to the Pool" is now `type="button"`** — it opens the confirm popup instead of submitting. The
  **real pooled submit moved into the modal**, so posting always takes a deliberate second click. (This also *reduces*
  the S18 node-reuse risk — the preview primary is no longer a submit at all.)
- **New confirm modal** (`confirmPost` state) reusing `.modal-overlay`/`.modal-card`: amber warning chip + **"This is
  final"** title (19px) + a **tightened message** (15px, `--text-muted`: "Posting sends this live to the Driver Pool
  right away — it can't be un-posted." — the original's redundant "Use Edit or Save as draft…" tail was dropped since
  Cancel covers it; `text-wrap: balance` evens the two lines so no word is orphaned) + **Cancel** / **Post to the
  Pool**. Lives **inside the `<form>`** so its `SubmitButton
  intent="pooled"` shares the same FormData + pending double-submit guard.
- **Three exits, all cancel:** `Cancel` button, **Escape** (a `useEffect` keydown listener, only while open), and a
  **backdrop click** (`e.target === e.currentTarget`). Clicking the card body does **not** close.
- **`ConfirmCancelButton`** reads `useFormStatus().pending` and disables once Post is in flight — so a Cancel click
  can't close the modal while an already-submitted post completes in the background.

**Verification:** `tsc` clean. **Browser-verified vs the REAL Supabase DB** (dev-login as demo Business, reached the
review step): rail no longer shows the warning (the three action buttons only); clicking Post opens the popup matching
the approved mockup (title 19px / body 15px, navy primary + amber chip); **Esc, backdrop, and Cancel all close it,
inside-card click keeps it open, and no navigation/post fired**; the modal's Post is a genuine form submit
(`form`-associated, `submitter` carries `intent=pooled`, verified via an intercepted `submit` event so no junk mission
was created); no console errors.

**Next:** unchanged from S20 — mission-form guidance (BACKLOG § L), saved base addresses, Driver app redesign.

---

## 2026-06-27 — Session 20 — Reference field: a dedicated, char-capped booking tag (Business-only, hidden from the Driver)
**Branch:** `main` — committed + pushed (deploy verified). **Migration applied by the founder.** · **Env:** local → Vercel (live).

**Why:** founder ask (BACKLOG § M item 3 / NEXT_SESSION item 2) — the remaining half of the S19 Reference split.
The message-to-Driver half shipped in the S19 Driver card; this finishes the job by turning the old "Reference /
notes" field (which double-served as reference + instructions) into a short, char-limited **Reference**. Designed via
the D25 preview loop (6 mockup iterations; the founder rejected a wider Trip-details card redesign — "be close to the
original, just improve" — so scope was pulled back to ONLY this field).

**Scope shipped (all KEEP, no third-party APIs):**
- **New `ReferenceField`** (`components/reference-field.tsx`, client) replacing the free-text `comment` textarea in the
  Trip-details card. Narrow (240px) single-line input, bookmark icon, **20-char cap**, a live `X / 20` counter that
  turns amber (the `--warning` token) within 3 of the limit, a one-line purpose hint, and a small **"Not shown to the
  Driver"** note. Controlled input; `.rf-*` classes added to `globals.css` from the real navy tokens.
- **Dedicated `reference` column** (was reusing `comment`). The Business sees it on the **schedule chip + detail**
  (`trip-row.tsx`) and the **Review preview** (`mission-form.tsx`); the **Driver never sees it** — the old "Comment"
  block was removed from the Driver mission detail (`app/(app)/missions/[id]/page.tsx`).
- **20-char cap enforced server-side** in `actions.ts` (`.slice(0, 20)`) — the input `maxLength` is a convenience; the
  server slice is the real guard. Preview builder in `mission-form.tsx` slices too.
- **Seed** (`app/api/seed/route.ts`): the two instruction-flavoured `comment`s moved to `driver_message` (S19) + a short
  `reference` added ("Chambre 412", "Suite 5").
- **DB (additive, founder ran):** `docs/migrations/2026-06-27_mission_reference.sql` — `add column reference text` +
  backfills from the legacy `comment` **truncated to 20** (`left(nullif(btrim(comment),''),20)`). The legacy `comment`
  column is **left in place** (dropping is non-additive, hard-rule #4) — the app no longer reads/writes it. Mirrored into
  `lib/database.types.ts` (D3); `comment` kept in the types since the column still exists.

**Verification:** `tsc` clean (no ESLint configured in repo — the prior "lint clean" was `tsc`). **Adversarial review**
(workflow, 3 parallel skeptics + synthesis: data-flow/round-trip, Driver-hidden guarantee, schema/pre-migration/stray-
surfaces) — change **sound**, reference shown to Business + hidden from Driver, types match. One **low** acted on: the
migration backfill now truncates to 20 (was unbounded). **Browser-verified vs the REAL Supabase DB:** field matches the
approved mockup (240px, icon, counter, note, no console errors); live counter + amber threshold work; **seed wrote
`reference` through PostgREST**; the schedule renders `.ref` chips incl. **backfilled+truncated legacy values** ("Add
fresh aqua Pana", "Passager VIP — eau à" — proof the migration backfill + `LEFT(...,20)` ran on real data); **draft
write+read round-trip via `createMission`** ("Room 999 RT-check" saved → resumed → populated) then the test draft
restored to empty. No live pooled mission posted (avoided Pool pollution; display surfaces are guarded `select('*')`
reads + reviewed).

**Follow-up (same session, founder ask):** **Luggage + Flight number now share one line** in the Trip-details card —
equal halves via the existing Pricing-row idiom (`display:flex; gap:12` + two `label.field` at `flex:1, minWidth:140`),
wrapping to stacked under ~290px (mobile). Mockup-approved (balanced halves) then built; browser-verified at 1440px
(both 321px, same line, gap 12) and confirmed wrap on a narrow viewport. No schema/logic change.

**Follow-up 2 (same session, founder ask — the big one): Passenger phones + a Share-with-Driver gate.**
The Passengers section was reworked (D25: ~6 mockup iterations): **"+ Add passenger"** moved to a light outline button
in the header; each Guest gains an optional **phone** and a selectable, highlighted **main contact** (star, exactly-one
invariant); a per-phone **Share with Driver** toggle (switch, off by default) in BOTH the form and the schedule trip
detail. A number reaches the Driver ONLY when shared, and only post-accept.
- **Privacy gate — AIRTIGHT (founder chose this over the no-migration option):** phone NUMBERS never touch the mission
  row (Pool Drivers can read pooled rows via `p_mission_driver_read`). `mission.passenger_names` keeps only
  `{first,last,main}` (`passengerRowData` strips phone/shared); the numbers + per-phone `shared` flag live in a NEW side
  table **`mission_guest_contact`** (`{mission_id, contacts jsonb}`, aligned by index) whose RLS
  (`p_guestcontact_business_all`) gives Drivers NO policy = deny-by-default. The assigned Driver sees a SHARED number via
  the **service role** in `/rides`, double-gated (assigned + `shared`) — mirrors the Dispatcher-contact unlock.
- **DB (additive, founder ran):** `docs/migrations/2026-06-27_mission_guest_contact.sql`. Types mirrored (D3).
- **New files:** `lib/passengers.ts` (Passenger gains phone/main/phoneShared; `GuestContact`; `passengerRowData` /
  `guestContacts` / `mergeContacts` / `zipGuestContacts` / `mainIndex`; `primaryPassengerName` is now main-based),
  `components/share-switch.tsx` (presentational toggle), `components/phone-share-toggle.tsx` (schedule toggle →
  `shareGuestPhone`, optimistic + revert), `app/(dispatch)/dispatch/passenger-actions.ts` (`shareGuestPhone`,
  user-session/RLS-scoped). **Rewrote** `components/passenger-list.tsx`. **Wired:** `createMission` splits storage
  (names→mission, phones→side table, index-aligned; logs side-table write failures rather than swallowing them);
  `new/page.tsx` loads draft contacts; `mission-form` merges them; `trip-row` + `dispatch/page.tsx` render the phone +
  toggle (locked on finished trips); `rides` reveals shared phones.
- **Verification:** `tsc` clean. **Adversarial review** (workflow, 3 skeptics + synth, privacy-focused) — gate **SOUND /
  airtight, NO leak** of an unshared or non-owned phone. 2 mediums fixed (silent side-table write → now logged; toggle
  read-only on finished trips). **Browser-verified vs the REAL DB:** all form interactions work; save-as-draft with a
  SHARED + an UNSHARED phone → **draft round-trip re-aligned both phones + states from the side table** (Céline shared /
  Jean not); main flag persisted; the test draft was restored. The phone re-fills from the side-table `draftContacts`
  (not `passenger_names`), confirming the split at runtime. (A direct service-role prod dump of the split was BLOCKED by
  the safety classifier — correctly, as a prod PII read; proven instead by the code review + the round-trip. The schedule
  toggle + Driver reveal are code/review-verified — not posted live, to avoid Pool pollution.)
- **Flagged (accepted, no dirty routes):** `shareGuestPhone` bounds the index against the phone list, not the name list
  (harmless — both written atomically); orphan side-table rows are deleted on re-save when phones are removed.

**Follow-up 3 (same session, founder bug report): address autocomplete POIs.** The Mapbox Search Box `/suggest` was
returning a non-routable `feature_type:"brand"` entry as the top hit ("Fnac — Brand") and `limit=6` cut real branches.
Fix (`components/address-autocomplete.tsx`): fetch `limit=10`, **drop `brand`/`category` suggestions**, show up to 8.
Diagnosed against the live Mapbox API (curl); "FNAC" now leads with **"Fnac — La Riviera, 06000 Nice"** (browser-verified
in the live form, no console errors). Flagged as Mapbox **data-coverage gaps** (no code fix): the **Eden-Roc restaurant**
(part of Hôtel du Cap-Eden-Roc) and the **Galeries Lafayette Nice store** (Mapbox indexes only the brand counters inside
it) aren't standalone POIs — a stronger POI source (Google Places) would be the real fix, deferred as a paid integration.

**Follow-up 4 (same session, founder polish): route-rail connector gap.** The stacked route-rail connector
(`.dx-route__node + .dx-route__node::before`) now leaves a ~2px gap at each end (`top:-6px; height:8px`, was
`-8px/13px`) so it stops just short of both dots — a cleaner finish. Approved via an enlarged before/after mockup;
geometry browser-verified (connector bottom y=2 vs the dot's top edge y=4 → 2px gap).

**Deferred / flagged (no dirty routes):** V2 **per-business custom reference label** (Hotel→Room, Restaurant→Table,
BACKLOG § M) — not built; the legacy `comment` column is now vestigial (a future non-additive cleanup could drop it).

## 2026-06-25 — Session 19 — New "Driver & service" card on the mission form (language / dress code / requests / board / message)
**Branch:** `main` — **committed `0887247` + DEPLOYED** (Vercel build `success`; deployment SHA verified == pushed SHA,
no dropped-deploy this time). **Migration applied by the founder.** · **Env:** local → Vercel (live).

**Why:** founder ask (dump 2026-06-25, BACKLOG § M item 2) — a dedicated Driver section on `/dispatch/new`. Designed
via the D25 preview loop first (6 mockup iterations, founder-approved), then built to match.

**Scope shipped (all KEEP, no third-party APIs beyond Supabase Storage which was already in-stack):**
- **New card `Driver & service`** between Trip details and Pricing. `components/driver-service-fields.tsx` (client).
  - **Languages** — fixed curated set (Français/English/Italiano/Español/Deutsch/العربية) multi-select chips. Display
    + preference only; **NOT a hard Pool filter** (would shrink the Pool — deliberate, flagged). Matched against the
    Driver's existing `driver.languages`. No proficiency "level" (Drivers don't store one — founder dropped it).
  - **Dress code** — 4-rung scale (`driver_choice`→`smart_casual`→`business_formal`→`suit_tie`). **Anti-suit default:**
    keyed to the service tier (eco→Driver's choice, business→Smart casual, First→Business formal) and **never** lands
    on Suit & tie. The default **tracks the tier** until the Dispatcher manually picks one (a `touchedRef`); a manual
    pick then sticks for that mission. (Cross-mission *learned* default after N repeats = deferred, see below.) Suit &
    tie carries a neutral "Specific event or VIP protocol" note w/ a Sparkles icon.
  - **Requests** — jsonb flags: meet_greet, **greeter (wait at the car)**, luggage_help, child_seat, quiet_ride, pets.
    (Dropped "card only" — PickUp handles payment; dropped PRM — it's a vehicle category, parked to IDEAS for the Bus
    expansion.) Meet & greet reveals a **name board**: `board_name` text **or** an attached PDF/JPG/PNG.
  - **Message to the Driver** — private free-text, revealed only post-accept.
- **DB (additive, founder runs):** `docs/migrations/2026-06-25_mission_driver_section.sql` adds `required_languages
  text[]`, `dress_code text`, `driver_flags jsonb`, `board_name text`, `board_file_path text`, `driver_message text`.
  Hand-mirrored into `lib/database.types.ts` (D3).
- **Board file** → reuses the existing private `documents` Storage bucket (`lib/supabase/storage.ts`). Uploaded inside
  `createMission` with a **random storage path** (no insert-return-id needed) and a **conditional-spread** write
  (mirrors the `eta` pattern) so re-saving a draft never wipes an existing board. Failed upload is non-fatal. A
  dismiss/meet-greet-off writes `board_file_path: null` via `board_file_clear`. On-demand signed URL via
  `lib/mission-board-actions.ts` (`getMissionBoardUrl`, authz: Dispatcher-of-business OR assigned Driver) +
  `components/board-file-link.tsx` (so lists never eagerly mint URLs).
- **Wiring:** `actions.ts` reads+writes all 6 fields (both draft/pooled, insert/update). `mission-form.tsx` lifts the
  service tier (new `onTierChange` on `ServiceClassFields`), renders the card, and adds the fields to the Review
  preview. Trip-details Reference placeholder trimmed ("or instructions" removed — instructions now have their own box).
- **Display (select('*') flows columns through automatically):** Dispatch `trip-row.tsx` shows everything (owner).
  Driver `missions/[id]` shows **languages/dress/requests pre-accept** (self-select); `rides` reveals **board + private
  message post-accept** (gated by `MINE_STATUSES`). Pool `mission-card.tsx` shows compact requirement tags.
- **CSS:** new `.ds-*` + `.mc-tag` classes in `globals.css`, built from the real navy tokens / tier-tile + chip idiom.

**Verification:** `tsc` + ESLint clean. **Adversarial review** (4 parallel skeptics: server-action data-flow, board-URL
security, client-form correctness, display/reveal-gating) — auth **sound** (no IDOR / cross-business / pooled-leak,
fail-closed), schema/types/writes an exact 3-way match, parsers throw-proof, degrades cleanly pre-migration. One MEDIUM
found + **fixed**: the "dismiss existing board" X was cosmetic → now actually clears via `board_file_clear`. **Browser-
verified (client-side, pre-migration):** card matches the approved mockup, no console errors; tier→dress default tracks
(Business→Smart casual, First→Business formal, Eco→Driver's choice); a manual Suit & tie pick **sticks** through a tier
change; meet & greet reveals the board+file; chips serialize to the right hidden fields.

**DONE (post-migration):** founder ran the additive migration ("Success, no rows returned"). **Full end-to-end verified
against the REAL Supabase DB** by driving the live form: picked a Mapbox pickup, set date/time/ceiling + the Driver-card
fields (Français+English, Smart casual, meet&greet+quiet ride, board name, message), **saved as draft → insert
succeeded** (redirect to /drafts, badge 1→2), then **resumed the draft → every new column round-tripped** (text[] +
jsonb through PostgREST confirmed). Test draft discarded after. Then **pushed `0887247` → Vercel deploy `success`**.
(Did NOT post a live pooled mission to avoid Pool pollution — the display surfaces are guarded `select('*')` reads +
adversarially reviewed; offer the founder a quick live demo post if they want to eyeball the schedule/Driver views.)

**Follow-up (same day, deployed `5eb2a40`):** the meet & greet **name board now auto-fills with the first Guest**
(name + surname) and tracks it live until the Dispatcher types a custom company/brand name (then it sticks). Lifted
the primary Guest out of `PassengerList` via a new `onPrimaryNameChange` → `MissionForm` → `DriverServiceFields`
(same pattern as the body/tier lifts); the board input became controlled with a `touchedRef`. Browser-verified
(pre-fills live, override sticks, no console errors). Changelog `899b60f`.

**Deferred / flagged (no dirty routes — surfaced):** the **learned** dress-code default (adopt a Business's repeated
override as their default after ~3 times) — needs history aggregation, invisible polish; **language as a hard Pool
filter** (kept display-only on purpose); **orphan cleanup** of replaced board files in Storage (minor leak); client MIME
is trusted (bucket `allowedMimeTypes` is the backstop). PRM → IDEAS (Bus expansion).

## 2026-06-25 — Session 18 — Fix: "Review" silently posted the mission (React node-reuse) + irreversible-post guardrails
**Branch:** `main` (working tree — **not yet committed/deployed**, awaiting founder review) · **Env:** local → Vercel.

**Why:** founder report — on `/dispatch/new`, clicking **"Review mission →"** posted the mission LIVE and jumped to the
Schedule (no review step, no explicit confirm); separately, "Post to the Pool" sometimes "did nothing". Item **#5**
of the founder's 2026-06-25 dump. Founder also asked: keep "Post to the Pool" but add an **irreversible** warning.

**Root cause (reproduced + verified in-browser, not guessed):** the edit-mode **Review** button (`type=button`) and the
preview-mode **Post to the Pool** button (`type=submit`, `intent=pooled`) render in the SAME position inside
`.mx-actions`, so React **reused the same `<button>` DOM node** and patched its `type` to `submit` *during* the click
that flips to preview → the browser then submitted the form = a LIVE post. Proven with a capture-phase submit
interceptor: clicking Review fired a `submit` whose `submitter` was the "Post to the Pool" button. **Ruled out** a
service worker (there is none — verified) and the Enter key (never pressed).

**What shipped (`mission-form.tsx` + `dispatch/new/actions.ts`, no schema change):**
- **Node-reuse cure** — distinct React `key`s on the edit vs preview `.mx-actions` containers, so React MOUNTS A FRESH
  button set instead of re-typing the Review node in place. Review now ONLY previews (verified: **0 submits**).
- **Server safety net** (`createMission`) — `intent` no longer defaults to `"pooled"`. A submit carrying neither
  `"pooled"` nor `"draft"` (e.g. a stray implicit submit) now redirects back to the form **writing NOTHING** — it can
  never silently post a live mission. (Defence in depth.)
- **Enter-key guard** — broadened: a stray Enter inside any single-line `<input>` is blocked in BOTH edit AND preview
  (was edit-only); `<textarea>` (newlines) and `<button>` (keyboard activation) left untouched.
- **Irreversible warning** (founder ask; D25 preview-approved) — amber `.notice warn` at the confirm step:
  "This is final. Posting sends the mission live to the Driver Pool right away — it can't be un-posted. Use Edit or
  Save as draft if you're not ready." The **"Post to the Pool"** label is kept.

**Verified** — `tsc` clean (didn't run `next build` while the dev server was live). Browser (real Supabase,
Business dev-login): Review → preview with **0 submits** + warning renders with the exact wording; "Post to the Pool"
fires `intent=pooled`, "Save as draft" fires `intent=draft`; **real end-to-end draft create → `/dispatch/drafts` →
discard** (zero residue); no console errors; screenshot matches the approved mockup.

**Also fixed (pre-existing, surfaced during #5):** the preview card showed a bogus "~4907 km" when **no dropoff** was
picked — `review()` used `Number(fd.get("dropoff_lat"))`, and `Number("")` is `0` (a "finite" coordinate), so it
computed a pickup→(0,0) great-circle distance. Switched to the file's existing `toNum` helper (empty → null, matching
the server action's `num`). Verified: no-dropoff shows no distance; a real dropoff still shows the right figure
(Nice → Cannes "30 km · 39 min").

**Follow-up (same session) — double-submit duplicates + discard confirmation (founder retest):**
Founder hit **duplicate missions**: a Céline Yow trip posted **7×** (DB: 7 inserts in 14s, 1–4s apart) + a twin
draft. Root cause: the form had **no in-flight guard**, so repeated clicks during the slow server action each
inserted a row (the #5 fix stopped accidental Review-posts, not deliberate re-clicks on a slow Post/Save).
- **Fix (`mission-form.tsx`):** a pending-aware `SubmitButton` via `useFormStatus` — while `createMission` runs
  EVERY submit button is **disabled** and shows "Posting…/Saving…". Verified live: mid-flight the button was
  `disabled=true`, `aria-busy=true`, label "Saving…". A second click now hits a dead button → no duplicate.
- **Discard confirmation (founder ask; `components/draft-actions.tsx`, new):** discarding a draft now needs an
  **inline confirm** ("Discard this draft? This can't be undone." + Cancel + red Discard), also pending-guarded.
  `drafts/page.tsx` now renders `<DraftActions>` instead of the bare discard form. Verified end-to-end (confirm
  shows, Cancel reverts, Discard deletes), `tsc` clean, no console errors. **Visual follow-up:** the draft card's
  "Continue editing" button was squeezed — `.btn` defaults to `width:100%`, so once Discard left its `<form>`
  wrapper it fought the flex layout; pinned Discard to content width (`flex:none; width:auto`). Verified
  (Continue 423px / Discard 93px, balanced).
- **Slowness (founder Q):** it's `npm run dev` (dev-mode compilation) + Supabase/Mapbox network round-trips before
  the redirect — NOT hardware; production is faster. No code change. (Optional future: move the Mapbox ETA call off
  the critical post path.)
- **Duplicate cleanup:** removed my own throwaway test drafts via the UI. The founder's **7 duplicate Céline Yow
  pooled missions** (17:00 UTC / 19:00 Paris, ceiling 170) + 1 stray Céline draft REMAIN — handed the founder a
  scoped `delete` SQL for the Supabase SQL editor (Claude does not delete shared-DB rows without authorization;
  the auto-mode classifier correctly blocked an attempt).

**Quick-polish batch (same session, shipping items as completed):**
- ✅ **Keyboard nav in the address autocomplete** (`components/address-autocomplete.tsx`): the Mapbox suggestion
  dropdown is now a proper ARIA combobox — **↑/↓** move the highlight (wrap-around, `aria-selected` +
  `aria-activedescendant`, scroll-into-view), **Enter** selects the highlighted suggestion (retrieves coords,
  closes the list, does NOT submit the form), **Esc** closes. `.ac-item.is-active` mirrors the hover style.
  Verified live (arrows move the highlight, Enter picked Nice with coords 43.71/7.26, Esc closes, no console errors).
- ✅ **Draft indicator in the sidebar** (`dispatch-shell.tsx` + `(dispatch)/layout.tsx` + `dispatch/new/actions.ts`):
  the **Drafts** nav item shows a navy count badge when drafts exist (a small dot when the sidebar is collapsed).
  Count is fetched in the layout (`count: "exact", head: true`) and kept **fresh** after save/post/discard via
  `revalidatePath("/dispatch", "layout")` in `createMission` + `discardDraft` (the layout otherwise persists across
  client nav and would go stale). Verified live: badge matched the DB (1), **1→2 on save**, **2→1 on discard**,
  collapsed-mode dot OK, no console errors. (Dev preview got flaky mid-verification — restarted the dev server for a
  clean run; confirmed read-only via service role that no stray test drafts were left.)

- ✅ **Driver search in the Calendar** (`components/dispatch-calendar.tsx`): the existing guest search now ALSO
  matches the **assigned driver's name** — the `match` filter ORs `e.driver` alongside `e.guest` (`CalEntry.driver`
  was already populated by the server). Placeholder/aria-label → "Search guest or driver…". Verified live:
  "Marc"/"Dubois" → 7 driver-matched trips (no guest carries those), "Willis" → 1 (guest search intact),
  nonsense → 0; no console errors.
- ⚠️ **Deploy ops gotcha (2026-06-25):** Vercel's GitHub auto-deploy **silently dropped** commit `1bc8671` — it
  created NO deployment for it, so the live calendar kept showing the OLD guest-only search even though the code was
  correct and `next build` passed locally. The founder reported "search doesn't work" twice; root cause was the
  missing deploy, not the code. Fix: pushed an **empty re-trigger commit** (`git commit --allow-empty`, `4c34c6c`) —
  Vercel picked that one up and deployed `success`. **Lesson:** after `git push origin main`, verify a deployment was
  actually created — `gh api repos/Phyrass-H/Pickup-marketplace/deployments --jq '.[0].sha'` should equal the pushed
  SHA. If a push is dropped, push an empty commit to re-trigger (or Vercel dashboard → Redeploy). The GitHub
  deployments `?sha=` filter needs the FULL 40-char SHA; the short SHA returns empty.

- ✅ **#6 Desktop width** (`dispatch-shell.tsx` + `globals.css`): `.dx-main` was capped at **1120px + left-aligned**,
  leaving dead space on wide monitors (324px at a 1680px viewport — "squished to the left"). Added a
  **`.dx-main--wide`** modifier (max-width **1520px**) that the shell applies on the **dense data views only**
  (Schedule / Calendar / History) via `pathname`. The **new-mission form is deliberately left UNTOUCHED** (founder
  asked) — it keeps the 1120px default (form grid 1072px, identical to before); Drafts (560px cards) + Settings also
  unchanged. D25 loop: showed before/after at 1680px (live CSS injection, nothing committed); founder approved
  widening the dense views but explicitly NOT the mission page. Verified live: Schedule/Calendar/History fill (1444px,
  0 dead space), new-mission still 1120/1072, Drafts still 560; tsc clean, no console errors.

- ❌ **#7 sidebar spacing — founder declined** ("sidebar is fine, we won't touch it"). Mocked it (current vs a
  more-spaced version with a "Manage" section label); founder chose to leave it as-is.
- 📓 **Session-end docs** (founder request): created **`project/CHANGELOG.md`** — a plain-language, dated,
  founder-facing history of everything shipped since day 1 (the simple read; `SESSION_LOG.md` stays the technical
  log). Refreshed `NEXT_SESSION.md` to the S18 resume point + the deploy gotcha. Added BACKLOG **§ M** (the
  2026-06-25 founder dump: done vs remaining) and **D29** (the dense-view width call).

**Next:** the mission-form fields + guidance (BACKLOG § M + § L) — reference/comment split, a Driver section
[required language / dress code / message-to-driver], smart defaults + why/how microcopy + input-driven guidance,
saved base addresses; then the ultra-luxury "Exception" tier (taxonomy V2). See `NEXT_SESSION.md`.

---

## 2026-06-24 — Session 17 — Named passengers (first + surname, capacity-capped) + idea-dump filed
**Branch:** `main` (committed + deployed) · **Env:** local → Vercel. **Migration:** founder-applied
`docs/migrations/2026-06-23_named_passengers.sql` (additive `mission.passenger_names jsonb`).

**Why:** founder ask — let the Dispatcher name **multiple Guests** (First name + Surname) on a mission, **capped
by the vehicle** (Sedan 4 / Van 7). Designed via the D25 preview loop (mockups → founder chose: rows = headcount,
structured storage, Sedan 4 / Van 7, prominent Add button).

**What shipped:**
- **`components/passenger-list.tsx`** (new): rows of `{first,last}`, "Add passenger", **capped by Body type**
  (`seatCap`: Sedan 4 / Van 7 / Any 7, nudge past 4). Rows = headcount; names optional; remove disabled at 1,
  add disabled at cap; emits a hidden `passenger_names` JSON field. **`lib/passengers.ts`** (new): shared
  `Passenger` type, `seatCap`, `parsePassengers`, `primaryPassengerName`, `splitFullName` (DRY across the
  component, the preview and the server action).
- **Cross-card cap sync:** `ServiceClassFields` gained an `onBodyChange` callback; `MissionForm` lifts the body
  value and passes it to `PassengerList`, so the cap reacts to the Vehicle & class selection.
- **Form rewire** (`mission-form.tsx`): replaced the "Passengers" number input + the single "Guest name" text
  input with `<PassengerList>`; `review()` derives guest + pax from the named list. **Action** (`actions.ts`):
  writes `passenger_names` (jsonb) + the denormalised `passenger_name` (first NAMED Guest) + `pax_count`
  (= rows). **Types:** `mission.passenger_names: Json|null`.
- **Migration:** additive `passenger_names jsonb`, **applied by the founder** in the Supabase SQL editor —
  schema rule #4: I can't run DDL with the app keys (PostgREST does rows, not table structure), only the founder
  via the dashboard.

**Verified** — `tsc` + `next build` green. Browser (real DB): add/remove rows; **cap reacts to Body** (Sedan→4,
Van→7) cross-card; **save-as-draft writes `passenger_names`** → **resume reads the names back** (Jean Dupont +
Marie Martin, tier/body/cap restored); preview shows "Jean Dupont · 2 pax"; **posted live → schedule shows the
Guest**; no console errors. (Dev preview got flaky mid-session from a build/dev `.next` clash — fixed by
`rm -rf .next` + clean restart; the ChunkLoadError was env, not code.)

**Reviewed** — 19-agent adversarial workflow (4 dims → 2-skeptic verify); 15 raw → **5 confirmed, all fixed:**
(MED) legacy/pre-migration drafts carried their count only in the old number field → resume now **pads rows up to
`pax_count`** so the count survives a resume+save; (MED) an untouched form stored a junk `[{"",""}]` blob → now
stores **null** when no Guest is named (count preserved in `pax_count`); (LOW) the cap warning was mounted fresh
so screen readers missed it → **always-mounted `role=status` live region**; (LOW) `.pl-note` text failed WCAG AA
at 12px → darkened to `#854f0b` (~6.5:1). `tsc`+build green after; live-region fix confirmed in-browser.
Decision kept (founder's model): rows = headcount, so an untouched mission reads "1 pax" by design.

**Also filed earlier this span (committed `0f346ee`):** founder idea-dump → **BACKLOG § L** (guided-form polish:
input-driven hints, why/how microcopy, smart most-used defaults, saved base addresses, multiple passengers ✅
this session, dress code) + **IDEAS "Founder idea dump — 2026-06-23"** (V2/strategic: Bus tier, First/VIP van,
cargo vehicle, driver specialisation, pricing engine, driver-vetting toggle, anti-disintermediation, overtime,
At-Disposal UX). Also: **specific-car dropdown** restyled (`appearance:none` + custom chevron, S16 follow-up,
committed `a7618a1`).

**Next:** deployed. The **BACKLOG § L** guided-form polish items are the obvious follow-on (founder priority:
features/polish before APIs/integrations).

---

## 2026-06-22 — Session 16 — Service-class redesign: tier tiles + tidied specific-car
**Branch:** `main` (committed `6c0a326`, **pushed + deployed**) · **Env:** local → Vercel. **Design loop:** D25.

**Why:** founder feedback — the **"Service class (routes to the matching Pool)"** control in the Vehicle &
class card was a native `<select>` sitting right above the modern segmented Body-type control, so it read as
outdated. Also flagged a real dead control: **Eco + a body** showed a single-option dropdown ("Any eco Sedan
(recommended)") because the catalog has **no Eco models**.

**Design loop (D25):** Claude-Code inline HTML mockups from the real navy tokens → founder compared
segmented-vs-tiles → chose the **richer tier tiles**; asked to keep the specific-car **a simple dropdown** (no
opt-in/search) and approved **hiding it for Eco**. Iterated the mock to the final before any code.

**What shipped (`components/service-class-fields.tsx` + additive CSS in `app/globals.css`):**
- **Service class → three selectable tiles** (Eco / Business / First), each with a short example (Eco:
  "Standard comfort"; Business: "Mercedes E, BMW 5, Audi A6"; First: "S-Class, 7 Series, Maybach"). Replaces
  the native `<select>`; a **hidden `<input name="category">`** carries the tier so the submit contract is
  unchanged. Selected = navy border + `--accent-soft` fill.
- **Body type → full-width** segmented control (`.seg--full`; `.seg`/`.seg-btn` themselves untouched).
- **Specific car → still a dropdown** for Business/First, but **hidden for Eco** (no catalog models) — a
  one-line `.tier-empty` note replaces the dead single-option dropdown. Gate:
  `showCarPicker = body && (carsFor(tier,body).length>0 || specific)`. Default helper vs the "fewer matches"
  warning when a model is picked. Removed the now-redundant per-body `carRangeHint` line.
- New additive CSS: `.tier-tiles`/`.tier-tile`(`.is-on`,`:focus-visible`), `.seg--full`, `.scf-label`,
  `.tier-empty`. **No schema, no token change**, no other component touched.

**Verified** — `tsc` + `next build` green (25 routes). Browser (real DB, Business dev-login): tiles render +
select (old `<select name=category>` gone); clicking a tier updates the hidden `category`; full-width body seg;
Business+Sedan → dropdown (40 opts) + default helper; picking Classe E → `required_make=Mercedes-Benz` /
`required_model=Classe E` + "fewer matches" warning; **Eco → picker hidden + note**, make/model cleared;
no console errors. All four form fields submit exactly as before.

**Reviewed** — 12-agent adversarial workflow (4 dims → 2-skeptic verify); 8 raw → **1 confirmed (MED)**: the
**selected** tile's example text (`--text-muted` on `--accent-soft`) was **4.05:1**, below WCAG AA. **Fixed** —
recoloured `.tier-tile__eg` to `--slate-600` (~6.5:1 on the tinted tile, ~7.6:1 on white); re-verified the
computed colour in-browser (`rgb(71,85,105)`).

**Next:** deployed; founder review. Driver-app layout redesign + small navy polish items still open.

---

## 2026-06-21 — Session 15 — New-mission Pricing card + read-only Summary rail
**Branch:** `main` (working tree, **uncommitted** — awaiting founder review/deploy) · **Env:** local → Vercel.

**Why:** founder feedback on the S14 two-pane form — the **Ceiling** input lived in the right-hand Summary
rail, split from the **Estimated base fare** (which sat in Trip details). The founder's point: the rail should
be a **read-only preview**, not an input section; group the two fare inputs together.

**Design loop (D25):** Claude-Code inline HTML mockup from the real navy tokens first → founder reacted
("the new pricing card is nice, I like it") and asked why the *rest* looked different (answer: the mockup is a
hand-built replica, the real app was untouched) → confirmed via Q&A: a **new dedicated Pricing card**, **SPEED
WIN moves with it**, **actions stay in the rail**, and the **card header matches the others** (no navy tint) →
implemented for real.

**What shipped (`app/(dispatch)/dispatch/new/mission-form.tsx` only — no other file, no schema, no token change):**
- **New "Pricing" section card** (5th, left pane) grouping the three existing pricing inputs:
  **Estimated base fare** (moved out of Trip details), **Ceiling** (moved out of the rail), **SPEED WIN**
  (moved out of the rail) — plus the too-low warning + a one-line helper. Same `.mx-card__*` slate icon chip
  + uppercase title as the other four cards (Lucide `Wallet` icon).
- **Summary rail is now read-only** — **0 input fields**. Shows the Ceiling as a value, the live starting fare
  (`.mx-fare`), and a **"Pricing mode"** line (SPEED WIN badge / "Standard climb"), then the actions
  (Review / Save draft / Post). Empty-state when no ceiling yet. The `createMission` contract is unchanged
  (same field `name`s submit from the relocated inputs); the D22 draft/Review flow + live ETA + waypoints all
  preserved. Reference textarea in Trip details nudged to `marginBottom:0` (cosmetic, now last field there).

**Verified** — `tsc` + `next build` green (25 routes). Browser (real Supabase, Business dev-login): 5 cards
incl. Pricing; exactly one ceiling/base/speed_win input each (no duplicates); rail has **0 inputs**; live fare
120 → **60,00 €** standard / **84,00 €** SPEED WIN; too-low warning fires (base 140 > ceiling 120) inside the
Pricing card; responsive collapse <900px intact (`position:static`, single column); no console errors.

**Reviewed** — 18-agent adversarial workflow (4 dims → 2-skeptic verify); 14 raw findings → **1 confirmed
(LOW)**: the too-low warning was **hidden in preview** mode (it had moved into the `display:none` `.mx-sections`).
**Fixed** — a compact version now renders in the read-only rail **only in preview** (`tooLow && mode==="preview"`)
so there's no edit-mode duplication and the post-time nudge is restored. Re-verified in-browser (edit: warning
in the card only; preview: "Below the recommended base fare — may go unfulfilled." in the rail).

**Next:** founder review → push `main` to deploy when okayed. **Not deployed.** Optional follow-up still open:
the Driver-app layout redesign + the small navy polish items (green "Complete ride", logo re-export).

---

## 2026-06-21 — Session 14 — Mission-page redesign: app-wide navy + two-pane new-mission form (Direction B)
**Branch:** `session-14-mission-redesign-navy` (off `main`, merged + deployed) · **Env:** local → Vercel.
**Decisions:** D24 (navy + two-pane), D25 (design = Claude-Code inline HTML mockups).

**Why:** the founder wants the **new-mission page** (`/dispatch/new`) to breathe — clear sectioning, less
narrow, a more "serious/solid/confident" look, away from the bright "Facebook" blue.

**Design loop (D25):** instead of Claude Design zips, this session used **Claude-Code-authored HTML mockups
rendered inline** (the visualize widget) from the real tokens + data → founder reacted in plain language →
iterated (two layout directions; cool vs warm; **four navy depths** → locked **#25344C**, between ink and
navy; fixed a `+`-marker alignment bug live in the mock) → then implemented for real.

**What shipped:**
- **App-wide navy palette** (token layer, `app/globals.css`): action blue → **navy #25344C** (`--blue-*`,
  `--ring`); status **"info"** (Confirmed/Accepted) → **steel #1b5e8a** (mirrored in `lib/dispatch-status.ts`)
  so it stays distinct from the navy CTA; hardcoded blues fixed (`.badge.status`, `.notice.info`, date-picker
  focus). Brand logo gradient untouched (logo-only).
- **`/dispatch/new` → Direction B two-pane** (`mission-form.tsx`, `page.tsx`): ONE `<form>`; left = 4 section
  cards (Vehicle/Route/Schedule/Trip) with slate icon chips + uppercase titles; right = a **sticky navy
  Summary rail** — mini-route, live **ETA** (mirrors the route card), Ceiling, a **live starting fare**
  (re-prices on ceiling/SPEED-WIN change), SPEED WIN toggle, actions. Collapses to 1 column <900px. The D22
  draft/Review flow + live ETA + waypoints all preserved. `RouteStops` publishes a snapshot via
  `onSummaryChange` + accepts `etaDefault` (no behavioural change to its inputs).

**Verified** — `tsc` + `next build` green. Browser (real DB, 1320px + mobile): two-pane render, rail ETA ==
route-card ETA, live fare 120→60€ / SPEED WIN→84€, Review preview fare agrees, responsive collapse, **Driver
app** navy OK (Accept reads primary, logo intact). Deploy **confirmed live** (CSS bundle hash changed; has
`.mx-summary` + `#25344c`).

**Reviewed** — planning workflow (3 agents: palette audit + form architecture + risks) front-loaded the
change; 4-dim adversarial review (16 agents) → 5 LOW findings **all fixed** (draft-ETA seeding + loading
state, aria-live on the fare, heading semantics, empty-state contrast); **final post-deploy 3-angle agent
check (11 agents) = ALL CLEAR (0 confirmed).**

**Follow-ups (optional, noted not done):** Driver "Complete ride" could be intentionally green (the
`success-btn` class falls through to navy `.btn`); re-export the logo to harmonise its sky-blue with navy;
the Dispatch sidebar doesn't auto-collapse on a phone (pre-existing; Dispatch is desktop-first).

---


## Older sessions (1–13) — archived
Sessions 1–13 (2026-06-16 → 2026-06-20) live in **`project/SESSION_LOG_ARCHIVE.md`** to keep this file — and
session startup — light. Read the archive only if you need that deep history; `project/CHANGELOG.md` has the
plain-language big picture.
