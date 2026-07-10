# PickUp — What we've built (plain-language history)

> A simple, dated log of what's been done — written to be read, not for engineers.
> Newest at the top. The detailed technical version lives in `SESSION_LOG.md`.

---

## 10 July 2026 (later)
- **The "review before posting" card got a light tidy-up.** Same card you liked — it just now matches the redesigned
  trip detail: the route reads as a clean top-to-bottom line, and the languages, dress code and requests show as neat
  little tags instead of a run-on list. Nothing moved, nothing removed.
- **The Pricing box now reminds you which vehicle you're pricing.** A small chip in the Pricing header shows the class
  and car you picked (e.g. "Business · Van"), so while you set the ceiling you always see what it's for.
- **Guest names capitalise themselves.** Type "james" and it becomes "James" (just the first letter, so names like
  "Al Souad" stay right).
- **Number boxes only take numbers now.** Luggage, base fare and ceiling reject letters and stray characters as you
  type or paste (base fare and ceiling still allow a decimal point).
- **The "what changed" note now shows the time of the edit**, in bold, before listing what changed.

## 10 July 2026
- **The expanded trip is far easier to read.** When you open a trip on the schedule, its details used to be one long
  grey list where everything looked the same — and half of it just repeated the row you'd already read. It's now
  grouped into clean sections you can scan in a glance: a small strip of the numbers you actually act on (pickup
  time, vehicle, flight, and the fare — fare on the right), the full route with distance and time beside it, a slim
  one-line driver bar (name, tappable phone, car and plate), and the service requests and guests side by side, with
  languages and requests shown as little tags. The route line now also stops cleanly at the destination instead of
  trailing off past it. Nothing was lost — it's the same information, just organised so a busy schedule reads fast.
- **The two "edit" buttons now explain themselves.** Under an open trip, "Edit details" and "Propose a change" each
  carry a one-line note so you never have to guess which is which: *Edit details — update guest, flight and service
  info, applies now*; *Propose a change — new route or fare, the Driver must agree*. (Short version: edit details =
  fix the info, happens immediately; propose a change = ask the Driver to agree to a different route or price.)
- **You can now see what was changed on a trip.** When a Driver accepts a route or fare change, the trip now spells
  out exactly what changed — e.g. "Fare 120 € → 140 € · Add a stop at 3 Bd de la Ferrage" — instead of just saying
  "change accepted". And when you edit a trip's details (guest, flight, service…), the trip keeps a short "what
  changed" note (e.g. "Flight BA342 → BA118 · Added guest Eleanor Whitmore"), private to your team. (The detail
  note needs a one-line database change — done.)

## 7 July 2026
- **You can now change a trip after a Driver has taken it — with their agreement.** This is the big one. Once a Driver
  has accepted a trip, you can't just silently move the goalposts (they agreed to a specific job and price). So there's
  now a proper **"propose a change"** flow: open an accepted trip, click **Propose a change**, edit the route (pickup,
  stops, or destination) and set the new agreed fare, add a note, and **send it to the Driver**. Nothing on the trip
  moves yet — it shows **"Change pending"** on your schedule.
  - The **Driver gets a clear "Change requested" card** showing exactly what's changing *inside the trip* (the added
    stop or new destination highlighted right where it sits), what it means for their fare, distance and drop-off time,
    and a heads-up if it now clashes with their next pickup. They tap **Accept** (the trip's route + fare update on the
    spot) or **Decline** (the trip stays exactly as you agreed — nothing changes).
  - **If a Driver declines, you get a calm explanation, not a cold "no".** Especially in busy periods a Driver may be
    too tight to extend a trip — so the decline comes with a short note that this is normal and not personal, the
    Driver's optional one-word reason, and buttons to **call them** or **adjust and re-send**. The trip stays as agreed.
  - Your tap (theirs, really) is the record — the app is the source of truth even if you sorted it out by phone first.
  - (The price change is one you type for now; automatic pricing comes with the pricing engine. Being alerted the
    instant a change is proposed/answered — rather than seeing it on refresh — comes with notifications, later.) **Now
    live** — the whole loop was tested against the real database (propose → accept, propose → decline, and adding a stop).

## 5 July 2026
- **Edit polish:** the **"Edit details"** button now sits at the **top** of an expanded trip (it was at the bottom,
  easy to miss). And once a trip's info has been edited, the detail shows a quiet **"Edited · ⟨time⟩"** stamp so you
  can see it was changed and when — shown only inside the trip detail, never on the schedule row. (Needed a one-line
  database change — done.)
- **You can now edit a posted trip's details — without changing the price.** Expand a trip on the schedule and click
  **"Edit details"** to update the info a Driver sees: the guest names and phone numbers, flight number, luggage,
  your reference tag, and the whole Driver-and-service card (languages, dress code, requests, name board, private
  message). The trip's **price, route and time stay locked** — those are shown at the top for context but can't be
  changed here (changing the destination or adding a stop is a separate step the Driver has to approve, coming later).
  Editing is only offered while a trip is still upcoming — once a Driver starts the run, or the trip is finished, the
  details are frozen. Saving drops you back on the schedule with that trip open.
- **The "late-night trip" hint moved to the Pricing box.** That amber note about night pickups being harder to fill
  is really pricing advice ("raise your ceiling or use SPEED WIN"), so it now appears next to the ceiling and SPEED
  WIN controls instead of under the date — where you can act on it right away.
- **Testing: a driver can now preview the whole Pool.** For testing only (never on the live site), adding `?all=1`
  to the Pool page shows *every* posted trip regardless of the driver's car or zone — so with one demo driver you can
  see the luggage runs, vans, and luxury trips a single Class-E sedan would normally never be shown.
- **The Calendar has been redesigned.** Two clearer views:
  - **Month** now reads as a *load map* — each trip is a proper little row (time + guest) with a colour bar down
    its left showing status, instead of the old faint tinted chips you couldn't tell apart. Past days are gently
    dimmed, there's a **colour legend** on the page so you never have to guess what red or amber means, and busy
    days show as many trips as fit then a "+N more" that opens the day.
  - **Week** is now a real **time grid** — hours down the side, weekday names across the top, and every trip sits
    at its actual pickup time, so you can see your day fill up and spot the gaps. A line marks "now" on today.
  - **Click any trip, anywhere**, and a panel slides in from the right showing *that* trip — route, driver, fare
    and ceiling, flight — with the rest of the day underneath. One button jumps straight to it in the Schedule
    (it even opens the "earlier trips" fold for past days). No more hunting.
  - Smaller wins: the view you're on is remembered if you reload or hit back; the vehicle filter no longer hides
    "Business · Van" trips; and on a phone the grid scrolls sideways instead of squashing.

## 4 July 2026
- **You can now book a van just for luggage.** On a new mission there's a "Trip type" switch — pick "Luggage only" and
  the form sets it to a Van, drops the passenger names, and just asks how many bags. Drivers with a van choose in their
  settings whether they're up for bags-only jobs (off by default, so nobody's surprised), and those runs show up
  clearly labelled "Luggage run · no passengers · N bags" in the Pool and on your schedule. (A dedicated luggage truck
  by size, and attaching a luggage van to a passenger trip, come later. Needs the one-line database change — done.)
- **The new-mission form now gently flags things as you type — only when there's something to flag.** Two small,
  calm hints (same amber style as the existing "this fare looks low" note) appear while you fill the form and
  vanish once you fix them: (1) if you've entered more luggage than the chosen car comfortably holds, it suggests
  a Van (and, for a lot of bags, a dedicated luggage vehicle — coming later); (2) if the pickup is in the middle
  of the night, it notes that late trips can be harder to fill and that a higher ceiling or SPEED WIN helps a
  Driver grab it. Nothing blocks you — you can always post anyway. First step of the "guided form"; more to come.

## 3 July 2026
- **Your business name now sits in the top-right of the Dispatch screen, not squeezed into the bottom-left corner.**
  Before, your company showed as a small avatar and name tucked under "Settings" at the bottom of the sidebar — easy
  to miss. Now it's an account chip in the top bar, on the right: your logo (or initials) next to your business name.
  Click it for a small menu with "Sign out". "PickUp Dispatch" stays exactly where it was, top-left. Nothing else
  changed — "Settings" is still in the sidebar and collapsing the sidebar works the same.

## 28 June 2026
- **Your saved address now works for any business, on either end of a trip.** It's labelled "Your address" (not
  "pickup"), since a business can be the start of a trip (a departure) or the destination (an arrival). On a new
  booking it pre-fills the pickup to save typing — and there's a **swap button** to flip pickup and drop-off in one
  tap (for an arrival, or to fix a reversed entry). If your address is never an endpoint (e.g. a concierge service),
  a switch in settings turns the pre-fill off. Also removed the "Default Guest instructions" field (too case-by-case).
- **The Business account is now a proper settings area.** Instead of four lonely fields, there's a real left-nav
  settings page (like Booking/Airbnb): **Company** (business type, legal name, SIRET, VAT number, registered address, plus
  your Kbis), **Contact** (now showing your account email + a reception number), **Branding** (logo), and **Booking
  defaults** — including a saved **default pickup address** that pre-fills every new mission. **Billing** and
  **Notifications** are there too as honest "coming soon" sections so the account feels complete without anything being
  half-wired. (Needs a one-line database change to switch on.)
- **The new-mission form is honest about what's missing, and won't post a trip with no destination.** The warning
  used to be one fixed sentence that listed everything (even fields you'd already filled) — now it names *only* what's
  actually missing, in plain words ("add a drop-off address and a ceiling price"). You can no longer post a live
  mission without a real drop-off picked from the address suggestions (drafts can still be saved unfinished). Also
  fixed a hidden bug where a pickup that wasn't picked from the suggestions could slip through the Review step.
- **Trips with stops now show their progress, on both sides.** When a ride has intermediate stops, the Driver gets a
  "Reached — ⟨stop⟩" button (one tap per stop) between "Guest on board" and "Complete ride" — and finally sees the
  full route during the trip, not just pickup and drop-off. On the Business schedule the stops **check off live** as
  the Driver passes them (reached = green, the next one highlighted) and the status badge shows a little counter, e.g.
  "On board · 1/2". (Needs a one-line database change to switch on.)
- **The schedule no longer breaks when you shrink the window.** Before, narrowing the browser made the addresses
  disappear and the "Route" and "Flight" headers overlap. Now the whole trip row shrinks together — every column gives
  up a little space and long text just trims with "…" — so it always stays a clean, aligned table. If you squeeze it
  really narrow, the table keeps a sensible minimum width and you scroll sideways instead of anything colliding. (Same
  fix applies to the History list.)

## 27 June 2026
- **Small finish on the schedule's route line** — the little connector now stops just short of the pickup dot and the
  drop-off ring instead of running flush into them.
- **The schedule is far easier to read at a glance.** The trip list is now a clean, aligned table: columns line up,
  the route shows much more of the address (no more cramped "…"), and every other row has a faint stripe so your eye
  runs straight across — even with 30 trips on screen. Each day is a clear banded divider, the **column headings stay
  pinned to the top as you scroll**, and a **colour-coded bar down the left of each row matches its status** (red =
  needs a call, amber = unfilled, steel = confirmed, grey = pooled/done) so you spot what needs attention instantly.
  The History page got the same treatment.
- **The schedule now shows the whole route, stacked.** Each trip reads top-to-bottom on a little route rail:
  **pickup** (dark, solid dot), then any **stops** (grey — the stop's address, not just a count), then the
  **drop-off** (light grey, hollow dot). Because the addresses stack vertically, each one gets the full column width
  and shows **in full** — just without the redundant trailing country ("…, 06600 Antibes" instead of "…, Antibes,
  France") — so long addresses stop getting cut off. A trip with no stop is two lines; each stop adds one line.
  **Reference keeps its own column**, and the exact address is still on hover + in the trip detail. (We tried a few
  forms first — full address, a pickup-only line, fading the overflow — and landed here.)
- **The "this is final" warning now appears as a pop-up when you actually post.** It used to sit in the review panel
  the whole time you were checking a mission over, which felt like a warning for no reason. Now the review panel is
  clean, and the moment you hit **Post to the Pool** a short confirmation pops up — "Posting sends this live to the
  Driver Pool right away — it can't be un-posted." — with **Post to the Pool** to go ahead or **Cancel** to step back. You can also dismiss it with the Escape key or by clicking outside it.
  Nothing posts until you confirm. (This is also the app's first proper confirmation pop-up.)
- **Address search surfaces real places better.** Typing a shop or chain (e.g. "FNAC") now puts the actual nearby
  branches at the top — including the Nice store — instead of a useless "— Brand" entry, and shows more results so the
  one you want isn't cut off. (Heads-up: a few spots aren't in the map provider's database as their own point — the
  **Eden-Roc restaurant** is part of "Hôtel du Cap-Eden-Roc", and the **Galeries Lafayette Nice** store only shows the
  shop counters inside it. Search the hotel name or a counter and it still lands in the right place.)
- **Passenger phone numbers, with a "Share with Driver" switch.** On a mission you can now add a **phone for each
  Guest** and mark one as the **main contact** (the lead person — the boss, the parent, the assistant's principal —
  whoever the Driver should deal with). A phone is **never shared automatically**: you flip a **Share** switch to let
  the Driver call the Guest — either when you post the trip, or **later from the schedule** if the Driver is having
  trouble reaching them. The Driver only ever sees a number you've shared, and only after they've accepted the trip.
  And it's genuinely private — an un-shared number is kept somewhere Drivers can't read at all, not just hidden on screen.
- **Luggage and Flight number now sit side by side** on the mission form (they used to be stacked), so the Trip
  details section is tidier. They drop back to stacked on a narrow phone screen.
- **The "Reference" field on a mission is now a proper short tag.** It used to be a big "Reference / notes" box that
  did double duty; now it's a compact, single-line **Reference** — a quick tag for your *own* schedule like "Room 312"
  or "FIF 2026 Chopard". It's capped at **20 characters** (with a live counter), and it's **private to your team —
  the Driver never sees it** (anything the Driver needs goes in the Driver & service card's message instead). Existing
  missions keep their tag automatically. **(Now live.)**

## 25 June 2026
- **New "Driver & service" section on the mission form.** When posting a trip you can now tell the Driver:
  - **Which language(s)** they should speak (French, English, Italian, Spanish, German, Arabic).
  - **A dress code** — *Driver's choice → Smart casual → Business formal → Suit & tie*. It's clever about it: the
    sensible default is set from your service class (Eco/Business/First) and **never** jumps straight to suit & tie —
    you have to choose that on purpose. So Businesses stop over-asking for a suit when it isn't needed.
  - **Quick requests** — Meet & greet, Greeter (the Driver waits at the car), Luggage help, Child seat, Quiet ride,
    Pets on board.
  - **A name board** — **auto-filled with the first Guest's name** (and kept in sync as you type it); change it for a
    company or brand name, or **attach a PDF/photo** for a branded board.
  - **A private message to the Driver** for any special instructions (shown to them once they accept the trip).
  The Driver sees the language, dress code and requests *before* accepting (so they can pick trips they're right for),
  and the name board + private message *after* they accept. **(Now live.)**
- **Fixed a serious bug:** clicking **"Review"** on a new mission was accidentally posting it live and jumping to
  the schedule. Review now only shows a preview — nothing goes out until you click **"Post to the Pool"**.
- Added a clear **"This is final" warning** at the moment you post a mission.
- **Fixed duplicate missions:** clicking Post or Save more than once (because the server was slow) used to create
  copies — one trip had been posted 7 times. Buttons now disable and say "Posting…/Saving…" while they work, so a
  mission can only be created once.
- Added a **confirmation before discarding a draft** ("Discard this draft? This can't be undone").
- Tidied the buttons on the draft cards (the "Continue editing" button was squeezed).
- **Address search** can now be used with the keyboard — arrow up/down to highlight, Enter to pick, Esc to close.
- Added a small **count badge on "Drafts"** in the sidebar so you can see at a glance how many you have.
- The **calendar search now finds drivers too** (by first name or surname), not just guests.
- **Widened the Schedule, Calendar and History screens** so they use the full width of a desktop. (The
  new-mission page was deliberately left as it was.)

## 24 June 2026
- You can now **name several passengers** on one mission (first name + surname), with the number capped by the
  vehicle size (a sedan holds 4, a van holds 7, with a nudge to switch to a van past 4).

## 22 June 2026
- The **service class** (Eco / Business / First) is now picked with clear **tiles** instead of a plain dropdown,
  and the specific-car picker was tidied (and hidden for Eco, which has no specific models).

## 21 June 2026
- New **"serious navy" look** across the whole app (moved away from the bright consumer blue).
- **Redesigned the new-mission page** into a two-pane layout with a live summary panel on the right, and grouped
  all the pricing fields (base fare, ceiling, SPEED WIN) into their own card.

## 20 June 2026
- The **route box** got map-powered address autocomplete with **live distance and travel time**, focused on
  France and nearby countries (no more foreign junk results).

## 19 June 2026
- A batch of improvements: **preview a mission before posting**, **save it as a draft** and come back later, and
  pickup **times now use Paris time** correctly.
- Added **vehicle types** — a service tier (Eco / Business / First) combined with a body (Sedan / Van) — plus
  **real, traffic-aware travel-time estimates** on each trip.

## 18 June 2026
- Set up the **custom web address**: `driver.pickupbedriven.com` for drivers and
  `dispatch.pickupbedriven.com` for businesses (this also fixed the "role switching" problem).
- Gave the **Business/Dispatch side a full visual redesign** — new sidebar, a denser schedule, and a fuller
  calendar (month + week views).

## 17 June 2026
- Added **accounts**: profiles, settings, vehicle details, document uploads, and **mission history** for both
  drivers and businesses.
- Drivers now set a **home base + how far they'll travel** (with map address search), instead of ticking a list
  of towns — a much more realistic match for how VTC work actually happens.

## 16 June 2026
- **Project started, and the core of the app went online the same day:**
  - **Driver app:** see available rides, accept one (first to accept wins), and run the trip step by step
    (on the way → arrived → on board → completed).
  - **Business app:** post a transport request and watch it on a day-by-day **schedule** and a monthly
    **calendar**, with the status updating live.
  - The whole loop works end-to-end against the real database.
