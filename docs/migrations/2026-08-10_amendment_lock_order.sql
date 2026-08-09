-- respond_to_amendment: take the locks in the house order (H2 drift audit, 2026-08-09).
--
-- THE BUG. respond_to_amendment locks mission_amendment FOR UPDATE and only then
-- locks mission FOR UPDATE (2026-07-07_mission_amendment.sql:112 then :118).
-- Every other RPC that touches both takes them the other way round -- mission
-- first, then the negotiation row: business_cancel_mission, driver_cancel_mission,
-- reclaim_mission, respond_to_release, mark_no_show and business_declare_no_show.
-- That is an AB-BA cycle, and PostgreSQL resolves it by aborting one side with
-- 40P01 after deadlock_timeout.
--
-- It is reachable, not theoretical: /missions/[id] renders the amendment card and
-- the release card on the same screen, so one Driver tapping both -- or a Business
-- tapping Cancel while the Driver taps Accept -- closes the cycle. It also leaks,
-- because app/(app)/rides/actions.ts passes any RPC message under 120 characters
-- straight through: the Driver would read the raw words "deadlock detected".
--
-- respond_to_release had exactly this inversion and was fixed on 2026-07-19; this
-- copies that shape onto the amendment side, so the two finally agree.
--
-- ONE BEHAVIOUR CHANGE, deliberate: a Driver who no longer holds the mission now
-- reads "Not your mission" where they used to read "This change is no longer
-- pending". Both strings already exist and both are Driver-readable, and
-- respond_to_release has had this precedence since 2026-07-19.
--
-- Everything else is byte-identical to the 2026-07-07 original -- the whole accept
-- branch, the fare collapse, the trailing not-found guard and the return. One
-- `create or replace function`, no DDL, no table touched, idempotent, safe to
-- re-run. Run once in the Supabase SQL editor.
--
-- PARKED, deliberately NOT fixed here: p_amendment_business_update is a USING-only
-- policy, so the owning Business can also mutate new_fare on a proposal the Driver
-- has already read. Unrelated to the lock order; needs its own RLS decision
-- (BACKLOG H2).

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
      ceiling         = v_am.new_fare,
      base_fare       = v_am.new_fare,
      pdp_start       = v_am.new_fare,
      pdp_step        = 0,
      pdp_interval    = 0,
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
