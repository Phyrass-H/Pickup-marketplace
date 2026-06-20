// Parse mission.waypoints (jsonb) into a typed list of intermediate stops.
// The column is `Json | null`; we keep only objects with a string `address`.
// Shared by the Driver Pool card, the Driver mission detail, and the Dispatch
// trip row so the parsing rule lives in one place.
import type { Waypoint } from "@/lib/database.types";

export function parseWaypoints(raw: unknown): Waypoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (w): w is Waypoint =>
      typeof w === "object" &&
      w !== null &&
      typeof (w as Waypoint).address === "string",
  );
}

// A `type` (not `interface`) so it keeps an implicit index signature and stays
// assignable to the mission row's jsonb `waypoints` (Json) column.
export type StopInput = {
  address: string;
  lat: number | null;
  lng: number | null;
};

function finiteOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Parse the new-mission form's hidden `waypoints` field. The route block writes
// JSON [{address,lat,lng}] (each stop geocoded); legacy drafts may still hold a
// newline-separated list of plain addresses. SHARED by the server action and the
// client-side review preview so the two parsers can never drift apart again.
export function parseWaypointsField(raw: unknown): StopInput[] {
  const s = String(raw ?? "").trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) {
        return arr
          .map((w) => ({
            address: String((w as { address?: unknown })?.address ?? "").trim(),
            lat: finiteOrNull((w as { lat?: unknown })?.lat),
            lng: finiteOrNull((w as { lng?: unknown })?.lng),
          }))
          .filter((w) => w.address);
      }
    } catch {
      // malformed → fall through to legacy newline parsing
    }
  }
  return s
    .split("\n")
    .map((a) => a.trim())
    .filter(Boolean)
    .map((address) => ({ address, lat: null, lng: null }));
}
