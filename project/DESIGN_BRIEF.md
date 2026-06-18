# PickUp — Design Brief (for Claude Design)

> Paste this into a Claude Design project, and/or link the GitHub repo so Claude
> Design reads the real components + this brief. It captures brand, constraints,
> and every screen so its redesign maps cleanly back onto the codebase. When a
> design is ready, use **Export → Send to local coding agent** to hand it back to
> Claude Code (this repo) to build for real.

## What PickUp is
A **B2B VTC booking marketplace** — a French *centrale de réservation VTC*. It
connects professional VTC **Drivers** with **Businesses** (hotels first) that need
transport. PickUp is an **agent / intermediary** — never the transport operator or
reseller. Tone: professional, trustworthy, calm. This is a **tool for professionals,
not a design showcase**: functional and intuitive over decorative.

## Two surfaces (separate subdomains, one codebase)
- **Dispatch (Business)** — `dispatch.pickupbedriven.com`. A **desktop dashboard**
  (~1080px canvas). Used by a hotel Dispatcher managing 10–55 trips/day. Density +
  at-a-glance status matter (think fleet-dispatch / booking software).
- **Driver** — `driver.pickupbedriven.com`. A **mobile-first PWA** (phone-sized).
  Used one-handed, on the move. Big tap targets, glanceable.

## Brand
- **Logo:** `public/logo.png` — a location pin with an infinity/“8” loop, in a soft
  **purple→blue gradient**. Tall aspect ratio (~924×1153, ratio 0.80). Keep the
  gradient on the mark only; the UI itself stays solid/flat.
- **Direction (chosen by the founder):** clean, conventional, "trustworthy SaaS"
  blue. Don't reinvent patterns people know. Easy on the eyes, functional.
- **Palette (current — open to refinement):**
  - Action blue `#2563EB` (hover `#1D4ED8`) — primary buttons, links, active states
  - Text / headings slate `#0F172A` · Muted `#64748B`
  - Page `#F8FAFC` · Surface `#FFFFFF` · Border `#E2E8F0`
  - Success `#16A34A` · Warning `#D97706` · Danger `#DC2626`
- **Type:** system sans stack today (`-apple-system, Segoe UI, Roboto, …`). A
  refined web font is welcome if it stays fast + professional. h1 ~22px, h2 ~17px.

## Glossary — use these EXACT terms (never "client" / "principal")
**Business · Dispatcher · Driver · Guest · Pool · PDP · Ceiling · SPEED WIN.**
- **Pool**: the live set of available (`pooled`) missions a Driver can accept.
- **PDP**: the current fare, computed on read (climbs over time toward the ceiling).
- **Ceiling**: the Business's maximum price for a mission.
- **SPEED WIN**: a mission posted at/near the ceiling for fast pickup.

## Screen inventory

### Dispatch (Business) — desktop
1. **Schedule** (`/dispatch`) — the home. Dense rows grouped by day, **Today pinned**,
   past under an "Earlier" fold. Columns: Time · Route · Client/Ref · Driver · Status.
   Each row has a **colour-coded left edge + status pill** (green=in progress,
   blue=confirmed, amber=unfilled near pickup, red=accepted-not-confirmed near pickup,
   grey=pooled). Click a row → expands in place with full detail + Driver phone.
2. **Calendar** (`/dispatch/calendar`) — month grid, trips as coloured dots/time/place.
3. **New mission** (`/dispatch/new`) — booking form: category, addresses (Mapbox
   autocomplete), stops, pickup time, pax/luggage, flight, room/event reference,
   **ceiling**, SPEED WIN toggle, live soft-warning if ceiling < estimate.
4. **Settings** (`/dispatch/settings`) — business name/field, **logo** (crop editor),
   Dispatcher contact, **documents** (Kbis upload, status pill), billing stub.
5. **History** (`/dispatch/history`) — past trips, month-grouped.

### Driver — mobile PWA
6. **Pool** (`/pool`) — available missions as **cards** with PDP fare, route, time,
   category; matched to the Driver's base + service radius. Tap → detail.
7. **Mission detail** (`/missions/[id]`) — full mission + **Accept** button.
8. **My Rides** (`/rides`) — accepted missions, **contacts unlocked**, a 4-step
   **status control** (en route → arrived → on board → completed) + progress bar.
9. **Ride history** (`/rides/history`) — past rides, month-grouped.
10. **Settings** (`/settings`) — profile photo (crop), name/phone/languages/GPS,
    **base + service radius** (Mapbox autocomplete), vehicle details, documents,
    payouts stub.

### Shared
11. **Login** (`/login`) — email magic-link form, logo, side-aware heading
    (Dispatch vs Driver). 12. **Splash** (`/` on the bare domain) — a small
    "Driver / Business" chooser. 13. First-run: `/welcome`, `/onboarding`,
    `/onboarding-business`.

## Design direction & principles
- **Clean, conventional, functional.** Lean on familiar SaaS patterns; no novelty
  for its own sake.
- **Dispatch:** dense but readable; a Dispatcher scans the day in one glance. Status
  colour-coding is load-bearing — keep it legible and consistent.
- **Driver:** mobile-first, big tap targets, glanceable cards, one-handed use.
- **Accessible:** AA contrast, clear focus states, no colour-only signals.
- **Consistent components** across both surfaces (buttons, cards, pills, fields).

## What to keep vs. what's open
- **Keep:** the information architecture, the Schedule/Calendar paradigm, the
  status colour system, the glossary, the Driver card pattern. Build only features
  that already exist (don't introduce new ones).
- **Open to redesign:** visual polish, spacing/rhythm, typography scale, component
  styling (headers, cards, pills, rows, forms, calendar), empty/loading states,
  the login/splash, iconography.

## Implementation notes (so the handoff maps to the code)
- **Stack:** Next.js (App Router, TS). Theming is driven by **CSS custom properties
  in `app/globals.css`** — a new palette is mostly variable changes.
- **Key classes to target** (so a redesign drops in cleanly): `.app-header`,
  `.brand` / `.brand-logo`, `.tabs`, `.trip` / `.trip-time` / `.trip-route` /
  `.status-pill`, `.card`, `.btn` (`.secondary`, `.danger`), `.field`, `.grid-2`,
  `.cal-grid` / `.cal-cell` / `.cal-entry`, `.mission-card`, `.kv`, `.notice`,
  `.auth-card` / `.auth-brand` / `.auth-logo`, `.doc-row`.
- **Targets:** Dispatch ≈ 1080px desktop; Driver ≈ 390px mobile.
- Prefer changes expressible as **CSS variables + component classes** so Claude Code
  can implement the handoff bundle by editing `globals.css` + the named components.

## Out of scope (don't design these — CUT for V1)
Ratings/badges, in-app chat, live-map GPS tracking, grouped missions, multi-seat
dispatch, full ML dynamic pricing. (Tracked but not built.)
