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

const CATEGORY_LABELS: Record<VehicleCategory, string> = {
  eco: "Eco",
  business: "Business",
  van: "Van",
  luxury: "Luxury",
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
