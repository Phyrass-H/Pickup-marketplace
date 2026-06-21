"use client";

import { useEffect, useRef, useState } from "react";
import { CircleDot, MapPin, Plus, X, Square, Route } from "lucide-react";
import { AddressAutocomplete, type Place, type DefaultPlace } from "@/components/address-autocomplete";
import { parisLocalToUtc } from "@/lib/time";
import { formatKm, formatDuration } from "@/lib/format";

// Route input block: From (pickup) → optional stops → Where to (dropoff). Each
// row is a Mapbox address field (POI-aware), so a STOP is geocoded too — its
// coords feed the live ETA and are persisted on the mission's waypoints. An
// "Add a stop" row inserts a stop between the pickup and dropoff. As soon as the
// pickup and dropoff are both picked, we fetch a live distance + travel time
// (via /api/eta, through any picked stops) and show "27 km · 40 min" under the
// card — like any ride app. Stops are written to the hidden `waypoints` field as
// JSON [{address,lat,lng}] (the server action reads it back).

const MAX_STOPS = 5;

interface StopState {
  id: string; // stable key: the stop fields are stateful, so index keys would
  // carry one row's typed text into another when a middle stop is removed.
  text: string;
  place: Place | null;
}

interface Metrics {
  distanceKm: number;
  durationMin: number;
}

// Snapshot published upward so a parent (the new-mission Summary rail) can mirror
// the route + live ETA without owning the inputs. RouteStops stays the source of
// truth for the form fields; this is display-only.
export interface RouteSummary {
  pickup: Place | null;
  dropoff: Place | null;
  stopCount: number;
  eta: Metrics | null;
}

export function RouteStops({
  pickupDefault,
  dropoffDefault,
  stopsDefault,
  pickupAtLocal,
  onSummaryChange,
}: {
  pickupDefault: Place | null;
  dropoffDefault: Place | null;
  stopsDefault: DefaultPlace[];
  pickupAtLocal?: string;
  onSummaryChange?: (s: RouteSummary) => void;
}) {
  const [pickup, setPickup] = useState<Place | null>(pickupDefault);
  const [dropoff, setDropoff] = useState<Place | null>(dropoffDefault);
  const [stops, setStops] = useState<StopState[]>(() =>
    stopsDefault.map((d, i) => ({
      id: `s${i}`, // deterministic for the initial set (SSR-safe)
      text: d.label,
      place:
        Number.isFinite(d.lat) && Number.isFinite(d.lng)
          ? { label: d.label, lat: d.lat as number, lng: d.lng as number }
          : null,
    })),
  );
  // Ids for stops added after mount (client-only, so non-deterministic is fine).
  const nextId = useRef(stopsDefault.length);
  const [eta, setEta] = useState<Metrics | null>(null);
  const [etaLoading, setEtaLoading] = useState(false);

  const addStop = () =>
    setStops((s) =>
      s.length >= MAX_STOPS ? s : [...s, { id: `s${nextId.current++}`, text: "", place: null }],
    );
  const removeStop = (i: number) => setStops((s) => s.filter((_, j) => j !== i));
  const setStop = (i: number, v: { text: string; place: Place | null }) =>
    setStops((s) => s.map((x, j) => (j === i ? { ...x, ...v } : x)));

  // Stops written as JSON so each carries its coords (used for the cached ETA).
  const waypoints = stops
    .map((s) => ({
      address: s.text.trim(),
      lat: s.place?.lat ?? null,
      lng: s.place?.lng ?? null,
    }))
    .filter((w) => w.address);
  const waypointsValue = JSON.stringify(waypoints);

  const pickedStops = stops.filter((s) => s.place).map((s) => s.place as Place);
  const canRoute = !!(pickup && dropoff);

  // Live ETA: pickup → picked stops → dropoff. Traffic-aware when a future pickup
  // time is set (depart_at), matching the value cached at posting. Debounced +
  // aborted so rapid edits don't pile up requests.
  useEffect(() => {
    if (!pickup || !dropoff) {
      setEta(null);
      setEtaLoading(false);
      return;
    }
    const points = [pickup, ...pickedStops, dropoff].map((p) => ({ lat: p.lat, lng: p.lng }));
    const at = pickupAtLocal ? parisLocalToUtc(pickupAtLocal) : null;
    const departAt =
      at && at.getTime() > Date.now() ? at.toISOString().replace(/\.\d{3}Z$/, "Z") : null;

    const controller = new AbortController();
    setEtaLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/eta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points, departAt }),
          signal: controller.signal,
        });
        const data = (await res.json()) as { metrics?: Metrics | null };
        setEta(data.metrics ?? null);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") setEta(null);
      } finally {
        // A superseded (aborted) run must not clear the flag the newer run owns.
        if (!controller.signal.aborted) setEtaLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pickup?.lat,
    pickup?.lng,
    dropoff?.lat,
    dropoff?.lng,
    pickedStops.map((p) => `${p.lng},${p.lat}`).join(";"),
    pickupAtLocal,
  ]);

  const viaCount = pickedStops.length;

  // Publish a display snapshot upward (for the live Summary rail). Effect, not
  // render, so it never warns; onSummaryChange is expected to be a stable setter.
  useEffect(() => {
    onSummaryChange?.({ pickup, dropoff, stopCount: viaCount, eta });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, dropoff, viaCount, eta]);

  return (
    <div className="field" style={{ marginBottom: 0 }}>
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
                onChange={(s) => setPickup(s.place)}
              />
            </div>
          </div>

          {/* Stops */}
          {stops.map((s, i) => (
            <div className="route-row route-row--stop" key={s.id}>
              <span className="route-ic route-ic--stop" aria-hidden>
                <Square size={11} fill="currentColor" strokeWidth={0} />
              </span>
              <div className="route-input">
                <AddressAutocomplete
                  defaultValue={{ label: s.text, lat: s.place?.lat, lng: s.place?.lng }}
                  placeholder={`Stop ${i + 1}`}
                  compact
                  proximity={pickup ? [pickup.lng, pickup.lat] : undefined}
                  onChange={(st) => setStop(i, st)}
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

          {/* Add a stop — the whole row is the button so the + reads as one */}
          {stops.length < MAX_STOPS && (
            <button type="button" className="route-row route-row--add" onClick={addStop}>
              <span className="route-ic route-ic--add" aria-hidden>
                <Plus size={16} />
              </span>
              <span className="route-addrow__label">Add a stop</span>
            </button>
          )}

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
                proximity={pickup ? [pickup.lng, pickup.lat] : undefined}
                onChange={(s) => setDropoff(s.place)}
              />
            </div>
          </div>
        </div>

        {/* Live distance + travel time — a footer inside the route card */}
        {canRoute && (eta || etaLoading) && (
          <div
            className={`route-eta${eta ? "" : " route-eta--loading"}`}
            role="status"
            aria-live="polite"
          >
            <span className="route-eta__ic" aria-hidden>
              <Route size={15} />
            </span>
            {eta ? (
              <span>
                {formatKm(eta.distanceKm)} · {formatDuration(eta.durationMin)}
                {viaCount > 0 && ` · via ${viaCount} stop${viaCount === 1 ? "" : "s"}`}
              </span>
            ) : (
              <span>Estimating distance &amp; time…</span>
            )}
          </div>
        )}
      </div>

      <input type="hidden" name="waypoints" value={waypointsValue} />
      <input type="hidden" name="route_distance_km" value={eta?.distanceKm ?? ""} />
      <input type="hidden" name="route_duration_min" value={eta?.durationMin ?? ""} />
    </div>
  );
}
