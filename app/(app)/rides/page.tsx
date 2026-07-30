import Link from "next/link";
import { Building2, Car, ChevronRight, CircleCheck, Layers, Route, Handshake } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDriverContext } from "@/lib/driver";
import { settledFare } from "@/lib/pdp";
import {
  formatDayGroup,
  formatMoney,
  formatPoolWhen,
  missionStatusLabel,
  addressLine,
} from "@/lib/format";
import { checkInOpen, parisDayKey } from "@/lib/dispatch-status";
import type { MissionRow, MissionStatus } from "@/lib/database.types";
import { parseWaypoints } from "@/lib/waypoints";
import { progressDone, progressSegments } from "@/lib/mission-flow";
import { statusPill, progressCaption } from "@/components/mission-run-view";
import { RidesTabs } from "@/components/rides-tabs";

export const dynamic = "force-dynamic";

// My Rides holds the LIVE work: trips the Driver is running or is about to. Finished
// trips move to the Past tab (/rides/history), so this list stays short and current.
const ACTIVE_STATUSES: MissionStatus[] = [
  "accepted",
  "confirmed",
  "en_route",
  "arrived",
  "on_board",
];
const PAST_STATUSES: MissionStatus[] = ["completed", "cancelled"];

export default async function RidesPage() {
  const { driver } = await getDriverContext();
  if (!driver) return null;

  const supabase = await createClient();
  const [{ data: missions, error }, { count: pastCount }] = await Promise.all([
    supabase
      .from("mission")
      .select("*")
      .eq("driver_id", driver.id)
      .in("status", ACTIVE_STATUSES)
      .order("pickup_at", { ascending: true }),
    // Just the number for the Past tab — no rows travel over the wire.
    supabase
      .from("mission")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", driver.id)
      .in("status", PAST_STATUSES),
  ]);

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

  // Day separators: consecutive runs of the same Paris calendar day. The query is
  // already ordered by pickup_at, so a single pass keeps the groups in order.
  const groups: { key: string; label: string; today: boolean; items: MissionRow[] }[] = [];
  for (const m of missions ?? []) {
    const key = parisDayKey(m.pickup_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(m);
    } else {
      const { label, today } = formatDayGroup(m.pickup_at);
      groups.push({ key, label, today, items: [m] });
    }
  }

  return (
    <>
      <h1 className="rhead">My Rides</h1>
      <RidesTabs active="upcoming" upcoming={missions?.length ?? 0} past={pastCount ?? 0} />

      {error && (
        <div className="notice error" style={{ marginTop: 14 }}>
          Couldn’t load your rides: {error.message}
        </div>
      )}

      {!error && groups.length === 0 && (
        <div className="pempty">
          <span className="pempty__ic">
            <Car size={26} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p className="pempty__t">Nothing on your schedule</p>
          <p className="pempty__s">Trips you accept from the Pool land here, soonest first.</p>
          <Link href="/pool" className="pempty__cta">
            <Layers size={17} strokeWidth={1.75} aria-hidden="true" />
            Browse the Pool
          </Link>
        </div>
      )}

      {groups.map((g, gi) => (
        <section key={g.key}>
          <div
            className={[
              "dday",
              g.today ? "dday--today" : "",
              gi === 0 ? "dday--first" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <h2 className="dday__l">{g.label}</h2>
            <span className="dday__n">
              {g.items.length} ride{g.items.length === 1 ? "" : "s"}
            </span>
          </div>

          {g.items.map((m) => {
            const stops = parseWaypoints(m.waypoints);
            const stopsReached = m.stops_reached ?? 0;
            const when = formatPoolWhen(m.pickup_at);
            const { tone, Icon: PillIcon } = statusPill(m);
            const segments = progressSegments(stops.length);
            const done = progressDone(m.status, stops.length, stopsReached);
            const caption = progressCaption(m.status, stops.length, stopsReached);
            const flag = pending.get(m.id);

            return (
              <Link href={`/missions/${m.id}`} className="dcard ridecard" key={m.id}>
                <div className="pcard__head">
                  <span className={`dpill dpill--${tone}`}>
                    {PillIcon && <PillIcon size={13} strokeWidth={1.75} aria-hidden="true" />}
                    {m.no_show ? "No-show" : missionStatusLabel(m.status)}
                  </span>
                  {/* Just the time: the day separator above already says which
                      day this is, so repeating it on every card is noise. */}
                  <span className="pcard__when">
                    <span className="pcard__time pcard__time--lg">{when.time}</span>
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

                  {/* D61 — the list stays a pure tap-through ([[d53]]), so this is
                      a flag and not a button: the card is one big <Link> and the
                      real Check in sits on the trip's own page. */}
                  {checkInOpen(m) && (
                    <div className="ridecard__flag">
                      <CircleCheck aria-hidden="true" />
                      Check in to confirm you’ll be there
                    </div>
                  )}

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
                    <span className="pcard__veh">{formatMoney(settledFare(m))}</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      ))}
    </>
  );
}
