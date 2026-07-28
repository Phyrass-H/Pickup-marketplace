"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { PERIODS, type Period } from "@/lib/earnings";

const LABEL: Record<Period, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
};

// The whole filter, in one row of controls: the granularity, a step either way, and
// the label itself as a jump — tapping it opens the phone's own date picker, and the
// selected granularity decides what that date means (a day, its week, its month, its
// year). State lives in the URL so reload and Back land on the same view.
export function EarningsPeriod({
  period,
  anchor,
  label,
  prev,
  next,
  isCurrent,
}: {
  period: Period;
  anchor: string;
  label: string;
  prev: string;
  next: string;
  isCurrent: boolean;
}) {
  const router = useRouter();
  const dateRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function go(p: Period, d: string) {
    startTransition(() => router.push(`/earnings?p=${p}&d=${d}`, { scroll: false }));
  }

  function openPicker() {
    const el = dateRef.current;
    if (!el) return;
    // showPicker() is the reliable way on mobile Safari/Chrome; older engines fall
    // back to focusing the (visually hidden but real) input.
    if (typeof el.showPicker === "function") el.showPicker();
    else el.focus();
  }

  return (
    <>
      <div className="seg seg--full" role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <button
            type="button"
            key={p}
            className={`seg-btn${period === p ? " is-on" : ""}`}
            aria-pressed={period === p}
            onClick={() => go(p, anchor)}
          >
            {LABEL[p]}
          </button>
        ))}
      </div>

      <div className={`eper${pending ? " is-busy" : ""}`}>
        <button
          type="button"
          className="eper__arw"
          aria-label={`Earlier ${period}`}
          onClick={() => go(period, prev)}
        >
          <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
        </button>

        <button type="button" className="eper__lab" onClick={openPicker}>
          <Calendar size={15} strokeWidth={1.8} aria-hidden="true" />
          {label}
        </button>

        <button
          type="button"
          className="eper__arw"
          aria-label={`Later ${period}`}
          onClick={() => go(period, next)}
          disabled={isCurrent}
        >
          <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
        </button>

        <input
          ref={dateRef}
          type="date"
          className="eper__date"
          value={anchor}
          aria-label="Jump to a date"
          onChange={(e) => e.target.value && go(period, e.target.value)}
        />
      </div>
    </>
  );
}
