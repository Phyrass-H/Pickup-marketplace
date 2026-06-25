# PickUp — Decision Log

> Every non-trivial choice, why it was made, and when. Append-only; supersede rather
> than delete (note "superseded by Dn"). Decisions about *scope/legal/glossary* defer to
> the spec docs; this log captures *build/implementation* decisions.

---

### D1 — PWA-first for the Driver app (2026-06-16)
Per Doc 03. No native build for V1; revisit only when background GPS/push truly needs it.

### D2 — Driver sign-in via Supabase Auth email (OTP / magic-link) (2026-06-16)
Spec says "email". Chose passwordless OTP/magic-link over password (no password storage,
matches Supabase-native auth). Revisit if a password flow is preferred.

### D3 — Hand-write `database.types.ts` from `pickup_schema.sql` (2026-06-16)
Can't run `supabase gen types` without DB/CLI credentials wired in this environment, and
the schema file is the source of truth and already applied. Hand-write types to match it.
If the Supabase CLI gets wired up later, regenerate to confirm parity.

### D4 — Use the modern Supabase key system as active keys (2026-06-16)
`sb_publishable_` (browser) + `sb_secret_` (server) are active in `.env.local`. Legacy JWT
`anon`/`service_role` kept as commented fallbacks in case a library expects JWT-form keys.

### D5 — Session-continuity docs live in `project/` (2026-06-16)
`STATUS.md` (resume point), `SESSION_LOG.md` (history), `DECISIONS.md` (this), `IDEAS.md`
(backlog). `CLAUDE.md` points new sessions here. Chosen over scattering notes so a fresh
session can resume from one place.

### D6 — Reads/Accept run as the user session; writes use the service role (2026-06-16)
Pool read, mission detail, My Rides, and `accept_mission` use the cookie-based **user-session**
client so RLS + `auth.uid()`/`current_driver_id()` resolve correctly. Onboarding inserts and the
seed route use the **service-role** client (server-only) because `profile`/`driver` have no INSERT
RLS policy in beta. Never call `accept_mission` with the service role (it'd see `auth.uid()` null).

### D7 — Contact unlock enforced in code via the service role (2026-06-16)
A Driver can't read `dispatcher`/`business` rows via RLS. "Reveal phone on acceptance" is done in
`/rides`: fetch Dispatcher/Business contact with the service-role client, **gated to missions whose
`driver_id` = this Driver** (themselves read under RLS first). This is the right place for the
service role — a rule RLS can't express. [[d6]]

### D8 — Magic-link auth; `/login` is a server-guarded client form (2026-06-16)
Passwordless OTP/PKCE (D2). `/login` is a server component that redirects already-authed users to
`/pool`/`/onboarding` and renders a client `<LoginForm>`; the callback validates the `next` param
(host-local only) and forwards link errors for the form to display.

### D9 — Dev-only seed route for test fixtures (2026-06-16)
`GET /api/seed` creates a Business + Dispatcher + pooled missions across zones/categories. Blocked
when `NODE_ENV=production` **or** on any Vercel env (`process.env.VERCEL`). Idempotent on the seed
dispatcher email; clears its missions before re-inserting. Replaces the "parked" fixtures idea.

### D10 — Pin `@supabase/ssr` to 0.12.x with `supabase-js` 2.108 (2026-06-16)
`@supabase/ssr@0.5.x` deep-imports a `supabase-js/dist/module/lib/types` path that no longer exists
in `supabase-js` 2.108 → the typed client silently collapsed every row to `never`. Upgrading ssr to
0.12.0 (peer-deps `supabase-js@^2.108`) fixed it. Also: each table in `database.types.ts` needs a
`Relationships: []` field (+ schema `CompositeTypes`) to satisfy supabase-js's `GenericSchema`.

### D11 — One app, role-aware via `profile.role` (2026-06-16)
Rather than two separate builds, a single Next app serves both surfaces. `lib/app-context.ts`
loads the user's profile + role-specific entities; `routeFor()` centralizes "where does this user
belong." Driver pages live under route group `(app)` (`/pool`, `/rides`, `/missions/[id]`);
Business pages under `(dispatch)` (`/dispatch`, `/dispatch/new`). `/welcome` picks the role on
first sign-in. Each area's layout guards its role. Revisit if the surfaces diverge enough to split.

### D12 — Dispatcher posts missions straight to the Pool via the user session (2026-06-16)
`/dispatch/new` inserts `status='pooled'` directly (no draft step in V1) using the **user-session**
client so RLS `p_mission_business_insert` authorizes it — service role NOT used for this write.
Business sets the **ceiling**; PDP curve params are auto-derived (`pdp_start` ≈ 50% of ceiling,
or = ceiling for SPEED WIN; `pdp_step` ≈ 5%; `pdp_interval` = 10 min) — tunable later. Maps
geocoding deferred (Doc 03): addresses are free text, `lat/lng` null, base fare is an optional
Dispatcher estimate that drives the soft-warning only. [[d6]]

### D13 — Status feed: status_event + service-role mission update; polling for now (2026-06-16)
The Driver's 4 status taps each write a `status_event` (the thing the Business watches) and advance
`mission.status`. Because there's no driver UPDATE policy on `mission`, the writes go through the
service role in a server action — gated by first verifying, under RLS, that the mission is the
Driver's and the requested step is the valid next one (`lib/mission-flow.ts`). The Business side
gets updates via **polling** (`LiveRefresh`, 4s) rather than websockets, so we don't have to modify
the DB (the `supabase_realtime` publication). Upgrade to true Realtime later by adding `status_event`
to that publication and swapping `LiveRefresh` for a subscription. [[d6]] [[d12]]

### D14 — Business side is a booking-style schedule + calendar, not cards (2026-06-16)
The Dispatch home is a **dense, day-grouped schedule** of rows (Today pinned) with an at-a-glance
**status colour** per line, expand-on-click detail (native `<details>`), and a month **calendar**
view. Status colour is **derived** from `mission.status` + time-to-pickup (`lib/dispatch-status.ts`),
so "red = not confirmed near pickup" works before the Lock-in scheduled job exists. The per-booking
**reference** (hotel room / event name) is stored in the existing `comment` column for now — a
deliberate no-schema-change choice (promote to a dedicated column later). Big cards remain the
Driver-side pattern only. [[d12]] [[d13]]

### D15 — Deploy from `main` on Vercel; key-gated dev sign-in for solo testing (2026-06-16)
Consolidated all work onto `main` (the feature branch was a session artifact) and deployed to
Vercel — `main` is now the permanent deploy branch (push → auto-redeploy). For solo live testing
without email/Supabase config, `/dev-login` + `/api/dev-login` require `?key=` matching the
`DEV_LOGIN_KEY` env var on hosted envs (local stays open; unset key = blocked). This is a
TEMPORARY scaffold — real drivers/businesses get email magic-link, and dev-login is turned off,
before real beta. Going forward: build on a branch, merge to `main` to deploy when verified.

### D16 — Storage buckets (private docs + public avatars) and a bank STUB, not raw capture (2026-06-17)
Accounts & records writes files to **Supabase Storage**, with buckets created on demand via the
service-role Storage API (`lib/supabase/storage.ts`). This is operational setup, **not** a DB schema
migration, so it respects hard-rule #4. Two buckets: **`documents`** is private — `document.file_url`
stores the storage PATH and reads mint short-lived **signed URLs** (sensitive proofs); **`avatars`**
is public — `business.logo_url` / `driver.profile_photo_url` store the public URL with a `?v=`
cache-buster (display assets). Document inserts + profile/business/dispatcher/vehicle updates go
through the **service role gated to the caller's own row** (no INSERT/UPDATE RLS for several of
these tables — extends D6/D7). Bank/card collection is a **deliberate stub**: status is derived from
the existing `stripe_account_id`/`stripe_customer_id` columns with an inert "coming soon" CTA. We do
**not** add or capture raw IBAN/card fields — there are no columns and storing raw bank/card data is
a PCI/compliance problem; Stripe Connect/Customer onboarding is the intended path, built later in the
Payments pillar. [[d6]] [[d7]]

### D17 — Driver service area = base location + radius (Mapbox), replaces operational zones (2026-06-17)
Founder feedback: a fixed town checklist doesn't model real VTC behaviour (a Cannes Driver will do
Milan→Nice but not Paris→Normandie). Switched the Pool from `zone ∈ operational_zones` to a
**geofence**: each Driver sets a **base** (geocoded via **Mapbox** autocomplete, public
`NEXT_PUBLIC_MAPBOX_TOKEN`) + a **service_radius_km**; a mission qualifies when its **pickup OR
drop-off** is within the radius (`lib/geo.ts` haversine; filter in `app/(app)/pool/page.tsx`). The
Business booking form geocodes pickup/drop-off into the existing `mission.pickup_lat/lng` +
`dropoff_lat/lng`; `zone` becomes a display-only label derived from the pickup town. **Schema:** an
*additive* migration (founder-approved) added `driver.base_label/base_lat/base_lng/service_radius_km`
(`docs/migrations/2026-06-17_driver_service_area.sql`) — additive only, no re-run of the base schema
(respects hard-rule #4). `operational_zones` is kept as a now-unused column; `lib/zones.ts` (BETA_ZONES)
was deleted. Matching runs in-app for beta scale (add a bounding-box/PostGIS prefilter later). [[d12]]

### D18 — Production splits the two sides onto role subdomains (2026-06-18)
The founder's "role switching" was a single shared Supabase session cookie: both demo roles signed in
on one host (`pickup-marketplace.vercel.app`), so each sign-in overwrote the other and open tabs flipped
on refresh. Fix: on the production domain **`pickupbedriven.com`**, the Driver app is served on
**`driver.*`** and the Business/Dispatch app on **`dispatch.*`**. Because `@supabase/ssr` sets
**host-only** cookies (no Domain attribute), each subdomain holds its own independent session — you can
be a Driver on one and a Business on the other at once, no switching. `lib/hosts.ts` maps role ↔
subdomain; `app/page.tsx` + the `(app)`/`(dispatch)` layouts cross-redirect to the correct subdomain;
dev-login targets each role's own subdomain. It's a **no-op off the prod domain**: localhost and
`*.vercel.app` keep single-origin path-based routing, so local dev/previews are unchanged. Stays ONE
Next app / one Vercel project (D11) — subdomains are extra domains pointed at it, enforced in the layout
guards, not a second deployment. Caveat for later: with host-only cookies, real magic-link users must
sign in on the right subdomain (or we add a shared-cookie/login bridge) — tracked against the real-email
pillar (BACKLOG A). [[d11]] [[d15]]

### D19 — Design direction (clean blue/slate) + Claude Design via GitHub-connect, not /design-sync (2026-06-18)
Founder direction: **clean, conventional, trustworthy "SaaS" blue** — functional, not a design vitrine,
don't reinvent. Implemented as a CSS-variable theme in `app/globals.css` (action blue `#2563EB`, slate
neutrals, white header) + the brand logo (`public/logo.png`, a purple→blue pin). To bring in
**Claude Design** (claude.ai/design) for its design POV: link the **public GitHub repo** via Claude
Design's **"Create here → Connect to GitHub"** (it reads our real React components + `globals.css` +
`project/DESIGN_BRIEF.md`). We do **not** use the `/design-sync` skill: it targets packaged design-system
*libraries* (Storybook, or a component package with a build), but PickUp is a Next.js *app* (no Storybook,
no library exports), and the `DesignSync` tool also needs a `claude.ai` `/login` (this session's
`CLAUDE_CODE_OAUTH_TOKEN` can't be granted design scopes). Handoff back is native: in Claude Design,
**Export → "Send to local coding agent"** drops a structured bundle (component spec + design tokens +
layout) into the Claude Code session to implement against the repo. `project/DESIGN_BRIEF.md` is the
shared context doc. Business app is designed first; the Driver app is delivered as a pixel-perfect phone
mockup. [[d11]] [[d17]]

### D20 — Dispatch redesign implemented from a Claude Design zip; Geist + Lucide adopted; `dx-` namespacing (2026-06-18)
Claude Design produced a handoff **zip** (`PickUp Design System-handoff.zip`). The `DesignSync`
connector stayed blocked (no design scopes on the session token; `/login` unavailable — see D19), so we
unzipped + implemented directly. Bundle lives at **`.design-handoff/`** (gitignored — reference for the
Driver phase, not committed). Founder-confirmed scope choices: **(1)** adopt **Geist + Geist Mono** (via
the `geist` pkg + `next/font`, self-hosted → no Google CDN, GDPR-safe) and **Lucide** (`lucide-react`);
**(2)** the Schedule **flight column shows flight number + ETA only — NO live flight status** (the
flight-tracking API isn't built; BACKLOG B); **(3)** build the **full calendar upgrade** (month+week,
peek drawer, KPI/search/vehicle filters). Implementation maps the design onto the repo's existing class
vocabulary where it already existed (reskinned `globals.css` tokens + shared classes) and introduces a
**`dx-`-prefixed** class set for the new Dispatch chrome (sidebar shell, schedule grid, calendar) so it
never collides with the Driver styles and maps 1:1 to the handoff for future syncs. Dispatch is done
first; the **Driver app is next, delivered as a phone mockup** then applied. Also: the dev-only
`/api/seed` now upserts the seed dispatcher's `profile` row (role=dispatcher) so a seeded Business is a
usable signed-in account — operational dev tooling, **not** a schema change (respects hard-rule #4). [[d19]] [[d17]]

### D21 — SPEED WIN starts at 70% of the ceiling and climbs fast (reverses D12) (2026-06-19)
Founder call (Session 11 triage): SPEED WIN should **not** start flat at 100% of the ceiling. New curve:
SPEED WIN now starts at **70%** of the ceiling and climbs **+5% every 5 min** toward it; a standard
mission still starts at 50% and climbs +5% every 10 min. This leaves the Driver some upside at the start
while still pulling a fast pickup. Implementation: removed the `speed_win → return ceiling` short-circuit
in `lib/pdp.ts` (the fare now always uses the normal climb from `pdp_start`); `dispatch/new/actions.ts`
sets `pdp_start = ceiling*0.7` and `pdp_interval = 5` for SPEED WIN. **No schema change** — `pdp_start`
already exists. Legally safe: the **Business still sets the ceiling** and PickUp only *recommends* the
start point (Doc 01 — keeps PickUp out of "the pricing algorithm controlling the fare"). The spec glossary
wording ("starts at/near the ceiling") is now superseded; updated here, not yet in Doc 00. [[d12]]

### D22 — New-mission flow: preview-before-post + save-as-draft (reverses D12 "straight to pool") (2026-06-19)
Founder call (Session 11): the Dispatcher should **review a final card before posting**, and be able to
**save a draft and resume later**. This reverses D12's "inserts status=pooled directly, no draft step".
New flow (`dispatch/new/mission-form.tsx`, a client form): fill → **Review** snapshots the fields into a
final **preview card** (O11) → **Post to the Pool** or **Save as draft** (O15). Drafts use the existing
`mission_status='draft'` enum value (no schema change). Resume loads the draft into the form
(`?draft=<id>`) and **updates in place** (UPDATE, not a new INSERT) via the user session
(`p_mission_business_update`); discard uses the **service role** (no DELETE RLS policy on `mission`),
scoped to the Business's own draft rows. Drafts are **excluded** from the Schedule/Calendar/History
(`.neq('status','draft')`) and live on a dedicated **`/dispatch/drafts`** page (new sidebar entry). Also
folded in: O9 — the pickup time is now interpreted as **Europe/Paris** wall time and converted to a real
UTC instant (`lib/time.ts`), fixing the old server-local-zone bug, plus a past-time guard for live posts
and quick date chips; and an O10a **SPEED WIN auto-suggest** in the preview when pickup is ≤5h away. [[d12]] [[d17]]

### D23 — Vehicle taxonomy = service tier × body + car catalog; real road ETA (2026-06-19)
Founder call (O5): model vehicles as **service tier (Eco/Business/Luxury) × body (Sedan/Van)**, each combo
resolving to a maintained **car catalog/classifier** (`lib/vehicle-catalog.ts`, founder's data); tiers
display as **Eco · Business · First**. The Dispatcher picks a tier + body (**Any/Sedan/Van** — Any reaches
both bodies) and, only when the Guest insists, a **specific car**. A Driver's tier is **auto-derived from
make+model** via a two-step fallback (`categorize()`: a checked-brands list + premium-model exceptions,
else Eco/Standard) — Drivers don't self-classify; body stays the Driver's pick. **Schema:** founder-approved additive migration
(`docs/migrations/2026-06-19_vehicle_taxonomy_and_eta.sql`, applied 2026-06-19): new `body_type` enum;
`vehicle.body_type`; `mission.required_body_type` (null = any) / `required_make` / `required_model`. The
existing `vehicle_category` enum becomes the **tier** (eco/business/luxury); the legacy `van` value was
backfilled to **business + body=van** and dropped from the UI/allowlists. **Pool** now matches tier (SQL)
+ body + specific car (in-app; specific-car uses a tolerant normalized match since Drivers type make/model
free-text — `carMatches()`). **ETA:** same migration adds `mission.distance_km` / `duration_min`, computed
once at creation via **Mapbox Directions** (`lib/directions.ts`) and cached. **Traffic-aware:** the
`driving-traffic` profile + `depart_at`=pickup time → the ETA reflects predicted traffic for that day &
hour (verified: a 27 km route returns 37 min Mon 9am vs 31 min Sun 2pm) — Mapbox's own historical+live
traffic, no Google. Cards show "27 km · 40 min" (straight-line `~` fallback for older/failed); the write
is conditional so a transient routing failure never wipes a cached ETA. Replaces the old flat 4-category enum (supersedes the
single-category model from the spine). Known follow-ups: bind the Driver's car to the catalog (a picker)
for fully-robust specific-car matching; geocode intermediate stops so ETA covers detours (today it's the
direct pickup→dropoff route). [[d17]]

### D24 — App-wide serious navy (#25344C) + Direction B two-pane new-mission form (2026-06-21)
Founder call: the bright action blue (#2563EB) read too "consumer/Facebook" and the new-mission page felt
narrow/cramped. **(1) Palette:** the action accent moves **app-wide** to a deep **navy #25344C** (hover
#1B2738, soft #E9EDF4) — swapped at the **token layer** (the `--blue-*` raws that `--accent*` chains to) so
every component follows with no per-component edits; `--ring` re-toned to navy so keyboard focus matches; the
status **info** tone (Confirmed/Accepted) shifted to a desaturated **steel #1B5E8A** (mirrored in
`lib/dispatch-status.ts` — the two MUST stay in sync) so a status pill never reads as a clickable navy
button; the few hardcoded blues (`.badge.status`, `.notice.info`, the date-picker focus ring) were
re-pointed to tokens. The **brand logo gradient is logo-only and unchanged**. Navy depth was picked from a
4-option inline comparison (ink / navy / steel / slate-blue) → the **midpoint of ink and navy**. **(2)
Layout:** `/dispatch/new` becomes a **two-pane** form — 4 section cards (Vehicle / Route / Schedule / Trip
details) on the left + a **sticky live Summary rail** (mini-route, ETA, ceiling, live starting fare =
`ceiling × (speedWin ? 0.7 : 0.5)`, SPEED WIN, actions) on the right, collapsing to one column <900px. It
stays **one `<form>`** so the `createMission` contract is unchanged; the D22 draft/Review flow, the live ETA
(`/api/eta`) and waypoints are preserved. `RouteStops` publishes a display snapshot up via `onSummaryChange`
and accepts an `etaDefault` to seed the rail on draft-resume. Verified app-wide incl. the Driver app;
deployed; a final 3-angle adversarial agent check returned ALL CLEAR. [[d19]] [[d20]] [[d22]]

### D25 — Design loop = Claude-Code-authored inline HTML mockups (augments D19/D20) (2026-06-21)
The founder found Claude Design (the export-zip round-trip of D19/D20) not yet smooth. New standing loop for
screen redesigns: **Claude Code builds a self-contained HTML mockup from the real tokens + data and renders
it inline** (the visualize widget); the founder reacts in plain language; we iterate the mockup (cheap to
change) until locked, then implement it for real against the repo and deploy. Used end-to-end this session
(two layout directions; cool vs warm palette; four navy depths) before any code was written. The Claude
Design zip path stays available when the founder prefers to design there; the **inline-mockup loop is the
default** for screens Claude Code can mock from existing code. [[d19]] [[d20]]

### D26 — New-mission form: pricing grouped into a card + the Summary rail is read-only (2026-06-21)
Founder call (Session 15): the right-hand **Summary rail is a read-only PREVIEW, not an input surface**. The
**Ceiling**, **Estimated base fare** and **SPEED WIN** were pulled into a dedicated left **"Pricing" section
card** (a 5th card, matching the others); the rail now shows the ceiling + live starting fare + a "Pricing
mode" line as *values* (no fields), then the actions (Review / Save draft / Post). The `createMission` contract
is unchanged. The too-low-fare warning renders in the Pricing card while editing, and a compact copy appears in
the rail **only in preview mode** (the editable sections are `display:none` there, so the nudge follows the user
to the post screen). [[d22]] [[d24]]

### D27 — Service class = tier tiles; specific-car a styled dropdown, hidden for Eco (2026-06-22)
Founder call (Session 16): the service-class **tier** picker (Eco / Business / First) became **three selectable
tiles** (was a native `<select>`), matching the body-type segmented control right below it. The **specific-car**
field stays a dropdown but is **`appearance:none` + a custom chevron** (the native one read thin/old-school on
desktop) and is **hidden entirely for Eco** — the car catalog has only business/luxury models (Eco is the
unlisted fallback), so an Eco specific-car list was a dead single-option dropdown; a one-line note shows instead.
Form fields unchanged (`category` via a hidden input / `required_body_type` / `required_make` / `required_model`).
WCAG-AA fix: the selected tile's example text was re-toned to `--slate-600`. [[d23]] [[d25]]

### D28 — Named passengers: structured `passenger_names` jsonb, rows = headcount, capacity-capped (2026-06-23)
Founder call (Session 17): a mission can **name N Guests** (`{first,last}`), stored **structured** in an additive
`mission.passenger_names jsonb` column (founder-applied migration `docs/migrations/2026-06-23_named_passengers.sql`
— I can't run DDL with the app keys; the founder runs it in the SQL editor). **The number of rows IS the
headcount** (`pax_count` = rows; default 1 row); names are optional per row. **Capacity-capped by Body type**
(Sedan 4 / Van 7 / Any 7, nudge past 4) — a **soft** cap (the UI disables Add; the server does not hard-block).
The cap depends on the body chosen in `ServiceClassFields`, **lifted** into `MissionForm` via an `onBodyChange`
callback and passed to `PassengerList`. `passenger_name` (singular) is kept as a **denormalised** display string
(first NAMED Guest) so the schedule line, Driver reveal and mission detail read it unchanged; stored **null**
(not a junk `[{"",""}]` blob) when no Guest is named. Resume **pads** rows up to `pax_count` so a legacy draft's
count survives. Shared helpers in `lib/passengers.ts`; UI in `components/passenger-list.tsx`. [[d22]] [[d23]]

---

## Open decisions inherited from the spec (not ours to close — track only)
From Doc 05 / Data Spine — values, not structure; don't let them block the build:
- Commission split exact numbers (~12.5% Business / ~10% Driver, teaser).
- Commission carved-out vs added-on.
- Charge timing: auth-at-booking vs capture-at-completion.
- Cancellation %s (Business compensation tiers, Driver penalty cap).
- Hard-floor field (floor-vs-benchmark).
- Fare extras (waiting, tolls, airport fee, hourly overtime).
- Final name for "SPEED WIN" (candidates: Rush, Fast Track).
