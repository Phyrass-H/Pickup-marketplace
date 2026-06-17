# Prompt for the next PickUp session

> Copy-paste the block below (from "We're continuing PickUp" to the end) into a fresh
> Claude Code session. It orients a new Claude and sets the scope. Pick ONE item under
> "THIS SESSION" (delete the others, or write your own).

---

We're continuing PickUp (B2B VTC booking marketplace). This is a LOCAL session on my
Mac; we push to GitHub and the app auto-deploys to Vercel.

START BY READING (in order):
- `CLAUDE.md` (root) — hard rules + glossary.
- `project/SESSION_LOG.md` — newest entry is the resume point.
- `project/BACKLOG.md` — the full feature list with KEEP/MANUAL/V2 tags.
- `project/DECISIONS.md` and `project/IDEAS.md`.
- Skim `docs/` (00–05, Phase0 spine, `pickup_schema.sql`) — the source of truth.

CURRENT STATE (live on https://pickup-marketplace.vercel.app, deployed from `main`):
- **Core loop** works end-to-end (Driver: Pool→Accept→run trip; Business: post mission→
  Schedule+Calendar→live status), verified against the real Supabase DB.
- **Accounts & records** (Session 7): Driver & Business settings/edit-profile, vehicle
  details, document uploads → Supabase Storage (`documents` private + `avatars` public
  buckets) + `document` rows (status 'pending', 👤 verify), bank/payouts STUB (no raw
  capture), mission history both sides.
- **Driver service area** (Session 8): the Pool now matches by a Driver **base location +
  service radius** (geofence), NOT a town list — a mission qualifies when its pickup OR
  drop-off is within the radius. Addresses use **Mapbox autocomplete** (Search Box API,
  includes hotels/airports); the Business booking form geocodes pickup/drop-off; avatar/
  logo have crop+zoom+remove. See DECISIONS D16–D17.
- **Auth for now:** key-gated dev sign-in `/dev-login?key=…` (solo testing). Real email
  magic-link is wired but needs the Supabase redirect-URL setting before real users.
- **Env:** `.env.local` (git-ignored) needs the 3 Supabase keys + `NEXT_PUBLIC_MAPBOX_TOKEN`
  (see `.env.example`). Mapbox token is also set in Vercel. ⚠️ Open follow-up: URL-restrict
  the Mapbox token once a final custom domain exists (tracked in BACKLOG H).

HARD RULES (from CLAUDE.md): glossary exactly (Business, Dispatcher, Driver, Guest, Pool,
PDP, Ceiling, SPEED WIN — never "client"/"principal"); PickUp is an AGENT, never principal;
PickUp ≠ PickUp Go; the Supabase schema is ALREADY APPLIED — never re-run it (additive
ALTERs only, founder-approved, recorded in `docs/migrations/`); build only KEEP items.

WORKFLOW THIS SESSION:
- Work on a new branch off `main`; keep `tsc` + `next build` green; verify in the browser
  preview against the real Supabase DB. When a feature is verified, merge to `main` to
  deploy (the founder authorizes each main merge). Append to `project/SESSION_LOG.md`.

THIS SESSION — pick ONE (see `project/BACKLOG.md` for the full menu):
1. **Payments — Stripe Connect** (recommended next): turn the bank/payouts stubs real —
   card payment per mission + commission split, write the `ledger_transaction` at
   completion, generate the `booking_voucher` (7 legal fields, Doc 01). Highest-value pillar.
2. **Account verification workspace** (BACKLOG F2): an in-app `/admin` (role=admin) queue to
   review new Drivers & Businesses + their uploaded documents and approve/reject — sets
   `document.status` + `driver.verified`. Needed before inviting real users.
3. **Real email sign-in**: switch on Supabase magic-link (one redirect-URL setting), turn
   off dev-login — required before real drivers/hotels.
4. **Internal observability stack** (BACKLOG F2): PostHog analytics + Sentry + admin metrics.
5. **Design/skin pass** over both apps (needs a design direction from the founder).
