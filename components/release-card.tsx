"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, Banknote, Star, Undo2 } from "lucide-react";
import { respondToRelease } from "@/app/(app)/rides/actions";
import { addressLine, formatMoney } from "@/lib/format";

// The Driver's "agreed release" card (O7, D45) — shown when the Business has proposed
// a mutual, FREE release of this trip. Accept → the trip releases free and re-pools as
// a SPEED WIN (no fee, no reliability mark). Decline → nothing moves; the trip stays
// exactly as agreed. Declining is always free and safe — the card says so plainly, so a
// Driver never feels pressured into giving up a trip they'd rather keep.
export function ReleaseCard({
  releaseId,
  businessName,
  createdAtLabel,
  pickup,
  dropoff,
  note,
}: {
  releaseId: string;
  businessName: string;
  createdAtLabel: string;
  pickup: string;
  dropoff: string | null;
  note: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function respond(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await respondToRelease(releaseId, accept, null);
      if (res.ok) router.refresh();
      else setError(res.message);
    });
  }

  return (
    <div className="amc">
      <div className="amc__head">
        <BellRing size={17} aria-hidden />
        <span className="amc__title">Release requested</span>
        <span className="amc__ago">
          {businessName} · {createdAtLabel}
        </span>
      </div>

      <div className="amc__lead">
        {businessName} asked to release you from this trip, free of charge. Agreed by phone?
        Confirm it here — your tap is the record.
      </div>

      <div className="amc__route">
        <div className="amc__leg">
          <span className="amc__dot amc__dot--pickup" aria-hidden />
          <span className="amc__addr" style={{ color: "var(--text)" }}>{addressLine(pickup)}</span>
        </div>
        <div className="amc__leg">
          <span className="amc__dot amc__dot--dropoff" aria-hidden />
          <span className="amc__addr" style={{ color: "var(--text)" }}>
            {dropoff ? addressLine(dropoff) : "—"}
          </span>
        </div>
      </div>

      {note && <div className="amc__note">“{note}”</div>}

      <div className="amc__sublabel">What it means for you</div>
      <div className="amc__metrics">
        <div className="amc__mrow amc__mrow--fare">
          <span className="amc__mlabel">
            <Banknote size={15} aria-hidden /> Fee to you
          </span>
          <span className="amc__up">{formatMoney(0)} — no penalty</span>
        </div>
        <div className="amc__mrow">
          <span className="amc__mlabel">
            <Star size={15} aria-hidden /> Your record
          </span>
          <b>No mark — this was mutual</b>
        </div>
        <div className="amc__mrow">
          <span className="amc__mlabel">
            <Undo2 size={15} aria-hidden /> The trip
          </span>
          <b>Returns to the Pool</b>
        </div>
      </div>

      <p className="amc__safe">
        Declining is free and changes nothing — the trip and your fare stay exactly as agreed.
        A release is only ever your choice.
      </p>

      {error && <div className="notice error" style={{ marginTop: 12 }}>{error}</div>}

      <button className="amc__btn amc__btn--accept" onClick={() => respond(true)} disabled={pending}>
        <Check size={18} aria-hidden />
        {pending ? "…" : "Accept the release"}
      </button>
      <button className="amc__btn amc__btn--ghost" onClick={() => respond(false)} disabled={pending}>
        Decline — keep the trip
      </button>

      <p className="amc__foot">Your tap is what counts — PickUp records it for both sides.</p>
    </div>
  );
}
