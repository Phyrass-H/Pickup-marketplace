"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app-context";
import { isValidLatLng } from "@/lib/geo";
import type { VehicleCategory } from "@/lib/database.types";

const CATEGORIES: readonly VehicleCategory[] = ["eco", "business", "van", "luxury"];

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function num(v: FormDataEntryValue | null): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Posts a mission straight into the Pool (status='pooled'). Inserted via the
// USER session so RLS p_mission_business_insert (business_id =
// current_business_id()) authorizes it — no service role needed.
//
// Addresses are geocoded client-side via Mapbox (the form submits pickup/dropoff
// lat/lng); `zone` is derived from the pickup town for display. The Business sets
// the ceiling (Doc 01/02); PDP curve params are auto-derived.
export async function createMission(formData: FormData) {
  const ctx = await getAppContext();
  if (!ctx.user) redirect("/login");
  if (!ctx.dispatcher || !ctx.business) redirect("/onboarding-business");

  const categoryRaw = String(formData.get("category") ?? "");
  const category = CATEGORIES.includes(categoryRaw as VehicleCategory)
    ? (categoryRaw as VehicleCategory)
    : null;

  const pickupAddress = String(formData.get("pickup_address") ?? "").trim();
  const dropoffAddress = String(formData.get("dropoff_address") ?? "").trim();
  const pickupLat = num(formData.get("pickup_lat"));
  const pickupLng = num(formData.get("pickup_lng"));
  const dropoffLat = num(formData.get("dropoff_lat"));
  const dropoffLng = num(formData.get("dropoff_lng"));
  // The pickup must be geocoded (picked from the suggestions) so the Pool can
  // match it by distance; dropoff coords are kept only if valid.
  const pickupValid = pickupLat != null && pickupLng != null && isValidLatLng(pickupLat, pickupLng);
  const dropoffValid =
    dropoffLat != null && dropoffLng != null && isValidLatLng(dropoffLat, dropoffLng);
  // Zone is now just a display label, derived from the pickup's town.
  const zone = pickupAddress ? pickupAddress.split(",")[0]!.trim() || null : null;
  const pickupLocal = String(formData.get("pickup_at") ?? "").trim();
  const ceiling = num(formData.get("ceiling"));
  const baseFare = num(formData.get("base_fare"));
  const speedWin = formData.get("speed_win") === "on";

  const passengerName = String(formData.get("passenger_name") ?? "").trim();
  const flightNumber = String(formData.get("flight_number") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  const paxCount = num(formData.get("pax_count"));
  const luggageCount = num(formData.get("luggage_count"));

  // Intermediate stops: one address per line (KEEP). Stored as jsonb waypoints.
  // Inline object type (not the Waypoint interface) so it's assignable to Json.
  const waypoints: { address: string }[] = String(formData.get("waypoints") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((address) => ({ address }));

  if (
    !category ||
    !pickupAddress ||
    !pickupValid ||
    !pickupLocal ||
    ceiling == null ||
    ceiling <= 0
  ) {
    redirect("/dispatch/new?error=missing");
  }

  // NOTE: datetime-local has no timezone; interpreted in the server's local
  // zone. Fine for local/beta; make this explicit (Europe/Paris) before prod.
  const pickupAt = new Date(pickupLocal);
  if (isNaN(pickupAt.getTime())) redirect("/dispatch/new?error=missing");

  // Deterministic PDP defaults (Doc 02): starts ~50% of ceiling and climbs in
  // fixed steps; SPEED WIN starts at the ceiling. Tunable later.
  const pdpStart = speedWin ? ceiling! : round2(ceiling! * 0.5);
  const pdpStep = round2(Math.max(1, ceiling! * 0.05));
  const pdpInterval = 10; // minutes between steps

  const supabase = await createClient();
  const { error } = await supabase.from("mission").insert({
    business_id: ctx.business.id,
    dispatcher_id: ctx.dispatcher.id,
    status: "pooled",
    category: category!,
    zone,
    pickup_address: pickupAddress,
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    dropoff_address: dropoffAddress || null,
    dropoff_lat: dropoffValid ? dropoffLat : null,
    dropoff_lng: dropoffValid ? dropoffLng : null,
    waypoints: waypoints.length > 0 ? waypoints : null,
    pickup_at: pickupAt.toISOString(),
    passenger_name: passengerName || null,
    pax_count: paxCount,
    luggage_count: luggageCount,
    flight_number: flightNumber || null,
    comment: comment || null,
    base_fare: baseFare,
    ceiling: ceiling!,
    pdp_start: pdpStart,
    pdp_step: pdpStep,
    pdp_interval: pdpInterval,
    speed_win: speedWin,
  });

  if (error) redirect("/dispatch/new?error=db");
  redirect("/dispatch");
}
