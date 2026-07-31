"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { PERIODS, type Period } from "@/lib/earnings";
import { useDismiss } from "@/lib/use-dismiss";
import { DateCal, shiftIso } from "@/components/date-cal";

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
// The calendar itself lives in components/date-cal.tsx — Dispatch History picks a
// range with the SAME control (S52). Why it isn't <input type="date"> is
// documented there.
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
    //
    // Deliberately does NOT close (founder): the calendar used to vanish on this
    // tap, so you never saw the range you'd just built. It stays open with the
    // band joined up and the label above rewritten, and the results load behind
    // meanwhile — so the confirming tap on Done costs no waiting. It also gives a
    // mis-tap on a small day cell somewhere to be noticed before you leave.
    // Clearing pendingFrom is what makes the NEXT tap start a fresh range rather
    // than extend this one.
    const [a, b] = pendingFrom <= iso ? [pendingFrom, iso] : [iso, pendingFrom];
    goRange(a, b);
    setPendingFrom(null);
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
          <DateCal
            period={period}
            fromDay={pendingFrom ?? fromDay}
            toDay={pendingFrom ?? toDay}
            pendingFrom={pendingFrom}
            today={today}
            presets={isRange ? presets : null}
            onPickDay={pickDay}
            // A shortcut is one tap with unambiguous intent — nothing to confirm,
            // so it closes straight away. Only the hand-built two-tap range waits.
            onPickPreset={(f, t) => {
              goRange(f, t);
              close();
            }}
            onDone={close}
          />
        )}
      </div>
    </>
  );
}
