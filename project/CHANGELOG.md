# PickUp — What we've built (plain-language history)

> A simple, dated log of what's been done — written to be read, not for engineers.
> Newest at the top. The detailed technical version lives in `SESSION_LOG.md`.

---

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
