// Vehicle classification — the decisions that decide which rate-card row applies.
//
// A vehicle's TIER is derived from make+model, never self-selected, and the tier
// picks the `rate_card` row (docs/06 §4). So a quiet edit to the catalog is a quiet
// change to what a Business pays and what a Driver earns. These tests pin the calls
// the founder actually made, with the reason attached.

import { describe, it, expect } from "vitest";
import { categorize, suggestedBody, carsFor } from "@/lib/vehicle-catalog";

describe("the V-Class is First, the Vito is Business (founder, 2026-08-16)", () => {
  // Where the premium market draws the line: Blacklane bills a V-Class as its top
  // van at 1.4-1.9x a sedan, and the aggregators list it as "First Class Van" while
  // the Vito sits in "Standard Van". This is why docs/06 §4 has a First — van row.
  it("classifies every V-Class alias as luxury + van", () => {
    for (const model of ["Classe V", "V-Class", "V-Klasse", "Vclass", "V 250", "V 300", "EQV", "V 220", "VLE"]) {
      expect([model, categorize("Mercedes", model)]).toEqual([model, "luxury"]);
      expect([model, suggestedBody("Mercedes", model)]).toEqual([model, "van"]);
    }
  });

  it("leaves the Vito, Sprinter and the VW vans in Business", () => {
    for (const [make, model] of [
      ["Mercedes", "Vito"],
      ["Mercedes", "Vito Tourer"],
      ["Mercedes", "Sprinter"],
      ["Volkswagen", "Multivan"],
      ["Volkswagen", "Caravelle"],
      ["Volkswagen", "ID. Buzz"],
    ] as const) {
      expect([model, categorize(make, model)]).toEqual([model, "business"]);
      expect([model, suggestedBody(make, model)]).toEqual([model, "van"]);
    }
  });

  it("offers the V-Class only in the First+van picker", () => {
    expect(carsFor("luxury", "van").map((c) => c.model)).toContain("Classe V");
    expect(carsFor("business", "van").map((c) => c.model)).not.toContain("Classe V");
    expect(carsFor("business", "van").map((c) => c.model)).toContain("Vito");
  });

  it("keeps a First van tier populated at all — the rate-card row needs one", () => {
    // If this ever empties, the First — van row in `rate_card` is unreachable and
    // the price it holds can never apply to anything.
    expect(carsFor("luxury", "van").length).toBeGreaterThan(0);
  });
});

describe("the two-step fallback still holds", () => {
  it("sends an unchecked brand to eco", () => {
    expect(categorize("Dacia", "Logan")).toBe("eco");
    expect(categorize("Renault", "Talisman")).toBe("eco");
  });

  it("sends a checked brand's unlisted model to eco, not to its brand's tier", () => {
    // Deliberate: a Mercedes A-Class is not a Business car just because it is a
    // Mercedes. Unlisted always falls back to the safe, cheapest tier.
    expect(categorize("Mercedes", "Classe A")).toBe("eco");
    expect(categorize("Tesla", "Model 3")).toBe("eco");
    expect(categorize("Tesla", "Model Y")).toBe("eco");
  });

  it("keeps the flagship sedans in First", () => {
    expect(categorize("Mercedes", "Classe S")).toBe("luxury");
    expect(categorize("BMW", "Série 7")).toBe("luxury");
    expect(categorize("Audi", "A8")).toBe("luxury");
  });
});
