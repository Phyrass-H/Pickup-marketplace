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
  shortPlaceLabel,
} from "@/lib/format";
import type { MissionStatus, MissionRow, MissionAmendmentRow } from "@/lib/database.types";
import { isExecutable } from "@/lib/mission-flow";
import { parseWaypoints } from "@/lib/waypoints";
import { routeDiff, parseFromSnapshot } from "@/lib/amendments";
import { parseLanguages, dressCodeLabel, activeFlagLabels } from "@/lib/driver-service";
import { StatusSteps } from "@/components/status-steps";
import { BoardFileLink } from "@/components/board-file-link";
import { AmendmentCard, type AmendmentLeg } from "@/components/amendment-card";
import { StatusControl } from "./status-control";

// Minutes of gap below which the trip's new end crowds the Driver's next pickup —
// surfaces the amber "it's tighter" heads-up on the change card.
const SLOT_TIGHT_MIN = 30;
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

// Precompute the "accept this change" card's props for a pending amendment: the
// route diff (was → now), the fare/time deltas, and a slot heads-up if the trip's
// new end crowds the Driver's next pickup.
function buildAmendmentData(
  a: MissionAmendmentRow,
  m: MissionRow,
  missions: MissionRow[],
  businessName: string | null,
) {
  const from = parseFromSnapshot(a.from_snapshot);
  const diff = routeDiff(
    { pickup: from.pickup_address, dropoff: from.dropoff_address, waypoints: from.waypoints },
    {
      pickup: a.new_pickup_address,
      dropoff: a.new_dropoff_address,
      waypoints: parseWaypoints(a.new_waypoints),
    },
  );
  const stops = from.waypoints.length;
  const wasLabel = `${shortPlaceLabel(from.pickup_address)} → ${
    from.dropoff_address ? shortPlaceLabel(from.dropoff_address) : "—"
  }${stops ? ` · ${stops} stop${stops === 1 ? "" : "s"}` : ", direct"}`;

  const durNew = a.new_duration_min;
  const pickupMs = new Date(m.pickup_at).getTime();
  const newEnd = durNew != null ? pickupMs + durNew * 60_000 : null;
  // The Driver's next mission after this one (missions are sorted by pickup_at).
  const next = missions.find(
    (x) => x.id !== m.id && new Date(x.pickup_at).getTime() > pickupMs,
  );
  let slot: { nextPickupIso: string; overlap: boolean } | null = null;
  if (newEnd != null && next) {
    const gapMin = (new Date(next.pickup_at).getTime() - newEnd) / 60_000;
    if (gapMin < SLOT_TIGHT_MIN) slot = { nextPickupIso: next.pickup_at, overlap: gapMin < 0 };
  }

  return {
    amendmentId: a.id,
    proposedBy: businessName ?? "The Business",
    createdAtLabel: formatDateTime(a.created_at),
    legs: diff.legs as AmendmentLeg[],
    removedStops: diff.removedStops,
    wasLabel,
    note: a.note,
    fareOld: from.fare ?? currentFare(m),
    fareNew: Number(a.new_fare),
    distOld: from.distance_km,
    durOld: from.duration_min,
    distNew: a.new_distance_km != null ? Number(a.new_distance_km) : null,
    durNew,
    pickupAtIso: m.pickup_at,
    slot,
  };
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

  // Pending amendments (D39 Phase 2) — the "accept this change" card. RLS scopes
  // these to the Driver's own missions; one pending proposal per mission (the
  // Business supersedes on re-send).
  const amendmentData = new Map<string, ReturnType<typeof buildAmendmentData>>();
  if (missions && missions.length > 0) {
    const { data: amendments } = await supabase
      .from("mission_amendment")
      .select("*")
      .in(
        "mission_id",
        missions.map((m) => m.id),
      )
      .eq("status", "proposed");
    for (const a of amendments ?? []) {
      const m = missions.find((x) => x.id === a.mission_id);
      if (m) {
        amendmentData.set(
          a.mission_id,
          buildAmendmentData(a, m, missions, contacts.get(m.id)?.businessName ?? null),
        );
      }
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
        const stops = parseWaypoints(m.waypoints);
        const stopsReached = m.stops_reached ?? 0;
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

            {amendmentData.has(m.id) && <AmendmentCard {...amendmentData.get(m.id)!} />}

            <div className="route">
              <div className="leg">
                <span className="dot" />
                <span>{m.pickup_address}</span>
              </div>
              {stops.map((w, i) => {
                const reached = i < stopsReached;
                const current = m.status === "on_board" && i === stopsReached;
                return (
                  <div
                    className={`leg leg--stop${reached ? " leg--done" : ""}${current ? " leg--now" : ""}`}
                    key={i}
                  >
                    <span className="dot mid" />
                    <span className="leg-addr">{w.address}</span>
                    {reached && <span className="leg-tag leg-tag--done">reached</span>}
                    {current && <span className="leg-tag leg-tag--now">next stop</span>}
                  </div>
                );
              })}
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
              <StatusSteps
                status={m.status}
                stopsCount={stops.length}
                stopsReached={stopsReached}
              />
            )}
            {m.status === "accepted" && (
              <p className="muted small" style={{ marginTop: 12 }}>
                Awaiting readiness confirmation (Lock-in at T-180). Trip controls
                appear once confirmed.
              </p>
            )}
            {isExecutable(m.status) && (
              <StatusControl
                missionId={m.id}
                status={m.status}
                stops={stops}
                stopsReached={stopsReached}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
