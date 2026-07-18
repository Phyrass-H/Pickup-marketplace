# Phase 0 — PickUp · Data Spine

> Scope: the single structural reference for the build — entities, fields, enums, relationships, and the mission state machine. Everything in the Driver PWA and Dispatch dashboard maps back to this.
> **Last updated:** 2026-06-19 — vehicle taxonomy (tier × body), cached trip ETA, base+radius Pool, SPEED-WIN-at-70%, save-as-draft. Reflects the applied additive migrations in `docs/migrations/` — see DECISIONS D17/D21/D22/D23.
> Terminology per Doc 00: Business · Dispatcher · Driver · Guest · Pool · PDP · Ceiling · SPEED WIN. Never "client" / "principal".

---

## Entities (12)

**Business** — the company posting missions (hotel, agency, concierge).
`id · name · field_of_activity · logo_url? · stripe_customer_id? · created_at`

**Dispatcher** — a user/seat at a Business. (Multi-seat is V2; V1 = one seat works.)
`id · business_id→Business · auth_user_id→Auth · name · email · phone · created_at`

**Driver** — the professional VTC who accepts and performs missions.
`id · auth_user_id→Auth · first_name · last_name · phone · email · profile_photo_url? · languages[] · operational_zones[] (legacy — superseded by base+radius, 2026-06-17) · base_label? · base_lat? · base_lng? · service_radius_km (default 50) · preferred_gps (waze|google|apple) · stripe_account_id? (Connect) · verified (bool — set MANUAL in beta) · created_at`

**Vehicle** — one per Driver in V1. (`category` = the service **tier**; `body_type` is a separate axis. Tier is auto-derived from make+model — see Vehicle taxonomy below.)
`id · driver_id→Driver · category (vehicle_category — the TIER) · body_type (sedan|van, default sedan; added 2026-06-19) · make · model · colour · plate · seats · created_at`

**Document** — uploaded proofs for a Driver or a Business; verified MANUAL in beta.
`id · owner_type (driver|business) · owner_id · type (document_type) · file_url · status (document_status) · expires_at? · uploaded_at`

**Mission** — the core record.
`id · business_id→Business · dispatcher_id→Dispatcher · driver_id→Driver? (null until accept) · status (mission_status) · mission_type (transfer|hourly, default transfer) · group_id? (nullable — hook for V2 grouped missions) · category (vehicle_category) · zone · pickup_address · pickup_lat · pickup_lng · dropoff_address · dropoff_lat · dropoff_lng · waypoints[]? · pickup_at (timestamp — booked/original) · flight_number? · flight_eta? (timestamp — updated landing, display-only) · passenger_name · pax_count · luggage_count · comment? · base_fare · ceiling · pdp_start · pdp_step · pdp_interval · speed_win (bool) · required_body_type? (body_type — null = any) · required_make? · required_model? · distance_km? · duration_min? (cached road distance + ETA, 2026-06-19) · cancelled_by? (cancellation_party) · cancelled_at? · created_at · accepted_at? · confirmed_at?`

**StatusEvent** — one row per status-button tap; streamed to the Dispatcher.
`id · mission_id→Mission · status (en_route|arrived|on_board|completed) · created_at`

**Payment** — Stripe payment intent for the mission.
`id · mission_id→Mission · stripe_payment_intent_id · amount · status (payment_status) · captured_at?`

**LedgerTransaction** — immutable record written at completion.
`id · mission_id→Mission · gross_fare · commission_pct · commission_amount · driver_net · currency · created_at`

**Payout** — weekly; a sum over the ledger (manual batch in beta).
`id · driver_id→Driver · period_start · period_end · amount · status · stripe_transfer_id?`

**BookingVoucher** — the *justificatif de réservation*, 7 mandatory legal fields (Doc 01).
`id · mission_id→Mission · voucher_number · pdf_url · generated_at`

**Auth/Role** — Supabase Auth. Links to a Driver or Dispatcher.
`auth_user_id · role (driver|dispatcher|admin)`

---

## Enums

- **role** — driver · dispatcher · admin
- **vehicle_category** (the service **tier**) — eco (Eco/Standard) · business · luxury (displayed "First"). *`van` is a legacy value, migrated to business + body=van on 2026-06-19; tier is now auto-derived from make+model via `lib/vehicle-catalog.ts`.*
- **body_type** — sedan · van   *(added 2026-06-19; a separate axis from tier)*
- **mission_type** — transfer · hourly        *(hourly = at-disposal / mise à disposition; V2 feature, enum present now as a hook)*
- **mission_status** — draft · pooled · accepted · confirmed · en_route · arrived · on_board · completed · cancelled · expired
- **cancellation_party** — driver · business · system
- **document_type** — drivers_licence · vtc_card · revtc · insurance · rc_pro · vehicle_registration · company_registration
- **document_status** — pending · verified · rejected
- **payment_status** — requires_capture · captured · refunded · failed

---

## Relationships

```
Business 1──* Dispatcher
Business 1──* Mission          (created by one Dispatcher)
Mission  *──0..1 Driver         (assigned on accept)
Driver   1──* Vehicle
Driver   1──* Document   ·   Business 1──* Document
Mission  1──* StatusEvent
Mission  1──1 Payment   ·   1──1 LedgerTransaction (on completion)   ·   1──1 BookingVoucher
Driver   1──* Payout            (Payout aggregates LedgerTransactions for the week)
Mission  *──0..1 group_id       (nullable hook; no group table in V1)
```

---

## Mission state machine (the spine)

```
draft ──post──▶ pooled
pooled ──accept (atomic, first wins)──▶ accepted          // removed from Pool, contacts unlock
pooled ──hits pickup deadline / unfilled──▶ expired
pooled ──business cancel──▶ cancelled                     // terminal, Business compensation (MANUAL in beta)

// LOCK-IN RULE — keyed to time-to-pickup, not the urgency flag:
accepted (pickup ≥3h away) ──Lock-in confirmed at T-180──▶ confirmed
accepted (pickup ≥3h away) ──Lock-in NOT confirmed──▶ pooled    // driver_id cleared, returns to Pool
accepted (pickup <3h away) ──auto──▶ confirmed            // no Lock-in needed; accept = confirmed

confirmed → en_route → arrived → on_board → completed     // each step = a StatusEvent

{accepted|confirmed} ──driver cancel──▶ pooled            // re-pooled for another Driver; cancelled_by=driver, cancelled_at set → penalty (MANUAL in beta)
{accepted|confirmed} ──business cancel──▶ cancelled        // terminal; cancelled_by=business → compensation (MANUAL in beta)

completed ──▶ Payment captured + LedgerTransaction + BookingVoucher
```

**Rules that protect the loop**
- **Accept is atomic.** Two Drivers tapping at once → exactly one wins; the other sees "already taken." (Conditional update on `status='pooled'`.)
- **Slot-conflict check** at accept: a Driver can't hold two overlapping missions.
- **Lock-in** is the readiness confirmation (the old "T-180"): required only when pickup is ≥3h away; under 3h, accepting *is* the confirmation.
- A **driver cancel re-pools** the mission and stamps `cancelled_by/cancelled_at` so a penalty can be applied; a **business cancel is terminal**. Penalty/compensation amounts are MANUAL in beta.
- Time-based transitions (PDP climb, Lock-in, expiry, return-to-pool) are driven by **scheduled jobs**, not user actions.

---

## Computed, not stored

- **Current PDP fare** = `f(base_fare, ceiling, time_to_mission, pdp_start, pdp_step, pdp_interval)` — deterministic, recomputed on read. **SPEED WIN starts at 70% of the ceiling and climbs fast** (D21, reversing the old at-ceiling rule). Never persisted as the "price."
- **Vehicle tier** is computed from make+model by a two-step fallback (`lib/vehicle-catalog.ts`: a checked-brands list + premium-model exceptions, else Eco/Standard) and stored on `vehicle.category` — the Driver doesn't self-select it. Body (sedan/van) is captured separately.
- **Trip distance + ETA** (`mission.distance_km` / `duration_min`) are computed once at posting via Mapbox **`driving-traffic` + `depart_at`=pickup time** (traffic-aware: the ETA reflects the day/hour) and cached. Cards fall back to a straight-line `~`estimate when absent.
- **Pool** is a *query/view*, not a table. Matching is by distance from the Driver's base (replaced the zone-list model 2026-06-17, D17) + tier/body/specific-car (D23):
  `missions WHERE status='pooled' AND category = driver.vehicle.category AND (haversine(base,pickup) ≤ radius OR haversine(base,dropoff) ≤ radius) AND (required_body_type IS NULL OR = vehicle.body_type) AND (required_make IS NULL OR driver's car matches required make+model)`.
  Mission `pickup_lat/lng` + `dropoff_lat/lng` are geocoded (Mapbox) at posting time; the body/specific-car checks run in the app (beta scale).

---

## V1 boundaries (so the model doesn't grow legs)

- One Vehicle per Driver · single missions only (no grouped/recurring) · `mission_type` always `transfer` in V1 · no wallet/periodic billing · no in-app chat (reveal phone on accept) · no live-map GPS (status feed only) · no ratings · no substitute-driver swap.
- **Hooks present but inert in V1** (cheap now, avoid a live-table migration later): `group_id`, `mission_type=hourly`.

**Open decisions feeding this model** (don't block the schema — they're values, not structure):
- Commission split numbers (teaser: ~12.5% Business / ~10% Driver).
- Commission carved-out vs added-on **[legal]**.
- Charge timing — auth-at-booking vs capture-at-completion **[legal]**.
- ~~Cancellation %s — Business compensation tiers + Driver penalty cap.~~ **DECIDED (2026-07-13, D45):** Business free >5h · 50% at −5h · +10%/h → 100% at pickup; Driver voluntary cancel **always 100%**; **no-show** (fires at status `arrived`; 1h airport / 20 min city) = Driver paid full like a completed mission (Business charged full); **T-60 Business reclaim** (assigned Driver unconfirmed **and** unreachable) → re-pool as SPEED WIN, penalty-free for the Business, Driver reliability mark. A re-pool re-enters the Pool as SPEED WIN at 70% of ceiling (needs a `pooled_at` climb-origin). Euro *settlement* stays MANUAL in beta. Driver→Driver "copilote" hand-over = O7 Phase 2 (a full transfer, not sous-traitance).
- Hard floor field — pending the floor-vs-benchmark decision.
- Fare extras (waiting time, tolls, airport fee, hourly overtime) — base modelled; extras pending.
- "SPEED WIN" final name (candidates: Rush, Fast Track).
