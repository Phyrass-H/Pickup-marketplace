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
