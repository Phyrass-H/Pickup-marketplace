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
- 🔨 **Maps/geocoding** (Google/Mapbox): address autocomplete, distance →
  recommended base fare, intermediate stops, ETA. (Addresses are free text now.)
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
- 🔨 **Custom domain** (e.g. app.pickup…) on Vercel.
  - ↳ **When the final domain lands:** create a URL-restricted Mapbox token (Mapbox's
    Default public token can't be restricted; no wildcards) scoped to the domain +
    `localhost:3000`, then swap `NEXT_PUBLIC_MAPBOX_TOKEN` in Vercel + `.env.local` and
    redeploy. Until then the unrestricted default token is in use (fine for closed beta).
    See SESSION_LOG S8 / DECISIONS D17.
- 🔨 **PWA polish**: icons, install prompt, offline shell.
- 🔨 **Design/skin** pass over both apps (founder will provide a design).
- 🅥 Security audit / pen test (plan post-V1).

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
