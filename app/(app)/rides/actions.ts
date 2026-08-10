"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDriverContext } from "@/lib/driver";
import { nextStep } from "@/lib/mission-flow";
import { checkInOpen, needsClosing } from "@/lib/dispatch-status";
import { parseWaypoints } from "@/lib/waypoints";
import { settledFare } from "@/lib/pdp";
import type { CloseAnswer, MissionStep } from "@/lib/database.types";

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

/**
 * § Q slice 2 — the Driver answers "what happened to this trip?" on a trip past
 * its expected end that is still open.
 *
 * ⚑ THE ONE THING THAT MUST NOT CHANGE HERE. `driven` closes the trip with a
 * SINGLE `→ completed` write. It deliberately does NOT walk the flow through
 * `advanceStatus`, and the reason is money: the `on_board` step of that walk runs
 * `board_guest`, and `mission_waiting()` computes `w_to = least(now, guest_due +
 * ceiling)` — so called days after the fact, `now` always loses and it settles
 * the CEILING every time (40 € city / 60 € airport), for waiting nobody observed.
 * Over the 13 unclosed `confirmed` trips live when this was written that was
 * 660,00 € invented, billed to the Business and paid to the Driver.
 *
 * The same walk would also leave the trip in `arrived` if it died partway — the
 * one status that unlocks BOTH no-show doors, on a weeks-old trip where every
 * other guard passes trivially. `arrived` is never passed through.
 *
 * So: no waiting is settled by this path. A trip closed here is worth exactly the
 * fare the Driver accepted (`settledFare` freezes at `accepted_at`), which is
 * what the card says before they tap.
 *
 * `not_driven` settles NOTHING and charges nobody. It is not a cancellation:
 * a cancellation names a party at fault and carries a fee, and nobody knows yet
 * who is at fault — that is why we asked. It clears the Driver's flag and turns
 * the Business's row into "the Driver says this didn't happen · call them".
 */
export async function answerClose(
  missionId: string,
  answer: CloseAnswer,
): Promise<StatusResult> {
  const { driver } = await getDriverContext();
  if (!driver) return { ok: false, message: "You’re not signed in as a Driver." };

  const supabase = await createClient();
  const { data: mission } = await supabase
    .from("mission")
    .select(
      "id, status, driver_id, pickup_at, duration_min, waiting_to, waypoints, stops_reached, mission_type, close_answer",
    )
    .eq("id", missionId)
    .maybeSingle();

  if (!mission || mission.driver_id !== driver.id) {
    return { ok: false, message: "This isn’t one of your missions." };
  }
  if (mission.close_answer) return { ok: true }; // already answered — idempotent
  // The button is the UI's business; the rule is the server's. Re-derived from the
  // same predicate the card and the schedule use, so a stale page can't answer a
  // question that isn't being asked.
  if (!needsClosing(mission)) {
    return { ok: false, message: "This trip isn’t waiting on an answer." };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (answer === "driven") {
    // Atomic: the status guard is part of the UPDATE, so two taps (or a tap racing
    // a Business cancel) can only land once. Nothing touches waiting_*.
    const { data: closed, error } = await admin
      .from("mission")
      .update({ status: "completed", close_answer: "driven", close_answered_at: now })
      .eq("id", missionId)
      .eq("driver_id", driver.id)
      .in("status", ["confirmed", "en_route", "arrived", "on_board"])
      .select("id");
    if (error) return { ok: false, message: "Couldn’t close the trip — please try again." };
    if (!closed || closed.length === 0) {
      return { ok: false, message: "This trip has already moved on — refresh to see it." };
    }
    // ONE event, stamped now. Not four backdated ones: the record should read
    // "closed on 10 Aug for a 21 Jul pickup", which is the truth, rather than
    // manufacturing a departure and a boarding that nobody observed.
    await admin.from("status_event").insert({ mission_id: missionId, status: "completed" });
    // Same tidy-up the normal completion does: a finished trip must not carry a
    // permanently 'proposed' change or release.
    const settled = { status: "superseded" as const, responded_at: now };
    await Promise.all([
      admin.from("mission_amendment").update(settled).eq("mission_id", missionId).eq("status", "proposed"),
      admin.from("mission_release").update(settled).eq("mission_id", missionId).eq("status", "proposed"),
    ]);
  } else {
    // No status change at all. The trip stays where it is; what changes is that
    // somebody has finally said something about it.
    const { error } = await admin
      .from("mission")
      .update({ close_answer: "not_driven", close_answered_at: now })
      .eq("id", missionId)
      .eq("driver_id", driver.id)
      .is("close_answer", null);
    if (error) return { ok: false, message: "Couldn’t record your answer — please try again." };
  }

  revalidatePath("/rides");
  revalidatePath("/missions", "layout");
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

// Driver cancels a trip they hold (O7, D45). Always 100%, and the Driver takes a
// reliability mark. The trip re-pools on the D46 window, NOT always as a SPEED WIN:
// under 24h to pickup it re-enters as a SPEED WIN (70% of ceiling, 5-min climb); at 24h
// or more it re-enters the normal Pool (50%, 10-min climb, SPEED WIN off). Runs the
// atomic driver_cancel_mission RPC
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
// releases free (no fee, no reliability mark) and re-pools on the same D46 24h window as
// every other re-pool path — SPEED WIN under 24h, the normal Pool at or above it; decline →
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
