import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDriverContext } from "@/lib/driver";
import { currentFare } from "@/lib/pdp";
import { tripDistanceKm } from "@/lib/geo";
import { parseWaypoints } from "@/lib/waypoints";
import {
  formatDateTime,
  formatMoney,
  formatTripMeta,
  serviceClassLabel,
} from "@/lib/format";
import { AcceptButton } from "./accept-button";

export const dynamic = "force-dynamic";

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { driver } = await getDriverContext();
  const supabase = await createClient();

  const { data: mission } = await supabase
    .from("mission")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!mission) notFound();

  const isMine = !!driver && mission.driver_id === driver.id;
  const isPooled = mission.status === "pooled";
  const fare = currentFare(mission);
  const waypoints = parseWaypoints(mission.waypoints);
  const distanceKm = tripDistanceKm(
    mission.pickup_lat,
    mission.pickup_lng,
    mission.dropoff_lat,
    mission.dropoff_lng,
  );
  const tripMeta = formatTripMeta(mission.distance_km, mission.duration_min, distanceKm);

  return (
    <>
      <p className="small">
        <Link href="/pool" className="muted">
          ← Back to Pool
        </Link>
      </p>

      <div className="card-row">
        <span className="fare" style={{ fontSize: 26 }}>
          {formatMoney(fare)}
        </span>
        <span style={{ display: "flex", gap: 6 }}>
          {mission.speed_win && <span className="badge speed">SPEED WIN</span>}
          <span className="badge">
            {serviceClassLabel(mission.category, mission.required_body_type)}
          </span>
        </span>
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        {formatDateTime(mission.pickup_at)}
        {mission.zone ? ` · ${mission.zone}` : ""}
      </p>

      <div className="card">
        <div className="card-row" style={{ alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>Route</h2>
          {tripMeta && <span className="muted small">{tripMeta}</span>}
        </div>
        <div className="route">
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
      </div>

      <div className="card">
        <h2>Details</h2>
        <dl className="kv">
          <dt>Passengers</dt>
          <dd>{mission.pax_count ?? "—"}</dd>
          <dt>Luggage</dt>
          <dd>{mission.luggage_count ?? "—"}</dd>
          {mission.flight_number && (
            <>
              <dt>Flight</dt>
              <dd>{mission.flight_number}</dd>
            </>
          )}
          {mission.comment && (
            <>
              <dt>Comment</dt>
              <dd>{mission.comment}</dd>
            </>
          )}
        </dl>
        <p className="muted small" style={{ marginTop: 12 }}>
          Guest name and contact details are revealed once you accept.
        </p>
      </div>

      {isPooled ? (
        <AcceptButton missionId={mission.id} />
      ) : isMine ? (
        <Link href="/rides" className="btn secondary">
          You’ve accepted this — open My Rides
        </Link>
      ) : (
        <div className="notice warn">
          This mission is no longer available in the Pool.
        </div>
      )}
    </>
  );
}
