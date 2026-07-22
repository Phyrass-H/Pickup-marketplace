"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, UserX } from "lucide-react";
import { businessDeclareNoShow } from "@/app/(dispatch)/dispatch/actions";
import { formatMoney, formatTime } from "@/lib/format";
import { WAITING_RATE_PER_MIN } from "@/lib/cancellation";

// The Business's view of a Driver waiting on site (O7 / D48). NET-NEW: before this the
// Dispatch row showed nothing at all while a Driver waited, so the first a Business knew
// of a waiting charge was the invoice.
//
// It shows the meter running — the Business is being charged per minute, so watching it
// tick is what prompts the call to their own Guest — plus the "stop waiting" door, which
// is a no-show declared from the Business side (same terminal outcome as the Driver's).
//
// The ceiling stops the MONEY, not the trip: past it the meter freezes and the Driver may
// still be waiting, so the panel stays up until someone ends it.
export function WaitingPanel({
  missionId,
  driverName,
  fare,
  waitingFromIso,
  waitingUntilIso,
  courtesyMinutes,
}: {
  missionId: string;
  driverName: string;
  fare: number;
  waitingFromIso: string;
  waitingUntilIso: string;
  courtesyMinutes: number;
}) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Client-only clock (null on SSR + first paint) so the meter never hydration-mismatches.
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function declare() {
    setError(null);
    startTransition(async () => {
      const res = await businessDeclareNoShow(missionId);
      if (res.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  if (now === null) return null;

  const from = new Date(waitingFromIso).getTime();
  const until = new Date(waitingUntilIso).getTime();
  const stop = Math.min(now, until);
  const minutes = Math.max(0, Math.ceil((stop - from) / 60_000));
  const fee = minutes * WAITING_RATE_PER_MIN;
  const maxFee = Math.round((until - from) / 60_000) * WAITING_RATE_PER_MIN;
  const capped = now >= until;

  // Before the courtesy wait lapses there is nothing to charge and nothing to declare.
  if (now < from) {
    return (
      <div className="notice" style={{ marginTop: 12 }}>
        <Clock size={14} aria-hidden /> {driverName || "The Driver"} is at the pickup — the{" "}
        {courtesyMinutes} min courtesy wait is running. No charge yet.
      </div>
    );
  }

  return (
    <div
      style={{
        background: capped ? "var(--tone-neutral-bg)" : "var(--tone-warn-bg)",
        borderRadius: 10,
        padding: 14,
        marginTop: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: capped ? "var(--text-muted)" : "var(--tone-warn-fg)",
          }}
        >
          Courtesy wait used · {capped ? "waiting closed" : "paid waiting"} {minutes} min
        </span>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: capped ? "var(--text)" : "var(--tone-warn-fg)",
          }}
        >
          {formatMoney(fee)}
        </span>
      </div>

      <div style={{ height: 5, borderRadius: 999, background: "var(--border)", marginTop: 7, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, (fee / maxFee) * 100)}%`,
            background: capped ? "var(--text-muted)" : "var(--tone-warn-fg)",
            borderRadius: 999,
          }}
        />
      </div>

      <div
        style={{
          fontSize: 12,
          marginTop: 7,
          lineHeight: 1.5,
          color: capped ? "var(--text-muted)" : "var(--tone-warn-fg)",
        }}
      >
        {capped
          ? `Stopped at the ${formatMoney(maxFee)} ceiling — it no longer grows. ${driverName || "The Driver"} may still be waiting.`
          : `${formatMoney(WAITING_RATE_PER_MIN)} per minute started, paid to ${driverName || "the Driver"}. Stops at ${formatMoney(maxFee)} (${formatTime(waitingUntilIso)}).`}
      </div>

      {error && <div className="notice error" style={{ marginTop: 10 }}>{error}</div>}

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={{
            width: "100%",
            marginTop: 12,
            background: "var(--tone-warn-fg)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: 11,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <UserX size={15} aria-hidden /> Stop waiting — the Guest isn’t coming
        </button>
      ) : (
        <div
          onClick={() => !pending && setConfirming(false)}
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
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text)" }}>Stop waiting and close this trip?</div>
            <p className="muted small" style={{ marginTop: 8, lineHeight: 1.55 }}>
              This ends the trip as a no-show. {driverName || "The Driver"} is paid in full, as if the
              trip had run — they held the slot and turned up.
            </p>

            <div style={{ background: "var(--tone-warn-bg)", borderRadius: 10, padding: 14, margin: "12px 0" }}>
              <div style={{ color: "var(--tone-warn-fg)", fontSize: 13 }}>You’ll be charged</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 24, fontWeight: 600, color: "var(--tone-warn-fg)" }}>
                  {formatMoney(fare + fee)}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--tone-warn-fg)" }}>
                  {formatMoney(fare)} fare + {formatMoney(fee)} waiting ({minutes} min)
                </span>
              </div>
            </div>

            <p className="muted small" style={{ lineHeight: 1.5 }}>
              Cancelling instead costs the same — the waiting is owed either way. If your Guest is
              simply delayed, it’s usually cheaper to let the wait run.
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="btn secondary"
                style={{ flex: 1 }}
              >
                Keep waiting
              </button>
              <button
                type="button"
                onClick={declare}
                disabled={pending}
                style={{
                  flex: 1,
                  background: "var(--tone-warn-fg)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: 11,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {pending ? "…" : "Yes, stop waiting"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
