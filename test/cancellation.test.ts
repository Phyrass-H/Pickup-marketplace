// O7 + D48 — who pays what when a trip does not happen the way it was booked.
//
// Three live bugs are pinned here:
//  · the accented-airport miss (S42) — every "Aéroport …" pickup was classified
//    CITY, so a Driver got 20 minutes of courtesy wait instead of 60;
//  · the no-show clock origin (S41) — the wait ran from the Driver's "arrived"
//    tap, so tapping through 33h early and waiting out the window charged a
//    Business the full fare before the trip;
//  · PostgREST returns `numeric` as a STRING, so a fee and a waiting charge
//    summed raw would concatenate instead of adding.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  NO_SHOW_ON_SITE_FLOOR_MIN,
  businessCancelPct,
  cancelCompensation,
  guestDueAt,
  isAirportPickup,
  noShowAvailableAt,
  noShowWaitMinutes,
  waitingAt,
  waitingCeilingMinutes,
} from "@/lib/cancellation";
import { cancelled, completed, mission } from "@/test/support/factories";

const at = (iso: string) => new Date(iso);

describe("isAirportPickup", () => {
  test("a flight number settles it, whatever the address says", () => {
    assert.equal(isAirportPickup(mission({ flight_number: "AF1234" })), true);
  });

  test("an ordinary city address is not an airport", () => {
    assert.equal(isAirportPickup(mission()), false);
  });

  test("the accented POI name matches — the S42 bug", () => {
    // The exact string Mapbox stores for the main airport, in pickup_LABEL: an
    // airport booked from autocomplete has no keyword in pickup_address at all.
    const m = mission({
      pickup_address: "Route de Grenoble, 06200 Nice",
      pickup_label: "Aéroport Nice Côte d'Azur",
    });
    assert.equal(isAirportPickup(m), true);
  });

  test("matches whatever the accent, case or Unicode normalisation", () => {
    const forms = [
      "Aéroport Nice Côte d'Azur", // NFC
      "Aéroport Nice Côte d'Azur", // NFD — a combining acute
      "aeroport nice",
      "AÉROPORT DE CANNES",
      "Nice Airport Terminal 2",
      "Aeroporto di Genova",
    ];
    for (const label of forms) {
      assert.equal(isAirportPickup(mission({ pickup_label: label })), true, label);
    }
  });

  test("the keyword counts in the address too, not only the label", () => {
    assert.equal(
      isAirportPickup(mission({ pickup_address: "Aéroport Nice Côte d'Azur, Terminal 1" })),
      true,
    );
  });

  test("a missing label is not a match", () => {
    assert.equal(isAirportPickup(mission({ pickup_label: null, dropoff_label: null })), false);
  });

  test("the DROP-OFF airport does not extend the pickup's courtesy wait", () => {
    const m = mission({ dropoff_address: "Aéroport Nice Côte d'Azur" });
    assert.equal(isAirportPickup(m), false);
  });
});

describe("the courtesy wait and its ceiling", () => {
  test("60 minutes at an airport, 20 in the city", () => {
    assert.equal(noShowWaitMinutes(true), 60);
    assert.equal(noShowWaitMinutes(false), 20);
  });

  test("the meter stops at 120 / 60 minutes from the Guest's due moment", () => {
    assert.equal(waitingCeilingMinutes(true), 120);
    assert.equal(waitingCeilingMinutes(false), 60);
  });
});

describe("waitingAt — €1 per minute STARTED, capped", () => {
  // Pickup 12:00, city → courtesy wait to 12:20, meter stops at 13:00.
  const city = mission({ pickup_at: "2026-07-10T12:00:00.000Z" });

  test("nothing is owed inside the courtesy wait", () => {
    assert.equal(waitingAt(city, at("2026-07-10T11:00:00Z")).fee, 0);
    assert.equal(waitingAt(city, at("2026-07-10T12:00:00Z")).fee, 0);
    assert.equal(waitingAt(city, at("2026-07-10T12:19:59Z")).fee, 0);
  });

  test("the boundary itself is free — the 20th minute is the last free one", () => {
    const w = waitingAt(city, at("2026-07-10T12:20:00Z"));
    assert.equal(w.minutes, 0);
    assert.equal(w.fee, 0);
  });

  test("one second past it owes a whole minute — 'per minute STARTED'", () => {
    const w = waitingAt(city, at("2026-07-10T12:20:01Z"));
    assert.equal(w.minutes, 1);
    assert.equal(w.fee, 1);
  });

  test("it accrues a euro a minute", () => {
    assert.equal(waitingAt(city, at("2026-07-10T12:50:00Z")).minutes, 30);
    assert.equal(waitingAt(city, at("2026-07-10T12:50:00Z")).fee, 30);
  });

  test("a city trip stops paying at €40, however long the Driver stays", () => {
    const capped = waitingAt(city, at("2026-07-10T13:00:00Z"));
    assert.equal(capped.minutes, 40);
    assert.equal(capped.fee, 40);
    assert.equal(capped.capped, true);
    assert.equal(capped.maxFee, 40);

    // Two hours later the meter has not moved.
    const later = waitingAt(city, at("2026-07-10T15:00:00Z"));
    assert.equal(later.fee, 40);
    assert.equal(later.capped, true);
  });

  test("an airport trip waits an hour free, then stops paying at €60", () => {
    const airport = mission({
      pickup_at: "2026-07-10T12:00:00.000Z",
      pickup_label: "Aéroport Nice Côte d'Azur",
    });
    assert.equal(waitingAt(airport, at("2026-07-10T12:59:59Z")).fee, 0);
    assert.equal(waitingAt(airport, at("2026-07-10T13:30:00Z")).fee, 30);

    const capped = waitingAt(airport, at("2026-07-10T14:00:00Z"));
    assert.equal(capped.fee, 60);
    assert.equal(capped.maxFee, 60);
    assert.equal(capped.capped, true);

    // The €20 gap between the two ceilings is the whole point of the S42 fix:
    // an accented airport misread as a city capped €20 short.
    assert.equal(capped.maxFee - waitingAt(city, at("2026-07-10T13:00:00Z")).maxFee, 20);
  });

  test("the meter's window is reported, not just the money", () => {
    const w = waitingAt(city, at("2026-07-10T12:30:00Z"));
    assert.equal(w.from.toISOString(), "2026-07-10T12:20:00.000Z");
    assert.equal(w.until.toISOString(), "2026-07-10T13:00:00.000Z");
    assert.equal(w.capped, false);
  });

  test("a late Guest moves the whole meter — guest_ready_at wins over pickup_at", () => {
    const late = mission({
      pickup_at: "2026-07-10T12:00:00.000Z",
      guest_ready_at: "2026-07-10T13:00:00.000Z",
    });
    // At 12:50 the booked time is long past, but the Guest is not due yet.
    assert.equal(waitingAt(late, at("2026-07-10T12:50:00Z")).fee, 0);
    assert.equal(waitingAt(late, at("2026-07-10T13:30:00Z")).fee, 10);
  });

  test("accepts an epoch number as readily as a Date", () => {
    const asDate = waitingAt(city, at("2026-07-10T12:50:00Z"));
    const asMs = waitingAt(city, Date.parse("2026-07-10T12:50:00Z"));
    assert.deepEqual(asMs, asDate);
  });
});

describe("guestDueAt", () => {
  test("the ordered pickup time by default", () => {
    assert.equal(guestDueAt(mission()).toISOString(), "2026-07-10T12:00:00.000Z");
  });

  test("the tracked instant once flight tracking sets one", () => {
    const m = mission({ guest_ready_at: "2026-07-10T13:15:00.000Z" });
    assert.equal(guestDueAt(m).toISOString(), "2026-07-10T13:15:00.000Z");
  });
});

describe("noShowAvailableAt — when a Driver may file", () => {
  const city = mission({ pickup_at: "2026-07-10T12:00:00.000Z" });

  test("an on-time Driver files when the courtesy wait lapses", () => {
    const when = noShowAvailableAt(city, "2026-07-10T11:55:00.000Z");
    assert.equal(when.toISOString(), "2026-07-10T12:20:00.000Z");
  });

  test("a Driver who turns up late must still be on site for the floor", () => {
    const when = noShowAvailableAt(city, "2026-07-10T12:30:00.000Z");
    assert.equal(when.toISOString(), "2026-07-10T12:35:00.000Z");
    assert.equal(NO_SHOW_ON_SITE_FLOOR_MIN, 5);
  });

  test("arriving 33 hours early buys nothing — the S41 exploit", () => {
    // `advanceStatus` has no time guard, so a Driver could tap through to
    // `arrived` a day and a half ahead. Anchored to the tap, the window would
    // have closed at 03:05 the previous day and a full fare could be charged
    // before the trip. Anchored to the GUEST, it does not open until 12:20.
    const when = noShowAvailableAt(city, "2026-07-09T03:00:00.000Z");
    assert.equal(when.toISOString(), "2026-07-10T12:20:00.000Z");
  });

  test("an airport gives the Guest the full hour", () => {
    const airport = mission({
      pickup_at: "2026-07-10T12:00:00.000Z",
      pickup_label: "Aéroport Nice Côte d'Azur",
    });
    assert.equal(
      noShowAvailableAt(airport, "2026-07-10T11:55:00.000Z").toISOString(),
      "2026-07-10T13:00:00.000Z",
    );
  });
});

describe("businessCancelPct — the D45 ramp", () => {
  test("free while nobody holds it, however close to pickup", () => {
    assert.equal(businessCancelPct(10, false), 0);
    assert.equal(businessCancelPct(0.5, false), 0);
    assert.equal(businessCancelPct(-1, false), 0);
  });

  test("free more than five hours out", () => {
    assert.equal(businessCancelPct(24, true), 0);
    assert.equal(businessCancelPct(5.01, true), 0);
  });

  test("50% the moment the five-hour line is crossed", () => {
    assert.equal(businessCancelPct(5, true), 50);
  });

  test("+10% an hour — 5% per half hour", () => {
    assert.equal(businessCancelPct(4.5, true), 55);
    assert.equal(businessCancelPct(4, true), 60);
    assert.equal(businessCancelPct(2, true), 80);
    assert.equal(businessCancelPct(1, true), 90);
  });

  test("100% at the pickup time, and after it", () => {
    assert.equal(businessCancelPct(0, true), 100);
    assert.equal(businessCancelPct(-0.5, true), 100);
    assert.equal(businessCancelPct(-48, true), 100);
  });

  test("never leaves 0–100", () => {
    for (let h = -12; h <= 12; h += 0.25) {
      const pct = businessCancelPct(h, true);
      assert.ok(pct >= 0 && pct <= 100, `${h}h → ${pct}`);
    }
  });
});

describe("cancelCompensation — what the Driver is owed", () => {
  test("nothing on a trip that did not end cancelled", () => {
    assert.equal(cancelCompensation(completed()), null);
  });

  test("nothing on a legacy row with no fee stamped", () => {
    assert.equal(cancelCompensation(cancelled({ cancellation_fee: null })), null);
  });

  test("a struck fee of zero is a real answer, not a missing one", () => {
    assert.equal(cancelCompensation(cancelled({ cancellation_fee: 0 })), 0);
  });

  test("the policy fee plus any waiting already run", () => {
    assert.equal(
      cancelCompensation(cancelled({ cancellation_fee: 42, waiting_fee: 13 })),
      55,
    );
  });

  test("adds PostgREST's numeric strings instead of concatenating them", () => {
    // `numeric` arrives over the wire as text. "50" + "10" is "5010".
    const m = cancelled({
      cancellation_fee: "50" as unknown as number,
      waiting_fee: "10" as unknown as number,
    });
    assert.equal(cancelCompensation(m), 60);
  });
});
