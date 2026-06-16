# CLAUDE.md — PickUp (read me first, every session)

PickUp is a **B2B VTC booking marketplace** — a French *centrale de réservation VTC*.
Professional VTC **Drivers** ↔ **Businesses** (hotels first) that need transport.

## Source of truth (do not contradict)
The spec docs at the repo root are canonical. Read before deciding anything:
- `00_Overview_and_Index.md` — what PickUp is + the glossary
- `01_Legal_VAT_Compliance.md` — agent/intermediary positioning, VAT, voucher rules
- `02_Product_Features_MVP.md` — V1 scope: **KEEP / CUT / MANUAL** per feature
- `03_Technical_Stack.md` — stack & architecture
- `04_Business_GTM.md` — market, beta strategy
- `05_Roadmap_Backlog_TODOs.md` — deferred (V2+) features & open decisions
- `PickUp_Phase0_Data_Spine.md` — entities, enums, state machine
- `pickup_schema.sql` — the actual DB schema (RPCs + RLS)

## For session continuity, read `project/`
- `project/SESSION_LOG.md` — chronological log of each session (the resume point)
- `project/DECISIONS.md` — decision log (what was chosen and why)
- `project/IDEAS.md` — parked ideas / backlog not yet in the spec
> Keep these current. A new session should pick up from the latest `SESSION_LOG.md` entry.

## Hard rules (never break)
1. **Glossary — use these exact terms, always:** Business, Dispatcher, Driver, Guest,
   Pool, PDP, Ceiling, SPEED WIN. **Never** "client" or "principal".
2. **PickUp is an AGENT / intermediary, never the principal.** This is a legal/VAT
   position (Doc 01). Never frame PickUp as the transport operator or reseller.
3. **PickUp ≠ PickUp Go.** They are different things; do not conflate.
4. **The schema is ALREADY APPLIED to the live Supabase DB.** Never recreate, migrate,
   drop, or re-run `pickup_schema.sql`. Generate TypeScript types FROM it.
5. **Build NOTHING marked CUT in `02_Product_Features_MVP.md`.** Build only KEEP.
   MANUAL items are done by a human in beta — don't build UI for them unless told.

## Stack (decided)
- Next.js (App Router, TypeScript) on Vercel · PWA-first.
- Supabase for DB / Auth / Realtime / Storage. `@supabase/supabase-js` + `@supabase/ssr`.
- Service-role key is **server-only** (bypasses RLS). Browser uses the anon/publishable key.

## Environment
- Secrets live in `.env.local` (git-ignored — never commit). Template: `.env.example`.
- Supabase project ref: `luitjivedqiumefhfzkw`.
- **Auth redirect allowlist (dashboard, not code):** magic-link sign-in only works
  if each origin's `/auth/callback` is in Supabase → Authentication → URL
  Configuration → Redirect URLs (+ Site URL). See `.env.example` for the list.
- **Local dev:** `npm run dev`; seed test missions with `GET /api/seed` (dev-only).

## Key data facts (from the spine)
- **Pool** is a query, not a table:
  `mission WHERE status='pooled' AND category = <driver's vehicle category>
   AND zone ∈ driver.operational_zones`.
- **Accept** = `rpc('accept_mission', { p_mission_id })`. It already does atomic accept
  (first wins), slot-conflict check, and the Lock-in 3h rule. Don't reimplement it.
- **Current fare (PDP)** is computed on read from base/ceiling/start/step/interval —
  never stored as "the price". SPEED WIN starts at/near the ceiling.

## Working agreement
- Develop on the branch you were assigned for the session. Commit with clear messages.
- Do not open a PR unless explicitly asked.
- When you finish a chunk of work, append to `project/SESSION_LOG.md`.
