// Earnings — period maths + what a Driver actually earned in one.
//
// Two rules this file exists to hold:
//  1. Money is read with `settledFare` (frozen at accept), never `currentFare`.
//     A completed trip whose fare still climbs would inflate every total.
//  2. Everything is bucketed in **Europe/Paris**, not UTC. A 00:30 pickup belongs to
//     the night the Driver worked, and a week starts on Monday.
import { settledFare } from "@/lib/pdp";
import { cancelCompensation } from "@/lib/cancellation";
import type { MissionRow } from "@/lib/database.types";

export const PERIODS = ["day", "week", "month", "year"] as const;
export type Period = (typeof PERIODS)[number];

export function isPeriod(v: string | undefined): v is Period {
  return !!v && (PERIODS as readonly string[]).includes(v);
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
}

export function periodRange(
  period: Period,
  anchor: { y: number; m: number; d: number },
  now: Date = new Date(),
): Range {
  const today = parisParts(now);
  const iso = (a: { y: number; m: number; d: number }) =>
    `${a.y}-${String(a.m).padStart(2, "0")}-${String(a.d).padStart(2, "0")}`;

  let start: { y: number; m: number; d: number };
  let end: { y: number; m: number; d: number };
  let label: string;
  let prev: { y: number; m: number; d: number };
  let next: { y: number; m: number; d: number };

  if (period === "day") {
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

  return {
    from,
    to,
    label,
    prev: iso(prev),
    next: iso(next),
    lastYear: iso({ ...start, y: start.y - 1 }),
    isCurrent: nowMs >= from.getTime() && nowMs < to.getTime(),
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

  for (const m of missions) {
    if (m.status === "completed") {
      const fare = settledFare(m);
      if (m.no_show) {
        t.noShow += fare;
        t.noShowCount += 1;
      } else {
        t.trips += fare;
        t.tripCount += 1;
      }
      // Waiting is settled onto the mission row by both exits; a cancelled trip's
      // waiting is already inside cancelCompensation, so only count it here.
      t.waiting += num(m.waiting_fee);
      t.waitingMinutes += m.waiting_minutes ?? 0;
    } else if (m.status === "cancelled") {
      const comp = cancelCompensation(m);
      if (comp != null) {
        t.cancelledOnYou += comp;
        t.cancelledOnYouCount += 1;
      }
    }
  }

  for (const c of cancels) {
    t.penalties += num(c.fee_amount);
    t.penaltyCount += 1;
  }

  t.total = t.trips + t.noShow + t.waiting + t.cancelledOnYou - t.penalties;
  return t;
}

/** What one mission contributed, for the trip-by-trip list. */
export function missionAmount(m: MissionRow): number {
  if (m.status === "cancelled") return cancelCompensation(m) ?? 0;
  return settledFare(m) + num(m.waiting_fee);
}
