"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Phone, AlertTriangle, UserX, Clock } from "lucide-react";
import { driverCancelMission, markNoShow } from "./actions";
import { formatMoney } from "@/lib/format";

// Driver cancel (O7, D45): always 100%, re-pools the trip as a SPEED WIN. The sheet
// surfaces the escape valves FIRST (hand to a copilote — Phase 2; call the Business to
// release it) before the plain "cancel and pay" path.
export function DriverCancel({
  missionId,
  fare,
  businessPhone,
  businessName,
}: {
  missionId: string;
  fare: number;
  businessPhone: string | null;
  businessName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setError(null);
    startTransition(async () => {
      const res = await driverCancelMission(missionId, reason);
      if (res.ok) router.refresh();
      else setError(res.message);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          marginTop: 12,
          width: "100%",
          background: "transparent",
          color: "var(--tone-danger-fg)",
          border: "none",
          padding: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Cancel this trip
      </button>
    );
  }

  return (
    <div style={{ marginTop: 12, border: "0.5px solid var(--border)", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Can’t do this trip?</div>
      <div className="muted small" style={{ marginTop: 4 }}>
        A Driver is a pro — try to keep it covered before you cancel.
      </div>

      <div
        style={{
          border: "0.5px solid var(--border-strong)",
          borderRadius: 10,
          padding: 12,
          marginTop: 12,
          opacity: 0.7,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            <Users size={15} aria-hidden /> Hand it to a copilote
          </span>
          <span className="badge" style={{ fontSize: 11 }}>Soon</span>
        </div>
        <div className="muted small" style={{ marginTop: 4 }}>
          Pass it to a verified same-class Driver. No fee. (Coming soon)
        </div>
      </div>

      {businessPhone && (
        <a href={`tel:${businessPhone}`} className="btn" style={{ marginTop: 8, display: "block", textAlign: "center" }}>
          <Phone size={15} aria-hidden /> Call {businessName ?? "the Business"} to release it
        </a>
      )}

      <div style={{ background: "var(--tone-danger-bg)", borderRadius: 10, padding: 12, marginTop: 12 }}>
        <div style={{ color: "var(--tone-danger-fg)", fontWeight: 600, fontSize: 13 }}>
          <AlertTriangle size={14} aria-hidden /> Cancelling costs 100%
        </div>
        <div style={{ color: "var(--tone-danger-fg)", fontSize: 12, marginTop: 4 }}>
          You’ll owe the full fare — {formatMoney(fare)}. This keeps PickUp reliable for Businesses. The trip re-pools
          as a SPEED WIN.
        </div>
      </div>

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        style={{
          width: "100%",
          boxSizing: "border-box",
          marginTop: 10,
          padding: "9px 10px",
          border: "0.5px solid var(--border-strong)",
          borderRadius: 8,
          fontSize: 13,
        }}
      />

      {error && <div className="notice error" style={{ marginTop: 10 }}>{error}</div>}

      <button
        type="button"
        onClick={cancel}
        disabled={pending}
        style={{
          width: "100%",
          marginTop: 10,
          background: "var(--tone-danger-fg)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: 11,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {pending ? "…" : `Cancel and pay ${formatMoney(fare)}`}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={pending}
        className="muted"
        style={{ width: "100%", marginTop: 8, background: "transparent", border: "none", padding: 6, fontSize: 13, cursor: "pointer" }}
      >
        Keep the trip
      </button>
    </div>
  );
}

// No-show (O7, D45): available once the Driver is on-site ('arrived') and the free wait
// window has elapsed (airport 60 min / city 20 min). Amber, not red — a no-show PAYS the
// Driver. A professional "be sure" confirm step discourages bailing the instant it opens.
export function NoShowControl({
  missionId,
  fare,
  arrivedAtIso,
  waitMinutes,
  guestPhone,
}: {
  missionId: string;
  fare: number;
  arrivedAtIso: string;
  waitMinutes: number;
  guestPhone: string | null;
}) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Client-only clock (null on SSR + first paint) so the countdown never mismatches.
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const windowEnds = new Date(arrivedAtIso).getTime() + waitMinutes * 60_000;

  function report() {
    setError(null);
    startTransition(async () => {
      const res = await markNoShow(missionId);
      if (res.ok) router.refresh();
      else setError(res.message);
    });
  }

  if (now === null) {
    return (
      <div
        className="muted small"
        style={{ marginTop: 12, border: "0.5px solid var(--border)", borderRadius: 12, padding: 12 }}
      >
        Waiting for the Guest…
      </div>
    );
  }

  const elapsed = now >= windowEnds;
  const remainingMs = Math.max(0, windowEnds - now);
  const mm = Math.floor(remainingMs / 60_000);
  const ss = Math.floor((remainingMs % 60_000) / 1000);
  const countdown = `${mm}:${ss.toString().padStart(2, "0")}`;

  return (
    <div style={{ marginTop: 12, border: "0.5px solid var(--border)", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="muted small">
          <Clock size={14} aria-hidden /> Free wait ({waitMinutes} min)
        </span>
        <span
          style={{
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            color: elapsed ? "var(--success)" : "var(--text)",
          }}
        >
          {elapsed ? "Elapsed" : `${countdown} left`}
        </span>
      </div>

      {guestPhone && (
        <a href={`tel:${guestPhone}`} className="btn" style={{ marginTop: 10, display: "block", textAlign: "center" }}>
          <Phone size={15} aria-hidden /> Call the Guest
        </a>
      )}

      {error && <div className="notice error" style={{ marginTop: 10 }}>{error}</div>}

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!elapsed}
          style={{
            width: "100%",
            marginTop: 10,
            borderRadius: 8,
            padding: 11,
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            cursor: elapsed ? "pointer" : "not-allowed",
            background: elapsed ? "var(--tone-warn-fg)" : "var(--slate-100)",
            color: elapsed ? "#fff" : "var(--text-faint)",
          }}
        >
          <UserX size={16} aria-hidden /> {elapsed ? "Report a no-show" : "Report a no-show — available at 0:00"}
        </button>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div style={{ background: "var(--tone-warn-bg)", borderRadius: 10, padding: 12 }}>
            <div style={{ color: "var(--tone-warn-fg)", fontWeight: 600, fontSize: 13 }}>The pro move</div>
            <div style={{ color: "var(--tone-warn-fg)", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
              A quick call or a few more minutes goes a long way — flights and bags run late, and Businesses remember
              Drivers who go the extra mile. If you’ve waited the full window and tried to reach them, you’re clear to
              report.
            </div>
          </div>
          <button
            type="button"
            onClick={report}
            disabled={pending}
            style={{
              width: "100%",
              marginTop: 10,
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
            {pending ? "…" : `Report the no-show — you’re paid ${formatMoney(fare)}`}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="muted"
            style={{ width: "100%", marginTop: 8, background: "transparent", border: "none", padding: 6, fontSize: 13, cursor: "pointer" }}
          >
            Keep waiting
          </button>
        </div>
      )}
    </div>
  );
}
