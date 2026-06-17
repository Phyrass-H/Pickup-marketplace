// Status "tone" for the Dispatch schedule — the at-a-glance colour a hotel
// scans. Derived from mission.status + time-to-pickup, so the red "not
// confirmed near pickup" warning works without the (not-yet-built) Lock-in job.
import type { MissionRow } from "@/lib/database.types";

export type Tone = "neutral" | "info" | "success" | "warn" | "danger";

export interface MissionTone {
  tone: Tone;
  label: string; // short status pill text
  hint?: string; // extra line in the detail / why it needs attention
  needsAttention: boolean; // surfaces a red marker on the row
}

const HOURS_3 = 3 * 3_600_000;

export function missionTone(
  m: Pick<MissionRow, "status" | "pickup_at">,
  now: Date = new Date(),
): MissionTone {
  const pickup = new Date(m.pickup_at).getTime();
  const within3h = pickup <= now.getTime() + HOURS_3;

  switch (m.status) {
    case "en_route":
      return { tone: "success", label: "En route", needsAttention: false };
    case "arrived":
      return { tone: "success", label: "Arrived", needsAttention: false };
    case "on_board":
      return { tone: "success", label: "On board", needsAttention: false };
    case "completed":
      return { tone: "neutral", label: "Completed", needsAttention: false };
    case "confirmed":
      return { tone: "info", label: "Confirmed", needsAttention: false };
    case "accepted":
      if (within3h)
        return {
          tone: "danger",
          label: "Not confirmed",
          hint: "Pickup is soon and the Driver hasn’t confirmed — call them.",
          needsAttention: true,
        };
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
      return { tone: "danger", label: "Cancelled", needsAttention: false };
    case "expired":
      return {
        tone: "danger",
        label: "Expired",
        hint: "Was not filled in time.",
        needsAttention: true,
      };
    default:
      return { tone: "neutral", label: m.status, needsAttention: false };
  }
}

export const TONE_COLOR: Record<Tone, string> = {
  neutral: "#667085",
  info: "#1d6fe0",
  success: "#157347",
  warn: "#b54708",
  danger: "#b42318",
};

export const TONE_BG: Record<Tone, string> = {
  neutral: "#eef2f7",
  info: "#e7f0ff",
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
