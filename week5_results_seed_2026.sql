-- Fantasy Chatroom 2026-27 Week 5 results.
-- Inserts the Week 5 matchups (with final scores) and sets each team's
-- record/points through Week 5 on the teams table. Power Rankings, the
-- LJ Index and the bye-week analysis all compute live from matchups + teams,
-- so no other page needs a manual update once this runs.
--
-- Safe to re-run: the matchups insert is guarded by a NOT EXISTS check on
-- (season, week, home manager, away manager) -- if the ESPN sync already
-- inserted Week 5 with the teams the other way round, the sync's own
-- either-orientation match keeps it from duplicating -- and the teams update
-- always sets the same absolute through-Week-5 totals rather than incrementing.
--
-- Step 0 repairs a real gap this surfaced: the ESPN sync's matchups insert
-- didn't set league_id at all, and this script's own insert used to pull it
-- from a `limit 1` subquery on managers with no order by -- non-deterministic,
-- and whichever row it grabbed could be wrong. Either way, a Week 5 row with
-- a missing/wrong league_id is invisible to every page's .eq('league_id', ...)
-- filter even though the matchup row and the teams update both look fine.
-- This backfills it from the home team's own (reliable) league_id so
-- re-running this script fixes it regardless of which path inserted the row.

-- 0. Repair league_id on any Week 5 row already inserted (by this script on
-- a prior run, or by the ESPN sync beating it to the row)
update matchups m set league_id = ht.league_id
from teams ht, (select id from seasons where year = 2026) s
where m.home_team_id = ht.id and m.season_id = s.id and m.week = 5
  and (m.league_id is distinct from ht.league_id);

-- 1. Matchups (home/away per the league's fixed schedule)
insert into matchups (season_id, week, home_team_id, away_team_id, home_score, away_score, league_id)
select s.id, 5, ht.id, at.id, v.home_score, v.away_score,
  ht.league_id
from (values
  ('Freed', 'Reid', 158.26, 171.56),
  ('Mamby/Tenner', 'Big E', 153.16, 173.44),
  ('Braden', 'JM/Cameron', 137.70, 119.56),
  ('John', 'Wally', 96.40, 131.38),
  ('Dan', 'Caden', 79.64, 143.78)
) as v(home_manager, away_manager, home_score, away_score)
join managers hm on hm.name = v.home_manager
join managers am on am.name = v.away_manager
cross join (select id from seasons where year = 2026) s
join teams ht on ht.season_id = s.id and ht.manager_id = hm.id
join teams at on at.season_id = s.id and at.manager_id = am.id
where not exists (
  select 1 from matchups m2
  where m2.season_id = s.id and m2.week = 5
    and ((m2.home_team_id = ht.id and m2.away_team_id = at.id)
      or (m2.home_team_id = at.id and m2.away_team_id = ht.id))
);

-- 1b. Overwrite the scores on any Week 5 rows that already exist. The daily
-- ESPN sync creates the current week's matchups mid-week with whatever partial
-- scores ESPN had at that moment, and the insert above skips a pair that's
-- already there -- so without this, a game keeps its stale score and the
-- standings never see the final result.
update matchups m set
  home_score = case when m.home_team_id = ht.id then v.home_score else v.away_score end,
  away_score = case when m.home_team_id = ht.id then v.away_score else v.home_score end
from (values
  ('Freed', 'Reid', 158.26, 171.56),
  ('Mamby/Tenner', 'Big E', 153.16, 173.44),
  ('Braden', 'JM/Cameron', 137.70, 119.56),
  ('John', 'Wally', 96.40, 131.38),
  ('Dan', 'Caden', 79.64, 143.78)
) as v(home_manager, away_manager, home_score, away_score)
join managers hm on hm.name = v.home_manager
join managers am on am.name = v.away_manager
cross join (select id from seasons where year = 2026) s
join teams ht on ht.season_id = s.id and ht.manager_id = hm.id
join teams at on at.season_id = s.id and at.manager_id = am.id
where m.season_id = s.id and m.week = 5
  and ((m.home_team_id = ht.id and m.away_team_id = at.id)
    or (m.home_team_id = at.id and m.away_team_id = ht.id));

-- 2. Team records/points through Week 5 (Week 4 totals + Week 5 result)
update teams t set
  wins = v.wins,
  losses = v.losses,
  points_for = v.points_for,
  points_against = v.points_against
from (values
  ('Dan', 2, 3, 633.02, 669.96),
  ('Braden', 5, 0, 715.08, 627.90),
  ('John', 4, 1, 613.72, 619.82),
  ('Reid', 1, 4, 632.36, 728.44),
  ('Caden', 4, 1, 701.74, 566.42),
  ('Mamby/Tenner', 2, 3, 651.62, 663.68),
  ('Wally', 1, 4, 535.86, 633.04),
  ('Freed', 3, 2, 656.70, 682.16),
  ('JM/Cameron', 1, 4, 632.76, 630.30),
  ('Big E', 2, 3, 652.16, 603.30)
) as v(manager_name, wins, losses, points_for, points_against)
join managers m on m.name = v.manager_name
join seasons s on s.year = 2026
where t.manager_id = m.id and t.season_id = s.id;
