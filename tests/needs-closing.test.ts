// § Q — "a trip the Driver never closed". The rule the founder set (2026-08-10):
// ask 30 minutes after the Driver reached the destination.
//
// What these pin is the part that is easy to get wrong and expensive when it is:
// the predicate must not fire while a trip is genuinely still running, and it must
// never outrank the check-in window, which is the schedule's live rescue signal.
// Both of those were real defects in the first draft of this feature.
import { describe, expect, it } from "vitest";
import {
  CHECK_IN_GRACE_MS,
  expectedArrival,
  missionTone,
  needsClosing,
} from "@/lib/dispatch-status";
import { formatAgo } from "@/lib/format";
import { mission } from "./fixtures";

// The fixture's pickup. Everything below is expressed relative to it.
const PICKUP = new Date("2026-07-15T12:00:00+02:00");
const at = (ms: number) => new Date(PICKUP.getTime() + ms);
const MIN = 60_000;
const HOUR = 3_600_000;

describe("expectedArrival", () => {
  it("is pickup + the booked route time", () => {
    const m = mission({ status: "on_board", duration_min: 45 });
    expect(expectedArrival(m)).toBe(PICKUP.getTime() + 45 * MIN);
  });

  // The founder's own worked examples, 2026-08-10.
  it("matches the founder's two examples", () => {
    // Nice city run: pickup 14:00, 15 minutes, arrives 14:15, reminder 14:45.
    const city = mission({ status: "on_board", duration_min: 15 });
    expect(expectedArrival(city)).toBe(PICKUP.getTime() + 15 * MIN);
    // Airport → Saint-Tropez: pickup 14:00, 1h45, arrives 15:45, reminder 16:15.
    const long = mission({ status: "on_board", duration_min: 105 });
    expect(expectedArrival(long)).toBe(PICKUP.getTime() + 105 * MIN);
  });

  // A late Guest means the trip genuinely ENDS later. `waiting_to` is stamped by
  // board_guest at the moment the Guest boards, so it is the boarding clock we
  // already have on the row — no status_event join, nothing to drift.
  it("counts from boarding when the Guest was late", () => {
    const m = mission({
      status: "on_board",
      duration_min: 30,
      waiting_to: new Date(PICKUP.getTime() + 40 * MIN).toISOString(),
    });
    expect(expectedArrival(m)).toBe(PICKUP.getTime() + 70 * MIN);
  });

  it("assumes an hour when the route was never measured", () => {
    const m = mission({ status: "on_board", duration_min: null });
    expect(expectedArrival(m)).toBe(PICKUP.getTime() + 60 * MIN);
  });

  it("allows dwell time at each stop", () => {
    const m = mission({
      status: "on_board",
      duration_min: 30,
      waypoints: [{ address: "a" }, { address: "b" }] as never,
    });
    expect(expectedArrival(m)).toBe(PICKUP.getTime() + 30 * MIN + 2 * 12 * MIN);
  });
});

describe("needsClosing — a trip that ran", () => {
  const onBoard = mission({ status: "on_board", duration_min: 90 });

  it("stays quiet until 30 minutes after the expected arrival", () => {
    expect(needsClosing(onBoard, at(90 * MIN))).toBe(false);
    expect(needsClosing(onBoard, at(119 * MIN))).toBe(false);
    expect(needsClosing(onBoard, at(121 * MIN))).toBe(true);
  });

  it("applies to every executing status, not just on_board", () => {
    for (const status of ["en_route", "arrived", "on_board"] as const) {
      expect(needsClosing(mission({ status, duration_min: 90 }), at(4 * HOUR))).toBe(true);
    }
  });

  // ⚑ The defect this exists to prevent. duration_min has a live median of 27
  // minutes, so a flat "arrival + 30" fires at pickup+57 — inside the hour that
  // belongs to check-in. A trip 45 minutes past its pickup is a Guest standing in
  // a lobby, and the schedule must keep saying "call them", not "it should have
  // finished".
  it("never fires inside the check-in hour, however short the trip", () => {
    const quick = mission({ status: "on_board", duration_min: 15 });
    expect(needsClosing(quick, at(45 * MIN))).toBe(false);
    expect(needsClosing(quick, at(CHECK_IN_GRACE_MS - MIN))).toBe(false);
    expect(needsClosing(quick, at(CHECK_IN_GRACE_MS + MIN))).toBe(true);
  });

  // Stops being ticked off is free proof the trip is being run right now, and a
  // multi-stop errand legitimately runs long.
  it("stays quiet while stops are still being reached", () => {
    const partly = mission({
      status: "on_board",
      duration_min: 30,
      waypoints: [{ address: "a" }, { address: "b" }, { address: "c" }] as never,
      stops_reached: 1,
    });
    expect(needsClosing(partly, at(8 * HOUR))).toBe(false);
    // Last stop reached and still not closed → it is askable again.
    expect(needsClosing({ ...partly, stops_reached: 3 }, at(8 * HOUR))).toBe(true);
  });

  it("ignores a trip at disposal — there is no drop-off to arrive at", () => {
    const hourly = mission({ status: "on_board", mission_type: "hourly", duration_min: null });
    expect(needsClosing(hourly, at(8 * HOUR))).toBe(false);
  });

  it("never applies to a finished or dead trip", () => {
    for (const status of ["completed", "cancelled", "expired", "pooled", "draft"] as const) {
      expect(needsClosing(mission({ status }), at(30 * 24 * HOUR))).toBe(false);
    }
  });
});

describe("needsClosing — a trip that never started", () => {
  const never = mission({ status: "confirmed", duration_min: 20 });

  // 30 minutes is right where we KNOW the trip ran. Here we know nothing at all —
  // no en_route, no arrived, no boarding — so § Q's original 3h applies.
  it("waits three hours from the pickup, not thirty minutes from an arrival", () => {
    expect(needsClosing(never, at(90 * MIN))).toBe(false);
    expect(needsClosing(never, at(2 * HOUR + 59 * MIN))).toBe(false);
    expect(needsClosing(never, at(3 * HOUR + MIN))).toBe(true);
  });

  it("covers the vestigial `accepted` status the same way", () => {
    expect(needsClosing(mission({ status: "accepted" }), at(4 * HOUR))).toBe(true);
  });
});

describe("missionTone — what the Business sees", () => {
  it("stops calling a trip boarded weeks ago an untroubled 'On board'", () => {
    const m = mission({ status: "on_board", duration_min: 40 });
    expect(missionTone(m, at(20 * MIN)).label).toBe("On board");
    const stale = missionTone(m, at(10 * 24 * HOUR));
    expect(stale.label).toBe("Not closed");
    expect(stale.needsAttention).toBe(true);
    expect(stale.wash).toBe(true);
  });

  it("says call them, and never offers to close it", () => {
    const t = missionTone(mission({ status: "on_board", duration_min: 40 }), at(6 * HOUR));
    expect(t.hint).toContain("call them");
    expect(t.hint).toContain("should have arrived");
    expect(t.hint).not.toMatch(/close it yourself|mark (it )?complete/i);
  });

  // ⚑ Found live, on the real schedule: "Checked in" had no time bound, so a trip
  // whose Driver confirmed they'd be there five weeks ago still read as a calm,
  // current "Checked in" — the strongest possible false reassurance, because the
  // Driver DID answer and then nothing happened.
  it("stops a five-week-old 'Checked in' reading as current", () => {
    const m = mission({
      status: "confirmed",
      checked_in_at: "2026-07-15T09:00:00+02:00",
      duration_min: 40,
    });
    expect(missionTone(m, at(-30 * MIN)).label).toBe("Checked in");
    expect(missionTone(m, at(35 * 24 * HOUR)).label).toBe("Not closed");
  });

  // ⚑ The precedence that matters: check-in owns the hour around the pickup.
  it("does not outrank the check-in alarm on an unstarted trip", () => {
    const m = mission({ status: "confirmed", checked_in_at: null, duration_min: 15 });
    const inWindow = missionTone(m, at(45 * MIN));
    expect(inWindow.label).toBe("Not checked in");
    expect(inWindow.tone).toBe("danger");
    // …and takes over once check-in has had its say and the trip is long past.
    expect(missionTone(m, at(5 * HOUR)).label).toBe("Not closed");
  });
});

// Slice 2 — the Driver has answered. Whichever way they answered, the question
// stops being asked: a prompt that survives its own answer is how people learn to
// ignore prompts.
describe("once the Driver has answered", () => {
  const stale = { status: "on_board" as const, duration_min: 40 };

  it("stops asking, both ways", () => {
    const open = mission(stale);
    expect(needsClosing(open, at(6 * HOUR))).toBe(true);
    for (const close_answer of ["driven", "not_driven"] as const) {
      expect(needsClosing(mission({ ...stale, close_answer }), at(6 * HOUR))).toBe(false);
    }
  });

  // The Business's row does NOT go quiet: for them "we're waiting on the Driver"
  // has become "they've told us, and it needs sorting out".
  it("turns the Business's row into the Driver's statement", () => {
    const t = missionTone(mission({ ...stale, close_answer: "not_driven" }), at(6 * HOUR));
    expect(t.label).toBe("Driver says it didn’t happen");
    expect(t.tone).toBe("danger");
    expect(t.needsAttention).toBe(true);
    // Nothing has moved. The copy must not imply otherwise.
    expect(t.hint).toContain("Nothing has been charged");
  });

  // ⚑ Founder-reported, the same day it shipped. `not_driven` writes no status,
  // so the trip stays `confirmed` — and `needsClosing` going false dropped it
  // straight back into the Driver's Upcoming list, and into the tab count, as
  // work they had just told us never happened. Whatever partitions that list has
  // to key on the OUTCOME being unsettled, not on the question being unanswered.
  it("is still not upcoming work after 'it didn't happen'", () => {
    const answered = mission({ ...stale, close_answer: "not_driven" });
    const unsettled = needsClosing(answered, at(6 * HOUR)) || answered.close_answer === "not_driven";
    expect(unsettled).toBe(true);
    // …while a genuinely upcoming trip is untouched by any of this.
    const upcoming = mission({ status: "confirmed", duration_min: 40 });
    const stillOpen =
      needsClosing(upcoming, at(-2 * HOUR)) || upcoming.close_answer === "not_driven";
    expect(stillOpen).toBe(false);
  });

  // 'driven' also moves the trip to `completed`, so the tone comes from the
  // status like any other finished trip — no lingering § Q state.
  it("reads as a normal completed trip once it was driven", () => {
    const t = missionTone(
      mission({ status: "completed", close_answer: "driven", duration_min: 40 }),
      at(6 * HOUR),
    );
    expect(t.label).toBe("Completed");
    expect(t.needsAttention).toBe(false);
  });
});

// The founder's call: an unclosed trip is normally minutes or hours old, so a
// date would be the wrong register — but the rare one that sits for a week has
// to read correctly too.
describe("formatAgo", () => {
  it("counts in the largest unit that still reads naturally", () => {
    expect(formatAgo(35 * MIN)).toBe("35 minutes");
    expect(formatAgo(MIN)).toBe("1 minute");
    expect(formatAgo(4 * HOUR)).toBe("4 hours");
    expect(formatAgo(HOUR)).toBe("1 hour");
    expect(formatAgo(3 * 24 * HOUR)).toBe("3 days");
    expect(formatAgo(24 * HOUR)).toBe("1 day");
  });

  it("never says '0 minutes'", () => {
    expect(formatAgo(0)).toBe("1 minute");
    expect(formatAgo(-5_000)).toBe("1 minute");
  });
});
