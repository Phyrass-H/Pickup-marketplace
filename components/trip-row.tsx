import Link from "next/link";
import { Pencil } from "lucide-react";
import type { MissionRow } from "@/lib/database.types";
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
import {
  parsePassengers,
  zipGuestContacts,
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

// One dense schedule line. Click to expand full detail. The coloured left edge +
// status pill are the at-a-glance signal a hotel scans (red = needs a call). When
// a Driver hasn't confirmed near pickup (danger tone) the whole row gets a gentle
// red wash — the T-180 alert.
export function TripRow({
  mission,
  driver,
  guestContacts,
  archived = false,
}: {
  mission: MissionRow;
  driver?: DriverContact | null;
  guestContacts?: GuestContact[] | null;
  archived?: boolean;
}) {
  const t = missionTone(mission, undefined, { archived });
  const reference = mission.reference?.trim() || null;
  // Guests with a phone (the Business owns these numbers). The Share switch flips
  // whether the assigned Driver can see each one; archived/past trips are read-only.
  const guests = zipGuestContacts(
    parsePassengers(mission.passenger_names),
    guestContacts ?? [],
  );
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
        {t.hint && <div className="notice warn" style={{ marginTop: 12 }}>{t.hint}</div>}

        <div className="route" style={{ marginTop: 12 }}>
          <div className="leg">
            <span className="dot" />
            <span>{mission.pickup_address}</span>
          </div>
          {waypoints.map((w, i) => {
            const reached = i < stopsReached;
            const current = mission.status === "on_board" && i === stopsReached;
            return (
              <div
                className={`leg leg--stop${reached ? " leg--done" : ""}${current ? " leg--now" : ""}`}
                key={i}
              >
                <span className="dot mid" />
                <span className="leg-addr muted">{w.address}</span>
                {reached && <span className="leg-tag leg-tag--done">reached</span>}
                {current && <span className="leg-tag leg-tag--now">next stop</span>}
              </div>
            );
          })}
          <div className="leg">
            <span className="dot end" />
            <span>{mission.dropoff_address ?? "—"}</span>
          </div>
        </div>

        {(isExecutable(mission.status) || mission.status === "completed") && (
          <StatusSteps
            status={mission.status}
            stopsCount={waypoints.length}
            stopsReached={stopsReached}
          />
        )}

        <dl className="kv" style={{ marginTop: 14 }}>
          <dt>When</dt>
          <dd>{formatDateTime(mission.pickup_at)}</dd>
          <dt>Fare (now)</dt>
          <dd>{formatMoney(currentFare(mission))} · ceiling {formatMoney(mission.ceiling)}</dd>
          <dt>Vehicle</dt>
          <dd>
            {serviceClassLabel(mission.category, mission.required_body_type)}
            {mission.luggage_only ? " · Luggage run" : ""}
            {mission.zone ? ` · ${mission.zone}` : ""}
          </dd>
          {mission.required_make && mission.required_model && (
            <>
              <dt>Specific car</dt>
              <dd>
                {mission.required_make} {mission.required_model}
              </dd>
            </>
          )}
          {tripMeta && (
            <>
              <dt>Trip</dt>
              <dd>{tripMeta}</dd>
            </>
          )}
          <dt>Guest</dt>
          <dd>{mission.passenger_name ?? "—"}</dd>
          {reference && (
            <>
              <dt>Reference</dt>
              <dd>{reference}</dd>
            </>
          )}
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
          {(mission.board_name || mission.board_file_path) && (
            <>
              <dt>Name board</dt>
              <dd>
                {mission.board_name || "—"}
                {mission.board_file_path && (
                  <>
                    {" · "}
                    <BoardFileLink missionId={mission.id} />
                  </>
                )}
              </dd>
            </>
          )}
          {mission.driver_message && (
            <>
              <dt>Message to Driver</dt>
              <dd>{mission.driver_message}</dd>
            </>
          )}
          <dt>Pax / luggage</dt>
          <dd>
            {mission.luggage_only
              ? `No passengers · ${mission.luggage_count ?? 0} bags`
              : `${mission.pax_count ?? "—"} pax · ${mission.luggage_count ?? "—"} bags`}
          </dd>
          {mission.flight_number && (
            <>
              <dt>Flight</dt>
              <dd>
                {mission.flight_number}
                {flightEta ? ` · ETA ${flightEta}` : ""}
              </dd>
            </>
          )}
          <dt>Driver</dt>
          <dd>
            {driver ? (
              <>
                {driver.name}
                {driver.phone && (
                  <>
                    {" · "}
                    <a href={`tel:${driver.phone}`} className="dx-tel">
                      {driver.phone}
                    </a>
                  </>
                )}
              </>
            ) : (
              "Not assigned yet"
            )}
          </dd>
          {car && (carDesc || car.plate) && (
            <>
              <dt>Car</dt>
              <dd>
                {carDesc || "—"}
                {car.plate && <span className="mono"> · {car.plate}</span>}
              </dd>
            </>
          )}
        </dl>

        {guests.length > 0 && (
          <div className="dx-guests">
            {guests.map((g) => (
              <div className="dx-guest" key={g.index}>
                <span className="dx-guest__who">
                  {g.main ? "Main contact" : "Guest"}
                  {g.name ? ` · ${g.name}` : ""}
                </span>
                <a className="dx-guest__tel" href={`tel:${g.phone}`}>
                  {g.phone}
                </a>
                <PhoneShareToggle
                  missionId={mission.id}
                  index={g.index}
                  shared={g.shared}
                  disabled={shareLocked}
                />
              </div>
            ))}
          </div>
        )}

        {/* Edit the trip's info (guests, flight, reference, Driver & service) — no
            price/route change. Only while pre-departure; frozen once executing/done. */}
        {editable && (
          <div className="dx-trip__actions">
            <Link href={`/dispatch/${mission.id}/edit`} className="dx-editlink">
              <Pencil size={14} aria-hidden /> Edit details
            </Link>
          </div>
        )}
      </div>
    </details>
  );
}
