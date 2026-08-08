// Row builders for the money tests.
//
// A MissionRow has ~60 columns and the money functions read eight of them. These
// builders supply a complete, valid default so a test can say what it is ABOUT
// ("a €100-ceiling trip accepted at 15:00") and nothing else.
//
// ⚑ The defaults are deliberately boring: a pooled transfer, no fees, no waiting,
// no flight. Every fee in a test is one the test put there.
import { historyFare } from "@/lib/history-filter";
import type { HistoryRow } from "@/lib/history-filter";
import type { MissionRow } from "@/lib/database.types";

let seq = 0;

/**
 * A mission row. Pass only what the test cares about.
 *
 * The PDP defaults describe a standard (non-SPEED-WIN) curve: it opens at half
 * the €100 ceiling and climbs €5 every 10 minutes, so 100 minutes in the Pool
 * takes it to the ceiling. Chosen so the arithmetic in a test reads by eye.
 */
export function mission(over: Partial<MissionRow> = {}): MissionRow {
  seq += 1;
  const base: MissionRow = {
    id: `m${seq}`,
    business_id: "biz-1",
    dispatcher_id: "desk-1",
    driver_id: null,
    status: "pooled",
    mission_type: "transfer",
    group_id: null,
    category: "business",
    zone: "nice",
    pickup_address: "1 Promenade des Anglais, Nice",
    pickup_lat: 43.695,
    pickup_lng: 7.265,
    dropoff_address: "Place du Casino, Monaco",
    dropoff_lat: 43.739,
    dropoff_lng: 7.427,
    pickup_label: null,
    dropoff_label: null,
    waypoints: null,
    stops_reached: 0,
    pickup_at: "2026-07-10T12:00:00.000Z",
    flight_number: null,
    flight_eta: null,
    guest_ready_at: null,
    passenger_name: null,
    passenger_names: null,
    pax_count: 2,
    luggage_count: 2,
    luggage_only: false,
    comment: null,
    reference: null,
    base_fare: null,
    ceiling: 100,
    pdp_start: 50,
    pdp_step: 5,
    pdp_interval: 10,
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
    distance_km: 22,
    duration_min: 35,
    cancelled_by: null,
    cancelled_at: null,
    created_at: "2026-07-10T08:00:00.000Z",
    accepted_at: null,
    confirmed_at: null,
    checked_in_at: null,
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
  };
  return { ...base, ...over };
}

/** A mission that ran and closed. Accepted 4h before pickup at €70 on the curve. */
export function completed(over: Partial<MissionRow> = {}): MissionRow {
  return mission({
    status: "completed",
    driver_id: "drv-1",
    // 40 minutes into the climb → 50 + 4×5 = €70.
    accepted_at: "2026-07-10T08:40:00.000Z",
    confirmed_at: "2026-07-10T08:40:00.000Z",
    ...over,
  });
}

/** A mission a Business cancelled after a Driver held it. */
export function cancelled(over: Partial<MissionRow> = {}): MissionRow {
  return mission({
    status: "cancelled",
    driver_id: "drv-1",
    accepted_at: "2026-07-10T08:40:00.000Z",
    cancelled_by: "business",
    cancelled_at: "2026-07-10T10:00:00.000Z",
    cancellation_fee: 42,
    ...over,
  });
}

/**
 * A HistoryRow, with `fare`/`counted` derived by the REAL `historyFare` — the
 * same wiring the page uses. Hand-setting them would let a test agree with
 * itself while the app disagreed.
 */
export function row(
  m: MissionRow,
  over: Partial<Omit<HistoryRow, "mission" | "fare" | "counted">> = {},
): HistoryRow {
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

/** Shorthand: build a mission and wrap it in a HistoryRow in one call. */
export function historyRowOf(over: Partial<MissionRow> = {}): HistoryRow {
  return row(mission(over));
}

// Money comes out of these functions as floats. Compare to the cent, not the bit.
export function cents(n: number): number {
  return Math.round(n * 100);
}
