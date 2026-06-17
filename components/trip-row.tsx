import type { MissionRow, Waypoint } from "@/lib/database.types";
import { currentFare } from "@/lib/pdp";
import {
  categoryLabel,
  formatDateTime,
  formatMoney,
  formatTime,
} from "@/lib/format";
import { missionTone, TONE_BG, TONE_COLOR } from "@/lib/dispatch-status";
import { isExecutable } from "@/lib/mission-flow";
import { StatusSteps } from "@/components/status-steps";

export interface DriverContact {
  name: string;
  phone: string | null;
}

function parseWaypoints(raw: unknown): Waypoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (w): w is Waypoint =>
      typeof w === "object" && w !== null && typeof (w as Waypoint).address === "string",
  );
}

// One dense schedule line. Click to expand full detail. The colored left edge +
// status pill are the at-a-glance signal a hotel scans (red = needs a call).
export function TripRow({
  mission,
  driver,
}: {
  mission: MissionRow;
  driver?: DriverContact | null;
}) {
  const t = missionTone(mission);
  const reference = mission.comment?.trim() || null;
  const waypoints = parseWaypoints(mission.waypoints);

  return (
    <details
      className="trip"
      style={{ "--row-accent": TONE_COLOR[t.tone] } as React.CSSProperties}
    >
      <summary>
        <span className="trip-time">{formatTime(mission.pickup_at)}</span>

        <span className="trip-route">
          <span>{mission.pickup_address}</span>
          <span className="arrow">→</span>
          <span>{mission.dropoff_address ?? "—"}</span>
        </span>

        <span className="trip-meta">
          {mission.passenger_name ?? "—"}
          {reference && <span className="ref">{reference}</span>}
        </span>

        <span className="trip-driver">
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

      <div className="trip-detail">
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
          <dd>{categoryLabel(mission.category)}{mission.zone ? ` · ${mission.zone}` : ""}</dd>
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
              <dd>{mission.flight_number}</dd>
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
                    <a href={`tel:${driver.phone}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
                      {driver.phone}
                    </a>
                  </>
                )}
              </>
            ) : (
              "Not assigned yet"
            )}
          </dd>
        </dl>
      </div>
    </details>
  );
}
