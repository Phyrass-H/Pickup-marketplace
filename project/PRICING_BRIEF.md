# Kavenue — pricing, commission & payments: everything decided so far

> **Purpose:** a self-contained brief to hand to a fresh Claude for a pricing / commission / payments
> brainstorm, without uploading the whole repo. Written 2026-08-01 (Session 52).
> **It is a snapshot, not a source of truth** — the canonical files are named against each section.
> When something is decided, it goes back into `docs/01`, `project/DECISIONS.md` and this file gets refreshed.

---

## 0. What Kavenue is (30 seconds)

A **B2B VTC booking marketplace** on the French Riviera — a *centrale de réservation VTC*. Professional VTC
**Drivers** on one side; **Businesses** (hotels first) that need transport for their **Guests** on the other.
A Business posts a mission; it sits in the **Pool**; a Driver accepts it; the Driver drives the Guest.

**Glossary — use these exact words:** Business · Dispatcher · Driver · Guest · Pool · PDP · Ceiling · SPEED WIN.
Never "client", never "principal".

---

## 1. THE HARD CONSTRAINT — Kavenue is an agent, never the principal

*(Source: `docs/01_Legal_VAT_Compliance.md` — read this one in full, it is short and it governs everything below.)*

Kavenue is an **intermediary on commission**, not a reseller of transport. This is a VAT position worth roughly
the whole business: as an agent Kavenue owes VAT **only on its commission** (20%); as a principal it would owe
VAT on the **full fare**, with almost nothing to deduct because most beta Drivers aren't VAT-registered. Uber was
forced into principal status and paid ~£1bn. Booking.com is an agent.

**Two things push a platform toward "principal", and both are pricing questions:**
1. **The pricing algorithm controlling the fare.**
2. The platform guaranteeing the service.

**The mitigation is already built into the product and must survive any new pricing model:**
> **The Business sets the Ceiling. Kavenue only *recommends*.** Price-setting sits with the Business.

⚠️ **This is the single biggest constraint on the brainstorm.** Any model where Kavenue *sets* the price — a fixed
tariff, a mandatory rate card, an algorithm the Business cannot override — attacks the legal position. Recommend,
suggest, default, warn: yes. Impose: no.

### VAT facts that shape the money
- Kavenue's **commission → 20% VAT** (a platform fee). Kavenue's only VAT responsibility.
- The **transport fare → 10%**, and that is the **Driver's** responsibility, not Kavenue's.
- Most beta Drivers are under the **franchise en base** (~€37,500) → they charge **no VAT at all**. Legal.
- **The 10% transport VAT is NOT recoverable by the Business; the 20% commission VAT IS.**
  → **Transport and service fee must be separate invoice lines.** This is a build requirement, not a nicety.
- **Cash flowing through Kavenue ≠ Kavenue's supply** — set up as *encaissement pour le compte du chauffeur*
  (collection on the Driver's behalf).
- **EU "ViDA"** deemed-supplier rule for road passenger transport lands **1 Jul 2028** (delayable to 1 Jan 2030) and
  may push uncollected Driver VAT onto the platform. Plan for it; don't build for it.

### ⚑ The worked example already in the spec — it answers a question people keep re-asking

Carlton Cannes → Nice airport. Driver under franchise. **15% commission.**

| Party | Pays | Receives | Keeps |
|---|---|---|---|
| Guest | €150 (to the Business) | — | the ride |
| Business (hotel) | €118 (to Kavenue) | €150 (from the Guest) | €32 margin |
| Kavenue | €100 (to Driver) + €3 VAT (to the state) | €118 (from the Business) | €15 commission |
| Driver | — | €100 (from Kavenue) | €100 (no VAT) |

Kavenue's invoice to the Business = **Transport €100 + Service fee €15 + €3 VAT**.

**Read what this implies:** the **Driver's price (€100) and the Business's price (€118) are different numbers**, and
the commission is **added on top** of the Driver's price rather than taken out of it. If that is still the intent,
**a mission needs two money figures, not one** — and today it has one. See § 4.

---

## 2. How a fare is set TODAY (the PDP)

*(Sources: `lib/pdp.ts` — 87 lines, worth pasting in full · `docs/Kavenue_Phase0_Data_Spine.md`.)*

There is **no objective base price**. The Business decides, Kavenue animates:

- The Business sets a **Ceiling** (its maximum) and optionally a **base fare**.
- The mission enters the Pool at a **start price** (default: half the Ceiling) and **climbs** toward the Ceiling in
  steps (`pdp_start`, `pdp_step`, `pdp_interval`) until a Driver accepts. This is the **PDP**.
- **SPEED WIN** starts at or near the Ceiling immediately — used when a trip must fill fast.
- Normal Pool: **50% start, 10-minute steps.** SPEED WIN: **70% start, 5-minute steps.**
- A re-pooled trip (< 24h to pickup) becomes SPEED WIN; ≥ 24h goes back to the normal curve.
- **The current fare is computed on read, never stored** as "the price".

**⚑ `settledFare()` — the rule that took two attempts to get right.** The climb exists to *fill* a mission; it has
no business running afterwards. So the moment a Driver accepts, the fare **freezes at `accepted_at`**, and
everything downstream reads that frozen number: what the Driver earned, what the Business owes, **and the euro
basis of every cancellation fee, no-show and amendment**. Founder's rule: *"the final fare, on the Business side and
the Driver side, is the price that the Driver accepted."*
The bug it fixed: a trip accepted at €70 displayed €100 a week later, because the clock kept climbing.

**What is missing:** any objective **base price by tier × body × distance × time/season**. That is the "pricing
engine", and it is the oldest open item in the project.

---

## 3. Every other way money moves today

*(Sources: `lib/cancellation.ts`, `project/DECISIONS.md` D45 · D46 · D48.)*

All of these already exist, are live, and any new commission model has to say whether it applies to them.

| Event | Money | Notes |
|---|---|---|
| **Completed trip** | the frozen accepted fare | the normal case |
| **Waiting** | courtesy 20 min city / 60 min airport, then **€1/min** Business → Driver, capped **€40 city / €60 airport** | the cap stops the money, not the trip |
| **No-show** | Business charged **in full**; Driver paid as if completed | two doors: the Driver reports, or the Business declares |
| **Business cancels** | **free** while pooled or > 5h out; **50% at −5h, +10%/h → 100%** | a live-% modal shows the cost before confirming |
| **Driver cancels** | **100% penalty**, always; trip re-pools as SPEED WIN | plus a silent reliability mark |
| **Agreed release** | **free**, no penalty, no mark | Business proposes, Driver must accept |
| **Unfilled** | nothing — nobody ever held it | § P |
| **Not closed** | agreed fare exists, **nothing settled** | § Q — parked, see D67 |

⚠️ **All amounts settle MANUALLY in beta.** The rules are enforced in the database; no money actually moves. Nothing
in the app may imply a payment ran.

---

## 4. THE OPEN QUESTIONS — this is what the brainstorm is for

### 4.1 Is commission taken OUT of the Pool price, or added ON TOP? ⚑ decides the data model
`docs/01`'s worked example says **on top**: Driver €100, Business €118. The working assumption recorded in D59 is
*"the price shown in the Pool is the Driver's price"* — consistent with that.
**If that holds, a mission needs two figures** (what the Driver gets / what the Business pays) where it has one
today, and every money read, every fee basis and every archive changes. It is an additive migration plus a sweep.
**Settle this first — everything else hangs off it.**

### 4.2 What IS the commission?
Flat %? Tiered by volume? Different per service class? A flat € minimum on cheap trips? `docs/01` uses 15% as an
illustration only — it is **not** a decision.

### 4.3 Does commission apply to money that isn't a trip fare?
Waiting fees, cancellation fees, no-show charges are all real money moving between the two parties. Each needs a
yes/no. "We'll see" is not survivable — these are already live.

### 4.4 The penalty rules need a rethink (founder, 2026-07-28)
With the fee basis now correct, **100% may be too weak on a cheap trip**: a €50 job costs €50 to walk away from, so a
Driver offered something better is tempted. Founder's words: *"100% is not enough … we need to fix rules later."*
Sketched, nothing decided: a **floor** (max of 100% and a fixed €X) · a **multiplier** as pickup nears · a
**non-monetary** cost (visible reliability marks). *(BACKLOG § H2.)*

### 4.5 How is a base price seeded at all?
No single public VTC price database exists. Practical seeds already researched: French **taxi tariff orders**
(préfecture *tarifs taxi* A/B/C/D) as a floor; a hand-tuned **base + €/km + €/min** grid per tier with
airport/season multipliers; later, learn from Kavenue's own accepted-fare data. *(`project/IDEAS.md`.)*

### 4.6 ⛔ NO empty-return charge — a founder decision, do not reopen
The Business is **never** charged for the Driver's empty return leg (*retour à vide*). The deadhead is solved
**structurally** by a future **smart Pool** that prioritises Drivers whose previous drop-off is near a mission's
pickup. So a one-way long transfer gets **no return-leg surcharge**. *(D37.)*

### 4.7 Payments
Stripe is unbuilt and deliberately deferred. When it lands: collection-on-behalf wording, a self-billing vs
Driver-issued-invoice decision, and the two-line invoice from § 1. Driver bank details are deliberately **not**
collected today — that is Stripe's job.

---

## 5. Where each number would be SEEN (settled 2026-08-01)

- **Driver → Earnings.** What they earned. Simple. Already built.
- **Business → spend, not earnings.** A hotel booking transport is *spending*. Whatever it charges its Guest happens
  on its own invoice, **outside Kavenue**, and should stay outside — Kavenue is the agent, not the seller. The screen
  shows what was booked, what it cost, and what was paid to Kavenue. *(Optional future: a "what you charged your
  Guest" field turns spend into margin. Only a concierge would use it — park it.)*
- **Kavenue's commission income → the admin back-office.** It is Kavenue's P&L, not either party's. A Business sees
  what it paid, itemised; a Driver sees what it earned; neither sees the take rate as a total.

**The design rule:** *one trip, one set of numbers, three slices.* If all three views are computed in one place they
always reconcile; if each screen does its own arithmetic they drift, and money that doesn't reconcile is the worst
class of bug to find late.

---

## 6. What to bring back

A decision on **4.1** (the shape), **4.2** (the rate), **4.3** (what it applies to), and ideally **4.4** (penalties).
With those four, the pricing engine, the Business spend screen (BACKLOG § S) and the admin revenue view are all
buildable. Without 4.1, none of them are — because nobody knows how many numbers a trip has.

---

## Files to attach alongside this brief

**Essential, and all short:**
- `docs/01_Legal_VAT_Compliance.md` (57 lines) — the constraint everything obeys
- `lib/pdp.ts` (87 lines) — the actual fare computation, comments included
- `docs/00_Overview_and_Index.md` (49 lines) — what Kavenue is + the glossary

**Useful:**
- `docs/Kavenue_Phase0_Data_Spine.md` (132 lines) — entities, enums, what a mission holds
- `lib/cancellation.ts` (143 lines) — the fee ramps and the waiting model in code
- `docs/02_Product_Features_MVP.md` (112 lines) — KEEP / CUT / MANUAL scope

**Do NOT attach:** `project/DECISIONS.md` (1,390 lines) or `project/BACKLOG.md` (812) — the pricing-relevant parts
are already summarised above. `docs/kavenue_schema.sql` is large and only needed once something is being built.
