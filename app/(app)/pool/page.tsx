import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDriverContext } from "@/lib/driver";
import { MissionCard } from "@/components/mission-card";
import { serviceClassLabel } from "@/lib/format";
import { withinRadius } from "@/lib/geo";

// The Pool changes constantly (PDP climbs, others accept) → never cache.
export const dynamic = "force-dynamic";

export default async function PoolPage() {
  const { driver, vehicle } = await getDriverContext();
  // Guarded by (app)/layout, but keep TypeScript happy.
  if (!driver || !vehicle) return null;

  // No base yet → can't match by distance. Send them to set it.
  if (driver.base_lat == null || driver.base_lng == null) {
    return (
      <>
        <h1>Pool</h1>
        <div className="empty">
          Set your base and service radius to see matching missions.
          <br />
          <Link href="/settings" style={{ textDecoration: "underline" }}>
            Go to Settings →
          </Link>
        </div>
      </>
    );
  }

  const supabase = await createClient();

  // Pool = pooled missions matching the Driver's category. RLS lets a Driver
  // read any pooled mission; we then keep those whose pickup OR dropoff falls
  // within the Driver's service radius of their base — the single place this
  // filter lives (IDEAS.md). (Beta scale: filter in app; add a bounding-box /
  // PostGIS prefilter later if the Pool grows large.)
  const { data: all, error } = await supabase
    .from("mission")
    .select("*")
    .eq("status", "pooled")
    .eq("category", vehicle.category)
    .order("pickup_at", { ascending: true });

  const radius = driver.service_radius_km ?? 50;
  const driverMake = (vehicle.make ?? "").trim().toLowerCase();
  const driverModel = (vehicle.model ?? "").trim().toLowerCase();
  const missions = (all ?? []).filter((m) => {
    const inRange =
      withinRadius(driver.base_lat!, driver.base_lng!, radius, m.pickup_lat, m.pickup_lng) ||
      withinRadius(driver.base_lat!, driver.base_lng!, radius, m.dropoff_lat, m.dropoff_lng);
    if (!inRange) return false;
    // Body: a mission that demands a body type must match the Driver's vehicle.
    if (m.required_body_type && m.required_body_type !== vehicle.body_type) return false;
    // Specific car: when required, only the exact make + model qualifies.
    if (m.required_make && m.required_model) {
      if (driverMake !== m.required_make.trim().toLowerCase()) return false;
      if (driverModel !== m.required_model.trim().toLowerCase()) return false;
    }
    return true;
  });

  return (
    <>
      <h1>Pool</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        {serviceClassLabel(vehicle.category, vehicle.body_type)} · within {radius} km of{" "}
        {driver.base_label ?? "your base"}
      </p>

      {error && (
        <div className="notice error">Couldn’t load the Pool: {error.message}</div>
      )}

      {!error && missions.length === 0 && (
        <div className="empty">
          No missions available right now.
          <br />
          New {serviceClassLabel(vehicle.category, vehicle.body_type)} missions within {radius} km of your
          base will appear here.
        </div>
      )}

      {missions.map((m) => (
        <MissionCard key={m.id} mission={m} />
      ))}
    </>
  );
}
