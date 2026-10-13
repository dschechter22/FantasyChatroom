-- Fantasy Chatroom 2026-27 Week 3 results.
-- Inserts the Week 3 matchups (with final scores) and sets each team's
-- record/points through Week 3 on the teams table. Power Rankings and the
-- LJ Index both compute their stats live from matchups + teams, so no other
-- page needs a manual update once this runs.
--
-- Safe to re-run: the matchups insert is guarded by a NOT EXISTS check on
-- (season, week, home manager, away manager), and the teams update always
-- sets the same absolute through-Week-3 totals rather than incrementing.

-- 1. Matchups
insert into matchups (season_id, week, home_team_id, away_team_id, home_score, away_score, league_id)
select s.id, 3, ht.id, at.id, v.home_score, v.away_score,
  ht.league_id
from (values
  ('Freed', 'Dan', 143.92, 137.04),
  ('Reid', 'Braden', 130.10, 140.50),
  ('Mamby/Tenner', 'John', 124.26, 127.32),
  ('Big E', 'Caden', 113.38, 129.66),
  ('JM/Cameron', 'Wally', 167.18, 72.84)
) as v(home_manager, away_manager, home_score, away_score)
join managers hm on hm.name = v.home_manager
join managers am on am.name = v.away_manager
cross join (select id from seasons where year = 2026) s
join teams ht on ht.season_id = s.id and ht.manager_id = hm.id
join teams at on at.season_id = s.id and at.manager_id = am.id
where not exists (
  select 1 from matchups m2
  where m2.season_id = s.id and m2.week = 3
    and m2.home_team_id = ht.id and m2.away_team_id = at.id
);

-- 2. Team records/points through Week 3 (Week 2 totals + Week 3 result)
update teams t set
  wins = v.wins,
  losses = v.losses,
  points_for = v.points_for,
  points_against = v.points_against
from (values
  ('Dan', 1, 2, 410.40, 395.96),
  ('Braden', 3, 0, 407.64, 377.06),
  ('John', 3, 0, 410.90, 390.96),
  ('Reid', 0, 3, 362.90, 408.02),
  ('Caden', 2, 1, 414.24, 358.62),
  ('Mamby/Tenner', 1, 2, 336.30, 392.34),
  ('Wally', 0, 3, 276.32, 392.92),
  ('Freed', 3, 0, 367.16, 340.86),
  ('JM/Cameron', 1, 2, 382.98, 349.62),
  ('Big E', 1, 2, 381.24, 343.72)
) as v(manager_name, wins, losses, points_for, points_against)
join managers m on m.name = v.manager_name
join seasons s on s.year = 2026
where t.manager_id = m.id and t.season_id = s.id;
