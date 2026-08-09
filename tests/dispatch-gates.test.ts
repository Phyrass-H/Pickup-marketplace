// The two gates the S56 drift audit found written by hand in several places and
// already drifted apart: "can the Business still edit this trip's info?" and
// "can a pending amendment / release still be answered?".
//
// Both mirror a rule that also lives in SQL, so what these pin is the TypeScript
// half — that the predicate says what the RPC and the § P expiry boundary say,
// and that neither silently widens back out.
import { describe, expect, it } from "vitest";
import { canEditInfo, negotiationAnswerable } from "@/lib/dispatch-status";
import { mission } from "./fixtures";

// Pickup is 2026-07-15T12:00+02:00 in the fixture.
const BEFORE = new Date("2026-07-15T09:00:00+02:00");
const AFTER = new Date("2026-07-15T12:30:00+02:00");

describe("canEditInfo", () => {
  it("allows the three pre-departure statuses while the pickup is ahead", () => {
    for (const status of ["pooled", "accepted", "confirmed"] as const) {
      expect(canEditInfo(mission({ status }), BEFORE)).toBe(true);
    }
  });

  it("refuses once the Driver is executing, and on a terminal trip", () => {
    for (const status of ["en_route", "arrived", "on_board", "completed", "cancelled"] as const) {
      expect(canEditInfo(mission({ status }), BEFORE)).toBe(false);
    }
  });

  // § P — the bug this closes: the gate read the raw `status` column, so a trip
  // the sweep hadn't reached yet was still `pooled` and stayed editable.
  it("refuses a still-`pooled` trip whose pickup has passed, before any sweep", () => {
    expect(canEditInfo(mission({ status: "pooled" }), AFTER)).toBe(false);
  });

  it("refuses an already-swept `expired` trip", () => {
    expect(canEditInfo(mission({ status: "expired" }), BEFORE)).toBe(false);
  });

  // The counter-case that rules out a blanket pickup_at floor: fixing a Guest's
  // phone number ten minutes after a confirmed pickup is exactly the real use.
  it("still allows a confirmed trip whose pickup time has just passed", () => {
    expect(canEditInfo(mission({ status: "confirmed" }), AFTER)).toBe(true);
  });
});

describe("negotiationAnswerable", () => {
  // Mirrors `status not in ('accepted','confirmed') → raise` inside
  // respond_to_amendment / respond_to_release.
  it("is true only where the RPCs will accept an answer", () => {
    expect(negotiationAnswerable("accepted")).toBe(true);
    expect(negotiationAnswerable("confirmed")).toBe(true);
  });

  it("is false everywhere the RPCs refuse", () => {
    for (const status of [
      "draft",
      "pooled",
      "en_route",
      "arrived",
      "on_board",
      "completed",
      "cancelled",
      "expired",
    ] as const) {
      expect(negotiationAnswerable(status)).toBe(false);
    }
  });
});
