// O7 cancellation + waiting policy (D45 · D47 · D48). MIRRORS, and must be kept in step
// with, docs/migrations/: 2026-07-13_o7_cancellation.sql · 2026-07-19_repool_speedwin_window.sql
// · 2026-07-19_no_show_clock_origin.sql · 2026-07-19_no_show_airport_label.sql ·
// 2026-07-22_waiting_fee.sql (mission_waiting / business_declare_no_show).
// Euro AMOUNTS settle MANUAL in beta; these are the fixed RULES, shared by the UI (to show
// the live cost) and the server actions (the fare snapshot).
import type { MissionRow } from "@/lib/database.types";

// Airport pickup = a flight number OR an airport-looking pickup address OR place label.
// The label matters: the Mapbox autocomplete stores the POI name ("Aéroport Nice Côte
// d'Azur") in pickup_label and the navigable street address in pickup_address, so an
// airport booked from autocomplete has NO keyword in the address.
//
// Matches the bare ASCII substring 'roport' rather than a[eé]roport: that is present in
// aéroport / aeroport / Aeroporto whatever the accent, case or Unicode normalisation
// (NFC vs NFD). The old bracket expression silently failed inside Postgres for a multibyte
// character, so every accented airport pickup was being treated as a 20-min city one —
// see 2026-07-22_airport_accent_fix.sql, which this mirrors.
const AIRPORT_RE = /roport|airport/i;

export function isAirportPickup(
  m: Pick<MissionRow, "flight_number" | "pickup_address"> & {
    pickup_label?: string | null;
  },
): boolean {
  if (m.flight_number) return true;
  return AIRPORT_RE.test(`${m.pickup_address ?? ""} ${m.pickup_label ?? ""}`);
}

// The COURTESY WAIT (minutes) — free, charged to nobody: airport 60, city 20.
export function noShowWaitMinutes(isAirport: boolean): number {
  return isAirport ? 60 : 20;
}

// D48 — after the courtesy wait, the Business is charged per minute STARTED and the Driver
// is paid it. The meter stops at the ceiling (total from clock start), so the PAID stretch
// is 40 min city / 60 min airport. ⚠️ The RATE IS PROVISIONAL — research owed (BACKLOG § N);
// settled rows pin their own rate in mission.waiting_rate so history doesn't re-price.
export const WAITING_RATE_PER_MIN = 1;

// Total minutes from clock start at which the METER stops. It does NOT end the trip —
// past this the Driver simply stops earning. Mirrors v_ceiling in mission_waiting().
export function waitingCeilingMinutes(isAirport: boolean): number {
  return isAirport ? 120 : 60;
}

export type Waiting = {
  /** When the paid meter starts = guest due + courtesy wait. */
  from: Date;
  /** When it stops paying = guest due + ceiling. */
  until: Date;
  /** Minutes STARTED so far, already clamped by the ceiling. */
  minutes: number;
  /** minutes * rate, in euros. */
  fee: number;
  /** True once the ceiling is reached — the meter is frozen. */
  capped: boolean;
  /** The most this trip can ever accrue. */
  maxFee: number;
};

// What the Business owes for waiting on this mission at `at`. MIRRORS the SQL helper
// mission_waiting() — keep the two in step; it is the single definition all three
// settlement paths (mark_no_show, business_declare_no_show, business_cancel_mission) use.
export function waitingAt(
  m: Pick<MissionRow, "pickup_at" | "flight_number" | "pickup_address"> & {
    guest_ready_at?: string | null;
    pickup_label?: string | null;
  },
  at: Date | number = Date.now(),
): Waiting {
  const airport = isAirportPickup(m);
  const due = guestDueAt(m).getTime();
  const from = due + noShowWaitMinutes(airport) * 60_000;
  const until = due + waitingCeilingMinutes(airport) * 60_000;
  const now = typeof at === "number" ? at : at.getTime();
  const stop = Math.min(now, until);
  // "Per minute STARTED" — minute 1 is owed the instant the courtesy wait lapses.
  const minutes = Math.max(0, Math.ceil((stop - from) / 60_000));
  const maxMinutes = Math.round((until - from) / 60_000);
  return {
    from: new Date(from),
    until: new Date(until),
    minutes,
    fee: minutes * WAITING_RATE_PER_MIN,
    capped: now >= until,
    maxFee: maxMinutes * WAITING_RATE_PER_MIN,
  };
}

// On-site floor: a Driver who turns up AFTER the courtesy wait already closed still has to be
// present for a few minutes before filing. Never binds for an on-time Driver. Mirrors
// v_floor in mark_no_show().
export const NO_SHOW_ON_SITE_FLOOR_MIN = 5;

// When the Guest was due to be available — the ordered pickup time, or a tracked
// landing-derived instant (guest_ready_at) once flight tracking lands. This is the origin
// of the courtesy wait: it belongs to the GUEST, never to the Driver's "I've arrived" tap.
export function guestDueAt(
  m: Pick<MissionRow, "pickup_at"> & { guest_ready_at?: string | null },
): Date {
  return new Date(m.guest_ready_at ?? m.pickup_at);
}

// When the no-show report unlocks: the courtesy wait measured from the Guest's due moment,
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
