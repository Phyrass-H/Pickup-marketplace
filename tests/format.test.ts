// Pins lib/format.ts's money-adjacent display rules.
//
// Written for the 2026-08-20 sweep: `mission.waiting_rate` had been stamped on
// every settled row since 2026-07-22 and rendered by ZERO lines of app code, so
// a Driver who banked 13,20 € for waiting had nothing on screen to check it
// against. The rate is now shown — which makes HOW it is shown load-bearing.
import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatLeadTime,
  formatMoney,
  formatPerMinute,
  formatWaitingSpell,
} from "@/lib/format";

// fr-FR puts a NO-BREAK SPACE (U+00A0) before the € sign. Asserting the literal
// would make these tests unreadable and fragile against an ICU change, so both
// sides are normalised to a plain space.
const flat = (s: string) => s.replace(/[  ]/g, " ");

describe("formatPerMinute — the settled waiting rate", () => {
  it("reads as money per minute, in French", () => {
    expect(flat(formatPerMinute(0.44))).toBe("0,44 €/min");
    expect(flat(formatPerMinute(1))).toBe("1,00 €/min");
  });

  it("coerces PostgREST's numeric-as-string", () => {
    expect(flat(formatPerMinute("0.66"))).toBe("0,66 €/min");
  });

  it("falls back to the em dash rather than inventing a zero rate", () => {
    expect(formatPerMinute(null)).toBe("—");
    expect(formatPerMinute(undefined)).toBe("—");
    expect(formatPerMinute("not a number")).toBe("—");
  });
});

describe("formatWaitingSpell — what a settled wait says on both sides", () => {
  it("names the minutes and the rate they were billed at", () => {
    expect(flat(formatWaitingSpell(13, 0.44))).toBe("13 min at 0,44 €/min");
  });

  it("multiplies out exactly on the Driver's side, at every class", () => {
    // ⚑ This is why the Driver gets a rate and the Business does not. The three
    // Course-side rates (0,50 · 0,75 · 1,00) net to 0,44 · 0,66 · 0,88, all of
    // which are clean cents — so "N min at X €/min" times N is exactly the
    // amount printed beside it. The Business's ×1,15 gives 0,575, which prints
    // "0,58 €" and does NOT multiply out (0,58 × 20 = 11,60 against a true
    // 11,50), so an all-in rate would make the row checkably wrong.
    for (const [rate, minutes, total] of [
      [0.44, 20, 8.8],
      [0.66, 20, 13.2],
      [0.88, 20, 17.6],
    ] as const) {
      expect(flat(formatWaitingSpell(minutes, rate))).toBe(
        `${minutes} min at ${flat(formatMoney(rate))}/min`,
      );
      expect(Math.round(rate * minutes * 100) / 100).toBe(total);
    }
  });

  it("gives the minutes alone on a legacy row that never stamped a rate", () => {
    // Rows settled before 2026-07-22 carry no waiting_rate. Re-deriving one from
    // the service class would print a rate the trip was never billed at — rows
    // settled between 2026-07-22 and 2026-08-18 were billed a flat 1,00 whatever
    // their class, so the class is not a safe source for a past row.
    expect(formatWaitingSpell(13, null)).toBe("13 min");
    expect(formatWaitingSpell(13, 0)).toBe("13 min");
  });

  it("says nothing when no minutes ran", () => {
    // A punctual no-show stamps waiting_rate unconditionally with 0 minutes and
    // a 0,00 fee, so gating on the rate alone would print "0 min at 0,75 €/min"
    // on every no-show.
    expect(formatWaitingSpell(0, 0.75)).toBe("—");
    expect(formatWaitingSpell(null, 0.75)).toBe("—");
  });
});

describe("formatDuration — the helper the Earnings breakdown now uses", () => {
  it("keeps the unit and zero-pads past the hour", () => {
    // The hand-rolled pair it replaced read "1 h 5" — no "min", no pad — on the
    // one line in the app whose whole job is to report a duration.
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(65)).toBe("1 h 05");
  });
});

describe("formatLeadTime — when a Driver walked, relative to the pickup", () => {
  it("reads in the units the distance deserves", () => {
    expect(formatLeadTime(2)).toBe("2 h before pickup");
    expect(formatLeadTime(0.75)).toBe("45 min before pickup");
    expect(formatLeadTime(72)).toBe("3 days before pickup");
  });

  it("says AFTER when the value is negative, instead of clamping or printing a minus", () => {
    // ⚑ `hours_before_pickup` is SIGNED and negative is a normal value.
    // driver_cancel_mission computes (pickup_at - now())/3600 and accepts a
    // cancel from 'en_route' and 'arrived' — a Driver who sits out a 60-minute
    // airport courtesy wait and then gives up stamps a negative number.
    // Two wrong answers were shipped for this on 2026-08-20 and caught the same
    // day: the CSVs printed "-18 min before pickup" (a negative duration in a
    // spreadsheet) while the row clamped to "0 min before pickup" (claiming
    // they walked at the pickup moment). Neither was true.
    expect(formatLeadTime(-0.3)).toBe("18 min after pickup");
    expect(formatLeadTime(-0.9166)).toBe("55 min after pickup");
    // Under the 48 h threshold, so hours — the same scale the positive side uses.
    expect(formatLeadTime(-26)).toBe("26 h after pickup");
    expect(formatLeadTime(-72)).toBe("3 days after pickup");
  });

  it("rounds minutes, not hours — the screen and the CSV must not drift", () => {
    // The first CSV copy did Math.round(hours) and read "3 h" where the row,
    // rounding minutes, read "2 h 30" for the same row. One helper now.
    expect(formatLeadTime(2.5)).toBe("2 h 30 before pickup");
  });

  it("returns null rather than a phrase when the lead time is unknown", () => {
    expect(formatLeadTime(null)).toBe(null);
    expect(formatLeadTime(undefined)).toBe(null);
    expect(formatLeadTime("nonsense")).toBe(null);
  });

  it("coerces PostgREST's numeric-as-string", () => {
    expect(formatLeadTime("2")).toBe("2 h before pickup");
    expect(formatLeadTime("-0.5")).toBe("30 min after pickup");
  });
});
