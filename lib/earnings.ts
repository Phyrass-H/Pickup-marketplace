// Earnings — period maths + what a Driver actually earned in one.
//
// Two rules this file exists to hold:
//  1. Money is read with `settledFare` (frozen at accept), never `currentFare`.
//     A completed trip whose fare still climbs would inflate every total.
//  2. Everything is bucketed in **Europe/Paris**, not UTC. A 00:30 pickup belongs to
//     the night the Driver worked, and a week starts on Monday.
import { settledFare } from "@/lib/pdp";
import { cancelCompensation } from "@/lib/cancellation";
import { driverNet } from "@/lib/commission";
import type { MissionRow } from "@/lib/database.types";

// The four calendar granularities step forwards and backwards from an anchor day.
// `range` is different in kind — it's an arbitrary from→to the Driver picked, so it
// has no natural neighbour to step to (that's why the ‹ › arrows hide in that mode).
export const GRANULARITIES = ["day", "week", "month", "year"] as const;
export const PERIODS = [...GRANULARITIES, "range"] as const;
export type Granularity = (typeof GRANULARITIES)[number];
export type Period = (typeof PERIODS)[number];

export function isPeriod(v: string | undefined): v is Period {
  return !!v && (PERIODS as readonly string[]).includes(v);
}
export function isGranularity(v: Period): v is Granularity {
  return v !== "range";
}

/** A 'YYYY-MM-DD' the calendar produced, or null. Rejects anything malformed. */
export function parseDayParam(v: string | undefined): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Reject 31 February and friends — Date rolls them over silently, which would
  // quietly shift a Driver's chosen range by a day or two.
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCMonth() + 1 !== m || probe.getUTCDate() !== d) return null;
  return v;
}

// ---------------------------------------------------------------- Paris calendar
const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function parisParts(d: Date) {
  const p = Object.fromEntries(PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour) % 24,
    mi: Number(p.minute),
    s: Number(p.second),
  };
}

// How far Paris is ahead of UTC at that instant (+1h or +2h).
function offsetMs(at: Date): number {
  const p = parisParts(at);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - at.getTime();
}

/** The instant of Paris-local midnight on a given calendar day. */
function parisMidnight(y: number, m: number, d: number): Date {
  const guess = new Date(Date.UTC(y, m - 1, d));
  // Two passes: the first offset is read at the wrong instant on a DST boundary.
  const once = new Date(guess.getTime() - offsetMs(guess));
  return new Date(guess.getTime() - offsetMs(once));
}

/** 'YYYY-MM-DD' as it reads in Paris. */
export function dayKey(iso: string | Date): string {
  const p = parisParts(typeof iso === "string" ? new Date(iso) : iso);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Parse a 'YYYY-MM-DD' anchor; falls back to today in Paris. */
export function parseAnchor(v: string | undefined): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? "");
  if (match) {
    const [, y, m, d] = match;
    return { y: Number(y), m: Number(m), d: Number(d) };
  }
  const now = parisParts(new Date());
  return { y: now.y, m: now.m, d: now.d };
}

// Monday-first weekday index (0 = Monday) for a Paris calendar day.
function weekdayIndex(y: number, m: number, d: number): number {
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function shiftDays(a: { y: number; m: number; d: number }, days: number) {
  const t = new Date(Date.UTC(a.y, a.m - 1, a.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const DM_LABEL = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export interface Range {
  /** Inclusive start / exclusive end, as instants. */
  from: Date;
  to: Date;
  label: string;
  /** Anchors for the ‹ › steps and the year-ago comparison. */
  prev: string;
  next: string;
  lastYear: string;
  /** True when the period contains today — the › step is then a no-op. */
  isCurrent: boolean;
  /**
   * For a custom range only: the comparison spans, since an anchor can't express
   * them. "The period before" is the span of the SAME LENGTH ending the day before
   * this one starts — comparing 46 days against a calendar month would be a lie.
   * Null for the four granularities, which step by anchor as they always have.
   */
  prevCustom: { from: string; to: string } | null;
  lastYearCustom: { from: string; to: string } | null;
  /** Inclusive 'YYYY-MM-DD' ends — what the calendar highlights. */
  fromDay: string;
  toDay: string;
}

export function periodRange(
  period: Period,
  anchor: { y: number; m: number; d: number },
  now: Date = new Date(),
  /** Only read when period === 'range'; both ends inclusive, 'YYYY-MM-DD'. */
  custom?: { from: string; to: string } | null,
): Range {
  const today = parisParts(now);
  const iso = (a: { y: number; m: number; d: number }) =>
    `${a.y}-${String(a.m).padStart(2, "0")}-${String(a.d).padStart(2, "0")}`;

  let start: { y: number; m: number; d: number };
  let end: { y: number; m: number; d: number };
  let label: string;
  let prev: { y: number; m: number; d: number };
  let next: { y: number; m: number; d: number };

  if (period === "range") {
    // A custom span. `to` is inclusive to the Driver ("16 June – 31 July" includes
    // the 31st), so `end` is the day after — every other branch is already
    // half-open and loadPeriod compares `< to`.
    const parts = (s: string) => ({
      y: Number(s.slice(0, 4)),
      m: Number(s.slice(5, 7)),
      d: Number(s.slice(8, 10)),
    });
    const a = parts(custom?.from ?? iso(anchor));
    const b = parts(custom?.to ?? custom?.from ?? iso(anchor));
    // Tolerate a reversed pair rather than returning an empty period: the URL is
    // hand-editable, and "to before from" reads as zero earnings, not as an error.
    const [lo, hi] =
      parisMidnight(a.y, a.m, a.d) <= parisMidnight(b.y, b.m, b.d) ? [a, b] : [b, a];
    start = lo;
    end = shiftDays(hi, 1);
    const days =
      Math.round(
        (parisMidnight(end.y, end.m, end.d).getTime() -
          parisMidnight(start.y, start.m, start.d).getTime()) /
          86_400_000,
      ) || 1;
    const one = DM_LABEL.format(Date.UTC(lo.y, lo.m - 1, lo.d));
    label =
      days === 1
        ? DAY_LABEL.format(Date.UTC(lo.y, lo.m - 1, lo.d))
        : `${one} – ${DM_LABEL.format(Date.UTC(hi.y, hi.m - 1, hi.d))} · ${days} days`;
    // Stepping an arbitrary span is meaningless, so the UI hides the arrows; these
    // stay self-referential rather than undefined so nothing downstream has to
    // special-case them.
    prev = start;
    next = start;
  } else if (period === "day") {
    start = anchor;
    end = shiftDays(anchor, 1);
    label = DAY_LABEL.format(Date.UTC(anchor.y, anchor.m - 1, anchor.d));
    prev = shiftDays(anchor, -1);
    next = shiftDays(anchor, 1);
  } else if (period === "week") {
    start = shiftDays(anchor, -weekdayIndex(anchor.y, anchor.m, anchor.d));
    end = shiftDays(start, 7);
    const last = shiftDays(start, 6);
    label = `${DM_LABEL.format(Date.UTC(start.y, start.m - 1, start.d))} – ${DM_LABEL.format(
      Date.UTC(last.y, last.m - 1, last.d),
    )}`;
    prev = shiftDays(start, -7);
    next = shiftDays(start, 7);
  } else if (period === "month") {
    start = { y: anchor.y, m: anchor.m, d: 1 };
    end = anchor.m === 12 ? { y: anchor.y + 1, m: 1, d: 1 } : { y: anchor.y, m: anchor.m + 1, d: 1 };
    label = MONTH_LABEL.format(Date.UTC(anchor.y, anchor.m - 1, 1));
    prev = anchor.m === 1 ? { y: anchor.y - 1, m: 12, d: 1 } : { y: anchor.y, m: anchor.m - 1, d: 1 };
    next = end;
  } else {
    start = { y: anchor.y, m: 1, d: 1 };
    end = { y: anchor.y + 1, m: 1, d: 1 };
    label = String(anchor.y);
    prev = { y: anchor.y - 1, m: 1, d: 1 };
    next = end;
  }

  const from = parisMidnight(start.y, start.m, start.d);
  const to = parisMidnight(end.y, end.m, end.d);
  const nowMs = now.getTime();
  const lastDay = shiftDays(end, -1); // `end` is exclusive; this is the inclusive end

  let prevCustom: { from: string; to: string } | null = null;
  let lastYearCustom: { from: string; to: string } | null = null;
  if (period === "range") {
    const span = Math.round((to.getTime() - from.getTime()) / 86_400_000) || 1;
    prevCustom = {
      from: iso(shiftDays(start, -span)),
      to: iso(shiftDays(start, -1)),
    };
    lastYearCustom = {
      from: iso({ ...start, y: start.y - 1 }),
      to: iso({ ...lastDay, y: lastDay.y - 1 }),
    };
  }

  return {
    from,
    to,
    label,
    prev: iso(prev),
    next: iso(next),
    lastYear: iso({ ...start, y: start.y - 1 }),
    isCurrent: nowMs >= from.getTime() && nowMs < to.getTime(),
    prevCustom,
    lastYearCustom,
    fromDay: iso(start),
    toDay: iso(lastDay),
  };
}

/** "This week" / "This month" style anchors for the quick-jump chips. */
export function todayAnchor(now: Date = new Date()) {
  const p = parisParts(now);
  return { y: p.y, m: p.m, d: p.d };
}

// ------------------------------------------------------------------- The money
export interface DriverCancelRow {
  created_at: string;
  fee_amount: number | string | null;
}

export interface Totals {
  /** Completed trips that ran (no-shows counted separately). */
  trips: number;
  tripCount: number;
  /** A no-show pays the Driver the full fare — it IS earnings, not a failure. */
  noShow: number;
  noShowCount: number;
  waiting: number;
  waitingMinutes: number;
  /** A Business cancelled on them: the policy fee plus any waiting already run. */
  cancelledOnYou: number;
  cancelledOnYouCount: number;
  /** What their own cancellations cost them, as a positive number to subtract. */
  penalties: number;
  penaltyCount: number;
  total: number;
}

const EMPTY: Totals = {
  trips: 0,
  tripCount: 0,
  noShow: 0,
  noShowCount: 0,
  waiting: 0,
  waitingMinutes: 0,
  cancelledOnYou: 0,
  cancelledOnYouCount: 0,
  penalties: 0,
  penaltyCount: 0,
  total: 0,
};

function num(v: number | string | null | undefined): number {
  return v == null ? 0 : Number(v);
}

/** Everything a Driver earned (and lost) in one period. */
export function totalsFor(missions: MissionRow[], cancels: DriverCancelRow[]): Totals {
  const t = { ...EMPTY };

  // ⚑ Every bucket below is NET — what the Driver banks (docs/06 §1). The
  // commission is applied per contribution rather than to the sum, so the
  // buckets on screen still add up to the total exactly. Penalties are the one
  // exception, further down.
  for (const m of missions) {
    if (m.status === "completed") {
      const fare = driverNet(m, settledFare(m));
      if (m.no_show) {
        t.noShow += fare;
        t.noShowCount += 1;
      } else {
        t.trips += fare;
        t.tripCount += 1;
      }
      // Waiting is settled onto the mission row by both exits; a cancelled trip's
      // waiting is already inside cancelCompensation, so only count it here.
      t.waiting += driverNet(m, num(m.waiting_fee));
      t.waitingMinutes += m.waiting_minutes ?? 0;
    } else if (m.status === "cancelled") {
      const comp = cancelCompensation(m);
      if (comp != null) {
        t.cancelledOnYou += driverNet(m, comp);
        t.cancelledOnYouCount += 1;
      }
    }
  }

  // ⚑ NOT netted. A Driver's own cancellation penalty runs Driver → Business,
  // so docs/06 §1 calls it an indemnity rather than payment for transport and it
  // carries no commission. The Driver owes the whole figure.
  for (const c of cancels) {
    t.penalties += num(c.fee_amount);
    t.penaltyCount += 1;
  }

  t.total = t.trips + t.noShow + t.waiting + t.cancelledOnYou - t.penalties;
  return t;
}

/**
 * What one mission contributed, for the trip-by-trip list — and the ONLY money
 * figure a Driver screen may render for a mission.
 *
 * ⚑ NET, since 2026-08-17. docs/06 §1 and the founder's ruling: the number in
 * the Pool is the number they bank, so the commission comes off before anything
 * is displayed and there is no gross/net language anywhere in the app. The
 * gross figures stay in `settledFare` / `cancelCompensation`, which is what the
 * money paths and the Business's side settle against — this is the display.
 */
export function missionAmount(m: MissionRow): number {
  return driverNet(m, grossToDriver(m));
}

/** The same amount before commission — what actually moves between the parties. */
export function grossToDriver(m: MissionRow): number {
  if (m.status === "cancelled") return cancelCompensation(m) ?? 0;
  return settledFare(m) + num(m.waiting_fee);
}
