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
- **Address search → Google Places (New)** — the real fix for POI precision (Mapbox ranks a random shop over the Nice
  airport terminal; Google weights prominence). Deferred until the founder registers the final RED domain, so the browser
  API key is restricted to the right domains ONCE. ~1 session, one file (`address-autocomplete.tsx`), keep Mapbox for
  routing. Founder has a Google Cloud project "RED Executive" ready. See [[d43]].
- **Domain migration `pickupbedriven.com` → a RED domain** (`dispatch.redexecutive.com` / `driver.redexecutive.com`, or a
  `.red` TLD). Separate ~1-session task: DNS + Vercel domains + Supabase redirect allowlist + `lib/hosts.ts` + the Google
  key restriction. Waiting on the founder registering the name/domain. See [[d44]].
- **Code/copy rebrand PickUp → RED Executive** — the repo is still codenamed PickUp; a later pass renames user-facing copy
  ("PickUp Dispatch" topbar, emails, etc.). Keep the glossary (Business/Dispatcher/Driver/Guest/Pool/Ceiling/SPEED WIN).
- **Detail-edit change-log: multi-edit visible history** — today `mission_info_change` stores every edit as a row but the
  schedule shows only the LATEST. A small extension could show a "…and N earlier edits" expand. (S36 / D41.)
- **Pricing vehicle chip: include the specific car** — the chip shows class·body only; wire an `onCarChange` up from
  `ServiceClassFields` to add the picked model (e.g. "First · Sedan · Mercedes Classe S"). Minor. (S37 / D42.)
- **Amend-form fare field: numeric sanitize** — the new-mission + edit forms now block non-numbers (D42); the amendment
  "New agreed fare" field wasn't included — apply the same for consistency. Minor.
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
- **Dispatcher mission edit — KEEP per Doc 02** (free edits while pooled; material edits after acceptance need
  re-consent). Design agreed with the founder 2026-07-05, phased. The **line that decides everything: has a Driver
  accepted yet?** Pooled = the mission is nobody's → edit anything freely (no consent). Accepted+ = two parties in
  a deal and **PickUp is the AGENT between them, not the boss** → a material change is a *proposed amendment the
  Driver accepts or declines* (this is what keeps us an intermediary AND keeps the deal honest — the Driver
  consents to the new price + time).
  - **Phase 1 — info-only edit (BUILDING NOW, Session 34).** Let a Business edit the **pure-info** fields of a
    posted mission — Guest name(s) + phones, flight number/ETA, reference, Driver & service (languages, dress,
    request flags, name board, private message), luggage/pax counts — **without recomputing the fare**
    (base/ceiling/SPEED WIN + geocoded distance untouched). No consent needed (info doesn't change the deal).
    **Excludes** pickup/drop-off/stops (re-geocode → distance → material) and the required vehicle (matching).
    RLS already allows a Business to UPDATE its own non-draft mission; the app **whitelists** the info columns
    (no column-level RLS). Allowed on pooled/accepted/confirmed; blocked once en_route+ / terminal.
  - **Phase 2 — the amendment model (✅ SHIPPED + DEPLOYED S35, 2026-07-07 — [[d40]]; migration applied, full loop
    verified live).** A material change (new destination / add a stop / **now also pickup**) after a Driver
    accepted, as a **propose → accept/decline** on the mission (a mini `accept_mission`: atomic, consented, with
    an audit trail). Flow: Business proposes → app shows the **delta** (new route + ETA + a price change) → Driver
    sees "add a stop at X · +12 min · +€15 — accept?" and taps **accept/decline** → on accept the terms swap
    atomically, on decline nothing changes. The **app is the system of record even if they talk by phone** (beta:
    dispatch calls, they agree, dispatch proposes in-app, the Driver's **tap is the binding step**). **Price:** the
    app *suggests* the delta and the Driver *consents* — never silently applied. ⚠️ today's fare isn't
    distance-based (PDP climb), so **no auto "+€X for N km" yet** — the Dispatcher types the delta and the app shows
    the new km/ETA to justify it (auto-fills once the pricing engine lands — [[d37]]). **Timing:** reuse the
    `accept_mission` **slot-conflict** check to warn the Driver "this ends 16:40 — you have a pickup 16:30" before
    he accepts. **Decline path:** trip stays as agreed, or the Business cancels (needs the O7 cancel/re-pool flow,
    also not built). Accept/decline only in v1 — no counter-offer haggle loop (a decline just prompts a phone call
    + re-proposal).
  - **Phase 3 — polish (BACKLOG).** Auto-computed price delta (the founder's **pricing engine**) + real
    **notifications** (Resend / push — deferred) so the Driver is alerted to a pending amendment without watching
    the app + an optional lightweight in-app note attached to the proposal ("could we add a stop please? +€15").
    Depends on both the pricing model and notifications (both deferred integrations).

### Guard against midnight-edge date ambiguity (safety notification) ❓
> Founder concern, 2026-07-05.
- A pickup at **00h15 on Monday** is technically the very start of Monday (the Sunday→Monday midnight), but a
  Driver reading "**Monday 00h15**" may assume **Monday *night*** (i.e. Monday→Tuesday, ~24h later) — a
  potentially serious miss on a real transfer (e.g. Cannes → Monaco). We want a **"secure" confirmation** around
  these edge-of-midnight / very-late / very-early hours so both sides read the same instant.
- Ideas to explore (not decided): show the **weekday of BOTH the evening and the morning** for 00:00–~04:00
  pickups ("**nuit de dimanche à lundi**, 00h15" / "night of Sun→Mon"); a small **inline confirm** on the form
  when the time lands in the ambiguous band; and the same disambiguated label on the **Driver** Pool/detail +
  the Business schedule. Pairs with the existing night-pickup nudge and the S31 guidance work. **Locale:** the
  French "nuit de X à Y" phrasing is the natural fix. Capture now; design + build later.

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
