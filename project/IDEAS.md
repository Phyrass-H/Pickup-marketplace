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
- ~~**Design layer**~~ — theme applied: blue/slate (S9) → Dispatch redesign (S10/D20) → **app-wide navy
  #25344C** (S14/D24). Dispatch + the new-mission form (two-pane + live Summary rail) are done; the **Driver
  app layout** is the remaining redesign. The design loop is now **D25** (inline HTML mockups from Claude Code).
- ~~**Maps / geocoding (Dispatcher)**~~ — DONE: Mapbox autocomplete (S8), geocoded pickup/dropoff **and
  stops** (S13), traffic-aware road ETA routed **through** stops (S12/S13), France-biased suggestions (S13).
  Remaining: feed the ETA into a better **recommended base fare** (still a manual estimate), and use
  `duration_min` to replace the crude ±90-min `accept_mission` slot-conflict buffer.
- ~~**Pickup-time timezone**~~ — DONE (Session 11): `lib/time.ts` interprets `datetime-local` as
  Europe/Paris and converts to a UTC instant; live posts are guarded against past pickup times.
- ~~Dispatcher realtime status feed~~ — DONE (Session 4) as near-realtime **polling** (`LiveRefresh`,
  4s). Upgrade to true Supabase Realtime websockets later: add `status_event` to the
  `supabase_realtime` publication and swap `LiveRefresh` for a channel subscription.
- **Completion side effects** — when a Driver marks `completed`, we only set the status. Still to
  build (later milestone): Stripe capture + `ledger_transaction` + `booking_voucher` generation.
- **Dispatcher mission detail + limited edit** — KEEP per Doc 02 (free edits while pooled; material
  edits after acceptance need re-consent). Not built yet; list view only.

## Navy / redesign follow-ups (parked Session 14)
- **Driver "Complete ride" button colour** — `app/(app)/rides/status-control.tsx` uses a `success-btn`
  class that has no CSS, so it falls through to the navy `.btn`. Make it intentionally **green** (define
  `.success-btn`) so "complete" reads as a positive terminal action, not just another navy primary.
- **Logo harmony with navy** — the mark (`public/logo.png`) is a purple→sky-blue gradient; next to the
  serious navy UI the bright sky-blue can clash. Re-export a navy-harmonised mark (an asset task, not a
  token change — the brand gradient tokens are logo-only and were left untouched).
- **Dispatch on a phone** — the Dispatch sidebar doesn't auto-collapse on narrow widths (only the manual
  toggle), so the desktop dashboard is cramped on mobile. Pre-existing; Dispatch is desktop-first. If mobile
  Dispatch ever matters, auto-collapse the sidebar to the 66px rail below ~720px.
- **Bind the Driver's car to the catalog** — Drivers type make/model free-text (matched tolerantly via
  `carMatches`). A picker bound to `lib/vehicle-catalog.ts` would make specific-car Pool matching fully robust.

## Questions to raise with the user when relevant
- ~~Beta zones / third town~~ — RESOLVED: founder confirmed the beta covers the **whole French
  Riviera, Saint-Tropez → Monaco/Menton**. `lib/zones.ts` now lists the Riviera communes.
- Preferred GPS deep-link behaviour (waze/google/apple) — confirm per-platform URLs later.
