// The archive — what a past trip is worth, and which rows a filter leaves.
//
// This is where History and Spend meet: both read the same archive through the
// same query, so a filtered total on one screen has to equal the same filtered
// total on the other. The last block asserts exactly that, because "the numbers
// agree across the page, the CSV and History" was verified by hand once and had
// nothing holding it there.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  applyHistoryQuery,
  bucketOf,
  fold,
  historyFare,
  parseHistoryQuery,
  type HistoryQuery,
} from "@/lib/history-filter";
import { rowCost, spendTotals } from "@/lib/spend";
import { cancelled, completed, mission, row } from "@/test/support/factories";

const query = (sp: Record<string, string> = {}): HistoryQuery => parseHistoryQuery(sp);

describe("historyFare — what a past trip is worth", () => {
  test("unfilled → nothing at all; nobody ever held it", () => {
    assert.deepEqual(historyFare(mission({ status: "expired" })), { fare: null, counted: true });
  });

  test("a still-pooled mission past its pickup time reads the same", () => {
    assert.deepEqual(
      historyFare(mission({ status: "pooled", pickup_at: "2026-07-10T12:00:00.000Z" })),
      { fare: null, counted: true },
    );
  });

  test("cancelled → the fee that was struck, not the fare", () => {
    assert.deepEqual(historyFare(cancelled({ cancellation_fee: 42 })), { fare: 42, counted: true });
  });

  test("cancelled with nothing stamped → shown blank, still counted as settled", () => {
    assert.deepEqual(historyFare(cancelled({ cancellation_fee: null })), { fare: null, counted: true });
  });

  test("a fee that will not parse is treated as absent, not as NaN", () => {
    const broken = cancelled({ cancellation_fee: "n/a" as unknown as number });
    assert.deepEqual(historyFare(broken), { fare: null, counted: true });
  });

  test("completed → the fare frozen at accept", () => {
    assert.deepEqual(historyFare(completed()), { fare: 70, counted: true });
  });

  test("a no-show is completed and billed in full", () => {
    assert.deepEqual(historyFare(completed({ no_show: true })), { fare: 70, counted: true });
  });

  test("§ Q — a trip nobody closed is shown, and not counted", () => {
    const unclosed = mission({ status: "confirmed", accepted_at: "2026-07-10T08:40:00.000Z" });
    assert.deepEqual(historyFare(unclosed), { fare: 70, counted: false });

    const midTrip = mission({ status: "on_board", accepted_at: "2026-07-10T08:40:00.000Z" });
    assert.equal(historyFare(midTrip).counted, false);
  });
});

describe("bucketOf — which chip a trip lands under", () => {
  test("the three endings, and the one that has not ended", () => {
    assert.equal(bucketOf(mission({ status: "expired" })), "unfilled");
    assert.equal(bucketOf(completed()), "completed");
    assert.equal(bucketOf(cancelled()), "cancelled");
    assert.equal(bucketOf(mission({ status: "confirmed" })), null);
  });

  test("unfilled wins over the raw status — a dead pooled row is not live", () => {
    assert.equal(bucketOf(mission({ status: "pooled", pickup_at: "2026-07-10T12:00:00.000Z" })), "unfilled");
  });
});

describe("fold — accents are never incidental", () => {
  test("an address typed without accents still matches", () => {
    assert.equal(fold("Aéroport Nice Côte d'Azur"), fold("aeroport nice cote d'azur"));
    assert.equal(fold("Hôtel Negresco"), "hotel negresco");
  });

  test("null and undefined fold to nothing rather than crashing", () => {
    assert.equal(fold(null), "");
    assert.equal(fold(undefined), "");
  });
});

describe("applyHistoryQuery", () => {
  const rows = [
    row(completed({ id: "a", pickup_at: "2026-07-10T12:00:00.000Z" })),
    row(completed({ id: "b", pickup_at: "2026-07-20T12:00:00.000Z", no_show: true })),
    row(cancelled({ id: "c", pickup_at: "2026-07-15T12:00:00.000Z", cancellation_fee: 42 })),
    row(mission({ id: "d", status: "expired", pickup_at: "2026-07-18T12:00:00.000Z" })),
    row(mission({ id: "e", status: "confirmed", pickup_at: "2026-07-12T12:00:00.000Z", driver_id: "drv-1", accepted_at: "2026-07-10T08:40:00.000Z" })),
  ];
  const ids = (r: { mission: { id: string } }[]) => r.map((x) => x.mission.id);

  test("no filter → everything, newest first", () => {
    const res = applyHistoryQuery(rows, query());
    assert.deepEqual(ids(res.rows), ["b", "d", "c", "e", "a"]);
  });

  test("the date filter compares Paris days", () => {
    const res = applyHistoryQuery(rows, query({ p: "range", from: "2026-07-12", to: "2026-07-16" }));
    assert.deepEqual(ids(res.rows).sort(), ["c", "e"]);
  });

  test("a pickup after midnight Paris falls on the next day's filter", () => {
    // 22:30Z on the 10th is 00:30 Paris on the 11th.
    const lateNight = [row(completed({ id: "z", pickup_at: "2026-07-10T22:30:00.000Z" }))];
    assert.equal(applyHistoryQuery(lateNight, query({ p: "day", d: "2026-07-10" })).rows.length, 0);
    assert.equal(applyHistoryQuery(lateNight, query({ p: "day", d: "2026-07-11" })).rows.length, 1);
  });

  test("the chip counts describe what you are looking at, before the outcome filter", () => {
    // Counting the outcome too would make every chip read its own selection (1 of 1).
    const res = applyHistoryQuery(rows, query({ filter: "cancelled" }));
    assert.deepEqual(ids(res.rows), ["c"]);
    assert.deepEqual(res.counts, { all: 5, completed: 2, unfilled: 1, cancelled: 1 });
  });

  test("but they DO respect the date and search filters", () => {
    const res = applyHistoryQuery(rows, query({ p: "range", from: "2026-07-12", to: "2026-07-16" }));
    assert.equal(res.counts.all, 2);
  });

  test("sorting by fare puts the fareless row last in both directions", () => {
    const high = ids(applyHistoryQuery(rows, query({ sort: "high" })).rows);
    const low = ids(applyHistoryQuery(rows, query({ sort: "low" })).rows);
    assert.equal(high.at(-1), "d", "an unfilled trip is not €0");
    assert.equal(low.at(-1), "d");
    assert.equal(high[0], "a");
    assert.equal(low[0], "c", "the €42 fee is the smallest real amount");
  });

  test("oldest first is the exact reverse of newest first", () => {
    const recent = ids(applyHistoryQuery(rows, query({ sort: "recent" })).rows);
    const oldest = ids(applyHistoryQuery(rows, query({ sort: "oldest" })).rows);
    assert.deepEqual(oldest, [...recent].reverse());
  });

  test("searching a Driver's name narrows to their trips", () => {
    const res = applyHistoryQuery(rows, query({ q: "dubois" }));
    assert.ok(res.rows.length > 0);
    assert.ok(res.rows.every((r) => r.driverName === "Marc Dubois"));
    assert.deepEqual(res.matches.get(res.rows[0].mission.id), ["driver"]);
  });

  test("a search with no hit anywhere returns nothing, not everything", () => {
    assert.equal(applyHistoryQuery(rows, query({ q: "zzzz" })).rows.length, 0);
  });

  test("the running spend excludes what has not settled", () => {
    const res = applyHistoryQuery(rows, query());
    // 70 (a) + 70 (b, no-show) + 42 (c). d has no fare; e is agreed, not settled.
    assert.equal(res.spend, 182);
  });
});

describe("History and Spend cannot disagree about the same filter", () => {
  // The invariant behind "5 879,69 € on the page, the CSV and History". Both
  // screens sum rowCost over the SAME filtered rows; spendTotals then splits
  // that same money into fares / no-shows / waiting / fees. If the split ever
  // stops adding back up, one of the two screens is lying.
  const rows = [
    row(completed({ id: "a", waiting_fee: 5, waiting_minutes: 5 })),
    row(completed({ id: "b", no_show: true, waiting_fee: 40, waiting_minutes: 40 })),
    row(cancelled({ id: "c", cancellation_fee: 42, waiting_fee: 13, waiting_minutes: 13 })),
    row(cancelled({ id: "d", cancellation_fee: 0 })),
    row(mission({ id: "e", status: "expired" })),
    row(mission({ id: "f", status: "confirmed", accepted_at: "2026-07-10T08:40:00.000Z" })),
  ];

  test("the sum of the rows is the hero total", () => {
    const summed = rows.reduce((s, r) => s + rowCost(r), 0);
    assert.equal(spendTotals(rows).total, summed);
  });

  test("and it holds under every outcome filter", () => {
    for (const filter of ["all", "completed", "unfilled", "cancelled"]) {
      const res = applyHistoryQuery(rows, query({ filter }));
      const summed = res.rows.reduce((s, r) => s + rowCost(r), 0);
      assert.equal(spendTotals(res.rows).total, summed, filter);
    }
  });

  test("the four components add back up to the total", () => {
    const t = spendTotals(rows);
    assert.equal(t.total, t.fares + t.noShow + t.waiting + t.cancelFees);
    assert.equal(t.trips, t.fareCount + t.noShowCount);
  });

  test("what is excluded is excluded from both, not from one", () => {
    const t = spendTotals(rows);
    assert.equal(t.unsettledCount, 1);
    assert.equal(t.unfilledCount, 1);
    assert.equal(rowCost(rows[4]), 0, "unfilled");
    assert.equal(rowCost(rows[5]), 0, "unclosed");
  });
});
