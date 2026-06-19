"use client";

import { useState } from "react";
import {
  SERVICE_TIERS,
  BODY_TYPES,
  TIER_LABEL,
  BODY_LABEL,
  carRangeHint,
  type ServiceTier,
  type BodyType,
} from "@/lib/vehicle-catalog";

// The Driver's own vehicle: service TIER + BODY (drive Pool matching) + the car
// details (make/model/colour/plate/seats). Shared by onboarding + settings.
export function DriverVehicleFields({
  defaults,
}: {
  defaults?: {
    category?: string | null;
    body_type?: string | null;
    make?: string | null;
    model?: string | null;
    colour?: string | null;
    plate?: string | null;
    seats?: number | null;
  };
}) {
  const initTier: ServiceTier = (SERVICE_TIERS as string[]).includes(defaults?.category ?? "")
    ? (defaults!.category as ServiceTier)
    : "business";
  const initBody: BodyType = defaults?.body_type === "van" ? "van" : "sedan";

  const [tier, setTier] = useState<ServiceTier>(initTier);
  const [body, setBody] = useState<BodyType>(initBody);
  const hint = carRangeHint(tier, body);

  return (
    <>
      <label className="field">
        <span>Service tier (sets which Pool missions you see)</span>
        <select name="category" value={tier} onChange={(e) => setTier(e.target.value as ServiceTier)}>
          {SERVICE_TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 6 }}>
          Body
        </span>
        <div className="seg" role="group" aria-label="Body type">
          {BODY_TYPES.map((b) => (
            <button
              type="button"
              key={b}
              className={`seg-btn${body === b ? " is-on" : ""}`}
              aria-pressed={body === b}
              onClick={() => setBody(b)}
            >
              {BODY_LABEL[b]}
            </button>
          ))}
        </div>
        <input type="hidden" name="body_type" value={body} />
        {hint && (
          <p className="muted small" style={{ marginTop: 6 }}>
            Common {TIER_LABEL[tier].toLowerCase()} {BODY_LABEL[body].toLowerCase()}s: {hint}
          </p>
        )}
      </div>

      <div className="grid-2">
        <label className="field">
          <span>Make</span>
          <input type="text" name="make" defaultValue={defaults?.make ?? ""} placeholder="Mercedes-Benz" />
        </label>
        <label className="field">
          <span>Model</span>
          <input type="text" name="model" defaultValue={defaults?.model ?? ""} placeholder="Classe E" />
        </label>
        <label className="field">
          <span>Colour</span>
          <input type="text" name="colour" defaultValue={defaults?.colour ?? ""} placeholder="Noir" />
        </label>
        <label className="field">
          <span>Plate</span>
          <input type="text" name="plate" defaultValue={defaults?.plate ?? ""} placeholder="AB-123-CD" />
        </label>
        <label className="field">
          <span>Seats</span>
          <input
            type="text"
            inputMode="numeric"
            name="seats"
            defaultValue={defaults?.seats ?? ""}
            placeholder="4"
          />
        </label>
      </div>
    </>
  );
}
