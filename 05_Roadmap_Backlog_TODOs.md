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

### Cancellation & conflict (V1 = cancel returns mission to pool; penalties MANUAL)
- **Driver cancellation penalties (tiered):** >1 week before = €10; between 1 week and 48h = increases gradually each day; <48h = full ride amount. Driver encouraged to find a qualified replacement within the PickUp community.
- **Business cancellation compensation (tiered):** free if >2 weeks before; then increases each week to a max of **50%** of the ride amount for <48h. Availability services: similar structure, peaking at **30%** for <48h. **PickUp's commission is non-refundable.**
- **Mediation / conflict resolution:** report via email; PickUp reviews evidence (communications, proof of service) and mediates; corrective actions range from financial restitution to rating adjustments or sanctions.

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
- **Registered Driver teams / substitute driver** — designate a stand-in to avoid cancellation penalties and keep service uninterrupted.
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
