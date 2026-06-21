"use client";

import { useRef, useState } from "react";
import { Car, MapPin, CalendarClock, ClipboardList, Route } from "lucide-react";
import { createMission } from "./actions";
import { DateTimePicker } from "@/components/date-time-picker";
import { RouteStops, type RouteSummary } from "@/components/route-stops";
import { ServiceClassFields } from "@/components/service-class-fields";
import { parseWaypoints, parseWaypointsField } from "@/lib/waypoints";
import {
  parisLocalToUtc,
  prettyParisLocal,
  utcToParisLocalInput,
} from "@/lib/time";
import { tripDistanceKm } from "@/lib/geo";
import {
  formatMoney,
  formatTripMeta,
  serviceClassLabel,
} from "@/lib/format";
import type { MissionRow, VehicleCategory, BodyType } from "@/lib/database.types";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toNum(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

interface PreviewData {
  category: string;
  body: string;
  requiredCar: string | null;
  pickup: string;
  dropoff: string;
  stops: string[];
  pickupAtLocal: string;
  pax: string;
  luggage: string;
  guest: string;
  flight: string;
  reference: string;
  distanceKm: number | null;
  roadKm: number | null;
  roadMin: number | null;
}

// Client form (Direction B). The fields live in a two-pane layout: section cards
// on the left, a sticky live Summary rail on the right (mini-route, ETA, ceiling,
// live starting fare, SPEED WIN, actions). Everything is inside ONE <form> so the
// createMission server action still gets a single FormData snapshot. "Review"
// snapshots the editable fields into the preview card (O11); from there you Post
// or Save as draft (O15). Editable cards stay mounted (hidden) in preview so they
// still submit; the rail (ceiling / SPEED WIN / actions) stays visible throughout.
export function MissionForm({
  error,
  prefillDate,
  draft,
}: {
  error?: string;
  prefillDate?: string;
  draft?: MissionRow | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [clientError, setClientError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  const [ceiling, setCeiling] = useState(draft?.ceiling != null ? String(draft.ceiling) : "");
  const [baseFare, setBaseFare] = useState(draft?.base_fare != null ? String(draft.base_fare) : "");
  const [speedWin, setSpeedWin] = useState(draft?.speed_win ?? false);

  // Calendar prefill (?date=) → that day at 09:00; a resumed draft wins over it.
  const calendarValue =
    prefillDate && /^\d{4}-\d{2}-\d{2}$/.test(prefillDate) ? `${prefillDate}T09:00` : "";
  const [pickupAt, setPickupAt] = useState(
    draft?.pickup_at ? utcToParisLocalInput(draft.pickup_at) : calendarValue,
  );

  const prettyCalendar =
    !draft && calendarValue ? prettyParisLocal(calendarValue) : null;

  const ceilingNum = Number(ceiling);
  const baseNum = Number(baseFare);
  const tooLow =
    baseFare !== "" &&
    ceiling !== "" &&
    Number.isFinite(ceilingNum) &&
    Number.isFinite(baseNum) &&
    ceilingNum < baseNum;

  // Prefill addresses when resuming a draft.
  const pickupDefault =
    draft && draft.pickup_lat != null && draft.pickup_lng != null
      ? { label: draft.pickup_address, lat: draft.pickup_lat, lng: draft.pickup_lng }
      : null;
  const dropoffDefault =
    draft && draft.dropoff_lat != null && draft.dropoff_lng != null
      ? { label: draft.dropoff_address ?? "", lat: draft.dropoff_lat, lng: draft.dropoff_lng }
      : null;
  const stopsDefault = parseWaypoints(draft?.waypoints).map((w) => ({
    label: w.address,
    lat: w.lat ?? null,
    lng: w.lng ?? null,
  }));

  // A resumed draft's cached road ETA — seeds both the rail snapshot and the
  // RouteStops eta state so the figure shows immediately (no flicker to blank
  // before the live fetch returns).
  const draftEta =
    draft?.distance_km != null && draft?.duration_min != null
      ? { distanceKm: Number(draft.distance_km), durationMin: Number(draft.duration_min) }
      : null;

  // Live route snapshot for the Summary rail (mini-route + ETA). RouteStops keeps
  // it current via onSummaryChange.
  const [routeSummary, setRouteSummary] = useState<RouteSummary>(() => ({
    pickup: pickupDefault,
    dropoff: dropoffDefault,
    stopCount: stopsDefault.filter((s) => s.lat != null && s.lng != null).length,
    eta: draftEta,
    etaLoading: false,
  }));

  function review() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const category = String(fd.get("category") ?? "");
    const pickup = String(fd.get("pickup_address") ?? "").trim();
    const pickupLat = Number(fd.get("pickup_lat"));
    const pickupLng = Number(fd.get("pickup_lng"));
    const at = String(fd.get("pickup_at") ?? "").trim();
    const ceilingN = Number(fd.get("ceiling"));

    if (
      !category ||
      !pickup ||
      !Number.isFinite(pickupLat) ||
      !at ||
      !Number.isFinite(ceilingN) ||
      ceilingN <= 0
    ) {
      setClientError(
        "Please choose a vehicle category, a pickup picked from the suggestions, a pickup time, and a ceiling.",
      );
      return;
    }

    const dropLat = Number(fd.get("dropoff_lat"));
    const dropLng = Number(fd.get("dropoff_lng"));
    const rMake = String(fd.get("required_make") ?? "").trim();
    const rModel = String(fd.get("required_model") ?? "").trim();
    setPreview({
      category,
      body: String(fd.get("required_body_type") ?? ""),
      requiredCar: rMake && rModel ? `${rMake} ${rModel}` : null,
      pickup,
      dropoff: String(fd.get("dropoff_address") ?? "").trim(),
      stops: parseWaypointsField(fd.get("waypoints")).map((w) => w.address),
      pickupAtLocal: at,
      pax: String(fd.get("pax_count") ?? ""),
      luggage: String(fd.get("luggage_count") ?? ""),
      guest: String(fd.get("passenger_name") ?? "").trim(),
      flight: String(fd.get("flight_number") ?? "").trim(),
      reference: String(fd.get("comment") ?? "").trim(),
      distanceKm: tripDistanceKm(
        pickupLat,
        pickupLng,
        Number.isFinite(dropLat) ? dropLat : null,
        Number.isFinite(dropLng) ? dropLng : null,
      ),
      roadKm: toNum(fd.get("route_distance_km")),
      roadMin: toNum(fd.get("route_duration_min")),
    });
    setClientError(null);
    setMode("preview");
  }

  // Prevent Enter from implicitly submitting while editing (textarea exempt).
  function onKeyDown(e: React.KeyboardEvent) {
    if (
      e.key === "Enter" &&
      mode === "edit" &&
      (e.target as HTMLElement).tagName !== "TEXTAREA"
    ) {
      e.preventDefault();
    }
  }

  // Auto-suggest SPEED WIN when the pickup is soon (≤5h) and it's off (O10a).
  const startsSoon = (() => {
    if (!preview) return false;
    const at = parisLocalToUtc(preview.pickupAtLocal);
    if (!at) return false;
    const hours = (at.getTime() - Date.now()) / 3_600_000;
    return hours > 0 && hours <= 5;
  })();

  const showFare = ceiling !== "" && Number.isFinite(ceilingNum) && ceilingNum > 0;

  return (
    <form ref={formRef} action={createMission} onKeyDown={onKeyDown}>
      {draft && <input type="hidden" name="mission_id" value={draft.id} />}

      {draft && mode === "edit" && (
        <div className="notice info">Editing a saved draft.</div>
      )}
      {prettyCalendar && (
        <div className="notice info">
          Pre-filled for <strong>{prettyCalendar}</strong> from the calendar.
        </div>
      )}
      {error === "missing" && (
        <div className="notice error">
          Please fill in the vehicle category, pickup address, pickup time, and a ceiling.
        </div>
      )}
      {error === "past" && (
        <div className="notice error">
          That pickup time is in the past. Pick a future time, or save it as a draft.
        </div>
      )}
      {error === "gone" && (
        <div className="notice error">
          That draft was already posted or discarded — check your schedule, it may
          be live already.
        </div>
      )}
      {error === "db" && (
        <div className="notice error">Something went wrong. Please try again.</div>
      )}

      <div className="mx-form-grid">
        {/* ---------- LEFT: section cards (kept mounted, hidden in preview) ---------- */}
        <div className="mx-left">
          <div className="mx-sections" style={{ display: mode === "preview" ? "none" : undefined }}>
            {/* Vehicle & class */}
            <div className="card">
              <div className="mx-card__head">
                <span className="mx-card__ic" aria-hidden>
                  <Car />
                </span>
                <h3 className="mx-card__title">Vehicle &amp; class</h3>
              </div>
              <ServiceClassFields
                defaults={{
                  category: draft?.category,
                  body: draft?.required_body_type,
                  make: draft?.required_make,
                  model: draft?.required_model,
                }}
              />
            </div>

            {/* Route */}
            <div className="card">
              <div className="mx-card__head">
                <span className="mx-card__ic" aria-hidden>
                  <MapPin />
                </span>
                <h3 className="mx-card__title">Route</h3>
              </div>
              <RouteStops
                pickupDefault={pickupDefault}
                dropoffDefault={dropoffDefault}
                stopsDefault={stopsDefault}
                pickupAtLocal={pickupAt}
                etaDefault={draftEta}
                onSummaryChange={setRouteSummary}
              />
            </div>

            {/* Schedule */}
            <div className="card">
              <div className="mx-card__head">
                <span className="mx-card__ic" aria-hidden>
                  <CalendarClock />
                </span>
                <h3 className="mx-card__title">Schedule</h3>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <span>Pickup date &amp; time</span>
                <DateTimePicker value={pickupAt} onChange={setPickupAt} />
              </div>
              {pickupAt && (
                <p className="muted small" style={{ margin: "8px 0 0" }}>
                  {prettyParisLocal(pickupAt)} · Europe/Paris
                </p>
              )}
            </div>

            {/* Trip details */}
            <div className="card">
              <div className="mx-card__head">
                <span className="mx-card__ic" aria-hidden>
                  <ClipboardList />
                </span>
                <h3 className="mx-card__title">Trip details</h3>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <label className="field" style={{ flex: 1 }}>
                  <span>Passengers</span>
                  <input
                    type="number"
                    name="pax_count"
                    min={0}
                    inputMode="numeric"
                    defaultValue={draft?.pax_count ?? ""}
                  />
                </label>
                <label className="field" style={{ flex: 1 }}>
                  <span>Luggage</span>
                  <input
                    type="number"
                    name="luggage_count"
                    min={0}
                    inputMode="numeric"
                    defaultValue={draft?.luggage_count ?? ""}
                  />
                </label>
              </div>

              <label className="field">
                <span>Guest / passenger name</span>
                <input type="text" name="passenger_name" defaultValue={draft?.passenger_name ?? ""} />
              </label>

              <label className="field">
                <span>Flight number (optional)</span>
                <input
                  type="text"
                  name="flight_number"
                  placeholder="AF1234"
                  defaultValue={draft?.flight_number ?? ""}
                />
              </label>

              <label className="field">
                <span>Reference / notes (optional — shown on the schedule line)</span>
                <textarea
                  name="comment"
                  rows={2}
                  defaultValue={draft?.comment ?? ""}
                  placeholder="e.g. Room 312 · or an event name like “Cannes Gala” · or instructions"
                  style={{
                    width: "100%",
                    padding: 12,
                    fontSize: 16,
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontFamily: "inherit",
                  }}
                />
              </label>

              <label className="field" style={{ marginBottom: 0 }}>
                <span>Estimated base fare € (optional)</span>
                <input
                  type="number"
                  name="base_fare"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={baseFare}
                  onChange={(e) => setBaseFare(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* PREVIEW card */}
          {mode === "preview" && preview && (
            <div>
              <p className="muted small" style={{ marginTop: 0 }}>
                Review before posting — this is how it enters the Pool.
              </p>

              <div className="card" style={{ background: "var(--surface-2, #f8fafc)" }}>
                <div className="card-row">
                  <span className="fare">
                    {formatMoney(round2(ceilingNum * (speedWin ? 0.7 : 0.5)))}
                  </span>
                  <span style={{ display: "flex", gap: 6 }}>
                    {speedWin && <span className="badge speed">SPEED WIN</span>}
                    <span className="badge">
                      {serviceClassLabel(preview.category as VehicleCategory, preview.body as BodyType)}
                    </span>
                  </span>
                </div>
                <div className="muted small" style={{ marginTop: 4 }}>
                  starting fare · climbs up to {formatMoney(ceilingNum)} (your ceiling)
                </div>

                <div className="muted small" style={{ marginTop: 8 }}>
                  {prettyParisLocal(preview.pickupAtLocal)}
                  {(() => {
                    const meta = formatTripMeta(preview.roadKm, preview.roadMin, preview.distanceKm);
                    return meta ? ` · ${meta}` : "";
                  })()}
                </div>

                <div className="route">
                  <div className="leg">
                    <span className="dot" />
                    <span>{preview.pickup}</span>
                  </div>
                  {preview.stops.map((s, i) => (
                    <div className="leg" key={i}>
                      <span className="dot" style={{ background: "#98a2b3" }} />
                      <span className="muted">{s}</span>
                    </div>
                  ))}
                  <div className="leg">
                    <span className="dot end" />
                    <span>{preview.dropoff || "—"}</span>
                  </div>
                </div>

                <dl className="kv" style={{ marginTop: 12 }}>
                  {preview.requiredCar && (
                    <>
                      <dt>Specific car</dt>
                      <dd>{preview.requiredCar}</dd>
                    </>
                  )}
                  <dt>Guest</dt>
                  <dd>{preview.guest || "—"}</dd>
                  <dt>Pax / luggage</dt>
                  <dd>
                    {preview.pax || "—"} pax · {preview.luggage || "—"} bags
                  </dd>
                  {preview.flight && (
                    <>
                      <dt>Flight</dt>
                      <dd>{preview.flight}</dd>
                    </>
                  )}
                  {preview.reference && (
                    <>
                      <dt>Reference</dt>
                      <dd>{preview.reference}</dd>
                    </>
                  )}
                </dl>
              </div>

              {startsSoon && !speedWin && (
                <div className="notice warn" style={{ marginTop: 14 }}>
                  This pickup is in under 5 hours. Consider SPEED WIN so a Driver grabs
                  it fast.{" "}
                  <button
                    type="button"
                    className="dx-link"
                    style={{ fontWeight: 600 }}
                    onClick={() => setSpeedWin(true)}
                  >
                    Enable SPEED WIN
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---------- RIGHT: sticky live Summary rail ---------- */}
        <aside className="mx-summary" aria-labelledby="mx-sum-title">
          <h2 id="mx-sum-title" className="mx-summary__band">Mission summary</h2>
          <div className="mx-summary__body">
            {routeSummary.pickup || routeSummary.dropoff ? (
              <div className="route" style={{ marginTop: 0 }}>
                <div className="leg">
                  <span className="dot" />
                  <span>{routeSummary.pickup?.label || "—"}</span>
                </div>
                {routeSummary.stopCount > 0 && (
                  <div className="leg">
                    <span className="dot" style={{ background: "#98a2b3" }} />
                    <span className="muted">
                      +{routeSummary.stopCount} stop{routeSummary.stopCount === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
                <div className="leg">
                  <span className="dot end" />
                  <span>{routeSummary.dropoff?.label || "—"}</span>
                </div>
              </div>
            ) : (
              <p className="mx-summary__empty">
                Pick a route to see the distance, time and starting fare.
              </p>
            )}

            {routeSummary.eta ? (
              <div style={{ marginTop: 11 }}>
                <span className="mx-eta" role="status" aria-live="polite">
                  <Route size={15} aria-hidden />{" "}
                  {formatTripMeta(routeSummary.eta.distanceKm, routeSummary.eta.durationMin, null)}
                </span>
              </div>
            ) : routeSummary.etaLoading && routeSummary.pickup && routeSummary.dropoff ? (
              <div style={{ marginTop: 11 }}>
                <span className="mx-eta mx-eta--loading" role="status" aria-live="polite">
                  Estimating distance &amp; time…
                </span>
              </div>
            ) : null}

            <div className="mx-sumdiv" />

            <label className="field" style={{ marginBottom: 0 }}>
              <span>Ceiling € (your maximum)</span>
              <input
                type="number"
                name="ceiling"
                required
                min={0}
                step="0.01"
                inputMode="decimal"
                value={ceiling}
                onChange={(e) => setCeiling(e.target.value)}
              />
            </label>
            {tooLow && (
              <div className="notice warn" style={{ margin: "10px 0 0" }}>
                Trips below the recommended fare are rarely accepted and may go
                unfulfilled. You can still post it.
              </div>
            )}

            {showFare && (
              <div
                style={{ marginTop: 14 }}
                role="status"
                aria-live="polite"
                aria-label="Starting fare"
              >
                <div className="mx-fare">
                  {formatMoney(round2(ceilingNum * (speedWin ? 0.7 : 0.5)))}
                </div>
                <div className="mx-fare-sub">
                  starting fare · climbs up to {formatMoney(ceilingNum)}
                </div>
              </div>
            )}

            <div className="mx-sumdiv" />
            <label className="mx-speed">
              <input
                type="checkbox"
                name="speed_win"
                checked={speedWin}
                onChange={(e) => setSpeedWin(e.target.checked)}
              />
              <span>
                <strong>SPEED WIN</strong> — start high (70% of ceiling) and climb
                fast for near-instant pickup
              </span>
            </label>

            <div className="mx-sumdiv" />
            {mode === "edit" ? (
              <div className="mx-actions">
                <button type="button" className="btn" onClick={review}>
                  Review mission →
                </button>
                <button type="submit" name="intent" value="draft" className="btn secondary">
                  Save as draft
                </button>
              </div>
            ) : (
              <div className="mx-actions">
                <button type="submit" name="intent" value="pooled" className="btn">
                  {draft ? "Post draft to the Pool" : "Post to the Pool"}
                </button>
                <button type="button" className="btn secondary" onClick={() => setMode("edit")}>
                  ← Edit
                </button>
                <button type="submit" name="intent" value="draft" className="btn secondary">
                  Save as draft
                </button>
              </div>
            )}

            {clientError && (
              <div className="notice error" style={{ margin: "10px 0 0" }}>
                {clientError}
              </div>
            )}
          </div>
        </aside>
      </div>
    </form>
  );
}
