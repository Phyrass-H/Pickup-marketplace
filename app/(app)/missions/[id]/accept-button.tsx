"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptMission } from "./actions";

export function AcceptButton({ missionId }: { missionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onAccept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptMission(missionId);
      if (res.ok) {
        router.push("/rides");
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="stack">
      {error && <div className="notice error">{error}</div>}
      <button className="btn" onClick={onAccept} disabled={pending}>
        {pending ? "Accepting…" : "Accept mission"}
      </button>
    </div>
  );
}
