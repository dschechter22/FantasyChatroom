-- Fantasy Chatroom 2026-27 Week 1 results.
-- Inserts the Week 1 matchups (with final scores) and sets each team's
-- Week 1 record/points on the teams table. Power Rankings and the LJ Index
-- both compute their stats live from matchups + teams, so no other page
-- needs a manual update once this runs.
--
-- Safe to re-run: the matchups insert is guarded by a NOT EXISTS check on
-- (season, week, home manager, away manager), and the teams update always
-- sets the same absolute Week 1 totals rather than incrementing.

-- 1. Matchups (home/away pairing per the fixed schedule in lib/schedule.js)
insert into matchups (season_id, week, home_team_id, away_team_id, home_score, away_score, league_id)
select s.id, 1, ht.id, at.id, v.home_score, v.away_score,
  (select league_id from managers where league_id is not null limit 1)
from (values
  ('Dan', 'Reid', 145.26, 113.46),
  ('Caden', 'John', 147.36, 161.32),
  ('Wally', 'Braden', 118.86, 128.56),
  ('JM/Cameron', 'Mamby/Tenner', 127.8, 128.12),
  ('Big E', 'Freed', 119.2, 126.06)
) as v(home_manager, away_manager, home_score, away_score)
join managers hm on hm.name = v.home_manager
join managers am on am.name = v.away_manager
cross join (select id from seasons where year = 2026) s
join teams ht on ht.season_id = s.id and ht.manager_id = hm.id
join teams at on at.season_id = s.id and at.manager_id = am.id
where not exists (
  select 1 from matchups m2
  where m2.season_id = s.id and m2.week = 1
    and m2.home_team_id = ht.id and m2.away_team_id = at.id
);

-- 2. Team records/points through Week 1
update teams t set
  wins = v.wins,
  losses = v.losses,
  points_for = v.points_for,
  points_against = v.points_against
from (values
  ('Dan', 1, 0, 145.26, 113.46),
  ('Reid', 0, 1, 113.46, 145.26),
  ('John', 1, 0, 161.32, 147.36),
  ('Caden', 0, 1, 147.36, 161.32),
  ('Braden', 1, 0, 128.56, 118.86),
  ('Wally', 0, 1, 118.86, 128.56),
  ('Mamby/Tenner', 1, 0, 128.12, 127.8),
  ('JM/Cameron', 0, 1, 127.8, 128.12),
  ('Freed', 1, 0, 126.06, 119.2),
  ('Big E', 0, 1, 119.2, 126.06)
) as v(manager_name, wins, losses, points_for, points_against)
join managers m on m.name = v.manager_name
join seasons s on s.year = 2026
where t.manager_id = m.id and t.season_id = s.id;
