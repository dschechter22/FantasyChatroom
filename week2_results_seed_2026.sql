-- Fantasy Chatroom 2026-27 Week 2 results.
-- Inserts the Week 2 matchups (with final scores) and sets each team's
-- record/points through Week 2 on the teams table. Power Rankings and the
-- LJ Index both compute their stats live from matchups + teams, so no other
-- page needs a manual update once this runs.
--
-- Safe to re-run: the matchups insert is guarded by a NOT EXISTS check on
-- (season, week, home manager, away manager), and the teams update always
-- sets the same absolute through-Week-2 totals rather than incrementing.

-- 1. Matchups
insert into matchups (season_id, week, home_team_id, away_team_id, home_score, away_score, league_id)
select s.id, 2, ht.id, at.id, v.home_score, v.away_score,
  (select league_id from managers where league_id is not null limit 1)
from (values
  ('Dan', 'Braden', 128.1, 138.58),
  ('John', 'Reid', 122.26, 119.34),
  ('Caden', 'Mamby/Tenner', 137.22, 83.92),
  ('Wally', 'Freed', 84.62, 97.18),
  ('JM/Cameron', 'Big E', 88.0, 148.66)
) as v(home_manager, away_manager, home_score, away_score)
join managers hm on hm.name = v.home_manager
join managers am on am.name = v.away_manager
cross join (select id from seasons where year = 2026) s
join teams ht on ht.season_id = s.id and ht.manager_id = hm.id
join teams at on at.season_id = s.id and at.manager_id = am.id
where not exists (
  select 1 from matchups m2
  where m2.season_id = s.id and m2.week = 2
    and m2.home_team_id = ht.id and m2.away_team_id = at.id
);

-- 2. Team records/points through Week 2 (Week 1 totals + Week 2 result)
update teams t set
  wins = v.wins,
  losses = v.losses,
  points_for = v.points_for,
  points_against = v.points_against
from (values
  ('Dan', 1, 1, 273.36, 252.04),
  ('Braden', 2, 0, 267.14, 246.96),
  ('John', 2, 0, 283.58, 266.70),
  ('Reid', 0, 2, 232.80, 267.52),
  ('Caden', 1, 1, 284.58, 245.24),
  ('Mamby/Tenner', 1, 1, 212.04, 265.02),
  ('Wally', 0, 2, 203.48, 225.74),
  ('Freed', 2, 0, 223.24, 203.82),
  ('JM/Cameron', 0, 2, 215.80, 276.78),
  ('Big E', 1, 1, 267.86, 214.06)
) as v(manager_name, wins, losses, points_for, points_against)
join managers m on m.name = v.manager_name
join seasons s on s.year = 2026
where t.manager_id = m.id and t.season_id = s.id;
