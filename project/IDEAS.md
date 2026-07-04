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

## Founder idea dump — 2026-06-23 (raw → triaged)
> Strategic / open-question / V2 ideas from a founder brain-dump. The concrete **guided-form polish** items
> from the same dump went to `BACKLOG.md` § L. Promote items here into the spec docs / DECISIONS when scoped.

### Vehicle taxonomy — expansion & catalog fixes
- **Catalog audit (facts, 2026-06-23):** `lib/vehicle-catalog.ts` has only **sedan** + **van** bodies (SUVs
  like Cayenne / Levante / X5 are filed as "sedan"); tiers are **business** + **luxury** only — **no Eco
  models** (Eco is the unlisted fallback). **Maserati** IS present (Quattroporte / Ghibli / Levante / Grecale)
  but as sedans/SUVs — **no sports coupés/convertibles** (a 2-seat sports car has no VTC use). All 7 vans
  (Classe V, Vito, Sprinter) are **business** → there is **no First-tier van**, and **Classe V is Business, not
  First**.
- 🅥 **"Bus" tier/body (V2)** — the **Sprinter** is really a **minibus**, currently mis-bucketed as a van. Add
  a proper people-mover axis: minibus (Sprinter) → midibus → coach, with seat-count bands. (Founder: MVP V2.)
- 🅥 **First-tier VIP van/people-mover** — a luxury Classe V / EQV (VIP captain seats) should be selectable as
  **First**, not only Business. Decide if "First van" is just a tier×body combo or its own service.
- 🅥 **Cargo / luggage vehicle (V2)** — a dedicated luggage option (Fr. *fourgon / utilitaire* — the
  cubic-metre vans used for moving) so the **luxury** range is complete (e.g. lead S-Class + a following
  luggage van). NOTE: "lead car + luggage van" is a **multi-vehicle / grouped mission**, already **CUT→V2**
  (Doc 02). Capture both: the cargo vehicle type AND the grouped mission that uses it.
  - ✅ **Phase 1 SHIPPED (Session 32, 2026-07-04)** — a **standalone "van for luggage" run**: a Business posts a
    `luggage_only` mission (forced Van + Business, no passengers, bags via `luggage_count`); Van Drivers **opt in**
    (`driver.accepts_luggage_runs`, off by default) to receive them; the Pool filters to opted-in Van Drivers and
    labels it "Luggage run". **Phase 2 (still V2):** real cargo/truck classes by **volume/m³ bands** (the "20 m³"
    idea) — likely a partly separate fleet — AND the grouped **car + luggage van** on one booking (the CUT
    grouped-mission feature; note the cargo leg can "stop before the end" of the passenger trip — a founder point).
- ❓ Body axis beyond sedan/van (SUV? coupé?) — likely unnecessary for VTC; revisit only if Guests ask.

### Driver specialisation / skills (V2)
- 🅥 Let Drivers opt into **specialisations / skills** for more accurate matching — e.g. decline
  "**luggage-van**" runs (a van used only for bags, with a separate lead car for the Guest), or flag
  VIP / security / multilingual / child-seat capability. Pairs with the grouped-mission idea above.

### Pricing engine (open — needed before real money) ❓
- ❓ **How is the fare actually computed?** Today the Business sets a **Ceiling** and PickUp recommends a start
  (PDP climbs toward it); there is no objective base price by **tier × body × distance × season/time**. Founder
  ask: is there a known VTC/taxi pricing model or dataset to seed the MVP?
  - Initial take (research later — it's data/integration, deferred this phase): there is **no single public VTC
    price DB**. Practical seeds — French **taxi tariff orders** (préfecture *tarifs taxi* A/B/C/D) as a floor;
    a hand-tuned **base + €/km + €/min** grid per tier with airport/season multipliers; later, learn
    empirically from our own accepted-fare data. PickUp stays the **recommender, never the price-setter**
    (Doc 01 — the Business sets the Ceiling). Connects to the Doc 05 "hard-floor" + "fare extras" open items.

### Smart Pool — trajectory-based Driver prioritisation · no empty-return charge (V2) 🅥
> Founder decision, 2026-07-04.
- **The Business is NEVER charged for the Driver's empty return leg (*retour à vide*).** Instead of pricing the
  deadhead into the fare, PickUp solves it **structurally** with a **smart Pool** that prioritises Drivers by
  **trajectory**: a Driver finishing a trip is bumped up the Pool for missions whose **pickup is near their
  current drop-off**, within a **time window**, so the return isn't empty. Example: a Driver on
  **Cannes → Saint-Tropez** is prioritised for missions *departing* Saint-Tropez when the timing matches
  (backhaul / deadhead reduction — a natural fit for the Riviera corridor).
- **Blast radius (when built):** the Pool is a query today — `status='pooled' AND category=…` + base+radius
  (`app/(app)/pool/page.tsx`). This adds a **prioritisation/ordering layer** on top: rank a Driver's Pool by the
  proximity of each mission's pickup to that Driver's *in-progress / most-recent* mission drop-off, plus a timing
  overlap (their trip's ETA-end vs the candidate's pickup time). Needs the Driver's next-free position + time
  (derivable from their accepted missions). **Not a hard filter — a prioritisation**, so Drivers still see the full Pool.
- **Why it matters:** this is the *reason* there's no empty-return charge, so it feeds the pricing model directly —
  one-way long transfers get **no return-leg surcharge**. Connects to the Pricing-engine note above and the Doc 05
  "fare extras" open item. Status: **V2** (a matching upgrade beyond the MVP base+radius Pool) — capture now, build later.

### Business vets the Driver before confirm (optional) ❓
- ❓ Optional **Settings toggle**: a Business may require **reviewing/approving the assigned Driver** (photo,
  car, rating/docs) before the mission locks. Off by default (most won't want the extra step / it slows the
  SPEED WIN loop). Pros/cons discussed in chat 2026-06-23. Ties to driver verification (BACKLOG F2) + Lock-in.

### Keep both sides on the platform + overtime (later)
- 🅥 **Anti-disintermediation** — once a hotel meets a good Driver via PickUp, what stops them going
  off-platform? Strategy/comms (belongs in **Doc 04 GTM**): position PickUp as the **guarantee layer** — for
  Drivers, secured/guaranteed payment + dispute cover; for Businesses, vetted drivers, SLA, a backup if a
  Driver cancels, one invoice + VAT. Draft the "why stay on PickUp" pitch for each side.
- 🅥 **Overtime / waiting time** — handle a mission running long (mise-à-disposition overrun, airport waiting).
  Connects to the existing **Doc 05 open decision "fare extras (waiting, tolls, airport, hourly overtime)"**.
  Later: a time-tracking / extra-charge mechanism.

### At-Disposal (mise à disposition) form UX — build with O12 (V2)
- 🅥 When **At-Disposal** is selected, the date/time picker should switch to a **from → to + hours/day** model
  instead of a single pickup instant. (O12 / hourly is confirmed **V2** — build this alongside it.)

### PRM / accessible transport — bundle with the Bus / vehicle-taxonomy expansion (later)
- 🅥 **PRM (wheelchair-accessible)** is a **vehicle category**, not a per-mission Driver flag — it needs an
  accessible vehicle + a Driver equipped/trained for it, so it belongs in the taxonomy, not the Driver card.
  Deferred out of the mission-form Driver section (2026-06-25, founder). Build it together with the **Bus
  tier / First-van / cargo-vehicle** expansion (see the vehicle-taxonomy V2 + Exception-tier notes).
