-- 2026-07-31 — Expired / unfilled trips: the missing protocol (BACKLOG § P)
--
-- THE BUG. The `expired` status has existed in the enum since day one and
-- `missionTone` already renders it ("Expired · Was not filled in time"), but
-- NOTHING has ever written it — no job, no trigger, no sweep. The Pool query had
-- no lower bound on pickup_at either, so an unfilled trip sat in the Pool for
-- ever. Measured on the live DB the day this was written: 23 of 23 pooled
-- missions had a pickup in the past, the oldest 44 days ago.
--
-- ⚑ THE SHARP EDGE — this is a money bug, not clutter. accept_mission checked
-- `status = 'pooled'` and NOT the time, so a Driver could accept a six-week-dead
-- booking and create a live, confirmed, priced obligation on a Business that had
-- long since made other arrangements.
--
-- FOUNDER DECISIONS (2026-07-31):
--   1. A trip expires EXACTLY at pickup_at. No grace period — a trip still
--      unfilled at T-0 is already a failure, and the PDP climb hit the ceiling
--      long before then.
--   2. An expired trip STAYS on the Dispatch schedule until the day ends, then
--      falls into the "Earlier trips" fold. That needs no query change: the
--      schedule already pins today's group and folds past days by Paris day key.
--   3. NO re-post for now. (It could never have been a re-time anyway — the D48
--      trigger freezes pickup_at once a trip leaves 'draft', so "post it again"
--      would have to duplicate into a new mission. Deferred.)
--
-- WHY THERE IS NO CRON. The sweep runs as a lazy, idempotent RPC called on the
-- Pool and Dispatch schedule reads. Vercel's Hobby plan caps cron at once per
-- DAY, which is useless for a T-0 rule, and the D61 T-180 reminder job needs a
-- real scheduler anyway — so that decision is deferred to the notifications
-- phase rather than half-made here. At beta volume a page read doing one
-- targeted UPDATE that normally matches zero rows costs nothing.
--
-- ⚠️ The D48 pickup_at freeze trigger is UNAFFECTED: the sweep writes `status`
-- only, and the trigger fires solely when pickup_at itself changes.
--
-- ▶ Run this in the Supabase SQL editor (Claude's keys can't run DDL).

-- ---------------------------------------------------------------------------
-- 1. Let the timeline record an expiry.
--    The Driver's direct-insert policy (O7) is deliberately NOT widened —
--    'expired' is written by the SECURITY DEFINER sweep, never by a client.
-- ---------------------------------------------------------------------------
alter table status_event drop constraint if exists status_event_status_check;
alter table status_event add  constraint status_event_status_check
  check (status in ('en_route','arrived','on_board','completed','cancelled','no_show','repooled','expired'));

-- ---------------------------------------------------------------------------
-- 2. The guard: accept_mission refuses a trip whose pickup has passed.
--    Create-or-replace of the D55 version (Option A, accept always confirms) —
--    the ONLY change is the new time check. Everything else is byte-identical.
--
--    It raises rather than expiring the row inline, because `raise` rolls the
--    transaction back — the flip to 'expired' would be undone with it. The sweep
--    below owns that write.
-- ---------------------------------------------------------------------------
create or replace function accept_mission(p_mission_id uuid)
returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_driver_id uuid := current_driver_id();
  v_mission   mission;
begin
  if v_driver_id is null then
    raise exception 'Not a driver';
  end if;

  -- lock the row; must still be pooled
  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.status <> 'pooled' then
    raise exception 'Mission no longer available';
  end if;

  -- § P: a dead booking can never become a live obligation. Checked under the
  -- same row lock as the status, so it can't be raced by the sweep.
  if v_mission.pickup_at <= now() then
    raise exception 'Mission has expired';
  end if;

  -- slot-conflict: block another active mission within +/-90 min of this pickup.
  -- NOTE: crude time buffer for now; refine once we store an estimated trip duration.
  if exists (
    select 1 from mission m
    where m.driver_id = v_driver_id
      and m.status in ('accepted','confirmed','en_route','arrived','on_board')
      and m.pickup_at between v_mission.pickup_at - interval '90 minutes'
                          and v_mission.pickup_at + interval '90 minutes'
  ) then
    raise exception 'Slot conflict with another mission';
  end if;

  -- Option A: accept confirms immediately — no Lock-in time gate (was: pickup <3h
  -- away -> 'confirmed', else 'accepted').
  update mission
     set driver_id    = v_driver_id,
         status       = 'confirmed',
         accepted_at  = now(),
         confirmed_at = now()
   where id = p_mission_id and status = 'pooled'   -- conditional -> atomic, first wins
   returning * into v_mission;

  if not found then
    raise exception 'Mission no longer available';
  end if;

  return v_mission;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The sweep: pooled + past due -> expired. Idempotent, safe to call on every
--    page read, and returns how many it closed so a caller can log it.
--
--    Only 'pooled' is touched. A trip with a Driver on it is somebody's problem,
--    not an unfilled one — the O7 cancel / release / no-show paths own those, and
--    this must never disturb them.
-- ---------------------------------------------------------------------------
create or replace function expire_stale_missions()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  -- One statement: sweep and log together, so a row can never be expired
  -- without its timeline entry (or vice versa) if this is interrupted.
  with swept as (
    update mission
       set status = 'expired'
     where status = 'pooled'
       and pickup_at <= now()
    returning id
  ), logged as (
    insert into status_event (mission_id, status)
    select id, 'expired' from swept
    returning 1
  )
  select count(*) into v_count from logged;

  return coalesce(v_count, 0);
end;
$$;
