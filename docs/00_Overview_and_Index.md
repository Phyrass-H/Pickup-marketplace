# 00 — PickUp · Overview & Index

> **Read me first.** This is the orientation doc for the whole PickUp project knowledge. It explains what PickUp is, defines the shared vocabulary, and maps the other documents.
> **Last updated:** current session · **Stage:** Pre-MVP (defining V1 scope, legal positioning, stack).

---

## What PickUp is

A two-sided **B2B booking platform** connecting professional VTC drivers with **Businesses** that need transport (hotels first, then event agencies, concierges, corporate accounts). The Business adds its own margin and serves its end client (e.g. a hotel guest). Two surfaces:
- **PickUp Driver** — mobile app for drivers.
- **PickUp Dispatch** — web dashboard / PWA for Businesses.

PickUp is the legal **intermediary** (a *centrale de réservation VTC*), not the transport operator — see Doc 01.

**Beta target:** French Riviera (Cannes, Nice + one more town). ~200 drivers lined up; hotels are the side still to secure. Every trip in beta is human-confirmed for reassurance.

**Founder:** Phyrass — former professional VTC driver, 5+ years in the industry. Collaborator: Dally.

---

## Glossary (use consistently across all docs)

- **Business** — the company/entity that posts missions (hotel, agency, concierge). The term for "the one who gives the missions." *Avoid "client"* (ambiguous with the passenger) and *avoid "principal"* (loaded VAT/legal term — see Doc 01).
- **Dispatcher** — the user/seat at a Business who posts and manages missions via PickUp Dispatch. One Business can have several Dispatcher seats (future multi-dispatch).
- **Driver** — the professional VTC who accepts and performs the mission.
- **Guest / passenger** — the Business's end client who actually rides.
- **Pool** — the list of available missions, filtered by category and zone, that Drivers browse and accept from.
- **PDP** — Progressive Dynamic Pricing: the fare starts underquoted and climbs over time toward the Business's ceiling until a Driver accepts.
- **Ceiling** — the maximum fare a Business is willing to pay; set by the Business per mission.
- **SPEED WIN** — urgent-priority flag for last-minute missions; fare starts at/near the ceiling for instant acceptance.

---

## Document map

| Doc | Title | Use it for |
|---|---|---|
| 00 | Overview & Index (this doc) | Orientation, vocabulary, where things live |
| 01 | Legal, VAT & Compliance | What PickUp legally is, obligations, tax model |
| 02 | Product & Features (MVP V1) | What we're building now and the full feature list |
| 03 | Technical Stack & Architecture | How it's built |
| 04 | Business Model & Go-to-Market | Commercials, market, beta strategy |
| 05 | Roadmap, Backlog & To-dos | Deferred features, open decisions, action items |

## How to maintain this set
- Keep docs **non-overlapping** — each fact lives in one place to avoid conflicting search results.
- When a decision is made, update the **one** relevant doc and bump its "Last updated" line.
- Keep terminology consistent with the glossary above.
