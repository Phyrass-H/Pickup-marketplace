"use client";

import { useState } from "react";
import {
  SERVICE_TIERS,
  BODY_TYPES,
  TIER_LABEL,
  BODY_LABEL,
  carsFor,
  carRangeHint,
  type ServiceTier,
  type BodyType,
} from "@/lib/vehicle-catalog";

type BodyChoice = "" | BodyType; // "" = any body (reaches sedan AND van drivers)

// Dispatcher's service-class picker (O5): pick a TIER (Eco/Business/Luxury) + a
// BODY (Any/Sedan/Van) — that routes the mission to the matching Pool — and, only
// if the Guest insists, a SPECIFIC car from the catalog. "Any" body keeps the
// mission visible to both sedan and van Drivers in the tier. Emits the form
// fields category / required_body_type / required_make / required_model.
export function ServiceClassFields({
  defaults,
}: {
  defaults?: { category?: string | null; body?: string | null; make?: string | null; model?: string | null };
}) {
  const initTier: ServiceTier = (SERVICE_TIERS as string[]).includes(defaults?.category ?? "")
    ? (defaults!.category as ServiceTier)
    : "business";
  const initBody: BodyChoice =
    defaults?.body === "van" ? "van" : defaults?.body === "sedan" ? "sedan" : "";

  const [tier, setTier] = useState<ServiceTier>(initTier);
  const [body, setBody] = useState<BodyChoice>(initBody);
  const [specific, setSpecific] = useState(
    defaults?.make && defaults?.model ? `${defaults.make}|${defaults.model}` : "",
  );

  // The catalog list depends on tier+body; reset the specific car when they change.
  function changeTier(t: ServiceTier) {
    setTier(t);
    setSpecific("");
  }
  function changeBody(b: BodyChoice) {
    setBody(b);
    setSpecific("");
  }

  const cars = body ? carsFor(tier, body) : [];
  const hint = body ? carRangeHint(tier, body) : "";
  const [reqMake, reqModel] = specific ? specific.split("|") : ["", ""];
  // Keep a resumed specific car selectable even if it's not in the current slice.
  const specificMissing = !!specific && !cars.some((c) => `${c.make}|${c.model}` === specific);

  const bodyChoices: { value: BodyChoice; label: string }[] = [
    { value: "", label: "Any" },
    ...BODY_TYPES.map((b) => ({ value: b, label: BODY_LABEL[b] })),
  ];

  return (
    <div className="field">
      <span style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 6 }}>
        Service class (routes to the matching Pool)
      </span>

      <select name="category" value={tier} onChange={(e) => changeTier(e.target.value as ServiceTier)}>
        {SERVICE_TIERS.map((t) => (
          <option key={t} value={t}>
            {TIER_LABEL[t]}
          </option>
        ))}
      </select>

      <div className="seg" style={{ marginTop: 8 }} role="group" aria-label="Body type">
        {bodyChoices.map((c) => (
          <button
            type="button"
            key={c.value || "any"}
            className={`seg-btn${body === c.value ? " is-on" : ""}`}
            aria-pressed={body === c.value}
            onClick={() => changeBody(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <input type="hidden" name="required_body_type" value={body} />

      {hint && (
        <p className="muted small" style={{ marginTop: 6 }}>
          e.g. {hint}
        </p>
      )}

      {body && (
        <>
          <select
            value={specific}
            onChange={(e) => setSpecific(e.target.value)}
            aria-label="Specific car"
            style={{ marginTop: 8 }}
          >
            <option value="">
              Any {TIER_LABEL[tier]} {BODY_LABEL[body].toLowerCase()} (recommended)
            </option>
            {specificMissing && (
              <option value={specific}>
                {reqMake} {reqModel}
              </option>
            )}
            {cars.map((c) => (
              <option key={`${c.make}|${c.model}`} value={`${c.make}|${c.model}`}>
                {c.make} {c.model}
              </option>
            ))}
          </select>
          {specific && (
            <p className="muted small" style={{ marginTop: 6 }}>
              Only Drivers with this exact car will see the mission — expect fewer matches.
            </p>
          )}
        </>
      )}

      <input type="hidden" name="required_make" value={reqMake} />
      <input type="hidden" name="required_model" value={reqModel} />
    </div>
  );
}
