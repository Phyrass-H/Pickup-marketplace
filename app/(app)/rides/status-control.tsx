"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceStatus, reachStop } from "./actions";
import { STEP_ACTION_LABELS, nextDriverAction } from "@/lib/mission-flow";
import type { MissionStatus } from "@/lib/database.types";

// The first part of an address (before the first comma) — a short, button-sized
// label, e.g. "Musée du Louvre, Rue de Rivoli" → "Musée du Louvre".
function shortStop(address: string): string {
  return address.split(",")[0]?.trim() || address;
}

// The Driver's "advance the trip" button. Normally it shows the next status step;
// when the Guest is on board and stops remain, it becomes "Reached — <stop>" (one
// tap per stop) before finally offering "Complete ride". On tap it records the
// change and refreshes (the Business sees it within seconds).
export function StatusControl({
  missionId,
  status,
  stops,
  stopsReached,
}: {
  missionId: string;
  status: MissionStatus;
  stops: { address: string }[];
  stopsReached: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const action = nextDriverAction(status, stops.length, stopsReached);
  if (!action) return null;

  const isComplete = action.kind === "status" && action.status === "completed";
  const label =
    action.kind === "stop"
      ? `Reached — ${shortStop(stops[action.stopIndex]?.address ?? "stop")}`
      : STEP_ACTION_LABELS[action.status];

  function go() {
    setError(null);
    startTransition(async () => {
      const res =
        action!.kind === "stop"
          ? await reachStop(missionId, action!.stopIndex)
          : await advanceStatus(missionId, action!.status);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="stack" style={{ marginTop: 12 }}>
      {error && <div className="notice error">{error}</div>}
      <button
        className={isComplete ? "btn success-btn" : "btn"}
        onClick={go}
        disabled={pending}
        style={isComplete ? { background: "var(--success)" } : undefined}
      >
        {pending ? "…" : label}
      </button>
    </div>
  );
}
