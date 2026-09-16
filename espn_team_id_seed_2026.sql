-- Links each 2026-27 team to its ESPN numeric team id, so the automated
-- sync (app/api/espn-sync) can match ESPN's payload back to our teams
-- without fuzzy name matching. The mapping below comes from the
-- fantasy.espn.com/football/team?...&teamId=N URLs visible in each team's
-- own box score page.
--
-- Safe to re-run.

alter table teams add column if not exists espn_team_id integer;

update teams t set espn_team_id = v.espn_team_id
from (values
  ('Wally', 1),
  ('Dan', 2),
  ('Mamby/Tenner', 3),
  ('Big E', 4),
  ('Freed', 5),
  ('John', 6),
  ('Braden', 7),
  ('Caden', 8),
  ('Reid', 9),
  ('JM/Cameron', 10)
) as v(manager_name, espn_team_id)
join managers m on m.name = v.manager_name
join seasons s on s.year = 2026
where t.manager_id = m.id and t.season_id = s.id;
