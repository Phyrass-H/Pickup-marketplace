import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/app-context";
import { formatMonth } from "@/lib/format";
import { isExpired, parisDayKey } from "@/lib/dispatch-status";
import { TripRow, type DriverContact } from "@/components/trip-row";
import type { MissionRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

/**
 * The outcomes a Business actually asks about. Mirrors the Driver's Past tab
 * ([[d56]]) and adds "Unfilled" — the § P ending, which only exists on this side
 * (a trip nobody accepted never belonged to a Driver, so it can't be in theirs).
 *
 * A **no-show ends as `completed` + `no_show`** — `mark_no_show` charges the
 * Business in full and pays the Driver like a completed trip, so it belongs
 * under Completed, not Cancelled. Same call the Driver's archive makes.
 *
 * ⚑ These buckets deliberately do NOT cover everything. A past trip still sitting
 * `confirmed`/`on_board` — a Driver took it and never closed it — has no ending in
 * the model yet, so it appears under All and nowhere else. That is why the chip
 * counts don't sum to All, and it stays visible on purpose until the founder
 * rules on what an abandoned trip costs.
 */
const FILTERS = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "unfilled", label: "Unfilled" },
  { key: "cancelled", label: "Cancelled" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

function bucketOf(m: MissionRow): Filter | null {
  if (isExpired(m)) return "unfilled";
  if (m.status === "completed") return "completed";
  if (m.status === "cancelled") return "cancelled";
  return null;
}

function ColumnHead() {
  return (
    <div className="dx-colhead">
      <span>Time</span>
      <span>Route</span>
      <span>Flight</span>
      <span>Guest</span>
      <span>Ref</span>
      <span>Driver</span>
      <span>Status</span>
    </div>
  );
}

export default async function DispatchHistory({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx.business) return null;

  const { filter } = await searchParams;
  const active: Filter =
    FILTERS.find((f) => f.key === filter)?.key ?? "all";

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data: all, error } = await supabase
    .from("mission")
    .select("*")
    .eq("business_id", ctx.business.id)
    .neq("status", "draft")
    .lt("pickup_at", nowIso)
    .order("pickup_at", { ascending: false });

  // Count every bucket from the full set, then narrow — so each chip shows its
  // real total whichever one is selected (a count that changed with the filter
  // would be useless: you'd have to click a bucket to find out if it's empty).
  const counts: Record<Filter, number> = { all: 0, completed: 0, unfilled: 0, cancelled: 0 };
  for (const m of all ?? []) {
    counts.all += 1;
    const b = bucketOf(m);
    if (b) counts[b] += 1;
  }
  const missions = active === "all" ? all : (all ?? []).filter((m) => bucketOf(m) === active);

  // Reveal assigned Driver contacts + car (service role, gated to this business).
  const contacts = new Map<string, DriverContact>();
  const assigned = (missions ?? []).filter((m) => m.driver_id);
  if (assigned.length > 0) {
    const admin = createAdminClient();
    const driverIds = [...new Set(assigned.map((m) => m.driver_id!))];
    const [{ data: drivers }, { data: vehicles }] = await Promise.all([
      admin.from("driver").select("id, first_name, last_name, phone").in("id", driverIds),
      admin.from("vehicle").select("driver_id, make, model, colour, plate").in("driver_id", driverIds),
    ]);
    const byId = new Map((drivers ?? []).map((d) => [d.id, d]));
    const vehByDriver = new Map((vehicles ?? []).map((v) => [v.driver_id, v]));
    for (const m of assigned) {
      const d = byId.get(m.driver_id!);
      if (d)
        contacts.set(m.id, {
          name: `${d.first_name} ${d.last_name}`,
          phone: d.phone,
          vehicle: vehByDriver.get(d.id) ?? null,
        });
    }
  }

  // Group by Paris month, newest first.
  const groups = new Map<string, MissionRow[]>();
  for (const m of missions ?? []) {
    const key = parisDayKey(m.pickup_at).slice(0, 7);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(m);
  }

  const isEmpty = !error && (!missions || missions.length === 0);
  const nothingEverHappened = !error && counts.all === 0;

  return (
    <>
      {!nothingEverHappened && !error && (
        <div className="dxh-head">
          <p className="dxh-sum">
            {counts.all} past trip{counts.all === 1 ? "" : "s"}
            {counts.unfilled > 0 && (
              <>
                {" · "}
                <span className="dxh-sum__bad">{counts.unfilled} unfilled</span>
              </>
            )}
          </p>
          <div className="rfilter" role="group" aria-label="Filter past trips by outcome">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === "all" ? "/dispatch/history" : `/dispatch/history?filter=${f.key}`}
                className={f.key === active ? "rchip rchip--on" : "rchip"}
                aria-current={f.key === active ? "true" : undefined}
              >
                {f.label} <span className="rchip__n">{counts[f.key]}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="notice error">Couldn’t load your history: {error.message}</div>
      )}

      {/* Two different emptinesses: a brand-new Business, or a filter that found
          nothing. The second must never read as "you have no history". */}
      {nothingEverHappened && <div className="empty">No past missions yet.</div>}
      {isEmpty && !nothingEverHappened && (
        <div className="empty">
          No {FILTERS.find((f) => f.key === active)!.label.toLowerCase()} trips in your history.
        </div>
      )}

      {[...groups.entries()].map(([monthKey, list]) => {
        const unfilled = list.filter((m) => isExpired(m)).length;
        return (
          <section key={monthKey} className="dx-sched">
            <div className="dx-day">
              <h2>{formatMonth(monthKey)}</h2>
              <span className="dx-count">
                {list.length} trip{list.length === 1 ? "" : "s"}
                {/* Only when it's non-zero — a good month stays quiet. Redundant
                    while the Unfilled filter is active, so it's hidden there. */}
                {active === "all" && unfilled > 0 && (
                  <>
                    {" · "}
                    <span className="dx-count__bad">{unfilled} unfilled</span>
                  </>
                )}
              </span>
            </div>
            <ColumnHead />
            {list.map((m) => (
              <TripRow key={m.id} mission={m} driver={contacts.get(m.id) ?? null} archived />
            ))}
          </section>
        );
      })}
    </>
  );
}
