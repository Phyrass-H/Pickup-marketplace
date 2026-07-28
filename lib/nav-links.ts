import type { PreferredGps } from "@/lib/database.types";

// Deep links for the Navigate button. Deliberately https universal links rather
// than custom schemes (`waze://`, `comgooglemaps://`): a scheme that isn't installed
// fails silently and the Driver is left tapping a dead button, whereas these open
// the app when it's there and the website when it isn't. A web app cannot detect
// which apps a phone has — that check only becomes possible in a native build, so
// the setting stays a preference with a fallback that always works.
export function navigateUrl(
  app: PreferredGps | null,
  dest: { lat: number | null; lng: number | null; address: string },
): string {
  const hasCoords = dest.lat != null && dest.lng != null;
  const ll = hasCoords ? `${dest.lat},${dest.lng}` : "";
  const q = encodeURIComponent(dest.address);

  switch (app) {
    case "waze":
      return hasCoords
        ? `https://waze.com/ul?ll=${ll}&navigate=yes`
        : `https://waze.com/ul?q=${q}&navigate=yes`;
    case "apple":
      return `https://maps.apple.com/?daddr=${hasCoords ? ll : q}&dirflg=d`;
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${hasCoords ? ll : q}`;
  }
}

// Where a Driver actually needs to go right now: the pickup until the Guest is
// aboard, then the next stop they haven't reached, then the drop-off.
export function nextDestination(m: {
  status: string;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  stops_reached: number | null;
}, stops: { address: string; lat?: number | null; lng?: number | null }[]):
  | { lat: number | null; lng: number | null; address: string; label: string }
  | null {
  if (m.status === "on_board") {
    const reached = m.stops_reached ?? 0;
    const next = stops[reached];
    if (next) {
      return { lat: next.lat ?? null, lng: next.lng ?? null, address: next.address, label: "stop" };
    }
    if (m.dropoff_address) {
      return {
        lat: m.dropoff_lat,
        lng: m.dropoff_lng,
        address: m.dropoff_address,
        label: "drop-off",
      };
    }
    return null;
  }
  return {
    lat: m.pickup_lat,
    lng: m.pickup_lng,
    address: m.pickup_address,
    label: "pickup",
  };
}
