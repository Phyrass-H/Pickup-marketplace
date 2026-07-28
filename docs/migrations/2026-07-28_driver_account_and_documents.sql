-- 2026-07-28 — Session 48: Driver account rebuild (real documents, one car for now).
--
-- Founder decisions this session:
--   1. A Driver is a COMPANY — Kavenue needs its company papers to pay it. Adds the
--      Kbis / SIRENE notice, the URSSAF *attestation de vigilance* (the donneur-d'ordre
--      obligation: contracts >= 5 000 EUR HT, re-collected every 6 months) and the
--      medical certificate (visite médicale, checked in roadside controls).
--   2. ONE car per Driver for now (founder's call). The real multi-car case in VTC is a
--      FLEET — one company, several Drivers, several cars — which the data spine doesn't
--      model, so "one Driver, many cars" would serve nobody in beta. Two columns here
--      leave the door open at zero cost (document.vehicle_id, vehicle.is_active); the
--      rest of multi-vehicle (mission.vehicle_id + a car picker inside accept_mission)
--      is deliberately NOT built, so the money-critical accept RPC stays untouched.
--   3. Documents get real lifecycle: an expiry date (the `expires_at` column has existed
--      since day one and was never written), a rejection reason, and front/back sides.
--
-- Everything here is ADDITIVE: new enum values, new nullable columns, one default-true
-- flag. No table is rewritten, no function is replaced.
--
-- ▶ Run this in the Supabase SQL editor (Claude's keys go through PostgREST = rows only).
--   If STEP 1 complains "cannot be executed inside a transaction block", run STEP 1
--   on its own first, then the rest.

-- ---------------------------------------------------------------- STEP 1: enum values
-- New document types. `if not exists` keeps the whole file re-runnable.
alter type document_type add value if not exists 'kbis';
alter type document_type add value if not exists 'urssaf_vigilance';
alter type document_type add value if not exists 'medical_certificate';

-- ------------------------------------------------------------- STEP 2: document table
-- side        — a licence and a VTC card are two-sided; today only one file per type
--               survives (getLatestDocuments keeps the newest row per type).
-- review_note — why a document was rejected. Without it "Rejected" is a dead end.
-- vehicle_id  — a carte grise / insurance belongs to ONE car, not to the Driver. Null
--               for personal + company papers. Cascades so deleting a car takes its
--               papers. With one car per Driver it's filled in but not yet read — it's
--               what makes a second car a small job later, not a re-attribution of
--               history.
alter table document add column if not exists side        text;
alter table document add column if not exists review_note text;
alter table document add column if not exists vehicle_id  uuid references vehicle(id) on delete cascade;

do $$ begin
  alter table document add constraint document_side_chk check (side in ('front','back'));
exception when duplicate_object then null; end $$;

create index if not exists document_vehicle_idx on document (vehicle_id);

-- -------------------------------------------------------------- STEP 3: vehicle table
-- is_active — "in the garage this week". A paused car stops pulling trips; nothing is
--             deleted. Default true so every existing vehicle keeps working untouched.
--             Not yet surfaced in the UI (one car = nothing to pause against).
alter table vehicle add column if not exists is_active boolean not null default true;

-- --------------------------------------------------------------- STEP 4: driver table
-- The Driver's company identity, mirroring the Business fields added in S28. Captured
-- now so the documents section is coherent; billing/payouts stay a DEFERRED integration
-- (bank details are Stripe's job — Kavenue never stores an IBAN).
alter table driver add column if not exists company_name text;
alter table driver add column if not exists siret        text;
alter table driver add column if not exists vat_number   text;
