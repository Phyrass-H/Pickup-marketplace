import {
  Ban,
  CalendarOff,
  Clock,
  Info,
  Route,
  TrendingDown,
  TrendingUp,
  Undo2,
  UserX,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDriverContext } from "@/lib/driver";
import {
  isPeriod,
  parseAnchor,
  periodRange,
  totalsFor,
  missionAmount,
  dayKey,
  todayAnchor,
  type Period,
  type Totals,
} from "@/lib/earnings";
import { formatMoney, formatTime, shortPlaceLabel, formatDayGroup } from "@/lib/format";
import { EarningsPeriod } from "@/components/earnings-period";
import type { MissionRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const MONEY_STATUSES = ["completed", "cancelled"] as const;

// Every read here is scoped to the signed-in Driver by RLS; the explicit driver_id
// filters say so at the call site too.
async function loadPeriod(driverId: string, from: Date, to: Date) {
  const supabase = await createClient();
  const [{ data: missions }, { data: cancels }] = await Promise.all([
    supabase
      .from("mission")
      .select("*")
      .eq("driver_id", driverId)
      .in("status", MONEY_STATUSES)
      .gte("pickup_at", from.toISOString())
      .lt("pickup_at", to.toISOString())
      .order("pickup_at", { ascending: false }),
    // A Driver's own cancellation re-pools the mission and clears driver_id, so the
    // penalty only survives here — dated by when they cancelled, not by the pickup.
    supabase
      .from("mission_cancellation")
      .select("created_at, fee_amount")
      .eq("actor_driver_id", driverId)
      .eq("kind", "driver_cancel")
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString()),
  ]);
  const rows = (missions ?? []) as MissionRow[];
  return { missions: rows, totals: totalsFor(rows, cancels ?? []) };
}

function Line({
  icon,
  label,
  value,
  negative = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <div className={`ebreak${negative ? " ebreak--neg" : ""}`}>
      <span className="ebreak__l">
        {icon}
        {label}
      </span>
      <b>
        {negative && "−"}
        {formatMoney(value)}
      </b>
    </div>
  );
}

function Breakdown({ t }: { t: Totals }) {
  const hours = Math.floor(t.waitingMinutes / 60);
  const mins = t.waitingMinutes % 60;
  const waitLabel = hours > 0 ? `Waiting time · ${hours} h ${mins}` : `Waiting time · ${mins} min`;

  return (
    <div className="dcard">
      <p className="dcard__label">What it’s made of</p>
      <Line
        icon={<Route size={16} strokeWidth={1.75} aria-hidden="true" />}
        label={`Trips · ${t.tripCount}`}
        value={t.trips}
      />
      {t.waiting > 0 && (
        <Line
          icon={<Clock size={16} strokeWidth={1.75} aria-hidden="true" />}
          label={waitLabel}
          value={t.waiting}
        />
      )}
      {t.noShowCount > 0 && (
        <Line
          icon={<UserX size={16} strokeWidth={1.75} aria-hidden="true" />}
          label={`No-show · ${t.noShowCount}`}
          value={t.noShow}
        />
      )}
      {t.cancelledOnYouCount > 0 && (
        <Line
          icon={<Ban size={16} strokeWidth={1.75} aria-hidden="true" />}
          label={`Cancelled on you · ${t.cancelledOnYouCount}`}
          value={t.cancelledOnYou}
        />
      )}
      {t.penaltyCount > 0 && (
        <Line
          icon={<Undo2 size={16} strokeWidth={1.75} aria-hidden="true" />}
          label={`You cancelled · ${t.penaltyCount}`}
          value={t.penalties}
          negative
        />
      )}
    </div>
  );
}

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; d?: string }>;
}) {
  const { driver } = await getDriverContext();
  if (!driver) return null;

  const { p, d } = await searchParams;
  const period: Period = isPeriod(p) ? p : "week";
  const anchor = parseAnchor(d);
  const range = periodRange(period, anchor);

  // This period, the one before it, and the same one a year ago — the year-ago read
  // costs one query and stays silent until there's actually a year of history.
  const prevRange = periodRange(period, parseAnchor(range.prev));
  const lastYearRange = periodRange(period, parseAnchor(range.lastYear));

  const [now, before, yearAgo] = await Promise.all([
    loadPeriod(driver.id, range.from, range.to),
    loadPeriod(driver.id, prevRange.from, prevRange.to),
    loadPeriod(driver.id, lastYearRange.from, lastYearRange.to),
  ]);

  const t = now.totals;
  const delta = t.total - before.totals.total;
  const pad = (n: number) => String(n).padStart(2, "0");
  const anchorIso = `${anchor.y}-${pad(anchor.m)}-${pad(anchor.d)}`;
  const today = todayAnchor();
  const todayIso = `${today.y}-${pad(today.m)}-${pad(today.d)}`;

  const periodNoun = period;
  // "this week" only while you're in it; stepping back reads "that week".
  const dem = range.isCurrent ? "this" : "that";
  const rideCount = t.tripCount + t.noShowCount;
  const worked = new Set(now.missions.map((m) => dayKey(m.pickup_at))).size;

  // Trip list, newest first, grouped into Paris days.
  const groups: { key: string; missions: MissionRow[] }[] = [];
  for (const m of now.missions) {
    const key = dayKey(m.pickup_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.missions.push(m);
    else groups.push({ key, missions: [m] });
  }

  return (
    <>
      <h1 className="dset__h1">Earnings</h1>
      <p className="dset__sub">What you’ve earned, whenever you want to look.</p>

      <EarningsPeriod
        period={period}
        anchor={anchorIso}
        label={range.label}
        prev={range.prev}
        next={range.next}
        isCurrent={range.isCurrent}
      />

      <div className="dcard">
        <div className="etotal">{formatMoney(t.total)}</div>
        <div className="etotal__sub">
          {rideCount === 0
            ? `No trips ${dem} ${periodNoun}`
            : `${rideCount} trip${rideCount > 1 ? "s" : ""}` +
              (period !== "day" && worked > 1 ? ` · ${worked} days worked` : "")}
        </div>

        {(t.total !== 0 || before.totals.total !== 0) && (
          <span className={`ecmp ecmp--${delta > 0 ? "up" : delta < 0 ? "down" : "flat"}`}>
            {delta > 0 ? (
              <TrendingUp size={13} strokeWidth={2} aria-hidden="true" />
            ) : delta < 0 ? (
              <TrendingDown size={13} strokeWidth={2} aria-hidden="true" />
            ) : null}
            {delta === 0
              ? `Same as the ${periodNoun} before`
              : `${delta > 0 ? "+" : "−"}${formatMoney(Math.abs(delta))} on the ${periodNoun} before`}
          </span>
        )}

        {/* Silent until there IS a year of history — a permanent "no data" line is
            worse than no line at all. */}
        {yearAgo.totals.total > 0 && (
          <span className="eyear">
            Same {periodNoun} last year: {formatMoney(yearAgo.totals.total)}
          </span>
        )}
      </div>

      {t.total !== 0 && <Breakdown t={t} />}

      {now.missions.length === 0 ? (
        <div className="dcard">
          <div className="pempty" style={{ padding: "30px 16px 26px" }}>
            <div className="pempty__ic">
              <CalendarOff size={26} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="pempty__t">
              Nothing {dem} {periodNoun}
            </p>
            <p className="pempty__s">
              Trips show up here the moment you complete them. Use the arrows to look at
              another {periodNoun}.
            </p>
          </div>
        </div>
      ) : (
        <div className="dcard">
          <p className="dcard__label">Trip by trip</p>
          {groups.map((g) => {
            const dayTotal = g.missions.reduce((sum, m) => sum + missionAmount(m), 0);
            const { label, today: isToday } = formatDayGroup(g.missions[0].pickup_at);
            return (
              <div key={g.key}>
                <div className="eday">
                  <b>{isToday ? `Today · ${label}` : label}</b>
                  <span>{formatMoney(dayTotal)}</span>
                </div>
                {g.missions.map((m) => (
                  <div className="etrip" key={m.id}>
                    <span className="etrip__t">
                      <b>
                        {shortPlaceLabel(m.pickup_address)} →{" "}
                        {shortPlaceLabel(m.dropoff_address) || "—"}
                      </b>
                      <span>
                        {formatTime(m.pickup_at)}
                        {m.no_show && " · no-show"}
                        {m.status === "cancelled" && " · cancelled on you"}
                        {!!m.waiting_minutes && ` · ${m.waiting_minutes} min wait`}
                      </span>
                    </span>
                    <span className="etrip__a">{formatMoney(missionAmount(m))}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="dlock dlock--foot" style={{ marginTop: 0 }}>
        <Info size={15} strokeWidth={1.9} aria-hidden="true" />
        <span>
          Every trip you completed, at the fare you accepted. During the beta we settle
          with you directly.
        </span>
      </div>

      {anchorIso !== todayIso && (
        <p className="ejump">
          <a href={`/earnings?p=${period}&d=${todayIso}`}>Back to now</a>
        </p>
      )}
    </>
  );
}
