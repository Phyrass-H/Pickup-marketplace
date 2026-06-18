"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, X, Plus } from "lucide-react";
import { type Tone, TONE_BG, TONE_COLOR } from "@/lib/dispatch-status";
import { formatMoney } from "@/lib/format";
import { LiveRefresh } from "@/components/live-refresh";

// Fire a handler on Enter/Space so role="button" divs behave like buttons.
function onActivate(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}

export interface CalEntry {
  id: string;
  day: number;
  time: string; // "08:30"
  guest: string;
  driver: string | null;
  cat: string; // "Business"
  tone: Tone;
  label: string;
  fare: number;
  ceiling: number;
  from: string;
  to: string;
}

export interface CalendarData {
  ym: string;
  title: string;
  daysInMonth: number;
  firstDow: number; // 0 = Monday
  todayDate: number | null;
  isCurrentMonth: boolean;
  prevYm: string;
  nextYm: string;
  currentYm: string;
  todayWeekIdx: number;
  landWeek: "first" | "last" | null; // when arriving via cross-month week nav
  entries: CalEntry[];
}

const DOW = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const SECTIONS: { key: string; label: string; test: (t: string) => boolean }[] = [
  { key: "am", label: "Morning", test: (t) => t < "12:00" },
  { key: "pm", label: "Afternoon", test: (t) => t >= "12:00" && t < "18:00" },
  { key: "eve", label: "Evening", test: (t) => t >= "18:00" },
];

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

export function DispatchCalendar({ data }: { data: CalendarData }) {
  const { ym, firstDow, daysInMonth, todayDate } = data;
  const numWeeks = Math.ceil((firstDow + daysInMonth) / 7);
  const initialWeek =
    data.landWeek === "last"
      ? numWeeks - 1
      : data.landWeek === "first"
        ? 0
        : data.isCurrentMonth
          ? data.todayWeekIdx
          : 0;

  const router = useRouter();
  const [view, setView] = useState<"month" | "week">(data.landWeek ? "week" : "month");
  const [weekIdx, setWeekIdx] = useState(initialWeek);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [cat, setCat] = useState("all");
  const [peek, setPeek] = useState<number | null>(null);

  const wi = Math.min(Math.max(0, weekIdx), numWeeks - 1);

  // Cross-month week navigation: the server passes landWeek; once the new month's
  // data arrives, jump to its first/last week in week view.
  useEffect(() => {
    if (data.landWeek === "last") {
      setView("week");
      setWeekIdx(Math.ceil((data.firstDow + data.daysInMonth) / 7) - 1);
    } else if (data.landWeek === "first") {
      setView("week");
      setWeekIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.ym, data.landWeek]);

  const match = (e: CalEntry) =>
    (!q || e.guest.toLowerCase().includes(q.toLowerCase())) &&
    (status === "all" ||
      (status === "needs"
        ? e.tone === "warn" || e.tone === "danger"
        : e.tone === status)) &&
    (cat === "all" || e.cat === cat);

  // Group filtered entries by day; tally the KPI counts off the same set.
  const byDay = new Map<number, CalEntry[]>();
  let total = 0,
    confirmed = 0,
    needs = 0;
  for (const e of data.entries) {
    if (!match(e)) continue;
    (byDay.get(e.day) ?? byDay.set(e.day, []).get(e.day)!).push(e);
    total++;
    if (e.tone === "info") confirmed++; // matches the info-only "Confirmed" filter
    if (e.tone === "warn" || e.tone === "danger") needs++;
  }

  const pad = (d: number) => String(d).padStart(2, "0");
  const goMonth = (m: string) => router.push(`/dispatch/calendar?month=${m}`);
  const addMission = (day: number) => router.push(`/dispatch/new?date=${ym}-${pad(day)}`);
  const openSchedule = () => router.push("/dispatch");

  const onPrev = () => {
    if (view === "week") {
      if (wi > 0) setWeekIdx(wi - 1);
      else router.push(`/dispatch/calendar?month=${data.prevYm}&week=last`);
    } else {
      goMonth(data.prevYm);
    }
  };
  const onNext = () => {
    if (view === "week") {
      if (wi < numWeeks - 1) setWeekIdx(wi + 1);
      else router.push(`/dispatch/calendar?month=${data.nextYm}&week=first`);
    } else {
      goMonth(data.nextYm);
    }
  };
  const onToday = () => {
    setWeekIdx(data.todayWeekIdx);
    if (ym !== data.currentYm) goMonth(data.currentYm);
  };

  // Cells for the active view.
  const monthCells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (monthCells.length % 7 !== 0) monthCells.push(null);
  const weekCells: (number | null)[] = Array.from({ length: 7 }, (_, i) => {
    const d = wi * 7 - firstDow + 1 + i;
    return d >= 1 && d <= daysInMonth ? d : null;
  });
  const cells = view === "week" ? weekCells : monthCells;

  const peekEntries = peek != null ? byDay.get(peek) ?? [] : [];

  return (
    <>
      <LiveRefresh intervalMs={8000} />

      <div className="dx-calhead">
        <h1 className="dx-calhead__title" style={{ margin: 0, textTransform: "capitalize" }}>
          {data.title}
        </h1>
        <div className="dx-calnav">
          <div className="dx-seg">
            <button
              className={`dx-seg__btn${view === "month" ? " is-on" : ""}`}
              onClick={() => setView("month")}
            >
              Month
            </button>
            <button
              className={`dx-seg__btn${view === "week" ? " is-on" : ""}`}
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

      {/* KPI filters + search + dropdowns */}
      <div className="dx-controls">
        <button
          className={`dx-kpi${status === "all" ? " is-on" : ""}`}
          onClick={() => setStatus("all")}
          title="Show all trips"
        >
          <span className="dx-kpi__n">{total}</span>
          <span className="dx-kpi__l">Trips</span>
        </button>
        <button
          className={`dx-kpi dx-kpi--info${status === "info" ? " is-on" : ""}`}
          onClick={() => setStatus(status === "info" ? "all" : "info")}
          title="Filter to confirmed trips"
        >
          <span className="dx-kpi__n">{confirmed}</span>
          <span className="dx-kpi__l">Confirmed</span>
        </button>
        <button
          className={`dx-kpi dx-kpi--warn${status === "needs" ? " is-on" : ""}`}
          onClick={() => setStatus(status === "needs" ? "all" : "needs")}
          title="Filter to trips that need action"
        >
          <span className="dx-kpi__n">{needs}</span>
          <span className="dx-kpi__l">Need action</span>
        </button>

        <div className="dx-controls__filters">
          <div className="dx-search">
            <Search />
            <input
              aria-label="Search by guest name"
              placeholder="Search guest…"
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
            aria-label="Filter by vehicle category"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="all">All vehicles</option>
            <option>Eco</option>
            <option>Business</option>
            <option>Van</option>
            <option>Luxury</option>
          </select>
        </div>
      </div>

      <div className={`dx-calgrid${view === "week" ? " dx-calgrid--week" : ""}`}>
        {DOW.map((d, i) => (
          <div className={`dx-dow${i > 4 ? " dx-dow--we" : ""}`} key={d}>
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div className="dx-cell dx-cell--muted" key={`b${i}`} />;
          const isWeekend = (firstDow + day - 1) % 7 > 4;
          const isToday = todayDate === day;
          const entries = byDay.get(day) ?? [];
          return view === "week" ? (
            <WeekCell
              key={day}
              day={day}
              entries={entries}
              isToday={isToday}
              isWeekend={isWeekend}
              onPick={setPeek}
              onAdd={addMission}
            />
          ) : (
            <MonthCell
              key={day}
              day={day}
              entries={entries}
              isToday={isToday}
              isWeekend={isWeekend}
              onPick={setPeek}
              onAdd={addMission}
            />
          );
        })}
      </div>

      {peek != null && (
        <DayPeek
          day={peek}
          monthLabel={data.title}
          entries={peekEntries}
          onClose={() => setPeek(null)}
          openSchedule={() => {
            setPeek(null);
            openSchedule();
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

function MonthCell({
  day,
  entries,
  isToday,
  isWeekend,
  onPick,
  onAdd,
}: {
  day: number;
  entries: CalEntry[];
  isToday: boolean;
  isWeekend: boolean;
  onPick: (d: number) => void;
  onAdd: (d: number) => void;
}) {
  const shown = entries.slice(0, 3);
  const act = () => (entries.length ? onPick(day) : onAdd(day));
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
          <div
            className="dx-entry"
            key={e.id}
            style={{ "--etone": TONE_COLOR[e.tone], background: TONE_BG[e.tone] } as React.CSSProperties}
            title={`${e.time} · ${e.guest} · ${e.from} → ${e.to}`}
            onClick={(ev) => {
              ev.stopPropagation();
              onPick(day);
            }}
          >
            <span className="dx-entry__time mono">{e.time}</span>
            <span className="dx-entry__to">{e.guest}</span>
          </div>
        ))}
        {entries.length > 3 && (
          <div
            className="dx-more"
            onClick={(ev) => {
              ev.stopPropagation();
              onPick(day);
            }}
          >
            +{entries.length - 3} more
          </div>
        )}
      </div>
    </div>
  );
}

function WeekCell({
  day,
  entries,
  isToday,
  isWeekend,
  onPick,
  onAdd,
}: {
  day: number;
  entries: CalEntry[];
  isToday: boolean;
  isWeekend: boolean;
  onPick: (d: number) => void;
  onAdd: (d: number) => void;
}) {
  return (
    <div
      className={`dx-wcell${isToday ? " dx-wcell--today" : ""}${isWeekend ? " dx-wcell--we" : ""}`}
    >
      <div
        className="dx-wcell__head"
        role="button"
        tabIndex={0}
        aria-label={`${day} — ${entries.length} trip${entries.length === 1 ? "" : "s"}`}
        onClick={() => (entries.length ? onPick(day) : onAdd(day))}
        onKeyDown={onActivate(() => (entries.length ? onPick(day) : onAdd(day)))}
      >
        <CellHead day={day} count={entries.length} isToday={isToday} onAdd={onAdd} />
      </div>
      <div className="dx-wcell__body">
        {entries.length === 0 && <div className="dx-wcell__empty">—</div>}
        {SECTIONS.map((s) => {
          const items = entries.filter((e) => s.test(e.time));
          if (!items.length) return null;
          return (
            <div className="dx-wsection" key={s.key}>
              <div className="dx-wsec">{s.label}</div>
              {items.map((e) => (
                <button
                  className="dx-wk"
                  key={e.id}
                  style={{ "--etone": TONE_COLOR[e.tone], "--ebg": TONE_BG[e.tone] } as React.CSSProperties}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onPick(day);
                  }}
                  title={`${e.time} · ${e.guest} · ${e.from} → ${e.to}`}
                >
                  <div className="dx-wk__top">
                    <span className="dx-wk__time mono">{e.time}</span>
                    <TonePill tone={e.tone} label={e.label} />
                  </div>
                  <div className="dx-wk__guest">{e.guest}</div>
                  <div className="dx-wk__route">
                    <span className="dx-wk__dot" />
                    {e.to}
                  </div>
                  <div className="dx-wk__foot">
                    <span className="badge">{e.cat}</span>
                    <span className="dx-wk__driver">
                      {e.driver ?? <span className="muted">Unassigned</span>}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayPeek({
  day,
  monthLabel,
  entries,
  onClose,
  openSchedule,
  addMission,
}: {
  day: number;
  monthLabel: string;
  entries: CalEntry[];
  onClose: () => void;
  openSchedule: () => void;
  addMission: (d: number) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Modal behaviour: focus in on open, Escape to close, lock background scroll,
  // restore focus to the trigger on close. Mirrors components/avatar-editor.tsx.
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, []);

  return (
    <>
      <div className="dx-scrim" onClick={onClose} />
      <aside className="dx-drawer" role="dialog" aria-modal="true" aria-labelledby="dx-peek-title">
        <div className="dx-drawer__head">
          <div>
            <div
              className="muted small"
              style={{ textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600 }}
            >
              {monthLabel}
            </div>
            <h2 id="dx-peek-title" style={{ margin: "2px 0 0", fontSize: 20 }}>
              {day} · {entries.length} trip{entries.length === 1 ? "" : "s"}
            </h2>
          </div>
          <button ref={closeRef} className="dx-toggle" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="dx-drawer__body">
          {entries.length === 0 && <p className="muted small">No trips this day.</p>}
          {entries.map((e) => (
            <button
              className="dx-peektrip"
              key={e.id}
              onClick={openSchedule}
              style={{ "--etone": TONE_COLOR[e.tone] } as React.CSSProperties}
            >
              <div className="dx-peektrip__top">
                <span className="mono" style={{ fontWeight: 600 }}>
                  {e.time}
                </span>
                <TonePill tone={e.tone} label={e.label} />
              </div>
              <div className="dx-peektrip__guest">{e.guest}</div>
              <div className="route" style={{ marginTop: 8 }}>
                <div className="leg">
                  <span className="dot" />
                  <span>{e.from}</span>
                </div>
                <div className="leg">
                  <span className="dot end" />
                  <span>{e.to}</span>
                </div>
              </div>
              <div className="dx-peektrip__foot">
                <span className="badge">{e.cat}</span>
                <span className="mono small muted">
                  {formatMoney(e.fare)} · ceiling {formatMoney(e.ceiling)}
                </span>
                <span className="dx-peektrip__driver">
                  {e.driver ?? <span className="muted">Unassigned</span>}
                </span>
              </div>
            </button>
          ))}
        </div>
        <div className="dx-drawer__foot">
          <button className="btn" onClick={() => addMission(day)}>
            <Plus size={18} /> New mission on {day} {monthLabel.split(" ")[0]}
          </button>
        </div>
      </aside>
    </>
  );
}
