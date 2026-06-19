import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/app-context";
import { formatMonth } from "@/lib/format";
import { parisDayKey } from "@/lib/dispatch-status";
import { TripRow, type DriverContact } from "@/components/trip-row";
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

export default async function DispatchHistory() {
  const ctx = await getAppContext();
  if (!ctx.business) return null;

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data: missions, error } = await supabase
    .from("mission")
    .select("*")
    .eq("business_id", ctx.business.id)
    .neq("status", "draft")
    .lt("pickup_at", nowIso)
    .order("pickup_at", { ascending: false });

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

  // Group by Paris month, newest first.
  const groups = new Map<string, MissionRow[]>();
  for (const m of missions ?? []) {
    const key = parisDayKey(m.pickup_at).slice(0, 7);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(m);
  }

  const isEmpty = !error && (!missions || missions.length === 0);

  return (
    <>
      {error && (
        <div className="notice error">Couldn’t load your history: {error.message}</div>
      )}

      {isEmpty && <div className="empty">No past missions yet.</div>}

      {[...groups.entries()].map(([monthKey, list]) => (
        <section key={monthKey}>
          <div className="dx-day">
            <h2 style={{ textTransform: "capitalize" }}>{formatMonth(monthKey)}</h2>
            <span className="dx-count">
              {list.length} trip{list.length === 1 ? "" : "s"}
            </span>
          </div>
          <ColumnHead />
          {list.map((m) => (
            <TripRow key={m.id} mission={m} driver={contacts.get(m.id) ?? null} archived />
          ))}
        </section>
      ))}
    </>
  );
}
