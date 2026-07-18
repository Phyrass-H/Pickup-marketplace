"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app-context";
import { currentFare } from "@/lib/pdp";

export type ActionResult = { ok: true } | { ok: false; message: string };

const FARE_COLS =
  "id, business_id, ceiling, base_fare, pdp_start, pdp_step, pdp_interval, speed_win, created_at, pooled_at";

function revalidateDispatch() {
  revalidatePath("/dispatch", "layout");
  revalidatePath("/dispatch/calendar");
  revalidatePath("/dispatch/history");
}

// Business cancels one of its trips (O7, D45). FREE while still pooled (no Driver
// committed); once a Driver holds it, a time-based fee applies — business_cancel_mission
// (SECURITY DEFINER) computes the % from time-to-pickup and stamps the terminal cancel.
// The fare snapshot is computed server-side (authoritative) as the euro basis (MANUAL).
export async function businessCancelMission(
  missionId: string,
  reason?: string | null,
): Promise<ActionResult> {
  const ctx = await getAppContext();
  if (!ctx.business) return { ok: false, message: "You’re not signed in as a Business." };

  const supabase = await createClient();
  const { data: mission } = await supabase
    .from("mission")
    .select(FARE_COLS)
    .eq("id", missionId)
    .eq("business_id", ctx.business.id)
    .maybeSingle();
  if (!mission) return { ok: false, message: "This isn’t one of your trips." };

  const { error } = await supabase.rpc("business_cancel_mission", {
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

  revalidateDispatch();
  return { ok: true };
}

// T-60 reclaim (O7, D45): the assigned Driver accepted but never confirmed the Lock-in
// and is unreachable → take the trip back, re-pool as a SPEED WIN, penalty-free. The RPC
// enforces eligibility (status = 'accepted' and pickup within 60 min).
export async function reclaimMission(missionId: string): Promise<ActionResult> {
  const ctx = await getAppContext();
  if (!ctx.business) return { ok: false, message: "You’re not signed in as a Business." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reclaim_mission", { p_mission_id: missionId });
  if (error) {
    const msg = error.message?.trim();
    return {
      ok: false,
      message: msg && msg.length < 120 ? msg : "Couldn’t reclaim — please refresh and try again.",
    };
  }

  revalidateDispatch();
  return { ok: true };
}
