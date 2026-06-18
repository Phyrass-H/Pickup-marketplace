# Prompt for the next PickUp session

> Copy-paste the block below (from "We're continuing PickUp" to the end) into a fresh
> Claude Code session. It orients a new Claude and sets the scope.

---

We're continuing PickUp (B2B VTC booking marketplace). This is a LOCAL session on my Mac; we push to
GitHub (`main`) and the app auto-deploys to Vercel. **Claude Code is allowed to push `main` to deploy**
(an `autoMode.allow` rule is set in `.claude/settings.local.json`).

START BY READING (in order):
- `CLAUDE.md` (root) — hard rules + glossary.
- `project/SESSION_LOG.md` — newest entry (**Session 9** + its 2026-06-18 addendum) is the resume point.
- `project/DESIGN_BRIEF.md` — brand, palette, glossary, every screen, constraints (shared with Claude Design).
- `project/BACKLOG.md`, `project/DECISIONS.md` (newest: **D19**), `project/IDEAS.md`.
- Skim `docs/` (00–05, Phase0 spine, `pickup_schema.sql`) — the source of truth.

CURRENT STATE (live, deployed from `main`):
- **Custom domain + role subdomains:** `pickupbedriven.com` (OVH) on Vercel. The two sides live on
  separate subdomains, each with its own session cookie (no role-switching):
  **`driver.pickupbedriven.com`** = Driver app · **`dispatch.pickupbedriven.com`** = Business/Dispatch.
  The bare domain shows a "Driver / Business" splash (www-canonical). Mapping in `lib/hosts.ts` —
  a no-op on localhost + `*.vercel.app` (those stay single-origin, path-based).
- **Design pass 1 (Business) shipped:** clean, conventional **blue/slate** theme (action blue `#2563EB`)
  in `app/globals.css`; **white app header + brand logo** (`public/logo.png`, a purple→blue pin);
  host/side-aware login. The **Driver app inherits the palette but its layout is NOT yet redesigned**.
- **Core loop** works end-to-end both sides against the real Supabase DB (Pool→Accept→run trip;
  post mission→Schedule/Calendar→live status; accounts/records; Mapbox autocomplete; service-area Pool).
- **Auth (testing):** key-gated dev-login. On the live subdomains:
  - Business → `https://dispatch.pickupbedriven.com/dev-login?key=v1a-DbkJHN9Dw3aqWKDGSfZ9`
  - Driver  → `https://driver.pickupbedriven.com/dev-login?key=v1a-DbkJHN9Dw3aqWKDGSfZ9`
  Local (`npm run dev`): dev-login is open, no key. Real email magic-link is wired but off.
- **Env:** `.env.local` (git-ignored) needs the 3 Supabase keys + `NEXT_PUBLIC_MAPBOX_TOKEN`
  (see `.env.example`); same set in Vercel.

THIS SESSION — the design loop is active:
- The founder is designing in **Claude Design** (claude.ai/design), fed by the **public GitHub repo**
  (Claude Design → "Create here → Connect to GitHub") + `project/DESIGN_BRIEF.md`. See DECISIONS D19.
  (We do NOT use `/design-sync` — PickUp is a Next.js app, not a packaged design-system library.)
- **You may receive a Claude Design handoff bundle** — the founder clicks Export → "Send to local
  coding agent" in Claude Design and it lands in your session. When it arrives: implement it against the
  repo, honor `project/DESIGN_BRIEF.md` (glossary, palette, the two device targets), keep `tsc` +
  `next build` green, verify in the browser preview, then push `main` to deploy and report the live URL.
  **Scope is Business (Dispatch) first.**
- After Business: deliver the **Driver app as a pixel-perfect smartphone mockup** (render it in-chat in a
  latest-phone frame for approval), then apply it.
- Also pending (not urgent): **Mapbox token URL-restriction** (BACKLOG H — make a restricted token
  scoped to `driver.`/`dispatch.`/`localhost`, swap `NEXT_PUBLIC_MAPBOX_TOKEN` in Vercel + `.env.local`,
  redeploy); **per-role PWA** manifest/icons; and any detail/behavior fixes the founder lists.

HARD RULES (from CLAUDE.md): glossary exactly (Business, Dispatcher, Driver, Guest, Pool, PDP, Ceiling,
SPEED WIN — never "client"/"principal"); PickUp is an AGENT, never principal; PickUp ≠ PickUp Go; the
Supabase schema is ALREADY APPLIED — never re-run it (additive ALTERs only, founder-approved, recorded
in `docs/migrations/`); build only KEEP items.

WORKFLOW THIS SESSION: work on a branch off `main` for code changes; keep `tsc` + `next build` green;
verify in the browser preview against the real Supabase DB. Push `main` to deploy (Claude Code may push).
Append to `project/SESSION_LOG.md` when a chunk is done.
