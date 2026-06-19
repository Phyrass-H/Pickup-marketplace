"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/app-context";
import { isValidLatLng } from "@/lib/geo";
import { parisLocalToUtc } from "@/lib/time";
import type { VehicleCategory, MissionStatus } from "@/lib/database.types";

const CATEGORIES: readonly VehicleCategory[] = ["eco", "business", "van", "luxury"];

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function num(v: FormDataEntryValue | null): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Posts a mission to the Pool, or saves it as a draft to finish later.
// Inserted/updated via the USER session so RLS authorizes it (no service role):
// p_mission_business_insert / _update key off business_id = current_business_id().
//
// `intent`     'pooled' (default) → live in the Pool · 'draft' → saved, not posted
// `mission_id` present → resuming an existing draft (UPDATE) · absent → INSERT
//
// Addresses are geocoded client-side via Mapbox; `zone` is a display label from
// the pickup town. The Business sets the ceiling (Doc 01/02); PDP params derived.
export async function createMission(formData: FormData) {
  const ctx = await getAppContext();
  if (!ctx.user) redirect("/login");
  if (!ctx.dispatcher || !ctx.business) redirect("/onboarding-business");

  const intent = String(formData.get("intent") ?? "pooled");
  const asDraft = intent === "draft";
  const missionId = String(formData.get("mission_id") ?? "").trim() || null;

  const backTo = (err: string) =>
    missionId
      ? `/dispatch/new?draft=${missionId}&error=${err}`
      : `/dispatch/new?error=${err}`;

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
  const waypoints: { address: string }[] = String(formData.get("waypoints") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((address) => ({ address }));

  // category / pickup / pickup_at / ceiling are NOT NULL on the mission table,
  // so even a draft must carry these core fields.
  if (
    !category ||
    !pickupAddress ||
    !pickupValid ||
    !pickupLocal ||
    ceiling == null ||
    ceiling <= 0
  ) {
    redirect(backTo("missing"));
  }

  // datetime-local carries no timezone — interpret it as Europe/Paris wall time
  // and convert to a real UTC instant (fixes the old server-local-zone bug).
  const pickupAt = parisLocalToUtc(pickupLocal);
  if (!pickupAt) redirect(backTo("missing"));
  // A live mission can't be posted in the past (a draft may legitimately sit
  // there until resumed). 60s of slack for clock skew.
  if (!asDraft && pickupAt!.getTime() < Date.now() - 60_000) redirect(backTo("past"));

  // PDP curve (D21): a standard mission starts at 50% of the ceiling and climbs
  // +5% every 10 min; SPEED WIN starts hotter (70%) and climbs every 5 min. It
  // no longer starts flat at the ceiling. Tunable later.
  const pdpStart = speedWin ? round2(ceiling! * 0.7) : round2(ceiling! * 0.5);
  const pdpStep = round2(Math.max(1, ceiling! * 0.05));
  const pdpInterval = speedWin ? 5 : 10;

  const status: MissionStatus = asDraft ? "draft" : "pooled";

  const row = {
    business_id: ctx.business.id,
    dispatcher_id: ctx.dispatcher.id,
    status,
    category: category!,
    zone,
    pickup_address: pickupAddress,
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    dropoff_address: dropoffAddress || null,
    dropoff_lat: dropoffValid ? dropoffLat : null,
    dropoff_lng: dropoffValid ? dropoffLng : null,
    waypoints: waypoints.length > 0 ? waypoints : null,
    pickup_at: pickupAt!.toISOString(),
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
  };

  const supabase = await createClient();
  if (missionId) {
    // Resume an existing DRAFT of this Business. When POSTING it live, reset the
    // climb origin: the PDP fare is measured from created_at (pdp.ts), so without
    // this a draft saved hours/days ago would be posted already near/at the
    // ceiling. A plain re-save-as-draft keeps the original created_at.
    const updateRow = asDraft ? row : { ...row, created_at: new Date().toISOString() };
    const { data: updated, error } = await supabase
      .from("mission")
      .update(updateRow)
      .eq("id", missionId)
      .eq("business_id", ctx.business.id)
      .eq("status", "draft")
      .select("id");
    if (error) redirect(backTo("db"));
    // 0 rows matched → the draft was already posted or discarded elsewhere
    // (stale tab / double-submit). Don't report a phantom success.
    if (!updated || updated.length === 0) redirect(backTo("gone"));
  } else {
    const { error } = await supabase.from("mission").insert(row);
    if (error) redirect(backTo("db"));
  }

  redirect(asDraft ? "/dispatch/drafts" : "/dispatch");
}

// Discard a saved draft. There is no DELETE RLS policy on mission, so this uses
// the service role, strictly scoped to the Business's own draft rows.
export async function discardDraft(formData: FormData) {
  const ctx = await getAppContext();
  if (!ctx.business) redirect("/login");
  const id = String(formData.get("mission_id") ?? "").trim();
  if (!id) redirect("/dispatch/drafts");
  const admin = createAdminClient();
  await admin
    .from("mission")
    .delete()
    .eq("id", id)
    .eq("business_id", ctx.business.id)
    .eq("status", "draft");
  redirect("/dispatch/drafts");
}
