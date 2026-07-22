-- 2026-07-19 — Guard guest_ready_at against client writes (supersedes an ineffective REVOKE)
--
-- CORRECTS 2026-07-19_no_show_airport_label.sql, which contained:
--     revoke update (guest_ready_at) on mission from anon, authenticated;
-- That statement is a NO-OP and the file's claim of protection was wrong. Verified live: a
-- Business JWT still PATCHed guest_ready_at to 2030 and got HTTP 204.
--
-- WHY THE REVOKE DID NOTHING. Postgres consults column-level privileges only when the role
-- LACKS table-level privilege. `authenticated` holds table-wide UPDATE on mission (via
-- policy p_mission_business_update), so revoking one column changes nothing. The
-- privilege-based fix is `revoke update on mission from authenticated` + a `grant update
-- (…)` naming every legitimate column — which needs a full audit of the Business write
-- paths (BACKLOG H2) and risks breaking mission editing if a column is missed.
--
-- THIS is the surgical alternative: a row trigger that rejects a change to this ONE column
-- when the caller is a browser role. No privilege changes, nothing else can break.
--
-- WHY IT MATTERS. guest_ready_at is an input to a money gate: mark_no_show() measures the
-- free wait from coalesce(guest_ready_at, pickup_at). A Business that could push it into
-- the future would hold the no-show gate shut forever, leaving the assigned Driver only the
-- 100%-fee cancel. It is written by the flight-tracking feed (service role) — never by a
-- client. Today it is always NULL; this closes the hole before that feed exists.
--
-- NOT COVERED (deliberate, see BACKLOG H2): pickup_at has the same exposure and also feeds
-- business_cancel_mission's fee tier, but it has a LEGITIMATE client writer (draft resume
-- rewrites it), so it needs a status-aware rule, not a blanket block.
--
-- Idempotent. Safe to re-run.

create or replace function mission_guard_guest_ready_at()
returns trigger
language plpgsql
security definer set search_path = public as $$
begin
  -- current_user is the ROLE PostgREST switched to: 'anon' / 'authenticated' for a browser,
  -- 'service_role' for the server key, and the function owner inside SECURITY DEFINER RPCs.
  -- So the O7 RPCs and the future tracking feed pass; a client PATCH does not.
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
