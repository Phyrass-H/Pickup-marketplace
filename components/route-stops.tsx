"use client";

import { useState } from "react";
import { CircleDot, MapPin, Plus, X, GripVertical } from "lucide-react";
import { AddressAutocomplete, type Place } from "@/components/address-autocomplete";

// Route input block: From (pickup) → optional stops → Where to (dropoff), with a
// "+" to add a stop and "×" to remove one (replaces the old free-text textarea
// that read like a comment field). Pickup/dropoff geocode via Mapbox (their
// hidden lat/lng feed Pool matching); stops are address-only, written to the
// hidden `waypoints` field the server action already reads (one per line).

const MAX_STOPS = 5;

export function RouteStops({
  pickupDefault,
  dropoffDefault,
  stopsDefault,
}: {
  pickupDefault: Place | null;
  dropoffDefault: Place | null;
  stopsDefault: string[];
}) {
  const [stops, setStops] = useState<string[]>(stopsDefault);

  const setStop = (i: number, v: string) =>
    setStops((s) => s.map((x, j) => (j === i ? v : x)));
  const addStop = () => setStops((s) => (s.length >= MAX_STOPS ? s : [...s, ""]));
  const removeStop = (i: number) => setStops((s) => s.filter((_, j) => j !== i));

  const waypointsValue = stops.map((s) => s.trim()).filter(Boolean).join("\n");

  return (
    <div className="field">
      <span style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 8 }}>
        Route
      </span>

      <div className="route-block">
        <div className="route-rail">
          {/* Pickup */}
          <div className="route-row">
            <span className="route-ic route-ic--from" aria-hidden>
              <CircleDot size={20} />
            </span>
            <div className="route-input">
              <AddressAutocomplete
                labelName="pickup_address"
                latName="pickup_lat"
                lngName="pickup_lng"
                defaultValue={pickupDefault}
                placeholder="From — hôtel, address, airport…"
              />
            </div>
            <button
              type="button"
              className="route-add"
              onClick={addStop}
              disabled={stops.length >= MAX_STOPS}
              aria-label="Add a stop"
              title={stops.length >= MAX_STOPS ? "Max stops reached" : "Add a stop"}
            >
              <Plus size={20} />
            </button>
          </div>

          {/* Stops */}
          {stops.map((s, i) => (
            <div className="route-row route-row--stop" key={i}>
              <span className="route-ic route-ic--stop" aria-hidden>
                <GripVertical size={16} />
              </span>
              <div className="route-input">
                <input
                  type="text"
                  value={s}
                  onChange={(e) => setStop(i, e.target.value)}
                  placeholder={`Stop ${i + 1}`}
                  aria-label={`Stop ${i + 1}`}
                />
              </div>
              <button
                type="button"
                className="route-rm"
                onClick={() => removeStop(i)}
                aria-label={`Remove stop ${i + 1}`}
                title="Remove stop"
              >
                <X size={18} />
              </button>
            </div>
          ))}

          {/* Dropoff */}
          <div className="route-row">
            <span className="route-ic route-ic--to" aria-hidden>
              <MapPin size={20} />
            </span>
            <div className="route-input">
              <AddressAutocomplete
                labelName="dropoff_address"
                latName="dropoff_lat"
                lngName="dropoff_lng"
                defaultValue={dropoffDefault}
                placeholder="Where to?"
              />
            </div>
          </div>
        </div>
      </div>

      <input type="hidden" name="waypoints" value={waypointsValue} />
    </div>
  );
}
