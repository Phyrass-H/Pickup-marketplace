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

### D29 — Dense Dispatch views fill the screen; the new-mission form stays narrow (2026-06-25)
Founder call: the Dispatch content read "squished to the left" — `.dx-main` was capped at **1120px** and
left-aligned (no auto-margin), leaving dead space on wide monitors (324px at a 1680px viewport). Rather than widen
everything and cap the form back (which would *change* the form page), added a **`.dx-main--wide` modifier
(max-width 1520px)** that the shell (`components/dispatch-shell.tsx`) applies **by `pathname`** to the dense data
views only — **Schedule, Calendar, History**. The **new-mission form is deliberately left at the 1120px default**
(founder asked NOT to touch it — it reads worse stretched: the tiles/inputs go sparse); Drafts (560px cards) +
Settings unchanged. Kept **left-aligned** (no centering) so the content stays in line with the topbar title.
Preview-first was done by applying the proposed CSS live in the browser at 1680px and screenshotting before/after
(the D25 loop works for width/layout tweaks too, not just full mockups). [[d24]]

### D30 — "Driver & service" mission-form card: anti-suit dress default, display-only languages, board file reuse (2026-06-25)
Founder ask (S19): a dedicated **Driver section** on `/dispatch/new` (BACKLOG § M item 2 + § L dress-code). Designed
via the D25 preview loop (6 mockup iterations) first, then built to match. Key calls:
- **Dress code** = a 4-rung ladder `driver_choice → smart_casual → business_formal → suit_tie`. Its default is
  **keyed to the service tier** (eco→Driver's choice · business→Smart casual · luxury/First→Business formal) and
  **never lands on suit & tie** — the Business must pick that on purpose (the founder's anti-over-asking goal). The
  default **tracks the tier** until the Dispatcher manually picks one (a per-mission `touchedRef`), then their pick
  sticks. The cross-mission **learned** default (adopt a repeated override after ~N times) is **deferred** (needs
  history aggregation). Suit & tie wording is neutral ("Specific event or VIP protocol", a `Sparkles` note), since
  most Drivers already wear a dark suit — anything specific goes in the message.
- **Requested languages are display / preference only — NOT a hard Pool filter** (filtering would shrink the Pool).
  Stored as label strings (curated set FR/EN/IT/ES/DE/AR), shown to the Driver and matched visually against their
  existing free-text `driver.languages`. **No proficiency "level"** — Drivers don't store one (founder dropped it).
- **Request flags** = one `jsonb` (meet_greet, greeter, luggage_help, child_seat, quiet_ride, pets). **"Card only"
  dropped** (PickUp handles payment); **PRM dropped** — it's a *vehicle category*, parked to IDEAS for the Bus
  expansion, not a per-mission flag.
- **Meet & greet name board** = a typed name **or** an attached PDF/JPG/PNG, reusing the existing private
  `documents` Storage bucket. Uploaded inside `createMission` with a **random storage path** (no insert-return-id)
  and a **conditional-spread** write (mirrors the `eta` pattern) so a draft re-save never wipes it; a dismiss writes
  `board_file_path: null` via `board_file_clear`. On-demand signed URL (`lib/mission-board-actions.ts` →
  `getMissionBoardUrl`, authz = Dispatcher-of-business OR assigned Driver) so lists never eagerly mint URLs. The
  **board name auto-fills from the first Guest** (name + surname) and tracks it live until overridden — lifted from
  `PassengerList` via `onPrimaryNameChange`, same pattern as the body/tier lifts.
- **Reveal gating:** languages / dress / flags show to the Driver **pre-accept** (so they self-select); board name +
  file + private message reveal only **post-accept** (same rule as Guest contact). **Migration**
  `docs/migrations/2026-06-25_mission_driver_section.sql` (founder-applied): additive `required_languages text[]`,
  `dress_code text`, `driver_flags jsonb`, `board_name text`, `board_file_path text`, `driver_message text`.
  Adversarially reviewed (auth sound, schema/types/writes exact match) + browser-verified end-to-end (draft
  write+read round-trip vs the real DB). [[d27]] [[d28]]

### D31 — Schedule rows shrink as one: fully-flexible grid + minimum + side-scroll (2026-06-28)
S25. Narrowing the Schedule made addresses vanish and the `Route`/`Flight` headers overlap — because the dense grid
had **4 rigid pixel columns** (time/flight/ref/status), so the only flexible track (route `minmax(0,1.9fr)`) absorbed
all the loss and collapsed to 0. Founder's words: *"the whole trip card to equally shrink horizontally"* + *"fix a
minimum limit"*. Decision: make **every** column `minmax(floor, fr)` so the row scales together; clip the header
cells (anti-overlap); below the summed floors hold `min-width: 572px` and **side-scroll** (`@media ≤880`, header drops
its sticky `top` offset). **Rejected** a reflow-to-stacked-cards (founder explicitly wanted the table to stay a table,
just smaller). CSS-only; History shares the grid; calendar untouched (own `.dx-peektrip`/fixed drawer).

### D32 — Per-stop trip progress WITHOUT touching the status enum (2026-06-28)
S26. A multi-stop trip had no progress story (stops stored in `waypoints` but no per-stop state; status jumped
`on_board → completed`; the Driver never even saw the stops mid-trip). Decision: keep the `mission_status` enum (hard
rule) and add **one additive counter** `stops_reached`. Between "on board" and "completed" the Driver taps
**"Reached — <stop>"** (server action `reachStop` — validates next-in-order + `on_board`); `advanceStatus → completed`
**guards** all stops are done. Business sees it on the dense **route rail** (reached = green, next = accent halo) + an
**"On board · k/N"** pill — **no new pill status** (would fight the tone system). **No `status_event` rows for stops**
(that table is enum-constrained). Real-time stays refresh-based (notifications deferred). Migration
`2026-06-28_mission_stops_reached`.

### D33 — New-mission validation: honest message + drop-off required to POST (2026-06-28)
S27. The "Review" warning was a **fixed catch-all** that recited every required field even when filled (it told the
founder to choose a vehicle class they'd chosen). Decision: make it **dynamic** — name only what's missing, in plain
words ("a pickup chosen from the address suggestions"). Fixed a latent bug: `review()` read coords with `Number()`,
and `Number("")` is `0` (finite), so an **un-located pickup slipped past** the client gate → switched to `toNum` +
`isValidLatLng`. And: a **POSTED (live) mission now requires a LOCATED drop-off** (picked from suggestions, like
pickup), enforced client + server (`error="nodrop"`); **DRAFTS stay lenient** (parked incomplete). Founder's call —
drop-off is critical for a transfer; the DB allows null only for future by-the-hour bookings. No migration.

### D34 — Business settings IA + the saved place is "the Business's address" (either end), not a "default pickup" (2026-06-28/29)
S28–S29. The Business account was 4 editable fields. **Researched** (audit + data-model + Booking/Airbnb/B2B study +
adversarial critique workflow) and **founder signed off an inline IA mockup** (D25). Decision: a **left-nav settings
area** — **Company** (business type / SIRET / VAT (TVA) / legal name / registered address + the existing Kbis),
**Contact** (+ account email read-only, reception line), **Branding**, **Booking defaults**; **Billing** + **Notifications**
as **clearly-marked DEFERRED stubs** (agent-positioned billing copy — fare *collected on the Driver's behalf*, service
fee + 20% VAT on the fee a separate line, **no derived VAT / invoice preview**). **CUT** (Doc 02): team/multi-seat,
roles, financial dashboard, multi-property. Each section is its own server-action form (`?s=<key>` re-opens the saved
tab); sections are server-rendered + passed into a client `SettingsTabs`. Migration `2026-06-28_business_profile_fields`.
**Founder follow-up (S29):** *not all Businesses are hotels*, and a Business is a fixed point that can be the **pickup
(departure) OR drop-off (arrival)** — or, for a concierge, **neither**. So a single "default pickup" was wrong. The
saved place is now **"Your address"** (`business_address_*`, renamed from `default_pickup_*`) with a **`prefill_pickup`
toggle** (default on; off when the address is never an endpoint) that auto-fills it into a new mission's pickup (new
missions only; drafts keep their own; always editable), plus a **pickup ⇄ drop-off swap** button (remounts the
uncontrolled `AddressAutocomplete`s via a `swapNonce` key). First entry toward the **saved-addresses address book**.
Removed the case-by-case "Default Guest instructions". Migration `2026-06-28_business_address_and_prefill`. [[d25]]

### D35 — Business identity → an account chip in the top-right topbar (2026-07-03)
S30. The Business was a cramped avatar + name tucked under "Settings" at the bottom-left of the Dispatch sidebar —
reading like a footnote. Showed 3 directions in a visualize mockup (D25): A = polished account card at the bottom · B
= business identity at the TOP of the sidebar (workspace header) · C = account chip in the top-right of the topbar.
Founder first picked B; on seeing it live, **corrected to C** — keep "PickUp Dispatch" top-left exactly as before, and
put the business name **top-right** as a chip that opens a dropdown (Sign out). Settings stays in the sidebar footer.
Uses the previously-empty right side of the topbar; standard SaaS account-menu pattern. [[d25]]

### D36 — Mission-form guidance = non-invasive, only-when-relevant nudges; concept teaching lives in a separate tutorial (2026-07-04)
S31–S32. The founder's recurring "very guided page" ask. A **4-way guidance audit** (`project/GUIDANCE_AUDIT.md`)
found the app is already substantially guided; the gap is **input-driven** reactive guidance. Decision: guidance
**surfaces only when the Dispatcher's own input triggers it** (never always-on — that's heavier/more confusing), in the
existing amber `.notice.warn` style, and **never blocks posting**. The founder is building a **standalone tutorial** in
parallel, so in-app we don't stuff concept definitions onto the page (a small glossary tooltip comes later, Tier 2).
Shipped 2 nudges (luggage-vs-vehicle, night pickup). The suggested Ceiling/base-fare range (highest-leverage) is
**deferred to the pricing work**. See D37. [[d25]]

### D37 — No empty-return charge; a smart trajectory-based Pool solves the deadhead instead (2026-07-04)
Founder decision. A long one-way transfer means the Driver drives back empty (*retour à vide*) — but the Business is
**never charged for it**. Instead of pricing the deadhead into the fare, PickUp will solve it **structurally** with a
**smart Pool** that prioritises Drivers by **trajectory**: a Driver finishing Cannes→Saint-Tropez is bumped up the Pool
for missions *departing* Saint-Tropez when the timing matches (backhaul / deadhead reduction). This is why the S31
long-distance "cover the return" nudge was **dropped before building** — it contradicted the model. The smart Pool is a
**V2 matching upgrade** (captured in `project/IDEAS.md`, not built); it feeds the pricing model (one-way transfers get
no return-leg surcharge).

### D38 — Luggage-vehicle Phase 1 = a standalone "van for luggage" run (2026-07-04)
S32 (Sujet B). "Sometimes we just hire an additional Van for luggages and it's enough." Decision: Phase 1 models a
**van USED for luggage**, not a new vehicle *class* and not a grouped booking. A Business posts a `luggage_only`
mission (forced **Van + Business** class — catalog vans are business-tier, so that's how it matches Van Drivers — no
passengers, bags via `luggage_count`); Van Drivers **opt in** at enrollment (`driver.accepts_luggage_runs`, **off by
default** — a Driver who won't risk bags in their van is never offered one); the Pool routes luggage runs only to
opted-in Van Drivers and labels them "Luggage run". **Boundary:** a standalone luggage run is its own mission — the
grouped **car + luggage van** on one booking is the **CUT grouped-mission** feature (Phase 2), and the cargo leg can
"stop before the end" of the passenger trip. **Phase 2 (still V2):** real cargo/truck classes by **volume/m³ bands**
(the "20 m³" idea, likely a partly separate fleet). Migration `2026-07-04_luggage_run_phase1` (additive; founder ran
it live). Preview signed off (D25).

### D39 — Mission edit is PHASED; the line is "has a Driver accepted yet?"; Phase 1 = info-only, no consent (2026-07-05)
S34. The KEEP "limited edit" (Doc 02) is built in phases, and the deciding principle is **whether a Driver has
accepted**. **Pooled** = the mission is nobody's → the Business edits anything freely (no consent). **Accepted+** =
two parties in a deal and **PickUp is the AGENT between them, not the boss** → a *material* change (route/price/time)
must be a **proposed amendment the Driver accepts or declines** (this is what keeps us an intermediary AND keeps the
deal honest — the Driver consents to the new price/time).
- **Phase 1 (SHIPPED):** info-only edit of a posted mission (guests+phones, flight, luggage, reference, Driver &
  service) with **no consent** (info doesn't change the deal) and **no price movement** — `updateMissionInfo`
  whitelists only info columns (never `base_fare/ceiling/pdp_*/created_at/category/pickup*/dropoff*/waypoints/distance/
  duration/zone/status`), atomic status guard (`pooled/accepted/confirmed`), RLS + `business_id` ownership. Migration
  `2026-07-05_mission_info_edited_at` stamps `info_edited_at`. **UX decisions:** edit entry = **"Edit details" at the
  TOP of the expanded trip detail** (founder rejected a row-level pencil); an **"Edited · time"** stamp shows in the
  **detail only, never the collapsed row** (founder's call); **per-item "what changed" was DECLINED** here — it's
  really a *Driver-notification* feature, so it's deferred to Phase 3.
- **Phase 2 (BACKLOG, founder to drive next):** the amendment model — change destination / add a stop after acceptance,
  as **propose → accept/decline** (atomic + audited, like `accept_mission`). App shows the delta (route + ETA + a price
  change), Driver taps accept/decline, terms swap atomically. **App is the system of record even if they agree by
  phone.** Price delta is **manual for now** (fare isn't distance-based yet — the PDP climb; auto-delta waits on the
  founder's pricing engine). Reuse `accept_mission`'s slot-conflict check to warn the Driver. Accept/decline only (no
  counter-offer). Decline → trip unchanged or Business cancels (needs O7).
- **Phase 3 (BACKLOG):** auto-computed delta (pricing engine) + notifications + an in-app "could we add a stop? +€X"
  note. Full design in `project/IDEAS.md` ("Dispatcher mission edit"). Previews signed off (D25).

### D40 — Mission edit PHASE 2 = amendment table + an atomic `respond_to_amendment` RPC mirroring `accept_mission` (2026-07-07)
S35, implementing the D39 Phase-2 design. The consent flow is **propose → accept/decline**, built as:
- **A new `mission_amendment` table** (the audit trail; greenfield — no amendment infra existed), holding the proposed
  new route + `new_fare` + a `from_snapshot` of the trip as agreed + `note` / `decline_reason` / `status`
  (`proposed→accepted|declined|superseded`). Additive migration `2026-07-07_mission_amendment.sql` (founder runs it);
  the base schema is untouched. RLS: Business r/w its own missions' amendments, Driver read-only on missions assigned
  to them, **no Driver write** (the RPC handles it).
- **`respond_to_amendment(id, accept, reason)` RPC** — chosen over a plain server action because the consented swap
  must be **atomic across two rows** (amendment + mission), which a server action can't transact. It's a faithful
  clone of `accept_mission`: `SECURITY DEFINER`, `current_driver_id()`, row-lock + verify (`accepted/confirmed`),
  first-wins conditional update. Called via the **USER session** (reads `auth.uid()`), never the service role (D6).
- **Fare is pinned, not stored separately:** there's no "agreed fare" column (the PDP fare computes from
  `ceiling`/`created_at`), so on accept the RPC **freezes** it by setting `ceiling = pdp_start = new_fare` + a flat
  curve + `speed_win=false`, so `currentFare()` returns exactly the agreed total. Clean, uses existing columns.
- **Scope (v1):** the amendable route = **pickup + stops + destination** (founder asked to allow pickup, beyond the
  D39 "destination + stops"); the **pickup TIME is not amended** in v1. Price delta is **manual** (typed) — auto-delta
  waits on the pricing engine ([[d37]]). **Accept/decline only** (no counter-offer); "adjust and re-send" supersedes.
- **Decline UX (founder ask):** the Driver gives an **optional one-tap reason**, and the Business sees the decline
  wrapped in a **calm reassurance** ("declines are normal in busy periods, not personal; the trip stays as agreed") —
  so a rejection never reads as cold. The **app is the system of record** even if they agreed by phone.
- **Driver card design (D25, 4 iterations):** the change must read **in-context inside the route** — unchanged legs
  muted, the changed leg highlighted with a badge (rejected an abstract "hero" restatement that lost the where) — and
  the drop-off row uses a **finish-flag**, not a landing-plane (to a Driver a plane = a pickup). **Phase 3** (auto
  price-delta + notifications + an in-app note) stays deferred on those integrations. [[d39]] [[d37]] [[d6]] [[d25]]

### D41 — Expanded trip-row redesign + a Business-private detail-edit change-log (2026-07-10)
S36. The expanded `.dx-trip__detail` (a flat 15-row `.kv` list that half-repeated the collapsed row) rebuilt into grouped,
scannable sections — a **scan-strip** (Pickup · Vehicle · Flight · Fare-right), a **route card** (full addresses + a
dot-to-dot connector that stops at the drop-off dot + trip distance/duration in the header), a **slim one-line Driver
bar**, and **Service · Guests side by side** with chips for languages/dress/requests. The flat `.kv`/`.route` classes
stay for the other pages that use them (rides, missions, new-mission). Founder drove it via the D25 preview loop (v1→v5).
**Plus "see what changed":** (a) the amendment **"Change accepted"** state now shows the fare/route diff from existing
`AmendmentBrief` data (no schema); (b) a new **`mission_info_change`** table logs **detail-edit** diffs (human phrases via
`lib/info-changes.ts`), rendered as a `.dx-trail` line. **Why a side table:** a detail-edit diff can contain the private
reference tag / guest names, so it CANNOT sit on the Driver-readable mission row — deny-by-default RLS, Business-only,
mirroring `mission_guest_contact` / `mission_amendment`. Migration `2026-07-10_mission_info_change.sql` (applied). Founder
chose the fuller "add the detail change-log too" option. [[d40]] [[d25]]

### D42 — Mission-form polish bundle (2026-07-10)
S37, five founder-requested tweaks (the two visual ones via a D25 preview). (1) **Review-before-posting card** lightly
polished to the S36 vocabulary (route rail + chips), staying recognisable. (2) **Guest names auto-capitalise** the first
letter only (safe for "Al Souad"/"de la Croix"). (3) **Numeric fields** (luggage / base fare / ceiling) switched from
`type=number` to `type=text` + `inputMode` + a controlled **sanitize** (`digitsOnly` / `decimalOnly`) — reliable vs
`type=number`'s quirks; phone stays flexible (`+`/spaces). (4) **Edit trail leads with the bold edit time**; the separate
"Edited ·" stamp is suppressed when a trail is present (no double time). (5) **Pricing card shows a live vehicle-reminder
chip** (`serviceClassLabel(tier, body)`) — the specific car isn't lifted from ServiceClassFields, so it's class·body only.

### D43 — Address search: tune Mapbox now (Riviera-first), Google Places later (2026-07-10)
S38. Founder flagged bad autocomplete (typing "aéroport t2" ranked a Roissy CDG shop / Barcelona / Geneva above the Nice
result) and asked about Google. **Tested the live Mapbox Search Box API:** the far-junk is a broad-country-list problem
(fixable), but Mapbox's **POI ranking is genuinely weak** — `proximity` only nudges, so a literal "T2" name match beats
the local airport; `bbox` / `poi_category` / tighter proximity all failed to surface the real NCE terminal. **Google
Places weights *prominence*** and would rank major airports/hotels/stations first — the founder's instinct is right.
**Decision:** ship a **free Mapbox cleanup now** (countries → `fr,mc,it,ch`; a client **Riviera-first re-rank** floats
local hits to the top without hiding far destinations) and **defer the Google swap until the final domain is registered**
(so the browser API key is restricted to the right domains ONCE, after the rebrand DNS move). Google = ~1 session, one
file (`address-autocomplete.tsx`), keep Mapbox for routing. [[d44]]

### D44 — Brand name = RED Executive (Riviera Executive Driver) (2026-07-10)
The long-open rebrand away from "PickUp" (La Poste holds "Pickup" as an EU transport trademark) resolves to **RED
Executive** — RED = **R**iviera **E**xecutive **D**river. The **repo/docs stay codenamed "PickUp" for now**; a code/copy
rename is a later task (don't assume it's been done). The **domain migration** (`pickupbedriven.com` subdomains → a RED
domain, e.g. `dispatch.redexecutive.com` / `driver.redexecutive.com`, or the on-brand `.red` TLD) is its own separate
~1-session task (DNS + Vercel + Supabase redirect allowlist + `lib/hosts.ts` + the Google key restriction), waiting on the
founder registering the name/domain. **Not to be confused with PickUp Go** (a separate product — hard rule).

### D45 — O7 cancellation / no-show / hand-over ruleset (2026-07-13)
Founder settled the full O7 policy: cancellation (both sides), no-show, the T-60 Business reclaim, re-pool pricing, and the
future Driver→Driver hand-over. **Split: Phase 1 = the cancellation spine (build now); Phase 2 = the "copilote" community
(later); disputes/mediation deferred but documented.** Fee *amounts* stay MANUAL to settle in beta, but the *rules* below
are fixed. All fees are penalties owed to **PickUp-the-intermediary**, never a transport charge (agent position, Doc 01).

- **DRIVER cancel (voluntary) = ALWAYS 100% of the trip amount** — no early-notice reduction. Deliberately tough because
  PickUp must be reliable for Businesses. The two escape valves (no fee): **hand the mission to a copilote** (Phase 2) or
  **the Business agrees to release** it back to the Pool. (A flight delay does NOT auto-waive the fee — the Driver's out is
  an escape valve, not an exception; whether a *documented* delay earns a protected release is an open sub-question.)
- **BUSINESS cancel = free until 5h before pickup; then a per-hour ramp.** >5h = **0%**; at **T-5h (−300 min) = 50%**;
  then **+10% per hour to 100% at pickup** (−4h 60 · −3h 70 · −2h 80 · −1h 90 · 0h 100). Replaces the earlier week-based
  draft in Doc 05 (Riviera/airport transfers are short-lead). PickUp's commission stays non-refundable.
- **NO-SHOW = Driver paid in full, like a completed mission.** Fires when the Driver is on-site (status **`arrived`**) and
  the Guest doesn't appear within the wait window: **1h airport · 20 min city/point-to-point.** The **Business is charged
  the full agreed fare** (Driver fully paid, PickUp keeps commission); the Business settles with its own Guest. Deeper
  mechanics (contact-attempt gate, evidence, whether the clock starts at scheduled time or flight landing) = defined later.
- **T-60 Business reclaim (NOT a Business cancel).** ONLY when the assigned Driver **hasn't confirmed the Lock-in
  notification AND is unreachable by phone**, PickUp **unlocks a reclaim button** (~T-60) so the Business takes the trip
  back and **re-pools it as SPEED WIN** — penalty-free for the Business (the Driver flaked → Driver takes a reliability
  mark). The button is **gated to the non-confirmation state** so a Business can't use it to dodge a legit cancel fee.
- **Re-pool pricing.** A re-pooled mission (Driver cancel · T-60 reclaim · released hand-back) re-enters the Pool as a
  **SPEED WIN starting at 70% of the ceiling**, like any SPEED WIN. Needs a `pooled_at` climb-origin (PDP climbs from
  `created_at` today, so a re-pool would mis-price without it).
- **DRIVER→DRIVER hand-over ("copilote") — Phase 2, LATER.** A full **transfer (novation)**, NOT subcontracting: the
  original Driver **drops out entirely** — no pay, no invoice, no liability; the copilote **re-accepts on their own
  account**, becomes the Driver of record (invoices, gets paid, carries every obligation) exactly as if taken from the
  Pool. The original Driver keeps only a **"passed on" trace** in history. **Legally confirmed viable — and this transfer
  model is *cleaner* than classic sous-traitance** (see the legal note below + IDEAS.md). Mandatory guardrails: copilote is
  an **active, verified, same-category** PickUp Driver (REVTC · carte pro · RC Pro · conforming vehicle — checked live at
  transfer); accepts on their **own account** (no account-sharing / *location de compte*); **zero money flows through the
  original Driver**; **Business consents by default** via terms (explained in the tutorial); GDPR-minimised data transfer;
  full **audit trail** (accepting-Driver vs performing-Driver). Needs the community/registration layer first. **Data-model
  NOW:** design distinct *accepting-Driver* vs *performing-Driver* fields so Phase 2 slots in without a rewrite.
- **Legal confirmation (the founder's explicit question).** YES, there is a lawful way — and the founder's framing IS the
  right one. The risky version is *sous-traitance* (A stays the contractor, pays B, invoices the Business, carries B's
  liability → a "mini-principal" + URSSAF requalification traps). The founder's version is a **clean transfer**: A earns
  nothing and carries nothing, B is the fresh Driver of record on their own account → no reselling, no account-rental, and
  PickUp stays the pure intermediary/agent (VAT position intact). Since 2026 *sous-traitance illicite* is a named REVTC
  offence, so the **credential gate is what keeps it legal.** Real precedent exists (Drivalty, iaDriver, and WAY-Partner —
  which credential-gates the pass — plus VTC cooperatives), so it's an established, buildable pattern.
- **Disputes / mediation = deferred, documented.** No dispute state today; V1 stays email + PickUp mediates on the
  timestamped trail (accept time · flight landing · contact log · proof of service), per Doc 05. Revisit deeper later.
- **NEW — SPEED WIN reachability gate (decided, build later).** A SPEED WIN may only be accepted by a Driver who can
  **physically reach the pickup on time**: geolocate the Driver, compute the GPS ETA to pickup, and **block acceptance with
  a popup** if they'd arrive late. Needs Driver geolocation + a Directions ETA call; relates to replacing the crude
  ±90-min `accept_mission` slot buffer. Captured in IDEAS.md + BACKLOG.
- **Refinements (founder answers, 2026-07-13):**
  - **Business cancel is FREE while the trip is still `pooled`** (no Driver has committed). The fee only protects a
    *committed* Driver, and PickUp's commission is taken at completion, so there is no cut to refund. The ramp applies
    only once a Driver holds it (accepted/confirmed/en_route/arrived).
  - **The Business ramp is LINEAR — 5% every 30 min** (= +10%/hour, landing exactly on 50/60/70/80/90/100 at each whole
    hour; fairer in between).
  - **No-show airport detection uses BOTH signals:** a flight number **OR** an airport-looking pickup address
    (`~* '(a[eé]roport|airport)'`) → 60 min; else 20 min city. (Businesses don't always supply a flight number.)
  - **No-show "be sure" nudge (Phase 1 UI):** before a Driver finalises a no-show, a professional confirm step
    encourages patience ("a quick call or a few more minutes — Businesses remember Drivers who go the extra mile"), so
    reporting the instant the window opens doesn't read as bailing. Pairs with a later contact-attempt gate.
  - **The no-show button is NOT red** (red = destructive/punitive; a no-show pays the Driver in full) — use amber/warn
    (caution + confirm), visually distinct from the red *cancel* action.
  - **MUTUAL-CONSENT RELEASE ("agreed cancellation") — Phase 2, precise spec.** A **free, no-fee** release that BOTH
    sides confirm (a "dating-app" double opt-in), separate from the unilateral Business cancel (which always pays the
    ramp). Flow: Driver + Business agree by phone that the Business should release the trip → the Business taps a
    **dedicated "agreed release" button** (NOT the normal cancel) → the Driver gets a **notification and must ACCEPT** →
    only on the Driver's accept does the trip release free (→ re-pool as SPEED WIN). **Why:** it stops a Business
    unilaterally cancelling on a committed Driver to dodge the fee (scam protection) — without the Driver's tap, the
    Business's only route is the fee-paying unilateral cancel. **Build cost: MODERATE** — reuses the amendment pattern
    almost exactly (a proposal record + a Driver accept/decline + an atomic RPC, like `respond_to_amendment`); degrades
    gracefully to refresh-based until notifications land. **Recommend: right after the Phase-1 spine (or as Phase 2).**
- **Migration (additive, founder-run) will add:** `mission.cancellation_fee`, `mission.cancelled_reason`,
  `mission.pooled_at`, a no-show marker (`no_show` + `no_show_at`), a widened `status_event` CHECK **or** a
  `mission_cancellation` audit table, a Driver **reliability mark**, and cancel/re-pool RPCs mirroring
  `accept_mission` / `respond_to_amendment`. The dormant `cancelled_by` / `cancelled_at` columns already exist.

### D46 — O7 agreed release BUILT (Business-initiated) + the 24h re-pool SPEED-WIN window (2026-07-19)
Built the mutual-consent **agreed release** (the D45 Phase-2 "agreed cancellation") and, in the same session, the founder
refined the re-pool pricing rule. Migrations `2026-07-19_agreed_release.sql` + `2026-07-19_repool_speedwin_window.sql`
(both additive, founder-run). Verified + 3-lens adversarially reviewed (6 findings fixed).

- **Direction = Business-initiated ONLY** (founder chose this over bidirectional). The Business taps a dedicated **"Agreed
  release · free"** button (distinct from the fee-paying Cancel) → the assigned Driver gets an accept/decline card and
  **must accept** → the trip releases **free (no fee, no reliability mark)** and re-pools. Decline → the trip stays exactly
  as agreed. The Driver's cancel-sheet escape valve ("Ask the Business to release it — free") is how a Driver *starts* it
  by phone; there is **no** Driver-initiated in-app proposal. Eligible only while `accepted`/`confirmed` (pre-execution).
- **Guardrails against pressure (founder's concern — a Business coercing a committed Driver into a free release).** The
  platform can't police the phone call, but it owns the **defaults + the receipts**: (1) declining is framed as **free,
  mark-free, and the Driver's choice** on the card; the Business-side decline state is **calm, not alarmist**; (2)
  **dispute-ready audit** — `mission_release` is append-only, **declines are retained** (a Business only HIDES a resolved
  request via `dismissed_at`, never deletes/rewrites), each row records who/when/note/decision/fare/**hours-before-pickup**
  so "a free release proposed inside the fee window, repeatedly declined" is legible and **per-Business counts are a query**.
  All writes go through **SECURITY DEFINER RPCs** (no client write policy) so the evidence can't be tampered with. The
  founder's framing: *not something we control, but something we set up fairly and can prove.* Abuse-rate **dashboard** =
  the deferred Admin workspace (BACKLOG F2); the data will be ready for it. **Review-weaponisation** (threatening a bad
  review) → when a Business→Driver review system is built, gate reviews to **completed trips + double-blind** so a
  released/declined trip generates no review right (logged as a constraint on that future feature).
- **RE-POOL PRICING — the 24h SPEED-WIN window (founder decision; supersedes D45 "re-pool = always SPEED WIN at 70%").**
  A re-pooled mission (driver cancel · T-60 reclaim · agreed release — **all re-pool paths**, for consistency) now prices
  by time-to-pickup: **< 24h → SPEED WIN** (start 70% of ceiling, climb 5%/5 min); **≥ 24h → NORMAL Pool** (start 50% of
  ceiling, climb 5%/10 min, SPEED WIN off) — no reason to burn SPEED-WIN margin when there's time to fill it. These are the
  exact curves a fresh posting uses. (T-60 reclaim is structurally always <24h, so always SPEED WIN — kept uniform.)
- **Review fixes folded in:** the cancel/reclaim/business-cancel RPCs now **supersede a pending `mission_release`** (they
  already did this for `mission_amendment`; `business_cancel` gained the amendment supersede it was missing too), the
  release cards/briefs are **gated to a still-releasable trip** (no dead/stale cards past accepted/confirmed or after a
  new Driver re-accepts a released trip), and `respond_to_release` locks **mission → release** (matching `propose_release`)
  to remove a deadlock inversion.

### D47 — No-show clock runs from when the GUEST was due, not from the Driver's arrival (2026-07-19)
Founder correction to D45. The free-wait countdown was anchored to the **Driver's** `arrived` tap — the wrong party. The
free wait is the **Guest's** grace period, so it runs from **when the Guest was due to be available**. Migrations
`2026-07-19_no_show_clock_origin.sql` + `2026-07-19_no_show_airport_label.sql` (additive, founder-run). Verified **9/9
live** against the real DB via a real Driver session.

- **The rule.** `guest_due := coalesce(guest_ready_at, pickup_at)`; reporting unlocks at
  `greatest(guest_due + wait, arrived_at + 5 min)`. Wait durations **unchanged** (60 min airport / 20 min city) — only the
  ORIGIN moved. The founder's two cases: an **airport** pickup starts the clock when the flight is **marked landed**; a
  **town** pickup starts it at the **ordered pickup time**, even if the Driver turns up early.
- **`arrived` is still required to report — it is just no longer the origin. Gate ≠ origin.** It remains a timestamped
  on-site attestation and part of the D45 dispute trail.
- **The 5-min on-site floor** (founder-approved) exists because a pure `pickup_at` anchor *introduces* a new abuse: a
  Driver arriving after the window already closed could file instantly and collect 100% for their own lateness. The floor
  never binds for an on-time Driver.
- **This closed a live exploit, not just a modelling error.** `advanceStatus` gates the `confirmed → en_route → arrived`
  walk on **sequencing only** — no time check. So a Driver could tap through ~33h early, wait out the 20-min city window
  and file a no-show: Business charged the full fare a day and a half before the trip, mission driven terminal, Guest
  stranded. Anchoring to `pickup_at` closes it, because the window can no longer elapse before the trip exists.
- **`mission.guest_ready_at`** (new, nullable) is the flight-tracking hook — the tracked instant the Guest became
  available. NULL until that integration lands, so today the behaviour is pure `pickup_at`. Deliberately **not**
  `flight_eta`, which is documented display-only: wiring a billing gate to a display column is how this bug happens twice.
- **Airport detection also reads `pickup_label`** (second migration). The Mapbox autocomplete stores the POI name in
  `pickup_label` and the navigable street address in `pickup_address`, so an airport booked from autocomplete **with no
  flight number** had no keyword in the address and silently got the 20-min city window. Pre-dates this work (it is in the
  original D45 migration); hidden because the seed writes "Aéroport" straight into `pickup_address`.
- **`hours_before_pickup`** is now recorded on no-show rows (it was hardcoded `0`, blanking the audit trail exactly where
  it is needed). It is **negative** for a no-show — reported *after* pickup — which is the opposite sign convention from
  the other four cancellation kinds. Cosmetic while settlement is MANUAL; noted in BACKLOG § H2.
- **`guest_ready_at` is now guarded (3rd attempt, verified live).** It feeds a money gate, so a Business must not be able
  to push it forward and hold the no-show gate shut. Trigger `trg_mission_guard_guest_ready_at` (migration
  `2026-07-22_guest_ready_at_guard_fix.sql`) rejects a change from `anon`/`authenticated`. Verified: Business PATCH →
  **403, value unchanged**; a normal Business column edit → 204; the **service role** (the future flight-tracking feed) →
  204. The two earlier attempts FAILED and are worth remembering as Postgres gotchas: (1) a **column-level `REVOKE` is a
  no-op** while the role holds table-level UPDATE — column privileges are only consulted when the table-level grant is
  absent; (2) a **`SECURITY DEFINER` trigger sees the function OWNER in `current_user`**, never the caller, so the guard
  never matched. The fix was dropping `security definer` (SECURITY INVOKER is what makes `current_user` the caller).
- **Still deferred to BACKLOG § H2 (founder):** **`pickup_at` has the same exposure** and additionally feeds
  `business_cancel_mission`'s fee tier — but it has a LEGITIMATE client writer (draft resume rewrites it), so it needs a
  status-aware rule, not a blanket block. Fix it with the full column-grant audit alongside the
  `p_mission_business_update` WITH CHECK flag.

---

## Open decisions inherited from the spec (not ours to close — track only)
From Doc 05 / Data Spine — values, not structure; don't let them block the build:
- Commission split exact numbers (~12.5% Business / ~10% Driver, teaser).
- Commission carved-out vs added-on.
- Charge timing: auth-at-booking vs capture-at-completion.
- ~~Cancellation %s (Business compensation tiers, Driver penalty cap).~~ **DECIDED — [[d45]]** (Business: free >5h · 50% at −5h · +10%/h → 100%; Driver voluntary cancel: always 100%). Euro *settlement* stays MANUAL in beta.
- Hard-floor field (floor-vs-benchmark).
- Fare extras (waiting, tolls, airport fee, hourly overtime).
- Final name for "SPEED WIN" (candidates: Rush, Fast Track).
