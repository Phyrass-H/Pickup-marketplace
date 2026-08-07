"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import { DateCal, shiftIso, type CalPreset } from "@/components/date-cal";
import { useDismiss } from "@/lib/use-dismiss";
import { parseAnchor, periodRange, PERIODS, type Period } from "@/lib/earnings";
import { SORTS, SORT_LABEL, type Sort } from "@/lib/history-filter";
import {
  CMPS,
  CMP_LABEL,
  spendHref,
  type Cmp,
  type SpendQuery,
} from "@/lib/spend-filter";
import type { VehicleCategory } from "@/lib/database.types";

const PERIOD_LABEL: Record<Period, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
  range: "Range",
};

/**
 * The Spend toolbar. One filter bar that governs EVERY module below it and the
 * CSV — no per-card date pickers, ever. Two tiles disagreeing about their date
 * range is the classic dashboard failure; one page-level filter is the fix.
 *
 * ⚑ This is History's toolbar with one control added (Compare) and one removed
 * ("Any date"). It reuses the same DateCal, the same debounce, the same
 * live/inflight refs — see components/history-filters.tsx for why each of those
 * exists. Do not build a second calendar; there were nearly three already.
 *
 * ⚑ There is no Driver dropdown here either (founder: *"can you imagine there is
 * 300"*). The Driver dimension arrives as a ranked top-8 in the breakdown, and
 * clicking a row sets ?driver= — which is finally a UI entry point for the param
 * History deliberately kept alive with no control attached.
 */
export function SpendFilters({
  query,
  view,
  categories,
  today,
  firstDay,
  driverName,
}: {
  query: SpendQuery;
  view: { label: string; isCurrent: boolean; fromDay: string; toDay: string };
  categories: { key: VehicleCategory; label: string }[];
  today: string;
  /** Earliest trip this Business has, for "All time". Null when brand new. */
  firstDay: string | null;
  /** Resolved name for an active ?driver=, so the chip can say who. */
  driverName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const live = useRef(query);
  const inflight = useRef<string | null>(null);
  useEffect(() => {
    const href = spendHref(query);
    if (inflight.current === null || inflight.current === href) {
      live.current = query;
      inflight.current = null;
    }
  }, [query]);

  const push = useCallback(
    (patch: Partial<SpendQuery>) => {
      const next = { ...live.current, ...patch };
      live.current = next;
      const href = spendHref(next);
      inflight.current = href;
      startTransition(() => router.replace(`/dispatch/spend${href}`, { scroll: false }));
    },
    [router],
  );

  // ---- search --------------------------------------------------------------
  // Local state is the only source of truth for this box; it is never synced back
  // from query.q. See history-filters.tsx — mirroring the URL here made the text
  // vanish and reappear once per keystroke.
  const [text, setText] = useState(query.q);
  const [focused, setFocused] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

  const search = useCallback(
    (next: string) => {
      setText(next);
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => push({ q: next }), 350);
    },
    [push],
  );

  // Clears what NARROWS the page — never the period. A spend total with no period
  // is meaningless, so the date stays whatever you were looking at.
  const clearAll = () => {
    if (debounce.current) clearTimeout(debounce.current);
    setText("");
    push({ outcome: "all", q: "", driverId: null, category: null, lens: null, sort: "recent" });
  };

  // ---- date ----------------------------------------------------------------
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const popRef = useDismiss<HTMLDivElement>(open, close);

  const period: Period = query.period ?? "month";
  const isRange = period === "range";

  const presets = useMemo<CalPreset[]>(
    () => [
      { key: "7d", label: "Last 7 days", from: shiftIso(today, -6), to: today },
      { key: "30d", label: "Last 30 days", from: shiftIso(today, -29), to: today },
      ...(firstDay ? [{ key: "all", label: "All time", from: firstDay, to: today }] : []),
    ],
    [today, firstDay],
  );

  function pickPeriod(p: Period) {
    if (p === "range") {
      push({ period: "range", anchor: null, from: view.fromDay, to: view.toDay });
    } else {
      push({ period: p, anchor: query.anchor ?? query.from ?? today, from: null, to: null });
    }
  }

  function pickDay(iso: string) {
    push({ period, anchor: iso, from: null, to: null });
    close();
  }

  // Computed from the LIVE anchor so holding ‹ steps once per click.
  function step(dir: -1 | 1) {
    const cur = live.current;
    const p = cur.period ?? "month";
    if (p === "range") return;
    const r = periodRange(p, parseAnchor(cur.anchor ?? cur.from ?? undefined));
    if (dir > 0 && r.isCurrent) return;
    push({ period: p, anchor: dir < 0 ? r.prev : r.next, from: null, to: null });
  }

  // ⚑ `lens` is deliberately NOT here. It narrows only the trip list, and it
  // already announces itself in a labelled header above that list — so putting it
  // in the global chip row claimed the whole page was filtered when it wasn't,
  // and left a lone "Clear all" sitting next to no chips.
  const narrowed = Boolean(
    query.q || query.driverId || query.category || query.outcome !== "all",
  );
  const exportHref = `/dispatch/spend/export${spendHref(query)}`;

  return (
    <>
      <div className="dxh-tools">
        <div className="dx-search dxh-search">
          <Search aria-hidden="true" />
          <input
            type="text"
            value={text}
            placeholder="Search trips…"
            aria-label="Search trips"
            aria-describedby="dxs-scope"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => search(e.target.value)}
          />
          {text && (
            <button
              type="button"
              className="dx-search__clear"
              aria-label="Clear search"
              onClick={() => search("")}
            >
              <X aria-hidden="true" />
            </button>
          )}
          <p id="dxs-scope" className={`dxh-scope${focused ? " is-on" : ""}`}>
            Guest · Driver · reference · address · flight · car
          </p>
        </div>

        <div className="dxh-pop" ref={popRef}>
          <div className="dxh-date is-on">
            {!isRange && (
              <button
                type="button"
                className="dxh-date__arw"
                aria-label={`Earlier ${period}`}
                onClick={() => step(-1)}
              >
                <ChevronLeft size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="dxh-date__lab"
              onClick={() => setOpen((o) => !o)}
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <Calendar size={15} strokeWidth={1.8} aria-hidden="true" />
              {view.label}
            </button>
            {!isRange && (
              <button
                type="button"
                className="dxh-date__arw"
                aria-label={`Later ${period}`}
                onClick={() => step(1)}
                disabled={view.isCurrent}
              >
                <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>

          {open && (
            <div className="dxh-cal">
              <div className="seg seg--full seg--5" role="group" aria-label="Period">
                {PERIODS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    className={`seg-btn${period === p ? " is-on" : ""}`}
                    aria-pressed={period === p}
                    onClick={() => pickPeriod(p)}
                  >
                    {PERIOD_LABEL[p]}
                  </button>
                ))}
              </div>

              <DateCal
                period={period}
                fromDay={view.fromDay}
                toDay={view.toDay}
                anchorDay={view.fromDay}
                today={today}
                presets={isRange ? presets : null}
                onPickDay={pickDay}
                onPickRange={(f, t) => push({ period: "range", anchor: null, from: f, to: t })}
                onPickPreset={(f, t) => {
                  push({ period: "range", anchor: null, from: f, to: t });
                  close();
                }}
                onDone={close}
              />
            </div>
          )}
        </div>

        <label className="dxh-sel">
          <span className="sr-only">Comparison</span>
          <select
            value={query.cmp}
            onChange={(e) => push({ cmp: e.target.value as Cmp })}
            className={query.cmp !== "prev" ? "is-on" : undefined}
          >
            {CMPS.map((c) => (
              <option key={c} value={c}>
                {CMP_LABEL[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="dxh-sel">
          <span className="sr-only">Service class</span>
          <select
            value={query.category ?? ""}
            onChange={(e) => push({ category: (e.target.value || null) as VehicleCategory | null })}
            className={query.category ? "is-on" : undefined}
          >
            <option value="">Any class</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="dxh-sel">
          <span className="sr-only">Sort trips</span>
          <select value={query.sort} onChange={(e) => push({ sort: e.target.value as Sort })}>
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <span className="dxh-spacer" />

        <a className={`dxh-btn${pending ? " is-busy" : ""}`} href={exportHref}>
          <Download size={15} strokeWidth={1.8} aria-hidden="true" />
          Export CSV
        </a>
      </div>

      {/* Applied filters sit BELOW the controls, never inside them — otherwise the
          toolbar reflows as chips accumulate and the buttons move under the
          cursor. */}
      {narrowed && (
        <div className="dxs-chips">
          {query.q && (
            <button type="button" className="dxs-ac" onClick={() => search("")}>
              “{query.q}” <span aria-hidden="true">×</span>
              <span className="sr-only">Clear search</span>
            </button>
          )}
          {query.driverId && (
            <button type="button" className="dxs-ac" onClick={() => push({ driverId: null })}>
              {driverName ?? "One Driver"} <span aria-hidden="true">×</span>
              <span className="sr-only">Clear Driver filter</span>
            </button>
          )}
          {query.category && (
            <button type="button" className="dxs-ac" onClick={() => push({ category: null })}>
              {categories.find((c) => c.key === query.category)?.label ?? query.category}{" "}
              <span aria-hidden="true">×</span>
              <span className="sr-only">Clear class filter</span>
            </button>
          )}
          {query.outcome !== "all" && (
            <button type="button" className="dxs-ac" onClick={() => push({ outcome: "all" })}>
              {query.outcome} <span aria-hidden="true">×</span>
              <span className="sr-only">Clear outcome filter</span>
            </button>
          )}
          <button type="button" className="dxs-ac-clear" onClick={clearAll}>
            Clear all
          </button>
        </div>
      )}
    </>
  );
}
