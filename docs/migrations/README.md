# `docs/migrations/` — how to tell which file is LIVE

Every file here is applied to the live Supabase database, in the order they were run.
**They are named by date, and that is not enough.**

## ⚑ THE TRAP

Filenames sort **alphabetically**, not by apply order. The moment a single day carries more than one
migration, sorting by name gives you the wrong answer. On **2026-08-22** five migrations shipped:

| # | applied | file |
|---|---|---|
| 1 | first | `2026-08-22_pdp_curve.sql` |
| 2 | | `2026-08-22_accepted_fare.sql` |
| 3 | | `2026-08-22_opening_price_band.sql` |
| 4 | | `2026-08-22_amendment_keeps_ceiling.sql` |
| 5 | last | `2026-08-22e_repool_touches_nothing.sql` |

Sorted by name that reads `accepted_fare → amendment_keeps_ceiling → opening_price_band → pdp_curve` —
**exactly backwards at both ends.** A script doing that during S64 reported `driver_cancel_mission` as live
in `_pdp_curve.sql` when it is actually live in `_opening_price_band.sql`, two migrations later. Caught before
it did damage, but only just. The fifth file carries an `e` suffix so it sorts last; that is a patch, not a
convention.

## THE RULE

**Give a migration a real ordinal whenever a day carries more than one:**
`2026-09-01a_…`, `2026-09-01b_…`, `2026-09-01c_…`. A single migration on a day needs no suffix.

## DON'T RESOLVE "WHICH IS LIVE" BY READING FILENAMES AT ALL

Ask the database. It is the only source that cannot drift:

```bash
# does accept_mission take p_fare? then the 2026-08-22 version is live, not the 08-11 one
node --experimental-strip-types .local/probe/handoff-check.ts
```

For anything else, call the function through PostgREST and see what answers, or read
`pg_get_functiondef` in the Supabase SQL editor. A function's **live body is in Postgres**, not in whichever
file you happened to open.

## OTHER STANDING RULES

- **The schema is already applied.** Never re-run `docs/kavenue_schema.sql` (CLAUDE.md hard rule 4).
- **Claude cannot run DDL** — app keys go through PostgREST, which is rows only. Write the SQL here, hand the
  founder the one-liner, and they run it in the Supabase SQL editor.
- **Migrations land BEFORE the code that needs them.** The app must be correct both before and after.
- **Postgres cannot patch a function body.** Changing one line means reproducing the whole function with
  `create or replace`. Extract the live definition programmatically and diff your version back against it —
  never retype it. S64's five migrations were all built and verified that way.
