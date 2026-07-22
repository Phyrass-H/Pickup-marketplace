# PickUp — Backlog (what's built, what's next)

> Single planning list for upcoming sessions. Tags map to the spec (Doc 02):
> ✅ done · 🔨 KEEP (build for V1) · 👤 MANUAL (a human does it in beta) ·
> ⚙️ infra/ops · 🅥 V2 (CUT in the spec — don't build unless re-prioritised) ·
> ❓ needs a founder/legal decision.
>
> Most KEEP items need NO schema change — the tables already exist in
> `docs/pickup_schema.sql` (document, payment, ledger_transaction, payout,
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
- ⚙️ **PickUp internal / investor metrics**: signups, missions posted vs accepted
  vs completed, **fill rate**, time-to-accept, GMV, commission earned, liquidity
  by zone/category, cancellation rate. (Admin dashboard; great for the raise.)
- ⚙️ **Dev observability**: error monitoring (e.g. Sentry), structured logs, uptime.
- 🔨/⚙️ **Admin role + dashboard** (`admin` role exists in schema): verify drivers,
  oversee missions, run payouts.

## F2. Internal tooling & observability stack  ⚙️/🔨 (PickUp back-office — future pillar)
> Founder request (2026-06-17): the PickUp-internal layer for **dev / marketing /
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
  is the dedicated interface PickUp staff use to **manually validate every new user in beta** (👤).
  Pairs with the 👤 verify + video-interview items in section A. Needs an admin **write** path
  (service role) — browser RLS is read-only for admins today. The upload side already exists
  (Session 7: documents land in the `documents` bucket as `pending`); this is the review/confirm side.
- 📊 Doubles as **investor metrics** (fill rate, time-to-accept, GMV, commission) — see the
  ⚙️ "PickUp internal / investor metrics" line in F.
- ⚠️ **GDPR dependency**: analytics + session replay capture PII → require PII masking,
  cookie consent, and listing Sentry/PostHog as processors in the privacy policy. Do together
  with **G › GDPR**. Don't enable for real users before that.

## G. Trust, legal, compliance
- 🔨 **GDPR**: privacy policy, consent capture, data-deletion path.
- 🔨 PII/financial **encryption** (use providers' built-in).
- 👤 DGITM declaration · PickUp RC Pro insurance · verify each driver is registered VTC.

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
  installs as its own app (PickUp Driver / PickUp Dispatch).
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
  - 💶 **Fee BASIS: `currentFare` never freezes at `accepted_at`** → the recorded cancellation fee basis climbs to the
    ceiling instead of the fare the Driver agreed at accept (e.g. a SPEED WIN accepted at €78 records €100). Pre-existing
    pricing behaviour; a clean fix caps the climb at `accepted_at` in `lib/pdp.ts` — but it changes fare *display*
    app-wide, so it's a **pricing-engine decision for the founder**. MANUAL settlement backstops it for now.
  - 🔒 **`p_fare_snapshot` is client-supplied / forgeable** → recompute the fare inside the RPC from the mission's pdp
    columns (or clamp) when the pricing engine lands. Beta-mitigated (MANUAL money, no payments).
  - 👁 **Mid-run Business cancel visibility** → `MINE_STATUSES` excludes 'cancelled', so a trip cancelled while the Driver
    is en_route/arrived silently vanishes from My Rides. Surface a "trip was pulled" state — pairs with notifications.
- **No-show clock flags (2026-07-19, from the D47 fix — deferred by the founder):**
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
> beta; the **rules** are fixed. All fees = penalties owed to PickUp-the-intermediary, never a transport charge (Doc 01).
> The `cancelled`/`expired` states + `cancelled_by`/`cancelled_at` columns already exist (dormant). Mirror the amendment
> pattern (immutable record + SECURITY DEFINER atomic RPC).

**🔨 PHASE 1 — the cancellation spine (buildable now, one additive migration):**
- **Driver voluntary cancel = always 100%** of the trip amount → re-pools the mission. Deliberately tough. Escape valves
  (no fee): copilote hand-over (Phase 2) or a Business-agreed release.
- **Business cancel = FREE while still pooled** (no Driver committed); once a Driver holds it: free >5h; **50% at −5h;
  +10%/h (linear, 5% / 30 min) → 100% at pickup** (−4h 60 · −3h 70 · −2h 80 · −1h 90 · 0h 100).
- **No-show** — fires when the Driver is on-site (**status `arrived`**) and the Guest doesn't appear within the wait
  window: **1h airport · 20 min city** (airport = a flight number **OR** an airport-looking pickup address). Business
  charged the full fare; Driver paid in full (like a completed mission); PickUp keeps commission; the Business settles
  with its own Guest. **UI:** a professional "be sure before you report" confirm nudge; the report button is **amber, not
  red** (a no-show pays the Driver — not a destructive action). _(Deeper: contact-attempt gate + evidence + clock
  origin = later.)_
- **T-60 Business reclaim** (NOT a cancel) — only when the assigned Driver **hasn't confirmed the Lock-in AND is
  unreachable**, PickUp unlocks a reclaim button (~T-60) → Business takes the trip back, re-pools as **SPEED WIN**,
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
- Guardrails (mandatory): copilote is an **active, verified, same-category** PickUp Driver (REVTC · carte pro · RC Pro ·
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
  state today; V1 stays email + PickUp mediates on the timestamped trail. Revisit deeper later.
