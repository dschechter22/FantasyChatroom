-- Fantasy Chatroom 2026-27 Week 7 results.
-- Inserts the Week 7 matchups (with final scores) and sets each team's
-- record/points through Week 7 on the teams table. Power Rankings, the
-- LJ Index and the bye-week analysis all compute live from matchups + teams.
--
-- Safe to re-run. The ESPN sync creates the current week's matchups mid-week
-- with partial scores and no league_id, so this script (0) repairs league_id on
-- any existing Week 7 row, (1) inserts the pairs that don't exist yet (either
-- home/away orientation counts as existing), (1b) overwrites the scores on the
-- ones that do, and (2) sets each team's absolute through-Week-7 totals.
-- league_id always comes from the home team's own row, never a managers subquery.

-- 0. Repair league_id on any Week 7 row the sync (or an earlier run) created
update matchups m set league_id = ht.league_id
from teams ht, (select id from seasons where year = 2026) s
where m.home_team_id = ht.id and m.season_id = s.id and m.week = 7
  and (m.league_id is distinct from ht.league_id);

-- 1. Matchups (home/away per the league's fixed schedule)
insert into matchups (season_id, week, home_team_id, away_team_id, home_score, away_score, league_id)
select s.id, 7, ht.id, at.id, v.home_score, v.away_score, ht.league_id
from (values
  ('JM/Cameron', 'Reid', 132.82, 134.18),
  ('Big E', 'Wally', 100.18, 117.72),
  ('Freed', 'Caden', 93.20, 159.22),
  ('Mamby/Tenner', 'Dan', 108.24, 146.18),
  ('Braden', 'John', 123.36, 123.62)
) as v(home_manager, away_manager, home_score, away_score)
join managers hm on hm.name = v.home_manager
join managers am on am.name = v.away_manager
cross join (select id from seasons where year = 2026) s
join teams ht on ht.season_id = s.id and ht.manager_id = hm.id
join teams at on at.season_id = s.id and at.manager_id = am.id
where not exists (
  select 1 from matchups m2
  where m2.season_id = s.id and m2.week = 7
    and ((m2.home_team_id = ht.id and m2.away_team_id = at.id)
      or (m2.home_team_id = at.id and m2.away_team_id = ht.id))
);

-- 1b. Overwrite the scores on Week 7 rows that already exist (the sync's
-- partial mid-week scores), whichever way round home/away was stored.
update matchups m set
  home_score = case when m.home_team_id = ht.id then v.home_score else v.away_score end,
  away_score = case when m.home_team_id = ht.id then v.away_score else v.home_score end
from (values
  ('JM/Cameron', 'Reid', 132.82, 134.18),
  ('Big E', 'Wally', 100.18, 117.72),
  ('Freed', 'Caden', 93.20, 159.22),
  ('Mamby/Tenner', 'Dan', 108.24, 146.18),
  ('Braden', 'John', 123.36, 123.62)
) as v(home_manager, away_manager, home_score, away_score)
join managers hm on hm.name = v.home_manager
join managers am on am.name = v.away_manager
cross join (select id from seasons where year = 2026) s
join teams ht on ht.season_id = s.id and ht.manager_id = hm.id
join teams at on at.season_id = s.id and at.manager_id = am.id
where m.season_id = s.id and m.week = 7
  and ((m.home_team_id = ht.id and m.away_team_id = at.id)
    or (m.home_team_id = at.id and m.away_team_id = ht.id));

-- 2. Team records/points through Week 7 (Week 6 totals + Week 7 result)
update teams t set
  wins = v.wins,
  losses = v.losses,
  points_for = v.points_for,
  points_against = v.points_against
from (values
  ('Dan', 4, 3, 909.92, 892.12),
  ('Braden', 6, 1, 963.68, 845.12),
  ('John', 5, 2, 851.26, 873.90),
  ('Reid', 2, 5, 875.34, 1005.00),
  ('Caden', 5, 2, 954.56, 784.86),
  ('Mamby/Tenner', 2, 5, 860.36, 912.76),
  ('Wally', 3, 4, 756.48, 833.72),
  ('Freed', 4, 3, 862.68, 928.44),
  ('JM/Cameron', 1, 6, 852.64, 877.26),
  ('Big E', 3, 4, 896.08, 829.82)
) as v(manager_name, wins, losses, points_for, points_against)
join managers m on m.name = v.manager_name
join seasons s on s.year = 2026
where t.manager_id = m.id and t.season_id = s.id;

-- 3. Team names as ESPN has them now (Waddle Waddle became Team Toot; the
-- database still had the pre-season names for a couple of teams)
update teams t set team_name = v.team_name
from (values
  ('Wally', 'Team Wal'),
  ('Mamby/Tenner', 'Team Tenner n Mamby'),
  ('Big E', 'Run achane on her'),
  ('Freed', 'Team Toot'),
  ('John', 'Team Ittounas'),
  ('Braden', 'Kittle and Friends'),
  ('Caden', 'Greg''s Gang'),
  ('Reid', 'Team Rats'),
  ('JM/Cameron', 'UNITED FRONT'),
  ('Dan', 'The Dans')
) as v(manager_name, team_name)
join managers m on m.name = v.manager_name
join seasons s on s.year = 2026
where t.manager_id = m.id and t.season_id = s.id;
