"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, RefreshCw, AlertTriangle, Phone } from "lucide-react";
import { businessCancelMission, reclaimMission } from "@/app/(dispatch)/dispatch/actions";
import { businessCancelPct, cancelFeeAmount, nextCancelRaise } from "@/lib/cancellation";
import { formatMoney, formatTime } from "@/lib/format";

// How long until `iso`, in the plainest words that are still precise enough to act on.
// Under a minute we count seconds, because that is exactly when someone is deciding.
function untilWords(iso: string, now: number): string {
  const secs = Math.max(0, Math.round((Date.parse(iso) - now) / 1000));
  if (secs < 60) return `in ${secs} sec`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
}

// The fee ramp, for the reference row in the cancel modal. Free >5h, then 50% at −5h
// climbing +10%/h to 100% at pickup (mirrors businessCancelPct / the SQL).
// ⚑ The real rule steps every HALF hour; these hourly columns are the landmarks on that
// staircase and are each exactly right — the tread boundaries in between are shown by the
// live "next raise" line instead, which is the one a Business actually acts on.
const RAMP = [
  { label: ">5h", pct: 0 },
  { label: "5h", pct: 50 },
  { label: "4h", pct: 60 },
  { label: "3h", pct: 70 },
  { label: "2h", pct: 80 },
  { label: "1h", pct: 90 },
  { label: "0", pct: 100 },
];

// Business "Cancel trip" (O7, D45): a button that opens a modal showing the LIVE cost by
// time-to-pickup (free while pooled / >5h, then the ramp), then the terminal cancel.
export function BusinessCancel({
  missionId,
  fare,
  pickupAtIso,
  hasDriver,
}: {
  missionId: string;
  fare: number;
  pickupAtIso: string;
  hasDriver: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Clock only while the modal is open (client-only → no hydration concern; the modal
  // is opened by a click).
  //
  // Every SECOND, not every 30 — but note what that is for. The fee itself is a half-hour
  // step, so it does not move between ticks; what moves is the COUNTDOWN to the next raise,
  // and a countdown that jumps 30 seconds at a time is worse than none. The one moment the
  // fee does change, the second-tick makes it change on screen the instant it changes in the
  // database, which is the whole point of dropping the slope.
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [open]);

  function cancel() {
    setError(null);
    startTransition(async () => {
      const res = await businessCancelMission(missionId, reason);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  const hours = now != null ? (new Date(pickupAtIso).getTime() - now) / 3_600_000 : 0;
  const pct = businessCancelPct(hours, hasDriver);
  const feeAmount = cancelFeeAmount(fare, pct);
  const activeIdx = !hasDriver || hours > 5 ? 0 : hours <= 0 ? 6 : Math.min(6, 6 - Math.ceil(hours));

  // The deadline, not just the price. A half-hour step is only safe if you can SEE the edge
  // coming — otherwise someone cancels two minutes late and pays five points more with no
  // warning. `null` once there is nothing left to rise to (already 100%, or no Driver).
  const raise = now != null ? nextCancelRaise(hours, hasDriver) : null;
  const raiseAtIso = raise
    ? new Date(new Date(pickupAtIso).getTime() - raise.atHoursToPickup * 3_600_000).toISOString()
    : null;
  const raiseFee = raise ? cancelFeeAmount(fare, raise.pct) : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "#fff",
          color: "var(--tone-danger-fg)",
          border: "0.5px solid #fbd9d4",
          borderRadius: 8,
          padding: "9px 14px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <Ban size={14} aria-hidden /> Cancel trip
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
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text)" }}>Cancel this trip?</div>

            {now == null ? (
              <p className="muted small" style={{ marginTop: 12 }}>Calculating…</p>
            ) : pct === 0 ? (
              <div style={{ background: "var(--tone-success-bg)", borderRadius: 10, padding: 14, margin: "12px 0" }}>
                <div style={{ color: "var(--tone-success-fg)", fontWeight: 600 }}>Free to cancel</div>
                <div style={{ color: "var(--tone-success-fg)", fontSize: 13, marginTop: 4 }}>
                  {hasDriver
                    ? "More than 5 hours before pickup — no fee."
                    : "No Driver has taken this yet — no fee."}
                </div>
                {raise && raiseAtIso && (
                  <div style={{ color: "var(--tone-success-fg)", fontSize: 12.5, marginTop: 8, opacity: 0.9 }}>
                    Free until <strong style={{ fontWeight: 600 }}>{formatTime(raiseAtIso)}</strong> — then{" "}
                    {raise.pct}% ({formatMoney(raiseFee)}), {untilWords(raiseAtIso, now)}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div style={{ background: "var(--tone-danger-bg)", borderRadius: 10, padding: 14, margin: "12px 0" }}>
                  <div style={{ color: "var(--tone-danger-fg)", fontSize: 13 }}>Cancelling now costs</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 26, fontWeight: 600, color: "var(--tone-danger-fg)" }}>{Math.round(pct)}%</span>
                    <span style={{ fontSize: 18, fontWeight: 600, color: "var(--tone-danger-fg)" }}>{formatMoney(feeAmount)}</span>
                    <span style={{ fontSize: 12, color: "var(--tone-danger-fg)" }}>of {formatMoney(fare)}</span>
                  </div>
                  {/* This price HOLDS until the moment below — that is the deal the step
                      buys. Say when it ends, what it becomes, and how long that is. */}
                  <div style={{ color: "var(--tone-danger-fg)", fontSize: 12.5, marginTop: 8, opacity: 0.9 }}>
                    {raise && raiseAtIso ? (
                      <>
                        This price holds until{" "}
                        <strong style={{ fontWeight: 600 }}>{formatTime(raiseAtIso)}</strong> — then {raise.pct}% (
                        {formatMoney(raiseFee)}), {untilWords(raiseAtIso, now)}
                      </>
                    ) : (
                      "This is the highest it goes."
                    )}
                  </div>
                </div>
                <div className="muted small" style={{ marginBottom: 6 }}>How the fee grows as pickup nears</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {RAMP.map((b, i) => {
                    const on = i === activeIdx;
                    return (
                      <div
                        key={b.label}
                        style={{
                          flex: b.pct === 0 ? 1.4 : 1,
                          textAlign: "center",
                          padding: "7px 2px",
                          borderRadius: 8,
                          background: on
                            ? "var(--tone-danger-fg)"
                            : b.pct === 0
                              ? "var(--tone-success-bg)"
                              : "var(--tone-danger-bg)",
                        }}
                      >
                        <div style={{ fontSize: 11, color: on ? "#fde8e5" : b.pct === 0 ? "var(--tone-success-fg)" : "var(--tone-danger-fg)" }}>
                          {on ? "now" : b.label}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: on ? "#fff" : b.pct === 0 ? "var(--tone-success-fg)" : "var(--tone-danger-fg)" }}>
                          {b.pct === 0 ? "Free" : `${b.pct}%`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* The Driver reads this in their history, so say so HERE — writing it
                under one expectation and showing it under another isn't ours to do. */}
            <label
              htmlFor="cancel-reason"
              style={{
                display: "block",
                marginTop: 12,
                marginBottom: 6,
                fontSize: 11.5,
                color: "var(--text-muted)",
              }}
            >
              Reason (optional) — your Driver will see this
            </label>
            <input
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Guest’s flight was cancelled…"
              style={{
                width: "100%",
                boxSizing: "border-box",
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
                onClick={cancel}
                disabled={pending || now == null}
                style={{ flex: 1.4, background: "var(--tone-danger-fg)", color: "#fff", border: "none", borderRadius: 8, padding: 11, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                {pending ? "…" : pct === 0 ? "Cancel trip" : `Cancel — accept ${formatMoney(feeAmount)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// T-60 reclaim card (O7, D45): shown when the assigned Driver accepted but never confirmed
// and pickup is close. Re-pools the trip as a SPEED WIN, penalty-free for the Business.
export function ReclaimCard({
  missionId,
  driverName,
  driverPhone,
}: {
  missionId: string;
  driverName: string;
  driverPhone: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reclaim() {
    setError(null);
    startTransition(async () => {
      const res = await reclaimMission(missionId);
      if (res.ok) router.refresh();
      else setError(res.message);
    });
  }

  return (
    <div
      style={{
        background: "var(--tone-danger-bg)",
        border: "0.5px solid #fbd9d4",
        borderLeft: "3px solid var(--tone-danger-fg)",
        borderRadius: "0 12px 12px 0",
        padding: "14px 16px",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <AlertTriangle size={18} style={{ color: "var(--tone-danger-fg)", marginTop: 2, flexShrink: 0 }} aria-hidden />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: "var(--tone-danger-fg)", fontSize: 14 }}>
            {driverName} hasn’t confirmed — pickup is close
          </div>
          <div style={{ color: "var(--tone-danger-fg)", fontSize: 13, margin: "4px 0 12px" }}>
            They accepted but never locked in. Couldn’t reach them by phone? Take the trip back — it re-pools as a
            SPEED WIN so another Driver can grab it fast. No penalty to you.
          </div>
          {error && <div className="notice error" style={{ marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reclaim}
              disabled={pending}
              style={{ background: "var(--tone-danger-fg)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              <RefreshCw size={14} aria-hidden /> {pending ? "…" : "Reclaim and re-pool as SPEED WIN"}
            </button>
            {driverPhone && (
              <a
                href={`tel:${driverPhone}`}
                style={{ background: "#fff", color: "var(--accent)", border: "0.5px solid var(--border-strong)", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
              >
                <Phone size={14} aria-hidden /> Call the Driver
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
