# 01 — PickUp · Legal, VAT & Compliance

> Scope: PickUp's legal identity, the obligations that come with it, and the VAT model. **Everything here must be confirmed with a French VTC/transport lawyer + expert-comptable before going live.** Not legal advice.
> **Last updated:** current session.

---

## Legal identity

- PickUp is a **centrale de réservation VTC** — a regulated VTC booking platform / intermediary under the French **Code des transports** (Loi Grandguillaume, n°2016-1920, 29 Dec 2016).
- PickUp is **NOT** the transport operator. Each **Driver** is the *exploitant VTC*. PickUp connects Drivers to Business demand.
- **Commercial model chosen: AGENT / intermediary (commission), NOT principal/reseller.** This keeps VAT on the commission only.
  - The earlier "reseller like Uber/Booking" framing was wrong: Booking.com is an agent (commission); Uber was *forced* into principal status and paid ~£1bn in VAT.

## The agent-vs-principal line (why it matters)

If PickUp is recharacterized as **principal**, it owes VAT on the **full fare** (not just commission), with little to deduct because most Drivers aren't VAT-registered. The two features that push toward "principal":
1. The pricing algorithm controlling the fare.
2. PickUp guaranteeing the service.

**Mitigations baked into the product:** the **Business sets the ceiling** (its commercial decision) and PickUp only **recommends** a fare — so price-setting sits with the Business, not PickUp. Contracts must keep the Driver a genuine free supplier that PickUp *facilitates*. (UK lesson: HMRC argued Uber was principal because it "controls the drivers' working patterns and terms.")

## Obligations of a centrale de réservation (some apply NOW, in beta)

1. **Declare to the DGITM** (annual). Since Sept 2025, only declared platforms may legally connect clients and Drivers. **€15,000 fine** for non-declaration.
2. **Verify every Driver is a registered VTC** — carte professionnelle, REVTC registration (€170 / 5 yrs), insurance, vehicle registration. **€300,000 fine** for connecting clients with non-VTC drivers. → Driver-doc verification is mandatory, not optional.
3. **Hold RC Pro insurance** for PickUp itself.
4. **Issue a compliant booking voucher** for every trip (*justificatif de réservation*; "transfer voucher" in EN) — 7 mandatory fields, format standardised by the arrêté of 6 Aug 2025. This is a build requirement.
5. **Display rule (art. L.3120-2):** do not show a client both the *location* AND the *availability* of cars before booking. Affects how availability is surfaced on the Dispatch side.

## VAT model

- As an **agent**, PickUp charges VAT only on its **commission**, at **20%** (standard rate for a platform fee).
- The **transport fare** carries the **10%** reduced rate — but that is the **Driver's** responsibility, not PickUp's.
- Most beta Drivers are under the **franchise en base** (~€37,500 turnover) → they charge **no VAT** at all on the fare. Legal, and not PickUp's problem.
- **VAT does not stack.** Each party accounts only for VAT on its own output and deducts its inputs; the **Guest** bears it once at the end. "Remitting" VAT ≠ "bearing" it — businesses in the middle are collectors, not payers.
- **Quirk:** the 10% transport VAT is **not recoverable** by the Business; the 20% commission VAT **is** recoverable. Keep transport vs service fee on **separate invoice lines**.
- **Cash ≠ supply:** money flowing through PickUp's account doesn't make the transport PickUp's supply — set up as *encaissement pour le compte du chauffeur* (collection on the Driver's behalf).
- **Future — EU "ViDA":** a deemed-supplier rule for road passenger transport applies from **1 Jul 2028** (member states may delay to **1 Jan 2030**). It may push the uncollected Driver VAT onto the platform unless the Driver provides a VAT ID and self-declares. Most small Drivers won't → plan for it.

## Worked money-flow example
Carlton Cannes → Nice airport, beta case, Driver under franchise, 15% commission:

| Party | Pays | Receives | Keeps |
|---|---|---|---|
| Guest | €150 (to Business) | — | the ride |
| Business (hotel) | €118 (to PickUp) | €150 (from Guest) | €32 margin |
| PickUp | €100 (to Driver) + €3 VAT (to state) | €118 (from Business) | €15 commission |
| Driver | — | €100 (from PickUp) | €100 (no VAT) |

PickUp's invoice to the Business = 2 lines: Transport €100 + Service fee €15 + €3 VAT (20%). PickUp's only VAT responsibility is the €3 on its own €15.

## Open questions for the lawyer
- Does the **B2B-via-hotels** structure (Driver → Business → Guest, not Driver → Guest) still cleanly fit "centrale de réservation"?
- Confirm contracts + the pricing/service-guarantee design don't tip PickUp into principal.
- Invoicing mechanics: self-billing (*auto-facturation*) vs Driver-issued invoices; collection-on-behalf wording.
- Driver status (independent contractor) — avoid requalification as employees.
