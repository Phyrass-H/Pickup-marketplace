import Link from "next/link";
import type { MissionRow } from "@/lib/database.types";
import { currentFare } from "@/lib/pdp";
import {
  categoryLabel,
  formatDateTime,
  formatMoney,
} from "@/lib/format";

// Presentational Pool card: live PDP fare, date/time, and the route.
export function MissionCard({ mission }: { mission: MissionRow }) {
  const fare = currentFare(mission);

  return (
    <Link href={`/missions/${mission.id}`} className="card">
      <div className="card-row">
        <span className="fare">{formatMoney(fare)}</span>
        <span style={{ display: "flex", gap: 6 }}>
          {mission.speed_win && <span className="badge speed">SPEED WIN</span>}
          <span className="badge">{categoryLabel(mission.category)}</span>
        </span>
      </div>

      <div className="muted small" style={{ marginTop: 4 }}>
        {formatDateTime(mission.pickup_at)}
        {mission.zone ? ` · ${mission.zone}` : ""}
      </div>

      <div className="route">
        <div className="leg">
          <span className="dot" />
          <span>{mission.pickup_address}</span>
        </div>
        <div className="leg">
          <span className="dot end" />
          <span>{mission.dropoff_address ?? "—"}</span>
        </div>
      </div>
    </Link>
  );
}
