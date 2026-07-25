-- 2026-07-25 — Option A (founder, Session 46): drop the Lock-in time gate on accept.
--
-- accept_mission previously auto-confirmed a trip ONLY when pickup was < 3h away;
-- otherwise it left the trip 'accepted' to await the Lock-in at T-180 (3h before
-- pickup). But nothing actually flips 'accepted' -> 'confirmed' at T-180 — that
-- auto-confirm needs the deferred cron/notifications phase — so a trip accepted 3h+
-- out could sit in 'accepted' limbo with NO Driver controls and only a dead-end
-- "awaiting readiness confirmation" message.
--
-- Beta decision: accept ALWAYS confirms immediately, so the Start controls are there
-- the moment a trip is the Driver's. The O7 reclaim / no-show paths still cover a
-- Driver who goes silent, so nothing depends on the (never-fired) Lock-in transition.
--
-- This is a create-or-replace of the accept_mission RPC (no table DDL) + a one-time
-- backfill so no existing trip is left in the old 'accepted' limbo.
--
-- ▶ Run this in the Supabase SQL editor (Claude's keys can't run DDL).

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

-- Backfill: clear any trip left in the old 'accepted' limbo. Idempotent.
update mission
   set status = 'confirmed',
       confirmed_at = coalesce(confirmed_at, now())
 where status = 'accepted';
