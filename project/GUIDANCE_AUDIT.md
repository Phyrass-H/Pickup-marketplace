# PickUp — In-app Guidance Audit & Roadmap

> Full inventory of every piece of in-app guidance (helper text, hinting placeholders,
> soft warnings, empty states, confirmations, tooltips, "coming soon" stubs, concept
> labels) across the app — plus the gaps and a prioritized plan to fill them.
> Produced **2026-07-04** via a 4-way parallel audit (new-mission form · rest of Dispatch ·
> Driver app · whole-app grep sweep). **Reference doc — keep it current as guidance is added.**

## TL;DR
- The app is already **substantially guided** (~50+ items). Point-of-use microcopy is decent,
  especially on the mission form and in Settings; the soft-warning style (amber `.notice.warn`)
  already matches the Doc 02 "nudge, not block" rule — a good base to extend.
- **Structural finding:** there is **no reusable guidance component** — all guidance is ad-hoc
  inline JSX carried by CSS classes, with class fragmentation (`.set-note`, `.rf-hint`, `.ds-note`
  are all ≈ `.muted.small`).
- **Biggest gap:** the core concepts (Ceiling, Pool, SPEED WIN / PDP, Lock-in / T-180, the status
  pills) are taught in fragments and defined nowhere; there is no FAQ/glossary (support is a
  `mailto:` only). Mostly the standalone **tutorial's** job + a small in-app glossary tooltip.
- **Highest in-app leverage:** mission-form pricing help (a suggested Ceiling range from the
  distance/ETA the form already computes) and a few input-driven nudges.

## How guidance is built today
- No `<Hint>` / `<InfoTip>` component. Guidance is carried by **CSS classes** (`app/globals.css`):
  - `.notice` + `.notice.warn` (amber `#fffbeb`/`#d97706`, soft) · `.error` (red) · `.info` · `.success` — banners.
    `.warn` is the Doc-02 "soft warning" style.
  - `.muted` + `.small` — the workhorse inline hint (~50 uses).
  - `.empty` — centered empty-state block.
  - one-off near-duplicates: `.set-note`, `.rf-hint` / `.rf-note`, `.ds-note` / `.ds-head__hint`,
    `.pl-note`, `.tier-empty`, `.mx-summary__empty`.
- The only reusable-ish helpers: `SectionHead` (Business settings only) and `HelpLegalCard` (shared,
  both sides).

---

# Full inventory (by surface)

*The four sections below are the raw per-surface audits. Each ends with its own GAPS list; the
consolidated gaps + roadmap are at the bottom of this document.*


---

## A · New-mission form

# Guidance Inventory — Dispatch New-Mission Form

Legend for TYPE: **helper** (p.muted.small / subtext) · **placeholder** · **hint** (inline label-adjacent) · **warn** (.notice.warn / soft nudge) · **error** (.notice.error / validation) · **info** (.notice.info) · **empty-state** · **confirm** (dialog) · **tooltip** (title=) · **aria** (teaching aria-label) · **concept-label** (a label whose wording explains a concept).

## Page intro (above the form)

| # | File:line · TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| 1 | `page.tsx:59` · helper | "Review it before it goes live. Posts into the matching Driver Pool — you set the ceiling; PickUp prices up to that maximum." | always | top of New-mission page |

## Card 1 — Vehicle & class (`service-class-fields.tsx`)

| # | File:line · TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| 2 | `service-class-fields.tsx:80` · concept-label | "Service class (routes to the matching Pool)" | always | tier picker label |
| 3 | `service-class-fields.tsx:19–23` (via `:91`) · hint | Tier example lines: `eco` → "Standard comfort", `business` → "Mercedes E, BMW 5, Audi A6", `luxury` → "S-Class, 7 Series, Maybach" | always | inside each tier tile |
| 4 | `service-class-fields.tsx:97` · label | "Body type" | always | body segmented control |
| 5 | `service-class-fields.tsx:70,99` · concept-label | "Any" (body choice — reaches sedan AND van Drivers) | always | body control (first option) |
| 6 | `service-class-fields.tsx:115` · label | "Specific car (optional)" | when a body is chosen and the tier has catalog models (or a resumed draft names one) | specific-car block |
| 7 | `service-class-fields.tsx:123` · hint (option) | "Any {Tier} {body} (recommended)" — e.g. "Any Business sedan (recommended)" | same condition, default `<option>` | car dropdown |
| 8 | `service-class-fields.tsx:137–139` · helper | If a car is picked: "Only Drivers with this exact car will see the mission — expect fewer matches." · else: "Pick an exact model only if the Guest insists — it narrows the Pool." | conditional on car picked / not | under car dropdown |
| 9 | `service-class-fields.tsx:146–150` · info (empty-state) | "{Tier} matches any standard car — no specific models to choose." (with Info icon) — e.g. "Eco matches any standard car…" | when a body is chosen but tier has no catalog (Eco) | specific-car slot |

## Card 2 — Route (`route-stops.tsx` + `address-autocomplete.tsx`)

| # | File:line · TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| 10 | `route-stops.tsx:206` · placeholder | "From — address, airport, station…" | always | pickup field |
| 11 | `route-stops.tsx:221` · placeholder | "Stop {n}" — e.g. "Stop 1" | when a stop row exists | stop field |
| 12 | `route-stops.tsx:245` · affordance-label | "Add a stop" | until MAX_STOPS (5) reached | add-stop row |
| 13 | `route-stops.tsx:262` · placeholder | "Where to?" | always | dropoff field |
| 14 | `route-stops.tsx:231,233` · aria+tooltip | aria "Remove stop {n}" · title "Remove stop" | per stop row | stop remove button |
| 15 | `route-stops.tsx:275–276` · aria+tooltip | aria "Swap pickup and drop-off" · title "Swap pickup and drop-off" | always | swap button |
| 16 | `route-stops.tsx:298` · empty-state (loading) | "Estimating distance & time…" | pickup+dropoff picked, ETA in flight | route card footer |
| 17 | `address-autocomplete.tsx:329` · helper (status) | "Locating…" | while a picked suggestion resolves coords | under any address field |
| 18 | `address-autocomplete.tsx:331–334` · hint (status) | "Pick an address from the list so we can place it on the map." | typed ≥3 chars, nothing picked yet, non-compact field (pickup/dropoff, not stops) | under address field |
| 19 | `address-autocomplete.tsx:337–339` · error | "Address search is unavailable (Mapbox token missing)." | only if Mapbox token missing (config failure) | under address field |

## Card 3 — Schedule (`mission-form.tsx` + `date-time-picker.tsx`)

| # | File:line · TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| 20 | `mission-form.tsx:457` · label | "Pickup date & time" | always | Schedule card |
| 21 | `mission-form.tsx:461–463` · helper | "{pretty local date} · Europe/Paris" — e.g. "sam. 5 juillet, 09:00 · Europe/Paris" | once a date/time is set | under picker |
| 22 | `date-time-picker.tsx:81` · placeholder | "Choisir une date" (FR) | before a date is picked | date button |
| 23 | `date-time-picker.tsx:178` · placeholder | "Heure" (FR) | before a time is picked | time button |
| 24 | `date-time-picker.tsx:189` · aria | "Heure exacte" (FR) | always | exact-time input in time popover |
| 25 | `date-time-picker.tsx:110,112,118` · aria | "Choisir une date", "Mois précédent", "Mois suivant" (FR) | calendar popover open | calendar nav |
| 26 | `date-time-picker.tsx:181` · aria | "Choisir l'heure" (FR) | time popover open | time popover |
| 27 | `date-time-picker.tsx:137` · behavior (no text) | past days `disabled` (`iso < today`) | always | calendar grid |

> Note on 22–26: the picker's teaching/placeholder text is **French** while the rest of the form is **English** — see GAPS.

## Card 4 — Trip details (`passenger-list.tsx`, `reference-field.tsx`, `mission-form.tsx`, `share-switch.tsx`)

| # | File:line · TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| 28 | `passenger-list.tsx:84,87` · concept-label | "Passengers" + cap pill "{Body} · up to {cap}" / "{n} / {cap}" — e.g. "Any · up to 7" | always | Passengers header |
| 29 | `passenger-list.tsx:97` · affordance | "Add passenger" (disabled at cap) | until cap | Passengers header |
| 30 | `passenger-list.tsx:109,117` · concept-label | "Guest {n} · Main contact" (main) / "Guest {n} · Set as main" (others) | per row | Guest row header |
| 31 | `passenger-list.tsx:138,146,155` · placeholder | "First name" · "Surname" · "Phone (optional)" | always | Guest fields |
| 32 | `passenger-list.tsx:141,148,158` · aria | "Guest {n} first name / surname / phone" | always | Guest fields |
| 33 | `passenger-list.tsx:126` · aria | "Remove Guest {n}" | when >1 row | Guest row |
| 34 | `passenger-list.tsx:70–78` · warn (over-cap) | "More passengers than a {Body} holds ({cap}) — remove some or switch Body type." | rows > cap | live region under rows |
| 35 | `passenger-list.tsx:73` · warn | "More than 4 passengers needs a Van." | Body=Any and rows>4 | live region |
| 36 | `passenger-list.tsx:75` · hint | "A Sedan seats up to 4. Switch Body type to Van to add more." | Body=sedan and at cap | live region |
| 37 | `passenger-list.tsx:77` · hint | "A Van seats up to 7." | Body=van and at cap | live region |
| 38 | `passenger-list.tsx:187–191` · helper | "Names are optional. The **main contact** shows on the schedule line. A phone is never shared automatically — flip *Share with Driver* to let them call the Guest, now or later from the schedule." | always | under passenger rows |
| 39 | `share-switch.tsx:21` · aria | "Shared with Driver — tap to stop sharing" / "Share this number with the Driver" | when a phone is typed | per-Guest share switch |
| 40 | `share-switch.tsx:29–31` · concept-label | "Shared with Driver" / "Share with Driver" | when a phone is typed | share switch label |
| 41 | `mission-form.tsx:494` · label | "Luggage" | always | Trip details |
| 42 | `mission-form.tsx:508` · label | "Flight number (optional)" | always | Trip details |
| 43 | `mission-form.tsx:513` · placeholder | "AF1234" | always | Flight number input |
| 44 | `reference-field.tsx:22,25` · concept-label | "Reference (optional)" + live count "{n} / 20" | always | Reference block |
| 45 | `reference-field.tsx:38` · placeholder | "Room 312" | always | Reference input |
| 46 | `reference-field.tsx:42` · helper | "A short tag for your own schedule." | always | under Reference |
| 47 | `reference-field.tsx:43–45` · helper (privacy) | "Not shown to the Driver" (with EyeOff icon) | always | under Reference |

## Card 5 — Driver & service (`driver-service-fields.tsx`)

| # | File:line · TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| 48 | `driver-service-fields.tsx:127` · concept-label | "Languages the Driver should speak" | always | Languages block |
| 49 | `driver-service-fields.tsx:145–147` · helper | "Matched against the languages each Driver lists on their profile." | always | under language chips |
| 50 | `driver-service-fields.tsx:154,157–159` · label + hint | "Dress code" + hint "Default set from your service class" (Info icon) | always | Dress code header |
| 51 | `driver-service.ts:60–72` (via `:177,182`) · concept-label + helper | Per-code label + description, e.g. "Driver's choice" — "Clean, neat everyday wear. No specific requirement."; "Smart casual" — "Collared shirt, tidy trousers, clean shoes. No tie."; "Business formal" — "Dark suit, open collar. Tie optional."; "Suit & tie" — "Dark suit and tie." | always | each dress-code option |
| 52 | `driver-service-fields.tsx:179` · hint (tag) | "Default · {Tier} tier" — e.g. "Default · Business tier" | on the tier's default dress code | dress option |
| 53 | `driver-service-fields.tsx:183–186` · hint | "Specific event or VIP protocol" (Sparkles icon) | only on the "Suit & tie" option | dress option |
| 54 | `driver-service-fields.tsx:198–199` · label | "Requests (optional)" | always | Requests block |
| 55 | `driver-service.ts:101–108` (via `:214`) · concept-label | Flag labels: "Meet & greet", "Greeter — wait at the car", "Luggage help", "Child seat", "Quiet ride", "Pets on board" | always | request chips |
| 56 | `driver-service-fields.tsx:225` · label | "Name on the board" | when Meet & greet flag is on | board sub-block |
| 57 | `driver-service-fields.tsx:229` · placeholder | "e.g. Mr. Laurent Chopard" | when meet & greet on | board name input |
| 58 | `driver-service-fields.tsx:240` · affordance | "Attach a board" | when meet & greet on | attach button |
| 59 | `driver-service-fields.tsx:250` · helper | "PDF, JPG or PNG — for a company or brand board" | when meet & greet on | next to attach button |
| 60 | `driver-service-fields.tsx:264` · info (state) | "A board is already attached" | resumed draft with an attached board, meet & greet on | board sub-block |
| 61 | `driver-service-fields.tsx:257,269` · aria | "Remove attachment" / "Remove attached board" | attachment present | remove buttons |
| 62 | `driver-service-fields.tsx:276–279` · helper | "Pre-filled with the first Guest — change it for a company or brand name, or attach a board." | when meet & greet on | under board block |
| 63 | `driver-service-fields.tsx:287` · label | "Message to the Driver (optional)" | always | Message block |
| 64 | `driver-service-fields.tsx:293` · placeholder | "Special instructions for this trip — e.g. wait at the lobby desk and call the room on arrival." | always | message textarea |
| 65 | `driver-service-fields.tsx:296–298` · helper (privacy) | "Private to the Driver — revealed once they accept." | always | under message |

## Card 6 — Pricing (`mission-form.tsx`)

| # | File:line · TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| 66 | `mission-form.tsx:553` · concept-label | "Estimated base fare € (optional)" | always | Pricing |
| 67 | `mission-form.tsx:565` · concept-label | "Ceiling € (your maximum)" | always | Pricing |
| 68 | `mission-form.tsx:578–583` · warn | "Trips below the recommended fare are rarely accepted and may go unfulfilled. You can still post it." | base fare set AND ceiling < base fare | under price inputs |
| 69 | `mission-form.tsx:584–587` · helper | "The base fare drives a soft "below recommended" warning only. The ceiling is the most a Driver can climb to." | always | under price inputs |
| 70 | `mission-form.tsx:596–599` · concept-label | "**SPEED WIN** — start high (70% of ceiling) and climb fast for near-instant pickup" | always | SPEED WIN checkbox |

## Summary rail (`mission-form.tsx`, right pane)

| # | File:line · TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| 71 | `mission-form.tsx:752–754` · empty-state | "Pick a route to see the distance, time and starting fare." | no pickup and no dropoff | rail (route slot) |
| 72 | `mission-form.tsx:767` · empty-state (loading) | "Estimating distance & time…" | pickup+dropoff set, ETA loading | rail |
| 73 | `mission-form.tsx:784` · concept-label | "Ceiling (your maximum)" | ceiling set | rail |
| 74 | `mission-form.tsx:798–800` · concept-label | "starting fare · climbs up to {ceiling}" | ceiling set | rail |
| 75 | `mission-form.tsx:811,815` · concept-label | "Pricing mode" → badge "SPEED WIN" or "Standard climb" | ceiling set | rail |
| 76 | `mission-form.tsx:818–824` · warn | "Below the recommended base fare — may go unfulfilled." | ceiling<base AND preview mode | rail |
| 77 | `mission-form.tsx:828–830` · empty-state | "Set a ceiling under Pricing to see the starting fare." | no valid ceiling | rail (fare slot) |
| 78 | `mission-form.tsx:730` · label | "Mission summary" | always | rail band |
| 79 | `mission-form.tsx:844,847` · affordance | "Review mission →" / "Save as draft" | edit mode | rail actions |

## Preview (`mission-form.tsx`, preview mode)

| # | File:line · TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| 80 | `mission-form.tsx:607–609` · helper | "Review before posting — this is how it enters the Pool." | preview mode | above preview card |
| 81 | `mission-form.tsx:623–625` · concept-label | "starting fare · climbs up to {ceiling} (your ceiling)" | preview mode | preview card |
| 82 | `mission-form.tsx:710–722` · warn (nudge) + action | "This pickup is in under 5 hours. Consider SPEED WIN so a Driver grabs it fast. **Enable SPEED WIN**" | preview mode, pickup ≤5h away, SPEED WIN off | below preview card |
| 83 | `mission-form.tsx:856–864` · affordance | "Post to the Pool" / "Post draft to the Pool" · "← Edit" · "Save as draft" | preview mode | rail actions |
| 84 | `mission-form.tsx:655,661,663,691,697,703` · concept-label | Preview kv labels teaching what was captured: "Specific car", "Pax / luggage" ("… pax · … bags"), "Requests", "Name board", "Message to Driver" | preview mode, when the field has a value | preview card |

## Confirm-post dialog (`mission-form.tsx`)

| # | File:line · TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| 85 | `mission-form.tsx:908–915` · confirm | Title "This is final" + body "Posting sends this live to the Driver Pool right away — it can't be un-posted." | after clicking Post to the Pool | modal |
| 86 | `mission-form.tsx:917–920` · confirm (buttons) | "Cancel" / "Post to the Pool" (or "Post draft to the Pool") | modal open | modal |

## Banners & server-side validation (`mission-form.tsx` reads `?error=`; set by `actions.ts`)

| # | File:line · TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| 87 | `mission-form.tsx:372` · info | "Editing a saved draft." | resuming a draft, edit mode | top banner |
| 88 | `mission-form.tsx:374–378` · info | "Pre-filled for **{date}** from the calendar." | arrived via `?date=` (calendar), not a draft | top banner |
| 89 | `mission-form.tsx:379–384` · error | "A mission needs at least a vehicle class, a pickup picked from the address suggestions, a pickup time, and a ceiling — even to save as a draft." | `?error=missing` (server: `actions.ts:145–154,166`) | top banner |
| 90 | `mission-form.tsx:385–390` · error | "Add a drop-off and pick it from the address suggestions before posting. (You can still save it as a draft without one.)" | `?error=nodrop` (server: `actions.ts:159–161`) | top banner |
| 91 | `mission-form.tsx:391–395` · error | "That pickup time is in the past. Pick a future time, or save it as a draft." | `?error=past` (server: `actions.ts:169`) | top banner |
| 92 | `mission-form.tsx:396–401` · error | "That draft was already posted or discarded — check your schedule, it may be live already." | `?error=gone` (server: `actions.ts:286`) | top banner |
| 93 | `mission-form.tsx:402–404` · error | "Something went wrong. Please try again." | `?error=db` (server: `actions.ts:283,293`) | top banner |
| 94 | `mission-form.tsx:303–305,868–872` · error (client) | "Before posting, add {a, b, and c}." (names only what's missing: "a vehicle class", "a pickup address", "a pickup chosen from the address suggestions", "a drop-off address", "a drop-off chosen from the address suggestions", "a pickup time", "a ceiling price") | clicking Review with fields missing | rail (client-side) |

---

# GAPS — where a non-VTC hotel Dispatcher (or a Driver) is left without guidance

These are confusion points specific to this form where **no guidance exists today**:

1. **"Ceiling" is never actually defined in plain terms.** The concept-label says "your maximum" and helper #69 says "the most a Driver can climb to," but a first-time hotel Dispatcher is never told *why* a price climbs at all, or that they don't pay the ceiling — they pay whatever fare a Driver accepts at. The page intro (#1) mentions "PickUp prices up to that maximum" but the mechanic (auction that starts low and rises) is invisible until you notice the "starting fare · climbs up to…" line. No tooltip/explainer on the word "Ceiling."

2. **"Base fare" has no anchor for what a *reasonable* number is.** The only feedback (#68) fires when ceiling < base fare, i.e. it assumes the Dispatcher already knows a market rate. There's no suggested/estimated fare from the computed ETA/distance (the form has `route_distance_km`/`route_duration_min` in hand) — so a hotel clerk pricing a Nice→Cannes transfer gets zero help choosing a number, and "Estimated base fare (optional)" reads as busywork with unclear payoff.

3. **SPEED WIN's cost/trade-off is unstated.** #70/#82 sell the upside ("near-instant pickup," "start high (70% of ceiling)") but never say the downside — that starting higher means the Business likely *pays more*. A Dispatcher can't tell whether SPEED WIN costs them money or is free. The two pricing modes ("Standard climb" vs "SPEED WIN") are never contrasted in one place.

4. **"Pool" is used everywhere with no definition.** #1, #2, #8, #71, #80, #85 all say "Pool" / "Driver Pool" / "routes to the matching Pool." A hotel Dispatcher has no idea this means "the set of eligible Drivers who'll see and bid on it." It's core to how the product works and is never explained on the form.

5. **Service tiers ("First") are unexplained beyond one-line car examples.** #3 gives example cars, but "First" (the label for `luxury`) is non-obvious (why not "Luxury"/"VIP"?), and there's no guidance on price implications or how tier interacts with the ceiling. A Dispatcher picking "First" doesn't know it shrinks the eligible Pool.

6. **"Specific car" narrowing is warned about, but "Body type = Any" is not explained.** #5's "Any" has an internal comment ("reaches sedan AND van drivers") that never surfaces to the user. A Dispatcher doesn't know that choosing Sedan or Van *narrows* the Pool the same way a specific car does — only the specific-car path gets the "expect fewer matches" warning (#8).

7. **The picker language is French while the whole form is English.** #22–26: "Choisir une date," "Heure," "Mois précédent," "Heure exacte," etc. This is a jarring inconsistency for an English-speaking Dispatcher and there's no rationale shown.

8. **Timezone is shown but never justified.** #21 appends "· Europe/Paris" to every pickup time. A Dispatcher at a hotel in Paris won't be confused — but there's no guidance for a cross-border trip (Cannes→Geneva/Milano, which the address allowlist explicitly supports): the pickup time is *always* Paris wall-clock regardless of destination, and nothing says so.

9. **No guidance on what happens after posting.** The confirm dialog (#85) says it "can't be un-posted," but there's no pointer to *where it goes* or *what to do next* (watch the schedule? get notified when accepted? what if no Driver takes it before pickup?). The "may go unfulfilled" warnings (#68/#76) raise the possibility of no-match but never tell the Dispatcher what to do about it.

10. **"Main contact" vs per-Guest phone sharing is subtle and under-explained for the Driver side.** #38/#40 explain sharing well for the Dispatcher, but there's no guidance about *why* a phone would be withheld by default (privacy/legal intermediary positioning) — a Dispatcher may not realize the Driver literally cannot see an unshared number, and a Driver has no on-form context here at all (Drivers don't see this form, but the withheld-by-default model is never surfaced as a reassurance to the hotel either).

11. **"Reference is not shown to the Driver" but "Message to Driver is private, revealed on accept" — the two privacy models are easy to conflate.** #47 says Reference is Driver-*invisible*; #65 says the message is "Private to the Driver — revealed once they accept." Both use "private"-adjacent language for opposite audiences (one hidden from Drivers, one hidden from the *Pool* until accept). A non-expert can't tell where to put "call room 312 on arrival" vs an internal tag. No disambiguating guidance.

12. **Flight number's purpose is unstated.** #42/#43 label and placeholder it, but nothing tells the Dispatcher it's for flight-tracking / delay-aware pickup (or whether it does anything at all in the beta). It reads as optional metadata with no explained benefit.

13. **"Greeter — wait at the car" vs "Meet & greet" overlap.** #55: both flags exist, "Meet & greet" opens the name-board block, "Greeter — wait at the car" does not. The functional difference (board/inside-terminal greet vs curbside wait) is not explained, and it's easy to pick the wrong one.

14. **No empty/zero-Driver guidance anywhere.** The rail and preview always assume a Pool exists for the chosen tier+zone. There's no hint like "no Drivers currently cover this zone/tier" even though the whole value of the form is getting a match — the Dispatcher only learns of a mismatch by the mission sitting unfulfilled after posting.

15. **Luggage has no cap or guidance** (#41): a plain number input with `min=0` and no hint on how it interacts with Body type (a Van vs Sedan boot). Passenger count nudges toward a Van (#34–37); luggage never does, so a 6-bag Sedan booking passes silently.

Relevant files audited (all absolute):
`/Users/phyrasshaidar/Documents/02_Cactus/PickUp/PickUp_project_dev/app/(dispatch)/dispatch/new/mission-form.tsx`, `.../new/page.tsx`, `.../new/actions.ts`, `/Users/phyrasshaidar/Documents/02_Cactus/PickUp/PickUp_project_dev/components/route-stops.tsx`, `service-class-fields.tsx`, `passenger-list.tsx`, `driver-service-fields.tsx`, `reference-field.tsx`, `date-time-picker.tsx`, `board-file-link.tsx`, `address-autocomplete.tsx`, `share-switch.tsx`, and `/Users/phyrasshaidar/Documents/02_Cactus/PickUp/PickUp_project_dev/lib/passengers.ts`, `lib/driver-service.ts`, `lib/vehicle-catalog.ts`.


---

## B · Dispatch (excluding the new-mission form)

# Dispatch App — Guidance Inventory (excludes the new-mission form)

All paths absolute. "Guidance" = teaching/steering text or affordances, not plain field labels or data. Line numbers are current as of read.

## Shell / chrome — `components/dispatch-shell.tsx`

| file:line | TYPE | Exact text | WHEN it shows | Section / screen |
|---|---|---|---|---|
| dispatch-shell.tsx:137 | Tooltip (title=) | `"Show sidebar"` / `"Hide sidebar"` (also aria-label L136) | Always, on the collapse toggle | Sidebar header |
| dispatch-shell.tsx:147 | Tooltip (title=) | `"New mission"` | Always, on the CTA nav item | Sidebar nav |
| dispatch-shell.tsx:158 | Tooltip (title=) | Nav label (`"Schedule"` / `"Calendar"` / `"Drafts"` / `"History"`) | Always (useful when collapsed → icon-only) | Sidebar nav |
| dispatch-shell.tsx:162-169 | Draft badge + tooltip | Badge = draft count; title=`"{n} draft"` / `"{n} drafts"` | Only when `draftCount > 0` | Sidebar → Drafts item |
| dispatch-shell.tsx:178 | Tooltip (title=) | `"Settings"` | Always | Sidebar foot |
| dispatch-shell.tsx:196 | Tooltip (title=) | `businessName` | Always, on the account chip | Topbar account chip |
| dispatch-shell.tsx:216 | Helper subtext | `"Business account"` | When account menu open | Account-chip popover head |
| dispatch-shell.tsx:227 | Button state text | `"Signing out…"` (vs `"Sign out"`) | While sign-out transition pending | Account-chip menu |

## Schedule — `app/(dispatch)/dispatch/page.tsx`

| file:line | TYPE | Exact text | WHEN it shows | Section / screen |
|---|---|---|---|---|
| page.tsx:129 | Error (.notice error) | `"Couldn't load your schedule: {error.message}"` | On query error | Schedule top |
| page.tsx:133-139 | Empty state | `"No missions yet."` + link `"Post your first mission →"` | When Business has zero non-draft missions | Schedule body |
| page.tsx:44 | Section label | `"Today · {date}"` prefix on today's group | Always for today's group | Day header |
| page.tsx:156-158 | Inline hint (p.muted.small) | `"No trips today."` | When today has 0 trips but other days exist | Under the pinned Today group |
| page.tsx:174-175 | Disclosure/fold label | `"Earlier trips ({n})"` | When past-dated trips exist | Collapsible past section |

## Trip row (Schedule + History) — `components/trip-row.tsx`

| file:line | TYPE | Exact text | WHEN it shows | Section / screen |
|---|---|---|---|---|
| trip-row.tsx:110,123,133 | Tooltip (title=) | Full pickup / waypoint / drop-off address | On hover of a route address line (truncated display) | Row summary route rail |
| trip-row.tsx:172 | Status pill sub-label | Stop progress e.g. `"1/2"` | When `status === on_board` and waypoints exist | Status pill |
| trip-row.tsx:170 | Attention marker | `"!"` | When tone needs attention (warn/danger) | Status pill |
| trip-row.tsx:177 | Soft warning (.notice warn) | `t.hint` — e.g. `"Pickup is soon and the Driver hasn't confirmed — call them."` / `"Pickup is soon and no Driver has accepted yet."` / `"Was not filled in time."` | Expanded detail, only when the tone has a hint | Trip detail |
| trip-row.tsx:194-195 | Inline tag | `"reached"` / `"next stop"` | Per waypoint during on_board | Trip detail route |
| trip-row.tsx:216-217 | Data label + concept | `"Fare (now)"` → `"{fare} · ceiling {ceiling}"` | Always in expanded detail | Trip detail KV |
| trip-row.tsx:311 | Empty/placeholder value | `"Not assigned yet"` | When no Driver assigned | Trip detail → Driver |
| trip-row.tsx:329-330 | Concept label | `"Main contact"` / `"Guest"` | Per guest with phone | Trip detail guests |

Status pill labels via `lib/dispatch-status.ts` (concept-bearing status wording, shown always on every row/pill):
| file:line | TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| dispatch-status.ts:29-64 | Status label (concept) | `"En route"`, `"Arrived"`, `"On board"`, `"Completed"`, `"Confirmed"`, `"Not confirmed"`, `"Accepted"`, `"Unfilled"`, `"In the Pool"`, `"Cancelled"`, `"Expired"` | Per mission status (+ within-3h escalation) | Schedule / History / Calendar pills |

## Status steps bar — `components/status-steps.tsx`

| file:line | TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| status-steps.tsx:41 | Progress step labels | Segment labels (en route → arrived → on board → stops → drop-off / completed) from `progressSegments` | In expanded detail when executable or completed | Trip detail |

## Share toggle — `components/share-switch.tsx` + `phone-share-toggle.tsx`

| file:line | TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| share-switch.tsx:21 | Teaching aria-label | `"Shared with Driver — tap to stop sharing"` / `"Share this number with the Driver"` | Always on the switch | Trip detail guest row |
| share-switch.tsx:29-31 | Affordance label | `"Shared with Driver"` / `"Share with Driver"` | Always | Trip detail guest row |

## Board file link — `components/board-file-link.tsx`

| file:line | TYPE | Exact text | WHEN | Screen |
|---|---|---|---|---|
| board-file-link.tsx:47 | Button + error state | `"View name board"` (default) / `"Opening…"` / `"Couldn't open — retry"` | Always / loading / on failure | Trip detail → Name board |

## Calendar — `app/(dispatch)/dispatch/calendar/page.tsx` + `components/dispatch-calendar.tsx`

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| dispatch-calendar.tsx:211 | Tooltip (title=) | `"Show all trips"` | Always, on "Trips" KPI | KPI bar |
| dispatch-calendar.tsx:219 | Tooltip (title=) | `"Filter to confirmed trips"` | Always, on "Confirmed" KPI | KPI bar |
| dispatch-calendar.tsx:227 | Tooltip (title=) | `"Filter to trips that need action"` | Always, on "Need action" KPI | KPI bar |
| dispatch-calendar.tsx:214,222,230 | KPI labels (concept) | `"Trips"` / `"Confirmed"` / `"Need action"` | Always | KPI bar |
| dispatch-calendar.tsx:237-239 | aria-label + placeholder hint | aria `"Search by guest or driver name"`; placeholder `"Search guest or driver…"` | Always | Search box |
| dispatch-calendar.tsx:243 | aria-label | `"Clear search"` | When query non-empty | Search box |
| dispatch-calendar.tsx:250-259 | aria-label + option labels | aria `"Filter by status"`; options `"All statuses"`, `"Pooled"`, `"Confirmed"`, `"In progress"`, `"Needs action"` | Always | Status filter select |
| dispatch-calendar.tsx:262-271 | aria-label + options | aria `"Filter by vehicle category"`; `"All vehicles"`, `"Eco"`, `"Business"`, `"Van"`, `"Luxury"` | Always | Vehicle filter select |
| dispatch-calendar.tsx:194,200 | aria-label | `"Previous"` / `"Next"` | Always | Month/week nav arrows |
| dispatch-calendar.tsx:348 | Tooltip (title=) | `"New mission this day"` | Always, on the per-cell `+` | Month/week cell |
| dispatch-calendar.tsx:384,446 | Teaching aria-label | `"{day} — {n} trips"` | Always, on each day cell | Month/week cell |
| dispatch-calendar.tsx:397,469 | Tooltip (title=) | `"{time} · {guest} · {from} → {to}"` | Hover on a calendar entry chip | Cell entry |
| dispatch-calendar.tsx:407-417 | Overflow affordance | `"+{n} more"` | When a day has >3 trips | Month cell |
| dispatch-calendar.tsx:453 | Empty-cell marker | `"—"` | When a week-view day has 0 trips | Week cell |
| dispatch-calendar.tsx:483,585 | Empty/placeholder value | `"Unassigned"` | When entry has no Driver | Week cell foot / Day peek |
| dispatch-calendar.tsx:554 | Empty state | `"No trips this day."` | When opening a day drawer with 0 trips | Day peek drawer |
| dispatch-calendar.tsx:582 | Concept data line | `"{fare} · ceiling {ceiling}"` | Per trip in the peek | Day peek trip card |
| dispatch-calendar.tsx:593 | Affordance label | `"New mission on {day} {month}"` | Always | Day peek footer |
| dispatch-calendar.tsx:549 | aria-label | `"Close"` | Always | Day peek close |

## Drafts — `app/(dispatch)/dispatch/drafts/page.tsx` + `components/draft-actions.tsx`

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| drafts/page.tsx:25-28 | Section helper (p.muted) | `"Missions you saved but haven't posted. Continue editing to review and send one to the Pool."` | Always at top of Drafts | Drafts page intro |
| drafts/page.tsx:31-35 | Empty state | `"No drafts."` + link `"Create a mission →"` | When 0 drafts | Drafts body |
| drafts/page.tsx:56 | Concept data line | `"Ceiling {money}"` | Per draft card | Draft card |
| draft-actions.tsx:48-49 | Confirmation dialog (.notice error) | `"Discard this draft?"` + `"This can't be undone."` | After clicking Discard (inline confirm swap) | Draft card |
| draft-actions.tsx:16 | Button state | `"Discarding…"` (vs `"Discard"`) | While discard action pending | Confirm row |
| draft-actions.tsx:53-56 / 71-77 | Affordance labels | `"Continue editing"`, `"Discard"`, `"Cancel"` | Always / confirm mode | Draft card actions |

## History — `app/(dispatch)/dispatch/history/page.tsx`

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| history/page.tsx:74 | Error (.notice error) | `"Couldn't load your history: {error.message}"` | On query error | History top |
| history/page.tsx:77 | Empty state | `"No past missions yet."` | When 0 past missions | History body |

(History rows reuse `TripRow` in `archived` mode — same guidance as Schedule, minus the within-3h "call them" hints, which `missionTone` suppresses for archived rows.)

## Settings — `app/(dispatch)/dispatch/settings/page.tsx` + `settings-tabs.tsx` + `actions.ts`

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| settings/page.tsx:399-401 | Page subtitle | `"{name} · your account, identity, and booking defaults"` | Always | Settings header |
| settings-tabs.tsx:44 | Concept badge | `"soon"` | On Billing & Notifications nav items | Settings left-nav |
| settings/page.tsx:404 | Success (.notice success) | `"Your changes were saved."` | After a successful save (`?ok=1`) | Settings top |
| settings/page.tsx:29-35,405 | Error map (.notice error) | `"Please fill in the required field before saving."` (missing) / `"Something went wrong saving your changes. Please try again."` (db) / `"Your logo couldn't be uploaded. Please try another file."` (upload) / `"That logo is too large (max 10 MB)."` (filesize) / `"Please use a PNG, JPG or WebP image."` (filetype) | On the matching error redirect | Settings top |
| settings/page.tsx:94 | Section helper (SectionHead desc) | `"Who the business legally is — used on bookings and on PickUp's invoices to you."` | Always | Company → Company identity |
| settings/page.tsx:118-120 | Placeholder hint | `"Oetker Hôtel Management Company"` | On empty Legal entity field | Company |
| settings/page.tsx:128 | Placeholder hint | `"552 116 329 00012"` | On empty SIRET field | Company |
| settings/page.tsx:137 | Placeholder hint | `"FR 76 552116329"` | On empty VAT field | Company |
| settings/page.tsx:148 | Placeholder hint | `"112 Rue du Faubourg Saint-Honoré, 75008 Paris"` | On empty Registered address | Company |
| settings/page.tsx:167-168 | Section helper | `"The Dispatcher seat — how the Driver and PickUp reach the business."` | Always | Contact |
| settings/page.tsx:171 | Field label (concept) | `"Contact name (the Dispatcher)"` | Always | Contact |
| settings/page.tsx:177-179 | Inline note (small.set-note) | `"The email tied to your sign-in. Contact support to change it."` | Always (field disabled) | Contact → Account email |
| settings/page.tsx:188,190 | Placeholder + note | placeholder `"+33 6 12 34 56 78"`; note `"Revealed to the Driver on acceptance."` | Always | Contact → Mobile phone |
| settings/page.tsx:197,200 | Placeholder + note | placeholder `"+33 1 53 43 43 00"`; note `"Your reception / front-desk line (optional)."` | Always | Contact → Reception |
| settings/page.tsx:216-217 | Section helper | `"Your logo — the face shown to Drivers and on vouchers."` | Always | Branding |
| settings/page.tsx:229-231 | Section helper | `"Your address and defaults that pre-fill the new-mission form."` | Always | Booking defaults |
| settings/page.tsx:241 | Placeholder hint | `"Your address — pick it from the suggestions"` | On empty address field | Booking defaults |
| settings/page.tsx:243-246 | Inline note | `"Used to pre-fill bookings. Pick it from the dropdown so it has a location."` | Always | Booking defaults → Your address |
| settings/page.tsx:254-259 | Toggle label + note | `"Pre-fill my address as the pickup"` + `"On a new mission, start the pickup with your address (swap it to the drop-off for an arrival). Turn this off if your address is never an endpoint."` | Always | Booking defaults toggle |
| settings/page.tsx:263-272 | Field label + option | `"Default vehicle class"`; options `"No default"`, `"Eco"`, `"Business"`, `"First"` | Always | Booking defaults |
| settings/page.tsx:289-291 | Section helper | `"Where PickUp's invoices go. Card payments go live later."` | Always | Billing |
| settings/page.tsx:296-301 | Placeholder + note | placeholder `"accounts@hotel.com"`; note `"Where we'll send PickUp invoices."` | Always | Billing → Billing email |
| settings/page.tsx:311-318 | "Coming soon" stub | `"Payment method"` · `"Coming soon"` + `"When billing goes live you'll add a card here. Stripe collects it securely — PickUp never stores your card number. The trip fare is collected on the Driver's behalf; PickUp's service fee (with 20% VAT on the fee only) shows as a separate line."` + disabled `"Add a payment method"` | Always | Billing stub |
| settings/page.tsx:327-333 | "Coming soon" stub | `"Invoices & statements"` · `"Coming soon"` + `"Your PickUp invoices will appear here once billing is live."` | Always | Billing stub |
| settings/page.tsx:347-359 | "Coming soon" stub | `"Notifications"` desc `"How you'll hear about mission updates."` + `"Mission alerts"` · `"Coming soon"` + `"Soon you'll choose which mission events notify you — accepted, Driver en route, completed — and how (email or SMS). For now, updates appear when you refresh the schedule."` | Always | Notifications |
| settings/page.tsx:372-379 | Section text | `"Your account"` + `"To export your data or close the business account, email support@pickupbedriven.com."` | Always | Help & legal |
| settings/page.tsx:381-388 | Nav affordance | `"View mission history →"` | Always | Help & legal |

## Documents — `components/document-section.tsx`

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| document-section.tsx:112-115 | Section helper (p.muted.small) | `"PDF or image, up to 10 MB. We review each document before it's marked verified."` | Always | Company → Documents |
| document-section.tsx:64 | Empty/status value | `"Not uploaded"` | When a doc has no status | Doc row |
| document-section.tsx:56-61 | Status pill (concept) | `documentStatusLabel(doc.status)` (e.g. pending/verified/rejected) | When a doc has a status | Doc row |
| document-section.tsx:76 | Button state | `"Uploading…"` / `"Replace"` / `"Upload"` | Pending / has status / none | Doc row |
| document-section.tsx:34 | Validation error | `"Please choose a file."` | On submit with no file | Doc row |
| document-section.tsx:92-93 | Confirmation feedback | `"Selected: {fileName}"` | After choosing a file, before upload | Doc row |
| document-section.tsx:96-100 | Error (inline) | Server error `res.message` | On upload failure | Doc row |

## Avatar editor — `components/avatar-editor.tsx`

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| avatar-editor.tsx:123-130 | Alt / fallback | alt `"Business logo"` (or `"Your profile photo"`); fallback initial | Always | Branding avatar |
| avatar-editor.tsx:134-135 | Field label | `"Logo"` (or `"Profile photo"`) | Always | Branding |
| avatar-editor.tsx:144,151 | Button labels | `"Change"` / `"Upload"` / `"Remove"` | Depending on current state | Branding |
| avatar-editor.tsx:74 | Validation error | `"Please use a PNG, JPG or WebP image."` | On non-image file pick | Branding |
| avatar-editor.tsx:174 | Modal title | `"Crop & zoom"` | Crop modal open | Crop modal |
| avatar-editor.tsx:189,196 | Control label | `"Zoom"` | Crop modal open | Crop modal |
| avatar-editor.tsx:200-204 | Button state | `"Cancel"` / `"Save photo"` / `"Saving…"` | Crop modal | Crop modal |

## Help & legal card — `components/help-legal-card.tsx`

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| help-legal-card.tsx:19-32 | Nav affordances | `"Terms of use"`, `"Privacy policy"`, `"Support"`, `"Share feedback"` | Always | Help & legal |
| help-legal-card.tsx:35-37 | Version stamp | `"PickUp · beta"` | Always | Help & legal foot |

---

# GAPS — where a non-expert would be confused and no guidance exists

1. **"Ceiling" is never defined anywhere in Dispatch.** It appears as raw data on drafts (`drafts/page.tsx:56`), trip detail (`trip-row.tsx:217`) and the calendar peek (`dispatch-calendar.tsx:582`) with zero explanation. A hotel dispatcher has no way to learn that the Ceiling is the max fare they'll pay and that the live fare (SPEED WIN) descends from it. No tooltip, no helper line. This is the single biggest concept gap.

2. **"Fare (now)" / the live-price mechanic (SPEED WIN / PDP) is invisible.** The detail shows `Fare (now)` next to `ceiling` but never explains *why* the fare changes over time or that a Driver claims at the current price. A Business user will wonder why "the price" differs between two views/refreshes.

3. **Status meanings are unexplained.** Pills like **"In the Pool"**, **"Unfilled"**, **"Not confirmed"**, **"Pooled"**, **"Expired"** carry heavy product meaning but have no legend/tooltip on the Schedule (only the Calendar KPIs have title= hints, and even those don't define the states). "In the Pool" especially assumes the reader knows what the Pool is. A first-time hotel user can't tell "Accepted" from "Confirmed," or why a trip went "Expired."

4. **No explanation of what "posting to the Pool" does.** The Drafts intro says "send one to the Pool" but nothing on any in-scope screen tells the user that posting broadcasts to eligible Drivers, that first-to-accept wins, or what happens next. The empty Schedule just says "Post your first mission →" with no reassurance about what follows.

5. **The share-phone toggle lacks a "why".** The switch says "Share with Driver" (aria adds "tap to stop sharing") but never states the default (numbers are private to the Business) or the consequence (only the *assigned* Driver sees it, only after acceptance). A cautious hotel handling VIP guest numbers would want that reassurance inline.

6. **The T-180 red wash / "needs attention" has no legend.** When a row turns red or shows `!`, the hint only appears *after expanding* the row. On the collapsed Schedule there's no tooltip on the pill explaining the red state — the user must expand to learn "call them."

7. **Booking-defaults concepts assume knowledge.** "Default vehicle class" offers **Eco / Business / First** with no description of what each tier means to a Guest or a Driver. Elsewhere the same categories render as **Eco/Business/Van/Luxury** (calendar filter) — the inconsistent "First" vs "Luxury" label with no glossary will confuse.

8. **"Drafts" concept is thin outside the Drafts page.** The sidebar badge and title just show a count; a user who never opened Drafts won't know a draft = an unposted, non-broadcast mission. The definition exists only as the one-line intro *inside* the page.

9. **Document verification timeline is vague.** "We review each document before it's marked verified" doesn't say who reviews, how long it takes, or whether an un-verified Business can still post missions. A hotel uploading a SIRET/KBIS will want to know if this blocks them.

10. **Settings success/error toasts aren't section-scoped in the message.** After saving one section, the banner "Your changes were saved." appears at the top of the whole Settings page while a different section may be visible; there's no confirmation *at* the form. Minor, but a user can miss it.

11. **History has no explanation of scope.** "No past missions yet." and the month grouping don't tell the user History = pickup time in the past (including cancelled/expired), vs the Schedule. A user may expect completed trips to stay on the Schedule and be confused when they "disappear."

12. **Calendar "Confirmed" KPI vs status filter mismatch is unexplained.** The KPI counts only `info` tone as "Confirmed," while the status dropdown separates "Pooled / Confirmed / In progress / Needs action." A user filtering by "Confirmed" in the dropdown vs clicking the "Confirmed" KPI may get different-feeling results with no note explaining the difference.

Relevant files (all absolute): `/Users/phyrasshaidar/Documents/02_Cactus/PickUp/PickUp_project_dev/app/(dispatch)/dispatch/page.tsx`, `.../calendar/page.tsx`, `.../drafts/page.tsx`, `.../history/page.tsx`, `.../settings/page.tsx`, `.../settings/actions.ts`, `/Users/phyrasshaidar/Documents/02_Cactus/PickUp/PickUp_project_dev/components/{dispatch-shell,dispatch-calendar,trip-row,draft-actions,document-section,avatar-editor,help-legal-card,settings-tabs,share-switch,phone-share-toggle,board-file-link,status-steps,live-refresh}.tsx`, `/Users/phyrasshaidar/Documents/02_Cactus/PickUp/PickUp_project_dev/lib/dispatch-status.ts`.


---

## C · Driver app

# DRIVER App — Guidance Inventory

Terms confirmed against glossary: Business, Dispatcher, Driver, Guest, Pool, PDP, Ceiling, SPEED WIN. All file paths absolute.

## Screen: Pool — `app/(app)/pool/page.tsx`

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| pool/page.tsx:23-27 | empty-state (no base) | "Set your base and service radius to see matching missions." + link "Go to Settings →" | when `driver.base_lat/lng` is null | Pool, no-base gate |
| pool/page.tsx:68-71 | helper subtext (p.muted) | "{ServiceClass} · within {radius} km of {base_label or "your base"}" | always (base set) | Pool header |
| pool/page.tsx:74 | error (.notice error) | "Couldn't load the Pool: {error.message}" | on query error | Pool |
| pool/page.tsx:78-83 | empty-state (.empty) | "No missions available right now." + "New {ServiceClass} missions within {radius} km of your base will appear here." | when 0 matches | Pool |

## Screen: Mission Card (Pool list item) — `components/mission-card.tsx`

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| mission-card.tsx:42 | concept label (badge) | "SPEED WIN" | when `mission.speed_win` | card header |
| mission-card.tsx:43-46 | concept label (badge) | service class e.g. "Business · Van" (`serviceClassLabel`) | always | card header |
| mission-card.tsx:64-66 | data hint | "+{n} stop / stops" | when waypoints > 0 | route |
| mission-card.tsx:74-82 | requirement tags (.mc-tag) | dress code / languages / request flags e.g. "Suit & tie", "Meet & greet", "Français / English" | when set | card footer |

## Screen: Mission Detail — `app/(app)/missions/[id]/page.tsx` + `accept-button.tsx` + `actions.ts`

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| page.tsx:54 | nav affordance | "← Back to Pool" | always | top |
| page.tsx:64 | concept label (badge) | "SPEED WIN" | when speed_win | fare row |
| page.tsx:78 | data hint (muted small) | trip meta (distance · duration, `formatTripMeta`) | when computed | Route card |
| page.tsx:130-132 | **pre-accept reveal hint** (p.muted.small) | "Guest name, the name board and any private message are revealed once you accept." | always pre-accept | Details card |
| accept-button.tsx:28-31 | primary action | "Accept mission" / "Accepting…" | pooled | bottom |
| page.tsx:138-140 | affordance (already mine) | "You've accepted this — open My Rides" | when `isMine` & not pooled | bottom |
| page.tsx:142-144 | soft warning (.notice warn) | "This mission is no longer available in the Pool." | when not pooled & not mine | bottom |
| missions/[id]/actions.ts:31-32 | error | "Sorry — this mission was just taken by another Driver." | accept race lost | (toast on button) |
| missions/[id]/actions.ts:33-34 | error | "This overlaps with another mission you've already accepted." | slot conflict | button |
| missions/[id]/actions.ts:35-36 | error | "Your Driver profile isn't set up yet." | not a driver | button |
| missions/[id]/actions.ts:37 | error | "Couldn't accept this mission. Please try again." | generic | button |

## Screen: My Rides — `app/(app)/rides/page.tsx` + `status-control.tsx` + `status-steps.tsx` + `actions.ts`

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| rides/page.tsx:112 | nav affordance | "History →" | always | header |
| rides/page.tsx:117-119 | error | "Couldn't load your rides: {error.message}" | on error | list |
| rides/page.tsx:123-128 | empty-state (.empty) | "You haven't accepted any missions yet." + "Browse the Pool →" | 0 rides | list |
| rides/page.tsx:150 | status label (badge) | mission status e.g. "En route", "On board" (`missionStatusLabel`) | always | card |
| rides/page.tsx:171 | step tag (.leg-tag--done) | "reached" | passed stops | route |
| rides/page.tsx:172 | step tag (.leg-tag--now) | "next stop" | current stop, on_board | route |
| rides/page.tsx:186,192,204,208,211 | field labels (muted small) | "Guest" / "Guest phone" / "(main)" / "Business" / "Dispatcher" / "Phone" | post-accept | contacts |
| rides/page.tsx:276-279 | **pre-execution hint** (p.muted.small) | "Awaiting readiness confirmation (Lock-in at T-180). Trip controls appear once confirmed." | status == `accepted` | card |
| status-steps.tsx:38 | progress labels | "En route", "Arrived", "On board", "Stop 1…N", "Drop-off"/"Completed" (`progressSegments`) | executable/completed | progress bar |
| status-control.tsx:40-41,67 | primary action buttons | "Start — I'm en route" / "I've arrived" / "Guest on board" / "Reached — {stop}" / "Complete ride" (`STEP_ACTION_LABELS`) | per current status | card |
| rides/actions.ts:23,78 | error | "You're not signed in as a Driver." | no driver | button |
| rides/actions.ts:33,88 | error | "This isn't one of your missions." | wrong owner | button |
| rides/actions.ts:38 | error | "That step isn't available right now." | bad step | button |
| rides/actions.ts:46 | error | "Mark the remaining stops before completing." | stops pending | button |
| rides/actions.ts:91 | error | "You can mark a stop only once the Guest is on board." | not on_board | button |
| rides/actions.ts:98 | error | "That stop isn't the next one." | out-of-order stop | button |
| rides/history/page.tsx:70 | empty-state | "No completed or cancelled rides yet." | 0 history | history |

**Label sources (lib):** `lib/mission-flow.ts:13-26` (`STEP_LABELS`, `STEP_ACTION_LABELS`), `lib/format.ts:178-193` (`missionStatusLabel`), `lib/driver-service.ts` (dress code / flag / language labels surfaced on cards). Note: `STEP_LABELS` ("En route/Arrived/On board/Completed") and `STEP_ACTION_LABELS` differ — the *action* wording ("Start — I'm en route", "Guest on board") is the teaching layer on the buttons.

## Screen: Onboarding — `app/onboarding/page.tsx` + `actions.ts` + `components/driver-vehicle-fields.tsx`

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| onboarding/page.tsx:25-28 | intro helper (p.muted) | "We need a few details to show you the right missions. Signed in as {email}." | always | top |
| onboarding/page.tsx:30-33 | validation (.notice error) | "Please fill in your name and pick a vehicle category." | error=missing | top |
| onboarding/page.tsx:35-38 | validation | "Please pick your base address from the suggestions so we can match missions by distance." | error=nobase | top |
| onboarding/page.tsx:40-43 | error | "Something went wrong saving your profile. Please try again." | error=db | top |
| onboarding/page.tsx:56, settings 69 | field-label hint | "Phone (revealed to the Business when you accept)" | always | profile |
| onboarding/page.tsx:57 | placeholder hint | "+33 6 12 34 56 78" | always | phone input |
| onboarding/page.tsx:61-64 | helper (p.muted.small) | "Make, colour and plate are shown to the Business so the Guest knows which car to look for. You can edit these later in Settings." | always | vehicle |
| onboarding/page.tsx:88 | field-label hint | "Service radius — how far from your base you'll drive" | always | base |
| onboarding/page.tsx:97-100 | helper (p.muted.small) | "A mission shows in your Pool when its pickup **or** drop-off is within this distance of your base." | always | base |
| onboarding/page.tsx:83 / settings 95 | placeholder | "Start typing a town or address…" | always | base input |
| onboarding/page.tsx:102 | primary action | "Save and see the Pool" | always | submit |
| driver-vehicle-fields.tsx:50 | placeholder hint | "Mercedes-Benz" | always | Make |
| driver-vehicle-fields.tsx:61 | placeholder hint | "Classe E" | always | Model |
| driver-vehicle-fields.tsx:66-72 | **derived-concept hint** | "Service tier" + badge {Eco/Business/First} + "set automatically from your car" | always | tier |
| driver-vehicle-fields.tsx:76-95 | body picker (seg, aria-label="Body type") | "Body" toggle "Sedan" / "Van" | always (auto-suggested from model) | body |
| driver-vehicle-fields.tsx:100 | placeholder | "Noir" | always | Colour |
| driver-vehicle-fields.tsx:104 | placeholder | "AB-123-CD" | always | Plate |
| driver-vehicle-fields.tsx:113 | placeholder | "4" | always | Seats |
| onboarding/actions.ts:44 (comment only) | — | tier derived, plate for VTC verification (not user-facing) | — | — |

## Screen: Welcome (role picker) — `app/welcome/page.tsx`

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| welcome/page.tsx:14-16 | helper (p.muted) | "How will you use PickUp? Signed in as {email}." | always | top |
| welcome/page.tsx:20 | concept subtext (p.muted.small) | "Browse the Pool, accept and run VTC missions." | always | Driver card |
| welcome/page.tsx:22 | primary action | "Continue as Driver" | always | Driver card |
| welcome/page.tsx:28-30 | subtext | "Post missions and manage bookings (hotel, agency, concierge)." | always | Business card |

## Screen: Settings — `app/(app)/settings/page.tsx` + `actions.ts` + shared components

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| settings/page.tsx:17-21 / 51-52 | validation notices | "Please fill in your first and last name." / "Please pick your base address from the suggestions so the Pool can match by distance." / "Something went wrong saving your changes. Please try again." | error param | top |
| settings/page.tsx:51 | success (.notice success) | "Your changes were saved." | ?ok=1 | top |
| settings/page.tsx:69 | field-label hint | "Phone (revealed to the Business when you accept)" | always | profile |
| settings/page.tsx:73-74 | field-label + placeholder | "Languages (comma-separated)" · ph "Français, English, Italiano" | always | profile |
| settings/page.tsx:99 | field-label hint | "Service radius — how far from your base you'll drive" | always | Where you work |
| settings/page.tsx:108-111 | helper (p.muted.small) | "A mission appears in your Pool when its pickup **or** drop-off is within this distance of your base — so a long transfer that ends near you still shows up." | always | Where you work |
| settings/page.tsx:135-137 | status subtext (.muted.small) | "Connected — payouts are set up." / "Not connected yet. Your weekly earnings are paid out via Stripe." | conditional | Payouts |
| settings/page.tsx:139-141 | **coming-soon stub** (disabled btn) | "Set up payouts with Stripe — coming soon" | always | Payouts |
| settings/page.tsx:142-145 | reassurance (p.muted.small) | "Bank details are collected securely by Stripe when payouts go live. PickUp never stores your card or IBAN." | always | Payouts |
| document-section.tsx:112-114 | helper (p.muted.small) | "PDF or image, up to 10 MB. We review each document before it's marked verified." | always | Documents |
| document-section.tsx:64 | empty status (muted small) | "Not uploaded" | no doc | Documents row |
| document-section.tsx:33 | validation | "Please choose a file." | submit empty | Documents |
| avatar-editor.tsx:74 | validation | "Please use a PNG, JPG or WebP image." | bad type | Profile |
| address-autocomplete.tsx:331-334 | inline hint (p.small.muted) | "Pick an address from the list so we can place it on the map." | 3+ chars, none picked | base field |
| address-autocomplete.tsx:326-329 | status | "Locating…" | while fetching | base field |
| address-autocomplete.tsx:336-338 | error | "Address search is unavailable (Mapbox token missing)." | no token | base field |
| help-legal-card.tsx:16-37 | links/stubs | "Terms of use", "Privacy policy", "Support", "Share feedback", "PickUp · beta" | always | Help & legal |

## App-wide — `components/app-header.tsx`

| file:line | TYPE | Exact text | WHEN | Section |
|---|---|---|---|---|
| app-header.tsx:34-42 | nav labels | "Pool", "My Rides", "Settings" | always | header |
| app-header.tsx:56 | action | "Sign out" | always | header |

---

# GAPS — where a Driver would be unsure and no guidance exists

1. **No explanation of what the fare number *is* (PDP / the price mechanism).** Pool cards and mission detail show a euro figure with a "SPEED WIN" badge, but nothing tells the Driver the fare *climbs over time* toward a Ceiling, or that "SPEED WIN" means it's at/near the ceiling now (accept fast). A new Driver sees a badge and a number with zero teaching — the core marketplace concept is unguided. (`mission-card.tsx:42`, `missions/[id]/page.tsx:60-68`)

2. **"Accept mission" has no commitment framing.** The button doesn't warn that accepting is binding (leaves the Pool, enters a slot-conflict/Lock-in regime, contact revealed). There is no confirmation dialog — one tap commits. First-time Drivers won't know accepting is a hard commit. (`accept-button.tsx`)

3. **Lock-in / T-180 is jargon with no definition.** `rides/page.tsx:276-279` says "Awaiting readiness confirmation (Lock-in at T-180). Trip controls appear once confirmed." A non-expert cannot decode "Lock-in", "T-180", or *who* confirms readiness (the Business) or *when* they can start driving. This is the single most confusing string in the app — it gates the trip buttons but explains nothing actionable.

4. **`accepted` vs `confirmed` — the Driver doesn't know what to do while waiting.** Between accept and confirm there is no button and only the cryptic T-180 line. No guidance on whether the Driver should contact the Dispatcher, wait, or what triggers confirmation.

5. **Status buttons give no "what happens next / who sees this."** The buttons ("I've arrived", "Guest on board", "Complete ride") don't tell the Driver the Business is watching live, or that "Complete ride" is final/irreversible and triggers payout. `status-control.tsx` comment says the Business sees it in seconds, but that reassurance never reaches the UI.

6. **"Reached — {stop}" flow is undocumented for the Driver.** On a multi-stop trip the button silently changes from a status advance to per-stop taps. Nothing tells the Driver "tap once at each stop, then you'll get Complete ride." A Driver could be confused why "Complete ride" isn't showing yet. (`status-control.tsx:38-41`, no accompanying hint)

7. **Service tier is derived but *why*/*from what* is thin.** `driver-vehicle-fields.tsx:71` says "set automatically from your car", but if a Driver expects "First/Business" and gets "Eco", there's no explanation that tier comes from make+model and that unlisted brands fall back to Eco. A Mercedes owner who typed "Mercedes" + an unlisted model lands on Eco silently and may not understand the downgrade affects which missions they see.

8. **Body picker auto-changes with no signal.** In `driver-vehicle-fields.tsx`, typing a recognized model silently flips Sedan/Van (`suggestedBody`). There's no hint that it was auto-set or that the Driver can override — the toggle just moves on its own.

9. **Pool empty state doesn't cover *why* it might be empty beyond distance.** `pool/page.tsx:78-83` mentions radius, but a Driver whose tier or required body/car excludes missions (the `required_body_type`/`required_make` filters at lines 54-60) gets the same generic "No missions available" — no hint that vehicle mismatch, not just distance, could be filtering them out.

10. **Pre-accept reveal is one-directional.** `missions/[id]/page.tsx:130-132` tells the Driver Guest name/board/message are hidden until accept, but the Pool card and detail never explain that the Dispatcher **phone** is also gated (revealed only in My Rides after accept). A Driver looking for a contact number pre-accept has no explanation why none is shown.

11. **No first-run/onboarding tour for the Pool or trip flow.** After onboarding the Driver lands on the Pool with no walkthrough of the tap sequence (browse → open → accept → wait for confirm → run status steps). Every screen assumes the mental model already exists.

12. **Documents section doesn't say which documents are required or why.** `document-section.tsx` lists rows and says "We review each document", but there's no per-document guidance (VTC card, insurance, etc. — driven by `DRIVER_DOC_TYPES`) explaining what each is or that verification may gate anything. A Driver doesn't learn whether unverified docs block accepting missions.

13. **Payouts "coming soon" gives no timeline or current-state clarity.** `settings/page.tsx:139` — a Driver running real missions has no guidance on *how/when* they actually get paid in beta (the "weekly earnings via Stripe" line describes a future state, not what happens now).

Key label files for reference: `/Users/phyrasshaidar/Documents/02_Cactus/PickUp/PickUp_project_dev/lib/mission-flow.ts` (button/step wording), `/Users/phyrasshaidar/Documents/02_Cactus/PickUp/PickUp_project_dev/lib/driver-service.ts` (dress/flag/language concept labels), `/Users/phyrasshaidar/Documents/02_Cactus/PickUp/PickUp_project_dev/lib/vehicle-catalog.ts` (tier derivation + `TIER_LABEL`), `/Users/phyrasshaidar/Documents/02_Cactus/PickUp/PickUp_project_dev/lib/format.ts` (`serviceClassLabel`, `missionStatusLabel`).


---

## D · Cross-cutting sweep (stragglers, auth/legal, consistency)

# Cross-Cutting Guidance Sweep — PickUp

Scope: every UI string whose job is to teach/steer (helper text, hinting placeholders, `.notice.*`, empty states, confirmations, tooltips, teaching aria-labels, "coming soon" stubs, concept-explaining labels). Plain field labels and pure data are excluded. Per-area audits cover the big screens; this catches the stragglers and assesses consistency.

---

## A. INVENTORY — Stragglers & cross-cutting guidance

### A1. Hinting placeholders (show: always, empty input)
These teach *format* or *what to type*, beyond a plain label:

| file:line | text | screen |
|---|---|---|
| `app/(dispatch)/dispatch/new/mission-form.tsx:512` | `"AF1234"` | New mission · Flight number |
| `components/reference-field.tsx:37` | `"Room 312"` | New mission · Reference |
| `components/driver-vehicle-fields.tsx:50,60,100,104` | `"Mercedes-Benz"`, `"Classe E"`, `"Noir"`, `"AB-123-CD"` | Vehicle fields (onboarding + settings) |
| `components/driver-service-fields.tsx:229` | `"e.g. Mr. Laurent Chopard"` | New mission · Name board |
| `components/driver-service-fields.tsx:293` | `"Special instructions for this trip — e.g. wait at the lobby desk and call the room on arrival."` | New mission · Message to Driver |
| `components/route-stops.tsx:206,262` | `"From — address, airport, station…"`, `"Where to?"` | New mission · Route |
| `components/passenger-list.tsx:155` | `"Phone (optional)"` | New mission · Passengers |
| `app/(dispatch)/dispatch/settings/page.tsx:119,129,138,148,299` | `"Oetker Hôtel Management Company"`, `"552 116 329 00012"`, `"FR 76 552116329"`, `"112 Rue du Faubourg Saint-Honoré…"`, `"accounts@hotel.com"` | Business settings (legal/billing) |
| `app/(dispatch)/dispatch/settings/page.tsx:241` | `"Your address — pick it from the suggestions"` | Business settings · Booking defaults |
| `app/onboarding-business/page.tsx:39,46` | `"Hôtel …"`, `"Hotel, concierge, event agency…"` | Business onboarding |
| `app/(app)/settings/page.tsx:74` | `"Français, English, Italiano"` | Driver settings · Languages |
| `app/login/login-form.tsx:84` | `"you@example.com"` | Login |

Phone placeholders (`"+33 6 12 34 56 78"`, `"+33 …"`, `"+33 1 53 43 43 00"`) recur across settings/onboarding — teach international format.

### A2. Inline helper / hint text (`p.muted.small`, `.set-note`, dedicated hint classes)

| file:line · when · text |
|---|
| `app/(app)/settings/page.tsx:108` · always · "A mission appears in your Pool when its pickup **or** drop-off is within this distance of your base — so a long transfer that ends near you still shows up." |
| `app/onboarding/page.tsx:97` · always · shorter variant: "A mission shows in your Pool when its pickup **or** drop-off is within this distance of your base." |
| `app/onboarding/page.tsx:61` · always · "Make, colour and plate are shown to the Business so the Guest knows which car to look for. You can edit these later in Settings." |
| `app/(app)/settings/page.tsx:142` · always · "Bank details are collected securely by Stripe when payouts go live. PickUp never stores your card or IBAN." |
| `components/driver-vehicle-fields.tsx:71` · always · "set automatically from your car" (Service tier is derived) |
| `components/service-class-fields.tsx:136-139` · conditional (car picker shown) · "Only Drivers with this exact car will see the mission — expect fewer matches." / "Pick an exact model only if the Guest insists — it narrows the Pool." |
| `components/service-class-fields.tsx:149` · conditional (Eco tier) · "{Tier} matches any standard car — no specific models to choose." |
| `components/driver-service-fields.tsx:146` · always · "Matched against the languages each Driver lists on their profile." |
| `components/driver-service-fields.tsx:157-159` · always (`.ds-head__hint`) · "Default set from your service class" |
| `components/driver-service-fields.tsx:184-186` · conditional (suit_tie) · "Specific event or VIP protocol" |
| `components/driver-service-fields.tsx:250` · conditional (meet_greet) · "PDF, JPG or PNG — for a company or brand board" |
| `components/driver-service-fields.tsx:276` · conditional · "Pre-filled with the first Guest — change it for a company or brand name, or attach a board." |
| `components/driver-service-fields.tsx:296` · always · "Private to the Driver — revealed once they accept." |
| `components/reference-field.tsx:42,44` · always · "A short tag for your own schedule." + `.rf-note` "Not shown to the Driver" |
| `components/passenger-list.tsx:187` · always · "Names are optional. The **main contact** shows on the schedule line. A phone is never shared automatically — flip *Share with Driver*…" |
| `components/document-section.tsx:112` · always · "PDF or image, up to 10 MB. We review each document before it's marked verified." |
| `app/(app)/missions/[id]/page.tsx:130` · always · "Guest name, the name board and any private message are revealed once you accept." |
| `app/(app)/rides/page.tsx:276-279` · conditional (accepted) · "Awaiting readiness confirmation (Lock-in at T-180). Trip controls appear once confirmed." |
| `app/(dispatch)/dispatch/settings/page.tsx:177-179` · always · "The email tied to your sign-in. Contact support to change it." |
| `.set-note` lines 190, 200, 244, 255-257, 301 · always · "Revealed to the Driver on acceptance." / "Your reception / front-desk line (optional)." / "Used to pre-fill bookings. Pick it from the dropdown so it has a location." / "On a new mission, start the pickup with your address (swap it to the drop-off for an arrival). Turn this off if your address is never an endpoint." / "Where we'll send PickUp invoices." |
| `SectionHead desc=` 94, 168, 217, 231, 291, 348 · always · e.g. "Who the business legally is — used on bookings and on PickUp's invoices to you." / "The Dispatcher seat — how the Driver and PickUp reach the business." / "Your logo — the face shown to Drivers and on vouchers." |

### A3. Concept-explaining labels & the Pricing card (New mission)

| file:line · text |
|---|
| `mission-form.tsx:553` · "Estimated base fare € (optional)" |
| `mission-form.tsx:565` / `:784` · "Ceiling € (your maximum)" / "Ceiling (your maximum)" — **the Ceiling concept, taught inline** |
| `mission-form.tsx:584-587` · always · "The base fare drives a soft 'below recommended' warning only. The ceiling is the most a Driver can climb to." |
| `mission-form.tsx:597-599` · always · "**SPEED WIN** — start high (70% of ceiling) and climb fast for near-instant pickup" — **the SPEED WIN concept** |
| `mission-form.tsx:798-800` / `:623-624` · "starting fare · climbs up to {ceiling}" — teaches PDP climb |
| `mission-form.tsx:815` · "Standard climb" (pricing mode) |
| `service-class-fields.tsx:80` · "Service class (routes to the matching Pool)" — teaches routing effect |

### A4. Soft warnings / nudges (`.notice.warn`)

| file:line · when · text |
|---|
| `mission-form.tsx:579-582` · base < recommended · "Trips below the recommended fare are rarely accepted and may go unfulfilled. You can still post it." |
| `mission-form.tsx:820-823` · same, preview rail · "Below the recommended base fare — may go unfulfilled." (**terser duplicate of the above**) |
| `mission-form.tsx:711-713` · pickup < 5h & no SPEED WIN · "This pickup is in under 5 hours. Consider SPEED WIN so a Driver grabs it fast. **[Enable SPEED WIN]**" |
| `app/(app)/missions/[id]/page.tsx:142-144` · mission gone · "This mission is no longer available in the Pool." |
| `components/trip-row.tsx:177` (source `lib/dispatch-status.ts:43,52,62`) · condition · "Pickup is soon and the Driver hasn't confirmed — call them." / "Pickup is soon and no Driver has accepted yet." / "Was not filled in time." |

### A5. Errors / validation (`.notice.error`)

| file:line · text |
|---|
| `mission-form.tsx:381-383` · "A mission needs at least a vehicle class, a pickup picked from the address suggestions, a pickup time, and a ceiling — even to save as a draft." |
| `mission-form.tsx:387-388` · "Add a drop-off and pick it from the address suggestions before posting. (You can still save it as a draft without one.)" |
| `mission-form.tsx:393` · "That pickup time is in the past. Pick a future time, or save it as a draft." |
| `mission-form.tsx:398-400` · "That draft was already posted or discarded — check your schedule…" |
| `onboarding/page.tsx:33,37,42` · name/category, base-from-suggestions, db |
| `onboarding-business/page.tsx:27,31` · name/contact, db |
| `login-form.tsx:73-75` · "Your sign-in link was invalid or has expired — request a new one below." |
| `friendlyAcceptError` (`missions/[id]/actions.ts:31-37`) · Driver accept · "Sorry — this mission was just taken by another Driver." / "This overlaps with another mission you've already accepted." / "Your Driver profile isn't set up yet." / "Couldn't accept this mission. Please try again." |
| `rides/actions.ts:23,33,38,46,91` · Driver status · "You're not signed in as a Driver." / "This isn't one of your missions." / "That step isn't available right now." / "Mark the remaining stops before completing." / "You can mark a stop only once the Guest is on board." |

### A6. Info banners (`.notice.info`)
`mission-form.tsx:372` "Editing a saved draft." · `:375-377` "Pre-filled for **{day}** from the calendar."

### A7. Empty states

| file:line · text |
|---|
| `pool/page.tsx:23-27` · "Set your base and service radius to see matching missions. [Go to Settings →]" |
| `pool/page.tsx:78-82` · "No missions available right now. New {class} missions within {radius} km of your base will appear here." |
| `rides/page.tsx:123-128` · "You haven't accepted any missions yet. [Browse the Pool →]" |
| `rides/history/page.tsx:70` · "No completed or cancelled rides yet." |
| `dispatch/page.tsx:133-138` · "No missions yet. [Post your first mission →]" · `:156` "No trips today." |
| `dispatch/drafts/page.tsx:25-27` intro + `:32-35` "No drafts. [Create a mission →]" |
| `dispatch/history/page.tsx:77` · "No past missions yet." |
| `dispatch-calendar.tsx:554` · "No trips this day." · `:483/585` "Unassigned" |
| `mission-form.tsx:752-754` · "Pick a route to see the distance, time and starting fare." · `:828-830` "Set a ceiling under Pricing to see the starting fare." |
| `document-section.tsx:64` · "Not uploaded" |

### A8. Confirmation dialogs
- **Post to the Pool** (`mission-form.tsx:908-915`): title "This is final" + "Posting sends this live to the Driver Pool right away — it can't be un-posted." (icon + warn tone)
- **Discard draft** (`draft-actions.tsx:48`): inline "**Discard this draft?** This can't be undone." with Cancel + red Discard (uses `.notice.error` as the container — see Consistency).

### A9. Tooltips (`title=`) & teaching aria-labels
- Dispatch shell (`dispatch-shell.tsx`): "Show/Hide sidebar", "New mission", "Settings", `{draftCount} draft(s)`, per-nav `title={label}`.
- Calendar (`dispatch-calendar.tsx`): "Show all trips", "Filter to confirmed trips", "Filter to trips that need action", "New mission this day", plus `{time · guest · from → to}` cell tooltips.
- Route (`route-stops.tsx:232,276`): "Remove stop", "Swap pickup and drop-off".
- Teaching aria-labels: `share-switch.tsx:21` "Shared with Driver — tap to stop sharing" / "Share this number with the Driver"; calendar search/filter aria-labels; `driver-service-fields` group labels.
- **Note:** `date-time-picker.tsx` aria-labels are **French** ("Choisir une date", "Mois précédent", "Heure exacte") while every other aria-label is English (see Consistency).

### A10. "Coming soon" stubs
- Driver payouts (`settings/page.tsx:139-145`): disabled "Set up payouts with Stripe — coming soon" + Stripe/IBAN reassurance.
- Business settings stubs (`dispatch/settings/page.tsx`): Billing → Payment method (`.set-soon` "Coming soon", 314-318 VAT-on-fee explainer), Invoices & statements (331-333), Notifications (355-359 "Soon you'll choose which mission events notify you… For now, updates appear when you refresh the schedule.").
- `settings-tabs.tsx:44` renders a small "soon" pill on tabs flagged `soon: true`.

---

## B. Auth / Legal guidance

- **Login** (`login-form.tsx`): role-aware subtitles (`COPY`, lines 7-11) "Sign in to see available missions." / "Sign in to manage your bookings."; success `.notice.success` "Check your email — we sent a sign-in link to **{email}**. Open it on this device to continue."; helper "No password needed. We email you a secure one-time link."; dev link "Local testing? Use one-click dev sign-in →".
- **Dev-login** (`dev-login/page.tsx`): "Testing only. No email needed — pick a side…"; per-card "Post missions and manage the schedule." / "Browse the Pool and run missions."
- **Welcome / role picker** (`welcome/page.tsx`): "How will you use PickUp?"; "Browse the Pool, accept and run VTC missions." / "Post missions and manage bookings (hotel, agency, concierge)."
- **Landing splash** (`landing-splash.tsx`): "The booking platform linking professional VTC Drivers with Businesses." + two role cards.
- **Legal** (`legal/terms`, `legal/privacy`): both lead with a bilingual `.notice.warn` draft banner ("Brouillon… / Draft — pending legal review."); "Last updated: TBD"; Terms teaches the **agent/intermediary** position and **Ceiling/PDP** concepts (§2, §3) — this is the one long-form place those concepts are defined for users.
- **Help & legal card** (`help-legal-card.tsx`): Terms / Privacy / mailto Support / mailto Share feedback + "PickUp · beta". Business settings adds an account note (373-378) "To export your data or close the business account, email support@…".
- **No dedicated FAQ / Help / Support route exists** — support is a `mailto:` only (see Gaps).

---

## C. Reusable component? / classes used

**There is no reusable guidance/hint/tooltip component.** All guidance is **ad-hoc inline JSX**. The only reusable primitives are:
- `SectionHead` (local to `dispatch/settings/page.tsx`) — renders a `title` + optional `desc`; the closest thing to a "helper text" component, but scoped to Business settings only.
- `HelpLegalCard` (`components/help-legal-card.tsx`) — shared Help/legal block (Driver + Business).
- `ShareSwitch` — carries teaching aria-labels but is a control, not guidance.

Guidance is carried by **CSS classes, not components**:
- `.notice` + `.notice.error / .info / .success / .warn` (`globals.css:447-472`) — the four semantic banner tones. `.warn` uses `--warn-bg` / `--warn` (amber) — this is the Doc-02 "soft-warning" style.
- `.muted` + `.small` (`230, 233`) — the workhorse inline-hint pairing (~50 uses).
- `.empty` (`488`) — centered empty-state block.
- Bespoke one-off classes: `.set-note`, `.set-soon`, `.set-stub`, `.rf-hint`, `.rf-note`, `.rf-opt`, `.ds-note`, `.ds-head__hint`, `.ds-optional`, `.pl-note`, `.tier-empty`, `.mx-summary__empty`. Several of these are visually near-identical to `.muted.small` but defined separately per feature.

---

## D. Consistency issues

1. **Same idea, two wordings — Pool radius rule.** `settings/page.tsx:108` ("…so a long transfer that ends near you still shows up") vs `onboarding/page.tsx:97` (short version, no example). A Driver reads the fuller one only after onboarding.
2. **"below recommended" warning duplicated with different phrasing.** `mission-form.tsx:579` ("Trips below the recommended fare are rarely accepted and may go unfulfilled. You can still post it.") vs `:820` ("Below the recommended base fare — may go unfulfilled.") — same trigger, two texts, shown in two places (form + rail).
3. **"Not shown to the Driver" vs "revealed once they accept" vs "Revealed to the Driver on acceptance."** Three different phrasings for the reveal/privacy concept: `reference-field.tsx:44`, `driver-service-fields.tsx:297`, `settings/page.tsx:190`, `missions/[id]/page.tsx:131`. Meaning is consistent but wording isn't standardized.
4. **Inline-hint class fragmentation.** `.muted.small`, `.set-note`, `.rf-hint`, `.ds-note` all render "small muted helper" but are four separate class definitions — drift risk in color/size (e.g. `.set-note` uses `--text-faint`, most `.muted` uses `--text-muted`).
5. **Discard confirm reuses `.notice.error` as a layout container** (`draft-actions.tsx:37`) rather than a dialog/warn pattern — the red "error" tone is borrowed for a confirm prompt, unlike the Post confirm which uses a proper `.modal-overlay` + warn icon. Inconsistent confirm patterns.
6. **Language mixing in aria-labels.** `date-time-picker.tsx` aria-labels + dialog labels are French; all other components' aria-labels are English. (User-facing copy is English throughout except the intentionally-bilingual legal pages.)
7. **"soon" pill casing.** `settings-tabs.tsx:44` renders lowercase "soon"; the stub rows render "Coming soon" (title case). Same `.set-soon` class, different text.
8. **Soft-warning tone applied *mostly* uniformly** (`.notice.warn` amber for the below-recommended, T-180, SPEED-WIN nudge, "no longer available", and legal-draft banners) — good. The one deviation is item 5 above (confirm using error-red).

---

## E. GAPS — where a non-expert is left unguided

**Dispatcher (hotel staff):**
1. **No first-run / empty-Pricing guidance for Ceiling before the field is touched.** The Ceiling concept is explained only *inline beside the input* ("your maximum") and in the below-recommended warning. A hotel clerk who's never heard "Ceiling" gets no upfront "what number do I put here?" — no suggested range, no worked example. The base-fare field is "optional" with no hint on how to estimate it.
2. **SPEED WIN is defined only on the checkbox** (`:597`). If unchecked and pickup isn't <5h, there's no explanation of the *default* "Standard climb" — the rail just says "Standard climb" with no tooltip on what climbing means or how fast.
3. **"In the Pool" / "Accepted" / "Confirmed" / Lock-in (T-180)** statuses appear on the Dispatch schedule with no legend or tooltip explaining the lifecycle. The only Lock-in explanation lives on the *Driver* side (`rides/page.tsx:277`), never shown to the Dispatcher.
4. **No guidance on what "post is final / can't be un-posted" means for cancellation** — the confirm says it can't be un-posted, but there's no pointer to how you'd cancel a live mission (cancellation policy is "TBD" in Terms). A Dispatcher who mis-posts has no visible recovery path.
5. **Booking-defaults "prefill_pickup" toggle** is explained, but there's no guidance on the *arrival vs departure* mental model beyond the parenthetical "swap it to the drop-off" — first-time users may not grasp the swap affordance (`route-swap` is icon-only with a `title`, no first-use hint).

**Driver:**
6. **Accept has no pre-accept explanation of the Lock-in 3h / slot-conflict rules.** The Driver only learns about slot conflict *after* a failed accept (`friendlyAcceptError`). The mission detail page teaches what gets revealed on accept but not the commitment/lock-in obligation.
7. **Empty-Pool reason is generic.** "No missions available right now" doesn't distinguish "none exist" from "your radius/body-type filtered them out" — a Driver with a narrow radius or rare body type gets no nudge to widen settings.
8. **Documents "pending" status has no explanation of consequence** — `document-section` says "We review each document before it's marked verified," but nowhere tells the Driver whether unverified docs block them from accepting missions (they don't appear to, but silence is confusing).
9. **Preferred GPS, service tier "set automatically from your car"** — the derived tier is stated but a Driver can't tell *how* their car maps to Eco/Business/First, or how to change tier (must change the car). No link/hint.

**Both / global:**
10. **No FAQ/Help surface.** Help is a `mailto:` only. There is no in-app explanation of the core glossary (Pool, PDP, Ceiling, SPEED WIN, Lock-in, Guest) outside the legal Terms page — non-experts have nowhere to look these up. This is the single biggest cross-cutting gap: the concepts are taught in fragments at point-of-use but never collected.
11. **Onboarding has no "what happens next" orientation** — after saving, a Driver lands on the Pool and a Business on an empty schedule with only a one-line empty state; no short tour of the workflow.

Key files: `app/(dispatch)/dispatch/new/mission-form.tsx`, `components/driver-service-fields.tsx`, `components/reference-field.tsx`, `components/service-class-fields.tsx`, `app/(dispatch)/dispatch/settings/page.tsx`, `app/(app)/settings/page.tsx`, `app/onboarding/page.tsx`, `app/onboarding-business/page.tsx`, `lib/dispatch-status.ts`, `app/(app)/missions/[id]/actions.ts`, `app/(app)/rides/actions.ts`, `app/legal/terms/page.tsx`, `components/help-legal-card.tsx`, `app/globals.css` (`.notice*` 447-472, `.muted/.small` 230-233, `.empty` 488).


---

# Consolidated gaps (themed, across all surfaces)

1. **Core concepts are never collected in one place.** Ceiling, Pool, SPEED WIN / PDP (the climbing
   fare), Lock-in / T-180, and the status pills (*In the Pool, Accepted, Confirmed, Unfilled, Expired*)
   are taught in fragments at point-of-use and defined nowhere. No FAQ/glossary; support is a `mailto:`.
   Hits **both** sides. → mostly the standalone tutorial's job + a small in-app glossary tooltip.
2. **Mission form — pricing is the weakest spot.** No help choosing the Ceiling / base-fare number
   (even though the form already computes distance + ETA); SPEED WIN's trade-off (*it costs you more*)
   is never stated; "Standard climb" is unexplained; luggage is a bare number with no vehicle nudge.
3. **Dispatch status lifecycle is opaque.** No legend/tooltip for the pill states on the Schedule; the
   red "call them" wash only appears *after* a row is expanded; Lock-in is explained only on the Driver
   side, never to the Business.
4. **Driver "what do I tap / what happens."** Accept has no commitment framing (binding, slot-conflict,
   contact reveal); *"Lock-in at T-180"* is the single most confusing string in the app; the status
   buttons don't say the Business is watching live or that "Complete ride" is final; the multi-stop
   "Reached" flow is undocumented; the derived tier (why "Eco"?) is thin.
5. **"What happens next"** — after posting (where it goes, what if nobody takes it, how to cancel) and
   after accepting — is unaddressed. No first-run orientation (the parallel tutorial covers most of this).
6. **Body = Any / tier narrows the Pool** — only the specific-car path gets an "expect fewer matches"
   warning; choosing a tier or a body silently narrows eligibility with no hint.

# Consistency issues (cheap fixes)
- The below-recommended fare warning has **two different wordings** (form vs summary rail).
- The reveal/privacy idea is phrased **three ways** ("Not shown to the Driver" / "revealed once they
  accept" / "Revealed to the Driver on acceptance").
- **French aria-labels** in `date-time-picker.tsx` ("Choisir une date", "Heure exacte") while the whole
  UI is English.
- **Class fragmentation:** `.set-note`, `.rf-hint`, `.ds-note` all render "small muted helper" separately.
- The **discard-draft confirm** borrows the red `.notice.error` container, while the post confirm uses a
  proper modal + warn icon — inconsistent confirm patterns.
- "**soon**" (lowercase pill) vs "**Coming soon**" (title case) drift for the same `.set-soon` class.

---

# Roadmap — what to add (prioritized)

**Philosophy:** guidance surfaces **only when relevant** (gently accompany, never clutter). The
standalone **tutorial** (built in parallel) carries the concept teaching; in-app we keep terms
*reachable*, not stuffed onto the page.

## Step 0 — one reusable primitive
`<FieldHint>` (inline muted line) + `<InfoTip>` (on-demand "?" bubble). Fixes the "no reusable
component" finding and makes everything below consistent. Tiny; also the home for the fragmented
one-off hint classes.

## Tier 1 — highest leverage, non-invasive, no schema
- **Suggested Ceiling / base-fare range** from the computed distance + ETA the form already has.
  *(Needs a pricing rule → deferred until the pricing discussion.)*
- **3 input-driven nudges** (fire only on their trigger): luggage > vehicle capacity
  (→ bridges the luggage-vehicle work / Sujet B), long-distance, night pickup.
- **A "?" glossary tooltip** for core terms (Ceiling, Pool, SPEED WIN, Lock-in, status pills), reused
  on both sides.

## Tier 2
- **Dispatch status legend** (pill tooltips) + **Lock-in / T-180 in plain words**, both sides.
- **"What happens after you post"** one-liner + a short **Accept commitment** note for the Driver.

## Tier 3 — hygiene
- Dedupe the two below-recommended wordings; standardize the reveal/privacy phrasing; English
  aria-labels on the date picker; unify "soon" / "Coming soon"; align the two confirm patterns;
  consolidate the fragmented hint classes onto the Step-0 primitive.

---

# Decision log (this track)
- **2026-07-04** — Founder felt the full list was a lot; chose to start with **just the 3 input-driven
  nudges** (built on the tiny reusable hint they sit on). **No schema.** The suggested-fare range is
  **deferred** until the pricing rule is decided ("we'll talk about pricing" next). Guidance must be
  **non-invasive** (only-when-relevant); concept teaching lives in a **separate tutorial** built in
  parallel. Reasoning: smallest visible win, zero dependencies, and the luggage nudge is the on-ramp to
  the luggage-vehicle class (Sujet B).
