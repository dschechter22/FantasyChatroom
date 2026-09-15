-- Fantasy Chatroom 2026-27 Week 2 per-player projections, from ESPN box score pages.
-- Stored as roster_entries.stats->'proj'->'2' so lib/predictions.js's
-- projectedWeekScore() can build real Week 2 forward lines for the
-- Predictions and Preweek pages. Safe to re-run.
--
-- Bench projections were not available (ESPN's "Show Bench" panel was
-- collapsed in the source page) for Wally, Freed, JM/Cameron, and Big E --
-- only their 9 starters are seeded below. That just means
-- projectedWeekScore() can't swap in a higher-projected bench player for
-- those four teams this week; it does not affect anyone else.
--
-- Brock Bowers (Freed/Waddle Waddle, IR slot) is seeded at 13.5 per an
-- explicit note on the source page that he's expected to play -- letting
-- projectedWeekScore() naturally pull him in over Terrance Ferguson (5.8)
-- at TE if he does.
--
-- Builds the nested {proj: {2: ...}} object with || merges rather than
-- jsonb_set(), since jsonb_set only creates the *last* segment of a path
-- when missing -- with existing stats of '{proj: {1: ...}}' it would
-- silently overwrite the whole 'proj' object instead of adding key '2'.

with proj_data (manager_name, player_name, proj) as (
  values
    ('Dan', 'Lamar Jackson', 21.4),
    ('Dan', 'Kenneth Walker III', 19.3),
    ('Dan', 'Javonte Williams', 18.9),
    ('Dan', 'Amon-Ra St. Brown', 18.7),
    ('Dan', 'Luther Burden III', 11.8),
    ('Dan', 'Colston Loveland', 10.5),
    ('Dan', 'Matthew Golden', 10.4),
    ('Dan', 'Jalen Coker', 10.4),
    ('Dan', 'Brandon Aubrey', 11.3),
    ('Dan', 'Alec Pierce', 10.7),
    ('Dan', 'Michael Pittman Jr.', 10.1),
    ('Dan', 'Dak Prescott', 20.2),
    ('Dan', 'Emmett Johnson', 5.8),
    ('Dan', 'Juwan Johnson', 7.9),
    ('Dan', 'Keaton Mitchell', 9.3),
    ('Dan', 'Tre Tucker', 7.9),

    ('Braden', 'Joe Burrow', 17.0),
    ('Braden', 'Christian McCaffrey', 22.2),
    ('Braden', 'Kyren Williams', 14.9),
    ('Braden', 'Justin Jefferson', 16.8),
    ('Braden', 'Zay Flowers', 14.1),
    ('Braden', 'Tyler Warren', 10.6),
    ('Braden', 'Tetairoa McMillan', 12.7),
    ('Braden', 'Kenny Gainwell', 10.5),
    ('Braden', 'Jake Bates', 8.9),
    ('Braden', 'Jayden Reed', 9.4),
    ('Braden', 'George Kittle', 9.5),
    ('Braden', 'Josh Downs', 8.1),
    ('Braden', 'Chris Rodriguez Jr.', 6.4),
    ('Braden', 'Xavier Worthy', 10.5),
    ('Braden', 'Tyler Shough', 16.0),
    ('Braden', 'Alvin Kamara', 5.3),

    ('John', 'Jalen Hurts', 20.6),
    ('John', 'James Cook III', 18.1),
    ('John', 'Breece Hall', 17.2),
    ('John', 'CeeDee Lamb', 17.4),
    ('John', 'DJ Moore', 11.9),
    ('John', 'Trey McBride', 12.7),
    ('John', 'David Montgomery', 15.3),
    ('John', 'Deebo Samuel Sr.', 13.7),
    ('John', 'Jason Myers', 9.9),
    ('John', 'DK Metcalf', 10.7),
    ('John', 'Jordan Addison', 9.3),
    ('John', 'Kyle Monangai', 10.8),
    ('John', 'Rachaad White', 8.6),
    ('John', 'Romeo Doubs', 10.0),
    ('John', 'Woody Marks', 8.9),
    ('John', 'Ray Davis', 3.3),

    ('Reid', 'Jayden Daniels', 20.5),
    ('Reid', 'Saquon Barkley', 18.4),
    ('Reid', 'Travis Etienne Jr.', 13.1),
    ('Reid', 'Jaxon Smith-Njigba', 17.0),
    ('Reid', 'Rashee Rice', 14.5),
    ('Reid', 'Sam LaPorta', 10.0),
    ('Reid', 'Ladd McConkey', 13.2),
    ('Reid', 'Tee Higgins', 11.3),
    ('Reid', 'Cameron Dicker', 10.6),
    ('Reid', 'Jonathon Brooks', 9.0),
    ('Reid', 'J.K. Dobbins', 12.9),
    ('Reid', 'Wan''Dale Robinson', 8.7),
    ('Reid', 'Dallas Goedert', 9.9),
    ('Reid', 'Patrick Mahomes', 19.0),
    ('Reid', 'Tyjae Spears', 8.4),
    ('Reid', 'Chris Bell', 6.4),

    ('Caden', 'Josh Allen', 24.0),
    ('Caden', 'Ashton Jeanty', 18.1),
    ('Caden', 'Bucky Irving', 14.7),
    ('Caden', 'Ja''Marr Chase', 17.5),
    ('Caden', 'Chris Olave', 14.4),
    ('Caden', 'Harold Fannin Jr.', 9.1),
    ('Caden', 'Terry McLaurin', 11.6),
    ('Caden', 'Rhamondre Stevenson', 14.0),
    ('Caden', 'Will Reichard', 9.0),
    ('Caden', 'Michael Wilson', 9.2),
    ('Caden', 'Jordan Mason', 11.5),
    ('Caden', 'Jakobi Meyers', 8.7),
    ('Caden', 'Tyler Allgeier', 7.9),
    ('Caden', 'Mike Washington Jr.', 4.0),
    ('Caden', 'Malik Washington', 10.0),
    ('Caden', 'Ja''Kobi Lane', 0.0),

    ('Mamby/Tenner', 'Drake Maye', 18.9),
    ('Mamby/Tenner', 'Bijan Robinson', 23.8),
    ('Mamby/Tenner', 'D''Andre Swift', 15.4),
    ('Mamby/Tenner', 'Nico Collins', 14.7),
    ('Mamby/Tenner', 'Garrett Wilson', 14.0),
    ('Mamby/Tenner', 'Kyle Pitts Sr.', 10.1),
    ('Mamby/Tenner', 'Courtland Sutton', 10.9),
    ('Mamby/Tenner', 'Tony Pollard', 12.3),
    ('Mamby/Tenner', 'Ka''imi Fairbairn', 10.3),
    ('Mamby/Tenner', 'Stefon Diggs', 9.8),
    ('Mamby/Tenner', 'Aaron Jones Sr.', 11.5),
    ('Mamby/Tenner', 'RJ Harvey', 12.3),
    ('Mamby/Tenner', 'Mark Andrews', 9.5),
    ('Mamby/Tenner', 'Brian Robinson Jr.', 7.9),
    ('Mamby/Tenner', 'Baker Mayfield', 17.1),

    -- Starters only -- bench not shown on the source page this week.
    ('Wally', 'Caleb Williams', 19.2),
    ('Wally', 'Omarion Hampton', 17.3),
    ('Wally', 'Chase Brown', 15.8),
    ('Wally', 'DeVonta Smith', 12.9),
    ('Wally', 'Jameson Williams', 11.7),
    ('Wally', 'Tucker Kraft', 9.9),
    ('Wally', 'Jadarian Price', 14.3),
    ('Wally', 'MarShawn Lloyd', 12.7),
    ('Wally', 'Cam Little', 8.6),

    -- Starters only -- bench not shown on the source page this week.
    -- Brock Bowers (IR) seeded per source note: "if Bowers plays his
    -- projection is 13.5, assume he is playing."
    ('Freed', 'Justin Herbert', 19.8),
    ('Freed', 'Derrick Henry', 19.5),
    ('Freed', 'Bhayshul Tuten', 10.0),
    ('Freed', 'Puka Nacua', 19.9),
    ('Freed', 'Mike Evans', 12.0),
    ('Freed', 'Terrance Ferguson', 5.8),
    ('Freed', 'Jaylen Waddle', 11.4),
    ('Freed', 'Christian Watson', 11.8),
    ('Freed', 'Harrison Mevis', 10.0),
    ('Freed', 'Brock Bowers', 13.5),

    -- Starters only -- bench not shown on the source page this week.
    ('JM/Cameron', 'Jaxson Dart', 19.7),
    ('JM/Cameron', 'Jahmyr Gibbs', 25.1),
    ('JM/Cameron', 'Quinshon Judkins', 13.0),
    ('JM/Cameron', 'Drake London', 14.5),
    ('JM/Cameron', 'Carnell Tate', 10.6),
    ('JM/Cameron', 'Dalton Kincaid', 9.6),
    ('JM/Cameron', 'Jeremiyah Love', 13.3),
    ('JM/Cameron', 'Cam Skattebo', 13.6),
    ('JM/Cameron', 'Eddy Pineiro', 10.4),

    -- Starters only -- bench not shown on the source page this week.
    ('Big E', 'Trevor Lawrence', 16.3),
    ('Big E', 'Jonathan Taylor', 19.1),
    ('Big E', 'De''Von Achane', 17.6),
    ('Big E', 'George Pickens', 14.1),
    ('Big E', 'Emeka Egbuka', 13.3),
    ('Big E', 'Isaiah Likely', 10.0),
    ('Big E', 'Davante Adams', 13.2),
    ('Big E', 'Chuba Hubbard', 15.2),
    ('Big E', 'Harrison Butker', 9.5)
),
resolved as (
  select re.id as roster_entry_id, pd.proj
  from proj_data pd
  join managers m on m.name = pd.manager_name
  join teams t on t.manager_id = m.id
  join seasons s on s.id = t.season_id and s.year = 2026
  join players p on p.name = pd.player_name
  join roster_entries re on re.team_id = t.id and re.player_id = p.id
)
update roster_entries
set stats = coalesce(roster_entries.stats, '{}'::jsonb)
  || jsonb_build_object(
       'proj',
       coalesce(roster_entries.stats -> 'proj', '{}'::jsonb) || jsonb_build_object('2', resolved.proj)
     )
from resolved
where roster_entries.id = resolved.roster_entry_id;
