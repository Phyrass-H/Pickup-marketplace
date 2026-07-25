import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Clock,
  Zap,
  Route,
  Car,
  Luggage,
  Users,
  Plane,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDriverContext } from "@/lib/driver";
import { currentFare } from "@/lib/pdp";
import { tripDistanceKm } from "@/lib/geo";
import { parseWaypoints } from "@/lib/waypoints";
import {
  formatMoney,
  formatTripMeta,
  formatPoolWhen,
  serviceClassLabel,
  addressLine,
} from "@/lib/format";
import { parseLanguages, dressCodeLabel, activeFlagLabels } from "@/lib/driver-service";
import { AcceptButton } from "./accept-button";

export const dynamic = "force-dynamic";

// Mission detail, pre-accept: "the Pool card, opened". It deliberately reuses the
// S43 Pool-card shape — price + when → mission type / SPEED WIN → route rail →
// trip facts — so a Driver recognises the same object they just tapped. What the
// card had to compress opens up here: every stop shows its full address instead of
// a "+N", and the service requests get their own rows. The page is free to scroll;
// what's still hidden (Guest, name board, private message) is named, not teased.
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
  const isHourly = mission.mission_type === "hourly";
  const fare = currentFare(mission);
  const when = formatPoolWhen(mission.pickup_at);
  const waypoints = parseWaypoints(mission.waypoints);
  const distanceKm = tripDistanceKm(
    mission.pickup_lat,
    mission.pickup_lng,
    mission.dropoff_lat,
    mission.dropoff_lng,
  );
  const tripMeta = formatTripMeta(mission.distance_km, mission.duration_min, distanceKm);
  const vehicle = serviceClassLabel(mission.category, mission.required_body_type);
  const languages = parseLanguages(mission.required_languages);
  const dressLabel = dressCodeLabel(mission.dress_code);
  const flagLabels = activeFlagLabels(mission.driver_flags);
  const hasChips = languages.length > 0 || !!dressLabel || flagLabels.length > 0;

  // Same rail as the Pool card, uncollapsed: pickup → every stop → drop-off. An
  // at-disposal (hourly) trip has no fixed drop-off, so it ends at the pickup.
  type Leg = { kind: "from" | "stop" | "to"; text: string };
  const legs: Leg[] = [{ kind: "from", text: addressLine(mission.pickup_address) }];
  for (const w of waypoints) legs.push({ kind: "stop", text: addressLine(w.address) });
  if (!isHourly && mission.dropoff_address) {
    legs.push({ kind: "to", text: addressLine(mission.dropoff_address) });
  }

  return (
    <>
      <p className="small">
        <Link href="/pool" className="muted">
          ← Back to Pool
        </Link>
      </p>

      <div className="dcard">
        <div className="pcard__head">
          <span className="pcard__fare">{formatMoney(fare)}</span>
          <span className="pcard__when">
            <span className={when.today ? "pcard__day pcard__day--today" : "pcard__day"}>
              {when.day}
            </span>
            <span className="pcard__time">{when.time}</span>
          </span>
        </div>

        <div className="pcard__body">
          <div className="pcard__badges">
            <span className="pbadge pbadge--type">
              {isHourly ? (
                <Clock size={13} strokeWidth={1.9} aria-hidden="true" />
              ) : (
                <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
              )}
              {isHourly ? "At disposal" : "Transfer"}
            </span>
            {mission.speed_win && (
              <span className="pbadge pbadge--speed">
                <Zap size={11} strokeWidth={2} aria-hidden="true" />
                SPEED WIN
              </span>
            )}
            {mission.luggage_only && (
              <span className="pbadge pbadge--run">
                <Luggage size={12} strokeWidth={1.9} aria-hidden="true" />
                Luggage run
              </span>
            )}
          </div>

          <div className="proute">
            {legs.map((leg, i) => {
              const last = i === legs.length - 1;
              return (
                <div key={i} className={last ? "proute__leg proute__leg--last" : "proute__leg"}>
                  <span className="proute__rail">
                    {!last && <span className="proute__line" />}
                    <span className={`proute__dot proute__dot--${leg.kind}`} />
                  </span>
                  <span
                    className={
                      `proute__addr proute__addr--${leg.kind}` +
                      (last ? "" : " proute__addr--pad")
                    }
                  >
                    {leg.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pcard__foot">
          <span className="pcard__facts">
            {isHourly ? (
              <Clock size={13} aria-hidden="true" />
            ) : (
              <Route size={13} aria-hidden="true" />
            )}
            {isHourly ? "Flexible route" : tripMeta || "—"}
            <span className="pcard__veh">
              <Car size={13} aria-hidden="true" />
              {vehicle}
            </span>
            {mission.zone && <span className="pcard__veh">{mission.zone}</span>}
          </span>
        </div>
      </div>

      <div className="dcard">
        <p className="dcard__label">Service</p>

        <div className="dfact">
          <span className="dfact__l">
            <Users size={16} strokeWidth={1.75} aria-hidden="true" />
            Passengers
          </span>
          <span className="dfact__v">
            {mission.luggage_only ? "None (luggage run)" : (mission.pax_count ?? "—")}
          </span>
        </div>

        <div className="dfact">
          <span className="dfact__l">
            <Luggage size={16} strokeWidth={1.75} aria-hidden="true" />
            Luggage
          </span>
          <span className="dfact__v">{mission.luggage_count ?? "—"}</span>
        </div>

        {mission.flight_number && (
          <div className="dfact">
            <span className="dfact__l">
              <Plane size={16} strokeWidth={1.75} aria-hidden="true" />
              Flight
            </span>
            <span className="dfact__v">{mission.flight_number}</span>
          </div>
        )}

        {hasChips && (
          <div className="dchips">
            {languages.map((l) => (
              <span className="dchip" key={l}>
                {l}
              </span>
            ))}
            {dressLabel && <span className="dchip">{dressLabel}</span>}
            {flagLabels.map((f) => (
              <span className="dchip" key={f}>
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {isPooled && (
        <p className="dlock">
          <Lock size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>Guest name, the name board and any private message unlock once you accept.</span>
        </p>
      )}

      {isPooled ? (
        <AcceptButton missionId={mission.id} />
      ) : isMine ? (
        <Link href="/rides" className="dcta dcta--ghost">
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
