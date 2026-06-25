# PickUp — What we've built (plain-language history)

> A simple, dated log of what's been done — written to be read, not for engineers.
> Newest at the top. The detailed technical version lives in `SESSION_LOG.md`.

---

## 25 June 2026
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
