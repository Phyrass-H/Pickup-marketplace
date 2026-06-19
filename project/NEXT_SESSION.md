# Prompt for the next PickUp session

> Copy-paste the block below (from "We're continuing PickUp" to the end) into a fresh
> Claude Code session. It orients a new Claude and sets the scope.

---

We're continuing PickUp (B2B VTC booking marketplace). This is a LOCAL session on my Mac; we push to
GitHub (`main`) and the app auto-deploys to Vercel. **Claude Code is allowed to push `main` to deploy**
(an `autoMode.allow` rule is set in `.claude/settings.local.json`).

START BY READING (in order):
- `CLAUDE.md` (root) — hard rules + glossary.
- `project/SESSION_LOG.md` — newest entry (**Session 12**) is the resume point.
- `project/DESIGN_BRIEF.md` — brand, palette, glossary, every screen, constraints (shared with Claude Design).
- `project/BACKLOG.md` (newest planning section **K** = the founder brain-dump triage), `project/DECISIONS.md`
  (newest **D23**), `project/IDEAS.md`.
- Skim `docs/` — `00`–`05`, `PickUp_Phase0_Data_Spine.md` (current as of 2026-06-19), `pickup_schema.sql`,
  and **`docs/migrations/`** (two applied additive migrations: `2026-06-17_driver_service_area.sql`,
  `2026-06-19_vehicle_taxonomy_and_eta.sql`). These are the source of truth.

CURRENT STATE (live, deployed from `main`):
- **Custom domain + role subdomains:** `driver.pickupbedriven.com` = Driver app · `dispatch.pickupbedriven.com`
  = Business/Dispatch. Each subdomain has its own session cookie. Mapping in `lib/hosts.ts` (no-op on
  localhost + `*.vercel.app`).
- **Core loop** works end-to-end both sides vs the real Supabase DB (Pool→Accept→run trip; post mission→
  Schedule/Calendar→live status; accounts/records; Mapbox autocomplete; base+radius Pool).
- **Dispatch redesign** shipped (Session 10 / D20): design-token system, Geist + Lucide, collapsible
  sidebar shell, Schedule (flight col + T-180 wash), full Calendar.
- **Session 11 (triage → quick wins + post-flow, D21/D22):** SPEED WIN starts at **70%** of ceiling (not
  100%); new-mission **preview-before-post** + **save-as-draft/resume/discard** (`/dispatch/drafts`);
  pickup time is **Europe/Paris**-correct; trip **distance** + **stops** on cards; Driver **car (make/
  colour/plate)** captured at onboarding + shown on Dispatch rows; **Terms/Privacy/Support** settings pages
  (`/legal/*`, FR+EN placeholder).
- **Session 12 (D23): real date+time pickers + route block (+stop button); O5 vehicle taxonomy; traffic-aware
  ETA.**
  - **Vehicle taxonomy:** `vehicle_category` is now the **service TIER** (Eco / Business / First — `luxury`
    relabelled); **body_type** (sedan/van) is a separate axis. A Driver's tier is **auto-classified** from
    make+model by a two-step fallback in **`lib/vehicle-catalog.ts`** (`categorize()`: checked-brands +
    premium-model exceptions, else Eco). Dispatcher picks tier + body (Any/Sedan/Van) + optional **specific
    car**; Pool matches tier + body + specific car (`carMatches`, alias-aware). Maintain by editing the two
    arrays in `lib/vehicle-catalog.ts` (anything unlisted → Eco).
  - **ETA:** `mission.distance_km` / `duration_min` computed once at posting via Mapbox **`driving-traffic`
    + `depart_at`=pickup time** (traffic-aware — Mon 8am ≠ Sun 2pm), cached; shown as "27 km · 40 min".
  - **Migration applied 2026-06-19** (additive): `body_type` enum, `vehicle.body_type`,
    `mission.required_body_type/required_make/required_model/distance_km/duration_min`; legacy `van` →
    business+van.
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

THE DESIGN WORKFLOW (established — D19/D20): founder designs in **Claude Design** → **Export → zip** → drops
the zip into the session → Claude implements it against the repo + deploys. The live `DesignSync` connector
is blocked; the zip path is the reliable one. Each handoff the founder states the scope. Honor `DESIGN_BRIEF.md`.
Last bundle kept locally at `.design-handoff/` (gitignored); Driver UI kit at
`.design-handoff/pickup-design-system/project/ui_kits/driver/`.

THIS SESSION — pick what the founder asks (open items):
- **Driver app redesign (headline next):** the founder delivers a pixel-perfect phone mockup (Claude Design
  zip); implement it. The Driver app currently inherits the palette/font but its layout is NOT yet redesigned.
- **O7 — Driver cancellation flow:** `cancel_mission` RPC (re-pool), auto-flip to SPEED WIN on re-pool, big
  red Dispatch card (red-wash exists), Driver reliability/"mark" field, cancellation fee data. (Fee/penalty
  *amounts* are a founder decision — MANUAL in beta per spec. Schema-change → additive migration, founder-
  approved, recorded in `docs/migrations/`.)
- **O2 — Guest phone to the Driver:** add `mission.passenger_phone` (additive) + show on the assigned ride.
  Founder: fine to share for the MVP.
- **Car classifier upkeep:** extend `CHECKED_BRANDS` / `MODEL_EXCEPTIONS` in `lib/vehicle-catalog.ts` as new
  models appear (low-touch; unlisted → Eco).
- **Engineering hardening (BACKLOG H2):** automated tests (money/PDP/`accept_mission`/RLS first), CI on PRs,
  generated DB types (`supabase gen types`), real email auth (remove dev-login), error monitoring + analytics.
- Smaller follow-ups: accurate ETA for multi-stop trips (geocode stops, pass as `via`); bind the Driver's car
  to the catalog for fully-robust specific-car matching; Mapbox token URL-restriction (BACKLOG H); per-role PWA.

HARD RULES (from CLAUDE.md): glossary exactly (Business, Dispatcher, Driver, Guest, Pool, PDP, Ceiling,
SPEED WIN — never "client"/"principal"); PickUp is an AGENT, never principal; PickUp ≠ PickUp Go; the
Supabase schema is ALREADY APPLIED — never re-run it (additive ALTERs only, founder-approved, recorded in
`docs/migrations/`); build only KEEP items.

WORKFLOW THIS SESSION: work on a branch off `main` for code changes; keep `tsc` + `next build` green; verify
in the browser preview against the real Supabase DB. Push `main` to deploy (Claude Code may push). Append to
`project/SESSION_LOG.md` when a chunk is done.
