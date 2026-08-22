-- 2026-08-22 (fourth and last migration of the day) — AN AMENDMENT MUST NOT
-- OVERWRITE THE BUSINESS'S CEILING, OR COLLAPSE THE CURVE.
--
-- ⚑ APPLY THE OTHER THREE 2026-08-22 MIGRATIONS FIRST.
--
-- THE DEFECT, found by an adversarial review and confirmed on real numbers.
-- `respond_to_amendment` froze an agreed fare by COLLAPSING the PDP curve:
--
--     ceiling = base_fare = pdp_start = new_fare
--
-- That was correct when it was written — before `accepted_fare` existed, the
-- ceiling column doubled as "the fare" once a trip was taken, and setting the
-- floor equal to the ceiling was the only way to make currentFare() return the
-- agreed total. It is now actively wrong, for two compounding reasons:
--
--   1. `pdp_start = ceiling` leaves the trip with a ZERO-WIDTH band. Since the
--      §6 curve's re-pool no longer rewrites `pdp_start` (2026-08-22_pdp_curve),
--      an amended trip whose Driver later walks re-pools with no auction at all —
--      one flat price, for ever, at the Business's maximum.
--   2. `ceiling = new_fare` silently LOWERS the Business's own stated maximum.
--      Worked example: Ceiling 110,00 all-in, Driver accepts at 41,53, the
--      Business adds a stop for +30,00 → new_fare 71,53. The maximum they set
--      collapses from 110,00 to 71,53 without anyone deciding that.
--
-- THE FIX.
--   • `ceiling = greatest(ceiling, new_fare)` — an amendment can only ever RAISE
--     the maximum, never lower it. It raises it when the amended trip genuinely
--     costs more than the old maximum, which the Business consented to when they
--     proposed the change.
--   • `pdp_start` is LEFT ALONE, holding the trip's real rate-card floor, so a
--     re-pool after an amendment still has a band to auction inside.
--   • `accepted_fare = new_fare` (already set by the previous migration) is what
--     freezes the agreed total now. Nothing downstream needs the collapse:
--     `settledFare()` reads the column, and `currentFare()` is only ever rendered
--     for a trip nobody holds (the Pool card and the pre-accept detail).
--   • `pdp_step` / `pdp_interval` were being set to 0 to flatten the old ladder.
--     They are dead columns; set NULL like everywhere else.
--
-- WHAT THIS COSTS, stated plainly: if an amended trip's Driver walks, the trip
-- re-auctions up towards the Business's original maximum rather than sitting at
-- the amended total. The Business can therefore end up paying more than the
-- figure they agreed with THAT Driver — but never more than the maximum they set
-- themselves, which is exactly the deal on every other trip. Founder's call,
-- 2026-08-22 ([[d81]]).
--
-- Reproduced verbatim from its live definition in 2026-08-22_accepted_fare.sql
-- with only the write block above changed. Idempotent. Run in the SQL editor.

begin;

create or replace function respond_to_amendment(
  p_amendment_id uuid,
  p_accept       boolean,
  p_reason       text default null
) returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_driver_id uuid := current_driver_id();
  v_am        mission_amendment;
  v_mission   mission;
  v_mid       uuid;
begin
  if v_driver_id is null then
    raise exception 'Not a driver';
  end if;

  -- Resolve the target mission WITHOUT locking, then take the locks in the order
  -- every other RPC uses -- mission, then the negotiation row -- so a concurrent
  -- cancel / release / no-show cannot deadlock against this one.
  select mission_id into v_mid from mission_amendment where id = p_amendment_id;
  if v_mid is null then
    raise exception 'This change is no longer pending';
  end if;

  -- Lock the mission; must be THIS Driver's.
  select * into v_mission from mission where id = v_mid for update;
  if not found or v_mission.driver_id is distinct from v_driver_id then
    raise exception 'Not your mission';
  end if;

  -- Now lock the amendment; must still be pending (serialises concurrent
  -- responses) AND must still point at the mission we just locked. That second
  -- test is what makes the unlocked read above safe: p_amendment_business_update
  -- is a USING-only client UPDATE policy with no WITH CHECK and no column
  -- restriction, so the owning Business can PATCH mission_id via PostgREST. If it
  -- moved between the read and the lock we abort, rather than apply the change to
  -- one mission and record it against another.
  select * into v_am from mission_amendment where id = p_amendment_id for update;
  if not found or v_am.status <> 'proposed' or v_am.mission_id is distinct from v_mid then
    raise exception 'This change is no longer pending';
  end if;

  -- Still amendable (pre-execution) -- the same slot respond_to_release uses.
  if v_mission.status not in ('accepted','confirmed') then
    raise exception 'This trip can no longer be changed';
  end if;

  if p_accept then
    -- Apply the NEW terms. The fare is frozen at new_fare by collapsing the PDP
    -- curve (start = ceiling = new_fare, flat step/interval, no SPEED WIN) so
    -- currentFare() reads exactly the agreed total. stops_reached resets (the trip
    -- hasn't started — status is accepted/confirmed).
    update mission set
      pickup_address  = v_am.new_pickup_address,
      pickup_lat      = v_am.new_pickup_lat,
      pickup_lng      = v_am.new_pickup_lng,
      pickup_label    = v_am.new_pickup_label,
      dropoff_address = v_am.new_dropoff_address,
      dropoff_lat     = v_am.new_dropoff_lat,
      dropoff_lng     = v_am.new_dropoff_lng,
      dropoff_label   = v_am.new_dropoff_label,
      waypoints       = v_am.new_waypoints,
      distance_km     = v_am.new_distance_km,
      duration_min    = v_am.new_duration_min,
      stops_reached   = 0,
      -- ⚑ THE CEILING IS THE BUSINESS'S OWN MAXIMUM AND AN AMENDMENT MUST NOT
      -- LOWER IT. It used to be overwritten with the agreed total, because before
      -- `accepted_fare` existed the ceiling doubled as "the fare" once a trip was
      -- taken. It no longer does. `greatest` still lets an amendment that costs
      -- MORE than the old maximum raise it — the Business consented to that total
      -- when they proposed the change.
      ceiling         = greatest(v_mission.ceiling, v_am.new_fare),
      base_fare       = v_am.new_fare,
      -- The agreed total, frozen. This is what every downstream read bills, so
      -- collapsing the curve to freeze it is no longer necessary — and `pdp_start`
      -- is deliberately LEFT ALONE, holding the trip's real floor, so that a
      -- re-pool after an amendment still has a band to auction inside.
      accepted_fare   = v_am.new_fare,
      pdp_step        = null,
      pdp_interval    = null,
      speed_win       = false
    where id = v_mission.id;

    update mission_amendment
      set status = 'accepted', responded_at = now()
      where id = p_amendment_id and status = 'proposed';
  else
    update mission_amendment
      set status = 'declined', decline_reason = p_reason, responded_at = now()
      where id = p_amendment_id and status = 'proposed';
  end if;

  -- Someone else already resolved it between our lock and update → abort clean.
  if not found then
    raise exception 'This change is no longer pending';
  end if;

  select * into v_mission from mission where id = v_mid;
  return v_mission;
end;
$$;

commit;
