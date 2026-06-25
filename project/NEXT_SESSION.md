# Prompt for the next PickUp session

> Copy-paste the block below (from "We're continuing PickUp" to the end) into a fresh
> Claude Code session. It orients a new Claude and sets the scope.

---

We're continuing PickUp (B2B VTC booking marketplace). This is a LOCAL session on my Mac; we push to
GitHub (`main`) and the app auto-deploys to Vercel. **Claude Code is allowed to push `main` to deploy**
(an `autoMode.allow` rule is set in `.claude/settings.local.json`).

START BY READING (in order):
- `CLAUDE.md` (root) — hard rules + glossary.
- `project/SESSION_LOG.md` — newest entry (**Session 17**) is the resume point.
- `project/DESIGN_BRIEF.md` — brand, palette (**navy** `#25344C`), glossary, every screen, constraints.
- `project/BACKLOG.md` (newest **§ L** = guided-form polish), `project/DECISIONS.md` (newest **D28**),
  `project/IDEAS.md` (newest **"Founder idea dump — 2026-06-23"**).
- Skim `docs/` — `00`–`05`, `PickUp_Phase0_Data_Spine.md`, `pickup_schema.sql`, and **`docs/migrations/`**
  (applied additive migrations: `2026-06-17_driver_service_area.sql`, `2026-06-19_vehicle_taxonomy_and_eta.sql`,
  **`2026-06-23_named_passengers.sql`**). These are the source of truth.

## HOW THE FOUNDER WANTS TO WORK (two standing preferences — honor both)
1. **Show a preview FIRST for any UI/design job.** Build a self-contained inline HTML mockup from the real
   tokens + data (the visualize widget), get the founder's sign-off, *then* implement — and make what ships
   **match the approved preview** (e.g. a styled control in the mock must ship styled, not fall back to a
   native one). This is the D25 design loop, now a hard expectation.
2. **Features + polish FIRST; APIs / third-party integrations LATER.** The founder wants the in-app experience
   right before wiring external services. **Defer** (capture, don't build yet): notifications (Resend),
   payments (Stripe), real email/magic-link auth, flight tracking, analytics/monitoring, the admin
   verification workspace. The founder green-lights the integration phase explicitly. **Additive DB
   migrations are fine** (see below).

## DB MIGRATIONS — Claude can't run them; the founder does
The schema is already applied (hard-rule #4). For an **additive** column/enum: write the SQL to
`docs/migrations/<date>_<name>.sql`, give the founder the one-liner, and they run it in the **Supabase SQL
editor** (Claude's app keys go through PostgREST = rows only, NOT DDL). Then build + verify + deploy. The DB
also keeps the running app's data, so the dev server reads the **real** Supabase DB.

CURRENT STATE (live, deployed from `main`):
- **Custom domain + role subdomains:** `driver.pickupbedriven.com` = Driver app · `dispatch.pickupbedriven.com`
  = Business/Dispatch. Each subdomain has its own host-only session cookie. Mapping in `lib/hosts.ts` (no-op on
  localhost + `*.vercel.app`).
- **Core loop** works end-to-end both sides vs the real Supabase DB (Pool→Accept→run trip; post mission→
  Schedule/Calendar→live status; accounts/records; Mapbox autocomplete + traffic-aware ETA; base+radius Pool).
- **Dispatch redesign** shipped: navy palette app-wide (S14/D24), Geist + Lucide, collapsible sidebar shell,
  Schedule (flight col + T-180 wash), full Calendar, design-token system.
- **New-mission form (`/dispatch/new`) is the most-worked screen** — two-pane (left section cards + a
  **read-only** sticky Summary rail). Recent passes:
  - **S15 / D26** — **Pricing** grouped into its own left card (estimated base fare + ceiling + SPEED WIN);
    the **Summary rail is read-only** (shows ceiling + live starting fare + pricing mode + actions, no fields).
  - **S16 / D27** — **Service class = tier tiles** (Eco/Business/First) instead of a native select; body stays
    a segmented control; the **specific-car dropdown** is restyled (`appearance:none` + custom chevron) and
    **hidden for Eco** (no Eco models in the catalog).
  - **S17 / D28** — **named Guests** in Trip details: First name + Surname, **multiple per mission**, **capped
    by the vehicle** (Sedan 4 / Van 7 / Any 7, "switch to a Van" nudge). Rows = headcount; names optional.
    Structured in `mission.passenger_names jsonb`; `passenger_name` (singular) kept denormalised (first named
    Guest) for the schedule/Driver/detail reads. Cross-card cap sync via `ServiceClassFields` `onBodyChange`
    → `MissionForm` → `PassengerList`. Shared `lib/passengers.ts`.
- **Auth (testing):** key-gated dev-login on the live subdomains:
  - Business → `https://dispatch.pickupbedriven.com/dev-login?key=v1a-DbkJHN9Dw3aqWKDGSfZ9`
  - Driver  → `https://driver.pickupbedriven.com/dev-login?key=v1a-DbkJHN9Dw3aqWKDGSfZ9`
  Local (`npm run dev`): dev-login is open, no key. `GET /api/seed` (dev-only) creates a Business +
  Dispatcher + missions. Real magic-link wired but OFF (turning it on is a deferred integration).
- **Env:** `.env.local` (git-ignored) needs the 3 Supabase keys + `NEXT_PUBLIC_MAPBOX_TOKEN`; same in Vercel.

LEGAL — **not a build blocker.** The founder (Céline) owns the legal track personally; a lawyer writes the real
Terms/Privacy/positioning later. Do **not** gate work on legal or add "needs a lawyer" flags. Keep the glossary
+ agent/intermediary framing in code/copy (a product rule, not a legal gate). Sharing the Guest phone across
parties is fine for the MVP.

RECOMMENDED NEXT STEP (matches the founder's current phase = features/polish):
**`BACKLOG.md` § L — the guided mission-form polish.** The theme: most Businesses (hotel staff) don't know the
VTC profession, so the form should teach the why/how inline and stop bad missions. Buildable now, no third-party
APIs:
1. **Input-driven guidance messages** — small contextual hints from what's entered (e.g. lots of luggage →
   "Consider a Van"; long-distance / late-night nudges). Calm, non-blocking (like the too-low-fare warning).
2. **Per-section "why/how" microcopy** — a short helper line on each section.
3. **Smart "most-used" defaults** — pre-select the Dispatcher's *most-frequent* tier+body (not just the last;
   a one-off doesn't move the default). Derivable from their history, no schema change.
4. **Saved base addresses (favourites)** — a hotel picks its own address in one tap (additive table).
5. **Dress-code option** — driver attire presets keyed to tier (additive field).
(✅ "multiple passengers" from § L shipped this session.)

DEFERRED until the founder okays the integration phase: **Notifications (Resend)** — the #1 functional gap
(today a Driver only sees a Pool mission if watching the screen; a Business sees an acceptance on refresh);
**real email auth** (retire dev-login); **Admin verification workspace** (BACKLOG F2 — onboards real
drivers/hotels); **Payments/Stripe**; flight tracking; analytics/monitoring.

OTHER OPEN ITEMS (pick what the founder asks):
- **Driver app redesign:** inherits the navy palette but its **layout** isn't redesigned (Dispatch is done).
  Use the D25 preview loop (or a Claude Design phone mockup), then build.
- **Navy polish (small):** Driver **"Complete ride"** uses a `success-btn` class that falls through to navy
  `.btn` — make it intentionally **green**; re-export the **logo** to harmonise its sky-blue with navy; the
  Dispatch **sidebar** doesn't auto-collapse on a phone (pre-existing; Dispatch is desktop-first).
- **Vehicle taxonomy V2** (IDEAS): **Bus tier** (the Sprinter is really a minibus), a **First/VIP van**
  (Classe V is Business today; there's no First van), a **cargo/luggage vehicle**, driver **specialisation**.
- **Pricing engine** (IDEAS, ❓): no objective base price by tier×body×distance×season yet — the Business sets
  the ceiling, PickUp recommends. Seeding approach noted in IDEAS (taxi tariff floor + base+€/km+€/min grid).
- **O7 cancellation** (driver re-pool + big red Dispatch card), **O2 guest phone to the Driver** (additive).
- **Engineering hardening (BACKLOG H2):** automated tests (money/PDP/`accept_mission`/RLS first), CI on PRs,
  generated DB types (`supabase gen types`), error monitoring.

HARD RULES (from CLAUDE.md): glossary exactly (Business, Dispatcher, Driver, Guest, Pool, PDP, Ceiling,
SPEED WIN — never "client"/"principal"); PickUp is an AGENT, never principal; PickUp ≠ PickUp Go; the Supabase
schema is ALREADY APPLIED — never re-run it (additive ALTERs only, founder-approved, in `docs/migrations/`);
build only KEEP items (Doc 02).

WORKFLOW THIS SESSION: work on `main` (or a branch off it) for code; keep `tsc` + `next build` green; verify in
the browser preview vs the real Supabase DB. **Don't run `next build` while the `next dev` preview is running**
— it corrupts `.next` (ChunkLoadError); if it happens, `rm -rf .next` + restart the dev server. Push `main` to
deploy (Claude Code may push). Append to `project/SESSION_LOG.md` when a chunk is done.
