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
import { parseLanguages, dressCodeLabel, activeFlagLabels } from "@/lib/driver-service";
import { StatusSteps } from "@/components/status-steps";
import { BoardFileLink } from "@/components/board-file-link";
import { StatusControl } from "./status-control";
import {
  parsePassengers,
  parseGuestContacts,
  zipGuestContacts,
  type GuestPhone,
} from "@/lib/passengers";

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
  // Guest phones the Business has SHARED, revealed to this assigned Driver only.
  const guestPhones = new Map<string, GuestPhone[]>();
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

    // Reveal SHARED Guest phones via the service role (Drivers can't read the
    // mission_guest_contact table via RLS). Gated to phones the Business toggled
    // shared, on missions already assigned to THIS Driver (the query above).
    const { data: gc } = await admin
      .from("mission_guest_contact")
      .select("mission_id, contacts")
      .in("mission_id", missions.map((m) => m.id));
    const gcByMission = new Map((gc ?? []).map((r) => [r.mission_id, r.contacts]));
    for (const m of missions) {
      const revealed = zipGuestContacts(
        parsePassengers(m.passenger_names),
        parseGuestContacts(gcByMission.get(m.id)),
      ).filter((g) => g.shared);
      if (revealed.length > 0) guestPhones.set(m.id, revealed);
    }
  }

  return (
    <>
      <div className="card-row" style={{ alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>My Rides</h1>
        <Link href="/rides/history" className="small muted" style={{ textDecoration: "underline" }}>
          History →
        </Link>
      </div>

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
        const languages = parseLanguages(m.required_languages);
        const dressLabel = dressCodeLabel(m.dress_code);
        const flagLabels = activeFlagLabels(m.driver_flags);
        const hasService =
          languages.length > 0 ||
          !!dressLabel ||
          flagLabels.length > 0 ||
          !!m.board_name ||
          !!m.board_file_path ||
          !!m.driver_message;
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
              {(guestPhones.get(m.id) ?? []).map((g) => (
                <div className="contact-row" key={g.index}>
                  <span className="muted small">
                    {g.name ? `${g.name}${g.main ? " (main)" : ""}` : "Guest phone"}
                  </span>
                  <a
                    href={`tel:${g.phone}`}
                    style={{ color: "var(--accent)", fontWeight: 600 }}
                  >
                    {g.phone}
                  </a>
                </div>
              ))}
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

            {/* Driver & service requirements + revealed board / message (S19) */}
            {hasService && (
              <dl className="kv" style={{ marginTop: 12 }}>
                {languages.length > 0 && (
                  <>
                    <dt>Languages</dt>
                    <dd>{languages.join(", ")}</dd>
                  </>
                )}
                {dressLabel && (
                  <>
                    <dt>Dress code</dt>
                    <dd>{dressLabel}</dd>
                  </>
                )}
                {flagLabels.length > 0 && (
                  <>
                    <dt>Requests</dt>
                    <dd>{flagLabels.join(" · ")}</dd>
                  </>
                )}
                {(m.board_name || m.board_file_path) && (
                  <>
                    <dt>Name board</dt>
                    <dd>
                      {m.board_name || "—"}
                      {m.board_file_path && (
                        <>
                          {" · "}
                          <BoardFileLink missionId={m.id} />
                        </>
                      )}
                    </dd>
                  </>
                )}
                {m.driver_message && (
                  <>
                    <dt>Message</dt>
                    <dd>{m.driver_message}</dd>
                  </>
                )}
              </dl>
            )}

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
