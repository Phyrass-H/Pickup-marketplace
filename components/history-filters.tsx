"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Download, Search, X } from "lucide-react";
import { DateCal, shiftIso, type CalPreset } from "@/components/date-cal";
import { useDismiss } from "@/lib/use-dismiss";
import { historyHref, isFiltered, SORTS, SORT_LABEL, type HistoryQuery, type Sort } from "@/lib/history-filter";
import type { VehicleCategory } from "@/lib/database.types";

export interface DriverOption {
  id: string;
  name: string;
}

const RANGE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const RANGE_FMT_Y = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "12 – 19 Jul" · "28 Jun – 3 Jul" · "3 Jul 2025 – 1 Aug 2026" · "Since 1 Jul". */
function rangeLabel(from: string | null, to: string | null, today: string): string {
  if (!from && !to) return "Any date";
  const sameYear = (a: string, b: string) => a.slice(0, 4) === b.slice(0, 4);
  const fmt = (d: string, withYear: boolean) =>
    (withYear ? RANGE_FMT_Y : RANGE_FMT).format(new Date(`${d}T00:00:00Z`));
  if (from && !to) return `Since ${fmt(from, !sameYear(from, today))}`;
  if (!from && to) return `Until ${fmt(to, !sameYear(to, today))}`;
  const withYear = !sameYear(from!, today) || !sameYear(to!, today);
  if (from === to) return fmt(from!, withYear);
  return `${fmt(from!, withYear || !sameYear(from!, to!))} – ${fmt(to!, withYear)}`;
}

/**
 * The History toolbar: one search box, a date range, a Driver, a class, a sort
 * and the export. Every control writes to the URL and nothing else — so a
 * filtered archive is a link you can send to your accountant, Back works, and
 * the CSV can be the very same query re-run on the server.
 *
 * The date range is the SAME calendar as the Driver's Earnings ([[d64]]–[[d66]],
 * components/date-cal.tsx). The founder asked for a range in three places; this
 * is the second, and it did not grow its own.
 */
export function HistoryFilters({
  query,
  drivers,
  categories,
  today,
  firstDay,
  resultCount,
}: {
  query: HistoryQuery;
  drivers: DriverOption[];
  categories: { key: VehicleCategory; label: string }[];
  today: string;
  /** Earliest trip this Business has, for "All time". Null when brand new. */
  firstDay: string | null;
  resultCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const push = useCallback(
    (patch: Partial<HistoryQuery>) => {
      startTransition(() =>
        router.replace(`/dispatch/history${historyHref(query, patch)}`, { scroll: false }),
      );
    },
    [router, query],
  );

  // ---- search: typed locally, debounced into the URL ------------------------
  // Every keystroke is a server round-trip otherwise, and `replace` (not `push`)
  // keeps a search from burying the previous page under 12 history entries.
  const [text, setText] = useState(query.q);
  const [focused, setFocused] = useState(false);
  // The last value THIS box sent to the URL. Anything else arriving in query.q
  // came from somewhere the box doesn't control — "Clear filters", a Back, a
  // pasted link — and has to win, or the box would keep pushing its stale text
  // back and the Clear button would appear not to work.
  const sent = useRef(query.q);

  useEffect(() => {
    if (query.q !== sent.current) {
      sent.current = query.q;
      setText(query.q);
      return;
    }
    if (text === query.q) return;
    const id = setTimeout(() => {
      sent.current = text;
      push({ q: text });
    }, 300);
    return () => clearTimeout(id);
  }, [text, query.q, push]);

  // ---- date range ----------------------------------------------------------
  const [open, setOpen] = useState(false);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const close = useCallback(() => {
    setOpen(false);
    setPendingFrom(null);
  }, []);
  const popRef = useDismiss<HTMLDivElement>(open, close);

  const presets = useMemo<CalPreset[]>(
    () => [
      { key: "7d", label: "Last 7 days", from: shiftIso(today, -6), to: today },
      { key: "30d", label: "Last 30 days", from: shiftIso(today, -29), to: today },
      { key: "mtd", label: "This month", from: `${today.slice(0, 7)}-01`, to: today },
      // Hidden for a Business with no history — "All time" over nothing is a lie.
      ...(firstDay ? [{ key: "all", label: "All time", from: firstDay, to: today }] : []),
    ],
    [today, firstDay],
  );

  function pickDay(iso: string) {
    if (!pendingFrom) {
      setPendingFrom(iso);
      return;
    }
    // Second tap completes it, in whichever order the two were tapped. It does
    // NOT close — same rule as Earnings ([[d66]]): the moment a range most needs
    // to confirm itself is the moment it used to destroy its own evidence.
    const [a, b] = pendingFrom <= iso ? [pendingFrom, iso] : [iso, pendingFrom];
    push({ from: a, to: b });
    setPendingFrom(null);
  }

  const filtered = isFiltered(query);
  const exportHref = `/dispatch/history/export${historyHref(query)}`;

  return (
    <div className={`dxh-tools${pending ? " is-busy" : ""}`}>
      <div className="dx-search dxh-search">
        <Search aria-hidden="true" />
        <input
          type="search"
          value={text}
          placeholder="Search trips…"
          aria-label="Search past trips"
          aria-describedby="dxh-scope"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => setText(e.target.value)}
        />
        {text && (
          <button
            type="button"
            className="dx-search__clear"
            aria-label="Clear search"
            onClick={() => setText("")}
          >
            <X aria-hidden="true" />
          </button>
        )}
        {/* What the one box actually covers. Shown on focus rather than crammed
            into the placeholder, where it was being truncated mid-list. */}
        <p id="dxh-scope" className={`dxh-scope${focused ? " is-on" : ""}`}>
          Guest · Driver · reference · address · flight · car
        </p>
      </div>

      <div className="dxh-pop" ref={popRef}>
        <button
          type="button"
          className={`dxh-btn${query.from || query.to ? " dxh-btn--on" : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Calendar size={15} strokeWidth={1.8} aria-hidden="true" />
          {rangeLabel(query.from, query.to, today)}
        </button>
        {open && (
          <DateCal
            period="range"
            fromDay={pendingFrom ?? query.from ?? ""}
            toDay={pendingFrom ?? query.to ?? ""}
            anchorDay={query.from ?? query.to ?? today}
            pendingFrom={pendingFrom}
            today={today}
            presets={presets}
            onPickDay={pickDay}
            onPickPreset={(f, t) => {
              push({ from: f, to: t });
              close();
            }}
            onDone={close}
          />
        )}
      </div>

      {/* Native selects on purpose: they are keyboard- and screen-reader-correct
          for free, they render as the platform's own picker on a phone, and this
          screen already has one popover to manage. */}
      <label className="dxh-sel">
        <span className="sr-only">Driver</span>
        <select
          value={query.driverId ?? ""}
          onChange={(e) => push({ driverId: e.target.value || null })}
          className={query.driverId ? "is-on" : undefined}
        >
          <option value="">Any Driver</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
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
        <span className="sr-only">Sort</span>
        <select value={query.sort} onChange={(e) => push({ sort: e.target.value as Sort })}>
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABEL[s]}
            </option>
          ))}
        </select>
      </label>

      {filtered && (
        <button
          type="button"
          className="dxh-btn dxh-btn--ghost"
          onClick={() =>
            startTransition(() => router.replace("/dispatch/history", { scroll: false }))
          }
        >
          Clear filters
        </button>
      )}

      <span className="dxh-spacer" />

      {/* A plain link, not an action: the export is the same query re-run on the
          server, so it downloads exactly the rows on screen — and a disabled
          button over an empty result is worse than one that yields a header row. */}
      <a
        className="dxh-btn"
        href={exportHref}
        aria-disabled={resultCount === 0 ? "true" : undefined}
      >
        <Download size={15} strokeWidth={1.8} aria-hidden="true" />
        Export CSV
      </a>
    </div>
  );
}
