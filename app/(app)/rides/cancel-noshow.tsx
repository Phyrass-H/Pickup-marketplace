"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Phone, AlertTriangle, UserX, Clock, Handshake } from "lucide-react";
import { driverCancelMission, markNoShow } from "./actions";
import { formatMoney, formatTime } from "@/lib/format";
import { WAITING_RATE_PER_MIN } from "@/lib/cancellation";

// Driver cancel (O7, D45): always 100%. The trip re-pools on the D46 window — SPEED WIN
// under 24h to pickup, the normal Pool at or above it. The sheet
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
      <button type="button" className="dquiet dquiet--danger" onClick={() => setOpen(true)}>
        Cancel this trip
      </button>
    );
  }

  return (
    <div className="dcard">
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
        <div style={{ border: "0.5px solid var(--border-strong)", borderRadius: 10, padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            <Handshake size={15} aria-hidden /> Ask {businessName ?? "the Business"} to release it — free
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            If they agree, they’ll send a release you accept here — no fee, no mark. Call to arrange it.
          </div>
          <a href={`tel:${businessPhone}`} className="dcta dcta--ghost" style={{ marginTop: 10 }}>
            <Phone size={15} strokeWidth={1.75} aria-hidden="true" /> Call{" "}
            {businessName ?? "the Business"}
          </a>
        </div>
      )}

      <div style={{ background: "var(--tone-danger-bg)", borderRadius: 10, padding: 12, marginTop: 12 }}>
        <div style={{ color: "var(--tone-danger-fg)", fontWeight: 600, fontSize: 13 }}>
          <AlertTriangle size={14} aria-hidden /> Cancelling costs 100%
        </div>
        <div style={{ color: "var(--tone-danger-fg)", fontSize: 12, marginTop: 4 }}>
          You’ll owe the full fare — {formatMoney(fare)}. This keeps Kavenue reliable for Businesses. The trip goes
          back to the Pool for another Driver.
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
        className="dcta"
        onClick={cancel}
        disabled={pending}
        style={{ marginTop: 10, background: "var(--tone-danger-fg)" }}
      >
        {pending ? "…" : `Cancel and pay ${formatMoney(fare)}`}
      </button>
      <button type="button" className="dquiet" onClick={() => setOpen(false)} disabled={pending}>
        Keep the trip
      </button>
    </div>
  );
}

// No-show (O7, D45 as amended 2026-07-19): available once the Driver is on-site
// ('arrived') AND the courtesy wait has elapsed (airport 60 min / city 20 min). The wait runs
// from when the GUEST was due — the ordered pickup time, or a tracked landing instant —
// never from the Driver's arrival, so turning up early can't start (or exhaust) the clock.
// Amber, not red — a no-show PAYS the Driver. A professional "be sure" confirm step
// discourages bailing the instant it opens. Both gates are re-enforced in mark_no_show().
export function NoShowControl({
  missionId,
  fare,
  guestDueIso,
  availableAtIso,
  waitMinutes,
  guestPhone,
  waitingFromIso,
  waitingUntilIso,
}: {
  missionId: string;
  fare: number;
  guestDueIso: string; // when the Guest was due — the courtesy wait starts here
  availableAtIso: string; // when reporting unlocks (wait elapsed + on-site floor)
  waitMinutes: number;
  guestPhone: string | null;
  waitingFromIso: string; // D48: when the paid meter starts
  waitingUntilIso: string; // D48: when it stops paying (the ceiling)
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

  const guestDue = new Date(guestDueIso).getTime();
  const windowEnds = new Date(availableAtIso).getTime();
  // The courtesy wait itself (for the header chip). When a LATE Driver's on-site floor is
  // what actually gates reporting, windowEnds > waitEnds — so the chip must not claim
  // the courtesy wait is still running.
  const waitEnds = guestDue + waitMinutes * 60_000;

  function report() {
    setError(null);
    startTransition(async () => {
      const res = await markNoShow(missionId);
      if (res.ok) router.refresh();
      else setError(res.message);
    });
  }

  if (now === null) {
    return <div className="dcard muted small">Waiting for the Guest…</div>;
  }

  const elapsed = now >= windowEnds;
  // Before the Guest was even due, there is no countdown to run — showing one would
  // conflate "time until pickup" with "courtesy wait".
  const notStarted = now < guestDue;
  const remainingMs = Math.max(0, windowEnds - now);
  const mm = Math.floor(remainingMs / 60_000);
  const ss = Math.floor((remainingMs % 60_000) / 1000);
  const countdown = `${mm}:${ss.toString().padStart(2, "0")}`;
  const dueLabel = formatTime(guestDueIso);
  const waitElapsed = now >= waitEnds;

  // The live meter. Computed here (not server-side) so it ticks; the authoritative
  // settlement is mission_waiting() in SQL, which this mirrors.
  const wFrom = new Date(waitingFromIso).getTime();
  const wUntil = new Date(waitingUntilIso).getTime();
  const wStop = Math.min(now, wUntil);
  const wMinutes = Math.max(0, Math.ceil((wStop - wFrom) / 60_000));
  const waiting = {
    minutes: wMinutes,
    fee: wMinutes * WAITING_RATE_PER_MIN,
    maxFee: Math.round((wUntil - wFrom) / 60_000) * WAITING_RATE_PER_MIN,
    capped: now >= wUntil,
    until: new Date(wUntil),
  };

  return (
    <div>
      {/* Where the courtesy wait stands — a fact row, not a headline. */}
      <div className="dfact">
        <span className="dfact__l">
          <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
          {waitElapsed ? "Courtesy wait used" : `Courtesy wait (${waitMinutes} min)`}
        </span>
        <span
          className="dfact__v"
          style={{
            fontVariantNumeric: "tabular-nums",
            color: waitElapsed ? "var(--success)" : undefined,
          }}
        >
          {waitElapsed ? "Elapsed" : notStarted ? `Starts ${dueLabel}` : `${countdown} left`}
        </span>
      </div>

      {/* D48 — once the courtesy wait lapses the Business is charged per minute STARTED
          and the Driver is paid it. The meter freezes at the ceiling; the trip does NOT
          end there (the Driver may keep waiting, unpaid, and reports when ready). */}
      {waiting && waitElapsed && (
        <div className={waiting.capped ? "dmeter dmeter--capped" : "dmeter"}>
          <div className="dmeter__head">
            <span className="dmeter__label">
              <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
              {waiting.capped ? "Waiting closed" : "Paid waiting"} · {waiting.minutes} min
            </span>
            <span className="dmeter__fee">{formatMoney(waiting.fee)}</span>
          </div>
          <div className="dmeter__bar">
            <div
              className="dmeter__fill"
              style={{ width: `${Math.min(100, (waiting.fee / waiting.maxFee) * 100)}%` }}
            />
          </div>
          <p className="dmeter__note">
            {waiting.capped
              ? `Stopped at the ${formatMoney(waiting.maxFee)} ceiling. You can still wait, but it no longer adds up — report when you're ready.`
              : `${formatMoney(1)} per minute started · stops at ${formatMoney(waiting.maxFee)} (${formatTime(waiting.until.toISOString())})`}
          </p>
        </div>
      )}

      {guestPhone && (
        <a href={`tel:${guestPhone}`} className="dcta dcta--ghost" style={{ marginTop: 12 }}>
          <Phone size={15} strokeWidth={1.75} aria-hidden="true" /> Call the Guest
        </a>
      )}

      {error && <div className="notice error" style={{ marginTop: 10 }}>{error}</div>}

      {!confirming ? (
        <button
          type="button"
          className="dquiet dquiet--warn"
          onClick={() => setConfirming(true)}
          disabled={!elapsed}
        >
          <UserX size={16} strokeWidth={1.75} aria-hidden="true" />{" "}
          {elapsed
            ? "Report a no-show"
            : notStarted
              ? `Report a no-show — courtesy wait starts ${dueLabel}`
              : `Report a no-show — available in ${countdown}`}
        </button>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div style={{ background: "var(--tone-warn-bg)", borderRadius: 10, padding: 12 }}>
            <div style={{ color: "var(--tone-warn-fg)", fontWeight: 600, fontSize: 13 }}>The pro move</div>
            <div style={{ color: "var(--tone-warn-fg)", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
              Make sure you’ve tried everything to reach the Guest — a call, the full wait. Then you’re clear to report.
            </div>
          </div>
          {/* At this point reporting IS the action — so it earns the one filled button. */}
          <button
            type="button"
            className="dcta"
            onClick={report}
            disabled={pending}
            style={{ marginTop: 10, background: "var(--tone-warn-fg)" }}
          >
            {pending
              ? "…"
              : waiting.fee > 0
                ? `Report the no-show — ${formatMoney(fare)} + ${formatMoney(waiting.fee)} waiting`
                : `Report the no-show — ${formatMoney(fare)}`}
          </button>
          <button
            type="button"
            className="dquiet"
            onClick={() => setConfirming(false)}
            disabled={pending}
          >
            Keep waiting
          </button>
        </div>
      )}
    </div>
  );
}
