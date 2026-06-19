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

// Dispatcher's service-class picker (O5): pick a TIER (Eco/Business/Luxury) + a
// BODY (Sedan/Van) — that routes the mission to the matching Pool — and, only if
// the Guest insists, a SPECIFIC car from the catalog. Emits the form fields
// category / required_body_type / required_make / required_model.
export function ServiceClassFields({
  defaults,
}: {
  defaults?: { category?: string | null; body?: string | null; make?: string | null; model?: string | null };
}) {
  const initTier: ServiceTier = (SERVICE_TIERS as string[]).includes(defaults?.category ?? "")
    ? (defaults!.category as ServiceTier)
    : "business";
  const initBody: BodyType = defaults?.body === "van" ? "van" : "sedan";

  const [tier, setTier] = useState<ServiceTier>(initTier);
  const [body, setBody] = useState<BodyType>(initBody);
  const [specific, setSpecific] = useState(
    defaults?.make && defaults?.model ? `${defaults.make}|${defaults.model}` : "",
  );

  // The catalog list depends on tier+body; reset the specific car when they change.
  function changeTier(t: ServiceTier) {
    setTier(t);
    setSpecific("");
  }
  function changeBody(b: BodyType) {
    setBody(b);
    setSpecific("");
  }

  const cars = carsFor(tier, body);
  const hint = carRangeHint(tier, body);
  const [reqMake, reqModel] = specific ? specific.split("|") : ["", ""];

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
        {BODY_TYPES.map((b) => (
          <button
            type="button"
            key={b}
            className={`seg-btn${body === b ? " is-on" : ""}`}
            aria-pressed={body === b}
            onClick={() => changeBody(b)}
          >
            {BODY_LABEL[b]}
          </button>
        ))}
      </div>
      <input type="hidden" name="required_body_type" value={body} />

      {hint && (
        <p className="muted small" style={{ marginTop: 6 }}>
          e.g. {hint}
        </p>
      )}

      <select
        value={specific}
        onChange={(e) => setSpecific(e.target.value)}
        aria-label="Specific car"
        style={{ marginTop: 8 }}
      >
        <option value="">
          Any {TIER_LABEL[tier]} {BODY_LABEL[body].toLowerCase()} (recommended)
        </option>
        {cars.map((c) => (
          <option key={`${c.make}|${c.model}`} value={`${c.make}|${c.model}`}>
            {c.make} {c.model}
          </option>
        ))}
      </select>
      <input type="hidden" name="required_make" value={reqMake} />
      <input type="hidden" name="required_model" value={reqModel} />

      {specific && (
        <p className="muted small" style={{ marginTop: 6 }}>
          Only Drivers with this exact car will see the mission — expect fewer matches.
        </p>
      )}
    </div>
  );
}
