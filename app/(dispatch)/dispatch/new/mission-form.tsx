"use client";

import { useRef, useState } from "react";
import { createMission } from "./actions";
import { DateTimePicker } from "@/components/date-time-picker";
import { RouteStops } from "@/components/route-stops";
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
  ceiling: number;
  distanceKm: number | null;
  roadKm: number | null;
  roadMin: number | null;
}

// Client form. Step 1 = fill in; "Review" snapshots the fields into a final card
// PREVIEW (O11); from there you Post to the Pool or Save as draft (O15). The
// editable fields stay mounted (hidden) in preview so the form still submits
// everything. The SPEED WIN copy + auto-suggest reflect the 70%-start curve.
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
      ceiling: ceilingN,
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

  return (
    <form ref={formRef} action={createMission} className="card" onKeyDown={onKeyDown}>
      {draft && (
        <input type="hidden" name="mission_id" value={draft.id} />
      )}

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
        <div className="notice error">
          Something went wrong. Please try again.
        </div>
      )}

      {/* ---------- EDITABLE FIELDS (stay mounted in preview so they submit) ---------- */}
      <div style={{ display: mode === "preview" ? "none" : "block" }}>
        <ServiceClassFields
          defaults={{
            category: draft?.category,
            body: draft?.required_body_type,
            make: draft?.required_make,
            model: draft?.required_model,
          }}
        />

        <RouteStops
          pickupDefault={pickupDefault}
          dropoffDefault={dropoffDefault}
          stopsDefault={stopsDefault}
          pickupAtLocal={pickupAt}
        />

        <div className="field">
          <span>Pickup date &amp; time</span>
          <DateTimePicker value={pickupAt} onChange={setPickupAt} />
        </div>
        {pickupAt && (
          <p className="muted small" style={{ marginTop: -2 }}>
            {prettyParisLocal(pickupAt)} · Europe/Paris
          </p>
        )}

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

        <div style={{ display: "flex", gap: 12 }}>
          <label className="field" style={{ flex: 1 }}>
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
          <label className="field" style={{ flex: 1 }}>
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
          <div className="notice warn">
            Trips below the recommended fare are rarely accepted and may go
            unfulfilled. You can still post it.
          </div>
        )}

        <label className="check" style={{ marginBottom: 14 }}>
          <input
            type="checkbox"
            name="speed_win"
            checked={speedWin}
            onChange={(e) => setSpeedWin(e.target.checked)}
          />
          SPEED WIN — urgent: start the fare high (70% of your ceiling) and climb
          fast for near-instant pickup
        </label>
      </div>

      {/* ---------- PREVIEW ---------- */}
      {mode === "preview" && preview && (
        <div>
          <p className="muted small" style={{ marginTop: 0 }}>
            Review before posting — this is how it enters the Pool.
          </p>

          <div className="card" style={{ background: "var(--surface-2, #f8fafc)" }}>
            <div className="card-row">
              <span className="fare">
                {formatMoney(round2(preview.ceiling * (speedWin ? 0.7 : 0.5)))}
              </span>
              <span style={{ display: "flex", gap: 6 }}>
                {speedWin && <span className="badge speed">SPEED WIN</span>}
                <span className="badge">
                  {serviceClassLabel(preview.category as VehicleCategory, preview.body as BodyType)}
                </span>
              </span>
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              starting fare · climbs up to {formatMoney(preview.ceiling)} (your ceiling)
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
            <div className="notice warn">
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

      {clientError && <div className="notice error">{clientError}</div>}

      {/* ---------- ACTIONS ---------- */}
      {mode === "edit" ? (
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn" style={{ flex: 1 }} onClick={review}>
            Review mission →
          </button>
          <button type="submit" name="intent" value="draft" className="btn secondary">
            Save as draft
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn secondary" onClick={() => setMode("edit")}>
            ← Edit
          </button>
          <button type="submit" name="intent" value="draft" className="btn secondary">
            Save as draft
          </button>
          <button type="submit" name="intent" value="pooled" className="btn" style={{ flex: 1 }}>
            {draft ? "Post draft to the Pool" : "Post to the Pool"}
          </button>
        </div>
      )}
    </form>
  );
}
