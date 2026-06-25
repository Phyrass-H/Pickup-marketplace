"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { discardDraft } from "@/app/(dispatch)/dispatch/new/actions";

// The red confirm button, wired to the form's pending state so it disables (and
// reads "Discarding…") while the discardDraft server action runs — same in-flight
// guard as the post/save buttons, so a slow discard can't be double-fired.
function ConfirmDiscardButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn danger" disabled={pending} aria-busy={pending} style={{ width: "auto" }}>
      {pending ? "Discarding…" : "Discard"}
    </button>
  );
}

// Action row for a draft card. Default: "Continue editing" + "Discard". Clicking
// Discard swaps the row for an inline confirm ("Discard this draft? This can't be
// undone.") with Cancel + a red Discard — so a draft is never deleted on a single
// stray click (founder ask). Discard itself is the existing discardDraft action.
export function DraftActions({
  missionId,
  editHref,
}: {
  missionId: string;
  editHref: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <form
        action={discardDraft}
        className="notice error"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginTop: 12,
          marginBottom: 0,
        }}
      >
        <input type="hidden" name="mission_id" value={missionId} />
        <span style={{ flex: 1 }}>
          <strong>Discard this draft?</strong> This can&rsquo;t be undone.
        </span>
        <button
          type="button"
          className="btn secondary"
          onClick={() => setConfirming(false)}
          style={{ width: "auto" }}
        >
          Cancel
        </button>
        <ConfirmDiscardButton />
      </form>
    );
  }

  return (
    <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
      <Link href={editHref} className="btn" style={{ flex: 1 }}>
        Continue editing
      </Link>
      <button type="button" className="btn secondary" onClick={() => setConfirming(true)}>
        Discard
      </button>
    </div>
  );
}
