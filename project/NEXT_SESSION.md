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
- `project/CHANGELOG.md` — plain-language history, the **recent entries** (the big picture, fast). Older entries live in
  `project/CHANGELOG_ARCHIVE.md` — read it only if you need the deep history.
- `project/SESSION_LOG.md` — skim the **newest entries (Sessions 40–42)** for recent technical detail. Older sessions
  (1–33) are in `project/SESSION_LOG_ARCHIVE.md` — don't open it unless you need deep history.

READ ON DEMAND — open these **only when the task actually touches that area** (this is the big context saver,
and it loses nothing — the docs are all still here, just read when relevant):
- `project/DESIGN_BRIEF.md` — for any UI/design work (brand, navy `#25344C`, screen inventory, constraints).
- `project/BACKLOG.md` (§ M = 2026-06-25 dump · § L = guided-form polish) · `project/DECISIONS.md` (newest
  **D39**) · `project/IDEAS.md` — for planning, "why was this decided", or parked ideas.
- `project/GUIDANCE_AUDIT.md` — the full in-app guidance inventory + gaps + roadmap (for any guidance/microcopy work).
- `docs/` — `00`–`05` + `PickUp_Phase0_Data_Spine.md`: the canonical spec; read the doc for the area you're in.
- `docs/pickup_schema.sql` (large) + `docs/migrations/` (`2026-06-17_driver_service_area`,
  `2026-06-19_vehicle_taxonomy_and_eta`, `2026-06-23_named_passengers`, `2026-06-25_mission_driver_section`,
  `2026-06-27_mission_reference`, `2026-06-27_mission_guest_contact`, `2026-06-28_mission_stops_reached`,
  `2026-06-28_business_profile_fields`, `2026-06-28_business_address_and_prefill`,
  `2026-07-04_luggage_run_phase1`, `2026-07-05_mission_info_edited_at`,
  `2026-07-07_mission_amendment`, `2026-07-10_mission_info_change`, `2026-07-13_o7_cancellation`,
  `2026-07-19_agreed_release`, `2026-07-19_repool_speedwin_window`, `2026-07-19_no_show_clock_origin`,
  `2026-07-19_no_show_airport_label`, `2026-07-19_guest_ready_at_guard`, `2026-07-22_waiting_fee`,
  `2026-07-22_airport_accent_fix`, `2026-07-22_guest_ready_at_guard_fix`) — **ONLY** for
  schema/data work. (All applied to the live DB.)
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

LEGAL — **not a build blocker.** The founder (Céline) owns the legal track personally; a lawyer writes the real
Terms/Privacy/positioning later. Do **not** gate work on legal or add "needs a lawyer" flags. Keep the glossary
+ agent/intermediary framing in code/copy (a product rule, not a legal gate). Sharing the Guest phone is fine for
the MVP — and is now an explicit **per-phone Business choice** (S20 Share gate), kept private from Drivers until shared.

RECOMMENDED NEXT STEP:

**★ THE LIVE FRONT (2026-07-23, after Sessions 41–42): the Driver app redesign.** The whole money-and-state engine (O7
cancellation · D47 clock · D48 waiting fees) is **shipped, deployed, and verified end-to-end (49/49 live)** — so the freshest
open build is the **Driver app layout redesign**. Two decisions are already **half-made and waiting on the founder** (a preview
loop was in flight when Session 41 pivoted to the clock fix):
   1. **The `arrived` screen needs a v3.** The approved-in-principle v2 preview predates the D48 **running waiting meter**, which
      now lives on that exact screen — so redraw the `arrived` state against the shipped meter before building.
   2. **Pool filter chips — keep or drop?** The v1 preview invented `All / SPEED WIN / Today` filter chips at the top of the
      Pool; they are NOT in the app today (the Pool is an unsectioned list). Founder to decide.
   Use the D25 preview loop (inline mockup → sign-off → build matching the preview). Bundle the small navy polish: Driver
   **"Complete ride" → green** (`success-btn` still falls through to navy) + re-export the **logo** to harmonise its sky-blue.
   Also open, smaller: **guidance Tier 2** (glossary "?" tooltips) and the **saved-addresses book**.
   **Parked, founder-gated:** Google Places for POI ranking (⚠️ NOT the airport-accent bug — that was Postgres, fixed S42; Google
   fixes *ranking*, and it waits on the RED domain registration) · the €1/min **waiting-rate research** + cap review (pricing
   model) · **§ H2** the `pickup_at` column-grant audit (still Business-writable) + **automated tests** (S42 made the case — 3 of
   its bugs looked correct in code and only fell to live probing).

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

**⚠️ BRAND / DOMAIN (new — [[d44]]):** the product's name is now **RED Executive** (RED = **R**iviera **E**xecutive
   **D**river) — the rebrand away from "PickUp" (La Poste's EU transport trademark). **The repo/docs stay codenamed
   "PickUp" for now** — DON'T assume a rename has happened; the topbar still says "PickUp Dispatch", the live domain is
   still `*.pickupbedriven.com`. Three separate future tasks, all waiting on the founder registering the final name/domain:
   (1) **Google Places** swap for address search (the real POI fix — key + billing the founder sets up; a "RED Executive"
   Google Cloud project already exists); (2) **domain migration** `pickupbedriven.com` → a RED domain (DNS + Vercel +
   Supabase redirect allowlist + `lib/hosts.ts` + the Google key restriction — that's why Google waits: restrict the key
   ONCE, after the DNS move); (3) **code/copy rebrand** PickUp → RED Executive. ≠ **PickUp Go** (separate product, hard
   rule). For now: **stay on Mapbox** for search. See [[d43]] [[d44]] + IDEAS.md.

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
3. **Driver app redesign** — it inherits the navy palette but its *layout* isn't redesigned (Dispatch is done). Use the
   D25 preview loop (or a Claude Design phone mockup), then build. Small navy polish bundled here: Driver **"Complete
   ride"** → green; re-export the **logo** to harmonise its sky-blue with navy.
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
- **O7 cancellation — ✅ SHIPPED + DEPLOYED (spine S39 [[d45]]; agreed release + 24h re-pool window S40 [[d46]]).**
  Remaining: the **copilote hand-over** (Phase 2 — needs the community/registration layer), and the § H2 review-flag
  hardening (the Business-UPDATE RLS WITH CHECK gate; the fee basis freeze at `accepted_at` / pricing).
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
- **⚠️ Vercel can also fail a build TRANSIENTLY** (happened 2026-07-07 — a **docs-only** commit `51784d8` got a
  `failure` while its app code was byte-identical to the commit that had just deployed `success`). Don't panic: check
  the per-deployment status (`gh api repos/Phyrass-H/Pickup-marketplace/deployments/<id>/statuses --jq '.[0]'`), then
  **reproduce `next build` locally** — if it passes clean, it was an infra flake, not your code, and production is still
  serving the last successful deploy (never down). Re-trigger with an empty commit. **Stop the `next dev` preview
  before `rm -rf .next && next build`** (building while dev runs corrupts `.next`).
