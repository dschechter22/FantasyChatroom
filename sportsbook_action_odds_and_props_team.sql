-- Two additions:
--
-- 1. fair_p_a / fair_p store each market's model-derived "true" probability
--    (before vig, before any action) separately from the odds actually on
--    display. Action-based juice movement always recomputes the displayed
--    odds fresh from this fixed baseline plus the CURRENT pending-bet
--    split, rather than nudging the previous displayed odds repeatedly --
--    that keeps it from drifting/compounding as more bets come in.
--    (Player props don't need a column for this: an O/U line set at the
--    player's own projection is a true pick'em by construction, so its
--    fair probability is always exactly 0.5.)
--
-- 2. sb_props.team_id lets the Props tab filter by this week's real
--    matchup (join back to teams/fixtures) instead of showing every
--    player in the league at once.
--
-- Run once in the Supabase SQL editor.

alter table sb_games add column if not exists fair_p_a numeric;
alter table sb_futures add column if not exists fair_p numeric;

alter table sb_props add column if not exists team_id uuid references teams(id);
create index if not exists sb_props_team_id_idx on sb_props(team_id);
