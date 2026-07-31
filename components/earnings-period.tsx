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
  const [view, setView] = useState({
    y: Number(fromDay.slice(0, 4)),
    m: Number(fromDay.slice(5, 7)),
  });

  const cells = useMemo(() => {
    const lead = firstDowMon(view.y, view.m);
    const total = daysInMonth(view.y, view.m);
    const out: (string | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= total; d++) out.push(`${view.y}-${pad(view.m)}-${pad(d)}`);
    return out;
  }, [view]);

  function shift(delta: number) {
    const d = new Date(Date.UTC(view.y, view.m - 1 + delta, 1));
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
  }

  const viewIso = `${view.y}-${pad(view.m)}`;
  // Nothing to earn in the future, so those days aren't offered.
  const atCurrentMonth = viewIso >= today.slice(0, 7);

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
        <button type="button" className="ecal__nav" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <span className="ecal__title">{MONTH_FMT.format(Date.UTC(view.y, view.m - 1, 1))}</span>
        <button
          type="button"
          className="ecal__nav"
          onClick={() => shift(1)}
          aria-label="Next month"
          disabled={atCurrentMonth}
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="ecal__dow" aria-hidden="true">
        {DOW.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="ecal__grid">
        {cells.map((iso, i) =>
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

      {/* Only where the granularity actually widens the tap. In Day mode "pick any
          day — you'll get its day" is a tautology, and in Range the header hint
          ("Now pick the end date") is doing the work. */}
      {period !== "range" && period !== "day" && (
        <p className="ecal__hint ecal__hint--foot">
          Pick any day — you’ll get its {period}.
        </p>
      )}
    </div>
  );
}
