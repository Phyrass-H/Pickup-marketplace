// Beta operational zones — the French Riviera, Saint-Tropez → Monaco/Menton
// (Doc 00 / Doc 04). A Driver picks the towns they serve; a Business tags each
// mission with a town; the Pool matches mission.zone ∈ driver.operational_zones.
// Single source for zone choices across the Driver app + Dispatch.
// Ordered roughly west → east along the coast.
export const BETA_ZONES = [
  "Saint-Tropez",
  "Sainte-Maxime",
  "Saint-Raphaël",
  "Fréjus",
  "Mandelieu-la-Napoule",
  "Cannes",
  "Mougins",
  "Grasse",
  "Antibes",
  "Juan-les-Pins",
  "Cagnes-sur-Mer",
  "Saint-Paul-de-Vence",
  "Vence",
  "Nice",
  "Villefranche-sur-Mer",
  "Beaulieu-sur-Mer",
  "Saint-Jean-Cap-Ferrat",
  "Èze",
  "Cap-d'Ail",
  "Monaco",
  "Roquebrune-Cap-Martin",
  "Menton",
] as const;

export type BetaZone = (typeof BETA_ZONES)[number];
