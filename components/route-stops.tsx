"use client";

import { useEffect, useRef, useState } from "react";
import { CircleDot, MapPin, Plus, X, Square, Route, ArrowUpDown } from "lucide-react";
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
//
// The pickup/dropoff fields are UNCONTROLLED (AddressAutocomplete seeds from
// defaultValue at mount and submits via its own hidden inputs). To SWAP the two
// ends we remount both with swapped defaultValues via a changing key — so we keep
// each end's {text, place} here as the swap source of truth.

const MAX_STOPS = 5;

type EndState = { text: string; place: Place | null };

function toDefault(s: EndState): DefaultPlace | null {
  if (s.place) return { label: s.place.label, lat: s.place.lat, lng: s.place.lng };
  if (s.text) return { label: s.text };
  return null;
}

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
  etaLoading: boolean;
}

export function RouteStops({
  pickupDefault,
  dropoffDefault,
  stopsDefault,
  pickupAtLocal,
  etaDefault,
  onSummaryChange,
}: {
  pickupDefault: Place | null;
  dropoffDefault: Place | null;
  stopsDefault: DefaultPlace[];
  pickupAtLocal?: string;
  etaDefault?: Metrics | null;
  onSummaryChange?: (s: RouteSummary) => void;
}) {
  const [pickup, setPickup] = useState<EndState>({
    text: pickupDefault?.label ?? "",
    place: pickupDefault,
  });
  const [dropoff, setDropoff] = useState<EndState>({
    text: dropoffDefault?.label ?? "",
    place: dropoffDefault,
  });
  // Bumped on swap to remount both end fields with the swapped defaultValue.
  const [swapNonce, setSwapNonce] = useState(0);

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
  // Seed from a resumed draft's cached ETA so the rail/footer show it immediately
  // (the live fetch recomputes it shortly after).
  const [eta, setEta] = useState<Metrics | null>(etaDefault ?? null);
  const [etaLoading, setEtaLoading] = useState(false);

  const pk = pickup.place;
  const dp = dropoff.place;

  // Swap the two ends (e.g. an arrival, where the saved address belongs in the
  // drop-off, or a mistake to flip without retyping). Both setState calls read
  // this render's closure, so it's a clean swap; the nonce remounts the fields.
  function swapEnds() {
    setPickup(dropoff);
    setDropoff(pickup);
    setSwapNonce((n) => n + 1);
  }

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
  const canRoute = !!(pk && dp);

  // Live ETA: pickup → picked stops → dropoff. Traffic-aware when a future pickup
  // time is set (depart_at), matching the value cached at posting. Debounced +
  // aborted so rapid edits don't pile up requests.
  useEffect(() => {
    if (!pk || !dp) {
      setEta(null);
      setEtaLoading(false);
      return;
    }
    const points = [pk, ...pickedStops, dp].map((p) => ({ lat: p.lat, lng: p.lng }));
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
    pk?.lat,
    pk?.lng,
    dp?.lat,
    dp?.lng,
    pickedStops.map((p) => `${p.lng},${p.lat}`).join(";"),
    pickupAtLocal,
  ]);

  const viaCount = pickedStops.length;

  // Publish a display snapshot upward (for the live Summary rail). Effect, not
  // render, so it never warns; onSummaryChange is expected to be a stable setter.
  useEffect(() => {
    onSummaryChange?.({ pickup: pk, dropoff: dp, stopCount: viaCount, eta, etaLoading });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pk, dp, viaCount, eta, etaLoading]);

  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <div className="route-block">
        <div className="route-main">
          <div className="route-rail">
            {/* Pickup */}
            <div className="route-row">
              <span className="route-ic route-ic--from" aria-hidden>
                <CircleDot size={20} />
              </span>
              <div className="route-input">
                <AddressAutocomplete
                  key={`pickup-${swapNonce}`}
                  labelName="pickup_address"
                  latName="pickup_lat"
                  lngName="pickup_lng"
                  placeLabelName="pickup_label"
                  defaultValue={toDefault(pickup)}
                  placeholder="From — address, airport, station…"
                  onChange={(s) => setPickup({ text: s.text, place: s.place })}
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
                    proximity={pk ? [pk.lng, pk.lat] : undefined}
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
                  key={`dropoff-${swapNonce}`}
                  labelName="dropoff_address"
                  latName="dropoff_lat"
                  lngName="dropoff_lng"
                  placeLabelName="dropoff_label"
                  defaultValue={toDefault(dropoff)}
                  placeholder="Where to?"
                  proximity={pk ? [pk.lng, pk.lat] : undefined}
                  onChange={(s) => setDropoff({ text: s.text, place: s.place })}
                />
              </div>
            </div>
          </div>

          {/* Swap the two ends — flip pickup ⇄ drop-off without retyping. */}
          <button
            type="button"
            className="route-swap"
            onClick={swapEnds}
            aria-label="Swap pickup and drop-off"
            title="Swap pickup and drop-off"
          >
            <ArrowUpDown size={17} />
          </button>
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
