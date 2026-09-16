-- Adds season-long futures markets (make/miss playoffs, bye, semis, finals,
-- title, season win total O/U, final-seed O/U, "finishes ahead of" head to
-- heads) and weekly player props (O/U a player's own projected fantasy
-- points) to the sportsbook.
--
-- Futures/props bets live in the existing sb_bets table rather than new bet
-- tables of their own -- sb_bets already carries parlay_id, and every leg of
-- a parlay (game, future, or prop alike) needs to sit in one place for the
-- "are all legs graded yet" settlement check to work across bet types.
--
-- Run once in the Supabase SQL editor.

create table if not exists sb_futures (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  market_type text not null, -- 'playoffs' | 'bye' | 'semis' | 'finals' | 'title' | 'win_total' | 'seed_total' | 'h2h_finish'
  team_id uuid references teams(id) not null,
  opp_team_id uuid references teams(id), -- only for h2h_finish ("team_id finishes ahead of opp_team_id")
  team_name text not null,
  opp_team_name text,
  line numeric, -- win total / seed number; null for the plain yes/no markets
  odds_yes integer not null default -110, -- "yes" for playoffs/bye/semis/finals/title/h2h_finish, "over" for win_total/seed_total
  odds_no integer not null default -110,
  is_settled boolean not null default false,
  result text, -- 'yes' | 'no' | 'push'
  created_at timestamptz not null default now()
);
create index if not exists sb_futures_season_idx on sb_futures(season);

create table if not exists sb_props (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  week integer not null,
  player_id uuid references players(id) not null,
  player_name text not null,
  position text,
  team_name text,
  line numeric not null, -- the week's O/U line (that player's own ESPN projection)
  odds_over integer not null default -110,
  odds_under integer not null default -110,
  is_settled boolean not null default false,
  actual_points numeric,
  result text, -- 'over' | 'under' | 'push'
  created_at timestamptz not null default now()
);
create index if not exists sb_props_season_week_idx on sb_props(season, week);

alter table sb_bets add column if not exists future_id uuid references sb_futures(id) on delete cascade;
alter table sb_bets add column if not exists prop_id uuid references sb_props(id) on delete cascade;
create index if not exists sb_bets_future_id_idx on sb_bets(future_id);
create index if not exists sb_bets_prop_id_idx on sb_bets(prop_id);

alter table sb_futures enable row level security;
alter table sb_props enable row level security;

drop policy if exists "public_all" on sb_futures;
create policy "public_all" on sb_futures for all using (true) with check (true);
drop policy if exists "public_all" on sb_props;
create policy "public_all" on sb_props for all using (true) with check (true);
