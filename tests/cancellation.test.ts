// lib/cancellation.ts — the O7 fee ramp, the courtesy wait and the waiting
// meter (D45 · D47 · D48). This file MIRRORS SQL: every number here also exists
// in docs/migrations/*.sql, so a test that pins the rule pins both sides.
import { describe, expect, it } from "vitest";
import {
  businessCancelPct,
  cancelCompensation,
  guestDueAt,
  isAirportPickup,
  noShowAvailableAt,
  noShowWaitMinutes,
  waitingAt,
  waitingCeilingMinutes,
  WAITING_RATE_PER_MIN,
} from "@/lib/cancellation";
import { mission } from "./fixtures";

const at = (iso: string) => new Date(iso);

describe("isAirportPickup — the S42 accent bug", () => {
  it("matches the exact Mapbox string for Nice airport", () => {
    // "Aéroport Nice Côte d'Azur" is what the autocomplete stores in
    // pickup_label. The old predicate used a bracket expression around a
    // multibyte character, Postgres `~*` didn't reliably match it, and every
    // accented airport pickup silently got a 20-minute city wait instead of 60.
    expect(
      isAirportPickup(
        mission({
          pickup_address: "Rue Costes et Bellonte, 06200 Nice, France",
          pickup_label: "Aéroport Nice Côte d'Azur",
        }),
      ),
    ).toBe(true);
  });

  it("matches whatever the accent, case or Unicode normalisation", () => {
    const forms = [
      "Aéroport Nice", // NFC — single é codepoint
      "Aéroport Nice", // NFD — e + combining acute
      "Aeroport Nice", // no accent at all
      "AÉROPORT NICE",
      "Aeroporto di Genova",
      "London City Airport",
      "airport terminal 2",
    ].map((s, i) => (i === 0 ? s.normalize("NFC") : i === 1 ? s.normalize("NFD") : s));
    // ⚑ The two normalisations are BUILT, not typed: an editor silently
    // normalises a pasted literal, and this case would quietly become vacuous.
    expect(forms[0]).not.toBe(forms[1]);
    for (const label of forms) {
      expect(isAirportPickup(mission({ pickup_label: label }))).toBe(true);
    }
  });

  it("reads the address as well as the label", () => {
    expect(
      isAirportPickup(mission({ pickup_address: "Aéroport de Cannes-Mandelieu", pickup_label: null })),
    ).toBe(true);
  });

  it("is true whenever a flight number is attached, wherever the pickup is", () => {
    expect(isAirportPickup(mission({ flight_number: "AF7701" }))).toBe(true);
  });

  it("is false for an ordinary city pickup", () => {
    expect(
      isAirportPickup(
        mission({ pickup_address: "37 Promenade des Anglais, 06000 Nice, France", pickup_label: "Hôtel Negresco" }),
      ),
    ).toBe(false);
  });
});

describe("the courtesy wait", () => {
  it("is 60 minutes at an airport and 20 in the city", () => {
    expect(noShowWaitMinutes(true)).toBe(60);
    expect(noShowWaitMinutes(false)).toBe(20);
  });

  it("stops the meter at 120 minutes at an airport and 60 in the city", () => {
    expect(waitingCeilingMinutes(true)).toBe(120);
    expect(waitingCeilingMinutes(false)).toBe(60);
  });
});

describe("guestDueAt — the clock belongs to the Guest, not the Driver", () => {
  it("is the booked pickup time by default", () => {
    const m = mission({ pickup_at: "2026-07-15T12:00:00+02:00" });
    expect(guestDueAt(m).toISOString()).toBe(at("2026-07-15T12:00:00+02:00").toISOString());
  });

  it("is the tracked ready instant once flight tracking sets one", () => {
    const m = mission({
      pickup_at: "2026-07-15T12:00:00+02:00",
      guest_ready_at: "2026-07-15T13:30:00+02:00",
    });
    expect(guestDueAt(m).toISOString()).toBe(at("2026-07-15T13:30:00+02:00").toISOString());
  });
});

describe("waitingAt — the D48 meter", () => {
  const city = mission({ pickup_at: "2026-07-15T12:00:00+02:00" });
  const airport = mission({ pickup_at: "2026-07-15T12:00:00+02:00", flight_number: "AF7701" });

  it("charges nothing during the courtesy wait", () => {
    expect(waitingAt(city, at("2026-07-15T12:00:00+02:00")).fee).toBe(0);
    expect(waitingAt(city, at("2026-07-15T12:19:59+02:00")).fee).toBe(0);
    expect(waitingAt(city, at("2026-07-15T12:20:00+02:00")).fee).toBe(0);
  });

  it("charges the first minute the instant the courtesy wait lapses (per minute STARTED)", () => {
    const w = waitingAt(city, at("2026-07-15T12:20:01+02:00"));
    expect(w.minutes).toBe(1);
    expect(w.fee).toBe(1 * WAITING_RATE_PER_MIN);
  });

  it("counts minutes started, not minutes completed", () => {
    expect(waitingAt(city, at("2026-07-15T12:25:00+02:00")).minutes).toBe(5);
    expect(waitingAt(city, at("2026-07-15T12:25:01+02:00")).minutes).toBe(6);
  });

  it("caps the money without ending the trip — 40 € city", () => {
    const capped = waitingAt(city, at("2026-07-15T13:00:00+02:00"));
    expect(capped.minutes).toBe(40);
    expect(capped.fee).toBe(40);
    expect(capped.capped).toBe(true);
    expect(capped.maxFee).toBe(40);

    // An hour later still 40 — the meter is frozen, the Driver is still there.
    const later = waitingAt(city, at("2026-07-15T14:00:00+02:00"));
    expect(later.fee).toBe(40);
    expect(later.capped).toBe(true);
  });

  it("caps at 60 € at an airport, on the longer courtesy wait", () => {
    expect(waitingAt(airport, at("2026-07-15T12:59:00+02:00")).fee).toBe(0);
    expect(waitingAt(airport, at("2026-07-15T13:30:00+02:00")).fee).toBe(30);
    const capped = waitingAt(airport, at("2026-07-15T14:00:00+02:00"));
    expect(capped.fee).toBe(60);
    expect(capped.capped).toBe(true);
    expect(capped.maxFee).toBe(60);
  });

  it("runs its window from the tracked Guest-ready instant when there is one", () => {
    const late = mission({
      pickup_at: "2026-07-15T12:00:00+02:00",
      guest_ready_at: "2026-07-15T13:00:00+02:00",
    });
    // The Guest is due at 13:00, so 13:10 is still inside the courtesy wait even
    // though it is over an hour past the booked pickup time.
    expect(waitingAt(late, at("2026-07-15T13:10:00+02:00")).fee).toBe(0);
    expect(waitingAt(late, at("2026-07-15T13:30:00+02:00")).minutes).toBe(10);
  });

  it("never returns negative minutes before the Guest is even due", () => {
    const w = waitingAt(city, at("2026-07-15T09:00:00+02:00"));
    expect(w.minutes).toBe(0);
    expect(w.fee).toBe(0);
    expect(w.capped).toBe(false);
  });

  it("exposes the meter's own start and stop instants", () => {
    const w = waitingAt(city, at("2026-07-15T12:30:00+02:00"));
    expect(w.from.toISOString()).toBe(at("2026-07-15T12:20:00+02:00").toISOString());
    expect(w.until.toISOString()).toBe(at("2026-07-15T13:00:00+02:00").toISOString());
  });

  it("accepts a millisecond timestamp as well as a Date", () => {
    const asMs = waitingAt(city, at("2026-07-15T12:30:00+02:00").getTime());
    const asDate = waitingAt(city, at("2026-07-15T12:30:00+02:00"));
    expect(asMs.fee).toBe(asDate.fee);
  });
});

describe("noShowAvailableAt — the S41 clock-origin exploit", () => {
  it("unlocks one courtesy wait after the GUEST was due", () => {
    const m = mission({ pickup_at: "2026-07-15T12:00:00+02:00" });
    const unlock = noShowAvailableAt(m, "2026-07-15T11:55:00+02:00");
    expect(unlock.toISOString()).toBe(at("2026-07-15T12:20:00+02:00").toISOString());
  });

  it("cannot be brought forward by tapping 'arrived' early", () => {
    // The exploit: `advanceStatus` has no time guard, so a Driver could tap
    // through ~33h early, wait out a 20-minute window anchored on their own tap,
    // and file a no-show — charging the Business a full fare before the trip.
    const m = mission({ pickup_at: "2026-07-15T12:00:00+02:00" });
    const unlock = noShowAvailableAt(m, "2026-07-14T03:00:00+02:00");
    expect(unlock.toISOString()).toBe(at("2026-07-15T12:20:00+02:00").toISOString());
    expect(unlock.getTime()).toBeGreaterThan(at("2026-07-15T12:00:00+02:00").getTime());
  });

  it("holds a late Driver on site for the 5-minute floor", () => {
    // Turning up after the courtesy wait already closed does not mean filing
    // instantly: the floor is 5 minutes of actual presence.
    const m = mission({ pickup_at: "2026-07-15T12:00:00+02:00" });
    const unlock = noShowAvailableAt(m, "2026-07-15T12:40:00+02:00");
    expect(unlock.toISOString()).toBe(at("2026-07-15T12:45:00+02:00").toISOString());
  });

  it("never binds the floor on an on-time Driver", () => {
    const m = mission({ pickup_at: "2026-07-15T12:00:00+02:00", flight_number: "AF7701" });
    // Airport: the window ends at 13:00, well past arrived + 5 min.
    expect(noShowAvailableAt(m, "2026-07-15T11:58:00+02:00").toISOString()).toBe(
      at("2026-07-15T13:00:00+02:00").toISOString(),
    );
  });

  it("uses the tracked Guest-ready instant as the origin when set", () => {
    const m = mission({
      pickup_at: "2026-07-15T12:00:00+02:00",
      guest_ready_at: "2026-07-15T14:00:00+02:00",
    });
    expect(noShowAvailableAt(m, "2026-07-15T11:50:00+02:00").toISOString()).toBe(
      at("2026-07-15T14:20:00+02:00").toISOString(),
    );
  });
});

describe("businessCancelPct — the D45 ramp", () => {
  it("is free while nobody holds the mission, however close to pickup", () => {
    expect(businessCancelPct(0.25, false)).toBe(0);
    expect(businessCancelPct(-3, false)).toBe(0);
  });

  it("is free more than 5 hours out even with a Driver on it", () => {
    expect(businessCancelPct(24, true)).toBe(0);
    expect(businessCancelPct(5.01, true)).toBe(0);
  });

  it("steps to 50 % at exactly 5 hours", () => {
    expect(businessCancelPct(5, true)).toBe(50);
  });

  it("climbs 10 % an hour — 5 % every half hour — from there", () => {
    expect(businessCancelPct(4, true)).toBe(60);
    expect(businessCancelPct(4.5, true)).toBe(55);
    expect(businessCancelPct(2.5, true)).toBe(75);
    expect(businessCancelPct(1, true)).toBe(90);
  });

  it("reaches 100 % at the pickup time and stays there afterwards", () => {
    expect(businessCancelPct(0, true)).toBe(100);
    expect(businessCancelPct(-0.5, true)).toBe(100);
    expect(businessCancelPct(-48, true)).toBe(100);
  });

  it("stays inside 0–100 across the whole range", () => {
    for (let h = -10; h <= 10; h += 0.25) {
      const pct = businessCancelPct(h, true);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });

  it("never decreases as the pickup gets closer", () => {
    // Monotonicity is the property that makes the ramp a deterrent: waiting must
    // never become cheaper than cancelling now.
    let prev = 0;
    for (let h = 10; h >= -2; h -= 0.25) {
      const pct = businessCancelPct(h, true);
      expect(pct).toBeGreaterThanOrEqual(prev);
      prev = pct;
    }
  });
});

describe("cancelCompensation — what the Driver is owed on a cancelled trip", () => {
  it("is the policy fee plus any waiting already accrued", () => {
    const m = mission({ status: "cancelled", cancellation_fee: 58.17, waiting_fee: 12 });
    expect(cancelCompensation(m)).toBe(70.17);
  });

  it("is the fee alone when no waiting ran", () => {
    const m = mission({ status: "cancelled", cancellation_fee: 45, waiting_fee: null });
    expect(cancelCompensation(m)).toBe(45);
  });

  it("is null on a trip that did not end cancelled", () => {
    expect(cancelCompensation(mission({ status: "completed", cancellation_fee: 45 }))).toBeNull();
  });

  it("is null on a legacy row stamped before the fee column existed", () => {
    // Show nothing rather than a wrong number.
    expect(cancelCompensation(mission({ status: "cancelled", cancellation_fee: null }))).toBeNull();
  });

  it("coerces the PostgREST numeric-as-STRING instead of concatenating it", () => {
    // Postgres `numeric` arrives over PostgREST as text. Summed raw, 58.17 and
    // 12 would produce the string "58.1712".
    const m = mission({
      status: "cancelled",
      cancellation_fee: "58.17" as unknown as number,
      waiting_fee: "12" as unknown as number,
    });
    expect(cancelCompensation(m)).toBe(70.17);
  });
});
