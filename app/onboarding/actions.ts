"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BETA_ZONES } from "@/lib/zones";
import type { VehicleCategory, PreferredGps } from "@/lib/database.types";

const CATEGORIES: readonly VehicleCategory[] = [
  "eco",
  "business",
  "van",
  "luxury",
];
const GPS_OPTIONS: readonly PreferredGps[] = ["waze", "google", "apple"];

// Creates the Driver's profile + driver + vehicle rows for the logged-in user.
// Uses the service-role client because profile/driver have no INSERT RLS policy
// (writes are server-side in beta) — gated strictly to the current user's id.
export async function createDriverProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const first = String(formData.get("first_name") ?? "").trim();
  const last = String(formData.get("last_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const gpsRaw = String(formData.get("preferred_gps") ?? "");
  const gps: PreferredGps | null = GPS_OPTIONS.includes(gpsRaw as PreferredGps)
    ? (gpsRaw as PreferredGps)
    : null;

  const categoryRaw = String(formData.get("category") ?? "");
  const category = CATEGORIES.includes(categoryRaw as VehicleCategory)
    ? (categoryRaw as VehicleCategory)
    : null;

  const zones = formData
    .getAll("zones")
    .map(String)
    .filter((z) => (BETA_ZONES as readonly string[]).includes(z));

  if (!first || !last || !category || zones.length === 0) {
    redirect("/onboarding?error=missing");
  }

  const admin = createAdminClient();

  // role profile (idempotent)
  const { error: profileErr } = await admin
    .from("profile")
    .upsert(
      { auth_user_id: user.id, role: "driver" },
      { onConflict: "auth_user_id" },
    );
  if (profileErr) redirect("/onboarding?error=db");

  // driver (create or update)
  const { data: existing } = await admin
    .from("driver")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  let driverId = existing?.id;
  if (!driverId) {
    const { data: created, error } = await admin
      .from("driver")
      .insert({
        auth_user_id: user.id,
        first_name: first,
        last_name: last,
        phone: phone || null,
        email: user.email ?? null,
        operational_zones: zones,
        preferred_gps: gps,
      })
      .select("id")
      .single();
    if (error || !created) redirect("/onboarding?error=db");
    driverId = created!.id;
  } else {
    const { error: updateErr } = await admin
      .from("driver")
      .update({
        first_name: first,
        last_name: last,
        phone: phone || null,
        operational_zones: zones,
        preferred_gps: gps,
      })
      .eq("id", driverId);
    if (updateErr) redirect("/onboarding?error=db");
  }

  // one vehicle per Driver (create or update its category). Check the write —
  // the (app) layout requires a vehicle, so a silent failure here would bounce
  // the Driver between /pool and /onboarding forever.
  const { data: vehicle } = await admin
    .from("vehicle")
    .select("id")
    .eq("driver_id", driverId!)
    .maybeSingle();

  if (!vehicle) {
    const { error: vErr } = await admin
      .from("vehicle")
      .insert({ driver_id: driverId!, category: category! });
    if (vErr) redirect("/onboarding?error=db");
  } else {
    const { error: vErr } = await admin
      .from("vehicle")
      .update({ category: category! })
      .eq("id", vehicle.id);
    if (vErr) redirect("/onboarding?error=db");
  }

  redirect("/pool");
}
