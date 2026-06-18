# PickUp — Session Log

> Append-only, newest at top. One entry per working session. Keep it short:
> what changed, what was decided, what's next.

---

## 2026-06-18 — Session 10 — Dispatch redesign (Claude Design handoff, pass 2)
**Branch:** `main` (committed + deployed) · **Env:** local (macOS) → Vercel.

**Why:** the founder designed in **Claude Design** and exported a handoff bundle
(`PickUp Design System-handoff.zip`). The Claude Design connector (`DesignSync`) is blocked in
this session (CLAUDE_CODE_OAUTH_TOKEN can't get design scopes; `/login` unavailable — confirms
D19), so the **zip → unzip → implement** path was used. Bundle kept locally at `.design-handoff/`
(gitignored, reference for the Driver phase). Scope confirmed up front: **adopt Geist + Lucide**,
**flight column = number + ETA (no live status)**, **full calendar upgrade**.

**What shipped (Dispatch / Business only):**
- **Foundation** — full design-token set in `app/globals.css` (slate + action-blue, the five
  status tones, spacing/radii/shadows/focus-ring); **Geist + Geist Mono** via `next/font` (`geist`
  pkg, self-hosted, GDPR-safe); **lucide-react**. Buttons/inputs/cards gained focus rings + press states.
- **Sidebar shell** (`components/dispatch-shell.tsx`) — collapsible sidebar (66px icon rail, persisted
  to `localStorage`) + sticky topbar title, replacing the top tabs. Deleted `dispatch-header.tsx` +
  `dispatch-tabs.tsx`.
- **Schedule** (`trip-row.tsx` + `page.tsx`/`history`) — 6-col grid with a **Flight** column (number +
  ETA), tone left-edge + status pills, **T-180 red row-wash** for unconfirmed-near-pickup.
- **Calendar** (`components/dispatch-calendar.tsx` + server `calendar/page.tsx`) — month **+ week**
  views, **KPI filter chips**, guest search, status/vehicle filters, **day peek drawer**, cross-month
  week navigation (`?week=first|last`), and **＋/empty-day → New mission prefilled with that date**.
- **Glossary fix:** schedule/history header is **"Guest / ref"** (never "client").
- **Dev-only:** `/api/seed` now also creates the dispatcher `profile` row (no schema change) so
  `dev-login` lands in a populated Dispatch — made verification possible + eases future local testing.

**Verified** — `tsc` + `next build` clean (13 routes). Browser-tested against the real Supabase DB
(seeded Business): shell + collapse, schedule + flight chips + day groups, calendar month/week/peek,
KPI counts (6/0/1), new-mission date prefill, settings; **Driver app unaffected** (shares `globals.css`).
Ran a **16-finding adversarial review workflow** (20 agents); **11 confirmed, all fixed + re-verified**
(week cross-month nav, drawer Escape/focus/scroll-lock, calendar keyboard a11y, dialog/filter accessible
names, "Confirmed" KPI count, "Today" history push, footer month, **glossary "Guest/ref"**, flight ETA).
**Live on `dispatch.pickupbedriven.com`** (curl: new tokens + `.dx-sidebar` + Geist @font-face present,
old `.tabs` gone).

**Decisions:** D20 (see `DECISIONS.md`).

**Next session:** the **Driver app** as a pixel-perfect phone mockup (the `ui_kits/driver/` kit in the
bundle), then apply it. Plus pending: Mapbox token URL-restriction (BACKLOG H), per-role PWA.

---

## 2026-06-18 — Session 9 — Custom domain + subdomain role routing
**Branch:** `subdomain-routing` (off `main`, merged + deployed) · **Env:** local (macOS) → Vercel.

**Why:** founder hit "role switching" — one browser shares a single Supabase session cookie on
`pickup-marketplace.vercel.app`, so signing in as the other demo role (Driver ↔ Business) overwrote
it and open tabs flipped roles on refresh. Root cause = one host = one cookie slot (NOT the long URL).

**What shipped**
- **Domain:** founder bought **`pickupbedriven.com`** (OVH) and pointed two CNAMEs at Vercel —
  **`driver.pickupbedriven.com`** + **`dispatch.pickupbedriven.com`** (both green, SSL auto-issued).
  Vercel shows "DNS Change Recommended" (cosmetic — CNAMEs resolve to Vercel; works).
- **Subdomain role routing** (`lib/hosts.ts`): on the prod domain the Driver app lives on `driver.*`
  and the Business/Dispatch app on `dispatch.*`. `app/page.tsx` + the `(app)` and `(dispatch)`
  layouts route a user to their role's subdomain (wrong role → their area; right role/wrong subdomain
  → their host). Dev-login buttons now target each role's OWN subdomain so the host-only session
  cookie lands on the correct host. **No-op off the prod domain** — localhost + `*.vercel.app` keep
  single-origin path-based routing.

**Verified** — `tsc` + `next build` clean; local prod build probed with spoofed Host headers (unauth
stays on each host's /login; localhost unchanged); 9/9 host→role unit cases. **Live on the real domain
(curl):** Driver → `driver.*/pool` (200); Business → `dispatch.*/dispatch` (200); **the driver's
cookie does NOT carry to `dispatch.*`** (→ /login) — the two sessions are isolated, switching is gone.

**Decisions:** D18 (see `DECISIONS.md`).

**Deferred/flagged:** real magic-link across subdomains (host-only cookies mean a user must sign in on
the right subdomain — fine for per-subdomain dev-login; revisit for real email, BACKLOG A); the bare
root `pickupbedriven.com` still points to OVH parking (decide destination); Mapbox token
URL-restriction now unblocked (BACKLOG H); per-role PWA manifest/icons; Supabase redirect URLs to add
before real email.

**Next session:** design pass, the remaining domain polish (root destination + Mapbox restriction +
per-role PWA), or detail/behavior fixes.

**Addendum (same session, 2026-06-18):** Shipped several things on top of the subdomains, all on `main`
(Claude Code can now push `main` for deploys — founder added an `autoMode.allow` rule in
`.claude/settings.local.json` after the harness blocked direct pushes to the default branch):
- **Root splash** — `pickupbedriven.com` / `www` now show a small "Driver / Business" chooser
  (`components/landing-splash.tsx`, rendered by `app/page.tsx` only on the bare prod host). DNS: apex +
  `www` A-records → Vercel `76.76.21.21`; **www-canonical** (apex 308-redirects to www, which serves the
  splash). Verified live.
- **Design pass 1 (Business)** — `app/globals.css` refreshed to a clean, conventional **blue/slate**
  theme (action blue `#2563EB`); **white app header + brand logo** (`public/logo.png`) replacing the navy
  bar; blue buttons; logo on login + splash. Login is **host/side-aware** (`dispatch.*` → "PickUp
  Dispatch", `driver.*` → "PickUp Driver"; was hardcoded "PickUp Driver" on both). Fixed the logo aspect
  ratio (tall 924×1153 pin; was squished to a square). Verified live on both subdomains.
- **Mapbox token URL-restriction** — still deferred (BACKLOG H); fine for closed beta.
- **Claude Design loop** — added `project/DESIGN_BRIEF.md`. Feed Claude Design via its **"Create here →
  Connect to GitHub"** path (repo is public) — NOT `/design-sync` (that's for packaged design-system
  libraries / Storybook; PickUp is a Next.js app, and DesignSync needs a `/login` re-auth). Round-trip:
  design in Claude Design → **Export → "Send to local coding agent"** → Claude Code implements + deploys.
  See D19.

**Still next:** receive the first Claude Design handoff (Business), then the **Driver app as a
pixel-perfect phone mockup**; later the Mapbox restriction + per-role PWA + detail/behavior fixes.

---

## 2026-06-17 — Session 8 — Driver service area (base + radius) + avatar crop
**Branch:** `driver-service-area` (off `main`) · **Env:** local (macOS).

**Why:** founder feedback — a fixed town checklist doesn't model real VTC work. A Cannes Driver
will take Milan→Nice (ends near home) but not Paris→Normandie. Need a base + radius, not a town list.

**What shipped**
- **Service-area matching (replaces zones):** Driver sets a **base** (Mapbox autocomplete) + a
  **service radius**; the Pool now keeps a mission when its **pickup OR drop-off** is within the
  radius of the base (`lib/geo.ts` haversine; `app/(app)/pool/page.tsx`). New
  `components/address-autocomplete.tsx` (Mapbox Geocoding v6, `NEXT_PUBLIC_MAPBOX_TOKEN`). Driver
  settings + onboarding capture base + radius; Business booking form geocodes pickup/drop-off into
  `mission.pickup_lat/lng` + `dropoff_lat/lng`; `zone` is now a display label from the pickup town.
- **Avatar/logo:** `components/avatar-editor.tsx` (react-easy-crop crop + zoom + remove, immediate)
  on both Driver photo and Business logo; `lib/avatar-actions.ts` (gated to the caller's own row).
- **DB:** additive migration `docs/migrations/2026-06-17_driver_service_area.sql` (founder-approved,
  ran in SQL Editor) adds `driver.base_label/base_lat/base_lng/service_radius_km`. Deleted the
  orphaned `lib/zones.ts`.

**Handoffs done by founder:** Mapbox public token (added to `.env.local`; **still needs adding to
Vercel env before deploy**) + ran the additive migration.

**Verified** — `tsc` + `next build` clean. Browser (real Supabase, both roles): Mapbox autocomplete
live (suggestions→pick→coords), base/radius save+persist, Pool radius UI; matching math proven
(Milan→Nice in / Paris→Rouen out). Caught + fixed an **infinite-render loop** in the autocomplete
(array-literal prop in effect deps). Ran a **13-finding adversarial review workflow** (24 agents)
and fixed: seed missions now carry coords (else invisible in the new Pool), server-side avatar
content-type validation, pickup-coords + lat/lng-range guards, autocomplete request-abort, avatar
object-URL leak + modal Escape/scroll-lock/aria, radius-option preservation, canonical docs
(Doc 00 + Phase0 spine) updated. Deferred only the cosmetic zone-label refinement (#5).

**Decisions:** D17 (see `DECISIONS.md`).

**Next session:** apply the Mapbox token in Vercel + verify live; optionally improve the derived
zone label (town from Mapbox context); then Payments (Stripe Connect) or the admin verification
workspace (BACKLOG F2).

**Addendum (same day):** deployed S8 to `main`; verified the Mapbox token is compiled into the live
build (autocomplete works live). Token URL-restriction deferred until a final domain exists (tracked
in BACKLOG H). **Bugfix (branch `fix-poi-autocomplete`):** the booking autocomplete used the
**Geocoding API**, which has no points of interest → French hotel/airport names returned foreign
junk ("Hôtel Negresco" → California; "Aéroport Nice" → Brazil). Switched to the **Mapbox Search Box
API** (suggest → retrieve, session-token based) — returns POIs. Verified live in-browser
("Aéroport Nice" → correct airport, coords 43.6597/7.2058) and cross-border (Milano) intact; `tsc` +
build clean. Component contract unchanged (same hidden lat/lng fields), so no page edits needed.

---

## 2026-06-17 — Session 7 — Accounts & records pillar
**Branch:** `accounts-records` (off `main`) · **Env:** local (macOS).

**What shipped** — the records layer both sides need before real onboarding/payments. All
**KEEP**, existing tables, **no schema change**. Files (proofs/images) go to **Supabase Storage**,
buckets created on demand via the service-role Storage API (operational setup, not a DB migration).
- **Storage foundation** (`lib/supabase/storage.ts`): `ensureBucket` (idempotent), `uploadFile`,
  `signedDocUrl` (private), `publicMediaUrl` (public). Two buckets: **`documents`** (private —
  signed URLs) and **`avatars`** (public — logo/photo). `lib/account.ts` = doc-type lists + labels.
- **Driver `/settings`**: edit name, phone, languages, GPS, zones, **profile photo**, + **vehicle**
  (make/model/colour/plate/seats/category). **Business `/dispatch/settings`**: name, field, **logo**,
  Dispatcher contact. Writes via service role gated to the caller's own row (D6/D7 pattern).
- **Documents** both sides (`components/document-section.tsx` + `lib/document-actions.ts`): one
  upload row per type → private bucket + `document` row, status stays `pending` (👤 verify). Status
  pill + signed "View" link. Driver: licence/VTC/REVTC/insurance/RC Pro/carte grise. Business: Kbis.
- **Bank/payouts = honest stub**: Driver "Payouts" + Business "Billing" cards show connected-state
  from `stripe_account_id`/`stripe_customer_id`; inert "coming soon" CTA. **No raw IBAN/card capture**
  (no columns; PCI) — Stripe Connect is a later pillar.
- **Mission history**: Driver `/rides/history` (month-grouped past completed/cancelled rides) +
  Business `/dispatch/history` (month-grouped past trips, reuses `TripRow`). Nav: Settings in the
  Driver header; History + Settings tabs in Dispatch; logo shown in the Dispatch header.
- Also (founder request): added an **"Internal tooling & observability stack"** pillar to
  `BACKLOG.md` (F2) — product analytics / Sentry / session replay / admin back-office + GDPR.

**Verified** — `tsc` + `next build` clean (19 routes). Browser-tested via preview against the
**real Supabase DB** (dev-login both roles): Driver settings render + edit-save persists; the
private-docs path proven end-to-end (bucket auto-provisioned, upload, `document` row `pending`,
signed URL HTTP 200) and renders "Pending review" + working View link; Business settings + Kbis
row + disabled Billing CTA; **logo** path proven (public bucket, header shows it); both history
views show real past missions grouped by "juin 2026". Fixed a polish bug: archived history rows no
longer show the live "pickup soon — call them" alarm (`missionTone(..., {archived})`). 1×1 test
artifacts cleaned up afterward; the two buckets remain (ready infra).

**Decisions:** D16 (see `DECISIONS.md`).

**Deferred/flagged:** file-pick can't be driven in the headless preview, so the upload UI itself
wasn't clicked through a real file — the storage mechanism was proven server-side instead (mirrors
the action exactly). History "fare" shows the PDP value (no stored final fare until the ledger is
written). Real email auth + Stripe wiring remain separate pillars.

**Next session:** Payments (Stripe Connect — turns the bank stubs real + writes the ledger/voucher),
or real email auth (flip dev-login off), or the observability/admin pillar (BACKLOG F2).

---

## 2026-06-16 — Session 6 — Live deploy + full backlog & next-session plan
**Branch:** `main` (consolidated). **Live:** https://pickup-marketplace.vercel.app

**What happened**
- **Merged everything to `main`** (founder authorized) and **deployed to Vercel**. Verified live:
  `/login` 200, dev sign-in blocked without key (403) and works with key (307 + session).
- Added **key-gated dev sign-in** so the founder can test the live site solo with no email /
  Supabase config: `/dev-login?key=<DEV_LOGIN_KEY>` (set in Vercel env). Local stays open.
- Founder is testing live and happy. Going forward: build on a branch, merge to `main` to deploy.
- **Planned the rest of the product**: wrote `project/BACKLOG.md` (full feature list tagged
  KEEP/MANUAL/V2 against Doc 02) and `project/NEXT_SESSION.md` (ready-to-paste prompt).

**Key facts for next time**
- Deploy = push to `main` → Vercel auto-redeploys (~1 min). Vercel env has the 3 Supabase keys
  + `DEV_LOGIN_KEY=v1a-DbkJHN9Dw3aqWKDGSfZ9`.
- Most remaining KEEP work needs **no schema change** — `document`, `payment`,
  `ledger_transaction`, `payout`, `booking_voucher`, `status_event` tables already exist.
- Before real beta: switch on email magic-link (one Supabase redirect-URL setting) and turn
  off dev-login.

**Decisions:** D15 (see `DECISIONS.md`).

**Next session:** recommended pillar = **Accounts & records** (profiles/settings, vehicle details,
document uploads → Storage, bank details, mission history). See `project/NEXT_SESSION.md`.

---

## 2026-06-16 — Session 5 — Dispatch redesign: booking-style schedule + calendar
**Branch:** `claude/compassionate-tesla-rdbmqb` · **Env:** local (macOS).

**Why:** founder wants the Business side to feel like hotel booking / fleet-dispatch software —
dense lines (not big cards), status visible at a glance for 10–55 trips/day, plus a calendar.

**What shipped** (replaces the card list on `/dispatch`):
- **Schedule** (`/dispatch`): dense rows grouped by day, **Today pinned** on top, past under an
  "Earlier" fold. Columns: Time · Route · Client/ref · Driver · Status. Each row has a
  **colour-coded left edge + status pill** (`lib/dispatch-status.ts` `missionTone`): green =
  in progress, blue = confirmed/accepted, amber `!` = unfilled & pickup soon, **red `!` = accepted
  but not confirmed near pickup ("call the driver")**, grey = pooled. Click a row → **expands in
  place** (native `<details>`) with full route, live progress, fare, guest, pax/luggage, flight,
  and the Driver's tap-to-call number. Auto-refreshes (LiveRefresh).
- **Calendar** (`/dispatch/calendar`): month grid (Mon-start, prev/next), trips placed on their
  day with colour dots + time + place, today highlighted.
- **Flexible reference field**: the booking form's notes field is now "Room / event / reference",
  shown as a chip on each line — works for hotel room **or** event name. Stored in the existing
  `comment` column (no schema change).
- Tabs (`DispatchTabs`) for Schedule / Calendar / New; header simplified to brand + business + sign-out.

**Verified in a real browser:** schedule with Today/▾Earlier grouping, coloured pills incl.
`!Unfilled`, reference chip, row-expand detail with driver phone; calendar month with placed,
colour-coded trips and Prev/Next. `tsc` + `next build` clean.

**Decisions:** D14 (see `DECISIONS.md`).

**Deferred/flagged:** reference lives in `comment` for now (promote to a dedicated column later);
fully user-configurable columns not built (single reference covers the 90% case); calendar entries
are display-only (no click-through to a filtered day yet); design/skin still to come (founder will
hand a design).

**Next session:** apply the founder's design when provided, or click-through from calendar day →
schedule, or payments / booking voucher.

---

## 2026-06-16 — Session 4 — Realtime status feed (trip execution)
**Branch:** `claude/compassionate-tesla-rdbmqb` · **Env:** local (macOS).

**What shipped** — the last functional piece of the core loop: the Driver runs the trip and the
Business watches it live.
- **Driver status buttons** (My Rides): for a confirmed mission, a single "next step" button
  advances en_route → arrived → on_board → completed (`lib/mission-flow.ts`, `StatusControl`).
  Each tap records a **status_event** AND moves `mission.status`. A 4-step progress bar
  (`StatusSteps`) shows where the trip is.
- **Status write path** (`app/(app)/rides/actions.ts`): a Driver can't UPDATE `mission` via RLS
  (no driver update policy), so after verifying ownership + valid transition under RLS, the
  status_event insert + mission update go through the **service role**.
- **Business live view**: `/dispatch` shows each active mission's progress bar + status badge and
  **auto-refreshes every 4s** (`LiveRefresh`) so Driver updates appear within seconds.

**Verified in a real browser (preview):** as the demo Driver, tapped "Start — I'm en route" → DB
shows `mission.status=en_route` + a `status_event`; switched to the demo Business and `/dispatch`
showed that mission **En route** with the progress bar advanced and the Driver's contact. `tsc` +
`next build` clean (12 routes).

**Decisions:** D13 (see `DECISIONS.md`).

**Deferred/flagged:** near-realtime is **polling** (4s), not websockets — true Supabase Realtime
needs `status_event` (and/or `mission`) added to the `supabase_realtime` publication (a one-time
DB enable; not done, to respect "don't touch the schema"). `completed` currently just sets the
status — the payment capture + ledger + booking-voucher on completion are a later milestone.

**Next session:** the **design layer** (one pass over both apps; needs a colour/logo direction
from the founder), or payments (Stripe Connect) / booking voucher.

---

## 2026-06-16 — Session 3 — Dispatcher (Business) slice — the loop closes
**Branch:** `claude/compassionate-tesla-rdbmqb` · **Env:** local (macOS).

**What shipped** — the other half of the marketplace, so the core V1 loop is now real
end-to-end (no more seed-only missions):
- **Role-aware app** (`lib/app-context.ts` + `routeFor`): one app serves Driver + Business,
  keyed off `profile.role`. New `/welcome` lets a first-time user pick Driver or Business.
- **Business onboarding** (`/onboarding-business`): creates `business` + `dispatcher` seat +
  `profile(role=dispatcher)`.
- **Dispatch area** (`/dispatch`): missions list for the Business, with the **assigned Driver's
  contact revealed** once accepted (service-role-gated to their own missions — mirror of the
  Driver side).
- **Create mission** (`/dispatch/new`): KEEP fields (category→pool routing, zone, addresses,
  intermediate stops, pickup time, pax/luggage, flight, comment, **ceiling**), posts straight
  to the Pool. Live **soft warning** when ceiling < estimated base fare (nudge, not block).
  PDP curve auto-derived; SPEED WIN toggle. Inserted via the **user session** so RLS authorizes
  it (no service role). Maps/geocoding deferred — addresses are free text, lat/lng null.

**Verified — the whole loop, under real RLS (not service-role bypass):** a Node script signed in
as a real Business and a real Driver and proved: Business inserts a mission as itself → Driver
sees it in the Pool → `accept_mission` succeeds (status=accepted, driver set) → **second accept
correctly rejected (atomic first-wins)** → both sides read the assigned mission. Plus `tsc` clean,
`next build` clean (11 routes), all guards redirect correctly.

**Decisions:** D11–D12 (see `DECISIONS.md`).

**Deferred / flagged:** Maps geocoding + real distance-based base fare; `datetime-local` is parsed
in the server's local zone (make Europe/Paris explicit before prod); Dispatcher realtime status
feed + mission detail/edit; mission can be posted with a past pickup time (no guard yet).

**Next session:** full browser walkthrough of both sides together, then realtime status feed
(Driver 4 status buttons → Dispatcher) or the design layer.

**Addendum (same session):**
- **Zones = whole French Riviera** (Saint-Tropez → Monaco/Menton). Founder confirmed it's the
  whole region, not 3 towns. `lib/zones.ts` now lists the Riviera communes (west→east).
- **One-click dev sign-in** (`/dev-login` + `GET /api/dev-login?as=driver|business`): lets a
  non-technical founder test locally with NO email and NO Supabase dashboard config — ensures a
  confirmed user via the service role and signs in server-side (sets the session cookie).
  Dev-only (blocked on hosted envs). Verified: sets `sb-…-auth-token` and routes to /welcome.
  The Supabase redirect-URL allowlist is still needed for real magic-link sign-in in PRODUCTION.

---

## 2026-06-16 — Session 2 — Driver PWA vertical slice (the bones)
**Branch:** `claude/compassionate-tesla-rdbmqb` · **Env:** local (macOS), pushes to GitHub.

**What shipped** — the first end-to-end Driver slice, KEEP-only, design deferred:
- Scaffolded Next.js 15.5 (App Router, TS) + Supabase (`@supabase/supabase-js` + `@supabase/ssr`).
  Hand-wrote `lib/database.types.ts` from `pickup_schema.sql` (D3) — never migrated the schema.
- **Auth:** email magic-link (OTP/PKCE) → `/auth/callback` → cookie session via middleware.
  `/login` is a server-guarded wrapper (redirects authed users) around a client form.
- **Onboarding** (glue): minimal Driver profile — zones + one vehicle/category — because the
  Pool can't filter without it. Writes via service role (no INSERT RLS on profile/driver).
- **Pool** (`/pool`): pooled missions filtered by the Driver's `vehicle.category` ∈ +
  `zone ∈ operational_zones`. PDP fare computed on read (`lib/pdp.ts`).
- **Mission detail** → **Accept** = `rpc('accept_mission', { p_mission_id })`, called as the
  user session. All atomic/slot-conflict/Lock-in logic stays in the DB function.
- **My Rides** (`/rides`): assigned missions with **contacts unlocked** — revealed server-side
  via the service-role client, gated to missions owned by this Driver (RLS can't express that).
- **Dev-only seed** (`GET /api/seed`): Business + Dispatcher + 6 pooled missions across zones/categories.

**Verified:** `tsc` clean · `next build` clean · dev server boots · route guards redirect ·
live Supabase read+write (seed inserted 6 missions; Pool filter returns the right 3).

**Review:** ran a 5-lens adversarial workflow (schema/security/auth/spec/correctness). Fixed all
8 confirmed findings: open-redirect in callback `next`, onboarding write-errors swallowed
(redirect-loop risk), seed route hardened to local-only, callback/login now surface link errors,
authed users redirected off `/login`, glossary "Client"→"Passager" in a seed comment, and
documented the Supabase redirect-URL allowlist. Also caught + fixed a PostgREST bulk-insert
NULL gotcha on `speed_win`, and upgraded `@supabase/ssr` 0.5→0.12 (see D10).

**Decisions:** D6–D10 (see `DECISIONS.md`).

**Action needed from the founder before the slice runs end-to-end in a browser:**
1. Supabase → Auth → URL Configuration → add `http://localhost:3000/auth/callback` to Redirect URLs.
2. Confirm the **third beta zone** (placeholder `Antibes` in `lib/zones.ts`).

**Next session:** manual browser run-through (login→onboarding→pool→accept→rides); then either
add realtime to the Pool, PWA icons + offline, or start the Dispatcher mission-creation side.

**Repo layout:** spec docs moved root → `docs/` as their single home (founder's preference;
files were byte-identical, nothing lost). `CLAUDE.md` references updated to `docs/…`.

---

## 2026-06-16 — Session 1 — Project bootstrap & env setup
**Branch:** `claude/compassionate-tesla-rdbmqb`

**What happened**
- Read all spec docs (00–05), the Phase 0 Data Spine, and `pickup_schema.sql`.
- Agreed the first milestone: a single end-to-end Driver PWA vertical slice
  (auth → Pool → detail → accept → My Rides). Plan approved in principle; build deferred
  until the user says go.
- Set up the environment (no app code yet, per user request):
  - `.gitignore`, `.env.local` (real keys, git-ignored), `.env.example` (placeholders).
  - `CLAUDE.md` with persistent rules + glossary.
  - `project/` continuity docs (STATUS, SESSION_LOG, DECISIONS, IDEAS).

**Decisions** — see `DECISIONS.md` (D1–D5).

**State of the DB:** empty. First session of PickUp; nothing exists yet.

**Next session:** when user says go — scaffold the Next.js PWA and build the Driver slice
(see `STATUS.md` → Next up).
