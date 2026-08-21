-- 2026-08-22 (second migration of the day) — THE FARE FREEZES AT ACCEPTANCE,
-- AND A RE-POOL NEVER RE-OPENS BELOW IT.
--
-- ⚑ APPLY 2026-08-22_pdp_curve.sql FIRST. This builds on it.
--
-- THE PROBLEM (founder, 2026-08-22). A Driver accepts a trip at 49,12 € and walks
-- at T−30h. The trip re-pools and re-opens at its floor, 36,25 €. It is now MORE
-- urgent than it was and it is being offered CHEAPER than it was a minute earlier —
-- and we are throwing away the one thing the market actually told us, which is that
-- a Driver said yes at 49,12. (Under 24h this does not bite: the re-pool turns
-- SPEED WIN on and 70 % of the Ceiling lands near where it was.)
--
-- THE RULE, decided: **a re-pool never opens below the fare the last Driver agreed
-- to.** Implemented as the smallest possible change — the re-pool RAISES the floor:
--
--     pdp_start = greatest(pdp_start, accepted_fare)
--
-- so `openingPrice()` in lib/pdp.ts needs no special case, and the SQL fee-basis
-- band follows for free (its bottom rises to the agreed fare, which is strictly
-- more protective than the floor was). `greatest` skips NULLs in Postgres, so a
-- trip that was never accepted keeps its original floor untouched.
--
-- WHAT THAT NEEDED. There was no frozen fare in the database. `settledFare()`
-- RE-COMPUTED the curve at `accepted_at` on every read, which docs/06 §9 has asked
-- us not to do since it was written ("the fare freezes at acceptance… that frozen
-- figure is the contract price"). So:
--
--   • `mission.accepted_fare numeric(10,2)` — nullable, in COURSE space like
--     `mission.ceiling`. NULL means "never accepted, or accepted before this
--     migration" and every reader falls back to recomputing, exactly as today.
--     Nothing is backfilled: founder, 2026-08-22, "no need to update prices on
--     existing trips."
--
--   • `accept_mission` gains `p_fare numeric default null`. The number is computed
--     ON THE SERVER by lib/pdp.ts inside the accept server action — the Driver's
--     browser only ever sends a mission id, so there is nothing to forge. It is
--     still clamped into [floor, ceiling] with the same expression the fee-basis
--     band uses, because a money column should not depend on a caller being
--     well-behaved. The DEFAULT is what makes this safe to apply before the code
--     deploys: the old one-argument call still works and simply stores NULL.
--
--     ⚑ The one-argument function is DROPPED first. Postgres would otherwise keep
--     both and `accept_mission(uuid)` would be an ambiguous call.
--
--   • `respond_to_amendment` sets `accepted_fare = new_fare` alongside the
--     ceiling/base_fare/pdp_start collapse it already does. Without this the frozen
--     fare would still be the PRE-amendment number and every downstream read —
--     the invoice, the cancellation basis, Earnings — would quietly bill the old one.
--
--   • The three re-pool RPCs raise the floor as above and then CLEAR
--     `accepted_fare`, because the trip has no accepted fare any more. Repeated
--     re-pools can therefore only ever raise the floor, never lower it.
--
-- NOT TOUCHED: `business_cancel_mission` and `mark_no_show` keep `accepted_fare`
-- on the row — the trip was cancelled, not re-pooled, and that frozen number is
-- exactly the basis their fee is charged against.
--
-- Additive and idempotent apart from the deliberate drop. Run in the Supabase SQL editor.

begin;

alter table mission add column if not exists accepted_fare numeric(10,2);

comment on column mission.accepted_fare is
  'docs/06 §9 — the PDP fare FROZEN at acceptance, in Course space. Written by accept_mission from a server-computed number, cleared on re-pool (after raising pdp_start to it). NULL = never accepted, or accepted before 2026-08-22: readers recompute.';

drop function if exists accept_mission(uuid);

create or replace function accept_mission(p_mission_id uuid, p_fare numeric default null)
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
         confirmed_at = now(),
         -- docs/06 §9: "the fare freezes at acceptance." Same clamp shape as the
         -- fee-basis band — the caller is trusted only as far as the mission's own
         -- columns can vouch for it. NULL stays NULL: a caller that sends nothing
         -- leaves the column empty and settledFare() recomputes, exactly as before.
         accepted_fare = case when p_fare is null then null else
           round(least(greatest(p_fare, least(coalesce(v_mission.pdp_start, v_mission.ceiling * 0.5), v_mission.ceiling)),
                       v_mission.ceiling), 2) end
   where id = p_mission_id and status = 'pooled'   -- conditional -> atomic, first wins
   returning * into v_mission;

  if not found then
    raise exception 'Mission no longer available';
  end if;

  return v_mission;
end;
$$;

create or replace function driver_cancel_mission(
  p_mission_id    uuid,
  p_reason        text    default null,
  p_fare_snapshot numeric default null
) returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_driver_id uuid := current_driver_id();
  v_mission   mission;
  v_hours     numeric;
  -- 2026-08-11 — the clamped fee basis. See the header.
  v_floor     numeric;
  v_basis     numeric(10,2);
begin
  if v_driver_id is null then raise exception 'Not a driver'; end if;

  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.driver_id is distinct from v_driver_id then
    raise exception 'Not your mission';
  end if;
  if v_mission.status not in ('accepted','confirmed','en_route','arrived') then
    raise exception 'This trip can no longer be cancelled';
  end if;

  -- Same clamp as business_cancel_mission, and here the caller is the party the 100%
  -- penalty is charged TO. As of the §6 curve the re-pool below no longer touches
  -- pdp_start, so the band describes the same floor before and after — but it is still
  -- read from v_mission, taken under the row lock, so the ordering cannot drift.
  v_floor := least(coalesce(v_mission.pdp_start, v_mission.ceiling * 0.5), v_mission.ceiling);
  v_basis := round(least(greatest(coalesce(p_fare_snapshot, 0), v_floor), v_mission.ceiling), 2);

  v_hours := extract(epoch from (v_mission.pickup_at - now())) / 3600.0;

  insert into mission_cancellation
    (mission_id, business_id, party, actor_driver_id, kind, reason,
     fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in)
  values
    (v_mission.id, v_mission.business_id, 'driver', v_driver_id, 'driver_cancel', p_reason,
     100, v_basis, v_basis, v_hours, 'repooled');

  update driver set reliability_marks = reliability_marks + 1 where id = v_driver_id;

  -- Any negotiation artifact with THIS Driver dies with the re-pool — it must not
  -- survive to the next Driver who accepts the re-pooled trip.
  update mission_amendment set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';
  update mission_release set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';

  if v_hours < 24 then
    update mission set
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
      stops_reached = 0, pooled_at = now(), speed_win = true,
      pdp_start = greatest(v_mission.pdp_start, v_mission.accepted_fare),
      accepted_fare = null
    where id = v_mission.id;
  else
    update mission set
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
      stops_reached = 0, pooled_at = now(), speed_win = false,
      pdp_start = greatest(v_mission.pdp_start, v_mission.accepted_fare),
      accepted_fare = null
    where id = v_mission.id;
  end if;

  insert into status_event (mission_id, status) values (v_mission.id, 'repooled');

  select * into v_mission from mission where id = p_mission_id;
  return v_mission;
end;
$$;

create or replace function reclaim_mission(p_mission_id uuid)
returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid := current_business_id();
  v_mission     mission;
  v_driver_id   uuid;
  v_hours       numeric;
begin
  if v_business_id is null then raise exception 'Not a dispatcher'; end if;

  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.business_id is distinct from v_business_id then
    raise exception 'Not your mission';
  end if;
  if v_mission.status <> 'accepted' or now() < v_mission.pickup_at - interval '60 minutes' then
    raise exception 'Not eligible for reclaim';
  end if;

  v_driver_id := v_mission.driver_id;
  v_hours := extract(epoch from (v_mission.pickup_at - now())) / 3600.0;

  insert into mission_cancellation
    (mission_id, business_id, party, actor_driver_id, kind, reason,
     fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in)
  values
    (v_mission.id, v_business_id, 'business', v_driver_id, 't60_reclaim',
     'Driver did not confirm within the Lock-in window',
     0, 0, null, v_hours, 'repooled');

  if v_driver_id is not null then
    update driver set reliability_marks = reliability_marks + 1 where id = v_driver_id;
  end if;

  update mission_amendment set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';
  update mission_release set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';

  if v_hours < 24 then
    update mission set
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
      stops_reached = 0, pooled_at = now(), speed_win = true,
      pdp_start = greatest(v_mission.pdp_start, v_mission.accepted_fare),
      accepted_fare = null
    where id = v_mission.id;
  else
    update mission set
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
      stops_reached = 0, pooled_at = now(), speed_win = false,
      pdp_start = greatest(v_mission.pdp_start, v_mission.accepted_fare),
      accepted_fare = null
    where id = v_mission.id;
  end if;

  insert into status_event (mission_id, status) values (v_mission.id, 'repooled');

  select * into v_mission from mission where id = p_mission_id;
  return v_mission;
end;
$$;

create or replace function respond_to_release(
  p_release_id uuid,
  p_accept     boolean,
  p_reason     text default null
) returns mission
language plpgsql security definer set search_path = public as $$
declare
  v_driver_id uuid := current_driver_id();
  v_rel       mission_release;
  v_mission   mission;
  v_mid       uuid;
  v_hours     numeric;
begin
  if v_driver_id is null then raise exception 'Not a driver'; end if;

  -- Resolve the target mission WITHOUT locking, then lock mission → release (the same
  -- order propose_release uses) so a concurrent propose-vs-respond can't deadlock.
  select mission_id into v_mid from mission_release where id = p_release_id;
  if v_mid is null then raise exception 'This release request is no longer pending'; end if;

  select * into v_mission from mission where id = v_mid for update;
  if not found or v_mission.driver_id is distinct from v_driver_id then
    raise exception 'Not your mission';
  end if;

  select * into v_rel from mission_release where id = p_release_id for update;
  if not found or v_rel.status <> 'proposed' then
    raise exception 'This release request is no longer pending';
  end if;

  if v_mission.status not in ('accepted','confirmed') then
    raise exception 'This trip can no longer be released';
  end if;

  if p_accept then
    v_hours := extract(epoch from (v_mission.pickup_at - now())) / 3600.0;

    insert into mission_cancellation
      (mission_id, business_id, party, actor_driver_id, kind, reason,
       fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in)
    values
      (v_mission.id, v_mission.business_id, 'business', v_driver_id, 'agreed_release',
       'Released by mutual agreement', 0, 0, v_rel.from_fare, v_hours, 'repooled');

    update mission_amendment set status = 'superseded', responded_at = now()
      where mission_id = v_mission.id and status = 'proposed';

    if v_hours < 24 then
      update mission set
        status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
        stops_reached = 0, pooled_at = now(), speed_win = true,
        pdp_start = greatest(v_mission.pdp_start, v_mission.accepted_fare),
        accepted_fare = null
      where id = v_mission.id;
    else
      update mission set
        status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
        stops_reached = 0, pooled_at = now(), speed_win = false,
        pdp_start = greatest(v_mission.pdp_start, v_mission.accepted_fare),
        accepted_fare = null
      where id = v_mission.id;
    end if;

    insert into status_event (mission_id, status) values (v_mission.id, 'repooled');

    update mission_release set status = 'accepted', responded_at = now()
      where id = p_release_id and status = 'proposed';
  else
    update mission_release set status = 'declined', decline_reason = p_reason, responded_at = now()
      where id = p_release_id and status = 'proposed';
  end if;

  if not found then
    raise exception 'This release request is no longer pending';
  end if;

  select * into v_mission from mission where id = v_rel.mission_id;
  return v_mission;
end;
$$;

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
      accepted_fare   = v_am.new_fare,
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

commit;
