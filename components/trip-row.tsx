import Link from "next/link";
import { Pencil, GitPullRequestArrow, Lock, Phone, Car, Clock, Star } from "lucide-react";
import type { MissionRow, AmendmentStatus, ReleaseStatus } from "@/lib/database.types";
import { closeAmendment } from "@/app/(dispatch)/dispatch/[id]/amend/actions";
import { closeRelease } from "@/app/(dispatch)/dispatch/actions";
import { currentFare } from "@/lib/pdp";
import { tripDistanceKm } from "@/lib/geo";
import { parseWaypoints } from "@/lib/waypoints";
import {
  addressLine,
  formatDateTime,
  formatMoney,
  formatTime,
  formatTripMeta,
  serviceClassLabel,
} from "@/lib/format";
import { missionTone, TONE_BG, TONE_COLOR } from "@/lib/dispatch-status";
import { isExecutable } from "@/lib/mission-flow";
import { parseLanguages, dressCodeLabel, activeFlagLabels } from "@/lib/driver-service";
import { StatusSteps } from "@/components/status-steps";
import { BoardFileLink } from "@/components/board-file-link";
import { PhoneShareToggle } from "@/components/phone-share-toggle";
import { BusinessCancel, ReclaimCard } from "@/components/dispatch-cancel";
import { AgreedRelease } from "@/components/dispatch-release";
import {
  parsePassengers,
  passengerName,
  type GuestContact,
} from "@/lib/passengers";

// A Driver's car, shown to the Dispatch so it can tell the Guest what to look
// for at pickup (brand, colour, plate). Captured at Driver onboarding/settings.
export interface VehicleBrief {
  make: string | null;
  model: string | null;
  colour: string | null;
  plate: string | null;
}

export interface DriverContact {
  name: string;
  phone: string | null;
  vehicle?: VehicleBrief | null;
}

// A proposed / resolved change to this trip (D39 Phase 2), for the schedule state.
// Precomputed server-side so the row stays presentational.
export interface AmendmentBrief {
  id: string;
  status: AmendmentStatus;
  summary: string; // "Add a stop at X · New destination Y"
  fareOld: number | null;
  fareNew: number;
  declineReason: string | null; // human label, or null
  at: string; // responded_at ?? created_at
}

// A proposed / resolved AGREED RELEASE for this trip (O7, D45), for the schedule
// state. Precomputed server-side; the release itself carries no route/fare change.
export interface ReleaseBrief {
  id: string;
  status: ReleaseStatus;
  at: string; // responded_at ?? created_at
}

// The latest detail-edit change-log for this trip (D40 follow-up) — the "what
// changed" trail shown under the edit actions. Business-private (side table).
export interface InfoChangeBrief {
  at: string;
  items: string[]; // human phrases: "Flight BA342 → BA118", "Added guest X"
}

// One dense schedule line. Click to expand full detail. The coloured left edge +
// status pill are the at-a-glance signal a hotel scans (red = needs a call). When
// a Driver hasn't confirmed near pickup (danger tone) the whole row gets a gentle
// red wash — the T-180 alert.
export function TripRow({
  mission,
  driver,
  guestContacts,
  amendment,
  release,
  infoChange,
  archived = false,
}: {
  mission: MissionRow;
  driver?: DriverContact | null;
  guestContacts?: GuestContact[] | null;
  amendment?: AmendmentBrief | null;
  release?: ReleaseBrief | null;
  infoChange?: InfoChangeBrief | null;
  archived?: boolean;
}) {
  const t = missionTone(mission, undefined, { archived });
  const reference = mission.reference?.trim() || null;
  // Every named Guest, aligned by index with its phone/share state from the side
  // table (Drivers can't read those numbers). Phone-less guests still list; the
  // Share switch flips reveal to the assigned Driver. Archived/past = read-only.
  const gcs = guestContacts ?? [];
  const guestRows = parsePassengers(mission.passenger_names)
    .map((p, i) => ({
      index: i,
      name: passengerName(p),
      main: Boolean(p.main),
      phone: (gcs[i]?.phone ?? "").trim(),
      shared: Boolean(gcs[i]?.shared),
    }))
    .filter((g) => g.name || g.phone);
  // Sharing is read-only once a trip is finished (and on archived/history rows).
  const shareLocked =
    archived ||
    mission.status === "completed" ||
    mission.status === "cancelled" ||
    mission.status === "expired";
  // Info edits allowed only while the trip is pre-departure (matches the edit
  // page + action guard). Hidden on history rows.
  const editable =
    !archived &&
    (mission.status === "pooled" ||
      mission.status === "accepted" ||
      mission.status === "confirmed");
  // A change can be PROPOSED (route/fare, needs Driver consent) only once a Driver
  // holds the trip but hasn't started it (D39 Phase 2).
  const canAmend =
    !archived && (mission.status === "accepted" || mission.status === "confirmed");
  // An AGREED RELEASE (free, needs Driver consent) can be offered while a committed
  // Driver holds the trip pre-execution (O7, D45). Hidden while one is already pending
  // (the schedule shows that state instead).
  const canRelease =
    !archived &&
    !!mission.driver_id &&
    (mission.status === "accepted" || mission.status === "confirmed");
  const releasePending = !!release && release.status === "proposed";
  // Business can cancel any live trip (O7). FREE while pooled; a fee applies once a
  // Driver holds it (the modal shows the live %). Not once on_board / completed.
  const cancellable =
    !archived &&
    (mission.status === "pooled" ||
      mission.status === "accepted" ||
      mission.status === "confirmed" ||
      mission.status === "en_route" ||
      mission.status === "arrived");
  // T-60 reclaim: the Driver accepted but never confirmed the Lock-in (still 'accepted')
  // and pickup is within the hour. The RPC re-checks; this only decides whether to offer it.
  const reclaimEligible =
    !archived &&
    mission.status === "accepted" &&
    !!driver &&
    new Date(mission.pickup_at).getTime() <= Date.now() + 60 * 60_000;
  // "Edited · time" stamp — when the info was last edited (null = never).
  const editedAt = mission.info_edited_at;
  const languages = parseLanguages(mission.required_languages);
  const dressLabel = dressCodeLabel(mission.dress_code);
  const flagLabels = activeFlagLabels(mission.driver_flags);
  const waypoints = parseWaypoints(mission.waypoints);
  const stopsReached = mission.stops_reached ?? 0;
  // Compact progress on the pill while passing stops, e.g. "On board · 1/2".
  const stopProgress =
    mission.status === "on_board" && waypoints.length > 0
      ? `${stopsReached}/${waypoints.length}`
      : "";
  const alert = t.tone === "danger";
  const flightEta = mission.flight_eta ? formatTime(mission.flight_eta) : null;
  const distanceKm = tripDistanceKm(
    mission.pickup_lat,
    mission.pickup_lng,
    mission.dropoff_lat,
    mission.dropoff_lng,
  );
  const tripMeta = formatTripMeta(mission.distance_km, mission.duration_min, distanceKm);
  const car = driver?.vehicle ?? null;
  const carDesc = car
    ? [[car.make, car.model].filter(Boolean).join(" "), car.colour]
        .filter(Boolean)
        .join(" · ")
    : "";
  const driverInitials = driver
    ? driver.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("")
    : "";
  const serviceLabel = serviceClassLabel(mission.category, mission.required_body_type);
  const specificCar =
    mission.required_make && mission.required_model
      ? `${mission.required_make} ${mission.required_model}`
      : null;
  const hasService =
    languages.length > 0 ||
    !!dressLabel ||
    flagLabels.length > 0 ||
    !!mission.board_name ||
    !!mission.board_file_path ||
    !!mission.driver_message;
  const paxN = mission.pax_count ?? (guestRows.length || null);
  const bagsN = mission.luggage_count ?? 0;
  const guestsHeader = mission.luggage_only
    ? `Luggage · ${bagsN} ${bagsN === 1 ? "bag" : "bags"}`
    : `Guests · ${paxN ?? "—"} ${paxN === 1 ? "passenger" : "passengers"} · ${bagsN} ${bagsN === 1 ? "bag" : "bags"}`;
  const acceptedFareChanged =
    !!amendment && amendment.fareOld != null && amendment.fareOld !== amendment.fareNew;
  const acceptedRouteChanged = !!amendment && !!amendment.summary && amendment.summary !== "Fare change";

  return (
    <details
      // Anchor for the calendar's "Open in Schedule" deep link (?open=<missionId>).
      id={`trip-${mission.id}`}
      className={`dx-trip${alert ? " dx-trip--alert" : ""}`}
      style={{ "--edge": TONE_COLOR[t.tone] } as React.CSSProperties}
    >
      <summary>
        <span className="dx-trip__time mono">{formatTime(mission.pickup_at)}</span>

        {/* Stacked route rail: pickup → stop(s) → drop-off, one address per line so
            long addresses fit without truncation. Each line is the full address
            minus the redundant trailing country; the exact address shows on hover.
            Dots: dark = pickup, grey = a via-stop, hollow = drop-off. */}
        <span className="dx-trip__route">
          <span className="dx-route__node">
            <span className="dx-route__dot dx-route__dot--pk" aria-hidden />
            <span className="dx-route__addr dx-route__addr--pk" title={mission.pickup_address}>
              {addressLine(mission.pickup_address)}
            </span>
          </span>
          {waypoints.map((w, i) => {
            const reached = i < stopsReached;
            const current = mission.status === "on_board" && i === stopsReached;
            return (
              <span
                className={`dx-route__node${reached ? " dx-route__node--reached" : ""}${current ? " dx-route__node--current" : ""}`}
                key={i}
              >
                <span className="dx-route__dot dx-route__dot--via" aria-hidden />
                <span className="dx-route__addr dx-route__addr--via" title={w.address}>
                  {addressLine(w.address)}
                </span>
              </span>
            );
          })}
          <span className="dx-route__node">
            <span className="dx-route__dot dx-route__dot--dp" aria-hidden />
            <span
              className="dx-route__addr dx-route__addr--dp"
              title={mission.dropoff_address ?? undefined}
            >
              {mission.dropoff_address ? addressLine(mission.dropoff_address) : "—"}
            </span>
          </span>
        </span>

        <span className="dx-trip__flight">
          {mission.flight_number ? (
            <span className="dx-flight">
              {mission.flight_number}
              {flightEta ? ` · ${flightEta}` : ""}
            </span>
          ) : (
            <span className="dx-flight-empty">—</span>
          )}
        </span>

        <span className="dx-trip__guest">
          {mission.luggage_only ? (
            <span className="muted">Luggage</span>
          ) : (
            mission.passenger_name ?? "—"
          )}
        </span>

        <span className="dx-trip__ref">
          {reference ? (
            <span className="ref">{reference}</span>
          ) : (
            <span className="dx-flight-empty">—</span>
          )}
        </span>

        <span className="dx-trip__driver">
          {driver ? driver.name : <span className="muted">—</span>}
        </span>

        <span
          className="status-pill"
          style={{ background: TONE_BG[t.tone], color: TONE_COLOR[t.tone] }}
        >
          <span className="dot" style={{ background: TONE_COLOR[t.tone] }} />
          {t.needsAttention && <span className="attention">!</span>}
          {t.label}
          {stopProgress && <span className="status-pill__sub">{stopProgress}</span>}
        </span>
      </summary>

      <div className="dx-trip__detail">
        {reclaimEligible && driver && (
          <ReclaimCard missionId={mission.id} driverName={driver.name} driverPhone={driver.phone} />
        )}
        {/* Top meta line: the private Reference tag (Business-only) + the detail-only
            "Edited · time" stamp. The stamp stays even after the trip is frozen so the
            edit record remains visible. */}
        {(reference || editedAt) && (
          <div className="dx-dt-meta">
            {reference && (
              <span className="dx-dt-ref">
                <Lock size={12} aria-hidden /> {reference}
                <span className="dx-dt-ref__note"> · your team only</span>
              </span>
            )}
            {editedAt && !(infoChange && infoChange.items.length > 0) && (
              <span className="dx-dt-edited">Edited · {formatDateTime(editedAt)}</span>
            )}
          </div>
        )}

        {/* Edit actions — each spells out what it changes + whether the Driver must
            agree, so the two aren't confused. "Edit details" applies immediately;
            "Propose a change" (route/fare) needs the Driver's consent, so it only
            appears once a Driver holds the trip (accepted / confirmed). */}
        {(editable || canAmend) && (
          <div className="dx-acts">
            {editable && (
              <Link href={`/dispatch/${mission.id}/edit`} className="dx-act">
                <span className="dx-act__t">
                  <Pencil size={14} aria-hidden /> Edit details
                </span>
                <span className="dx-act__s">Update guest, flight &amp; service info · applies now</span>
              </Link>
            )}
            {canAmend && (
              <Link href={`/dispatch/${mission.id}/amend`} className="dx-act">
                <span className="dx-act__t">
                  <GitPullRequestArrow size={14} aria-hidden /> Propose a change
                </span>
                <span className="dx-act__s">New route or fare · the Driver must agree</span>
              </Link>
            )}
          </div>
        )}

        {(cancellable || (canRelease && !releasePending)) && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {canRelease && !releasePending && (
                <AgreedRelease missionId={mission.id} driverName={driver?.name ?? ""} />
              )}
              {cancellable && (
                <BusinessCancel
                  missionId={mission.id}
                  fare={currentFare(mission)}
                  pickupAtIso={mission.pickup_at}
                  hasDriver={!!mission.driver_id}
                />
              )}
            </div>
            {canRelease && !releasePending && (
              <p className="muted small" style={{ margin: "8px 0 0", lineHeight: 1.5 }}>
                Agreed release is free but {driver ? driver.name : "the Driver"} must accept it · Cancel is
                unilateral and may cost a fee this close to pickup.
              </p>
            )}
          </div>
        )}

        {/* What the last detail edit changed (D40) — the "what changed" trail. */}
        {infoChange && infoChange.items.length > 0 && (
          <div className="dx-trail">
            <Clock size={13} aria-hidden />
            <span>
              <strong>{formatDateTime(infoChange.at)}</strong> — {infoChange.items.join(" · ")}
            </span>
          </div>
        )}

        {/* Amendment state (D39 Phase 2): a proposed route/fare change awaiting the
            Driver, a decline (with a calm explanation), or an accepted change. */}
        {amendment && amendment.status === "proposed" && (
          <div className="dx-amend dx-amend--pending">
            <div className="dx-amend__head">
              <span className="dx-amend__tag">Change pending</span>
              <span className="muted small">Waiting for {driver ? driver.name : "the Driver"} to accept</span>
            </div>
            <div className="dx-amend__body">
              {amendment.summary}
              {" · fare "}
              {amendment.fareOld != null && <s>{formatMoney(amendment.fareOld)}</s>} → {formatMoney(amendment.fareNew)}
            </div>
            {!archived && (
              <form action={closeAmendment} className="dx-amend__actions">
                <input type="hidden" name="amendment_id" value={amendment.id} />
                <input type="hidden" name="mission_id" value={mission.id} />
                <button type="submit" className="dx-amend__link">Withdraw request</button>
              </form>
            )}
          </div>
        )}

        {amendment && amendment.status === "declined" && (
          <div className="dx-amend dx-amend--declined">
            <div className="dx-amend__head">
              <span className="dx-amend__tag dx-amend__tag--off">
                {driver ? `${driver.name} couldn’t take this change` : "The Driver couldn’t take this change"}
              </span>
            </div>
            {amendment.declineReason && (
              <div className="dx-amend__reason">
                <span className="muted">Reason:</span> {amendment.declineReason}
              </div>
            )}
            <p className="dx-amend__reassure">
              Declines are normal, especially in busy periods — a Driver already committed to nearby trips may
              not be able to extend this one. It’s not a reflection on you. The trip stays exactly as agreed.
            </p>
            {!archived && (
              <div className="dx-amend__actions">
                {driver?.phone && (
                  <a href={`tel:${driver.phone}`} className="dx-amend__btn">Call {driver.name}</a>
                )}
                <Link href={`/dispatch/${mission.id}/amend`} className="dx-amend__btn dx-amend__btn--primary">
                  Adjust and re-send
                </Link>
                <form action={closeAmendment}>
                  <input type="hidden" name="amendment_id" value={amendment.id} />
                  <input type="hidden" name="mission_id" value={mission.id} />
                  <button type="submit" className="dx-amend__link">Dismiss</button>
                </form>
              </div>
            )}
          </div>
        )}

        {amendment && amendment.status === "accepted" && (
          <div className="dx-amend dx-amend--accepted">
            <div className="dx-amend__head">
              <span className="dx-amend__tag dx-amend__tag--ok">Change accepted</span>
              <span className="muted small">· {formatDateTime(amendment.at)}</span>
            </div>
            {(acceptedFareChanged || acceptedRouteChanged) && (
              <div className="dx-amend__body">
                {acceptedFareChanged && (
                  <>
                    Fare <s>{formatMoney(amendment.fareOld)}</s> → {formatMoney(amendment.fareNew)}
                  </>
                )}
                {acceptedFareChanged && acceptedRouteChanged && " · "}
                {acceptedRouteChanged && amendment.summary}
              </div>
            )}
          </div>
        )}

        {/* Agreed-release state (O7, D45): a free release awaiting the Driver, a
            decline (the Driver kept the trip — their right, framed calmly), or a
            completed release (the trip is back in the Pool). */}
        {release && release.status === "proposed" &&
          (mission.status === "accepted" || mission.status === "confirmed") && (
          <div className="dx-amend dx-amend--pending">
            <div className="dx-amend__head">
              <span className="dx-amend__tag">Release pending</span>
              <span className="muted small">
                Waiting for {driver ? driver.name : "the Driver"} to accept · free
              </span>
            </div>
            {!archived && (
              <form action={closeRelease} className="dx-amend__actions">
                <input type="hidden" name="release_id" value={release.id} />
                <input type="hidden" name="mission_id" value={mission.id} />
                <button type="submit" className="dx-amend__link">Withdraw request</button>
              </form>
            )}
          </div>
        )}

        {release && release.status === "declined" && (
          <div className="dx-amend dx-amend--neutral">
            <div className="dx-amend__head">
              <span className="dx-amend__tag">Release declined</span>
              <span className="muted small">{driver ? driver.name : "The Driver"} kept the trip</span>
            </div>
            <p className="dx-amend__reassure">
              That’s the Driver’s call — a release is only ever their choice. The trip stays exactly as
              agreed. If you still need to end it, you can cancel (a fee may apply this close to pickup).
            </p>
            {!archived && (
              <form action={closeRelease} className="dx-amend__actions">
                <input type="hidden" name="release_id" value={release.id} />
                <input type="hidden" name="mission_id" value={mission.id} />
                <button type="submit" className="dx-amend__link">Dismiss</button>
              </form>
            )}
          </div>
        )}

        {release && release.status === "accepted" && mission.status === "pooled" && (
          <div className="dx-amend dx-amend--neutral">
            <div className="dx-amend__head">
              <span className="dx-amend__tag dx-amend__tag--ok">Released by agreement</span>
              <span className="muted small">· back in the Pool · {formatDateTime(release.at)}</span>
            </div>
            {!archived && (
              <form action={closeRelease} className="dx-amend__actions">
                <input type="hidden" name="release_id" value={release.id} />
                <input type="hidden" name="mission_id" value={mission.id} />
                <button type="submit" className="dx-amend__link">Dismiss</button>
              </form>
            )}
          </div>
        )}

        {t.hint && <div className="notice warn" style={{ marginTop: 12 }}>{t.hint}</div>}

        {/* Scan strip — the numbers a Dispatcher acts on. Pickup on the left, fare
            on the right; the Flight tile drops out when there's no flight. */}
        <div className="dx-scan">
          <div className="dx-scan__c">
            <div className="dx-scan__cap">Pickup</div>
            <div className="dx-scan__v">{formatDateTime(mission.pickup_at)}</div>
            <div className="dx-scan__s">Paris time</div>
          </div>
          <div className="dx-scan__c">
            <div className="dx-scan__cap">Vehicle</div>
            <div className="dx-scan__v">{serviceLabel}</div>
            <div className="dx-scan__s">
              {specificCar ?? (mission.luggage_only ? "Luggage run" : mission.zone ?? "")}
            </div>
          </div>
          {mission.flight_number && (
            <div className="dx-scan__c">
              <div className="dx-scan__cap">Flight</div>
              <div className="dx-scan__v">{mission.flight_number}</div>
              <div className="dx-scan__s">{flightEta ? `lands ${flightEta}` : ""}</div>
            </div>
          )}
          <div className="dx-scan__c dx-scan__c--fare">
            <div className="dx-scan__cap">Fare now</div>
            <div className="dx-scan__v dx-scan__v--big">{formatMoney(currentFare(mission))}</div>
            <div className="dx-scan__s">ceiling {formatMoney(mission.ceiling)}</div>
          </div>
        </div>

        {/* Route — full addresses + trip distance/duration; the rail checks off live
            as the Driver reaches each stop mid-trip. */}
        <div className="dx-panel dx-panel--route">
          <div className="dx-panel__h dx-panel__h--split">
            <span>Route</span>
            {tripMeta && <span className="dx-panel__meta">{tripMeta}</span>}
          </div>
          <div className="dx-rte">
            <div className="dx-rte__leg">
              <span className="dx-rte__dot dx-rte__dot--pk" aria-hidden />
              <span className="dx-rte__addr" title={mission.pickup_address}>
                {mission.pickup_address}
              </span>
            </div>
            {waypoints.map((w, i) => {
              const reached = i < stopsReached;
              const current = mission.status === "on_board" && i === stopsReached;
              return (
                <div
                  className={`dx-rte__leg${reached ? " dx-rte__leg--done" : ""}${current ? " dx-rte__leg--now" : ""}`}
                  key={i}
                >
                  <span className="dx-rte__dot dx-rte__dot--via" aria-hidden />
                  <span className="dx-rte__addr" title={w.address}>{w.address}</span>
                  {reached && <span className="dx-rte__tag dx-rte__tag--done">reached</span>}
                  {current && <span className="dx-rte__tag dx-rte__tag--now">next stop</span>}
                </div>
              );
            })}
            <div className="dx-rte__leg">
              <span className="dx-rte__dot dx-rte__dot--dp" aria-hidden />
              <span className="dx-rte__addr" title={mission.dropoff_address ?? undefined}>
                {mission.dropoff_address ?? "—"}
              </span>
            </div>
          </div>
          {(isExecutable(mission.status) || mission.status === "completed") && (
            <StatusSteps
              status={mission.status}
              stopsCount={waypoints.length}
              stopsReached={stopsReached}
            />
          )}
        </div>

        {/* Driver — a slim bar (name · phone · car), or a quiet placeholder when the
            trip is still in the Pool. */}
        {driver ? (
          <div className="dx-driverbar">
            <span className="dx-av" aria-hidden>{driverInitials}</span>
            <div className="dx-driverbar__id">
              <div className="dx-driverbar__nm">
                {driver.name} <span>· Driver</span>
              </div>
              {driver.phone && (
                <a href={`tel:${driver.phone}`} className="dx-tel">
                  <Phone size={13} aria-hidden /> {driver.phone}
                </a>
              )}
            </div>
            {(carDesc || car?.plate) && (
              <span className="dx-carinline">
                <Car size={14} aria-hidden /> {carDesc || "Car"}
                {car?.plate && <span className="mono dx-plate">{car.plate}</span>}
              </span>
            )}
          </div>
        ) : (
          <div className="dx-driverbar dx-driverbar--empty">
            <Car size={15} aria-hidden />
            {mission.status === "pooled" ? "No Driver yet · in the Pool" : "No Driver assigned"}
          </div>
        )}

        {/* Service for the Driver + Guests, side by side. */}
        <div className="dx-pgrid">
          {hasService && (
            <div className="dx-panel">
              <div className="dx-panel__h">Service for the Driver</div>
              {languages.length > 0 && (
                <div className="dx-srow">
                  <span className="dx-slbl">Languages</span>
                  <div className="dx-chips">
                    {languages.map((l) => (
                      <span className="dx-chip dx-chip--plain" key={l}>{l}</span>
                    ))}
                  </div>
                </div>
              )}
              {dressLabel && (
                <div className="dx-srow">
                  <span className="dx-slbl">Dress</span>
                  <div className="dx-chips"><span className="dx-chip">{dressLabel}</span></div>
                </div>
              )}
              {flagLabels.length > 0 && (
                <div className="dx-srow">
                  <span className="dx-slbl">Requests</span>
                  <div className="dx-chips">
                    {flagLabels.map((f) => (
                      <span className="dx-chip" key={f}>{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {(mission.board_name || mission.board_file_path) && (
                <div className="dx-srow">
                  <span className="dx-slbl">Name board</span>
                  <div className="dx-sval">
                    {mission.board_name || "—"}
                    {mission.board_file_path && (
                      <>
                        {" "}
                        <BoardFileLink missionId={mission.id} />
                      </>
                    )}
                  </div>
                </div>
              )}
              {mission.driver_message && (
                <div className="dx-srow">
                  <span className="dx-slbl">Message</span>
                  <div className="dx-quote">{mission.driver_message}</div>
                </div>
              )}
            </div>
          )}

          <div className="dx-panel">
            <div className="dx-panel__h">{guestsHeader}</div>
            {mission.luggage_only ? (
              <p className="dx-note">No passengers — luggage only.</p>
            ) : guestRows.length > 0 ? (
              guestRows.map((g) => (
                <div className="dx-guestrow" key={g.index}>
                  <div className="dx-gwho">
                    {g.main && <Star size={13} className="dx-gstar" aria-hidden />}
                    {g.main ? "Main contact" : "Guest"}
                    {g.name ? ` · ${g.name}` : ""}
                  </div>
                  {g.phone && (
                    <div className="dx-grow">
                      <a className="dx-tel" href={`tel:${g.phone}`}>
                        <Phone size={13} aria-hidden /> {g.phone}
                      </a>
                      <PhoneShareToggle
                        missionId={mission.id}
                        index={g.index}
                        shared={g.shared}
                        disabled={shareLocked}
                      />
                    </div>
                  )}
                </div>
              ))
            ) : mission.passenger_name ? (
              <div className="dx-guestrow">
                <div className="dx-gwho">
                  <Star size={13} className="dx-gstar" aria-hidden /> Main contact · {mission.passenger_name}
                </div>
              </div>
            ) : (
              <p className="dx-note">No named guests.</p>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}
