"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDriverContext } from "@/lib/driver";
import { nextStep } from "@/lib/mission-flow";
import { parseWaypoints } from "@/lib/waypoints";
import type { StatusEventStatus } from "@/lib/database.types";

export type StatusResult = { ok: true } | { ok: false; message: string };

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
