import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDriverContext } from "@/lib/driver";
import { currentFare } from "@/lib/pdp";
import {
  categoryLabel,
  formatDateTime,
  formatMoney,
  missionStatusLabel,
} from "@/lib/format";
import type { MissionStatus } from "@/lib/database.types";
import { isExecutable } from "@/lib/mission-flow";
import { StatusSteps } from "@/components/status-steps";
import { StatusControl } from "./status-control";

export const dynamic = "force-dynamic";

// Statuses that mean "this mission is mine" (accepted onward, excluding
// re-pooled/cancelled/expired which leave the Driver).
const MINE_STATUSES: MissionStatus[] = [
  "accepted",
  "confirmed",
  "en_route",
  "arrived",
  "on_board",
  "completed",
];

interface Contact {
  dispatcherName: string | null;
  dispatcherPhone: string | null;
  businessName: string | null;
}

export default async function RidesPage() {
  const { driver } = await getDriverContext();
  if (!driver) return null;

  const supabase = await createClient();
  const { data: missions, error } = await supabase
    .from("mission")
    .select("*")
    .eq("driver_id", driver.id)
    .in("status", MINE_STATUSES)
    .order("pickup_at", { ascending: true });

  // CONTACT UNLOCK: a Driver cannot read Dispatcher/Business rows via RLS, so
  // we reveal the contact server-side with the service-role client — but ONLY
  // for missions that are already assigned to THIS driver (fetched above under
  // RLS). This is the "reveal phone on acceptance" gate, enforced in code.
  const contacts = new Map<string, Contact>();
  if (missions && missions.length > 0) {
    const admin = createAdminClient();
    const dispatcherIds = [...new Set(missions.map((m) => m.dispatcher_id))];
    const businessIds = [...new Set(missions.map((m) => m.business_id))];

    const [{ data: dispatchers }, { data: businesses }] = await Promise.all([
      admin
        .from("dispatcher")
        .select("id, name, phone")
        .in("id", dispatcherIds),
      admin.from("business").select("id, name").in("id", businessIds),
    ]);

    const dispById = new Map((dispatchers ?? []).map((d) => [d.id, d]));
    const bizById = new Map((businesses ?? []).map((b) => [b.id, b]));

    for (const m of missions) {
      const d = dispById.get(m.dispatcher_id);
      const b = bizById.get(m.business_id);
      contacts.set(m.id, {
        dispatcherName: d?.name ?? null,
        dispatcherPhone: d?.phone ?? null,
        businessName: b?.name ?? null,
      });
    }
  }

  return (
    <>
      <h1>My Rides</h1>

      {error && (
        <div className="notice error">
          Couldn’t load your rides: {error.message}
        </div>
      )}

      {!error && (!missions || missions.length === 0) && (
        <div className="empty">
          You haven’t accepted any missions yet.
          <br />
          <Link href="/pool" className="muted" style={{ textDecoration: "underline" }}>
            Browse the Pool →
          </Link>
        </div>
      )}

      {missions?.map((m) => {
        const c = contacts.get(m.id);
        return (
          <div className="card" key={m.id}>
            <div className="card-row">
              <span className="fare">{formatMoney(currentFare(m))}</span>
              <span className="badge status">{missionStatusLabel(m.status)}</span>
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              {formatDateTime(m.pickup_at)} · {categoryLabel(m.category)}
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

            {/* Unlocked contacts */}
            <div style={{ marginTop: 12 }}>
              {m.passenger_name && (
                <div className="contact-row">
                  <span className="muted small">Guest</span>
                  <span>{m.passenger_name}</span>
                </div>
              )}
              <div className="contact-row">
                <span className="muted small">Business</span>
                <span>{c?.businessName ?? "—"}</span>
              </div>
              <div className="contact-row">
                <span className="muted small">Dispatcher</span>
                <span>{c?.dispatcherName ?? "—"}</span>
              </div>
              <div className="contact-row">
                <span className="muted small">Phone</span>
                {c?.dispatcherPhone ? (
                  <a href={`tel:${c.dispatcherPhone}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
                    {c.dispatcherPhone}
                  </a>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>

            {/* Trip execution: progress + the next status button */}
            {(isExecutable(m.status) || m.status === "completed") && (
              <StatusSteps status={m.status} />
            )}
            {m.status === "accepted" && (
              <p className="muted small" style={{ marginTop: 12 }}>
                Awaiting readiness confirmation (Lock-in at T-180). Trip controls
                appear once confirmed.
              </p>
            )}
            {isExecutable(m.status) && (
              <StatusControl missionId={m.id} status={m.status} />
            )}
          </div>
        );
      })}
    </>
  );
}
