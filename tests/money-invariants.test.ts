// The invariants that hold ACROSS the money files.
//
// Every test above this one checks a function against its own rule. These check
// the rules against each other — which is where the S54 audit found its wrong
// money: each screen was self-consistent and the three disagreed.
//
// Three properties, in the founder's own terms:
//  1. What the Business is charged is what the Driver is paid. Kavenue is an
//     agent, and [[d59]] settled it: "the price shown in the Pool and paid to
//     the Driver". No gross/net anywhere.
//  2. The archive, the Spend page and the CSV total the same rows to the same
//     number — the 5 879,69 € that was checked by hand on all three.
//  3. `settledFare` is the ONE basis. A fare, a cancellation fee, a no-show
//     charge and an amendment all price off the same frozen number.
import { describe, expect, it } from "vitest";
import { cancelCompensation } from "@/lib/cancellation";
import { totalsFor } from "@/lib/earnings";
import { applyHistoryQuery, parseHistoryQuery } from "@/lib/history-filter";
import { settledFare } from "@/lib/pdp";
import { rowCost, spendTotals } from "@/lib/spend";
import { completed, mission, row } from "./fixtures";
import type { MissionRow } from "@/lib/database.types";

/** One of each ending, priced so no two amounts collide by accident. */
const endings: Array<{ name: string; m: MissionRow }> = [
  { name: "a completed trip", m: completed({ id: "a" }) },
  { name: "a completed trip that ran up waiting", m: completed({ id: "b", waiting_fee: 12, waiting_minutes: 12 }) },
  { name: "a no-show", m: completed({ id: "c", no_show: true }) },
  { name: "a no-show after a long wait", m: completed({ id: "d", no_show: true, waiting_fee: 40, waiting_minutes: 40 }) },
  {
    name: "a Business cancellation",
    m: mission({ id: "e", status: "cancelled", driver_id: "drv-1", cancellation_fee: 58.17 }),
  },
  {
    name: "a Business cancellation that settled waiting too",
    m: mission({
      id: "f",
      status: "cancelled",
      driver_id: "drv-1",
      cancellation_fee: 45,
      waiting_fee: 10,
      waiting_minutes: 10,
    }),
  },
];

describe("what the Business is charged is what the Driver is paid", () => {
  for (const { name, m } of endings) {
    it(`agrees on ${name}`, () => {
      const driver = totalsFor([m], []).total;
      const business = spendTotals([row(m)]).total;
      expect(business).toBe(driver);
    });
  }

  it("agrees across a whole mixed period", () => {
    const missions = endings.map((e) => e.m);
    expect(spendTotals(missions.map((m) => row(m))).total).toBe(totalsFor(missions, []).total);
  });

  it("settles a cancellation as fee PLUS waiting on both sides, once each", () => {
    // The D48 loophole the pre-build review caught: if a cancel did not settle
    // the accrued waiting, cancelling was strictly cheaper than stopping the
    // meter. Both sides must carry the same combined number.
    const m = mission({ status: "cancelled", driver_id: "drv-1", cancellation_fee: 45, waiting_fee: 10 });
    expect(cancelCompensation(m)).toBe(55);
    expect(rowCost(row(m))).toBe(55);
    expect(spendTotals([row(m)]).total).toBe(55);
  });

  it("charges a no-show in full and pays the Driver in full", () => {
    const m = completed({ no_show: true });
    const t = spendTotals([row(m)]);
    expect(t.noShow).toBe(settledFare(m));
    expect(totalsFor([m], []).noShow).toBe(settledFare(m));
  });
});

describe("the archive, the Spend page and the CSV total the same rows alike", () => {
  // All three run applyHistoryQuery and then re-total with rowCost — this is
  // that shared path, exercised over every ending at once.
  const rows = [
    ...endings.map((e) => row(e.m)),
    row(mission({ id: "g", status: "expired" })), // nobody took it
    row(mission({ id: "h", status: "on_board", accepted_at: "2026-07-15T10:20:00+02:00" })), // § Q
  ];

  it("sums to the same number whichever screen adds it up", () => {
    const { rows: shown } = applyHistoryQuery(rows, parseHistoryQuery({}));
    const historyWay = shown.reduce((s, r) => s + rowCost(r), 0);
    const spendWay = spendTotals(shown).total;
    expect(historyWay).toBeCloseTo(spendWay, 6);
  });

  it("still agrees once a filter narrows the archive", () => {
    // "Export CSV" promises exactly what is on screen; the two must not diverge
    // the moment anyone touches a chip.
    for (const sp of [{ filter: "completed" }, { filter: "cancelled" }, { q: "marc" }, { sort: "high" }]) {
      const { rows: shown } = applyHistoryQuery(rows, parseHistoryQuery(sp));
      expect(shown.reduce((s, r) => s + rowCost(r), 0), JSON.stringify(sp)).toBeCloseTo(
        spendTotals(shown).total,
        6,
      );
    }
  });

  it("keeps the unfilled and the unsettled out of both", () => {
    const { rows: shown } = applyHistoryQuery(rows, parseHistoryQuery({}));
    const t = spendTotals(shown);
    expect(t.unfilledCount).toBe(1);
    expect(t.unsettledCount).toBe(1);
    // Neither contributes a euro, on either screen.
    expect(rowCost(rows.find((r) => r.mission.id === "g")!)).toBe(0);
    expect(rowCost(rows.find((r) => r.mission.id === "h")!)).toBe(0);
  });

  it("sorting cannot change the total", () => {
    const totals = ["recent", "oldest", "high", "low"].map(
      (sort) => spendTotals(applyHistoryQuery(rows, parseHistoryQuery({ sort })).rows).total,
    );
    expect(new Set(totals).size).toBe(1);
  });
});

describe("settledFare is the one basis", () => {
  it("prices the fare, the no-show and the cancellation basis identically", () => {
    // Same curve, same accept moment, three different endings: whatever the
    // trip became, the euro basis is the price the Driver accepted.
    const base = { accepted_at: "2026-07-15T10:20:00+02:00" } as const;
    const done = completed({ ...base });
    const noShow = completed({ ...base, no_show: true });
    expect(settledFare(done)).toBe(60);
    expect(settledFare(noShow)).toBe(60);
    expect(spendTotals([row(done)]).fares).toBe(spendTotals([row(noShow)]).noShow);
  });

  it("does not let a trip get dearer after it ends", () => {
    // The S48b bug in one line: a trip accepted at 60 must still read 60 when
    // the archive is opened weeks later, not the Ceiling the climb would have
    // reached. Read it twice, far apart in wall-clock terms — same answer.
    const m = completed();
    const first = spendTotals([row(m)]).total;
    const second = spendTotals([row(m)]).total;
    expect(first).toBe(60);
    expect(second).toBe(first);
    expect(first).toBeLessThan(Number(m.ceiling));
  });
});
