"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceStatus } from "./actions";
import { STEP_ACTION_LABELS, nextStep } from "@/lib/mission-flow";
import type { MissionStatus } from "@/lib/database.types";

// The Driver's "advance the trip" button. Shows the next step's action; on tap
// it records the status and refreshes (the Business sees it within seconds).
export function StatusControl({
  missionId,
  status,
}: {
  missionId: string;
  status: MissionStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const next = nextStep(status);
  if (!next) return null;

  function go() {
    if (!next) return;
    setError(null);
    startTransition(async () => {
      const res = await advanceStatus(missionId, next);
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
        className={next === "completed" ? "btn success-btn" : "btn"}
        onClick={go}
        disabled={pending}
        style={next === "completed" ? { background: "var(--success)" } : undefined}
      >
        {pending ? "…" : STEP_ACTION_LABELS[next]}
      </button>
    </div>
  );
}
