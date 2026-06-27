"use client";

import { useEffect, useId, useRef, useState } from "react";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Country allowlist for suggestions (ISO 3166-1 alpha-2). The beta is run from
// France, so France-first — but a VTC legitimately drives cross-border (Cannes →
// Monaco / Geneva / Milano / Barcelona / Berlin), so we keep France's neighbours
// and the common long-haul European destinations. `proximity` then ranks the
// nearest hits first. This is what stops the old USA/Canada junk from leaking in
// (proximity only *biases* ranking; country actually *filters*).
const DEFAULT_COUNTRIES = "fr,mc,it,ch,de,es,be,lu,nl,gb,at,pt";

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

// A default may carry only a label (e.g. a resumed draft's stop saved before we
// captured coords) — coords are optional, and we only treat it as "picked" when
// they're present.
export interface DefaultPlace {
  label: string;
  lat?: number | null;
  lng?: number | null;
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

function asPlace(d: DefaultPlace | null | undefined): Place | null {
  if (d && Number.isFinite(d.lat) && Number.isFinite(d.lng)) {
    return { label: d.label, lat: d.lat as number, lng: d.lng as number };
  }
  return null;
}

// Mapbox-backed address field. Uses the **Search Box API** (suggest → retrieve),
// NOT the Geocoding API — Search Box includes points of interest (hotels,
// airports, venues), which a VTC booking form is full of; plain geocoding only
// knows addresses/places and returns junk for POI queries. The visible input is
// for typing; when name props are given, three HIDDEN inputs (label/lat/lng) are
// what the form submits, and only carry a value once the user PICKS a suggestion
// (a retrieve call fills the coords). `onChange` lets a parent mirror the chosen
// place (used to compute the live route ETA). Riviera proximity + an EU country
// allowlist by default; "Geneva"/"Milano"/"Berlin" still resolve. The dropdown is
// a keyboard combobox: ↑/↓ move the highlight, Enter picks it, Esc closes.
export function AddressAutocomplete({
  labelName,
  latName,
  lngName,
  defaultValue,
  placeholder,
  proximity = [7.2619, 43.7102], // Nice
  countries = DEFAULT_COUNTRIES,
  compact = false,
  onChange,
}: {
  labelName?: string;
  latName?: string;
  lngName?: string;
  defaultValue?: DefaultPlace | null;
  placeholder?: string;
  proximity?: [number, number];
  countries?: string;
  compact?: boolean;
  onChange?: (state: { text: string; place: Place | null }) => void;
}) {
  const [px, py] = proximity;
  const [query, setQuery] = useState(defaultValue?.label ?? "");
  const [picked, setPicked] = useState<Place | null>(asPlace(defaultValue));
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1); // keyboard-highlighted suggestion
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = useRef<string>(newSession());
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

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
        // Fetch 10 (the Search Box max) so a real location isn't cut off when a
        // brand query (e.g. "Fnac", "Galeries Lafayette") front-loads several hits.
        const url =
          `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(query)}` +
          `&language=fr&limit=10&country=${countries}&proximity=${px},${py}` +
          `&session_token=${session.current}&access_token=${TOKEN}`;
        const res = await fetch(url, { signal: controller.signal });
        const data = (await res.json()) as {
          suggestions?: {
            mapbox_id?: string;
            name?: string;
            full_address?: string;
            place_formatted?: string;
            feature_type?: string;
          }[];
        };
        const list: Suggestion[] = (data.suggestions ?? [])
          // Drop 'brand'/'category' suggestions: they're search categories
          // ("Fnac — Brand"), not a specific place you can be picked up from —
          // they waste the top slot and resolve to nothing on retrieve.
          .filter((s) => s.feature_type !== "brand" && s.feature_type !== "category")
          .map((s) => ({
            mapbox_id: s.mapbox_id ?? "",
            name: s.name ?? "",
            address: s.full_address || s.place_formatted || "",
          }))
          .filter((s) => s.mapbox_id && s.name)
          .slice(0, 8);
        setSuggestions(list);
        setActive(-1); // fresh results → no stale highlight
        setOpen(true);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") setSuggestions([]);
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      controller.abort();
    };
  }, [query, picked, px, py, countries]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Keep the keyboard-highlighted option scrolled into view (the list scrolls).
  useEffect(() => {
    if (active < 0) return;
    const li = listRef.current?.children[active] as HTMLElement | undefined;
    li?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Resolve a chosen suggestion to coordinates (Search Box retrieve step).
  async function pick(s: Suggestion) {
    if (!TOKEN) return;
    setOpen(false);
    setActive(-1);
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
        const place: Place = { label, lng: c[0], lat: c[1] };
        setPicked(place);
        setQuery(label);
        onChange?.({ text: label, place });
      }
      session.current = newSession(); // fresh session for the next search
    } catch {
      // leave unpicked; the form guards on coords
    } finally {
      setBusy(false);
      setSuggestions([]);
    }
  }

  function onInput(v: string) {
    setQuery(v);
    setActive(-1);
    // Editing the text after a pick invalidates the chosen coords.
    const next = picked && v === picked.label ? picked : null;
    if (next !== picked) setPicked(next);
    onChange?.({ text: v, place: next });
  }

  // Keyboard combobox: ↑/↓ move the highlight, Enter picks it, Esc closes.
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
      } else {
        setActive((i) => (i + 1) % suggestions.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(suggestions.length - 1);
      } else {
        setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      }
    } else if (e.key === "Enter") {
      // Only swallow Enter when it's selecting a highlighted suggestion, so a
      // plain Enter elsewhere still hits the form's own guard.
      if (open && active >= 0 && suggestions[active]) {
        e.preventDefault();
        pick(suggestions[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  }

  const listOpen = open && suggestions.length > 0;

  return (
    <div className="ac" ref={boxRef}>
      <input
        type="text"
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(e) => onInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={listOpen && active >= 0 ? optionId(active) : undefined}
      />
      {labelName && <input type="hidden" name={labelName} value={picked?.label ?? ""} />}
      {latName && <input type="hidden" name={latName} value={picked?.lat ?? ""} />}
      {lngName && <input type="hidden" name={lngName} value={picked?.lng ?? ""} />}

      {listOpen && (
        <ul className="ac-list" id={listId} role="listbox" ref={listRef}>
          {suggestions.map((s, i) => (
            <li key={s.mapbox_id} role="presentation">
              <button
                type="button"
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                className={`ac-item${i === active ? " is-active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(s)}
              >
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
        <p className="small muted" style={{ margin: "4px 0 0" }} role="status" aria-live="polite">
          Locating…
        </p>
      )}
      {!compact && query.trim().length >= 3 && !picked && !busy && (
        <p className="small muted" style={{ margin: "4px 0 0" }} role="status" aria-live="polite">
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
