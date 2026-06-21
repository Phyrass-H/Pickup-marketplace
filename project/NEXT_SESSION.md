# Prompt for the next PickUp session

> Copy-paste the block below (from "We're continuing PickUp" to the end) into a fresh
> Claude Code session. It orients a new Claude and sets the scope.

---

We're continuing PickUp (B2B VTC booking marketplace). This is a LOCAL session on my Mac; we push to
GitHub (`main`) and the app auto-deploys to Vercel. **Claude Code is allowed to push `main` to deploy**
(an `autoMode.allow` rule is set in `.claude/settings.local.json`).

START BY READING (in order):
- `CLAUDE.md` (root) — hard rules + glossary.
- `project/SESSION_LOG.md` — newest entry (**Session 14**) is the resume point.
- `project/DESIGN_BRIEF.md` — brand, palette (now **navy**), glossary, every screen, constraints.
- `project/BACKLOG.md`, `project/DECISIONS.md` (newest **D25**), `project/IDEAS.md`.
- Skim `docs/` — `00`–`05`, `PickUp_Phase0_Data_Spine.md`, `pickup_schema.sql`, and **`docs/migrations/`**
  (applied additive migrations: `2026-06-17_driver_service_area.sql`, `2026-06-19_vehicle_taxonomy_and_eta.sql`).
  These are the source of truth. **No schema change in Sessions 13–14.**

CURRENT STATE (live, deployed from `main`):
- **Custom domain + role subdomains:** `driver.pickupbedriven.com` = Driver app · `dispatch.pickupbedriven.com`
  = Business/Dispatch. Each subdomain has its own session cookie. Mapping in `lib/hosts.ts` (no-op on
  localhost + `*.vercel.app`).
- **Core loop** works end-to-end both sides vs the real Supabase DB (Pool→Accept→run trip; post mission→
  Schedule/Calendar→live status; accounts/records; Mapbox autocomplete; base+radius Pool).
- **Dispatch redesign** shipped (Session 10 / D20): design-token system, Geist + Lucide, collapsible sidebar
  shell, Schedule (flight col + T-180 wash), full Calendar.
- **Session 11 (D21/D22):** SPEED WIN starts at **70%** of ceiling; new-mission **preview-before-post** +
  **save-as-draft/resume/discard** (`/dispatch/drafts`); Europe/Paris pickup time; Terms/Privacy/Support pages.
- **Session 12 (D23):** O5 **vehicle taxonomy** — `vehicle_category` = service **tier** (Eco/Business/First),
  **body_type** a separate axis; Driver tier auto-classified in `lib/vehicle-catalog.ts`; Dispatcher picks
  tier + Any/Sedan/Van + optional specific car; Pool matches all three. **Traffic-aware ETA** via Mapbox.
- **Session 13 (D23 follow-ups):** **stops are geocoded** (each "Add a stop" field is a Mapbox autocomplete;
  waypoints store `[{address,lat,lng}]`); the route card was redesigned (the floating "+" became an **"Add a
  stop"** button, **red square** stop marker, breathing room); a **live distance + travel-time** preview while
  picking addresses (`POST /api/eta` → `lib/directions.ts`, routes through stops, traffic-aware); and
  **France-biased autocomplete** (a `country` allowlist in `components/address-autocomplete.tsx` — no more
  USA/Canada junk; Cannes→Geneva/Berlin still resolve; dropoff/stops bias `proximity` to the picked pickup).
- **Session 14 (D24/D25):** **app-wide navy palette** + **two-pane new-mission form (Direction B).**
  - **Palette (D24):** the action accent is now a deep **navy #25344C** (hover #1B2738, soft #E9EDF4),
    swapped at the **token layer** in `app/globals.css` (the `--blue-*` raws that `--accent*` chains to), so
    the whole app — Driver + Dispatch — follows. `--ring` is navy. The status **"info"** tone
    (Confirmed/Accepted) is a desaturated **steel #1B5E8A** (kept in sync in `lib/dispatch-status.ts`) so a
    status pill never reads as a navy button. Brand logo gradient untouched (logo-only).
  - **`/dispatch/new` (D24):** rebuilt into a **two-pane** layout — left = 4 section cards (Vehicle / Route /
    Schedule / Trip details); right = a **sticky navy Summary rail** (mini-route, live ETA, Ceiling, a **live
    starting fare**, SPEED WIN, actions). ONE `<form>` (the `createMission` contract is unchanged); the D22
    draft/Review flow + live ETA + waypoints all preserved; collapses to one column <900px. `RouteStops`
    publishes a snapshot via `onSummaryChange` + accepts `etaDefault`. New CSS is `.mx-*` in `globals.css`.
  - **Design loop (D25):** the founder found Claude Design (zip round-trip) not yet smooth. The new default
    for screen redesigns is **Claude Code authoring self-contained HTML mockups from the real tokens + data,
    rendered inline** (the visualize widget) → founder reacts → iterate the mock → implement for real. The
    Claude Design zip path stays available when the founder prefers to design there.
- **Auth (testing):** key-gated dev-login on the live subdomains:
  - Business → `https://dispatch.pickupbedriven.com/dev-login?key=v1a-DbkJHN9Dw3aqWKDGSfZ9`
  - Driver  → `https://driver.pickupbedriven.com/dev-login?key=v1a-DbkJHN9Dw3aqWKDGSfZ9`
  Local (`npm run dev`): dev-login is open, no key. `GET /api/seed` (dev-only) creates a Business +
  Dispatcher + missions. Real magic-link wired but off.
- **Env:** `.env.local` (git-ignored) needs the 3 Supabase keys + `NEXT_PUBLIC_MAPBOX_TOKEN`; same in Vercel.

LEGAL — **not a build blocker.** The founder (Céline) owns the legal track personally; a lawyer will write the
real Terms/Privacy/positioning later. Do **not** gate work on legal or add "needs a lawyer" flags. Keep the
glossary + agent/intermediary framing in code/copy (that's a product rule, not a legal gate). Sharing the
Guest phone across parties is fine for the MVP.

THE DESIGN WORKFLOW (now D25): for a screen redesign, **Claude Code builds an inline HTML mockup from the real
tokens + data** (the visualize widget), the founder reacts in plain language, we iterate the mock, then
implement it for real + deploy. (Used end-to-end in Session 14 for the navy/two-pane work.) Claude Design
zips (D19/D20) remain an option when the founder prefers to design there; last bundle kept at `.design-handoff/`
(gitignored), Driver UI kit at `.design-handoff/pickup-design-system/project/ui_kits/driver/`. Honor
`DESIGN_BRIEF.md` (palette is now navy `#25344C`).

RECOMMENDED NEXT STEP (to finish the MVP — grounded in Doc 02 KEEP + Doc 04 beta plan):
The **core V1 loop is built and polished**; what's missing to make it touchable by REAL users (vs a demo) is
the "real people can use it" layer. Doc 04 runs a **concierge beta (a human confirms every trip)** and says
the #1 risk is **liquidity (hotel supply), not engineering** — so don't over-build; do the minimum that lets
a real Driver + hotel run the loop:
1. **Notifications (email via Resend)** — KEEP (Doc 02), currently NONE. The biggest gap: today a Driver only
   sees a Pool mission if watching the screen, and a Business only sees an acceptance on refresh. Trigger on
   mission accepted, T-180 confirm reminder, status changes.
2. **Real email auth** — flip on magic-link, retire the dev-login scaffold (needs the Supabase redirect-URL
   setting for `driver.*`/`dispatch.*`).
3. **Admin verification workspace** (founder priority, BACKLOG F2) — staff screen to review uploaded docs +
   approve a Driver (`driver.verified`); needed to onboard the ~200 drivers.
DEFERRABLE in the concierge beta (staff-manual for now): **Payments/Stripe Connect** (payouts MANUAL in
beta — Doc 02), the **Lock-in/T-180/expiry cron jobs** (a human confirms each trip), O7 cancellation,
limited-edit, flight tracking. The **Driver app redesign** is polish (loop works), not MVP-blocking.

OTHER OPEN ITEMS (pick what the founder asks):
- **Driver app redesign:** the Driver app inherits the navy palette but its **layout** isn't redesigned yet.
  Either the founder hands a phone mockup (Claude Design zip) or we use the D25 inline-mockup loop, then build.
- **Navy polish follow-ups (small, optional):** the Driver **"Complete ride"** button uses a `success-btn`
  class that falls through to navy `.btn` — make it intentionally **green** (or define `.success-btn`);
  re-export the **logo** so its sky-blue mark harmonises with the navy UI; the Dispatch **sidebar** doesn't
  auto-collapse on a phone (pre-existing; Dispatch is desktop-first).
- **O7 — Driver cancellation flow:** `cancel_mission` RPC (re-pool), auto-flip to SPEED WIN on re-pool, big
  red Dispatch card (red-wash exists), Driver reliability/"mark" field, cancellation fee data. (Fee amounts =
  founder decision, MANUAL in beta. Schema-change → additive migration, founder-approved, in `docs/migrations/`.)
- **O2 — Guest phone to the Driver:** add `mission.passenger_phone` (additive) + show on the assigned ride.
- **Engineering hardening (BACKLOG H2):** automated tests (money/PDP/`accept_mission`/RLS first), CI on PRs,
  generated DB types (`supabase gen types`), real email auth (remove dev-login), error monitoring + analytics.
- Smaller follow-ups: bind the Driver's car to the catalog for fully-robust specific-car matching; Mapbox
  token URL-restriction (BACKLOG H); per-role PWA; car-classifier upkeep (`lib/vehicle-catalog.ts`).

HARD RULES (from CLAUDE.md): glossary exactly (Business, Dispatcher, Driver, Guest, Pool, PDP, Ceiling,
SPEED WIN — never "client"/"principal"); PickUp is an AGENT, never principal; PickUp ≠ PickUp Go; the
Supabase schema is ALREADY APPLIED — never re-run it (additive ALTERs only, founder-approved, recorded in
`docs/migrations/`); build only KEEP items.

WORKFLOW THIS SESSION: work on a branch off `main` for code changes; keep `tsc` + `next build` green; verify
in the browser preview against the real Supabase DB. **Don't run `next build` while the `next dev` preview is
running** — it corrupts `.next` (restart the dev server after a build). Push `main` to deploy (Claude Code may
push). Append to `project/SESSION_LOG.md` when a chunk is done.
