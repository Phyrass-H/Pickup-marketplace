# 05 — PickUp · Roadmap, Backlog & To-dos

> Scope: features deferred past V1 (with their original detail preserved so nothing is lost), open decisions, and immediate action items. V1 scope is in Doc 02.
> **Last updated:** current session.

---

## Immediate to-dos
- [ ] Book a French VTC/tax lawyer + expert-comptable; bring the open questions from Doc 01.
- [ ] Confirm all ~200 Drivers are REVTC-registered with valid carte pro + insurance.
- [ ] Start/declare DGITM registration; obtain PickUp RC Pro insurance.
- [ ] Secure hotel-side connections for the beta (the liquidity gap — Doc 04).
- [ ] Lock commission % and the exact PDP curve parameters (start %, step size, interval, ceiling logic, hard-floor level).
- [ ] Define the booking-voucher template (7 mandatory fields, arrêté 6 Aug 2025).
- [ ] Confirm who is the technical owner of the build.
- [ ] Decide native vs PWA for the Driver app (default: PWA first).

## Open decisions
- Commission split exact numbers (teaser says ~12.5% Business / ~10% Driver).
- Whether commission is carved out of the fare or added on top (shifts invoice presentation + the money-flow numbers in Doc 01).
- Native Driver app trigger: when does background GPS / push justify going native?

---

## V2+ backlog (deferred features, with original detail preserved)

### Payments & billing (V1 = card per mission + Stripe Connect split only)
- **Prepaid account / virtual wallet** — Dispatchers prepay; costs of large missions or series auto-deducted from the wallet.
- **Periodic (weekly) billing** — for Businesses managing high ride volume, to simplify payment.
- **Service Level Agreements (SLA)** — negotiated terms (payment conditions, deadlines) for large accounts or complex missions.
- **Diversified payment options** — bank transfers, direct debits for substantial payments.
- **Financial dashboard** — monitor costs, payment status, wallet balance.
- **Driver payouts** — weekly; a pay-week runs Mon 04:00 to the following Mon 03:59 (per original mockup). V1 = manual weekly batch; automate via Stripe Connect later.

### Cancellation & conflict (DECIDED 2026-07-13 — see project/DECISIONS.md D45; euro amounts settle MANUAL in beta)
- **Driver cancellation (voluntary) = ALWAYS 100% of the trip amount** — no early-notice reduction; deliberately tough (PickUp must be reliable for Businesses). It is a penalty owed to PickUp-the-intermediary, never a transport charge (agent position, Doc 01). Escape valves (no fee): hand the mission to a copilote (Phase 2, below) or the Business agrees to release it back to the Pool. _(Supersedes the earlier draft tier: >1wk €10 / gradual / <48h full.)_
- **Business cancellation = free until 5h before pickup; 50% at T-5h; then +10% per hour to 100% at pickup** (−4h 60% · −3h 70% · −2h 80% · −1h 90% · 0h 100%). Replaces the earlier week-based draft (Riviera/airport transfers are short-lead). **PickUp's commission is non-refundable.**
- **No-show = Driver paid in full (like a completed mission).** Fires on-site (status `arrived`) when the Guest doesn't appear within the wait window — **1h airport · 20 min city**. The Business is charged the full fare and settles with its own Guest. Deeper mechanics (contact-attempt gate, evidence, clock origin) TBD.
- **T-60 Business reclaim** (NOT a cancel): only when the assigned Driver hasn't confirmed the Lock-in AND is unreachable, PickUp unlocks a reclaim button so the Business takes the trip back and re-pools it as a SPEED WIN (penalty-free for the Business; Driver takes a reliability mark). Gated to the non-confirmation state so it can't be abused.
- **Mediation / conflict resolution (deferred):** report via email; PickUp reviews evidence (accept time, flight landing, contact log, proof of service) and mediates; corrective actions range from financial restitution to rating adjustments or sanctions.

### Communication (V1 = reveal phone numbers + tap-to-call)
- **In-app chat & voice calls** — message/call without leaving the app.
- **Group event chat** — broadcast to all Drivers on a multi-driver event, replacing external WhatsApp groups.

### Tracking (V1 = 4 status buttons → realtime feed)
- **Continuous live-map GPS** of the Driver moving toward pickup.
- **Geolocated alerts** — strikes, road closures, local events.

### Mission creation & scale (V1 = single missions)
- **Grouped missions** — create many missions in one process (e.g. 26 V-Class vans, 11–23 May, 9am–10pm); the app posts them individually, with tools to adjust/track/communicate across the group.
- **Management via Administrator account** — assign roles, adjust permissions, oversee all dispatch activity.
- **Multi-Dispatch** — multiple Dispatcher seats per Business account, each with individual rights, under centralized control.

### Driver tools & reliability
- **Driver→Driver hand-over ("copilote") — O7 Phase 2 (DECIDED model, 2026-07-13, D45).** A full **transfer (novation)** of a booked mission to another verified, **same-category** PickUp Driver — **NOT subcontracting**: the original Driver drops out entirely (no pay, no invoice, no liability) and keeps only a "passed on" trace; the copilote **re-accepts on their own account** and becomes the Driver of record. Avoids the outright-cancel penalty and keeps service uninterrupted. **Legally confirmed viable** (cleaner than sous-traitance — PickUp stays the pure intermediary; the credential gate is what keeps it legal, since *sous-traitance illicite* is a named REVTC offence from 2026). Requires the community/registration layer + credential-gating (WAY-Partner model). Precedent: Drivalty · iaDriver · WAY-Partner · VTC cooperatives. See D45 + IDEAS.md.
- **SPEED WIN reachability gate (DECIDED, build later — D45)** — a SPEED WIN can only be accepted by a Driver who can **physically reach the pickup on time**: geolocate the Driver, compute the GPS ETA to pickup, and **block acceptance with a popup** if they'd be late. Needs Driver geolocation + a Directions ETA call.
- **Multiple vehicles** per Driver.
- **Auto invoice / quote / purchase-order (PO) generation** for Drivers operating as companies, with a feature opt-in selector.

### Ratings & trust
- **Mutual rating** after each ride; **excellence badge**; rating-based ride-access priority/throttling; automated punctuality/quality scoring.

### Targeting & priority
- **Favourite-driver** priority window before pool release; **badged-driver** targeting; **SPEED WIN** visibility boosts (SPEED WIN itself is in V1).

### Reporting & analytics
- Performance reports by period/client/vehicle/segment/Driver/mission; year-over-year comparator; profitability analysis with external expense import; CSV export.

### Pricing (V1 = simplified deterministic PDP)
- **Full Dynamic Pricing** — algorithm suggests a rate from demand, season, time of day, local events (with Business able to adjust). Layer this on once there's real ride data to tune it.

### Distribution (long-term)
- **Amadeus GDS** integration; **public-sector** transport contracts.
