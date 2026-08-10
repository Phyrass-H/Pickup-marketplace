# "Needs closing" — a trip the Driver never closed

> Written 2026-08-10 (Session 58) from a founder conversation, a 5-agent code map and a 4-lens adversarial
> refutation. **This supersedes BACKLOG § Q's phasing and trigger; it keeps § Q's money reasoning.**
> § Q said "do not re-derive" — the departures below are deliberate founder decisions, each recorded with why.

## The problem, measured

Live DB, 2026-08-10: **24 missions sit in an active status with a pickup already past** — 11 `on_board`,
13 `confirmed`. (`en_route` and `arrived` have **zero** rows in the entire DB: Drivers never tap the middle
steps, so a trip actually in progress sits at `confirmed` the whole time.)

The Driver's `/rides` "Upcoming" tab is a pure status filter with **no time floor**, so the demo Driver's 8
are all 23–54 days old, sorted oldest-first. **Zero genuinely upcoming trips are shown.**

An unclosed trip is invisible to both sides' money: Earnings counts only `completed`/`cancelled`
(`app/(app)/earnings/page.tsx:32`); Spend files it as `unsettled` and excludes it from every total
(`lib/spend.ts:128`).

## Founder decisions, 2026-08-10 (these change § Q)

1. **The `on_board` tap is the signal.** Guest physically in the car ⇒ the trip happened; the only question is
   when it ended. A `confirmed` trip that never started tells us nothing. **Two groups, two questions.**
2. **Both sides see it, at the same moment.** § Q had the Driver asked first and a flip to the Business at 48h.
   Founder: *"not 48H but almost instantly"*.
3. **The Business calls the Driver; it never closes the trip.** Keeps § Q's rule (nudge, never close) — a
   Business marking a Driver's work done is a Business deciding a Driver gets paid.
4. **Nothing auto-closes, ever.** Unchanged from § Q. The system asks; a person answers.
5. **GPS is not built, but the seam is.** The trigger is one function with one input today (the clock). A native
   app later adds a second input (geofence arrival) and changes nothing else — because location may
   *suggest, never decide* (§ Q). The clock version and the GPS version produce the same screens.

## What the refutation killed

Both of these were in the first draft and would have shipped real money bugs.

### ⚑ KILLED — closing a `confirmed` trip by walking the flow would invent €660

The draft closed a never-started trip by walking `confirmed → en_route → arrived → on_board → completed`
through `advanceStatus`, "reusing every existing guard". **The guard for the `on_board` step *is*
`board_guest`**, which settles the waiting meter — and `mission_waiting()` computes
`w_to = least(now, guest_due + ceiling)`, so days later `now` always loses and it returns **the ceiling,
every time**. Run over the 13 live `confirmed` rows that is **660,00 €** of waiting nobody observed
(8 airport × 60 € + 5 city × 40 €), billed to the Business and paid to the Driver. Real genuine waiting fees
in this DB run 10–34 €.
→ **A late close must be ONE atomic `confirmed → completed` transition that never touches `waiting_*`.**

### ⚑ KILLED — the walk would park trips in `arrived`, which unlocks both no-show doors

Four sequential writes can die in the middle. A trip left at `arrived` is in the **one status** where
`mark_no_show` and `business_declare_no_show` become available — and the walk would itself write the
`arrived` status_event that `mark_no_show` looks for. One tap from either side then charges **100% of the
fare as a no-show plus the ceiling waiting fee**, on a trip the Driver just said they drove. § Q's stated
reason the late-no-show branch was safe to leave out is that it *can't* pass those guards. After the walk, it
can.
→ **`arrived` must never be an observable intermediate state. One transition, one `status_event`.**

## The trigger — "arrival at destination, plus 30 minutes"

**The founder's rule, in their own words (2026-08-10): 30 minutes after the Driver reached the destination.**
Their two worked examples:

| | pickup | trip | arrives | reminder |
|---|---|---|---|---|
| Nice city run | 14:00 | 15 min | 14:15 | **14:45** |
| Airport → Saint-Tropez | 14:00 | 1h45 | 15:45 | **16:15** |

**⚑ This is the GPS seam, and it is the whole reason the design survives going native.** The anchor is
*arrival at the destination*. Today that arrival is **estimated** (`pickup_at + duration_min`); with a native
app it becomes **observed** (a geofence at the drop-off — founder: *"then there's no doubt the driver made
the trip"*). **One variable changes and nothing else does** — same predicate, same screens, same questions.
Building it now on the clock is not a placeholder; it is the final design with the cheaper input.

```ts
// lib/dispatch-status.ts
export const CLOSE_BUFFER_MIN = 30;            // founder — 30 min after arrival
export const CONFIRMED_NEVER_STARTED_MIN = 180; // § Q's 3h — nothing ever arrived
export const CLOSE_FLOOR_MIN = 60;             // never inside D61's check-in window
export const ASSUMED_TRIP_MIN = 60;            // when duration_min is null
export const STOP_DWELL_MIN = 12;              // per waypoint
```

`arrivedAt = onBoardAt ?? pickup_at` `+ (duration_min ?? 60)` `+ stops × 12 min` *(later: the GPS fact)*
`askableAt = max(arrivedAt + 30 min, pickup_at + 60 min)`

**Why `onBoardAt` and not always `pickup_at`.** Both founder examples assume the Driver boarded on time. When
the Guest is 40 minutes late, the trip genuinely *ends* 40 minutes later — so anchoring on the On board tap,
where we have it, is the truer estimate of arrival and is more faithful to the rule, not less. It also stops
a Driver being nagged while the Guest is still in the car.

**⚑ The one group the rule cannot cover: a trip that never started.** "30 minutes after arrival" needs an
arrival. A `confirmed` trip has no On board tap, no `en_route`, nothing — there is no evidence anything ever
happened, so there is no arrival to be 30 minutes after. Estimating one from `pickup_at` produces the
founder's own Example 01 as a **live failure**: pickup 14:00, 15-min run, so the estimate fires at **14:45** —
when the Guest is still in the lobby and the Dispatcher's screen currently shows a **red** *"Not checked in —
call them"*. Replacing that with amber *"the trip should have finished"* downgrades the schedule's strongest
rescue signal at the only moment it can still be fixed. Live `duration_min` is **min 7 / median 27 / p90 55**,
so this would hit **67% of trips**.
→ The 30-minute rule applies wherever there is an arrival (estimated or observed). A trip that never started
gets § Q's 3h instead, and never fires inside the first hour.

**The precedence rule matters as much as the numbers:** for a `confirmed` trip, D61's check-in states win
until the grace expires. `needsClosingTone` is returned **after** the two check-in branches, not before.

**The precedence rule matters as much as the numbers:** for a `confirmed` trip, D61's check-in states win
until the grace expires. `needsClosingTone` is returned **after** the two check-in branches, not before.

Other guards the refutation forced:
- **Suppress the flag entirely while `stops_reached > 0 && < stops.length`** — an incrementing stop counter is
  free proof the trip is being run right now.
- **`mission_type !== 'transfer'` → never askable.** An at-disposal hire has no drop-off, so `duration_min` is
  null and a 4-hour booking would be flagged at pickup+90. Zero rows today; one cheap line.
- **`accepted`** is in `ACTIVE_STATUSES` but not `isExecutable` — treat it as `confirmed` (D55 made it
  unreachable, but the list shouldn't lie).
- **`guest_ready_at` is NULL on all 271 rows** and is written by the flight feed only. It is *not* an origin
  today, so **delayed flights are NOT handled by this pass** — that is what the 3h buffer on `confirmed` buys.
  When the feed lands, a test must assert the fire time moves with it.
- **`onBoardAt` comes from `waiting_to`, not from a `status_event` join — and so there is no migration.**
  The refutation was right that reading the boarding instant on some surfaces and not others produces exactly
  the drift a derived predicate exists to prevent. The way out was not "read it everywhere": `board_guest`
  stamps **`waiting_to` on the mission row** at the moment the Guest boards, and it is NULL precisely when the
  Guest was on time — which is when the booked pickup is already the right origin. So the one case that
  matters (a late Guest means the trip genuinely ends later) is covered by a column every caller already
  selects, with no second query, no index, and nothing to fall out of sync.

## Slice 1 — the lie and the visibility (NO new money path)

Nothing in this slice can settle, invent or move a euro. That is the point of the split.

**Driver `/rides`** — stale trips leave the day groups into a **single collapsed line** at the top:
*"8 trips need closing ›"*. **Not 8 pinned cards** — the founder's problem is that real work is buried, and a
wall of stale cards at the top does not fix that; it also reads bold and heavy against a brief of
hierarchy-from-restraint. Tab badge: a second count in `app/(app)/layout.tsx` + `driver-tabbar.tsx` — **not**
free reuse of D61's badge, and it must not be merged into `checkInCount` (one number, two meanings).

**Dispatch** — a new derived tone, same shape as `expiredTone`:
`{ tone:'warn', label:'Waiting on the Driver to close this', needsAttention:true, wash:true }` (§ Q's own
wording — "Needs closing" is the Driver's chore, not the Business's question).
⚑ **The tint alone delivers nothing.** Every past day on the Schedule sits inside a collapsed
`<details> Earlier trips (N)`, and the hint renders inside the row's own collapsed pane — two clicks deep, so
all 24 are invisible today. Slice 1 therefore adds a **pinned band above Today**: *"3 trips are waiting to be
closed"* + the Driver's number, so "call the Driver" is one tap. That is what "both sides at the same moment"
actually requires.

**Safety fix, same slice** — `BusinessCancel` renders on every `confirmed` row, and `businessCancelPct`
returns **100** whenever the pickup is past. A Dispatcher newly told the row needs attention, unable to reach
the Driver, reaches for the only control on it and is charged the full fare. **Suppress cancel once the trip
is askable.**

**Money-honesty fix, same slice** — `spendTotals` `continue`s at `lib/spend.ts:132` before the waiting block,
and `t.unsettled` sums `settledFare` only, so a settled waiting fee on an unclosed trip appears in **no total
and not in the unsettled figure either**. **0 of the 24 carry one today**, so nothing on screen is wrong yet —
which is exactly why it's cheap now. Must include `spend/export/route.ts` and `components/trip-row.tsx`, or
the page and the CSV disagree. ⚠️ *"Same on the Driver's Earnings" is a no-op* — Earnings never loads an
unclosed mission. Dropped.

## ✅ Slice 1 SHIPPED (S58, 2026-08-10) — and what the live check found

Built to the approved mockup. `npm test` **314** (+20). **No migration.** Three things only a real screen
could have caught, all fixed before the commit:

1. **`Checked in` had no time bound.** A trip whose Driver confirmed they'd be there *five weeks ago* still
   read as a calm, current "Checked in" — the strongest possible false reassurance, because the Driver *did*
   answer and then nothing happened. `needsClosing` now runs first in the `confirmed` branch. It cannot
   collide with the check-in states: the predicate can't be true until pickup + 1h, which is where that
   window closes. Pinned by a test.
2. **Today's trip count counted the lifted rows** — the schedule read "23 trips" on a day with none. It now
   reads `0 trips · 23 to close`: shown, not counted.
3. **The date collided with the route.** The schedule's time column is sized for `19:45`; the archive's
   `Thu 30 Jul` overran it into the pickup dot. New `formatShortDay` (`30 Jul`, no weekday) plus a 58px floor.

Also removed on an unclosed row, for one reason: **there is nothing left to negotiate.**
**Cancel** (`businessCancelPct` returns 100 on any past pickup — it was the only control on a row we now
actively tell the desk to chase) and **Agreed release** (it re-pools the trip for another Driver, which is
meaningless three weeks after the pickup — and `accept_mission` refuses a past pickup since § P, so it would
only mint a dead pooled row for the sweep to expire). The explainer copy naming both went with them.

⚑ **Expect the seeded data to look alarming.** Le Grand Hôtel opens on **23 amber rows** today, because 23
test trips were never run to the end. In real use this is one trip at a time — which is the founder's own
premise for putting the warning on the row instead of behind a summary.

## ✅ Slice 2 BUILT (S58, 2026-08-10) — ⚠️ NEEDS THE MIGRATION RUN

**`docs/migrations/2026-08-10_mission_close_answer.sql` — the founder runs it in the Supabase SQL editor.**
Until then the cards render and the reads are safe (`close_answer` simply comes back undefined), but the two
answer buttons will fail on the write. `npm test` **317**.

**Two columns, not a table** — `close_answer` (`'driven' | 'not_driven'`) + `close_answered_at`. The
append-only tables exist because their rows are dispute proof over money that moved; nothing moves here. The
condition is written into the migration: **if the Business is ever given a way to contest this in-app, it
wants to become `mission_close_answer` in the `mission_release` idiom.**

**`driven` — one write, never `advanceStatus`.** A single guarded `→ completed` UPDATE (the status guard is
part of the statement, so a double tap or a race with a Business cancel can only land once), one `status_event`
stamped *now* rather than four backdated ones, and the same amendment/release supersede the normal completion
does. **Nothing touches `waiting_*`.** The card states the fare before the tap and says plainly that waiting
isn't included, because it can only ever be counted from an Arrived tap.

**`not_driven` — no status change at all.** It is deliberately **not** a cancellation: a cancellation names a
party at fault and carries a fee, and nobody knows who is at fault yet — that is why we asked. It clears the
Driver's flag and turns the Business's row into a red **"Driver says it didn't happen · nothing has been
charged — call them"**. Two taps on the Driver's side, because it can't be undone from the app.

**`needsClosing` returns false once `close_answer` is set** — answered is answered, whichever way. The
Business's row does *not* go quiet: for them "waiting on the Driver" has become "they've told us".

**While the close card is showing, the normal step buttons stand down.** Two competing sets of controls on one
screen is how a Driver taps the wrong one.

**Still not built, and still for the same reason:** the late no-show route (§ Q — `mark_no_show` assumes a
courtesy clock running at the pickup), email/SMS, and any GPS scaffolding.

### ✅ Verified live (migration applied 2026-08-10, both paths driven through the real UI)

- **`driven`** → `status=completed`, `close_answer=driven`, `close_answered_at` set, and **`waiting_fee`
  stayed NULL** — the assertion the whole design exists to protect.
- **`not_driven`** → status **unchanged** at `confirmed`, answer recorded, no money touched anywhere.
- Business row → red wash, **"Driver says it didn't happen"**, *"Nothing has been charged — call them"*.
- Both missions restored to their pre-test state, the one `status_event` deleted by recorded id, baseline back
  at **271**.

**⚑ Founder-reported the same day: an answered "it didn't happen" reappeared as UPCOMING work.** It writes
no status by design, so the trip stays `confirmed` — and `needsClosing` going false dropped it straight back
into the Driver's day groups and the Upcoming tab count, as work they had just told us never happened. The
partition now keys on the outcome being **unsettled**, not on the question being unanswered, and the card
switches from an amber prompt to a quiet receipt: *"You said this trip didn't happen. The hotel has been told
and will be in touch."* The section retitles itself to **Waiting on the hotel** when everything in it is
answered. Pinned by a test.

**⚑ Two more controls suppressed, found by running it.** Once a trip is answered `not_driven`, `needsClosing`
goes false — which silently handed **Cancel** and **Agreed release** back to the Business on a trip the Driver
had just said never happened. The suppression is now keyed on the outcome being *unsettled*
(`needsClosing || close_answer === 'not_driven'`), not merely unanswered. Same fix on the Driver's side, where
**Cancel this trip** was still offered on a 51-day-old trip — a 100% penalty plus a re-pool, on a trip that
already came and went. An unclosed trip now shows the Driver exactly **one** button: the answer.

## Slice 2 — the design, as specified before building

- **`on_board` group needs no new action** — "Complete ride" already exists and is already right. It gets
  framing only: *"Still on board since 14:20. Close it when you've dropped the Guest."*
- **`confirmed` group: "Yes, I drove it"** — ONE atomic `confirmed → completed`, one `status_event`, never
  through `advanceStatus`, never touching `waiting_*`. Test: closing a `confirmed` mission leaves
  `waiting_fee` NULL. Copy states the fare and is honest about waiting: *"This closes at 96,00 €. Waiting can
  only be counted from an Arrived tap, so it isn't included."*
- **⚑ A second clearing answer is REQUIRED, not optional.** With "Yes, I drove it" as the only control that
  clears the flag, and no time guard on completion, and the fare frozen at accept: a Driver who never turned
  up taps once three days later and takes the full fare, with no mark and no way for the Business to dispute
  it. **Today that Driver has no in-app route to get paid at all — Slice 2 would build one.** And the mirror
  case is just as bad: a Driver who genuinely didn't drive has no answer, so the badge never clears.
  So Slice 2 needs *"It didn't happen"* — clears the Driver's flag, settles **nothing**, and hands the
  question to the Business. That needs a small additive record (a `mission_close_answer` row in the
  `mission_release` idiom: read-only RLS, writes via SECURITY DEFINER).
- **Still NOT built:** the late no-show route (§ Q: `mark_no_show` assumes a courtesy clock running at the
  pickup), email/SMS, the 48h flip, any GPS scaffolding.

## Also flagged, not in either slice

**Retroactive period mutation.** Everything files under `pickup_at`, so a July trip closed in August moves
money into July *after* the hotel exported it — and Spend's unsettled line is scoped to the selected period,
which defaults to this month, so the warning only ever appears in a period nobody reopens. There is no
`completed_at` column, so a re-exported July CSV cannot say which line moved or when. Cheap partial fix: a
line in the **current** period naming older periods that still hold unclosed trips and the euro at stake.

## Process

**D25 preview first** — this is a UI job: the collapsed Driver line, the Dispatch pinned band and the row
tone all get a mockup and founder sign-off before any code.

**Scope.** Slice 1 ≈ one session (one additive index migration). Slice 2 ≈ one session (one additive table).
Files, Slice 1: `lib/dispatch-status.ts`, `app/(app)/rides/page.tsx`, `app/(app)/layout.tsx`,
`components/driver-tabbar.tsx`, `app/(dispatch)/dispatch/page.tsx`, `components/trip-row.tsx`,
`lib/spend.ts`, `app/(dispatch)/dispatch/spend/export/route.ts`, `app/globals.css`, tests.
