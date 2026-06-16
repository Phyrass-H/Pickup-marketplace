# PickUp — Ideas & Parked Notes

> Loose ideas, "remember to consider", and things that aren't yet in the spec docs.
> When an idea becomes a real plan, promote it into the spec docs (00–05) or DECISIONS.md
> and remove it here. Keep this from becoming a second source of truth.

---

## Build-time reminders
- Enforce the glossary in code: name variables/components Business/Dispatcher/Driver/
  Guest/Pool/Ceiling — never `client`/`principal`. Consider a lint note in review.
- PDP fare is computed on read — keep a single shared `pdp.ts` so Driver + Dispatch agree.
- Pool RLS lets a Driver read *any* pooled mission; the zone/category narrowing is done in
  the query, not by RLS. Keep that filter in one place to avoid drift.

## Parked (not yet scoped)
- ~~Seed/fixtures script~~ — DONE as dev-only `GET /api/seed` (see D9).
- Scheduled jobs the spine assumes (PDP climb, Lock-in/T-180, expiry, return-to-pool) —
  not in the first slice; plan where they run (Supabase cron / edge functions / Vercel cron).
- TypeScript type generation via Supabase CLI once credentials/CLI are wired (see D3).
- **Realtime Pool/My Rides** — currently `force-dynamic` (fresh on each load), no live
  subscription. Add Supabase Realtime so the Pool updates as missions are taken / PDP climbs.
- **PWA polish** — `manifest.webmanifest` has no icons yet; add icons + offline shell + install.
- **PDP climb origin** — fare climb is measured from `mission.created_at`; if a dedicated
  `pooled_at` is added later, switch `lib/pdp.ts` to that.
- **Design layer** — bones only so far (neutral CSS vars in `globals.css`); apply a real theme
  + logo when the founder picks a direction (premium/trustworthy).
- **Maps / geocoding (Dispatcher)** — `/dispatch/new` uses free-text addresses (lat/lng null) and
  a manual base-fare estimate. Wire Google Maps/Mapbox for autocomplete + distance → real
  recommended fare, and validate waypoints. (Doc 03.)
- **Pickup-time timezone** — `datetime-local` is parsed in the server's local zone; make
  Europe/Paris explicit before prod (Vercel runs UTC). Also guard against past pickup times.
- **Dispatcher realtime status feed** — the 4 Driver status buttons → live updates on `/dispatch`
  (Supabase Realtime). Currently the list is `force-dynamic` (fresh per load).
- **Dispatcher mission detail + limited edit** — KEEP per Doc 02 (free edits while pooled; material
  edits after acceptance need re-consent). Not built yet; list view only.

## Questions to raise with the user when relevant
- ~~Beta zones / third town~~ — RESOLVED: founder confirmed the beta covers the **whole French
  Riviera, Saint-Tropez → Monaco/Menton**. `lib/zones.ts` now lists the Riviera communes.
- Preferred GPS deep-link behaviour (waze/google/apple) — confirm per-platform URLs later.
