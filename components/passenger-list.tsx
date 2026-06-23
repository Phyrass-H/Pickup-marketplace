"use client";

import { useState } from "react";
import { Plus, X, Info } from "lucide-react";
import { seatCap, SEDAN_SEATS, VAN_SEATS, type Passenger } from "@/lib/passengers";

// Named Guests on a mission (first + surname). The number of rows IS the
// headcount (createMission derives pax_count from it), capped by the chosen
// Body type. Names are optional per row. Emits a hidden `passenger_names` JSON
// field; `body` comes from the Vehicle & class card (lifted into MissionForm).
export function PassengerList({
  body,
  defaultPassengers,
}: {
  body: string; // "" (any) | "sedan" | "van"
  defaultPassengers?: Passenger[];
}) {
  const [rows, setRows] = useState<Passenger[]>(
    defaultPassengers && defaultPassengers.length > 0
      ? defaultPassengers
      : [{ first: "", last: "" }],
  );

  const cap = seatCap(body);
  const atCap = rows.length >= cap;
  const overCap = rows.length > cap;
  const anyOver4 = body === "" && rows.length > SEDAN_SEATS;
  const bodyLabel = body === "van" ? "Van" : body === "sedan" ? "Sedan" : "Any";

  function update(i: number, patch: Partial<Passenger>) {
    setRows((r) => r.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function add() {
    setRows((r) => (r.length >= cap ? r : [...r, { first: "", last: "" }]));
  }
  function remove(i: number) {
    setRows((r) => (r.length <= 1 ? r : r.filter((_, idx) => idx !== i)));
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
        </span>
        <span className="pl-cap">
          {bodyLabel} ·{" "}
          {atCap || overCap ? `${rows.length} / ${cap}` : `up to ${cap}`}
        </span>
      </div>

      <div className="pl-rows">
        {rows.map((p, i) => (
          <div className="pl-row" key={i}>
            <span className="pl-n">Guest {i + 1}</span>
            <div className="pl-cols">
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
            </div>
            {rows.length > 1 ? (
              <button
                type="button"
                className="pl-rm"
                onClick={() => remove(i)}
                aria-label={`Remove Guest ${i + 1}`}
              >
                <X size={15} aria-hidden />
              </button>
            ) : (
              <span className="pl-rm-space" aria-hidden />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="pl-add"
        onClick={add}
        disabled={atCap}
        aria-label="Add passenger"
      >
        <Plus size={16} aria-hidden /> Add passenger
      </button>

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

      <p className="muted small" style={{ margin: "8px 0 0" }}>
        Names are optional. The first Guest shows on the schedule line and is
        shared with the assigned Driver.
      </p>

      <input type="hidden" name="passenger_names" value={JSON.stringify(rows)} />
    </div>
  );
}
