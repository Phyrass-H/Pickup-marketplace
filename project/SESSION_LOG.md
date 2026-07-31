# Kavenue — Session Log

> Append-only, newest at top. One entry per working session. Keep it short:
> what changed, what was decided, what's next.

---

## 2026-07-31 — Session 51 — EXPIRED TRIPS: the missing protocol (BACKLOG § P, [[d62]])

**Scope.** The founder picked § P — item **A** of the three things they'd found by using the app. Five decisions were
open in the backlog; three of them changed what gets built, so I asked those and inferred nothing: expiry moment
(**exactly `pickup_at`**, no grace), where it lands (**stays on the schedule until the day ends**), re-post (**not now**).

**State on arrival, measured not assumed.** 34 missions; **23 pooled, every one past due**, oldest 2026-06-17 (44 days);
**zero** rows had ever been `expired`. `missionTone` had rendered the state since day one for nobody.

**⚑ The sharp edge.** `accept_mission` checked `status = 'pooled'` and not the time. Accepting a dead booking would
have produced a confirmed, priced trip that the whole O7 fee machinery ([[d45]]/[[d48]]) would then treat as real.

**Built.** Migration `2026-07-31_expired_missions.sql`: widen `status_event_status_check` to allow `'expired'`; a
`create or replace` of `accept_mission` adding one time check **inside the existing row lock** (everything else
byte-identical to the D55 version); and `expire_stale_missions()`, a `SECURITY DEFINER` sweep flipping `pooled → expired`
and inserting the `status_event` in **one statement** (a data-modifying CTE chain, so a row can't be expired without its
timeline entry). App: new `lib/expiry.ts` `sweepExpiredMissions()` called on the Pool + Dispatch schedule reads; a
`.gt("pickup_at", now)` floor on the Pool query (**including under `?all=1`**); `isExpired()` exported from
`lib/dispatch-status.ts` and used by `missionTone`, the trip-row Share lock, the "Edit details" gate and
`/missions/[id]`; an `expired` branch in `friendlyAcceptError`.

**No cron, on purpose.** Vercel Hobby caps cron at once per **day** — useless for a T-0 rule — and [[d61]]'s T-180
reminder needs a real scheduler regardless. Building half a scheduler here would have meant redoing it. The RPC is
idempotent, its UPDATE normally matches zero rows, and it **never throws** — which is what let the app deploy ahead of
the migration (confirmed in the browser: `Could not find the function…` logged, page rendered fine).

**Why `missionTone` also derives it.** The sweep runs on two pages; the calendar, the history and deep links don't
sweep. Without the display-level rule the founder's original complaint would have stayed true on the calendar.

**Verification (live, real Supabase DB, 34-mission baseline restored after).** Sweep closed **23 with 23 timeline rows**,
returns 0 on a second call. **A genuine UI race:** staged a trip 75s out → Accept rendered → clicked it **96s after** the
pickup passed → RPC raised, UI showed *"This mission expired — its pickup time has passed."* The sweep then caught that
newly-stale row on the next Pool read (timeline 23 → 24). Happy path: a +3d trip accepted → `confirmed` immediately
([[d55]] intact). Business schedule: **18 Expired rows** with the red wash. `tsc` + `next build` green (24 routes).
Deployed `d7e06d4` → Vercel `success`.

**⚑ Process note — my own error cost two round-trips.** I handed the founder a `bash` block (`open …`, then `pbcopy …`)
immediately above the words "paste this into the SQL editor"; they pasted the shell command into Postgres twice and got
`42601`. They then asked what a shell command even is — a fair question I should never have made them ask. **Name the
destination before the block, and give SQL as SQL.**

**⚑ Left open, deliberately:** an expired trip counts nowhere (fill rate needs § F2). And the third time now that a
feature has been found two-thirds built and unreachable — `reclaim_mission` after [[d55]], the check-in pill in
[[d61]], `expired` here. Worth a sweep for others.

**Noticed, not touched:** the Dispatch day headers render French (*"Samedi 11 Juillet"*) inside the English app — same
family as the French date picker already queued as item 2.

### Part C — the Earnings period picker + a custom range (item B of the founder's list; [[d64]]; deployed `684ae82`)

**Root cause, and it was a design decision not a slip.** `earnings-period.tsx` rendered a real `<input type="date">`,
hid it (`opacity: 0`, 1px, **`pointer-events: none`**) and drove it with `showPicker()`. Both reported symptoms fall
straight out of that: on a phone `showPicker()` on a non-interactive input does nothing, so the label was dead; on a
desktop the native calendar anchors to an invisible 1px box the user can't click away — "won't close". Probed live:
`showPicker()` also throws `NotAllowedError` without a gesture, so an uncaught throw in the handler was a second way
to fail silently. **And it was a dead end anyway** — `<input type="date">` cannot express a range, which was the other
half of the ask. So the native control is gone entirely rather than patched.

**Built.** The app's own calendar, deliberately the same shape as `components/date-time-picker.tsx` but NOT shared
code: that one is future-only + single-date, this one past-only + span. Merging them is a fair follow-up; doing it
inside a bug fix would have meant editing the money-critical mission form. New `lib/use-dismiss.ts` listens on
**`pointerdown`** (the old inline hook in the mission picker used `mousedown` only) — that is the actual mobile fix,
and the mission form should adopt it too. A 5th period `range`: two taps in either order, `?p=range&from=&to=`, with
the **‹ › arrows removed** rather than disabled. Presets: last 7 / last 30 / this month / **all time** (hidden when
the Driver has no history — `loadFirstDay()`). The band finally makes the pre-existing "granularity decides what a
tapped day means" rule *visible*: Month lights the whole month.

**⚑ Comparisons needed a new shape.** A custom span can't be expressed as an anchor, so `Range` gained
`prevCustom`/`lastYearCustom`. "The period before" is the **same-length** span ending the day before it starts —
comparing 46 days against a calendar month would be a lie wearing a real comparison's clothes. Copy borrows a neutral
`"period"` noun for range, since "the range before" and "same range last year" are nonsense.

**⚑ `parseDayParam` rejects 31 February.** `new Date(Date.UTC(y, 1, 31))` rolls over to 2/3 March silently, which
would have shifted a Driver's chosen span by days with no error anywhere. Reversed `from`/`to` is normalised rather
than rendered as zero earnings; an incomplete range URL falls back to the week.

**Verified live** on both viewports: tap opens · outside-tap and Escape close · two-tap range → "5 July – 20 July ·
16 days" · All time → "17 June – 31 July · 45 days", 265,00 €, 3 trips, and the comparison chip reads correctly with
the neutral noun · reversed URL normalised · `from=2026-02-31` falls back to Week with the arrows back. `tsc` +
`next build` green.

**⚑ Measurement trap worth remembering:** reading the DOM synchronously right after `.click()` shows the *old* state —
React hasn't re-rendered yet. I twice concluded the popover "wasn't opening" when it was; the third check, deferred by
120ms, showed it open. **Assert on React UI only after a tick.**

**Part C2 — the grid matches the period (founder's follow-up, deployed `df54770`).** The founder asked for the arrows
to step by period instead of always by month. **The arrows were the symptom:** the calendar always rendered DAYS, so
Month mode had you tap the 14th to mean "July" and Year mode had you tap any day at all to mean "2026" — it collected
information it discarded, and reaching 2024 took ~30 taps on ‹. Fixing the grid fixed the arrows for free. Month → a
12-month grid stepping a year; Year → a 12-year grid stepping 12 years; Day/Week/Range keep days and month steps,
because there the day is the unit or genuinely sits in the month on screen. **Year blocks END at the current year**
(2015–2026) rather than aligning to a calendar decade — a Driver's history runs backwards from today, so the default
block holds the data and no cell is spent on the future. The "pick any day — you'll get its X" footnote now shows for
**Week only**: it was a tautology in Day and is false in Month/Year. Month cells sliced to 3 chars (en-GB renders
"Sept" while every other month is 3 letters). Verified live across all five modes.

**⚑ The generalisable bit:** the founder asked for a control tweak; the actual defect was that the control was asking
the wrong question. Worth checking for the same shape elsewhere — a widget collecting precision the model then throws
away.

### Part B — Dispatch History, done properly (same day, [[d62]] cont.; deployed `73d7102`)

**Why it followed.** The founder's next question was whether the Business keeps a trace of an unfilled trip. It does —
18 rows already showed in History — but they said the screen "was never properly done", and they were right: 95 lines,
no filters, no counts, no per-view empty state. The Driver's Past tab got that in S47 ([[d56]]); this side never did.
So the expiry work had made a question answerable that the UI still couldn't ask.

**D25 loop honoured.** Mockup from the real tokens + the real July rows → founder amended the wording → built to match.

**Built.** `FILTERS` = All / Completed / **Unfilled** / Cancelled as server-side `?filter=` links, reusing the Driver's
`.rfilter`/`.rchip` (not a second control). **Counts are computed from the full set before narrowing** — a count that
moved with the active filter would force a click to discover an empty bucket. Plus a `.dxh-sum` one-liner and a
`.dx-count__bad` per-month failure count, both rendered only when non-zero, and the month suffix suppressed while the
Unfilled filter is active (redundant there). Two distinct empty states: never-any-history vs this-filter-is-empty.
A **no-show buckets under Completed** (`mark_no_show` pays the Driver in full) — same call `rides/history` makes.

**⚑ The wording fix, which is the part worth remembering.** "Expired" described the record, not the hotel's problem.
The founder chose **"Unfilled"** — and spotted that renaming the Schedule's live warning to **"No Driver yet"** frees
that word up. The two had both read "Unfilled": one a warning you can still act on, one a final outcome. That is the
single pair of labels a Dispatcher must never confuse, and it had shipped that way since S39. "No Driver yet" also
happens to match the Driver bar's pre-existing `No Driver yet · in the Pool`.

**⚑ The chip counts deliberately do not sum to All (3 + 18 + 0 ≠ 28).** The 8 past trips still sitting
`confirmed`/`on_board` have **no ending in the model** — accepted and never closed, one `on_board` for 36 days. The
founder declined a 5th bucket, so they appear under All and nowhere else, visibly. Hiding them would have implied we
handle them. **This is the next open question and it is a money question:** what does an abandoned trip cost, and who
pays? § P closed the *unfilled* hole; the *abandoned* one is untouched.

**Verified live:** Unfilled → 18 rows, month counts recomputed (7 + 11), suffix suppressed; Cancelled → 0 rows with its
own empty state and the chips still reachable; a staged 2h-out trip renders amber **"No Driver yet"** while a 30h-out
one stays **"In the Pool"**. DB restored to baseline. `tsc` + `next build` green.

---

## 2026-07-30 — Session 50 — CHECK-IN restored, and the fee hole that kept the take-back parked ([[d61]])

**Scope.** The founder ruled out the back-office and notifications for now — *"I need to have a complete functional
system between the Dispatch and the Driver and all UI done"* — so I audited what is actually open on that loop and read
the code rather than the notes. Top of the list: the Business's T-60 take-back is **dead code**. `trip-row.tsx` gates it
on `status === "accepted"`, which [[d55]] made unreachable. The founder's reply reframed it: *"At T-180 the system sends
a notification reminder to the driver, he has to confirm it, if not, at T-60 the dispatch has access to a button."* Same
feature — they were describing the design, I was describing the state.

**The archaeology.** That design shipped two-thirds built in S39 and then lost its other third. See [[d61]]; the short
version is that the pill, the hint and the red row wash all exist and have rendered for nobody since S46.

**⚑ I listed the take-back as buildable and had to withdraw it.** The S47 trigger — *"the Driver hasn't started"* — fires
on a Driver who simply intends to leave at 17:40 for an 18:00 pickup, turning a **90%** business-cancel fee into **0%**
one hour before every trip. The distinguishing signal is a response test, which needs push. Raised before any code;
the founder took the safe half.

**Built (9 files + 1 migration `2026-07-30_mission_check_in.sql`):** `mission.checked_in_at`; `checkInOpen()` +
`CHECK_IN_OPENS_MS` / `CHECK_IN_GRACE_MS` and a rewritten `confirmed` branch in `lib/dispatch-status.ts`; an explicit
`wash` flag on `MissionTone` driving a new `.dx-trip--warn` beside the existing `.dx-trip--alert`; `checkIn()` in
`rides/actions.ts` (+ implicit check-in on `en_route`); `components/check-in-card.tsx`; a flag on the My Rides list; a
count badge on the tab bar, counted in `app/(app)/layout.tsx`.

**Two decisions worth keeping.** No countdown copy on the check-in card — a live "pickup in 2h 47m" needs the client
clock and is how S33 shipped a hydration mismatch; the pickup time is already at the top of the card. And the badge is
computed in the **layout**, not the page, so it follows the Driver around the app: with no push, the badge *is* the
notification.

**⚑ Caught by probing, not by reading.** `within1h` (`pickup <= now + 1h`) is also true for a pickup in the **past**, so
six stale still-`confirmed` demo trips went red on the schedule alongside the three deliberate test rows. Bounded with a
1h grace in all three places (`missionTone`, `checkInOpen`, the badge query). Deployed as its own commit `aa18778`.

**⚑ Test-harness trap, recorded so the next session doesn't repeat it.** `?as=driver` signs in as
`demo.driver@pickup.local`, which maps to the **Marc Dubois** driver row — *not* the row whose `email` column reads
`s46.driver@pickup.local` ("Demo Driver"). I reassigned the test trips to the wrong driver on that assumption and got
three empty pages. The `driver.email` column is not the dev-login identity; `driver.auth_user_id` is.

**Verified live** on 3 tagged trips (T-2h / T-30m / T-8h) through real authenticated sessions on both subdomains: both
row washes, all four pill states, the badge counting 2 → 1, the button absent beyond 3h, `en_route` clearing the
warning, and 5 guards including a Driver being **denied** a direct PATCH of `checked_in_at`. DB restored to its
34-mission baseline, 0 leftover rows. Deployed `c6f13a0` + `aa18778` → Vercel `success`.

**⚑ Founder testing, 2026-07-31 — three findings, all recorded, none built:**
1. **The Pool is entirely stale.** 23 of 23 pooled missions have a pickup in the past (oldest 44 days); nothing has ever
   been marked `expired`. The status exists and `missionTone` renders it, but no code writes it and the Pool query has
   no time floor. **`accept_mission` has no time check either**, so a Driver can accept a dead trip and create a live
   priced obligation. Spec + the 5 open decisions → **BACKLOG § P**. The guard needs no scheduler; the sweep shares
   D61's.
2. **Driver Earnings:** no date-range filter, the calendar won't close on desktop, and it doesn't respond on mobile
   (`components/earnings-period.tsx`, `showPicker()` + focus fallback).
3. **Dispatch-side earnings/spend** wanted — mirror [[d59]] (BACKLOG § F).

**⚑ And a confirmation that matters:** the founder tested the "default vehicle class is ignored" item and reported
Business *was* selected. It is a **coincidence** — `service-class-fields.tsx:41` falls back to a hardcoded `"business"`
with no draft, and to `""` for the body (hence Sedan unselected). The setting is genuinely never read. Worth knowing
before someone "verifies" this is already working.

**Also this session:** the domain + email migration to `kavenue.fr` ([[d60]]) — logged separately under Session 49 —
and two scoping conversations that produced **BACKLOG § O** (trust & safety) and the parked **Guest touchpoint** idea.

---

## 2026-07-29 — Session 49 — THE DOMAIN MOVES TO kavenue.fr, and Kavenue gets email ([[d60]])

**Scope set by the founder, not the menu.** S49 opened with the A/B/C/D choice from `NEXT_SESSION.md`; the founder
picked none of them — *"before we are going further we have to update the domain name, I have bought kavenue.fr"* —
plus real mailboxes. This closes the gap the S44 rename left open: the product was called Kavenue but lived at
`pickupbedriven.com`.

**Answers that set the shape** (asked up front, three questions): registrar **OVHcloud** · email **Google Workspace** ·
old domain **full cutover**.

### Code (5 files, no schema, no behaviour change) — `0306bb7`, then `bce11e6`
- **`lib/hosts.ts`** — `PROD_BASE` → `kavenue.fr`. During the migration `isProdDomain()` checked a `PROD_DOMAINS` list
  accepting **both** domains while `originForRole`/`devLoginHref` still generated `PROD_BASE` URLs, so the old domain
  *funnelled onto* the new one and there was no switchover instant. Reverted to the single-domain check in `bce11e6`
  once every hostname was verified.
- **`support@` / `feedback@` mailto** → `kavenue.fr` (`components/help-legal-card.tsx`,
  `app/(dispatch)/dispatch/settings/page.tsx`). The stale comment claiming the addresses were placeholders is gone.
- Comment headers in `app/page.tsx` + `components/landing-splash.tsx` (the latter already imported `PROD_BASE`, so it
  followed automatically).
- **Sequencing that mattered:** DNS first, deploy second. Deploying while `kavenue.fr` was unresolved would have pointed
  live role-redirects at a dead host. Written into the runbook as a gate, not left as tribal knowledge.

### Infrastructure (founder-executed, Claude-verified at every gate)
Vercel: 4 domains, apex primary (**declined** Vercel's "redirect apex to www" default), `www` → 308 → apex, old
domains removed, project renamed `pickup-marketplace` → **`kavenue`**. OVH: parking A/AAAA/MX/SPF/ftp deleted, then
A + 3 CNAME + MX + SPF + DKIM + DMARC. Supabase: Site URL + 5 redirect URLs. Google Workspace: one user
`phyrass@kavenue.fr` + 3 free aliases, 2FA on.

### Verification — every gate probed, and two probes changed the plan
- **Vercel's DNS values were read off the panel, not assumed.** They were **not** the widely-documented
  `76.76.21.21` / `cname.vercel-dns.com` but a per-project `216.198.79.1` /
  `b995c589bd56b1fa.vercel-dns-017.com`. Guessing would have cost an hour.
- **An IPv6 false alarm, correctly dismissed.** `dig` returned an AAAA (`64:ff9b::d8c6:4f01`) for the apex — that is
  a NAT64/DNS64 *synthesis* of the A record by the local resolver (`d8c6:4f01` = `216.198.79.1`), not a zone record.
  Querying `dns106.ovh.net` directly returned nothing, which is the correct state.
- **The Mapbox step turned out to be a no-op.** Probing the geocoding API with referers `kavenue.fr`, the old domain,
  and *none* all returned 200 — a restricted token rejects the no-referer case, so the token was never restricted at
  all and nothing was gating the new domain. Step skipped, and the real finding logged instead (below).
- **DKIM proved twice.** Base64-decoded the published key and parsed it with `openssl` → valid **2048-bit RSA**, so the
  paste wasn't truncated (the usual DKIM failure). That still can't prove it's the *right* key — the real proof was
  `dkim=pass header.i=@kavenue.fr header.s=google` on a received message, with `spf=pass` and `dmarc=pass` beside it.
- Build output grepped: the only `pickupbedriven` string that shipped during the window was the deliberate
  `PROD_DOMAINS` constant; every `mailto:` resolved to `kavenue.fr`. After `bce11e6`, zero.
- Old domain → **404**. Cert: Let's Encrypt, valid to 2026-10-27. Both dev-logins hold **separate simultaneous
  sessions** on `driver.` and `dispatch.` — the host-only cookie split survived the move, which was the whole point of
  the subdomain design.

### ⚑ The OVH trap (worth remembering for `kavenue.com`)
A fresh OVH zone ships with its own **MX**, an **SPF** (`include:mx.ovh.com -all` — a *hard fail* that would have
blocked Google from sending as you), a parking **A**, an **AAAA**, and an `ftp` CNAME. Two subtleties: OVH files SPF
under its own record **type**, so it survives a "delete the TXT records" pass; and the **AAAA** is the dangerous one —
Vercel issues only an IPv4 A record, so a leftover AAAA sends IPv6 visitors to a parking page while the site looks
perfect to you over IPv4. Also: the **NS** records must be kept (deleting them takes the domain offline), and OVH's
"Overview of the recording" preview line is the reliable way to confirm `@` resolved to the bare domain and not
`@.kavenue.fr`.

### ⚑ Open / follow-ups
- **The Mapbox public token has no URL restrictions.** It ships in the JS bundle by design, so anyone can lift it and
  spend the quota. Mapbox's auto-created *Default public token* can't be meaningfully restricted — the fix is a **new**
  public token with restrictions, swapped into `.env.local` **and** Vercel, then a redeploy. ~30 min, not blocking.
  Logged in `DOMAIN_MIGRATION.md` step 5.
- **DMARC is at `p=none`** (monitor only) on purpose. Tighten to `quarantine` then `reject` once the `rua` reports show
  only your own senders — jumping straight to `reject` on a fresh domain bins your own mail.
- **`pickupbedriven.com` is removed from Vercel but still registered.** Worth ~€10/yr to keep parked; founder's call.
- **Transactional email (Resend, deferred phase) should send from a subdomain** — `send.kavenue.fr` with its own
  SPF/DKIM — so mission-alert volume never touches the reputation of the human mailbox. Noted in the runbook.

**Runbook:** `project/DOMAIN_MIGRATION.md` — 14 steps, each marked **[YOU]** or **[CLAUDE]** with a "done looks like"
gate. Written so `kavenue.com` later is the same file with one word changed.

**Session 50 is still the S49 menu** (back-office / notifications / pricing / the small ones) — untouched, nothing
consumed from it.

---

## 2026-07-28 — Session 48b — EARNINGS, and the fare freeze it exposed ([[d59]])

**Scope (founder-set).** "Simple but efficient", one-car independent Driver, **no charts**, filters by period, and a
comparison against the same period last year. D25 loop: mockup (week / month / quiet week) → founder feedback → a
second mockup for the date picker → sign-off → build.

**The bug found before building.** Probing the real DB showed a completed trip reading **€100** whose fare at accept was
**€70**: `currentFare()` climbs to `now`, so a finished trip keeps getting more expensive. New `settledFare()` freezes
the curve at `accepted_at` (falls back to the live fare when never accepted, so it's a safe drop-in). Swapped into every
**display** read of an assigned trip — `rides/page.tsx`, `rides/history/page.tsx`, `mission-run-view.tsx`,
`trip-row.tsx` (the Dispatch scan value), `dispatch/calendar/page.tsx`. **Left alone on purpose:** `p_fare_snapshot` on
cancel/no-show and the amendment from-fare — those set the euro basis of a penalty, which is founder-owned pricing
(BACKLOG § H2). Verified live: the Past tab now renders 70,00 € and no longer contains 100,00 €.

**Files.** New `lib/earnings.ts` (Paris-correct period maths — `parisMidnight` via a two-pass offset read so a DST
boundary can't shift a bucket, Monday-first weeks, `periodRange` returning label + prev/next/last-year anchors +
`isCurrent` — and the money: `totalsFor` / `missionAmount`), new `components/earnings-period.tsx` (segmented Day/Week/
Month/Year + ‹ › + the label opening a real-but-invisible `<input type=date>` via `showPicker()`; `display:none` would
make showPicker throw), rewritten `app/(app)/earnings/page.tsx` (was a "coming soon" placeholder), `lib/pdp.ts`
(`settledFare`), `app/globals.css` (`.eper*`, `.etotal*`, `.ecmp`, `.eyear`, `.ebreak*`, `.eday`, `.etrip*`, `.ejump`).

**Three queries per view** — the period, the one before it, the same one a year ago. The year-ago line renders only when
it's non-zero, so it activates by itself once there's a year of history instead of reading "no data" until mid-2027.

**Verified live vs the real DB** (3 completed missions, the only money in the fleet): month June = **265,00 € = 70 + 120
+ 75** (the settled fares, not the ceilings) · day 18 June = 120,00 € / 19 June = empty · year 2026 = 265,00 € · current
week = the empty state with › disabled and no comparison chip. The segmented control, both arrows and the date input all
navigate and carry `?p=&d=` into the URL. No console errors. `tsc` + `next build` clean (the two build warnings are
pre-existing: supabase-js on the edge runtime, webpack cache).

**Copy corrections during the build:** the preview's commission line was cut on the founder's instruction (the Pool price
IS the Driver's price — see [[d59]]); "No trips this week" becomes "that week" once you step away from now; and the trip
route wraps to two lines rather than truncating to "Cannes → 16…".

**Then the founder closed the fee-basis question the same session** — *"If a driver accepted a trip why would the fare
keep climbing? The final fare … is the price that the Driver accepted."* So `settledFare` went into the fee snapshots
too: `p_fare_snapshot` on `driver_cancel_mission` / `mark_no_show` / `business_cancel_mission` /
`business_declare_no_show`, `p_from_fare`, and the amendment's `buildFromSnapshot`. BACKLOG § H2's fee-basis flag is now
**RESOLVED**; a new § H2 entry records the founder's next question (100% is a weak deterrent on a €50 trip).

**⚑ The bug of the session, caught by probing not reading.** After the change the cancel modal quoted €70 and
`mission_cancellation.fee_amount` still recorded **€100**. Cause: `settledFare` typed `accepted_at` as *optional*, and
both actions files select a narrow `FARE_COLS` list that didn't include it — so it fell back to `currentFare(now)`.
The diff looked completely correct. Fixed by adding `accepted_at` to both `FARE_COLS` **and making the parameter
required**, so a narrow select is now a compile error rather than a wrong penalty. (Same shape as the S42 airport-regex
bug: correct-looking code, wrong at runtime, only live probing found it — more evidence for the § H2 automated-tests
argument.)

**Verified live, both directions, on throwaway missions** (ZZTEST, ceiling €100, accepted at €70, deleted after):
driver cancel → quoted €70, recorded `fee_amount 70 / fare_snapshot 70`; business cancel at T−1.7h → quoted 58,15 €,
recorded `fee_pct 83.09 / fee_amount 58,17 / fare_snapshot 70` (the few cents are the % clock ticking between render and
RPC, not a basis error). DB restored to its 34-mission baseline, `reliability_marks` back to 0, no ZZTEST rows left.
Dispatch's scan label now reads **"Agreed fare"** once `accepted_at` is set, "Fare now" only while pooled.

---

## 2026-07-28 — Session 48 — the Driver ACCOUNT rebuilt: hub + sub-pages, documents with a lifecycle ([[d58]])

**Scope (founder-set).** "Make a real and complete settings page like a real app" — research driver apps, do documents
properly, photos you can frame. D25 loop: two interactive mockups (hub + documents + capture, then vehicles + grouped
documents + the accept-time car picker) → founder Q&A → sign-off → build.

**Research fed the design.** French VTC roadside requirements (carte VTC, carte grise, assurance, RC Pro, REVTC, visite
médicale) and how Uber structures a driver account (documents with expiry dates + colour-coded warnings; vehicles;
payment; app settings). The URSSAF *attestation de vigilance* was the find that changed scope — it's an obligation on
**Kavenue** as donneur d'ordre (≥ €5 000 HT, re-collected every 6 months, joint liability if missing).

**Migration** `docs/migrations/2026-07-28_driver_account_and_documents.sql` (founder ran it, confirmed): 3 new
`document_type` values (`kbis`, `urssaf_vigilance`, `medical_certificate`); `document.side` (+ CHECK) / `review_note` /
`vehicle_id` (+ index); `vehicle.is_active`; `driver.company_name` / `siret` / `vat_number`. Additive only — an earlier
draft that also added `mission.vehicle_id` and rewrote `accept_mission` for a car picker was **cut** with multi-vehicle.

**Routes (net-new).** `/settings` is now a hub; `/settings/{profile,area,vehicle,company,documents,navigation,payouts,help}`
+ `/settings/documents/[type]` (unknown type → 404). `updateDriverSettings` split into `updateProfile` / `updateServiceArea`
/ `updateVehicle` / `updateCompany` / `updateNavigation`, each redirecting to its own page; every save
`revalidatePath("/settings","layout")` because the hub's readiness strip is computed from all of them.

**Files.** New: `lib/driver-readiness.ts`, `lib/nav-links.ts`, `components/image-framer.tsx`, `document-capture.tsx`,
`document-icon.tsx`, `language-picker.tsx`, `seg-field.tsx`, `settings-header.tsx`. Rewritten: `lib/account.ts` (doc
groups + `DocMeta` + `docState`/`docStateLabel`/`blocksWork`), `lib/documents.ts` (per-side rows, expiry, review note),
`components/avatar-editor.tsx` (now composes `ImageFramer`). Touched: `lib/document-actions.ts` (side + expiry validation
+ `vehicle_id`), `driver-tabbar.tsx` (Settings → **Account**), `help-legal-card.tsx` (`variant="driver"`),
`mission-run-view.tsx` + `missions/[id]/page.tsx` (Navigate button), `lib/database.types.ts`, `app/globals.css`
(`.dset*`/`.dback`/`.dident`/`.dready*`/`.drow*`/`.ddoc*`/`.dstage`/`.dnav`/`.dchip--btn`, and Driver-scoped 13px/500
form labels).

**Verified live against the real Supabase DB** (dev-login Driver, 375×812): all 10 routes 200 (unknown doc type 404);
**a real document filed end-to-end** — inject photo → framer → crop/rotate → upload → storage object + `document` row
with `side='front'` and `expires_at` → state computed **"Expires in 21 days"** (expiring/warn) → front View link, back
Missing; **rejected state** (`review_note` set via service role) → red pill + the note + the side picker moving to the
rejected side (fixed with a remount `key` — a client `useState` kept the stale side); SIRET validation rejects 9 digits
and saves 14 space-stripped, VAT upper-cased; Navigate on a live `on_board` trip resolved to the **drop-off** in **Waze**
(the Driver's own preference). No console errors. `tsc` clean. Test document + storage object deleted afterwards.

**Two design corrections made during verification.** Nine filled navy "Add" buttons on a fresh account was a wall →
outlined CTAs. And `Add your ${label.toLowerCase()}` produced "Add your vtc card" → labels stay verbatim, blockers sort
above warnings.

**Deliberately not built:** multi-vehicle (see [[d58]]); document *verification* (the admin workspace is a deferred
integration — states are honest, nothing reviews them); notification reminders for expiring papers (the copy promises
them; they need the notifications phase); and enforcement — readiness is shown, never gated.

---

## 2026-07-26 — Session 47 — My Rides tabs + day separators + the Past archive (Guest data leaves a closed trip) ([[d56]])

**Scope (founder-set, ask-first honoured).** The Earnings screen was deferred again; the founder asked for My Rides
first: "the history is an ugly link in the header, I want proper tabs and a clean page", plus **date separators** on
the current list and **Guest details gone from past rides** (Dispatch keeps them). D25 loop: two previews
(v1 tabs+separators+past card, v2 empty states + the cancelled question) → signed off before any code.

**Founder decisions:** tab style **A** (segmented pill, not underline) · labels **Upcoming / Past** · **no money
totals** on Past (that's Earnings' job) · a **filter row inside Past**, NOT a third tab (Claude's recommendation:
three segments crowd a phone and a cancelled trip is rare).

- **Tabs (`components/rides-tabs.tsx`, new).** A segmented control replacing the `History →` corner link. Deliberately
  still **two routes** (`/rides` + `/rides/history`) so each keeps its own server query and every deep link (the
  `← History` back link on a finished trip) still lands — the tabs are `<Link>`s, no client state. Counts render only
  when > 0; the Past count is always the **whole archive**, never the filtered slice.
- **Upcoming (`app/(app)/rides/page.tsx`).** Day separators from consecutive runs of `parisDayKey` (single pass, the
  query is already ordered): **Today** (navy) / **Tomorrow** / **Friday 31 July**, each with a ride count. New
  `formatDayGroup()` in `lib/format.ts` reuses the DST-safe Paris calendar arithmetic from `formatPoolWhen` (a Paris
  day is 23h/25h twice a year). **Found in the browser, not in the mockup:** every card repeated "Today · 26 Jul"
  under a separator already saying Today — the card now shows **only the time**, at 15.5px (`.pcard__time--lg`).
- **Past (`app/(app)/rides/history/page.tsx`).** Rebuilt off the old `.card`/`.route`/`.fare` markup onto a new
  **`.pastcard`** — a record, not work: date + time, a small status pill, a 2-dot rail with **single-line** addresses,
  Business + fare in the foot. No progress bar, no state-first lead. Month groups reuse the same `.dday` separator.
  Filter chips `All | Completed | Cancelled` are server-side (`?filter=`), hidden when the archive is empty.
  A **no-show ends as `completed` + `no_show=true`** (mark_no_show pays the Driver the FULL fare), so it correctly files
  under Completed — the founder chose to leave it there rather than add a 4th chip.
- **Cancelled trips: who + how much (founder follow-up, same session).** Traced a structural fact worth writing down:
  **a Driver only ever sees a cancelled trip that the BUSINESS cancelled.** `driver_cancel_mission` / `respond_to_release`
  / `reclaim_mission` all re-pool (`status='pooled'`, `driver_id=null`), so those leave the Driver's app entirely; only
  `business_cancel_mission` goes terminal with `driver_id` intact. So the card now says **"Cancelled by the Business"**
  and shows **real money** — `mission.cancellation_fee` (the 50–100% curve) + any `waiting_fee`, both already stamped on
  the row by the RPC — labelled **"Compensation"** so it can't be read as the trip fare. Shared
  `cancelCompensation()` in `lib/cancellation.ts` (list + detail can't drift); a legacy pre-2026-07-13 row with no
  stamped fee still shows "—". **This replaced the blanket "—" shipped hours earlier** — that caution was unnecessary
  once the asymmetry was understood.
- **Guest data leaves a closed trip (the privacy rule).** Enforced **server-side**, not hidden in CSS: for a terminal
  owned mission `missions/[id]/page.tsx` **never queries `mission_guest_contact`** and passes `archived` to
  `MissionRunView`, which drops the Guest name row, the name board and the Business's private message (both can quote
  the Guest). Kept: date, route, fare, status, **Business + Dispatcher** — a business counterparty and the Driver's
  only route to a dispute, not Guest data. A `.dlock` line says so once, plainly. **Dispatch is untouched.**
- **Also fixed at the root:** `formatMonth` was `fr-FR`, so month headings read "Juillet 2026" above "Fri 24 July"
  rows. Now `en-GB` — matches the rest of the (English) UI; the two `textTransform: capitalize` hacks it needed are
  gone, including in Dispatch history.
- **New CSS** (`app/globals.css`): `.rhead` `.rtabs/.rtab` `.dday` `.rfilter/.rchip` `.pastcard*` `.dpill--danger`
  `.dpill--sm` `.dlock--foot` `.pcard__time--lg`. `statusPill()` gained a **`cancelled`** case (danger + `CircleX`).
  Muted greys held at `--text-muted` (AA on both the sunken track and the page) per the founder's contrast note.

**Verified live** (localhost, real Supabase DB, 375×812): a tagged 8-mission set (`reference='S47QA'`) on the
dev-login Driver exercised Today/Tomorrow/weekday separators, both empty states, all three filters, the cancelled
"—", and the no-show pill; the archived detail showed **no Guest name / phone / board / message** while the same data
on an `en_route` trip still renders in full (no regression). No console errors. **DB restored to the exact 34-mission
baseline** (same status distribution) — the fleet + scripts live in the session scratchpad only, never the repo.
`tsc --noEmit` clean · `next build` green (24 routes).

- **Part B — the archive tells the WHOLE truth ([[d57]]).** The founder pushed back on "a cancelled trip in Past was
  always cancelled by the Business": a Driver can obviously cancel too (accident, breakdown). Both are true, and the
  gap between them was the bug — **a Driver cancel / agreed release RE-POOLS the trip and clears `driver_id`, so it
  vanished from the Driver's app entirely.** A Driver could pay a 100% penalty and take a reliability mark with **no
  record anywhere**. Both events are already recorded in side tables their own RLS lets them read
  (`mission_cancellation.actor_driver_id` / `mission_release.driver_id`) — never queried until now. No migration.
  - Past is now built from a `PastItem[]` union — missions (completed / Business-cancelled) + the two re-pooled
    endings — sorted together by `pickup_at` and grouped by month. The events' missions come via the **service role**,
    gated to exactly the ids the Driver's own event rows point at (after a re-pool they usually can't read them any
    more). Re-pooled cards are **not tappable** (`.pastcard--flat`, no chevron): the mission may belong to another
    Driver now, so no detail page would still be true.
  - Money reads in the Driver's direction: `Compensation` (owed to them) · **`Penalty` in red** (their own cancel is
    always 100%, D45 — founder chose to show it plainly) · `Free` · `—`.
  - **Reasons both ways.** The Business's `cancellation_reason` is now shown to the Driver — a **deliberate reversal of
    the S39 review**, which had hidden it; the founder's call. Condition attached: the Dispatch cancel field was a bare
    "Reason (optional)" promising nothing, so it now reads **"Reason (optional) — your Driver will see this"**, said at
    the point of writing rather than republished after the fact. The Driver's own reason is read back as *"You said: …"*.
  - **Cancelled pill lost its × icon** (founder: it reads as a dismiss control) — `statusPill` returns `Icon: null` for
    `cancelled`, both call sites handle it. `.dcancel-note` → `.dend-note`; new `.dreason`, `.pastcard__fare--pen`.
  - **⚑ Dead code found: the T-60 reclaim can never fire.** It requires `status='accepted'`, which Option A ([[d55]])
    made unreachable — accept now confirms instantly and existing rows were backfilled. The Business UI gate is the
    same condition, so the card simply never renders (dead, not broken — no failing button). **Deliberately NOT built
    a card for it.** Real consequence for next session: **a Business has lost its free remedy for a Driver who goes
    silent near pickup** — pairs with notifications. Founder also rejected "Lock-in"/"T-180" as jargon; agreed
    replacement when it returns: **"check in"** / "3 hours before pickup".
  - **Verified live** on 4 seeded endings (completed · Business cancel + reason + €130,40 compensation · own cancel +
    "You said" + €260 penalty, no chevron · agreed release + Free, no chevron), all three filters, and the relabelled
    Dispatch field. DB restored to the 34-mission baseline (missions + both event tables).

- **Part C — the T-60 remedy: designed, then deliberately NOT built (founder).** Worked the replacement through with
  the founder and stopped short of code, on purpose. Agreed shape: the take-back must **not** auto-re-pool — a confirm
  step offering **two** outcomes (back to the Pool as SPEED WIN, or a plain free cancel); trigger = the Driver hasn't
  started the trip (not `en_route`) inside the hour; a reliability mark only on a **real** no-response, which needs a
  response test (take-back instant, mark deferred ~10 min, dropped if the Driver touches the trip).
  **Why it stopped:** the founder asked whether any of it is necessary before notifications — correct. The response test
  is meaningless without push (**no service worker, no Web Push exists** — "enabling notifications on the phone" does
  nothing today), and fees settle MANUAL in beta, so the unfair ~90% charge exists only on paper. Building now = ship
  the weakest trigger, redo it later. Full decision trail parked in `project/NEXT_SESSION.md` so the next attempt
  doesn't restart from zero. An optional 10-min stopgap (a "Driver unreachable? Call us before cancelling." line in the
  Business modal) was offered and left undecided.
- **Housekeeping:** the spawned task on `mission.cancellation_reason` readability was **dismissed as superseded** —
  showing that reason to the Driver is now intended ([[d57]]), so the "leak" it was going to chase is the feature. The
  residual `mission_cancellation` actor-scoping inconsistency is harmless and noted here rather than tracked.

**Next (founder chose Driver Settings over Earnings):** (1) **redesign the Driver Settings screen** — the last
un-redesigned Driver screen, still on the generic `.card` styling; (2) the **T-60 replacement** + the "check in"
rename, once notifications exist; (3) **reliability marks** — whether a Driver sees their own; (4) the **Earnings
screen**. See `project/NEXT_SESSION.md` for the Settings brief and the full T-60 trail.

---

## 2026-07-25 — Session 46 — My Rides restructure + Pool empty/loading states + pre-accept polish + waiting-meter verification

**Part D — pre-accept card polish + Option A: accept always confirms (founder).** Three founder-flagged items on the
pre-accept / accepted Driver cards.
1. **Removed the redundant zone** from the pre-accept card footer (`missions/[id]/page.tsx`) — the city is already in
   the pickup address, and the Pool card never showed it. Footer now reads `distance · duration · Business · Sedan`,
   matching the Pool card.
2. **Shortened the unlock line** from "Guest name, the name board and any private message unlock once you accept." to
   **"Private details unlock once you accept."**
3. **Dropped the Lock-in time gate on accept (Option A).** The old `accept_mission` auto-confirmed only when pickup was
   <3h away, else left the trip `accepted` awaiting Lock-in at T-180 — but nothing flips it at T-180 (that needs the
   deferred cron), so a trip accepted 3h+ out sat in `accepted` limbo with no controls and a dead-end "awaiting readiness
   confirmation (Lock-in at T-180)" message. Founder chose: **accept ALWAYS confirms immediately.** Migration
   `docs/migrations/2026-07-25_accept_always_confirms.sql` (create-or-replace `accept_mission`, always `confirmed` +
   `confirmed_at`, plus a one-time backfill of existing `accepted` → `confirmed`). App: **removed the T-180 message**
   from `mission-run-view.tsx` and the dead "Awaiting Lock-in" list caption in `rides/page.tsx`. Done via the RPC (not by
   touching the shared `mission-flow` helpers, which the Dispatch `trip-row` also uses).
   - **⚠️ Needs the founder to run the migration** (Claude's keys can't run DDL). Deploy sequencing: run the migration
     first, then push — so no trip is briefly left in `accepted` limbo between the code deploy and the RPC change.
   - **Verified live (localhost, real DB):** footer zone gone; unlock line shortened; a `confirmed` trip shows
     "Start — I'm en route"; an `accepted` trip no longer shows the T-180 message (its controls return once the migration
     backfills it to `confirmed`). `tsc` clean.

**Part C — Pool empty + loading states (founder-approved, D25 preview signed off).** The un-designed parts S43 left.
- **New `app/(app)/pool/loading.tsx`** — a route-level Suspense fallback: the `pool-head` shell + three `.pcard--skel`
  card skeletons in the real Pool-card shape (fare/when/badge/route-rail/foot placeholders) that pulse via the existing
  `dx-pulse` keyframe, staggered `animation-delay 0 / 0.15 / 0.3s`. So navigating to the (force-dynamic) Pool shows
  structure, not a blank flash.
- **Both empty states redesigned** from the plain `.empty` text into a calm `.pempty` block (soft rounded icon tile +
  headline + muted subtext): the **no-trips** state names the filter in bold ("New **Business · Sedan** trips within
  **15 km of Paris** land here…") with a `ti`-less Radar icon + a quiet "Checking your area · pull to refresh" pulse
  line; the **no-service-area** state is a setup prompt (MapPin) with one filled navy CTA into Settings. New `.pempty*`
  + `.pskel*` CSS; no new keyframe (reuses `dx-pulse`).
- Files: `app/(app)/pool/page.tsx` (two empty states), `app/(app)/pool/loading.tsx` (new), `app/globals.css`. No schema,
  no data change.
- **Verified live** (localhost, real DB, mobile): both empty states screenshotted pixel-matching the preview (via a
  throwaway driver flipped null-base → Paris/15km); the loading skeleton **proven in the streamed `/pool` HTML** (the
  Suspense fallback ships the full `.pcard--skel` markup with the staggered delays — it renders correctly, just flashes
  too fast to screenshot on a local render). `tsc` clean.

**Part B — My Rides restructure (founder-approved, D25 preview signed off) [[d53]].** The complaint: `/rides` dumped every
active/completed trip in one scroll AND hung each mission's action buttons (Guest on board, the waiting meter, cancel,
amendment/release cards) inline under its card — so a live mission's controls sat sandwiched between unrelated rides.
The fix, per the approved 3-frame preview:
- **`/rides` is now a clean tap-through list** — one `<Link>` card per trip (state pill · when · progress · route ·
  business+fare · chevron), **current + upcoming only** (`accepted/confirmed/en_route/arrived/on_board`; completed &
  cancelled dropped to History). A small amber flag ("A change/release is waiting for your answer") when a
  `mission_amendment`/`mission_release` is `proposed`. No action buttons in the list.
- **`/missions/[id]` is the single "mission, opened" page, now branching by ownership.** OWNED (isMine) → the full run
  view (new `components/mission-run-view.tsx`, ported verbatim from the old inline rides card + `.dstack` actions) with
  a **`← My Rides`** back link and every action (StatusControl · NoShowControl · DriverCancel · Amendment/Release
  cards). OWNED + terminal (completed/cancelled) → the same view renders read-only (no executable step → no buttons) with
  a **`← History`** back link. NOT-mine → the unchanged pre-accept view (fare-first + Accept, `← Back to Pool`) or the
  "no longer available" notice.
- **Contact reveal moved from the batch list into the per-mission page**, still gated strictly to `isMine` (dispatcher/
  business/shared-guest phones via the service role, only inside the `isMine` branch; the list reveals business NAMES
  only). Amendment/release builders extracted to `lib/mission-cards.ts`; `statusPill`/`progressCaption` exported from
  `mission-run-view.tsx` so the list and the run view can't drift.
- **Copy (founder):** the no-show "The pro move" nudge cut to one generic line ("Make sure you've tried everything to
  reach the Guest — a call, the full wait. Then you're clear to report." — no more "bags"); the filled report button
  drops "you're paid" ("Report the no-show — €X + €Y waiting").
- Files: `app/(app)/rides/page.tsx` (rewrite → list), `app/(app)/missions/[id]/page.tsx` (branch + run data load),
  `components/mission-run-view.tsx` (new), `lib/mission-cards.ts` (new), `app/(app)/rides/cancel-noshow.tsx` (copy),
  `app/globals.css` (`.ridecard*`). No schema, no migration, no server-action/RPC change.
- **Verified live** (localhost, real DB, mobile) on a seeded 6-mission mix: list shows the 5 active as tap-through cards
  (completed correctly absent); the airport Arrived opens with `← My Rides` + meter + new copy + the "€95 + €23 waiting"
  button; completed opens read-only with `← History`; a seeded pending release shows the list flag AND the accept/decline
  card on the detail page; a pooled trip still shows the pre-accept Accept view. `tsc` clean; no console errors. 3-lens
  adversarial review (privacy-gating · parity · branching).

**Part A — verified the S45 waiting-meter visuals against live data (no code change, item #1).** Close the one gap S45
left open: the `arrived` waiting-meter (`.dmeter`),
its capped state, and the no-show confirm nudge were never seen against real data (no trip was in that state when S45
shipped). A *look*, not a rebuild — D48 logic is unchanged. No code, no schema, no migration.

**Method.** The UI can't post a past-pickup mission (the form, plus the D48 `pickup_at` freeze trigger — which is
`before update` only), so — per the S42 test-data precedent — a scratchpad service-role script seeded 3 tagged
(`reference = "S46-VERIFY"`) `arrived` missions with past `pickup_at` + a matching `arrived` status_event, under a
dedicated dev driver (`s46.driver@pickup.local`) so `/rides` stayed clean of the demo driver's ~20 legacy trips.
Dev-login as that driver → `/rides`, screenshotted each state, then deleted the 3 missions (DB restored, tree clean).

**Verified live (localhost, real Supabase DB), mobile 375×812:**
- **Running meter (amber `.dmeter`)** — city + airport variants. Warm amber panel, `Paid waiting · N min`, live-ticking
  fee, amber progress bar, note `1,00 € per minute started · stops at 40,00 € / 60,00 €`. Matches D48 exactly (€1/min
  started, courtesy 20/60 min, cap €40 city / €60 airport).
- **Capped meter (`.dmeter--capped`)** — a neutral "closed" look (deliberately NOT amber): `Waiting closed · 40 min ·
  40,00 €`, full bar, note "Stopped at the 40,00 € ceiling… report when you're ready." Good contrast: amber = money
  accruing, neutral = money stopped.
- **Confirm nudge** — tap "Report a no-show" → "The pro move" reassurance box + the one filled button `Report the
  no-show — you're paid 95,00 € + 24,00 € waiting` (fare + live waiting fee summed, the `waiting.fee > 0` branch) +
  quiet "Keep waiting". One filled button per card ("Guest on board"); no-show + cancel stay `.dquiet`.
- No console errors; the meter renders + ticks correctly, no visual defects.

**Outcome.** S45's flagged "not verified live" gap is CLOSED — no code change warranted. Inert test identities
(`s46.driver` / `s46.verify` dev auth + their driver/business rows) left in the DB like the existing seed identities;
the 3 test missions were removed.

---

## 2026-07-25 — Session 45 — the two remaining Driver cards (pre-accept + accepted), redesigned

**Scope.** Carry the S43 Pool-card design language onto the last two un-redesigned Driver screens. No schema, no
migration, no behaviour change — presentation only. Same data, same server actions, same RPCs, same copy strings,
same gating conditions. D25 loop: one preview covering both cards → founder sign-off with two notes (drop the fare
beside the Accept CTA; give the accepted card real breathing room, scrolling is fine) → built to match.

**Approach — the cards REUSE the Pool card's classes rather than copy them.** `.pcard__head/__fare/__when/__day/
__time/__body/__badges`, `.pbadge--type/--speed/--run` and the whole `.proute*` rail are plain (unnested) selectors,
so both screens now render an opened mission out of the *same* vocabulary as its Pool card. Only a roomier container
(`.dcard`) and the pieces the Pool card has no equivalent for are new (~230 lines appended to `app/globals.css`):
`.dcard__label`, `.dfact*`, `.dchips/.dchip`, `.dlock`, `.dpill--neutral/info/go/warn`, `.dprog*`, `.dcall*`,
`.dnote*`, `.dreached/.dnext` + `.proute__dot--done/--now`, `.dmeter*`, `.dcta/.dcta--done/--ghost`, `.dquiet*`,
`.dstack`. Nothing at weight 700 (the S43 rule). `.dcard` overrides give the Pool-card pieces more air — a detail
screen is *read*, a Pool card is *scanned*.

**1. Pre-accept — `/missions/[id]` (`page.tsx` + `accept-button.tsx`).** Now reads as "the Pool card, opened":
fare + `formatPoolWhen` head, badges, then the route rail **uncollapsed** — every waypoint shown with its full
address instead of the Pool card's `+N` (the one thing a Driver opens the screen for). `zone` rides on the facts
line. The `.kv` dt/dd list became a `Service` card of `.dfact` rows (Passengers / Luggage / Flight) plus `.dchip`s
for languages, dress code and request flags. The "revealed once you accept" sentence became a `.dlock` row with a
Lock icon, and is now shown **only while the mission is still pooled** (it was previously shown even to the Driver
who already owned the trip). Action is a full-width `.dcta` in normal flow — **no sticky bar, no fare beside it**
(founder's call); the `isMine` state is a `.dcta--ghost` link, the gone state keeps its `.notice.warn`.

**2. Accepted — My Rides (`rides/page.tsx`, `status-control.tsx`, `cancel-noshow.tsx`).** The card is a working
tool now, so **state leads and the fare stops being the headline**: a `.dpill` status pill (tone-mapped
info/go/neutral/warn) + day/time head, then progress, route, contacts, prep. The fare moved down to `.pcard__foot`
beside the Business name. `StatusSteps`' five cramped labels became one `.dprog` segment bar + a plain-words caption
("Not started" / "On the way" / "Waiting for the Guest" / "On board · 1/2 stops" / "Completed"), with an aria-label
so the bar isn't colour-only — it reuses the exported `progressSegments`/`progressDone` maths, and
**`components/status-steps.tsx` was left untouched** because Dispatch still renders it. Stop progress moved from
`.leg-tag` pills onto the rail itself (`--done` / `--now` dots + `.dreached` / `.dnext`). Contacts became
`.dcall` tap-to-call chips (Guest / Dispatcher) instead of `.contact-row`/`.kv` rows — same privacy gating, an
unshared number is still never rendered. Name board + private message became a `.dnote` prep box. The duplicated
Business row was dropped (it's in the card foot).

**3. One filled button per screen.** `StatusControl` is a `.dcta` (`.dcta--done` for "Complete ride" — that also
fixes the long-standing `success-btn` fall-through to navy, so **Complete ride is finally green**, one of the
open "navy polish" items). "Report a no-show" and "Cancel this trip" dropped to `.dquiet` text actions, so the pro
path is the loud one; the no-show **confirm** step keeps its filled amber button, because at that point it *is*
the action. `DriverCancel`'s hand-rolled sheet is now a `.dcard`. The D48 waiting meter kept every number, gate and
copy string and was restyled to `.dmeter` (amber accruing → `.dmeter--capped` neutral), fee at weight 600 not 700.

**Verified.** `tsc --noEmit` clean · `next build` green (24 routes) · both screens loaded in-browser at 375×812
against the **real Supabase DB** as a real authenticated Driver (Pool → mission detail → My Rides), 0 console errors.

**⚑ Not covered by live verification:** the `arrived` + waiting-meter and no-show confirm states, and the
release/amendment overlays, were not reachable with the demo data on hand — their logic is byte-for-byte unchanged
(class swaps only) and `tsc`/`build` are green, but the *visual* result of `.dmeter` is unproven against real data.
Worth a look next session, or the moment a real trip reaches `arrived`.

**Still open on the Driver side:** the Pool empty + loading states; the discreet-vehicle keep/drop call; the
Earnings screen; guidance Tier-2 tooltips.

---

## 2026-07-25 — Session 44 — PickUp → Kavenue rename (brand only, no behaviour change)
**Branch:** `rename/kavenue` → merged to `main`. **No migration. No schema, dependency or behaviour change.** Executes
[[d50]]; the full rationale + the never-rename list is **[[d51]]**.

**Scope: 51 files.** User-facing copy (Dispatch topbar wordmark → "Kavenue Dispatch", login/welcome/dev-login titles,
FR+EN legal pages, Business + Driver Settings, cancel/no-show, release + amendment cards), `app/layout.tsx`
`metadata.title`/`description`/`appleWebApp.title`, `public/manifest.webmanifest`, `package.json` + `package-lock.json`
(`pickup-driver` → `kavenue-driver`), `README.md`, `.claude/launch.json`, all of `docs/` + `project/`, and **SQL comments
only** in `docs/migrations/*.sql`. Two git-renamed files (tracked as renames, history preserved):
`docs/PickUp_Phase0_Data_Spine.md` → `docs/Kavenue_Phase0_Data_Spine.md` · `docs/pickup_schema.sql` →
`docs/kavenue_schema.sql`, all 12 references updated.

**The hard part was the never-rename list** — "PickUp" the brand and "pickup" the transport term are the same token.
Held back deliberately: every `pickupbedriven.com` hostname (DNS move hasn't happened) · the
`Phyrass-H/Pickup-marketplace` remote · the `PickUp_project_dev` directory · `PickUp Go` + La Poste's "Pickup" trademark
+ all rebrand/historical prose (renaming these makes the sentences self-contradicting) · the transport term and its DB
columns (`pickup_at`, `prefill_pickup`, `isAirportPickup`, the "Pickup"/"Route" headers) · and two **live-data
couplings**: the `pickup-dx-collapsed` localStorage key and the `*@pickup.local` dev-login/seed emails, which address
real Supabase auth rows — renaming the constant alone breaks dev-login. Full list in [[d51]].

**Method.** 7 parallel edit agents partitioned so no two touched the same file, under one explicit ruleset; then 4
adversarial verify lenses (missed-brand · over-rename · reference-integrity · copy-coherence). The decisive check was
**mechanical reversibility** — reverse every added line (Kavenue→PickUp) and diff against the removed line: **0 mismatches
across 209 changed lines**, proving no collateral edit. 23 findings → real ones fixed. Biggest miss: `NEXT_SESSION.md`
was skipped entirely and still claimed the rename hadn't happened (plus 2 dead file paths) — the one file every new
session reads first. Also fixed: stale "RED Executive" survivors in `IDEAS.md` + `SESSION_LOG.md:295`, and a
`package-lock.json` name drift that the next `npm install` would have silently rewritten.

**Verified.** `tsc --noEmit` clean · `next build` green (24 routes) · dev server on :3000 vs the **real Supabase DB**,
18 routes fetched (Driver + Dispatch + public + manifest + both legal pages) → **0 occurrences of "PickUp"** in rendered
HTML · no console errors · FR legal élision checked ("Kavenue" is consonant-initial, so "de Kavenue" is correct).

**Not done (founder-owned):** the repo **directory** rename, the **GitHub repo** rename, the **domain migration**, and
`.claude/settings.local.json` (a permission rule mentions the old brand; line 32 holds a stale — already-dead —
`pickup_schema.sql` path). Claude deliberately left the permissions file alone.
**Next:** the two remaining **Driver card redesigns** (pre-accept mission detail + the accepted/My-Rides run-flow incl.
the D48 waiting meter) via the D25 preview loop — the founder deferred these out of this session.

---

## 2026-07-24 — Session 43 — Driver Pool redesign + bottom tab bar (Pool-first)
**Branch:** `main`. **No migration** — `mission_type` (`'transfer'|'hourly'`, hourly = at-disposal) and a nullable
`dropoff_address` already exist in the schema. Design decided via the **D25 preview loop** (v1→v9 inline mockups, founder
sign-off each round), then built to match.

**The Driver app finally gets a layout redesign — Pool first.** It had inherited the navy palette (D24) but never a
structural redesign the way Dispatch did. This session: the shell + the Pool card.
- **Bottom tab bar** (`components/driver-tabbar.tsx`) replaces the old top text-nav (`components/app-header.tsx`, now
  unused): Pool (stack / Lucide `Layers`) · My Rides (`Car`) · Earnings (`Wallet`) · Settings (`Settings`). Fixed,
  safe-area aware, active-state by pathname (Pool stays active on `/missions/*`). Content moved into
  `<main class="dapp-main">` (bottom padding clears the bar). **Sign out** moved from the header into Settings
  (`components/driver-signout.tsx`).
- **Pool card** (`components/mission-card.tsx`, full rewrite) to the approved v9 mockup — uniform, quiet, refined weights
  (nothing 700):
  * head: fare (left) + when (right: day "Today · 24 Jul" / "Sun · 26 Jul" + time; today accented navy), a **gentle
    divider**, then **mission-only badges** — Transfer OR "At disposal" (`mission_type='hourly'`), SPEED WIN, Luggage run.
    The vehicle class is NOT a badge — it's the Driver's own car (the Pool is filtered to it), so it's redundant → demoted.
  * **route rail** (Dispatch-style): navy dot (pickup) → line → grey mid-dot with "+N" (waypoint count) → line → hollow
    ring (drop-off). Full **2-line** addresses (`addressLine()` + `-webkit-line-clamp:2`). An at-disposal (hourly) trip
    has no drop-off → pickup alone; the facts line shows "Flexible route" instead of distance.
  * **one-line footer**: trip facts (distance·duration) + a **discreet vehicle** (Car icon + class, muted, truncates
    first) | service-request icons **capped at 3 by priority** (child seat > pets > luggage > meet&greet > greeter >
    dress > language > quiet > flight) then "+N".
- **Earnings** = the new 4th tab (`app/(app)/earnings/page.tsx`) — honest "coming soon" placeholder; its own screen gets
  a D25 pass later (payouts settle manually in beta, Stripe deferred).
- **CSS** (`app/globals.css`): new `.dtabbar/.dtab`, `.dapp-main`, `.pool-head`, `.pcard/.proute/.pbadge`. The shared
  `.card/.route/.badge` are UNTOUCHED (still used by My Rides / mission detail — those screens redesign in a later pass).
- **`lib/format.ts`**: new `formatPoolWhen()` (Paris-tz relative Today/Tomorrow else weekday + "D Mon" + time).

**Verified** in-browser vs the real Supabase DB (Pool · My Rides · Earnings render, no console errors; 2-line wrap, route
rail, badges, capped icons, Luggage-run badge all correct). **3-lens adversarial review (13 agents) → 6 confirmed (0
high), ALL FIXED:** the "Tomorrow" **DST drift** (now Paris-calendar arithmetic, not +24h), `viewportFit:'cover'` for the
iOS safe-area, `.ac-list` z-index raised above the tab bar, `role="img"` on the service icons + an aria-label on "+N",
muted-grey **contrast** darkened to `--text-muted` (was failing WCAG AA on white), and real `<h1>`s for the Pool/Earnings
titles. `tsc` clean.

**Locked via the preview loop:** uniform cards; badges = mission-only; the route rail with a mid-dot "+N"; full 2-line
addresses (no truncated titles); one-line footer; icons capped 3 + N by priority; Pool tab icon = stack; 4 tabs (Earnings
added). **Not exercised by seed data (code-reviewed only):** SPEED WIN badge, the +N stop marker, the at-disposal card,
the Today/Tomorrow accent.

**⚑ Parked (founder to decide):** the **discreet vehicle** in the footer — keep (it truncates to "Business · Se…" on a
narrow card) or drop it (it's redundant); the **"Both"** mission type (needs a new enum value + the model). **Not yet
redesigned:** My Rides / mission detail / Settings cards (Pool-first); the Earnings screen; the Pool empty + loading
states. **Deployed `56211e7` → Vercel `success`; founder tested on phone + approved ("I like it, good job").**
**Next session (founder-set, in order):** (1) full **rename PickUp → Kavenue** everywhere — docs, code, folders, copy,
config ([[d50]]); (2) redesign the **extended pre-accept mission card** (`/missions/[id]`) + the **accepted mission card**
(My Rides run-flow, incl. the `arrived`/waiting-meter screen) via the D25 preview loop.

## 2026-07-23 — Session 42 — Waiting fees + a hard end-to-end stress test ([[d48]])
**Branch:** `main`. **Migrations (founder RAN all):** `2026-07-22_waiting_fee.sql`, `2026-07-22_airport_accent_fix.sql`,
`2026-07-22_guest_ready_at_guard_fix.sql`. Continues Session 41; the founder chose waiting fees over reschedulable time.

**D48 waiting model, SHIPPED + DEPLOYED (`0aed706`).** Courtesy wait (renamed from "free wait") 20 city / 60 airport,
then **€1/min started** Business→Driver, ceiling **€40 city / €60 airport** — the ceiling stops the MONEY not the trip
(no cron; a `least()` clamp). Two exits, both with a confirm: the Driver reports, or the Business declares via the
net-new **`business_declare_no_show`**. **`business_cancel_mission` now settles accrued waiting too** — it already
accepted `arrived` and charged a flat 100% past pickup, so without this "Cancel" was strictly cheaper than "stop
waiting" by the whole waiting amount (the loophole the pre-build review caught). A booked trip's **`pickup_at` is frozen
after draft** (blanket trigger, safe because time is never amendable) — this dissolves the postpone-then-cancel dodge.
- **Files.** SQL: the three migrations + one shared `mission_waiting()` / `mission_is_airport()` so the three settlement
  paths can't drift. App: `lib/cancellation.ts` (`waitingAt`, `WAITING_RATE_PER_MIN`, widened `isAirportPickup`),
  `rides/cancel-noshow.tsx` (the Driver meter states), `components/dispatch-waiting.tsx` (net-new Business meter +
  "stop waiting" confirm), `dispatch/actions.ts` (`businessDeclareNoShow`), `trip-row.tsx` (mount), `database.types.ts`.
- **THE BUG OF THE SESSION — found by probing, not reading.** The airport predicate `a[eé]roport` used a bracket
  expression with a multibyte char; **Postgres `~*` does not reliably match it**, so `"Aéroport Nice Côte d'Azur"` — the
  exact Mapbox string for the region's main airport — was classified CITY. Every accented airport pickup without a flight
  number had been getting a 20-min courtesy wait instead of 60 (a no-show fileable 40 min early). Latent since the O7
  spine (2026-07-13); the 07-19 label fix reused the same broken expression so didn't cure it. Proven with 3 identical
  missions differing only in the label; fixed by matching the ASCII substring `roport` (accent/case/NFC-NFD immune).
- **The guest_ready_at guard finally works (3rd try).** Two earlier attempts were no-ops (a column REVOKE against a
  table-level grant; a SECURITY DEFINER trigger where `current_user` is the owner). Fixed by dropping `security definer`.
  Live: Business PATCH → 403 unchanged; service role → 204. `pickup_at` still Business-writable (deferred, § H2).

**THE HARD END-TO-END STRESS TEST (founder-requested session close).** A tagged 14-driver / 3-business fleet provisioned
with real auth (`scratchpad/fleet.mjs`), then a **12-battery workflow** exercised the whole RPC + RLS + trigger layer
against the LIVE DB, each battery on dedicated drivers, each self-cleaning: **49/49 cases GREEN, 0 real bugs, 0 test
artifacts.** Batteries: accept_mission (atomic first-wins + lock-in) · driver-cancel + re-pool SPEED-WIN window ·
business-cancel ramp (fee_pct 0/50.83/80/90/100) · no-show clock D47 (incl. the accent regression as a discriminator) ·
waiting math + ceiling · money conservation across all 3 doors (identical totals, Business charged == Driver paid) ·
**concurrency race x5 (exactly one winner, RPC winner == DB driver_id)** + slot conflict · agreed release + supersede ·
amendment accept/decline · T-60 reclaim · RLS/privacy (cross-driver read denial, guest-contact side table, both column
guards) · state-machine guards. Fleet torn down; **DB verified back to baseline 34 missions**, no leftovers. Test scripts
live in the session scratchpad only (never the repo). Earlier the same paths were proven 13/13 + a 3-door settlement proof.

**Next:** the **Driver app redesign** (v2 preview approved in principle; the `arrived` screen needs a v3 drawn against the
now-shipped running meter, and the Pool filter chips are still an open keep/drop). Pricing-model research owed on the
€1/min rate + the caps. § H2 still holds: `pickup_at` freeze needs the column-grant audit; automated tests (this session
made the case — 3 of the session's bugs looked correct in code and only fell to live probing).

## 2026-07-22 — Session 41 — No-show clock origin: the Guest's due time, not the Driver's arrival ([[d47]])
**Branch:** `main`. **Migrations (founder RAN all three):** `2026-07-19_no_show_clock_origin.sql`,
`2026-07-19_no_show_airport_label.sql`, `2026-07-19_guest_ready_at_guard.sql` (the third is a **no-op** — see Failures).
Started as the Driver-app redesign; the founder corrected the no-show model mid-preview and the fix took the session.

**The correction (founder).** The free-wait countdown was anchored to the Driver's `arrived` tap in BOTH engines
(`mark_no_show` line ~310 and `rides/page.tsx` → `NoShowControl`). Wrong party: the free wait is the **Guest's** grace
period. Origin is now `coalesce(guest_ready_at, pickup_at)`; reporting unlocks at
`greatest(guest_due + wait, arrived_at + 5 min)`. Durations unchanged (60 airport / 20 city). `arrived` stays a
**precondition**, not the origin.

**It was a live exploit, not just a model error.** `advanceStatus` (`rides/actions.ts:76-79`) checks sequencing only — no
time guard — so a Driver could walk to `arrived` ~33h early, wait out the 20-min city window, and file: Business charged
100%, mission `completed`+`no_show`, Guest stranded. `pickup_at` anchoring closes it structurally.

**Second bug found by the review (pre-existing, from `2026-07-13_o7_cancellation.sql`).** Airport detection read only
`pickup_address`, but `address-autocomplete.tsx:235` writes `full_address` there and the POI name to `pickup_label`
(`2026-06-27_mission_place_labels`). So an autocomplete airport pickup **with no flight number** got the 20-min city
window. Hidden because `api/seed` writes "Aéroport" into `pickup_address`. Now tests both + `nullif(flight_number,'')`.

- **Files.** DB: the three migrations (`mission.guest_ready_at` nullable = the flight-tracking hook; deliberately NOT
  `flight_eta`, which is display-only). App: `lib/cancellation.ts` (new `guestDueAt` / `noShowAvailableAt` /
  `NO_SHOW_ON_SITE_FLOOR_MIN`, widened `isAirportPickup`), `rides/page.tsx` (passes `guestDueIso`+`availableAtIso`; stops
  swallowing the `status_event` query error), `rides/cancel-noshow.tsx` (separate `waitEnds` for the header chip so a
  floor-gated countdown can't claim the free wait is running; new "Starts HH:MM" state; `formatTime` instead of a
  per-tick `Intl` formatter), `rides/actions.ts` (comment), `lib/database.types.ts`.
- **Verification: 9/9 live** vs the real DB (scratchpad harness, real Driver JWT for `demo.driver@pickup.local` → Marc
  Dubois; creates disposable missions, exercises `mark_no_show`, deletes everything, `leftover=0`). The autocomplete-airport
  case was **demonstrated failing (ALLOWED) before the 2nd migration and passing (BLOCKED) after** — a genuine red→green.
  A city POI stays on 20 min, guarding against over-match. Two adversarial workflows ran (46 + 30 agents).

**The `guest_ready_at` guard took THREE attempts — two failed silently, both my error.** Worth recording as Postgres
gotchas, because each one *looked* applied and neither protected anything:
1. `revoke update (guest_ready_at) … from authenticated` — **no-op**: column privileges are only consulted when the role
   lacks **table-level** UPDATE, which `authenticated` has (via `p_mission_business_update`).
2. A `before update` trigger declared **`security definer`** — **no-op**: inside SECURITY DEFINER, `current_user` is the
   function OWNER, never the caller, so `current_user in ('anon','authenticated')` was never true.
3. ✅ **Same trigger, `security definer` removed** (`2026-07-22_guest_ready_at_guard_fix.sql`) — SECURITY INVOKER makes
   `current_user` the role PostgREST switched to. **Verified live: Business PATCH → 403 + value unchanged; normal Business
   column edit → 204; service role (the future tracking feed) → 204; no-show suite still 9/9.**
Each failure was caught only because the guard was **tested**, not assumed — migrations 1 and 2 both returned "success".
Test writes reverted (0 rows non-null). One live pooled mission (`2dd71a4d`, Antibes) had `luggage_count` set to 2 during
the "normal edits still work" check; prior value not recorded, founder chose to **leave it at 2**.

**Still open (BACKLOG § H2):** `pickup_at` has the same exposure and additionally feeds `business_cancel_mission`'s fee
tier, but it has a legitimate client writer (draft resume), so it needs a status-aware rule — folded into the
column-grant audit with the `p_mission_business_update` flag.

**Also logged to § H2:** negative `hours_before_pickup` on no-show rows (opposite sign to the other 4 kinds); the
`advanceStatus` early-tap (now data-quality, not money); device-clock vs Postgres-clock countdown skew (fails safe).

**Next:** back to the **Driver app redesign** — v2 preview approved in principle, two opens: (1) do the Pool filter chips
stay (they are a NEW feature I invented, not in the app today)? (2) the `arrived` screen still needs a v3 drawn against
the corrected model, since the "Starts HH:MM" state didn't exist when v2 was drawn.

## 2026-07-19 — Session 40 — O7 agreed release (Business-initiated) + the 24h re-pool SPEED-WIN window
**Branch:** `main`. **Migrations (founder RAN both):** `docs/migrations/2026-07-19_agreed_release.sql` (new `mission_release`
evidence table + `propose_release` / `respond_to_release` / `close_release` RPCs + widened `mission_cancellation.kind`) and
`docs/migrations/2026-07-19_repool_speedwin_window.sql` (the 24h re-pool window + review fixes; `create or replace` of the
four O7 RPCs). Both additive. **Decision [[d46]].** Finishes the actionable half of O7 (the copilote hand-over stays Phase 2 —
needs the community layer).

**The agreed release — the D45 mutual-consent "agreed cancellation".** A free, no-fee release that BOTH sides confirm.
**Direction = Business-initiated ONLY** (founder chose this over bidirectional, after seeing the D25 preview): the Business
taps a dedicated **"Agreed release · free"** button (distinct from the fee-paying Cancel) → the assigned Driver gets an
accept/decline card and **must accept** → the trip releases **free (no fee, no reliability mark)** and re-pools; decline →
the trip stays exactly as agreed. Eligible only while `accepted`/`confirmed`. The Driver's cancel-sheet escape valve ("Ask
the Business to release it — free") is the phone trigger; there is no Driver-initiated in-app proposal. Mirrors the amendment
pattern almost exactly (propose record + Driver accept/decline + atomic SECURITY DEFINER RPC).
- **Files.** DB: the two migrations. Driver: `components/release-card.tsx` (the card, with the safe-decline reassurance),
  `respondToRelease` in `rides/actions.ts`, loader + gate in `rides/page.tsx`, escape-valve copy in `rides/cancel-noshow.tsx`.
  Business: `components/dispatch-release.tsx` (`AgreedRelease` button + confirm modal), `proposeRelease`/`closeRelease` in
  `dispatch/actions.ts`, schedule states + button wiring + gates in `trip-row.tsx`, loader in `dispatch/page.tsx`. Types in
  `lib/database.types.ts`; CSS in `globals.css` (`.amc__lead`/`.amc__safe`/`.dx-amend--neutral`, else reuses the amendment classes).

**Dispute-ready evidence (founder's explicit concern — a Business coercing a committed Driver into a free release).** The
platform can't police the phone call, so it owns the defaults + the receipts: (1) declining is framed as **free, mark-free,
the Driver's choice** on the card, and the Business-side decline state is **calm, not alarmist**; (2) `mission_release` is
**append-only** — declines are retained; a Business only HIDES a resolved request (`dismissed_at`), never deletes/rewrites;
each row stores who/when/note/decision/`from_fare`/**`hours_before_pickup`** so "a free release proposed inside the fee
window, repeatedly declined" is legible and **per-Business counts are a query**. ALL writes go through the SECURITY DEFINER
RPCs (no client INSERT/UPDATE policy) → tamper-resistant (stronger than the amendment table; closes the class of gap the O7
review flagged). Abuse dashboard = deferred Admin workspace (BACKLOG F2); the data is ready for it. Logged the
review-weaponisation constraint (completed-trip + double-blind reviews) for whenever a Business→Driver review system is built.

**Re-pool pricing — the 24h SPEED-WIN window (founder decision; supersedes D45 "re-pool = always SPEED WIN at 70%").** A
re-pooled mission (driver cancel · T-60 reclaim · agreed release — ALL re-pool paths) now prices by time-to-pickup: **<24h →
SPEED WIN** (start 70% of ceiling, climb 5%/5 min); **≥24h → NORMAL Pool** (start 50% of ceiling, climb 5%/10 min, SPEED WIN
off) — the exact curves a fresh posting uses (`dispatch/new/actions.ts`). Re-pool re-bases the climb to `pooled_at`.

**Adversarial 3-lens review (SQL-security / TS-integration / UX-policy) → 6 confirmed of 10, ALL fixed** (2 verified-REJECTED:
client-forgeable `p_proposed_by` — tenant security holds; a hedged "24h" copy nuance). Fixes folded into the repool migration
+ UI: the cancel/reclaim/business-cancel RPCs now **supersede a pending `mission_release`** (business-cancel gained the
amendment supersede it was missing too); the release cards/briefs are **gated to a still-releasable trip** (no dead card past
accepted/confirmed; no stale "back in the Pool" once a new Driver re-accepts); `respond_to_release` locks **mission → release**
(matching `propose_release`) to kill a deadlock inversion.

**Verified live vs the real Supabase DB** — a self-contained script (`scratchpad/verify-release.mjs`) that creates a throwaway
tenant + missions, signs in as real Business + Driver auth users (the exact SECURITY DEFINER path), exercises the loop, and
cleans up: **28/28 assertions pass** — Test A (≥24h → normal 50%/int10/speed-off), B (<24h → SPEED WIN 70%/int5), C (decline
untouched + reason retained), D (business-cancel supersedes pending release), E (status guard blocks a stale accept), F
(deny-by-default writes: Business/Driver can't INSERT or rewrite a declined `mission_release`). `tsc` + `next build` green.
Founder ran migration #2 (a first-paste "syntax error" then a clean "success" — an incomplete `$$…$$` paste; the successful
idempotent re-run applied all four functions, confirmed by the 28 live checks). **Deployed to `main`.**

**Next here:** the **copilote hand-over** (O7 Phase 2 — needs the community/registration layer) is the last O7 piece. The
§ H2 review-flags remain (the Business-UPDATE RLS WITH CHECK; the fee basis freeze at `accepted_at`).

## 2026-07-13 — Session 39 — O7 cancellation: research + full ruleset decided + documented (no code yet)
**Branch:** `main`. **No code / no schema change this session — design + decisions only.** Founder chose to work on **O7
(cancellation)** and gave the full policy context; I ran a **4-agent research workflow** (canonical docs sweep · schema/code
sweep · global web benchmarks · French VTC + hand-over legal angle) to ground it, then captured the settled ruleset.

**Research highlights (fed the decisions):**
- Founder's model largely matches the market: **no-show → Driver paid after a wait** is universal; the **1h airport / ~20min
  city** split is the industry norm (Blacklane/Wheely/Uber Black/Welcome all = 60min from landing; city ~20–30min); an
  **escalating % as pickup nears** is validated (a Côte d'Azur operator publishes >24h 0% / 24–12h 50% / 12–6h 70% / <6h 100%).
- Kavenue-specific (not a market norm, flagged): a **Driver fined ≈ the trip amount** (elsewhere a bailing driver is just
  re-dispatched, not fined) — must live in the Driver↔Kavenue contract as an intermediary penalty, never a transport charge.
- **Copilote hand-over legal answer:** the founder's framing (full **transfer/novation** — original Driver drops out with
  zero pay/invoice/liability, copilote re-accepts on his own account) is **the clean, lawful structure** — cleaner than
  classic *sous-traitance* (which would make the original a "mini-principal" with URSSAF requalification risk). Guardrails:
  credential-gate to active same-category verified Drivers (2026 made *sous-traitance illicite* a named REVTC offence), own
  account, no money through the original, Business consent via terms. Precedent exists (Drivalty, iaDriver, WAY-Partner, VTC
  coops). Confirmed viable; **Phase 2, later.**
- Docs already encode part of it (driver-cancel-re-pools / business-cancel-terminal, dormant `cancelled_by`/`cancelled_at`,
  Lock-in = "T-180"). **Gaps O7 must invent:** no-show (entirely undefined), the **T-60 reclaim**, the hour-based business
  curve, the copilote layer, disputes, a fee/reliability data model, mid-trip cancel window (`arrived`), re-pool pricing.

**Decided ruleset (→ [[d45]]).** Driver voluntary cancel = **always 100%** (re-pools). Business cancel = **free >5h · 50% at
−5h · +10%/h → 100%** at pickup. No-show fires at status **`arrived`** (**1h airport / 20min city**) → **Business charged full,
Driver paid full like a completed mission**, Kavenue keeps commission, Business settles with its own Guest. **T-60 Business
reclaim** (NOT a cancel) only when the assigned Driver **hasn't confirmed the Lock-in AND is unreachable** → reclaim button →
re-pool as SPEED WIN, penalty-free for the Business, Driver takes a **reliability mark** (gated to non-confirmation = anti-
abuse). Re-pool re-enters the Pool as **SPEED WIN at 70% of ceiling** (needs a `pooled_at` climb-origin). **Copilote hand-over
= Phase 2.** **NEW: SPEED WIN reachability gate** — geolocate the Driver, GPS-ETA to pickup, **block accept with a popup** if
they'd be late (build later). **Disputes = deferred, documented.** Euro *amounts* stay MANUAL in beta; the *rules* are fixed.

**Documented in:** `project/DECISIONS.md` **D45** (authoritative + the legal confirmation) · `docs/05_Roadmap_Backlog_TODOs.md`
(Cancellation & conflict section rewritten to the decided rules; copilote + SPEED WIN gate added) · `docs/Kavenue_Phase0_Data_
Spine.md` (the "Cancellation %s" open decision resolved) · `project/BACKLOG.md` (new **§ N** with the full Phase 1 spine +
Phase 2 copilote + SPEED WIN gate + disputes; § B and § K O7 lines updated) · `project/IDEAS.md` (parked detail for the
copilote model, SPEED WIN gate, disputes).

**Phase 1 CODE BUILT (tsc + next build green; migration pending).** After the D25 previews were signed off (driver cancel
sheet + amber no-show + "be sure" nudge; dispatch live-% cancel modal + T-60 reclaim), implemented the cancellation spine.
- **Migration** `docs/migrations/2026-07-13_o7_cancellation.sql` (additive, founder-run): mission `cancellation_fee` /
  `cancellation_reason` / `pooled_at` / `no_show` / `no_show_at`; `driver.reliability_marks`; a widened `status_event`
  CHECK (adds cancelled/no_show/repooled); a `mission_cancellation` audit table (deny-by-default RLS, holds the fee record
  even for re-pooled trips); and 4 SECURITY DEFINER RPCs — `driver_cancel_mission` (100% → re-pool as SPEED WIN),
  `business_cancel_mission` (free while pooled / >5h, then 50%@−5h +10%/h → 100%; terminal), `reclaim_mission` (T-60,
  gated to accepted-but-unconfirmed), `mark_no_show` (from `arrived`, 60/20-min window, → completed + no_show) — all
  mirroring `accept_mission`.
- **Code:** `lib/pdp.ts` now climbs from `pooled_at ?? created_at`; `lib/cancellation.ts` (shared % ramp + airport
  heuristic, mirrors the SQL); driver `app/(app)/rides/cancel-noshow.tsx` (`DriverCancel` sheet + `NoShowControl` amber
  countdown) + 2 actions in `rides/actions.ts`; dispatch `app/(dispatch)/dispatch/actions.ts` + `components/dispatch-cancel.tsx`
  (`BusinessCancel` live-% modal + `ReclaimCard`) wired into `trip-row.tsx`; `missionTone` gained a "No-show" state;
  `lib/database.types.ts` extended (columns + table + 4 RPCs + `MissionCancellationRow`).
**Verified + reviewed (2026-07-13).** Migration applied by the founder. Ran a full end-to-end check via REAL authenticated
sessions (the browser pane was flaky, so signed in as the demo Driver/Business with the anon key — the exact SECURITY
DEFINER auth path the UI uses): all **5 money paths + 5 adversarial guards** pass against the live DB (business cancel
free / 70.02%, reclaim→SPEED WIN at 0.7×ceiling, driver cancel 100%, no-show→completed+charged; guards: reclaim-ineligible,
cross-tenant, no-show-too-early, role-mismatch ×2). UI rendering confirmed both sides via the a11y tree; airport heuristic
confirmed (flight OR airport address → 60 m). tsc + next build green. Test artifacts cleaned off the demo DB.
Then a **3-lens adversarial review** (correctness / security / integration) found 6 issues:
- **FIXED in the migration** (re-run the file — every statement is idempotent): (a) **HIGH** the re-pool RPCs
  (driver_cancel / reclaim) left a pending `mission_amendment` 'proposed', which could leak to the next Driver → now
  supersede it on re-pool; (b) **LOW** the widened `status_event` CHECK let a Driver spoof no_show/repooled rows → tightened
  `p_statusevent_driver_write` to the execution steps; (c) **LOW** a Business cancel's private `reason` was readable by the
  released Driver → `actor_driver_id` set null on business_cancel rows.
- **FLAGGED** (→ BACKLOG H2; not O7 regressions / beta-mitigated): **#1** `currentFare` doesn't freeze at `accepted_at`, so
  the recorded fee BASIS inflates toward the ceiling (pre-existing pricing behaviour; MANUAL settlement backstops it — a
  pricing-engine decision); **#2 (HIGH for prod)** `p_mission_business_update` has no WITH CHECK, so a Business could bypass
  the fee/reclaim gates via a direct PostgREST UPDATE (pre-existing RLS gap; ~nil risk in beta — key-gated, no payments;
  needs column-level grants before real Business users); **#3** `p_fare_snapshot` is client-supplied/forgeable → recompute
  in SQL when the pricing engine lands; **#6b** a mid-run Business cancel makes the trip vanish from the Driver's My Rides
  (visibility gap — pairs with notifications).
**Next:** founder re-runs the updated migration → re-verify the amendment fix → deploy. Then the immediate follow-ups:
the mutual-consent "agreed release" + the copilote hand-over (both reuse the amendment pattern).

## 2026-07-10 — Session 38 — Address search: Riviera-first ranking + narrower countries (Mapbox cleanup, Google deferred)
**Branch:** `main`. **No schema change.** **Touched:** `components/address-autocomplete.tsx` only. Founder flagged bad
autocomplete: typing "aéroport t2" returned a Roissy CDG Fnac #1, Barcelona/Geneva/Lisbon, with the Nice result buried at
#3. Asked whether to switch to Google.

**Diagnosis (tested the live Mapbox Search Box API directly):** two problems. (1) The country allowlist was a broad 12-
country EU list, so Spain/Portugal/etc. leaked in for vague queries. (2) Mapbox's POI ranking is genuinely weak for
prominent places — `proximity=Nice` only *nudges*, so a literal "T2" name match (CDG Fnac, a Barcelona parking) outranks
the local airport; `bbox`, `poi_category=airport`, tighter proximity all failed to float the real "Terminal 2, Aéroport
Nice-Côte d'Azur (NCE)" (it exists in Mapbox but ranks below shops/kiss-and-fly/Airbnbs). **Google Places weights
*prominence* and would genuinely rank major airports/hotels/stations first** — so the founder's instinct is sound.

**Decision (founder):** *Mapbox cleanup now (free, no new integration), Google later.* Google needs a Google Cloud
project + Places API key + billing the founder sets up (deferred to the integration phase, like the other third-party
integrations). Logged as the future fix for true POI precision.
**UPDATE (2026-07-10, later):** founder explicitly **deferred the Google swap until the final domain is registered** — so
the browser API key gets restricted to the *right* domains ONCE (avoids redoing it after the rebrand DNS move). The brand
name **at that date** was **RED Executive** (Riviera Executive Driver) — **since superseded by `Kavenue`, [[d50]]** — and a
Google Cloud project was created under that name, but the key/
switch waits. **For now: stay on Mapbox** (the Riviera-first cleanup above is the current state). When the switch happens
it's ~1 session, one file (`address-autocomplete.tsx`), Mapbox kept for routing. Related: the domain migration
(pickupbedriven.com → a Kavenue domain) is its own separate ~1-session task (DNS + Vercel + Supabase redirect allowlist +
`lib/hosts.ts` + the key restriction), also waiting on the founder registering the name/domain.

**Shipped (Mapbox cleanup):** (1) `DEFAULT_COUNTRIES` narrowed `fr,mc,it,ch,de,es,be,lu,nl,gb,at,pt` → **`fr,mc,it,ch`**
(France + the only neighbours a Riviera VTC actually DRIVES to: Monaco, Italy, Switzerland/Geneva). (2) A **Riviera-first
re-rank** — `isRiviera()` tests each suggestion's formatted address for a Côte d'Azur marker (postcodes 06/83/98000 or the
towns we serve) and a stable sort floats local hits to the top *without hiding* far destinations (they still show, below).
Verified live vs the real Mapbox API + in the browser field: "aéroport t2" now returns **"Kiss and Fly - Terminal 2, 06200
Nice" at #1** (Barcelona/Lisbon gone). Known limit: the exact NCE terminal still won't surface for that vague query — that's
the Google-later fix. `tsc` clean, no console errors. Deployed.

## 2026-07-10 — Session 37 — Mission-form polish: review card, capitalised names, numeric-only fields, trail time, pricing vehicle chip
**Branch:** `main`. **No schema change.** Five founder-requested tweaks; the two visual ones (review card + pricing chip)
went through a D25 preview (signed off "go"). **Touched:** `app/(dispatch)/dispatch/new/mission-form.tsx`,
`components/passenger-list.tsx`, `components/trip-row.tsx`, `app/(dispatch)/dispatch/[id]/edit/edit-form.tsx`,
`app/globals.css`.

1. **Review-before-posting card — lightly polished** (`mission-form.tsx`): the flat `.kv` + old `.route` swapped for the
   S36 detail vocabulary — the `.dx-rte` route rail (dot-to-dot connector), `.dx-srow` rows, and **chips** for Languages /
   Dress / Requests (`.dx-chip`). Guest + pax + bags collapse to one line; reference marked "· your team only". Same card,
   just coherent with the trip detail. Verified live (fare 65 €, connector route with a stop, all chips render).
2. **Names auto-capitalise** (`passenger-list.tsx`, shared by new + edit): a `capitalizeFirst` on the Guest first/surname
   `onChange` — first letter only (safe for "Al Souad"/"de la Croix") + `autoCapitalize="words"`. Verified: james→James.
3. **Numeric-only fields** (`mission-form.tsx` + `edit-form.tsx`): `luggage_count` (integer), `base_fare` + `ceiling`
   (money) switched from `type=number` to `type=text` + `inputMode` + a controlled sanitize (`digitsOnly` / `decimalOnly`
   — strips letters, `e`, `+`/`-`, extra dots; comma→dot). Reliable vs `type=number`'s quirks. Verified: `12ab.3cd9`→
   `12.39`, `9.9.9xx`→`9.99`, `3a4b`→`34`. Phone left flexible (needs `+`/spaces). (Amend-form fare left for later.)
4. **Edit trail shows the time** (`trip-row.tsx`): the `.dx-trail` now leads with the bold edit time
   (`formatDateTime(infoChange.at)`) then the changes; the separate top "Edited ·" stamp is suppressed when a trail is
   present (no double time). Verified live on trip `d6f7c70a`.
5. **Pricing card vehicle reminder** (`mission-form.tsx`, `.mx-vehiclechip`): a live accent-soft chip in the Pricing card
   head showing the class·body you're pricing (`serviceClassLabel(tier, body)`; "Business · Van" in luggage-only mode). The
   specific car isn't lifted from ServiceClassFields, so the chip is class·body only (the specific car is already in the
   review card) — a small follow-up could add `onCarChange` to include it. Verified: renders "Business" + accent-soft bg.

**Verified** on localhost vs the real Supabase DB: `tsc` clean, no console errors on the form or schedule. Deployed.

## 2026-07-10 — Session 36 — Expanded trip-row redesign + a "what changed" trail (detail-edit change-log)
**Branch:** `main`. **Migration (founder RUNS it):** `docs/migrations/2026-07-10_mission_info_change.sql` — a **new
`mission_info_change` table** (+ RLS, deny-by-default for Drivers). Additive only; base schema untouched (hard-rule #4).
**New files:** `lib/info-changes.ts`. **Touched:** `components/trip-row.tsx` (the detail rewrite), `app/globals.css`,
`app/(dispatch)/dispatch/page.tsx`, `app/(dispatch)/dispatch/[id]/edit/actions.ts`, `lib/database.types.ts`.
**D25 previews** (v1→v5 visualize mockups) all signed off ("that way better!!"). Founder decisions folded in below.

**Why:** the expanded `.dx-trip__detail` was one flat 15-row `.kv` definition list (When/Fare/Vehicle/Specific car/
Trip/Guest/Reference/Languages/Dress/Requests/Board/Message/Pax/Flight/Driver/Car) — equal weight, no grouping, and it
re-showed the collapsed row (When/Guest/Ref/Flight + the route drawn twice). Hard to scan across many trips. Founder
ask: "easy on the eyes, fast, efficient."

**The redesign (`.dx-trip__detail`, `.dx-*` classes; the flat `.kv`/`.route` kept for other pages — rides, missions,
new-mission form):** meta line (private **Reference lock-chip** "· your team only" + the detail-only "Edited ·" stamp)
→ **two edit-action tiles, each with a one-line helper** (Edit details = "Update guest, flight & service info · applies
now"; Propose a change = "New route or fare · the Driver must agree") so the two aren't confused (founder Q) → the
**"what changed" trail** → amendment state → hint → **scan-strip** (Pickup left · Vehicle · Flight · **Fare now right**,
per founder; the Flight tile drops out with no flight number) → **Route card** (full addresses + trip **distance·duration
in the header** beside the route, per founder; a **dot-to-dot connector that STOPS at the drop-off dot** — the old rail
overshot; live stop check-off preserved) → **slim single-line Driver bar** (avatar · name · tappable phone · car·plate;
"No Driver yet · in the Pool" when unassigned — was a stretched half-empty panel, per founder) → **Service · Guests
side-by-side** (`.dx-pgrid`; languages/dress/requests as **chips**; pax/bags shown **once**, in the Guests header, not
duplicated in the scan-strip per founder). Every variant handled: no driver, luggage-only, in-progress, no flight/guests/
service, and the amendment pending/declined/accepted states.

**"Can we see what a Business changed?" (founder Q) — two levels, both built:**
1. **Route/fare change (amendment) — no schema.** The "Change accepted" state now shows the **diff**: `Fare <s>120 €</s>
   → 140 € · Add a stop at 3 Bd de la Ferrage` (data already in `AmendmentBrief` — fareOld/fareNew/summary).
2. **Detail edit (guest/flight/service) — new migration.** `updateMissionInfo` now snapshots the info **before** the
   write, computes a human-readable diff (`lib/info-changes.ts` `diffMissionInfo` → phrases like "Flight BA342 → BA118",
   "Added guest X", "Dress Smart casual → Business formal"), and appends a row to **`mission_info_change`**. The schedule
   loads the **latest** row per mission (RLS-scoped) → a `.dx-trail` line under the actions. **Privacy:** the diff can
   contain the private reference tag / guest names, so it CAN'T sit on the mission row Drivers read — it's a **Business-
   only side table, deny-by-default RLS** (mirrors `mission_guest_contact` / `mission_amendment`). Founder chose the
   fuller "add the detail change-log too" option (vs amendment-diff-only). Both degrade gracefully pre-migration
   (missing-table query → empty; the insert logs + is non-fatal).

**Verified (localhost, real Supabase DB — `mission_info_change` NOT yet applied, so the trail degrades to empty):** `tsc`
clean. Dispatch schedule renders (27 real trips). Expanded a real Confirmed trip w/ an accepted amendment
(`d6f7c70a`, Jason Statham · Marc Dubois): the **whole redesign renders** — lock ref-chip, both action tiles w/ helpers,
the **enriched "Change accepted — Fare 120 → 140 € · Add a stop"**, scan-strip in order (Pickup·Vehicle·Flight·Fare-right),
route card w/ the connector **confirmed stopping at the drop-off dot** (`::before content:none` on the last leg), slim
driver bar, Guests panel "2 passengers · 2 bags". **No console errors.** Screenshot matches the approved v5 mockup.

**PENDING:** founder RUNS `2026-07-10_mission_info_change.sql` in Supabase → then deploy. (Redesign + amendment diff are
migration-independent; only the detail-edit trail waits on the table.) **Next:** the detail-edit change-log field-level
history is per-field human phrases stored at edit time (latest edit shown); a multi-edit visible history is a later
extension. Founder's other named items remain: Driver app redesign, the pricing-engine-dependent items.

## 2026-07-07 — Session 35 — Mission edit PHASE 2: the amendment / consent flow (propose → accept/decline)
**Branch:** `main`. **Migration (founder RUNS it):** `docs/migrations/2026-07-07_mission_amendment.sql` — a **new
`mission_amendment` table** (+ RLS + 2 indexes) and the atomic **`respond_to_amendment` RPC**. Additive only; the base
schema is untouched (hard-rule #4). **New files:** `lib/amendments.ts`, `app/(dispatch)/dispatch/[id]/amend/{page.tsx,
amend-form.tsx,actions.ts}`, `components/amendment-card.tsx`. **Touched:** `lib/database.types.ts`,
`components/{route-stops,trip-row}.tsx`, `app/(dispatch)/dispatch/{new/mission-form.tsx,page.tsx}`,
`app/(app)/rides/{page.tsx,actions.ts}`, `app/globals.css`. **D25 previews** (4 driver-card iterations → the muted-ends
route-diff card; the propose screen; the decline path) all signed off ("agreed go"). [[d40]]

**Why (D39 Phase 2):** once a Driver has ACCEPTED, Kavenue is the AGENT between two parties, so a **material change
(route / fare)** can't be applied silently — it's a **proposed amendment the Driver accepts or declines**, recorded
in-app even if they agreed by phone. Phase 1 (info-only edit, no consent) shipped S34; this is the consent flow.

**Data model (greenfield — nothing existed):** `mission_amendment` = the audit trail. Columns: the proposed NEW route
(`new_pickup_*`, `new_dropoff_*`, `new_waypoints`, `new_distance_km`, `new_duration_min`) + `new_fare` (the new agreed
TOTAL), a `from_snapshot jsonb` (the trip AS AGREED at propose-time incl. the current fare, for the "was …" display +
record), `note`, `decline_reason`, `status` (`proposed→accepted|declined|superseded`), timestamps, `business_id`
(denormalised for RLS), `proposed_by`. RLS: Business select/insert/update on its own missions (INSERT also checks the
mission is theirs); Driver select on missions assigned to them; **no Driver INSERT/UPDATE** — the response goes through
the RPC. Supabase default privileges cover the new table (base schema has no explicit grants).

**The atomic apply — `respond_to_amendment(p_amendment_id, p_accept, p_reason)` RPC** — a faithful **mirror of
`accept_mission`**: `SECURITY DEFINER`, resolves `current_driver_id()`, row-locks the amendment + mission, verifies the
mission is this Driver's and still `accepted/confirmed`, then in ONE transaction: **accept** → swaps the new route + fare
onto the mission and marks the amendment accepted; **decline** → leaves the mission untouched, marks it declined (+
reason). The fare is **frozen at `new_fare`** by collapsing the PDP curve (`ceiling = pdp_start = new_fare`, flat
step/interval, `speed_win=false`) so `currentFare()` reads exactly the agreed total (there's no stored "agreed fare"
today — the PDP climbs from `created_at`; this is the clean way to pin it). `stops_reached` resets. Conditional
`where … status='proposed'` → atomic first-wins (concurrent double-accept / accept-vs-decline can't half-apply).

**Business — propose screen (`/dispatch/[id]/amend`):** a locked "trip as agreed" header (route · time · assigned
Driver + car · agreed fare) + a two-pane form mirroring the new-mission layout: left = the exact `RouteStops` editor
(pickup + stops + destination **all editable** — founder asked to allow pickup) + a manual "New agreed fare" field
(shows the live delta) + an optional note; right = a **live "what the Driver will see" preview** (change summary +
fare/distance/drop-off deltas) + the send button. `proposeMissionAmendment` (USER session, RLS) verifies ownership +
`accepted/confirmed`, recomputes the ETA server-side (traffic-aware), snapshots the from-state (incl. `currentFare`),
**supersedes any still-pending proposal**, and inserts the new one. Redirects to `/dispatch?open=<id>` (the S33 deep
link) — the trip now reads "Change pending". `closeAmendment` withdraws a pending / dismisses a declined one.

**Driver — accept/decline card (`components/amendment-card.tsx`, in My Rides):** the approved v4 card — the change reads
**inside the route** (unchanged legs muted grey, the changed leg highlighted with a "New stop / New destination / New
pickup" badge; removed stops struck), a "was …" line, the Dispatcher's note, then **what it means for you** (fare
old→new + delta, distance·time, **Drop-off** [finish-flag icon, not a plane — founder's call]), an amber **slot heads-up**
(reuses the ±90-min idea: computes the trip's new end vs the Driver's next pickup — "tighter" or "overlaps"), and the
binding **Accept the change / Decline**. Decline opens an **optional one-tap reason** (Schedule too tight / Too far /
Timing / Other) — softens the rejection for the Business (founder ask). `respondToAmendment` calls the RPC via the USER
session (must NOT be service role — the RPC reads `auth.uid()`, like `accept_mission`, D6). Slot warning computed in
`rides/page.tsx` (`SLOT_TIGHT_MIN=30`).

**Business — schedule states (`trip-row.tsx` + `dispatch/page.tsx`):** the expanded detail gains a **"Propose a change"**
entry (accepted/confirmed only, next to "Edit details"), and renders the amendment state: **Change pending** (navy chip
+ summary + Withdraw), **declined** (a calm reassurance — "declines are normal in busy periods, not personal" — + the
reason + trip-stays-as-agreed + **Call / Adjust and re-send / Dismiss**), or a subtle **Change accepted · <time>**. The
dispatch page loads the latest non-superseded amendment per mission (RLS-scoped) → a compact `AmendmentBrief`.

**Founder feedback folded in (from the preview loop):** (1) enable **pickup edit** (not just destination + stops); (2)
the **decline reassurance** for the Business (busy-season scheduling, not personal) + the Driver's optional reason; (3)
fixed the send-rail copy — after sending you **leave for the schedule**, so it now says the answer shows there as
"Change pending" (was the wrong "you'll see his answer here"). Earlier: the driver card went through 4 iterations — the
change must read **in-context inside the route** (not an abstract hero banner), with the two unchanged ends muted so the
new stop stands out; and the drop-off row uses a **finish-flag**, not a landing-plane (a plane = a pickup to a Driver).

**Reused `RouteStops` (the most-worked component) safely:** added 3 additive fields to its `RouteSummary`
(`pickupText/dropoffText/stops`) so the amend preview can diff the live route; the new-mission rail ignores them (its
initial literal was updated to satisfy the type). Pure diff/summary helpers live in `lib/amendments.ts` (`routeDiff`,
`changeSummary`, `parseFromSnapshot`, `buildFromSnapshot`, `dropoffInstants`, `DECLINE_REASONS`), shared client + server.

**Verified (localhost, real Supabase DB — the mission_amendment table NOT yet applied, so the flow degrades gracefully):**
`tsc` clean. Dispatch schedule renders (27 real trips; the amendments query returns nothing without the table — no
crash). **Propose screen renders end-to-end** for a real Confirmed trip (locked header "Marc Dubois · Mercedes Classe E
· Agreed fare 130,00 €", RouteStops editor, live ETA, fare field) and the **live delta reacts** (145 € → "Current 130,00
€ · +15,00 €" green, and the preview rail "130,00 € → 145,00 € +15,00 €"); the empty-route-diff path shows "Fare change
only" (exercises `routeDiff`/`changeSummaryParts`). Driver rides page renders. **No console errors on any surface.** The
two-pane collapses to stacked under the narrow preview panel (correct; side-by-side ≥ ~600px content).
**Then the founder RAN the migration** (2026-07-07) and the FULL loop was **verified live vs the real DB**: (1) a
fare-only **propose → decline** (RPC decline branch; trip fare untouched; Business sees the reason + reassurance state);
(2) a fare-only **propose → accept** (RPC accept branch; fare swapped 55→70 €, frozen; "Change accepted"); (3) a real
**add-a-stop route change** — Business added "3 Bd de la Ferrage" (ETA recomputed 57 km · 1h13, fare 120→140 €) → the
Driver card rendered the **highlighted new stop + badge** with the deltas → accept → the **mission genuinely swapped**
(route now pickup → 3 Bd de la Ferrage → Pl. du Casino Monaco, Trip 57 km · 1h13, Fare 140 €). RLS (business insert +
driver read), the atomic RPC (both branches), and the fare-freeze all confirmed. No console errors. **Pushed + deployed**
(`fc63a37` — Vercel deployment SHA + build status verified `success`).

**Deploy note:** the follow-up **docs-only** commit `51784d8` hit a **transient Vercel build flake** (`failure`), even
though its app code is byte-identical to the successful `fc63a37`. Reproduced `next build` **locally → clean** (all
routes compile, incl. `/dispatch/[id]/amend`), confirming it was infra, not code; production was never down (Vercel keeps
the last successful deploy live). Re-triggered with an empty commit → **`ddeadf5` deployed `success`**. Lesson added to
the WORKFLOW note in `NEXT_SESSION.md` (a transient BUILD FAILURE, not just a dropped commit, also happens — reproduce
with `next build`, re-trigger if it passes). **Test artifacts left on the shared demo DB** (visible on prod too, all
revertible): trip `00a5e67b` fare 55→70 € (accepted), `d6f7c70a` +stop "3 Bd de la Ferrage" & 120→140 € (accepted),
`1b8a1444` a declined-change example.

**Next:** **Phase 3** (auto price-delta via the pricing engine + notifications so the Driver is alerted without watching the
app + an in-app "could we add a stop? +€X" note) — both wait on deferred integrations. Also queued: O7 cancel/re-pool
(the decline "or Business cancels" path), the unfolded-trip-row redesign (founder's other named item), Driver app redesign.

## 2026-07-05 — Session 34 — Edit a posted trip's INFO without touching price (mission edit, Phase 1)
**Branch:** `main`. **No schema change.** New: `app/(dispatch)/dispatch/[id]/edit/{page.tsx,edit-form.tsx,actions.ts}`.
Touched: `components/trip-row.tsx` ("Edit details" link + `editable` flag), `app/globals.css` (`.ex-*` / `.dx-editlink`).
**D25 preview** signed off ("ok"). First slice of the KEEP "limited edit" feature (Doc 02); design phased with the
founder — Phase 2 (amendment/consent for material changes) + Phase 3 (auto-delta + notifications) are in IDEAS.

**Shipped:** a Business can edit the **info a Driver sees** on a posted mission — Guest names + phones (+ share),
flight number, luggage, reference, and the whole Driver & service card (languages, dress, request flags, meet &
greet board + file, private message) — **without changing the price, route, or time.**
- **New route `/dispatch/[id]/edit`** (server `page.tsx`): loads the one mission + its `mission_guest_contact` phones
  (RLS-scoped), renders a **read-only "locked" header** (route rail · time · `Fare (now)` · ceiling · status pill,
  via `missionTone`) with a note that route/price changes are the Phase-2 amendment flow, then the editable form. If
  the trip isn't editable it shows a "frozen" notice instead of the form.
- **`edit-form.tsx`** (client) **reuses the exact new-mission components** — `PassengerList`, `ReferenceField`,
  `DriverServiceFields` — pre-filled the SAME way the form seeds a resumed draft (`mergeContacts` + `splitFullName`
  fallback + pad to `pax_count` bounded `VAN_SEATS`; `parseLanguages`/`parseDriverFlags`/`hasBoardFile`). Tier for the
  dress-code default derives from `mission.category` (SERVICE_TIERS, legacy `van`→business fallback). A luggage-only
  run hides the Guests card. `useFormStatus` Save button ("Saving…"), multipart for the board file.
- **`actions.ts` `updateMissionInfo(id, formData)`** — the safety core. **Whitelists ONLY info columns**; the UPDATE
  object literal can't receive price/route fields, so `base_fare/ceiling/pdp_*/speed_win/created_at/category/pickup*/
  dropoff*/waypoints/distance_km/duration_min/zone/status/luggage_only/required_*` are all untouched → the PDP curve
  and Pool matching can't move. **Atomic status guard** via `.in("status",["pooled","accepted","confirmed"])` on the
  update (+ `business_id` eq + RLS) — no TOCTOU with a mid-edit accept; 0 rows → `?error=locked`. Mirrors createMission
  for passenger parsing, the board-file upload/clear conditional-spread (keeps an existing board when no new file), and
  the `mission_guest_contact` upsert-else-delete (only after the row update matched — no orphan). Redirects to
  `/dispatch?open=<id>` (reuses the Session-33 deep link → row expands + scrolls). `revalidatePath` schedule/calendar/history.
- **Entry point:** an "Edit details" link in the expanded schedule trip detail, shown only while `pooled/accepted/confirmed`.

**Verified live** (localhost, real Supabase DB): edit link appears on an editable trip → edit page renders (locked
header Eco·Van €67.50/ceiling €90, all 3 cards) → set reference + driver message → save → redirected to `?open=` with
the row expanded; **reference + message persisted, and Fare 67,50 € · ceiling 90,00 € · route 9.7 km/18 min · status
"In the Pool" ALL UNCHANGED.** `tsc` clean; no console errors. **Adversarial 2-lens review (security + parity, Opus,
51 tool calls) → 0 findings** (price-safety invariant + createMission parity both hold).

**Follow-up (founder feedback, same day):** two polish asks on the edit feature.
- **Edit button placement** — it was at the BOTTOM of the expanded trip detail (expand + scroll = unintuitive). Moved
  it to the **TOP-right of the detail** as a filled navy button (first thing you see on expand). D25 mockup: founder
  picked "top of detail only" (declined a row-level pencil). No schema — shipped first (`5e6a0cb`).
- **"Edited" mention** — founder wanted a simple edited indicator **in the trip detail only, NOT on the collapsed row**
  (declined per-item "what changed" — that's really a Driver-notification feature, deferred to the edit Phase 3).
  Migration `docs/migrations/2026-07-05_mission_info_edited_at.sql` (`mission.info_edited_at timestamptz`, founder RAN
  it live). `updateMissionInfo` stamps `info_edited_at = now()` on every info edit (never on price/route/status).
  `trip-row.tsx` shows **"Edited · <time>"** (via `formatDateTime`) at the top-left of the detail edit bar, kept even
  after the trip is frozen; **never rendered on the collapsed `<summary>` row.** `lib/database.types.ts` updated (Row +
  Insert). Verified live: edit → "Edited · dim. 05 juil., 18:51" shows in the detail, absent from the row, ceiling
  unchanged. `tsc` clean.


---

## Older sessions (1–33) — archived
Sessions 1–33 (2026-06-16 → 2026-07-05) live in **`project/SESSION_LOG_ARCHIVE.md`** to keep this file — and
session startup — light. Read the archive only if you need that deep history; `project/CHANGELOG.md` has the
plain-language big picture.

---

## Session 52 — 2026-07-31 · § Q ruled on and parked · Dispatch History taken the rest of the way ([[d67]], [[d68]])

### Part A — abandoned trips (§ Q): a founder conversation, no code

The founder opened by challenging the premise: *"I am the only one here testing… in a real situation there will be
people taking care of it — a business who creates a mission will follow up on it… and if a driver has it we did offer
solution on both parties, copilote, agreed release, T-60."*

Mostly right, and the useful part was naming **which** case the valves cover. Every escape valve built to date
(copilote · agreed release · T-60 · Business cancel) answers **"this trip isn't going to happen"** — someone is
unhappy, so someone acts. That case is genuinely closed. The open hole is the opposite: **the trip DID happen and
nobody tapped the last button.** Driver drops the Guest, hotel is delighted, Driver moves on and never reopens the app.
Nobody is unhappy, so nobody chases it — the service was fine, only the *record* is wrong, and the record is what pays
the Driver and bills the Business. **That is the case that survives real users, because it has no complainer.**

So the answer isn't a rule (time can never separate "drove and forgot" from "never turned up") but a **question**:
a pinned card — **not a modal**, the founder agreed a popup trains people to tap ✕ without reading — on My Rides ~3h
after the trip should have ended. The founder's own best question closed the design: *"what if the driver comes back a
month later?"* A month later he doesn't remember either, so the question has a **48h shelf life** and then **flips to
the Business**, who knew that same day whether their Guest reached the airport.

The founder also proposed **geolocation auto-close**. Right instinct, blocked: Kavenue is a PWA and a browser only gets
location while the app is on screen — no background arrival detection without a native app. And even then, **location
may suggest, never decide**; location closing a trip is location *paying* someone (failure case: the Driver returns to
Nice airport at 11am for his next job and the app closes and pays out yesterday's trip).

**Founder's call: leave it.** All 8 rows are test artifacts, and the card only fires if a Driver opens the app, so the
design needs push. Written up in full in BACKLOG § Q + [[d67]] so it is never re-derived. Q4 (reliability mark) stays
open; Q5 dissolves; ⚑ the "No, the Guest never showed" branch will need its own route — the [[d47]]/[[d48]] no-show
rules assume a courtesy-wait clock running on the spot and will not pass their guards three days later.

### Part B — Dispatch History, § R phase 2 ([[d68]], deployed `0acdb68` → Vercel `success`)

Founder: *"it is a professional tool, and they need accurate infos and easy to find a specific trip or mission by
drivers name, or passenger or internal reference, or car… it need to be perfect and complete."*

**D25 loop:** researched back-office/reservation-log patterns, then built a **live** preview at real width (a static
harness on :4613 `<link>`-ing the real `app/globals.css`, with the founder's own addresses/refs/guests) — the search
actually filtered, so the founder could type in it. Signed off with one change: **the search placeholder was being
truncated**, so it became `Search trips…` with the covered fields shown under the box on focus.

**New files**
- `lib/history-filter.ts` — the ONE place a past trip is filtered, searched, sorted and priced. The page and the CSV
  route both call `applyHistoryQuery`, which is what makes "Export CSV = exactly what's on screen" survive future
  filters. Holds `fold()` (accent-blind compare), `foldWithMap()`/`highlightSegments()` (paint the ORIGINAL string from
  offsets found in the FOLDED one — folding the whole string loses the mapping the moment a character isn't 1:1),
  `matchRow()` (AND across terms, OR across fields, returns WHICH fields hit), `historyFare()` and `historyHref()`.
- `components/history-filters.tsx` — the toolbar. Search debounced 300 ms into the URL via `router.replace`; native
  `<select>` for Driver/class/sort (keyboard + SR correct for free, platform picker on a phone); Export is a plain `<a>`.
- `components/date-cal.tsx` — the Earnings calendar, **extracted** and adopted unchanged. Gained one optional
  `anchorDay` prop so it can open on a month while banding nothing.
- `app/(dispatch)/dispatch/history/export/route.ts` — CSV.

**Changed:** `history/page.tsx` (rewrite), `components/trip-row.tsx` (archive gains a date cell, a fare cell, the
highlight and the match-reason line), `components/earnings-period.tsx` (imports the shared calendar), `lib/format.ts`
(`formatArchiveDay`), `app/globals.css` (the 8-column archive grid + toolbar).

**Two gaps the work exposed:** rows showed only a **time** while grouped by **month** (3 vs 19 July indistinguishable),
and there was **no fare column at all**.

**⚑ The accuracy call.** First cut counted every non-expired trip's `settledFare` into the spend total — which silently
included the 8 § Q trips nobody ever closed, inflating the archive's spend by trips that may never have happened.
`historyFare()` now returns `{fare, counted}`: an unclosed trip shows its agreed fare **greyed, "Not settled", excluded
from row totals, month bands and the summary**, with its own CSV column.

**⚑ Bug caught in review, not by the compiler.** The search box tracked "has the user typed" with a boolean ref that
never reset — so after typing, **"Clear filters" could not clear the box**: the effect ignored the incoming empty
`query.q` and re-pushed the stale text. Replaced with a `sent` ref holding the last value the box itself pushed;
anything else arriving in `query.q` (Clear, Back, a pasted link) wins. Verified live.

**CSV specifics:** `;` delimiter and French decimals (58,17) because the reader is Excel FR, where a comma is the
decimal separator and a comma-delimited file lands entirely in column A; UTF-8 BOM (without it "Aéroport" arrives as
"AÃ©roport"); a leading `=`/`+`/`-`/`@` is quote-prefixed so a stray reference can't execute as a formula.

**Verified live** vs the real Supabase DB on `Le Grand Hôtel (demo)`, 28 past trips: accent search (`medecin` → matches
and highlights "Médecin"), car search (`mercedes` → 10 rows, each with the `Car ·` reason line), the settled/unsettled
money split (10 trips, only the 3 completed summing to 265,00 €), a two-tap range (1–6 Jul, band joins, calendar stays
open with Done, results narrow to 1), search→Clear round trip, CSV output (delimiter, decimals, accents, sort, columns),
narrow-viewport wrap + side-scroll, and **the Driver's Earnings picker re-checked at 430 px after the extraction** (no
regression). `tsc --noEmit` clean · `next build` green (25 routes) · no console errors.

**Left open, deliberately** (both recorded in § R): the **volume ceiling** — the page loads the whole archive in one
query and filters in memory, which is exactly what lets the chip counts, the Driver dropdown and the class list be
honest about the *whole* archive; correct at 28 trips, first thing to break at 5 000, at which point the filters move
into SQL and the counts need their own aggregate query. And the **density toggle** — the row is already dense and
nobody asked for it.
