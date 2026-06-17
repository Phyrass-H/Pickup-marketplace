"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BETA_ZONES } from "@/lib/zones";
import {
  ensureBucket,
  uploadFile,
  publicMediaUrl,
  fileExt,
  MEDIA_BUCKET,
  MAX_UPLOAD_BYTES,
} from "@/lib/supabase/storage";
import type { VehicleCategory, PreferredGps } from "@/lib/database.types";

const CATEGORIES: readonly VehicleCategory[] = ["eco", "business", "van", "luxury"];
const GPS_OPTIONS: readonly PreferredGps[] = ["waze", "google", "apple"];
const IMAGE_MIME = ["image/png", "image/jpeg", "image/webp"];

// Update the Driver's profile + their one vehicle in a single save. Writes go
// through the service role gated to the current user's driver row (matches the
// onboarding pattern). Profile photo (optional) → public avatars bucket.
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

  const zones = formData
    .getAll("zones")
    .map(String)
    .filter((z) => (BETA_ZONES as readonly string[]).includes(z));

  const languages = String(formData.get("languages") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!first || !last || zones.length === 0) {
    redirect("/settings?error=missing");
  }

  // Optional profile photo. Validate before the upload try (redirect can't run
  // inside try — it works by throwing).
  let photoUrl: string | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_UPLOAD_BYTES) redirect("/settings?error=filesize");
    if (!IMAGE_MIME.includes(photo.type)) redirect("/settings?error=filetype");
    let failed = false;
    try {
      await ensureBucket(MEDIA_BUCKET, true);
      const path = `driver/${driver.id}.${fileExt(photo)}`;
      await uploadFile(MEDIA_BUCKET, path, photo);
      photoUrl = publicMediaUrl(path, Date.now());
    } catch {
      failed = true;
    }
    if (failed) redirect("/settings?error=upload");
  }

  const { error: driverErr } = await admin
    .from("driver")
    .update({
      first_name: first,
      last_name: last,
      phone: phone || null,
      preferred_gps: gps,
      operational_zones: zones,
      languages,
      ...(photoUrl ? { profile_photo_url: photoUrl } : {}),
    })
    .eq("id", driver.id);
  if (driverErr) redirect("/settings?error=db");

  // Vehicle (the one row per Driver).
  const categoryRaw = String(formData.get("category") ?? "");
  const category = CATEGORIES.includes(categoryRaw as VehicleCategory)
    ? (categoryRaw as VehicleCategory)
    : null;
  const make = String(formData.get("make") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const colour = String(formData.get("colour") ?? "").trim();
  const plate = String(formData.get("plate") ?? "").trim();
  const seatsRaw = String(formData.get("seats") ?? "").trim();
  const seatsNum = seatsRaw ? Number.parseInt(seatsRaw, 10) : NaN;
  const seats = Number.isFinite(seatsNum) ? seatsNum : null;

  const vehicleFields = {
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
