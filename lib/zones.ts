// Beta operational zones — French Riviera (Doc 00 / Doc 04).
// Cannes + Nice are confirmed; the THIRD beta town is still pending
// (tracked in project/IDEAS.md → "Questions to raise"). Update here once
// confirmed; this is the single source for zone choices in the Driver app.
export const BETA_ZONES = ["Cannes", "Nice", "Antibes"] as const;

export type BetaZone = (typeof BETA_ZONES)[number];

// NOTE: "Antibes" is a PLACEHOLDER for the unconfirmed third town. Swap it for
// the real one once the founder confirms (see IDEAS.md).
