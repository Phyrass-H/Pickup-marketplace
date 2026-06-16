# 02 — PickUp · Product & Features (MVP V1)

> Scope: what we are building for V1, the full feature inventory with status, the pricing mechanic, and the core loop. For deferred (V2+) features and their original detail, see Doc 05.
> **Last updated:** current session.
> Legend: **KEEP** = build for V1 · **CUT** = deferred (Doc 05) · **MANUAL** = a human does it in beta, not built yet.

---

## The core V1 loop (must work end-to-end)
1. **Dispatcher** posts a mission and sets a **ceiling**.
2. **PDP** prices it into the correct **category pool** (filtered by zone/category).
3. A verified **Driver** in that zone/category sees it, taps for detail, and **accepts** → mission moves to "My Rides," removed from pool, **contacts unlock both ways**, Dispatcher gets a confirmation notification.
4. **Slot-conflict check** blocks accepting overlapping missions.
5. **T-180 min readiness confirmation**; no confirm → mission returns to pool.
6. Driver taps the **4 status buttons** (en route → arrived → on board → completed); each streams a real-time update to the Dispatcher.
7. Card charged; **commission split off** (Stripe Connect); Driver paid (weekly; manual in beta).
8. **Compliant booking voucher** generated. Both sides see the mission in **history**.
9. In beta, a **human confirms each trip** before it matters to the Business.

## Pricing mechanic (V1)
- **Base fare** = distance × duration × vehicle category (via Maps API).
- **Recommended fare** shown to the Business (based on real route/category/typical accepted fares) — *recommendation only*.
- **Business sets the ceiling** (its commercial decision). No free fixed-price override in V1.
- **PDP (simplified, deterministic):** fare starts underquoted (e.g. ~50% of ceiling) and **climbs in fixed steps over time** toward the ceiling until a Driver accepts. No demand/season/ML inputs in V1.
- **SPEED WIN:** urgent missions start at/near the ceiling for instant acceptance.
- **Too-low ceiling → soft warning** (nudge, not block; phrased as consequence: "Trips below the recommended fare are rarely accepted and may go unfulfilled"). Optional **hard floor** at ~Driver break-even to keep junk lowball missions out of the pool.
- *Legal note:* Business-sets-ceiling + PickUp-recommends reinforces the AGENT position (see Doc 01).

---

## Feature inventory

### Driver — onboarding & account
| Feature | Status |
|---|---|
| Registration (personal info) | KEEP |
| Upload docs: licence, insurance, RC Pro, company reg | KEEP (upload) |
| Verify docs against authorities | MANUAL |
| Bank details for payouts | KEEP |
| Video interview validation | MANUAL (Zoom; flag account verified) |
| Profile photo, languages | KEEP |
| Preferred GPS (open in Waze/Google/Apple Maps) | KEEP |
| One vehicle + service category (Eco/Business/Van/Luxury) | KEEP |
| Multiple/additional vehicles | CUT |
| Operational zones | KEEP |
| Auto invoice/quote/PO generation + feature opt-in | CUT |

### Driver — discovery, acceptance & execution
| Feature | Status |
|---|---|
| View category/zone-filtered pool | KEEP |
| Mission card (price, date, times, pickup/dropoff) + tap for detail | KEEP |
| Accept → assigned, contacts unlock | KEEP |
| Slot-conflict safety check | KEEP |
| Favourite/badged-driver priority window | CUT |
| T-180 readiness confirmation (no confirm → back to pool) | KEEP |
| 4 status buttons (en route/arrived/on board/completed) → realtime to Dispatcher | KEEP |
| Native welcome banner (branded greeting screen) | **KEEP** |
| Intelligent flight tracking via API | **KEEP** (paid API dep — see Doc 03) |
| Driver teams / substitute driver | CUT |
| Cancel mission (+acknowledge penalty) | KEEP cancel / penalty MANUAL |
| Rate the Dispatcher post-ride | CUT |
| Continuous live-map GPS to Dispatcher | CUT |

### Dispatcher (Business) — onboarding & mission creation
| Feature | Status |
|---|---|
| Account creation; company docs upload | KEEP upload / MANUAL verify |
| Bank/card details | KEEP |
| Field of activity | KEEP |
| Company logo (optional) | KEEP (one optional field) |
| Company presentation, dispatcher names+photos | CUT |
| Create mission: type, vehicle, client name+address, passenger(s), #people/luggage, pickup+destination (geocoded), flight # (text), comment | KEEP |
| **Intermediate stops** | **KEEP** (multi-waypoint via Maps) |
| Phone-number masking | CUT |
| Specific equipment requests (baby seat etc.) | CUT (free-text comment covers it) |
| Auto-route to correct category pool | KEEP |
| Rate simulation / quote estimate | KEEP (simple) |
| **Mission modification** | **KEEP (limited):** free edits while pooled; after acceptance minor edits auto-notify, material edits (route/time/price/stops) need Driver re-consent or cancel+repost; **no** live mid-trip changes |
| Grouped missions; admin/multi-dispatch seats | CUT |

### Pricing, payments, communication, tracking, support
| Feature | Status |
|---|---|
| Base fare calc | KEEP |
| Simplified PDP (fixed curve) | KEEP |
| SPEED WIN | KEEP |
| Recommend + ceiling + soft warning + hard floor | KEEP |
| Dynamic pricing by demand/season/ML | CUT |
| Card payment per mission + auto commission split (Stripe Connect) | KEEP |
| Wallet / periodic billing / SLA / bank transfer / financial dashboard | CUT |
| In-app chat & calls; group event chat | CUT (use reveal-number tap-to-call) |
| Reveal phone numbers on acceptance | KEEP |
| Realtime status feed + acceptance notification to Dispatcher | KEEP |
| Geolocated alerts (strikes/closures) | CUT |
| Mission history (month → list → detail), both sides | KEEP |
| Search/reporting/analytics/CSV/profitability | CUT |
| Ratings, badges, rating-based priority | CUT |
| Email support; static FAQ | KEEP |
| Live chat / phone support / in-app bug form | CUT (email) / MANUAL |

### Platform / cross-cutting
| Feature | Status |
|---|---|
| Push notifications (acceptance, T-180, status, reminders) | KEEP |
| Auth + roles (Driver/Dispatcher/admin) | KEEP |
| GDPR, privacy policy, consent | KEEP (legal must-have) |
| Encryption of PII & financial data | KEEP (use providers' built-in) |
| Compliant booking voucher generation | KEEP (legal — see Doc 01) |
| Dispatch as PWA (Mac/Windows from one build) | KEEP |
| Native iOS+Android Driver apps | DECISION — PWA first (see Doc 03) |
| Security audits / pen tests | CUT for V1, plan later |
