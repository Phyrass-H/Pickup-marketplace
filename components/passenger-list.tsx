"use client";

import { useEffect, useState } from "react";
import { Plus, X, Info, Star, Phone } from "lucide-react";
import { ShareSwitch } from "@/components/share-switch";
import {
  primaryPassengerName,
  mainIndex,
  seatCap,
  SEDAN_SEATS,
  VAN_SEATS,
  type Passenger,
} from "@/lib/passengers";

// Named Guests on a mission (first + surname + optional phone). The number of
// rows IS the headcount (createMission derives pax_count from it), capped by the
// chosen Body type. One row is the MAIN contact (shows on the schedule line). A
// phone is captured per Guest but only reaches the Driver when its "Share" switch
// is on — the number is stored apart from the mission row (privacy gate). Emits a
// hidden `passenger_names` JSON field with the full rows; createMission splits
// names (→ mission) from phones (→ mission_guest_contact). `body` comes from the
// Vehicle & class card (lifted into MissionForm).
export function PassengerList({
  body,
  defaultPassengers,
  onPrimaryNameChange,
}: {
  body: string; // "" (any) | "sedan" | "van"
  defaultPassengers?: Passenger[];
  onPrimaryNameChange?: (name: string) => void;
}) {
  const [rows, setRows] = useState<Passenger[]>(
    defaultPassengers && defaultPassengers.length > 0
      ? defaultPassengers
      : [{ first: "", last: "", phone: "", main: true }],
  );

  // Surface the main Guest's name so the Driver card can pre-fill the meet &
  // greet board with it (lifted into MissionForm, mirrors the body/tier lifts).
  useEffect(() => {
    onPrimaryNameChange?.(primaryPassengerName(rows));
  }, [rows, onPrimaryNameChange]);

  const cap = seatCap(body);
  const atCap = rows.length >= cap;
  const overCap = rows.length > cap;
  const anyOver4 = body === "" && rows.length > SEDAN_SEATS;
  const bodyLabel = body === "van" ? "Van" : body === "sedan" ? "Sedan" : "Any";
  const mi = mainIndex(rows);

  function update(i: number, patch: Partial<Passenger>) {
    setRows((r) => r.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function setMain(i: number) {
    setRows((r) => r.map((p, idx) => ({ ...p, main: idx === i })));
  }
  function add() {
    setRows((r) => (r.length >= cap ? r : [...r, { first: "", last: "", phone: "" }]));
  }
  function remove(i: number) {
    setRows((r) => {
      if (r.length <= 1) return r;
      const next = r.filter((_, idx) => idx !== i);
      // Keep exactly one main contact if we removed it.
      if (!next.some((p) => p.main)) next[0] = { ...next[0], main: true };
      return next;
    });
  }

  const note = overCap
    ? `More passengers than a ${bodyLabel} holds (${cap}) — remove some or switch Body type.`
    : anyOver4
      ? `More than ${SEDAN_SEATS} passengers needs a Van.`
      : body === "sedan" && atCap
        ? `A Sedan seats up to ${SEDAN_SEATS}. Switch Body type to Van to add more.`
        : body === "van" && atCap
          ? `A Van seats up to ${VAN_SEATS}.`
          : null;

  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <div className="pl-head">
        <span className="scf-label" style={{ marginBottom: 0 }}>
          Passengers
          <span className="pl-cap">
            {bodyLabel} ·{" "}
            {atCap || overCap ? `${rows.length} / ${cap}` : `up to ${cap}`}
          </span>
        </span>
        <button
          type="button"
          className="pl-add"
          onClick={add}
          disabled={atCap}
          aria-label="Add passenger"
        >
          <Plus size={15} aria-hidden /> Add passenger
        </button>
      </div>

      <div className="pl-rows">
        {rows.map((p, i) => {
          const isMain = i === mi;
          return (
            <div className={`pl-guest${isMain ? " pl-guest--main" : ""}`} key={i}>
              <div className="pl-ghead">
                {isMain ? (
                  <span className="pl-star pl-star--main">
                    <Star size={14} aria-hidden /> Guest {i + 1} · Main contact
                  </span>
                ) : (
                  <button
                    type="button"
                    className="pl-star"
                    onClick={() => setMain(i)}
                  >
                    <Star size={14} aria-hidden /> Guest {i + 1} ·{" "}
                    <span className="pl-star__set">Set as main</span>
                  </button>
                )}
                {rows.length > 1 ? (
                  <button
                    type="button"
                    className="pl-grm"
                    onClick={() => remove(i)}
                    aria-label={`Remove Guest ${i + 1}`}
                  >
                    <X size={15} aria-hidden />
                  </button>
                ) : (
                  <span aria-hidden />
                )}
              </div>

              <div className="pl-fields">
                <input
                  type="text"
                  placeholder="First name"
                  value={p.first}
                  onChange={(e) => update(i, { first: e.target.value })}
                  aria-label={`Guest ${i + 1} first name`}
                />
                <input
                  type="text"
                  placeholder="Surname"
                  value={p.last}
                  onChange={(e) => update(i, { last: e.target.value })}
                  aria-label={`Guest ${i + 1} surname`}
                />
                <div className="pl-phone">
                  <Phone size={15} aria-hidden />
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="Phone (optional)"
                    value={p.phone}
                    onChange={(e) => update(i, { phone: e.target.value })}
                    aria-label={`Guest ${i + 1} phone`}
                  />
                </div>
              </div>

              {p.phone.trim() !== "" && (
                <div className="pl-share">
                  <ShareSwitch
                    on={Boolean(p.phoneShared)}
                    onToggle={() => update(i, { phoneShared: !p.phoneShared })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* The live region is always mounted (empty when there's no note) so a
          screen reader announces the cap/over-cap warning the moment it appears. */}
      <div role="status" aria-live="polite">
        {note && (
          <div className="pl-note">
            <Info size={14} aria-hidden />
            {note}
          </div>
        )}
      </div>

      <p className="muted small" style={{ margin: "10px 0 0" }}>
        Names are optional. The <strong>main contact</strong> shows on the schedule
        line. A phone is never shared automatically — flip <em>Share with Driver</em>{" "}
        to let them call the Guest, now or later from the schedule.
      </p>

      <input type="hidden" name="passenger_names" value={JSON.stringify(rows)} />
    </div>
  );
}
