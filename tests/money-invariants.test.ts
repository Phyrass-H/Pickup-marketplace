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
//     (Exception, 2026-08-11: the two cancel RPCs also CLAMP the basis they are
//     handed into [pdp_start, ceiling] — see the last describe block. On an
//     honest call that is a no-op; on a forged or omitted one the recorded basis
//     is the band floor, not settledFare.)
import { describe, expect, it } from "vitest";
import { cancelCompensation, cancelFeeAmount, waitingBetween } from "@/lib/cancellation";
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

  it("quotes a cancel-while-waiting as the fee PLUS the meter — the number the row settles", () => {
    // The live 2026-08-09 case: the modal showed 47,99 € and the RPC charged 64,99 €,
    // because the quote was the percentage alone while business_cancel_mission also
    // settles the meter. The modal is JSX and not in this suite, so what is pinned here
    // is the arithmetic behind it — the same two functions the modal now adds together.
    const fee = cancelFeeAmount(50.52, 95); // 47,99 €
    // At the flat 1,00 €/min that was in force on the day — this pins a real incident,
    // so it keeps its own rate rather than moving with the S62 per-class table.
    const wait = waitingBetween(0, 3_600_000, 17 * 60_000, 1); // 17 min → 17,00 €
    expect(fee).toBe(47.99);
    expect(wait.fee).toBe(17);

    const settled = mission({
      status: "cancelled",
      driver_id: "drv-1",
      cancellation_fee: fee,
      waiting_fee: wait.fee,
    });

    // ⚑ Asserted in CENTS, not against a float sum. In float64 47.99 + 17 is
    // 64.99000000000001, and until commission shipped every screen carried the
    // same tail because every screen performed the same addition. `rowCost` now
    // goes through the commission split, which is integer arithmetic end to end
    // (it has to be — Postgres rounds exact decimals and JavaScript cannot), so
    // it returns a clean 64.99 while `cancelCompensation` still carries the
    // tail. Same money; one of them has stopped lying about its precision.
    // Consistency is what this file protects, and cents are the unit money has.
    const cents = (n: number) => Math.round(n * 100);
    const modalTotal = fee + wait.fee; // exactly what the cancel modal adds up
    expect(cents(rowCost(row(settled)))).toBe(cents(modalTotal)); // the Business's archive
    expect(cents(cancelCompensation(settled)!)).toBe(cents(modalTotal)); // what the Driver is paid
    expect(cents(modalTotal)).toBe(6499); // 64,99 € to the cent
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
    const base = { accepted_at: "2026-07-15T10:00:00+02:00" } as const;
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

// ---------------------------------------------------------------------------
// 4. THE FEE BASIS NEVER LEAVES THE BAND THE SQL CLAMP ASSERTS.
//
// The cancel RPCs cannot recompute a fare — lib/pdp.ts is the only place the PDP
// exists — so docs/migrations/2026-08-11_fee_basis_band.sql asserts a BAND read
// off the mission's own columns instead:
//     floor = least(pdp_start ?? ceiling * 0.5, ceiling)
//     basis = round(least(greatest(supplied ?? 0, floor), ceiling), 2)
// That is only honest if settledFare() can never land outside it. If this ever
// goes red, the SQL has stopped catching forged money and started rewriting
// correct money — which is much worse than the hole it was built to close.
// ---------------------------------------------------------------------------
describe("the fee basis never leaves the band the SQL clamp asserts", () => {
  const bandFloor = (m: MissionRow) =>
    Math.min(m.pdp_start != null ? Number(m.pdp_start) : Number(m.ceiling) * 0.5, Number(m.ceiling));

  /** The SQL clamp, transcribed. `supplied === null` models an OMITTED p_fare_snapshot. */
  const sqlBasis = (m: MissionRow, supplied: number | null) =>
    Math.round(Math.min(Math.max(supplied ?? 0, bandFloor(m)), Number(m.ceiling)) * 100) / 100;

  const curves: Array<{ name: string; m: MissionRow }> = [
    { name: "a standard curve", m: completed({ ceiling: 100, pdp_start: 50, pdp_step: 5, pdp_interval: 10 }) },
    { name: "SPEED WIN", m: completed({ ceiling: 100, pdp_start: 70, pdp_step: 5, pdp_interval: 5, speed_win: true }) },
    { name: "an amendment-collapsed curve", m: completed({ ceiling: 175, pdp_start: 175, pdp_step: 0, pdp_interval: 0 }) },
    { name: "a null pdp_start", m: completed({ ceiling: 200, pdp_start: null }) },
    { name: "a trip already at its Ceiling", m: completed({ ceiling: 80, pdp_start: 80, pdp_step: 5, pdp_interval: 10 }) },
  ];

  for (const { name, m } of curves) {
    it(`${name}: settledFare sits inside [floor, ceiling]`, () => {
      const fare = settledFare(m);
      expect(fare).toBeGreaterThanOrEqual(bandFloor(m));
      expect(fare).toBeLessThanOrEqual(Number(m.ceiling));
    });

    it(`${name}: the clamp is the identity on an honest call`, () => {
      const fare = settledFare(m);
      expect(sqlBasis(m, fare)).toBe(fare);
    });

    it(`${name}: an OMITTED basis records the floor, never 0`, () => {
      expect(sqlBasis(m, null)).toBe(Math.round(bandFloor(m) * 100) / 100);
      expect(sqlBasis(m, null)).toBeGreaterThan(0);
    });

    it(`${name}: an inflated basis is capped at the Ceiling`, () => {
      expect(sqlBasis(m, 99_999)).toBe(Number(m.ceiling));
    });
  }

  // The residual, written down so nobody reads the clamp as a fence. A forger can
  // still understate all the way to the floor — 50% off on a standard curve.
  it("is a floor, not a fence: understating to pdp_start still succeeds", () => {
    const m = completed({ ceiling: 100, pdp_start: 50, pdp_step: 5, pdp_interval: 10 });
    expect(sqlBasis(m, 50)).toBe(50);
    expect(sqlBasis(m, 1)).toBe(50); // below the floor is lifted, not rejected
  });
});
