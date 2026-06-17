# Prompt for the next PickUp session

> Copy-paste the block below to start the next session. It orients a fresh Claude
> and sets the scope. Edit the "This session" line if you want a different pillar.

---

We're continuing PickUp (B2B VTC booking marketplace). This is a LOCAL session on my
Mac; we push to GitHub and the app auto-deploys to Vercel.

START BY READING (in order):
- `CLAUDE.md` (root) — hard rules + glossary.
- `project/SESSION_LOG.md` — newest entry is the resume point.
- `project/BACKLOG.md` — the full feature list with KEEP/MANUAL/V2 tags.
- `project/DECISIONS.md` and `project/IDEAS.md`.
- Skim `docs/` (00–05, Phase0 spine, `pickup_schema.sql`) — the source of truth.

CURRENT STATE:
- The full core loop is built and LIVE on Vercel, deployed from the `main` branch
  (https://pickup-marketplace.vercel.app). Driver app (Pool→Accept→run trip) and
  Business app (post mission→Schedule+Calendar→live status) both work end-to-end,
  verified against the real Supabase DB.
- Auth for now: key-gated dev sign-in at `/dev-login?key=…` (solo testing only).
  Real email magic-link is wired but needs the Supabase redirect-URL setting before
  real users.
- `.env.local` is git-ignored — make sure it exists with the Supabase URL + anon +
  service-role keys (see `.env.example`). `DEV_LOGIN_KEY` is only needed on Vercel.

HARD RULES (from CLAUDE.md): glossary exactly (Business, Dispatcher, Driver, Guest,
Pool, PDP, Ceiling, SPEED WIN — never "client"/"principal"); PickUp is an AGENT, never
principal; PickUp ≠ PickUp Go; the Supabase schema is ALREADY APPLIED — never migrate
it, generate types from it; build only KEEP items, nothing marked CUT/🅥.

WORKFLOW THIS SESSION:
- Work on a new branch off `main`; keep `tsc` + `next build` green; verify in the
  browser preview. When a feature is verified, merge to `main` to deploy (the founder
  authorizes main merges). Append to `project/SESSION_LOG.md` and push when done.

THIS SESSION — build the "Accounts & records" pillar (all KEEP, existing tables, no
schema change; documents go to Supabase Storage → the `document` table):
1. Driver & Business **edit-profile / settings** pages.
2. Driver **vehicle details** (make/model/colour/plate/seats) + Business **logo**.
3. **Document uploads** both sides (licence, insurance, RC Pro, REVTC, vehicle &
   company registration) → Storage + `document` rows; status stays 'pending' (👤 verify).
4. **Bank/card details** capture (prep for Stripe Connect; can stub the Stripe piece).
5. **Mission history** (month → list → detail) for both sides.

(If I'd rather do Payments, Notifications, Real-email-auth, or Analytics instead,
I'll say so — see `project/BACKLOG.md` for the full menu.)
