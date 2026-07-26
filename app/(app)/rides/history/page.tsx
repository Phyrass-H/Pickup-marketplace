import Link from "next/link";
import { Building2, ChevronRight, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDriverContext } from "@/lib/driver";
import { currentFare } from "@/lib/pdp";
import {
  addressLine,
  formatMoney,
  formatMonth,
  formatTime,
  missionStatusLabel,
} from "@/lib/format";
import { parisDayKey } from "@/lib/dispatch-status";
import type { MissionRow, MissionStatus } from "@/lib/database.types";
import { statusPill } from "@/components/mission-run-view";
import { RidesTabs } from "@/components/rides-tabs";

export const dynamic = "force-dynamic";

// Terminal statuses — the archive of finished work. A no-show ends as
// status='completed' + no_show=true (mark_no_show pays the Driver like a
// completed trip), so it belongs under "Completed", not "Cancelled".
const PAST_STATUSES: MissionStatus[] = ["completed", "cancelled"];
const ACTIVE_STATUSES: MissionStatus[] = [
  "accepted",
  "confirmed",
  "en_route",
  "arrived",
  "on_board",
];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

// Short date for the archive row: "Thu 24 July".
const pastDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

export default async function RideHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { driver } = await getDriverContext();
  if (!driver) return null;

  const { filter } = await searchParams;
  const active: Filter =
    filter === "completed" || filter === "cancelled" ? filter : "all";
  const statuses: MissionStatus[] = active === "all" ? PAST_STATUSES : [active];

  const supabase = await createClient();
  const [{ data: missions, error }, { count: upcomingCount }, { count: pastCount }] =
    await Promise.all([
      supabase
        .from("mission")
        .select("*")
        .eq("driver_id", driver.id)
        .in("status", statuses)
        .order("pickup_at", { ascending: false }),
      supabase
        .from("mission")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", driver.id)
        .in("status", ACTIVE_STATUSES),
      // The tab count is the WHOLE archive, never the filtered slice.
      supabase
        .from("mission")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", driver.id)
        .in("status", PAST_STATUSES),
    ]);

  // Reveal the Business name per mission (service role, gated to these missions).
  // Guest names/phones are deliberately NOT read here — they leave the Driver's
  // app when a trip closes (the Business keeps the full record).
  const bizNames = new Map<string, string>();
  if (missions && missions.length > 0) {
    const admin = createAdminClient();
    const ids = [...new Set(missions.map((m) => m.business_id))];
    const { data: businesses } = await admin
      .from("business")
      .select("id, name")
      .in("id", ids);
    for (const b of businesses ?? []) bizNames.set(b.id, b.name);
  }

  // Group by Paris month, preserving the newest-first order.
  const groups: { key: string; items: MissionRow[] }[] = [];
  for (const m of missions ?? []) {
    const key = parisDayKey(m.pickup_at).slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(m);
    else groups.push({ key, items: [m] });
  }

  const isEmpty = !error && groups.length === 0;

  return (
    <>
      <h1 className="rhead">My Rides</h1>
      <RidesTabs active="past" upcoming={upcomingCount ?? 0} past={pastCount ?? 0} />

      {(pastCount ?? 0) > 0 && (
        <div className="rfilter" role="group" aria-label="Filter past rides">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/rides/history" : `/rides/history?filter=${f.key}`}
              className={f.key === active ? "rchip rchip--on" : "rchip"}
              aria-current={f.key === active ? "true" : undefined}
            >
              {f.label}
            </Link>
          ))}
        </div>
      )}

      {error && (
        <div className="notice error" style={{ marginTop: 14 }}>
          Couldn’t load your history: {error.message}
        </div>
      )}

      {isEmpty && (
        <div className="pempty">
          <span className="pempty__ic">
            <History size={26} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p className="pempty__t">
            {active === "all" ? "No finished trips yet" : `No ${active} trips`}
          </p>
          <p className="pempty__s">
            {active === "all"
              ? "A trip moves here once it’s completed or cancelled. Guest details are removed when it does."
              : "Nothing in your archive matches this filter."}
          </p>
        </div>
      )}

      {groups.map((g, gi) => (
        <section key={g.key}>
          <div className={gi === 0 ? "dday dday--first" : "dday"}>
            <h2 className="dday__l">{formatMonth(g.key)}</h2>
            <span className="dday__n">
              {g.items.length} ride{g.items.length === 1 ? "" : "s"}
            </span>
          </div>

          {g.items.map((m) => {
            const { tone, Icon: PillIcon } = statusPill(m);
            // A cancelled trip's payout depends on WHO cancelled and how late
            // (O7/D45: a Business cancel pays the Driver a %, a Driver cancel
            // pays nothing), and that settles manually in beta — so show no
            // number rather than a wrong one. Earnings owns the money truth.
            const cancelled = m.status === "cancelled";

            return (
              <Link href={`/missions/${m.id}`} className="pastcard" key={m.id}>
                <div className="pastcard__head">
                  <span className="pastcard__when">
                    {pastDate.format(new Date(m.pickup_at))}
                    <span className="pastcard__time">{formatTime(m.pickup_at)}</span>
                  </span>
                  <span className={`dpill dpill--sm dpill--${tone}`}>
                    <PillIcon size={12} strokeWidth={1.75} aria-hidden="true" />
                    {m.no_show ? "No-show" : missionStatusLabel(m.status)}
                  </span>
                </div>

                <div className="pastcard__route">
                  <span className="pastcard__rail">
                    <span className="pastcard__line" />
                    <span className="pastcard__dot pastcard__dot--from" />
                    <span className="pastcard__dot pastcard__dot--to" />
                  </span>
                  <span className="pastcard__addrs">
                    <span className="pastcard__addr">{addressLine(m.pickup_address)}</span>
                    <span className="pastcard__addr">
                      {addressLine(m.dropoff_address ?? "—")}
                    </span>
                  </span>
                  <ChevronRight className="pastcard__chev" size={16} aria-hidden="true" />
                </div>

                <div className="pastcard__foot">
                  <span className="pastcard__biz">
                    <Building2 size={13} aria-hidden="true" />
                    {bizNames.get(m.business_id) ?? "—"}
                  </span>
                  <span
                    className={cancelled ? "pastcard__fare pastcard__fare--none" : "pastcard__fare"}
                  >
                    {cancelled ? "—" : formatMoney(currentFare(m))}
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      ))}
    </>
  );
}
