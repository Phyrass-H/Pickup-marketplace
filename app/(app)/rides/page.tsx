import { Fragment } from "react";
import Link from "next/link";
import {
  Building2,
  Car,
  CircleCheck,
  Clock,
  MapPin,
  Navigation,
  Phone,
  UserRound,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDriverContext } from "@/lib/driver";
import { currentFare } from "@/lib/pdp";
import {
  formatDateTime,
  formatMoney,
  formatPoolWhen,
  missionStatusLabel,
  shortPlaceLabel,
} from "@/lib/format";
import type {
  MissionStatus,
  MissionRow,
  MissionAmendmentRow,
  MissionReleaseRow,
} from "@/lib/database.types";
import { isExecutable, progressDone, progressSegments } from "@/lib/mission-flow";
import { parseWaypoints } from "@/lib/waypoints";
import { routeDiff, parseFromSnapshot } from "@/lib/amendments";
import { parseLanguages, dressCodeLabel, activeFlagLabels } from "@/lib/driver-service";
import {
  guestDueAt,
  isAirportPickup,
  noShowAvailableAt,
  noShowWaitMinutes,
  waitingAt,
} from "@/lib/cancellation";
import { BoardFileLink } from "@/components/board-file-link";
import { AmendmentCard, type AmendmentLeg } from "@/components/amendment-card";
import { ReleaseCard } from "@/components/release-card";
import { StatusControl } from "./status-control";
import { DriverCancel, NoShowControl } from "./cancel-noshow";

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

// The card leads with STATE, not price. Tone follows the trip's phase: blue while
// it's held but not moving, green once it's under way, grey when done, amber for a
// no-show (which pays the Driver — a warning, never a failure).
function statusPill(m: MissionRow): { tone: string; Icon: LucideIcon } {
  if (m.no_show) return { tone: "warn", Icon: UserX };
  switch (m.status) {
    case "en_route":
      return { tone: "go", Icon: Navigation };
    case "arrived":
      return { tone: "go", Icon: MapPin };
    case "on_board":
      return { tone: "go", Icon: Car };
    case "completed":
      return { tone: "neutral", Icon: CircleCheck };
    case "confirmed":
      return { tone: "info", Icon: CircleCheck };
    default:
      return { tone: "info", Icon: Clock }; // accepted — awaiting Lock-in
  }
}

// Plain words for where the trip is, read next to the segment bar (which is
// colour-only otherwise). The maths lives in progressSegments/progressDone.
function progressCaption(
  status: MissionStatus,
  stopsCount: number,
  stopsReached: number,
): string {
  switch (status) {
    case "en_route":
      return "On the way";
    case "arrived":
      return "Waiting for the Guest";
    case "on_board":
      return stopsReached < stopsCount
        ? `On board · ${stopsReached}/${stopsCount} stops`
        : "On board";
    case "completed":
      return "Completed";
    default:
      return "Not started"; // confirmed
  }
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

// Props for the "agreed release" card (O7, D45) — a free mutual release the Driver
// accepts or declines. No route/fare change, so it just needs the trip + who asked.
function buildReleaseData(r: MissionReleaseRow, m: MissionRow, businessName: string | null) {
  return {
    releaseId: r.id,
    businessName: businessName ?? "The Business",
    createdAtLabel: formatDateTime(r.created_at),
    pickup: m.pickup_address,
    dropoff: m.dropoff_address,
    note: r.note,
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

  // Pending agreed releases (O7, D45) — the "Release requested" accept/decline card.
  // RLS (driver_id = current_driver_id()) scopes these to this Driver; one pending per
  // mission (the Business supersedes on re-send).
  const releaseData = new Map<string, ReturnType<typeof buildReleaseData>>();
  if (missions && missions.length > 0) {
    const { data: rels } = await supabase
      .from("mission_release")
      .select("*")
      .in(
        "mission_id",
        missions.map((m) => m.id),
      )
      .eq("status", "proposed");
    for (const r of rels ?? []) {
      const m = missions.find((x) => x.id === r.mission_id);
      // Only while the trip is still releasable (respond_to_release's own guard) — once
      // it starts executing / completes, a lingering proposal would be a dead card.
      if (m && (m.status === "accepted" || m.status === "confirmed")) {
        releaseData.set(r.mission_id, buildReleaseData(r, m, contacts.get(m.id)?.businessName ?? null));
      }
    }
  }

  // No-show: the latest 'arrived' status_event is the Driver's on-site attestation — the
  // precondition to report, and the basis of the 5-min on-site floor. It is NOT the clock
  // origin: the courtesy wait runs from when the GUEST was due (see noShowAvailableAt).
  // A Driver reads its own mission's events under RLS.
  const arrivedAt = new Map<string, string>();
  let arrivedErr: string | null = null;
  const arrivedIds = (missions ?? []).filter((m) => m.status === "arrived").map((m) => m.id);
  if (arrivedIds.length > 0) {
    const { data: evs, error: evErr } = await supabase
      .from("status_event")
      .select("mission_id, created_at")
      .eq("status", "arrived")
      .in("mission_id", arrivedIds)
      .order("created_at", { ascending: false });
    // Don't swallow this: a failed read silently hides the whole no-show control.
    if (evErr) arrivedErr = evErr.message;
    for (const e of evs ?? []) if (!arrivedAt.has(e.mission_id)) arrivedAt.set(e.mission_id, e.created_at);
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

      {arrivedErr && (
        <div className="notice error">
          Couldn’t load your arrival times: {arrivedErr}. The no-show report may be
          unavailable — reload, or call the Business.
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
        const hasChips = languages.length > 0 || !!dressLabel || flagLabels.length > 0;
        const hasPrep = !!m.board_name || !!m.board_file_path || !!m.driver_message;

        const when = formatPoolWhen(m.pickup_at);
        const { tone, Icon: PillIcon } = statusPill(m);
        const showProgress = isExecutable(m.status) || m.status === "completed";
        const segments = progressSegments(stops.length);
        const done = progressDone(m.status, stops.length, stopsReached);
        const caption = progressCaption(m.status, stops.length, stopsReached);
        const phones = guestPhones.get(m.id) ?? [];

        return (
          <Fragment key={m.id}>
            <article className="dcard">
              {/* State leads; the fare moved down to the footer. */}
              <div className="pcard__head">
                <span className={`dpill dpill--${tone}`}>
                  <PillIcon size={13} strokeWidth={1.75} aria-hidden="true" />
                  {m.no_show ? "No-show" : missionStatusLabel(m.status)}
                </span>
                <span className="pcard__when">
                  <span className={when.today ? "pcard__day pcard__day--today" : "pcard__day"}>
                    {when.day}
                  </span>
                  <span className="pcard__time">{when.time}</span>
                </span>
              </div>

              <div className="pcard__body">
                {/* Trip progress: one bar + plain words (the bar alone is colour-only). */}
                {showProgress && (
                  <div>
                    <div className="dprog__row">
                      <span>Trip progress</span>
                      <span className="dprog__now">{caption}</span>
                    </div>
                    <div className="dprog__bar" role="img" aria-label={`Trip progress: ${caption}`}>
                      {segments.map((seg, i) => (
                        <span
                          key={seg.key}
                          className={i < done ? "dprog__seg dprog__seg--on" : "dprog__seg"}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {amendmentData.has(m.id) && <AmendmentCard {...amendmentData.get(m.id)!} />}
                {releaseData.has(m.id) && <ReleaseCard {...releaseData.get(m.id)!} />}

                {/* Route rail, full addresses. Live progress rides the dots: a reached
                    stop turns green, the next one is ringed while the Guest is on board. */}
                <div className="proute">
                  <div className="proute__leg">
                    <span className="proute__rail">
                      <span className="proute__line" />
                      <span className="proute__dot proute__dot--from" />
                    </span>
                    <span className="proute__addr proute__addr--from proute__addr--pad">
                      {m.pickup_address}
                    </span>
                  </div>
                  {stops.map((w, i) => {
                    const reached = i < stopsReached;
                    const current = m.status === "on_board" && i === stopsReached;
                    const dot = reached ? "done" : current ? "now" : "stop";
                    return (
                      <div className="proute__leg" key={i}>
                        <span className="proute__rail">
                          <span className="proute__line" />
                          <span className={`proute__dot proute__dot--${dot}`} />
                        </span>
                        <span className="proute__addr proute__addr--stop proute__addr--pad">
                          {w.address}
                          {reached && <span className="dreached">Reached</span>}
                          {current && <span className="dnext">Next stop</span>}
                        </span>
                      </div>
                    );
                  })}
                  <div className="proute__leg proute__leg--last">
                    <span className="proute__rail">
                      <span className="proute__dot proute__dot--to" />
                    </span>
                    <span className="proute__addr proute__addr--to">{m.dropoff_address ?? "—"}</span>
                  </div>
                </div>

                {/* Unlocked contacts, as tap targets. Only SHARED Guest numbers reach
                    here (filtered server-side); a contact without a number is a fact row. */}
                {(phones.length > 0 || c?.dispatcherPhone) && (
                  <div className="dcall">
                    {phones.map((g) => (
                      <a className="dcall__btn" href={`tel:${g.phone}`} key={g.index}>
                        <Phone size={17} strokeWidth={1.75} aria-hidden="true" />
                        <span className="dcall__txt">
                          <span className="dcall__l">Guest</span>
                          <span className="dcall__v">{g.name || "Guest"}</span>
                        </span>
                      </a>
                    ))}
                    {c?.dispatcherPhone && (
                      <a className="dcall__btn" href={`tel:${c.dispatcherPhone}`}>
                        <Phone size={17} strokeWidth={1.75} aria-hidden="true" />
                        <span className="dcall__txt">
                          <span className="dcall__l">Dispatcher</span>
                          <span className="dcall__v">{c.dispatcherName ?? "Dispatcher"}</span>
                        </span>
                      </a>
                    )}
                  </div>
                )}

                <div>
                  {m.passenger_name && (
                    <div className="dfact">
                      <span className="dfact__l">
                        <UserRound size={16} strokeWidth={1.75} aria-hidden="true" />
                        Guest
                      </span>
                      <span className="dfact__v">{m.passenger_name}</span>
                    </div>
                  )}
                  {/* The Business itself lives in the card foot — no need to say it twice. */}
                  {!c?.dispatcherPhone && (
                    <div className="dfact">
                      <span className="dfact__l">
                        <UserRound size={16} strokeWidth={1.75} aria-hidden="true" />
                        Dispatcher
                      </span>
                      <span className="dfact__v">{c?.dispatcherName ?? "—"}</span>
                    </div>
                  )}
                </div>

                {/* What to have ready: the board + the Business's private message (S19). */}
                {hasPrep && (
                  <div className="dnote">
                    {(m.board_name || m.board_file_path) && (
                      <div className="dnote__row">
                        <span className="dnote__l">Name board</span>
                        {m.board_name || "—"}
                        {m.board_file_path && (
                          <>
                            {" · "}
                            <BoardFileLink missionId={m.id} />
                          </>
                        )}
                      </div>
                    )}
                    {m.driver_message && (
                      <div className="dnote__row">
                        <span className="dnote__l">Message</span>
                        {m.driver_message}
                      </div>
                    )}
                  </div>
                )}

                {/* Soft requirements — languages, dress code, request flags. */}
                {hasChips && (
                  <div className="dchips">
                    {languages.map((l) => (
                      <span className="dchip" key={l}>
                        {l}
                      </span>
                    ))}
                    {dressLabel && <span className="dchip">{dressLabel}</span>}
                    {flagLabels.map((f) => (
                      <span className="dchip" key={f}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                {m.status === "accepted" && (
                  <p className="muted small" style={{ marginTop: 14, marginBottom: 0 }}>
                    Awaiting readiness confirmation (Lock-in at T-180). Trip controls
                    appear once confirmed.
                  </p>
                )}
              </div>

              <div className="pcard__foot">
                <span className="pcard__facts">
                  <Building2 size={13} aria-hidden="true" />
                  {c?.businessName ?? "—"}
                  <span className="pcard__veh">{formatMoney(currentFare(m))}</span>
                </span>
              </div>
            </article>

            {/* Actions live below the card: exactly one filled button, the rest quiet. */}
            <div className="dstack">
              {isExecutable(m.status) && (
                <StatusControl
                  missionId={m.id}
                  status={m.status}
                  stops={stops}
                  stopsReached={stopsReached}
                />
              )}

              {/* No-show (O7): once on-site, the amber report flow after the wait window.
                  The window runs from when the GUEST was due — the ordered pickup time, or a
                  tracked landing instant — never from the Driver's arrival. */}
              {m.status === "arrived" && arrivedAt.get(m.id) && (
                <NoShowControl
                  missionId={m.id}
                  fare={currentFare(m)}
                  guestDueIso={guestDueAt(m).toISOString()}
                  availableAtIso={noShowAvailableAt(m, arrivedAt.get(m.id)!).toISOString()}
                  waitMinutes={noShowWaitMinutes(isAirportPickup(m))}
                  waitingFromIso={waitingAt(m).from.toISOString()}
                  waitingUntilIso={waitingAt(m).until.toISOString()}
                  guestPhone={
                    (guestPhones.get(m.id) ?? []).find((g) => g.main)?.phone ??
                    (guestPhones.get(m.id) ?? [])[0]?.phone ??
                    null
                  }
                />
              )}

              {/* Cancel (O7): available while the Driver holds the trip, before boarding. */}
              {(m.status === "accepted" ||
                m.status === "confirmed" ||
                m.status === "en_route" ||
                m.status === "arrived") && (
                <DriverCancel
                  missionId={m.id}
                  fare={currentFare(m)}
                  businessPhone={c?.dispatcherPhone ?? null}
                  businessName={c?.businessName ?? null}
                />
              )}
            </div>
          </Fragment>
        );
      })}
    </>
  );
}
