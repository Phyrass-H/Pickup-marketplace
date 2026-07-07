// Mission edit — PHASE 2 (D39). Shared helpers for the amendment / consent flow:
// the "was → now" snapshot, the route diff the Driver's card renders, and the
// decline reasons. The DB shape lives in database.types.ts; the atomic apply is
// the respond_to_amendment RPC. Fare/route are the only things an amendment moves.
import type { Json, Waypoint, MissionAmendmentRow } from "@/lib/database.types";
import { parseWaypoints } from "@/lib/waypoints";

// The trip AS AGREED at propose-time, stored on the amendment for the "was …"
// display (so the record is self-contained even if the mission later changes).
export interface FromSnapshot {
  pickup_address: string;
  dropoff_address: string | null;
  waypoints: Waypoint[];
  distance_km: number | null;
  duration_min: number | null;
  fare: number | null;
  pickup_label: string | null;
  dropoff_label: string | null;
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseFromSnapshot(raw: Json | null | undefined): FromSnapshot {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    pickup_address: String(o.pickup_address ?? ""),
    dropoff_address: o.dropoff_address != null ? String(o.dropoff_address) : null,
    waypoints: parseWaypoints(o.waypoints),
    distance_km: toNum(o.distance_km),
    duration_min: toNum(o.duration_min),
    fare: toNum(o.fare),
    pickup_label: o.pickup_label != null ? String(o.pickup_label) : null,
    dropoff_label: o.dropoff_label != null ? String(o.dropoff_label) : null,
  };
}

// Build the from-snapshot to persist. `fare` is the current agreed fare computed
// at propose-time (currentFare) — the number the Driver already agreed to.
export function buildFromSnapshot(m: {
  pickup_address: string;
  dropoff_address: string | null;
  waypoints: Json | null;
  distance_km: number | null;
  duration_min: number | null;
  pickup_label: string | null;
  dropoff_label: string | null;
}, currentFare: number): Json {
  return {
    pickup_address: m.pickup_address,
    dropoff_address: m.dropoff_address,
    waypoints: (m.waypoints ?? null) as Json,
    distance_km: m.distance_km,
    duration_min: m.duration_min,
    fare: currentFare,
    pickup_label: m.pickup_label,
    dropoff_label: m.dropoff_label,
  } as Json;
}

// The first, most-recognisable part of a formatted address ("Hôtel du Cap-Eden-Roc,
// Antibes, France" → "Hôtel du Cap-Eden-Roc"). Used for compact change labels.
export function firstPart(address: string | null | undefined): string {
  const s = (address ?? "").trim();
  return s.split(",")[0]?.trim() || s;
}

function norm(a: string | null | undefined): string {
  return (a ?? "").trim().toLowerCase();
}

// ---- Route diff: what changed between the agreed trip and the proposal --------
export interface RouteLeg {
  kind: "pickup" | "stop" | "dropoff";
  address: string;
  isNew: boolean; // pickup/dropoff changed, or a stop not present before
}
export interface RouteDiff {
  legs: RouteLeg[]; // the NEW route, top-to-bottom
  removedStops: string[]; // agreed stops no longer in the route
  pickupChanged: boolean;
  dropoffChanged: boolean;
  addedStops: string[];
  hasChanges: boolean;
}

export interface RoutePoints {
  pickup: string;
  dropoff: string | null;
  waypoints: Waypoint[];
}

// Address-based diff (advisory display, not the source of truth — the RPC applies
// the full proposed route regardless). Matches stops by normalised address.
export function routeDiff(from: RoutePoints, to: RoutePoints): RouteDiff {
  const fromStops = new Set(from.waypoints.map((w) => norm(w.address)));
  const toStops = new Set(to.waypoints.map((w) => norm(w.address)));

  const pickupChanged = norm(from.pickup) !== norm(to.pickup);
  const dropoffChanged = norm(from.dropoff) !== norm(to.dropoff);

  const legs: RouteLeg[] = [
    { kind: "pickup", address: to.pickup, isNew: pickupChanged },
    ...to.waypoints.map((w) => ({
      kind: "stop" as const,
      address: w.address,
      isNew: !fromStops.has(norm(w.address)),
    })),
    { kind: "dropoff", address: to.dropoff ?? "—", isNew: dropoffChanged },
  ];

  const addedStops = to.waypoints
    .filter((w) => !fromStops.has(norm(w.address)))
    .map((w) => w.address);
  const removedStops = from.waypoints
    .filter((w) => !toStops.has(norm(w.address)))
    .map((w) => w.address);

  return {
    legs,
    removedStops,
    pickupChanged,
    dropoffChanged,
    addedStops,
    hasChanges:
      pickupChanged || dropoffChanged || addedStops.length > 0 || removedStops.length > 0,
  };
}

// Short human summary of the change(s), e.g. ["Add a stop at Eden-Roc",
// "New destination Monaco"] — used in the schedule "pending" state + previews.
export function changeSummaryParts(diff: RouteDiff): string[] {
  const parts: string[] = [];
  if (diff.pickupChanged) parts.push(`New pickup ${firstPart(diff.legs[0]?.address)}`);
  for (const s of diff.addedStops) parts.push(`Add a stop at ${firstPart(s)}`);
  for (const s of diff.removedStops) parts.push(`Remove the stop at ${firstPart(s)}`);
  if (diff.dropoffChanged) {
    const dp = diff.legs[diff.legs.length - 1]?.address;
    parts.push(`New destination ${firstPart(dp)}`);
  }
  return parts;
}

export function changeSummary(diff: RouteDiff): string {
  const parts = changeSummaryParts(diff);
  if (parts.length === 0) return "Fare change";
  if (parts.length <= 2) return parts.join(" · ");
  return `${parts.length} changes`;
}

// ---- Decline reasons (optional, softens the rejection for the Business) --------
export interface DeclineReason {
  key: string;
  label: string;
}
export const DECLINE_REASONS: readonly DeclineReason[] = [
  { key: "schedule_tight", label: "Schedule too tight" },
  { key: "too_far", label: "Too far out of my way" },
  { key: "timing", label: "Timing doesn't work" },
  { key: "other", label: "Other" },
];

export function declineReasonLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return DECLINE_REASONS.find((r) => r.key === key)?.label ?? key;
}

// The two ISO instants for the trip's drop-off time, before and after — pickup_at
// (unchanged in v1) + each duration. Returns ISO strings (or null when unknown).
export function dropoffInstants(
  pickupAtIso: string,
  fromDurationMin: number | null,
  toDurationMin: number | null,
): { before: string | null; after: string | null } {
  const base = new Date(pickupAtIso).getTime();
  const mk = (min: number | null) =>
    min == null || !Number.isFinite(base) ? null : new Date(base + min * 60_000).toISOString();
  return { before: mk(fromDurationMin), after: mk(toDurationMin) };
}

// Is this amendment still awaiting the Driver's answer?
export function isPending(a: Pick<MissionAmendmentRow, "status">): boolean {
  return a.status === "proposed";
}
