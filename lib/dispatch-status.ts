// Status "tone" for the Dispatch schedule — the at-a-glance colour a hotel
// scans. Derived from mission.status + time-to-pickup + the D61 check-in.
import type { MissionRow } from "@/lib/database.types";

export type Tone = "neutral" | "info" | "success" | "warn" | "danger";

export interface MissionTone {
  tone: Tone;
  label: string; // short status pill text
  hint?: string; // extra line in the detail / why it needs attention
  needsAttention: boolean; // surfaces the "!" marker beside the pill
  /**
   * Tint the WHOLE row in `tone`, not just the pill — the founder's ask for
   * check-in (D61): a trip nobody has confirmed should be impossible to scroll
   * past. Explicit rather than derived from `tone`, because "No-show" and
   * "Unfilled" are also warn/danger and deliberately do NOT wash.
   */
  wash?: boolean;
}

/** Check-in opens 3h before pickup, and the row escalates to red at 1h. */
export const CHECK_IN_OPENS_MS = 3 * 3_600_000;
const HOURS_3 = CHECK_IN_OPENS_MS;
const HOURS_1 = 1 * 3_600_000;

/**
 * Is the check-in button live for this trip? (Driver side.)
 *
 * A trip accepted less than 3h out opens immediately — there is no window to
 * wait for. Anything past `confirmed` means they've already started, which is a
 * stronger signal than the button, so it stops applying.
 */
export function checkInOpen(
  m: Pick<MissionRow, "status" | "pickup_at" | "checked_in_at">,
  now: Date = new Date(),
): boolean {
  if (m.status !== "confirmed" || m.checked_in_at) return false;
  return new Date(m.pickup_at).getTime() <= now.getTime() + CHECK_IN_OPENS_MS;
}

export function missionTone(
  m: Pick<MissionRow, "status" | "pickup_at" | "checked_in_at"> & {
    no_show?: boolean | null;
  },
  now: Date = new Date(),
  opts: { archived?: boolean } = {},
): MissionTone {
  const pickup = new Date(m.pickup_at).getTime();
  // In the history archive every pickup is in the past, so the "pickup is soon —
  // call them" urgency is never meaningful: show the calm variants instead.
  const within3h = !opts.archived && pickup <= now.getTime() + HOURS_3;
  const within1h = !opts.archived && pickup <= now.getTime() + HOURS_1;

  switch (m.status) {
    case "en_route":
      return { tone: "success", label: "En route", needsAttention: false };
    case "arrived":
      return { tone: "success", label: "Arrived", needsAttention: false };
    case "on_board":
      return { tone: "success", label: "On board", needsAttention: false };
    case "completed":
      if (m.no_show)
        return {
          tone: "warn",
          label: "No-show",
          hint: "Guest didn’t show — the trip was charged in full.",
          needsAttention: false,
        };
      return { tone: "neutral", label: "Completed", needsAttention: false };
    // D61 — check-in replaces "Confirmed" once it opens, then the Driver's own
    // progress (En route → …) takes over above. Beyond 3h nothing is shown: a
    // Driver who hasn't checked in for tomorrow's trip is not news.
    case "confirmed":
      if (m.checked_in_at) return { tone: "info", label: "Checked in", needsAttention: false };
      if (within1h)
        return {
          tone: "danger",
          label: "Not checked in",
          hint: "Pickup is within the hour and the Driver hasn’t checked in — call them.",
          needsAttention: true,
          wash: true,
        };
      if (within3h)
        return {
          tone: "warn",
          label: "Not checked in",
          hint: "Check-in is open and the Driver hasn’t confirmed they’ll be there yet.",
          needsAttention: false,
          wash: true,
        };
      return { tone: "info", label: "Confirmed", needsAttention: false };
    // Vestigial since D55 — `accept_mission` confirms immediately and every old
    // row was backfilled, so nothing reaches this. Kept so an unexpected row
    // renders as something rather than falling through to the raw enum.
    case "accepted":
      return { tone: "info", label: "Accepted", needsAttention: false };
    case "pooled":
      if (within3h)
        return {
          tone: "warn",
          label: "Unfilled",
          hint: "Pickup is soon and no Driver has accepted yet.",
          needsAttention: true,
        };
      return { tone: "neutral", label: "In the Pool", needsAttention: false };
    case "cancelled":
      return { tone: "danger", label: "Cancelled", needsAttention: false, wash: true };
    case "expired":
      return {
        tone: "danger",
        label: "Expired",
        hint: "Was not filled in time.",
        needsAttention: true,
        wash: true,
      };
    default:
      return { tone: "neutral", label: m.status, needsAttention: false };
  }
}

// Mirrors --tone-* in app/globals.css — keep the two in sync. The "info"
// (Confirmed/Accepted) tone is a desaturated steel, kept distinct from the navy
// action accent so a status pill never reads as a clickable button.
export const TONE_COLOR: Record<Tone, string> = {
  neutral: "#667085",
  info: "#1b5e8a",
  success: "#157347",
  warn: "#b54708",
  danger: "#b42318",
};

export const TONE_BG: Record<Tone, string> = {
  neutral: "#eef2f7",
  info: "#e3ebf2",
  success: "#e6f6ec",
  warn: "#fff6ed",
  danger: "#fef3f2",
};

// 'YYYY-MM-DD' in Europe/Paris — the day-bucket key for grouping/calendar.
const parisDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function parisDayKey(iso: string | Date): string {
  return parisDayFmt.format(typeof iso === "string" ? new Date(iso) : iso);
}
