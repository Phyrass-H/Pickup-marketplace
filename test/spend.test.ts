// Spend — what a Business paid, and what the page is allowed to call "spent".
//
// Three rules this file exists to keep honest, all of them found the hard way:
//  · a past trip a Driver never closed is AGREED, not settled — shown, never
//    totalled (§ Q), or a hotel's spend inflates with trips that may not have
//    happened;
//  · waiting settled onto a CANCELLED mission is real money, but it is not part
//    of cost-per-TRIP — dividing it by completed trips charged the trips that
//    happened for time spent on one that didn't;
//  · the breakdown panel sits beside a euro column, so an unfilled or unclosed
//    mission has no place in it — it reads "9 trips · 0,00 €".
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  autoBucket,
  avoidable,
  breakdown,
  minutesToAccept,
  rowCost,
  series,
  spendTotals,
  wasteLines,
} from "@/lib/spend";
import { cancelled, completed, mission, row } from "@/test/support/factories";

const NO_DESKS = new Map<string, string>();

// A trip that ran and closed: accepted 40 min into the climb → €70.
const ran = () => row(completed());
// A Guest who never came down: the Business is still billed the full fare.
const noShow = () => row(completed({ no_show: true, no_show_by: "driver" }));
// Nobody took it before the pickup time (§ P).
const unfilled = () => row(mission({ status: "expired" }));
// § Q — a Driver took it, drove it (or didn't) and never tapped the last button.
const unclosed = () => row(mission({ status: "confirmed", driver_id: "drv-1", accepted_at: "2026-07-10T08:40:00.000Z" }));

describe("rowCost — one row's real cost", () => {
  test("fare plus the waiting settled on it", () => {
    assert.equal(rowCost(row(completed({ waiting_fee: 12 }))), 82);
  });

  test("nothing settled → nothing counted, however big the agreed fare", () => {
    const r = unclosed();
    assert.equal(r.fare, 70, "the agreed fare is still shown on the row");
    assert.equal(r.counted, false);
    assert.equal(rowCost(r), 0);
  });

  test("an unfilled mission cost nothing", () => {
    assert.equal(rowCost(unfilled()), 0);
  });

  test("a cancellation is billed at its fee, not at the fare", () => {
    assert.equal(rowCost(row(cancelled({ cancellation_fee: 42 }))), 42);
  });

  test("adds PostgREST's numeric strings instead of concatenating them", () => {
    // waiting_fee arrives as text; 70 + "12" is "7012".
    const r = row(completed({ waiting_fee: "12" as unknown as number }));
    assert.equal(rowCost(r), 82);
  });
});

describe("spendTotals — the hero figure", () => {
  test("empty in, empty out", () => {
    const t = spendTotals([]);
    assert.equal(t.total, 0);
    assert.equal(t.ordered, 0);
    assert.equal(t.costPerTrip, null);
    assert.equal(t.fillRate, null);
    assert.equal(t.medianToAccept, null);
  });

  test("the total is fares + no-shows + waiting + cancellation fees", () => {
    const t = spendTotals([
      row(completed({ waiting_fee: 5, waiting_minutes: 5 })),
      noShow(),
      row(cancelled({ cancellation_fee: 42, waiting_fee: 13, waiting_minutes: 13 })),
    ]);
    assert.equal(t.fares, 70);
    assert.equal(t.noShow, 70);
    assert.equal(t.waiting, 18);
    assert.equal(t.cancelFees, 42);
    assert.equal(t.total, 200);
  });

  test("a no-show is a trip that ran, not a failure to fill", () => {
    const t = spendTotals([noShow()]);
    assert.equal(t.noShowCount, 1);
    assert.equal(t.fareCount, 0);
    assert.equal(t.trips, 1);
    assert.equal(t.total, 70);
  });

  test("an unfilled mission costs nothing and reports its unspent Ceiling", () => {
    const t = spendTotals([unfilled(), ran()]);
    assert.equal(t.unfilledCount, 1);
    assert.equal(t.unfilledCeiling, 100);
    assert.equal(t.total, 70, "the Ceiling was authorised, never spent");
    assert.equal(t.ordered, 2);
  });

  test("a still-pooled mission past its pickup time counts as unfilled too", () => {
    // The sweep only runs on two reads; every other screen derives it.
    const t = spendTotals([row(mission({ status: "pooled", pickup_at: "2026-07-10T12:00:00.000Z" }))]);
    assert.equal(t.unfilledCount, 1);
    assert.equal(t.total, 0);
  });

  test("§ Q — an unclosed trip is its own line, out of the total", () => {
    const t = spendTotals([ran(), unclosed()]);
    assert.equal(t.unsettled, 70);
    assert.equal(t.unsettledCount, 1);
    assert.equal(t.total, 70, "only the closed trip is money");
    assert.equal(t.trips, 1);
  });

  test("a cancellation with no fee is still a cancellation", () => {
    const free = spendTotals([row(cancelled({ cancellation_fee: 0 }))]);
    assert.equal(free.cancelCount, 1);
    assert.equal(free.cancelFees, 0);

    const legacy = spendTotals([row(cancelled({ cancellation_fee: null }))]);
    assert.equal(legacy.cancelCount, 0, "a row with nothing stamped is not a nil fee");
  });

  test("cost-per-trip excludes waiting settled on a trip that never ran", () => {
    // The audit fix: t.waiting also holds waiting a business_cancel settled, and
    // dividing that by the completed count charges the trips that DID happen.
    const t = spendTotals([
      row(completed({ waiting_fee: 5 })),
      row(cancelled({ cancellation_fee: 42, waiting_fee: 13 })),
    ]);
    assert.equal(t.waiting, 18);
    assert.equal(t.tripWaiting, 5);
    assert.equal(t.trips, 1);
    assert.equal(t.costPerTrip, 75, "(70 fare + 5 its own waiting) ÷ 1 trip");
  });

  test("fill rate is missions that found a Driver ÷ missions ordered", () => {
    const t = spendTotals([ran(), ran(), unfilled(), unfilled()]);
    assert.equal(t.filledCount, 2);
    assert.equal(t.ordered, 4);
    assert.equal(t.fillRate, 50);
  });

  test("median time-to-accept, odd and even", () => {
    const acceptedAfter = (min: number) =>
      row(completed({ accepted_at: new Date(Date.parse("2026-07-10T08:00:00Z") + min * 60_000).toISOString() }));

    assert.equal(spendTotals([acceptedAfter(10), acceptedAfter(30), acceptedAfter(50)]).medianToAccept, 30);
    assert.equal(spendTotals([acceptedAfter(10), acceptedAfter(30)]).medianToAccept, 20);
  });

  test("two calls do not share state", () => {
    const first = spendTotals([ran()]);
    const second = spendTotals([]);
    assert.equal(first.total, 70);
    assert.equal(second.total, 0);
    assert.equal(spendTotals([ran()]).total, 70);
  });
});

describe("minutesToAccept", () => {
  test("null when nobody ever took it", () => {
    assert.equal(minutesToAccept(mission()), null);
  });

  test("measured from entering the Pool", () => {
    assert.equal(minutesToAccept(completed()), 40);
  });

  test("a re-pooled mission measures from the RE-pool, not the original posting", () => {
    const m = completed({
      created_at: "2026-07-10T08:00:00.000Z",
      pooled_at: "2026-07-10T09:00:00.000Z",
      accepted_at: "2026-07-10T09:20:00.000Z",
    });
    assert.equal(minutesToAccept(m), 20);
  });

  test("a negative interval is discarded rather than shown", () => {
    const m = completed({ accepted_at: "2026-07-10T07:00:00.000Z" });
    assert.equal(minutesToAccept(m), null);
  });
});

describe("avoidable + wasteLines", () => {
  const t = spendTotals([
    row(completed({ waiting_fee: 5, waiting_minutes: 5 })),
    noShow(),
    row(cancelled({ cancellation_fee: 42 })),
    unfilled(),
  ]);

  test("the avoidable slice is the fees, the no-shows and the waiting", () => {
    assert.equal(avoidable(t), 42 + 70 + 5);
  });

  test("the unfilled line carries a count but no euro amount", () => {
    const unfilledLine = wasteLines(t).find((l) => l.key === "unfilled");
    assert.equal(unfilledLine?.amount, null, "nothing was spent on a trip nobody took");
    assert.equal(unfilledLine?.count, 1);
  });

  test("every line is present even at zero, worst first", () => {
    const keys = wasteLines(spendTotals([])).map((l) => l.key);
    assert.deepEqual(keys, ["cancelled", "noshow", "waiting", "unfilled"]);
    for (const line of wasteLines(spendTotals([]))) {
      assert.equal(line.count, 0);
      assert.equal(line.detail, "none this period");
    }
  });
});

describe("breakdown — where the money went", () => {
  test("shares are of the money, and add up", () => {
    const rows = [
      row(completed()), // transfer, €70
      row(completed({ luggage_only: true, category: "van" })), // luggage run, €70
      row(completed({ luggage_only: true, category: "van" })),
    ];
    const b = breakdown(rows, "type", NO_DESKS);
    assert.deepEqual(
      b.map((x) => [x.label, x.trips, x.amount]),
      [
        ["Luggage run", 2, 140],
        ["Transfer", 1, 70],
      ],
    );
    assert.equal(Math.round(b.reduce((s, x) => s + x.share, 0)), 100);
  });

  test("an unfilled or unclosed mission is not a row in a euro ranking", () => {
    // `counted` alone is not enough — historyFare marks an expired mission
    // counted:true, because a correctly-zero contribution to a TOTAL is real.
    const b = breakdown([ran(), unfilled(), unclosed()], "type", NO_DESKS);
    assert.equal(b.length, 1);
    assert.equal(b[0].trips, 1);
    assert.equal(b[0].amount, 70);
  });

  test("a mission nobody drove belongs to no Driver", () => {
    const b = breakdown([ran(), unfilled()], "driver", NO_DESKS);
    assert.equal(b.length, 1);
    assert.equal(b[0].driverId, "drv-1");
  });

  test("a desk with no name still ranks, labelled", () => {
    const named = new Map([["desk-1", "Front desk"]]);
    assert.equal(breakdown([ran()], "desk", named)[0].label, "Front desk");
    assert.equal(breakdown([ran()], "desk", NO_DESKS)[0].label, "Your desk");
  });

  test("everything past the top N rolls into one quiet Other", () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      row(completed({ id: `x${i}`, pickup_address: `Street ${i}`, dropoff_address: `Place ${i}` })),
    );
    const b = breakdown(rows, "route", NO_DESKS, 3);
    assert.equal(b.length, 4);
    const other = b.at(-1);
    assert.equal(other?.key, "__other");
    assert.equal(other?.other, true);
    assert.equal(other?.label, "Other (2)");
    assert.equal(other?.trips, 2);
    assert.equal(other?.amount, 140);
    assert.equal(b.reduce((s, x) => s + x.amount, 0), 350, "the rollup loses no money");
  });
});

describe("autoBucket", () => {
  test("a month or less is drawn day by day", () => {
    assert.equal(autoBucket("2026-07-10", "2026-07-10"), "day");
    assert.equal(autoBucket("2026-07-01", "2026-07-31"), "day");
  });

  test("past 31 days it switches to weeks, past 182 to months", () => {
    assert.equal(autoBucket("2026-07-01", "2026-08-01"), "week");
    assert.equal(autoBucket("2026-01-01", "2026-07-01"), "week");
    assert.equal(autoBucket("2026-01-01", "2026-07-02"), "month");
    assert.equal(autoBucket("2026-01-01", "2026-12-31"), "month");
  });
});

describe("series — every bucket, including the quiet ones", () => {
  test("a quiet day is a zero, not a missing column", () => {
    const points = series([ran()], "2026-07-08", "2026-07-11", "day");
    assert.deepEqual(points.map((p) => p.key), [
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
    ]);
    assert.deepEqual(points.map((p) => p.amount), [0, 0, 70, 0]);
  });

  test("the trip count is the same population the hero counts", () => {
    // `counted` is true for an unfilled AND a cancelled mission, so counting it
    // here made a tooltip say "2 trips" on a day nobody drove.
    const points = series([ran(), unfilled(), unclosed(), row(cancelled())], "2026-07-10", "2026-07-10", "day");
    assert.equal(points[0].trips, 1);
  });

  test("a cancellation fee still lands on the day's amount", () => {
    const points = series([row(cancelled({ cancellation_fee: 42 }))], "2026-07-10", "2026-07-10", "day");
    assert.equal(points[0].amount, 42);
    assert.equal(points[0].trips, 0);
  });

  test("rows outside the span are dropped, not folded into an edge bucket", () => {
    const outside = row(completed({ pickup_at: "2026-06-01T12:00:00.000Z" }));
    const points = series([ran(), outside], "2026-07-08", "2026-07-11", "day");
    assert.equal(points.reduce((s, p) => s + p.amount, 0), 70);
  });

  test("week buckets start on the Monday", () => {
    // 2026-07-10 is a Friday; its week opens on Monday the 6th.
    const points = series([ran()], "2026-07-06", "2026-07-19", "week");
    assert.deepEqual(points.map((p) => p.key), ["2026-07-06", "2026-07-13"]);
    assert.equal(points[0].amount, 70);
  });

  test("month buckets roll over the year end", () => {
    const points = series([], "2026-11-01", "2027-01-31", "month");
    assert.deepEqual(points.map((p) => p.key), ["2026-11-01", "2026-12-01", "2027-01-01"]);
  });

  test("a Paris-evening pickup belongs to the Paris day, not the UTC one", () => {
    // 23:30 Paris on 10 July is 21:30Z the same day; 00:30 Paris on the 11th is
    // 22:30Z on the 10th and must land on the 11th.
    const lateNight = row(completed({ pickup_at: "2026-07-10T22:30:00.000Z" }));
    const points = series([lateNight], "2026-07-10", "2026-07-11", "day");
    assert.deepEqual(points.map((p) => p.amount), [0, 70]);
  });
});
