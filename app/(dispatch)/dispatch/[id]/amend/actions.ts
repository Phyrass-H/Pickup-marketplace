"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app-context";
import { isValidLatLng } from "@/lib/geo";
import { routeMetrics } from "@/lib/directions";
import { parseWaypointsField } from "@/lib/waypoints";
import { currentFare } from "@/lib/pdp";
import { buildFromSnapshot } from "@/lib/amendments";
import type { MissionStatus } from "@/lib/database.types";

// A mission can only be AMENDED (proposed to a Driver) while a Driver holds it but
// hasn't started the run. Pooled has no Driver to consent (free info edit instead);
// en_route+ is already underway (frozen).
const AMENDABLE: MissionStatus[] = ["accepted", "confirmed"];

function num(v: FormDataEntryValue | null): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Propose a change to an ACCEPTED mission's route + fare (D39 Phase 2). This does
// NOT touch the mission — it records a proposed amendment the assigned Driver must
// accept (via respond_to_amendment) before anything changes. Written via the USER
// session so RLS (p_amendment_business_insert) authorises it, scoped to a mission
// this Business owns.
export async function proposeMissionAmendment(missionId: string, formData: FormData) {
  const ctx = await getAppContext();
  if (!ctx.user) redirect("/login");
  if (!ctx.dispatcher || !ctx.business) redirect("/onboarding-business");

  const id = String(missionId ?? "").trim();
  if (!id) redirect("/dispatch");
  const backTo = (err: string) => `/dispatch/${id}/amend?error=${err}`;

  const supabase = await createClient();
  // Load the trip AS AGREED (RLS scopes to this Business; the extra eq is defence).
  const { data: mission } = await supabase
    .from("mission")
    .select("*")
    .eq("id", id)
    .eq("business_id", ctx.business.id)
    .maybeSingle();
  if (!mission) redirect("/dispatch");
  if (!AMENDABLE.includes(mission.status)) redirect(backTo("locked"));

  // Proposed new route (same hidden fields the new-mission RouteStops writes).
  const pickupAddress = String(formData.get("pickup_address") ?? "").trim();
  const dropoffAddress = String(formData.get("dropoff_address") ?? "").trim();
  const pickupLat = num(formData.get("pickup_lat"));
  const pickupLng = num(formData.get("pickup_lng"));
  const dropoffLat = num(formData.get("dropoff_lat"));
  const dropoffLng = num(formData.get("dropoff_lng"));
  const pickupValid = pickupLat != null && pickupLng != null && isValidLatLng(pickupLat, pickupLng);
  const dropoffValid =
    dropoffLat != null && dropoffLng != null && isValidLatLng(dropoffLat, dropoffLng);
  const pickupLabel = String(formData.get("pickup_label") ?? "").trim();
  const dropoffLabel = String(formData.get("dropoff_label") ?? "").trim();

  // The pickup must stay located (the Pool/nav depend on coords) and a transfer
  // always keeps a located destination — you can't propose a trip to nowhere.
  if (!pickupAddress || !pickupValid) redirect(backTo("missing"));
  if (!dropoffAddress || !dropoffValid) redirect(backTo("nodrop"));

  const newFare = num(formData.get("new_fare"));
  if (newFare == null || newFare <= 0) redirect(backTo("fare"));

  const note = String(formData.get("note") ?? "").trim();

  const waypoints = parseWaypointsField(formData.get("waypoints"));
  const via = waypoints
    .filter((w) => w.lat != null && w.lng != null && isValidLatLng(w.lat, w.lng))
    .map((w) => ({ lat: w.lat as number, lng: w.lng as number }));

  // Recompute the road distance + ETA server-side (authoritative), traffic-aware
  // for the unchanged pickup time. Best-effort: fall back to the client hidden
  // fields, then null, so a routing hiccup never blocks the proposal.
  const departAt =
    new Date(mission.pickup_at).getTime() > Date.now()
      ? new Date(mission.pickup_at).toISOString().replace(/\.\d{3}Z$/, "Z")
      : null;
  const metrics = await routeMetrics(
    { lat: pickupLat!, lng: pickupLng! },
    { lat: dropoffLat!, lng: dropoffLng! },
    departAt,
    via,
  );
  const newDistanceKm = metrics ? metrics.distanceKm : num(formData.get("route_distance_km"));
  const newDurationMin = metrics ? metrics.durationMin : num(formData.get("route_duration_min"));

  // The trip as agreed at this moment — including the CURRENT fare the Driver
  // agreed to (computed, never stored) — for the "was …" display + audit trail.
  const fromSnapshot = buildFromSnapshot(mission, currentFare(mission));

  // Only one proposal can be live at a time: retire any still-pending one for this
  // mission (the Business is replacing it). RLS scopes the update to this Business.
  await supabase
    .from("mission_amendment")
    .update({ status: "superseded" })
    .eq("mission_id", id)
    .eq("business_id", ctx.business.id)
    .eq("status", "proposed");

  const { error } = await supabase.from("mission_amendment").insert({
    mission_id: id,
    business_id: ctx.business.id,
    proposed_by: ctx.dispatcher.id,
    status: "proposed",
    new_pickup_address: pickupAddress,
    new_pickup_lat: pickupLat,
    new_pickup_lng: pickupLng,
    new_pickup_label: pickupLabel || null,
    new_dropoff_address: dropoffAddress,
    new_dropoff_lat: dropoffLat,
    new_dropoff_lng: dropoffLng,
    new_dropoff_label: dropoffLabel || null,
    new_waypoints: waypoints.length > 0 ? waypoints : null,
    new_distance_km: newDistanceKm,
    new_duration_min: newDurationMin,
    new_fare: newFare,
    from_snapshot: fromSnapshot,
    note: note || null,
  });
  if (error) redirect(backTo("db"));

  // Back to the schedule with this trip open — it now reads "Change pending".
  revalidatePath("/dispatch", "layout");
  revalidatePath("/dispatch/calendar");
  revalidatePath("/dispatch/history");
  redirect(`/dispatch?open=${id}`);
}

// Withdraw a pending proposal, or dismiss a declined one — either way it stops
// showing on the schedule (the trip stays exactly as agreed). RLS scopes to the
// Business's own amendments.
export async function closeAmendment(formData: FormData) {
  const ctx = await getAppContext();
  if (!ctx.business) redirect("/login");
  const amendmentId = String(formData.get("amendment_id") ?? "").trim();
  const missionId = String(formData.get("mission_id") ?? "").trim();
  if (!amendmentId) redirect("/dispatch");

  const supabase = await createClient();
  await supabase
    .from("mission_amendment")
    .update({ status: "superseded" })
    .eq("id", amendmentId)
    .eq("business_id", ctx.business.id)
    .in("status", ["proposed", "declined"]);

  revalidatePath("/dispatch", "layout");
  redirect(missionId ? `/dispatch?open=${missionId}` : "/dispatch");
}
