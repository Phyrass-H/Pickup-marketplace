// PDP — the climb, and the freeze at accept.
//
// The single most expensive bug this repo has shipped lived here: `currentFare`
// kept climbing after a Driver took the trip, so a €70 job read €100 a week
// later and a cancellation fee was struck against the wrong basis (S48b). Every
// test below that names `settledFare` exists to keep that closed.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { currentFare, isAtCeiling, settledFare } from "@/lib/pdp";
import { completed, mission } from "@/test/support/factories";

const at = (iso: string) => new Date(iso);

describe("currentFare — the climb", () => {
  // Defaults: €100 ceiling, opens at €50, +€5 every 10 min, in the Pool from 08:00.
  const m = mission();

  test("opens at pdp_start", () => {
    assert.equal(currentFare(m, at("2026-07-10T08:00:00Z")), 50);
  });

  test("climbs in whole steps only — nine minutes buys nothing", () => {
    assert.equal(currentFare(m, at("2026-07-10T08:09:59Z")), 50);
    assert.equal(currentFare(m, at("2026-07-10T08:10:00Z")), 55);
    assert.equal(currentFare(m, at("2026-07-10T08:19:59Z")), 55);
  });

  test("40 minutes in the Pool is four steps", () => {
    assert.equal(currentFare(m, at("2026-07-10T08:40:00Z")), 70);
  });

  test("clamps at the Ceiling and never passes it", () => {
    assert.equal(currentFare(m, at("2026-07-10T09:40:00Z")), 100);
    assert.equal(currentFare(m, at("2026-07-17T09:40:00Z")), 100);
  });

  test("a clock read before the mission existed does not go backwards", () => {
    assert.equal(currentFare(m, at("2026-07-10T07:00:00Z")), 50);
  });

  test("no curve configured → the clamped start, whatever the clock says", () => {
    const flat = mission({ pdp_step: 0, pdp_interval: 0 });
    assert.equal(currentFare(flat, at("2026-07-17T00:00:00Z")), 50);

    const noInterval = mission({ pdp_step: 5, pdp_interval: null });
    assert.equal(currentFare(noInterval, at("2026-07-17T00:00:00Z")), 50);
  });

  test("a start above the Ceiling is still capped by the Ceiling", () => {
    const over = mission({ pdp_start: 130, pdp_step: 0, pdp_interval: 0 });
    assert.equal(currentFare(over, at("2026-07-10T08:00:00Z")), 100);
  });

  test("no pdp_start → half the Ceiling", () => {
    const bare = mission({ pdp_start: null, pdp_step: null, pdp_interval: null, ceiling: 90 });
    assert.equal(currentFare(bare, at("2026-07-10T08:00:00Z")), 45);
  });

  test("SPEED WIN's hotter curve is just different numbers, same maths", () => {
    // 70% of the ceiling, +€5 every 5 min (the O7 re-pool curve).
    const sw = mission({ speed_win: true, pdp_start: 70, pdp_step: 5, pdp_interval: 5 });
    assert.equal(currentFare(sw, at("2026-07-10T08:00:00Z")), 70);
    assert.equal(currentFare(sw, at("2026-07-10T08:15:00Z")), 85);
    assert.equal(currentFare(sw, at("2026-07-10T08:35:00Z")), 100);
  });

  test("the result is rounded to the cent, not left as float dust", () => {
    const dusty = mission({ ceiling: 100, pdp_start: 0.1, pdp_step: 0.2, pdp_interval: 10 });
    // 0.1 + 0.2 is 0.30000000000000004 in IEEE 754.
    assert.equal(currentFare(dusty, at("2026-07-10T08:10:00Z")), 0.3);
  });
});

describe("currentFare — a RE-POOLED mission restarts its climb", () => {
  // O7: a driver cancel / reclaim / agreed release puts the trip back in the Pool
  // and stamps pooled_at. Measuring from created_at would hand the next Driver a
  // fare that had been climbing for hours against a trip they never saw.
  const repooled = mission({
    created_at: "2026-07-10T08:00:00.000Z",
    pooled_at: "2026-07-10T09:00:00.000Z",
  });

  test("climbs from pooled_at, not created_at", () => {
    assert.equal(currentFare(repooled, at("2026-07-10T09:40:00Z")), 70);
  });

  test("without the restart the same instant would already be at the Ceiling", () => {
    const original = mission({ created_at: "2026-07-10T08:00:00.000Z" });
    assert.equal(currentFare(original, at("2026-07-10T09:40:00Z")), 100);
  });
});

describe("settledFare — frozen at accept", () => {
  test("a completed trip does not get more expensive with time", () => {
    // The S48b bug, in one assertion: accepted at €70, and still €70 forever.
    const m = completed();
    assert.equal(settledFare(m), 70);
    assert.equal(currentFare(m, at("2026-07-17T00:00:00Z")), 100);
  });

  test("the freeze is the accept instant, not the pickup or the completion", () => {
    const early = completed({ accepted_at: "2026-07-10T08:00:00.000Z" });
    const late = completed({ accepted_at: "2026-07-10T09:00:00.000Z" });
    assert.equal(settledFare(early), 50);
    assert.equal(settledFare(late), 80);
  });

  test("a re-pooled mission settles on ITS climb, not the original one", () => {
    const m = completed({
      created_at: "2026-07-10T08:00:00.000Z",
      pooled_at: "2026-07-10T09:00:00.000Z",
      accepted_at: "2026-07-10T09:20:00.000Z",
    });
    assert.equal(settledFare(m), 60);
  });

  test("no accepted_at → falls back to the live fare", () => {
    // A row still in the Pool, or a legacy one. Deliberately relative to the real
    // clock, because that is the documented fallback.
    const future = mission({ created_at: new Date(Date.now() + 60_000).toISOString() });
    assert.equal(settledFare({ ...future, accepted_at: null }), 50);

    const ancient = mission({ created_at: "2020-01-01T00:00:00.000Z" });
    assert.equal(settledFare({ ...ancient, accepted_at: null }), 100);
  });
});

describe("isAtCeiling", () => {
  const m = mission();

  test("false mid-climb, true once the curve tops out", () => {
    assert.equal(isAtCeiling(m, at("2026-07-10T08:40:00Z")), false);
    assert.equal(isAtCeiling(m, at("2026-07-10T09:40:00Z")), true);
  });

  test("a flat mission already at its Ceiling reads true immediately", () => {
    const flat = mission({ pdp_start: 100, pdp_step: 0, pdp_interval: 0 });
    assert.equal(isAtCeiling(flat, at("2026-07-10T08:00:00Z")), true);
  });
});
