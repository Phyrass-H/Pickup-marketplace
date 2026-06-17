import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/app-context";
import { formatDate } from "@/lib/format";
import { parisDayKey } from "@/lib/dispatch-status";
import { DispatchTabs } from "@/components/dispatch-tabs";
import { LiveRefresh } from "@/components/live-refresh";
import { TripRow, type DriverContact } from "@/components/trip-row";
import type { MissionRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

function ColumnHead() {
  return (
    <div className="col-head">
      <span>Time</span>
      <span>Route</span>
      <span>Client / ref</span>
      <span>Driver</span>
      <span>Status</span>
    </div>
  );
}

function DayGroup({
  dayKey,
  missions,
  contacts,
  today,
}: {
  dayKey: string;
  missions: MissionRow[];
  contacts: Map<string, DriverContact>;
  today?: boolean;
}) {
  return (
    <section>
      <div className={`day-head${today ? " today" : ""}`}>
        <h2>{today ? "Today · " : ""}{formatDate(`${dayKey}T12:00:00`)}</h2>
        <span className="count">
          {missions.length} trip{missions.length === 1 ? "" : "s"}
        </span>
      </div>
      {missions.map((m) => (
        <TripRow key={m.id} mission={m} driver={contacts.get(m.id) ?? null} />
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
    .order("pickup_at", { ascending: true });

  // Reveal assigned Driver contacts (service role, gated to this business).
  const contacts = new Map<string, DriverContact>();
  const assigned = (missions ?? []).filter((m) => m.driver_id);
  if (assigned.length > 0) {
    const admin = createAdminClient();
    const driverIds = [...new Set(assigned.map((m) => m.driver_id!))];
    const { data: drivers } = await admin
      .from("driver")
      .select("id, first_name, last_name, phone")
      .in("id", driverIds);
    const byId = new Map((drivers ?? []).map((d) => [d.id, d]));
    for (const m of assigned) {
      const d = byId.get(m.driver_id!);
      if (d) contacts.set(m.id, { name: `${d.first_name} ${d.last_name}`, phone: d.phone });
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
    <main className="container wide">
      <DispatchTabs />
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
          <DayGroup dayKey={todayKey} missions={todayMissions} contacts={contacts} today />
          {todayMissions.length === 0 && (
            <p className="muted small" style={{ margin: "0 0 8px 2px" }}>
              No trips today.
            </p>
          )}

          {futureKeys.map((k) => (
            <DayGroup key={k} dayKey={k} missions={groups.get(k)!} contacts={contacts} />
          ))}

          {pastKeys.length > 0 && (
            <details style={{ marginTop: 20 }}>
              <summary className="muted small" style={{ cursor: "pointer" }}>
                Earlier trips ({pastKeys.reduce((n, k) => n + groups.get(k)!.length, 0)})
              </summary>
              <div style={{ marginTop: 8 }}>
                {pastKeys.map((k) => (
                  <DayGroup key={k} dayKey={k} missions={groups.get(k)!} contacts={contacts} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </main>
  );
}
