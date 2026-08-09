"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDriverContext } from "@/lib/driver";
import { nextStep } from "@/lib/mission-flow";
import { checkInOpen } from "@/lib/dispatch-status";
import { parseWaypoints } from "@/lib/waypoints";
import { settledFare } from "@/lib/pdp";
import type { MissionStep } from "@/lib/database.types";

// The PDP columns needed to compute the fare snapshot recorded on a cancel / no-show.
const FARE_COLS =
  "id, driver_id, ceiling, base_fare, pdp_start, pdp_step, pdp_interval, speed_win, created_at, pooled_at, accepted_at";

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
  requested: MissionStep,
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

  // Boarding the Guest is the one step in this flow that MOVES MONEY: it is the moment the
  // waiting meter provably stops, so it settles the accrued fee (D48; founder 2026-08-09 —
  // waiting is owed whether or not the trip then happens). That write goes through a
  // SECURITY DEFINER RPC on the user's own session, off the server clock and the same
  // mission_waiting() the three failure doors use — never through the service role here,
  // which would put a fourth hand-written copy of the meter on the one path with no SQL
  // guard. The RPC writes its own status_event, so this returns before the admin block.
  if (requested === "on_board") {
    const { error } = await supabase.rpc("board_guest", { p_mission_id: missionId });
    if (error) {
      const msg = error.message?.trim();
      return {
        ok: false,
        message: msg && msg.length < 120 ? msg : "Couldn’t record the update.",
      };
    }
    revalidatePath("/rides");
    revalidatePath("/dispatch");
    return { ok: true };
  }

  const admin = createAdminClient();

  const { error: eventErr } = await admin
    .from("status_event")
    .insert({ mission_id: missionId, status: requested });
  if (eventErr) return { ok: false, message: "Couldn’t record the update." };

  // D61 — starting the trip IS a check-in, and a stronger one than the button.
  // Backfill it here so a Driver who drives off without tapping check-in never
  // shows the Business a "not checked in" row while they're on their way.
  const { error: updateErr } = await admin
    .from("mission")
    .update(
      requested === "en_route"
        ? { status: requested, checked_in_at: new Date().toISOString() }
        : { status: requested },
    )
    .eq("id", missionId)
    .eq("driver_id", driver.id);
  if (updateErr) return { ok: false, message: "Couldn’t update the mission." };

  // Every SQL terminal path (business_cancel_mission, mark_no_show,
  // business_declare_no_show) supersedes the pending negotiation rows on its way
  // out; this is the one terminal path written in TypeScript, and it didn't — so
  // a normally-completed trip could carry a permanently 'proposed' amendment or
  // release. The Business's schedule then showed "Waiting for <Driver> to accept"
  // on a finished trip, and because it keeps only the LATEST non-superseded row
  // per mission, that stranded row also masked the accepted one behind it.
  //
  // Service role for the same reason the writes above use it: there is no client
  // write policy on mission_release at all, and none for a Driver on
  // mission_amendment. Non-transactional with the status write, so a crash
  // between the two leaves the row 'proposed' — which is exactly today's state,
  // so this can only improve it.
  if (requested === "completed") {
    const settled = { status: "superseded" as const, responded_at: new Date().toISOString() };
    await Promise.all([
      admin.from("mission_amendment").update(settled).eq("mission_id", missionId).eq("status", "proposed"),
      admin.from("mission_release").update(settled).eq("mission_id", missionId).eq("status", "proposed"),
    ]);
  }

  revalidatePath("/rides");
  revalidatePath("/dispatch");
  return { ok: true };
}

// D61 — the Driver confirms, from 3h before pickup, that they'll be there.
//
// Deliberately does NOT write a status_event: check-in is not a step in the
// trip, it's an answer to a question, and the Business reads it from the pill.
// Same trust model as advanceStatus — verify ownership under RLS, then write
// through the service role (there is no driver UPDATE policy on mission).
//
// The eligibility check is re-run here rather than trusted from the client: the
// button is the UI's business, the rule is the server's.
export async function checkIn(missionId: string): Promise<StatusResult> {
  const { driver } = await getDriverContext();
  if (!driver) return { ok: false, message: "You’re not signed in as a Driver." };

  const supabase = await createClient();
  const { data: mission } = await supabase
    .from("mission")
    .select("id, status, driver_id, pickup_at, checked_in_at")
    .eq("id", missionId)
    .maybeSingle();

  if (!mission || mission.driver_id !== driver.id) {
    return { ok: false, message: "This isn’t one of your missions." };
  }
  if (mission.checked_in_at) return { ok: true }; // already done — idempotent, not an error
  if (!checkInOpen(mission)) {
    return { ok: false, message: "Check-in opens 3 hours before pickup." };
  }

  const { error } = await createAdminClient()
    .from("mission")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("id", missionId)
    .eq("driver_id", driver.id)
    .is("checked_in_at", null); // first write wins; a double-tap can't move the time
  if (error) return { ok: false, message: "Couldn’t check you in — please try again." };

  revalidatePath("/rides");
  revalidatePath("/missions", "layout");
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
    p_fare_snapshot: settledFare(mission),
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

// Report a Guest no-show (O7, D45 as amended 2026-07-19). Only from 'arrived', once the
// courtesy wait has elapsed — measured from when the GUEST was due (pickup_at, or a tracked
// guest_ready_at), NOT from the Driver's arrival — plus a 5-min on-site floor. The RPC
// enforces all three (airport 60 / city 20 min). Business is charged the full fare; the
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
    p_fare_snapshot: settledFare(mission),
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
