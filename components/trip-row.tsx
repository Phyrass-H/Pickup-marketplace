import type { MissionRow } from "@/lib/database.types";
import { currentFare } from "@/lib/pdp";
import { tripDistanceKm } from "@/lib/geo";
import { parseWaypoints } from "@/lib/waypoints";
import {
  formatDateTime,
  formatMoney,
  formatTime,
  formatTripMeta,
  serviceClassLabel,
} from "@/lib/format";
import { missionTone, TONE_BG, TONE_COLOR } from "@/lib/dispatch-status";
import { isExecutable } from "@/lib/mission-flow";
import { StatusSteps } from "@/components/status-steps";

// A Driver's car, shown to the Dispatch so it can tell the Guest what to look
// for at pickup (brand, colour, plate). Captured at Driver onboarding/settings.
export interface VehicleBrief {
  make: string | null;
  model: string | null;
  colour: string | null;
  plate: string | null;
}

export interface DriverContact {
  name: string;
  phone: string | null;
  vehicle?: VehicleBrief | null;
}

// One dense schedule line. Click to expand full detail. The coloured left edge +
// status pill are the at-a-glance signal a hotel scans (red = needs a call). When
// a Driver hasn't confirmed near pickup (danger tone) the whole row gets a gentle
// red wash — the T-180 alert.
export function TripRow({
  mission,
  driver,
  archived = false,
}: {
  mission: MissionRow;
  driver?: DriverContact | null;
  archived?: boolean;
}) {
  const t = missionTone(mission, undefined, { archived });
  const reference = mission.comment?.trim() || null;
  const waypoints = parseWaypoints(mission.waypoints);
  const alert = t.tone === "danger";
  const flightEta = mission.flight_eta ? formatTime(mission.flight_eta) : null;
  const distanceKm = tripDistanceKm(
    mission.pickup_lat,
    mission.pickup_lng,
    mission.dropoff_lat,
    mission.dropoff_lng,
  );
  const tripMeta = formatTripMeta(mission.distance_km, mission.duration_min, distanceKm);
  const car = driver?.vehicle ?? null;
  const carDesc = car
    ? [[car.make, car.model].filter(Boolean).join(" "), car.colour]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <details
      className={`dx-trip${alert ? " dx-trip--alert" : ""}`}
      style={{ "--edge": TONE_COLOR[t.tone] } as React.CSSProperties}
    >
      <summary>
        <span className="dx-trip__time mono">{formatTime(mission.pickup_at)}</span>

        <span className="dx-trip__route">
          <span>{mission.pickup_address}</span>
          <span className="dx-arrow">→</span>
          <span>{mission.dropoff_address ?? "—"}</span>
        </span>

        <span className="dx-trip__flight">
          {mission.flight_number ? (
            <span className="dx-flight">
              {mission.flight_number}
              {flightEta ? ` · ${flightEta}` : ""}
            </span>
          ) : (
            <span className="dx-flight-empty">—</span>
          )}
        </span>

        <span className="dx-trip__meta">
          {mission.passenger_name ?? "—"}
          {reference && <span className="ref">{reference}</span>}
        </span>

        <span className="dx-trip__driver">
          {driver ? driver.name : <span className="muted">—</span>}
        </span>

        <span
          className="status-pill"
          style={{ background: TONE_BG[t.tone], color: TONE_COLOR[t.tone] }}
        >
          <span className="dot" style={{ background: TONE_COLOR[t.tone] }} />
          {t.needsAttention && <span className="attention">!</span>}
          {t.label}
        </span>
      </summary>

      <div className="dx-trip__detail">
        {t.hint && <div className="notice warn" style={{ marginTop: 12 }}>{t.hint}</div>}

        <div className="route" style={{ marginTop: 12 }}>
          <div className="leg">
            <span className="dot" />
            <span>{mission.pickup_address}</span>
          </div>
          {waypoints.map((w, i) => (
            <div className="leg" key={i}>
              <span className="dot" style={{ background: "#98a2b3" }} />
              <span className="muted">{w.address}</span>
            </div>
          ))}
          <div className="leg">
            <span className="dot end" />
            <span>{mission.dropoff_address ?? "—"}</span>
          </div>
        </div>

        {(isExecutable(mission.status) || mission.status === "completed") && (
          <StatusSteps status={mission.status} />
        )}

        <dl className="kv" style={{ marginTop: 14 }}>
          <dt>When</dt>
          <dd>{formatDateTime(mission.pickup_at)}</dd>
          <dt>Fare (now)</dt>
          <dd>{formatMoney(currentFare(mission))} · ceiling {formatMoney(mission.ceiling)}</dd>
          <dt>Vehicle</dt>
          <dd>
            {serviceClassLabel(mission.category, mission.required_body_type)}
            {mission.zone ? ` · ${mission.zone}` : ""}
          </dd>
          {mission.required_make && mission.required_model && (
            <>
              <dt>Specific car</dt>
              <dd>
                {mission.required_make} {mission.required_model}
              </dd>
            </>
          )}
          {tripMeta && (
            <>
              <dt>Trip</dt>
              <dd>{tripMeta}</dd>
            </>
          )}
          <dt>Guest</dt>
          <dd>{mission.passenger_name ?? "—"}</dd>
          {reference && (
            <>
              <dt>Reference</dt>
              <dd>{reference}</dd>
            </>
          )}
          <dt>Pax / luggage</dt>
          <dd>
            {mission.pax_count ?? "—"} pax · {mission.luggage_count ?? "—"} bags
          </dd>
          {mission.flight_number && (
            <>
              <dt>Flight</dt>
              <dd>
                {mission.flight_number}
                {flightEta ? ` · ETA ${flightEta}` : ""}
              </dd>
            </>
          )}
          <dt>Driver</dt>
          <dd>
            {driver ? (
              <>
                {driver.name}
                {driver.phone && (
                  <>
                    {" · "}
                    <a href={`tel:${driver.phone}`} className="dx-tel">
                      {driver.phone}
                    </a>
                  </>
                )}
              </>
            ) : (
              "Not assigned yet"
            )}
          </dd>
          {car && (carDesc || car.plate) && (
            <>
              <dt>Car</dt>
              <dd>
                {carDesc || "—"}
                {car.plate && <span className="mono"> · {car.plate}</span>}
              </dd>
            </>
          )}
        </dl>
      </div>
    </details>
  );
}
