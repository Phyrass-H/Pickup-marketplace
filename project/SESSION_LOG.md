# PickUp — Session Log

> Append-only, newest at top. One entry per working session. Keep it short:
> what changed, what was decided, what's next.

---

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
