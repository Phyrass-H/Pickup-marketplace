// O7 cancellation policy (D45). MIRRORS docs/migrations/2026-07-13_o7_cancellation.sql,
// 2026-07-19_repool_speedwin_window.sql (business_cancel_mission) and
// 2026-07-19_no_show_clock_origin.sql (mark_no_show) — keep them in sync. Euro AMOUNTS
// settle MANUAL in beta; these are the fixed RULES, shared by the UI (to show the live
// cost) and the server actions (the fare snapshot).
import type { MissionRow } from "@/lib/database.types";

// Airport pickup = a flight number OR an airport-looking pickup address OR place label.
// The label matters: the Mapbox autocomplete stores the POI name ("Aéroport Nice Côte
// d'Azur") in pickup_label and the navigable street address in pickup_address, so an
// airport booked from autocomplete has NO keyword in the address. Mirrors the SQL in
// 2026-07-19_no_show_airport_label.sql.
const AIRPORT_RE = /a[eé]roport|airport/i;

export function isAirportPickup(
  m: Pick<MissionRow, "flight_number" | "pickup_address"> & {
    pickup_label?: string | null;
  },
): boolean {
  if (m.flight_number) return true;
  return AIRPORT_RE.test(`${m.pickup_address ?? ""} ${m.pickup_label ?? ""}`);
}

// No-show free wait window (minutes): airport 60, city 20.
export function noShowWaitMinutes(isAirport: boolean): number {
  return isAirport ? 60 : 20;
}

// On-site floor: a Driver who turns up AFTER the free wait already closed still has to be
// present for a few minutes before filing. Never binds for an on-time Driver. Mirrors
// v_floor in mark_no_show().
export const NO_SHOW_ON_SITE_FLOOR_MIN = 5;

// When the Guest was due to be available — the ordered pickup time, or a tracked
// landing-derived instant (guest_ready_at) once flight tracking lands. This is the origin
// of the free wait: it belongs to the GUEST, never to the Driver's "I've arrived" tap.
export function guestDueAt(
  m: Pick<MissionRow, "pickup_at"> & { guest_ready_at?: string | null },
): Date {
  return new Date(m.guest_ready_at ?? m.pickup_at);
}

// When the no-show report unlocks: the free wait measured from the Guest's due moment,
// but never before the Driver has been on site for the floor. MIRRORS mark_no_show().
export function noShowAvailableAt(
  m: Pick<MissionRow, "pickup_at" | "flight_number" | "pickup_address"> & {
    guest_ready_at?: string | null;
  },
  arrivedAtIso: string,
): Date {
  const windowEnds =
    guestDueAt(m).getTime() + noShowWaitMinutes(isAirportPickup(m)) * 60_000;
  const floorEnds =
    new Date(arrivedAtIso).getTime() + NO_SHOW_ON_SITE_FLOOR_MIN * 60_000;
  return new Date(Math.max(windowEnds, floorEnds));
}

// Business-cancel fee %, by hours-to-pickup. FREE while still pooled (no Driver
// committed). Once a Driver holds it: free >5h; 50% at −5h; +10%/h (linear, 5%/30 min)
// → 100% at pickup. Mirrors business_cancel_mission().
export function businessCancelPct(hoursToPickup: number, hasDriver: boolean): number {
  if (!hasDriver) return 0;
  if (hoursToPickup > 5) return 0;
  if (hoursToPickup < 0) return 100;
  return Math.min(100, Math.max(50, 50 + 10 * (5 - hoursToPickup)));
}
