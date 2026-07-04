"use client";

import { useState } from "react";
import {
  BODY_TYPES,
  BODY_LABEL,
  TIER_LABEL,
  categorize,
  suggestedBody,
  type BodyType,
} from "@/lib/vehicle-catalog";

// The Driver's own vehicle. The service TIER is DERIVED from make+model (the
// two-step fallback) and shown read-only — Drivers don't self-classify. BODY
// (Sedan/Van) is captured separately (pre-filled from the recognised model when
// known). Make/colour/plate matter for the legally-required VTC verification.
export function DriverVehicleFields({
  defaults,
}: {
  defaults?: {
    body_type?: string | null;
    make?: string | null;
    model?: string | null;
    colour?: string | null;
    plate?: string | null;
    seats?: number | null;
    accepts_luggage_runs?: boolean | null;
  };
}) {
  const [make, setMake] = useState(defaults?.make ?? "");
  const [model, setModel] = useState(defaults?.model ?? "");
  const [body, setBody] = useState<BodyType>(defaults?.body_type === "van" ? "van" : "sedan");
  // Whether the Driver has manually set the body (so we stop auto-suggesting).
  const [bodyTouched, setBodyTouched] = useState(!!defaults?.body_type);
  // Opt-in to bags-only Van runs (Sujet B, Phase 1). Off by default.
  const [acceptsLuggage, setAcceptsLuggage] = useState(defaults?.accepts_luggage_runs ?? false);

  const tier = categorize(make, model);
  // Pre-fill body from a recognised model until the Driver overrides it.
  const sugg = suggestedBody(make, model);
  const effectiveBody: BodyType = bodyTouched ? body : sugg ?? body;

  return (
    <>
      <div className="grid-2">
        <label className="field">
          <span>Make</span>
          <input
            type="text"
            name="make"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            placeholder="Mercedes-Benz"
          />
        </label>
        <label className="field">
          <span>Model</span>
          <input
            type="text"
            name="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Classe E"
          />
        </label>
      </div>

      <div className="field">
        <span style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 6 }}>
          Service tier
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="badge">{TIER_LABEL[tier]}</span>
          <span className="muted small">set automatically from your car</span>
        </div>
      </div>

      <div className="field">
        <span style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 6 }}>
          Body
        </span>
        <div className="seg" role="group" aria-label="Body type">
          {BODY_TYPES.map((b) => (
            <button
              type="button"
              key={b}
              className={`seg-btn${effectiveBody === b ? " is-on" : ""}`}
              aria-pressed={effectiveBody === b}
              onClick={() => {
                setBody(b);
                setBodyTouched(true);
              }}
            >
              {BODY_LABEL[b]}
            </button>
          ))}
        </div>
      </div>

      {/* Van Drivers can opt in to bags-only luggage runs (Sujet B, Phase 1). */}
      {effectiveBody === "van" && (
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            cursor: "pointer",
            margin: "-4px 0 18px",
          }}
        >
          <input
            type="checkbox"
            name="accepts_luggage_runs"
            checked={acceptsLuggage}
            onChange={(e) => setAcceptsLuggage(e.target.checked)}
            style={{ marginTop: 3, flexShrink: 0 }}
          />
          <span>
            <span style={{ fontWeight: 600, fontSize: 14, display: "block" }}>
              Available for luggage-only runs
            </span>
            <span className="muted small">
              Get bags-only jobs (no passengers) in your Van. Off by default — turn it on if
              you&apos;re happy to carry luggage.
            </span>
          </span>
        </label>
      )}

      <div className="grid-2">
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

      {/* Derived tier + (possibly auto-suggested) body submit via hidden inputs. */}
      <input type="hidden" name="category" value={tier} />
      <input type="hidden" name="body_type" value={effectiveBody} />
    </>
  );
}
