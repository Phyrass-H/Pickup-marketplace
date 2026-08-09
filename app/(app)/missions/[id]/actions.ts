"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AcceptResult = { ok: true } | { ok: false; message: string };

// Accept a mission. ALL the hard logic — atomic first-wins, slot-conflict, the
// immediate confirm (D55), and the § P expiry check — lives in the DB function
// accept_mission (Doc spine). We just call it AS THE DRIVER (user-session client,
// so auth.uid() resolves) and translate any error into something human-readable.
export async function acceptMission(missionId: string): Promise<AcceptResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("accept_mission", {
    p_mission_id: missionId,
  });

  if (error) {
    return { ok: false, message: friendlyAcceptError(error.message) };
  }

  // The mission left the Pool and entered My Rides — refresh both.
  revalidatePath("/pool");
  revalidatePath("/rides");
  return { ok: true };
}

function friendlyAcceptError(raw: string): string {
  const m = raw.toLowerCase();
  // § P — checked before "no longer available" so the Driver gets the real
  // reason: this one isn't a race they lost, it's a trip that died unfilled.
  if (m.includes("expired"))
    return "Too late — this mission’s pickup time has passed.";
  if (m.includes("no longer available"))
    return "Sorry — this mission was just taken by another Driver.";
  if (m.includes("slot conflict"))
    return "This overlaps with another mission you’ve already accepted.";
  // § B — the DB now enforces the Pool's tier / body / luggage rules, so an accept
  // can fail for a reason this page's own gate didn't catch (a deep link, a stale
  // tab, the dev ?all=1 view, or a hand-rolled call).
  if (m.includes("not eligible"))
    return "This mission doesn’t match your vehicle — check your vehicle and luggage settings.";
  if (m.includes("not a driver"))
    return "Your Driver profile isn’t set up yet.";
  return "Couldn’t accept this mission. Please try again.";
}
