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
