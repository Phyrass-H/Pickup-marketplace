"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDriverContext } from "@/lib/driver";
import { nextStep } from "@/lib/mission-flow";
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
    .select("id, status, driver_id")
    .eq("id", missionId)
    .maybeSingle();

  if (!mission || mission.driver_id !== driver.id) {
    return { ok: false, message: "This isn’t one of your missions." };
  }

  const expected = nextStep(mission.status);
  if (!expected || expected !== requested) {
    return { ok: false, message: "That step isn’t available right now." };
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
