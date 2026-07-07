"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, Route, Flag, Banknote, Clock } from "lucide-react";
import { respondToAmendment } from "@/app/(app)/rides/actions";
import { DECLINE_REASONS, dropoffInstants } from "@/lib/amendments";
import { addressLine, formatMoney, formatKm, formatDuration, formatTime } from "@/lib/format";

export interface AmendmentLeg {
  kind: "pickup" | "stop" | "dropoff";
  address: string;
  isNew: boolean;
}

const BADGE: Record<AmendmentLeg["kind"], string> = {
  pickup: "New pickup",
  stop: "New stop",
  dropoff: "New destination",
};

// The Driver's "accept this change" card (D39 Phase 2) — shown on an accepted
// mission that has a pending amendment. The change reads inside the route (the
// unchanged legs muted, the changed leg highlighted with a badge), then what it
// means for the fare / time / drop-off, an optional slot heads-up, and the binding
// accept / decline. Accept applies the swap atomically via respond_to_amendment.
export function AmendmentCard({
  amendmentId,
  proposedBy,
  createdAtLabel,
  legs,
  removedStops,
  wasLabel,
  note,
  fareOld,
  fareNew,
  distOld,
  durOld,
  distNew,
  durNew,
  pickupAtIso,
  slot,
}: {
  amendmentId: string;
  proposedBy: string;
  createdAtLabel: string;
  legs: AmendmentLeg[];
  removedStops: string[];
  wasLabel: string | null;
  note: string | null;
  fareOld: number;
  fareNew: number;
  distOld: number | null;
  durOld: number | null;
  distNew: number | null;
  durNew: number | null;
  pickupAtIso: string;
  slot: { nextPickupIso: string; overlap: boolean } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const delta = Math.round((fareNew - fareOld) * 100) / 100;
  const deltaLabel = delta > 0 ? `+${formatMoney(delta)}` : delta < 0 ? `−${formatMoney(-delta)}` : null;
  const { before, after } = dropoffInstants(pickupAtIso, durOld, durNew);
  const routeChanged = legs.some((l) => l.isNew) || removedStops.length > 0;

  function respond(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await respondToAmendment(amendmentId, accept, accept ? null : reason);
      if (res.ok) router.refresh();
      else setError(res.message);
    });
  }

  return (
    <div className="amc">
      <div className="amc__head">
        <BellRing size={17} aria-hidden />
        <span className="amc__title">Change requested</span>
        <span className="amc__ago">
          {proposedBy} · {createdAtLabel}
        </span>
      </div>

      <div className="amc__sublabel">What’s changing</div>
      <div className="amc__route">
        {legs.map((leg, i) => (
          <div key={i} className={`amc__leg${leg.isNew ? " amc__leg--new" : ""}`}>
            <span className={`amc__dot amc__dot--${leg.kind}${leg.isNew ? " amc__dot--new" : ""}`} aria-hidden />
            <span className="amc__addr">{addressLine(leg.address)}</span>
            {leg.isNew && <span className="amc__badge">{BADGE[leg.kind]}</span>}
          </div>
        ))}
        {removedStops.map((s, i) => (
          <div key={`r${i}`} className="amc__leg amc__leg--removed">
            <span className="amc__dot amc__dot--stop" aria-hidden />
            <span className="amc__addr">{addressLine(s)}</span>
            <span className="amc__badge amc__badge--rm">Removed</span>
          </div>
        ))}
        {wasLabel && <div className="amc__was">Was: {wasLabel}</div>}
      </div>

      {note && <div className="amc__note">“{note}”</div>}

      <div className="amc__sublabel">What it means for you</div>
      <div className="amc__metrics">
        <div className="amc__mrow amc__mrow--fare">
          <span className="amc__mlabel">
            <Banknote size={15} aria-hidden /> Your fare
          </span>
          <span>
            <s>{formatMoney(fareOld)}</s> → <b className="amc__fareNew">{formatMoney(fareNew)}</b>
            {deltaLabel && <span className={delta > 0 ? "amc__up" : "amc__down"}> {deltaLabel}</span>}
          </span>
        </div>
        {routeChanged && (
          <>
            <div className="amc__mrow">
              <span className="amc__mlabel">
                <Route size={15} aria-hidden /> Distance · time
              </span>
              <span>
                <s>
                  {formatKm(distOld)} · {formatDuration(durOld)}
                </s>{" "}
                → <b>
                  {formatKm(distNew)} · {formatDuration(durNew)}
                </b>
              </span>
            </div>
            <div className="amc__mrow">
              <span className="amc__mlabel">
                <Flag size={15} aria-hidden /> Drop-off
              </span>
              <span>
                <s>~{formatTime(before)}</s> → <b>~{formatTime(after)}</b>
              </span>
            </div>
          </>
        )}
      </div>

      {slot && (
        <div className="amc__slot">
          <Clock size={16} aria-hidden />
          <span>
            {slot.overlap ? (
              <>
                This now ends after your next pickup at <b>{formatTime(slot.nextPickupIso)}</b> — check it still
                works before you accept.
              </>
            ) : (
              <>
                This runs closer to your next pickup at <b>{formatTime(slot.nextPickupIso)}</b> — it still fits,
                but it’s tighter than before.
              </>
            )}
          </span>
        </div>
      )}

      {error && <div className="notice error" style={{ marginTop: 12 }}>{error}</div>}

      {declining ? (
        <div className="amc__decline">
          <div className="amc__declabel">
            A quick reason helps {proposedBy} understand <span className="muted">optional</span>
          </div>
          <div className="amc__reasons">
            {DECLINE_REASONS.map((r) => (
              <button
                type="button"
                key={r.key}
                className={`amc__chip${reason === r.key ? " amc__chip--on" : ""}`}
                onClick={() => setReason((cur) => (cur === r.key ? null : r.key))}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button className="amc__btn amc__btn--decline" onClick={() => respond(false)} disabled={pending}>
            {pending ? "…" : "Decline the change"}
          </button>
          <button
            className="amc__btn amc__btn--ghost"
            onClick={() => setDeclining(false)}
            disabled={pending}
          >
            Keep it — go back
          </button>
        </div>
      ) : (
        <>
          <button className="amc__btn amc__btn--accept" onClick={() => respond(true)} disabled={pending}>
            <Check size={18} aria-hidden />
            {pending ? "…" : "Accept the change"}
          </button>
          <button
            className="amc__btn amc__btn--ghost"
            onClick={() => setDeclining(true)}
            disabled={pending}
          >
            Decline — keep it as agreed
          </button>
        </>
      )}

      <p className="amc__foot">Your tap is what counts — PickUp records it for both sides.</p>
    </div>
  );
}
