-- 2026-06-28 — Business profile fields (additive, non-breaking).
--
-- Fleshes out the thin `business` account so the Dispatch settings can hold a
-- credible B2B identity + booking defaults. Every column is nullable and added
-- with IF NOT EXISTS, so this is safe to run more than once and touches no
-- existing data, enum, or RLS policy.
--
-- Company identity (the credibility jump — drives compliant vouchers/invoices
-- under the agent/intermediary VAT positioning; values are human-verified off
-- the Kbis in beta, NOT computed):
--   business_type           constrained in the app to hotel/concierge/travel_agency/event_venue/other
--   legal_name              raison sociale (often differs from the trading name)
--   siret                   14-digit French establishment id
--   vat_number              TVA intracommunautaire (storage only — no derived VAT)
--   registered_address      head-office / legal address (distinct from a pickup base)
--   reception_phone         hotel switchboard, separate from the Dispatcher's mobile
-- Booking defaults (pre-fill the new-mission form):
--   default_pickup_*        the hotel's own pickup point, geocoded like the form's pickup
--   default_vehicle_category  matches the mission category values
--   default_booking_notes   house default Guest instructions
-- Billing:
--   billing_email           where PickUp invoices are sent (storable now; Stripe is deferred)

alter table business
  add column if not exists business_type           text,
  add column if not exists legal_name               text,
  add column if not exists siret                    text,
  add column if not exists vat_number               text,
  add column if not exists registered_address       text,
  add column if not exists reception_phone          text,
  add column if not exists default_pickup_address   text,
  add column if not exists default_pickup_lat       double precision,
  add column if not exists default_pickup_lng       double precision,
  add column if not exists default_pickup_label     text,
  add column if not exists default_vehicle_category text,
  add column if not exists default_booking_notes    text,
  add column if not exists billing_email            text;
