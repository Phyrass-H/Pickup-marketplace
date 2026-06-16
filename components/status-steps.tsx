import {
  EXECUTION_STEPS,
  STEP_LABELS,
  completedSteps,
} from "@/lib/mission-flow";
import type { MissionStatus } from "@/lib/database.types";

// Visual 4-step progress bar (en route → arrived → on board → completed).
// Shared by the Driver's My Rides and the Business's Dispatch list.
export function StatusSteps({ status }: { status: MissionStatus }) {
  const done = completedSteps(status);
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
      {EXECUTION_STEPS.map((step, i) => {
        const active = i < done;
        return (
          <div key={step} style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: active ? "var(--success)" : "var(--border)",
              }}
            />
            <div
              className="small"
              style={{
                marginTop: 4,
                color: active ? "var(--text)" : "var(--text-muted)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {STEP_LABELS[step]}
            </div>
          </div>
        );
      })}
    </div>
  );
}
