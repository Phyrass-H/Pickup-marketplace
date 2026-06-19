"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidLatLng } from "@/lib/geo";
import type { VehicleCategory, BodyType, PreferredGps } from "@/lib/database.types";

const CATEGORIES: readonly VehicleCategory[] = ["eco", "business", "luxury"];
const GPS_OPTIONS: readonly PreferredGps[] = ["waze", "google", "apple"];

// Update the Driver's profile (incl. base location + service radius) and their
// one vehicle. Service-role, gated to the current user's driver row. The base +
// radius are what the Pool matches against now (replacing the town list); the
// profile photo is handled separately by the avatar editor.
export async function updateDriverSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: driver } = await admin
    .from("driver")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!driver) redirect("/onboarding");

  const first = String(formData.get("first_name") ?? "").trim();
  const last = String(formData.get("last_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const gpsRaw = String(formData.get("preferred_gps") ?? "");
  const gps: PreferredGps | null = GPS_OPTIONS.includes(gpsRaw as PreferredGps)
    ? (gpsRaw as PreferredGps)
    : null;

  const languages = String(formData.get("languages") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const baseLabel = String(formData.get("base_label") ?? "").trim();
  const baseLat = Number.parseFloat(String(formData.get("base_lat") ?? ""));
  const baseLng = Number.parseFloat(String(formData.get("base_lng") ?? ""));
  const radiusRaw = Number.parseInt(String(formData.get("service_radius_km") ?? ""), 10);
  const radius = Number.isFinite(radiusRaw) ? Math.min(500, Math.max(5, radiusRaw)) : 50;

  if (!first || !last) redirect("/settings?error=missing");
  if (!baseLabel || !isValidLatLng(baseLat, baseLng)) {
    redirect("/settings?error=nobase");
  }

  const { error: driverErr } = await admin
    .from("driver")
    .update({
      first_name: first,
      last_name: last,
      phone: phone || null,
      preferred_gps: gps,
      languages,
      base_label: baseLabel,
      base_lat: baseLat,
      base_lng: baseLng,
      service_radius_km: radius,
    })
    .eq("id", driver.id);
  if (driverErr) redirect("/settings?error=db");

  // Vehicle (the one row per Driver).
  const categoryRaw = String(formData.get("category") ?? "");
  const category = CATEGORIES.includes(categoryRaw as VehicleCategory)
    ? (categoryRaw as VehicleCategory)
    : null;
  const bodyRaw = String(formData.get("body_type") ?? "");
  const bodyType: BodyType = bodyRaw === "van" ? "van" : "sedan";
  const make = String(formData.get("make") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const colour = String(formData.get("colour") ?? "").trim();
  const plate = String(formData.get("plate") ?? "").trim();
  const seatsRaw = String(formData.get("seats") ?? "").trim();
  const seatsNum = seatsRaw ? Number.parseInt(seatsRaw, 10) : NaN;
  const seats = Number.isFinite(seatsNum) ? seatsNum : null;

  const vehicleFields = {
    body_type: bodyType,
    make: make || null,
    model: model || null,
    colour: colour || null,
    plate: plate || null,
    seats,
  };

  const { data: vehicle } = await admin
    .from("vehicle")
    .select("id")
    .eq("driver_id", driver.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (vehicle) {
    const { error } = await admin
      .from("vehicle")
      .update({ ...vehicleFields, ...(category ? { category } : {}) })
      .eq("id", vehicle.id);
    if (error) redirect("/settings?error=db");
  } else if (category) {
    const { error } = await admin
      .from("vehicle")
      .insert({ driver_id: driver.id, category, ...vehicleFields });
    if (error) redirect("/settings?error=db");
  }

  redirect("/settings?ok=1");
}
