# Prompt for the next PickUp session

> Copy-paste the block below (from "We're continuing PickUp" to the end) into a fresh
> Claude Code session. It orients a new Claude and sets the scope.

---

We're continuing PickUp (B2B VTC booking marketplace). This is a LOCAL session on my Mac; we push to
GitHub (`main`) and the app auto-deploys to Vercel. **Claude Code is allowed to push `main` to deploy**
(an `autoMode.allow` rule is set in `.claude/settings.local.json`).

START BY READING (in order):
- `CLAUDE.md` (root) — hard rules + glossary.
- `project/SESSION_LOG.md` — newest entry (**Session 18**) is the resume point. `project/CHANGELOG.md` is a
  **plain-language, founder-facing** history of everything shipped — read it for the big picture fast.
- `project/DESIGN_BRIEF.md` — brand, palette (**navy** `#25344C`), glossary, every screen, constraints.
- `project/BACKLOG.md` (newest **§ M** = the 2026-06-25 founder dump; **§ L** = guided-form polish),
  `project/DECISIONS.md` (newest **D29**), `project/IDEAS.md` (newest **"Founder idea dump — 2026-06-23"**).
- Skim `docs/` — `00`–`05`, `PickUp_Phase0_Data_Spine.md`, `pickup_schema.sql`, and **`docs/migrations/`**
  (applied additive migrations: `2026-06-17_driver_service_area.sql`, `2026-06-19_vehicle_taxonomy_and_eta.sql`,
  `2026-06-23_named_passengers.sql`). These are the source of truth.

## HOW THE FOUNDER WANTS TO WORK (standing preferences — honor all)
1. **Show a preview FIRST for any UI/design job.** Build a self-contained inline mockup from the real tokens +
   data (the visualize widget) — or, for a *width/layout* tweak, apply the proposed CSS live in the browser and
   screenshot it — get the founder's sign-off, *then* implement, and make what ships **match the approved
   preview**. This is the D25 design loop, a hard expectation.
2. **Features + polish FIRST; APIs / third-party integrations LATER.** Get the in-app experience right before
   wiring external services. **Defer** (capture, don't build yet): notifications (Resend), payments (Stripe),
   real email/magic-link auth, flight tracking, analytics/monitoring, the admin verification workspace. The
   founder green-lights the integration phase explicitly. **Additive DB migrations are fine** (see below).
3. **No "dirty routes."** Fix the real root cause in the codebase's idiom — never a hidden hack. Pragmatic
   MVP shortcuts are OK *only if flagged* so the founder can accept the debt; surface anything you cut.

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
  Schedule (flight col + T-180 wash), full Calendar, design tokens. **S18:** the dense views
  (Schedule/Calendar/History) now **fill the screen** (a `.dx-main--wide` 1520px modifier the shell applies by
  pathname; the new-mission page is deliberately left at 1120px). The **calendar search** also matches the
  **assigned driver's name** now.
- **New-mission form (`/dispatch/new`) is the most-worked screen** — two-pane (left section cards + a
  **read-only** sticky Summary rail). Passes:
  - **S15/D26** — Pricing grouped into its own card; the Summary rail is read-only.
  - **S16/D27** — Service class = tier tiles; specific-car dropdown restyled, hidden for Eco.
  - **S17/D28** — named Guests (first+surname, multiple, capped by vehicle: Sedan 4 / Van 7).
  - **S18 (bug round)** — **"Review" no longer accidentally posts** the mission (it was a React node-reuse bug:
    the Review button got reconciled into the Post button mid-click). Defence in depth: `createMission` now
    **requires an explicit `intent`** (a stray submit writes nothing); a **double-submit guard** disables all
    submit buttons + shows "Posting…/Saving…" while the action runs (rapid clicks were creating duplicate
    missions — one trip posted 7×); an **irreversible "This is final" warning** at the post step; the address
    fields are a **keyboard combobox** (↑/↓/Enter/Esc).
- **Drafts:** a **discard confirmation** (inline "Discard this draft? This can't be undone.") + a **count badge**
  on the sidebar Drafts item, kept fresh after save/post/discard via `revalidatePath("/dispatch","layout")`.
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

RECOMMENDED NEXT STEP (features/polish phase). The big remaining founder asks are the **mission-form fields +
guidance** — all buildable now, no third-party APIs; each NEW field needs a small founder-run additive migration:
1. **Reference vs message-to-driver split** (founder dump 2026-06-25, BACKLOG § M): today one "Reference / notes"
   textarea does two jobs. Split into a short, char-limited **Reference** (shown on the schedule line —
   "FIF 2026 Chopard", "Room 312") + a free **message to the driver** for special requests. (V2: a per-business
   **custom reference label** — Hotel→Room, Restaurant→Table.)
2. **A "Driver" section on the mission form** (founder dump): **required language**, **dress code** (presets keyed
   to tier), and the **message to the driver**. Drivers already store languages. Other flag ideas raised: meet &
   greet / name board, child seat, no-cash, quiet ride, luggage help, PRM, pet — a single jsonb of flags works.
3. **Smart "most-used" defaults** + **per-section why/how microcopy** + **input-driven guidance** (e.g. lots of
   luggage → "Consider a Van") (BACKLOG § L) — no schema change.
4. **Saved base addresses (favourites)** (§ L) — additive table; a hotel picks its own address in one tap.
5. **Ultra-luxury "Exception" tier** (Rolls/Bentley, above First — founder dump + IDEAS vehicle-taxonomy V2) — a
   deliberate taxonomy decision; bundle with the Bus tier / First-van / cargo-vehicle expansion.
(✅ shipped: multiple passengers (S17); keyboard nav, draft badge, calendar driver search, desktop width, and the
Review / double-submit / discard fixes (S18). ❌ the founder **declined** the sidebar-spacing tweak — leave it.)

DEFERRED until the founder okays the integration phase: **Notifications (Resend)** — the #1 functional gap
(today a Driver only sees a Pool mission if watching the screen; a Business sees an acceptance on refresh);
**real email auth** (retire dev-login); **Admin verification workspace** (BACKLOG F2 — onboards real
drivers/hotels); **Payments/Stripe**; flight tracking; analytics/monitoring.

OTHER OPEN ITEMS (pick what the founder asks):
- **Driver app redesign:** inherits the navy palette but its **layout** isn't redesigned (Dispatch is done).
  Use the D25 preview loop (or a Claude Design phone mockup), then build.
- **Navy polish (small):** Driver **"Complete ride"** uses a `success-btn` class that falls through to navy
  `.btn` — make it intentionally **green**; re-export the **logo** to harmonise its sky-blue with navy.
- **Pricing engine** (IDEAS, ❓): no objective base price by tier×body×distance×season — the Business sets the
  ceiling, PickUp recommends. Seeding approach noted in IDEAS (taxi tariff floor + base+€/km+€/min grid).
- **O7 cancellation** (driver re-pool + big red Dispatch card), **O2 guest phone to the Driver** (additive).
- **Engineering hardening (BACKLOG H2):** automated tests (money/PDP/`accept_mission`/RLS first), CI on PRs,
  generated DB types (`supabase gen types`), error monitoring.

HARD RULES (from CLAUDE.md): glossary exactly (Business, Dispatcher, Driver, Guest, Pool, PDP, Ceiling,
SPEED WIN — never "client"/"principal"); PickUp is an AGENT, never principal; PickUp ≠ PickUp Go; the Supabase
schema is ALREADY APPLIED — never re-run it (additive ALTERs only, founder-approved, in `docs/migrations/`);
build only KEEP items (Doc 02).

WORKFLOW: work on `main` (or a branch off it) for code; keep `tsc` + `next build` green; verify in the browser
preview vs the real Supabase DB. **Don't run `next build` while the `next dev` preview is running** — it corrupts
`.next` (ChunkLoadError); if it happens, `rm -rf .next` + restart the dev server. Push `main` to deploy (Claude
Code may push). Append to `project/SESSION_LOG.md` when a chunk is done; keep `project/CHANGELOG.md` updated with
a plain-language line per shipped item.
- **⚠️ Vercel auto-deploy can silently drop a commit** (happened 2026-06-25 — a push got NO deployment, so the
  live site kept the old code even though the build was fine). After `git push origin main`, VERIFY a deployment
  landed: `gh api repos/Phyrass-H/Pickup-marketplace/deployments --jq '.[0].sha'` should equal the pushed SHA. If
  it's dropped, push an **empty commit** (`git commit --allow-empty`) to re-trigger, or use the Vercel dashboard →
  Redeploy. (The deployments `?sha=` filter needs the FULL 40-char SHA.)
