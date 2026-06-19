// Mapbox Directions — road distance + travel time for a trip, TRAFFIC-AWARE.
// Uses the `driving-traffic` profile with `depart_at` set to the scheduled
// pickup time, so the ETA reflects predicted traffic for that day & hour
// (Mon 8am ≠ Sun 2pm) from Mapbox's own historical + live traffic — no Google
// needed. Computed once at mission creation and cached on mission.distance_km /
// duration_min. Best-effort: returns null on any failure so posting a mission
// never blocks on routing (the UI falls back to straight-line distance).

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export interface RouteMetrics {
  distanceKm: number;
  durationMin: number;
}

type LngLat = { lat: number; lng: number };

// `departAt`: ISO-8601 instant of the scheduled pickup (must be now-or-future).
// When omitted/past, driving-traffic uses current conditions instead.
export async function routeMetrics(
  from: LngLat,
  to: LngLat,
  departAt?: string | null,
): Promise<RouteMetrics | null> {
  if (!TOKEN) return null;
  try {
    const points = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const params = new URLSearchParams({ overview: "false", access_token: TOKEN });
    if (departAt) params.set("depart_at", departAt);
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${points}?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: { distance?: number; duration?: number }[];
    };
    const route = data.routes?.[0];
    if (!route || typeof route.distance !== "number" || typeof route.duration !== "number") {
      return null;
    }
    return {
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.max(1, Math.round(route.duration / 60)),
    };
  } catch {
    return null;
  }
}
