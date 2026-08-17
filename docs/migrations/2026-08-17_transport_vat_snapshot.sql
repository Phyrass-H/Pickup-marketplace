-- 2026-08-17 — WHOSE VAT IS INSIDE THE FARE. Companion to 2026-08-17_commission.sql.
-- Additive: one trigger function, one trigger. Safe to re-run. Writes only a
-- column that is NULL on every existing row.
--
-- WHY. docs/06 §3: the transport line must show the VAT that ACTUALLY applies —
-- 10 % if the Driver is VAT-registered, 0 % if not — "read it from the Driver's
-- vat_number; never assume". That answer does not exist while a trip is in the
-- Pool, because nobody has taken it. It exists the moment a Driver accepts.
--
-- AND IT MUST BE FROZEN THERE. A Driver who registers for VAT in September must
-- not change the VAT on a trip they drove in August — the invoice for that trip
-- was already correct. §9: settlement and invoicing read the snapshot, never the
-- live row.
--
-- ── WHY A TRIGGER AND NOT A LINE IN accept_mission ─────────────────────────
-- Four RPCs assign or clear a Driver (accept_mission, and the three re-pool
-- paths), and every one of them is money-critical and already carries a row
-- lock, a status guard and a fee calculation. Editing four of them to copy one
-- column is four chances to disturb code that took two sessions to prove
-- correct — S57's probes exist because that arithmetic drifted once already.
--
-- A trigger is the smaller blast radius: it fires on the STATE CHANGE
-- (driver_id becoming set, or being cleared) rather than on the code path, so it
-- covers all four today and anything added later, and it cannot alter who wins
-- an accept race — it runs inside the same transaction, after the row is already
-- locked and decided, and touches a column no money reads.
--
-- ⚑ NOT security definer. The S41/S42 guard saga: a SECURITY DEFINER trigger
-- sees the OWNER in `current_user`, which is exactly how two attempts to lock
-- `guest_ready_at` turned into silent no-ops. This one needs no elevated rights
-- — it reads `driver`, which the trip's own RPCs already read.

begin;

create or replace function trg_snapshot_transport_vat()
returns trigger
language plpgsql
as $$
declare
  v_registered boolean;
  v_rate       numeric;
begin
  -- A Driver just took it: freeze whose VAT the fare carries.
  if new.driver_id is not null and old.driver_id is distinct from new.driver_id then
    select coalesce(nullif(btrim(d.vat_number), ''), null) is not null
      into v_registered
      from driver d
     where d.id = new.driver_id;

    -- The rate is law, not policy, so it comes from the table like the rest
    -- (docs/06 §9). No generation in force = no answer, and NULL is the honest
    -- way to say that; the app renders no VAT line rather than guessing one.
    select cr.transport_vat_rate into v_rate
      from commission_rate cr
     where cr.effective_from <= now()
     order by cr.effective_from desc
     limit 1;

    new.transport_vat_rate :=
      case when coalesce(v_registered, false) then v_rate else 0 end;

  -- The trip was re-pooled (driver cancel · reclaim · agreed release): the next
  -- Driver's status is not this one's, so the answer goes back to "not yet".
  elsif new.driver_id is null and old.driver_id is not null then
    new.transport_vat_rate := null;
  end if;

  return new;
end;
$$;

drop trigger if exists mission_snapshot_transport_vat on mission;
create trigger mission_snapshot_transport_vat
  before update of driver_id on mission
  for each row
  execute function trg_snapshot_transport_vat();

comment on function trg_snapshot_transport_vat is
  'docs/06 §3/§9. Freezes the assigned Driver''s VAT status onto the mission when '
  'they accept, and clears it on re-pool. Never re-read live: a Driver who '
  'registers later must not change the VAT on a trip already driven.';

commit;

-- ── VERIFY (read-only; run after) ──────────────────────────────────────────
-- -- The trigger exists and is not security definer:
-- select tgname, p.prosecdef
--   from pg_trigger t join pg_proc p on p.oid = t.tgfoid
--  where tgname = 'mission_snapshot_transport_vat';   -- expect prosecdef = false
--
-- -- Nothing was written to existing rows:
-- select count(*) from mission where transport_vat_rate is not null;   -- expect 0
--
-- -- How many Drivers would get 10 % vs 0 % (no writes, just the shape):
-- select coalesce(nullif(btrim(vat_number), ''), null) is not null as registered,
--        count(*)
--   from driver group by 1;
