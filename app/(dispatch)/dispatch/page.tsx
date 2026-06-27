import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/app-context";
import { formatDate } from "@/lib/format";
import { parisDayKey } from "@/lib/dispatch-status";
import { LiveRefresh } from "@/components/live-refresh";
import { TripRow, type DriverContact } from "@/components/trip-row";
import { parseGuestContacts, type GuestContact } from "@/lib/passengers";
import type { MissionRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

function ColumnHead() {
  return (
    <div className="dx-colhead">
      <span>Time</span>
      <span>Route</span>
      <span>Flight</span>
      <span>Guest / ref</span>
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
  today,
}: {
  dayKey: string;
  missions: MissionRow[];
  contacts: Map<string, DriverContact>;
  guestContacts: Map<string, GuestContact[]>;
  today?: boolean;
}) {
  return (
    <section>
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
        />
      ))}
    </section>
  );
}

export default async function DispatchSchedule() {
  const ctx = await getAppContext();
  if (!ctx.business) return null;

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
          <ColumnHead />

          {/* Today is always shown and pinned on top. */}
          <DayGroup
            dayKey={todayKey}
            missions={todayMissions}
            contacts={contacts}
            guestContacts={guestContacts}
            today
          />
          {todayMissions.length === 0 && (
            <p className="muted small" style={{ margin: "0 0 8px 2px" }}>
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
            />
          ))}

          {pastKeys.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary className="dx-fold" style={{ cursor: "pointer", listStyle: "none" }}>
                Earlier trips ({pastKeys.reduce((n, k) => n + groups.get(k)!.length, 0)})
              </summary>
              <div style={{ marginTop: 8 }}>
                {pastKeys.map((k) => (
                  <DayGroup
              key={k}
              dayKey={k}
              missions={groups.get(k)!}
              contacts={contacts}
              guestContacts={guestContacts}
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
