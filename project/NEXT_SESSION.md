# Prompt for the next PickUp session

> Copy-paste the block below (from "We're continuing PickUp" to the end) into a fresh
> Claude Code session. It orients a new Claude and sets the scope.

---

We're continuing PickUp (B2B VTC booking marketplace). This is a LOCAL session on my Mac; we push to
GitHub (`main`) and the app auto-deploys to Vercel. **Claude Code is allowed to push `main` to deploy**
(an `autoMode.allow` rule is set in `.claude/settings.local.json`).

START BY READING (in order):
- `CLAUDE.md` (root) — hard rules + glossary.
- `project/SESSION_LOG.md` — newest entry (**Session 10**, the Dispatch redesign) is the resume point.
- `project/DESIGN_BRIEF.md` — brand, palette, glossary, every screen, constraints (shared with Claude Design).
- `project/BACKLOG.md`, `project/DECISIONS.md` (newest: **D20**), `project/IDEAS.md`.
- Skim `docs/` (00–05, Phase0 spine, `pickup_schema.sql`) — the source of truth.

CURRENT STATE (live, deployed from `main`):
- **Custom domain + role subdomains:** `driver.pickupbedriven.com` = Driver app · `dispatch.pickupbedriven.com`
  = Business/Dispatch. Each subdomain has its own session cookie (no role-switching). Mapping in
  `lib/hosts.ts` — a no-op on localhost + `*.vercel.app`. Bare domain shows a Driver/Business splash.
- **Dispatch (Business) redesign SHIPPED** (Session 10 / D20) — the Claude Design handoff, implemented:
  full **design-token system** in `app/globals.css` (slate + action-blue, the five status tones,
  spacing/radii/shadows/focus-ring); **Geist + Geist Mono** via `next/font` (`geist` pkg, self-hosted);
  **lucide-react** icons. **Collapsible sidebar shell** (`components/dispatch-shell.tsx`) replacing the
  top tabs. **Schedule** with a **Flight** column (number + ETA, display only) + **T-180 red row-wash**
  (`components/trip-row.tsx`). **Full Calendar** (`components/dispatch-calendar.tsx` + server
  `calendar/page.tsx`): month **+ week** views, **KPI filter chips**, guest search, status/vehicle
  filters, **day peek drawer**, cross-month week nav (`?week=first|last`), and **＋ / empty-day → New
  mission prefilled with that date**. Glossary header is **"Guest / ref"**. 11 adversarial-review
  findings fixed (a11y, week nav, KPI count, etc.). Verified in-browser + live.
- **Driver app:** inherits the new palette + Geist font, but its **layout is NOT yet redesigned** — that
  is the next design pass (deliver as a phone mockup first, then apply).
- **Core loop** works end-to-end both sides vs the real Supabase DB (Pool→Accept→run trip; post
  mission→Schedule/Calendar→live status; accounts/records; Mapbox autocomplete; service-area Pool).
- **Auth (testing):** key-gated dev-login. On the live subdomains:
  - Business → `https://dispatch.pickupbedriven.com/dev-login?key=v1a-DbkJHN9Dw3aqWKDGSfZ9`
  - Driver  → `https://driver.pickupbedriven.com/dev-login?key=v1a-DbkJHN9Dw3aqWKDGSfZ9`
  Local (`npm run dev`): dev-login is open, no key. `GET /api/seed` (dev-only) creates a Business +
  Dispatcher (now **incl. a `profile` row** so it's a usable login) + 6 missions. Real magic-link wired but off.
- **Env:** `.env.local` (git-ignored) needs the 3 Supabase keys + `NEXT_PUBLIC_MAPBOX_TOKEN`; same set in Vercel.

THE DESIGN WORKFLOW (established + working — see D19/D20):
- Founder designs in **Claude Design** → **Export → zip** → drops the zip into the Claude Code session →
  Claude implements it against the repo + deploys. The live `DesignSync` connector is **blocked** (the
  session token can't get design scopes; `/login` unavailable) — **the zip path is the reliable one.**
- Each handoff the founder states the **scope** (which screens changed) and flags any element that needs
  **live backend vs. placeholder**. Claude implements everything wirable over existing data/actions, then
  hands back a short **"needs a backend decision"** list BEFORE building any new backend/schema/external
  service (it never fakes data or assumes intent from a mockup). Honor `DESIGN_BRIEF.md`.
- The last handoff bundle is kept locally at **`.design-handoff/`** (gitignored). The **Driver UI kit** is
  at `.design-handoff/pickup-design-system/project/ui_kits/driver/`.

THIS SESSION — pick what the founder asks:
- **Driver app redesign (headline next item):** deliver as a **pixel-perfect smartphone mockup** (render
  in-chat in a latest-phone frame for approval), then apply it. UI kit is in the bundle above.
- OR receive another **Claude Design zip** (e.g. a second Dispatch pass) and implement it.
- OR **Engineering hardening** — the founder wants these done before real production (see BACKLOG
  "Engineering hardening"): **automated tests** (esp. money/PDP/`accept_mission`/RLS), **CI on PRs**
  (typecheck + lint + test), **generated DB types** (`supabase gen types`, replacing the hand-written
  ones), **real email auth** (remove dev-login), **error monitoring + analytics** (Sentry/PostHog).
  Biggest single quality win = a test suite around the money/pricing/accept logic + a CI check.
- Pending platform polish: **Mapbox token URL-restriction** (BACKLOG H), **per-role PWA** manifest/icons.

HARD RULES (from CLAUDE.md): glossary exactly (Business, Dispatcher, Driver, Guest, Pool, PDP, Ceiling,
SPEED WIN — never "client"/"principal"); PickUp is an AGENT, never principal; PickUp ≠ PickUp Go; the
Supabase schema is ALREADY APPLIED — never re-run it (additive ALTERs only, founder-approved, recorded in
`docs/migrations/`); build only KEEP items.

WORKFLOW THIS SESSION: work on a branch off `main` for code changes; keep `tsc` + `next build` green;
verify in the browser preview against the real Supabase DB. Push `main` to deploy (Claude Code may push).
Append to `project/SESSION_LOG.md` when a chunk is done.
