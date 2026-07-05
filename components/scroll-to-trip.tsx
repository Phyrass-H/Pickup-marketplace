"use client";

import { useEffect } from "react";

// Deep links from the calendar into the Schedule:
//   /dispatch?open=<missionId> → expand that trip's row and scroll to it
//   /dispatch?day=<YYYY-MM-DD>  → scroll to that day's band
// Either way, open any collapsed ancestor <details> (e.g. the "Earlier trips"
// fold that hides past days) so the target is actually visible.
export function ScrollToTrip({
  missionId,
  dayKey,
}: {
  missionId?: string;
  dayKey?: string;
}) {
  useEffect(() => {
    const id = missionId ? `trip-${missionId}` : dayKey ? `day-${dayKey}` : null;
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    let anc = el.parentElement;
    while (anc) {
      if (anc instanceof HTMLDetailsElement) anc.open = true;
      anc = anc.parentElement;
    }
    if (el instanceof HTMLDetailsElement) el.open = true;
    el.scrollIntoView({ block: "center" });
  }, [missionId, dayKey]);
  return null;
}
