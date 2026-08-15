# Doc 06 — Pricing, Commission & Payments

> **Status:** the V1 transfer pricing model. Written and locked with the founder 2026-08-14/15.
> **Scope: V1 transfers only.** *Mise à disposition* (MAD, hourly/daily hire) and long multi-week
> missions are **V2 — do not build them.** `mission_type` stays `transfer` for every V1 mission.
> **Source of truth.** Where this doc and any other document disagree about price or commission,
> this one wins. Hand *this file* to any outside session that touches pricing.
>
> Mechanics are locked. The rate-card values in §4 are calibrated against real market data but
> remain tunable — which is why every one of them lives in a table, never in code.

---

## 0. The constraint every rule obeys

Kavenue is an **agent / intermediary, never the principal.** It never buys and resells transport,
and there is no markup. Two things push a platform toward principal status, and both are pricing
questions: **controlling the fare**, and **guaranteeing the service**.

Binding on everything below:

- The Business sets its own Ceiling. Kavenue **recommends** a price; it does not impose one.
- Commission rates are **constants**. They never vary by event, time of day, season, zone,
  urgency, or Business.
- **No discretionary amount may ever be typed in** by a Driver, a Dispatcher or Kavenue after
  acceptance. Every extra must be pre-published, rule-based, and derived from data the system
  already holds.
- Kavenue controls only the **path between two numbers it did not choose** — the Business's
  ceiling above, the cost-based floor below.

If an implementation choice would require a free-text amount, **stop and flag it** rather than
building it.

---

## 1. Commission — LOCKED

| | Before VAT (HT) | With VAT (TTC) |
|---|---|---|
| **Business** pays, on top of the fare | 12.5% | **15%** |
| **Driver** has deducted from the fare | 10% | **12%** |

**The same rates written two ways.** `12.5 × 1.2 = 15` · `10 × 1.2 = 12`. Kavenue's commission
carries **20% VAT** (a platform service fee), which is not optional.

### On a €100 fare

| | |
|---|---|
| Hotel is invoiced | **€115.00** — reclaims the €2.50 VAT, so its real cost is €112.50 |
| Driver receives | **€88.00** — a VAT-registered Driver reclaims the €2, so their real cost is 10% |
| Kavenue collects €27.00 | pays **€4.50** VAT to the state, **banks €22.50** |

### The rule for what carries commission

> **Money moving from the Business to the Driver carries commission. Always.**

Payment for the trip, or compensation instead of it — both carry it. This replaces a list of
cases, because a rule cannot drift.

| Event | Carries commission? |
|---|---|
| Completed fare · waiting time · extra stops · no-show | **Yes** — 15% / 12% |
| Business cancellation compensation | **Yes** — a €90 fee becomes €103.50 paid / €79.20 received |
| Agreed release | **No** — no money moves |
| Driver cancellation penalty | **No** — it runs Driver → Business, so it is an indemnity, not a payment |

### How to talk about it

| Talking to | Say | Why |
|---|---|---|
| A **Business** | **15%** | It's what appears on their invoice |
| A **Driver** | **12%** | Same reason, their side |
| An **investor** | **22.5% of the fare**, or **~20% of Business spend** | 22.5% is actual revenue; 20% is like-for-like against Uber's ~40%, which is measured on what the customer pays |

⛔ **Never say "27%."** It counts VAT handed to the state as income — overstating the take rate and
understating competitiveness at the same time.

**Have this ready:** someone will add 15 and 12. Kavenue takes **22.5% of the fare, split across two
parties**, each paying less than they would anywhere else. It is the Booking.com structure.

### Why the Driver's rate includes VAT

A Driver with a real company reclaims VAT, so 12% costs them 10%. A very small Driver under
*franchise en base* cannot reclaim, so 12% costs them 12% — the same as any other purchase their
status makes them bear. Kavenue does not adjust its rate for a counterparty's tax status.

---

## 2. Every price shown is TTC — LOCKED

All prices displayed anywhere in the app are **TTC** (all taxes included).

**The reason, in the founder's words:** the price Kavenue advises is the base a Business uses to
charge its Guest, and the Guest is the final consumer. One convention everywhere removes any
confusion about which number is which.

---

## 3. The Business invoice — three lines, always — LOCKED

```
Course                      190,00 €
Frais de service (12,5 %)    23,75 €
TVA sur frais de service      4,75 €
─────────────────────────────────────
Total                       218,50 €
```

**Never one collapsed "service fee" line.** The Business reclaims the 20% VAT on Kavenue's fee but
**not** the 10% on the transport, so the two must be separable. The same three lines appear
everywhere the total appears. The Business never sees `driver_net` or the Driver-side rate.

⚑ The transport line must show the VAT that **actually applies** — 10% if the Driver is
VAT-registered, 0% if not. Read it from the Driver's `vat_number`; never assume.

---

## 4. Kavenue calculates the price — LOCKED

The Business no longer invents a price. Kavenue computes and **pre-fills** it; the Business can
still edit the Ceiling (§0).

```
ceiling = ceiling_base + ceiling_per_km × km
floor   = floor_base   + floor_per_km   × km
```

**Distance only — no duration term.** The price must be final when the trip enters the Pool, so it
cannot depend on a traffic estimate that moves between posting and acceptance. Accepted
consequence: the same route prices identically at 07:00 and 18:00. This matches the premium
segment — a sales line, not a compromise. `km` is frozen on the mission at creation.

### Rate card — market `riviera`

Calibrated 2026-08-14 against **192 real published prices** from 9 operators plus the regulated
taxi tariff, positioned at **~77% of retail** so a Business reselling to its Guest keeps a margin.
Uber was excluded from the fit above the entry tier — it distorts the market on premium classes —
leaving Blacklane, local private-driver grids and the transfer aggregators as the anchors.

| Class / body | `floor_base` | `floor_per_km` | `ceiling_base` | `ceiling_per_km` |
|---|---|---|---|---|
| Eco | 12 | 0.65 | 20 | 1.85 |
| **Business — sedan** | **13** | **0.75** | **48** | **2.00** |
| Business — van | 17 | 0.90 | 45 | 2.25 |
| Luxury (First) | 20 | 1.10 | 115 | 1.90 |

⚑ **Luxury is provisional** — 11 data points, nothing below 28 km, so its base is extrapolated.
⚑ **Fixed class ratios do not hold.** Observed retail ratios move with distance in opposite
directions — Eco converges upward on Business, Luxury collapses toward it. Do not reintroduce a
single multiplier per class.

### Night pricing

**×1.20** on ceiling and floor alike, for a pickup between **22:00 and 06:00**, keyed to the
**pickup time**. Store `night_applied` so a past price stays explicable.

**This is the only time modifier in V1.** No season, no event calendar, no day of week, no demand
input, no surge, no personalised pricing. Demand-based pricing is commercial judgement and belongs
to the Business.

### Tolls

**Never mentioned, anywhere.** They are inside the price and the Driver deals with them. A toll
billed afterwards would be a discretionary typed amount, which §0 forbids absolutely.

---

## 5. The floor is a guard rail, not a valuation — LOCKED

A trip cannot be posted below the floor. If a Business edits the Ceiling below it, the app
**refuses** and shows the real number: *"The lowest this trip can be offered at is €104.90."*

**The floor is the auction's opening bid — it is not a price anyone is expected to accept.** Its
only job is to stop a Business posting something absurd. It is cost-anchored, which is also the
defensible position under §0: arithmetic on a Driver's cost base, not a fraction of the Business's
commercial decision.

⚑ **At scale this changes.** With enough Drivers, trips clear early and near the floor — so the
floor quietly becomes the effective price and deserves more care than a guard rail normally gets.

---

## 6. The auction (PDP) — LOCKED

### The shape

**Equal movement every time the remaining time halves.** Two weeks → one week is one step up; one
week → 3½ days, another; 10 hours → 5 hours, another. The same rule at every zoom level, so the
price is alive whether you look a fortnight out or the same morning.

### The rules

1. **Every trip opens at its floor**, whatever the lead time. The pace compresses into whatever
   time exists — a trip posted two days out runs the whole climb over two days.
2. **The ceiling is reached at T−5h**, and the trip then sits at the ceiling until taken or expired.
   Five hours matches the SPEED WIN nudge, so the moment the normal climb runs out is the same
   moment SPEED WIN becomes the tool.
3. **Posted inside 5 hours:** the climb runs from posting to the **midpoint** to pickup, then sits
   at the ceiling. Posted at T−3h → ceiling at T−1h30. Even a very late trip gets a real climb *and*
   time at the top to be taken.
4. **The curve never starts earlier than 2 weeks out.** A trip posted a month ahead sits at its
   floor until then. Two identical trips for the same pickup are therefore worth the same at every
   moment, whoever typed theirs in first.

### The steps

- **Roughly one step per €2 of gap**, floored at ~8 and capped at ~60, so every rise stays visible
  on a cheap trip and the app still feels alive on an expensive one.
- **Step times are log-spaced, then jittered.** Uneven step *sizes* fall out of that for free —
  one source of randomness, not two.
- **The jitter is seeded from the mission id.** The curve is unguessable from outside but perfectly
  reproducible: every read agrees, and any past price can be replayed and proved in a dispute.
- **The price never goes down**, and always lands exactly on the ceiling.

### Why unpredictable

A predictable ladder lets a Driver compute the optimal moment to wait. Unpredictable steps leave
only one sensible strategy: *take it when it's worth it to me.*

⚑ **This does not contradict the cancellation-fee ruling.** A *penalty* should be predictable so
people can plan around it. An *auction* must not be. Opposite goals, opposite answers.

⚑ **Publish the rule, never the schedule:** *"the price rises in steps until 5 hours before pickup,
when it reaches the maximum the Business set."* True, complete, and still unguessable.

### SPEED WIN

**The same curve with a higher starting point** — nothing more.

- Opens at **70% of the ceiling** instead of the floor. Same shape, same end point.
- **The Business's own checkbox**, available at **any** lead time. A hotel anxious about filling a
  trip can tick it a month out.
- **Never applied automatically at posting.** At **≤5h** the form shows a nudge with a one-tap
  *Enable SPEED WIN* button. Nothing is ticked for them.
- **On re-pool it is automatic** (Driver cancel · reclaim · agreed release): under 24h to pickup →
  on; 24h or more → off.

### What the Business sees

At booking: **"Your maximum cost: €273.67"**, with the range beneath it. They quote their Guest
from the maximum and add their margin. After acceptance, the row shows **what they saved against
that maximum** — the argument for the whole auction, made visible on every booking.

⚑ **The commission follows the accepted fare, never the ceiling.** A hotel that fills cheaply saves
twice: on the fare *and* on the fee.

---

## 7. The 30-second hold — LOCKED, build after the pricing engine

A Driver can hold a trip for **30 seconds** to think before committing.

**Why it exists:** an attractive number triggers an impulsive accept, and the Driver then finds it
does not fit their day. That becomes a Driver cancellation — a 100% penalty, a re-pooled trip and a
hotel with no car. Thirty seconds of thinking time is cheap against that.

- **The price is frozen** for the duration. At 30 seconds it barely moves, and frozen is easier to
  explain.
- **One hold at a time per Driver**, or someone parks three trips and blocks the Pool.
- **One hold per Driver per trip** — no releasing and re-holding to reset the clock.
- **Enforced inside the same gate as Accept.** If it were checked separately, a Driver pressing
  Accept in the same tenth of a second could write past a live hold and steal it. One decision
  point, under the existing row lock.
- **The card stays fully readable to everyone else.** Accept is replaced by a quiet
  **"Being reviewed · 0:23"** counting down; when it lapses the card silently returns to normal.
  Showing the countdown is deliberate — another Driver knows whether to wait or move on.
- **The Business sees "a Driver is reviewing this"** — reassuring, not alarming.

⚑ **Accept at the price the Driver was shown.** Prices only rise, so the server's number can only
be higher; honouring the displayed one removes any "it changed on me" complaint.

---

## 8. Learned route prices — LOCKED as the design, build later

Per-km pricing is the base everywhere. On top of it, routes learn their own price — so Paris,
Normandy and the Riviera diverge on their own with nobody drawing a zone map.

- **Route key:** start and end snapped to a ~1 km grid, so Cannes → Monaco is always the same key.
- **Threshold:** roughly 15 trips before a key overrides the card. Below that, the card applies.

### ⛔ Never learn from the accepted fare

It would ratchet prices down: accepted fares set the anchor → lower ceiling → lower accepted fares
→ repeat. That is auction psychology deflating the card, not the market speaking.

### The two signals that are safe

1. **Edited ceilings.** A hotel that *raises* the pre-filled number says the card is low on that
   route; one that cuts it says the opposite. The motive is ambiguous — a raise may be anxiety
   rather than valuation — but **the outcome referees it**: raised and it fills instantly at a low
   price means they were anxious, not right.
2. **Fill rate and time-to-fill.** Filling at the floor in minutes says over-priced or
   over-supplied; unfilled, or only clearing near the ceiling, says the card is too low. This is
   how airlines do it — watch the booking curve, not the sale price.

### ⛔ Untouched ceilings do not move the price

An untouched ceiling is Kavenue's own number handed back, not an opinion. Pooling it with real
opinions dilutes them: 90 hotels leaving €112 and 10 raising it to €140 averages to €114.80, which
measures *how many hotels bother to edit*, not what the route is worth. Untouched ceilings
**validate** through the outcome — untouched and unfilled is the strongest signal the card is too
low, because Kavenue's own number failed on its own terms.

**One exception:** a hotel that normally edits and this time does not is a real vote, because
changing it was live for them.

### Where the absolute level comes from

External market benchmarking, refreshed periodically — as in the §4 calibration. The learned layer
adjusts routes relative to that; it never sets the level on its own.

---

## 9. Data rules — LOCKED

- **The snapshot rule.** At creation, the computed values and both commission rates are **copied
  onto the mission row**. Settlement, invoicing and history read the snapshot and must **never**
  join back to the live rate card.
- **Changing a rate never rewrites history.** Add a row with a later `effective_from`.
- **Numbers live in tables, not in code.** Recalibration is an `INSERT`/`UPDATE` — never a redeploy.
- **The fare freezes at acceptance.** That frozen figure is the contract price and the basis for
  every cancellation fee, however late the trip closes. Storing it also closes the €0-fee hole,
  since there is finally a fare in the database to recompute a fee against.
- **Rounding: store full precision, round only at render.** Never back-derive a fare from a rounded
  displayed total.
- **Category, never model.** The Business picks a service class, never a make or model.

---

## 10. Extras — LOCKED

### Extra stops — no tariff, three cases

1. **Booked in advance** — the route runs through it, so it is already in the price.
2. **Last minute, short or on the way** — the Driver does it as goodwill.
3. **The Business formally adds it** — an **amendment**: route, distance and fare are recomputed and
   the **Driver accepts or declines**, with an audit trail.

There is no fourth case common enough to justify a tariff. **Dwell time is deliberately unpriced**
in V1 — a flat fee would charge the same for a 2-minute stop and a 20-minute one.

⚑ When dwell time is eventually priced, the machinery exists: the Driver already taps
**"Reached — <stop>"** on every stop, so the timestamps are recorded.

⚑ **Build note:** an amendment's new fare must be **recomputed from the rate card** using the new
distance — never typed.

### Waiting time

Courtesy **20 min city / 60 min airport**, then **€1/min** Business → Driver, capped at **€40 city /
€60 airport**. Derived from status timestamps, never typed. Billed at completion, carrying both
commissions.

⛔ **The clock starts when the GUEST was due** — `guest_ready_at ?? pickup_at` — **never from the
Driver's "I've arrived" tap.** Anchoring it to arrival was a live exploit and was fixed. Do not
re-introduce it.

✅ **The Business keeps its live running meter.** They are the only party who can stop the clock by
calling the Guest.

---

## 11. Corrections that must not be re-imported

Outside sessions have produced pricing material without access to what is already built. If these
reappear, they are stale, not new:

- The waiting clock does **not** start at the Driver's arrival (§10).
- The Business **does** keep its live waiting meter (§10).
- The Pool has no "zone list" — it filters on the **Driver's base + service radius**.
- Commission is **not** 15%/12% before VAT. Those are the TTC forms of 12.5%/10% (§1).
- `docs/06` is this file. Any other numbering for it is a document that never existed here.

---

## 12. Still open

| | Question | Status |
|---|---|---|
| 1 | Luxury card is provisional — no market data below 28 km | Needs a second benchmark pass |
| 2 | Is 100% a strong enough Driver-cancellation penalty on a cheap trip? | Parked, not blocking |
| 3 | Business and Van read slightly low against the founder's own market knowledge | Tunable, table values |

**Payments (Stripe) are deliberately deferred.** When they land: collection-on-behalf wording, a
self-billing vs Driver-issued-invoice decision, and the invoice of §3. Driver bank details are not
collected today — that is Stripe's job. Build the payment layer behind an interface; do not
hard-wire Stripe into mission logic.

---

## 13. Build order

1. **`rate_card` table + seed rows + the §4 formula.** Pre-fill the ceiling on `/dispatch/new`,
   enforce the floor.
2. **Commission, the two displays, the three invoice lines, snapshot columns.**
3. **The §6 curve**, replacing the current `pdp_start`/`pdp_step`/`pdp_interval` climb. Money-critical
   — `pdp_start` is used by the SQL fee-basis band, so this ships with the money tests updated and
   both existing probes re-run.
4. **The §7 hold** — after the pricing engine, since both touch the accept path.
5. **§8 learned routes** — once there is volume.

⚑ **Fix on the way:** the Pool loads the whole archive and filters in memory. Already flagged as the
first thing to break at scale, and the curve arrives at the same time.
