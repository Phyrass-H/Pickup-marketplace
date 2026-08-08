// Driver Earnings — the period calendar, and what a Driver actually made.
//
// Everything here is bucketed in **Europe/Paris**, never UTC: a 00:30 pickup
// belongs to the night the Driver worked, and a week starts on Monday. The DST
// cases are not pedantry — a day that is 23 or 25 hours long is the one that
// silently moves a trip into the wrong period, and the wrong period is the wrong
// payout.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
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
} from "@/lib/earnings";
import { cancelled, completed, mission } from "@/test/support/factories";

const NOW = new Date("2026-08-08T08:00:00.000Z");
const anchor = (s: string) => parseAnchor(s);

describe("parseDayParam", () => {
  test("accepts a real calendar day", () => {
    assert.equal(parseDayParam("2026-07-10"), "2026-07-10");
    assert.equal(parseDayParam("2024-02-29"), "2024-02-29");
  });

  test("rejects a day that does not exist — Date would roll it over silently", () => {
    // "?p=day&d=2026-02-31" used to quietly filter to 3 March.
    assert.equal(parseDayParam("2026-02-31"), null);
    assert.equal(parseDayParam("2026-02-29"), null, "2026 is not a leap year");
    assert.equal(parseDayParam("2026-04-31"), null);
    assert.equal(parseDayParam("2026-13-01"), null);
    assert.equal(parseDayParam("2026-00-10"), null);
    assert.equal(parseDayParam("2026-01-32"), null);
  });

  test("rejects anything that is not YYYY-MM-DD", () => {
    assert.equal(parseDayParam(undefined), null);
    assert.equal(parseDayParam(""), null);
    assert.equal(parseDayParam("2026-7-1"), null);
    assert.equal(parseDayParam("10/07/2026"), null);
    assert.equal(parseDayParam("2026-07-10T12:00:00Z"), null);
  });
});

describe("isPeriod / isGranularity", () => {
  test("the five periods, and the one that cannot be stepped", () => {
    for (const p of ["day", "week", "month", "year", "range"]) assert.equal(isPeriod(p), true, p);
    assert.equal(isPeriod("fortnight"), false);
    assert.equal(isPeriod(undefined), false);
    assert.equal(isGranularity("month"), true);
    assert.equal(isGranularity("range"), false, "an arbitrary span has no neighbour to step to");
  });
});

describe("dayKey — Paris, not UTC", () => {
  test("a pickup after midnight Paris belongs to the next day", () => {
    // Summer: Paris is UTC+2. 22:30Z is 00:30 the following morning.
    assert.equal(dayKey("2026-07-10T22:30:00Z"), "2026-07-11");
    assert.equal(dayKey("2026-07-10T21:30:00Z"), "2026-07-10");
  });

  test("and in winter, when the offset is only an hour", () => {
    assert.equal(dayKey("2026-01-10T23:30:00Z"), "2026-01-11");
    assert.equal(dayKey("2026-01-10T22:30:00Z"), "2026-01-10");
  });
});

describe("parseAnchor", () => {
  test("splits a well-formed day", () => {
    assert.deepEqual(parseAnchor("2026-07-10"), { y: 2026, m: 7, d: 10 });
  });

  test("falls back to today rather than throwing", () => {
    assert.deepEqual(parseAnchor("nonsense"), todayAnchor());
    assert.deepEqual(parseAnchor(undefined), todayAnchor());
  });
});

describe("periodRange", () => {
  test("day", () => {
    const r = periodRange("day", anchor("2026-07-10"), NOW);
    assert.equal(r.label, "Friday 10 July");
    assert.equal(r.fromDay, "2026-07-10");
    assert.equal(r.toDay, "2026-07-10");
    assert.equal(r.prev, "2026-07-09");
    assert.equal(r.next, "2026-07-11");
    assert.equal(r.lastYear, "2025-07-10");
    // Paris midnight to Paris midnight, half-open.
    assert.equal(r.from.toISOString(), "2026-07-09T22:00:00.000Z");
    assert.equal(r.to.toISOString(), "2026-07-10T22:00:00.000Z");
  });

  test("week opens on the Monday, whatever day the anchor falls on", () => {
    // 10 July 2026 is a Friday.
    const r = periodRange("week", anchor("2026-07-10"), NOW);
    assert.equal(r.fromDay, "2026-07-06");
    assert.equal(r.toDay, "2026-07-12");
    assert.equal(r.label, "6 July – 12 July");
    assert.equal(r.prev, "2026-06-29");
    assert.equal(r.next, "2026-07-13");

    // The Monday itself must not step back a week.
    assert.equal(periodRange("week", anchor("2026-07-06"), NOW).fromDay, "2026-07-06");
    // Nor must the Sunday step forward.
    assert.equal(periodRange("week", anchor("2026-07-12"), NOW).fromDay, "2026-07-06");
  });

  test("month", () => {
    const r = periodRange("month", anchor("2026-07-15"), NOW);
    assert.equal(r.label, "July 2026");
    assert.equal(r.fromDay, "2026-07-01");
    assert.equal(r.toDay, "2026-07-31");
    assert.equal(r.prev, "2026-06-01");
    assert.equal(r.next, "2026-08-01");
  });

  test("month steps across the year boundary in both directions", () => {
    assert.equal(periodRange("month", anchor("2026-12-15"), NOW).next, "2027-01-01");
    assert.equal(periodRange("month", anchor("2026-01-15"), NOW).prev, "2025-12-01");
  });

  test("February knows how long it is", () => {
    assert.equal(periodRange("month", anchor("2026-02-10"), NOW).toDay, "2026-02-28");
    assert.equal(periodRange("month", anchor("2024-02-10"), NOW).toDay, "2024-02-29");
  });

  test("year", () => {
    const r = periodRange("year", anchor("2026-07-10"), NOW);
    assert.equal(r.label, "2026");
    assert.equal(r.fromDay, "2026-01-01");
    assert.equal(r.toDay, "2026-12-31");
    assert.equal(r.prev, "2025-01-01");
    assert.equal(r.next, "2027-01-01");
  });

  test("a custom range is inclusive at both ends", () => {
    const r = periodRange("range", anchor("2026-07-01"), NOW, { from: "2026-07-01", to: "2026-07-10" });
    assert.equal(r.fromDay, "2026-07-01");
    assert.equal(r.toDay, "2026-07-10");
    assert.equal(r.label, "1 July – 10 July · 10 days");
    assert.equal(r.to.toISOString(), "2026-07-10T22:00:00.000Z", "the 10th is included");
  });

  test("a backwards range is swapped, not read as an empty period", () => {
    const forwards = periodRange("range", anchor("2026-07-01"), NOW, { from: "2026-07-01", to: "2026-07-10" });
    const backwards = periodRange("range", anchor("2026-07-01"), NOW, { from: "2026-07-10", to: "2026-07-01" });
    assert.equal(backwards.fromDay, forwards.fromDay);
    assert.equal(backwards.toDay, forwards.toDay);
  });

  test("a one-day range reads as that day, not as a span", () => {
    const r = periodRange("range", anchor("2026-07-10"), NOW, { from: "2026-07-10", to: "2026-07-10" });
    assert.equal(r.label, "Friday 10 July");
  });

  test("a range's comparisons are the same LENGTH, not the same calendar unit", () => {
    const r = periodRange("range", anchor("2026-07-01"), NOW, { from: "2026-07-01", to: "2026-07-10" });
    assert.deepEqual(r.prevCustom, { from: "2026-06-21", to: "2026-06-30" });
    assert.deepEqual(r.lastYearCustom, { from: "2025-07-01", to: "2025-07-10" });
  });

  test("the four granularities carry no custom comparisons", () => {
    for (const p of ["day", "week", "month", "year"] as const) {
      const r = periodRange(p, anchor("2026-07-10"), NOW);
      assert.equal(r.prevCustom, null, p);
      assert.equal(r.lastYearCustom, null, p);
    }
  });

  test("isCurrent is true only for the period holding `now`", () => {
    assert.equal(periodRange("month", anchor("2026-08-01"), NOW).isCurrent, true);
    assert.equal(periodRange("month", anchor("2026-07-01"), NOW).isCurrent, false);
    assert.equal(periodRange("day", anchor("2026-08-08"), NOW).isCurrent, true);
    assert.equal(periodRange("year", anchor("2026-01-01"), NOW).isCurrent, true);
  });
});

describe("periodRange — the clocks change", () => {
  test("a spring-forward day is 23 hours long", () => {
    // 29 March 2026: Paris jumps 02:00 → 03:00.
    const r = periodRange("day", anchor("2026-03-29"), NOW);
    assert.equal(r.from.toISOString(), "2026-03-28T23:00:00.000Z");
    assert.equal(r.to.toISOString(), "2026-03-29T22:00:00.000Z");
    assert.equal((r.to.getTime() - r.from.getTime()) / 3_600_000, 23);
  });

  test("an autumn-back day is 25", () => {
    // 25 October 2026: Paris falls 03:00 → 02:00.
    const r = periodRange("day", anchor("2026-10-25"), NOW);
    assert.equal(r.from.toISOString(), "2026-10-24T22:00:00.000Z");
    assert.equal(r.to.toISOString(), "2026-10-25T23:00:00.000Z");
    assert.equal((r.to.getTime() - r.from.getTime()) / 3_600_000, 25);
  });

  test("a month spanning a transition still starts and ends at Paris midnight", () => {
    const r = periodRange("month", anchor("2026-03-15"), NOW);
    assert.equal(r.from.toISOString(), "2026-02-28T23:00:00.000Z", "CET");
    assert.equal(r.to.toISOString(), "2026-03-31T22:00:00.000Z", "CEST");
  });
});

describe("totalsFor — what a Driver made", () => {
  test("empty in, empty out", () => {
    const t = totalsFor([], []);
    assert.equal(t.total, 0);
    assert.equal(t.tripCount, 0);
  });

  test("a completed trip is its settled fare, plus any waiting", () => {
    const t = totalsFor([completed({ waiting_fee: 12, waiting_minutes: 12 })], []);
    assert.equal(t.trips, 70);
    assert.equal(t.tripCount, 1);
    assert.equal(t.waiting, 12);
    assert.equal(t.waitingMinutes, 12);
    assert.equal(t.total, 82);
  });

  test("a no-show pays like a completed trip — it IS earnings", () => {
    const t = totalsFor([completed({ no_show: true })], []);
    assert.equal(t.noShow, 70);
    assert.equal(t.noShowCount, 1);
    assert.equal(t.trips, 0, "counted separately, not as a driven trip");
    assert.equal(t.total, 70);
  });

  test("a Business cancelling on them pays the fee and any waiting already run", () => {
    const t = totalsFor([cancelled({ cancellation_fee: 42, waiting_fee: 13 })], []);
    assert.equal(t.cancelledOnYou, 55);
    assert.equal(t.cancelledOnYouCount, 1);
    assert.equal(t.waiting, 0, "already inside cancelCompensation — never counted twice");
    assert.equal(t.total, 55);
  });

  test("a legacy cancellation with nothing stamped shows nothing rather than zero", () => {
    const t = totalsFor([cancelled({ cancellation_fee: null })], []);
    assert.equal(t.cancelledOnYouCount, 0);
    assert.equal(t.total, 0);
  });

  test("their own cancellations come off the total", () => {
    const t = totalsFor(
      [completed()],
      [{ created_at: "2026-07-11T09:00:00.000Z", fee_amount: 25 }],
    );
    assert.equal(t.penalties, 25);
    assert.equal(t.penaltyCount, 1);
    assert.equal(t.total, 45);
  });

  test("the total is trips + no-shows + waiting + cancelled-on-you − penalties", () => {
    const t = totalsFor(
      [
        completed({ waiting_fee: 5 }),
        completed({ no_show: true }),
        cancelled({ cancellation_fee: 42 }),
      ],
      [{ created_at: "2026-07-11T09:00:00.000Z", fee_amount: 30 }],
    );
    assert.equal(t.total, 70 + 70 + 5 + 42 - 30);
  });

  test("adds PostgREST's numeric strings instead of concatenating them", () => {
    const t = totalsFor(
      [completed({ waiting_fee: "5" as unknown as number })],
      [{ created_at: "2026-07-11T09:00:00.000Z", fee_amount: "30" }],
    );
    assert.equal(t.waiting, 5);
    assert.equal(t.penalties, 30);
    assert.equal(t.total, 45);
  });

  test("a mission that never closed contributes nothing either way", () => {
    const t = totalsFor([mission({ status: "confirmed", accepted_at: "2026-07-10T08:40:00.000Z" })], []);
    assert.equal(t.total, 0);
    assert.equal(t.tripCount, 0);
  });
});

describe("missionAmount — one line in the trip list", () => {
  test("a completed trip is its fare plus its waiting", () => {
    assert.equal(missionAmount(completed({ waiting_fee: 12 })), 82);
  });

  test("a cancelled trip is its compensation, not its fare", () => {
    assert.equal(missionAmount(cancelled({ cancellation_fee: 42, waiting_fee: 13 })), 55);
  });

  test("a cancelled trip with nothing stamped is zero, not a fare", () => {
    assert.equal(missionAmount(cancelled({ cancellation_fee: null })), 0);
  });

  test("the frozen fare, never the climbing one", () => {
    assert.equal(missionAmount(completed()), 70);
  });
});
