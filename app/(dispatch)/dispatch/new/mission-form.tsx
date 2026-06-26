"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Car, MapPin, CalendarClock, ClipboardList, Route, Wallet, AlertTriangle, UserRound } from "lucide-react";
import { createMission } from "./actions";
import { DateTimePicker } from "@/components/date-time-picker";
import { RouteStops, type RouteSummary } from "@/components/route-stops";
import { ServiceClassFields } from "@/components/service-class-fields";
import { DriverServiceFields } from "@/components/driver-service-fields";
import { PassengerList } from "@/components/passenger-list";
import { ReferenceField } from "@/components/reference-field";
import { SERVICE_TIERS, type ServiceTier } from "@/lib/vehicle-catalog";
import {
  parseLanguages,
  parseDriverFlags,
  activeFlagLabels,
  dressCodeLabel,
} from "@/lib/driver-service";
import { parseWaypoints, parseWaypointsField } from "@/lib/waypoints";
import {
  parsePassengers,
  primaryPassengerName,
  splitFullName,
  VAN_SEATS,
  type Passenger,
} from "@/lib/passengers";
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

// Submit button wired to the form's pending state. While the createMission
// server action is in flight EVERY submit button is disabled, so a slow
// post/save can't be fired twice (repeated clicks were creating duplicate
// missions). Only the button that actually submitted shows its pending label.
// Must live in a child of the <form> for useFormStatus to see it.
function SubmitButton({
  intent,
  className,
  pendingLabel,
  children,
}: {
  intent: "pooled" | "draft";
  className: string;
  pendingLabel: string;
  children: React.ReactNode;
}) {
  const { pending, data } = useFormStatus();
  const isThis = pending && data?.get("intent") === intent;
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      className={className}
      disabled={pending}
      aria-busy={isThis}
    >
      {isThis ? pendingLabel : children}
    </button>
  );
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
  languages: string[];
  dressLabel: string | null;
  flagLabels: string[];
  boardName: string;
  driverMessage: string;
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

  // Body type is chosen in the Vehicle & class card, but the passenger cap lives
  // in the Trip-details PassengerList — lift it so the cap reacts to it.
  const initBody =
    draft?.required_body_type === "van"
      ? "van"
      : draft?.required_body_type === "sedan"
        ? "sedan"
        : "";
  const [body, setBody] = useState<string>(initBody);

  // Service tier (category) lifted from the Vehicle & class card so the Driver
  // card's dress-code default tracks the chosen service class (S19).
  const initTier: ServiceTier = (SERVICE_TIERS as string[]).includes(draft?.category ?? "")
    ? (draft!.category as ServiceTier)
    : "business";
  const [tier, setTier] = useState<ServiceTier>(initTier);

  // First named Guest, lifted from the Trip-details PassengerList so the Driver
  // card pre-fills the meet & greet board with it (corrected on mount by the list).
  const [primaryName, setPrimaryName] = useState<string>(draft?.passenger_name ?? "");

  // Seed passenger rows: a draft's structured passenger_names, else best-effort
  // from a legacy single passenger_name, else one blank row (the PassengerList default).
  const draftPassengers = parsePassengers(draft?.passenger_names);
  const seedBase =
    draftPassengers.length > 0
      ? draftPassengers
      : draft?.passenger_name
        ? [splitFullName(draft.passenger_name)]
        : [];
  // Preserve the stored headcount on resume: a draft (especially one predating
  // passenger_names) can carry pax_count > the named rows. Pad with blank rows up
  // to pax_count so resuming + re-saving never shrinks the count. Bounded to the
  // largest vehicle so a stray value can't spawn hundreds of rows.
  const seedTarget = Math.min(
    Math.max(seedBase.length, Number(draft?.pax_count) || 0),
    VAN_SEATS,
  );
  const seededPassengers: Passenger[] | undefined =
    seedTarget > 0
      ? Array.from({ length: seedTarget }, (_, i) => seedBase[i] ?? { first: "", last: "" })
      : undefined;

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

    // toNum (not Number()) so an empty dropoff is null, not 0 — Number("") is 0,
    // which is a "finite" coordinate and would yield a bogus pickup→(0,0) distance.
    const dropLat = toNum(fd.get("dropoff_lat"));
    const dropLng = toNum(fd.get("dropoff_lng"));
    const rMake = String(fd.get("required_make") ?? "").trim();
    const rModel = String(fd.get("required_model") ?? "").trim();
    const passengers = parsePassengers(fd.get("passenger_names"));
    setPreview({
      category,
      body: String(fd.get("required_body_type") ?? ""),
      requiredCar: rMake && rModel ? `${rMake} ${rModel}` : null,
      pickup,
      dropoff: String(fd.get("dropoff_address") ?? "").trim(),
      stops: parseWaypointsField(fd.get("waypoints")).map((w) => w.address),
      pickupAtLocal: at,
      pax: passengers.length ? String(passengers.length) : "",
      luggage: String(fd.get("luggage_count") ?? ""),
      guest: primaryPassengerName(passengers),
      flight: String(fd.get("flight_number") ?? "").trim(),
      reference: String(fd.get("reference") ?? "").trim().slice(0, 20),
      languages: parseLanguages(fd.get("required_languages")),
      dressLabel: dressCodeLabel(String(fd.get("dress_code") ?? "")),
      flagLabels: activeFlagLabels(fd.get("driver_flags")),
      boardName: String(fd.get("board_name") ?? "").trim(),
      driverMessage: String(fd.get("driver_message") ?? "").trim(),
      distanceKm: tripDistanceKm(pickupLat, pickupLng, dropLat, dropLng),
      roadKm: toNum(fd.get("route_distance_km")),
      roadMin: toNum(fd.get("route_duration_min")),
    });
    setClientError(null);
    setMode("preview");
  }

  // Enter inside a single-line <input> implicitly submits the form. Submitting
  // is only ever an explicit button action here, and in preview mode a stray
  // implicit submit would fire a LIVE post — so block Enter for inputs in BOTH
  // modes. <textarea> (newlines) and <button> (keyboard activation) are exempt.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
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
                onBodyChange={setBody}
                onTierChange={setTier}
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
              <PassengerList
                body={body}
                defaultPassengers={seededPassengers}
                onPrimaryNameChange={setPrimaryName}
              />

              <label className="field" style={{ marginTop: 16 }}>
                <span>Luggage</span>
                <input
                  type="number"
                  name="luggage_count"
                  min={0}
                  inputMode="numeric"
                  defaultValue={draft?.luggage_count ?? ""}
                />
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

              <ReferenceField defaultValue={draft?.reference} />
            </div>

            {/* Driver & service — language / dress code / requests / message (S19) */}
            <div className="card">
              <div className="mx-card__head">
                <span className="mx-card__ic" aria-hidden>
                  <UserRound />
                </span>
                <h3 className="mx-card__title">Driver &amp; service</h3>
              </div>
              <DriverServiceFields
                tier={tier}
                guestName={primaryName}
                defaults={{
                  languages: parseLanguages(draft?.required_languages),
                  dressCode: draft?.dress_code ?? null,
                  flags: parseDriverFlags(draft?.driver_flags),
                  boardName: draft?.board_name ?? null,
                  driverMessage: draft?.driver_message ?? null,
                  hasBoardFile: !!draft?.board_file_path,
                }}
              />
            </div>

            {/* Pricing — base fare + ceiling + SPEED WIN grouped together */}
            <div className="card">
              <div className="mx-card__head">
                <span className="mx-card__ic" aria-hidden>
                  <Wallet />
                </span>
                <h3 className="mx-card__title">Pricing</h3>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <label className="field" style={{ flex: 1, marginBottom: 0 }}>
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
                <label className="field" style={{ flex: 1, marginBottom: 0 }}>
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
              </div>
              {tooLow && (
                <div className="notice warn" style={{ margin: "12px 0 0" }}>
                  Trips below the recommended fare are rarely accepted and may go
                  unfulfilled. You can still post it.
                </div>
              )}
              <p className="muted small" style={{ margin: "10px 0 0" }}>
                The base fare drives a soft “below recommended” warning only. The
                ceiling is the most a Driver can climb to.
              </p>
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
                  {preview.languages.length > 0 && (
                    <>
                      <dt>Languages</dt>
                      <dd>{preview.languages.join(", ")}</dd>
                    </>
                  )}
                  {preview.dressLabel && (
                    <>
                      <dt>Dress code</dt>
                      <dd>{preview.dressLabel}</dd>
                    </>
                  )}
                  {preview.flagLabels.length > 0 && (
                    <>
                      <dt>Requests</dt>
                      <dd>{preview.flagLabels.join(" · ")}</dd>
                    </>
                  )}
                  {preview.boardName && (
                    <>
                      <dt>Name board</dt>
                      <dd>{preview.boardName}</dd>
                    </>
                  )}
                  {preview.driverMessage && (
                    <>
                      <dt>Message to Driver</dt>
                      <dd>{preview.driverMessage}</dd>
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

            {showFare ? (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 12,
                  }}
                >
                  <span className="muted small">Ceiling (your maximum)</span>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>
                    {formatMoney(ceilingNum)}
                  </span>
                </div>
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 12,
                  }}
                >
                  <span className="muted small">Pricing mode</span>
                  {speedWin ? (
                    <span className="badge speed">SPEED WIN</span>
                  ) : (
                    <span className="muted small">Standard climb</span>
                  )}
                </div>
                {tooLow && mode === "preview" && (
                  <div
                    className="notice warn"
                    style={{ margin: "12px 0 0", padding: "9px 12px", fontSize: 13 }}
                  >
                    Below the recommended base fare — may go unfulfilled.
                  </div>
                )}
              </>
            ) : (
              <p className="mx-summary__empty">
                Set a ceiling under Pricing to see the starting fare.
              </p>
            )}

            <div className="mx-sumdiv" />
            {mode === "preview" && (
              <div
                className="notice warn"
                role="note"
                style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
              >
                <AlertTriangle size={16} style={{ flex: "none", marginTop: 1 }} aria-hidden />
                <span>
                  <strong>This is final.</strong> Posting sends the mission live to
                  the Driver Pool right away — it can’t be un-posted. Use Edit or
                  Save as draft if you’re not ready.
                </span>
              </div>
            )}
            {/* Distinct keys per mode so React MOUNTS A FRESH button set instead of
                reusing (and re-typing) the same <button> node — without this, the
                edit "Review" button (type=button) is reconciled into the preview
                "Post to the Pool" submit button in place, and the click that opens
                the preview submits the form (a live post). See SESSION_LOG S18. */}
            {mode === "edit" ? (
              <div className="mx-actions" key="actions-edit">
                <button type="button" className="btn" onClick={review}>
                  Review mission →
                </button>
                <SubmitButton intent="draft" className="btn secondary" pendingLabel="Saving…">
                  Save as draft
                </SubmitButton>
              </div>
            ) : (
              <div className="mx-actions" key="actions-preview">
                <SubmitButton intent="pooled" className="btn" pendingLabel="Posting…">
                  {draft ? "Post draft to the Pool" : "Post to the Pool"}
                </SubmitButton>
                <button type="button" className="btn secondary" onClick={() => setMode("edit")}>
                  ← Edit
                </button>
                <SubmitButton intent="draft" className="btn secondary" pendingLabel="Saving…">
                  Save as draft
                </SubmitButton>
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
