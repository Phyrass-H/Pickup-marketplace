// The execution phase of a mission: confirmed → en_route → arrived → on_board
// → completed. Each tap of a status button is a status_event (Doc spine).
import type { MissionStatus, StatusEventStatus } from "@/lib/database.types";

// The 4 execution steps, in order (each one is a status_event row).
export const EXECUTION_STEPS: StatusEventStatus[] = [
  "en_route",
  "arrived",
  "on_board",
  "completed",
];

export const STEP_LABELS: Record<StatusEventStatus, string> = {
  en_route: "En route",
  arrived: "Arrived",
  on_board: "On board",
  completed: "Completed",
};

// Button text the Driver taps to ADVANCE to that step.
export const STEP_ACTION_LABELS: Record<StatusEventStatus, string> = {
  en_route: "Start — I’m en route",
  arrived: "I’ve arrived",
  on_board: "Guest on board",
  completed: "Complete ride",
};

// Linear flow from confirmed onward.
const FLOW: MissionStatus[] = [
  "confirmed",
  "en_route",
  "arrived",
  "on_board",
  "completed",
];

/** The next step the Driver can tap, or null if none (not executable / done). */
export function nextStep(status: MissionStatus): StatusEventStatus | null {
  const i = FLOW.indexOf(status);
  if (i < 0 || i >= FLOW.length - 1) return null;
  return FLOW[i + 1] as StatusEventStatus;
}

/** In an executable phase (confirmed..on_board) — the trip can be advanced. */
export function isExecutable(status: MissionStatus): boolean {
  return (
    status === "confirmed" ||
    status === "en_route" ||
    status === "arrived" ||
    status === "on_board"
  );
}

/** How many of the 4 steps are done (0..4) for the progress bar. */
export function completedSteps(status: MissionStatus): number {
  const idx: Partial<Record<MissionStatus, number>> = {
    confirmed: 0,
    en_route: 1,
    arrived: 2,
    on_board: 3,
    completed: 4,
  };
  return idx[status] ?? 0;
}

// ----- Stops (intermediate waypoints) -----
// A mission with N stops runs: en_route → arrived → on_board → [reach stop 1 …
// reach stop N] → completed. The status enum is untouched: while passing stops
// the mission stays `on_board` and `mission.stops_reached` counts up. The single
// next thing the Driver taps is either a status advance OR "reached this stop".

export type DriverAction =
  | { kind: "status"; status: StatusEventStatus } // advance mission.status
  | { kind: "stop"; stopIndex: number }; // mark waypoints[stopIndex] reached

/** The one next action for the Driver, accounting for any remaining stops. */
export function nextDriverAction(
  status: MissionStatus,
  stopsCount: number,
  stopsReached: number,
): DriverAction | null {
  const next = nextStep(status);
  if (!next) return null;
  // On board with stops still to pass → the next tap is a stop, not "completed".
  if (status === "on_board" && stopsReached < stopsCount) {
    return { kind: "stop", stopIndex: stopsReached };
  }
  return { kind: "status", status: next };
}

export interface ProgressSegment {
  key: string;
  label: string;
}

/** Ordered progress segments, with one inserted per stop (for the bar). */
export function progressSegments(stopsCount: number): ProgressSegment[] {
  const segs: ProgressSegment[] = [
    { key: "en_route", label: "En route" },
    { key: "arrived", label: "Arrived" },
    { key: "on_board", label: "On board" },
  ];
  for (let i = 0; i < stopsCount; i++) {
    segs.push({ key: `stop-${i}`, label: `Stop ${i + 1}` });
  }
  segs.push({ key: "completed", label: stopsCount > 0 ? "Drop-off" : "Completed" });
  return segs;
}

/** How many progress segments are reached, given status + stops done. */
export function progressDone(
  status: MissionStatus,
  stopsCount: number,
  stopsReached: number,
): number {
  switch (status) {
    case "en_route":
      return 1;
    case "arrived":
      return 2;
    case "on_board":
      return 3 + Math.min(Math.max(stopsReached, 0), stopsCount);
    case "completed":
      return stopsCount + 4;
    default:
      return 0; // confirmed / pre-execution
  }
}
