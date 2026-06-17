"use client";

import { useEffect, useRef, useState } from "react";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

interface MapboxFeature {
  properties?: { full_address?: string; name?: string; place_formatted?: string };
  geometry?: { coordinates?: [number, number] };
}

// Mapbox-backed address field. The visible input is just for typing; the three
// HIDDEN inputs (label/lat/lng) are what the form submits — and they only carry
// a value once the user PICKS a suggestion, so we never submit an un-geocoded
// address. Editing after a pick clears the coords (they'd be stale). Used for
// the Driver base and the mission pickup/dropoff. Riviera proximity bias by
// default, but typing "Milan"/"Paris" still returns them.
export function AddressAutocomplete({
  labelName,
  latName,
  lngName,
  defaultValue,
  placeholder,
  proximity = [7.2619, 43.7102], // Nice
}: {
  labelName: string;
  latName: string;
  lngName: string;
  defaultValue?: Place | null;
  placeholder?: string;
  proximity?: [number, number];
}) {
  // Primitive proximity coords so the effect deps are stable (the array literal
  // default is a new reference each render — putting it in deps loops forever).
  const [px, py] = proximity;
  const [query, setQuery] = useState(defaultValue?.label ?? "");
  const [picked, setPicked] = useState<Place | null>(defaultValue ?? null);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!TOKEN) return;
    if (picked && query === picked.label) return;
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const url =
          `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}` +
          `&autocomplete=true&limit=5&proximity=${px},${py}&access_token=${TOKEN}`;
        const res = await fetch(url);
        const data = (await res.json()) as { features?: MapboxFeature[] };
        const places: Place[] = (data.features ?? [])
          .map((f) => {
            const c = f.geometry?.coordinates;
            const label =
              f.properties?.full_address ||
              [f.properties?.name, f.properties?.place_formatted].filter(Boolean).join(", ");
            return c ? { label, lng: c[0], lat: c[1] } : null;
          })
          .filter((p): p is Place => !!p && !!p.label && Number.isFinite(p.lat));
        setSuggestions(places);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, picked, px, py]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(p: Place) {
    setPicked(p);
    setQuery(p.label);
    setSuggestions([]);
    setOpen(false);
  }

  function onChange(v: string) {
    setQuery(v);
    if (picked && v !== picked.label) setPicked(null);
  }

  return (
    <div className="ac" ref={boxRef}>
      <input
        type="text"
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
      <input type="hidden" name={labelName} value={picked?.label ?? ""} />
      <input type="hidden" name={latName} value={picked?.lat ?? ""} />
      <input type="hidden" name={lngName} value={picked?.lng ?? ""} />

      {open && suggestions.length > 0 && (
        <ul className="ac-list">
          {suggestions.map((p, i) => (
            <li key={i}>
              <button type="button" className="ac-item" onClick={() => pick(p)}>
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim().length >= 3 && !picked && (
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          Pick an address from the list so we can place it on the map.
        </p>
      )}
      {!TOKEN && (
        <p className="small" style={{ color: "var(--danger)", margin: "4px 0 0" }}>
          Address search is unavailable (Mapbox token missing).
        </p>
      )}
    </div>
  );
}
