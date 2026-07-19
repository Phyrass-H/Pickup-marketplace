-- O7 — the MUTUAL-CONSENT "AGREED RELEASE" (D45).
--   A free, no-fee cancellation that BOTH sides confirm: the Business proposes a
--   release (a dedicated action, NOT the fee-paying unilateral cancel) → the assigned
--   Driver must ACCEPT → only then does the trip release free and RE-POOL as a SPEED
--   WIN. No ramp fee for the Business, no 100% penalty for the Driver, no reliability
--   mark. Decline → nothing moves; the trip stays exactly as agreed.
--
--   WHY the Driver's tap is mandatory (scam protection): without consent, a Business's
--   only exit is the fee-paying unilateral cancel — so a Business can't dodge the fee
--   by "agreeing" a release on a committed Driver. Consent makes the free path honest.
--
--   DISPUTE-READY AUDIT (founder requirement). mission_release is an append-only
--   evidence trail. Every proposal is its own row; a DECLINE is retained permanently
--   (a Business can only HIDE a resolved request from its own schedule via dismissed_at
--   — never delete or rewrite it); propose-time context (fare + hours-before-pickup) is
--   captured so "a free release proposed INSIDE the fee window, repeatedly declined" is
--   legible on its face, and per-Business counts are a plain query. To keep the evidence
--   tamper-resistant, ALL writes go through SECURITY DEFINER RPCs (propose / respond /
--   close) — there is deliberately NO client INSERT/UPDATE policy on the table (stronger
--   than the amendment table's client-write model; closes the class of gap the O7 review
--   flagged on p_mission_business_update). The settled release also writes a
--   mission_cancellation row (kind='agreed_release', fee 0, re-pooled) so both parties
--   keep a readable record.
--
-- ADDITIVE ONLY. Never re-runs or drops the base schema (hard-rule #4). Mirrors the
-- mission_amendment + O7 cancellation patterns. Base schema uses Supabase default
-- privileges (no explicit GRANTs), so the new table/functions inherit access the same
-- way; we only add RLS + policies. Run once in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. Record the settled agreed-release in the existing cancellation audit.
--    Widen mission_cancellation.kind to add 'agreed_release' (fee 0, re-pooled).
-- ---------------------------------------------------------------------------
alter table mission_cancellation drop constraint if exists mission_cancellation_kind_check;
alter table mission_cancellation add  constraint mission_cancellation_kind_check
  check (kind in ('driver_cancel','business_cancel','no_show','t60_reclaim','agreed_release'));

-- ---------------------------------------------------------------------------
-- 2. The release request (one row per proposal; an append-only evidence trail).
-- ---------------------------------------------------------------------------
create table if not exists mission_release (
  id                  uuid primary key default gen_random_uuid(),
  mission_id          uuid not null references mission(id) on delete cascade,
  business_id         uuid not null references business(id),   -- denormalised for RLS + abuse counts
  driver_id           uuid references driver(id),              -- the assigned Driver who must consent (self-describing record)
  proposed_by         uuid references dispatcher(id),
  status              text not null default 'proposed'
                        check (status in ('proposed','accepted','declined','superseded')),
  note                text,                                    -- optional message to the Driver
  decline_reason      text,                                    -- optional short reason the Driver gives on decline
  from_fare           numeric(10,2),                           -- computed fare at propose-time (dispute context)
  hours_before_pickup numeric,                                 -- server-computed at propose-time (the "inside the fee window?" signal)
  dismissed_at        timestamptz,                             -- Business hid a RESOLVED request from its schedule (evidence preserved)
  created_at          timestamptz not null default now(),
  responded_at        timestamptz                              -- when the Driver accepted / declined (or a supersede)
);
create index if not exists mission_release_mission_status_idx on mission_release (mission_id, status);
create index if not exists mission_release_business_idx        on mission_release (business_id);
create index if not exists mission_release_driver_idx          on mission_release (driver_id);

alter table mission_release enable row level security;

-- READ-ONLY policies. Business reads its own requests; the Driver reads requests
-- addressed to them (driver_id is stamped at propose-time and survives the re-pool, so
-- the Driver keeps read access to their own record even after accepting). ALL writes go
-- through the SECURITY DEFINER RPCs below → no client INSERT/UPDATE policy = deny by
-- default (tamper-resistant evidence).
drop policy if exists p_release_business_read on mission_release;
create policy p_release_business_read on mission_release for select using (
  business_id = current_business_id() or app_role() = 'admin'
);
drop policy if exists p_release_driver_read on mission_release;
create policy p_release_driver_read on mission_release for select using (
  driver_id = current_driver_id()
);

-- ---------------------------------------------------------------------------
-- 3. BUSINESS proposes a release — a dedicated action, NOT the fee-paying cancel.
--    Only a committed Driver, pre-execution (accepted/confirmed), can be released.
--    Supersedes any prior PENDING request for the mission (one live card at a time);
--    superseded rows stay on file (a burst of them is itself a pressure signal).
--    Declined / accepted rows are never touched.
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
-- 4. DRIVER responds — the atomic, consented apply (a mini accept_mission).
--    Accept → re-pool as a SPEED WIN (free, NO reliability mark), supersede any pending
--    amendment, write the settled cancellation record (both parties can read it).
--    Decline → nothing on the mission moves; the trip stays exactly as agreed.
-- ---------------------------------------------------------------------------
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
  v_hours     numeric;
begin
  if v_driver_id is null then raise exception 'Not a driver'; end if;

  -- Lock the request; must still be pending (serialises concurrent responses).
  select * into v_rel from mission_release where id = p_release_id for update;
  if not found or v_rel.status <> 'proposed' then
    raise exception 'This release request is no longer pending';
  end if;

  -- Lock the mission; must be THIS Driver's and still pre-execution.
  select * into v_mission from mission where id = v_rel.mission_id for update;
  if not found or v_mission.driver_id is distinct from v_driver_id then
    raise exception 'Not your mission';
  end if;
  if v_mission.status not in ('accepted','confirmed') then
    raise exception 'This trip can no longer be released';
  end if;

  if p_accept then
    v_hours := extract(epoch from (v_mission.pickup_at - now())) / 3600.0;

    -- Settled record: free (0%), re-pooled, mutual. party = the business proposer;
    -- actor_driver_id = the consenting Driver so BOTH keep a readable proof (the Driver
    -- read policy on mission_cancellation is scoped to actor_driver_id).
    insert into mission_cancellation
      (mission_id, business_id, party, actor_driver_id, kind, reason,
       fee_pct, fee_amount, fare_snapshot, hours_before_pickup, resulted_in)
    values
      (v_mission.id, v_mission.business_id, 'business', v_driver_id, 'agreed_release',
       'Released by mutual agreement', 0, 0, v_rel.from_fare, v_hours, 'repooled');

    -- Any change negotiated with THIS Driver dies with the re-pool.
    update mission_amendment set status = 'superseded', responded_at = now()
      where mission_id = v_mission.id and status = 'proposed';

    -- Re-pool as a SPEED WIN (identical to a driver cancel — but free + no mark).
    update mission set
      status        = 'pooled',
      driver_id     = null,
      accepted_at   = null,
      confirmed_at  = null,
      stops_reached = 0,
      pooled_at     = now(),
      speed_win     = true,
      pdp_start     = round(v_mission.ceiling * 0.7, 2),
      pdp_step      = greatest(1, round(v_mission.ceiling * 0.05, 2)),
      pdp_interval  = 5
    where id = v_mission.id;

    insert into status_event (mission_id, status) values (v_mission.id, 'repooled');

    update mission_release set status = 'accepted', responded_at = now()
      where id = p_release_id and status = 'proposed';
  else
    update mission_release set status = 'declined', decline_reason = p_reason, responded_at = now()
      where id = p_release_id and status = 'proposed';
  end if;

  -- Lost the race between our lock and the write → abort clean.
  if not found then
    raise exception 'This release request is no longer pending';
  end if;

  select * into v_mission from mission where id = v_rel.mission_id;
  return v_mission;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. BUSINESS closes a request — withdraw a still-pending one, or hide a RESOLVED
--    one from the schedule. Hiding sets dismissed_at only: the evidence (status +
--    decline_reason + timestamps) is never deleted or rewritten.
-- ---------------------------------------------------------------------------
create or replace function close_release(p_release_id uuid)
returns mission_release
language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid := current_business_id();
  v_rel         mission_release;
begin
  if v_business_id is null then raise exception 'Not a dispatcher'; end if;

  select * into v_rel from mission_release where id = p_release_id for update;
  if not found or v_rel.business_id is distinct from v_business_id then
    raise exception 'Not your request';
  end if;

  if v_rel.status = 'proposed' then
    update mission_release set status = 'superseded', responded_at = now()
      where id = p_release_id and status = 'proposed';
  else
    update mission_release set dismissed_at = now() where id = p_release_id;
  end if;

  select * into v_rel from mission_release where id = p_release_id;
  return v_rel;
end;
$$;
