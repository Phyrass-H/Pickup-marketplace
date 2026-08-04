-- 2026-08-03 — access_request: the landing page's "Request access" / "Apply to drive" capture.
--
-- WHY A TABLE AND NOT AN EMAIL. Resend is still a deferred integration, and a
-- `mailto:` on a landing page reads as unfinished — especially with an investor
-- audience. A row in Postgres works today, needs no third party, and keeps every
-- enquiry in one place you can triage. When notifications land, a trigger or the
-- server action can also send you a heads-up; the row stays the record.
--
-- WHY IT IS NOT SIGN-UP. A Business needs onboarding, and a Driver legally cannot
-- work until their documents are verified (Doc 01: EUR 300,000 for connecting
-- Guests with unregistered VTC drivers, and the admin verification workspace is
-- still unbuilt — BACKLOG F2). So this captures intent; a human opens the door.
--
-- Additive. Creates one new table. Touches nothing that exists.

create table if not exists public.access_request (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  -- Which door they knocked on. 'investor' is included because the unlisted
  -- investor page has its own contact form and those enquiries must not be
  -- mixed in with hotels asking for a demo.
  side         text not null check (side in ('business', 'driver', 'investor')),

  name         text not null,
  email        text not null,
  company      text,          -- hotel / company name; a Driver may leave it blank
  phone        text,
  message      text,

  -- Triage, done by hand in the Supabase table editor until the back-office exists.
  status       text not null default 'new'
               check (status in ('new', 'contacted', 'accepted', 'declined')),
  note         text,          -- internal, never shown to the person who wrote in

  -- Light abuse forensics. Deliberately NOT an IP address: this is a public,
  -- unauthenticated form, and storing IPs would make a marketing table into
  -- personal data with a retention duty for no operational gain.
  source       text           -- which page it came from, e.g. '/drivers'
);

create index if not exists access_request_created_idx
  on public.access_request (created_at desc);
create index if not exists access_request_triage_idx
  on public.access_request (status, side, created_at desc);

-- DENY BY DEFAULT, and deliberately WITHOUT any policy.
--
-- The form is public and unauthenticated, so the insert runs server-side through
-- the service role, which bypasses RLS. Granting the anon key an INSERT policy
-- instead would hand the open internet a writable table. With RLS on and no
-- policy at all, neither the anon nor the authenticated key can read or write a
-- single row — only the server action and your own Supabase dashboard can.
alter table public.access_request enable row level security;

comment on table public.access_request is
  'Landing-page enquiries (business / driver / investor). Written server-side via the service role; RLS on with no policies, so no client key can read or write it.';
