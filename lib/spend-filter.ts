// Spend URL state — History's filter vocabulary, plus what a spend page adds.
//
// ⚑ Deliberately built ON TOP of lib/history-filter.ts rather than beside it.
// The two screens read the same archive, so a second filter vocabulary would
// eventually disagree with the first, and then "Export CSV" stops meaning
// "exactly what's on screen". parseSpendQuery calls parseHistoryQuery first and
// only adds the three params History has no use for.
//
// Two differences from History, both on purpose:
//  1. Spend ALWAYS has a period (default: this month). A spend total with no
//     period is meaningless, and the comparison needs a span to compare against.
//  2. It carries `cmp` — what "vs" means — which History has no concept of.
import {
  historyHref,
  parseHistoryQuery,
  type HistoryQuery,
} from "@/lib/history-filter";
import { parseAnchor, parseDayParam, periodRange, todayAnchor } from "@/lib/earnings";
import { DIMS, type Dim } from "@/lib/spend";

export const CMPS = ["prev", "year", "none"] as const;
export type Cmp = (typeof CMPS)[number];

export const CMP_LABEL: Record<Cmp, string> = {
  prev: "vs previous period",
  year: "vs same period last year",
  none: "No comparison",
};

/**
 * The money lenses. NOT outcomes — History's four-token `filter` vocabulary
 * (all/completed/unfilled/cancelled) stays exactly as it is; these narrow the
 * trip list by which COMPONENT of the bill a row belongs to.
 */
export const LENSES = ["waiting", "noshow", "cancelled", "unsettled"] as const;
export type Lens = (typeof LENSES)[number];

export const LENS_LABEL: Record<Lens, string> = {
  waiting: "waiting charges",
  noshow: "no-shows",
  cancelled: "cancellation fees",
  unsettled: "trips not settled",
};

export interface SpendQuery extends HistoryQuery {
  cmp: Cmp;
  dim: Dim;
  lens: Lens | null;
}

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseSpendQuery(
  sp: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): SpendQuery {
  const base = parseHistoryQuery(sp);

  // History's default is "any date"; ours is this month. Only fall back when the
  // URL genuinely says nothing — a real ?p= is honoured as parsed.
  if (base.period === null) {
    const a = todayAnchor(now);
    base.period = "month";
    base.anchor = `${a.y}-${String(a.m).padStart(2, "0")}-01`;
    const r = periodRange("month", a, now);
    base.from = r.fromDay;
    base.to = r.toDay;
  }

  const cmpRaw = one(sp.cmp);
  const dimRaw = one(sp.dim);
  const lensRaw = one(sp.lens);

  return {
    ...base,
    cmp: (CMPS as readonly string[]).includes(cmpRaw ?? "") ? (cmpRaw as Cmp) : "prev",
    dim: (DIMS as readonly string[]).includes(dimRaw ?? "") ? (dimRaw as Dim) : "type",
    lens: (LENSES as readonly string[]).includes(lensRaw ?? "") ? (lensRaw as Lens) : null,
  };
}

/**
 * Rebuild the query string. Defaults are dropped so a clean view is a clean URL.
 * Returns "?a=b" or "" — the caller prefixes the path, exactly like historyHref.
 */
export function spendHref(q: SpendQuery, patch: Partial<SpendQuery> = {}): string {
  const next = { ...q, ...patch };
  const base = historyHref(next);
  const extra: string[] = [];
  if (next.cmp !== "prev") extra.push(`cmp=${next.cmp}`);
  if (next.dim !== "type") extra.push(`dim=${next.dim}`);
  if (next.lens) extra.push(`lens=${next.lens}`);
  if (extra.length === 0) return base;
  return base ? `${base}&${extra.join("&")}` : `?${extra.join("&")}`;
}

export interface Span {
  fromDay: string;
  toDay: string;
  label: string;
}

/** The applied period, as inclusive Paris day keys. */
export function currentSpan(q: SpendQuery, now: Date = new Date()): Span {
  const r = periodRange(
    q.period ?? "month",
    parseAnchor(q.anchor ?? q.from ?? undefined),
    now,
    q.period === "range" && q.from && q.to ? { from: q.from, to: q.to } : null,
  );
  return { fromDay: r.fromDay, toDay: r.toDay, label: r.label };
}

/**
 * The span to compare against, or null when comparison is off.
 *
 * ⚑ For a custom range, "the period before" is the span of the SAME LENGTH
 * ending the day before this one starts — periodRange already computes that
 * (prevCustom), because comparing 46 days against a calendar month would lie.
 */
export function comparisonSpan(q: SpendQuery, now: Date = new Date()): Span | null {
  if (q.cmp === "none") return null;
  const period = q.period ?? "month";
  const anchor = parseAnchor(q.anchor ?? q.from ?? undefined);
  const custom = period === "range" && q.from && q.to ? { from: q.from, to: q.to } : null;
  const r = periodRange(period, anchor, now, custom);

  if (period === "range") {
    const c = q.cmp === "year" ? r.lastYearCustom : r.prevCustom;
    if (!c) return null;
    const back = periodRange("range", anchor, now, c);
    return { fromDay: back.fromDay, toDay: back.toDay, label: back.label };
  }

  const anchorIso = q.cmp === "year" ? r.lastYear : r.prev;
  const back = periodRange(period, parseAnchor(anchorIso), now);
  return { fromDay: back.fromDay, toDay: back.toDay, label: back.label };
}

/**
 * The same query, re-pointed at another span. Used to run applyHistoryQuery a
 * second time for the comparison period, so every other filter (search, class,
 * Driver, outcome) applies identically on both sides of a "vs" figure.
 */
export function queryForSpan(q: SpendQuery, span: Span): SpendQuery {
  return {
    ...q,
    period: "range",
    anchor: null,
    from: parseDayParam(span.fromDay) ?? span.fromDay,
    to: parseDayParam(span.toDay) ?? span.toDay,
  };
}
