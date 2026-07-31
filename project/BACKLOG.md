# Kavenue — Backlog (what's built, what's next)

> Single planning list for upcoming sessions. Tags map to the spec (Doc 02):
> ✅ done · 🔨 KEEP (build for V1) · 👤 MANUAL (a human does it in beta) ·
> ⚙️ infra/ops · 🅥 V2 (CUT in the spec — don't build unless re-prioritised) ·
> ❓ needs a founder/legal decision.
>
> Most KEEP items need NO schema change — the tables already exist in
> `docs/kavenue_schema.sql` (document, payment, ledger_transaction, payout,
> booking_voucher, status_event). Build against them.

---

## ✅ Already built & live (Vercel, `main`)
- Email-magic-link plumbing + key-gated dev sign-in (solo testing).
- Driver: Pool (zone/category filter) → mission detail → Accept (atomic RPC) →
  My Rides → 4 status buttons (en route→arrived→on board→completed).
- Business (Dispatch): post mission → booking-style **Schedule** (day-grouped,
  Today pinned, colour-coded, expandable rows) + month **Calendar**; live status.
- Contacts unlock on accept (both sides). PDP fare computed on read.

---

## A. Accounts, profiles & settings
- 🔨 Driver profile: photo, languages (zones/category/name already done) + **edit**.
- 🔨 Driver **vehicle** details: make / model / colour / plate / seats (category done).
- 🔨 Driver **documents upload** → `document` table + Supabase Storage:
  licence, VTC card, REVTC, insurance, RC Pro, vehicle registration. 👤 verify.
- 🔨 Driver **bank details / Stripe Connect** onboarding (for payouts).
- 👤 Driver video-interview validation (flag `driver.verified`).
- 🔨 Business profile: logo (name/field done) + **edit**; Dispatcher contact edit.
- 🔨 Business **documents upload**: company registration. 👤 verify.
- 🔨 Business **card/bank** (Stripe customer) details.
- 🔨 **Account settings** page both sides (edit profile, sign-out, GPS pref, etc.).
- 🔨 **Real email sign-in** for actual users (turn off dev-login; needs the one
  Supabase redirect-URL setting). Required before inviting real drivers/hotels.

## B. Mission lifecycle (gaps)
- 🔨 **Mission edit** (limited per Doc 02: free while pooled; material edits after
  accept need driver re-consent or cancel+repost).
- 🔨 **Cancel mission (O7)** — RULESET DECIDED 2026-07-13 ([[d45]]): driver voluntary cancel = always 100% (re-pools);
  business cancel = free >5h then 50%@−5h +10%/h→100%; no-show (status `arrived`, 1h airport/20min city) = driver paid
  full, business charged; T-60 reclaim (driver unconfirmed+unreachable) → re-pool as SPEED WIN. 👤 euro amounts MANUAL.
  Copilote hand-over = Phase 2 (below). See § N.
- ⚙️ **Scheduled jobs** (Supabase cron / Vercel cron): Lock-in auto-confirm +
  T-180 reminder, expiry of unfilled missions, return-to-pool on no-confirm.
- 🔨 **Maps/geocoding** (Mapbox): autocomplete + lat/lng ✅ (D17); **road ETA** ✅ (S12/D23); stops are now
  **geocoded** and the ETA is **routed through them** ✅ (S13); **France-biased** suggestions (country
  allowlist, pickup-proximity) ✅ (S13). Still to do: feed the ETA into a better **recommended base fare**
  (manual estimate today); use `duration_min` to replace the crude ±90-min `accept_mission` slot-conflict buffer.
- 🔨 Intelligent **flight tracking** API (paid) → auto-shift pickup on delay.
- 🔨 Native **welcome banner** (branded greeting) for the Driver app.

## C. History (both sides)
- 🔨 **Mission history**: month → list → detail, for Driver and Business
  (Dispatch shows current/active only today; no archived history view yet).

## D. Money (Stripe Connect)
- 🔨 **Card payment per mission** + auto **commission split** (Stripe Connect).
- 🔨 **Ledger transaction** written at completion (table ready; trigger/flow TODO).
- 🔨 **Booking voucher** (justificatif, 7 legal fields, arrêté 6 Aug 2025) per trip.
- ❓ **Invoice** to Business (2 lines: transport + service fee + 20% VAT) — KEEP but
  invoicing **direction** is pending the agent/principal + self-billing decision (Doc 01/03).
- 👤 **Driver payouts** weekly (manual batch in beta; automate via Connect later).
- 🅥 Auto invoice / quote / PO for drivers · wallet · periodic billing · SLA ·
  financial dashboard.

## E. Notifications & support
- 🔨 **Email notifications** (Resend): acceptance, T-180/Lock-in, status, reminders.
- 🔨 **Push notifications** (web push, PWA): same triggers.
- 🔨 Email support + static **FAQ** page.

## F. Analytics & reporting  ❓ (mostly V2 in the spec — confirm priority)
- 🅥 **Business-facing analytics**: by category / period / zone, profitability,
  CSV export, year-over-year. (Doc 02 marks reporting/analytics CUT for V1.)
- ⚙️ **Kavenue internal / investor metrics**: signups, missions posted vs accepted
  vs completed, **fill rate**, time-to-accept, GMV, commission earned, liquidity
  by zone/category, cancellation rate. (Admin dashboard; great for the raise.)
- ⚙️ **Dev observability**: error monitoring (e.g. Sentry), structured logs, uptime.
- 🔨/⚙️ **Admin role + dashboard** (`admin` role exists in schema): verify drivers,
  oversee missions, run payouts.

**Dispatch-side EARNINGS / spend (founder, 2026-07-31) 🔨** — the founder wants the money view on the Business side too:
what a hotel has spent over a period, per trip, and presumably by month for their own accounting. The Driver's Earnings
screen ([[d59]]) is the model to follow — same period filter (Day/Week/Month/Year), no charts, comparison against the
previous period — and `settledFare()` already gives the correct frozen fare, so the maths is solved. **Open:** does it
include cancellation fees and waiting charges (it should — a hotel's real cost), and does it need an export for their
accountant? ⚠️ Keep the **agent/intermediary** framing in the copy: Kavenue is not the seller of the transport.

## F2. Internal tooling & observability stack  ⚙️/🔨 (Kavenue back-office — future pillar)
> Founder request (2026-06-17): the Kavenue-internal layer for **dev / marketing /
> dispute-support** — so when a user calls about a bug we can see what happened, and
> marketing can follow usage. It's NOT one dashboard: it's a stack of distinct tools per
> audience. Consolidates the analytics/observability pieces above into one named pillar.
> Each piece is mostly copy-paste SDK + free tiers; the admin dashboard is the real build.
- ⚙️ **Product analytics** (marketing): clickstream + named events (`mission_posted`,
  `mission_accepted`, `signup_completed`) → funnels + retention. PostHog (recommended;
  bundles session replay + funnels + flags) or Mixpanel/Amplitude/GA4.
- ⚙️ **Error monitoring** (devs): Sentry SDK (browser + server) → stack trace, user, URL,
  breadcrumbs; on top of the free Vercel + Supabase logs. Search by user/time when a bug is
  reported. (~½ day to wire.)
- ⚙️ **Session replay** (support + dev): privacy-masked reconstruction of a real session to
  see what the user actually did. PostHog built-in, or Microsoft Clarity (free) / LogRocket.
- 🔨 **Admin dashboard / back-office** (dispute-support): in-app `/admin` gated to `role=admin`
  (RLS already grants admin read on every table). Search a Driver/Business/mission; view its
  **audit timeline** (built on the existing `status_event`), statuses, payments, documents,
  contacts. Highest-value piece — wanted before real users go live.
- 🔨 **Account verification workspace** (onboarding approval — **founder priority, 2026-06-17**):
  a dedicated **enrollment queue** in `/admin` listing every new **Driver** and **Business**
  awaiting validation. Per applicant: their profile/company details + **all uploaded documents**
  (Driver: licence, VTC card, REVTC, insurance, RC Pro, carte grise · Business: Kbis) shown inline
  via signed-URL preview, with **approve / reject** controls that set each `document.status`
  (pending → verified/rejected) and flip **`driver.verified`** true once the file is complete. This
  is the dedicated interface Kavenue staff use to **manually validate every new user in beta** (👤).
  Pairs with the 👤 verify + video-interview items in section A. Needs an admin **write** path
  (service role) — browser RLS is read-only for admins today. The upload side already exists
  (Session 7: documents land in the `documents` bucket as `pending`); this is the review/confirm side.
  - **Founder confirmed 2026-07-28: this back-office is wanted, and its scope is papers + disputes +
    "other things"** — i.e. the two 🔨 items above are one product, not two. Call it the **back-office**
    (`/admin`); "support console" works too. Not scheduled yet.
  - **S48 made the Driver side concrete — the reviewer's contract is now fixed** ([[d58]]): per document
    the back-office writes `status` (pending → verified/rejected), **`review_note`** (the Driver reads it
    verbatim: *"the bottom edge is cut off"*), and may correct **`expires_at`** (the Driver types it off
    the paper, so it's the field most likely to be wrong). Two-sided papers are **one row per `side`**
    (front/back) — approve them independently. The Driver-facing states already render all of this, so the
    back-office is genuinely just the write path. **Doc list to review** (9): licence · VTC card · REVTC ·
    medical certificate · Kbis · **URSSAF attestation de vigilance** (re-collect every 6 months — the one
    with a legal deadline on Kavenue) · RC Pro · carte grise · insurance.
  - **The expiry-reminder job belongs here too**, not in the Driver app: the account copy already promises
    "a month before, and again the week it lapses", which needs a scheduled query over `document.expires_at`
    + the notifications phase. Until it exists, a Driver only learns on opening the app.
- 📊 Doubles as **investor metrics** (fill rate, time-to-accept, GMV, commission) — see the
  ⚙️ "Kavenue internal / investor metrics" line in F.
- ⚠️ **GDPR dependency**: analytics + session replay capture PII → require PII masking,
  cookie consent, and listing Sentry/PostHog as processors in the privacy policy. Do together
  with **G › GDPR**. Don't enable for real users before that.

## G. Trust, legal, compliance
- 🔨 **GDPR**: privacy policy, consent capture, data-deletion path.
- 🔨 PII/financial **encryption** (use providers' built-in).
- 👤 DGITM declaration · Kavenue RC Pro insurance · verify each driver is registered VTC.

## H. Platform / production readiness
- ✅ **Custom domain**: `pickupbedriven.com` (OVH) live on Vercel with role subdomains
  **`driver.*`** (Driver app) + **`dispatch.*`** (Dispatch). See SESSION_LOG S9 / DECISIONS D18.
  - ↳ **Now unblocked — URL-restrict the Mapbox token:** the Default public token can't be
    restricted (no wildcards), so create a new token scoped to `driver.pickupbedriven.com` +
    `dispatch.pickupbedriven.com` + `localhost:3000`, then swap `NEXT_PUBLIC_MAPBOX_TOKEN` in
    Vercel + `.env.local` and redeploy. Until then the unrestricted token is in use (fine for beta).
  - ↳ **Bare root** `pickupbedriven.com` still points to OVH parking — decide its destination
    (redirect to a side, a "Driver / Business" splash, or a marketing landing).
  - ↳ **Supabase redirect URLs** — add `driver.*` + `dispatch.*` `/auth/callback` before real email.
- 🔨 **PWA polish**: icons, install prompt, offline shell — **per-role manifest** so each subdomain
  installs as its own app (Kavenue Driver / Kavenue Dispatch).
- 🔨 **Design/skin** pass. ✅ **Dispatch** (S10 / D20: tokens + Geist + Lucide + sidebar + schedule +
  calendar). ✅ **Route card** (S13: stop autocomplete + live ETA + "Add a stop" button + red stop marker).
  ✅ **App-wide navy + new-mission two-pane** (S14 / D24: navy `#25344C` at the token layer; `/dispatch/new` =
  section cards + sticky live Summary rail; status "info" → steel). The design loop is now **D25** (Claude
  Code inline HTML mockups). ↳ **Driver app layout next** — design it (D25 mockup or a Claude Design phone
  mockup), then apply. Navy polish (small): Driver "Complete ride" → green; re-export the logo to harmonise
  its sky-blue with navy.
- 🅥 Security audit / pen test (plan post-V1).

## H2. Engineering hardening (quality — before real production) ⚙️
> Flagged 2026-06-19. The foundations are clean (modern stack, lib/ domain separation, RLS-first
> security, strong docs), but this is still an MVP/beta codebase. These are the standard MVP→production
> steps a takeover dev team would expect. Founder intent: do them all eventually; not blocking beta.
- ⚙️ **Automated tests** (none today — biggest gap). Priority targets: PDP pricing (`lib/pdp.ts`),
  `missionTone` (`lib/dispatch-status.ts`), `accept_mission` atomic/first-wins + Lock-in, RLS policies,
  geo radius matching. Money paths first. (Vitest/Jest unit + a Playwright e2e for the core loop.)
- ⚙️ **CI on PRs** — GitHub Actions running `tsc` + lint + tests (+ build) on every PR. None today.
- ⚙️ **Generated DB types** — replace hand-written `lib/database.types.ts` with `supabase gen types`
  once the CLI is wired (D3); removes drift risk.
- 🔨 **Real email auth** — flip on magic-link, remove the dev-login scaffold (see A · needs the Supabase
  redirect-URL settings for `driver.*`/`dispatch.*`).
- ⚙️ **Error monitoring + product analytics** — Sentry + PostHog (also in F2).
- ⚙️ **Realtime** — swap `LiveRefresh` polling for Supabase Realtime websockets (also in I).
- 🅥 Security audit / pen test (also in H) — plan post-V1.
- **O7 review flags (2026-07-13, from the pre-deploy adversarial review — [[d45]]; before real Business users / payments):**
  - 🔒 **`p_mission_business_update` has no WITH CHECK** → a Business can bypass the O7 fee/reclaim gates with a direct
    PostgREST UPDATE on its own mission (set `status='cancelled'` skipping the fee, or unpool a *confirmed* trip). Fix with
    column-level grants (`REVOKE UPDATE … ; GRANT UPDATE (info cols) …`) once the legit business-write paths
    (updateMissionInfo, PhoneShareToggle, drafts) are audited. **HIGH for prod**; ~nil in beta (key-gated, no payments).
  - ✅ **Fee BASIS: `currentFare` never freezes at `accepted_at` — RESOLVED 2026-07-28 ([[d59]]).** Founder ruling:
    *"the final fare, whatever it is on the Business side or on the Driver side, is the price that the Driver accepted."*
    New `settledFare()` in `lib/pdp.ts` freezes the climb at `accepted_at`; applied to every display AND to the fee
    snapshots (`p_fare_snapshot` on driver cancel / no-show / business cancel / business no-show, and the amendment
    from-fare). Verified live both ways: a driver cancel on a €70-accepted / €100-ceiling trip recorded **€70** (was
    €100), and a business cancel at 83% recorded **58,17 € off a €70 basis** (would have been €83). ⚠️ The bug the live
    test caught: `settledFare` was optional-typed and the actions' narrow `FARE_COLS` select omitted `accepted_at`, so it
    silently fell back to the live fare — the column is now selected and the parameter is **required**, so a missing
    column is a compile error rather than a money bug.
  - 💶 **Penalty RULES need a rethink — founder, 2026-07-28. Not urgent, but before real money moves.** With the fee now
    correctly based on the accepted fare, **100% may be too weak a deterrent on cheap trips**: a €50 job costs €50 to
    walk away from, so a Driver offered something better is tempted to cancel and pay. The founder's words: *"100% is not
    enough … we need to fix rules later."* Sketch of the space (nothing decided): a **floor** under the penalty (max of
    100% and a fixed €X), a **multiplier** that scales as pickup nears, or a non-monetary cost (reliability marks that a
    Driver can actually see — itself an open founder conversation). Pairs with the reliability-marks discussion and with
    the postpone-then-cancel laundering note below.
  - 🔒 **`p_fare_snapshot` is client-supplied / forgeable** → recompute the fare inside the RPC from the mission's pdp
    columns (or clamp) when the pricing engine lands. Beta-mitigated (MANUAL money, no payments).
  - 👁 **Mid-run Business cancel visibility** → `MINE_STATUSES` excludes 'cancelled', so a trip cancelled while the Driver
    is en_route/arrived silently vanishes from My Rides. Surface a "trip was pulled" state — pairs with notifications.
- **No-show clock flags (2026-07-19, from the D47 fix — deferred by the founder):**
  - ✅ **RESOLVED by [[d48]] (2026-07-22) — the two entries below are SUPERSEDED, kept for the reasoning trail.** The
    founder cut the knot: **a booked trip's pickup time never moves.** Late Guests are handled by **waiting fees**
    (€1/min after the free wait, cap 60 min city / 120 min airport) and a genuine time change is a **cancel + rebook as a
    new trip**. So pickup time never becomes amendable, the postpone-then-cancel dodge cannot exist, and `pickup_at` gets
    a **blanket freeze after draft** — no status-aware rule, no amendment dependency. Research owed on the €1/min rate.
  - ~~❓ **BLOCKER on amendable time — "postpone then cancel" laundering (founder, 2026-07-22). DECIDE BEFORE BUILDING.**~~
    `business_cancel_mission` prices the fee from the **current** `pickup_at` (`v_hours := extract(epoch from
    (pickup_at - now()))/3600`). So the moment pickup time becomes amendable, a Business can dodge the fee **inside the
    app, with no technical skill**: at −30 min (100% = €180) propose "move to Friday" → the Driver accepts (rational — he
    keeps the job) → `pickup_at` is now 72h out → cancel → **€0**. The Driver consented to a DATE CHANGE, not to waiving
    his fee, but his tap is what unlocked it. Today this is closed only because time is not amendable
    (`2026-07-07_mission_amendment.sql:29` — "pickup_at (time) is NOT amended in v1"), so **building amendable time
    OPENS it**. Needs a founder POLICY decision, not just code — sketch: price a cancel that follows a POSTPONEMENT
    against the **pre-amendment** time (i.e. the fee clock never gets reset later by an amendment), with the founder
    deciding the edges: does it apply indefinitely or only for a window after the amendment? does a genuine
    later-cancellation of a long-postponed trip eventually price normally? Same family as the § H2 "fee basis doesn't
    freeze at `accepted_at`" flag — decide them together.
  - ~~⚠️ **ORDER MATTERS: add pickup-time amendments BEFORE freezing `pickup_at`.**~~ *(superseded by [[d48]] — time is
    never amendable, so the freeze has no dependency.)* The amendment table
    (`2026-07-07_mission_amendment.sql`) has `new_pickup_address` / `new_waypoints` / `new_fare` but **no
    `new_pickup_at`** — the amend screen only *displays* the time. So freezing `pickup_at` first would close the fee
    loophole AND remove the legitimate "the flight's delayed, can we push to 18:00?" path, with no route left for a real
    time change. Build (1) pickup time as an amendable field — `new_pickup_at` column + the field on `/dispatch/[id]/amend`
    + the before→after on the Driver's accept/decline card + apply it in `respond_to_amendment` — then (2) the freeze
    trigger. Worth doing on its own merits: "can we move it later?" is likely the commonest real Business request.
  - 🔒 **`pickup_at` is Business-writable and feeds two money gates** → `mark_no_show` measures the free wait from
    `coalesce(guest_ready_at, pickup_at)` and `business_cancel_mission` derives its fee tier from `pickup_at`, yet a
    Business can UPDATE it via raw PostgREST (so a late cancel can be re-tiered to 0%). Same root cause as the
    `p_mission_business_update` WITH CHECK flag above — fix **together** in the column-grant audit
    (`REVOKE UPDATE ON mission FROM authenticated` + `GRANT UPDATE (…legit cols…)`). `pickup_at` needs a **status-aware**
    rule, not a blanket block, because draft-resume legitimately rewrites it (`dispatch/new/actions.ts`).
    ✅ **`guest_ready_at` is DONE** — trigger `trg_mission_guard_guest_ready_at`
    (`2026-07-22_guest_ready_at_guard_fix.sql`), verified live (Business → 403, service role → 204). **Two Postgres
    gotchas worth remembering** when doing the audit: a column-level `REVOKE` is a **no-op** while the role holds
    table-level UPDATE (column privileges are only consulted when the table grant is absent), and a **`SECURITY DEFINER`
    trigger sees the function OWNER in `current_user`**, never the caller.
  - 💶 **`hours_before_pickup` is NEGATIVE on no-show rows** (e.g. `-0.5` = reported 30 min after pickup) — the opposite
    sign convention from the other four cancellation kinds, which count *down* to pickup. Arguably the honest value; decide
    the convention (signed / `abs()` / a separate column) before money is automated.
  - ⏱ **`advanceStatus` has no time guard** → a Driver can still mark themselves `en_route`/`arrived` arbitrarily early
    (sequencing is checked, timing is not). Since D47 this can no longer produce a no-show, so it is now a **data-quality**
    issue (the Business sees a bogus "arrived" a day out), not a money one. Needs a founder call on how early is too early.
  - 🕐 **Countdown uses the device clock** → `cancel-noshow.tsx` compares against `Date.now()` while the gate runs on
    Postgres `now()`. Fails safe and self-heals (the RPC re-checks and its message is surfaced), but device skew can show a
    button state the server disagrees with. Pass a server `now` from the RSC if it ever matters.

## I. Small follow-ups noted in code
- ✅ Promote the per-booking **reference** (room/event) to a dedicated DB column. **SHIPPED S20**
  (`mission.reference`, migration `2026-06-27_mission_reference`; legacy `comment` now vestigial).
- ✅ **Guest phone to the Driver (O2)** — **SHIPPED S20** with a Share gate: optional phone per Guest, revealed to the
  assigned Driver post-accept only when the Business toggles Share. Numbers in a Driver-unreadable side table
  (`mission_guest_contact`), so an un-shared number is physically private.
- **Calendar day → schedule** click-through (filter schedule to a day).
- Upgrade live status from polling to **Supabase Realtime websockets**
  (add `status_event` to the `supabase_realtime` publication).
- Make `pickup_at` timezone explicit (Europe/Paris) before relying on it in prod.

## J. Deferred (CUT in spec) — track only, don't build
Ratings/badges · in-app chat · live-map GPS · grouped missions · multi-dispatch
seats · substitute driver · multiple vehicles · favourite-driver priority ·
full ML dynamic pricing · Amadeus GDS.

## K. Session 11 — founder brain-dump triage (2026-06-19)
> 18 observations sorted. ✅ items shipped this session (branch `session-11-quickwins-postflow`).
> Glossary note: the borrowed settings mock had a "Clients" entry — **forbidden term**, dropped.

**✅ Shipped this session**
- ✅ **O1** trip distance on Driver Pool card, Dispatch row, both detail views + new-mission preview
  (straight-line; road/ETA = the Maps item in B).
- ✅ **O3** intermediate stops now shown on the Driver Pool **card** ("+N stops") — were detail-only.
- ✅ **O6** Driver car (make/colour/plate) captured at **onboarding**; shown on the **Dispatch** trip
  row when a Driver is assigned. (⚠️ plate = part of the legally-required VTC verification, not cosmetic.)
- ✅ **O9** pickup time is **Europe/Paris** explicit (UTC bug fixed) + quick chips + live echo + past guard.
- ✅ **O10** SPEED WIN starts at **70%** and climbs fast (D21). + **O10a** auto-suggest in preview when ≤5h.
- ✅ **O11** final **preview card** before posting. **O15** **save-as-draft** + resume + discard (`/dispatch/drafts`). (D22)
- ✅ **O13** Settings now link **Terms / Privacy / Support / Share feedback**; **O17** draft **Terms +
  Privacy pages, FR + EN** (`/legal/*`) — placeholder copy is fine for the MVP (founder owns the legal track).

**❓/🔨 Next — needs a schema change (additive ALTER, founder-approved, → `docs/migrations/`)**
- 🔨 **O2** show the **Guest phone** to the Driver (founder: fine to share across parties for the MVP) →
  new `mission.passenger_phone`; the Dispatcher toggle is optional. (Dispatcher↔Driver reveal already works.)
- ✅ **O5** vehicle **taxonomy** — SHIPPED (Session 12 / D23): tier (eco/business/luxury) × body
  (sedan/van) + maintained **car catalog** (`lib/vehicle-catalog.ts`); Dispatcher picks tier + Any/Sedan/Van
  + optional specific car; Pool matches tier + body + specific car. Additive migration applied.
  ↳ follow-ups: bind the **Driver's car to the catalog** (a picker) for fully-robust specific-car matching
  (today Drivers type make/model free-text, matched tolerantly); a DB/admin UI to edit the catalog later.
- 🔨 **O7** cancellation/no-show flow — **RULESET DECIDED ([[d45]]), see § N for the full spec.** Phase 1 spine =
  `cancel_mission` RPC (driver 100% / re-pool) + business cancel with the hour-ramp % + no-show@`arrived` + T-60 reclaim +
  re-pool-as-SPEED-WIN, big red Dispatch card (red-wash exists), driver reliability/"mark" field, cancellation **fee** data.
  (Fee/penalty *amounts* are a founder decision — MANUAL in beta per spec.) Phase 2 = copilote hand-over (§ N).

**🅥 Future (post-MVP — track, don't build)**
- 🅥 **O8** Guest/passenger app (phone-based, cross-business, post-trip Q&A, download invite). Net-new third
  surface — meaningful build (auth, Guest entity, feedback tables). Post-MVP.
- 🅥 **O12** at-disposal / *mise à disposition* (hourly) — confirmed **V2** (the `hourly` enum hook exists).
- 🅥 **O14** Business **multi-access**: per-staff logins + action attribution (structurally easy —
  `mission.dispatcher_id` exists) + **owner-only revenue** (needs a role/permission field + tighter RLS).
  Aligns with the already-deferred multi-dispatch (J).
- 🅥 **O17 (full)** real app **i18n** (FR/EN) framework — none today; the legal pages are bilingual by hand.

**Already covered before this session**
- **O4** area/radius zones — shipped in D17 (the St-Tropez→Lac example already works: pickup **or** drop-off
  in radius). The "stays smooth" answer: in-app filter now; add a DB bounding-box / PostGIS prefilter as the
  Pool grows (noted in D17).
- **O16/O18** settings page + mission-page redesign — the Driver design pass (BACKLOG H) is where the visual
  rework lands; this session improved structure (preview/draft/help-legal) but not the full skin.

## L. Dispatch mission-form — guidance & smart UX (founder idea dump, 2026-06-23) 🔨
> Theme: the mission page must be a **guided** experience. Most Businesses (hotel staff) don't know the VTC
> profession, so the form should teach the why/how inline and stop bad missions before they post. These are
> features/polish — buildable now (no third-party APIs). The strategic / V2 ideas from the same dump live in
> `IDEAS.md` (§ "Founder idea dump — 2026-06-23").
- ✅ **Input-driven guidance messages** — **SHIPPED S31/D36** (2 nudges): luggage count high for the body → "Consider a
  Van" (and, in a Van, "a dedicated luggage vehicle"); night pickup (≥22:00 / <06:00) → harder-to-fill nudge. Calm amber
  `.notice.warn`, only-when-relevant, never block. The **long-distance** nudge was **dropped** — it told the Business to
  price the empty return, contradicting the no-empty-return model (D37). More input-driven hints add the same way.
- 🔨 **Per-section "why/how" microcopy** — **REVISED (D36):** NOT always-on (heavier / more confusing). The full
  **guidance audit** (`project/GUIDANCE_AUDIT.md`) found the app already well-guided at point-of-use; concept teaching
  is the founder's **standalone tutorial's** job. In-app **Tier 2** = a small **"?" glossary tooltip** (Ceiling / Pool /
  SPEED WIN / Lock-in / status pills) + a **Dispatch status legend**, non-invasive.
- 🔨 **Smart "most-used" defaults** — pre-select the Dispatcher's *most frequently used* tier + body, not just
  the last one. A one-off different choice must NOT move the default; only a repeated pattern shifts it.
  (Per-dispatcher frequency from their own mission history — derivable on read, no schema change.)
- 🔨 **Saved base addresses (favourites)** — let a Business store frequent pickup/drop-off points (e.g. its own
  hotel) and pick them in one tap instead of retyping. Additive: a per-business saved-places list.
- ✅ **Multiple passenger names** — SHIPPED (Session 17 / D28): first + surname, multiple per mission, **capped
  by vehicle** (Sedan 4 / Van 7); structured `passenger_names` jsonb; rows = headcount.
- ✅ **Dress-code option** — SHIPPED (Session 19 / D30): a 4-rung ladder (Driver's choice → Smart casual →
  Business formal → Suit & tie) **inside the new "Driver & service" card**, with a **tier-keyed default that never
  lands on suit & tie**. Part of the § M Driver-section build.
- ↳ Saved places needs a small **additive** migration (founder-approved, → `docs/migrations/`); smart-defaults and
  guidance copy need none. (Multiple passengers + dress code already shipped.) All in-phase (not third-party APIs).

## M. Founder dump 2026-06-25 — bug fixes + Dispatch polish (Session 18) 🔨
> A founder testing pass produced fixes + small features. Most shipped in S18; the rest are the next chunk.
> (Detailed log: SESSION_LOG S18 · plain-language: `project/CHANGELOG.md`.)

**✅ Shipped (S18, deployed):**
- ✅ **"Review" accidentally posted the mission** — fixed (React node-reuse: the Review button was reconciled into
  the Post button mid-click); + a server **intent guard** so a stray submit writes nothing; + an **irreversible
  "This is final" warning** at the post step ("Post to the Pool" label kept).
- ✅ **Duplicate missions from double-clicking** a slow Post/Save (one trip posted 7×) — pending-state guard:
  every submit button disables + shows "Posting…/Saving…" while the action runs (`useFormStatus`).
- ✅ **Discard had no confirmation** — inline "Discard this draft? This can't be undone." step (also pending-guarded).
- ✅ **Keyboard nav** in the address autocomplete (↑/↓/Enter/Esc combobox). ✅ **Draft count badge** on the sidebar
  Drafts item (fresh via `revalidatePath`). ✅ **Calendar search matches the assigned driver's name** too.
  ✅ **Desktop width:** dense views (Schedule/Calendar/History) fill the screen (`.dx-main--wide`, mission page
  left untouched — D29).
- ✅ Cosmetic: un-squeezed the draft-card buttons; fixed a bogus "~4907 km" preview when no dropoff was picked.
- ❌ **Sidebar spacing** — founder **declined** (leave the sidebar as-is).

**✅ Shipped (S19, deployed — the "Driver & service" card, D30):**
- ✅ **A "Driver" section** on the mission form — SHIPPED: **languages** (display/preference, not a hard filter),
  **dress code** (tier-keyed, anti-suit default), **request flags** (`jsonb`: meet & greet, greeter, luggage help,
  child seat, quiet ride, pets — "card only" + PRM deliberately dropped), a **meet & greet name board** (typed name
  **or** an attached PDF/JPG/PNG, auto-filled from the first Guest), and a **private message to the Driver**
  (revealed post-accept). Migration `2026-06-25_mission_driver_section.sql` applied.
- ✅ **Message-to-the-driver half of the Reference split** — SHIPPED as the private message in the Driver card.

**🔨 Remaining (next chunk — each NEW field = a small founder-run additive migration):**
- ✅ **Reference field (the remaining half of the split)** — **SHIPPED S20:** the old "Reference / notes" field is now
  a short, **20-char Reference** (Business-only schedule tag, hidden from the Driver), backed by a dedicated
  `mission.reference` column. V2 still open: a per-business **custom reference label** (Hotel→Room, Restaurant→Table).
- ❓ **Ultra-luxury "Exception" tier** (Rolls/Bentley above First) — a taxonomy decision; bundle with the
  IDEAS vehicle-taxonomy V2 (Bus tier, First-van, cargo vehicle).

## N. O7 — Cancellation / no-show / hand-over (RULESET DECIDED 2026-07-13, [[d45]]) 🔨
> Founder settled the policy (see DECISIONS.md D45 for rationale + the legal confirmation). **Amounts stay MANUAL** in
> beta; the **rules** are fixed. All fees = penalties owed to Kavenue-the-intermediary, never a transport charge (Doc 01).
> The `cancelled`/`expired` states + `cancelled_by`/`cancelled_at` columns already exist (dormant). Mirror the amendment
> pattern (immutable record + SECURITY DEFINER atomic RPC).

**❓ WAITING-FEE RATE — research owed ([[d48]], 2026-07-22).** The €1/min-started rate is a **placeholder the founder set
to unblock the build**, not a researched number. Before real money: benchmark the French **préfecture *tarifs taxi***
orders (the hourly *tarif d'attente* is the legal reference point), what **Uber / Bolt / Blacklane / Welcome Pickups**
charge for waiting on airport transfers, and what Riviera VTC operators actually bill. Decide whether the rate should
vary by **tier** (an S-Class hour is not a Prius hour) and whether the airport rate differs from city. Feeds — and is
fed by — the founder's pricing engine. Also revisit the **caps** (60 min city / 120 min airport) once real data exists.

**🔨 PHASE 1 — the cancellation spine (buildable now, one additive migration):**
- **Driver voluntary cancel = always 100%** of the trip amount → re-pools the mission. Deliberately tough. Escape valves
  (no fee): copilote hand-over (Phase 2) or a Business-agreed release.
- **Business cancel = FREE while still pooled** (no Driver committed); once a Driver holds it: free >5h; **50% at −5h;
  +10%/h (linear, 5% / 30 min) → 100% at pickup** (−4h 60 · −3h 70 · −2h 80 · −1h 90 · 0h 100).
- **No-show** — fires when the Driver is on-site (**status `arrived`**) and the Guest doesn't appear within the wait
  window: **1h airport · 20 min city** (airport = a flight number **OR** an airport-looking pickup address). Business
  charged the full fare; Driver paid in full (like a completed mission); Kavenue keeps commission; the Business settles
  with its own Guest. **UI:** a professional "be sure before you report" confirm nudge; the report button is **amber, not
  red** (a no-show pays the Driver — not a destructive action). _(Deeper: contact-attempt gate + evidence + clock
  origin = later.)_
- **T-60 Business reclaim** (NOT a cancel) — only when the assigned Driver **hasn't confirmed the Lock-in AND is
  unreachable**, Kavenue unlocks a reclaim button (~T-60) → Business takes the trip back, re-pools as **SPEED WIN**,
  penalty-free for the Business, Driver takes a **reliability mark**. Gated to the non-confirmation state (anti-abuse).
- **Re-pool pricing** — any re-pool (driver cancel · reclaim · release) re-enters the Pool as **SPEED WIN at 70% of
  ceiling**. Needs a **`pooled_at`** climb-origin (PDP climbs from `created_at` today → would mis-price otherwise).
- **Closes the amendment dead-end** — a Driver-declined amendment today resolves nothing; O7 gives the Business the
  cancel/release path out of it.
- **Migration (additive, founder-run):** `mission.cancellation_fee`, `mission.cancelled_reason`, `mission.pooled_at`,
  no-show marker (`no_show` + `no_show_at`), a widened `status_event` CHECK **or** a `mission_cancellation` audit table,
  a Driver **reliability mark**, + `cancel_mission` / `repool_mission` RPCs (mirror `accept_mission`).
- **UI:** driver cancel + hand-over card (mirror `amendment-card.tsx`); a business cancel flow showing the live % it will
  cost; the T-60 reclaim button; the no-show flow on the driver `arrived` screen; reuse the existing **red-wash**
  (`missionTone`→danger) for the Dispatch alert. **Show D25 previews before building the UI.**

**🅥 PHASE 2 — the "copilote" community hand-over (LATER — net-new, needs the community layer):**
- A **full transfer (novation)** of a booked mission to another Driver — NOT subcontracting. Original Driver drops out
  entirely (no pay/invoice/liability), keeps only a **"passed on" trace**; the copilote **re-accepts on their own account**
  and becomes the Driver of record. **Legally confirmed** (D45) — cleaner than sous-traitance.
- Guardrails (mandatory): copilote is an **active, verified, same-category** Kavenue Driver (REVTC · carte pro · RC Pro ·
  conforming vehicle, checked live); own account (no account-sharing); zero money through the original Driver; **Business
  consents by default** via terms + explained in the **tutorial**; GDPR-minimised data transfer; audit trail
  (accepting-Driver vs performing-Driver).
- **Data-model NOW (in Phase 1):** distinct *accepting-Driver* vs *performing-Driver* fields so Phase 2 slots in.
- Precedent to study: Drivalty · iaDriver · **WAY-Partner** (credential-gated) · VTC cooperatives.

**🔨 MUTUAL-CONSENT RELEASE ("agreed cancellation") — Phase 2 (build right after the spine, or bundle here):** a free,
no-fee cancellation BOTH sides confirm (Business taps a dedicated "agreed release" button → Driver gets a notification
and must ACCEPT → releases free, re-pools as SPEED WIN). Scam protection: a Business can't dodge the fee by cancelling on
a committed Driver without consent. MODERATE build — reuses the amendment pattern (proposal + accept/decline + atomic
RPC, like `respond_to_amendment`). See [[d45]] + IDEAS.md.

**🔨 SPEED WIN reachability gate (DECIDED, build later — [[d45]]):** a SPEED WIN may only be accepted by a Driver who can
  **physically reach the pickup on time** — geolocate the Driver, compute the GPS ETA to pickup (Mapbox Directions), and
  **block acceptance with a popup** if they'd be late. Needs Driver geolocation (browser API / live location) + a
  point-in-time ETA call; also the clean way to replace the crude ±90-min `accept_mission` slot buffer. (Distinct from the
  CUT continuous live-map GPS — this is a one-shot check at accept.)

**⏸️ Disputes / mediation (deferred, documented):** the "Business disputes a hand-back / no-show / cancellation" path — no
  state today; V1 stays email + Kavenue mediates on the timestamped trail. Revisit deeper later.

---

## O. Trust & safety — incidents, investigation, and blocking a Driver (founder, 2026-07-30) 🔨❓

**Why this exists.** The founder's scenario: *a Business reports a Driver's behaviour towards a woman.* Today there is
**no** answer — the only lever is setting `driver.verified = false` by hand in the Supabase dashboard: no reason, no
timestamp, no notice to the Driver, no distinction between "papers lapsed" and "removed after a safety report". And
`blocksWork()` isn't wired into the Pool, so it isn't even certain that flag stops them being offered work.

**The boundary (positioning — hard rule #2).** Kavenue **investigates to make a platform decision, not to reach a legal
verdict.** Deciding who keeps access to the marketplace is entirely ours — we admitted them, we hold their papers, we are
the donneur d'ordre. Determining criminal guilt is not. If a report describes a crime, the two run in parallel: ours ends
at *"does this Driver stay"*, the police's at *"what happened in law"*. We preserve evidence and cooperate; we do not
take statements for a prosecution.

**Roles.** **Support receives** — takes the details, escalates immediately, promises nothing, adjudicates nothing, and
**never names the reporter**. **The team investigates** — Guest, Business and Driver, to understand what happened.
**Admin decides and clicks.** In beta all three are the founder.

### O.1 A two-stage model 🔨
1. **Precautionary hold** — immediate, needs no investigation, fully reversible. Stops the Driver being offered or
   accepting work now.
2. **Decision** — after the investigation: reinstate · warning · permanent block.

**Why suspend first:** the two errors are not symmetrical. A wrongly-held Driver loses income you can pay back. The other
error has no ceiling. Decide this *before* it happens — in the moment there will be an angry hotel on the phone.

### O.2 Schema — append-only, mirroring the O7 idiom 🔨
Three tables, all **deny-by-default RLS**, all writes through SECURITY DEFINER RPCs (the `mission_cancellation` /
`mission_release` pattern — tamper-proof, and they are the evidence if this ever goes further):

- **`driver_suspension`** (append-only) — `driver_id` · `kind` (`precautionary` | `permanent`) · `reason_internal` ·
  `notice_to_driver` · `opened_by` · `opened_at` · `lifted_at` · `lifted_by` · `lift_reason` · `incident_id`.
  A lift is a new column on the row, never a delete — re-suspension writes a new row, so the history reads in order.
- **`incident`** — `mission_id` (**nullable** — a report may not be tied to one trip) · `category`
  (`conduct` | `safety` | `vehicle` | `other`) · `severity` · `reported_by_type` / `reported_by_id` ·
  `subject_driver_id` · `subject_business_id` · `summary` · `status` (`open` | `investigating` | `decided` | `closed`) ·
  `decision` · `decided_by` · `decided_at`.
- **`incident_note`** (append-only) — `incident_id` · `party_spoken_to` (`guest` | `business` | `driver` | `other`) ·
  `body` · `author` · `created_at`. **This is the investigation trail** the founder described.

**⚠️ One shared SQL helper `driver_is_blocked(driver_id)`**, called by **both** the Pool query **and**
`accept_mission`. Do **not** denormalise a boolean onto `driver` — two sources of truth drift, and this one decides
whether a suspended Driver can take a Guest. Same reasoning as the shared `mission_waiting()` / `pdp.ts`.

**RLS is the sensitive part.** `incident` and `incident_note` hold **third-party allegations about a named person**.
No Driver read, no Business read, ever — not even "their own". The Driver sees exactly one field,
`driver_suspension.notice_to_driver`, served through a narrow read.

### O.3 What the Driver sees 🔨
A blocking screen where the Pool would be:
- **"Your account is on hold"** + the `notice_to_driver` text (written by admin, plain words, no jargon).
- What happens next, and **a way to respond** — otherwise it is a black box, which is both unfair and guarantees an
  angry email to `support@` anyway.
- **It must never reveal who reported, or any detail that identifies them.** Non-negotiable — in a conduct case that
  is itself a safety risk.
- Visual: the calm `.pempty` block idiom ([[d54]]), **not** an alarming red screen. This is a person's income.

### O.4 ✅ DECIDED (founder, 2026-07-30) — we block ACCOUNTS, not trips
*"I don't want to block a trip in progress but just a driver or a business account — we do not take care of trips apart
from having a sight on it."*

**The block is an account-level switch: no new work.** `driver_is_blocked()` gates the Pool query and
`accept_mission`. That is the whole mechanism. Kavenue does **not** reach into work two professionals already agreed —
consistent with hard rule #2.

- **A trip in progress:** untouched, it completes.
- **Upcoming accepted trips:** untouched **by Kavenue**. Instead, **tell the Business the assigned Driver's account is
  on hold** — the *fact*, never the reason — so they can use the tools they already have (**agreed release** [[d46]], or
  their own cancel). We surface the situation; the Business decides. That is giving them the tool rather than making the
  decision, which is the same line as *"we don't chase a Driver for them"*.
- **⚑ Accepted residual risk, recorded on purpose:** a Driver on hold can still perform tomorrow's trip if the Business
  does nothing. Known, accepted, defensible — not an oversight. Revisit only if it actually bites.
- **⚠️ The two stages differ here.** A **precautionary hold** leaves trips alone. A **permanent block** ends the
  relationship, so there is no Driver left to perform an accepted trip — those **must** be released and re-pooled (the
  O7 path, 24h SPEED-WIN window, supersede any pending amendment/release). Still open for that case only: is the release
  **free** for the Driver (*recommend yes* — they did not cancel), and who covers a higher re-pool price?

### O.5 Due process (this protects Kavenue as much as the Driver) 🔨
- Before a **permanent** block: the Driver is told there is an issue and given a chance to respond. A **precautionary
  hold does not wait** — that is the point of having two stages.
- Every decision records **who** and **when**. Append-only, nothing editable.
- A reinstatement path with its own reason, so a lift six months later can be explained.
- **⚠️ Real constraint:** the Guest is the person it happened to, and **Kavenue has no relationship with the Guest at
  all** — the report arrives third-hand via the Business, with no way to ask her anything. Another argument for the
  Guest touchpoint parked in IDEAS.md.

### O.6 Wire `blocksWork()` at the same time 🔨
`blocksWork()` already exists in `lib/account.ts` and **nothing calls it**. Suspension and document-readiness are the
same question — *may this Driver work right now?* Build **one** gate with two inputs (blocked, or a
missing/expired/rejected required document) rather than two mechanisms that disagree. Note the deliberate S48 decision:
readiness is shown, never enforced, until real Drivers onboard — flipping it is a founder call.

### O.7 ❓ For the lawyer — flag, don't gate ([[legal-not-mvp-blocker]])
Worth knowing the answer *before* it happens, not as a build gate: what Kavenue is **obliged** to do on receiving a
report of this kind, what it is obliged to **retain**, and whether a blocked Driver has a right of appeal or to know the
substance of an allegation. The model above is deliberately conservative — record everything, tell the Driver something,
always allow a lift.

### O.8 Also missing, same area 🔨
- **Businesses have no `verified` flag at all** (`driver.verified` exists; the business side has `siret` / `vat_number` /
  `legal_name` and can file a Kbis, but nowhere to record approval). A Business that behaves badly has even less of a
  lever than a Driver.
- **Nothing records a warning** short of a block — the middle outcome of an investigation currently has no home.

---

## P. Expired / unfilled trips — ✅ SHIPPED 2026-07-31 (S51, [[d62]]; migration `2026-07-31_expired_missions` applied; deployed `d7e06d4`)

**Founder's answers to the five questions below:** (1) expires **exactly at `pickup_at`**, no grace · (2) **stays on the
Dispatch schedule until the day ends**, then folds into "Earlier trips" (no query change needed) · (3) labelled with the
existing "Expired · Was not filled in time" · (4) **no re-post for now** — and note it could never have been a re-time,
since the [[d48]] trigger freezes `pickup_at`, so it would have to duplicate into a new mission · (5) **counts nowhere
yet** — fill rate still needs the § F2 back-office, which is the one piece of § P left open.

**Shipped:** a time check inside `accept_mission` (under the existing row lock), a `pickup_at` floor on the Pool query
(applied even under the dev `?all=1` bypass), `expire_stale_missions()` sweeping `pooled → expired` + writing the
`status_event` in one statement, called on the Pool/Schedule reads — **no cron** (Hobby caps at once per day; the
scheduler decision belongs to the notifications phase with [[d61]]'s T-180 reminder). `missionTone` also derives the
state for `pooled` + past-due so the calendar/history can't lag. Verified live 6/6 incl. a genuine UI accept race.

<details><summary>Original § P brief (kept for the record)</summary>

**Found by the founder in the live Pool:** *"trips on the pool exist even though the trips are outdated by weeks!"*

**Measured 2026-07-31:** **23 of 23 pooled missions have a pickup time in the past.** Oldest is **44 days** ago. The
Pool is, right now, entirely stale. **Zero** missions have ever been marked `expired`.

**Why.** The `expired` status exists in the enum, and `missionTone` already renders it ("Expired · Was not filled in
time"). **Nothing ever writes it** — there is no job, no trigger, no server-side sweep. The Pool query is simply
`status = 'pooled'` with no lower bound on `pickup_at` ([`app/(app)/pool/page.tsx:82`]). So an unfilled trip stays in
the Pool for ever.

**⚑ The sharp edge:** `accept_mission` checks `status = 'pooled'` and **does not check the time**. A Driver can accept
a trip whose pickup was six weeks ago — creating a live, confirmed, priced obligation out of a dead booking. That is a
money-and-trust bug, not just clutter.

### ❓ Founder decisions needed before building
1. **When does a trip expire?** At `pickup_at`? A grace period after (15 min? an hour)? The PDP climb ends at the
   ceiling long before pickup, so a trip sitting unfilled at T-0 is already a failure.
2. **Where does it go?** Out of the Pool, clearly — but does it land in the **Dispatch History** as a closed record,
   stay on the schedule, or get its own "didn't happen" list?
3. **How is it labelled to the Business?** `missionTone` already has the copy ("Expired · Was not filled in time"), so
   this may be free.
4. **Is the Business told, and can they re-post it?** A one-tap "post it again" is cheap and probably what a hotel
   wants when the trip is tomorrow rather than yesterday.
5. **Does it count anywhere?** An unfilled trip is the single most important marketplace-health number (fill rate) —
   see the metrics note in the § F2 back-office.

### How it would be built (no third-party anything)
- **The guard is the urgent half and needs no scheduler:** add a `pickup_at` floor to the Pool query *and* a time check
  inside `accept_mission`. That alone stops a Driver accepting a dead trip, today.
- **The sweep** (actually flipping `pooled → expired`) wants something that runs on a timer. Options: Vercel Cron
  (⚠️ **Hobby plan caps cron at once per day** — confirm the plan), or a lazy sweep on read, or a Postgres trigger.
  Deciding this overlaps with the T-180 reminder job (D61), which needs the same scheduler — **build the scheduler once.**
- ⚠️ Whatever writes `expired` must respect the **`pickup_at` freeze trigger** (D48) and must not disturb the O7
  cancellation/release paths.

**Note for the founder:** the 23 stale rows are demo data, so this reads worse in the beta DB than it would in
production — but the missing guard is real either way.

</details>

---

## Q. Abandoned trips — a Driver took it and never closed it ❓🔨 (found 2026-07-31 closing § P, [[d63]])

**⚠️ NEEDS A FOUNDER RULING BEFORE ANY CODE. It is a money question, not a cleanup question.**

**Measured 2026-07-31:** **8 missions have a pickup in the past and no ending** — 7 `confirmed`, 1 `on_board` (that one
for **36 days**). A Driver accepted each of them and never advanced it to `completed`. Nothing expires them, nothing
settles them, and they fall into no History bucket — which is exactly why the § P filter chips deliberately don't sum
to All (3 + 18 + 0 ≠ 28).

**Why this is worse than the unfilled case § P just closed.** An unfilled trip owes nobody anything — no Driver ever
held it. Each of these has **a fare, an assigned Driver, and the whole O7 fee machinery** ([[d45]], [[d48]]) still
treating it as live. As far as the system is concerned that `on_board` trip is *still driving*.

### ❓ The questions
1. **The same status means two opposite things.** A past `confirmed` trip might be one the Driver **drove and forgot to
   tap Complete on** (a data-entry failure — they should be paid) or one they **never turned up for** (a Driver no-show
   — the Business should not be charged, and it is a reliability event). The status cannot tell them apart, so **the
   rule probably can't be time alone.**
2. **Does anything auto-close?** And at what distance — 24h past pickup? A week? Or does it wait for a human (the § F2
   back-office) precisely because money hangs on it?
3. **Who pays?** Driver paid / Business charged / neither / held pending review.
4. **Does it mark the Driver?** `driver.reliability_marks` exists and is written silently on a driver cancel; the
   founder has already parked whether a Driver sees their own.
5. **`on_board` specifically** — the trip demonstrably started. Does that alone justify paying it out?

### Signals we already have (and their limits)
- **Check-in ([[d61]])** is the only "will you be there" signal, and it is **shown, never enforced**.
- **`status_event`** timestamps every advance, so "how far did this trip actually get" is answerable per trip.
- ⚠️ There is **no push**, so "the Driver didn't respond" cannot yet be distinguished from "the Driver wasn't asked" —
  the same blocker that keeps the T-60 take-back parked ([[d61]]).

### If/when it is built
Mirrors § P's shape: a sweep with a guard. But **§ P's sweep could be lazy and unattended precisely because expiring an
unfilled trip moves no money.** This one does, so it likely wants the real scheduler *and* a human review step — i.e.
it lands with the back-office (§ F2) or the notifications phase, not before.

### ✅ DESIGNED + PARKED 2026-07-31 (founder conversation, S52). Do not re-derive.
**Founder's ruling: leave it for now.** In beta the founder is the only one creating trips, so all 8 are test artifacts;
and the good version needs push, so building now means shipping the weak version twice. **The design below is settled —
pick it up in the notifications phase (menu option B) or with the back-office (§ F2).**

**The insight that resolved Q1 — there are two different holes, and only one is open.**
Every escape valve already built (copilote, agreed release, T-60, Business cancel) answers *"this trip is not going to
happen."* Someone is unhappy, so someone acts. **That case is covered.** The open hole is the opposite: *the trip DID
happen and nobody tapped the last button* — Driver drops the Guest, hotel is delighted, Driver drives off and never
reopens the app. **Nobody is unhappy, so nobody chases it.** The service was fine; only the record is wrong, and the
record is what pays the Driver and bills the Business. That is the case that survives real users, because it has no
complainer.

**So the answer is not a rule that guesses — it is a question.** Time alone cannot separate "drove and forgot" from
"never turned up" (Q1), and no threshold ever will. Ask the only party who knows.

1. **Trigger** — a trip still open a few hours after it should have ended (`pickup_at` + trip duration + buffer;
   founder's instinct **~3h after the expected end**, so a delayed flight is not nagged). Nothing auto-changes; the trip
   just becomes *askable*. **This answers Q2: nothing auto-closes.**
2. **Driver side** — a **pinned card, NOT a modal popup** (founder agreed: a popup trains people to tap ✕ without
   reading). Top of My Rides + a tab badge — the same pattern as the [[d61]] check-in badge. Stays until answered, never
   blocks the Pool. Three answers: **Yes, I drove it** → closes the trip dated at its real time, lands in Earnings/Past ·
   **No, the Guest never showed** → the existing no-show path · **Something else** → human review.
   ⚑ **No new abuse surface**: a Driver can already tap "Complete ride" without driving. Same exposure as today.
3. **Business side, meanwhile** — instead of a frozen "On board" from 36 days ago, an honest amber
   *"Waiting on the Driver to close this"* + a **Nudge the Driver** button. ⚑ **Nudge, never close** — a Business that can
   mark a trip complete is a Business declaring a Driver's work done, and that is money (**Q3**).
4. **The shelf life (founder's own question: "what if the Driver comes back a month later?")** — a month later *he does
   not remember either*, so the question expires. **~48h**, then it stops being his and **flips to the Business**, who
   knew that same day whether their Guest reached the airport. Two independent parties, one tap each, and they will
   almost always agree. Neither answers → back-office queue, unresolved, founder closes by hand (which is what happens
   today, minus anything telling them it is there). **The deadline must be short — days, not weeks; the value of the
   answer decays fast.**

**Why this needs push (and therefore waits).** The card only fires when the Driver opens the app. A notification is what
makes a 48h shelf life realistic instead of optimistic. Same blocker as the T-60 take-back.

**Geolocation auto-close — founder's idea, correct instinct, blocked today.** Kavenue is a PWA: a browser only gets
location **while the app is open on screen**, so there is no background "he arrived at the airport" detection without a
native app. V2 at the earliest. And even then, one hard rule: **location may suggest, never decide** — location closing a
trip is location *paying* someone. Failure case: the Driver returns to Nice airport at 11am for his *next* job and the
app closes and pays out yesterday's trip. The right shape is *"Looks like you finished — tap to complete."*

**Still open when it is built:**
- **Q4 (reliability mark)** — untouched, still gated on the founder's parked "does a Driver see their own?" decision.
- **Q5 (`on_board` specifically)** — moot under this design: `on_board` is asked the same question as `confirmed`.
- ⚑ **The "No, the Guest never showed" branch needs its own route.** The [[d47]]/[[d48]] no-show rules assume the Driver
  is standing at the pickup with a courtesy-wait clock running; reporting one three days later does not fit that shape
  and will not pass those guards.

---

## R. Dispatch History — ✅ SHIPPED 2026-07-31 (S52, [[d68]]; NO migration; deployed `0acdb68`)

Phase 1 shipped 2026-07-31 ([[d63]]): outcome filter chips (All / Completed / Unfilled / Cancelled) with counts, a
one-line summary, per-month failure counts, two empty states.

**Phase 2 — the rest of the way — is DONE.** Founder: *"it is a professional tool, and they need accurate infos and easy
to find a specific trip or mission by drivers name, or passenger or internal reference, or car… it need to be perfect
and complete."* Everything in the candidate list below shipped except the two items explicitly deferred at the end.
Full reasoning: [[d68]]. Files: `lib/history-filter.ts` (new — the one place a past trip is filtered/searched/sorted),
`components/history-filters.tsx` (new toolbar), `components/date-cal.tsx` (the Earnings calendar, extracted),
`app/(dispatch)/dispatch/history/{page.tsx,export/route.ts}`, `components/trip-row.tsx`, `lib/format.ts`, `globals.css`.

- ✅ **Search** — ONE box over Guest · Driver · reference · address · flight · car; every term must hit somewhere;
  **accent-folded** ("aeroport" finds "Aéroport"); the hit is painted in the row; and when it lands somewhere with no
  column (a plate, a make) the row prints `Car · Mercedes · Classe E · AB-123-CD` so the result never looks arbitrary.
- ✅ **Date range** — the Earnings calendar, extracted to `components/date-cal.tsx` and adopted unchanged. Presets:
  last 7 / last 30 / this month / all time.
- ✅ **Sort** — newest / oldest / highest fare / lowest fare, from the toolbar or by clicking the Date / Fare headers.
- ✅ **Export CSV** — the page and the export run the SAME `applyHistoryQuery`, so it is exactly what's on screen.
  `;` delimiter + French decimals + BOM (Excel FR), formula-injection escaped.
- ✅ **Per-Driver view** — a Driver dropdown listing everyone who has driven for this Business.
- ✅ **Deep links** — `?open=<id>` matches the Schedule; every filter is in the URL, so a filtered archive is a link.
- ✅ **Two gaps found and closed:** rows showed only a **time** inside month bands (3 July vs 19 July were
  indistinguishable), and there was **no fare column at all**.
- ✅ **Accuracy:** a past trip a Driver never closed (§ Q) shows its agreed fare greyed as **"Not settled"** and is
  **excluded from every total** — row, month band and summary. It has its own CSV column.
- ⏳ **Deferred, deliberately:** the compact/comfortable **density toggle** (the row is already dense — nobody asked)
  and **pagination/virtualisation** (fine at 28 trips, the first thing to break at 5 000 — see the note below).

<details><summary>The original candidate list (kept for reference)</summary>

**Candidates (needs a founder pass to prioritise — this list is deliberately longer than one session):**
- **Search** — by Guest name, reference, address, Driver. The Calendar already has a search that matches the assigned
  Driver's name (S18); reuse that vocabulary rather than inventing a second one.
- **A date range** — "everything between these two dates", the same ask as the Driver's Earnings (§ B of the current
  worklist). **Build the range control once and share it** across History and both Earnings screens.
- **Sort** — newest/oldest, and by fare.
- **Export** (CSV) — a hotel's accountant is the real user here; pairs with the § S spend view. ⚠️ Agent framing in any
  document the Business hands on: Kavenue is not the seller of the transport.
- **Per-Driver view** — "show me every trip Marc did for us".
- **Columns/density** — the dense grid is fixed today; consider a compact/comfortable toggle.
- **Deep links** — `/dispatch/history?open=<id>` to match the Schedule's existing `?open=`/`?day=` (S33).
- **Pagination / virtualisation** — not needed at 34 missions; the whole archive is loaded in one query today, and
  that is the first thing to break at real volume. Note it before a hotel has 5 000 trips.

</details>

**⚑ STILL OPEN — the volume ceiling.** The page loads the Business's whole archive in one query and filters in memory.
That is correct at 28 trips and deliberate (it is what lets the chip counts, the Driver dropdown and the class list all
be honest about the *whole* archive). It is also the first thing that breaks at real volume. When a hotel has thousands
of trips, the filters move into the SQL (`ilike`/`websearch_to_tsquery` on a generated search column) and the page
paginates — and at that point the chip counts need their own aggregate query. Not before.

---

## S. Dispatch EARNINGS / spend — "a real one, complete and pro" 🔨 (founder, 2026-07-31)

The Business-side money view. Supersedes the short note in § F.

**⚑ The one place it deliberately DIVERGES from the Driver's Earnings ([[d59]]): the founder wants CHARTS here.** The
Driver's screen has none — an explicit founder call ("no charts"), because a Driver wants to know what they made, on a
phone. A hotel's back-office is a different user on a bigger screen doing analysis, so "pro graphic", comparison tools
and desktop-class controls are the ask. **Do not treat the two screens as needing to match.**

**Already solved, reuse it:** `settledFare()` freezes the fare at `accepted_at` ([[d59]]), so the maths is correct and
already proven on both sides. The period-filter concept (Day/Week/Month/Year + step + jump) exists in
`components/earnings-period.tsx` — but see § B of the current worklist, **its picker is broken and is being fixed
first**; the fixed control is what this screen should adopt.

**Scope to design (D25 preview loop applies — this is a big UI job, mock it before building):**
- **Total spend** for the period + what it's made of (trip fares · waiting charges · cancellation fees · no-shows).
- **Comparison tools** — previous period, and same-period-last-year once there is a year of data (the Driver's screen
  turns that line on by itself once it's non-zero; do the same, don't render a zero).
- **Charts** — spend over time, and probably a breakdown by category. Research the best-in-class first (the founder's
  ask): hotel/travel back-offices, Stripe, Qonto, Pennylane, Booking's partner dashboards.
- **Breakdowns worth having:** by month, by vehicle class, by route/zone, by Driver, by Dispatcher (who booked it), and
  **fill rate** — the § P number that currently has no home.
- **Export** for the accountant (shares with § R).
- ⚠️ **Agent/intermediary framing throughout** (Doc 01): Kavenue takes a service fee, it does not sell the transport.
  Watch the copy on anything that looks like an invoice.
- ⚠️ **Amounts settle MANUAL in beta.** Every figure is what the model says is owed, not what has been paid — the
  screen must not imply a payment ran.

---

## T. Earnings feels laggy — MEASURED 2026-07-31, it's cold starts 🔨

**Founder, testing [[d66]]:** *"there is some lag but maybe because is the test version."* It was **not** a test build
— `driver.kavenue.fr` serves production. So the lag is real. Measured rather than guessed:

| What | Time |
|---|---|
| production `/earnings`, first request | **1.97 s** |
| same page, warm | **0.34–0.38 s** |
| all 7 Supabase queries, in parallel | 213–490 ms |
| one `loadPeriod` (2 queries) | 146 ms |
| `loadFirstDay` | 102 ms |

**⚑ The cause is a serverless COLD START, not the query count.** The queries run in `Promise.all`, so seven of them
cost roughly one query's latency. The first tap after an idle period pays ~2 s; every tap after is ~350 ms. Cold start
is inherent to the Vercel Hobby plan — not fixable in code.

### ❌ DON'T trim the queries — the measurement above already rules it out
An earlier draft of this section proposed skipping the always-empty year-ago query and caching `loadFirstDay`. **Both
are near-worthless and the table above says why:** seven queries in parallel cost 213–490 ms while ONE `loadPeriod`
costs 146 ms. They are concurrent, not queued, so removing two of seven saves roughly nothing — and gating the year-ago
query on `firstDay` would mean *sequencing* a round trip, plausibly making it slower. Recorded as a rejected option so
nobody re-derives it. (`force-dynamic` is likewise correct here; caching an archive is a different, later question.)

### ✅ The fix worth making — the wait should be honest, not shorter
`startTransition` already keeps the old UI up and `.eper.is-busy` dims the period row, but **the money total sits there
looking final while it is stale.** 350 ms of a visibly-loading number reads as deliberate; 350 ms of a confidently wrong
number reads as lag — which is exactly what the founder reported.

Shape: move the four loads out of `EarningsPage` into an async child, and render it inside
`<Suspense key={period+anchor+from+to} fallback={<skeleton/>}>` so the boundary re-suspends on every period change. The
skeleton wants to mirror `.etotal`/`.etotal__sub`/`.ecmp`, and `pool/loading.tsx` ([[d54]]) is the house precedent for
what a Kavenue skeleton looks like. Contained to one file, but a real restructure — **not an end-of-session job.**

### The bigger perceived win — make the wait honest, not shorter
`startTransition` already keeps the old UI up, and `.eper.is-busy` dims the period row — but **the money total sits
there looking final while it is stale**. 350 ms of a visibly-loading number reads as deliberate; 350 ms of a confidently
wrong number reads as lag. This is probably worth more than any query trimming.

**Applies to § S too** — the Dispatch spend view will have the same shape and should be built with this known.
