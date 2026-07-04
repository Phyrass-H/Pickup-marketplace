# Prompt for the next PickUp session

> Copy-paste the block below (from "We're continuing PickUp" to the end) into a fresh
> Claude Code session. It orients a new Claude and sets the scope.

---

We're continuing PickUp (B2B VTC booking marketplace). This is a LOCAL session on my Mac; we push to
GitHub (`main`) and the app auto-deploys to Vercel. **Claude Code is allowed to push `main` to deploy**
(an `autoMode.allow` rule is set in `.claude/settings.local.json`).

START BY READING — **just these four**; they get you fully up to date without bloating context:
- `CLAUDE.md` (root) — hard rules + glossary (auto-loaded anyway).
- **This file** (`project/NEXT_SESSION.md`) — the current state + what's next (the resume point).
- `project/CHANGELOG.md` — plain-language history of everything shipped (the big picture, fast).
- `project/SESSION_LOG.md` — skim the **newest entries (Sessions 30–32, 2026-07-03/04)** for recent technical
  detail. Older sessions are in `project/SESSION_LOG_ARCHIVE.md` — don't open it unless you need deep history.

READ ON DEMAND — open these **only when the task actually touches that area** (this is the big context saver,
and it loses nothing — the docs are all still here, just read when relevant):
- `project/DESIGN_BRIEF.md` — for any UI/design work (brand, navy `#25344C`, screen inventory, constraints).
- `project/BACKLOG.md` (§ M = 2026-06-25 dump · § L = guided-form polish) · `project/DECISIONS.md` (newest
  **D38**) · `project/IDEAS.md` — for planning, "why was this decided", or parked ideas.
- `project/GUIDANCE_AUDIT.md` — the full in-app guidance inventory + gaps + roadmap (for any guidance/microcopy work).
- `docs/` — `00`–`05` + `PickUp_Phase0_Data_Spine.md`: the canonical spec; read the doc for the area you're in.
- `docs/pickup_schema.sql` (large) + `docs/migrations/` (`2026-06-17_driver_service_area`,
  `2026-06-19_vehicle_taxonomy_and_eta`, `2026-06-23_named_passengers`, `2026-06-25_mission_driver_section`,
  `2026-06-27_mission_reference`, `2026-06-27_mission_guest_contact`, `2026-06-28_mission_stops_reached`,
  `2026-06-28_business_profile_fields`, `2026-06-28_business_address_and_prefill`,
  `2026-07-04_luggage_run_phase1`) — **ONLY** for schema/data work. (All applied to the live DB.)
- For any **big read** (the schema, a wide code sweep), prefer a **subagent** that reads it and returns just the
  answer — so the bulk never enters the main conversation.

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
  - **S19/D30** — a new **"Driver & service" card** (between Trip details and Pricing): requested **languages**
    (display-only, not a hard filter), a **dress code** with a **tier-keyed anti-suit default** (eco→Driver's
    choice · business→Smart casual · First→Business formal — never suit & tie unless picked on purpose), **request
    flags** (meet & greet · greeter · luggage · child seat · quiet · pets), a **meet & greet name board** (typed
    name **or** an attached PDF/JPG/PNG, **auto-filled from the first Guest**), and a **private message to the
    Driver** (revealed post-accept). Migration `2026-06-25_mission_driver_section.sql` (applied). Driver sees
    language/dress/flags pre-accept; board + message post-accept.
  - **S20** — three Trip-details improvements. (1) The old free-text "Reference / notes" is now a **dedicated
    `reference` column** + a compact **20-char Reference** field — a Business-only schedule tag, **hidden from the
    Driver** (migration `2026-06-27_mission_reference`; legacy `comment` column now vestigial). (2) **Luggage + Flight
    number share one line** (equal halves, wraps on mobile). (3) **Passenger phones + a Share gate:** each Guest has an
    optional **phone** + a selectable, highlighted **main contact** (star); a per-phone **Share with Driver** toggle
    (off by default) in the form AND the schedule trip detail. **Airtight privacy** — numbers live in a
    **`mission_guest_contact`** side table Drivers can't read (RLS deny-by-default); `mission.passenger_names` keeps
    only `{first,last,main}`; a SHARED number is revealed to the assigned Driver post-accept via the service role
    (migration `2026-06-27_mission_guest_contact`).
- **Drafts:** a **discard confirmation** (inline "Discard this draft? This can't be undone.") + a **count badge**
  on the sidebar Drafts item, kept fresh after save/post/discard via `revalidatePath("/dispatch","layout")`.
- **Auth (testing):** key-gated dev-login on the live subdomains:
  - Business → `https://dispatch.pickupbedriven.com/dev-login?key=v1a-DbkJHN9Dw3aqWKDGSfZ9`
  - Driver  → `https://driver.pickupbedriven.com/dev-login?key=v1a-DbkJHN9Dw3aqWKDGSfZ9`
  Local (`npm run dev`): dev-login is open, no key. `GET /api/seed` (dev-only) creates a Business +
  Dispatcher + missions. Real magic-link wired but OFF (turning it on is a deferred integration).
- **Env:** `.env.local` (git-ignored) needs the 3 Supabase keys + `NEXT_PUBLIC_MAPBOX_TOKEN`; same in Vercel.
- **Shipped 2026-06-28/29 (Sessions 25–29) — all live (decisions [[d31]]–[[d34]]):**
  - **S25 — Schedule/History responsive (no schema):** the dense grid is now **fully flexible** — every column
    `minmax(floor, fr)`, so narrowing shrinks the whole row together (no more vanishing addresses / colliding
    `Route`/`Flight` headers); below the floors it holds `min-width:572px` and **side-scrolls** (`@media ≤880`).
  - **S26 — Per-stop trip progress** (migration `2026-06-28_mission_stops_reached`, `stops_reached int`): the Driver
    finally **sees the stops mid-trip** and taps **"Reached — <stop>"** (action `reachStop`) between "on board" and
    "Complete ride" (which is **guarded** until all stops done); the dense **route rail checks off live** (reached =
    green, next = accent) + an **"On board · k/N"** pill. Status enum untouched.
  - **S27 — New-mission validation (no schema):** the "Review" warning is now **dynamic** (names only what's missing,
    plain words) — fixed a latent `Number("")===0` bug that let an **un-located pickup** slip through; and a **POSTED
    mission now requires a located drop-off** (`error="nodrop"`) while **drafts stay lenient**.
  - **S28 — Business settings rebuilt** (migration `2026-06-28_business_profile_fields`): a **left-nav account area**
    (Booking/Airbnb-modelled) replacing the 4-field page — **Company** (business type / SIRET / VAT / legal name /
    registered address + Kbis), **Contact** (+ account email read-only, reception), **Branding**, **Booking defaults**;
    **Billing + Notifications** are honest **"coming soon" stubs** (agent-positioned billing copy, billing email saveable
    now). CUT: team/multi-seat, roles, financial dashboard, multi-property. Client `SettingsTabs` + per-section forms.
  - **S29 — Business-neutral saved address + pre-fill toggle + swap** (migration `2026-06-28_business_address_and_prefill`,
    renames `default_pickup_*` → `business_address_*` + adds `prefill_pickup bool`): the saved place is **"Your address"**
    (a Business can be the pickup OR the drop-off — or, for a concierge, neither). A **toggle** "pre-fill my address as
    the pickup" (default on) auto-fills it into a **new** mission's pickup (drafts keep their own; always editable), with a
    **pickup ⇄ drop-off swap** button. Groundwork for the saved-addresses book. Removed "Default Guest instructions".
- **Shipped 2026-07-03/04 (Sessions 30–32) — all live (decisions [[d35]]–[[d38]]):**
  - **S30 — Business identity → account chip in the topbar** (no schema): the Business logo + name moved OUT of the
    cramped sidebar bottom-left into a **top-right account chip** in `.dx-topbar` (a dropdown → Sign out). "PickUp
    Dispatch" stays top-left as before; Settings stays in the sidebar footer. Founder picked this (Option C) after
    seeing the "workspace header" option (B) live and preferring the topbar chip. `components/dispatch-shell.tsx`.
  - **S31 — Mission-form input-driven nudges** (no schema) + a **full guidance audit** (`project/GUIDANCE_AUDIT.md`):
    2 calm amber `.notice.warn` nudges on `/dispatch/new` that appear ONLY when the input triggers them — **luggage >
    vehicle capacity** ("consider a Van") and **night pickup** (≥22:00 or <06:00, "harder to fill; raise ceiling /
    SPEED WIN"). Never block posting. Thresholds are tunable consts. The long-distance "cover the empty return" nudge
    was **dropped** (contradicts the no-empty-return model — see [[d37]]).
  - **S32 — Luggage-vehicle Phase 1 ("van for luggage")** (migration `2026-07-04_luggage_run_phase1`: `mission.luggage_only`
    + `driver.accepts_luggage_runs`, both bool default false): a **Trip type: Passengers | Luggage only** toggle on the
    new-mission form → luggage mode **forces Van + Business, hides passengers, keeps bags**; Van Drivers **opt in** at
    enrollment/settings (off by default); the **Pool routes luggage runs only to opted-in Van Drivers** and labels them
    **"Luggage run · no passengers · N bags"** (Pool card + Driver detail + Business schedule). Phase 2 (V2) = real
    cargo/truck classes by volume + the grouped car+van booking. [[d38]]
- **VERIFICATION NOTE (this stretch):** another chat held the `next dev` server on **:3000**, so the preview/Chrome MCPs
  couldn't reach it. Workaround that worked well: a **static harness** (a tiny Node server on :4612 serving an HTML page
  that `<link>`s the **real** `app/globals.css` + the actual component markup) for CSS/layout checks, plus an **isolated
  `next build` in a detached git worktree** (`node_modules` symlinked, `.env.local` copied) to validate compile/RSC
  without corrupting the running server's `.next`. Reuse these when :3000 is taken.

LEGAL — **not a build blocker.** The founder (Céline) owns the legal track personally; a lawyer writes the real
Terms/Privacy/positioning later. Do **not** gate work on legal or add "needs a lawyer" flags. Keep the glossary
+ agent/intermediary framing in code/copy (a product rule, not a legal gate). Sharing the Guest phone is fine for
the MVP — and is now an explicit **per-phone Business choice** (S20 Share gate), kept private from Drivers until shared.

RECOMMENDED NEXT STEP (features/polish phase). Sessions 30–32 shipped the topbar account chip, the mission-form
input-driven nudges (+ a full guidance audit), and **luggage-vehicle Phase 1**. **PRICING is IN PROGRESS — the founder
is working on the model themselves** (how a Ceiling / base-fare is estimated; one-way vs round-trip). Key principle to
respect: **[[d37]] — NO empty-return charge**; a smart trajectory-based Pool solves the deadhead instead. Don't build a
pricing engine until the founder brings the rule; the **suggested Ceiling/base-fare range** on the form (highest-leverage
guidance win) waits on it. Everything below is buildable now, no third-party APIs; any NEW field = a small founder-run
additive migration:
1. **Mission-form guidance — Tier 2** (see `project/GUIDANCE_AUDIT.md`; mostly NO schema): a small **"?" glossary
   tooltip** for the core terms (Ceiling, Pool, SPEED WIN, Lock-in, the status pills — taught in fragments today,
   defined nowhere), a **Dispatch status legend**, and **Lock-in/T-180 in plain words** both sides. Plus **smart
   "most-used" defaults** + wiring the Business **default vehicle class** (Settings → Booking defaults) into the form
   (saved but not read yet). Keep it **non-invasive** ([[d36]]); concept teaching is largely the **standalone tutorial's**
   job (the founder is building it).
2. **Saved-addresses address book** (BACKLOG § L) — the Business's own address is its **first saved place** (S29), and
   the pre-fill + **swap** plumbing already exists. Next: a small additive table for **multiple** saved addresses + a
   one-tap insert/picker on both ends of the new-mission Route card.
3. **Driver app redesign** — it inherits the navy palette but its *layout* isn't redesigned (Dispatch is done). Use the
   D25 preview loop (or a Claude Design phone mockup), then build. Small navy polish bundled here: Driver **"Complete
   ride"** → green; re-export the **logo** to harmonise its sky-blue with navy.
4. **Luggage-vehicle Phase 2 (V2)** — real cargo/truck classes by **volume/m³ bands** (the "20 m³" idea, likely a
   partly separate fleet) + the grouped **car + luggage van** booking (the CUT grouped-mission feature; the cargo leg
   can "stop before the end" of the passenger trip). Bundle with the **Exception tier** (Rolls/Bentley above First) /
   Bus tier / First-van / PRM taxonomy expansion.
(✅ shipped 2026-07-03/04, S30–S32 — see the "Shipped" block in CURRENT STATE + [[d35]]–[[d38]]: the topbar account chip;
the 2 input-driven nudges + guidance audit; luggage-vehicle Phase 1. Earlier S25–S29 ([[d31]]–[[d34]]): schedule
responsive; per-stop progress; new-mission validation; Business settings area; business-neutral saved address. ❌ the
founder **declined** the sidebar-spacing tweak — leave it.)

DEFERRED until the founder okays the integration phase: **Notifications (Resend)** — the #1 functional gap
(today a Driver only sees a Pool mission if watching the screen; a Business sees an acceptance on refresh);
**real email auth** (retire dev-login); **Admin verification workspace** (BACKLOG F2 — onboards real
drivers/hotels); **Payments/Stripe**; flight tracking; analytics/monitoring.

OTHER OPEN ITEMS (pick what the founder asks):
- **Driver app redesign:** inherits the navy palette but its **layout** isn't redesigned (Dispatch is done).
  Use the D25 preview loop (or a Claude Design phone mockup), then build.
- **Navy polish (small):** Driver **"Complete ride"** uses a `success-btn` class that falls through to navy
  `.btn` — make it intentionally **green**; re-export the **logo** to harmonise its sky-blue with navy.
- **Pricing engine** (IDEAS, ❓) — **founder is working on this now.** No objective base price by tier×body×distance×season;
  the Business sets the ceiling, PickUp recommends. Principle: **NO empty-return charge** ([[d37]]) — a smart trajectory
  Pool handles the deadhead. Seeding approach in IDEAS (taxi tariff floor + base+€/km+€/min grid). Don't build until the
  founder brings the rule; then the suggested Ceiling/base-fare range on the form follows.
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
