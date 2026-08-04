# Kavenue — landing site handoff

> **For a NEW, separate Claude Code project** that owns the public marketing site, independent of the product
> repo. Founder's call, 2026-08-04: the landing page lives in its own repo, not inside the app.
> Copy this file into the new project as its `CLAUDE.md` starting point.
> Written from the product repo at `PickUp_project_dev` on 2026-08-04.

---

## 1. What Kavenue is (get this right or nothing else matters)

A **B2B VTC booking marketplace** on the French Riviera — a *centrale de réservation VTC*. It connects
professional VTC **Drivers** with **Businesses** (hotels first) that need transport for their **Guests**.
A Business posts a trip; it sits in the **Pool**; a Driver accepts it and drives the Guest.

### Hard rules — these are legal, not stylistic

1. **Kavenue is an AGENT / intermediary. NEVER the transport operator, never a reseller.**
   Never write "our drivers", "our fleet", "we drive you", "book a Kavenue car". Kavenue *connects*; the
   Driver is the independent operator (*exploitant VTC*). This is a VAT position worth the business — as an
   agent Kavenue owes VAT only on its commission; recharacterised as principal it owes VAT on every fare.
2. **The Business sets the price. Kavenue only recommends.** Never imply Kavenue sets or controls fares —
   "the pricing algorithm controlling the fare" is one of the two things that pushes a platform into
   principal status.
3. **Glossary — use these exact words:** Business · Dispatcher · Driver · Guest · Pool · PDP · Ceiling ·
   SPEED WIN. **Never "client", never "principal".**
4. **Kavenue ≠ PickUp Go.** Different product. Don't conflate.
5. **Invent nothing.** No traction numbers, no market figures, no testimonials, no client logos, no
   "trusted by N hotels". If the founder hasn't supplied it, leave a visible placeholder.

A safe one-line description, already used in the product:
> *Kavenue is a booking platform, not a transport operator. Every trip is carried out by an independent,
> registered VTC Driver.*

---

## 2. The domain plan — read before touching Vercel

**Today** (all on one Vercel project called `kavenue`, registrar OVHcloud, DNS zone at OVH):

| Host | Serves |
|---|---|
| `kavenue.fr` (apex) | the product repo's placeholder splash |
| `www.kavenue.fr` | 308 → apex |
| `driver.kavenue.fr` | the Driver app |
| `dispatch.kavenue.fr` | the Business / Dispatch app |

**Target** — two Vercel projects, each owning its own hosts:

| Host | Project |
|---|---|
| `kavenue.fr` + `www.kavenue.fr` | **NEW landing project** |
| `driver.kavenue.fr` · `dispatch.kavenue.fr` | existing `kavenue` product project |

This is clean: a host belongs to exactly one project, so nothing is ambiguous.

### The safe order (do NOT reorder — step 4 is the only risky one)

1. Build the landing site in the new repo.
2. Deploy it to its own Vercel project. It gets a free `*.vercel.app` URL.
3. **Verify it fully on that `.vercel.app` URL.** Nothing below is reversible in seconds.
4. In Vercel: **remove** `kavenue.fr` and `www.kavenue.fr` from the `kavenue` project, then **add** them to
   the landing project. Vercel refuses to let two projects claim one domain, so it must be remove-then-add.
   ⚠️ The apex is briefly unserved between the two — do it in a quiet minute. `driver.` and `dispatch.`
   are separate hostnames and are **not affected**; the product keeps working throughout.
5. DNS: the OVH records already point at Vercel and **do not need to change**. Only the project-to-domain
   binding inside Vercel changes.
6. Back in the product repo, delete the now-dead splash (`components/landing-splash.tsx` and the
   `isProdDomain && roleSubOf === null` branch in `app/page.tsx`). Ask the founder before doing this —
   it is a change to the product repo, not this one.

### Sign-in must be a LINK, never a form
Each app subdomain has its own **host-only session cookie** — that is deliberate, it is what lets someone be
signed in as a Driver and a Business at once. **A login form on `kavenue.fr` physically cannot set a session
cookie for `dispatch.kavenue.fr`.** So the landing page links out:
- Businesses → `https://dispatch.kavenue.fr`
- Drivers → `https://driver.kavenue.fr`

Sign-**up** is not self-serve and must not pretend to be: a Business needs onboarding, and a Driver legally
cannot work until their documents are verified (there is a €300,000 fine for connecting Guests with
unregistered VTC drivers, and the admin verification workspace is unbuilt). The CTA is **"Request access" /
"Apply to drive"** — a capture, not an account.

---

## 3. Brand tokens — copy these exactly

The product's source of truth is `app/globals.css` in the product repo. **Drift is the real cost of a second
repo**, so copy this block verbatim and treat any change as needing to happen in both places.

```css
/* Action navy — primary buttons, links, active states */
--accent:        #25344C;
--accent-hover:  #1B2738;
--accent-soft:   #E9EDF4;

/* Text */
--text:          #0F172A;
--text-muted:    #64748B;
--text-faint:    #94A3B8;

/* Surfaces */
--bg:            #F8FAFC;
--surface:       #FFFFFF;
--surface-2:     #FAFBFC;
--border:        #E2E8F0;
--border-strong: #CBD5E1;

/* Status tones (only if showing product states) */
--tone-neutral:  #667085 on #EEF2F7;   /* Pooled / Completed  */
--tone-info:     #1B5E8A on #E3EBF2;   /* Confirmed           */
--tone-success:  #157347 on #E6F6EC;   /* En route → On board */
--tone-warn:     #B54708 on #FFF6ED;   /* Unfilled near pickup */
--tone-danger:   #B42318 on #FEF3F2;   /* Expired / not confirmed */
```

- **Font:** Geist (Google Fonts) in the product. Match it or choose deliberately.
- **Direction (founder, D24):** serious, solid, confident. Deep navy, premium, restrained,
  **near-monochrome**. B2B, *not* bright consumer SaaS.
- **Founder's taste:** refined, quiet, light. **Never bold or heavy.** Hierarchy from restraint, not weight.
  Keep muted greys legible (WCAG AA).
- **The logo gradient (purple → sky-blue) is for the MARK ONLY.** Never a gradient on a UI surface.
- ⚠️ **The logo asset is not web-ready.** `public/logo.png` is 924×1153 and still sky-blue; a navy SVG
  re-export is an open founder task. Ask for it before designing a header around it.

---

## 4. The three audiences

- **`/` — the hero.** What Kavenue is, then a fork to the two sides.
- **`/business`** — hotels, concierges, relocation, events. They book transport all day and answer for it
  when it goes wrong.
- **`/drivers`** — independent VTC operators. They want real work at a fair, honest price.
- **`/investors`** — **unlisted**: real page, `noindex`, not in the nav, URL shared deliberately.
  **All content comes from the founder.** Do not draft traction, market size or the ask.

### True things the product actually does (safe to claim)
- The Business sets a **Ceiling**; the fare climbs toward it until a Driver accepts (the **PDP**).
- **The fare freezes the moment a Driver accepts** — it cannot change afterwards, for either side.
- **No empty-return charge, ever** — a one-way is priced as a one-way (founder decision, D37).
- **Waiting is paid**: a courtesy wait, then by the minute, capped.
- Drivers choose their **zones, vehicle class and hours**. Nothing is assigned.
- A Business sees **live status** — checked in, on the way, arrived, on board, complete.
- Guest phone numbers are shared with the Driver **only when the Business chooses**, and leave the Driver's
  app when the trip closes.
- Full searchable history with **CSV export**.

### ⚠️ Claims to CHECK with the founder before using
- Anything about Driver **vetting/verification** — it happens by hand today, with no admin tooling.
- Anything implying **volume or scale** ("hundreds of trips", "our network").
- A **pricing page** — the commission model is actively being decided. Don't invent numbers.

---

## 5. The contact form

Two options; the founder decides at design time.

- **Simple:** show `contact@kavenue.fr` (a real, working alias). Zero infrastructure.
- **Real form:** POST to a `access_request` table in the existing Supabase project. The migration is already
  written at `docs/migrations/2026-08-03_access_request.sql` in the **product** repo — copy it across if
  used. The new project would need the Supabase URL + **service-role key** (server-side only, never in the
  browser), and the table is deliberately RLS-locked with no policies so only the service role can write it.

Fields that matter: name · email · company (optional) · phone (optional) · message · which side they came
from (business / driver / investor).

---

## 6. Recommended stack

Next.js (App Router) on Vercel — same as the product, so the founder isn't learning two things, and
components/tokens can be lifted across by hand. A static site generator would also be fine; the only dynamic
need is the form.

**Do not** copy the product's `globals.css` wholesale. It is 3,000+ lines of app UI and its class names
(`.btn`, `.card`, `.row`) will collide with anything a landing page wants. Take the **token block above** and
write fresh CSS.

---

## 7. Context worth reading in the product repo

Attach these if the new project needs depth (all short):

- `docs/00_Overview_and_Index.md` — what Kavenue is + the glossary
- `docs/01_Legal_VAT_Compliance.md` — the agent/intermediary position; governs every word of copy
- `project/DESIGN_BRIEF.md` — brand, palette, the founder's design direction
- `project/PRICING_BRIEF.md` — if anything on the site touches price or commission

**Don't attach** `project/DECISIONS.md` (1,400 lines) or `project/BACKLOG.md` — product history, irrelevant here.

---

## 8. Founder working preferences (these apply in any project)

1. **Show a preview FIRST for any UI job.** Build a self-contained mockup, get sign-off, *then* implement.
   Do not build a finished page and present it — that was tried on 2026-08-03 and rejected wholesale.
2. **Be brief.** Report results, not narration. No "still working" messages.
3. **Ask before starting substantial work.** Confirm scope in one or two lines and wait.
4. **No dirty workarounds.** Fix the real cause; flag any shortcut so it can be accepted knowingly.
