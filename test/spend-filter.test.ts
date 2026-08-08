// The Spend period pair — currentSpan and comparisonSpan.
//
// ⚑ These two exist because of the worst defect the audit found. The mission
// query only ever returns trips that have happened, but periodRange returns the
// whole calendar month — so the default landing view measured 8 days of August
// against all 31 of July, called it a 77% drop, and painted it GREEN. Every
// month. For every hotel. The pair below is only correct if both sides always
// cover the SAME number of days; that is what most of this file asserts.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  comparisonSpan,
  currentSpan,
  parseSpendQuery,
  queryForSpan,
  spendHref,
  type SpendQuery,
} from "@/lib/spend-filter";

// A fixed "now": Saturday 8 August 2026, 10:00 Paris. Eight days into the month.
const NOW = new Date("2026-08-08T08:00:00.000Z");

/** A parsed query, exactly as the page would receive it from the URL. */
const q = (sp: Record<string, string> = {}): SpendQuery => parseSpendQuery(sp, NOW);

describe("parseSpendQuery", () => {
  test("no params → this month, compared with the previous one", () => {
    const parsed = q();
    assert.equal(parsed.period, "month");
    assert.equal(parsed.anchor, "2026-08-01");
    assert.equal(parsed.from, "2026-08-01");
    assert.equal(parsed.to, "2026-08-31");
    assert.equal(parsed.cmp, "prev");
    assert.equal(parsed.dim, "type");
    assert.equal(parsed.lens, null);
  });

  test("a real ?p= is honoured, not overridden by the default", () => {
    const parsed = q({ p: "day", d: "2026-07-10" });
    assert.equal(parsed.period, "day");
    assert.equal(parsed.from, "2026-07-10");
    assert.equal(parsed.to, "2026-07-10");
  });

  test("garbage falls back to the defaults rather than through", () => {
    const parsed = q({ cmp: "sideways", dim: "colour", lens: "vibes" });
    assert.equal(parsed.cmp, "prev");
    assert.equal(parsed.dim, "type");
    assert.equal(parsed.lens, null);
  });

  test("the real values are kept", () => {
    const parsed = q({ cmp: "year", dim: "driver", lens: "waiting" });
    assert.equal(parsed.cmp, "year");
    assert.equal(parsed.dim, "driver");
    assert.equal(parsed.lens, "waiting");
  });

  test("History's own vocabulary comes through untouched", () => {
    const parsed = q({ filter: "cancelled", q: "negresco", sort: "high", cat: "van" });
    assert.equal(parsed.outcome, "cancelled");
    assert.equal(parsed.q, "negresco");
    assert.equal(parsed.sort, "high");
    assert.equal(parsed.category, "van");
  });
});

describe("currentSpan — clamped to today", () => {
  test("the current month holds only the days that have happened", () => {
    const span = currentSpan(q(), NOW);
    assert.equal(span.fromDay, "2026-08-01");
    assert.equal(span.toDay, "2026-08-08", "not the 31st — those days do not exist yet");
    assert.equal(span.partial, true);
    assert.equal(span.days, 8);
  });

  test("a finished month is not clamped", () => {
    const span = currentSpan(q({ p: "month", d: "2026-07-01" }), NOW);
    assert.equal(span.fromDay, "2026-07-01");
    assert.equal(span.toDay, "2026-07-31");
    assert.equal(span.partial, false);
    assert.equal(span.days, 31);
  });

  test("today is one day, not a partial one", () => {
    const span = currentSpan(q({ p: "day", d: "2026-08-08" }), NOW);
    assert.equal(span.days, 1);
    assert.equal(span.toDay, "2026-08-08");
    assert.equal(span.partial, false, "the period ends today; there is nothing to clamp");
  });

  test("the running week stops at today", () => {
    // 8 August 2026 is a Saturday; the ISO week opened on Monday the 3rd.
    const span = currentSpan(q({ p: "week", d: "2026-08-08" }), NOW);
    assert.equal(span.fromDay, "2026-08-03");
    assert.equal(span.toDay, "2026-08-08");
    assert.equal(span.days, 6);
  });

  test("the running year stops at today", () => {
    const span = currentSpan(q({ p: "year", d: "2026-01-01" }), NOW);
    assert.equal(span.fromDay, "2026-01-01");
    assert.equal(span.toDay, "2026-08-08");
    assert.equal(span.partial, true);
  });

  test("a hand-picked range is clamped the same way", () => {
    const span = currentSpan(q({ p: "range", from: "2026-08-01", to: "2026-08-31" }), NOW);
    assert.equal(span.toDay, "2026-08-08");
    assert.equal(span.days, 8);
  });

  test("a range wholly in the past is left alone", () => {
    const span = currentSpan(q({ p: "range", from: "2026-07-01", to: "2026-07-10" }), NOW);
    assert.equal(span.fromDay, "2026-07-01");
    assert.equal(span.toDay, "2026-07-10");
    assert.equal(span.days, 10);
    assert.equal(span.partial, false);
  });
});

describe("comparisonSpan — the same number of days on both sides", () => {
  test("8 days of August are compared with 8 days of July, not 31", () => {
    const here = currentSpan(q(), NOW);
    const there = comparisonSpan(q(), NOW);
    assert.equal(there?.fromDay, "2026-07-01");
    assert.equal(there?.toDay, "2026-07-08");
    assert.equal(there?.days, 8);
    assert.equal(there?.days, here.days, "a part-month against a whole one is not a comparison");
  });

  test("the truncated span is labelled by its real dates", () => {
    assert.equal(comparisonSpan(q(), NOW)?.label, "1 July – 8 July");
  });

  test("two finished months are compared in full", () => {
    const query = q({ p: "month", d: "2026-07-01" });
    const here = currentSpan(query, NOW);
    const there = comparisonSpan(query, NOW);
    assert.equal(here.days, 31);
    assert.equal(there?.fromDay, "2026-06-01");
    assert.equal(there?.toDay, "2026-06-30");
    assert.equal(there?.days, 30, "June is 30 days long; that is a calendar fact, not a bug");
  });

  test("vs last year truncates too", () => {
    const query = q({ cmp: "year" });
    const there = comparisonSpan(query, NOW);
    assert.equal(there?.fromDay, "2025-08-01");
    assert.equal(there?.toDay, "2025-08-08");
    assert.equal(there?.days, currentSpan(query, NOW).days);
  });

  test("comparison off → nothing to compare", () => {
    assert.equal(comparisonSpan(q({ cmp: "none" }), NOW), null);
  });

  test("a custom range compares against the same LENGTH, not a calendar month", () => {
    const query = q({ p: "range", from: "2026-07-01", to: "2026-07-10" });
    const there = comparisonSpan(query, NOW);
    assert.equal(there?.fromDay, "2026-06-21");
    assert.equal(there?.toDay, "2026-06-30");
    assert.equal(there?.days, 10);
  });

  test("a custom range vs last year keeps its own ends", () => {
    const query = q({ p: "range", from: "2026-07-01", to: "2026-07-10", cmp: "year" });
    const there = comparisonSpan(query, NOW);
    assert.equal(there?.fromDay, "2025-07-01");
    assert.equal(there?.toDay, "2025-07-10");
  });

  test("a range running into today is truncated on both sides", () => {
    const query = q({ p: "range", from: "2026-08-01", to: "2026-08-31" });
    const here = currentSpan(query, NOW);
    const there = comparisonSpan(query, NOW);
    assert.equal(here.days, 8);
    assert.equal(there?.days, 8);
    assert.equal(there?.fromDay, "2026-07-01");
    assert.equal(there?.toDay, "2026-07-08");
  });

  test("every period the UI offers compares like with like", () => {
    for (const p of ["day", "week", "month", "year"]) {
      for (const cmp of ["prev", "year"]) {
        const query = q({ p, d: "2026-08-08", cmp });
        const here = currentSpan(query, NOW);
        const there = comparisonSpan(query, NOW);
        assert.equal(there?.days, here.days, `${p} / ${cmp}`);
      }
    }
  });
});

describe("queryForSpan — the comparison runs the same filters", () => {
  test("re-points the period and keeps everything else", () => {
    const query = q({ q: "negresco", cat: "van", filter: "completed", sort: "high" });
    const re = queryForSpan(query, { fromDay: "2026-07-01", toDay: "2026-07-08", label: "", days: 8 });
    assert.equal(re.period, "range");
    assert.equal(re.anchor, null);
    assert.equal(re.from, "2026-07-01");
    assert.equal(re.to, "2026-07-08");
    assert.equal(re.q, "negresco");
    assert.equal(re.category, "van");
    assert.equal(re.outcome, "completed");
    assert.equal(re.sort, "high");
  });
});

describe("spendHref — a clean view is a clean URL", () => {
  test("the defaults are not written", () => {
    assert.equal(spendHref(q()), "?p=month&d=2026-08-01");
  });

  test("only what differs is written", () => {
    assert.equal(spendHref(q(), { lens: "waiting" }), "?p=month&d=2026-08-01&lens=waiting");
    assert.equal(spendHref(q(), { cmp: "none", dim: "driver" }), "?p=month&d=2026-08-01&cmp=none&dim=driver");
  });

  test("round-trips through the parser", () => {
    const original = q({ p: "range", from: "2026-07-01", to: "2026-07-10", cmp: "year", dim: "class", lens: "noshow", q: "AF1234" });
    const href = spendHref(original);
    const reparsed = parseSpendQuery(Object.fromEntries(new URLSearchParams(href.slice(1))), NOW);
    assert.deepEqual(reparsed, original);
  });

  test("with no date filter at all it is only the extras", () => {
    const bare = { ...q(), period: null, anchor: null, from: null, to: null } as SpendQuery;
    assert.equal(spendHref(bare), "");
    assert.equal(spendHref(bare, { lens: "unfilled" }), "?lens=unfilled");
  });
});
