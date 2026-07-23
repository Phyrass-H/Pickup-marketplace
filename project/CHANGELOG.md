# PickUp — What we've built (plain-language history)

> A simple, dated log of what's been done — written to be read, not for engineers.
> Newest at the top. The detailed technical version lives in `SESSION_LOG.md`.

---

## 23 July 2026
- **Late Guests: the Driver is now paid to wait, instead of the trip being rescheduled.** This is the big decision of the
  day. If a Guest is running late, the Driver waits — and gets paid for it — rather than anyone moving the booking around.
  After the free "courtesy wait" (20 minutes in town, an hour at the airport), the Business is charged **€1 for every
  minute started**, which goes to the Driver. It stops climbing at a ceiling — **€40 in town, €60 at the airport** — so a
  Driver with an empty afternoon can't run the meter forever, but he's fairly paid for the time he's held.
  - **The Business can see the meter and stop it.** While a Driver is waiting, the Business now sees the running total on
    its schedule (before, it saw nothing until the invoice) and has a **"Stop waiting — the Guest isn't coming"** button.
    The Driver keeps his own way to report a no-show too. Either way the Driver is paid the fare plus the waiting.
  - **No more rescheduling a booked trip.** If the time genuinely needs to change, that's a new trip: cancel and rebook.
    A booked trip's pickup time is now locked once it's posted. (This also quietly closes a loophole where a Business
    could have pushed the time back to dodge a cancellation fee.)
  - **The €1/min is a starting figure**, set so we could build it — the real rate (and whether it differs by car class)
    is something to research properly later.
- **Fixed: airport pickups were quietly getting the short wait.** When you picked the airport from the address
  suggestions without typing a flight number, the app was treating "Aéroport Nice Côte d'Azur" as a *town* pickup — 20
  minutes of free wait instead of 60 — because of how the accented "é" was being read. Now airports are always recognised.
  This one had been hiding since the cancellation system launched; we only caught it by testing against real data.
- **Put the whole system through a hard test.** Before closing the day we ran an automated end-to-end test across the
  booking, acceptance, cancellation, no-show, waiting, and privacy rules — dozens of scenarios with many simulated
  Drivers and Businesses at once, including two Drivers grabbing the same trip at the same instant. **Everything passed**,
  and the test data was cleaned up afterwards so nothing was left behind.

## 19 July 2026 (later)
- **The no-show wait now starts when your Guest was due — not when the Driver turns up.** This was wrong, and it mattered.
  The free wait is the *Guest's* grace period, so it has to be counted from the moment the Guest was supposed to be there:
  for a town pickup, the time on the booking; for an airport, the moment the flight actually lands. Before this, a Driver
  who arrived early started the clock early — and could report a no-show *before the booked pickup time had even passed*.
  In the worst case a Driver could tap "on my way" and "arrived" a day and a half ahead, wait twenty minutes, and report a
  no-show: you'd have been charged the full fare for a trip that hadn't happened yet, and your Guest would have been left
  with a booking already marked finished. That's now impossible — the wait can't run out before the trip exists.
  - **A Driver who turns up late can't file instantly either.** They have to actually be there a few minutes first, so
    lateness can't be turned into a paid no-show.
  - **Airport pickups were quietly getting the wrong window.** When you pick an airport from the address suggestions, the
    app stores the street address in one place and the name ("Aéroport Nice Côte d'Azur") in another — and the wait rule
    was only reading the street address. So an airport booking without a flight number was treated as a *town* pickup:
    20 minutes of free wait instead of 60. Your Guest could still be at baggage reclaim. Fixed — it now reads both. (This
    one had been there since the cancellation system launched on the 13th.)
  - Groundwork is in place for automatic flight tracking: when we connect it, a delayed flight will shift the free wait
    with it, so nobody's clock starts while the plane is still in the air. (Needed two database changes — done.)

## 19 July 2026
- **"Agreed release" — a free, friendly way to hand a trip back, with both sides' say-so.** Sometimes a Driver who's taken a
  trip genuinely can't do it and there's still time to re-fill it — nobody's at fault. Instead of the Driver paying the 100%
  cancellation fee or the Business paying a cancel fee, there's now a proper **free release**: on an assigned trip the Business
  taps **"Agreed release · free"** (a separate button from the red Cancel), and the Driver gets a card to **accept or decline**.
  If the Driver accepts, the trip goes back to the Pool for another Driver — **no fee to anyone, no black mark on the Driver.**
  If the Driver declines, nothing changes — the trip stays exactly as agreed.
  - **Why the Driver has to agree:** it stops a Business quietly pressuring its way out of the cancellation fee. Without the
    Driver's tap, the only way for a Business to cancel is the normal fee-paying cancel. Consent keeps the free door honest.
  - **Declining is always safe for the Driver** — the card says so plainly ("free, no mark, only ever your choice"), and on the
    Business side a decline is shown calmly ("that's the Driver's call — the trip stays as agreed"), never as the Driver being
    difficult. We can't police a phone call, but the app makes saying "no" cost the Driver nothing.
  - **Every release is on the record.** The Business's request, the Driver's answer (including declines), the time, and how far
    out it was are all kept — so if a Business ever leans on Drivers with repeated "please release me" requests, there's a clear
    trail. You can hide a finished request from your own schedule, but it's never erased. (Needed a database change — done.)
- **Trips returning to the Pool are now priced smarter.** When a trip goes back to the Pool (a driver cancels, you reclaim it,
  or it's released), how it's re-offered now depends on timing: **within 24 hours of pickup it goes out as a SPEED WIN** (a
  higher offer, so someone grabs it fast); **more than 24 hours out it re-enters at the normal price and climbs as usual** —
  no need to overpay when there's plenty of time to fill it. (Applies to every way a trip comes back to the Pool.)

## 13 July 2026
- **You can now cancel a trip — properly, on both sides.** This is the cancellation system (O7).
  - **A Business can cancel a trip.** It's free while the trip is still unfilled (no Driver has taken it), and free up
    until 5 hours before pickup. After that a fee kicks in — 50% at 5 hours out, then rising 10% an hour to the full fare
    at pickup — and the cancel screen shows you exactly what it'll cost *before* you confirm, with a little chart of how
    the fee grows as pickup nears.
  - **A Driver can cancel a trip they've taken**, but it costs the full fare — the system is deliberately tough on Drivers
    so Businesses can count on their bookings. Before the "cancel and pay" button, the app points the Driver to two better
    options first: hand the trip to a trusted colleague (coming soon), or call the Business to agree a release. When a
    Driver does cancel, the trip goes straight back into the Pool as a SPEED WIN so another Driver grabs it fast.
  - **No-show.** If the Guest doesn't turn up, the Driver waits — an hour for airport pickups, 20 minutes in town — with a
    live countdown, then reports a no-show and is **paid in full**, exactly like a completed trip (the Business is charged
    and settles with its own guest). Because a no-show *pays* the Driver, that button is amber, not alarming red — and
    there's a friendly "are you sure?" step first, since a good Driver gives it a few extra minutes.
  - **"Take it back" when a Driver goes quiet.** If the assigned Driver never confirms and you can't reach them, close to
    pickup you get a one-tap "reclaim" that pulls the trip back and re-pools it as a SPEED WIN — no penalty to you. It only
    appears when the Driver genuinely hasn't confirmed, so a Business can't use it to dodge a cancellation fee.
  - The exact euro amounts are settled by hand during the beta; the rules above are what's built. Needed a database change
    (done). The "hand to a colleague" and the mutual "agreed release" flows come next.

## 10 July 2026 (later)
- **Address search now puts local places first.** Typing something like "aéroport t2" was showing a Paris (Roissy)
  shop, then Barcelona and Geneva, with the Nice result buried down the list. Now Côte d'Azur results (Nice, Cannes,
  Monaco, Antibes…) float to the top, and far-flung countries you'd never drive to (Spain, Portugal, the UK…) no
  longer clutter the suggestions. It's not perfect yet — the exact airport terminal can still be hard to pin down for
  a very short query — and for that last bit of precision we're planning to move the search to Google later. For now
  it's much cleaner and local-first.
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


---

## Earlier entries (16 June → 27 June 2026) — archived
Older shipped-work entries live in **`project/CHANGELOG_ARCHIVE.md`** to keep this file — and session startup — light.
