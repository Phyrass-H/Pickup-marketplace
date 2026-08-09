-- ONE LIVE ASK PER MISSION (§ C drift audit, 2026-08-10).
--
-- THE BUG. A Business can have a pending mission_amendment and a pending
-- mission_release on the SAME trip at once. propose_release supersedes prior
-- RELEASES only (2026-07-19_agreed_release.sql:106-107); the amendment insert path
-- supersedes prior AMENDMENTS only, and only in TypeScript
-- (app/(dispatch)/dispatch/[id]/amend/actions.ts:100-105). Neither touches the other
-- table, and the two creation paths commute, so both cards render on one Driver
-- screen (app/(app)/missions/[id]/page.tsx:158-164 -> components/mission-run-view.tsx
-- :210-211) and the Driver's ANSWER ORDER decides the money:
--   * release first   -> respond_to_release supersedes the amendment
--     (2026-08-10_repool_clears_check_in.sql:210-211) and the trip re-pools off its
--     original ceiling. Safe.
--   * amendment first -> respond_to_amendment permanently sets
--     ceiling = base_fare = pdp_start = new_fare
--     (2026-08-10_amendment_lock_order.sql:100-102), and the release then re-pools
--     off the RAISED ceiling (pdp_start = 0.7 * ceiling,
--     2026-08-10_repool_clears_check_in.sql:217-219). A trip the Business is giving
--     away FREE goes back to the Pool at a price agreed with a Driver who has just
--     left, and the settled mission_cancellation row records v_rel.from_fare
--     (:208) -- the PRE-amendment fare -- so the audit row and the mission disagree
--     about what the trip was worth. In beta a human settles from those rows.
--
-- Two contradictory asks on one screen ("drive this instead" / "hand it back") is
-- a consent defect on its own terms: the Business cannot say which it means, and
-- the Driver cannot know that answering them in the other order is worth money.
--
-- THE RULE. One live ask per mission, in BOTH directions and across BOTH tables:
-- the last thing the Business asked for is the only thing the Driver is asked to
-- answer. This is not new vocabulary -- it is the rule propose_release already
-- applies inside its own table ("one live card at a time",
-- 2026-07-19_agreed_release.sql:80), generalised from per-table to per-mission, and
-- it is the rule every re-pool path already applies to both tables at once
-- (driver_cancel_mission, reclaim_mission, 2026-08-10_repool_clears_check_in.sql
-- :72-75 and :136-139). Superseded rows are RETAINED, as always: the evidence trail
-- stays append-only and a burst of superseded rows is itself the pressure signal
-- (2026-07-19_agreed_release.sql:12-23).
--
-- 1. propose_release also supersedes a pending amendment. Byte-identical to
--    2026-07-19_agreed_release.sql:84-118 -- its ONLY definition, nothing later
--    redefines it -- except for the one added update.
-- 2. The other direction is a TRIGGER, not a line of TypeScript, because the
--    amendment is a client INSERT under p_amendment_business_insert
--    (2026-07-07_mission_amendment.sql:70-74) rather than an RPC, and
--    mission_release has no client write policy by design
--    (2026-07-19_agreed_release.sql:63-67). A trigger is transactional with the
--    insert and binds a direct PostgREST call; a TypeScript call would be neither.
--    The trigger supersedes prior AMENDMENTS too. The same "transactional, and it
--    binds a direct insert" argument applies identically to that half, which today
--    lives only in TypeScript at amend/actions.ts:100-105 -- and two 'proposed'
--    amendments on one mission is not hypothetical harm: app/(app)/missions/[id]/
--    page.tsx:137-142 reads them with .maybeSingle(), so the Driver's card silently
--    vanishes while the Business schedule still shows "Change pending". In a BEFORE
--    INSERT the new row is not in the heap yet, so no self-exclusion is needed.
--    The TypeScript supersede is left in place deliberately (see the migration
--    ordering note in the plan): it becomes redundant, not wrong.
--
-- LOCK ORDER (load-bearing, per 2026-08-10_amendment_lock_order.sql): the trigger
-- is BEFORE INSERT and takes `mission FOR UPDATE` first, so no mission_amendment row
-- is held when the mission lock is acquired -- mission, then the negotiation rows,
-- the house order, with no inversion even nominally. The lock is what closes the
-- race: without it, a propose_release and an amendment insert in two concurrent
-- transactions each supersede a row the other cannot yet see, and both asks end up
-- live anyway. (Under READ COMMITTED each SPI statement inside the trigger takes a
-- fresh snapshot after the lock is granted, so the updates below DO see a release
-- committed while the trigger was blocked -- verification step 7 proves it.)
--
-- ON INSERT ONLY, deliberately. p_amendment_business_update is USING-only with no
-- WITH CHECK, so a Business can PATCH a superseded amendment back to 'proposed'
-- (parked as BACKLOG H2 at 2026-08-10_amendment_lock_order.sql:33). Firing on UPDATE
-- too would mean holding an EXISTING amendment row lock and then asking for the
-- mission lock -- the exact AB-BA inversion against respond_to_amendment (mission at
-- :60, amendment at :72) that the 2026-08-10 migration was written to eliminate.
-- A SECOND VARIANT of the same hole, named so nobody thinks INSERT coverage is
-- total: p_amendment_business_insert (2026-07-07_mission_amendment.sql:71-74)
-- constrains business_id and mission_id but NOT status, so a Business can insert
-- with status='declined' (the WHEN clause below does not fire) and then PATCH it to
-- 'proposed'. Dropping the WHEN clause would not close that -- it is the same UPDATE
-- hole -- and would make an ordinary declined insert retire a live release for no
-- reason. Closing H2 is an RLS decision, not a trigger.
--
-- NOT CHANGED, deliberately: respond_to_amendment. Superseding a release because the
-- DRIVER answered an unrelated change would write an event on the evidence table
-- that the Business never asked for. With both PROPOSE sides closed there is nothing
-- left for it to supersede. Note this also makes 2026-08-10_repool_clears_check_in
-- .sql:210-211 (respond_to_release superseding a pending amendment) unreachable in
-- practice; it stays as a belt-and-braces guard against the H2 UPDATE hole.
--
-- NOT CLOSED, honestly: (i) an amendment ACCEPTED and a release proposed LATER still
-- re-pools off the amended ceiling -- same mission, new ROUTE, so the new ceiling is
-- the trip's real price; changing that is a founder ruling needing an
-- original_ceiling column. (ii) The propose-vs-accept RACE still yields a stale
-- fare_snapshot: p_from_fare is computed client-side at dispatch/actions.ts:116
-- before this function takes its lock at :98, so an amendment accepted in that
-- window leaves from_fare pre-amendment while the mission's money columns say
-- new_fare. No SQL can fix it -- there is no PDP fare function in Postgres.
--
-- Additive and idempotent: one create-or-replace RPC, one trigger function, one
-- trigger. No table altered, no row rewritten, no data repair needed
-- (mission_release currently has 0 rows). Safe to re-run. Run once in the Supabase
-- SQL editor.

-- ---------------------------------------------------------------------------
-- 1. A release request replaces a pending change request.
-- ---------------------------------------------------------------------------
create or replace function propose_release(
  p_mission_id  uuid,
  p_note        text    default null,
  p_from_fare   numeric default null,
  p_proposed_by uuid    default null
) returns mission_release
language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid := current_business_id();
  v_mission     mission;
  v_release     mission_release;
begin
  if v_business_id is null then raise exception 'Not a dispatcher'; end if;

  select * into v_mission from mission where id = p_mission_id for update;
  if not found or v_mission.business_id is distinct from v_business_id then
    raise exception 'Not your mission';
  end if;
  if v_mission.status not in ('accepted','confirmed') or v_mission.driver_id is null then
    raise exception 'This trip can no longer be released';
  end if;

  update mission_release set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';

  -- ONE LIVE ASK: a release request also retires a pending CHANGE request, so the
  -- Driver is never holding two contradictory asks whose answer order moves money.
  update mission_amendment set status = 'superseded', responded_at = now()
    where mission_id = v_mission.id and status = 'proposed';

  insert into mission_release
    (mission_id, business_id, driver_id, proposed_by, status, note, from_fare, hours_before_pickup)
  values
    (v_mission.id, v_business_id, v_mission.driver_id, p_proposed_by, 'proposed', p_note, p_from_fare,
     extract(epoch from (v_mission.pickup_at - now())) / 3600.0)
  returning * into v_release;

  return v_release;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. A change request replaces a pending release request (and a pending change).
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because mission_release deliberately has no client write
-- policy. The blast radius is one mission: it only ever touches rows for
-- new.mission_id, and the INSERT that fires it is itself RLS-checked against
-- p_amendment_business_insert (business_id = current_business_id() AND the mission
-- is that Business's). A forged insert aimed at someone else's mission fails that
-- WITH CHECK and rolls the whole statement back, supersedes included.
create or replace function amendment_replaces_release()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Mission first, then the negotiation rows -- the house lock order. BEFORE INSERT,
  -- so nothing of ours is locked yet. This serialises against propose_release,
  -- which holds the same mission lock across its own supersedes.
  perform 1 from mission where id = new.mission_id for update;

  -- The row being inserted is not in the heap yet, so this cannot hit it.
  update mission_amendment set status = 'superseded', responded_at = now()
    where mission_id = new.mission_id and status = 'proposed';

  update mission_release set status = 'superseded', responded_at = now()
    where mission_id = new.mission_id and status = 'proposed';

  return new;
end;
$$;

drop trigger if exists trg_amendment_replaces_release on mission_amendment;
create trigger trg_amendment_replaces_release
  before insert on mission_amendment
  for each row when (new.status = 'proposed')
  execute function amendment_replaces_release();