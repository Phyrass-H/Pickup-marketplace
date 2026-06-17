"use client";

import { useEffect, useRef, useState } from "react";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

interface Suggestion {
  mapbox_id: string;
  name: string;
  address: string;
}

function newSession(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  }
}

// Mapbox-backed address field. Uses the **Search Box API** (suggest → retrieve),
// NOT the Geocoding API — Search Box includes points of interest (hotels,
// airports, venues), which a VTC booking form is full of; plain geocoding only
// knows addresses/places and returns junk for POI queries. The visible input is
// for typing; the three HIDDEN inputs (label/lat/lng) are what the form submits,
// and only carry a value once the user PICKS a suggestion (a retrieve call fills
// the coords). Riviera proximity bias by default; "Milano"/"Paris" still work.
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
  const [px, py] = proximity;
  const [query, setQuery] = useState(defaultValue?.label ?? "");
  const [picked, setPicked] = useState<Place | null>(defaultValue ?? null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = useRef<string>(newSession());

  useEffect(() => {
    if (!TOKEN) return;
    if (picked && query === picked.label) return;
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const url =
          `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(query)}` +
          `&language=fr&limit=6&proximity=${px},${py}` +
          `&session_token=${session.current}&access_token=${TOKEN}`;
        const res = await fetch(url, { signal: controller.signal });
        const data = (await res.json()) as {
          suggestions?: {
            mapbox_id?: string;
            name?: string;
            full_address?: string;
            place_formatted?: string;
          }[];
        };
        const list: Suggestion[] = (data.suggestions ?? [])
          .map((s) => ({
            mapbox_id: s.mapbox_id ?? "",
            name: s.name ?? "",
            address: s.full_address || s.place_formatted || "",
          }))
          .filter((s) => s.mapbox_id && s.name);
        setSuggestions(list);
        setOpen(true);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") setSuggestions([]);
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      controller.abort();
    };
  }, [query, picked, px, py]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Resolve a chosen suggestion to coordinates (Search Box retrieve step).
  async function pick(s: Suggestion) {
    if (!TOKEN) return;
    setOpen(false);
    setBusy(true);
    try {
      const url =
        `https://api.mapbox.com/search/searchbox/v1/retrieve/${s.mapbox_id}` +
        `?session_token=${session.current}&access_token=${TOKEN}`;
      const res = await fetch(url);
      const data = (await res.json()) as {
        features?: {
          geometry?: { coordinates?: [number, number] };
          properties?: { full_address?: string; name?: string };
        }[];
      };
      const f = data.features?.[0];
      const c = f?.geometry?.coordinates;
      if (c && Number.isFinite(c[1])) {
        const label = f?.properties?.full_address || f?.properties?.name || s.address || s.name;
        setPicked({ label, lng: c[0], lat: c[1] });
        setQuery(label);
      }
      session.current = newSession(); // fresh session for the next search
    } catch {
      // leave unpicked; the form guards on coords
    } finally {
      setBusy(false);
      setSuggestions([]);
    }
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
          {suggestions.map((s) => (
            <li key={s.mapbox_id}>
              <button type="button" className="ac-item" onClick={() => pick(s)}>
                <span style={{ fontWeight: 500 }}>{s.name}</span>
                {s.address && (
                  <span className="muted" style={{ display: "block", fontSize: 12 }}>
                    {s.address}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {busy && (
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          Locating…
        </p>
      )}
      {query.trim().length >= 3 && !picked && !busy && (
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
