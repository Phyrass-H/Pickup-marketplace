// Mapbox Directions — road distance + travel time for a trip. Called once at
// mission creation (server-side) and cached on mission.distance_km/duration_min
// so cards can show an accurate ETA without per-render API calls. Best-effort:
// returns null on any failure so posting a mission never blocks on routing.

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export interface RouteMetrics {
  distanceKm: number;
  durationMin: number;
}

type LngLat = { lat: number; lng: number };

// `via` are intermediate stops (in order). All points must be valid coords.
export async function routeMetrics(
  from: LngLat,
  to: LngLat,
  via: LngLat[] = [],
): Promise<RouteMetrics | null> {
  if (!TOKEN) return null;
  try {
    const points = [from, ...via, to].map((p) => `${p.lng},${p.lat}`).join(";");
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${points}` +
      `?overview=false&access_token=${TOKEN}`;
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
