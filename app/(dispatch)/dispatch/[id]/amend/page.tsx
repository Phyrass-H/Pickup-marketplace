import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/app-context";
import { parseWaypoints } from "@/lib/waypoints";
import { currentFare } from "@/lib/pdp";
import { missionTone, TONE_BG, TONE_COLOR } from "@/lib/dispatch-status";
import {
  addressLine,
  formatDateTime,
  formatMoney,
  serviceClassLabel,
} from "@/lib/format";
import type { Place } from "@/components/address-autocomplete";
import { AmendForm } from "./amend-form";

export const dynamic = "force-dynamic";

// A change can be proposed only while a Driver holds the trip but hasn't started
// it. (Pooled → no Driver to consent, edit info instead. en_route+ → frozen.)
const AMENDABLE = ["accepted", "confirmed"];

const ERROR_COPY: Record<string, string> = {
  locked: "This trip can no longer be changed — the Driver may have started it.",
  missing: "Pick the pickup from the address suggestions so it stays located.",
  nodrop: "Pick a destination from the address suggestions.",
  fare: "Enter the new agreed fare.",
  db: "Couldn’t send the change. Please try again.",
};

export default async function AmendMissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const ctx = await getAppContext();
  if (!ctx.business) return null;

  const supabase = await createClient();
  const { data: mission } = await supabase
    .from("mission")
    .select("*")
    .eq("id", id)
    .eq("business_id", ctx.business.id)
    .neq("status", "draft")
    .maybeSingle();
  if (!mission) notFound();

  // Assigned Driver name + car (service role, gated to this Business's mission) —
  // shown in the locked header + the "what the Driver sees" preview.
  let driverName = "the Driver";
  let driverCar: string | null = null;
  if (mission.driver_id) {
    const admin = createAdminClient();
    const [{ data: d }, { data: v }] = await Promise.all([
      admin.from("driver").select("first_name, last_name").eq("id", mission.driver_id).maybeSingle(),
      admin.from("vehicle").select("make, model").eq("driver_id", mission.driver_id).maybeSingle(),
    ]);
    if (d) driverName = `${d.first_name} ${d.last_name}`.trim() || driverName;
    if (v) driverCar = [v.make, v.model].filter(Boolean).join(" ") || null;
  }

  const t = missionTone(mission);
  const amendable = AMENDABLE.includes(mission.status);
  const waypoints = parseWaypoints(mission.waypoints);
  const fare = currentFare(mission);

  const pickupDefault: Place | null =
    mission.pickup_lat != null && mission.pickup_lng != null
      ? { label: mission.pickup_address, lat: mission.pickup_lat, lng: mission.pickup_lng }
      : null;
  const dropoffDefault: Place | null =
    mission.dropoff_address && mission.dropoff_lat != null && mission.dropoff_lng != null
      ? { label: mission.dropoff_address, lat: mission.dropoff_lat, lng: mission.dropoff_lng }
      : null;
  const stopsDefault = waypoints.map((w) => ({
    label: w.address,
    lat: w.lat ?? null,
    lng: w.lng ?? null,
  }));
  const etaDefault =
    mission.distance_km != null && mission.duration_min != null
      ? { distanceKm: Number(mission.distance_km), durationMin: Number(mission.duration_min) }
      : null;

  return (
    <div className="ex-wrap am-wrap">
      <div className="ex-head">
        <h1 style={{ margin: 0 }}>Propose a change</h1>
        <Link href="/dispatch" className="ex-back">
          ← Back to schedule
        </Link>
      </div>
      <p className="muted" style={{ margin: "4px 0 16px" }}>
        {driverName} has accepted this trip, so a change to the route or fare needs their approval
        before it takes effect.
      </p>

      {error && ERROR_COPY[error] && (
        <div className="notice error" style={{ marginBottom: 14 }}>
          {ERROR_COPY[error]}
        </div>
      )}

      {/* The trip AS AGREED — context, not editable here. */}
      <div className="card ex-lock">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div className="route" style={{ flex: 1, minWidth: 0 }}>
            <div className="leg">
              <span className="dot" />
              <span>{addressLine(mission.pickup_address)}</span>
            </div>
            {waypoints.map((w, i) => (
              <div className="leg leg--stop" key={i}>
                <span className="dot mid" />
                <span className="leg-addr muted">{addressLine(w.address)}</span>
              </div>
            ))}
            <div className="leg">
              <span className="dot end" />
              <span>{mission.dropoff_address ? addressLine(mission.dropoff_address) : "—"}</span>
            </div>
          </div>
          <span className="status-pill" style={{ background: TONE_BG[t.tone], color: TONE_COLOR[t.tone] }}>
            <span className="dot" style={{ background: TONE_COLOR[t.tone] }} />
            {t.label}
          </span>
        </div>
        <div className="ex-meta">
          <span>{formatDateTime(mission.pickup_at)}</span>
          <span>
            {driverName}
            {driverCar ? ` · ${driverCar}` : ""}
          </span>
          <span>
            Agreed fare <b>{formatMoney(fare)}</b>
          </span>
        </div>
      </div>

      {amendable ? (
        <AmendForm
          missionId={mission.id}
          driverName={driverName}
          currentFare={fare}
          pickupDefault={pickupDefault}
          dropoffDefault={dropoffDefault}
          stopsDefault={stopsDefault}
          etaDefault={etaDefault}
          pickupAtIso={mission.pickup_at}
          fromDurationMin={mission.duration_min != null ? Number(mission.duration_min) : null}
          fromDistanceKm={mission.distance_km != null ? Number(mission.distance_km) : null}
          original={{
            pickup: mission.pickup_address,
            dropoff: mission.dropoff_address,
            waypoints,
          }}
        />
      ) : (
        <div className="notice info" style={{ marginTop: 14 }}>
          {mission.status === "pooled"
            ? "No Driver has accepted this trip yet, so there’s no one to approve a change. You can still edit the details, or a route change becomes available once a Driver accepts."
            : "This trip is already underway or finished — its route and fare are frozen."}
        </div>
      )}
    </div>
  );
}
