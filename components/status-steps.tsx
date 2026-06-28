import { progressSegments, progressDone } from "@/lib/mission-flow";
import type { MissionStatus } from "@/lib/database.types";

// Visual progress bar (en route → arrived → on board → … → completed). When the
// trip has intermediate stops, one segment per stop is inserted between "On board"
// and the final "Drop-off". Shared by the Driver's My Rides and the Business's
// Dispatch list — both pass the mission's stop count + how many are reached.
export function StatusSteps({
  status,
  stopsCount = 0,
  stopsReached = 0,
}: {
  status: MissionStatus;
  stopsCount?: number;
  stopsReached?: number;
}) {
  const segments = progressSegments(stopsCount);
  const done = progressDone(status, stopsCount, stopsReached);
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
      {segments.map((seg, i) => {
        const active = i < done;
        return (
          <div key={seg.key} style={{ flex: 1, textAlign: "center" }}>
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
              {seg.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
