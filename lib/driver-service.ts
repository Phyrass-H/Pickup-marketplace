// "Driver & service" card on the new-mission form (S19): the language(s) a Driver
// should speak, a dress code, request flags, the meet & greet name board, and a
// private message to the Driver. Shared by the client DriverServiceFields, the
// new-mission preview, the createMission server action, and every display surface
// so they can't drift (mirrors the lib/passengers.ts pattern).

import type { ServiceTier } from "@/lib/vehicle-catalog";

// ---- Languages ----------------------------------------------------------------
// A fixed, curated set for a France-first luxury VTC. We store the LABELS (the
// chip text) so a future naive match against driver.languages (free-text labels)
// is straightforward. Not a hard Pool filter yet — display + preference only.
export const REQUEST_LANGUAGES = [
  "Français",
  "English",
  "Italiano",
  "Español",
  "Deutsch",
  "العربية",
] as const;

// Tolerant parse of the hidden required_languages field / a stored text[] value.
// Accepts an array, a JSON string, or null; always returns a clean string[].
export function parseLanguages(value: unknown): string[] {
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
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const label = String(v ?? "").trim();
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

// ---- Dress code ---------------------------------------------------------------
// A 4-rung scale. The default is keyed to the service tier and never lands on
// "suit & tie" — the Business has to reach for that deliberately (anti-default).
export const DRESS_CODES = [
  "driver_choice",
  "smart_casual",
  "business_formal",
  "suit_tie",
] as const;
export type DressCode = (typeof DRESS_CODES)[number];

export const DRESS_CODE_LABEL: Record<DressCode, string> = {
  driver_choice: "Driver's choice",
  smart_casual: "Smart casual",
  business_formal: "Business formal",
  suit_tie: "Suit & tie",
};

export const DRESS_CODE_DESC: Record<DressCode, string> = {
  driver_choice: "Clean, neat everyday wear. No specific requirement.",
  smart_casual: "Collared shirt, tidy trousers, clean shoes. No tie.",
  business_formal: "Dark suit, open collar. Tie optional.",
  suit_tie: "Dark suit and tie.",
};

// Per-tier default. The form pre-selects this and (until the Dispatcher touches
// it) keeps it in sync with the chosen tier — eco/business/First → never suit_tie.
export const TIER_DRESS_DEFAULT: Record<ServiceTier, DressCode> = {
  eco: "driver_choice",
  business: "smart_casual",
  luxury: "business_formal", // luxury renders as "First"
};

export function dressCodeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return DRESS_CODE_LABEL[value as DressCode] ?? null;
}

// ---- Request flags ------------------------------------------------------------
// A single jsonb of booleans. PRM/accessible deliberately excluded (it's a
// vehicle category — parked for the Bus expansion, see IDEAS.md). No "card only"
// (PickUp handles payment).
export const REQUEST_FLAG_KEYS = [
  "meet_greet",
  "greeter",
  "luggage_help",
  "child_seat",
  "quiet_ride",
  "pets",
] as const;
export type RequestFlagKey = (typeof REQUEST_FLAG_KEYS)[number];

export const REQUEST_FLAG_LABEL: Record<RequestFlagKey, string> = {
  meet_greet: "Meet & greet",
  greeter: "Greeter — wait at the car",
  luggage_help: "Luggage help",
  child_seat: "Child seat",
  quiet_ride: "Quiet ride",
  pets: "Pets on board",
};

export type DriverFlags = Partial<Record<RequestFlagKey, boolean>>;

// Tolerant parse of the hidden driver_flags field / a stored jsonb value.
// Accepts an object, a JSON string, or null; keeps only known keys that are true.
export function parseDriverFlags(value: unknown): DriverFlags {
  if (value == null) return {};
  let obj: unknown = value;
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return {};
    try {
      obj = JSON.parse(s);
    } catch {
      return {};
    }
  }
  if (typeof obj !== "object" || obj == null || Array.isArray(obj)) return {};
  const rec = obj as Record<string, unknown>;
  const out: DriverFlags = {};
  for (const key of REQUEST_FLAG_KEYS) {
    if (rec[key]) out[key] = true;
  }
  return out;
}

// Active flag keys, in canonical order.
export function activeFlagKeys(flags: DriverFlags): RequestFlagKey[] {
  return REQUEST_FLAG_KEYS.filter((k) => flags[k]);
}

// Labels of active flags, in canonical order (for display).
export function activeFlagLabels(value: unknown): string[] {
  const flags = parseDriverFlags(value);
  return activeFlagKeys(flags).map((k) => REQUEST_FLAG_LABEL[k]);
}
