// Test fixtures — a real MissionRow, built by hand.
//
// Deliberately typed as MissionRow (not a loose object): `npm run typecheck`
// covers tests/, so the day a money-critical column is added to the schema the
// fixture stops compiling and the tests have to acknowledge it. A `Partial<>`
// spread over `any` would have let the suite drift away from the table it claims
// to test.
import { historyFare, type HistoryRow } from "@/lib/history-filter";
import type { MissionRow } from "@/lib/database.types";

/**
 * A neutral mission: posted at 10:00, pickup at 12:00 (Paris, summer = UTC+2),
 * ceiling 100, no curve. Every test overrides only what it is about.
 *
 * The ISO strings carry an explicit +02:00 offset rather than a `Z`, so a
 * "12:00 pickup" in a test reads as noon in Paris — the timezone every bucket in
 * this app is computed in.
 */
export function mission(over: Partial<MissionRow> = {}): MissionRow {
  return {
    id: "m-1",
    business_id: "b-1",
    dispatcher_id: "d-1",
    driver_id: null,
    status: "pooled",
    mission_type: "transfer",
    group_id: null,
    category: "business",
    zone: "nice",
    pickup_address: "58 Boulevard des Moulins, 06000 Nice, France",
    pickup_lat: 43.7,
    pickup_lng: 7.26,
    dropoff_address: "1 Promenade des Anglais, 06000 Nice, France",
    dropoff_lat: 43.69,
    dropoff_lng: 7.25,
    pickup_label: null,
    dropoff_label: null,
    waypoints: null,
    stops_reached: 0,
    pickup_at: "2026-07-15T12:00:00+02:00",
    flight_number: null,
    flight_eta: null,
    guest_ready_at: null,
    passenger_name: null,
    passenger_names: null,
    pax_count: 2,
    luggage_count: 1,
    luggage_only: false,
    comment: null,
    reference: null,
    base_fare: 50,
    ceiling: 100,
    pdp_start: null,
    pdp_step: null,
    pdp_interval: null,
    speed_win: false,
    required_body_type: "sedan",
    required_make: null,
    required_model: null,
    required_languages: null,
    dress_code: null,
    driver_flags: null,
    board_name: null,
    board_file_path: null,
    driver_message: null,
    distance_km: 12,
    duration_min: 25,
    cancelled_by: null,
    cancelled_at: null,
    created_at: "2026-07-15T10:00:00+02:00",
    accepted_at: null,
    confirmed_at: null,
    checked_in_at: null,
    close_answer: null,
    close_answered_at: null,
    info_edited_at: null,
    cancellation_fee: null,
    cancellation_reason: null,
    pooled_at: null,
    no_show: false,
    no_show_at: null,
    no_show_by: null,
    waiting_from: null,
    waiting_to: null,
    waiting_minutes: null,
    waiting_rate: null,
    waiting_fee: null,
    ...over,
  };
}

/**
 * A standard (non-SPEED-WIN) curve: starts at 50 % of the ceiling and climbs
 * 5 € every 10 minutes. Mirrors what dispatch/new/actions.ts writes.
 */
export function standardCurve(ceiling = 100) {
  return {
    ceiling,
    pdp_start: ceiling * 0.5,
    pdp_step: 5,
    pdp_interval: 10,
    speed_win: false,
  } satisfies Partial<MissionRow>;
}

/** A SPEED WIN curve: hotter start (70 %), faster climb (5 min). */
export function speedWinCurve(ceiling = 100) {
  return {
    ceiling,
    pdp_start: ceiling * 0.7,
    pdp_step: 5,
    pdp_interval: 5,
    speed_win: true,
  } satisfies Partial<MissionRow>;
}

/**
 * A completed trip taken `acceptedAfterMin` minutes into its climb — the shape
 * every archive read sees. `settledFare` on this is what the Business owes and
 * what the Driver is paid.
 */
export function completed(over: Partial<MissionRow> = {}): MissionRow {
  return mission({
    status: "completed",
    driver_id: "drv-1",
    ...standardCurve(),
    accepted_at: "2026-07-15T10:20:00+02:00", // 2 steps in → 60
    confirmed_at: "2026-07-15T10:20:00+02:00",
    ...over,
  });
}

/**
 * Wrap a mission the way the page does — `fare`/`counted` come from the real
 * `historyFare`, not from the test, so a row built here is the row the page
 * builds. Override them explicitly only when a test is about a malformed row.
 */
export function row(m: MissionRow, over: Partial<HistoryRow> = {}): HistoryRow {
  const { fare, counted } = historyFare(m);
  return {
    mission: m,
    driverId: m.driver_id,
    driverName: m.driver_id ? "Marc Dubois" : null,
    car: null,
    fare,
    counted,
    ...over,
  };
}
