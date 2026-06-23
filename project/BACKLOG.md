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
- 🔨 **Cancel mission** — driver cancel re-pools; business cancel terminal.
  👤 penalty/compensation amounts.
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

## I. Small follow-ups noted in code
- Promote the per-booking **reference** (room/event) to a dedicated DB column.
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
- 🔨 **O7** driver **cancellation** flow: `cancel_mission` RPC (re-pool), auto-flip to SPEED WIN on re-pool,
  big red Dispatch card (red-wash already exists), driver reliability/"mark" field, cancellation **fee** data.
  (Fee/penalty *amounts* are a founder decision — MANUAL in beta per spec.)

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
- 🔨 **Input-driven guidance messages** — small contextual hints triggered by what the Dispatcher enters, e.g.
  luggage count high → "Consider a Van"; nudges on long-distance / late-night. Calm, non-blocking (same style
  as the existing too-low-fare warning).
- 🔨 **Per-section "why/how" microcopy** — a short helper line on each mission-form section so a non-expert
  Dispatcher knows what good input looks like (the "very guided page" the founder keeps asking for).
- 🔨 **Smart "most-used" defaults** — pre-select the Dispatcher's *most frequently used* tier + body, not just
  the last one. A one-off different choice must NOT move the default; only a repeated pattern shifts it.
  (Per-dispatcher frequency from their own mission history — derivable on read, no schema change.)
- 🔨 **Saved base addresses (favourites)** — let a Business store frequent pickup/drop-off points (e.g. its own
  hotel) and pick them in one tap instead of retyping. Additive: a per-business saved-places list.
- 🔨 **Multiple passenger names** — allow more than one Guest name + surname on a mission. (Additive field.)
- 🔨 **Dress-code option** — specify driver attire with a few presets keyed to tier (e.g. First → suit/tie;
  Business → smart; Eco → neat). Founder defines the option set. (Additive field.)
- ↳ Saved places / multiple passengers / dress code each need a small **additive** migration (founder-approved,
  → `docs/migrations/`); smart-defaults and guidance copy need none. All in-phase (not third-party APIs).
