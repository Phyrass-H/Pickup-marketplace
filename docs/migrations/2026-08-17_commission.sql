-- 2026-08-17 — COMMISSION. Step 4 of the pricing engine (docs/06 §13, §1, §3, §9).
-- Additive: one new table, one seed row, four snapshot columns on `mission`,
-- three functions. Safe to re-run. Changes NO behaviour on its own — nothing
-- reads any of it until the app half ships.
--
-- WHY IT EXISTS. docs/06 §1 fixes what Kavenue takes: the Business pays
-- 12,5 % HT / 15 % TTC on top of the Course, the Driver has 10 % HT / 12 % TTC
-- deducted from it. Kavenue's fee carries 20 % VAT. §3 fixes how it is billed:
-- three lines, never collapsed, because the Business reclaims the 20 % on
-- Kavenue's fee but NOT the VAT on passenger transport.
--
-- ── THE FOUNDER'S CALL THAT SHAPES EVERY DISPLAY (2026-08-17) ───────────────
-- The Ceiling Kavenue pre-fills is the Business's ALL-IN maximum — the service
-- fee and its VAT are already inside it. The rate_card numbers were calibrated
-- against retail, which is an all-in consumer price, so reading them as the
-- Business's cost is the only reading that keeps §4's "70-94 % of retail" true.
--
--   ⚑ AND THE PART THAT IS EASY TO GET WRONG: `mission.ceiling` DOES NOT CHANGE
--     MEANING. It still stores the COURSE — the fare the PDP curve climbs and
--     the Driver is paid from. The all-in figure is DERIVED for display
--     (course x 1,15). Nothing here touches settledFare, the fee-basis band, or
--     any cancel RPC, and no row is backfilled. What changes in the app half is
--     the PRE-FILL: the rate card's ceiling is all-in, so the stored ceiling
--     becomes card_ceiling / 1,15.
--
--   ⚑ WHY THE SNAPSHOT COLUMNS ARE NULLABLE, AND MUST STAY THAT WAY. Every
--     mission that already exists was priced with NO commission — the Business
--     paid the bare fare. NULL rates mean exactly that, and the app must render
--     those rows as a single amount with no breakdown. Defaulting them to 0.125
--     would retroactively invent 15 % of charges that were never billed on 271
--     live rows.
--
-- ── WHY A TABLE FOR THREE CONSTANTS ────────────────────────────────────────
-- docs/06 §0 says the commission rates never vary, and §9 says numbers live in
-- tables, not in code. Both hold here: the table has ONE row, and it is not a
-- per-Business or per-event knob — there is no policy dimension to key on. It
-- exists because the VAT rates in it are set by law rather than by Kavenue, and
-- a change in French VAT should be an INSERT, not a redeploy. History is safe
-- either way: the rates that priced a mission are copied onto the mission row.
--
-- ── ROUNDING: THE VAT LINE ABSORBS THE CENT ────────────────────────────────
-- §9 says store full precision and round at render. The Course obeys that — it
-- is computed by the PDP curve and already rounded to the cent by round2()
-- before it reaches anything here. The three invoice lines are a PRESENTATION
-- of that Course, and an invoice whose lines do not add up to its total is
-- wrong however defensible the arithmetic. So each side computes its total and
-- its HT fee independently, then derives the VAT line as the remainder. It can
-- sit a cent off 20 % of the fee; it can never fail to reconcile. This is the
-- ordinary invoicing convention and both copies of the formula implement it —
-- `lib/commission.ts` mirrors this file, pinned by tests/commission.test.ts.
--
-- ── THE TRANSPORT VAT IS THE DRIVER'S, AND IS SNAPSHOT AT ACCEPTANCE ───────
-- §3: the transport line shows the VAT that actually applies — 10 % if the
-- Driver is VAT-registered, 0 % if not. It is read from `driver.vat_number`,
-- never assumed, and frozen onto the mission when a Driver accepts, because a
-- Driver who registers for VAT in September must not change the VAT on a trip
-- they drove in August. Until then it is NULL: nobody has been assigned, so
-- there is no answer yet.

begin;

-- ───────────────────────────────────────────────────────────────── the table ──
create table if not exists commission_rate (
  id                  uuid primary key default gen_random_uuid(),
  effective_from      timestamptz not null default now(),

  business_rate_ht    numeric(6,5) not null,   -- 0.12500 — on top of the Course
  driver_rate_ht      numeric(6,5) not null,   -- 0.10000 — deducted from it
  fee_vat_rate        numeric(6,5) not null,   -- 0.20000 — VAT on Kavenue's fee
  transport_vat_rate  numeric(6,5) not null,   -- 0.10000 — what a VAT-registered
                                               -- Driver charges on the transport

  note                text,
  created_at          timestamptz not null default now(),

  constraint commission_rate_sane check (
    business_rate_ht   >= 0 and business_rate_ht   < 1 and
    driver_rate_ht     >= 0 and driver_rate_ht     < 1 and
    fee_vat_rate       >= 0 and fee_vat_rate       < 1 and
    transport_vat_rate >= 0 and transport_vat_rate < 1
  )
);

create unique index if not exists commission_rate_generation_key
  on commission_rate (effective_from);

comment on table commission_rate is
  'docs/06 §1. One row. Never UPDATE a live row — INSERT a new generation with a '
  'later effective_from, so missions already priced keep the rates snapshot onto '
  'them (§9). The rates never vary by Business, event, time or zone (§0).';

insert into commission_rate
  (effective_from, business_rate_ht, driver_rate_ht, fee_vat_rate, transport_vat_rate, note)
values
  (timestamptz '2026-08-17 00:00:00+00', 0.125, 0.10, 0.20, 0.10,
   'docs/06 §1, locked 2026-08-14/15. 12,5 % HT = 15 % TTC to the Business; 10 % HT = 12 % TTC to the Driver; Kavenue''s fee carries 20 % VAT. Transport VAT 10 % is the French rate for passenger transport, and applies only to a VAT-registered Driver.')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────── RLS ──
-- Readable by any signed-in user: both apps render a breakdown from it. No
-- insert/update/delete policy, so no app key can touch the rates through
-- PostgREST — re-rating is a statement in the SQL editor, which is the point.
alter table commission_rate enable row level security;

drop policy if exists p_commission_rate_read on commission_rate;
create policy p_commission_rate_read on commission_rate for select
  to authenticated
  using (true);

-- ────────────────────────────────────────────── the mission's snapshot ──────
-- docs/06 §9: settlement, invoicing and history read the snapshot and must
-- NEVER join back to the live rates. NULL = priced before commission existed.
alter table mission add column if not exists commission_business_rate numeric(6,5);
alter table mission add column if not exists commission_driver_rate   numeric(6,5);
alter table mission add column if not exists commission_vat_rate      numeric(6,5);
alter table mission add column if not exists transport_vat_rate       numeric(6,5);

comment on column mission.commission_business_rate is
  'docs/06 §9 snapshot: the HT rate the Business pays on top of the Course, as it '
  'stood when this mission was created. NULL = created before commission shipped, '
  'so no fee was ever billed — render the amount alone, with no breakdown.';

comment on column mission.transport_vat_rate is
  'docs/06 §3: the VAT actually inside the Course — the assigned Driver''s rate, '
  'frozen at acceptance from driver.vat_number. NULL until a Driver takes it.';

-- ──────────────────────────────────────────── one formula, not two ──────────
-- The pricing half already lives twice (lib/rate-card.ts and mission_price()),
-- deliberately, and tests pin the pair. Same discipline: lib/commission.ts
-- mirrors these functions figure for figure.

-- The generation in force at `p_at`.
create or replace function commission_for(p_at timestamptz default now())
returns commission_rate
language sql
stable
as $$
  select cr.*
    from commission_rate cr
   where cr.effective_from <= p_at
   order by cr.effective_from desc
   limit 1;
$$;

-- The whole split for one Course, both sides, to the cent.
--
-- business_total  what the Business pays, all in — the number the Ceiling shows
-- business_fee_ht + business_fee_vat   the two fee lines on their invoice
-- driver_net      what the Driver banks — the number the Pool shows
-- driver_fee_ht + driver_fee_vat       what was deducted to get there
--
-- The two VAT lines are remainders, so `course + business_fee_ht +
-- business_fee_vat = business_total` and `course - driver_fee_ht -
-- driver_fee_vat = driver_net` hold exactly, always. See the header.
create or replace function commission_split(
  p_course           numeric,
  p_business_rate_ht numeric,
  p_driver_rate_ht   numeric,
  p_fee_vat_rate     numeric
) returns table (
  business_total   numeric,
  business_fee_ht  numeric,
  business_fee_vat numeric,
  driver_net       numeric,
  driver_fee_ht    numeric,
  driver_fee_vat   numeric
)
language plpgsql
immutable
as $$
declare
  course numeric := round(greatest(coalesce(p_course, 0), 0), 2);
  b_rate numeric := coalesce(p_business_rate_ht, 0);
  d_rate numeric := coalesce(p_driver_rate_ht, 0);
  v_rate numeric := coalesce(p_fee_vat_rate, 0);
  total  numeric;
  net    numeric;
  b_ht   numeric;
  d_ht   numeric;
begin
  total := round(course * (1 + b_rate * (1 + v_rate)), 2);
  net   := round(course * (1 - d_rate * (1 + v_rate)), 2);
  b_ht  := round(course * b_rate, 2);
  d_ht  := round(course * d_rate, 2);

  return query select
    total,
    b_ht,
    total - course - b_ht,
    net,
    d_ht,
    course - d_ht - net;
end;
$$;

comment on function commission_split is
  'docs/06 §1/§3. Both sides of one Course. The VAT lines are remainders so an '
  'invoice always reconciles; mirrored by lib/commission.ts.';

-- The VAT sitting inside a TTC Course, at the Driver's own rate. 0 for a Driver
-- under franchise en base, who charges none — docs/06 §1.
create or replace function transport_vat(p_course numeric, p_rate numeric)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(p_rate, 0) <= 0 then 0::numeric
    else round(coalesce(p_course, 0), 2)
       - round(round(coalesce(p_course, 0), 2) / (1 + p_rate), 2)
  end;
$$;

commit;

-- ── VERIFY (run after; these are the figures the founder signed off) ────────
-- select * from commission_rate;
--
-- -- Cannes -> Monaco at the pre-filled ceiling: Course 138,61
-- select * from commission_split(138.61, 0.125, 0.10, 0.20);
-- --  business_total 159.40 | fee_ht 17.33 | fee_vat 3.46
-- --  driver_net     121.98 | fee_ht 13.86 | fee_vat 2.77
--
-- -- The same trip taken at 87,00: Course 98,86
-- select * from commission_split(98.86, 0.125, 0.10, 0.20);
-- --  business_total 113.69 | fee_ht 12.36 | fee_vat 2.47
-- --  driver_net      87.00 | fee_ht  9.89 | fee_vat 1.97
--
-- -- Every line reconciles, at any Course:
-- select c,
--        (select business_total - c - business_fee_ht - business_fee_vat
--           from commission_split(c, 0.125, 0.10, 0.20)) as business_gap,
--        (select c - driver_fee_ht - driver_fee_vat - driver_net
--           from commission_split(c, 0.125, 0.10, 0.20)) as driver_gap
--   from unnest(array[12.01,33.13,54.78,87,98.86,138.61,159.40,971.56]::numeric[]) c;
-- -- expect 0 in both columns on every row
--
-- -- The VAT inside the Course, by Driver status
-- select transport_vat(98.86, 0.10),   --  8.99  (registered)
--        transport_vat(98.86, 0);      --  0     (franchise en base)
--
-- -- Nothing was backfilled: every existing mission still has no commission
-- select count(*) from mission where commission_business_rate is not null;  -- 0
