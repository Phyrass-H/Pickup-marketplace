import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/app-context";
import { formatDate } from "@/lib/format";
import { parisDayKey } from "@/lib/dispatch-status";
import { LiveRefresh } from "@/components/live-refresh";
import { ScrollToTrip } from "@/components/scroll-to-trip";
import { TripRow, type DriverContact, type AmendmentBrief } from "@/components/trip-row";
import { parseGuestContacts, type GuestContact } from "@/lib/passengers";
import { parseWaypoints } from "@/lib/waypoints";
import {
  parseFromSnapshot,
  routeDiff,
  changeSummary,
  declineReasonLabel,
} from "@/lib/amendments";
import type { MissionRow, MissionAmendmentRow } from "@/lib/database.types";

// Reduce a stored amendment to the compact brief the schedule row renders.
function buildBrief(a: MissionAmendmentRow): AmendmentBrief {
  const from = parseFromSnapshot(a.from_snapshot);
  const diff = routeDiff(
    { pickup: from.pickup_address, dropoff: from.dropoff_address, waypoints: from.waypoints },
    {
      pickup: a.new_pickup_address,
      dropoff: a.new_dropoff_address,
      waypoints: parseWaypoints(a.new_waypoints),
    },
  );
  return {
    id: a.id,
    status: a.status,
    summary: changeSummary(diff),
    fareOld: from.fare,
    fareNew: Number(a.new_fare),
    declineReason: declineReasonLabel(a.decline_reason),
    at: a.responded_at ?? a.created_at,
  };
}

export const dynamic = "force-dynamic";

function ColumnHead() {
  return (
    <div className="dx-colhead">
      <span>Time</span>
      <span>Route</span>
      <span>Flight</span>
      <span>Guest</span>
      <span>Ref</span>
      <span>Driver</span>
      <span>Status</span>
    </div>
  );
}

function DayGroup({
  dayKey,
  missions,
  contacts,
  guestContacts,
  amendments,
  today,
}: {
  dayKey: string;
  missions: MissionRow[];
  contacts: Map<string, DriverContact>;
  guestContacts: Map<string, GuestContact[]>;
  amendments: Map<string, AmendmentBrief>;
  today?: boolean;
}) {
  return (
    // The id lets the calendar's "Open day in Schedule" land on this band.
    <section id={`day-${dayKey}`}>
      <div className={`dx-day${today ? " dx-day--today" : ""}`}>
        <h2>{today ? "Today · " : ""}{formatDate(`${dayKey}T12:00:00`)}</h2>
        <span className="dx-count">
          {missions.length} trip{missions.length === 1 ? "" : "s"}
        </span>
      </div>
      {missions.map((m) => (
        <TripRow
          key={m.id}
          mission={m}
          driver={contacts.get(m.id) ?? null}
          guestContacts={guestContacts.get(m.id) ?? null}
          amendment={amendments.get(m.id) ?? null}
        />
      ))}
    </section>
  );
}

export default async function DispatchSchedule({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; day?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx.business) return null;
  const { open, day } = await searchParams;

  const supabase = await createClient();
  const { data: missions, error } = await supabase
    .from("mission")
    .select("*")
    .eq("business_id", ctx.business.id)
    .neq("status", "draft") // drafts live on their own page, not the schedule
    .order("pickup_at", { ascending: true });

  // Reveal assigned Driver contacts + car (service role, gated to this business).
  const contacts = new Map<string, DriverContact>();
  const assigned = (missions ?? []).filter((m) => m.driver_id);
  if (assigned.length > 0) {
    const admin = createAdminClient();
    const driverIds = [...new Set(assigned.map((m) => m.driver_id!))];
    const [{ data: drivers }, { data: vehicles }] = await Promise.all([
      admin.from("driver").select("id, first_name, last_name, phone").in("id", driverIds),
      admin.from("vehicle").select("driver_id, make, model, colour, plate").in("driver_id", driverIds),
    ]);
    const byId = new Map((drivers ?? []).map((d) => [d.id, d]));
    const vehByDriver = new Map((vehicles ?? []).map((v) => [v.driver_id, v]));
    for (const m of assigned) {
      const d = byId.get(m.driver_id!);
      if (d)
        contacts.set(m.id, {
          name: `${d.first_name} ${d.last_name}`,
          phone: d.phone,
          vehicle: vehByDriver.get(d.id) ?? null,
        });
    }
  }

  // Guest phone numbers (side table, RLS-scoped to this Business). Drivers can't
  // read these; the Share switch in each row controls reveal to the assigned Driver.
  const guestContacts = new Map<string, GuestContact[]>();
  const missionIds = (missions ?? []).map((m) => m.id);
  if (missionIds.length > 0) {
    const { data: gc } = await supabase
      .from("mission_guest_contact")
      .select("mission_id, contacts")
      .in("mission_id", missionIds);
    for (const r of gc ?? []) {
      guestContacts.set(r.mission_id, parseGuestContacts(r.contacts));
    }
  }

  // Amendments (D39 Phase 2): the latest live proposal / decline / accept per
  // mission, for the schedule's "Change pending / declined / accepted" states.
  // RLS scopes to this Business's own missions.
  const amendments = new Map<string, AmendmentBrief>();
  if (missionIds.length > 0) {
    const { data: ams } = await supabase
      .from("mission_amendment")
      .select("*")
      .in("mission_id", missionIds)
      .neq("status", "superseded")
      .order("created_at", { ascending: false });
    const seen = new Set<string>();
    for (const a of ams ?? []) {
      if (seen.has(a.mission_id)) continue; // keep only the latest per mission
      seen.add(a.mission_id);
      amendments.set(a.mission_id, buildBrief(a));
    }
  }

  // Group by Paris day; split into today / future / past.
  const todayKey = parisDayKey(new Date());
  const groups = new Map<string, MissionRow[]>();
  for (const m of missions ?? []) {
    const k = parisDayKey(m.pickup_at);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(m);
  }
  const keys = [...groups.keys()];
  const futureKeys = keys.filter((k) => k > todayKey).sort();
  const pastKeys = keys.filter((k) => k < todayKey).sort().reverse();
  const todayMissions = groups.get(todayKey) ?? [];

  const isEmpty = !error && (!missions || missions.length === 0);

  return (
    <>
      <LiveRefresh />
      {(open || day) && <ScrollToTrip missionId={open} dayKey={day} />}

      {error && (
        <div className="notice error">Couldn’t load your schedule: {error.message}</div>
      )}

      {isEmpty && (
        <div className="empty">
          No missions yet.
          <br />
          <Link href="/dispatch/new" style={{ textDecoration: "underline" }}>
            Post your first mission →
          </Link>
        </div>
      )}

      {!isEmpty && (
        <>
          <div className="dx-sched">
            <ColumnHead />

            {/* Today is always shown and pinned on top. */}
            <DayGroup
              dayKey={todayKey}
              missions={todayMissions}
              contacts={contacts}
              guestContacts={guestContacts}
              amendments={amendments}
              today
            />
            {todayMissions.length === 0 && (
              <p className="muted small" style={{ margin: 0, padding: "10px 16px" }}>
                No trips today.
              </p>
            )}

            {futureKeys.map((k) => (
              <DayGroup
                key={k}
                dayKey={k}
                missions={groups.get(k)!}
                contacts={contacts}
                guestContacts={guestContacts}
                amendments={amendments}
              />
            ))}
          </div>

          {pastKeys.length > 0 && (
            <details>
              <summary className="dx-fold" style={{ cursor: "pointer", listStyle: "none" }}>
                Earlier trips ({pastKeys.reduce((n, k) => n + groups.get(k)!.length, 0)})
              </summary>
              <div className="dx-sched" style={{ marginTop: 8 }}>
                <ColumnHead />
                {pastKeys.map((k) => (
                  <DayGroup
                    key={k}
                    dayKey={k}
                    missions={groups.get(k)!}
                    contacts={contacts}
                    guestContacts={guestContacts}
                    amendments={amendments}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </>
  );
}
