"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Period } from "@/lib/earnings";

// The app's own calendar — a month/month-block/year grid that can pick a single
// day OR a two-tap span. Extracted from components/earnings-period.tsx in S52 so
// Dispatch History uses the SAME control ([[d64]]–[[d66]]); the founder asked for
// a date range in three places and the rule is that it gets built once.
//
// ⚑ WHY THIS EXISTS AND NOT <input type="date">.
// The first version rendered a real date input, hid it (opacity 0, 1px, and
// pointer-events: none) and drove it with showPicker(). That failed both ways the
// founder reported: on a phone showPicker() on a non-interactive input does
// nothing at all, and on a desktop the native calendar anchors to an invisible
// 1px box the user can't click away from — so it "wouldn't close". It was also a
// dead end, because <input type="date"> cannot express a RANGE, which is the
// feature that was actually being asked for.
//
// It deliberately mirrors components/date-time-picker.tsx (the mission form's
// picker) — same shape, same vocabulary. Still NOT the same code: that one only
// allows FUTURE days and picks a single date. Merging them is a fair follow-up.
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

/** Shift a YYYY-MM-DD key by whole days. UTC arithmetic — no DST drift. */
export function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface CalPreset {
  key: string;
  label: string;
  from: string;
  to: string;
}

export function DateCal({
  period,
  fromDay,
  toDay,
  anchorDay,
  today,
  presets,
  onPickDay,
  onPickRange,
  onPickPreset,
  onDone,
}: {
  period: Period;
  /** Inclusive ends of the COMMITTED band (from the URL). "" for both = nothing banded. */
  fromDay: string;
  toDay: string;
  /** Which month/year to open on. Defaults to the band's start; required when
      the band is empty, since "" carries no month to show. */
  anchorDay?: string;
  today: string;
  presets: readonly CalPreset[] | null;
  /** A single day, for day/week/month/year. */
  onPickDay: (iso: string) => void;
  /** Both ends of a hand-built span, once the second tap lands. Range mode only. */
  onPickRange?: (from: string, to: string) => void;
  onPickPreset: (from: string, to: string) => void;
  onDone: () => void;
}) {
  // ⚑ The two-tap range lives HERE, not in the callers.
  //
  // It used to live in each caller (Earnings and History), which had two costs:
  // the same twenty lines twice, and a flash the founder reported — *"when I pick
  // the second date the calendar displays today's date for a moment before going
  // back to the from-to selected."* The caller cleared its half-built state the
  // instant the second tap landed, but the new range only arrives after
  // router.replace commits, so for one frame the calendar rendered the OLD props:
  // the previous range, or nothing at all with only "today" still highlighted.
  //
  // `optimistic` closes that window. The completed pair is held locally and drawn
  // immediately; it is dropped once the props catch up, so the URL stays the
  // source of truth and nothing is stale for longer than the navigation takes.
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    if (optimistic && optimistic.from === fromDay && optimistic.to === toDay) setOptimistic(null);
  }, [optimistic, fromDay, toDay]);

  // Switching granularity abandons a half-built span rather than carrying it into
  // a mode where a "start" means nothing.
  useEffect(() => {
    setPendingFrom(null);
    setOptimistic(null);
  }, [period]);

  const band = pendingFrom
    ? { from: pendingFrom, to: pendingFrom }
    : (optimistic ?? { from: fromDay, to: toDay });

  function handleDay(iso: string) {
    if (period !== "range" || !onPickRange) {
      onPickDay(iso);
      return;
    }
    if (!pendingFrom) {
      setPendingFrom(iso);
      return;
    }
    // Second tap completes it, in whichever order the two were tapped. It does
    // NOT close ([[d66]]): the moment a range most needs to confirm itself is the
    // moment it used to destroy its own evidence.
    const [a, b] = pendingFrom <= iso ? [pendingFrom, iso] : [iso, pendingFrom];
    setOptimistic({ from: a, to: b });
    setPendingFrom(null);
    onPickRange(a, b);
  }

  function handleDone() {
    setPendingFrom(null);
    onDone();
  }
  // The grid matches what the period is actually asking for. Picking a DAY to mean
  // "July" (Month) or to mean "2026" (Year) made the calendar collect information
  // it then threw away, and left the arrows stepping a month when reaching 2024
  // needed thirty taps. Day / Week / Range keep the day grid — there a day really
  // is the unit, or sits inside the month on screen.
  const grid: "day" | "month" | "year" =
    period === "month" ? "month" : period === "year" ? "year" : "day";

  const anchor = anchorDay || fromDay || today;
  const bandFrom = band.from;
  const bandTo = band.to;
  const curY = Number(today.slice(0, 4));
  const selY = Number(anchor.slice(0, 4));

  const [view, setView] = useState({
    y: selY,
    m: Number(anchor.slice(5, 7)),
    // Blocks of 12 years anchored to END at the current year, not to a calendar
    // decade: history runs backwards from today, so the default block is the one
    // with the data in it and no cell is wasted on the future.
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

  // Nothing has happened in the future, so it is never offered — and once the
  // view reaches the present there is nothing further to step to.
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
                className={`ecal__block${key === bandFrom.slice(0, 7) ? " is-sel" : ""}`}
                disabled={key > today.slice(0, 7)}
                // The 1st is only a carrier: periodRange widens it to the month.
                onClick={() => handleDay(`${key}-01`)}
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
                onClick={() => handleDay(`${y}-01-01`)}
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
                  bandFrom && iso >= bandFrom && iso <= bandTo ? "is-in" : "",
                  iso === bandFrom ? "is-start" : "",
                  iso === bandTo ? "is-end" : "",
                  iso === today ? "is-today" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={iso > today}
                aria-label={iso}
                onClick={() => handleDay(iso)}
              >
                {Number(iso.slice(8, 10))}
              </button>
            ),
          )}
        </div>
      )}

      {/* Week is the only mode where a tap widens into something else — Month and
          Year pick their own unit directly, and in Day the sentence was a
          tautology. */}
      {period === "week" && (
        <p className="ecal__hint ecal__hint--foot">Pick any day — you’ll get its week.</p>
      )}

      {/* ⚑ ONE footer slot of a FIXED height, holding either the prompt or the way
          out. The prompt used to appear at the TOP and Done used to vanish, so a
          first tap pushed the whole grid down 27px and shrank the popover — the
          founder read that as the weekday letters disappearing, because the date
          numbers slid up into where the letters had been. Nothing above this line
          moves now; only the contents of this row change. */}
      {period === "range" && (
        <div className="ecal__foot">
          {pendingFrom ? (
            <p className="ecal__prompt">Now pick the end date.</p>
          ) : (
            <button type="button" className="ecal__done" onClick={handleDone}>
              Done
            </button>
          )}
        </div>
      )}
    </div>
  );
}
