"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Handshake } from "lucide-react";
import { proposeRelease } from "@/app/(dispatch)/dispatch/actions";

// Business "Agreed release · free" (O7, D45): a dedicated action, deliberately SEPARATE
// from the fee-paying "Cancel trip". Opens a modal that spells out the free-for-both /
// re-pool outcome and that the Driver must accept, then sends a release request. Without
// the Driver's acceptance nothing happens — that consent is what keeps the free path
// honest (a Business can't dodge the cancel fee by "agreeing" a release unilaterally).
export function AgreedRelease({
  missionId,
  driverName,
}: {
  missionId: string;
  driverName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const who = driverName || "the Driver";

  function send() {
    setError(null);
    startTransition(async () => {
      const res = await proposeRelease(missionId, note);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "#fff",
          color: "var(--accent)",
          border: "0.5px solid var(--border-strong)",
          borderRadius: 8,
          padding: "9px 14px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <Handshake size={14} aria-hidden /> Agreed release · free
      </button>

      {open && (
        <div
          onClick={() => !pending && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 460, maxWidth: "94vw", background: "#fff", borderRadius: 14, padding: 20, boxSizing: "border-box" }}
          >
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text)" }}>Release this trip — free?</div>

            <div style={{ background: "var(--tone-success-bg)", borderRadius: 10, padding: 14, margin: "12px 0" }}>
              <div style={{ color: "var(--tone-success-fg)", fontWeight: 600 }}>No fee for either side</div>
              <div style={{ color: "var(--tone-success-fg)", fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
                You won’t be charged and {who} won’t owe the cancellation penalty. The trip goes back to
                the Pool so another Driver picks it up fast (as a SPEED WIN if it’s within 24h of pickup).
              </div>
            </div>

            <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
              {who} must accept the release for it to take effect. If they don’t, the trip stays exactly as
              agreed — and cancelling it yourself may cost a fee this close to pickup.
            </div>

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`Note to ${who} (optional)`}
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginTop: 12,
                padding: "9px 10px",
                border: "0.5px solid var(--border-strong)",
                borderRadius: 8,
                fontSize: 13,
              }}
            />

            {error && <div className="notice error" style={{ marginTop: 10 }}>{error}</div>}

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                style={{ flex: 1, background: "#fff", color: "var(--text-muted)", border: "0.5px solid var(--border-strong)", borderRadius: 8, padding: 11, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={send}
                disabled={pending}
                style={{ flex: 1.5, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: 11, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                {pending ? "…" : "Send release request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
