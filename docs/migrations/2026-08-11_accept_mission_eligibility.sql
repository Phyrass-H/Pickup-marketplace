-- 2026-08-11 — accept_mission enforces the Pool's matching rules (§ B drift audit)
--
-- THE GAP. The Pool page decides what a Driver SEES (app/(app)/pool/page.tsx:94-125:
-- category equality, service radius, luggage consent, required body, required car).
-- accept_mission decided only what a Driver could TAKE, and it checks exactly four
-- things — driver identity, status, pickup_at, slot conflict
-- (2026-07-31_expired_missions.sql:63-89). The word "vehicle" does not appear in it.
-- RLS lets any Driver SELECT every pooled mission (docs/kavenue_schema.sql:310-313),
-- so the ids are free, and the RPC is reachable with a Driver JWT. A TypeScript check
-- inside a Next.js server action is not a gate against that actor. This is.
-- Already logged as known: project/BACKLOG.md:327-329.
--
-- accept_mission is the only door: the sole UPDATE policy on mission is
-- p_mission_business_update (docs/kavenue_schema.sql:320-322), business-scoped, so
-- mission.driver_id cannot be PATCHed around this function.
--
-- WHAT THIS IS AND IS NOT. It makes an accept consistent with the Driver's DECLARED
-- vehicle. It does NOT verify the declaration: app/(app)/settings/actions.ts:115-163
-- lets any signed-in Driver re-type make/model and flip body_type, written with the
-- SERVICE ROLE (:117, :158-159), with no `verified` gate
-- (app/(app)/settings/vehicle/page.tsx:21). So this turns an invisible per-request
-- mismatch into a public, attributable, persistent re-declaration. That is the whole
-- claim — do not oversell it.
--
-- WHAT IS ENFORCED HERE — and what deliberately is not:
--   ENFORCED · tier (mission.category = vehicle.category) and required_body_type.
--     One enum comparison each, and category is derived from make+model by
--     lib/vehicle-catalog.ts categorize() rather than self-selected
--     (app/(app)/settings/actions.ts:140).
--   ENFORCED · luggage_only implies driver.accepts_luggage_runs. The Driver's own
--     opt-in, free to check.
--   NOT ENFORCED · the service radius. A great-circle test against
--     driver.base_lat/base_lng/service_radius_km (lib/geo.ts:36-45). Three reasons:
--     241 of 271 live missions have pickup_lat IS NULL and withinRadius() returns
--     false for those (lib/geo.ts:43), so a faithful port would refuse ~89% of the
--     Pool; 6 of 9 Drivers have base_lat NULL and the app answers that with a setup
--     screen (pool/page.tsx:52-74), which a `raise` cannot do; and service_radius_km
--     is a preference the Driver edits in /settings (settings/actions.ts:99-108), so
--     it can never be an entitlement anyone is defended against.
--   NOT ENFORCED · required_make / required_model. carMatches
--     (lib/vehicle-catalog.ts:235-249) needs NFD normalisation, a 14-brand/40-alias
--     resolver, ~70 model rows and a prefix rule that only accepts a numeric
--     remainder. In plpgsql that is a THIRD copy of a matching rule, exercised by 9
--     of 271 missions — a wrong port would be invisible in testing.
--   NOT ENFORCED · operational_zones. Abandoned at
--     2026-06-17_driver_service_area.sql:20-23 and unimplementable on live data
--     (mission.zone is the first comma-segment of the pickup address; the Driver
--     column holds town names).
--
-- NO BYPASS COLUMN, ON PURPOSE. An earlier draft added driver.pool_bypass_until so
-- the demo Driver could still accept what /pool?all=1 lists. Unnecessary and harmful:
-- (a) /settings/vehicle re-declares the demo car in ten seconds
--     (app/(app)/settings/actions.ts:115-163), and (b) app/api/dev-login/route.ts:37-39
-- accepts ?email=, and ensureUser (:63-83) resets the password on an existing auth
-- user — so the six seeded Drivers from .local/seed/seed-fleet.mjs:46-53 (business
-- sedan ×2, business van + luggage ×2, eco sedan, luxury sedan) are already
-- sign-in-able, one per tier/body. A permanent security-relevant column in the shared
-- production DB was being bought for a demo that two shipped paths already serve.
--
-- TODO (vehicle.is_active). The exists() below matches ANY of the Driver's vehicles
-- and ignores is_active, because lib/driver.ts:29-37 ignores it too — that symmetry is
-- what makes this guard a strict SUPERSET of the app filter, so drift can only ever
-- hide a trip, never refuse one the Pool offered. If someone implements "pause this
-- car" (lib/database.types.ts:256), add `and v.is_active` to BOTH sides in the same
-- commit or the superset guarantee is gone.
--
-- The body below is 2026-07-31_expired_missions.sql:56-107 verbatim with ONE extra
-- declare and ONE guard block added. I diffed it: the § P expiry check, the ±90-minute
-- slot window and the atomic first-wins UPDATE are byte-identical. Idempotent.
--
-- ▶ Run this in the Supabase SQL editor (Claude's keys can't run DDL).

create or replace function accept_mission(p_mission_id uuid)
returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_driver_id uuid := current_driver_id();
  v_driver    driver;
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

  -- § B: the Pool's matching rules, enforced where they cannot be skipped.
  -- Read AFTER the mission lock, to keep the house lock order (mission first).
  -- No FOR UPDATE on driver — this takes no lock and cannot join a deadlock cycle.
  select * into v_driver from driver where id = v_driver_id;
  if not exists (
       select 1 from vehicle v
        where v.driver_id = v_driver_id
          and v.category  = v_mission.category
          and (v_mission.required_body_type is null
               or v_mission.required_body_type = v.body_type)
     )
     or (v_mission.luggage_only
         and not coalesce(v_driver.accepts_luggage_runs, false))
  then
    raise exception 'Not eligible for this mission';
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
