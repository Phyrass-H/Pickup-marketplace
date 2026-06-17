"use client";

import { useState } from "react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { createMission } from "./actions";

// Client form so we can show the live "too-low ceiling" SOFT WARNING (Doc 02):
// a nudge, never a block. Submits to the createMission server action.
export function MissionForm({ error }: { error?: string }) {
  const [ceiling, setCeiling] = useState("");
  const [baseFare, setBaseFare] = useState("");
  const [speedWin, setSpeedWin] = useState(false);

  const ceilingNum = Number(ceiling);
  const baseNum = Number(baseFare);
  const tooLow =
    baseFare !== "" &&
    ceiling !== "" &&
    Number.isFinite(ceilingNum) &&
    Number.isFinite(baseNum) &&
    ceilingNum < baseNum;

  return (
    <form action={createMission} className="card">
      {error === "missing" && (
        <div className="notice error">
          Please fill in the vehicle category, pickup address, pickup time, and a
          ceiling.
        </div>
      )}
      {error === "db" && (
        <div className="notice error">
          Something went wrong posting the mission. Please try again.
        </div>
      )}

      <label className="field">
        <span>Vehicle category (routes to the matching Pool)</span>
        <select name="category" required defaultValue="">
          <option value="" disabled>
            Choose a category…
          </option>
          <option value="eco">Eco</option>
          <option value="business">Business</option>
          <option value="van">Van</option>
          <option value="luxury">Luxury</option>
        </select>
      </label>

      <div className="field">
        <span style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 6 }}>
          Pickup address
        </span>
        <AddressAutocomplete
          labelName="pickup_address"
          latName="pickup_lat"
          lngName="pickup_lng"
          placeholder="Hôtel, address, airport…"
        />
      </div>

      <div className="field">
        <span style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 6 }}>
          Dropoff address
        </span>
        <AddressAutocomplete
          labelName="dropoff_address"
          latName="dropoff_lat"
          lngName="dropoff_lng"
          placeholder="Aéroport Nice Côte d'Azur…"
        />
      </div>

      <label className="field">
        <span>Intermediate stops (optional, one address per line)</span>
        <textarea
          name="waypoints"
          rows={2}
          style={{
            width: "100%",
            padding: 12,
            fontSize: 16,
            border: "1px solid var(--border)",
            borderRadius: 10,
            fontFamily: "inherit",
          }}
        />
      </label>

      <label className="field">
        <span>Pickup date &amp; time</span>
        <input type="datetime-local" name="pickup_at" required />
      </label>

      <div style={{ display: "flex", gap: 12 }}>
        <label className="field" style={{ flex: 1 }}>
          <span>Passengers</span>
          <input type="number" name="pax_count" min={0} inputMode="numeric" />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Luggage</span>
          <input type="number" name="luggage_count" min={0} inputMode="numeric" />
        </label>
      </div>

      <label className="field">
        <span>Guest / passenger name</span>
        <input type="text" name="passenger_name" />
      </label>

      <label className="field">
        <span>Flight number (optional)</span>
        <input type="text" name="flight_number" placeholder="AF1234" />
      </label>

      <label className="field">
        <span>Reference / notes (optional — shown on the schedule line)</span>
        <textarea
          name="comment"
          rows={2}
          placeholder="e.g. Room 312 · or an event name like “Cannes Gala” · or instructions"
          style={{
            width: "100%",
            padding: 12,
            fontSize: 16,
            border: "1px solid var(--border)",
            borderRadius: 10,
            fontFamily: "inherit",
          }}
        />
      </label>

      <div style={{ display: "flex", gap: 12 }}>
        <label className="field" style={{ flex: 1 }}>
          <span>Estimated base fare € (optional)</span>
          <input
            type="number"
            name="base_fare"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={baseFare}
            onChange={(e) => setBaseFare(e.target.value)}
          />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Ceiling € (your maximum)</span>
          <input
            type="number"
            name="ceiling"
            required
            min={0}
            step="0.01"
            inputMode="decimal"
            value={ceiling}
            onChange={(e) => setCeiling(e.target.value)}
          />
        </label>
      </div>

      {tooLow && (
        <div className="notice warn">
          Trips below the recommended fare are rarely accepted and may go
          unfulfilled. You can still post it.
        </div>
      )}

      <label className="check" style={{ marginBottom: 14 }}>
        <input
          type="checkbox"
          name="speed_win"
          checked={speedWin}
          onChange={(e) => setSpeedWin(e.target.checked)}
        />
        SPEED WIN — urgent: start the fare at the ceiling for instant acceptance
      </label>

      <button className="btn" type="submit">
        Post to the Pool
      </button>
    </form>
  );
}
