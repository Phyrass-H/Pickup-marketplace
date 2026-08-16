-- 2026-08-16 — THE RATE CARD. Step 1 of the pricing engine (docs/06 §13).
-- Additive: one new table, two nullable-ish columns on `mission`, two functions.
-- Safe to re-run. Changes NO behaviour on its own — nothing reads this yet.
--
-- WHY THIS EXISTS. Until now the Business invented its own Ceiling out of thin
-- air. docs/06 §4 replaces that: Kavenue computes and PRE-FILLS the price, and
-- the Business may still edit it (§0 — Kavenue recommends, it never imposes).
-- This migration is the data half of that. The app half comes next.
--
-- THE RULE THAT SHAPES THE WHOLE TABLE (docs/06 §9): "Numbers live in tables,
-- not in code. Recalibration is an INSERT/UPDATE — never a redeploy." So every
-- coefficient is a column, and re-tuning a class is one statement.
--
-- AND ITS COMPANION: "Changing a rate never rewrites history. Add a row with a
-- later `effective_from`." That is why the key includes `effective_from` and why
-- nothing here is ever UPDATEd in anger — you INSERT a new generation, and every
-- mission already priced keeps pointing at the row that priced it.
--
-- ── THE FORMULA (docs/06 §4) ────────────────────────────────────────────────
--   ceiling = ceiling_base
--           + ceiling_per_km      × min(km, long_threshold_km)
--           + ceiling_per_km_long × max(0, km − long_threshold_km)
--   floor   = floor_base + floor_per_km × km
--   both × night_multiplier for a pickup between 22:00 and 06:00
--
-- TWO BANDS, NOT ONE LINE. Re-calibrated 2026-08-16 against four independent
-- sources over eleven routes, 5.9 km → 619 km. The market charges less per km
-- the further you go — Blacklane bills 4.36 €/km for a Business sedan at 32 km
-- and 1.82 €/km at 595 km, and a second source independently reaches the same
-- 1.82 at the same distance. A single straight line put Kavenue ABOVE retail
-- past ~200 km, which would have made booking here more expensive than booking
-- the aggregator direct. The long band is ~70% of the first.
--   ⚑ The 150 km threshold is the one number with no direct evidence behind it
--     (nobody publishes where their own band turns). It is worth only 3–6% of a
--     fare and shrinks with distance. It is a column precisely so it can move.
--
-- THE FLOOR DOES NOT TAPER, and does not need to: floor_per_km is below
-- ceiling_per_km_long on every row (tightest pair 0.65 vs 1.30), so the floor
-- can never catch the ceiling however long the trip. There is a CHECK for it.
--   ⚑ The floors look brutally low on purpose. docs/06 §5: the floor is the
--     auction's OPENING BID, not a valuation — every trip opens there and climbs.
--     This has been flagged as "too low to be viable" twice and overruled twice.
--     Do not raise them without the founder saying so in as many words.
--
-- ── HOW A ROW IS CHOSEN ─────────────────────────────────────────────────────
-- Keyed on (market, tier, body). `tier` is the mission's `category`, which for a
-- mission means the SERVICE TIER — eco | business | luxury. The enum also carries
-- a legacy 'van' value that missions never use (body is its own axis since the
-- 2026-06-19 taxonomy migration); a CHECK keeps it out of this table.
--
-- `body` NULL means "this row covers any body". Eco is seeded that way because
-- the market prices no meaningful Eco van premium. Business and First each get a
-- sedan row and a van row.
--
-- A mission whose Business chose "Any body" (`required_body_type is null`)
-- resolves to the SEDAN row. Deliberate: the Business asked for the base product
-- and the trip reaches sedan and van Drivers alike, so it should not pay the van
-- premium for declining to specify. A van Driver taking it is choosing a job at
-- the mission's rate — the same principle as BACKLOG § V.
--
-- ── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────
-- The COMMISSION snapshot columns (docs/06 §9 — "both commission rates copied
-- onto the mission row"). Their shape falls out of step 2, which decides the
-- three invoice lines. Columns nothing writes to are debt; they come with the
-- code that fills them.
--
-- ── THE V-CLASS ─────────────────────────────────────────────────────────────
-- Founder's call, same day: the Mercedes V-Class is FIRST, the Vito stays
-- BUSINESS — which is where every source we checked draws the line, and the
-- reason a `First — van` row exists at all. That change lives in
-- `lib/vehicle-catalog.ts`, not here. Its Pool consequence is BACKLOG § V.

begin;

-- ─────────────────────────────────────────────────────────────── the table ──
create table if not exists rate_card (
  id                  uuid primary key default gen_random_uuid(),
  market              text not null default 'riviera',
  tier                vehicle_category not null,     -- eco | business | luxury
  body                body_type,                     -- null = covers any body
  effective_from      timestamptz not null default now(),

  floor_base          numeric(10,2) not null,
  floor_per_km        numeric(10,4) not null,
  ceiling_base        numeric(10,2) not null,
  ceiling_per_km      numeric(10,4) not null,        -- first `long_threshold_km`
  ceiling_per_km_long numeric(10,4) not null,        -- everything beyond
  long_threshold_km   numeric(10,2) not null default 150,
  night_multiplier    numeric(10,4) not null default 1.20,

  note                text,
  created_at          timestamptz not null default now(),

  -- 'van' is a legacy vehicle_category value; body is its own axis here.
  constraint rate_card_tier_is_a_service_tier check (tier <> 'van'),
  -- every coefficient positive
  constraint rate_card_positive check (
    floor_base >= 0 and floor_per_km > 0 and ceiling_base >= 0
    and ceiling_per_km > 0 and ceiling_per_km_long > 0
    and long_threshold_km > 0 and night_multiplier >= 1
  ),
  -- the taper may flatten the rate, never invert it
  constraint rate_card_taper_does_not_invert check (ceiling_per_km_long <= ceiling_per_km),
  -- the floor can never catch the ceiling, at any distance
  constraint rate_card_floor_below_ceiling check (
    floor_base < ceiling_base and floor_per_km < ceiling_per_km_long
  )
);

-- One row per (market, tier, body) generation. Two partial indexes rather than
-- one expression index: `body` is nullable, and NULL is not distinct from NULL
-- for a plain unique index, so the any-body rows need their own.
create unique index if not exists rate_card_generation_key
  on rate_card (market, tier, body, effective_from) where body is not null;

create unique index if not exists rate_card_generation_key_anybody
  on rate_card (market, tier, effective_from) where body is null;

-- The lookup a price does: newest generation at or before `p_at`.
create index if not exists rate_card_lookup
  on rate_card (market, tier, effective_from desc);

comment on table rate_card is
  'docs/06 §4. Kavenue''s recommended price per class. Never UPDATE a live row to '
  're-tune — INSERT a new one with a later effective_from, so priced missions keep '
  'pointing at the row that priced them (§9).';

-- ──────────────────────────────────────────────────────── the seed, S60 ────
-- Re-calibrated 2026-08-16 against Blacklane, two transfer aggregators and Uber
-- across eleven routes. Sits at 70–94% of retail everywhere it was checked, so a
-- Business reselling to its Guest keeps a margin.
insert into rate_card
  (market, tier, body, effective_from,
   floor_base, floor_per_km, ceiling_base, ceiling_per_km, ceiling_per_km_long, note)
values
  ('riviera', 'eco',      null,    timestamptz '2026-08-16 00:00:00+00',
   12, 0.65, 20, 1.85, 1.30,
   'Anchored on Uber, the only class it does not distort. No body split — the market prices no Eco van premium.'),

  ('riviera', 'business', 'sedan', timestamptz '2026-08-16 00:00:00+00',
   13, 0.75, 48, 2.00, 1.40,
   'Confirmed at 80-90% of Blacklane at 32 / 318 / 595 km. Unchanged from the 2026-08-14 fit.'),

  ('riviera', 'business', 'van',   timestamptz '2026-08-16 00:00:00+00',
   17, 0.90, 52, 2.25, 1.58,
   'Base 45 -> 52 on 2026-08-16: below 12 km the van priced CHEAPER than the sedan. Now 1.09-1.13x it at every distance, against Uber 1.14-1.37x and the aggregators 1.03-1.12x. This is the Vito row.'),

  ('riviera', 'luxury',   'sedan', timestamptz '2026-08-16 00:00:00+00',
   20, 1.10, 86, 3.60, 2.52,
   'Rebuilt 2026-08-16. Was 115 + 1.90 — per-km BELOW Business, propped up by a base fitted from 11 points with nothing under 28 km, so a 2 km trip cost 5% less than a 5 km one. Measured ratio is 1.80x Business; the line pivots at ~17 km.'),

  ('riviera', 'luxury',   'van',   timestamptz '2026-08-16 00:00:00+00',
   20, 1.10, 82, 3.42, 2.39,
   'New row. 5% under the First sedan across six paired observations (-5.2% mean): the S-Class is the prestige object, the V-Class a people-mover. Note this INVERTS the Business tier, where the van is dearer than the sedan.')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────── RLS ────
-- Readable by any signed-in user: the Dispatch form pre-fills from it and the
-- Driver app explains a price with it. Deny-by-default on writes — there is no
-- insert/update/delete policy, so PostgREST cannot touch it with any app key.
-- Re-tuning is a statement in the SQL editor, which is the point.
alter table rate_card enable row level security;

drop policy if exists p_rate_card_read on rate_card;
create policy p_rate_card_read on rate_card for select
  to authenticated
  using (true);

-- ────────────────────────────────────────────── the mission's snapshot ────
-- WHICH card priced this trip. docs/06 §9: settlement, invoicing and history
-- read the snapshot and must NEVER join back to the live card. NULL means the
-- mission predates the engine (every row today) or was priced by hand.
alter table mission add column if not exists rate_card_id uuid references rate_card(id);

-- Whether the 22:00-06:00 x1.20 was applied (docs/06 §4, "so a past price stays
-- explicable"). false on historical rows is accurate: no night multiplier ever
-- touched them.
alter table mission add column if not exists night_applied boolean not null default false;

comment on column mission.rate_card_id is
  'docs/06 §9 snapshot: the rate_card generation that produced this mission''s '
  'pre-filled ceiling. Never re-resolve a price through the live card.';

-- ────────────────────────────────────────────── one formula, not two ──────
-- The fee rules already exist twice in this codebase (lib/ and SQL), and S56 was
-- spent proving the two had not drifted. The pricing engine starts with one
-- definition on the SQL side so the RPCs and the app can be checked against each
-- other rather than each carrying its own arithmetic.

-- Resolve the row that applies. Exact body match wins; otherwise the any-body
-- row. "Any body" on the mission resolves to the sedan row (see header).
create or replace function rate_card_for(
  p_tier   vehicle_category,
  p_body   body_type   default null,
  p_market text        default 'riviera',
  p_at     timestamptz default now()
) returns rate_card
language sql
stable
as $$
  select rc.*
    from rate_card rc
   where rc.market = p_market
     and rc.tier   = p_tier
     and (rc.body is null or rc.body = coalesce(p_body, 'sedan'::body_type))
     and rc.effective_from <= p_at
   order by (rc.body is not null) desc,   -- prefer the body-specific row
            rc.effective_from desc         -- then the newest generation
   limit 1;
$$;

-- The price itself. Returns full precision — docs/06 §9: "store full precision,
-- round only at render. Never back-derive a fare from a rounded displayed total."
create or replace function mission_price(
  p_tier   vehicle_category,
  p_body   body_type   default null,
  p_km     numeric     default 0,
  p_night  boolean     default false,
  p_market text        default 'riviera',
  p_at     timestamptz default now()
) returns table (rate_card_id uuid, floor_price numeric, ceiling_price numeric)
language plpgsql
stable
as $$
declare
  c    rate_card;
  km   numeric := greatest(coalesce(p_km, 0), 0);
  mult numeric;
begin
  c := rate_card_for(p_tier, p_body, p_market, p_at);
  if c.id is null then
    return;                              -- no card for this market/tier: caller decides
  end if;

  mult := case when p_night then c.night_multiplier else 1 end;

  return query select
    c.id,
    (c.floor_base + c.floor_per_km * km) * mult,
    (c.ceiling_base
       + c.ceiling_per_km      * least(km, c.long_threshold_km)
       + c.ceiling_per_km_long * greatest(km - c.long_threshold_km, 0)) * mult;
end;
$$;

comment on function mission_price is
  'docs/06 §4. Two distance bands; night multiplier applies to floor and ceiling '
  'alike. Full precision — round at render only (§9).';

commit;

-- ── VERIFY (run after, expect the numbers in docs/06 and SESSION_LOG S60) ───
-- select tier, body, ceiling_base, ceiling_per_km, ceiling_per_km_long
--   from rate_card order by tier, body;
--
-- -- Nice Airport -> Hotel de Paris Monaco, 32.5 km      floor  /  ceiling
-- select 'eco' t, * from mission_price('eco',      null,    32.5)         --  33.125 /   80.125
-- union all select 'bus', * from mission_price('business','sedan', 32.5)  --  37.375 /  113.000
-- union all select 'van', * from mission_price('business','van',   32.5)  --  46.250 /  125.125
-- union all select 'fst', * from mission_price('luxury',  'sedan', 32.5)  --  55.750 /  203.000
-- union all select 'fsv', * from mission_price('luxury',  'van',   32.5); --  55.750 /  193.150
--
-- -- Nice Airport -> Courchevel, 595.4 km (second band)
-- select * from mission_price('business','sedan', 595.4);           -- 459.550 /  971.560
-- select * from mission_price('luxury',  'sedan', 595.4);           -- 674.940 / 1748.408
--
-- -- "Any body" resolves to sedan; Eco ignores body entirely
-- select * from mission_price('business', null,  32.5);             -- = the sedan row
-- select * from mission_price('eco',      'van', 32.5);             -- = the eco row
--
-- -- Night x1.20 on both
-- select * from mission_price('business','sedan', 32.5, true);      --  44.850 /  135.600
--
-- -- The van must never undercut the sedan again (the bug fixed on 2026-08-16):
-- select k,
--        (select ceiling_price from mission_price('business','sedan', k)) sedan,
--        (select ceiling_price from mission_price('business','van',   k)) van
--   from unnest(array[2,5.9,12,32.5,110.6,327.4,595.4]::numeric[]) k;
-- -- expect van > sedan on every row
