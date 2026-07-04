"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/app-context";
import { isValidLatLng } from "@/lib/geo";
import { parisLocalToUtc } from "@/lib/time";
import { routeMetrics } from "@/lib/directions";
import { parseWaypointsField } from "@/lib/waypoints";
import {
  parsePassengers,
  primaryPassengerName,
  passengerRowData,
  guestContacts,
} from "@/lib/passengers";
import { parseLanguages, parseDriverFlags, DRESS_CODES } from "@/lib/driver-service";
import {
  DOCS_BUCKET,
  ensureBucket,
  uploadFile,
  fileExt,
  MAX_UPLOAD_BYTES,
} from "@/lib/supabase/storage";
import type { VehicleCategory, BodyType, MissionStatus } from "@/lib/database.types";

const BOARD_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

// Tiers offered post-O5 ('van' is a legacy enum value, no longer a tier).
const CATEGORIES: readonly VehicleCategory[] = ["eco", "business", "luxury"];

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

  const missionId = String(formData.get("mission_id") ?? "").trim() || null;

  // Posting is an explicit, named button action: 'pooled' (go live in the Pool)
  // or 'draft' (save for later). A submit that carries NEITHER — e.g. a stray
  // implicit submit — must never silently post a live mission. Bounce back to
  // the form, writing nothing. (Defence in depth alongside the client guards.)
  const intent = String(formData.get("intent") ?? "");
  if (intent !== "pooled" && intent !== "draft") {
    redirect(missionId ? `/dispatch/new?draft=${missionId}` : "/dispatch/new");
  }
  const asDraft = intent === "draft";

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
  // Short glance labels captured at pick-time from Mapbox's structured POI/place
  // data (phase 2). Written only when present (conditional spread below) so a
  // draft re-saved without re-picking keeps its stored label rather than wiping it.
  const pickupLabel = String(formData.get("pickup_label") ?? "").trim();
  const dropoffLabel = String(formData.get("dropoff_label") ?? "").trim();
  const labels = {
    ...(pickupLabel ? { pickup_label: pickupLabel } : {}),
    ...(dropoffLabel ? { dropoff_label: dropoffLabel } : {}),
  };
  const pickupLocal = String(formData.get("pickup_at") ?? "").trim();
  const ceiling = num(formData.get("ceiling"));
  const baseFare = num(formData.get("base_fare"));
  const speedWin = formData.get("speed_win") === "on";

  // Named Guests (first + surname). The list IS the headcount (rows = pax_count);
  // passenger_name keeps the MAIN Guest's name as a denormalised display string.
  // Names + the main flag go on the mission row (Pool Drivers can read it); phones
  // go in a Driver-unreadable side table (mission_guest_contact), aligned by index.
  const passengers = parsePassengers(formData.get("passenger_names"));
  const hasGuestData = passengers.some((p) => p.first || p.last || p.phone);
  const passengerName = primaryPassengerName(passengers);
  const paxCount = passengers.length > 0 ? passengers.length : null;
  const flightNumber = String(formData.get("flight_number") ?? "").trim();
  // Reference: a short booking tag (room / event) for the Business's own
  // schedule line — never shown to the Driver. Capped at 20 chars server-side
  // (the input's maxLength is a convenience; this is the real guard).
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 20);
  const luggageCount = num(formData.get("luggage_count"));
  // Luggage-only run (Sujet B, Phase 1): a bags-only trip carried in a Van, no
  // passengers. Forced to category=business + body=van server-side so it matches
  // Van Drivers (catalog vans are business-tier) regardless of the submitted fields.
  const luggageOnly = formData.get("luggage_only") === "1";

  // Service class: category is the TIER; body + an optional specific car narrow
  // which Drivers match (O5).
  const bodyRaw = String(formData.get("required_body_type") ?? "");
  const requiredBody: BodyType | null = bodyRaw === "sedan" || bodyRaw === "van" ? bodyRaw : null;
  const requiredMake = String(formData.get("required_make") ?? "").trim() || null;
  const requiredModel = String(formData.get("required_model") ?? "").trim() || null;

  // Driver & service card (S19): requested languages, dress code, request flags,
  // the meet & greet name board, and a private message to the Driver.
  const requiredLanguages = parseLanguages(formData.get("required_languages"));
  const dressRaw = String(formData.get("dress_code") ?? "").trim();
  const dressCode = (DRESS_CODES as readonly string[]).includes(dressRaw) ? dressRaw : null;
  const driverFlags = parseDriverFlags(formData.get("driver_flags"));
  const boardName = String(formData.get("board_name") ?? "").trim();
  const driverMessage = String(formData.get("driver_message") ?? "").trim();

  // Intermediate stops (KEEP). Stored as jsonb waypoints, each with its coords.
  const waypoints = parseWaypointsField(formData.get("waypoints"));
  // Picked stops (with coords) extend the cached ETA through the detour.
  const via = waypoints
    .filter((w) => w.lat != null && w.lng != null && isValidLatLng(w.lat, w.lng))
    .map((w) => ({ lat: w.lat as number, lng: w.lng as number }));

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

  // A LIVE mission (posted to the Pool) must have a located destination — Drivers
  // need to know where the trip goes, and it's what gives the fare/ETA a distance.
  // A draft may legitimately be parked without one and finished later.
  if (!asDraft && (!dropoffAddress || !dropoffValid)) {
    redirect(backTo("nodrop"));
  }

  // datetime-local carries no timezone — interpret it as Europe/Paris wall time
  // and convert to a real UTC instant (fixes the old server-local-zone bug).
  const pickupAt = parisLocalToUtc(pickupLocal);
  if (!pickupAt) redirect(backTo("missing"));
  // A live mission can't be posted in the past (a draft may legitimately sit
  // there until resumed). 60s of slack for clock skew.
  if (!asDraft && pickupAt!.getTime() < Date.now() - 60_000) redirect(backTo("past"));

  // Cache road distance + ETA (best-effort; null if routing fails or no dropoff).
  // Traffic-aware: pass the scheduled pickup time as depart_at (future only) so
  // the ETA reflects predicted traffic for that day & hour. Only WRITE it when a
  // fresh value was obtained, so a transient routing failure on a re-save/post
  // never wipes a previously-cached ETA.
  const departAt =
    pickupAt!.getTime() > Date.now() ? pickupAt!.toISOString().replace(/\.\d{3}Z$/, "Z") : null;
  const metrics =
    pickupValid && dropoffValid
      ? await routeMetrics(
          { lat: pickupLat!, lng: pickupLng! },
          { lat: dropoffLat!, lng: dropoffLng! },
          departAt,
          via,
        )
      : null;
  const eta = metrics
    ? { distance_km: metrics.distanceKm, duration_min: metrics.durationMin }
    : {};

  // PDP curve (D21): a standard mission starts at 50% of the ceiling and climbs
  // +5% every 10 min; SPEED WIN starts hotter (70%) and climbs every 5 min. It
  // no longer starts flat at the ceiling. Tunable later.
  const pdpStart = speedWin ? round2(ceiling! * 0.7) : round2(ceiling! * 0.5);
  const pdpStep = round2(Math.max(1, ceiling! * 0.05));
  const pdpInterval = speedWin ? 5 : 10;

  const status: MissionStatus = asDraft ? "draft" : "pooled";

  // Optional meet & greet board file → the private "documents" bucket. The path
  // uses a random id (not the mission id) so the row needn't exist first. We only
  // WRITE board_file_path when a new file was uploaded (conditional spread, like
  // eta below), so re-saving a draft never wipes a previously-attached board.
  // A failed upload is non-fatal: the mission still saves, just without the file.
  let boardUpload: { board_file_path: string | null } | Record<string, never> = {};
  const boardFile = formData.get("board_file");
  if (
    boardFile instanceof File &&
    boardFile.size > 0 &&
    boardFile.size <= MAX_UPLOAD_BYTES &&
    BOARD_MIME.includes(boardFile.type)
  ) {
    try {
      await ensureBucket(DOCS_BUCKET, false);
      const path = `mission/${ctx.business.id}/board-${crypto.randomUUID()}.${fileExt(boardFile)}`;
      await uploadFile(DOCS_BUCKET, path, boardFile);
      boardUpload = { board_file_path: path };
    } catch {
      boardUpload = {};
    }
  }
  // Explicit removal of a previously-attached board (the Dispatcher dismissed it
  // or turned meet & greet off), but only when no replacement file was uploaded.
  if (Object.keys(boardUpload).length === 0 && formData.get("board_file_clear") === "1") {
    boardUpload = { board_file_path: null };
  }

  const row = {
    business_id: ctx.business.id,
    dispatcher_id: ctx.dispatcher.id,
    status,
    category: luggageOnly ? "business" : category!,
    zone,
    pickup_address: pickupAddress,
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    dropoff_address: dropoffAddress || null,
    dropoff_lat: dropoffValid ? dropoffLat : null,
    dropoff_lng: dropoffValid ? dropoffLng : null,
    waypoints: waypoints.length > 0 ? waypoints : null,
    pickup_at: pickupAt!.toISOString(),
    passenger_name: luggageOnly ? null : passengerName || null,
    // Names + main flag only (no phone) — this row is Pool-readable. Stored when
    // any Guest has a name or phone; pax_count preserves the headcount. A luggage
    // run carries no passengers.
    passenger_names: luggageOnly ? null : hasGuestData ? passengerRowData(passengers) : null,
    pax_count: luggageOnly ? null : paxCount,
    luggage_count: luggageCount,
    luggage_only: luggageOnly,
    flight_number: flightNumber || null,
    reference: reference || null,
    base_fare: baseFare,
    ceiling: ceiling!,
    pdp_start: pdpStart,
    pdp_step: pdpStep,
    pdp_interval: pdpInterval,
    speed_win: speedWin,
    required_body_type: luggageOnly ? "van" : requiredBody,
    required_make: luggageOnly ? null : requiredMake,
    required_model: luggageOnly ? null : requiredModel,
    required_languages: requiredLanguages.length > 0 ? requiredLanguages : null,
    dress_code: dressCode,
    driver_flags: Object.keys(driverFlags).length > 0 ? driverFlags : null,
    board_name: boardName || null,
    driver_message: driverMessage || null,
  };

  const supabase = await createClient();
  let effectiveId: string | null = missionId;
  if (missionId) {
    // Resume an existing DRAFT of this Business. When POSTING it live, reset the
    // climb origin: the PDP fare is measured from created_at (pdp.ts), so without
    // this a draft saved hours/days ago would be posted already near/at the
    // ceiling. A plain re-save-as-draft keeps the original created_at.
    const updateRow = asDraft
      ? { ...row, ...eta, ...boardUpload, ...labels }
      : { ...row, ...eta, ...boardUpload, ...labels, created_at: new Date().toISOString() };
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
    const { data: inserted, error } = await supabase
      .from("mission")
      .insert({ ...row, ...eta, ...boardUpload, ...labels })
      .select("id")
      .single();
    if (error || !inserted) redirect(backTo("db"));
    effectiveId = inserted.id;
  }

  // Guest phones live in a side table Drivers can't read (privacy gate), aligned
  // by index to passenger_names. Upsert when any number was entered; otherwise
  // clear any prior row (e.g. a phone removed on re-save). RLS scopes both to this
  // Business's own mission.
  if (effectiveId) {
    const contacts = guestContacts(passengers);
    const { error: contactErr } = contacts.some((c) => c.phone)
      ? await supabase.from("mission_guest_contact").upsert({
          mission_id: effectiveId,
          contacts,
          updated_at: new Date().toISOString(),
        })
      : await supabase
          .from("mission_guest_contact")
          .delete()
          .eq("mission_id", effectiveId);
    // The mission row is already saved; a phone side-table failure shouldn't undo
    // a posted mission — but never swallow it silently (e.g. table missing
    // pre-migration). Surface it in the server logs.
    if (contactErr) {
      console.error("mission_guest_contact write failed:", contactErr.message);
    }
  }

  // Refresh the layout so the sidebar Drafts badge reflects the new count.
  revalidatePath("/dispatch", "layout");
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
  revalidatePath("/dispatch", "layout");
  redirect("/dispatch/drafts");
}
