// O7 cancellation policy (D45). MIRRORS docs/migrations/2026-07-13_o7_cancellation.sql —
// keep the two in sync. Euro AMOUNTS settle MANUAL in beta; these are the fixed RULES,
// shared by the UI (to show the live cost) and the server actions (the fare snapshot).
import type { MissionRow } from "@/lib/database.types";

// Airport pickup = a flight number OR an airport-looking pickup address. Mirrors the
// SQL `pickup_address ~* '(a[eé]roport|airport)'`.
const AIRPORT_RE = /a[eé]roport|airport/i;

export function isAirportPickup(
  m: Pick<MissionRow, "flight_number" | "pickup_address">,
): boolean {
  return !!m.flight_number || AIRPORT_RE.test(m.pickup_address);
}

// No-show free wait window (minutes): airport 60, city 20.
export function noShowWaitMinutes(isAirport: boolean): number {
  return isAirport ? 60 : 20;
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
