// Display helpers. Beta is French Riviera → French locale, Europe/Paris, EUR.
import type { BodyType, MissionStatus, VehicleCategory } from "@/lib/database.types";

const money = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const timeOnly = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const dateOnly = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  timeZone: "Europe/Paris",
});

const monthLong = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

// "2026-06" → "juin 2026". Input is a Paris year-month key (YYYY-MM).
export function formatMonth(monthKey: string): string {
  return monthLong.format(new Date(`${monthKey}-01T12:00:00`));
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return money.format(Number(n));
}

// Straight-line distance, flagged approximate with "~" (it's not road distance).
// Under 10 km we keep one decimal; above, round to the nearest km.
export function formatDistance(km: number | null | undefined): string {
  if (km == null) return "—";
  if (km < 10) return `~${km.toFixed(1).replace(".", ",")} km`;
  return `~${Math.round(km)} km`;
}

// Cached ROAD distance (no "~" — it's a real routed distance). Postgres
// `numeric` comes back from PostgREST as a STRING, so coerce before maths.
export function formatKm(km: number | string | null | undefined): string {
  if (km == null) return "—";
  const n = Number(km);
  if (!Number.isFinite(n)) return "—";
  return n < 10 ? `${n.toFixed(1).replace(".", ",")} km` : `${Math.round(n)} km`;
}

// Travel time: "25 min" or "1 h 05".
export function formatDuration(min: number | string | null | undefined): string {
  if (min == null) return "—";
  const n = Number(min);
  if (!Number.isFinite(n)) return "—";
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

// Card/detail trip line: prefer cached road distance + ETA; fall back to the
// straight-line estimate when routing wasn't available (older missions).
export function formatTripMeta(
  distanceKm: number | string | null | undefined,
  durationMin: number | string | null | undefined,
  straightKm: number | null | undefined,
): string {
  if (distanceKm != null) {
    return durationMin != null
      ? `${formatKm(distanceKm)} · ${formatDuration(durationMin)}`
      : formatKm(distanceKm);
  }
  return straightKm != null ? formatDistance(straightKm) : "";
}

// Countries we drop from the tail of a geocoded address (beta = Riviera, but be
// generous so cross-border Monaco/Italy trips read cleanly too).
const COUNTRY_RE =
  /^(france|monaco|italia|italy|españa|espagne|spain|deutschland|allemagne|germany|suisse|switzerland|belgique|belgium|united kingdom|royaume-uni|uk)$/i;

// Short, scannable label for the dense schedule line: the place name + its town,
// with the postcode and country stripped. Derived at render time from the stored
// formatted address — "1055 Chemin De Rabiac-Estagnol, 06600 Antibes, France"
// becomes "Chemin De Rabiac-Estagnol, Antibes". The EXACT address still shows in
// the expanded trip detail + the Driver's navigation, so nothing is lost. (Phase 1:
// string-derived; a later additive migration can store Mapbox's structured POI
// fields for the prettier "Nice Airport · T1" form.)
export function shortPlaceLabel(address: string | null | undefined): string {
  const raw = (address ?? "").trim();
  if (!raw) return "";
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  // Drop a trailing country segment ("…, Nice, France" → "…, Nice").
  if (parts.length > 1 && COUNTRY_RE.test(parts[parts.length - 1])) parts.pop();
  if (parts.length === 0) return raw;

  // Town = the postcode-bearing segment with its postcode removed ("06600 Antibes"
  // → "Antibes"), scanning from the end; else the last segment, sans any postcode.
  let town = "";
  for (let i = parts.length - 1; i >= 1; i--) {
    const m = parts[i].match(/^\d{4,6}\s+(.+)$/);
    if (m) {
      town = m[1].trim();
      break;
    }
  }
  if (!town && parts.length > 1) {
    town = parts[parts.length - 1].replace(/\b\d{4,6}\b/, "").trim();
  }

  // Name = the first segment without a leading house number ("58 Bd …" → "Bd …").
  const name = parts[0].replace(/^\d+\s*(?:bis|ter)?\s+/i, "").trim() || parts[0];

  // Skip the town when the name already carries it ("Port de Nice" + "Nice").
  if (town && !name.toLowerCase().includes(town.toLowerCase())) return `${name}, ${town}`;
  return name;
}

// The schedule route line: the full address MINUS the redundant trailing country
// (beta is all France/Monaco, so "…, Nice, France" → "…, Nice"). Keeps the house
// number, street, postcode + city untouched. The exact, full address still shows
// on hover + in the expanded trip detail.
export function addressLine(address: string | null | undefined): string {
  const raw = (address ?? "").trim();
  if (!raw) return "";
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1 && COUNTRY_RE.test(parts[parts.length - 1])) parts.pop();
  return parts.join(", ");
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dateTime.format(new Date(iso));
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return timeOnly.format(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dateOnly.format(new Date(iso));
}

// Pool card "when": a relative day + date ("Today · 24 Jul", "Sun · 26 Jul") and
// the time on its own line. `today` flags the current Paris day so the card can
// accent it. Relative today/tomorrow are decided on the Paris calendar date, so
// they never drift with the viewer's own timezone.
const poolWeekday = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  timeZone: "Europe/Paris",
});
const poolDayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});
const parisCalDate = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Paris",
});

export function formatPoolWhen(iso: string | null | undefined): {
  day: string;
  time: string;
  today: boolean;
} {
  if (!iso) return { day: "—", time: "—", today: false };
  const d = new Date(iso);
  const dCal = parisCalDate.format(d);
  const todayCal = parisCalDate.format(new Date());
  // Tomorrow from the Paris calendar date, not a fixed +24h offset — a Paris day
  // is 23h/25h across a DST boundary, so a millisecond offset lands on the wrong
  // date in those two ~1h windows a year. Noon UTC keeps us mid-afternoon Paris.
  const [ty, tm, td] = todayCal.split("-").map(Number);
  const tomorrowCal = parisCalDate.format(new Date(Date.UTC(ty, tm - 1, td + 1, 12)));

  let prefix: string;
  const today = dCal === todayCal;
  if (today) prefix = "Today";
  else if (dCal === tomorrowCal) prefix = "Tomorrow";
  else prefix = poolWeekday.format(d);

  return { day: `${prefix} · ${poolDayMonth.format(d)}`, time: timeOnly.format(d), today };
}

const CATEGORY_LABELS: Record<VehicleCategory, string> = {
  eco: "Eco",
  business: "Business",
  van: "Van", // legacy enum value (pre-O5)
  luxury: "First",
};

export function categoryLabel(c: VehicleCategory): string {
  return CATEGORY_LABELS[c];
}

const BODY_LABELS: Record<BodyType, string> = { sedan: "Sedan", van: "Van" };

// Service class = tier + body, e.g. "Business · Van". Body optional (older/any).
export function serviceClassLabel(c: VehicleCategory, body?: BodyType | null): string {
  const tier = CATEGORY_LABELS[c] ?? c;
  return body ? `${tier} · ${BODY_LABELS[body]}` : tier;
}

const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  draft: "Draft",
  pooled: "Pooled",
  accepted: "Accepted",
  confirmed: "Confirmed",
  en_route: "En route",
  arrived: "Arrived",
  on_board: "On board",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function missionStatusLabel(s: MissionStatus): string {
  return MISSION_STATUS_LABELS[s];
}
