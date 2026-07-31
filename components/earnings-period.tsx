"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { PERIODS, type Period } from "@/lib/earnings";
import { useDismiss } from "@/lib/use-dismiss";

const LABEL: Record<Period, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
  range: "Range",
};

// The whole filter in one block: the granularity, a step either way, and the label
// itself as a jump. State lives in the URL so reload and Back land on the same view.
//
// ⚑ WHY THIS IS THE APP'S OWN CALENDAR AND NOT <input type="date">.
// The first version rendered a real date input, hid it (opacity 0, 1px, and
// pointer-events: none) and drove it with showPicker(). That failed both ways the
// founder reported: on a phone showPicker() on a non-interactive input does
// nothing at all, and on a desktop the native calendar anchors to an invisible
// 1px box the user can't click away from — so it "wouldn't close". It was also a
// dead end, because <input type="date"> cannot express a RANGE, which is the
// feature that was actually being asked for. So the native control is gone.
//
// The month grid deliberately mirrors components/date-time-picker.tsx (the mission
// form's picker) — same shape, same vocabulary. It is NOT shared code yet: that one
// only allows FUTURE days and picks a single date, this one only allows PAST days
// and also picks a span. Merging them is a fair follow-up; doing it inside a bug
// fix would have meant editing the money-critical mission form.
const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_FMT = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
/**
 * "Jul" — the cells of the Month grid. Sliced to 3, because en-GB's short month
 * gives "Sept" while every other month is three letters, and one wider label in a
 * 3-across grid reads as a mistake.
 */
const MON_FMT = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const monthCell = (y: number, i: number) => MON_FMT.format(Date.UTC(y, i, 1)).slice(0, 3);

const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Monday-first index of the 1st, matching the Paris week the totals use. */
const firstDowMon = (y: number, m: number) => (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
const shiftIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function EarningsPeriod({
  period,
  anchor,
  label,
  prev,
  next,
  isCurrent,
  fromDay,
  toDay,
  firstDay,
  today,
}: {
  period: Period;
  anchor: string;
  label: string;
  prev: string;
  next: string;
  isCurrent: boolean;
  /** Inclusive ends of the period on screen — what the grid bands. */
  fromDay: string;
  toDay: string;
  /** The Driver's earliest mission, for "All time". Null when they have none. */
  firstDay: string | null;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  // Half-picked range: the first tap lands here until a second tap completes it.
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPendingFrom(null);
  }, []);
  const popRef = useDismiss<HTMLDivElement>(open, close);

  const isRange = period === "range";

  function go(p: Period, d: string) {
    startTransition(() => router.push(`/earnings?p=${p}&d=${d}`, { scroll: false }));
  }
  function goRange(from: string, to: string) {
    startTransition(() =>
      router.push(`/earnings?p=range&from=${from}&to=${to}`, { scroll: false }),
    );
  }

  function pickPeriod(p: Period) {
    if (p === "range") {
      // Seed the range with the period already on screen, so switching to Range
      // shows the same numbers rather than resetting to nothing.
      goRange(fromDay, toDay);
      setOpen(true);
      setPendingFrom(null);
    } else {
      go(p, anchor);
    }
  }

  function pickDay(iso: string) {
    if (!isRange) {
      go(period, iso);
      close();
      return;
    }
    if (!pendingFrom) {
      setPendingFrom(iso);
      return;
    }
    // Second tap completes it, in whichever order they were tapped.
    const [a, b] = pendingFrom <= iso ? [pendingFrom, iso] : [iso, pendingFrom];
    goRange(a, b);
    close();
  }

  const presets = useMemo(
    () =>
      [
        { key: "7d", label: "Last 7 days", from: shiftIso(today, -6), to: today },
        { key: "30d", label: "Last 30 days", from: shiftIso(today, -29), to: today },
        { key: "mtd", label: "This month", from: `${today.slice(0, 7)}-01`, to: today },
        // Hidden for a Driver with no history — "All time" over nothing is a lie.
        ...(firstDay ? [{ key: "all", label: "All time", from: firstDay, to: today }] : []),
      ] as const,
    [today, firstDay],
  );

  return (
    <>
      <div className="seg seg--full seg--5" role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <button
            type="button"
            key={p}
            className={`seg-btn${period === p ? " is-on" : ""}`}
            aria-pressed={period === p}
            onClick={() => pickPeriod(p)}
          >
            {LABEL[p]}
          </button>
        ))}
      </div>

      <div className={`eper${pending ? " is-busy" : ""}`} ref={popRef}>
        {/* Stepping an arbitrary span has no meaning, so the arrows go away
            entirely rather than sitting there disabled. */}
        {!isRange && (
          <button
            type="button"
            className="eper__arw"
            aria-label={`Earlier ${period}`}
            onClick={() => go(period, prev)}
          >
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        )}

        <button
          type="button"
          className={`eper__lab${open ? " is-open" : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Calendar size={15} strokeWidth={1.8} aria-hidden="true" />
          {label}
        </button>

        {!isRange && (
          <button
            type="button"
            className="eper__arw"
            aria-label={`Later ${period}`}
            onClick={() => go(period, next)}
            disabled={isCurrent}
          >
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        )}

        {open && (
          <Cal
            period={period}
            fromDay={pendingFrom ?? fromDay}
            toDay={pendingFrom ?? toDay}
            pendingFrom={pendingFrom}
            today={today}
            presets={isRange ? presets : null}
            onPickDay={pickDay}
            onPickPreset={(f, t) => {
              goRange(f, t);
              close();
            }}
          />
        )}
      </div>
    </>
  );
}

function Cal({
  period,
  fromDay,
  toDay,
  pendingFrom,
  today,
  presets,
  onPickDay,
  onPickPreset,
}: {
  period: Period;
  fromDay: string;
  toDay: string;
  pendingFrom: string | null;
  today: string;
  presets: readonly { key: string; label: string; from: string; to: string }[] | null;
  onPickDay: (iso: string) => void;
  onPickPreset: (from: string, to: string) => void;
}) {
  // The grid matches what the period is actually asking for. Picking a DAY to mean
  // "July" (Month) or to mean "2026" (Year) made the calendar collect information
  // it then threw away, and left the arrows stepping a month when reaching 2024
  // needed thirty taps. Day / Week / Range keep the day grid — there a day really
  // is the unit, or sits inside the month on screen.
  const grid: "day" | "month" | "year" =
    period === "month" ? "month" : period === "year" ? "year" : "day";

  const curY = Number(today.slice(0, 4));
  const selY = Number(fromDay.slice(0, 4));

  const [view, setView] = useState({
    y: selY,
    m: Number(fromDay.slice(5, 7)),
    // Blocks of 12 years anchored to END at the current year, not to a calendar
    // decade: a Driver's history runs backwards from today, so the default block
    // is the one with the data in it and no cell is wasted on the future.
    block: Math.floor((selY - (curY - 11)) / 12),
  });

  const blockStart = curY - 11 + view.block * 12;

  function shift(delta: number) {
    if (grid === "day") {
      const d = new Date(Date.UTC(view.y, view.m - 1 + delta, 1));
      setView((v) => ({ ...v, y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }));
    } else if (grid === "month") {
      setView((v) => ({ ...v, y: v.y + delta }));
    } else {
      setView((v) => ({ ...v, block: v.block + delta }));
    }
  }

  const dayCells = useMemo(() => {
    if (grid !== "day") return [];
    const lead = firstDowMon(view.y, view.m);
    const total = daysInMonth(view.y, view.m);
    const out: (string | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= total; d++) out.push(`${view.y}-${pad(view.m)}-${pad(d)}`);
    return out;
  }, [grid, view.y, view.m]);

  const title =
    grid === "day"
      ? MONTH_FMT.format(Date.UTC(view.y, view.m - 1, 1))
      : grid === "month"
        ? String(view.y)
        : `${blockStart} – ${blockStart + 11}`;

  // Nothing to earn in the future, so it is never offered — and once the view
  // reaches the present there is nothing further to step to.
  const atPresent =
    grid === "day"
      ? `${view.y}-${pad(view.m)}` >= today.slice(0, 7)
      : grid === "month"
        ? view.y >= curY
        : blockStart + 11 >= curY;

  const navNoun = grid === "day" ? "month" : grid === "month" ? "year" : "years";

  return (
    <div className="ecal" role="dialog" aria-label="Choose a date">
      {presets && (
        <div className="ecal__presets">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              className="rchip"
              onClick={() => onPickPreset(p.from, p.to)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {pendingFrom && (
        <p className="ecal__hint">Now pick the end date.</p>
      )}

      <div className="ecal__head">
        <button
          type="button"
          className="ecal__nav"
          onClick={() => shift(-1)}
          aria-label={`Previous ${navNoun}`}
        >
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <span className="ecal__title">{title}</span>
        <button
          type="button"
          className="ecal__nav"
          onClick={() => shift(1)}
          aria-label={`Next ${navNoun}`}
          disabled={atPresent}
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>

      {grid === "month" && (
        <div className="ecal__blocks">
          {Array.from({ length: 12 }, (_, i) => {
            const key = `${view.y}-${pad(i + 1)}`;
            return (
              <button
                key={key}
                type="button"
                className={`ecal__block${key === fromDay.slice(0, 7) ? " is-sel" : ""}`}
                disabled={key > today.slice(0, 7)}
                // The 1st is only a carrier: periodRange widens it to the month.
                onClick={() => onPickDay(`${key}-01`)}
              >
                {monthCell(view.y, i)}
              </button>
            );
          })}
        </div>
      )}

      {grid === "year" && (
        <div className="ecal__blocks">
          {Array.from({ length: 12 }, (_, i) => {
            const y = blockStart + i;
            return (
              <button
                key={y}
                type="button"
                className={`ecal__block${y === selY ? " is-sel" : ""}`}
                disabled={y > curY}
                onClick={() => onPickDay(`${y}-01-01`)}
              >
                {y}
              </button>
            );
          })}
        </div>
      )}

      {grid === "day" && (
        <div className="ecal__dow" aria-hidden="true">
          {DOW.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
      )}

      {grid === "day" && (
      <div className="ecal__grid">
        {dayCells.map((iso, i) =>
          iso === null ? (
            <span key={`e${i}`} />
          ) : (
            <button
              key={iso}
              type="button"
              // The band shows what the current selection covers — for the four
              // granularities that's the whole week/month/year the tap would land
              // in, which is what makes "the granularity decides" visible at last.
              className={[
                "ecal__day",
                iso >= fromDay && iso <= toDay ? "is-in" : "",
                iso === fromDay ? "is-start" : "",
                iso === toDay ? "is-end" : "",
                iso === today ? "is-today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={iso > today}
              aria-label={iso}
              onClick={() => onPickDay(iso)}
            >
              {Number(iso.slice(8, 10))}
            </button>
          ),
        )}
      </div>
      )}

      {/* Week is now the only mode where a tap widens into something else — Month
          and Year pick their own unit directly, and in Day the sentence was a
          tautology. Range is covered by the "now pick the end date" hint above. */}
      {period === "week" && (
        <p className="ecal__hint ecal__hint--foot">Pick any day — you’ll get its week.</p>
      )}
    </div>
  );
}
