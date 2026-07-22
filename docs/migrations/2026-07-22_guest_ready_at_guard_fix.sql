-- 2026-07-22 — Make the guest_ready_at guard actually work (drop SECURITY DEFINER)
--
-- CORRECTS 2026-07-19_guest_ready_at_guard.sql, which created a trigger that never fires.
-- Verified live: a Business JWT still PATCHed guest_ready_at to 2030 and got HTTP 204.
--
-- WHY IT DIDN'T FIRE. The trigger function was declared `security definer`. Inside a
-- SECURITY DEFINER function, `current_user` is the function's OWNER — not the caller — so
-- `current_user in ('anon','authenticated')` compared against the owner every time and was
-- never true. The trigger ran on every UPDATE and allowed all of them.
--
-- THE FIX is one word: drop `security definer` so the function runs SECURITY INVOKER (the
-- default) and `current_user` is the role PostgREST switched to for the request.
--
--   browser (Business/Driver) → 'authenticated' or 'anon'  → BLOCKED
--   server key               → 'service_role'              → allowed
--   inside a SECURITY DEFINER RPC (the O7 functions) → the RPC's owner → allowed
--
-- The O7 RPCs never touch guest_ready_at, so they are unaffected either way; the allowance
-- matters for the future flight-tracking feed, which writes it via the service role.
--
-- This is the THIRD attempt at this guard. The first (a column-level REVOKE) was a no-op
-- because column privileges are only consulted when the role lacks table-level UPDATE. Both
-- failures are recorded in DECISIONS D47 and BACKLOG § H2 — read those before assuming any
-- column on `mission` is protected. `pickup_at` still is NOT (BACKLOG § H2).
--
-- Idempotent. Safe to re-run.

create or replace function mission_guard_guest_ready_at()
returns trigger
language plpgsql as $$
begin
  -- SECURITY INVOKER (default): current_user is the role PostgREST switched to.
  if new.guest_ready_at is distinct from old.guest_ready_at
     and current_user in ('anon', 'authenticated') then
    raise exception
      'guest_ready_at is set by the flight-tracking feed, not by a client'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mission_guard_guest_ready_at on mission;

create trigger trg_mission_guard_guest_ready_at
  before update on mission
  for each row
  execute function mission_guard_guest_ready_at();
