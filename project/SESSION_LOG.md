# PickUp — Session Log

> Append-only, newest at top. One entry per working session. Keep it short:
> what changed, what was decided, what's next.

---

## 2026-06-16 — Session 3 — Dispatcher (Business) slice — the loop closes
**Branch:** `claude/compassionate-tesla-rdbmqb` · **Env:** local (macOS).

**What shipped** — the other half of the marketplace, so the core V1 loop is now real
end-to-end (no more seed-only missions):
- **Role-aware app** (`lib/app-context.ts` + `routeFor`): one app serves Driver + Business,
  keyed off `profile.role`. New `/welcome` lets a first-time user pick Driver or Business.
- **Business onboarding** (`/onboarding-business`): creates `business` + `dispatcher` seat +
  `profile(role=dispatcher)`.
- **Dispatch area** (`/dispatch`): missions list for the Business, with the **assigned Driver's
  contact revealed** once accepted (service-role-gated to their own missions — mirror of the
  Driver side).
- **Create mission** (`/dispatch/new`): KEEP fields (category→pool routing, zone, addresses,
  intermediate stops, pickup time, pax/luggage, flight, comment, **ceiling**), posts straight
  to the Pool. Live **soft warning** when ceiling < estimated base fare (nudge, not block).
  PDP curve auto-derived; SPEED WIN toggle. Inserted via the **user session** so RLS authorizes
  it (no service role). Maps/geocoding deferred — addresses are free text, lat/lng null.

**Verified — the whole loop, under real RLS (not service-role bypass):** a Node script signed in
as a real Business and a real Driver and proved: Business inserts a mission as itself → Driver
sees it in the Pool → `accept_mission` succeeds (status=accepted, driver set) → **second accept
correctly rejected (atomic first-wins)** → both sides read the assigned mission. Plus `tsc` clean,
`next build` clean (11 routes), all guards redirect correctly.

**Decisions:** D11–D12 (see `DECISIONS.md`).

**Deferred / flagged:** Maps geocoding + real distance-based base fare; `datetime-local` is parsed
in the server's local zone (make Europe/Paris explicit before prod); Dispatcher realtime status
feed + mission detail/edit; mission can be posted with a past pickup time (no guard yet).

**Next session:** full browser walkthrough of both sides together (needs the Supabase redirect-URL
setting), then realtime status feed (Driver 4 status buttons → Dispatcher) or the design layer.

---

## 2026-06-16 — Session 2 — Driver PWA vertical slice (the bones)
**Branch:** `claude/compassionate-tesla-rdbmqb` · **Env:** local (macOS), pushes to GitHub.

**What shipped** — the first end-to-end Driver slice, KEEP-only, design deferred:
- Scaffolded Next.js 15.5 (App Router, TS) + Supabase (`@supabase/supabase-js` + `@supabase/ssr`).
  Hand-wrote `lib/database.types.ts` from `pickup_schema.sql` (D3) — never migrated the schema.
- **Auth:** email magic-link (OTP/PKCE) → `/auth/callback` → cookie session via middleware.
  `/login` is a server-guarded wrapper (redirects authed users) around a client form.
- **Onboarding** (glue): minimal Driver profile — zones + one vehicle/category — because the
  Pool can't filter without it. Writes via service role (no INSERT RLS on profile/driver).
- **Pool** (`/pool`): pooled missions filtered by the Driver's `vehicle.category` ∈ +
  `zone ∈ operational_zones`. PDP fare computed on read (`lib/pdp.ts`).
- **Mission detail** → **Accept** = `rpc('accept_mission', { p_mission_id })`, called as the
  user session. All atomic/slot-conflict/Lock-in logic stays in the DB function.
- **My Rides** (`/rides`): assigned missions with **contacts unlocked** — revealed server-side
  via the service-role client, gated to missions owned by this Driver (RLS can't express that).
- **Dev-only seed** (`GET /api/seed`): Business + Dispatcher + 6 pooled missions across zones/categories.

**Verified:** `tsc` clean · `next build` clean · dev server boots · route guards redirect ·
live Supabase read+write (seed inserted 6 missions; Pool filter returns the right 3).

**Review:** ran a 5-lens adversarial workflow (schema/security/auth/spec/correctness). Fixed all
8 confirmed findings: open-redirect in callback `next`, onboarding write-errors swallowed
(redirect-loop risk), seed route hardened to local-only, callback/login now surface link errors,
authed users redirected off `/login`, glossary "Client"→"Passager" in a seed comment, and
documented the Supabase redirect-URL allowlist. Also caught + fixed a PostgREST bulk-insert
NULL gotcha on `speed_win`, and upgraded `@supabase/ssr` 0.5→0.12 (see D10).

**Decisions:** D6–D10 (see `DECISIONS.md`).

**Action needed from the founder before the slice runs end-to-end in a browser:**
1. Supabase → Auth → URL Configuration → add `http://localhost:3000/auth/callback` to Redirect URLs.
2. Confirm the **third beta zone** (placeholder `Antibes` in `lib/zones.ts`).

**Next session:** manual browser run-through (login→onboarding→pool→accept→rides); then either
add realtime to the Pool, PWA icons + offline, or start the Dispatcher mission-creation side.

**Repo layout:** spec docs moved root → `docs/` as their single home (founder's preference;
files were byte-identical, nothing lost). `CLAUDE.md` references updated to `docs/…`.

---

## 2026-06-16 — Session 1 — Project bootstrap & env setup
**Branch:** `claude/compassionate-tesla-rdbmqb`

**What happened**
- Read all spec docs (00–05), the Phase 0 Data Spine, and `pickup_schema.sql`.
- Agreed the first milestone: a single end-to-end Driver PWA vertical slice
  (auth → Pool → detail → accept → My Rides). Plan approved in principle; build deferred
  until the user says go.
- Set up the environment (no app code yet, per user request):
  - `.gitignore`, `.env.local` (real keys, git-ignored), `.env.example` (placeholders).
  - `CLAUDE.md` with persistent rules + glossary.
  - `project/` continuity docs (STATUS, SESSION_LOG, DECISIONS, IDEAS).

**Decisions** — see `DECISIONS.md` (D1–D5).

**State of the DB:** empty. First session of PickUp; nothing exists yet.

**Next session:** when user says go — scaffold the Next.js PWA and build the Driver slice
(see `STATUS.md` → Next up).
