// PDP — Progressive Dynamic Pricing.
// The "current fare" is COMPUTED ON READ (Doc spine: "Computed, not stored").
// The fare starts underquoted (pdp_start) and climbs in fixed steps (pdp_step)
// every pdp_interval minutes toward the Business's ceiling, until a Driver
// accepts. SPEED WIN is just a hotter curve: it starts HIGHER (70% of the
// ceiling, vs 50% for a standard mission) and climbs FASTER, so it gets picked
// up quickly while still leaving the Driver some upside (D21, reversing D12 —
// it no longer starts flat at 100%). The start %/step/interval are set by the
// writer (dispatch/new/actions.ts); this file just reads them.
//
// This is the SINGLE place fare is computed — Driver + (future) Dispatch must
// agree (IDEAS.md). Never persist the result as "the price".

export interface PdpInputs {
  ceiling: number;
  base_fare: number | null;
  pdp_start: number | null;
  pdp_step: number | null;
  pdp_interval: number | null; // minutes between steps
  speed_win: boolean;
  created_at: string; // when the mission entered the Pool (proxy for climb start)
}

/**
 * Current PDP fare in euros, rounded to 2 decimals.
 * Deterministic: same inputs + same `now` → same output. No demand/ML inputs.
 *
 * Assumption (documented): the climb is measured from `created_at`. When a
 * dedicated "pooled_at" timestamp exists, switch to that. Clamped to the
 * ceiling so it can never exceed the Business's maximum.
 */
export function currentFare(m: PdpInputs, now: Date = new Date()): number {
  const ceiling = Number(m.ceiling);

  // Fall back sensibly if PDP params are not set on the mission.
  const start = m.pdp_start != null ? Number(m.pdp_start) : ceiling * 0.5;
  const step = m.pdp_step != null ? Number(m.pdp_step) : 0;
  const interval = m.pdp_interval != null ? Number(m.pdp_interval) : 0;

  // No curve configured → just the (clamped) start price.
  if (step <= 0 || interval <= 0) return round2(Math.min(start, ceiling));

  const elapsedMin =
    (now.getTime() - new Date(m.created_at).getTime()) / 60_000;
  const steps = Math.max(0, Math.floor(elapsedMin / interval));
  const fare = start + steps * step;

  return round2(Math.min(ceiling, fare));
}

/** Whether the fare has reached the ceiling (climb is done). */
export function isAtCeiling(m: PdpInputs, now: Date = new Date()): boolean {
  return currentFare(m, now) >= round2(Number(m.ceiling));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
