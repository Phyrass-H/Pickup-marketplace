// PDP — Progressive Dynamic Pricing. The §6 curve.
// The "current fare" is COMPUTED ON READ (Doc spine: "Computed, not stored").
//
// THE SHAPE (docs/06 §6): equal movement every time the remaining time HALVES.
// Two weeks → one week is one step up; one week → 3½ days, another; 10 hours →
// 5 hours, another. The same rule at every zoom level, so the price is alive
// whether you look a fortnight out or the same morning. That is exactly "linear
// in log(time remaining)", which is what `progress()` below computes.
//
//   opens at   the FLOOR (pdp_start) — 70% of the ceiling under SPEED WIN
//   anchored to the PICKUP, not to when it was posted
//   tops out   at T−5h, exactly on the ceiling, and sits there
//   steps      log-spaced then JITTERED, seeded from the mission id
//
// ⚑ WHY JITTERED. A predictable ladder lets a Driver compute the optimal moment
// to wait. Unpredictable steps leave one sensible strategy: take it when it's
// worth it to me. The seed is the mission id, so the curve is unguessable from
// outside and perfectly reproducible: every read agrees, and any past price can
// be replayed and proved in a dispute. Publish the RULE, never the schedule.
//
// This is the SINGLE place fare is computed — Driver + Dispatch must agree
// (IDEAS.md). Never persist the result as "the price".

export interface PdpInputs {
  /** Seeds the jitter. REQUIRED — a curve without it is a different curve. */
  id: string;
  ceiling: number;
  /** Where the auction opens. The rate-card floor, snapshot in Course space. */
  pdp_start: number | null;
  speed_win: boolean;
  /** The curve is anchored HERE, not to when the trip was posted. */
  pickup_at: string;
  created_at: string; // when the mission entered the Pool
  pooled_at?: string | null; // set when a mission is RE-POOLED (O7); restarts the climb
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** §6 rule 2 — the ceiling is reached at T−5h, and the trip sits there. */
export const TOP_LEAD_MS = 5 * HOUR_MS;

/**
 * §6 rule 4 — the curve never starts earlier than 2 weeks out. A trip posted a
 * month ahead sits at its floor until then, so two identical trips for the same
 * pickup are worth the same at every moment, whoever typed theirs in first.
 */
export const HORIZON_MS = 14 * DAY_MS;

/** §6 SPEED WIN — the same curve with a higher starting point. Nothing more. */
export const SPEED_WIN_OPEN = 0.7;

/** §6 steps — roughly one per €2 of gap, so a cheap trip still visibly moves. */
const STEP_PER_EURO = 2;
const MIN_STEPS = 8;
const MAX_STEPS = 60;

/**
 * How far a step time may slide from its log-spaced position, as a fraction of
 * one step. Under ½ by construction: at ½ two steps could collide and the price
 * would jump twice at once. Uneven step SIZES fall out of this for free — one
 * source of randomness, not two (§6).
 */
const JITTER = 0.45;

/**
 * Current PDP fare in euros (Course space), rounded to 2 decimals.
 * Deterministic: same mission + same `now` → same output, for ever. No demand
 * or ML inputs — the only randomness is seeded from `id`.
 *
 * ⚑ TWO PROPERTIES OF THIS FUNCTION ARE LOAD-BEARING IN SQL. The cancel RPCs
 * cannot recompute a fare — this file is the only place the PDP exists — so they
 * clamp the caller-supplied fee basis into
 *   [ least(pdp_start ?? ceiling * 0.5, ceiling), ceiling ]
 * (docs/migrations/2026-08-11_fee_basis_band.sql). That band is honest only
 * because every branch below returns a value in [opening, ceiling]. Break it and
 * the SQL silently starts REWRITING correct money instead of catching forged
 * money. Pinned by tests/money-invariants.test.ts.
 */
export function currentFare(m: PdpInputs, now: Date = new Date()): number {
  const ceiling = Number(m.ceiling);
  const open = openingPrice(m);
  const gap = ceiling - open;

  // An amendment FREEZES the fare by collapsing the curve — respond_to_amendment
  // writes pdp_start = ceiling = the agreed total. Zero gap, nothing to climb.
  if (!(gap > 0)) return round2(Math.min(open, ceiling));

  const u = progress(m, now);
  if (u <= 0) return round2(open);
  if (u >= 1) return round2(ceiling);

  const steps = stepPositions(m.id, stepCount(gap));
  let taken = 0;
  for (let i = 0; i < steps.length; i++) if (steps[i] <= u) taken = i;
  return round2(open + gap * steps[taken]);
}

/**
 * Where the auction opens, in Course space. The rate-card floor for a normal
 * trip; 70% of the ceiling under SPEED WIN — but never BELOW the floor, since a
 * Business may set a ceiling close enough to the floor that 70% of it is less.
 *
 * `pdp_start` null is a pre-curve row: fall back to the old 50% opening, which
 * is also exactly what the SQL fee-basis band coalesces to, so the two agree.
 */
export function openingPrice(m: PdpInputs): number {
  const ceiling = Number(m.ceiling);
  const floor = m.pdp_start != null ? Number(m.pdp_start) : ceiling * 0.5;
  const open = m.speed_win ? Math.max(floor, ceiling * SPEED_WIN_OPEN) : floor;
  return Math.min(open, ceiling);
}

/**
 * The climb, as a fraction from 0 (opens) to 1 (on the ceiling).
 *
 * Linear in log(time remaining), which IS "equal movement every time the
 * remaining time halves". The window runs from the trip's remaining time when it
 * entered the Pool down to `topLead`, so the pace compresses into whatever time
 * exists — a trip posted two days out runs the whole climb over two days.
 */
function progress(m: PdpInputs, now: Date): number {
  const pickup = new Date(m.pickup_at).getTime();
  const opensAt = curveOpensAt(m, pickup);
  const lead = pickup - opensAt;
  if (!(lead > 0)) return 1; // pickup already passed when it was posted

  const topLead = topLeadFor(lead);
  const remaining = pickup - now.getTime();
  if (remaining <= topLead) return 1;
  if (remaining >= lead) return 0;

  return Math.log(lead / remaining) / Math.log(lead / topLead);
}

/**
 * When the climb starts: when the trip entered the Pool, or T−2 weeks, whichever
 * is LATER (§6 rule 4). A RE-POOLED mission (O7 cancel · reclaim · agreed
 * release) restarts from `pooled_at` — a re-pooled trip re-auctions.
 */
function curveOpensAt(m: PdpInputs, pickup: number): number {
  const pooled = new Date(m.pooled_at ?? m.created_at).getTime();
  return Math.max(pooled, pickup - HORIZON_MS);
}

/**
 * How long before the pickup the curve tops out. T−5h whenever there is runway
 * for it (§6 rule 2); for a trip posted inside 5 hours, the MIDPOINT between
 * posting and pickup instead (§6 rule 3) — posted at T−3h → ceiling at T−1h30.
 * Even a very late trip gets a real climb AND time at the top to be taken.
 *
 * ⚑ Founder, 2026-08-22: rule 2 wins wherever the two overlap. A trip posted
 * 6 hours out is urgent — it should reach its ceiling fast and fill, not sit
 * cheap while the clock runs down.
 */
function topLeadFor(lead: number): number {
  return lead > TOP_LEAD_MS ? TOP_LEAD_MS : lead / 2;
}

/** §6 — one step per €2 of gap, floored at 8 and capped at 60. */
function stepCount(gap: number): number {
  return Math.min(MAX_STEPS, Math.max(MIN_STEPS, Math.round(gap / STEP_PER_EURO)));
}

/**
 * The step boundaries, as fractions of the climb: `n + 1` positions from 0 (the
 * opening price) to 1 (the ceiling). Evenly spaced — which is log-spaced in TIME
 * — then each interior one slid by the seeded jitter.
 *
 * The endpoints are NOT jittered: every trip must open exactly on its floor and
 * land exactly on its ceiling.
 */
function stepPositions(id: string, n: number): number[] {
  const rand = mulberry32(seedFrom(id));
  const positions = [0];
  for (let k = 1; k < n; k++) positions.push((k + (rand() * 2 - 1) * JITTER) / n);
  positions.push(1);
  return positions;
}

/**
 * THE fare of a mission once someone has taken it: the PDP climb FROZEN at the
 * moment of accept.
 *
 * Founder rule (2026-07-28): *the final fare, on the Business side and the Driver
 * side, is the price the Driver accepted.* The climb exists to fill a mission; it
 * has no business running afterwards. So everything downstream of accept reads this
 * — what a Driver earned, what a Business owes, AND the euro basis of a
 * cancellation fee, a no-show and an amendment. `currentFare` is only correct while
 * a mission is still in the Pool (the Pool card, and the pre-accept detail).
 *
 * `accepted_at` is REQUIRED, not optional, on purpose: the first version made it
 * optional and a server action selected a narrow column list without it, so the
 * function silently fell back to the live fare and recorded a EUR 100 penalty on a
 * EUR 70 trip. A missing column is now a compile error, not a money bug. `id` and
 * `pickup_at` are required on `PdpInputs` for the same reason — the curve cannot
 * be computed without them, so no select list may omit them.
 *
 * Falls back to the live fare when there's no `accepted_at` (a mission still
 * pooled, or a legacy row).
 */
export function settledFare(m: PdpInputs & { accepted_at: string | null }): number {
  return currentFare(m, m.accepted_at ? new Date(m.accepted_at) : new Date());
}

/** Whether the fare has reached the ceiling (climb is done). */
export function isAtCeiling(m: PdpInputs, now: Date = new Date()): boolean {
  return currentFare(m, now) >= round2(Number(m.ceiling));
}

/**
 * When this trip's price stops moving — the instant it lands on the ceiling.
 * Shown to the Business as "at its maximum from …", and the only honest way to
 * say when the climb ends without publishing the schedule.
 */
export function ceilingReachedAt(m: PdpInputs): Date {
  const pickup = new Date(m.pickup_at).getTime();
  const lead = pickup - curveOpensAt(m, pickup);
  if (!(lead > 0)) return new Date(pickup);
  return new Date(pickup - topLeadFor(lead));
}

// ── the seeded stream ───────────────────────────────────────────────────────
// xmur3 + mulberry32: a 32-bit string hash feeding a small, uniform PRNG. Chosen
// because both are integer-only and fully specified in a dozen lines — the curve
// has to be replayable years from now, so the generator must be readable here,
// not imported and versioned somewhere else.

function seedFrom(id: string): number {
  let h = 1779033703 ^ id.length;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
