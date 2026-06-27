// Named passengers on a mission. Shared by the client PassengerList, the
// new-mission preview, and the createMission server action so they can't drift
// (mirrors the lib/waypoints.ts pattern).
//
// PRIVACY SPLIT: a passenger's NAME + the "main contact" flag are stored on the
// mission row (mission.passenger_names) — readable by Pool Drivers, which is fine.
// The phone NUMBER + its per-passenger "shared" flag live in a separate table
// (mission_guest_contact) that Drivers cannot read; see the 2026-06-27 migration.
// Both arrays are aligned by index.

export type Passenger = {
  first: string;
  last: string;
  phone: string; // "" when blank
  main?: boolean; // exactly one passenger is the main contact (defaults to the first)
  phoneShared?: boolean; // the Business has shared this number with the Driver
};

// What actually lands on the mission row — no phone, no share state.
export type PassengerRow = { first: string; last: string; main: boolean };

// What lands in the Driver-unreadable side table, aligned by passenger index.
export type GuestContact = { phone: string; shared: boolean };

const MAX_PHONE = 30;

// Seat caps per required Body type. "" / null (Any) allows up to the van cap;
// the form nudges toward a Van once a sedan's capacity is exceeded.
export const SEDAN_SEATS = 4;
export const VAN_SEATS = 7;

export function seatCap(body: string | null | undefined): number {
  return body === "sedan" ? SEDAN_SEATS : VAN_SEATS;
}

// Parse the hidden passenger_names field / a stored jsonb value defensively.
// Accepts an array, a JSON string, or null; always returns a clean array.
// Tolerates both full rows (form payload) and stripped rows (mission column).
export function parsePassengers(value: unknown): Passenger[] {
  const arr = toArray(value);
  return arr.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const phone = String(o.phone ?? "").trim().slice(0, MAX_PHONE);
    return {
      first: String(o.first ?? "").trim(),
      last: String(o.last ?? "").trim(),
      phone,
      main: Boolean(o.main),
      phoneShared: phone ? Boolean(o.phoneShared) : false,
    };
  });
}

// Parse the side table's `contacts` jsonb defensively.
export function parseGuestContacts(value: unknown): GuestContact[] {
  const arr = toArray(value);
  return arr.map((c) => {
    const o = (c ?? {}) as Record<string, unknown>;
    const phone = String(o.phone ?? "").trim().slice(0, MAX_PHONE);
    return { phone, shared: phone ? Boolean(o.shared) : false };
  });
}

function toArray(value: unknown): unknown[] {
  if (value == null) return [];
  let arr: unknown = value;
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return [];
    try {
      arr = JSON.parse(s);
    } catch {
      return [];
    }
  }
  return Array.isArray(arr) ? arr : [];
}

// "First Last", trimmed; "" when both parts are empty.
export function passengerName(p: Passenger): string {
  return `${p.first} ${p.last}`.trim();
}

// Index of the main contact — the flagged one, else the first.
export function mainIndex(passengers: Passenger[]): number {
  const i = passengers.findIndex((p) => p.main);
  return i >= 0 ? i : 0;
}

// The denormalised display name = the main contact if named, else the first
// Guest that actually has a name.
export function primaryPassengerName(passengers: Passenger[]): string {
  if (passengers.length === 0) return "";
  const main = passengers[mainIndex(passengers)];
  const mainName = main ? passengerName(main) : "";
  if (mainName) return mainName;
  for (const p of passengers) {
    const n = passengerName(p);
    if (n) return n;
  }
  return "";
}

// The names-only rows stored on mission.passenger_names. Enforces exactly one
// main flag (so a crafted payload can't leave it ambiguous).
export function passengerRowData(passengers: Passenger[]): PassengerRow[] {
  const mi = mainIndex(passengers);
  return passengers.map((p, i) => ({ first: p.first, last: p.last, main: i === mi }));
}

// The phone rows stored in the side table, aligned by index. `shared` is forced
// false when there's no number.
export function guestContacts(passengers: Passenger[]): GuestContact[] {
  return passengers.map((p) => ({
    phone: (p.phone ?? "").trim().slice(0, MAX_PHONE),
    shared: p.phone ? Boolean(p.phoneShared) : false,
  }));
}

// Rebuild full form rows from the stored names + the side-table contacts (used
// when resuming a draft).
export function mergeContacts(
  passengers: Passenger[],
  contacts: GuestContact[],
): Passenger[] {
  return passengers.map((p, i) => ({
    ...p,
    phone: contacts[i]?.phone ?? "",
    phoneShared: contacts[i]?.shared ?? false,
  }));
}

export type GuestPhone = {
  index: number;
  name: string;
  phone: string;
  shared: boolean;
  main: boolean;
};

// Zip names (passenger_names) with phones (side table) by index, keeping only
// passengers that actually have a number. Used by the Dispatch schedule (all of
// them, with the share toggle) and the Driver reveal (filtered to shared).
export function zipGuestContacts(
  passengers: Passenger[],
  contacts: GuestContact[],
): GuestPhone[] {
  const out: GuestPhone[] = [];
  const n = Math.max(passengers.length, contacts.length);
  for (let i = 0; i < n; i++) {
    const phone = (contacts[i]?.phone ?? "").trim();
    if (!phone) continue;
    const p = passengers[i];
    out.push({
      index: i,
      name: p ? passengerName(p) : "",
      phone,
      shared: Boolean(contacts[i]?.shared),
      main: Boolean(p?.main),
    });
  }
  return out;
}

// Best-effort split of a legacy single "passenger_name" string into first +
// surname (first token → first name, the rest → surname). Used to seed the
// rows when resuming an older draft that predates passenger_names.
export function splitFullName(s: string): Passenger {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "", phone: "", main: true };
  const first = parts.shift() as string;
  return { first, last: parts.join(" "), phone: "", main: true };
}
