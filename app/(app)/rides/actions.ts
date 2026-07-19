"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDriverContext } from "@/lib/driver";
import { nextStep } from "@/lib/mission-flow";
import { parseWaypoints } from "@/lib/waypoints";
import { currentFare } from "@/lib/pdp";
import type { StatusEventStatus } from "@/lib/database.types";

// The PDP columns needed to compute the fare snapshot recorded on a cancel / no-show.
const FARE_COLS =
  "id, driver_id, ceiling, base_fare, pdp_start, pdp_step, pdp_interval, speed_win, created_at, pooled_at";

export type StatusResult = { ok: true } | { ok: false; message: string };

// The Driver's answer to a proposed amendment (D39 Phase 2). Runs the atomic
// respond_to_amendment RPC via the USER session (it's SECURITY DEFINER and
// resolves current_driver_id() from auth.uid(), so it must NOT use the service
// role — same rule as accept_mission, D6). Accept swaps the new route + fare onto
// the mission in one transaction; decline leaves the trip exactly as agreed.
export async function respondToAmendment(
  amendmentId: string,
  accept: boolean,
  reason?: string | null,
): Promise<StatusResult> {
  const { driver } = await getDriverContext();
  if (!driver) return { ok: false, message: "You’re not signed in as a Driver." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_amendment", {
    p_amendment_id: amendmentId,
    p_accept: accept,
    p_reason: reason ?? null,
  });
  if (error) {
    // The RPC's RAISE messages are already Driver-readable ("This change is no
    // longer pending", "This trip can no longer be changed"); surface them, with a
    // safe fallback for anything unexpected.
    const msg = error.message?.trim();
    return {
      ok: false,
      message: msg && msg.length < 120 ? msg : "Couldn’t apply the change — please refresh and try again.",
    };
  }

  revalidatePath("/rides");
  revalidatePath("/dispatch");
  return { ok: true };
}

// Advance a mission one execution step. Records a status_event (the thing the
// Business watches) AND moves mission.status forward. A Driver can't UPDATE the
// mission via RLS (no driver update policy), so the writes go through the
// service role — but ONLY after we verify, under RLS, that this mission is the
// Driver's and the requested step is the valid next one.
export async function advanceStatus(
  missionId: string,
  requested: StatusEventStatus,
): Promise<StatusResult> {
  const { driver } = await getDriverContext();
  if (!driver) return { ok: false, message: "You’re not signed in as a Driver." };

  const supabase = await createClient();
  const { data: mission } = await supabase
    .from("mission")
    .select("id, status, driver_id, waypoints, stops_reached")
    .eq("id", missionId)
    .maybeSingle();

  if (!mission || mission.driver_id !== driver.id) {
    return { ok: false, message: "This isn’t one of your missions." };
  }

  const expected = nextStep(mission.status);
  if (!expected || expected !== requested) {
    return { ok: false, message: "That step isn’t available right now." };
  }

  // Can't finish while stops are still pending — defence in depth (the UI offers
  // "Reached — <stop>" before "Complete ride" when stops remain).
  if (requested === "completed") {
    const stops = parseWaypoints(mission.waypoints);
    if ((mission.stops_reached ?? 0) < stops.length) {
      return { ok: false, message: "Mark the remaining stops before completing." };
    }
  }

  const admin = createAdminClient();

  const { error: eventErr } = await admin
    .from("status_event")
    .insert({ mission_id: missionId, status: requested });
  if (eventErr) return { ok: false, message: "Couldn’t record the update." };

  const { error: updateErr } = await admin
    .from("mission")
    .update({ status: requested })
    .eq("id", missionId)
    .eq("driver_id", driver.id);
  if (updateErr) return { ok: false, message: "Couldn’t update the mission." };

  revalidatePath("/rides");
  revalidatePath("/dispatch");
  return { ok: true };
}

// Mark the NEXT intermediate stop reached (one tap per stop, while on board).
// Same trust model as advanceStatus: verify under RLS that the mission is this
// Driver's and that the tapped stop is genuinely the next one, then bump the
// counter via the service role. The mission stays `on_board` throughout.
export async function reachStop(
  missionId: string,
  stopIndex: number,
): Promise<StatusResult> {
  const { driver } = await getDriverContext();
  if (!driver) return { ok: false, message: "You’re not signed in as a Driver." };

  const supabase = await createClient();
  const { data: mission } = await supabase
    .from("mission")
    .select("id, status, driver_id, waypoints, stops_reached")
    .eq("id", missionId)
    .maybeSingle();

  if (!mission || mission.driver_id !== driver.id) {
    return { ok: false, message: "This isn’t one of your missions." };
  }
  if (mission.status !== "on_board") {
    return { ok: false, message: "You can mark a stop only once the Guest is on board." };
  }

  const stops = parseWaypoints(mission.waypoints);
  const reached = mission.stops_reached ?? 0;
  // Only the next stop in order, and never past the last one.
  if (stopIndex !== reached || reached >= stops.length) {
    return { ok: false, message: "That stop isn’t the next one." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("mission")
    .update({ stops_reached: reached + 1 })
    .eq("id", missionId)
    .eq("driver_id", driver.id);
  if (error) return { ok: false, message: "Couldn’t record the stop." };

  revalidatePath("/rides");
  revalidatePath("/dispatch");
  return { ok: true };
}

// Driver cancels a trip they hold (O7, D45). Always 100% — the trip re-pools as a SPEED
// WIN and the Driver takes a reliability mark. Runs the atomic driver_cancel_mission RPC
// via the USER session (SECURITY DEFINER resolves current_driver_id(), like accept). The
// fare snapshot is computed server-side (authoritative) as the euro basis (MANUAL settle).
export async function driverCancelMission(
  missionId: string,
  reason?: string | null,
): Promise<StatusResult> {
  const { driver } = await getDriverContext();
  if (!driver) return { ok: false, message: "You’re not signed in as a Driver." };

  const supabase = await createClient();
  const { data: mission } = await supabase
    .from("mission")
    .select(FARE_COLS)
    .eq("id", missionId)
    .maybeSingle();
  if (!mission || mission.driver_id !== driver.id) {
    return { ok: false, message: "This isn’t one of your missions." };
  }

  const { error } = await supabase.rpc("driver_cancel_mission", {
    p_mission_id: missionId,
    p_reason: reason?.trim() || null,
    p_fare_snapshot: currentFare(mission),
  });
  if (error) {
    const msg = error.message?.trim();
    return {
      ok: false,
      message: msg && msg.length < 120 ? msg : "Couldn’t cancel — please refresh and try again.",
    };
  }

  revalidatePath("/rides");
  revalidatePath("/dispatch");
  return { ok: true };
}

// The Driver's answer to a proposed AGREED RELEASE (O7, D45). Accept → the trip
// releases free and re-pools as a SPEED WIN (no fee, no reliability mark); decline →
// the trip stays exactly as agreed. Runs the atomic respond_to_release RPC via the
// USER session (SECURITY DEFINER resolves current_driver_id(), like accept_mission —
// must NOT use the service role, D6). Declining is always free and safe for the Driver.
export async function respondToRelease(
  releaseId: string,
  accept: boolean,
  reason?: string | null,
): Promise<StatusResult> {
  const { driver } = await getDriverContext();
  if (!driver) return { ok: false, message: "You’re not signed in as a Driver." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_release", {
    p_release_id: releaseId,
    p_accept: accept,
    p_reason: reason?.trim() || null,
  });
  if (error) {
    const msg = error.message?.trim();
    return {
      ok: false,
      message: msg && msg.length < 120 ? msg : "Couldn’t respond — please refresh and try again.",
    };
  }

  revalidatePath("/rides");
  revalidatePath("/dispatch");
  return { ok: true };
}

// Report a Guest no-show (O7, D45). Only from 'arrived' once the wait window has elapsed
// (the RPC enforces airport 60 / city 20 min). Business is charged the full fare; the
// Driver is paid like a completed mission (status → completed, no_show = true).
export async function markNoShow(missionId: string): Promise<StatusResult> {
  const { driver } = await getDriverContext();
  if (!driver) return { ok: false, message: "You’re not signed in as a Driver." };

  const supabase = await createClient();
  const { data: mission } = await supabase
    .from("mission")
    .select(FARE_COLS)
    .eq("id", missionId)
    .maybeSingle();
  if (!mission || mission.driver_id !== driver.id) {
    return { ok: false, message: "This isn’t one of your missions." };
  }

  const { error } = await supabase.rpc("mark_no_show", {
    p_mission_id: missionId,
    p_fare_snapshot: currentFare(mission),
  });
  if (error) {
    const msg = error.message?.trim();
    return {
      ok: false,
      message: msg && msg.length < 120 ? msg : "Couldn’t report the no-show — please refresh and try again.",
    };
  }

  revalidatePath("/rides");
  revalidatePath("/dispatch");
  return { ok: true };
}
