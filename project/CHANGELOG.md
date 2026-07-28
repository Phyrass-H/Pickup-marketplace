# Kavenue — What we've built (plain-language history)

> A simple, dated log of what's been done — written to be read, not for engineers.
> Newest at the top. The detailed technical version lives in `SESSION_LOG.md`.

---

## 28 July 2026 (evening) — Earnings
- **The Earnings tab is real.** Big total for the period, what it's made of, and every trip listed underneath grouped
  by day. No charts — you didn't want them, and the day and week rows say the same thing in numbers you can read.
- **Look at any period you like.** Day, week, month or year, ‹ › to step back one at a time, and tapping the dates
  opens your phone's own calendar to jump anywhere. Whichever of the four is selected decides what the date you pick
  means — 18 July in "month" mode shows you July.
- **It compares.** A green or red chip shows how the period did against the one before it. The same-period-last-year
  line will appear on its own once there's a year of history — right now the oldest trip is 16 June, so there's
  nothing to compare to yet.
- **It counts the money that isn't a trip fare**: waiting time, a no-show (which pays you in full), a Business
  cancelling on you — and your own cancellations in red, so the total actually adds up.
- **⚠️ A real money bug, found and fixed — and it was worse than it first looked.** A trip's price rises while it waits
  in the Pool for a Driver, but the clock was never stopped when someone took it. So a finished trip kept getting more
  expensive: one demo ride was accepted at **70 €** and was showing **100 €** weeks later. Worse, **cancellation fees
  were being calculated off that inflated number** — a Driver walking away from a 70 € job was charged 100 €, and a
  Business cancelling was billed too much too.
- **Now the rule is simple and applies everywhere: the final price is the price the Driver accepted.** Every screen and
  every fee on both sides uses it. Tested for real on the live database: a Driver cancelling a 70 € trip is now charged
  **70 €** (was 100 €), and a Business cancelling the same trip at 83% is charged **58,17 €** (would have been 83 €).
  A few historic trips will show their correct, lower number. The schedule also stops saying "Fare now" once a Driver
  has the trip — it says **"Agreed fare"**.
- **Still to decide (noted for you):** now that the fee is based on the real fare, **100% may not be enough of a
  deterrent on cheap trips** — a 50 € job only costs 50 € to abandon. Written into the backlog with some options; no
  rule changed.

## 28 July 2026 (later) — the Driver's account, rebuilt
- **A Driver's settings is now a proper account area.** It used to be one very long scroll with a single Save button
  that quietly saved your car as well as your phone number. Now there's an **Account** screen — your photo, your name,
  your car, and a line telling you exactly what's still missing — with a separate page for each thing: Profile, Where
  you work, Your vehicle, Your company, Documents, Navigation, Payouts, Help.
- **"2 things left before you can drive."** Instead of a meaningless progress percentage, the account page names what's
  actually missing — *"URSSAF attestation — not added"*, *"VTC card — expires in 21 days"* — and each one is a link
  straight to it. Anything that would stop you working is listed first. **It only tells you; it never blocks you** —
  during the beta nobody is locked out for a missing paper.
- **Documents are a real feature now, not a list of upload boxes.** Each paper has a state you can see at a glance —
  valid, with us for review, needs a new photo, **expires in 21 days**, expired — and we ask for the expiry date when
  you file it, so nothing lapses quietly. If we reject one, you're told **why**. Two-sided papers (licence, VTC card)
  take a front *and* a back instead of one replacing the other.
- **Take a photo, and frame it before it's sent.** A camera button opens the phone camera directly; you then crop the
  document, turn it if it came out sideways, and straighten it if it's crooked — the same framing tool the profile
  photo uses, and it starts by showing your whole document rather than cropping the ends off. A PDF still works and
  skips the framing step.
- **We now collect what we need to actually pay you.** A Driver drives as a company, so the account asks for the
  company name, SIRET and VAT number, and the documents list has a "so we can pay you" section: **Kbis, RC Pro, and
  the URSSAF attestation de vigilance** — that last one is something *Kavenue* is legally required to hold and renew
  every 6 months. **We never ask for your bank details** — Stripe collects those when payouts go live.
- **Languages are chips now**, not a comma-separated text box where "Francais" and "FR" both meant French.
- **Navigate.** The "preferred GPS" setting had never actually done anything. Now a live trip has a **Navigate** button
  that opens Waze, Google Maps or Apple Maps — whichever you chose — pointed at the pickup, then the next stop, then
  the drop-off. If the app isn't on the phone it opens the route in the browser instead.
- **Decided: one car per Driver for now.** Adding a second car sounds small but changes what the hotel is told about
  which car is coming, and touches the code that hands out trips. The real "several cars" case is a fleet with several
  drivers, which is a bigger piece of work — so the groundwork is in place and the feature waits.

## 28 July 2026
- **A Driver's history now shows every trip that ended — including the ones they walked away from.** Until now, if a
  Driver cancelled a trip or you both agreed to release it, the trip went back into the Pool and **disappeared from
  their app completely** — even though a cancel costs them a 100% penalty. Their Past tab now shows those too:
  "You cancelled this trip · it went back to the Pool" with the penalty in red, and "Released by agreement · no fee,
  no mark". Neither is clickable, because the trip may belong to another Driver by then.
- **A Driver can now read why you cancelled.** If you write a reason when cancelling, the Driver sees it in their
  history. The reason box on your side now says **"your Driver will see this"** so there's no surprise. Their own
  reason is shown back to them the same way.
- **The "Cancelled" badge lost its little ×** — it looked like a button you could press.
- **Noticed while doing this:** the feature that let you take a trip back for free when a Driver never confirmed can no
  longer trigger — accepting now confirms instantly, so there's no "not confirmed yet" state left for it to catch. It
  isn't broken, just unreachable. That means you currently have **no free way to replace a Driver who goes quiet close
  to pickup** — first thing on the list for next session.

## 26 July 2026
- **My Rides has proper tabs now — Upcoming and Past.** The ride history used to be a small underlined link tucked in
  the corner of the header. It's now a real two-tab switch at the top of the screen, each tab showing how many trips
  are in it, so a Driver can move between "what I'm driving" and "what I've driven" without hunting for a link.
- **The upcoming list is split by day.** Trips are grouped under **Today**, **Tomorrow** and then the date ("Friday 31
  July"), with a count beside each. Because the day is written above the group, each card now shows just the pickup
  time — one clean number instead of the date repeated on every card.
- **Past trips got their own, lighter design.** A finished trip is a record, not work, so it's drawn simply: the date
  and time, a status badge, the route on one line each, the Business and the fare. They're grouped by month, and a small
  **All / Completed / Cancelled** filter sits at the top so a cancelled trip is one tap away instead of a scroll.
- **A cancelled trip now says who cancelled it, and what the Driver is owed.** It turns out a Driver only ever *sees* a
  trip you cancelled — if a Driver drops a trip, or you both agree to release it, it goes straight back into the Pool
  and disappears from their app. So the card says **"Cancelled by the Business"** and shows the real compensation
  (50–100% of the fare depending on how late, plus any waiting already running), labelled "Compensation" so it can't be
  mistaken for the trip fare. **No-shows stay under Completed** — they pay the Driver the full fare, so that's where
  they belong; the amber badge already makes them easy to spot.
- **A Guest's details disappear from a Driver's app once the trip is over.** Names, phone numbers, the name board and
  your private message to the Driver are all removed the moment a trip closes — the Driver keeps only the date, route,
  fare, status and who the trip was for. **Nothing changes on your side: Dispatch keeps the complete record.** The
  Driver sees a one-line explanation so it reads as a rule, not as missing information.
- **Both tabs now have a proper empty screen** instead of a bare line of text — the Upcoming one points you to the Pool.
- **Month headings are in English again** ("July 2026", not "Juillet 2026") on both the Driver and Business history.

## 25 July 2026
- **Accepting a trip now works right away.** Before, if you grabbed a trip more than 3 hours ahead, it sat in a
  half-accepted state — no "Start" button, and a confusing "Lock-in at T-180" note — and nothing ever un-stuck it.
  Now accepting a trip confirms it on the spot: the run controls are there immediately. Two small tidy-ups on the
  pre-accept card went with it — the redundant city label is gone from the footer, and the "unlock once you accept"
  line is now one short sentence ("Private details unlock once you accept.").
- **The Pool's quiet moments got designed.** When there are no trips for you yet, the Pool no longer shows a bare
  line of grey text — it's a calm little state that tells you *why* it's empty ("New Business · Sedan trips within
  15 km of Nice land here…"), so you know it's working, not broken. If you haven't set your driving area yet, it
  points you to Settings with one clear button. And while trips are loading, you now see placeholder cards shaped
  like the real ones, gently pulsing, instead of a blank screen.
- **My Rides is a clean list now — and each trip opens on its own page.** Your accepted trips used to pile up in
  one long scroll with every button — start, complete, cancel, the waiting meter — crammed under each card, so your
  live trip's controls sat squeezed between other trips above and below. Confusing. Now **My Rides is just a tidy
  list, like the Pool**: one tap-through card per trip showing where it stands, the route, and the fare — nothing
  else. **Tap a trip and it opens on its own page**, where all the buttons live, with a **"← My Rides" link** to get
  back. One trip, one screen.
- **Finished trips move to History.** My Rides only shows what's live or coming up now; completed trips go to the
  History page, so the list stays short and current.
- **The no-show reminder got shorter.** The note before reporting a no-show is now one line — "Make sure you've
  tried everything to reach the Guest — a call, the full wait. Then you're clear to report." — instead of a
  paragraph, and it no longer talks about bags. The report button just shows the amount, without the "you're paid"
  wording.
- **The Driver app's two remaining screens got the new look.** In July we redesigned the Pool — the list of trips a
  Driver can take. Now the other two catch up, so the whole Driver app finally looks like one product. **Tapping a
  Pool trip** opens what is recognisably the same card, just opened up: the price and time at the top, the badges,
  and the route — except every stop is now spelled out in full instead of being folded into a "+2". Underneath, a
  clean **Service** panel (passengers, bags, flight) and small grey tags for the things the Business asked for
  (meet & greet, child seat, dress code, languages). A quiet locked line explains what's still hidden — the Guest's
  name, the name board, the private message — and why: those unlock the moment you accept. The **Accept mission**
  button sits at the bottom, on its own, with nothing competing with it.
- **The trip you've already accepted is now a working screen, not a list entry.** Once a trip is yours, the price
  stops being the headline — you know what you're earning — so the top of the card now shows **where you are in the
  trip**: a status badge, a progress bar, and a line in plain words ("Not started", "On the way", "Waiting for the
  Guest", "On board · 1/2 stops"). The price moved down to the bottom corner. Phone numbers became **big tap-to-call
  buttons** for the Guest and the Dispatcher instead of small rows of text — you can hit them without looking. The
  name board and the Business's private message sit together in their own little box, so you can check what to have
  ready in one glance. Stops now tick off **on the route line itself** as you reach them.
- **One button that matters, per screen.** Whatever the next step is — "Start — I'm en route", "Guest on board",
  "Complete ride" — that's the only filled-in button on screen. "Report a no-show" and "Cancel this trip" are still
  right there, but as quiet text underneath, so a tired thumb doesn't hit them by mistake. (Reporting a no-show
  still asks you to confirm, and that confirmation is still a big amber button — at that point it *is* the action.)
  Small fix along the way: **"Complete ride" is finally green** instead of navy, the way it was always meant to be.
- **The waiting meter didn't change — it just got tidier.** The courtesy wait, the €1 per minute after it, the €40
  city / €60 airport stop point: all identical. It just looks like the rest of the app now.
- **The product is now called Kavenue, everywhere in the app and the docs.** The old "PickUp" name is gone from every
  screen a Business or a Driver can see — the Dispatch header now reads **Kavenue Dispatch**, the sign-in pages, the
  welcome screen, the Settings pages, the cancellation and no-show wording, and both legal pages (French and English) all
  say Kavenue. The phone app's name and icon label changed too, so installing it to a home screen gives you "Kavenue
  Driver". All the internal paperwork (spec documents, session notes) was renamed to match.
- **Nothing about how the app works changed.** This was purely a change of name — no new features, no database changes,
  nothing moved. Everything was rechecked afterwards: the app builds cleanly and all 18 screens were opened against the
  real database to confirm the old name appears nowhere.
- **Three things were left alone on purpose, and they're yours to do when you're ready:**
  - The **web address is still `pickupbedriven.com`** — changing it needs the new domain registered first, and touching it
    early would take the live site down. Everything in the code is ready for the switch.
  - The **folder on your Mac** (`PickUp_project_dev`) and the **GitHub project name** still say PickUp. Renaming those
    from here would have broken the connection to your repository, so they need doing by hand.
  - The **demo login accounts** (the "sign in as demo Business/Driver" buttons) still use old-name email addresses behind
    the scenes. Those addresses are real records in the database — renaming just the app's copy of them would break the
    demo sign-in, so they should only be changed together with the database.
- Also left alone deliberately: the word "pickup" where it means **the pickup point of a trip** (the Route column, "pickup
  time", "pre-fill my address as the pickup"). That's the transport word, not the brand.

---

## 24 July 2026
- **The Driver app got a proper redesign — starting with the Pool (the Driver's list of available trips).** Until now the
  Driver side only had the new navy colours; its layout was never redone the way the Business side was. Two big changes:
  - **A real bottom menu bar with icons** — Pool, My Rides, Earnings, Settings — replacing the old plain text links at the
    top that looked cheap. It feels like a proper phone app now. (Sign out moved into Settings.)
  - **Redesigned trip cards** — every card is the same clean shape, so a Driver's eye learns exactly where to look: price
    and time up top; the trip type (Transfer / At disposal) and any SPEED WIN; the pickup→drop-off route as a tidy line
    with a "+2" marker when there are extra stops; the full addresses; and one neat bottom line with the trip distance and
    small icons for what the trip needs (child seat, luggage, meet & greet…). Busy trips show the 3 most important and a "+N".
  - **A new "Earnings" tab** in the menu (the screen itself is a "coming soon" placeholder for now — we'll design it next).
- All of it was drawn first as on-screen mockups you signed off, then built to match, checked live in the browser, and run
  through an automated review that caught and fixed six small polish issues (mostly legibility and phone-edge spacing).
- **Still to decide:** whether to keep the small greyed-out car type on each card (it's the Driver's own car, so a bit
  redundant). The rest of the Driver screens get the same treatment in later passes.

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
  Click it for a small menu with "Sign out". "Kavenue Dispatch" stays exactly where it was, top-left. Nothing else
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
