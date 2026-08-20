// Pins lib/waypoints.ts — specifically `unlocatedStops`, the rule both mission
// forms now enforce.
//
// The defect (2026-08-20): a stop TYPED but never picked from the address
// suggestions carries no coordinates, and every routing path filters it out —
// the live ETA, /api/eta, and the distance both server actions send to the rate
// card. So the stop added nothing to the route and nothing to the fare, while
// still being stored, drawn on the Driver's route rail, counted in their stop
// progress and needing a "Reached" tap. Reproduced on the amend screen: the
// change summary read "Add a stop at Place du Casino" while the route stayed
// 15 km and the fare did not move. The Driver drove an unpaid detour.
import { describe, expect, it } from "vitest";
import { parseWaypointsField, unlocatedStops } from "@/lib/waypoints";

describe("unlocatedStops — the stop that would have been free", () => {
  it("catches a stop with no coordinates at all", () => {
    const stops = [{ address: "Place du Casino", lat: null, lng: null }];
    expect(unlocatedStops(stops).map((s) => s.address)).toEqual(["Place du Casino"]);
  });

  it("passes a stop that was picked from the suggestions", () => {
    const stops = [{ address: "Nice Airport", lat: 43.6584, lng: 7.2159 }];
    expect(unlocatedStops(stops)).toEqual([]);
  });

  it("catches a half-located stop", () => {
    expect(unlocatedStops([{ address: "Somewhere", lat: 43.7, lng: null }])).toHaveLength(1);
    expect(unlocatedStops([{ address: "Somewhere", lat: null, lng: 7.2 }])).toHaveLength(1);
  });

  it("does not let an empty coordinate arrive as a finite 0", () => {
    // Number("") is 0 — a "finite" coordinate that would sail through a null
    // check and yield a route through the Gulf of Guinea. The defence is in the
    // shared parser: it coerces "" to null BEFORE this function sees it, which
    // is the same reason the pickup and drop-off use `toNum` over `Number`.
    // ⚑ A literal 0,0 that survives that is treated as located, exactly as the
    // two ends treat it — one rule, not two.
    expect(unlocatedStops(parseWaypointsField(JSON.stringify([{ address: "X", lat: "", lng: "" }])))).toHaveLength(1);
  });

  it("rejects an out-of-range coordinate", () => {
    expect(unlocatedStops([{ address: "Bad", lat: 95, lng: 7.2 }])).toHaveLength(1);
    expect(unlocatedStops([{ address: "Bad", lat: 43.7, lng: 200 }])).toHaveLength(1);
  });

  it("names every loose stop, not just the first — the form counts them", () => {
    const stops = [
      { address: "Located", lat: 43.7, lng: 7.2 },
      { address: "Typed only", lat: null, lng: null },
      { address: "Also typed only", lat: null, lng: null },
    ];
    expect(unlocatedStops(stops)).toHaveLength(2);
  });

  it("holds against the field the form actually posts", () => {
    // End to end through the shared parser, so the check and the write can never
    // disagree about what a stop is.
    const field = JSON.stringify([
      { address: "Monaco", lat: 43.7384, lng: 7.4246 },
      { address: "Place du Casino", lat: null, lng: null },
    ]);
    expect(unlocatedStops(parseWaypointsField(field)).map((s) => s.address)).toEqual([
      "Place du Casino",
    ]);
  });

  it("treats a legacy newline-separated draft as entirely unlocated", () => {
    // Old drafts stored a plain address list with no coords. Refusing them at
    // POST is correct — they were never on the route either.
    expect(unlocatedStops(parseWaypointsField("Cannes\nAntibes"))).toHaveLength(2);
  });

  it("says nothing about a trip with no stops", () => {
    expect(unlocatedStops(parseWaypointsField(""))).toEqual([]);
    expect(unlocatedStops([])).toEqual([]);
  });
});
