"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { getMissionBoardUrl } from "@/lib/mission-board-actions";

// Opens a mission's meet & greet board file in a new tab. The signed URL is
// minted on demand (server action authorizes Dispatcher-of-business or assigned
// Driver), so lists don't pay for a signed URL per row.
export function BoardFileLink({
  missionId,
  label = "View name board",
}: {
  missionId: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function open() {
    setLoading(true);
    setError(false);
    try {
      const url = await getMissionBoardUrl(missionId);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="dx-link"
      onClick={open}
      disabled={loading}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
    >
      <FileText size={14} aria-hidden />
      {loading ? "Opening…" : error ? "Couldn’t open — retry" : label}
    </button>
  );
}
