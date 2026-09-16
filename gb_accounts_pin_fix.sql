-- The live gb_accounts table was created before the sportsbook's name+PIN
-- login was added and never picked up the 'pin' column that
-- supabase/schema.sql has always documented -- every account-creation
-- attempt failed with a schema-cache error ("Could not find the 'pin'
-- column"), which app/sportsbook/page.js's old error handling mislabeled as
-- "Name already taken" regardless of the real cause.
--
-- Run once in the Supabase SQL editor.

alter table gb_accounts add column if not exists pin text;
