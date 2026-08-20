// lib/earnings.ts — the Paris calendar every period on both money screens is
// cut with, and what a Driver actually earned inside one.
//
// The calendar half matters more than it looks: History, Spend and Earnings all
// derive their from/to days from periodRange, so an off-by-one here moves money
// between periods on three screens at once.
import { describe, expect, it } from "vitest";
import {
  dayKey,
  isGranularity,
  isPeriod,
  missionAmount,
  parseAnchor,
  parseDayParam,
  periodRange,
  todayAnchor,
  totalsFor,
  driverCancelPickupAt,
} from "@/lib/earnings";
import { completed, mission, standardCurve } from "./fixtures";

const anchor = (s: string) => parseAnchor(s);
const DAY_MS = 86_400_000;

describe("parseDayParam — a hand-editable URL is not to be trusted", () => {
  it("accepts a well-formed day", () => {
    expect(parseDayParam("2026-07-15")).toBe("2026-07-15");
    expect(parseDayParam("2026-02-29")).toBe(null); // 2026 is not a leap year
    expect(parseDayParam("2024-02-29")).toBe("2024-02-29"); // 2024 is
  });

  it("rejects a date that does not exist rather than letting Date roll it over", () => {
    // "?p=day&d=2026-02-31" would otherwise quietly filter to 3 March.
    expect(parseDayParam("2026-02-31")).toBe(null);
    expect(parseDayParam("2026-04-31")).toBe(null);
    expect(parseDayParam("2026-13-01")).toBe(null);
    expect(parseDayParam("2026-00-10")).toBe(null);
    expect(parseDayParam("2026-07-00")).toBe(null);
    expect(parseDayParam("2026-07-32")).toBe(null);
  });

  it("rejects anything not shaped like a day", () => {
    for (const v of ["", "2026-7-15", "15/07/2026", "2026-07-15T12:00", "yesterday", undefined]) {
      expect(parseDayParam(v)).toBe(null);
    }
  });
});

describe("the period vocabulary", () => {
  it("knows its five periods and which four can be stepped", () => {
    for (const p of ["day", "week", "month", "year", "range"]) expect(isPeriod(p)).toBe(true);
    for (const p of ["quarter", "", "DAY", undefined]) expect(isPeriod(p)).toBe(false);
    expect(isGranularity("month")).toBe(true);
    expect(isGranularity("range")).toBe(false);
  });
});

describe("dayKey — everything buckets in Europe/Paris, never UTC", () => {
  it("puts a small-hours pickup on the night the Driver worked", () => {
    // 00:30 Paris on 16 July is 22:30 UTC on the 15th. Bucketed in UTC it would
    // land on the wrong day, and a Driver's Monday would hold Sunday's work.
    expect(dayKey("2026-07-15T22:30:00Z")).toBe("2026-07-16");
    expect(dayKey("2026-07-16T00:30:00+02:00")).toBe("2026-07-16");
  });

  it("uses the winter offset in winter", () => {
    // +01:00 in January: 23:30 UTC is still the same day in Paris.
    expect(dayKey("2026-01-15T23:30:00Z")).toBe("2026-01-16");
    expect(dayKey("2026-01-15T22:30:00Z")).toBe("2026-01-15");
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(dayKey(new Date("2026-07-15T10:00:00+02:00"))).toBe("2026-07-15");
  });
});

describe("periodRange — day", () => {
  it("spans one Paris day, midnight to midnight", () => {
    const r = periodRange("day", anchor("2026-07-15"));
    expect(r.fromDay).toBe("2026-07-15");
    expect(r.toDay).toBe("2026-07-15");
    expect(r.from.toISOString()).toBe("2026-07-14T22:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-07-15T22:00:00.000Z");
    expect(r.label).toBe("Wednesday 15 July");
  });

  it("steps one day back and forward", () => {
    const r = periodRange("day", anchor("2026-07-01"));
    expect(r.prev).toBe("2026-06-30");
    expect(r.next).toBe("2026-07-02");
  });

  it("is 23 hours long on the spring DST day", () => {
    // 29 March 2026: Paris jumps 02:00 → 03:00. A day is not always 86 400 000 ms,
    // which is exactly why parisMidnight resolves its offset twice.
    const r = periodRange("day", anchor("2026-03-29"));
    expect(r.to.getTime() - r.from.getTime()).toBe(23 * 3_600_000);
    expect(r.fromDay).toBe("2026-03-29");
    expect(r.toDay).toBe("2026-03-29");
  });

  it("is 25 hours long on the autumn DST day", () => {
    const r = periodRange("day", anchor("2026-10-25"));
    expect(r.to.getTime() - r.from.getTime()).toBe(25 * 3_600_000);
  });
});

describe("periodRange — week", () => {
  it("starts on Monday whatever day the anchor falls on", () => {
    // 15 July 2026 is a Wednesday; its week is Mon 13 – Sun 19.
    const r = periodRange("week", anchor("2026-07-15"));
    expect(r.fromDay).toBe("2026-07-13");
    expect(r.toDay).toBe("2026-07-19");
    expect(r.label).toBe("13 July – 19 July");
  });

  it("keeps a Sunday in the week that is ending, not the one starting", () => {
    const r = periodRange("week", anchor("2026-07-19"));
    expect(r.fromDay).toBe("2026-07-13");
    expect(r.toDay).toBe("2026-07-19");
  });

  it("steps a whole week either way", () => {
    const r = periodRange("week", anchor("2026-07-15"));
    expect(r.prev).toBe("2026-07-06");
    expect(r.next).toBe("2026-07-20");
  });

  it("covers 7 calendar days across a DST boundary, not 7 × 24 hours", () => {
    const r = periodRange("week", anchor("2026-03-29"));
    expect(r.fromDay).toBe("2026-03-23");
    expect(r.toDay).toBe("2026-03-29");
    expect(r.to.getTime() - r.from.getTime()).toBe(7 * 24 * 3_600_000 - 3_600_000);
  });
});

describe("periodRange — month", () => {
  it("spans the whole calendar month", () => {
    const r = periodRange("month", anchor("2026-07-15"));
    expect(r.fromDay).toBe("2026-07-01");
    expect(r.toDay).toBe("2026-07-31");
    expect(r.label).toBe("July 2026");
  });

  it("handles a short month and a February", () => {
    expect(periodRange("month", anchor("2026-02-10")).toDay).toBe("2026-02-28");
    expect(periodRange("month", anchor("2024-02-10")).toDay).toBe("2024-02-29");
    expect(periodRange("month", anchor("2026-06-10")).toDay).toBe("2026-06-30");
  });

  it("steps across a year boundary in both directions", () => {
    const jan = periodRange("month", anchor("2026-01-15"));
    expect(jan.prev).toBe("2025-12-01");
    expect(jan.next).toBe("2026-02-01");

    const dec = periodRange("month", anchor("2026-12-15"));
    expect(dec.next).toBe("2027-01-01");
    expect(dec.toDay).toBe("2026-12-31");
  });

  it("offers the same month a year earlier for the comparison", () => {
    expect(periodRange("month", anchor("2026-07-15")).lastYear).toBe("2025-07-01");
  });
});

describe("periodRange — year", () => {
  it("spans 1 January to 31 December", () => {
    const r = periodRange("year", anchor("2026-07-15"));
    expect(r.fromDay).toBe("2026-01-01");
    expect(r.toDay).toBe("2026-12-31");
    expect(r.label).toBe("2026");
    expect(r.prev).toBe("2025-01-01");
    expect(r.next).toBe("2027-01-01");
  });
});

describe("periodRange — a custom range", () => {
  it("treats both ends as inclusive", () => {
    const r = periodRange("range", anchor("2026-07-01"), new Date(), {
      from: "2026-06-16",
      to: "2026-07-31",
    });
    expect(r.fromDay).toBe("2026-06-16");
    expect(r.toDay).toBe("2026-07-31");
    expect(r.label).toBe("16 June – 31 July · 46 days");
  });

  it("reads a single-day range as that day", () => {
    const r = periodRange("range", anchor("2026-07-15"), new Date(), {
      from: "2026-07-15",
      to: "2026-07-15",
    });
    expect(r.label).toBe("Wednesday 15 July");
    expect(r.fromDay).toBe("2026-07-15");
    expect(r.toDay).toBe("2026-07-15");
  });

  it("tolerates a reversed pair instead of returning nothing", () => {
    // The URL is hand-editable, and "to before from" reads as zero earnings
    // rather than as an error.
    const r = periodRange("range", anchor("2026-07-01"), new Date(), {
      from: "2026-07-31",
      to: "2026-06-16",
    });
    expect(r.fromDay).toBe("2026-06-16");
    expect(r.toDay).toBe("2026-07-31");
  });

  it("compares against the same NUMBER of days, not the calendar month before", () => {
    // ⚑ The rule that makes a custom range honest: 46 days is compared with the
    // 46 days before it, never with "last month".
    const r = periodRange("range", anchor("2026-07-01"), new Date(), {
      from: "2026-06-16",
      to: "2026-07-31",
    });
    expect(r.prevCustom).toEqual({ from: "2026-05-01", to: "2026-06-15" });
    const span = (a: string, b: string) =>
      (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS + 1;
    expect(span(r.prevCustom!.from, r.prevCustom!.to)).toBe(46);
    expect(span(r.fromDay, r.toDay)).toBe(46);
  });

  it("offers the same span a year earlier", () => {
    const r = periodRange("range", anchor("2026-07-01"), new Date(), {
      from: "2026-06-16",
      to: "2026-07-31",
    });
    expect(r.lastYearCustom).toEqual({ from: "2025-06-16", to: "2025-07-31" });
  });

  it("leaves the step anchors self-referential — an arbitrary span has no neighbour", () => {
    const r = periodRange("range", anchor("2026-07-01"), new Date(), {
      from: "2026-06-16",
      to: "2026-07-31",
    });
    expect(r.prev).toBe(r.next);
    expect(r.prev).toBe("2026-06-16");
  });

  it("carries no comparison spans for the four granularities", () => {
    const r = periodRange("month", anchor("2026-07-15"));
    expect(r.prevCustom).toBeNull();
    expect(r.lastYearCustom).toBeNull();
  });
});

describe("periodRange — isCurrent", () => {
  const now = new Date("2026-07-15T12:00:00+02:00");

  it("is true for the period holding `now` and false either side", () => {
    expect(periodRange("day", anchor("2026-07-15"), now).isCurrent).toBe(true);
    expect(periodRange("day", anchor("2026-07-14"), now).isCurrent).toBe(false);
    expect(periodRange("month", anchor("2026-07-01"), now).isCurrent).toBe(true);
    expect(periodRange("month", anchor("2026-06-01"), now).isCurrent).toBe(false);
    expect(periodRange("year", anchor("2026-03-01"), now).isCurrent).toBe(true);
  });

  it("treats the exclusive end as the next period, not this one", () => {
    // Midnight Paris on the 16th belongs to the 16th.
    const midnight = new Date("2026-07-16T00:00:00+02:00");
    expect(periodRange("day", anchor("2026-07-15"), midnight).isCurrent).toBe(false);
    expect(periodRange("day", anchor("2026-07-16"), midnight).isCurrent).toBe(true);
  });
});

describe("parseAnchor / todayAnchor", () => {
  it("parses a day and falls back to today in Paris", () => {
    expect(parseAnchor("2026-07-15")).toEqual({ y: 2026, m: 7, d: 15 });
    expect(parseAnchor("nonsense")).toEqual(todayAnchor());
    expect(parseAnchor(undefined)).toEqual(todayAnchor());
  });

  it("reads today from the Paris calendar, not the machine's", () => {
    // 23:30 UTC on 15 July is already the 16th in Paris.
    expect(todayAnchor(new Date("2026-07-15T23:30:00Z"))).toEqual({ y: 2026, m: 7, d: 16 });
  });
});

// --------------------------------------------------------------------- the money
describe("totalsFor — what a Driver earned", () => {
  it("counts a completed trip at its settled fare", () => {
    const t = totalsFor([completed()], []);
    expect(t.trips).toBe(60);
    expect(t.tripCount).toBe(1);
    expect(t.total).toBe(60);
  });

  it("counts a no-show as earnings, kept separate from trips", () => {
    // The Guest didn't come down; the Driver is paid like a completed trip.
    const t = totalsFor([completed({ no_show: true })], []);
    expect(t.trips).toBe(0);
    expect(t.tripCount).toBe(0);
    expect(t.noShow).toBe(60);
    expect(t.noShowCount).toBe(1);
    expect(t.total).toBe(60);
  });

  it("adds waiting settled onto a completed trip", () => {
    const t = totalsFor([completed({ waiting_fee: 12, waiting_minutes: 12 })], []);
    expect(t.waiting).toBe(12);
    expect(t.waitingMinutes).toBe(12);
    expect(t.total).toBe(72);
  });

  it("splits a Business cancellation into the fee and the waiting, without paying either twice", () => {
    // ⚑ cancelCompensation is fee PLUS waiting, so the waiting must not be ADDED
    // a second time — that would pay the Driver twice for the same wait. Until
    // 2026-08-20 the whole sum sat in "Cancelled on you" and the minutes the
    // Driver actually sat there never reached the "Waiting time" line. It is now
    // carved OUT of the compensation: the two buckets still sum to 55.
    const m = mission({
      status: "cancelled",
      driver_id: "drv-1",
      cancellation_fee: 45,
      waiting_fee: 10,
      waiting_minutes: 10,
    });
    const t = totalsFor([m], []);
    expect(t.cancelledOnYou).toBe(45);
    expect(t.cancelledOnYouCount).toBe(1);
    expect(t.waiting).toBe(10);
    expect(t.waitingMinutes).toBe(10);
    expect(t.total).toBe(55);
  });

  it("still shows the minutes when a Business cancels a trip that ran no fee", () => {
    // A cancellation with waiting but no policy fee contributes nothing today
    // (cancelCompensation returns null on a null fee) — pinned so a later
    // change to that rule is a deliberate one, not a surprise.
    const t = totalsFor(
      [mission({ status: "cancelled", cancellation_fee: null, waiting_fee: 10, waiting_minutes: 10 })],
      [],
    );
    expect(t.waitingMinutes).toBe(0);
    expect(t.total).toBe(0);
  });

  it("ignores a cancelled trip with no fee stamped on it", () => {
    const t = totalsFor([mission({ status: "cancelled", cancellation_fee: null })], []);
    expect(t.cancelledOnYouCount).toBe(0);
    expect(t.total).toBe(0);
  });

  it("subtracts the Driver's own cancellation penalties", () => {
    const t = totalsFor([completed()], [{ created_at: "2026-07-15T09:00:00+02:00", fee_amount: 70 }]);
    expect(t.penalties).toBe(70);
    expect(t.penaltyCount).toBe(1);
    expect(t.total).toBe(-10);
  });

  it("coerces PostgREST's numeric-as-string penalties", () => {
    const t = totalsFor([], [{ created_at: "2026-07-15T09:00:00+02:00", fee_amount: "58.17" }]);
    expect(t.penalties).toBe(58.17);
  });

  it("counts nothing for a trip that is neither completed nor cancelled", () => {
    // A still-confirmed past trip (§ Q) has settled nothing.
    const t = totalsFor([mission({ status: "confirmed", ...standardCurve(), accepted_at: "2026-07-15T10:20:00+02:00" })], []);
    expect(t.total).toBe(0);
    expect(t.tripCount).toBe(0);
  });

  it("holds the identity: total = trips + no-show + waiting + cancelled-on-you − penalties", () => {
    const t = totalsFor(
      [
        completed({ id: "a" }),
        completed({ id: "b", no_show: true, waiting_fee: 20, waiting_minutes: 20 }),
        mission({ id: "c", status: "cancelled", cancellation_fee: 45, waiting_fee: 10 }),
      ],
      [{ created_at: "2026-07-15T09:00:00+02:00", fee_amount: 30 }],
    );
    expect(t.total).toBe(t.trips + t.noShow + t.waiting + t.cancelledOnYou - t.penalties);
    // 20 of the waiting is the no-show's, 10 is carved out of mission c's
    // compensation — which is why "cancelled on you" reads 45 and not 55.
    expect(t.total).toBe(60 + 60 + 30 + 45 - 30);
  });

  it("returns a zeroed set for an empty period without inventing nulls", () => {
    const t = totalsFor([], []);
    expect(t.total).toBe(0);
    expect(t.tripCount).toBe(0);
    expect(t.waitingMinutes).toBe(0);
  });

  it("does not leak state between calls", () => {
    // The totals start from a shared EMPTY constant; a missing spread would make
    // the second period include the first.
    totalsFor([completed()], []);
    expect(totalsFor([], []).total).toBe(0);
  });
});

describe("missionAmount — one row's contribution to the list", () => {
  it("is the settled fare plus waiting on a completed trip", () => {
    expect(missionAmount(completed({ waiting_fee: 12 }))).toBe(72);
  });

  it("is the compensation on a cancelled trip", () => {
    expect(
      missionAmount(mission({ status: "cancelled", cancellation_fee: 45, waiting_fee: 10 })),
    ).toBe(55);
  });

  it("is zero, not NaN, on a cancelled trip with nothing stamped", () => {
    expect(missionAmount(mission({ status: "cancelled", cancellation_fee: null }))).toBe(0);
  });
});

describe("driverCancelPickupAt — dating a trip the Driver walked away from", () => {
  // A driver cancellation clears `driver_id`, so the mission leaves the Driver's
  // own query and the cancellation row is all that survives. Its penalty was
  // still in the headline total while no row for it appeared in the list, so the
  // day rows summed to MORE than the total with nothing explaining the gap.
  // `hours_before_pickup` was measured against the same clock that stamped
  // `created_at`, so the two add back to the pickup exactly.
  it("adds the lead time back onto the moment they cancelled", () => {
    expect(
      driverCancelPickupAt({
        created_at: "2026-07-15T10:00:00+02:00",
        fee_amount: 190,
        hours_before_pickup: 2,
      }),
    ).toBe("2026-07-15T10:00:00.000Z");
  });

  it("handles a fractional lead time", () => {
    expect(
      driverCancelPickupAt({
        created_at: "2026-07-15T08:00:00Z",
        fee_amount: 190,
        hours_before_pickup: 1.5,
      }),
    ).toBe("2026-07-15T09:30:00.000Z");
  });

  it("coerces PostgREST's numeric-as-string", () => {
    expect(
      driverCancelPickupAt({
        created_at: "2026-07-15T08:00:00Z",
        fee_amount: 190,
        hours_before_pickup: "3",
      }),
    ).toBe("2026-07-15T11:00:00.000Z");
  });

  it("returns null rather than guessing when the column is absent", () => {
    // Pre-O7 rows have no lead time. The penalty row still has to appear — it
    // just loses the "was due" clause; it is dated by `created_at` either way.
    expect(driverCancelPickupAt({ created_at: "2026-07-15T08:00:00Z", fee_amount: 190 })).toBe(null);
    expect(
      driverCancelPickupAt({
        created_at: "2026-07-15T08:00:00Z",
        fee_amount: 190,
        hours_before_pickup: null,
      }),
    ).toBe(null);
  });

  it("returns null on an unparseable timestamp instead of Invalid Date", () => {
    expect(
      driverCancelPickupAt({ created_at: "not a date", fee_amount: 190, hours_before_pickup: 2 }),
    ).toBe(null);
  });
});
