// Named passengers (first + surname) on a mission. Shared by the client
// PassengerList, the new-mission preview, and the createMission server action so
// they can't drift (mirrors the lib/waypoints.ts pattern).

export type Passenger = {
  first: string;
  last: string;
};

// Seat caps per required Body type. "" / null (Any) allows up to the van cap;
// the form nudges toward a Van once a sedan's capacity is exceeded.
export const SEDAN_SEATS = 4;
export const VAN_SEATS = 7;

export function seatCap(body: string | null | undefined): number {
  return body === "sedan" ? SEDAN_SEATS : VAN_SEATS;
}

// Parse the hidden passenger_names field / a stored jsonb value defensively.
// Accepts an array, a JSON string, or null; always returns a clean array.
export function parsePassengers(value: unknown): Passenger[] {
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
  if (!Array.isArray(arr)) return [];
  return arr.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    return {
      first: String(o.first ?? "").trim(),
      last: String(o.last ?? "").trim(),
    };
  });
}

// "First Last", trimmed; "" when both parts are empty.
export function passengerName(p: Passenger): string {
  return `${p.first} ${p.last}`.trim();
}

// The denormalised display name = the first Guest that actually has a name.
export function primaryPassengerName(passengers: Passenger[]): string {
  for (const p of passengers) {
    const n = passengerName(p);
    if (n) return n;
  }
  return "";
}

// Best-effort split of a legacy single "passenger_name" string into first +
// surname (first token → first name, the rest → surname). Used to seed the
// rows when resuming an older draft that predates passenger_names.
export function splitFullName(s: string): Passenger {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  const first = parts.shift() as string;
  return { first, last: parts.join(" ") };
}
