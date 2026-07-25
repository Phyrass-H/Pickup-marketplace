// Shared builders for the two "respond to a change" cards a Driver sees on their own
// mission — the amendment (D39 Phase 2) accept/decline, and the agreed-release (O7, D45)
// accept/decline. Extracted from the old rides list so the dedicated mission page
// (/missions/[id], the "opened" run view) can render them too.
import { currentFare } from "@/lib/pdp";
import { parseWaypoints } from "@/lib/waypoints";
import { routeDiff, parseFromSnapshot } from "@/lib/amendments";
import { formatDateTime, shortPlaceLabel } from "@/lib/format";
import type { AmendmentLeg } from "@/components/amendment-card";
import type {
  MissionRow,
  MissionAmendmentRow,
  MissionReleaseRow,
} from "@/lib/database.types";

// Minutes of gap below which the trip's new end crowds the Driver's next pickup —
// surfaces the amber "it's tighter" heads-up on the change card.
export const SLOT_TIGHT_MIN = 30;

export type AmendmentCardData = ReturnType<typeof buildAmendmentData>;
export type ReleaseCardData = ReturnType<typeof buildReleaseData>;

// Precompute the "accept this change" card's props for a pending amendment: the
// route diff (was → now), the fare/time deltas, and a slot heads-up if the trip's
// new end crowds the Driver's next pickup.
export function buildAmendmentData(
  a: MissionAmendmentRow,
  m: MissionRow,
  missions: MissionRow[],
  businessName: string | null,
) {
  const from = parseFromSnapshot(a.from_snapshot);
  const diff = routeDiff(
    { pickup: from.pickup_address, dropoff: from.dropoff_address, waypoints: from.waypoints },
    {
      pickup: a.new_pickup_address,
      dropoff: a.new_dropoff_address,
      waypoints: parseWaypoints(a.new_waypoints),
    },
  );
  const stops = from.waypoints.length;
  const wasLabel = `${shortPlaceLabel(from.pickup_address)} → ${
    from.dropoff_address ? shortPlaceLabel(from.dropoff_address) : "—"
  }${stops ? ` · ${stops} stop${stops === 1 ? "" : "s"}` : ", direct"}`;

  const durNew = a.new_duration_min;
  const pickupMs = new Date(m.pickup_at).getTime();
  const newEnd = durNew != null ? pickupMs + durNew * 60_000 : null;
  // The Driver's next mission after this one (missions are sorted by pickup_at).
  const next = missions.find(
    (x) => x.id !== m.id && new Date(x.pickup_at).getTime() > pickupMs,
  );
  let slot: { nextPickupIso: string; overlap: boolean } | null = null;
  if (newEnd != null && next) {
    const gapMin = (new Date(next.pickup_at).getTime() - newEnd) / 60_000;
    if (gapMin < SLOT_TIGHT_MIN) slot = { nextPickupIso: next.pickup_at, overlap: gapMin < 0 };
  }

  return {
    amendmentId: a.id,
    proposedBy: businessName ?? "The Business",
    createdAtLabel: formatDateTime(a.created_at),
    legs: diff.legs as AmendmentLeg[],
    removedStops: diff.removedStops,
    wasLabel,
    note: a.note,
    fareOld: from.fare ?? currentFare(m),
    fareNew: Number(a.new_fare),
    distOld: from.distance_km,
    durOld: from.duration_min,
    distNew: a.new_distance_km != null ? Number(a.new_distance_km) : null,
    durNew,
    pickupAtIso: m.pickup_at,
    slot,
  };
}

// Props for the "agreed release" card (O7, D45) — a free mutual release the Driver
// accepts or declines. No route/fare change, so it just needs the trip + who asked.
export function buildReleaseData(
  r: MissionReleaseRow,
  m: MissionRow,
  businessName: string | null,
) {
  return {
    releaseId: r.id,
    businessName: businessName ?? "The Business",
    createdAtLabel: formatDateTime(r.created_at),
    pickup: m.pickup_address,
    dropoff: m.dropoff_address,
    note: r.note,
  };
}
