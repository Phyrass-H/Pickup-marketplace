import Link from "next/link";
import type { MissionRow } from "@/lib/database.types";
import { currentFare } from "@/lib/pdp";
import { tripDistanceKm } from "@/lib/geo";
import { parseWaypoints } from "@/lib/waypoints";
import {
  formatDateTime,
  formatMoney,
  formatTripMeta,
  serviceClassLabel,
} from "@/lib/format";

// Presentational Pool card: live PDP fare, date/time, ETA (road distance +
// travel time when cached, else straight-line), and the route.
export function MissionCard({ mission }: { mission: MissionRow }) {
  const fare = currentFare(mission);
  const straightKm = tripDistanceKm(
    mission.pickup_lat,
    mission.pickup_lng,
    mission.dropoff_lat,
    mission.dropoff_lng,
  );
  const meta = formatTripMeta(mission.distance_km, mission.duration_min, straightKm);
  const stops = parseWaypoints(mission.waypoints).length;

  return (
    <Link href={`/missions/${mission.id}`} className="card">
      <div className="card-row">
        <span className="fare">{formatMoney(fare)}</span>
        <span style={{ display: "flex", gap: 6 }}>
          {mission.speed_win && <span className="badge speed">SPEED WIN</span>}
          <span className="badge">
            {serviceClassLabel(mission.category, mission.required_body_type)}
          </span>
        </span>
      </div>

      <div className="muted small" style={{ marginTop: 4 }}>
        {formatDateTime(mission.pickup_at)}
        {meta ? ` · ${meta}` : ""}
        {mission.zone ? ` · ${mission.zone}` : ""}
      </div>

      <div className="route">
        <div className="leg">
          <span className="dot" />
          <span>{mission.pickup_address}</span>
        </div>
        {stops > 0 && (
          <div className="leg">
            <span className="dot" style={{ background: "#98a2b3" }} />
            <span className="muted">
              +{stops} stop{stops === 1 ? "" : "s"}
            </span>
          </div>
        )}
        <div className="leg">
          <span className="dot end" />
          <span>{mission.dropoff_address ?? "—"}</span>
        </div>
      </div>
    </Link>
  );
}
