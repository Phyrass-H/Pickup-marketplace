// lib/pdp.ts — the fare itself. Everything downstream is arithmetic on top of
// this, so a defect here is wrong money on every screen at once.
//
// These tests are written against the RULES in docs/06 §6, not against a
// schedule. The schedule is jittered on purpose — pinning the exact euro value
// of step 7 would be pinning the jitter, and the next tweak to the generator
// would go red for no reason. What must never move is: it opens on the floor, it
// only ever rises, it lands exactly on the Ceiling at T−5h, and it is the same
// curve every time you ask.
import { describe, expect, it } from "vitest";
import { ceilingReachedAt, currentFare, isAtCeiling, openingPrice, settledFare } from "@/lib/pdp";
import { mission, speedWinCurve, standardCurve } from "./fixtures";

const at = (iso: string) => new Date(iso);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A trip picked up at noon on 4 September, posted `leadMs` before that. */
function trip(leadMs: number, over: Record<string, unknown> = {}) {
  const pickup = Date.parse("2026-09-04T12:00:00+02:00");
  return mission({
    id: "3f2a91c4-77bd-4e0a-9a1b-2c5d8e6f0a13",
    pickup_at: new Date(pickup).toISOString(),
    created_at: new Date(pickup - leadMs).toISOString(),
    ...standardCurve(), // 100 € Ceiling, 60 € floor
    ...over,
  });
}
/** `hours` before that same pickup. */
const before = (hours: number) => new Date(Date.parse("2026-09-04T12:00:00+02:00") - hours * HOUR);

describe("currentFare — the two endpoints", () => {
  it("opens at the floor, whatever the lead time (§6 rule 1)", () => {
    for (const lead of [14 * DAY, 2 * DAY, 12 * HOUR, 6 * HOUR, 3 * HOUR]) {
      const m = trip(lead);
      expect(currentFare(m, new Date(Date.parse(m.created_at)))).toBe(60);
    }
  });

  it("lands exactly on the Ceiling at T−5h and sits there (§6 rule 2)", () => {
    const m = trip(2 * DAY);
    expect(currentFare(m, before(5.01))).toBeLessThan(100);
    expect(currentFare(m, before(5))).toBe(100);
    expect(currentFare(m, before(1))).toBe(100);
    expect(currentFare(m, before(0))).toBe(100);
    expect(currentFare(m, before(-2))).toBe(100); // two hours after the pickup
  });

  it("climbs to the MIDPOINT instead when it is posted inside 5 hours (§6 rule 3)", () => {
    const m = trip(3 * HOUR); // posted at T−3h → Ceiling at T−1h30
    expect(currentFare(m, before(3))).toBe(60);
    expect(currentFare(m, before(1.51))).toBeLessThan(100);
    expect(currentFare(m, before(1.5))).toBe(100);
    expect(ceilingReachedAt(m)).toEqual(before(1.5));
  });

  it("still tops out at T−5h for a trip posted just over five hours ahead", () => {
    // Founder, 2026-08-22: rule 2 wins wherever the two overlap. An urgent trip
    // should reach its Ceiling fast and fill, not sit cheap while the clock runs.
    const m = trip(6 * HOUR);
    expect(ceilingReachedAt(m)).toEqual(before(5));
    expect(currentFare(m, before(5))).toBe(100);
  });
});

describe("currentFare — the shape (§6: equal movement every time the time left halves)", () => {
  it("moves by the same amount on every halving of the remaining time", () => {
    const m = trip(14 * DAY); // 336 h → 5 h is log2(336/5) = 6.07 halvings
    const halvings = Math.log2((14 * DAY) / (5 * HOUR));
    const perHalving = 40 / halvings; // 40 € of gap spread over 6.07 halvings

    let previous = 60;
    let remaining = (14 * DAY) / HOUR;
    for (let k = 1; remaining / 2 > 5; k++) {
      remaining /= 2;
      const fare = currentFare(m, before(remaining));
      const expected = 60 + perHalving * k;
      // One step is 2 € (40 € of gap, ~one step per 2 €) and the staircase both
      // lags the continuous curve and carries ±0.45 of a step of jitter, so the
      // honest tolerance is a step and a half — not a decimal place.
      expect(Math.abs(fare - expected)).toBeLessThan(3);
      expect(fare).toBeGreaterThan(previous);
      previous = fare;
    }
  });

  it("is the same rule at every zoom level — a 2-day trip runs the whole climb over 2 days", () => {
    const long = trip(14 * DAY);
    const short = trip(2 * DAY);
    // Both are 60 % of the way up their own window at the same FRACTION of it,
    // even though one window is a fortnight and the other is two days.
    const frac = (m: ReturnType<typeof trip>, lead: number) => {
      const top = 5 * HOUR;
      const r = Math.exp(Math.log(lead) - 0.6 * Math.log(lead / top));
      return currentFare(m, before(r / HOUR));
    };
    expect(Math.abs(frac(long, 14 * DAY) - frac(short, 2 * DAY))).toBeLessThan(3);
  });

  it("never goes down, at any resolution", () => {
    const m = trip(14 * DAY);
    let previous = -1;
    for (let i = 0; i <= 20_000; i++) {
      const hours = 15 * 24 - (i / 20_000) * (16 * 24); // a day either side of the window
      const fare = currentFare(m, before(hours));
      expect(fare).toBeGreaterThanOrEqual(previous);
      previous = fare;
    }
  });

  it("takes roughly one step per €2 of gap, floored at 8 and capped at 60 (§6)", () => {
    const distinct = (m: ReturnType<typeof trip>) => {
      const seen = new Set<number>();
      for (let i = 0; i <= 4000; i++) seen.add(currentFare(m, before(336 - (i / 4000) * 331)));
      return seen.size;
    };
    // 40 € of gap → 20 steps → 21 distinct prices, opening included.
    expect(distinct(trip(14 * DAY))).toBe(21);
    // A 6 € gap would be 3 steps; the floor of 8 keeps every rise visible.
    expect(distinct(trip(14 * DAY, standardCurve(100, 94)))).toBe(9);
    // A 400 € gap would be 200 steps; the cap of 60 keeps it from flickering.
    expect(distinct(trip(14 * DAY, standardCurve(500, 100)))).toBe(61);
  });
});

describe("currentFare — anchored to the PICKUP, not to when it was posted", () => {
  it("prices two trips for the same pickup alike, whoever typed theirs in first (§6 rule 4)", () => {
    // The curve never starts earlier than 2 weeks out, so a trip entered a month
    // ahead and one entered a fortnight ahead are worth the same at every moment.
    const month = trip(30 * DAY);
    const fortnight = trip(14 * DAY);
    for (const hours of [336, 200, 100, 50, 20, 8, 5.5, 5, 1]) {
      expect(currentFare(month, before(hours))).toBe(currentFare(fortnight, before(hours)));
    }
  });

  it("holds a trip posted a month out at its floor until the curve opens", () => {
    const m = trip(30 * DAY);
    expect(currentFare(m, before(30 * 24))).toBe(60);
    expect(currentFare(m, before(20 * 24))).toBe(60);
    expect(currentFare(m, before(14 * 24))).toBe(60);
    // It is still on the floor an hour into the fortnight — the first step is
    // a fair way in, because the steps are log-spaced and the window is 336 h.
    // What matters is that it HAS started: by T−200h it has moved.
    expect(currentFare(m, before(200))).toBeGreaterThan(60);
  });

  it("is cheaper at a given instant when the pickup is further away", () => {
    const soon = trip(2 * DAY);
    const later = mission({ ...soon, pickup_at: new Date(Date.parse(soon.pickup_at) + 2 * DAY).toISOString() });
    expect(currentFare(later, before(12))).toBeLessThan(currentFare(soon, before(12)));
  });

  it("returns the Ceiling when the pickup was already past at posting", () => {
    expect(currentFare(trip(-1 * HOUR), before(2))).toBe(100);
  });
});

describe("currentFare — the jitter (§6: unguessable, but replayable)", () => {
  it("gives the same curve every single time it is asked", () => {
    const m = trip(14 * DAY);
    const once = [200, 100, 50, 20, 9].map((h) => currentFare(m, before(h)));
    const again = [200, 100, 50, 20, 9].map((h) => currentFare(m, before(h)));
    expect(again).toEqual(once);
  });

  it("gives a DIFFERENT schedule to a different mission id", () => {
    const a = trip(14 * DAY);
    const b = mission({ ...a, id: "8c1d5e77-40a2-4bb9-9f31-6de2c4a90b58" });
    const sample = (m: typeof a) => [200, 100, 50, 20, 9].map((h) => currentFare(m, before(h)));
    expect(sample(b)).not.toEqual(sample(a));
    // …but both still obey the endpoints. Unguessable, not unbounded.
    expect(currentFare(b, before(336))).toBe(60);
    expect(currentFare(b, before(5))).toBe(100);
  });
});

describe("openingPrice — where the auction opens", () => {
  it("is the stored floor on a standard trip", () => {
    expect(openingPrice(trip(2 * DAY))).toBe(60);
  });

  it("is 70 % of the Ceiling under SPEED WIN — the same curve, higher start (§6)", () => {
    const m = trip(2 * DAY, speedWinCurve());
    expect(openingPrice(m)).toBe(70);
    expect(currentFare(m, before(48))).toBe(70);
    expect(currentFare(m, before(5))).toBe(100);
  });

  it("never opens BELOW the floor, even when 70 % of the Ceiling is less", () => {
    // A Business may set a Ceiling close to its floor; 70 % of it would be under.
    const m = trip(2 * DAY, speedWinCurve(100, 80));
    expect(openingPrice(m)).toBe(80);
  });

  it("falls back to half the Ceiling when pdp_start is null — a pre-curve row", () => {
    // Exactly what the SQL fee-basis band coalesces to, so the two agree.
    const m = trip(2 * DAY, { ...standardCurve(), pdp_start: null });
    expect(openingPrice(m)).toBe(50);
    expect(currentFare(m, before(48))).toBe(50);
  });

  it("is flat at the Ceiling on an amendment-collapsed curve", () => {
    // respond_to_amendment freezes an agreed fare by writing
    // ceiling = base_fare = pdp_start = new_fare. Zero gap, nothing to climb.
    const m = trip(2 * DAY, { ...standardCurve(), ceiling: 175, pdp_start: 175 });
    for (const hours of [48, 24, 6, 5, 1, 0]) expect(currentFare(m, before(hours))).toBe(175);
  });
});

describe("currentFare — a RE-POOLED mission (O7)", () => {
  it("restarts the climb from pooled_at, ignoring created_at", () => {
    // Posted a fortnight out, taken, then a Driver walked at T−12h.
    const m = trip(14 * DAY, { pooled_at: before(12).toISOString() });
    expect(currentFare(m, before(12))).toBe(60); // back to the floor, re-auctioned
    expect(currentFare(m, before(8))).toBeGreaterThan(60);
    expect(currentFare(m, before(5))).toBe(100);
  });

  it("keeps the floor underneath when the re-pool turns SPEED WIN on", () => {
    // Under 24h the re-pool sets speed_win — and stores nothing else, so the
    // floor in pdp_start survives to be used again if it is ever turned off.
    const m = trip(14 * DAY, { ...speedWinCurve(), pooled_at: before(12).toISOString() });
    expect(m.pdp_start).toBe(60);
    expect(currentFare(m, before(12))).toBe(70);
  });
});

describe("settledFare — the climb FROZEN at accept (the S48b money bug)", () => {
  it("is the price the Driver accepted, however long ago that was", () => {
    const m = trip(14 * DAY, { accepted_at: before(100).toISOString() });
    const atAccept = currentFare(m, before(100));
    expect(atAccept).toBeLessThan(100);
    expect(settledFare(m)).toBe(atAccept);
    // The live fare would have run all the way to the Ceiling by now. It must not.
    expect(currentFare(m, before(0))).toBe(100);
  });

  it("freezes at accept measured from pooled_at on a re-pooled trip", () => {
    const m = trip(14 * DAY, {
      pooled_at: before(12).toISOString(),
      accepted_at: before(11).toISOString(),
    });
    expect(settledFare(m)).toBe(currentFare(m, before(11)));
  });

  it("freezes a SPEED WIN trip at its accept price too", () => {
    const m = trip(2 * DAY, { ...speedWinCurve(), accepted_at: before(48).toISOString() });
    expect(settledFare(m)).toBe(70);
  });

  it("falls back to the live fare when nobody has taken it yet", () => {
    const m = trip(2 * DAY, { accepted_at: null });
    expect(settledFare(m)).toBe(currentFare(m));
  });

  // 2026-08-22: the frozen fare is a COLUMN now, not a re-derivation.
  it("prefers the stored accepted_fare over recomputing the curve", () => {
    const m = trip(14 * DAY, { accepted_at: before(100).toISOString(), accepted_fare: 73.5 });
    expect(settledFare(m)).toBe(73.5);
    expect(settledFare(m)).not.toBe(currentFare(m, before(100)));
  });

  it("still recomputes when accepted_fare is null — the whole pre-2026-08-22 archive", () => {
    const m = trip(14 * DAY, { accepted_at: before(100).toISOString(), accepted_fare: null });
    expect(settledFare(m)).toBe(currentFare(m, before(100)));
  });

  it("reads a stored fare that PostgREST handed back as a string", () => {
    // numeric(10,2) arrives as a string often enough that this is not theoretical.
    const m = trip(14 * DAY, { accepted_at: before(100).toISOString(), accepted_fare: "73.50" });
    expect(settledFare(m)).toBe(73.5);
  });
});

describe("the re-pool floor (founder, 2026-08-22)", () => {
  // The RAISING happens in SQL — the re-pool RPCs write
  // `pdp_start = greatest(pdp_start, accepted_fare)` — and is verified against the
  // real database by .local/probe/curve-live.ts. What belongs HERE is the other
  // half of the contract: that lib/pdp.ts honours a raised floor with no special
  // case, and re-auctions from it over whatever time is left.
  it("re-opens at the raised floor and climbs from there", () => {
    const agreed = 82.4; // a Driver accepted at 82,40 and walked at T−30h
    const m = trip(14 * DAY, { pdp_start: agreed, pooled_at: before(30).toISOString() });
    expect(openingPrice(m)).toBe(agreed);
    expect(currentFare(m, before(30))).toBe(agreed);
    expect(currentFare(m, before(20))).toBeGreaterThan(agreed);
    expect(currentFare(m, before(5))).toBe(100);
  });

  it("never returns less than the opening price, whatever the floor was raised to", () => {
    // The SQL fee-basis band clamps a fee into [pdp_start, ceiling], so a fare
    // below the opening would make the band start rewriting honest money.
    for (const floor of [60, 82.4, 99.99, 100]) {
      const m = trip(14 * DAY, { pdp_start: floor, pooled_at: before(30).toISOString() });
      for (const h of [30, 20, 10, 6, 5, 1]) {
        expect(currentFare(m, before(h))).toBeGreaterThanOrEqual(floor);
        expect(currentFare(m, before(h))).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("isAtCeiling", () => {
  it("is false below the Ceiling and true once the climb tops out", () => {
    const m = trip(2 * DAY);
    expect(isAtCeiling(m, before(48))).toBe(false);
    expect(isAtCeiling(m, before(6))).toBe(false);
    expect(isAtCeiling(m, before(5))).toBe(true);
    expect(isAtCeiling(m, before(0))).toBe(true);
  });
});

describe("rounding", () => {
  it("returns clean cents rather than binary-float dust", () => {
    const m = trip(14 * DAY, standardCurve(87.31, 41.07));
    for (let i = 0; i <= 500; i++) {
      const fare = currentFare(m, before(336 - (i / 500) * 331));
      expect(Math.round(fare * 100) / 100).toBe(fare);
    }
  });

  it("never exceeds the Ceiling — the SQL fee-basis band depends on it", () => {
    const m = trip(14 * DAY, standardCurve(87.31, 41.07));
    for (let i = 0; i <= 2000; i++) {
      const fare = currentFare(m, before(340 - (i / 2000) * 345));
      expect(fare).toBeLessThanOrEqual(87.31);
      expect(fare).toBeGreaterThanOrEqual(41.07);
    }
  });
});
