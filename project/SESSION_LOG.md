# PickUp — Session Log

> Append-only, newest at top. One entry per working session. Keep it short:
> what changed, what was decided, what's next.

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

**Note:** an untracked `docs/` folder holds duplicate copies of the root spec files — left
untracked, not committed; safe to delete.

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
