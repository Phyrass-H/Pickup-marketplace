# 03 — PickUp · Technical Stack & Architecture

> Scope: recommended stack, integrations, build approach, and the limits to plan around.
> **Last updated:** current session. (Recommendation, not yet locked — confirm with whoever owns the build.)

---

## Recommended stack

| Layer | Choice | Notes |
|---|---|---|
| Dispatch dashboard | **Next.js** (React), on Vercel | Doubles as the PWA → covers Mac/Windows "multi-platform Dispatch" in one build |
| Driver app | **PWA first** (Expo/React Native only when native background GPS or push is truly needed) | Skips app-store review, daily iteration; V1 needs no continuous background GPS |
| Backend / DB / Auth / Realtime / Storage | **Supabase** (managed Postgres) | Auth + roles, realtime status feed, document storage out of the box; relational fit for booking data |
| Payments / commission split / payouts | **Stripe Connect** | Built for marketplaces: collect from Business, split commission, pay Drivers, Driver KYC. **Do not build this in-house** |
| Maps / geocoding / distance / ETA / waypoints | **Google Maps Platform** or **Mapbox** | Address autocomplete, distance for fares, intermediate stops (waypoints). Mapbox often cheaper at scale; Google has stronger autocomplete |
| Flight data | **FlightAware AeroAPI** / **AeroDataBox** / **Cirium** | For the flight-tracking feature; paid, plan for delay/cancellation logic that auto-shifts pickup time |
| Notifications | Web push + email/SMS (Resend / Twilio); Expo Push if native | T-180 reminders, status alerts, acceptance |

## Build approach
- **Integrate the hard parts** (money, auth, maps, realtime, flight data) rather than building them. This is what keeps a small team stable.
- **Claude Code** can scaffold and wire most of this. But a human must own deployment, secrets/environments, monitoring, security, and production debugging — this handles real money + PII, so it's not a generate-once-and-ship task.

## Architectural notes
- **Realtime status feed** = the 4 Driver status buttons pushed to the Dispatcher via Supabase Realtime (websockets). This replaces continuous live-map GPS for V1.
- **Pricing** = a deterministic PDP function: inputs (base fare, ceiling, time-to-mission, step size/interval) → current fare. No ML/demand inputs in V1; easy to tune later.
- **Ledger** = record every completed mission as an immutable transaction (gross fare, commission %, Driver net) at completion. Weekly payout = a sum over the ledger, not a fragile script. Stripe Connect automates most of the split + payout.
- **Booking voucher** = generated per mission with the 7 mandatory legal fields (see Doc 01).
- **Don't hard-code invoicing direction** until the agent/principal structure is confirmed (Doc 01).

## Limits to plan around
1. **Cold-start / liquidity** — not a tech problem; see Doc 04. The #1 risk.
2. **Continuous background GPS** is genuinely hard on mobile (battery, OS kill states) → another reason V1 uses status buttons, not live tracking.
3. **Regulatory + payments + GDPR** compliance burden.
4. **Ownership gap** — if no one on the team can operate/debug the code, the first live bug with money in flight is a wall.
5. **Flight API** adds cost + edge cases (delays, cancellations, gate changes).
