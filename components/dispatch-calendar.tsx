"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, X, Plus, ArrowRight } from "lucide-react";
import { type Tone, TONE_BG, TONE_COLOR } from "@/lib/dispatch-status";
import { formatMoney } from "@/lib/format";
import { LiveRefresh } from "@/components/live-refresh";

// Fire a handler on Enter/Space so role="button" divs behave like buttons.
// Ignores events bubbling up from nested real <button>s (chips, "+", "+N more")
// — otherwise Enter on a chip would run the cell's action instead of the chip's.
function onActivate(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}

export interface CalEntry {
  id: string;
  day: number;
  time: string; // "08:30" (Paris)
  guest: string; // "—" when unnamed (e.g. a luggage run)
  driver: string | null;
  cat: string; // display label, e.g. "Business · Van"
  catKey: string; // raw category enum: eco | business | van | luxury
  body: string | null; // raw body enum: sedan | van | null
  tone: Tone;
  label: string;
  fare: number;
  ceiling: number;
  from: string;
  to: string;
  stops: string[];
  flight: string | null; // "AF1234 · 14:35"
  ref: string | null;
  luggageOnly: boolean;
  bags: number | null;
  pax: number | null;
}

export interface CalendarData {
  ym: string;
  title: string;
  daysInMonth: number;
  firstDow: number; // 0 = Monday
  todayDate: number | null;
  todayKey: string; // 'YYYY-MM-DD' in Paris
  isCurrentMonth: boolean;
  prevYm: string;
  nextYm: string;
  currentYm: string;
  todayWeekIdx: number;
  landWeek: "first" | "last" | null; // when arriving via cross-month week nav
  initialView: "month" | "week";
  initialWeek: number | null; // restored from ?wk= on reload
  entries: CalEntry[];
}

const DOW = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

// Week time grid geometry: 48px per hour, uniform cards anchored at pickup time
// (a trip is a pickup moment — card height does NOT encode duration, per the
// founder's call on the approved mockup).
const PX_PER_MIN = 0.8;
const CARD_H = 42;
const CARD_GAP = 2;

const pad = (d: number) => String(d).padStart(2, "0");
const shortPlace = (addr: string) => (addr.split(",")[0] || addr).trim();
// Month chips show time + guest; a trip with no Guest name (e.g. a luggage run)
// falls back to the drop-off place — no special labelling in the overview.
const chipText = (e: CalEntry) => (e.guest === "—" ? shortPlace(e.to) : e.guest);

const parisHM = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const frDayLong = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const frDayShort = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function timeToMin(t: string): number {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

function TonePill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className="status-pill"
      style={{ background: TONE_BG[tone], color: TONE_COLOR[tone] }}
    >
      <span className="dot" style={{ background: TONE_COLOR[tone] }} />
      {label}
    </span>
  );
}

const LEGEND: { tone: Tone; label: string }[] = [
  { tone: "neutral", label: "In the Pool / Completed" },
  { tone: "info", label: "Confirmed / Accepted" },
  { tone: "success", label: "In progress" },
  { tone: "warn", label: "Unfilled — pickup < 3 h" },
  { tone: "danger", label: "Needs action / Cancelled" },
];

type Peek = { day: number; focus: string | null };

// Where a fresh server payload says the week view should sit: cross-month
// week hops (landWeek) win, then a ?wk= restored from the URL, then today.
function resolveWeek(data: CalendarData): number {
  const numWeeks = Math.ceil((data.firstDow + data.daysInMonth) / 7);
  return data.landWeek === "last"
    ? numWeeks - 1
    : data.landWeek === "first"
      ? 0
      : data.initialWeek != null
        ? Math.min(Math.max(0, data.initialWeek), numWeeks - 1)
        : data.isCurrentMonth
          ? data.todayWeekIdx
          : 0;
}

export function DispatchCalendar({ data }: { data: CalendarData }) {
  const { ym, firstDow, daysInMonth, todayDate, todayKey } = data;
  const [year, mon] = ym.split("-").map(Number);
  const numWeeks = Math.ceil((firstDow + daysInMonth) / 7);

  const router = useRouter();
  const [navPending, startNav] = useTransition();
  const [view, setView] = useState<"month" | "week">(data.initialView);
  const [weekIdx, setWeekIdx] = useState(() => resolveWeek(data));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [cat, setCat] = useState("all");
  const [peek, setPeek] = useState<Peek | null>(null);

  const wi = Math.min(Math.max(0, weekIdx), numWeeks - 1);

  // A server navigation landed (month change, cross-month week hop, browser
  // Back/Forward): resync view + week from the fresh payload BEFORE paint, so the
  // navigated-to URL — not stale client state — wins. Local view/week changes only
  // replaceState (no server navigation), so they never re-trigger this.
  useLayoutEffect(() => {
    setView(data.initialView);
    setWeekIdx(resolveWeek(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.ym, data.landWeek]);

  // Keep the view + week in the URL (replace, no navigation) so a reload or a
  // shared link lands where you were instead of dumping back to month view.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    p.set("month", ym);
    p.delete("week");
    if (view === "week") {
      p.set("view", "week");
      p.set("wk", String(wi));
    } else {
      p.delete("view");
      p.delete("wk");
    }
    const url = `${window.location.pathname}?${p.toString()}`;
    if (url !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", url);
    }
  }, [view, wi, ym]);

  const match = (e: CalEntry) => {
    const ql = q.toLowerCase();
    return (
      (!q ||
        e.guest.toLowerCase().includes(ql) ||
        !!e.driver?.toLowerCase().includes(ql)) &&
      (status === "all" ||
        (status === "needs"
          ? e.tone === "warn" || e.tone === "danger"
          : e.tone === status)) &&
      (cat === "all" ||
        (cat === "van" ? e.body === "van" || e.catKey === "van" : e.catKey === cat))
    );
  };

  // Month totals for the KPI chips — always the whole month, unaffected by the
  // search/filters, so "14 assigned" keeps meaning 14 this month.
  let mTotal = 0,
    mAssigned = 0,
    mNeeds = 0;
  for (const e of data.entries) {
    mTotal++;
    if (e.tone === "info") mAssigned++;
    if (e.tone === "warn" || e.tone === "danger") mNeeds++;
  }

  // Group filtered entries by day for the grid + panel.
  const byDay = new Map<number, CalEntry[]>();
  for (const e of data.entries) {
    if (!match(e)) continue;
    (byDay.get(e.day) ?? byDay.set(e.day, []).get(e.day)!).push(e);
  }

  const dayKeyOf = (day: number) => `${ym}-${pad(day)}`;
  const isPastDay = (day: number) => dayKeyOf(day) < todayKey;

  // Month/week server navigations run in a transition so the grid can show a
  // busy state — a route-level loading.tsx never fires for same-segment
  // searchParam navigations, so this is the only visible feedback.
  const goMonth = (m: string) =>
    startNav(() =>
      router.push(`/dispatch/calendar?month=${m}${view === "week" ? "&view=week" : ""}`),
    );
  const addMission = (day: number) => router.push(`/dispatch/new?date=${dayKeyOf(day)}`);

  const onPrev = () => {
    if (view === "week") {
      if (wi > 0) setWeekIdx(wi - 1);
      else startNav(() => router.push(`/dispatch/calendar?month=${data.prevYm}&week=last`));
    } else {
      goMonth(data.prevYm);
    }
  };
  const onNext = () => {
    if (view === "week") {
      if (wi < numWeeks - 1) setWeekIdx(wi + 1);
      else startNav(() => router.push(`/dispatch/calendar?month=${data.nextYm}&week=first`));
    } else {
      goMonth(data.nextYm);
    }
  };
  const onToday = () => {
    setWeekIdx(data.todayWeekIdx);
    if (ym !== data.currentYm) goMonth(data.currentYm);
  };

  const monthCells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (monthCells.length % 7 !== 0) monthCells.push(null);

  // The 7 real dates of the visible week (UTC noon — day-level only). Days that
  // fall outside the loaded month render as muted columns (their trips live in
  // the adjacent month's page, one arrow away).
  const weekDates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = wi * 7 - firstDow + 1 + i;
        return { day: d, date: new Date(Date.UTC(year, mon - 1, d, 12)) };
      }),
    [wi, firstDow, year, mon],
  );

  const weekTitle = `${frDayShort.format(weekDates[0].date)} – ${frDayShort.format(
    weekDates[6].date,
  )} ${weekDates[6].date.getUTCFullYear()}`;

  const peekEntries = peek != null ? byDay.get(peek.day) ?? [] : [];

  return (
    <>
      <LiveRefresh intervalMs={8000} />

      <div className="dx-calhead">
        <h1
          className="dx-calhead__title"
          style={{ margin: 0, textTransform: view === "week" ? "none" : "capitalize" }}
        >
          {view === "week" ? weekTitle : data.title}
        </h1>
        <div className="dx-calnav">
          <div className="dx-seg">
            <button
              className={`dx-seg__btn${view === "month" ? " is-on" : ""}`}
              aria-pressed={view === "month"}
              onClick={() => setView("month")}
            >
              Month
            </button>
            <button
              className={`dx-seg__btn${view === "week" ? " is-on" : ""}`}
              aria-pressed={view === "week"}
              onClick={() => setView("week")}
            >
              Week
            </button>
          </div>
          <button className="dx-toggle" aria-label="Previous" onClick={onPrev}>
            <ChevronLeft />
          </button>
          <button className="btn secondary" style={{ width: "auto", padding: "8px 14px", fontSize: 14 }} onClick={onToday}>
            Today
          </button>
          <button className="dx-toggle" aria-label="Next" onClick={onNext}>
            <ChevronRight />
          </button>
        </div>
      </div>

      {/* KPI filters (month totals) + search + dropdowns */}
      <div className="dx-controls">
        <button
          className={`dx-kpi${status === "all" ? " is-on" : ""}`}
          aria-pressed={status === "all"}
          onClick={() => setStatus("all")}
          title="Show all trips this month"
        >
          <span className="dx-kpi__n">{mTotal}</span>
          <span className="dx-kpi__l">Trips</span>
        </button>
        <button
          className={`dx-kpi dx-kpi--info${status === "info" ? " is-on" : ""}`}
          aria-pressed={status === "info"}
          onClick={() => setStatus(status === "info" ? "all" : "info")}
          title="Trips a Driver has accepted or confirmed"
        >
          <span className="dx-kpi__n">{mAssigned}</span>
          <span className="dx-kpi__l">Assigned</span>
        </button>
        <button
          className={`dx-kpi dx-kpi--warn${status === "needs" ? " is-on" : ""}`}
          aria-pressed={status === "needs"}
          onClick={() => setStatus(status === "needs" ? "all" : "needs")}
          title="Filter to trips that need action"
        >
          <span className="dx-kpi__n">{mNeeds}</span>
          <span className="dx-kpi__l">Need action</span>
        </button>

        <div className="dx-controls__filters">
          <div className="dx-search">
            <Search />
            <input
              aria-label="Search by guest or driver name"
              placeholder="Search guest or driver…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button className="dx-search__clear" onClick={() => setQ("")} aria-label="Clear search">
                <X />
              </button>
            )}
          </div>
          <select
            className="dx-filter"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="neutral">Pooled</option>
            <option value="info">Confirmed</option>
            <option value="success">In progress</option>
            <option value="needs">Needs action</option>
          </select>
          <select
            className="dx-filter"
            aria-label="Filter by vehicle"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="all">All vehicles</option>
            <option value="eco">Eco</option>
            <option value="business">Business</option>
            <option value="luxury">First</option>
            <option value="van">Van</option>
          </select>
        </div>
      </div>

      <div className="dx-legend" aria-hidden>
        {LEGEND.map((l) => (
          <span key={l.tone}>
            <i style={{ background: TONE_COLOR[l.tone] }} />
            {l.label}
          </span>
        ))}
      </div>

      {view === "month" ? (
        <div className={`dx-calwrap${navPending ? " dx-calwrap--busy" : ""}`}>
          <div className="dx-calgrid">
            {DOW.map((d, i) => (
              <div className={`dx-dow${i > 4 ? " dx-dow--we" : ""}`} key={d}>
                {d}
              </div>
            ))}
            {monthCells.map((day, i) => {
              if (!day) return <div className="dx-cell dx-cell--muted" key={`b${i}`} />;
              const isWeekend = (firstDow + day - 1) % 7 > 4;
              return (
                <MonthCell
                  key={day}
                  day={day}
                  entries={byDay.get(day) ?? []}
                  isToday={todayDate === day}
                  isWeekend={isWeekend}
                  isPast={isPastDay(day)}
                  onPick={setPeek}
                  onAdd={addMission}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <WeekGrid
          weekDates={weekDates}
          mon={mon}
          byDay={byDay}
          todayKey={todayKey}
          ymKeyOf={dayKeyOf}
          busy={navPending}
          onPick={setPeek}
          onAdd={addMission}
        />
      )}

      {peek != null && (
        <DayPeek
          day={peek.day}
          focus={peek.focus}
          date={new Date(Date.UTC(year, mon - 1, peek.day, 12))}
          entries={peekEntries}
          onClose={() => setPeek(null)}
          openTripInSchedule={(id) => {
            setPeek(null);
            router.push(`/dispatch?open=${id}`);
          }}
          openDayInSchedule={() => {
            setPeek(null);
            router.push(`/dispatch?day=${dayKeyOf(peek.day)}`);
          }}
          addMission={(d) => {
            setPeek(null);
            addMission(d);
          }}
        />
      )}
    </>
  );
}

function CellHead({
  day,
  count,
  isToday,
  onAdd,
}: {
  day: number;
  count: number;
  isToday: boolean;
  onAdd: (d: number) => void;
}) {
  return (
    <>
      <span className={`dx-celldate${isToday ? " dx-celldate--today" : ""}`}>{day}</span>
      <span className="dx-cellhead__right">
        {count > 0 && <span className="dx-cellcount">{count}</span>}
        <button
          className="dx-celladd"
          title="New mission this day"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(day);
          }}
        >
          <Plus />
        </button>
      </span>
    </>
  );
}

// Month cells show readable chips (time + guest, status rail on the left) — as
// many as comfortably fit, then a "+N more" that opens the day panel. Past days
// are dimmed so the future carries the visual weight.
const MONTH_CAP = 5;

function MonthCell({
  day,
  entries,
  isToday,
  isWeekend,
  isPast,
  onPick,
  onAdd,
}: {
  day: number;
  entries: CalEntry[];
  isToday: boolean;
  isWeekend: boolean;
  isPast: boolean;
  onPick: (p: Peek) => void;
  onAdd: (d: number) => void;
}) {
  const shown = entries.length > MONTH_CAP ? entries.slice(0, MONTH_CAP - 1) : entries;
  const act = () => (entries.length ? onPick({ day, focus: null }) : onAdd(day));
  const label = `${day} — ${entries.length} trip${entries.length === 1 ? "" : "s"}`;
  return (
    <div
      className={`dx-cell${isToday ? " dx-cell--today" : ""}${isWeekend ? " dx-cell--we" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={act}
      onKeyDown={onActivate(act)}
    >
      <div className="dx-cellhead">
        <CellHead day={day} count={entries.length} isToday={isToday} onAdd={onAdd} />
      </div>
      <div className="dx-entries">
        {shown.map((e) => (
          <button
            className={`dx-entry${isPast ? " dx-entry--past" : ""}`}
            key={e.id}
            style={{ "--etone": TONE_COLOR[e.tone] } as React.CSSProperties}
            title={`${e.time} · ${chipText(e)} · ${e.label}`}
            onClick={(ev) => {
              ev.stopPropagation();
              onPick({ day, focus: e.id });
            }}
          >
            <span className="dx-entry__time mono">{e.time}</span>
            <span className="dx-entry__to">{chipText(e)}</span>
          </button>
        ))}
        {entries.length > shown.length && (
          <button
            className="dx-more"
            onClick={(ev) => {
              ev.stopPropagation();
              onPick({ day, focus: null });
            }}
          >
            +{entries.length - shown.length} more
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Week view: a vertical time grid. Uniform cards anchored at pickup time;
// overlapping pickups split side by side; a navy "now" line runs through today.
interface WeekDay {
  day: number;
  date: Date;
}

// maxTop clamps a card into the grid BEFORE lane assignment, so two late trips
// that collide only after clamping still split side by side instead of stacking.
function layoutDay(entries: CalEntry[], startMin: number, maxTop: number) {
  const sorted = [...entries].sort((a, b) => (a.time < b.time ? -1 : 1));
  type P = { e: CalEntry; top: number; lane: number; lanes: number };
  const placed: P[] = [];
  let cluster: P[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const lanes = Math.max(...cluster.map((p) => p.lane)) + 1;
    for (const p of cluster) p.lanes = lanes;
    cluster = [];
  };
  for (const e of sorted) {
    const top = Math.min((timeToMin(e.time) - startMin) * PX_PER_MIN, maxTop);
    if (cluster.length && top >= clusterEnd) flush();
    const laneEnds: number[] = [];
    for (const p of cluster) {
      laneEnds[p.lane] = Math.max(laneEnds[p.lane] ?? 0, p.top + CARD_H + CARD_GAP);
    }
    let lane = 0;
    while ((laneEnds[lane] ?? 0) > top) lane++;
    const p = { e, top, lane, lanes: 1 };
    cluster.push(p);
    placed.push(p);
    clusterEnd = cluster.length === 1 ? top + CARD_H + CARD_GAP : Math.max(clusterEnd, top + CARD_H + CARD_GAP);
  }
  if (cluster.length) flush();
  return placed;
}

function WeekGrid({
  weekDates,
  mon,
  byDay,
  todayKey,
  ymKeyOf,
  busy,
  onPick,
  onAdd,
}: {
  weekDates: WeekDay[];
  mon: number;
  byDay: Map<number, CalEntry[]>;
  todayKey: string;
  ymKeyOf: (day: number) => string;
  busy: boolean;
  onPick: (p: Peek) => void;
  onAdd: (d: number) => void;
}) {
  const inMonth = (w: WeekDay) => w.date.getUTCMonth() === mon - 1;

  // Hour range: 06:00–22:00 baseline, stretched to fit any earlier/later pickup —
  // including the full height of the LAST card (a card spans ~53 min below its
  // anchor), so late-evening trips sit at their true slot instead of clamping up.
  let startH = 6;
  let endH = 22;
  let lastMin = -1;
  for (const w of weekDates) {
    if (!inMonth(w)) continue;
    for (const e of byDay.get(w.day) ?? []) {
      const mm = timeToMin(e.time);
      const h = Math.floor(mm / 60);
      if (h < startH) startH = h;
      if (h + 1 > endH) endH = Math.min(24, h + 1);
      if (mm > lastMin) lastMin = mm;
    }
  }
  if (lastMin >= 0) {
    const fitH = Math.ceil((lastMin + (CARD_H + CARD_GAP) / PX_PER_MIN) / 60);
    endH = Math.max(endH, Math.min(24, fitH));
  }
  const startMin = startH * 60;
  const gridH = (endH - startH) * 60 * PX_PER_MIN;
  // Only a pickup within ~53 min of midnight can still hit this clamp.
  const maxTop = gridH - CARD_H - CARD_GAP;

  // "Now" line on today's column (Paris time). Client-only: `new Date()` differs
  // between the server render and hydration, so it would mismatch — render it
  // after mount (and re-tick every minute; LiveRefresh's 8s refresh also nudges it).
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNowMin(timeToMin(parisHM.format(new Date())));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  const nowTop = nowMin != null ? (nowMin - startMin) * PX_PER_MIN : 0;

  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);

  return (
    <div className={`dx-calwrap${busy ? " dx-calwrap--busy" : ""}`}>
      <div className="dx-tg">
        <div className="dx-tg__head">
          <div />
          {weekDates.map((w, i) => {
            const isToday = inMonth(w) && ymKeyOf(w.day) === todayKey;
            const count = inMonth(w) ? (byDay.get(w.day) ?? []).length : 0;
            const act = () =>
              inMonth(w) && (count ? onPick({ day: w.day, focus: null }) : onAdd(w.day));
            return (
              <div
                key={i}
                className={`dx-tg__dayhead${inMonth(w) ? "" : " dx-tg__dayhead--muted"}${isToday ? " dx-tg__dayhead--today" : ""}`}
                role={inMonth(w) ? "button" : undefined}
                tabIndex={inMonth(w) ? 0 : undefined}
                aria-label={inMonth(w) ? `${DOW[i]} ${w.date.getUTCDate()} — ${count} trip${count === 1 ? "" : "s"}` : undefined}
                onClick={act}
                onKeyDown={inMonth(w) ? onActivate(() => act()) : undefined}
              >
                <span className="dx-tg__dow">{DOW[i]}</span>
                <span className="dx-tg__num">{w.date.getUTCDate()}</span>
              </div>
            );
          })}
        </div>
        <div className="dx-tg__body">
          <div className="dx-tg__gutter" style={{ height: gridH }}>
            {hours.map((h) => (
              <span className="dx-tg__hour" key={h} style={{ top: (h - startH) * 60 * PX_PER_MIN }}>
                {pad(h)}:00
              </span>
            ))}
          </div>
          {weekDates.map((w, i) => {
            if (!inMonth(w)) {
              return <div className="dx-tg__col dx-tg__col--muted" key={i} style={{ height: gridH }} />;
            }
            const isToday = ymKeyOf(w.day) === todayKey;
            const isPast = ymKeyOf(w.day) < todayKey;
            const isWeekend = i > 4;
            const placed = layoutDay(byDay.get(w.day) ?? [], startMin, maxTop);
            return (
              <div
                className={`dx-tg__col${isToday ? " dx-tg__col--today" : ""}${isWeekend ? " dx-tg__col--we" : ""}`}
                key={i}
                style={{ height: gridH }}
              >
                {placed.map(({ e, top, lane, lanes }) => (
                  <button
                    key={e.id}
                    className={`dx-tgcard${isPast ? " dx-tgcard--past" : ""}`}
                    style={
                      {
                        top,
                        left: `calc(${(100 / lanes) * lane}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                        "--etone": TONE_COLOR[e.tone],
                        "--ebg": TONE_BG[e.tone],
                      } as React.CSSProperties
                    }
                    title={`${e.time} · ${chipText(e)} · ${e.label}`}
                    onClick={() => onPick({ day: w.day, focus: e.id })}
                  >
                    <span className="dx-tgcard__top">
                      <span className="dx-tgcard__time mono">{e.time}</span>
                      <span className="dx-tgcard__guest">{chipText(e)}</span>
                    </span>
                    <span className="dx-tgcard__route">
                      {shortPlace(e.from)} → {shortPlace(e.to)}
                    </span>
                  </button>
                ))}
                {isToday && nowMin != null && nowMin >= startMin && nowMin <= endH * 60 && (
                  <div className="dx-tg__now" style={{ top: nowTop }} aria-hidden>
                    <span />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- Day panel: mini Schedule-style rows; clicking a trip anywhere on the
// calendar opens the panel with that trip expanded.
function DayPeek({
  day,
  focus,
  date,
  entries,
  onClose,
  openTripInSchedule,
  openDayInSchedule,
  addMission,
}: {
  day: number;
  focus: string | null;
  date: Date;
  entries: CalEntry[];
  onClose: () => void;
  openTripInSchedule: (id: string) => void;
  openDayInSchedule: () => void;
  addMission: (d: number) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(focus);
  const asideRef = useRef<HTMLElement>(null);

  // Modal behaviour: Escape to close, Tab kept inside the panel (aria-modal
  // promises the background is inert — so trap focus to match), lock background
  // scroll, restore focus on close. Mirrors components/avatar-editor.tsx. Scrolls
  // the focused trip into view when opened from a specific chip/card.
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const el = focus
      ? document.getElementById(`dx-pk-${focus}`)
      : document.getElementById("dx-peek-close");
    (el as HTMLElement | null)?.focus?.();
    if (focus) el?.scrollIntoView({ block: "center" });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !asideRef.current) return;
      const f = asideRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      const active = document.activeElement;
      if (!asideRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="dx-scrim" onClick={onClose} />
      <aside ref={asideRef} className="dx-drawer" role="dialog" aria-modal="true" aria-labelledby="dx-peek-title">
        <div className="dx-drawer__head">
          <div>
            <h2 id="dx-peek-title" style={{ margin: 0, fontSize: 19, textTransform: "capitalize" }}>
              {frDayLong.format(date)}
            </h2>
            <div className="muted small" style={{ marginTop: 2 }}>
              {entries.length} trip{entries.length === 1 ? "" : "s"}
            </div>
          </div>
          <button id="dx-peek-close" className="dx-toggle" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="dx-drawer__body">
          {entries.length === 0 && <p className="muted small">No trips this day.</p>}
          {entries.map((e) => {
            const open = openId === e.id;
            return (
              <div
                className={`dx-pkrow${open ? " dx-pkrow--open" : ""}`}
                key={e.id}
                style={{ "--etone": TONE_COLOR[e.tone] } as React.CSSProperties}
              >
                <button
                  id={`dx-pk-${e.id}`}
                  className="dx-pkrow__sum"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : e.id)}
                >
                  <span className="mono dx-pkrow__time">{e.time}</span>
                  <span className="dx-pkrow__mid">
                    <span className="dx-pkrow__guest">
                      {e.luggageOnly ? <span className="muted">Luggage</span> : chipText(e)}
                    </span>
                    <span className="dx-pkrow__leg">
                      <i className="dx-pkrow__dot dx-pkrow__dot--pk" />
                      {e.from}
                    </span>
                    {e.stops.map((s, i) => (
                      <span className="dx-pkrow__leg dx-pkrow__leg--via" key={i}>
                        <i className="dx-pkrow__dot dx-pkrow__dot--via" />
                        {s}
                      </span>
                    ))}
                    <span className="dx-pkrow__leg">
                      <i className="dx-pkrow__dot dx-pkrow__dot--dp" />
                      {e.to}
                    </span>
                  </span>
                  <TonePill tone={e.tone} label={e.label} />
                </button>
                {open && (
                  <div className="dx-pkrow__detail">
                    <div className="dx-pkrow__meta">
                      <span className="badge">{e.cat}</span>
                      {e.flight && <span className="dx-flight">{e.flight}</span>}
                      {e.ref && <span className="ref">{e.ref}</span>}
                    </div>
                    <dl className="kv" style={{ margin: "10px 0 0" }}>
                      <dt>Fare (now)</dt>
                      <dd>
                        {formatMoney(e.fare)} · ceiling {formatMoney(e.ceiling)}
                      </dd>
                      <dt>Driver</dt>
                      <dd>{e.driver ?? <span className="muted">Unassigned</span>}</dd>
                      <dt>Pax / luggage</dt>
                      <dd>
                        {e.luggageOnly
                          ? `No passengers · ${e.bags ?? 0} bags`
                          : `${e.pax ?? "—"} pax · ${e.bags ?? "—"} bags`}
                      </dd>
                    </dl>
                    <button className="dx-pkrow__link" onClick={() => openTripInSchedule(e.id)}>
                      Open in Schedule <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="dx-drawer__foot">
          <button className="btn" onClick={() => addMission(day)}>
            <Plus size={18} /> New mission · {frDayShort.format(date)}
          </button>
          {entries.length > 0 && (
            <button className="dx-pkrow__link" style={{ marginTop: 10 }} onClick={openDayInSchedule}>
              Open day in Schedule <ArrowRight size={14} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
