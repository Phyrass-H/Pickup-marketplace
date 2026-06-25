-- 2026-06-25_mission_driver_section.sql
-- ADDITIVE ONLY. Adds the "Driver & service" card fields to the mission table
-- (new-mission form: requested languages, dress code, request flags, name board,
-- private message to the Driver). The live schema is already applied (hard-rule #4);
-- this only ADDs nullable columns, never drops or rewrites anything.
--
-- Run once in the Supabase SQL editor (PostgREST / app keys can't do DDL).

alter table public.mission
  add column if not exists required_languages text[],   -- requested language labels, e.g. {Français,English}
  add column if not exists dress_code         text,     -- driver_choice | smart_casual | business_formal | suit_tie
  add column if not exists driver_flags        jsonb,    -- { meet_greet, greeter, luggage_help, child_seat, quiet_ride, pets }
  add column if not exists board_name          text,     -- name shown on the meet & greet board
  add column if not exists board_file_path     text,     -- storage path in the private "documents" bucket (uploaded board)
  add column if not exists driver_message      text;     -- private special-instructions message to the Driver

-- All columns are nullable: a mission with none set behaves exactly as before.
