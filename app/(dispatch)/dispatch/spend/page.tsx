import Link from "next/link";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/app-context";
import { categoryLabel, formatMoney, formatMonth } from "@/lib/format";
import { parisDayKey } from "@/lib/dispatch-status";
import { TripRow, type DriverContact } from "@/components/trip-row";
import { SpendFilters } from "@/components/spend-filters";
import { SpendChart } from "@/components/spend-chart";
import { ScrollToTrip } from "@/components/scroll-to-trip";
import {
  applyHistoryQuery,
  historyFare,
  type HistoryRow,
} from "@/lib/history-filter";
import {
  autoBucket,
  breakdown,
  DIMS,
  DIM_LABEL,
  rowCost,
  series,
  spendTotals,
  wasteLines,
  avoidable,
  type SpendTotals,
} from "@/lib/spend";
import {
  comparisonSpan,
  currentSpan,
  LENS_LABEL,
  parseSpendQuery,
  queryForSpan,
  spendHref,
  type Lens,
  type SpendQuery,
} from "@/lib/spend-filter";
import type { MissionRow, VehicleCategory } from "@/lib/database.types";

export const dynamic = "force-dynamic";

/**
 * /dispatch/spend — what the hotel paid, what changed, and what was avoidable.
 *
 * Not the Driver's Earnings screen with a hotel's numbers in it. Same maths
 * (settledFare, historyFare), opposite question: the Driver asks *what did I
 * make*, the Business asks *where did the money go and what do I do about it*.
 *
 * ⚑ Two kinds of click, and the distinction is load-bearing:
 *   · a DIMENSION click (chart column, breakdown row) sets a global filter — the
 *     whole page recomputes and the URL changes.
 *   · a COMPONENT click (Waiting, No-shows, …) sets ?lens=, which narrows ONLY
 *     the trip list. It must not touch the charts: a "cancellations" lens that
 *     repainted the spend chart would make the headline total disagree with the
 *     bars underneath it.
 *
 * ⚑ Volume: this loads the whole past archive in one query and filters in
 * memory, exactly as /dispatch/history does — which is what lets the comparison
 * period, the chip counts and the class list all be honest without a second
 * round trip. Correct at 28 trips; the first thing to revisit at 5 000.
 */

// One quiet strip of facts about SERVICE, kept apart from the money above it.
// "Guests moved" is deliberately absent: passenger_names is optional and
// pax_count is often blank, so a headcount we can only half-observe would be
// worse than none (founder, 2026-08-07).
function ServiceStrip({ t }: { t: SpendTotals }) {
  const took =
    t.medianToAccept == null
      ? null
      : t.medianToAccept < 90
        ? `${Math.round(t.medianToAccept)} min`
        : t.medianToAccept < 60 * 48
          ? `${(t.medianToAccept / 60).toFixed(1)} h`
          : `${Math.round(t.medianToAccept / 1440)} days`;

  return (
    <div className="dxs-serv">
      <span className="dxs-serv__t">What you got</span>

      <span className="dxs-sv">
        Requests covered{" "}
        {t.fillRate == null ? (
          <b className="dxs-sv__none">—</b>
        ) : (
          <b>{t.fillRate.toFixed(1).replace(".", ",")} %</b>
        )}
        <i>
          {t.ordered > 0 ? `${t.filledCount} of ${t.ordered}` : "nothing ordered yet"}
        </i>
      </span>

      {/* ⚑ Sits next to Requests covered on purpose. Time-to-accept only counts
          trips that FILLED, so alone it flatters — the ones nobody took never
          contribute. Together the two are honest. */}
      <span className="dxs-sv">
        Typically taken in {took ? <b>{took}</b> : <b className="dxs-sv__none">—</b>}
        <i>{took ? "median" : "too few trips to say"}</i>
      </span>

      <span className="dxs-sv">
        Arrived on time <b className="dxs-sv__none">—</b>
        <i>needs check-in data</i>
      </span>
    </div>
  );
}

/**
 * ⚑ A delta against a ZERO baseline is not a trend, it's a first month — so it
 * stays neutral. Colouring "+265,00 €" red because May happens to be empty reads
 * as an alarm about nothing, which is exactly the kind of number a hotel learns
 * to ignore. Green/red only once there is something real to compare against.
 */
function Delta({ now, was }: { now: number; was: number }) {
  if (was === 0 && now === 0) return <span className="dxs-d">—</span>;
  if (was === 0) return <span className="dxs-d">no comparison</span>;
  const diff = now - was;
  // Spending MORE is the bad direction for a Business — inverted against the
  // Driver's Earnings screen, where the same arrow means the opposite thing.
  const tone = diff === 0 ? "" : diff < 0 ? " up" : " down";
  return (
    <span className={`dxs-d${tone}`}>
      {diff > 0 ? "+" : diff < 0 ? "−" : ""}
      {formatMoney(Math.abs(diff))}
      {` · ${diff >= 0 ? "+" : "−"}${Math.abs((diff / was) * 100).toFixed(0)} %`}
    </span>
  );
}

export default async function DispatchSpend({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAppContext();
  if (!ctx.business) return null;

  const sp = await searchParams;
  const query: SpendQuery = parseSpendQuery(sp);
  const openId = typeof sp.open === "string" ? sp.open : undefined;

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: all, error }, { data: desks }] = await Promise.all([
    supabase
      .from("mission")
      .select("*")
      .eq("business_id", ctx.business.id)
      .neq("status", "draft")
      .lt("pickup_at", nowIso)
      .order("pickup_at", { ascending: false }),
    supabase.from("dispatcher").select("id, name").eq("business_id", ctx.business.id),
  ]);

  const missions: MissionRow[] = all ?? [];
  const deskName = new Map((desks ?? []).map((d) => [d.id, d.name]));

  // Driver + car for EVERY past trip, not just the ones on screen — the search
  // matches a Driver's name and a plate, and the breakdown ranks by Driver.
  const contacts = new Map<string, DriverContact>();
  const driverIdOf = new Map<string, string>();
  const assigned = missions.filter((m) => m.driver_id);
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
      if (!d) continue;
      contacts.set(m.id, {
        name: `${d.first_name} ${d.last_name}`,
        phone: d.phone,
        vehicle: vehByDriver.get(d.id) ?? null,
      });
      driverIdOf.set(m.id, d.id);
    }
  }

  const rows: HistoryRow[] = missions.map((m) => {
    const c = contacts.get(m.id) ?? null;
    return {
      mission: m,
      driverId: driverIdOf.get(m.id) ?? null,
      driverName: c?.name ?? null,
      car: c?.vehicle ?? null,
      ...historyFare(m),
    };
  });

  // ---- the two spans -------------------------------------------------------
  const span = currentSpan(query);
  const back = comparisonSpan(query);

  const { rows: shown, matches } = applyHistoryQuery(rows, query);
  const prevRows = back ? applyHistoryQuery(rows, queryForSpan(query, back)).rows : [];

  const t = spendTotals(shown);
  const p = spendTotals(prevRows);

  const bucket = autoBucket(span.fromDay, span.toDay);
  const points = series(shown, span.fromDay, span.toDay, bucket);
  const prevPoints = back ? series(prevRows, back.fromDay, back.toDay, bucket) : null;

  const dims = breakdown(shown, query.dim, deskName);
  const dimMax = Math.max(...dims.map((d) => d.amount), 1);

  // ---- the trip list -------------------------------------------------------
  const lensOf: Record<Lens, (r: HistoryRow) => boolean> = {
    waiting: (r) => Number(r.mission.waiting_fee ?? 0) > 0,
    noshow: (r) => r.mission.status === "completed" && r.mission.no_show,
    cancelled: (r) => r.mission.status === "cancelled",
    unsettled: (r) => !r.counted,
  };
  const listed = query.lens ? shown.filter(lensOf[query.lens]) : shown;

  const categories = [...new Set(missions.map((m) => m.category))]
    .map((key) => ({ key: key as VehicleCategory, label: categoryLabel(key) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const oldest = missions.length > 0 ? missions[missions.length - 1] : null;
  const firstDay = oldest ? parisDayKey(oldest.pickup_at) : null;
  const today = parisDayKey(new Date());
  const activeDriverName = query.driverId
    ? ([...contacts.entries()].find(([id]) => driverIdOf.get(id) === query.driverId)?.[1].name ?? null)
    : null;

  // Group the list by Paris month, as History does — but only under a date sort,
  // since a fare sort would produce month bands that aren't chronological.
  const grouped = query.sort === "recent" || query.sort === "oldest";
  const groups = new Map<string, HistoryRow[]>();
  for (const r of listed) {
    const key = grouped ? parisDayKey(r.mission.pickup_at).slice(0, 7) : "";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  const href = (patch: Partial<SpendQuery>) => `/dispatch/spend${spendHref(query, patch)}`;
  const waste = wasteLines(t);
  const avoid = avoidable(t);
  const stamp = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date());

  const components = [
    { key: "fares", label: "Trip fares", n: `${t.fareCount} trip${t.fareCount === 1 ? "" : "s"}`, v: t.fares, was: p.fares, lens: null },
    { key: "waiting", label: "Waiting charges", n: t.waitingCount > 0 ? `${t.waitingCount} trip${t.waitingCount === 1 ? "" : "s"} · ${Math.round(t.waitingMinutes)} min` : "none", v: t.waiting, was: p.waiting, lens: "waiting" as Lens },
    { key: "cancelled", label: "Cancellation fees", n: t.cancelCount > 0 ? `${t.cancelCount} cancellation${t.cancelCount === 1 ? "" : "s"}` : "none", v: t.cancelFees, was: p.cancelFees, lens: "cancelled" as Lens },
    { key: "noshow", label: "No-shows", n: t.noShowCount > 0 ? `${t.noShowCount} no-show${t.noShowCount === 1 ? "" : "s"}` : "none", v: t.noShow, was: p.noShow, lens: "noshow" as Lens },
  ];

  return (
    <>
      <div className="dxs-head">
        <div>
          <h1 className="dset__h1">Spend</h1>
          <p className="dset__sub">
            {span.label}
            {back ? ` · compared with ${back.label}` : " · no comparison"} · Europe/Paris
          </p>
        </div>
        {/* Not decoration: fares are computed on read, so the hotel must never
            wonder whether the number in front of them is stale. */}
        <span className="dxs-fresh">as of {stamp} (Paris)</span>
      </div>

      <SpendFilters
        query={query}
        view={{ label: span.label, isCurrent: isCurrentSpan(span), fromDay: span.fromDay, toDay: span.toDay }}
        categories={categories}
        today={today}
        firstDay={firstDay}
        driverName={activeDriverName}
      />

      {error && <div className="notice error">Couldn’t load your spend: {error.message}</div>}

      {/* ---- hero: one total in charge, two stats that qualify it ---------- */}
      <div className="dcard dxs-hero">
        <div className="dxs-hero__main">
          <p className="dcard__label">Total spend</p>
          <div className="etotal">{formatMoney(t.total)}</div>
          <div className="etotal__sub">
            {t.trips} trip{t.trips === 1 ? "" : "s"} · {t.ordered} mission
            {t.ordered === 1 ? "" : "s"} ordered
          </div>
          {back && (
            /* Neutral whenever there is nothing to compare against — an empty
               previous period is not a 100 % rise, and painting it red would
               alarm a hotel about its own first month. */
            <span
              className={`ecmp ${
                p.total === 0
                  ? "ecmp--flat"
                  : t.total > p.total
                    ? "ecmp--down"
                    : t.total < p.total
                      ? "ecmp--up"
                      : "ecmp--flat"
              }`}
            >
              {p.total === 0 || t.total === p.total ? (
                <Minus size={13} aria-hidden="true" />
              ) : t.total > p.total ? (
                <TrendingUp size={13} aria-hidden="true" />
              ) : (
                <TrendingDown size={13} aria-hidden="true" />
              )}
              {p.total === 0 && t.total === 0
                ? `Nothing spent in ${back.label} either`
                : p.total === 0
                  ? `Nothing to compare — ${back.label} has no trips`
                  : `${t.total >= p.total ? "+" : "−"}${formatMoney(Math.abs(t.total - p.total))} · ${
                      t.total >= p.total ? "+" : "−"
                    }${Math.abs(((t.total - p.total) / p.total) * 100).toFixed(1).replace(".", ",")} % vs ${back.label}`}
            </span>
          )}
        </div>

        <div className="dxs-hero__stats">
          <div className="dxs-stat">
            <div className="dxs-stat__l">Trips</div>
            <div className="dxs-stat__n">{t.trips}</div>
            <div className="dxs-stat__d">
              {back ? (p.trips === 0 ? "no previous period" : `${t.trips >= p.trips ? "+" : "−"}${Math.abs(t.trips - p.trips)} vs ${back.label}`) : "comparison off"}
            </div>
          </div>
          <div className="dxs-stat">
            <div className="dxs-stat__l">Cost per trip</div>
            <div className="dxs-stat__n">
              {t.costPerTrip == null ? "—" : formatMoney(t.costPerTrip)}
            </div>
            <div className="dxs-stat__d">
              {t.trips === 0
                ? "no trips settled"
                : t.trips < 5
                  ? `a mean of ${t.trips}`
                  : back && p.costPerTrip
                    ? `was ${formatMoney(p.costPerTrip)}`
                    : "fare + waiting"}
            </div>
          </div>
        </div>
      </div>

      <ServiceStrip t={t} />

      {/* ---- the one chart ------------------------------------------------- */}
      <div className="dcard">
        <div className="dcard__label dcard__label--split">
          <span>Spend over time</span>
          {back && (
            <span className="dxs-legend">
              <i className="dxs-sw dxs-sw--now" aria-hidden="true" />
              {span.label}
              <i className="dxs-sw dxs-sw--prev" aria-hidden="true" />
              {back.label}
            </span>
          )}
        </div>
        {t.ordered === 0 ? (
          <p className="dxs-none">No missions in this period.</p>
        ) : (
          <SpendChart
            points={points}
            compare={prevPoints}
            compareLabel={back?.label ?? null}
            periodLabel={span.label}
            hrefFor={
              bucket === "day"
                ? (pt) => href({ period: "day", anchor: pt.key, from: null, to: null })
                : bucket === "week"
                  ? (pt) => href({ period: "week", anchor: pt.key, from: null, to: null })
                  : (pt) => href({ period: "month", anchor: pt.key, from: null, to: null })
            }
          />
        )}
        <p className="dxs-foot">
          Each column is one {bucket} of {span.label}, at the fare the Driver accepted
          {back ? "; the grey line behind is the same shape for " + back.label : ""}. Click a column
          to narrow the whole page to it.
        </p>
      </div>

      {/* ---- what it's made of | what cost you money ----------------------- */}
      <div className="dxs-band">
        <div className="dcard">
          <p className="dcard__label">What it’s made of</p>

          {/* ⚑ The comparison is named ONCE, as a column head sitting directly
              over the numbers it governs. It used to be an "vs May 2026" note in
              the card's top-right corner, a long way from the figures — so a
              "+45,00 € · +60 %" three rows down referred to nothing you could
              see, and anyone coming back to the page had no way to recover what
              it meant. */}
          {back && (
            <div className="dxs-comp dxs-comp--head">
              <span />
              <span>Amount</span>
              <span>vs {back.label}</span>
            </div>
          )}

          {components.map((c) => {
            const body = (
              <>
                <span className="dxs-comp__l">
                  {c.label} <span className="dxs-comp__n">{c.n}</span>
                </span>
                <b className={`dxs-comp__v${c.v === 0 ? " dxs-zero" : ""}`}>{formatMoney(c.v)}</b>
                {back && <Delta now={c.v} was={c.was} />}
              </>
            );
            return c.lens && c.v > 0 ? (
              <Link
                key={c.key}
                href={href({ lens: query.lens === c.lens ? null : c.lens })}
                className={`dxs-comp dxs-lens${query.lens === c.lens ? " is-on" : ""}`}
                scroll={false}
              >
                {body}
              </Link>
            ) : (
              <div key={c.key} className="dxs-comp">
                {body}
              </div>
            );
          })}

          {/* Excluded, never hidden. Counting these would inflate a hotel's spend
              with trips that may never have happened. */}
          <div className="dxs-exc">
            <Link
              href={href({ lens: query.lens === "unsettled" ? null : "unsettled" })}
              className={`dxs-comp dxs-lens${query.lens === "unsettled" ? " is-on" : ""}`}
              scroll={false}
            >
              <span className="dxs-comp__l">
                Agreed, not settled{" "}
                <span className="dxs-comp__n">
                  {t.unsettledCount} trip{t.unsettledCount === 1 ? "" : "s"} a Driver hasn’t closed
                </span>
              </span>
              <b className="dxs-comp__v">{formatMoney(t.unsettled)}</b>
              {back && <span className="dxs-d" />}
            </Link>
            <div className="dxs-comp">
              <span className="dxs-comp__l">
                Unfilled{" "}
                <span className="dxs-comp__n">
                  {t.unfilledCount} mission{t.unfilledCount === 1 ? "" : "s"}
                  {t.unfilledCeiling > 0
                    ? ` · ${formatMoney(t.unfilledCeiling)} of Ceiling never spent`
                    : ""}
                </span>
              </span>
              <b className="dxs-comp__v">—</b>
              {back && <span className="dxs-d" />}
            </div>
          </div>
        </div>

        <div className="dcard">
          <p className="dcard__label">What cost you money</p>
          {waste.map((w) => (
            <div key={w.key} className="dxs-w">
              <span className="dxs-w__l">
                {w.label}
                <span className="dxs-w__n">{w.detail}</span>
              </span>
              <span className={`dxs-w__v${!w.amount ? " zero" : ""}`}>
                {w.amount == null ? "no cost" : formatMoney(w.amount)}
              </span>
            </div>
          ))}
          <p className="dxs-foot">
            {avoid > 0
              ? `${formatMoney(avoid)} of this period — ${((avoid / (t.total || 1)) * 100).toFixed(1).replace(".", ",")} % of what you spent. Most of it is timing your desk controls: how late a trip is cancelled, and whether the Guest is ready when the Driver arrives.`
              : "Nothing avoidable cost you money in this period."}
          </p>
        </div>
      </div>

      {/* ---- where the money went ------------------------------------------ */}
      <div className="dcard">
        <div className="dcard__label dcard__label--split">
          <span>Where the money went</span>
          <span className="seg seg--tiny" role="group" aria-label="Break spend down by">
            {DIMS.map((d) => (
              <Link
                key={d}
                href={href({ dim: d })}
                className={`seg-btn${query.dim === d ? " is-on" : ""}`}
                aria-current={query.dim === d ? "true" : undefined}
                scroll={false}
              >
                {DIM_LABEL[d]}
              </Link>
            ))}
          </span>
        </div>

        {dims.length === 0 ? (
          <p className="dxs-none">Nothing to break down in this period.</p>
        ) : (
          <div className="dxs-brk">
            {dims.map((d) => {
              const inner = (
                <>
                  <span className="dxs-r__lab">
                    {d.label}
                    <span className="dxs-bar" style={{ width: `${Math.max(2, (d.amount / dimMax) * 100)}%` }} />
                  </span>
                  <span className="dxs-r__num">
                    {d.trips} trip{d.trips === 1 ? "" : "s"}
                  </span>
                  <span className="dxs-r__eur">{formatMoney(d.amount)}</span>
                  <span className="dxs-r__pc">{d.share.toFixed(1).replace(".", ",")} %</span>
                </>
              );
              // Only the Driver dimension can filter the page — it's the one with
              // a param behind it. The rest are read-only rankings for now.
              return d.driverId && !d.other ? (
                <Link
                  key={d.key}
                  href={href({ driverId: query.driverId === d.driverId ? null : d.driverId })}
                  className={`dxs-r dxs-r--link${query.driverId === d.driverId ? " is-on" : ""}`}
                  scroll={false}
                >
                  {inner}
                </Link>
              ) : (
                <div key={d.key} className={`dxs-r${d.other ? " dxs-r--other" : ""}`}>
                  {inner}
                </div>
              );
            })}
          </div>
        )}

        <p className="dxs-foot">
          {query.dim === "type"
            ? "At disposal will appear here once it can be booked."
            : query.dim === "route"
              ? "Routes are grouped from the addresses as typed — near-duplicates are not merged."
              : query.dim === "driver"
                ? "Top Drivers by spend. Click one to narrow the whole page to them."
                : "Top rows by spend, waiting included."}
        </p>
      </div>

      {/* ---- every trip ----------------------------------------------------- */}
      <div className="dxs-listbar">
        <p className="dxs-listhead">Every trip</p>
        {query.lens && (
          <p className="dxs-lensnote">
            Showing {LENS_LABEL[query.lens]} · {listed.length} trip
            {listed.length === 1 ? "" : "s"}{" "}
            <Link href={href({ lens: null })} scroll={false}>
              Show all
            </Link>
          </p>
        )}
      </div>

      {listed.length === 0 ? (
        <div className="empty">
          {query.lens
            ? `No ${LENS_LABEL[query.lens]} in this period.`
            : "No trips in this period."}
        </div>
      ) : (
        [...groups.entries()].map(([monthKey, list]) => {
          let monthSpend = 0;
          for (const r of list) monthSpend += rowCost(r);
          return (
            <section key={monthKey || "flat"} className="dx-sched">
              {monthKey && (
                <div className="dx-day" id={`day-${monthKey}`}>
                  <h2>{formatMonth(monthKey)}</h2>
                  <span className="dx-count">
                    {list.length} trip{list.length === 1 ? "" : "s"} · {formatMoney(monthSpend)}
                  </span>
                </div>
              )}
              <div className="dx-colhead dx-colhead--arch">
                <span>Date</span>
                <span>Route</span>
                <span>Flight</span>
                <span>Guest</span>
                <span>Ref</span>
                <span>Driver</span>
                <span>Fare</span>
                <span>Outcome</span>
              </div>
              {list.map((r) => (
                <TripRow
                  key={r.mission.id}
                  mission={r.mission}
                  driver={contacts.get(r.mission.id) ?? null}
                  archived
                  fare={r.fare}
                  farePending={!r.counted}
                  query={query.q}
                  matchedOn={matches.get(r.mission.id) ?? null}
                />
              ))}
            </section>
          );
        })
      )}

      <div className="dlock dlock--foot">
        <span>
          Each fare is the price the Driver accepted, frozen at that moment. Nothing here has been
          charged yet — amounts settle manually during beta. Trips a Driver hasn’t closed are shown
          but excluded from every total, and an unfilled mission costs nothing.
        </span>
      </div>

      {openId && <ScrollToTrip missionId={openId} />}
    </>
  );
}

/** Whether the applied span contains today — the › step is then a no-op. */
function isCurrentSpan(span: { fromDay: string; toDay: string }): boolean {
  const today = parisDayKey(new Date());
  return today >= span.fromDay && today <= span.toDay;
}
