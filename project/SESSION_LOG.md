# PickUp — Session Log

> Append-only, newest at top. One entry per working session. Keep it short:
> what changed, what was decided, what's next.

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
