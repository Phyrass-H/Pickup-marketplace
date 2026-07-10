"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { UserRound, ClipboardList, Users } from "lucide-react";
import { PassengerList } from "@/components/passenger-list";
import { ReferenceField } from "@/components/reference-field";
import { DriverServiceFields } from "@/components/driver-service-fields";
import type { Passenger } from "@/lib/passengers";
import type { DriverFlags } from "@/lib/driver-service";
import type { ServiceTier } from "@/lib/vehicle-catalog";
import { updateMissionInfo } from "./actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" style={{ width: "auto", padding: "10px 18px" }} disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

// Phase-1 info-only mission edit. Reuses the exact new-mission sub-components
// (PassengerList, ReferenceField, DriverServiceFields) pre-filled from the
// mission; the server action whitelists only info columns, so price/route/timing
// can't move. A luggage-only run hides the Guests card (no passengers).
export function EditMissionForm({
  missionId,
  luggageOnly,
  tier,
  body,
  seedPassengers,
  initialPrimaryName,
  flightNumber,
  luggageCount,
  reference,
  serviceDefaults,
}: {
  missionId: string;
  luggageOnly: boolean;
  tier: ServiceTier;
  body: string;
  seedPassengers?: Passenger[];
  initialPrimaryName: string;
  flightNumber: string | null;
  luggageCount: number | null;
  reference: string | null;
  serviceDefaults: {
    languages?: string[];
    dressCode?: string | null;
    flags?: DriverFlags;
    boardName?: string | null;
    driverMessage?: string | null;
    hasBoardFile?: boolean;
  };
}) {
  // Lift the primary Guest name so the meet & greet board can track it (mirrors
  // the new-mission form). Irrelevant on a luggage run (no passengers).
  const [primaryName, setPrimaryName] = useState<string>(initialPrimaryName);
  const action = updateMissionInfo.bind(null, missionId);

  return (
    <form action={action} encType="multipart/form-data" className="ex-form">
      {/* luggage_only is read-only context; the action reads it to keep passenger
          columns null on a bags-only run. It is never written back. */}
      {luggageOnly && <input type="hidden" name="luggage_only" value="1" />}

      {!luggageOnly && (
        <div className="card">
          <div className="mx-card__head">
            <span className="mx-card__ic" aria-hidden>
              <Users />
            </span>
            <h3 className="mx-card__title">Guests</h3>
          </div>
          <PassengerList
            body={body}
            defaultPassengers={seedPassengers}
            onPrimaryNameChange={setPrimaryName}
          />
        </div>
      )}

      <div className="card">
        <div className="mx-card__head">
          <span className="mx-card__ic" aria-hidden>
            <ClipboardList />
          </span>
          <h3 className="mx-card__title">Trip details</h3>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <label className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span>Luggage (bags)</span>
            <input
              type="text"
              name="luggage_count"
              inputMode="numeric"
              defaultValue={luggageCount ?? ""}
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.replace(/[^\d]/g, "");
              }}
            />
          </label>
          <label className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span>Flight number</span>
            <input type="text" name="flight_number" defaultValue={flightNumber ?? ""} />
          </label>
        </div>
        <div className="mx-sumdiv" />
        <ReferenceField defaultValue={reference} />
      </div>

      <div className="card">
        <div className="mx-card__head">
          <span className="mx-card__ic" aria-hidden>
            <UserRound />
          </span>
          <h3 className="mx-card__title">Driver &amp; service</h3>
        </div>
        <DriverServiceFields tier={tier} guestName={primaryName} defaults={serviceDefaults} />
      </div>

      <div className="ex-actions">
        <SaveButton />
        <Link href="/dispatch" className="btn secondary" style={{ width: "auto", padding: "10px 18px" }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
