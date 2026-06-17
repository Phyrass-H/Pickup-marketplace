import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDriverContext } from "@/lib/driver";
import { currentFare } from "@/lib/pdp";
import {
  categoryLabel,
  formatDateTime,
  formatMoney,
  formatMonth,
  missionStatusLabel,
} from "@/lib/format";
import { parisDayKey } from "@/lib/dispatch-status";
import type { MissionRow, MissionStatus } from "@/lib/database.types";

export const dynamic = "force-dynamic";

// Terminal statuses — the archive of finished work.
const PAST_STATUSES: MissionStatus[] = ["completed", "cancelled"];

export default async function RideHistoryPage() {
  const { driver } = await getDriverContext();
  if (!driver) return null;

  const supabase = await createClient();
  const { data: missions, error } = await supabase
    .from("mission")
    .select("*")
    .eq("driver_id", driver.id)
    .in("status", PAST_STATUSES)
    .order("pickup_at", { ascending: false });

  // Reveal the Business name per mission (service role, gated to these missions).
  const bizNames = new Map<string, string>();
  if (missions && missions.length > 0) {
    const admin = createAdminClient();
    const ids = [...new Set(missions.map((m) => m.business_id))];
    const { data: businesses } = await admin
      .from("business")
      .select("id, name")
      .in("id", ids);
    for (const b of businesses ?? []) bizNames.set(b.id, b.name);
  }

  // Group by Paris month, preserving the newest-first order.
  const groups = new Map<string, MissionRow[]>();
  for (const m of missions ?? []) {
    const key = parisDayKey(m.pickup_at).slice(0, 7);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(m);
  }

  const isEmpty = !error && (!missions || missions.length === 0);

  return (
    <>
      <div className="card-row" style={{ alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Ride history</h1>
        <Link href="/rides" className="small muted" style={{ textDecoration: "underline" }}>
          ← My Rides
        </Link>
      </div>

      {error && (
        <div className="notice error" style={{ marginTop: 12 }}>
          Couldn’t load your history: {error.message}
        </div>
      )}

      {isEmpty && (
        <div className="empty">No completed or cancelled rides yet.</div>
      )}

      {[...groups.entries()].map(([monthKey, list]) => (
        <section key={monthKey} style={{ marginTop: 16 }}>
          <div className="day-head">
            <h2 style={{ textTransform: "capitalize" }}>{formatMonth(monthKey)}</h2>
            <span className="count">
              {list.length} ride{list.length === 1 ? "" : "s"}
            </span>
          </div>

          {list.map((m) => (
            <div className="card" key={m.id}>
              <div className="card-row">
                <span className="fare">{formatMoney(currentFare(m))}</span>
                <span className={m.status === "completed" ? "badge status" : "badge"}>
                  {missionStatusLabel(m.status)}
                </span>
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {formatDateTime(m.pickup_at)} · {categoryLabel(m.category)}
                {bizNames.get(m.business_id) ? ` · ${bizNames.get(m.business_id)}` : ""}
              </div>
              <div className="route">
                <div className="leg">
                  <span className="dot" />
                  <span>{m.pickup_address}</span>
                </div>
                <div className="leg">
                  <span className="dot end" />
                  <span>{m.dropoff_address ?? "—"}</span>
                </div>
              </div>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
