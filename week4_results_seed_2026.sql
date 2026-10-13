-- Fantasy Chatroom 2026-27 Week 4 results.
-- Inserts the Week 4 matchups (with final scores) and sets each team's
-- record/points through Week 4 on the teams table. Power Rankings and the
-- LJ Index both compute their stats live from matchups + teams, so no other
-- page needs a manual update once this runs.
--
-- Safe to re-run: the matchups insert is guarded by a NOT EXISTS check on
-- (season, week, home manager, away manager), and the teams update always
-- sets the same absolute through-Week-4 totals rather than incrementing.

-- 1. Matchups
insert into matchups (season_id, week, home_team_id, away_team_id, home_score, away_score, league_id)
select s.id, 4, ht.id, at.id, v.home_score, v.away_score,
  (select league_id from managers where league_id is not null limit 1)
from (values
  ('Dan', 'JM/Cameron', 142.98, 130.22),
  ('Mamby/Tenner', 'Reid', 162.16, 97.90),
  ('Braden', 'Freed', 169.74, 131.28),
  ('John', 'Big E', 106.42, 97.48),
  ('Caden', 'Wally', 143.72, 128.16)
) as v(home_manager, away_manager, home_score, away_score)
join managers hm on hm.name = v.home_manager
join managers am on am.name = v.away_manager
cross join (select id from seasons where year = 2026) s
join teams ht on ht.season_id = s.id and ht.manager_id = hm.id
join teams at on at.season_id = s.id and at.manager_id = am.id
where not exists (
  select 1 from matchups m2
  where m2.season_id = s.id and m2.week = 4
    and m2.home_team_id = ht.id and m2.away_team_id = at.id
);

-- 2. Team records/points through Week 4 (Week 3 totals + Week 4 result)
update teams t set
  wins = v.wins,
  losses = v.losses,
  points_for = v.points_for,
  points_against = v.points_against
from (values
  ('Dan', 2, 2, 553.38, 526.18),
  ('Braden', 4, 0, 577.38, 508.34),
  ('John', 4, 0, 517.32, 488.44),
  ('Reid', 0, 4, 460.80, 570.18),
  ('Caden', 3, 1, 557.96, 486.78),
  ('Mamby/Tenner', 2, 2, 498.46, 490.24),
  ('Wally', 0, 4, 404.48, 536.64),
  ('Freed', 3, 1, 498.44, 510.60),
  ('JM/Cameron', 1, 3, 513.20, 492.60),
  ('Big E', 1, 3, 478.72, 450.14)
) as v(manager_name, wins, losses, points_for, points_against)
join managers m on m.name = v.manager_name
join seasons s on s.year = 2026
where t.manager_id = m.id and t.season_id = s.id;
