-- Fantasy Chatroom 2026-27 Week 1 actual per-player results + started/benched
-- flags, from ESPN's Week 1 box scores.
--
-- Stores roster_entries.stats.actual['1'] (points actually scored) and
-- stats.started['1'] (true if the player was in the starting lineup, false
-- if benched/IR) so lib/predictions.js's lineupEfficiency() can answer
-- "did you start the right players" for the Scoreboard drilldown and the
-- Start % column on Power Rankings.
--
-- Only 4 of the 10 teams had full player-by-player box scores available for
-- Week 1 (Team Rats, The Dans, Team Ittounas, Greg's Gang) -- the other 6
-- teams only had team totals on file, so their Week 1 Start % will read
-- "not enough data yet" until their box scores are pasted too.
--
-- Safe to re-run: same || merge pattern as week1_proj_seed_2026.sql /
-- week2_proj_seed_2026.sql, just writing into 'actual' and 'started' instead
-- of 'proj'.

with week1_actual (manager_name, player_name, actual, started) as (
  values
    -- Reid / Team Rats -- starters
    ('Reid', 'Jayden Daniels', 18.16, true),
    ('Reid', 'Saquon Barkley', 9.5, true),
    ('Reid', 'Travis Etienne Jr.', 13.3, true),
    ('Reid', 'Jaxon Smith-Njigba', 24.7, true),
    ('Reid', 'Rashee Rice', 9.4, true),
    ('Reid', 'Sam LaPorta', 8.3, true),
    ('Reid', 'Ladd McConkey', 19.2, true),
    ('Reid', 'Tee Higgins', 8.9, true),
    ('Reid', 'Cameron Dicker', 2.0, true),
    -- Reid / Team Rats -- bench
    ('Reid', 'Jonathon Brooks', 7.2, false),
    ('Reid', 'J.K. Dobbins', 4.1, false),
    ('Reid', 'Wan''Dale Robinson', 7.8, false),
    ('Reid', 'Dallas Goedert', 23.2, false),
    ('Reid', 'Patrick Mahomes', 22.66, false),
    ('Reid', 'Tyjae Spears', 3.9, false),
    ('Reid', 'Chris Bell', 3.5, false),

    -- Dan / The Dans -- starters
    ('Dan', 'Lamar Jackson', 26.46, true),
    ('Dan', 'Kenneth Walker III', 37.6, true),
    ('Dan', 'Javonte Williams', 23.7, true),
    ('Dan', 'Amon-Ra St. Brown', 25.7, true),
    ('Dan', 'Luther Burden III', 8.0, true),
    ('Dan', 'Colston Loveland', 0.0, true),
    ('Dan', 'Matthew Golden', 14.5, true),
    ('Dan', 'Michael Pittman Jr.', 8.3, true),
    ('Dan', 'Brandon Aubrey', 1.0, true),
    -- Dan / The Dans -- bench
    ('Dan', 'Alec Pierce', 10.1, false),
    ('Dan', 'Dak Prescott', 14.9, false),
    ('Dan', 'Emmett Johnson', 8.8, false),
    ('Dan', 'Juwan Johnson', 14.4, false),
    ('Dan', 'Jalen Coker', 32.8, false),
    ('Dan', 'Keaton Mitchell', 1.9, false),
    ('Dan', 'Tre Tucker', 4.2, false),
    ('Dan', 'TreVeyon Henderson', 0.0, false),

    -- John / Team Ittounas -- starters
    ('John', 'Jalen Hurts', 25.72, true),
    ('John', 'James Cook III', 10.9, true),
    ('John', 'Breece Hall', 22.3, true),
    ('John', 'CeeDee Lamb', 15.4, true),
    ('John', 'DJ Moore', 20.5, true),
    ('John', 'Trey McBride', 23.0, true),
    ('John', 'David Montgomery', 29.9, true),
    ('John', 'DK Metcalf', 7.0, true),
    ('John', 'Jason Myers', 6.6, true),
    -- John / Team Ittounas -- bench
    ('John', 'Jordan Addison', 0.0, false),
    ('John', 'Kyle Monangai', 20.9, false),
    ('John', 'Rachaad White', 6.2, false),
    ('John', 'Deebo Samuel Sr.', 19.0, false),
    ('John', 'Romeo Doubs', 0.0, false),
    ('John', 'Woody Marks', 9.5, false),
    ('John', 'Ray Davis', 2.3, false),

    -- Caden / Greg's Gang -- starters
    ('Caden', 'Josh Allen', 36.66, true),
    ('Caden', 'Ashton Jeanty', 34.2, true),
    ('Caden', 'Bucky Irving', 19.3, true),
    ('Caden', 'Ja''Marr Chase', 2.7, true),
    ('Caden', 'Chris Olave', 26.7, true),
    ('Caden', 'Harold Fannin Jr.', 3.6, true),
    ('Caden', 'Terry McLaurin', 2.9, true),
    ('Caden', 'Rhamondre Stevenson', 13.5, true),
    ('Caden', 'Will Reichard', 7.8, true),
    -- Caden / Greg's Gang -- bench
    ('Caden', 'Michael Wilson', 9.6, false),
    ('Caden', 'Jordan Mason', 12.9, false),
    ('Caden', 'Jakobi Meyers', 12.7, false),
    ('Caden', 'Tyler Allgeier', 9.0, false),
    ('Caden', 'Mike Washington Jr.', 4.6, false),
    ('Caden', 'Malik Washington', 7.3, false),
    ('Caden', 'Ja''Kobi Lane', 1.6, false)
),
resolved as (
  select re.id as roster_entry_id, wa.actual, wa.started
  from week1_actual wa
  join managers m on m.name = wa.manager_name
  join teams t on t.manager_id = m.id
  join seasons s on s.id = t.season_id and s.year = 2026
  join players p on p.name = wa.player_name
  join roster_entries re on re.team_id = t.id and re.player_id = p.id
)
update roster_entries
set stats = coalesce(roster_entries.stats, '{}'::jsonb)
  || jsonb_build_object(
       'actual',
       coalesce(roster_entries.stats -> 'actual', '{}'::jsonb) || jsonb_build_object('1', resolved.actual)
     )
  || jsonb_build_object(
       'started',
       coalesce(roster_entries.stats -> 'started', '{}'::jsonb) || jsonb_build_object('1', resolved.started)
     )
from resolved
where roster_entries.id = resolved.roster_entry_id;
