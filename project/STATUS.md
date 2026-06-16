# PickUp — Project Status

> The single "where are we now" page. A new session should be able to resume from here.
> **Last updated:** 2026-06-16

## Stage
**Pre-build / environment setup.** No application code written yet. Spec docs and the
live Supabase schema are the foundation.

## Stack (decided — see Doc 03 / CLAUDE.md)
Next.js (App Router, TS) on Vercel · PWA-first · Supabase (DB/Auth/Realtime/Storage) ·
Stripe Connect (later) · Google Maps or Mapbox (later).

## Done
- [x] Read & internalised the spec docs (00–05, Data Spine, schema).
- [x] `.gitignore` created (ignores `.env.local`, `node_modules`, `.next`, etc.).
- [x] `.env.local` created with real Supabase keys (URL, publishable/anon, secret/service-role).
      Verified git-ignored and untracked.
- [x] `.env.example` committed (placeholders only).
- [x] `CLAUDE.md` created (persistent rules + glossary + session pointers).
- [x] `project/` continuity docs created (this file, SESSION_LOG, DECISIONS, IDEAS).

## Next up (agreed first milestone — Driver PWA vertical slice)
Build only when the user says go. Build KEEP only; nothing CUT (Doc 02).
1. [ ] Scaffold Next.js + TS PWA (manifest, installable, mobile-first).
2. [ ] Install `@supabase/supabase-js` + `@supabase/ssr`; create browser + server clients.
3. [ ] Hand-write `database.types.ts` from `pickup_schema.sql`.
4. [ ] Driver auth via Supabase Auth (email OTP / magic-link).
5. [ ] Pool screen: list `pooled` missions filtered to the Driver's `operational_zones`
       + their vehicle `category`; each a card (price, date, times, pickup/dropoff, category).
6. [ ] Mission detail on tap.
7. [ ] Accept button → `rpc('accept_mission', { p_mission_id })`; on success move to
       "My Rides" and unlock contact info.
8. [ ] Seed test data together (Driver + Vehicle + a few pooled missions) to test the slice.

## Not in this slice (later KEEP work — not CUT)
Driver onboarding/doc upload, 4 status buttons + realtime feed, T-180 Lock-in UI,
payments/vouchers, the whole Dispatch side.

## Known notes / gotchas
- DB is empty — no Driver/Vehicle/Mission rows yet. Seeding needed before the Pool shows anything.
- Service-role key bypasses RLS → server-side only.
- Provided Project URL originally had `/rest/v1/`; stored as bare base URL.
