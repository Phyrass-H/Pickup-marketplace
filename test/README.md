# Tests — the money functions

```bash
npm test          # the whole suite
npm test -- test/spend.test.ts       # one file
```

No test framework, no new dependency: Node 22 runs TypeScript directly and ships
its own test runner. `register.mjs` teaches Node the `@/…` import alias so the
tests import **the same modules the app imports** — there is no compiled copy of
the money rules that could drift from the real one.

## Why these functions first

An adversarial audit of the Spend page — code that had already been shipped *and*
verified by hand — found 17 real defects, **three of them wrong money**. The worst
was the view a hotel lands on by default: it compared 8 days of one month against
31 of another and painted the gap green. Every month. For every hotel.

The lesson was not "look harder". Hand-verification proves a number once, on one
data set, on one day; it holds nothing in place afterwards. So the rules that
decide what someone is paid or billed are pinned here:

| File | What it protects |
| --- | --- |
| `pdp.test.ts` | `settledFare` — the fare **frozen at accept**. `currentFare` climbing after a Driver took the trip is the S48b bug: a €70 job read €100 a week later, and a cancellation fee was struck against the wrong basis. |
| `cancellation.test.ts` | The D45 fee ramp, the D48 waiting meter and its ceilings, the airport predicate (the accented-`Aéroport` miss that cost every airport pickup 40 minutes of paid wait), and the no-show clock origin (the S41 exploit: arrive 33h early, wait out the window, charge a full fare before the trip). |
| `spend.test.ts` | `rowCost` · `spendTotals` — what a Business is told it spent, and what is deliberately excluded: an unfilled mission, and a trip a Driver never closed (§ Q). |
| `spend-filter.test.ts` | `currentSpan` / `comparisonSpan` — the pair is only correct if both sides always cover the **same number of days**. Most of that file asserts exactly that. |
| `earnings.test.ts` | The Paris period calendar (a week starts Monday; a DST day is 23 or 25 hours long) and `totalsFor` — what a Driver made. |
| `history-filter.test.ts` | `historyFare`, the archive filters, and the cross-screen invariant: **History's total and Spend's total cannot disagree about the same filter.** |

## Conventions

- **Build rows with `support/factories.ts`**, never by hand. The defaults are a
  boring €100-ceiling transfer with no fees; every euro in a test is one the test
  put there.
- `row()` derives `fare`/`counted` through the real `historyFare`. Setting them by
  hand would let a test agree with itself while the app disagreed.
- **Pass an explicit `now`.** Anything reading the wall clock passes on the day
  you write it and fails in November.
- PostgREST returns `numeric` as a **string**. Several tests pass `"12"` where a
  number is expected on purpose — `70 + "12"` is `"7012"`, and that is a shipped
  bug in waiting.

## What this does NOT cover

These are pure functions. The **RPCs** (`accept_mission`, the four cancel/no-show
paths, `mission_waiting()`) are SQL, are not exercised here, and remain verified
only by live probing — `RPC writes a fee → the page reads it` is still untested
end to end. React components are also out of scope.
