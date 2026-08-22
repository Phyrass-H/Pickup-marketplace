-- 2026-08-22 (fifth, and the last of the day) — A RE-POOL CHANGES NOTHING ABOUT
-- THE PRICE EXCEPT THAT TIME HAS PASSED.
--
-- ⚑ APPLY THE OTHER FOUR 2026-08-22 MIGRATIONS FIRST. Their filenames share a
-- date and do NOT sort into apply order — this one is named `…22e_…` precisely so
-- that it does. The real order today was:
--     1. 2026-08-22_pdp_curve.sql
--     2. 2026-08-22_accepted_fare.sql
--     3. 2026-08-22_opening_price_band.sql
--     4. 2026-08-22_amendment_keeps_ceiling.sql
--     5. this file
-- Getting that wrong points you at the wrong "live" definition of a function. It
-- caught me once while writing this migration; the functions below are taken from
-- (3) for driver_cancel_mission and (2) for the other two.
--
-- WHAT CHANGES. The three re-pool RPCs stop touching the price entirely. Both
-- removals came out of the same principle, from two directions on the same day:
--
--   • THE FLOOR RAISE (`pdp_start = greatest(pdp_start, accepted_fare)`) GOES.
--     It was [[d80]]'s mechanism, and [[d81]] replaced the rule it implemented
--     with a better one: the curve runs to the pickup and never restarts, so a
--     re-pooled trip is already worth at least what the last Driver agreed to,
--     for free. Keeping the raise on top made a re-pooled trip permanently
--     DEARER than an untouched one — 52,70 € against 43,37 € at the same instant
--     on a live probe. That is the history-dependence [[d81]] exists to remove.
--     Found by .local/probe/accepted-fare.ts, not by a person.
--
--   • THE SPEED WIN FLIP GOES. §6 said a re-pool turns SPEED WIN on under 24h and
--     off at 24h+. That rule was written when a re-pool RESTARTED the climb at 50 %
--     of the Ceiling and needed a boost to fill. There is no restart any more. And
--     SPEED WIN raises where the curve OPENS, so its effect shrinks as the pickup
--     nears — on a 110 € Ceiling it is worth +33 % at T−48h, +7 % at T−12h, +0 % at
--     T−5h. Switching it on BECAUSE a trip became urgent does least exactly when it
--     is needed most. It is also the Business's own checkbox and their own money:
--     Kavenue moving it unasked is Kavenue nudging the fare, which docs/01 and
--     docs/06 §0 are explicit about not doing. `speed_win` is now only ever what
--     the Business set. Founder's call, 2026-08-22 ([[d82]]).
--
-- With no flip there is nothing left to branch on, so the `if v_hours < 24` split
-- collapses into a single UPDATE in each function. `v_hours` is still computed and
-- still recorded on the cancellation row — only the branch is gone.
--
-- STILL CLEARED on re-pool: `accepted_fare`. Nobody holds the trip any more.
-- STILL STAMPED: `pooled_at` — it is no longer a pricing input (lib/pdp.ts stopped
-- reading it) but it is still the Business's "time to fill" metric (lib/spend.ts).
--
-- Reproduced verbatim from the live definitions with only that block replaced.
-- Idempotent. Run in the Supabase SQL editor.

begin;

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
  v_floor := mission_opening_price(v_mission);
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

  -- A RE-POOL CHANGES NOTHING ABOUT THE PRICE EXCEPT THAT TIME HAS PASSED
  -- (founder, 2026-08-22, [[d82]]). It used to do three things here; it now does none:
  --   * RESTART the climb -- removed 2026-08-22 ([[d81]]): the curve runs to the
  --     pickup, so a trip dropped two days out simply reads the two-days-out price.
  --   * RAISE the opening price to the fare the last Driver agreed to -- removed
  --     here. It made a re-pooled trip permanently DEARER than one nobody had
  --     touched (52,70 against 43,37 on a live probe), which is exactly the
  --     history-dependence [[d81]] exists to remove.
  --   * FLIP SPEED WIN on under 24h -- removed here too. SPEED WIN raises where the
  --     curve OPENS, so its effect SHRINKS as the pickup nears: measured on a
  --     110 EUR Ceiling it is worth +33% at T-48h, +7% at T-12h and +0% at T-5h.
  --     Switching it on BECAUSE a trip became urgent does least exactly when it is
  --     needed most. It is also the Business's own checkbox and their money, and
  --     Kavenue moving it unasked is Kavenue nudging the fare (docs/01, docs/06 s0).
  --     It is now only ever what the Business set.
  -- With no flip there is nothing left to branch on, so the two branches collapse.
  -- The frozen fare is still cleared: nobody holds this trip any more.
  update mission set
    status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
    stops_reached = 0, pooled_at = now(), accepted_fare = null
  where id = v_mission.id;

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

  -- A RE-POOL CHANGES NOTHING ABOUT THE PRICE EXCEPT THAT TIME HAS PASSED
  -- (founder, 2026-08-22, [[d82]]). It used to do three things here; it now does none:
  --   * RESTART the climb -- removed 2026-08-22 ([[d81]]): the curve runs to the
  --     pickup, so a trip dropped two days out simply reads the two-days-out price.
  --   * RAISE the opening price to the fare the last Driver agreed to -- removed
  --     here. It made a re-pooled trip permanently DEARER than one nobody had
  --     touched (52,70 against 43,37 on a live probe), which is exactly the
  --     history-dependence [[d81]] exists to remove.
  --   * FLIP SPEED WIN on under 24h -- removed here too. SPEED WIN raises where the
  --     curve OPENS, so its effect SHRINKS as the pickup nears: measured on a
  --     110 EUR Ceiling it is worth +33% at T-48h, +7% at T-12h and +0% at T-5h.
  --     Switching it on BECAUSE a trip became urgent does least exactly when it is
  --     needed most. It is also the Business's own checkbox and their money, and
  --     Kavenue moving it unasked is Kavenue nudging the fare (docs/01, docs/06 s0).
  --     It is now only ever what the Business set.
  -- With no flip there is nothing left to branch on, so the two branches collapse.
  -- The frozen fare is still cleared: nobody holds this trip any more.
  update mission set
    status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
    stops_reached = 0, pooled_at = now(), accepted_fare = null
  where id = v_mission.id;

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

    -- A RE-POOL CHANGES NOTHING ABOUT THE PRICE EXCEPT THAT TIME HAS PASSED
    -- (founder, 2026-08-22, [[d82]]). It used to do three things here; it now does none:
    --   * RESTART the climb -- removed 2026-08-22 ([[d81]]): the curve runs to the
    --     pickup, so a trip dropped two days out simply reads the two-days-out price.
    --   * RAISE the opening price to the fare the last Driver agreed to -- removed
    --     here. It made a re-pooled trip permanently DEARER than one nobody had
    --     touched (52,70 against 43,37 on a live probe), which is exactly the
    --     history-dependence [[d81]] exists to remove.
    --   * FLIP SPEED WIN on under 24h -- removed here too. SPEED WIN raises where the
    --     curve OPENS, so its effect SHRINKS as the pickup nears: measured on a
    --     110 EUR Ceiling it is worth +33% at T-48h, +7% at T-12h and +0% at T-5h.
    --     Switching it on BECAUSE a trip became urgent does least exactly when it is
    --     needed most. It is also the Business's own checkbox and their money, and
    --     Kavenue moving it unasked is Kavenue nudging the fare (docs/01, docs/06 s0).
    --     It is now only ever what the Business set.
    -- With no flip there is nothing left to branch on, so the two branches collapse.
    -- The frozen fare is still cleared: nobody holds this trip any more.
    update mission set
      status = 'pooled', driver_id = null, accepted_at = null, confirmed_at = null, checked_in_at = null,
      stops_reached = 0, pooled_at = now(), accepted_fare = null
    where id = v_mission.id;

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

commit;
