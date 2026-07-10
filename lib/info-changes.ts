// Detail-edit change-log (D40 follow-up). Turns an "Edit details" save into a
// list of human-readable change phrases ("Flight BA342 → BA118", "Added guest
// Eleanor Whitmore") for the schedule's "what changed" trail. The phrases are
// computed server-side in updateMissionInfo, stored in mission_info_change (a
// Business-private side table), and rendered verbatim on the Dispatch schedule.
//
// It only compares the INFO fields "Edit details" can touch — never price/route/
// time (a material change goes through the amendment flow, which has its own diff).
import { dressCodeLabel, REQUEST_FLAG_LABEL, type RequestFlagKey } from "@/lib/driver-service";

// A normalised view of the editable info, built from the mission row (old) and
// from the parsed form values (new). Names only for guests — no phone numbers.
export interface InfoSnapshot {
  guests: string[]; // display names, non-empty, in order
  flight: string | null;
  luggage: number | null;
  reference: string | null;
  languages: string[];
  dress: string | null; // raw dress code key
  flags: string[]; // active request-flag keys
  boardName: string | null;
  message: string | null;
  hasBoardFile: boolean;
}

function s(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

// Members of `a` not in `b` (case-insensitive, order preserved from `a`).
function missingFrom(a: string[], b: string[]): string[] {
  const set = new Set(b.map((x) => x.trim().toLowerCase()));
  return a.filter((x) => !set.has(x.trim().toLowerCase()));
}

// Parse the stored jsonb `items` back to a clean string[] for rendering.
export function parseChangeItems(value: unknown): string[] {
  let arr: unknown = value;
  if (typeof value === "string") {
    try {
      arr = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => String(x ?? "").trim()).filter(Boolean);
}

// The ordered list of human phrases describing what changed between two info
// snapshots. Empty when nothing meaningful changed (→ no change-log row written).
export function diffMissionInfo(before: InfoSnapshot, after: InfoSnapshot): string[] {
  const out: string[] = [];

  // Guests (names only — added / removed). A rename reads as a remove + add.
  for (const g of missingFrom(after.guests, before.guests)) out.push(`Added guest ${g}`);
  for (const g of missingFrom(before.guests, after.guests)) out.push(`Removed guest ${g}`);

  // Flight
  const fb = s(before.flight);
  const fa = s(after.flight);
  if (fb !== fa) {
    if (fb && fa) out.push(`Flight ${fb} → ${fa}`);
    else if (fa) out.push(`Added flight ${fa}`);
    else out.push(`Removed flight ${fb}`);
  }

  // Luggage
  const lb = before.luggage ?? null;
  const la = after.luggage ?? null;
  if (lb !== la) out.push(`Luggage ${lb ?? 0} → ${la ?? 0} bags`);

  // Reference (Business-private tag — safe here, this table is Business-only)
  const rb = s(before.reference);
  const ra = s(after.reference);
  if (rb !== ra) {
    if (rb && ra) out.push(`Reference “${rb}” → “${ra}”`);
    else if (ra) out.push(`Added reference “${ra}”`);
    else out.push(`Removed reference “${rb}”`);
  }

  // Languages (set change → show the new list, which is what the Driver now sees)
  if (missingFrom(after.languages, before.languages).length > 0 ||
      missingFrom(before.languages, after.languages).length > 0) {
    const to = after.languages.length ? after.languages.join(", ") : "none";
    out.push(`Languages → ${to}`);
  }

  // Dress code
  if ((before.dress ?? null) !== (after.dress ?? null)) {
    const from = dressCodeLabel(before.dress) ?? "none";
    const to = dressCodeLabel(after.dress) ?? "none";
    out.push(`Dress ${from} → ${to}`);
  }

  // Request flags (added / removed, by label)
  const label = (k: string) => REQUEST_FLAG_LABEL[k as RequestFlagKey] ?? k;
  for (const k of missingFrom(after.flags, before.flags)) out.push(`Added request: ${label(k)}`);
  for (const k of missingFrom(before.flags, after.flags)) out.push(`Removed request: ${label(k)}`);

  // Name board text
  const bb = s(before.boardName);
  const ba = s(after.boardName);
  if (bb !== ba) {
    if (bb && ba) out.push(`Name board ${bb} → ${ba}`);
    else if (ba) out.push(`Set name board to ${ba}`);
    else out.push(`Cleared the name board`);
  }

  // Name-board file (attach / remove — content not shown)
  if (before.hasBoardFile !== after.hasBoardFile) {
    out.push(after.hasBoardFile ? `Attached a name-board file` : `Removed the name-board file`);
  }

  // Private message to the Driver (note that it changed — never its content)
  const mb = s(before.message);
  const ma = s(after.message);
  if (mb !== ma) {
    if (mb && ma) out.push(`Updated the message to the Driver`);
    else if (ma) out.push(`Added a message to the Driver`);
    else out.push(`Removed the message to the Driver`);
  }

  return out;
}
