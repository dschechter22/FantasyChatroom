-- Caches each team's full simulated distribution (probability of every
-- possible season win total, every finishing seed, and "finishes ahead of"
-- against every other team) so the sportsbook can price a custom win-total
-- line, seed line, or team-vs-team pairing a bettor picks from a dropdown --
-- on demand, rather than only whatever fixed line/pairing got
-- pre-generated. Refreshed by generateFutures() (the daily cron and the
-- admin "Generate/Refresh" button) alongside the fixed yes/no futures.
--
-- Also backfills sb_props.team_id for any prop rows created before that
-- column existed (it only gets set going forward otherwise, since a
-- column added via ALTER TABLE doesn't populate existing rows).
--
-- Run once in the Supabase SQL editor.

create table if not exists sb_team_sim (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  team_id uuid references teams(id) not null,
  team_name text not null,
  win_tally jsonb not null default '{}'::jsonb,   -- { "7": 0.12, "8": 0.18, ... } win count -> probability
  seed_probs jsonb not null default '{}'::jsonb,  -- { "1": 0.15, "2": 0.10, ... } seed -> probability
  ahead_probs jsonb not null default '{}'::jsonb, -- { "<opp_team_id>": 0.62, ... } this team finishes ahead of opp
  updated_at timestamptz not null default now(),
  unique (season, team_id)
);
alter table sb_team_sim enable row level security;
drop policy if exists "public_all" on sb_team_sim;
create policy "public_all" on sb_team_sim for all using (true) with check (true);

update sb_props sp
set team_id = re.team_id
from roster_entries re
where sp.player_id = re.player_id and sp.team_id is null;
