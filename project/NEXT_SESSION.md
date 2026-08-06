# Prompt for the next Kavenue session

> Copy-paste the block below (from "We're continuing Kavenue" to the end) into a fresh
> Claude Code session. It orients a new Claude and sets the scope.

---

We're continuing Kavenue (B2B VTC booking marketplace). This is a LOCAL session on my Mac; we push to
GitHub (`main`) and the app auto-deploys to Vercel. **Claude Code is allowed to push `main` to deploy**
(an `autoMode.allow` rule is set in `.claude/settings.local.json`).

START BY READING — **just these four**; they get you fully up to date without bloating context:
- `CLAUDE.md` (root) — hard rules + glossary (auto-loaded anyway).
- **This file** (`project/NEXT_SESSION.md`) — the current state + what's next (the resume point).
- `project/CHANGELOG.md` — plain-language history, the **recent entries** (the big picture, fast). Older entries live in
  `project/CHANGELOG_ARCHIVE.md` — read it only if you need the deep history.
- `project/SESSION_LOG.md` — skim the **newest entries (Sessions 44–46)** for recent technical detail. Older sessions
  (1–33) are in `project/SESSION_LOG_ARCHIVE.md` — don't open it unless you need deep history.

READ ON DEMAND — open these **only when the task actually touches that area** (this is the big context saver,
and it loses nothing — the docs are all still here, just read when relevant):
- `project/DESIGN_BRIEF.md` — for any UI/design work (brand, navy `#25344C`, screen inventory, constraints).
- `project/BACKLOG.md` (§ M = 2026-06-25 dump · § L = guided-form polish) · `project/DECISIONS.md` (newest
  **D39**) · `project/IDEAS.md` — for planning, "why was this decided", or parked ideas.
- `project/GUIDANCE_AUDIT.md` — the full in-app guidance inventory + gaps + roadmap (for any guidance/microcopy work).
- `docs/` — `00`–`05` + `Kavenue_Phase0_Data_Spine.md`: the canonical spec; read the doc for the area you're in.
- `docs/kavenue_schema.sql` (large) + `docs/migrations/` (`2026-06-17_driver_service_area`,
  `2026-06-19_vehicle_taxonomy_and_eta`, `2026-06-23_named_passengers`, `2026-06-25_mission_driver_section`,
  `2026-06-27_mission_reference`, `2026-06-27_mission_guest_contact`, `2026-06-28_mission_stops_reached`,
  `2026-06-28_business_profile_fields`, `2026-06-28_business_address_and_prefill`,
  `2026-07-04_luggage_run_phase1`, `2026-07-05_mission_info_edited_at`,
  `2026-07-07_mission_amendment`, `2026-07-10_mission_info_change`, `2026-07-13_o7_cancellation`,
  `2026-07-19_agreed_release`, `2026-07-19_repool_speedwin_window`, `2026-07-19_no_show_clock_origin`,
  `2026-07-19_no_show_airport_label`, `2026-07-19_guest_ready_at_guard`, `2026-07-22_waiting_fee`,
  `2026-07-22_airport_accent_fix`, `2026-07-22_guest_ready_at_guard_fix`, `2026-07-25_accept_always_confirms`,
  `2026-07-28_driver_account_and_documents`) —
  **ONLY** for schema/data work. (All applied to the live DB.)
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
4. **⚠️ ASK BEFORE YOU START.** Do NOT read this file and launch straight into the listed priority — it records what *was*
   planned, not what the founder wants today. Orient, propose the scope in 1–2 lines, wait for a yes. (S44: the rename was
   started unprompted and the Driver-card prep had to be halted mid-turn.)
5. **⚠️ BE BRIEF — context is a real budget.** In S44 ~**83% of the context window went to Claude's own chat messages.**
   Report results, not narration. **Never post "still working / still waiting" turns** — background tasks re-invoke you
   automatically, so wait silently. Don't restate plans or re-explain finished work. Push big reads into a **subagent**
   that returns just the answer. Long-form detail belongs in `project/SESSION_LOG.md`, not the chat.

## DB MIGRATIONS — Claude can't run them; the founder does
The schema is already applied (hard-rule #4). For an **additive** column/enum: write the SQL to
`docs/migrations/<date>_<name>.sql`, give the founder the one-liner, and they run it in the **Supabase SQL
editor** (Claude's app keys go through PostgREST = rows only, NOT DDL). Then build + verify + deploy. The DB
also keeps the running app's data, so the dev server reads the **real** Supabase DB.

CURRENT STATE (live, deployed from `main`):
- **⚑ THE APEX IS NO LONGER THIS APP (2026-08-05).** `kavenue.fr` + `www.kavenue.fr` were moved to a **separate
  Vercel project + separate repo** for the marketing site (`Phyrass-H/kavenue-landing`, local folder
  `../kavenue-landing`). Founder's call after weighing a route group inside this repo: they wanted a hard wall.
  **This app now only ever receives `driver.kavenue.fr` and `dispatch.kavenue.fr` in production**, so the old
  `LandingSplash` branch in `app/page.tsx` was unreachable and both it and `components/landing-splash.tsx` are
  deleted. `lib/hosts.ts` is untouched — `isProdDomain`/`roleSubOf` still enforce role-per-subdomain in the two
  route-group layouts. Runbook + brand rules for the marketing site: **`project/LANDING_HANDOFF.md`**.
  ⚑ **Brand-token drift is the standing cost of the split:** the tokens are copied verbatim into the landing
  repo's `app/globals.css`. Change a colour here, change it there.
  ⚑ **Landing decisions live in `../kavenue-landing/CLAUDE.md` §0 — NOT in this repo's DECISIONS.md.** As of
  2026-08-06: **D-L1** English only for now (French is a later pass; no i18n routing yet) · **D-L2** *no geography
  anywhere on the site* (no "French Riviera", no city names — it talks to everyone) · **D-L3** no Driver count, in
  any wording. More will have been added since. **If you need to know what the public site says, read that file.**
  The full context pack for that repo is `../kavenue-landing/brief/` (8 files, self-contained — don't duplicate it here).
- **Custom domain + role subdomains — `kavenue.fr` since 2026-07-29 ([[d60]]):**
  `www.kavenue.fr` → 308 → apex (both now on the LANDING project) · `driver.kavenue.fr` = Driver app ·
  `dispatch.kavenue.fr` = Business/Dispatch (both still on this project).
  Each subdomain has its own host-only session cookie. Mapping in `lib/hosts.ts` (no-op on localhost +
  `*.vercel.app`). Registrar **OVHcloud**, DNS zone at OVH (app records + mail records in one zone), Vercel project
  renamed **`kavenue`**. `pickupbedriven.com` is removed from Vercel (404) but still registered.
  ⚑ **DNS at OVH was NOT touched** by the split — only the project↔hostname binding inside Vercel changed.
- **Email — Google Workspace on `kavenue.fr`:** one paid mailbox `phyrass@kavenue.fr`; **`support@` · `feedback@` ·
  `contact@` are free aliases into it** (`support@`/`feedback@` are hardcoded in the app — Driver help card +
  Dispatch settings). SPF + DKIM + DMARC all verified `pass` on a real message. **DMARC is at `p=none`** (monitor
  only) — tighten to quarantine → reject once the reports show only your own senders.
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
  - Business → `https://dispatch.kavenue.fr/dev-login?key=v1a-DbkJHN9Dw3aqWKDGSfZ9`
  - Driver  → `https://driver.kavenue.fr/dev-login?key=v1a-DbkJHN9Dw3aqWKDGSfZ9`
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
    cramped sidebar bottom-left into a **top-right account chip** in `.dx-topbar` (a dropdown → Sign out). The topbar
    wordmark (now "Kavenue Dispatch") stays top-left as before; Settings stays in the sidebar footer. Founder picked this (Option C) after
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
- **Shipped 2026-07-05 (Sessions 33–34) — all live ([[d39]]):**
  - **S33 — Calendar redesign** (no schema): the Dispatch calendar rebuilt into a **month "load-map"** (readable
    status-railed chips instead of near-white pastel tints, past-day dimming, a **status legend**, honest month-total
    KPIs) + a **week vertical time-grid** (hour axis, day headers, uniform cards at pickup time, overlap lane-splitting,
    a client-only navy "now" line) + a **trip-focused day panel** (click any chip/card → panel opens with THAT trip
    expanded). **Deep links** `/dispatch?open=<id>` (row expands + scrolls, opens the past-day fold) and
    `/dispatch?day=<key>` (`components/scroll-to-trip.tsx`). View+week persist in the URL (reload/Back-Forward safe).
    Founder rejected a horizontal hotel-tape-chart + duration-scaled cards ("a trip is a pickup moment"). Files:
    `components/dispatch-calendar.tsx` (rewrite), `app/(dispatch)/dispatch/calendar/{page,loading}.tsx`. 13-agent
    adversarial review → 7 findings fixed (incl. a real hydration mismatch on the now-line → gated client-only).
  - **S33 follow-ups (no schema):** the **night-pickup nudge moved from the Schedule card to the Pricing card** on
    `/dispatch/new` (it's pricing advice). **Dev-only Pool `?all=1`** (gated by the `NODE_ENV/VERCEL` hosted-check, like
    dev-login) bypasses the tier/zone/body/luggage filters so ONE demo Driver can test the whole Pool (a Class-E sedan
    now sees van/luxury/luggage runs). `app/(app)/pool/page.tsx`.
  - **S34 — Edit a posted trip's INFO without changing price** (migration `2026-07-05_mission_info_edited_at`): new
    route **`/dispatch/[id]/edit`** — a Business edits the info a Driver sees (guests+phones, flight, luggage, reference,
    Driver & service) with **price/route/time locked**. `updateMissionInfo` **whitelists only info columns** (never
    `base_fare/ceiling/pdp_*/created_at/category/pickup*/dropoff*/waypoints/distance/duration/zone/status`), atomic
    status guard (`.in pooled/accepted/confirmed`), mirrors createMission for parsing + board-file + guest-contact
    upsert. Reuses the exact new-mission info sub-components (`PassengerList`/`ReferenceField`/`DriverServiceFields`).
    Entry = **"Edit details" at the TOP of the expanded trip detail**; an **"Edited · <time>"** stamp shows in the
    detail ONLY (never the collapsed row), stamped by `info_edited_at`. Security+parity review → 0 findings. [[d39]]
- **Shipped 2026-07-10 (Sessions 36–38) — all live ([[d41]]–[[d44]]):**
  - **S36 — Expanded trip-row redesign + a "what changed" trail** (migration `2026-07-10_mission_info_change`): the flat
    15-row `.kv` detail rebuilt into grouped, scannable sections — a **scan-strip** (Pickup · Vehicle · Flight · **Fare
    right**), a **route card** (full addresses + a dot-to-dot connector that STOPS at the drop-off dot + trip
    distance/duration in the header), a **slim one-line Driver bar** ("No Driver yet" when unassigned), and **Service ·
    Guests side by side** with **chips** for languages/dress/requests. New `.dx-*` classes; the flat `.kv`/`.route` stay
    for other pages. **"See what changed"**: the amendment **"Change accepted"** state now shows the fare/route diff (no
    schema, existing `AmendmentBrief`); and **detail edits** log a diff to the new **Business-only `mission_info_change`**
    side table (deny-by-default RLS — the diff can hold the private reference/guest names) via `lib/info-changes.ts`,
    rendered as a `.dx-trail` line. Files: `components/trip-row.tsx` (rewrite), `app/globals.css`, `dispatch/page.tsx`,
    `dispatch/[id]/edit/actions.ts`, `lib/database.types.ts`. D25 previews v1→v5 signed off. [[d41]]
  - **S37 — Mission-form polish** (no schema): (1) **review-before-posting card** lightly polished to the S36 vocabulary
    (route rail + chips); (2) **Guest names auto-capitalise** the first letter; (3) **numeric fields** (luggage / base
    fare / ceiling) reject letters/`e`/`+`/`-` via a controlled sanitize (`type=text`+`inputMode`; phone stays flexible);
    (4) the **edit trail leads with the bold edit time**; (5) a live **vehicle-reminder chip** in the Pricing card head
    (class·body). Files: `mission-form.tsx`, `passenger-list.tsx`, `trip-row.tsx`, `edit-form.tsx`, `globals.css`. [[d42]]
  - **S38 — Address search: Riviera-first Mapbox cleanup** (no schema, `components/address-autocomplete.tsx` only):
    countries narrowed `fr,mc,it,ch,de,es,…` → **`fr,mc,it,ch`** + a client **Riviera-first re-rank** (`isRiviera()` floats
    Côte d'Azur hits to the top without hiding far destinations). "aéroport t2" now returns the Nice result at #1. **Mapbox
    POI ranking is still weak for prominent places** → **Google Places is the planned fix, DEFERRED until the founder
    registers the final domain** (so the API key is restricted once) — see BRAND/DOMAIN below + [[d43]].
- **Shipped 2026-07-13 (Session 39) — O7 cancellation spine, LIVE ([[d45]]; migration `2026-07-13_o7_cancellation` applied):**
  - **Driver cancel** (always 100% → re-pools as SPEED WIN; escape valves shown first — copilote "Soon", call the Business),
    **Business cancel** (FREE while pooled / >5h, then 50% at −5h, +10%/h → 100%; a live-% modal), **No-show** (on-site
    `arrived` + wait window 60 m airport / 20 m city → Business charged full, Driver paid like a completed trip; **amber**
    button + a "be sure" nudge), **T-60 reclaim** (assigned Driver never confirmed + unreachable → re-pool, penalty-free).
    Atomic SECURITY DEFINER RPCs (`driver_cancel_mission` / `business_cancel_mission` / `reclaim_mission` / `mark_no_show`)
    mirroring `accept_mission` + a `mission_cancellation` audit table. `lib/pdp.ts` climbs from `pooled_at ?? created_at`;
    `lib/cancellation.ts` shares the % ramp + airport heuristic. Files: `app/(app)/rides/cancel-noshow.tsx`,
    `components/dispatch-cancel.tsx`, `app/(dispatch)/dispatch/actions.ts`, `rides/actions.ts`, `trip-row.tsx`,
    `dispatch-status.ts`, `pdp.ts`, `database.types.ts`. Fee **amounts settle MANUAL** in beta; the rules are fixed.
  - **Verified** end-to-end vs the live DB via real authenticated sessions (5 money paths + 5 adversarial guards) + a
    3-lens adversarial review → **3 fixes applied** (supersede a pending amendment on re-pool; lock down status_event
    spoofing; keep the business-cancel reason private from the Driver). Deployed `e9052d7` → Vercel Production `success`.
  - **⚑ Flagged (BACKLOG § H2 — before real Business users / payments; NOT O7 regressions):** `p_mission_business_update`
    has no WITH CHECK (a Business could bypass the fee via a raw PostgREST UPDATE — **HIGH for prod**, ~nil in beta);
    `currentFare` doesn't freeze at `accepted_at` so the fee BASIS inflates to the ceiling (a **pricing-engine decision**);
    `p_fare_snapshot` is client-forgeable (recompute in SQL with the pricing engine); a mid-run Business cancel vanishes
    from the Driver's My Rides (pairs with notifications).
  - **✅ Agreed release SHIPPED (S40, below).** Remaining O7 piece: the **copilote hand-over** (Phase 2 — needs the community layer).
- **Shipped 2026-07-19 (Session 40) — O7 agreed release + the 24h re-pool window, LIVE ([[d46]]; migrations
  `2026-07-19_agreed_release` + `2026-07-19_repool_speedwin_window` applied):**
  - **Agreed release (Business-initiated).** The Business taps **"Agreed release · free"** (distinct from the fee Cancel) →
    the Driver **must accept** → the trip releases **free (no fee, no reliability mark)** and re-pools; decline → stays as
    agreed. New `mission_release` **append-only evidence** table (declines retained; `dismissed_at` hides-without-deleting;
    stores who/when/note/decision/fare/hours-before-pickup → dispute proof + per-Business abuse counts). ALL writes via
    SECURITY DEFINER RPCs `propose_release` / `respond_to_release` / `close_release` (no client write policy → tamper-proof).
    Driver `components/release-card.tsx` + `respondToRelease`; Business `components/dispatch-release.tsx` + `proposeRelease` /
    `closeRelease`; schedule states + gates in `trip-row.tsx`. Guardrails: declining is framed free/safe/no-mark; the Business
    decline state is calm. Review-weaponisation → gate a future Business→Driver review system to completed-trip + double-blind (logged).
  - **24h re-pool SPEED-WIN window (supersedes D45 "always 70%").** ALL re-pool paths (driver cancel · reclaim · release):
    **<24h → SPEED WIN** (70% / 5-min climb) · **≥24h → normal Pool** (50% / 10-min climb, SPEED WIN off) — the fresh-posting
    curves. `create or replace` of the 4 O7 RPCs.
  - **3-lens adversarial review → 6 fixes** (supersede pending release on cancel/reclaim/business-cancel; gate release cards to
    a still-releasable trip; `respond_to_release` lock order mission→release). **Verified live 28/28** vs the real DB via real
    Business+Driver sessions (pricing branches · free re-pool · decline · supersede · deny-by-default writes). Deployed `d939df7` → Vercel `success`.
- **VERIFICATION NOTE (this stretch):** another chat held the `next dev` server on **:3000**, so the preview/Chrome MCPs
  couldn't reach it. Workaround that worked well: a **static harness** (a tiny Node server on :4612 serving an HTML page
  that `<link>`s the **real** `app/globals.css` + the actual component markup) for CSS/layout checks, plus an **isolated
  `next build` in a detached git worktree** (`node_modules` symlinked, `.env.local` copied) to validate compile/RSC
  without corrupting the running server's `.next`. Reuse these when :3000 is taken.
- **Shipped 2026-07-22 (Session 41) — the no-show CLOCK ORIGIN fix, LIVE ([[d47]]; migrations `2026-07-19_no_show_clock_origin`
  + `2026-07-19_no_show_airport_label` + `2026-07-19_guest_ready_at_guard` applied):** the free-wait countdown was anchored to
  the **Driver's `arrived` tap** in both the client and `mark_no_show` — the wrong party. It now runs from **when the GUEST was
  due** = `coalesce(guest_ready_at, pickup_at)`; reporting unlocks at `greatest(guest_due + wait, arrived_at + 5 min)`. This
  **closed a live exploit** (`advanceStatus` has no time guard → a Driver could tap through ~33h early, wait out the 20-min
  window, and file a no-show, charging the Business full fare before the trip). `mission.guest_ready_at` (new, nullable) is the
  flight-tracking hook — NULL today, so airport falls back to the booked time. `arrived` stays a *precondition to report*, not the
  origin. Verified 9/9 live. **Guard saga:** two attempts to lock `guest_ready_at` were no-ops (a column REVOKE against a
  table-level grant; a SECURITY DEFINER trigger sees the owner in `current_user`) — fixed 3rd try (Session 42) by dropping
  `security definer`.
- **Shipped 2026-07-23 (Session 42) — WAITING FEES + a hard end-to-end stress test, LIVE ([[d48]]; migrations
  `2026-07-22_waiting_fee` + `2026-07-22_airport_accent_fix` + `2026-07-22_guest_ready_at_guard_fix` applied; deployed `0aed706`):**
  - **D48 waiting model.** Founder chose "pay the Driver to wait" over reschedulable time. **Courtesy wait** (renamed from "free
    wait") 20 city / 60 airport, then **€1/min started** Business→Driver, ceiling **€40 city / €60 airport**. The ceiling stops
    the MONEY not the trip (a `least()` clamp — no cron needed). **Two exits, both confirmed:** the Driver reports, or the
    Business declares via net-new **`business_declare_no_show`**. `business_cancel_mission` **also settles accrued waiting** (else
    Cancel was strictly cheaper than "stop waiting" — the loophole the pre-build review caught). A booked trip's **`pickup_at` is
    frozen after draft** (blanket trigger) → dissolves the postpone-then-cancel fee dodge. Net-new Business UI: the Dispatch row
    now **shows the running meter** (before it showed nothing while a Driver waited). Files: `lib/cancellation.ts`,
    `rides/cancel-noshow.tsx`, `components/dispatch-waiting.tsx`, `dispatch/actions.ts`, `trip-row.tsx`; one shared SQL
    `mission_waiting()` / `mission_is_airport()` so the three settlement paths can't drift.
  - **⚑ The bug of the session — found by PROBING, not reading.** The airport predicate `a[eé]roport` used a bracket expression
    with a multibyte char; **Postgres `~*` doesn't reliably match it**, so `"Aéroport Nice Côte d'Azur"` (the exact Mapbox string
    for the main airport) classified CITY → every accented airport pickup without a flight number got 20 min instead of 60. Latent
    since 2026-07-13. Fixed by matching the ASCII substring `roport`. **NOTE: this was Postgres, NOT Mapbox — moving to Google
    Places would NOT have fixed it.**
  - **Verification:** 13/13 live (clock + waiting) + a 3-door settlement proof (Business charged == Driver paid, no cheaper door)
    + a **12-battery / 49-case end-to-end stress test** on a tagged 14-driver/3-business fleet (accept atomicity · both cancel
    paths · no-show clock · waiting math · money conservation · **concurrency race x5, exactly one winner** · release · amendment ·
    reclaim · RLS/privacy · guards) → **49/49 GREEN, 0 real bugs**, DB restored to baseline 34 missions. Fleet lib +
    test scripts live in the **session scratchpad only** (never the repo).
- **Shipped 2026-07-24 (Session 43) — DRIVER POOL REDESIGN + bottom tab bar, LIVE ([[d49]]; NO migration —
  `mission_type` `'transfer'|'hourly'` + a nullable `dropoff_address` already exist in the schema; deployed `56211e7`):**
  the Driver app finally gets a layout redesign (**Pool first**). Decided via the D25 preview loop (v1→v9 mockups), built to match.
  - **Bottom tab bar** (`components/driver-tabbar.tsx`) replaces the old top text-nav (`components/app-header.tsx` DELETED):
    Pool (stack / Lucide `Layers`) · My Rides · **Earnings (net-new 4th tab)** · Settings. **Sign out** moved into Settings
    (`components/driver-signout.tsx`). Content in `<main class="dapp-main">`.
  - **Pool card rewrite** (`components/mission-card.tsx`) to the approved v9 mockup — uniform, refined weights (**nothing
    700**): fare+when head, a gentle divider, **mission-only badges** (Transfer / At disposal / SPEED WIN / Luggage run — the
    vehicle class is **demoted** to a discreet footer note, it's the Driver's own car), a **Dispatch-style route rail** (navy
    dot → line → grey mid-dot **"+N"** → hollow ring), **full 2-line addresses**, and a **one-line footer** (distance·duration
    + discreet vehicle | service icons **capped 3 + N by priority**: child seat>pets>luggage>meet&greet>greeter>dress>
    language>quiet>flight). New `formatPoolWhen()` (Today/Tomorrow/weekday + date). New CSS `.dtabbar/.pcard/.proute/.pbadge`
    (the shared `.card/.route/.badge` untouched — still used by the un-redesigned Driver screens).
  - **Earnings** = honest "coming soon" placeholder (its own screen = a later D25 pass). Verified in-browser vs the real DB;
    **3-lens adversarial review (13 agents) → 6 fixes** (DST "Tomorrow", iOS safe-area `viewportFit:'cover'`, `.ac-list`
    z-index above the tab bar, icon a11y, muted-grey **WCAG-AA contrast**, real `<h1>`s). `tsc` clean.
  - **⚑ Parked:** the discreet **vehicle** footer note — keep (truncates to "Business · Se…" on a narrow card) or drop
    (redundant). **NOT redesigned yet:** My Rides / mission detail / Settings / the Earnings screen / Pool empty+loading.
- **Shipped 2026-07-25 (Session 44) — the PickUp → Kavenue RENAME, LIVE ([[d51]]; NO migration, NO behaviour change):**
  a pure brand rename across **51 files**: user-facing copy (Dispatch topbar wordmark, login/welcome/dev-login titles, the
  FR+EN legal pages, Settings, cancel/no-show and release/amendment copy), `app/layout.tsx` metadata + `appleWebApp.title`,
  `public/manifest.webmanifest`, `package.json`/`package-lock.json` (`kavenue-driver`), `README.md`, `.claude/launch.json`,
  every `docs/` + `project/` doc, and SQL **comments only** in `docs/migrations/*.sql`. Two files git-renamed (tracked as
  renames, history preserved): `docs/PickUp_Phase0_Data_Spine.md` → **`docs/Kavenue_Phase0_Data_Spine.md`** and
  `docs/pickup_schema.sql` → **`docs/kavenue_schema.sql`**, with all 12 references updated.
  - **Method:** 7 parallel edit agents partitioned by file (no two touching the same file) under an explicit never-rename
    ruleset, then **4 adversarial verify lenses** (missed-brand · over-rename · reference-integrity · copy-coherence).
    The over-rename lens ran a **mechanical reversibility check** — reverse every added line and diff it against the removed
    line — **0 mismatches across all 209 changed lines**, proving no collateral edits. 23 findings → all real ones fixed
    (the big one: `project/NEXT_SESSION.md` had been skipped entirely and still claimed the rename hadn't happened).
  - **Verified:** `tsc --noEmit` clean · `next build` green (24 routes) · **18 routes fetched in-browser against the real
    Supabase DB → 0 occurrences of "PickUp"** in rendered HTML, including the PWA manifest and both legal pages · no
    console errors · French legal copy checked for élision (Kavenue is consonant-initial, so "de Kavenue" is correct).
  - **⚑ Founder actions:** **✅ The domain migration is DONE — S49, [[d60]].** **✅ The repo directory is DONE — S53,
    2026-08-06:** the folder is now `02_Cactus/Kavenue/Kavenue_project_dev` (both levels renamed), and the matching
    `~/.claude/projects/` directory moved with it, so the session history and memory survived. **Still open:** rename the
    **GitHub repo** `Phyrass-H/Pickup-marketplace` (outward-facing, your account, and it breaks the git remote — yours).
    Also flagged, not
    touched: `.claude/settings.local.json` line 42 mentions the old brand inside a permission rule and line 32 has a stale
    `pickup_schema.sql` path (a dead entry — that path was already wrong pre-rename) — it's your permissions config, so
    edit it yourself if you want it tidy.
- **Shipped 2026-07-25 (Session 45) — the two remaining Driver cards redesigned, LIVE ([[d52]]; deployed `1a1e5b6`; NO
  migration):** `/missions/[id]` pre-accept reads as "the Pool card, opened" (uncollapsed route rail + a Service card +
  a `.dlock` reveal + a plain `Accept mission`); the My Rides card leads with STATE not price (`.dpill` + `.dprog` bar +
  `.dcall` tap-to-call + `.dnote` prep box, fare in the foot). One filled button per screen; no-show + cancel are
  `.dquiet`; Complete ride is green. Both reuse `.pcard*`/`.proute*`. **These Driver pages scroll by design.**
- **Shipped 2026-07-25 (Session 46) — My Rides restructure + Pool empty/loading + pre-accept polish + Option A, LIVE
  ([[d53]]–[[d55]]; migration `2026-07-25_accept_always_confirms` applied; deployed `7dd4c34` · `950612f` · `ea33515`):**
  - **D53 — My Rides is a tap-through LIST, and each trip opens its own page.** `/rides` = a clean list of `<Link>`
    cards (state · when · progress · route · fare), **current + upcoming only** (completed → History); a "change/release
    is waiting" flag when one is answerable. **`/missions/[id]` now branches by ownership:** OWNED → the full run view
    (new `components/mission-run-view.tsx`) + `← My Rides` + every action (status advance · waiting meter · no-show ·
    cancel · amendment/release cards); OWNED + terminal → read-only + `← History`; POOLED → the unchanged pre-accept +
    Accept + `← Back to Pool`. Contact/phone reveal moved into the per-mission page, still gated to `isMine`. Amendment/
    release builders extracted to `lib/mission-cards.ts`. Copy: shorter generic "pro move" nudge; report button drops
    "you're paid". 3-lens adversarial review → 3 fixes (amendment/release gating · swallowed arrived-read error · icon).
  - **D54 — Pool loading + empty states.** New `pool/loading.tsx` (skeleton cards, `dx-pulse`, staggered); both empty
    states rebuilt into a calm `.pempty` block (no-trips **names the filter**; no-service-area = a setup CTA to Settings).
  - **D55 — pre-accept polish + Option A.** Removed the redundant zone from the pre-accept footer; shortened the unlock
    line to "Private details unlock once you accept."; and **accept now ALWAYS confirms immediately** (dropped the
    Lock-in <3h gate that left 3h+ trips stuck `accepted` with no controls — nothing fired the T-180 auto-confirm). The
    migration replaces `accept_mission` + backfills existing `accepted` → `confirmed`. **The `accepted` status is now
    vestigial** (no path produces it). Verified live: accept → `confirmed`, controls immediately.

LEGAL — **not a build blocker.** The founder (Céline) owns the legal track personally; a lawyer writes the real
Terms/Privacy/positioning later. Do **not** gate work on legal or add "needs a lawyer" flags. Keep the glossary
+ agent/intermediary framing in code/copy (a product rule, not a legal gate). Sharing the Guest phone is fine for
the MVP — and is now an explicit **per-phone Business choice** (S20 Share gate), kept private from Drivers until shared.

**★ SESSION-46 — SHIPPED (2026-07-25).** Everything on the Driver track this session is done + deployed (see the S46
CURRENT STATE block above). What each proposed item became:
1. **✅ S45 verification gap — CLOSED.** The `arrived` waiting-meter + capped state + no-show confirm verified live.
2. **✅ Pool empty + loading states — SHIPPED ([[d54]]).**
3. **Earnings tab — DEFERRED, and deferred AGAIN in S47** (the founder chose My Rides, then Driver Settings ahead of it).
4. **✅ Discreet-vehicle note — DECIDED: KEEP** (founder). Left on the Pool card as-is; only the redundant **zone** was
   removed from the *pre-accept* footer ([[d55]]).
5. **✅ Also shipped, unplanned:** the My Rides restructure ([[d53]]) + Option A "accept always confirms" ([[d55]]).

- **Shipped 2026-07-26 (Session 47) — MY RIDES: Upcoming | Past tabs + day separators + the Past archive, LIVE
  ([[d56]]; NO migration; deployed `0fcb831` → Vercel `success`):** the founder re-ordered S47 — My Rides before
  Earnings ("the history is an ugly link in the header").
  - **Tabs** (`components/rides-tabs.tsx`): a segmented **Upcoming | Past** control (founder picked style A over
    underline) with counts, replacing the `History →` corner link. Deliberately still **two routes** (`/rides` +
    `/rides/history`) — each keeps its own server query and every deep link still lands.
  - **Upcoming:** **day separators** (Today / Tomorrow / Friday 31 July + a ride count) from consecutive `parisDayKey`
    runs; new DST-safe `formatDayGroup()`. The card now shows **only the time** (the day is written above it).
  - **Past:** rebuilt off the old `.card`/`.route` markup onto a lighter **`.pastcard`** (date, small pill,
    single-line route, Business + fare), month groups, and server-side **All | Completed | Cancelled** filter chips
    (a filter row, NOT a third tab). **No money totals** (Earnings owns money). A **cancelled trip shows "—", not €0**
    — its payout depends on who cancelled and when ([[d45]]) and settles manually in beta.
  - **⚑ The privacy rule:** a **Guest's data leaves the Driver's app once the trip closes** — name, phones, name board
    and the Business's private message, enforced **server-side** (`mission_guest_contact` is never queried for a
    terminal mission). Kept: date/route/fare/status + **Business & Dispatcher** (dispute route). **Dispatch untouched.**
  - Designed **empty states per tab**; `formatMonth` fixed `fr-FR` → `en-GB` (month headings read "July 2026" now, both
    Driver and Dispatch history). Verified live on a tagged 8-mission set, DB restored to its 34-mission baseline.
- **Shipped 2026-07-28 (Session 47, part B) — the archive tells the WHOLE truth, LIVE ([[d57]]; NO migration; deployed
  `3025c4a` → Vercel `success`):** a **driver cancel** and an **agreed release** re-pool the trip and clear `driver_id`,
  so they had **vanished from the Driver's app entirely** — a Driver could pay a 100% penalty and take a reliability
  mark with no record anywhere. Past is now a union of missions + those two events (read from
  `mission_cancellation.actor_driver_id` / `mission_release.driver_id`, which their own RLS already allows), sorted
  together; the events' missions come via the service role gated to those ids, and their cards are **not tappable**
  (the mission may belong to another Driver now). Money reads in the Driver's direction: **Compensation · Penalty (red)
  · Free · —**. **The Business's cancellation reason is now shown to the Driver** — a deliberate reversal of the S39
  review, the founder's call — with the Dispatch field relabelled **"Reason (optional) — your Driver will see this"**
  so the promise changes before the text does; the Driver's own reason reads back as *"You said: …"*. The **Cancelled
  pill lost its × icon** (it read as a dismiss control). **Six possible endings** now exist in the model: no-show ·
  Business cancel · Driver cancel · agreed release · T-60 take-back (dead, see below) · **copilote hand-over (NOT
  BUILT — needs the community layer, shows "Soon")**.

**★ SESSION-48 — ✅ SHIPPED (2026-07-28, [[d58]]; migration `2026-07-28_driver_account_and_documents` applied).**
The Driver **Account** replaced the old Settings scroll: a hub (identity · a readiness strip that *names* what's
missing · rows) with a sub-page each for Profile / Where you work / Your vehicle / Your company / Documents /
Navigation / Payouts / Help, each saving only what it shows. **Documents got a real lifecycle** — expiry dates (the
`expires_at` column had existed since day one and was never written), missing/pending/rejected/expiring/expired states,
a rejection reason, front+back sides — plus **camera-first capture with framing** (shared `<ImageFramer>`: round for a
face, rectangular + turn/straighten for a document; PDFs skip it). **Company papers added** (Kbis · RC Pro · the URSSAF
*attestation de vigilance*, which is Kavenue's own legal obligation as donneur d'ordre, renewed every 6 months) plus
`siret`/`vat_number`/`company_name`. Bank details deliberately NOT collected — Stripe's job. **`preferred_gps` was fake
(saved, never read); it's now real** — a **Navigate** button on a live trip targeting pickup → next stop → drop-off via
https universal links. Tab renamed **Settings → Account**. Languages are chips.
- **Founder call: ONE car per Driver for now.** The real multi-car case in VTC is a *fleet* (one company, several
  Drivers, several cars), which the data spine doesn't model — so multi-vehicle would serve nobody in beta while
  dragging `mission.vehicle_id` + a car picker into the money-critical `accept_mission` RPC. Groundwork shipped anyway
  (`document.vehicle_id`, `vehicle.is_active`): car #2 is now a small, contained job. See [[d58]] for what it costs.
- **⚑ Open, deliberately:** readiness is **shown, never enforced** (`blocksWork()` exists and is unused — wiring it into
  the Pool query is the switch to flip when real Drivers onboard, NOT before: no beta Driver has filed a document);
  **nothing reviews a document** (the admin verification workspace is a deferred integration, so every state is honest
  but a paper stays "with us for review" forever); and the expiry copy **promises reminders** ("a month before, and
  again the week it lapses") that need the notifications phase to become true.

**★ ALSO SHIPPED 2026-07-28 — EARNINGS ([[d59]]; no migration).** The 4th tab is real: total · what it's made of ·
trip-by-trip, with a **Day/Week/Month/Year** filter (‹ › steps, and the label opens the phone's date picker to jump
anywhere; state in the URL `?p=&d=`). **No charts** (founder). Comparison is the **previous period** — the founder asked
for same-period-last-year, but the oldest mission is 2026-06-16, so that line renders **only once it's non-zero** and
turns itself on. Non-trip money is included (waiting · no-show · cancelled-on-you · own cancellations in red).
- **⚑ Money bug fixed on the way, then fixed properly:** `currentFare()` climbs to `now`, so a COMPLETED trip kept
  getting more expensive — one accepted at €70 displayed €100. New `settledFare()` freezes the curve at `accepted_at`.
  The founder then ruled that it applies to **fees as well** ("the final fare … is the price that the Driver accepted"),
  so `p_fare_snapshot` on all four cancel/no-show RPCs and the amendment from-fare use it too. **BACKLOG § H2's
  fee-basis flag is RESOLVED.** Verified live both ways (driver cancel €70 not €100; business cancel 58,17 € off a €70
  basis). **The trap to remember:** `settledFare` needs `accepted_at`, and the actions select a narrow `FARE_COLS` list
  — it was omitted, so the fix silently did nothing until a live probe caught it. The parameter is **required** now, so
  that failure is a compile error.
- **⚑ Founder's next pricing question, logged in § H2, nothing decided:** with the basis correct, **100% may be too weak
  a penalty on cheap trips** ("a €50 trip … a driver would be tempted to cancel"). Options sketched: a floor, a
  multiplier near pickup, or visible reliability marks.
- **⚑ Founder ruling to carry into the pricing model:** *the fare shown in the Pool is the Driver's fare* — "like the
  other apps, the price shown in the Pool and paid to the Driver should be commission-taken". So no gross/net language
  anywhere in the app. Provisional until the pricing work lands.

**★ SESSION-49 — ✅ SHIPPED (2026-07-29, [[d60]]): the DOMAIN MOVE + EMAIL.** The founder took none of the menu below —
they'd bought **`kavenue.fr`** and wanted the product to finally live at its own name, plus real mailboxes. Done and
verified the same day: four hosts on `kavenue.fr` (apex primary, `www` → 308 → apex, `driver.`, `dispatch.`), the old
domain removed from Vercel, the Vercel project renamed **`kavenue`**, and Google Workspace email with `support@` /
`feedback@` / `contact@` as free aliases — SPF + DKIM + DMARC all verified `pass` on a real message. Runbook, gates and
the OVH traps: `project/DOMAIN_MIGRATION.md`. **No app behaviour changed; nothing was consumed from the menu below.**

**★ SESSION-50 — CHECK-IN shipped (2026-07-30, [[d61]]; migration `2026-07-30_mission_check_in.sql` applied; deployed
`c6f13a0` + `aa18778`).** The founder ruled out A–C for now — *"I need to have a complete functional system between the
Dispatch and the Driver and all UI done"* — so the work is the Driver↔Dispatch loop. Shipped: a Driver **checks in** 3h
before pickup; the Business's row reads `Confirmed` → **`Not checked in`** (amber, whole row) → red inside 1h →
**`Checked in`**; a count badge on the My Rides tab; `en_route` checks in implicitly. This revived the S39 pill + red row
wash that [[d55]] had made unreachable.
- **⚑ The T-60 take-back is STILL parked, and now for a documented reason.** Its S47 trigger ("the Driver hasn't
  started") fires on a Driver who simply plans to leave at 17:40 for an 18:00 pickup — turning a **90%** business-cancel
  fee into **0%**, an hour before every trip. It needs a response test, which needs push. See [[d61]].
- **⚑ Test-harness trap:** `?as=driver` → `demo.driver@pickup.local` → the **Marc Dubois** driver row, NOT the row whose
  `email` column says `s46.driver@pickup.local`. Match on `driver.auth_user_id`, never on `driver.email`.

**REMAINING ON THE DRIVER↔DISPATCH LOOP** (audited from the code 2026-07-30, + the founder's own testing 2026-07-31).
**★ START HERE — B is now the top item; A shipped in S51.**

**A. ✅ EXPIRED TRIPS — SHIPPED (S51, 2026-07-31, [[d62]]; migration `2026-07-31_expired_missions` applied; deployed
`d7e06d4` → Vercel `success`).** A trip now expires **exactly at `pickup_at`** (founder: no grace), leaves the Pool, and
shows the Business a red **"Expired · Was not filled in time"** row that stays on the schedule until the day ends. The
money bug is closed in three places — a time check **inside `accept_mission`** (under the existing row lock), a
`pickup_at` floor on the Pool query (**including under `?all=1`**), and `/missions/[id]` no longer offering Accept.
`expire_stale_missions()` sweeps `pooled → expired` + writes the `status_event` in one statement, called on the Pool and
Dispatch schedule reads — **deliberately no cron** (Vercel Hobby caps it at once a DAY; the scheduler decision belongs
with D61's T-180 reminder in the notifications phase). `missionTone` derives the same state for `pooled` + past-due so
the calendar and history can't lag behind the sweep. Verified live incl. a genuine UI accept race; DB restored to its
34-mission baseline. **Still open from § P: an expired trip counts nowhere** — fill rate needs the § F2 back-office.
**⚑ Note the side effect: the Pool is now legitimately EMPTY** (all 23 were dead), so testing needs freshly posted trips.
- **Part B, same day ([[d63]], deployed `73d7102`): Dispatch History done properly.** Filter chips **All / Completed /
  Unfilled / Cancelled** with counts (server-side `?filter=`, reusing the Driver's `.rfilter`/`.rchip`), a one-line
  summary, a per-month failure count, and two distinct empty states. **Wording changed:** "Expired" → **"Unfilled"**
  (the ending) and the Schedule's live warning "Unfilled" → **"No Driver yet"** (still fixable) — they had read almost
  identically since S39 and nobody noticed, because the outcome had never rendered.
  **→ Superseded/extended by [[d68]] (S52): History is now searchable, range-filterable, sortable and exportable.**

**B. ✅ Driver EARNINGS picker — SHIPPED (S51, 2026-07-31, [[d64]]; NO migration; deployed `684ae82` → Vercel
`success`).** One root cause behind both symptoms: the label drove a **hidden** `<input type="date">`
(`pointer-events: none`) via `showPicker()` — dead on phone, undismissable on desktop, and unable to express a range
at all. Replaced with the app's own calendar (opens on tap, closes on outside-tap/Escape, same on both), plus a 5th
period **Range** (two taps, `?p=range&from=&to=`, arrows removed) and presets last 7 / last 30 / this month / all
time. The selection band now makes the "granularity decides what a tapped day means" rule visible for the first time.
- **⚑ REUSE THIS for § R and § S.** `lib/use-dismiss.ts` (pointerdown, not mousedown) + the calendar in
  `components/earnings-period.tsx` are the controls Dispatch History and Dispatch Earnings should adopt — the founder
  asked for a date range in all three. **Do not build a second one.**
- **⚑ TESTED AND CLEAR — do NOT re-flag this.** Claude suspected the three other popovers that dismiss on `mousedown`
  only (`date-time-picker.tsx:38` · `address-autocomplete.tsx:204` · `dispatch-shell.tsx:77`) had the same mobile
  weakness, on the theory that iOS Safari skips synthetic mouse events when you tap a non-interactive area. **The
  founder tested all three on a real iPhone 2026-07-31: every one closes correctly**, and so does the new Earnings
  calendar. The theory was wrong — iOS synthesises the event fine here. They are NOT broken, and the Earnings bug was
  never about `mousedown` (it was `showPicker()` on a hidden input). Consolidating the three inline hooks onto
  `useDismiss` is optional tidying, worth doing only if one of those files is open for another reason.

**C. Dispatch-side EARNINGS / spend — "a real one, complete and pro" (founder, 2026-07-31).** Full spec now in
**BACKLOG § S**. ⚑ It deliberately **diverges** from the Driver's Earnings: the founder wants **charts, comparison
tools and desktop-class controls** here, where the Driver's screen has none by their own earlier call ([[d59]]) — a
hotel back-office is a different user doing analysis, not a Driver checking a phone. Research best-in-class first;
D25 preview loop applies. `settledFare()` already solves the maths, and it should adopt the **fixed** period control
from B rather than the broken one.

**§ R — ✅ SHIPPED (S52, 2026-07-31, [[d68]]; NO migration; deployed `0acdb68` → Vercel `success`).**
**Dispatch History is a tool you search, not a list you scroll.** Founder: *"it is a professional tool… easy to find a
specific trip by drivers name, or passenger or internal reference, or car… perfect and complete."*
- **One search box** over Guest · Driver · reference · address · flight · car. Every term must hit somewhere;
  **accent-folded** ("aeroport" finds "Aéroport" — the highlight maps folded offsets back to the original per
  character, which is why it paints correctly); and when the hit lands somewhere with **no column** the row prints
  `Car · Mercedes · Classe E · AB-123-CD`, so searching a plate never returns rows with no visible reason.
- **Date range · Driver · class · sort · Export CSV.** The export re-runs the **same** `applyHistoryQuery` on the
  server, so "exactly what's on screen" survives the next filter anyone adds. `;` + French decimals + BOM for Excel FR;
  formula-injection escaped. Every filter is in the URL → a filtered archive is a shareable link, and `?open=<id>`
  matches the Schedule.
- **Two gaps closed:** rows showed only a **time** inside month bands (3 vs 19 July were indistinguishable), and there
  was **no fare column at all**.
- **⚑ The accuracy call:** a past trip a Driver never closed (§ Q) shows its agreed fare **greyed as "Not settled" and
  excluded from every total** (row, month band, summary; its own CSV column). Counting it inflated a hotel's spend with
  trips that may never have happened.
- **⚑ The date-range control is now genuinely shared** — extracted from `earnings-period.tsx` to
  **`components/date-cal.tsx`**; the Driver's Earnings was re-verified after the extraction. **§ S adopts THAT file.
  Do not build a third.**
- **⚑ Left open on purpose (in § R):** the **volume ceiling** — the page loads the whole archive in one query and
  filters in memory, which is what lets the chip counts / Driver list / class list be honest about the *whole* archive.
  Correct at 28 trips, the first thing to break at 5 000. Also skipped: a density toggle (nobody asked).

**★ NEXT SESSION STARTS HERE — the founder picks. Nothing is pre-selected; open with these in 2–3 lines (rule #4).**
The obvious candidates, in the order they'd help most:
1. **§ S — Dispatch-side Earnings / spend** ("a real one, complete and pro"): the founder already asked for it, it
   **wants charts and desktop-class controls** (unlike the Driver's, [[d59]]), `settledFare()` already solves the maths,
   and it should adopt `components/date-cal.tsx` + the § R filter vocabulary rather than inventing a second one.
   Research best-in-class first; D25 preview loop applies. **This is the natural follow-on from § R.**
2. **§ T — the Earnings lag** (below): one file, real restructure, well understood.
3. **The two quick ones** (§ 1 and § 2 in the worst-first list below): the Business default vehicle class that's saved
   and never read (~1h), and the 7 French strings in the English app (~30 min).

**Also open: § T — the Earnings lag, already measured, don't re-measure and don't trim the queries.** Production is
**1.97 s cold / 0.34 s warm**; the 7 queries run in parallel and cost about one query's latency (146 ms for one alone),
so **the cause is a serverless cold start, not the query count** — Hobby plan, not fixable in code. Query trimming is
**explicitly rejected in § T** with the numbers. The one fix worth making is perceptual: wrap the loads in a
`<Suspense key={period…}>` with a skeleton, so the total shows as loading instead of sitting there looking final while
it's stale. One file, but a real restructure — give it a proper slot, not the tail of a session.

**★ ABANDONED TRIPS — ✅ RULED ON + DESIGNED, then PARKED by the founder (2026-07-31, S52). Do NOT reopen it as an open
question, and do NOT re-derive the design — it's written out in full in BACKLOG § Q.**
§ P closed the *unfilled* hole; this was the other one (**8 past trips sit `confirmed`/`on_board`**, one for 36 days).
**Founder's call: leave it for now** — in beta they're the only one creating trips, so all 8 are test artifacts, and the
good version needs push, so building now ships the weak version twice.
- **What resolved it:** every escape valve already built (copilote · agreed release · T-60 · cancel) answers *"this trip
  isn't going to happen"* — someone's unhappy, so someone acts. **Covered.** The open hole is the opposite case: *the
  trip DID happen and nobody tapped the last button.* Nobody is unhappy, so nobody chases it — only the record is wrong,
  and the record is what pays the Driver and bills the Business.
- **The agreed shape:** not a rule that guesses (time can never separate "drove and forgot" from "never turned up") but a
  **question** — a pinned card (**not a modal**) on the Driver's My Rides ~3h after the trip should have ended, three
  answers; the Business meanwhile sees an honest "Waiting on the Driver to close this" + **Nudge, never close**; the
  question **expires in ~48h and flips to the Business**, who knew that day; neither answers → back-office.
- **Blocked on push** (the card only fires if the Driver opens the app) → lands with notifications (menu **B**) or the
  back-office (**§ F2**). **Geolocation auto-close was considered and is V2** — a PWA only gets location while the app is
  on screen; and location may **suggest, never decide** (location closing a trip = location *paying* someone).

Then, worst first:
1. **A Business's default vehicle class is saved and never read.** `default_vehicle_category` saves in Settings →
   Booking defaults; `/dispatch/new` ignores it. **⚑ Confirmed by the founder 2026-07-31 and it is a trap:** the form
   *looks* right because `service-class-fields.tsx:41` falls back to a hardcoded `"business"` — that is a coincidence,
   not the setting being read. The body type falls back to `""`, which is why Sedan is unselected. **Also decide:** the
   setting is ONE `default_vehicle_category` while the form has TWO controls (tier + body), so wiring it needs to say
   which it fills. ~1h.
2. **French strings inside the English app** — 7 in `components/date-time-picker.tsx` ("Choisir une date", "Mois
   précédent", "Heure exacte"…) on the most-worked screen, **plus the Dispatch schedule's day headers** ("Samedi 11
   Juillet" — spotted S51, `formatDate` in `lib/format.ts`; S47 fixed `formatMonth` to `en-GB` but not this one).
   Do both together. ~30 min.
3. **Only the latest edit shows.** `mission_info_change` records every edit to a posted trip; the schedule renders one
   ("…and 2 earlier edits"). ~half a session.
4. **A second vehicle** — scoped in [[d58]], groundwork shipped. ~half a session.
5. **Saved-addresses book** (§ L) — needs a small additive table. ~1 session.
6. **Reliability marks** — a conversation before any code: does a Driver see their own?
7. **Guidance Tier-2 tooltips** — the biggest UI-completeness item (Ceiling / Pool / SPEED WIN / the status pills are
   "taught in fragments and defined nowhere"), plus folding `.set-note`/`.rf-hint`/`.ds-note` into one component.
   ⚠️ `GUIDANCE_AUDIT.md` predates S31/S37, which closed some of its 15 gaps — re-check before using it as a worklist.
8. **The logo re-export** (sky-blue → navy) — founder's own, ~15 min.
- **Blocked, not forgotten:** the suggested Ceiling/base-fare range is the audit's highest-leverage item but needs the
  pricing rule (option C).

**★ The A–D menu below is UNTOUCHED and still current** when the founder wants to leave the Driver↔Dispatch loop.
Open with it in 2–3 lines and let the founder pick — do NOT start any of it unprompted (rule #4).

**The Driver app is now COMPLETE**: Pool (S43) · both mission cards (S45) · My Rides + Past (S46–S47) · Account +
documents (S48) · Earnings (S48b). There is no un-redesigned Driver screen left. That's why the next step is a genuine
choice rather than the next item on a list.

**A — The back-office (`/admin`).** *The one thing that unblocks real users.* **Scope grew on 2026-07-30:** the founder
walked through the surfaces and two additions came out of it — **BACKLOG § O (trust & safety: incidents, an investigation
trail, and blocking a Driver with a notice)**, which today has NO answer at all (the only lever is editing
`driver.verified` by hand), and the **admin subdomain** `admin.kavenue.fr` (separate host-only cookie so a staff session
survives testing as a Driver; plus origin-level gating on the most sensitive surface in the product). § O has **one
blocking question** — what happens to a suspended Driver's live and upcoming trips (§ O.4).
 Founder-confirmed 2026-07-28 as ONE
product: **document review + disputes + support**. Nobody can approve a paper today, so every Driver sits at "with us
for review" forever, and `driver.verified` can only be flipped by hand in Supabase. Half-built: the `admin` role exists
and RLS already grants admins read on every table; what's missing is a **write** path (service role). S48 fixed the
write contract (`status` · `review_note` · `expires_at`, one row per `side`). The **expiry-reminder job** belongs here
too. See BACKLOG § F2. **Biggest single build of the options; also the one with no design unknowns.**

**B — Notifications (Resend + web push).** *The #1 functional gap in the whole product* (a Driver only sees a Pool
mission if they're looking at the screen; a Business learns of an acceptance on refresh). It is an INTEGRATION, which
the founder has been deferring on purpose until the in-app experience is right — and the in-app experience is now
right. Several shipped features are **written as promises that only notifications can keep**: document expiry reminders
("a month before, and again the week it lapses"), the amendment/release cards, and the T-60 remedy below. Needs a
service worker + Web Push (neither exists) and the founder's explicit green light for the integration phase.

**C — Pricing.** *Founder-owned, and now the oldest blocker.* The suggested Ceiling/base-fare range on the mission form
and the amendment auto price-delta both wait on it, and two live questions surfaced in S48b: **100% is a weak penalty on
a cheap trip** (§ H2), and **commission** — the working assumption is now "the Pool price IS the Driver's price"
([[d59]]), which the real model has to either confirm or overturn. Nothing to build until the founder brings the rule.

**D — Smaller, self-contained, any time:**
- **Reliability marks — a conversation first.** A driver cancel adds one silently (`driver.reliability_marks`); the
  founder wants to decide whether a Driver sees their own before any UI ships. S47 shipped the cancel cards WITHOUT them.
- **The T-60 replacement + the "check in" rename** — designed in S47, deliberately not built; see the block below. It
  really wants notifications (option B) first.
- **A second vehicle** — fully scoped in [[d58]], ~half a session, worth doing the moment a real Driver has two cars.
- **Guidance Tier-2 tooltips** (`project/GUIDANCE_AUDIT.md`) and the **saved-addresses book** (BACKLOG § L) — both
  Business-side, both small, neither urgent.

**If the founder has no preference: A.** It's the only option that removes a human bottleneck rather than adding a
feature, it has no design unknowns, and every honest "we're reviewing it" state shipped in S48 is currently a promise
with nothing behind it.

**★ T-60 / silent-Driver remedy — DESIGNED IN S47, DELIBERATELY NOT BUILT.** Keep this whole block; it's the decision
trail so the next attempt doesn't restart from zero.
- **The state today:** a Driver can still advance a trip and the Business sees it on the schedule (on refresh, not
  pushed). But **there is no T-60 unlock** — `reclaim_mission` requires `status='accepted'`, which [[d55]] made
  unreachable, and the Business UI gate is the same condition, so the card never renders. Dead, not broken.
- **The gap:** at T-60 with a silent Driver, a Business's only working option is a **cancel at ~90% of the fare**
  (the [[d45]] curve at 1h). The agreed release is free but needs the Driver to accept — and they're not answering.
- **The design that was agreed** (founder, S47): the take-back must **not** auto-re-pool — a confirm step offering
  **two** outcomes, back to the Pool as SPEED WIN *or* a plain free cancel. Trigger: **the Driver hasn't started the
  trip** (not `en_route`) inside the hour. Reliability mark **only on a real no-response**, which needs a response test:
  take-back is instant, the mark waits ~10 min and is dropped if the Driver touches the trip.
- **Why it was deferred:** the response test is meaningless without push (we have **no service worker and no Web Push** —
  a Driver "enabling notifications" on their phone does nothing today), and fees settle **MANUAL** in beta, so the unfair
  90% charge exists only on paper. Building now would mean shipping the weakest trigger and redoing it later.
- **Optional 10-minute stopgap the founder did NOT decide on:** a line in the Business cancel modal for the
  under-an-hour case — *"Driver unreachable? Call us before cancelling."*
- **Terminology (founder, S47): "Lock-in" and "T-180" are jargon — do not ship them.** When the confirmation step
  returns, call it **"check in"** ("check in 3 hours before pickup" / "not checked in yet").

**Non-Driver items still parked** (both small, neither urgent — listed as **D** in the Session-49 menu above):
**guidance Tier-2 tooltips** (`project/GUIDANCE_AUDIT.md` — a "?" glossary tooltip for Ceiling / Pool / SPEED WIN /
check-in / the status pills, plus a Dispatch status legend) and the **saved-addresses book** (BACKLOG § L — the
Business's own address + the pre-fill/swap plumbing already exist; next is a small additive table for *multiple* saved
places + a one-tap picker on both ends of the new-mission Route card).

RECOMMENDED NEXT STEP (set by the founder at the end of Session 43 — ★1 and ★2 are now both SHIPPED):

**★ 1. ✅ RENAME PickUp → `Kavenue` — SHIPPED (S44, [[d51]]).** Done across app copy, spec docs, `project/`, package name,
PWA manifest, README and the Dispatch topbar wordmark; the two brand-named doc files were git-renamed to
`docs/Kavenue_Phase0_Data_Spine.md` + `docs/kavenue_schema.sql` and every reference updated. Verified by 4 adversarial
lenses (a mechanical reversibility check on all 209 changed lines found 0 collateral edits) + 18 routes in-browser.
**Deliberately NOT renamed at the time** (each would have broken something real): every `pickupbedriven.com` hostname
(**superseded — the DNS move shipped in S49, [[d60]]; the code is on `kavenue.fr` now**), the
`Phyrass-H/Pickup-marketplace` repo slug, the `PickUp_project_dev` directory (**superseded — renamed 2026-08-06 to
`Kavenue_project_dev`**), `PickUp Go`, La Poste's
"Pickup" trademark, the `pickup_*` transport term/DB columns, the `pickup-dx-collapsed` localStorage key, and the
`*@pickup.local` dev-login/seed identities (they map to REAL Supabase auth rows — renaming the string alone breaks
dev-login). See the founder-action list at the end of this file.

**★ 2. ✅ Driver cards redesign — SHIPPED (S45, [[d52]]; deployed `1a1e5b6`, Vercel `success`).** Both remaining Driver
screens now carry the S43 Pool-card language: `/missions/[id]` reads as "the Pool card, opened" (uncollapsed route rail,
a `Service` card of `.dfact` rows + `.dchip`s, a `.dlock` reveal row, a plain full-width `Accept mission` — no sticky
bar, no fare beside it), and the My Rides card leads with **state not price** (`.dpill` + a `.dprog` segment bar with a
plain-words caption, stop progress on the rail, `.dcall` tap-to-call chips, a `.dnote` prep box, fare in the foot).
**One filled button per screen** — no-show + cancel dropped to `.dquiet` text actions; `Complete ride` is finally green.
No schema, no behaviour change. **✅ Now verified live (S46, 2026-07-25):** the `arrived`/waiting-meter (`.dmeter`) +
no-show-confirm visuals were checked against real data — amber running meter, neutral capped state, and the confirm
nudge all render correctly, no console errors.
**Founder preference recorded:** these pages **scroll by design** — breathing room beats fitting one viewport.

<details><summary>Original S45 brief (kept for reference)</summary>

**Redesign the two remaining Driver cards (ask first, then D25 preview → sign-off → build).**
The founder **deferred these out of S44** ("don't do the card now") — so confirm they still want it before starting.
A design brief was already gathered in S44 and is worth re-deriving cheaply: the shipped `.pcard`/`.proute`/`.pbadge` CSS
and tokens live in `app/globals.css` (~lines 6–127 for `:root`, ~1636–1838 for the Pool card); the Pool card DOM is
`components/mission-card.tsx`. Read those two, not the whole repo. The Pool card is done (S43);
these carry the same design language forward (`.pcard`/`.proute`/`.pbadge`, refined weights, route rail, service icons):
   1. **The extended pre-accept mission card** — what a Driver sees on **`/missions/[id]` BEFORE accepting** (today it's still
      the old `.card`/`.route`/`.kv` style; `app/(app)/missions/[id]/page.tsx` + `accept-button.tsx`).
   2. **The accepted mission card** — the **My Rides** trip card + run-flow once a trip is the Driver's
      (`app/(app)/rides/page.tsx`, `status-control.tsx`, `status-steps.tsx`, and the **`arrived`/waiting-meter** screen
      `cancel-noshow.tsx`). The `arrived` state **must be drawn against the shipped D48 waiting meter** (the old S41 v2
      preview predates it).

</details>

Smaller open: **guidance Tier-2** tooltips; the **saved-addresses book**. (✅ done since: the **Earnings screen**
[[d59]]; the Driver **Account + documents** [[d58]];
**Pool empty/loading** [[d54]]; the **discreet-vehicle** note — KEPT (founder); Driver **"Complete ride" → green** [[d52]];
the pre-accept **zone** removed [[d55]].) **Parked, founder-gated:** the €1/min **waiting-rate** research + cap review (pricing);
**§ H2** the `pickup_at` column-grant audit (still Business-writable) + **automated tests** (S42 made the case — 3 of its bugs
looked correct in code and only fell to live probing); the **"Both"** mission type (needs a new `mission_type` enum value).

**A. ✅ Mission-edit Phase 2 — SHIPPED + DEPLOYED (S35, 2026-07-07, [[d40]]; migration applied, full loop verified live).**
   The amendment/consent flow is live: a Business **Propose a change** screen (`/dispatch/[id]/amend` — route incl. pickup
   + fare, live preview), a Driver **accept/decline card** (in-context route diff + optional decline reason + slot
   heads-up), the schedule **pending / declined (calm reassurance) / accepted** states, and the atomic
   **`respond_to_amendment` RPC** mirroring `accept_mission`. Verified end-to-end on the real DB (fare accept + decline +
   a real add-a-stop route change → the mission genuinely swapped). **Phase 3 is the future here** (auto price-delta via
   the pricing engine + notifications so the Driver is alerted without watching the app + an in-app "could we add a stop?
   +€X" note) — deferred on those integrations. The **decline "or Business cancels" path is now unblocked by O7** —
   cancel + re-pool shipped (S39, [[d45]]) and the free mutual **"agreed release"** shipped (S40, [[d46]]).

**B. ✅ Unfolded (expanded) trip-row redesign — SHIPPED (S36, 2026-07-10, [[d41]]).** Plus the S37 mission-form polish
   ([[d42]]) and the S38 Riviera-first address-search cleanup ([[d43]]). So the freshest open items are now the **Driver
   app redesign**, the **guidance tooltips (Tier 2)**, the **saved-addresses book**, and the parked **Google Places switch
   + domain migration** (below).

**⚠️ BRAND / DOMAIN — name is `Kavenue` ([[d50]], supersedes RED Executive [[d44]]):** the rebrand away from "PickUp"
   (La Poste's EU transport trademark). **The code/copy rename SHIPPED in Session 44 ([[d51]])** — app copy, the Dispatch
   topbar wordmark, spec docs, `project/`, package name, PWA manifest and README all say **Kavenue**; `tsc` + `next build`
   green, 18 routes verified with zero "PickUp" leakage. **Kavenue ≠ PickUp Go** (separate product, hard rule) and the
   glossary (Business/Dispatcher/Driver/Guest/Pool/PDP/Ceiling/SPEED WIN) was deliberately untouched.
   **✅ The domain migration SHIPPED in Session 49 ([[d60]])** — `kavenue.fr` is live (the `.com` waits until it's
   affordable), old domain removed, Google Workspace email running. Runbook: `project/DOMAIN_MIGRATION.md`.
   **Still outstanding, founder-owned:** (1) ✅ the **repo directory** was renamed 2026-08-06 — now
   `02_Cactus/Kavenue/Kavenue_project_dev`; the **GitHub repo** is still `Phyrass-H/Pickup-marketplace`, the founder's to
   rename (it breaks the git remote);
   (2) **Google Places** swap for address search — this was gated on the DNS move so the key could be restricted once,
   and **that gate is now lifted**. Related: the Mapbox public token turned out to have **no URL restrictions at all**
   (probed in S49), so if we stay on Mapbox it wants a new restricted token anyway. See [[d43]] [[d50]] [[d51]] [[d60]]
   + IDEAS.md.

**PRICING is IN PROGRESS — the founder is working on the model themselves** (how a Ceiling / base-fare is estimated;
one-way vs round-trip). Respect **[[d37]] — NO empty-return charge** (a smart trajectory Pool solves the deadhead). Don't
build a pricing engine until the founder brings the rule; the **suggested Ceiling/base-fare range** on the form + the
Phase-2 **auto price-delta** both wait on it. Everything below is buildable now, no third-party APIs; any NEW field = a
small founder-run additive migration:
1. **Mission-form guidance — Tier 2** (see `project/GUIDANCE_AUDIT.md`; mostly NO schema): a small **"?" glossary
   tooltip** for the core terms (Ceiling, Pool, SPEED WIN, Lock-in, the status pills — taught in fragments today,
   defined nowhere), a **Dispatch status legend** (the S33 calendar already has one — reuse), and **Lock-in/T-180 in
   plain words** both sides. Plus **smart "most-used" defaults** + wiring the Business **default vehicle class** (Settings
   → Booking defaults) into the form (saved but not read yet). Keep it **non-invasive** ([[d36]]).
2. **Saved-addresses address book** (BACKLOG § L) — the Business's own address is its **first saved place** (S29), and
   the pre-fill + **swap** plumbing already exists. Next: a small additive table for **multiple** saved addresses + a
   one-tap insert/picker on both ends of the new-mission Route card.
3. ✅ **Driver app redesign — COMPLETE (S43 → S48b).** Pool [[d49]] · both mission cards [[d52]] · My Rides + Past
   [[d53]][[d56]][[d57]] · Account + documents [[d58]] · Earnings [[d59]]. No un-redesigned Driver screen remains.
   "Complete ride" is green; the only leftover from this item is the cosmetic **logo re-export** (sky-blue → navy).
4. **Luggage-vehicle Phase 2 (V2)** — real cargo/truck classes by **volume/m³ bands** (the "20 m³" idea, likely a
   partly separate fleet) + the grouped **car + luggage van** booking (the CUT grouped-mission feature; the cargo leg
   can "stop before the end" of the passenger trip). Bundle with the **Exception tier** (Rolls/Bentley above First) /
   Bus tier / First-van / PRM taxonomy expansion.
(✅ shipped 2026-07-05, S33–S34 — see the "Shipped" block + [[d39]]: calendar redesign; night-nudge→Pricing; dev Pool
see-all; mission-edit Phase 1 + placement + "Edited" stamp. Earlier S30–S32 ([[d35]]–[[d38]]): topbar account chip;
input-driven nudges + guidance audit; luggage-vehicle Phase 1. ❌ the founder **declined**: the sidebar-spacing tweak
(S-earlier); per-item "what changed" on edits (→ it's a Driver-notification feature, Phase 3); a row-level edit pencil
(edit entry is top-of-detail only); horizontal calendar tape-chart + duration-scaled week cards.)

DEFERRED until the founder okays the integration phase: **Notifications (Resend)** — the #1 functional gap
(today a Driver only sees a Pool mission if watching the screen; a Business sees an acceptance on refresh);
**real email auth** (retire dev-login); **the back-office / admin
verification workspace** (BACKLOG F2 — onboards real drivers/hotels; founder-confirmed 2026-07-28 as ONE product
covering documents + disputes + support, and it is **option A in the menu above**); **Payments/Stripe**; flight tracking;
analytics/monitoring. **Mailboxes now exist ([[d60]]) but that does NOT make notifications work** — Resend, a service
worker and Web Push are all still unbuilt, and when they land they should send from a **subdomain** (`send.kavenue.fr`,
its own SPF/DKIM) so mission-alert volume never touches the human mailbox's reputation.

OTHER OPEN ITEMS (pick what the founder asks):
- ✅ **Driver app redesign — COMPLETE (S43 → S48b).** See the Session-49 menu at the top: the next step is a real
  choice now, not the next screen in a queue.
- **Navy polish (all that's left):** re-export the **logo** to harmonise its sky-blue with navy. (Driver "Complete
  ride" → green shipped in [[d52]].)
- **Pricing engine** (IDEAS, ❓) — **founder is working on this now.** No objective base price by tier×body×distance×season;
  the Business sets the ceiling, Kavenue recommends. Principle: **NO empty-return charge** ([[d37]]) — a smart trajectory
  Pool handles the deadhead. Seeding approach in IDEAS (taxi tariff floor + base+€/km+€/min grid). Don't build until the
  founder brings the rule; then the suggested Ceiling/base-fare range on the form follows.
- **O7 cancellation — ✅ SHIPPED + DEPLOYED (spine S39 [[d45]]; agreed release + 24h re-pool window S40 [[d46]]).**
  Remaining: the **copilote hand-over** (Phase 2 — needs the community/registration layer), and the § H2 review-flag
  hardening (the Business-UPDATE RLS WITH CHECK gate; the fee basis freeze at `accepted_at` / pricing).
- **Engineering hardening (BACKLOG H2):** automated tests (money/PDP/`accept_mission`/RLS first), CI on PRs,
  generated DB types (`supabase gen types`), error monitoring.

HARD RULES (from CLAUDE.md): glossary exactly (Business, Dispatcher, Driver, Guest, Pool, PDP, Ceiling,
SPEED WIN — never "client"/"principal"); Kavenue is an AGENT, never principal; Kavenue ≠ PickUp Go; the Supabase
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
- **⚠️ Vercel can also fail a build TRANSIENTLY** (happened 2026-07-07 — a **docs-only** commit `51784d8` got a
  `failure` while its app code was byte-identical to the commit that had just deployed `success`). Don't panic: check
  the per-deployment status (`gh api repos/Phyrass-H/Pickup-marketplace/deployments/<id>/statuses --jq '.[0]'`), then
  **reproduce `next build` locally** — if it passes clean, it was an infra flake, not your code, and production is still
  serving the last successful deploy (never down). Re-trigger with an empty commit. **Stop the `next dev` preview
  before `rm -rf .next && next build`** (building while dev runs corrupts `.next`).
