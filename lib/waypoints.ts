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
