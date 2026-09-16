-- Adds a real-NFL-team column to players, kept fresh by the daily ESPN sync
-- (from each player's proTeamId in the same payload already being fetched),
-- so the sportsbook's Props tab can show "who do they play this week in the
-- NFL" without a separate lookup.
--
-- Run once in the Supabase SQL editor.

alter table players add column if not exists nfl_team text;
