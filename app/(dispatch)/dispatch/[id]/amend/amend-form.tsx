"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Route, Banknote, MessageSquare, Send } from "lucide-react";
import { RouteStops, type RouteSummary } from "@/components/route-stops";
import type { Place, DefaultPlace } from "@/components/address-autocomplete";
import type { Waypoint } from "@/lib/database.types";
import {
  routeDiff,
  changeSummaryParts,
  dropoffInstants,
} from "@/lib/amendments";
import { formatMoney, formatKm, formatDuration, formatTime } from "@/lib/format";
import { priceFor, type RateCardRow } from "@/lib/rate-card";
import type { VehicleCategory, BodyType } from "@/lib/database.types";
import { proposeMissionAmendment } from "./actions";

function SendButton({ driverName }: { driverName: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn am-send" disabled={pending}>
      <Send size={16} aria-hidden />
      {pending ? "Sending…" : `Send change to ${driverName.split(" ")[0]}`}
    </button>
  );
}

// Propose-a-change form (D39 Phase 2). Reuses the new-mission RouteStops editor
// (pickup + stops + destination all editable) + a manual new-fare field + an
// optional note, with a live "what the Driver will see" preview on the right. On
// submit, proposeMissionAmendment records the proposal — nothing on the trip moves
// until the Driver accepts.
export function AmendForm({
  missionId,
  driverName,
  currentFare,
  rateCard,
  tier,
  body,
  night,
  pickupDefault,
  dropoffDefault,
  stopsDefault,
  etaDefault,
  pickupAtIso,
  fromDurationMin,
  fromDistanceKm,
  original,
}: {
  missionId: string;
  driverName: string;
  currentFare: number;
  /** The live rate card — the form prices the CHANGE with it as the route is edited. */
  rateCard: RateCardRow[];
  tier: VehicleCategory;
  body: BodyType | null;
  night: boolean;
  pickupDefault: Place | null;
  dropoffDefault: Place | null;
  stopsDefault: DefaultPlace[];
  etaDefault: { distanceKm: number; durationMin: number } | null;
  pickupAtIso: string;
  fromDurationMin: number | null;
  fromDistanceKm: number | null;
  original: { pickup: string; dropoff: string | null; waypoints: Waypoint[] };
}) {
  const [summary, setSummary] = useState<RouteSummary>(() => ({
    pickup: pickupDefault,
    dropoff: dropoffDefault,
    stopCount: stopsDefault.filter((s) => s.lat != null && s.lng != null).length,
    eta: etaDefault,
    etaLoading: false,
    pickupText: pickupDefault?.label ?? "",
    dropoffText: dropoffDefault?.label ?? "",
    stops: stopsDefault.map((s) => s.label),
  }));
  const action = proposeMissionAmendment.bind(null, missionId);

  // Live diff of the proposed route vs the agreed trip (advisory preview; the
  // server recomputes authoritatively on submit).
  const diff = routeDiff(original, {
    pickup: summary.pickupText,
    dropoff: summary.dropoffText || null,
    waypoints: summary.stops.map((a) => ({ address: a }) as Waypoint),
  });
  const parts = changeSummaryParts(diff);

  const newDuration = summary.eta?.durationMin ?? fromDurationMin;
  const newDistance = summary.eta?.distanceKm ?? fromDistanceKm;
  const routeChanged = diff.hasChanges;

  // ⚑ KAVENUE PRICES THE CHANGE — nobody types a fare (docs/06 §0, §10). The card
  // prices the OLD route and the NEW one, and the difference is applied to the fare
  // the two sides already agreed. Re-quoting the new distance outright would throw
  // away the auction result the Driver won. Advisory here; proposeMissionAmendment
  // re-prices from the server's own road distance on submit.
  const round2 = (n: number) => Math.sign(n) * Math.round(Math.abs(n) * 100 + Number.EPSILON) / 100;
  // `van` is the vestigial category (BACKLOG § X); the card has no row for it, so it
  // prices as Business — the same fallback the waiting rate uses.
  const cardTier = tier === "van" ? "business" : tier;
  const wasQuote = priceFor(rateCard, cardTier, body, fromDistanceKm, { night });
  const nowQuote = priceFor(rateCard, cardTier, body, newDistance, { night });
  // An unchanged route cannot change the fare, whatever two measurements say. The
  // server re-measures the original route to make the same guarantee properly; this
  // keeps the screen from flickering a delta the moment it loads.
  const delta = !routeChanged
    ? 0
    : wasQuote && nowQuote
      ? round2(nowQuote.ceiling - wasQuote.ceiling)
      : null;
  const newFareNum = delta == null ? null : round2(currentFare + delta);
  const validFare = newFareNum != null && newFareNum > 0;
  const deltaLabel =
    delta == null || delta === 0
      ? null
      : delta > 0
        ? `+${formatMoney(delta)}`
        : `−${formatMoney(-delta)}`;
  const { before, after } = dropoffInstants(pickupAtIso, fromDurationMin, newDuration);

  return (
    <form action={action} className="am-grid">
      <div className="am-main">
        <div className="card">
          <div className="mx-card__head">
            <span className="mx-card__ic" aria-hidden>
              <Route />
            </span>
            <h3 className="mx-card__title">New route</h3>
          </div>
          <RouteStops
            pickupDefault={pickupDefault}
            dropoffDefault={dropoffDefault}
            stopsDefault={stopsDefault}
            etaDefault={etaDefault}
            onSummaryChange={setSummary}
          />
        </div>

        <div className="card">
          <div className="mx-card__head">
            <span className="mx-card__ic" aria-hidden>
              <Banknote />
            </span>
            <h3 className="mx-card__title">New agreed fare</h3>
          </div>
          <div className="am-fare">
            <div
              className="am-fare__input"
              style={{ fontVariantNumeric: "tabular-nums" }}
              aria-live="polite"
            >
              <span aria-hidden>€</span>
              <span style={{ fontWeight: 500 }}>
                {validFare ? formatMoney(newFareNum).replace(/\s*€$/, "") : "—"}
              </span>
            </div>
            <div className="am-fare__delta muted">
              Current <s>{formatMoney(currentFare)}</s>
              {deltaLabel && (
                <>
                  {" · "}
                  <span className={(delta ?? 0) > 0 ? "am-up" : "am-down"}>{deltaLabel}</span>
                </>
              )}
            </div>
          </div>
          <p className="muted small am-hint">
            {!validFare
              ? "Pick the addresses from the suggestions so Kavenue can measure the route and price it."
              : delta === 0
                ? "The route is the same length, so the fare doesn’t move."
                : `Kavenue priced the change: ${formatKm(fromDistanceKm)} → ${formatKm(newDistance)} on the rate card. The fare your Driver agreed stands; only the difference is added.`}
          </p>
        </div>

        <div className="card">
          <div className="mx-card__head">
            <span className="mx-card__ic" aria-hidden>
              <MessageSquare />
            </span>
            <h3 className="mx-card__title">
              Note to {driverName.split(" ")[0]} <span className="muted">optional</span>
            </h3>
          </div>
          <textarea
            name="note"
            rows={2}
            className="am-note"
            placeholder="e.g. Guest needs to collect a colleague on the way — thanks."
          />
        </div>
      </div>

      <aside className="am-rail">
        <div className="am-preview">
          <div className="am-preview__label">What {driverName.split(" ")[0]} will see</div>
          <div className="am-card">
            {parts.length > 0 ? (
              <ul className="am-changes">
                {parts.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            ) : (
              <div className="am-changes am-changes--none muted">Fare change only</div>
            )}
            <div className="am-drow">
              <span className="muted">Fare</span>
              <span>
                <s>{formatMoney(currentFare)}</s> → <b>{validFare ? formatMoney(newFareNum) : "—"}</b>
                {deltaLabel && (
                  <span className={(delta ?? 0) > 0 ? "am-up" : "am-down"}> {deltaLabel}</span>
                )}
              </span>
            </div>
            {routeChanged && (
              <>
                <div className="am-drow">
                  <span className="muted">Distance · time</span>
                  <span>
                    <s>
                      {formatKm(fromDistanceKm)} · {formatDuration(fromDurationMin)}
                    </s>{" "}
                    → <b>{formatKm(newDistance)} · {formatDuration(newDuration)}</b>
                  </span>
                </div>
                <div className="am-drow">
                  <span className="muted">Drop-off</span>
                  <span>
                    <s>~{formatTime(before)}</s> → <b>~{formatTime(after)}</b>
                  </span>
                </div>
              </>
            )}
          </div>
          <SendButton driverName={driverName} />
          <p className="am-note-copy">
            This takes you back to your schedule, where the trip shows <b>Change pending</b> until{" "}
            {driverName.split(" ")[0]} answers.
          </p>
          <p className="am-note-copy am-note-copy--faint">
            If they’re too tight to fit it, the trip simply stays as agreed.
          </p>
          <Link href="/dispatch" className="am-cancel">
            Cancel
          </Link>
        </div>
      </aside>
    </form>
  );
}
