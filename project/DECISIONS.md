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
