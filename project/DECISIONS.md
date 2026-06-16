# PickUp — Decision Log

> Every non-trivial choice, why it was made, and when. Append-only; supersede rather
> than delete (note "superseded by Dn"). Decisions about *scope/legal/glossary* defer to
> the spec docs; this log captures *build/implementation* decisions.

---

### D1 — PWA-first for the Driver app (2026-06-16)
Per Doc 03. No native build for V1; revisit only when background GPS/push truly needs it.

### D2 — Driver sign-in via Supabase Auth email (OTP / magic-link) (2026-06-16)
Spec says "email". Chose passwordless OTP/magic-link over password (no password storage,
matches Supabase-native auth). Revisit if a password flow is preferred.

### D3 — Hand-write `database.types.ts` from `pickup_schema.sql` (2026-06-16)
Can't run `supabase gen types` without DB/CLI credentials wired in this environment, and
the schema file is the source of truth and already applied. Hand-write types to match it.
If the Supabase CLI gets wired up later, regenerate to confirm parity.

### D4 — Use the modern Supabase key system as active keys (2026-06-16)
`sb_publishable_` (browser) + `sb_secret_` (server) are active in `.env.local`. Legacy JWT
`anon`/`service_role` kept as commented fallbacks in case a library expects JWT-form keys.

### D5 — Session-continuity docs live in `project/` (2026-06-16)
`STATUS.md` (resume point), `SESSION_LOG.md` (history), `DECISIONS.md` (this), `IDEAS.md`
(backlog). `CLAUDE.md` points new sessions here. Chosen over scattering notes so a fresh
session can resume from one place.

---

## Open decisions inherited from the spec (not ours to close — track only)
From Doc 05 / Data Spine — values, not structure; don't let them block the build:
- Commission split exact numbers (~12.5% Business / ~10% Driver, teaser).
- Commission carved-out vs added-on.
- Charge timing: auth-at-booking vs capture-at-completion.
- Cancellation %s (Business compensation tiers, Driver penalty cap).
- Hard-floor field (floor-vs-benchmark).
- Fare extras (waiting, tolls, airport fee, hourly overtime).
- Final name for "SPEED WIN" (candidates: Rush, Fast Track).
