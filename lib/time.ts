// Timezone helpers. Beta is the French Riviera → every wall-clock time the user
// types or reads is Europe/Paris. An <input type="datetime-local"> yields
// "YYYY-MM-DDTHH:mm" with NO timezone; we must interpret that as Paris wall time
// and convert to a UTC instant for storage (Postgres timestamptz). This replaces
// the old `new Date(local)` which silently used the server's local zone.

const PARIS = "Europe/Paris";

// Offset (in minutes) of `timeZone` at a given UTC instant. Positive = ahead of
// UTC (Paris is +60 in winter / +120 in summer).
function tzOffsetMinutes(timeZone: string, instant: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return (asUTC - instant.getTime()) / 60_000;
}

// "YYYY-MM-DDTHH:mm" (Paris wall time) → the matching UTC Date. Null if it can't
// be parsed. Refined once so it stays correct across DST boundaries.
export function parisLocalToUtc(local: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  // First guess: treat the wall time as if it were UTC, then subtract the zone
  // offset at that instant; refine once for the instant we landed on.
  const guessUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Reject out-of-range parts (the regex only checks digit count): Date.UTC
  // silently rolls over (month 13, day 99, hour 99…), which would let a forged
  // POST store a wrong-but-valid instant. If normalisation changed any field,
  // the input was invalid → return null so callers hit the error path.
  const g = new Date(guessUtc);
  if (
    g.getUTCFullYear() !== y ||
    g.getUTCMonth() !== mo - 1 ||
    g.getUTCDate() !== d ||
    g.getUTCHours() !== h ||
    g.getUTCMinutes() !== mi
  ) {
    return null;
  }
  const off1 = tzOffsetMinutes(PARIS, new Date(guessUtc));
  const off2 = tzOffsetMinutes(PARIS, new Date(guessUtc - off1 * 60_000));
  const date = new Date(guessUtc - off2 * 60_000);
  return isNaN(date.getTime()) ? null : date;
}

// UTC ISO instant → "YYYY-MM-DDTHH:mm" Paris wall time, for prefilling a
// datetime-local input (e.g. when resuming a saved draft).
export function utcToParisLocalInput(iso: string): string {
  const off = tzOffsetMinutes(PARIS, new Date(iso));
  const shifted = new Date(new Date(iso).getTime() + off * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}` +
    `T${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}`
  );
}

// "YYYY-MM-DDTHH:mm" (Paris wall time) → a friendly French label, e.g.
// "mar. 23 juin · 14:00". Formats from the parts directly so no second zone
// conversion happens.
export function prettyParisLocal(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return "—";
  const asUtc = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])),
  );
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(asUtc);
}
