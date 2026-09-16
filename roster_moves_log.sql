-- Logs every roster change app/api/espn-sync detects against ESPN's real
-- roster data (a player traded/waiver-claimed onto a different team, or a
-- free-agent pickup never seen before), so it's visible on /roster-moves
-- instead of only in that route's own JSON response.
--
-- Run once in the Supabase SQL editor.

create table if not exists roster_moves (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references seasons(id),
  week integer,
  player_id uuid references players(id),
  from_team_id uuid references teams(id), -- null for a brand-new pickup (no prior team of ours to move from)
  to_team_id uuid references teams(id) not null,
  move_type text not null, -- 'moved' | 'added'
  detected_at timestamptz not null default now(),
  league_id text default 'f35680a1-3392-47e5-abf2-0e81ae662f88'
);
create index if not exists roster_moves_season_id_idx on roster_moves(season_id);
create index if not exists roster_moves_detected_at_idx on roster_moves(detected_at desc);

alter table roster_moves enable row level security;

drop policy if exists "public_all" on roster_moves;
create policy "public_all" on roster_moves for all using (true) with check (true);
