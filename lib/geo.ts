// Geo helpers. Great-circle distance for the Pool's radius matching — a Driver
// sees a mission when its pickup OR dropoff is within service_radius_km of their
// base (Doc spine: the Pool is a query; matching is by location, not a town list).

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Valid WGS84 coordinate? Guards against garbage before we persist/match. */
export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Great-circle distance between two lat/lng points, in kilometres. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // mean Earth radius (km)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Is (lat,lng) within `radiusKm` of (baseLat,baseLng)? Null coords → false. */
export function withinRadius(
  baseLat: number,
  baseLng: number,
  radiusKm: number,
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  if (lat == null || lng == null) return false;
  return haversineKm(baseLat, baseLng, lat, lng) <= radiusKm;
}
