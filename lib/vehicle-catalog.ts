// PickUp vehicle catalog — the canonical list of cars, organised by
// SERVICE TIER × BODY. One place to maintain (edit this file, redeploy). It
// powers: (1) the Dispatcher's "range of cars per category" hint and the
// optional specific-car picker, (2) the Driver's vehicle picker. Tier maps to
// the live `vehicle_category` enum (eco/business/luxury — 'van' is legacy);
// body maps to the `body_type` enum (sedan/van). Keep models realistic for the
// French Riviera VTC market. This is a STARTER list — extend freely.

import type { VehicleCategory } from "@/lib/database.types";

// Tiers actually offered (subset of vehicle_category; 'van' is a legacy value).
export type ServiceTier = Extract<VehicleCategory, "eco" | "business" | "luxury">;
export type BodyType = "sedan" | "van";

export interface CatalogCar {
  tier: ServiceTier;
  body: BodyType;
  make: string;
  model: string;
  seats: number;
}

export const SERVICE_TIERS: ServiceTier[] = ["eco", "business", "luxury"];
export const BODY_TYPES: BodyType[] = ["sedan", "van"];

export const TIER_LABEL: Record<ServiceTier, string> = {
  eco: "Eco",
  business: "Business",
  luxury: "Luxury",
};

export const BODY_LABEL: Record<BodyType, string> = {
  sedan: "Sedan",
  van: "Van",
};

export const VEHICLE_CATALOG: CatalogCar[] = [
  // ---- Eco · Sedan ----
  { tier: "eco", body: "sedan", make: "Toyota", model: "Prius", seats: 4 },
  { tier: "eco", body: "sedan", make: "Tesla", model: "Model 3", seats: 4 },
  { tier: "eco", body: "sedan", make: "Volkswagen", model: "Passat", seats: 4 },
  { tier: "eco", body: "sedan", make: "Škoda", model: "Superb", seats: 4 },
  { tier: "eco", body: "sedan", make: "Peugeot", model: "508", seats: 4 },
  // ---- Eco · Van ----
  { tier: "eco", body: "van", make: "Renault", model: "Trafic", seats: 8 },
  { tier: "eco", body: "van", make: "Citroën", model: "SpaceTourer", seats: 8 },
  { tier: "eco", body: "van", make: "Volkswagen", model: "Caravelle", seats: 8 },
  // ---- Business · Sedan ----
  { tier: "business", body: "sedan", make: "Mercedes-Benz", model: "Classe E", seats: 4 },
  { tier: "business", body: "sedan", make: "BMW", model: "Série 5", seats: 4 },
  { tier: "business", body: "sedan", make: "Audi", model: "A6", seats: 4 },
  { tier: "business", body: "sedan", make: "Tesla", model: "Model Y", seats: 4 },
  // ---- Business · Van ----
  { tier: "business", body: "van", make: "Mercedes-Benz", model: "Classe V", seats: 7 },
  { tier: "business", body: "van", make: "Volkswagen", model: "Multivan", seats: 7 },
  // ---- Luxury · Sedan ----
  { tier: "luxury", body: "sedan", make: "Mercedes-Benz", model: "Classe S", seats: 3 },
  { tier: "luxury", body: "sedan", make: "BMW", model: "Série 7", seats: 3 },
  { tier: "luxury", body: "sedan", make: "Audi", model: "A8", seats: 3 },
  { tier: "luxury", body: "sedan", make: "Tesla", model: "Model S", seats: 4 },
  // ---- Luxury · Van ----
  { tier: "luxury", body: "van", make: "Mercedes-Benz", model: "Classe V (VIP)", seats: 6 },
];

// Cars for a given tier+body (the "range of cars" shown for a category).
export function carsFor(tier: ServiceTier, body: BodyType): CatalogCar[] {
  return VEHICLE_CATALOG.filter((c) => c.tier === tier && c.body === body);
}

// A short human hint, e.g. "Mercedes Classe E, BMW Série 5, Audi A6…".
export function carRangeHint(tier: ServiceTier, body: BodyType, max = 3): string {
  const names = carsFor(tier, body).map((c) => `${c.make} ${c.model}`);
  if (names.length === 0) return "";
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown}…` : shown;
}
