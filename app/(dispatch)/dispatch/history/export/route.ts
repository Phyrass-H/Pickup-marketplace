import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/app-context";
import { parisDayKey } from "@/lib/dispatch-status";
import { serviceClassLabel } from "@/lib/format";
import { parsePassengers, passengerName } from "@/lib/passengers";
import { parseWaypoints } from "@/lib/waypoints";
import {
  applyHistoryQuery,
  bucketOf,
  historyFare,
  parseHistoryQuery,
  type HistoryRow,
} from "@/lib/history-filter";
import { rowCost } from "@/lib/spend";
import type { MissionRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

/**
 * ⚑ Delimiter is `;`, not `,`. The reader here is a French hotel's accountant on
 * Excel FR, where a comma is the DECIMAL separator and a comma-delimited file
 * lands entirely in column A. Sheets and Numbers both sniff the delimiter, so
 * `;` is the choice that works for all three. Amounts are written French-style
 * (58,17) to match.
 */
const SEP = ";";

function cell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  // Quote when the value could break the row; double any embedded quote. A
  // leading =/+/-/@ is prefixed with a quote so a spreadsheet treats a stray
  // address or reference as text and never as a formula.
  const risky = /^[=+\-@]/.test(s);
  const body = risky ? `'${s}` : s;
  return /["\n\r;]/.test(body) ? `"${body.replace(/"/g, '""')}"` : body;
}

const euro = (n: number | null) => (n == null ? "" : n.toFixed(2).replace(".", ","));

const HEADERS = [
  "Date",
  "Time",
  "Pickup",
  "Stops",
  "Drop-off",
  "Flight",
  "Guest",
  "Reference",
  "Driver",
  "Car",
  "Plate",
  "Class",
  "Outcome",
  "Cost to you (EUR)",
  "Agreed, not settled (EUR)",
  "Of which waiting (EUR)",
  "Note",
];

const OUTCOME_TEXT: Record<string, string> = {
  completed: "Completed",
  unfilled: "Unfilled",
  cancelled: "Cancelled",
};

export async function GET(req: NextRequest) {
  const ctx = await getAppContext();
  if (!ctx.business) return new NextResponse("Not found", { status: 404 });

  const query = parseHistoryQuery(Object.fromEntries(req.nextUrl.searchParams));

  const supabase = await createClient();
  const { data } = await supabase
    .from("mission")
    .select("*")
    .eq("business_id", ctx.business.id)
    .neq("status", "draft")
    .lt("pickup_at", new Date().toISOString())
    .order("pickup_at", { ascending: false });

  const missions: MissionRow[] = data ?? [];

  const driverName = new Map<string, string>();
  const driverId = new Map<string, string>();
  const cars = new Map<string, { make: string | null; model: string | null; colour: string | null; plate: string | null }>();
  const assigned = missions.filter((m) => m.driver_id);
  if (assigned.length > 0) {
    const admin = createAdminClient();
    const ids = [...new Set(assigned.map((m) => m.driver_id!))];
    const [{ data: drivers }, { data: vehicles }] = await Promise.all([
      admin.from("driver").select("id, first_name, last_name").in("id", ids),
      admin.from("vehicle").select("driver_id, make, model, colour, plate").in("driver_id", ids),
    ]);
    const byId = new Map((drivers ?? []).map((d) => [d.id, d]));
    const vehByDriver = new Map((vehicles ?? []).map((v) => [v.driver_id, v]));
    for (const m of assigned) {
      const d = byId.get(m.driver_id!);
      if (!d) continue;
      driverName.set(m.id, `${d.first_name} ${d.last_name}`);
      driverId.set(m.id, d.id);
      const v = vehByDriver.get(d.id);
      if (v) cars.set(m.id, v);
    }
  }

  const rows: HistoryRow[] = missions.map((m) => ({
    mission: m,
    driverId: driverId.get(m.id) ?? null,
    driverName: driverName.get(m.id) ?? null,
    car: cars.get(m.id) ?? null,
    ...historyFare(m),
  }));

  // The SAME function the page runs. "Export CSV" promises exactly what's on
  // screen, and this is the only way that promise survives a future filter.
  const { rows: shown } = applyHistoryQuery(rows, query);

  const lines = [HEADERS.join(SEP)];
  for (const r of shown) {
    const m = r.mission;
    const car = cars.get(m.id);
    const waiting = Number(m.waiting_fee ?? 0);
    const bucket = bucketOf(m);
    const note = m.no_show
      ? "Guest no-show — charged in full"
      : m.status === "cancelled"
        ? m.cancelled_by === "driver"
          ? "Cancelled by the Driver"
          : "Cancelled by you"
        : bucket === null
          ? "Not closed by the Driver"
          : "";

    lines.push(
      [
        parisDayKey(m.pickup_at),
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Paris",
        }).format(new Date(m.pickup_at)),
        m.pickup_address,
        parseWaypoints(m.waypoints)
          .map((w) => w.address)
          .join(" | "),
        m.dropoff_address ?? "",
        m.flight_number ?? "",
        m.luggage_only
          ? "Luggage run"
          : parsePassengers(m.passenger_names).map(passengerName).filter(Boolean).join(" | ") ||
            m.passenger_name ||
            "",
        m.reference ?? "",
        driverName.get(m.id) ?? "",
        car ? [car.colour, car.make, car.model].filter(Boolean).join(" ") : "",
        car?.plate ?? "",
        serviceClassLabel(m.category, m.required_body_type),
        bucket ? OUTCOME_TEXT[bucket] : "Not closed",
        // ⚑ rowCost, not r.fare. The summary bar on /dispatch/history now counts
        // waiting (it is part of a hotel's bill), so a "Fare" column that
        // excluded it made the file disagree with the screen that produced it —
        // while the next column, "Of which waiting", told the reader the waiting
        // was already inside. Same definition on both surfaces now, and the same
        // column name the Spend export uses.
        r.counted && (r.fare != null || waiting > 0) ? euro(rowCost(r)) : "",
        r.counted ? "" : euro(r.fare),
        waiting > 0 ? euro(waiting) : "",
        note,
      ]
        .map(cell)
        .join(SEP),
    );
  }

  const span = query.from || query.to ? `-${query.from ?? "start"}_${query.to ?? "today"}` : "";
  // ﻿: without the BOM, Excel reads the file as Latin-1 and every French
  // address comes out as "AÃ©roport". Sheets and Numbers ignore it.
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kavenue-history${span}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
