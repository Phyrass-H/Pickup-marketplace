import Link from "next/link";
import { Building2, ChevronRight, Route, Handshake } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDriverContext } from "@/lib/driver";
import { currentFare } from "@/lib/pdp";
import { formatMoney, formatPoolWhen, missionStatusLabel, addressLine } from "@/lib/format";
import type { MissionStatus } from "@/lib/database.types";
import { parseWaypoints } from "@/lib/waypoints";
import { progressDone, progressSegments } from "@/lib/mission-flow";
import { statusPill, progressCaption } from "@/components/mission-run-view";

export const dynamic = "force-dynamic";

// My Rides holds the LIVE work: trips the Driver is running or is about to. Finished
// trips move to History (/rides/history), so this list stays short and current.
const ACTIVE_STATUSES: MissionStatus[] = [
  "accepted",
  "confirmed",
  "en_route",
  "arrived",
  "on_board",
];

export default async function RidesPage() {
  const { driver } = await getDriverContext();
  if (!driver) return null;

  const supabase = await createClient();
  const { data: missions, error } = await supabase
    .from("mission")
    .select("*")
    .eq("driver_id", driver.id)
    .in("status", ACTIVE_STATUSES)
    .order("pickup_at", { ascending: true });

  // Business name for the card foot, and a "needs your answer" flag when a change or
  // release is pending — both revealed/queried only for THIS Driver's trips. The
  // actual accept/decline lives on the mission page now; the list just points there.
  const bizNames = new Map<string, string>();
  const pending = new Map<string, "amendment" | "release">();
  if (missions && missions.length > 0) {
    const admin = createAdminClient();
    const ids = missions.map((m) => m.id);
    const bizIds = [...new Set(missions.map((m) => m.business_id))];

    const [{ data: businesses }, { data: amds }, { data: rels }] = await Promise.all([
      admin.from("business").select("id, name").in("id", bizIds),
      supabase.from("mission_amendment").select("mission_id").in("mission_id", ids).eq("status", "proposed"),
      supabase.from("mission_release").select("mission_id").in("mission_id", ids).eq("status", "proposed"),
    ]);
    for (const b of businesses ?? []) bizNames.set(b.id, b.name);
    // A change or release is answerable ONLY while accepted/confirmed (the RPCs reject any
    // later status), so the flag must not nag once the trip is under way — mirrors the
    // mission page's own guard. Amendment takes priority in the label.
    const answerable = new Set(
      (missions ?? [])
        .filter((m) => m.status === "accepted" || m.status === "confirmed")
        .map((m) => m.id),
    );
    for (const r of rels ?? []) if (answerable.has(r.mission_id)) pending.set(r.mission_id, "release");
    for (const a of amds ?? []) if (answerable.has(a.mission_id)) pending.set(a.mission_id, "amendment");
  }

  return (
    <>
      <div className="card-row" style={{ alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>My Rides</h1>
        <Link href="/rides/history" className="small muted" style={{ textDecoration: "underline" }}>
          History →
        </Link>
      </div>

      {error && (
        <div className="notice error">Couldn’t load your rides: {error.message}</div>
      )}

      {!error && (!missions || missions.length === 0) && (
        <div className="empty">
          No active or upcoming rides.
          <br />
          <Link href="/pool" className="muted" style={{ textDecoration: "underline" }}>
            Browse the Pool →
          </Link>
        </div>
      )}

      {missions?.map((m) => {
        const stops = parseWaypoints(m.waypoints);
        const stopsReached = m.stops_reached ?? 0;
        const when = formatPoolWhen(m.pickup_at);
        const { tone, Icon: PillIcon } = statusPill(m);
        const segments = progressSegments(stops.length);
        const done = progressDone(m.status, stops.length, stopsReached);
        const caption =
          m.status === "accepted"
            ? "Awaiting Lock-in"
            : progressCaption(m.status, stops.length, stopsReached);
        const flag = pending.get(m.id);

        return (
          <Link href={`/missions/${m.id}`} className="dcard ridecard" key={m.id}>
            <div className="pcard__head">
              <span className={`dpill dpill--${tone}`}>
                <PillIcon size={13} strokeWidth={1.75} aria-hidden="true" />
                {m.no_show ? "No-show" : missionStatusLabel(m.status)}
              </span>
              <span className="pcard__when">
                <span className={when.today ? "pcard__day pcard__day--today" : "pcard__day"}>
                  {when.day}
                </span>
                <span className="pcard__time">{when.time}</span>
              </span>
            </div>

            <div className="pcard__body">
              <div className="dprog__row">
                <span className="dprog__now">{caption}</span>
                <ChevronRight className="ridecard__chev" size={18} aria-hidden="true" />
              </div>
              <div className="dprog__bar" role="img" aria-label={`Trip progress: ${caption}`}>
                {segments.map((seg, i) => (
                  <span
                    key={seg.key}
                    className={i < done ? "dprog__seg dprog__seg--on" : "dprog__seg"}
                  />
                ))}
              </div>

              {flag && (
                <div className="ridecard__flag">
                  {flag === "amendment" ? (
                    <>
                      <Route aria-hidden="true" />A change is waiting for your answer
                    </>
                  ) : (
                    <>
                      <Handshake aria-hidden="true" />A release is waiting for your answer
                    </>
                  )}
                </div>
              )}

              <div className="proute">
                <div className="proute__leg">
                  <span className="proute__rail">
                    <span className="proute__line" />
                    <span className="proute__dot proute__dot--from" />
                  </span>
                  <span className="proute__addr proute__addr--from proute__addr--pad">
                    {addressLine(m.pickup_address)}
                  </span>
                </div>
                {stops.length > 0 && (
                  <div className="proute__leg">
                    <span className="proute__rail">
                      <span className="proute__line" />
                      <span className="proute__dot proute__dot--stop" />
                    </span>
                    <span className="proute__addr proute__addr--stop proute__addr--pad">
                      {stops.length} stop{stops.length === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
                <div className="proute__leg proute__leg--last">
                  <span className="proute__rail">
                    <span className="proute__dot proute__dot--to" />
                  </span>
                  <span className="proute__addr proute__addr--to">
                    {addressLine(m.dropoff_address ?? "—")}
                  </span>
                </div>
              </div>
            </div>

            <div className="pcard__foot">
              <span className="pcard__facts">
                <Building2 size={13} aria-hidden="true" />
                {bizNames.get(m.business_id) ?? "—"}
                <span className="pcard__veh">{formatMoney(currentFare(m))}</span>
              </span>
            </div>
          </Link>
        );
      })}
    </>
  );
}
