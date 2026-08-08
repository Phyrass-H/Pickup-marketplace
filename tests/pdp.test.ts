// lib/pdp.ts — the fare itself. Everything downstream is arithmetic on top of
// this, so a defect here is wrong money on every screen at once.
import { describe, expect, it } from "vitest";
import { currentFare, isAtCeiling, settledFare } from "@/lib/pdp";
import { mission, speedWinCurve, standardCurve } from "./fixtures";

const at = (iso: string) => new Date(iso);

describe("currentFare — the climb", () => {
  it("starts at pdp_start and climbs one step per interval", () => {
    const m = mission({ ...standardCurve(), created_at: "2026-07-15T10:00:00+02:00" });
    expect(currentFare(m, at("2026-07-15T10:00:00+02:00"))).toBe(50);
    expect(currentFare(m, at("2026-07-15T10:09:59+02:00"))).toBe(50);
    expect(currentFare(m, at("2026-07-15T10:10:00+02:00"))).toBe(55);
    expect(currentFare(m, at("2026-07-15T10:25:00+02:00"))).toBe(60);
  });

  it("climbs in whole steps only — no interpolation between them", () => {
    const m = mission({ ...standardCurve(), created_at: "2026-07-15T10:00:00+02:00" });
    // 15 min in is one and a half steps; the fare is one step, not 57,50.
    expect(currentFare(m, at("2026-07-15T10:15:00+02:00"))).toBe(55);
  });

  it("clamps at the Ceiling and never exceeds it", () => {
    const m = mission({ ...standardCurve(), created_at: "2026-07-15T10:00:00+02:00" });
    // 50 + 10 steps × 5 = 100 exactly at T+100 min, then flat forever.
    expect(currentFare(m, at("2026-07-15T11:40:00+02:00"))).toBe(100);
    expect(currentFare(m, at("2026-07-15T23:00:00+02:00"))).toBe(100);
    expect(currentFare(m, at("2027-07-15T10:00:00+02:00"))).toBe(100);
  });

  it("never goes backwards when the clock does (created_at in the future)", () => {
    // Clock skew between the DB and the reader must not produce a negative step
    // count and a fare below the start price.
    const m = mission({ ...standardCurve(), created_at: "2026-07-15T10:00:00+02:00" });
    expect(currentFare(m, at("2026-07-15T09:00:00+02:00"))).toBe(50);
  });

  it("is deterministic — same inputs, same now, same number", () => {
    const m = mission({ ...standardCurve() });
    const when = at("2026-07-15T10:33:00+02:00");
    expect(currentFare(m, when)).toBe(currentFare(m, when));
  });
});

describe("currentFare — a curve that isn't configured", () => {
  it("falls back to half the Ceiling when pdp_start is null", () => {
    const m = mission({ ceiling: 90, pdp_start: null, pdp_step: null, pdp_interval: null });
    expect(currentFare(m, at("2026-07-15T18:00:00+02:00"))).toBe(45);
  });

  it("holds the start price flat when there is no step or no interval", () => {
    const noStep = mission({ ceiling: 100, pdp_start: 60, pdp_step: 0, pdp_interval: 10 });
    const noInterval = mission({ ceiling: 100, pdp_start: 60, pdp_step: 5, pdp_interval: 0 });
    const late = at("2026-07-16T10:00:00+02:00");
    expect(currentFare(noStep, late)).toBe(60);
    expect(currentFare(noInterval, late)).toBe(60);
  });

  it("clamps even the flat start price to the Ceiling", () => {
    // A malformed row (start above the Business's maximum) must never bill above
    // what the Business authorised.
    const m = mission({ ceiling: 40, pdp_start: 60, pdp_step: 0, pdp_interval: 0 });
    expect(currentFare(m, at("2026-07-15T10:00:00+02:00"))).toBe(40);
  });
});

describe("currentFare — SPEED WIN vs the standard curve", () => {
  it("starts hotter and climbs faster", () => {
    const created = "2026-07-15T10:00:00+02:00";
    const normal = mission({ ...standardCurve(), created_at: created });
    const hot = mission({ ...speedWinCurve(), created_at: created });

    expect(currentFare(hot, at(created))).toBe(70);
    expect(currentFare(normal, at(created))).toBe(50);

    // 10 minutes in: the standard curve has taken one step, SPEED WIN two.
    expect(currentFare(normal, at("2026-07-15T10:10:00+02:00"))).toBe(55);
    expect(currentFare(hot, at("2026-07-15T10:10:00+02:00"))).toBe(80);
  });

  it("reaches the Ceiling sooner", () => {
    const hot = mission({ ...speedWinCurve(), created_at: "2026-07-15T10:00:00+02:00" });
    expect(isAtCeiling(hot, at("2026-07-15T10:29:00+02:00"))).toBe(false);
    expect(isAtCeiling(hot, at("2026-07-15T10:30:00+02:00"))).toBe(true);
  });
});

describe("currentFare — a RE-POOLED mission (O7)", () => {
  it("measures the climb from pooled_at, not created_at", () => {
    // Posted at 08:00, cancelled and re-pooled at 10:00. At 10:10 the climb is
    // one step old, not thirteen — otherwise a re-pooled trip would land in the
    // Pool already at its Ceiling and the whole point of re-pooling is lost.
    const m = mission({
      ...standardCurve(),
      created_at: "2026-07-15T08:00:00+02:00",
      pooled_at: "2026-07-15T10:00:00+02:00",
    });
    expect(currentFare(m, at("2026-07-15T10:10:00+02:00"))).toBe(55);
  });

  it("ignores created_at entirely once pooled_at is set", () => {
    const m = mission({
      ...standardCurve(),
      created_at: "2026-07-01T08:00:00+02:00",
      pooled_at: "2026-07-15T10:00:00+02:00",
    });
    expect(currentFare(m, at("2026-07-15T10:00:00+02:00"))).toBe(50);
  });
});

describe("settledFare — the climb FROZEN at accept (the S48b money bug)", () => {
  it("is the price the Driver accepted, however long ago that was", () => {
    // The bug: a trip accepted at 60 read 100 (the Ceiling) a week later,
    // because currentFare kept climbing to `now`. It charged a Business, paid a
    // Driver and set a cancellation basis 40 too high.
    const m = mission({
      ...standardCurve(),
      status: "completed",
      created_at: "2026-07-15T10:00:00+02:00",
      accepted_at: "2026-07-15T10:20:00+02:00",
    });
    expect(settledFare(m)).toBe(60);
    // Same row, read at any point in the future: still 60.
    expect(settledFare(m)).toBe(60);
    expect(currentFare(m, at("2026-07-22T10:00:00+02:00"))).toBe(100);
  });

  it("freezes a SPEED WIN trip at its accept price too", () => {
    const m = mission({
      ...speedWinCurve(),
      status: "completed",
      created_at: "2026-07-15T10:00:00+02:00",
      accepted_at: "2026-07-15T10:05:00+02:00",
    });
    expect(settledFare(m)).toBe(75);
  });

  it("freezes at accept measured from pooled_at on a re-pooled trip", () => {
    const m = mission({
      ...standardCurve(),
      status: "completed",
      created_at: "2026-07-15T08:00:00+02:00",
      pooled_at: "2026-07-15T10:00:00+02:00",
      accepted_at: "2026-07-15T10:20:00+02:00",
    });
    expect(settledFare(m)).toBe(60);
  });

  it("falls back to the live fare while a mission is still in the Pool", () => {
    // No accepted_at: nothing has been agreed, so the live climb IS the answer.
    const m = mission({ ...standardCurve(), accepted_at: null });
    expect(settledFare(m)).toBe(currentFare(m));
  });

  it("is never above the Ceiling even if accept is stamped long after posting", () => {
    const m = mission({
      ...standardCurve(),
      accepted_at: "2026-07-20T10:00:00+02:00",
      created_at: "2026-07-15T10:00:00+02:00",
    });
    expect(settledFare(m)).toBe(100);
  });
});

describe("rounding", () => {
  it("returns clean cents rather than binary-float dust", () => {
    // 0.1 + 0.2 arithmetic reaches this function through pdp_step; a fare of
    // 60.000000000000004 would print, sum and compare wrong.
    const m = mission({
      ceiling: 100,
      pdp_start: 0.1,
      pdp_step: 0.2,
      pdp_interval: 10,
      created_at: "2026-07-15T10:00:00+02:00",
    });
    expect(currentFare(m, at("2026-07-15T10:10:00+02:00"))).toBe(0.3);
  });

  it("rounds a half-cent up, consistently", () => {
    const m = mission({
      ceiling: 100,
      pdp_start: 10.005,
      pdp_step: 0,
      pdp_interval: 0,
    });
    expect(currentFare(m, at("2026-07-15T10:00:00+02:00"))).toBe(10.01);
  });
});

describe("isAtCeiling", () => {
  it("is false below the Ceiling and true once the climb tops out", () => {
    const m = mission({ ...standardCurve(), created_at: "2026-07-15T10:00:00+02:00" });
    expect(isAtCeiling(m, at("2026-07-15T11:30:00+02:00"))).toBe(false);
    expect(isAtCeiling(m, at("2026-07-15T11:40:00+02:00"))).toBe(true);
  });

  it("is true immediately for a mission posted with no climb configured", () => {
    // A ceiling-priced mission with no curve is already at its maximum.
    const m = mission({ ceiling: 80, pdp_start: 80, pdp_step: 0, pdp_interval: 0 });
    expect(isAtCeiling(m, at("2026-07-15T10:00:00+02:00"))).toBe(true);
  });
});
