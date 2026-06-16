import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/app-context";
import { currentFare } from "@/lib/pdp";
import {
  categoryLabel,
  formatDateTime,
  formatMoney,
  missionStatusLabel,
} from "@/lib/format";

export const dynamic = "force-dynamic";

interface DriverContact {
  name: string;
  phone: string | null;
}

export default async function DispatchHome() {
  const ctx = await getAppContext();
  if (!ctx.business) return null;

  const supabase = await createClient();
  const { data: missions, error } = await supabase
    .from("mission")
    .select("*")
    .eq("business_id", ctx.business.id)
    .order("created_at", { ascending: false });

  // Reveal the assigned Driver's contact once a mission is accepted. A
  // Dispatcher can't read driver rows via RLS, so use the service role — gated
  // to missions belonging to THIS business (fetched under RLS just above).
  const driverContacts = new Map<string, DriverContact>();
  const assigned = (missions ?? []).filter((m) => m.driver_id);
  if (assigned.length > 0) {
    const admin = createAdminClient();
    const driverIds = [...new Set(assigned.map((m) => m.driver_id!))];
    const { data: drivers } = await admin
      .from("driver")
      .select("id, first_name, last_name, phone")
      .in("id", driverIds);
    const byId = new Map((drivers ?? []).map((d) => [d.id, d]));
    for (const m of assigned) {
      const d = byId.get(m.driver_id!);
      if (d)
        driverContacts.set(m.id, {
          name: `${d.first_name} ${d.last_name}`,
          phone: d.phone,
        });
    }
  }

  return (
    <>
      <div className="card-row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Missions</h1>
        <Link href="/dispatch/new" className="badge status" style={{ padding: "8px 14px" }}>
          + New mission
        </Link>
      </div>

      {error && (
        <div className="notice error">
          Couldn’t load your missions: {error.message}
        </div>
      )}

      {!error && (!missions || missions.length === 0) && (
        <div className="empty">
          No missions yet.
          <br />
          <Link href="/dispatch/new" style={{ textDecoration: "underline" }}>
            Post your first mission →
          </Link>
        </div>
      )}

      {missions?.map((m) => {
        const contact = driverContacts.get(m.id);
        return (
          <div className="card" key={m.id}>
            <div className="card-row">
              <span className="fare">{formatMoney(currentFare(m))}</span>
              <span style={{ display: "flex", gap: 6 }}>
                {m.speed_win && <span className="badge speed">SPEED WIN</span>}
                <span className="badge status">{missionStatusLabel(m.status)}</span>
              </span>
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              {formatDateTime(m.pickup_at)} · {categoryLabel(m.category)}
              {m.zone ? ` · ${m.zone}` : ""}
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

            {contact ? (
              <div style={{ marginTop: 12 }}>
                <div className="contact-row">
                  <span className="muted small">Driver</span>
                  <span>{contact.name}</span>
                </div>
                <div className="contact-row">
                  <span className="muted small">Phone</span>
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      style={{ color: "var(--accent)", fontWeight: 600 }}
                    >
                      {contact.phone}
                    </a>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
            ) : (
              m.status === "pooled" && (
                <p className="muted small" style={{ marginTop: 10 }}>
                  In the Pool — waiting for a Driver to accept.
                </p>
              )
            )}
          </div>
        );
      })}
    </>
  );
}
