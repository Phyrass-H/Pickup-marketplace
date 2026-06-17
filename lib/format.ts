// Display helpers. Beta is French Riviera → French locale, Europe/Paris, EUR.
import type { MissionStatus, VehicleCategory } from "@/lib/database.types";

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
