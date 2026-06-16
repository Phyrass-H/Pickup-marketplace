import { createClient } from "@/lib/supabase/server";
import { getDriverContext } from "@/lib/driver";
import { MissionCard } from "@/components/mission-card";
import { categoryLabel } from "@/lib/format";

// The Pool changes constantly (PDP climbs, others accept) → never cache.
export const dynamic = "force-dynamic";

export default async function PoolPage() {
  const { driver, vehicle } = await getDriverContext();
  // Guarded by (app)/layout, but keep TypeScript happy.
  if (!driver || !vehicle) return null;

  const supabase = await createClient();

  // Pool = pooled missions matching the Driver's category AND one of their
  // zones. (RLS lets a Driver read any pooled mission; we narrow here — the
  // single place this filter lives, per IDEAS.md.)
  const { data: missions, error } = await supabase
    .from("mission")
    .select("*")
    .eq("status", "pooled")
    .eq("category", vehicle.category)
    .in("zone", driver.operational_zones)
    .order("pickup_at", { ascending: true });

  return (
    <>
      <h1>Pool</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        {categoryLabel(vehicle.category)} ·{" "}
        {driver.operational_zones.join(", ") || "no zones set"}
      </p>

      {error && (
        <div className="notice error">Couldn’t load the Pool: {error.message}</div>
      )}

      {!error && (!missions || missions.length === 0) && (
        <div className="empty">
          No missions available right now.
          <br />
          New {categoryLabel(vehicle.category)} missions in your zones will
          appear here.
        </div>
      )}

      {missions?.map((m) => (
        <MissionCard key={m.id} mission={m} />
      ))}
    </>
  );
}
