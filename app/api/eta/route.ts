// Live ETA for the new-mission form: distance + travel time for the route the
// Dispatcher is currently composing (pickup → stops → dropoff), so they see
// "27 km · 40 min" while picking addresses — like any ride app. Thin proxy over
// lib/directions (traffic-aware via depart_at) so the same routing logic backs
// both the live preview and the value cached at posting. Auth-gated: it spends
// our Mapbox quota, so only a signed-in user may call it.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { routeMetrics } from "@/lib/directions";
import { isValidLatLng } from "@/lib/geo";

interface Pt {
  lat: number;
  lng: number;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { points?: unknown; departAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const raw = Array.isArray(body.points) ? body.points : [];
  // Mirror the routing ceiling so a signed-in caller can't push an oversized
  // array through to Mapbox (the UI caps a trip at 7 points anyway).
  if (raw.length > 25) {
    return NextResponse.json({ error: "too many points" }, { status: 400 });
  }
  const points: Pt[] = raw
    .map((p) => {
      const lat = Number((p as Pt)?.lat);
      const lng = Number((p as Pt)?.lng);
      return { lat, lng };
    })
    .filter((p) => isValidLatLng(p.lat, p.lng));

  // Need at least an origin + destination to route anything.
  if (points.length < 2) {
    return NextResponse.json({ metrics: null });
  }

  const from = points[0]!;
  const to = points[points.length - 1]!;
  const via = points.slice(1, -1);
  const departAt = typeof body.departAt === "string" ? body.departAt : null;

  const metrics = await routeMetrics(from, to, departAt, via);
  return NextResponse.json({ metrics });
}
