-- Fantasy Chatroom 2026-27 Week 8 individual player fantasy points and roster.
-- Companion to week8_results_seed_2026.sql. Same fields /api/espn-sync writes:
--   stats.actual[8]  -- real fantasy points scored
--   stats.started[8] -- true for a starting slot, false for bench/IR
--   stats.proj[8]    -- ESPN's pre-game projection
--   stats.teamId[8]  -- which team owned the player in Week 8 (roster snapshot)
--
-- Rosters come straight from the Week 8 box scores: players new to a team get
-- teamId[8] and their team_id moved there; players who left a team simply have
-- no Week 8 snapshot. New pickups are added to players / roster_entries first.
-- league_id is taken from the team row, never a managers subquery.
--
-- Bye-week players (*BYE* on the box score) get no actual/proj for Week 8: no
-- game was played, and a 0 would drag down their season average and the
-- bye-week analysis. They are still on the roster and still bench.
--
-- Safe to re-run: every write sets the same absolute Week 8 values and never
-- touches any other week.

-- 1. Players not in the players table yet
insert into players (name, position)
select v.name, v.position from (values
  ('Jonah Coleman', 'RB'),
  ('Antonio Williams', 'WR'),
  ('Dalton Kincaid', 'TE'),
  ('Harold Fannin Jr.', 'TE'),
  ('Tyler Bass', 'K'),
  ('Corey Kiner', 'RB'),
  ('Malik Willis', 'QB'),
  ('Makai Lemon', 'WR'),
  ('Jaydon Blue', 'RB'),
  ('Jordan Addison', 'WR'),
  ('Kimani Vidal', 'RB'),
  ('Keenan Allen', 'WR'),
  ('Hunter Henry', 'TE'),
  ('Caleb Douglas', 'WR'),
  ('Jake Bates', 'K'),
  ('Tyler Goodson', 'RB'),
  ('Elijah Mitchell', 'RB'),
  ('Jacoby Brissett', 'QB')
) as v(name, position)
where not exists (
  select 1 from players p where regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(v.name), '[^a-z0-9]', '', 'g')
);

-- 2. Week 8 box scores (167 rows)
create table if not exists week_box_2026 (
  week integer not null,
  manager_name text not null,
  player_name text not null,
  proj numeric,
  actual numeric,
  started boolean not null
);
delete from week_box_2026 where week = 8;
insert into week_box_2026 (week, manager_name, player_name, proj, actual, started)
select 8, v.manager_name, v.player_name, v.proj, v.actual, v.started
from (values
  ('Dan','Lamar Jackson',23.2,0.0,true),
  ('Dan','Kenneth Walker III',21.4,12.9,true),
  ('Dan','Javonte Williams',22.2,8.2,true),
  ('Dan','Matthew Golden',14.4,19.4,true),
  ('Dan','Jalen Coker',13.5,9.1,true),
  ('Dan','Colston Loveland',10.6,10.0,true),
  ('Dan','Amon-Ra St. Brown',16.4,11.1,true),
  ('Dan','Luther Burden III',12.5,17.1,true),
  ('Dan','Brandon Aubrey',10.5,13.7,true),
  ('Dan','Dak Prescott',19.9,21.3,false),
  ('Dan','Emmett Johnson',5.8,25.8,false),
  ('Dan','Germie Bernard',9.7,6.5,false),
  ('Dan','Jonah Coleman',9.8,21.4,false),
  ('Dan','Antonio Williams',7.6,9.4,false),
  ('Dan','Dalton Kincaid',8.1,18.6,false),
  ('Dan','Harold Fannin Jr.',7.9,21.4,false),
  ('Dan','TreVeyon Henderson',0.0,0.0,false),

  ('Mamby/Tenner','Drake Maye',23.0,23.46,true),
  ('Mamby/Tenner','Bijan Robinson',21.3,8.6,true),
  ('Mamby/Tenner','D''Andre Swift',15.4,29.9,true),
  ('Mamby/Tenner','Garrett Wilson',13.0,14.3,true),
  ('Mamby/Tenner','Stefon Diggs',11.6,12.8,true),
  ('Mamby/Tenner','T.J. Hockenson',9.9,15.3,true),
  ('Mamby/Tenner','Tony Pollard',16.5,29.2,true),
  ('Mamby/Tenner','Aaron Jones Sr.',10.8,6.0,true),
  ('Mamby/Tenner','Tyler Bass',10.9,15.9,true),
  ('Mamby/Tenner','A.J. Brown',0.0,0.0,false),
  ('Mamby/Tenner','Nico Collins',null,null,false),
  ('Mamby/Tenner','RJ Harvey',0.0,0.0,false),
  ('Mamby/Tenner','Brian Robinson Jr.',0.0,0.0,false),
  ('Mamby/Tenner','Ka''imi Fairbairn',null,null,false),
  ('Mamby/Tenner','Khalil Shakir',8.6,10.4,false),
  ('Mamby/Tenner','Matthew Stafford',17.1,8.28,false),

  ('Reid','Jayden Daniels',24.0,15.48,true),
  ('Reid','Jaylen Warren',17.0,24.3,true),
  ('Reid','Corey Kiner',11.0,4.8,true),
  ('Reid','Jaxon Smith-Njigba',20.7,23.8,true),
  ('Reid','Tee Higgins',14.7,37.0,true),
  ('Reid','Sam LaPorta',9.8,6.0,true),
  ('Reid','Ladd McConkey',9.5,11.6,true),
  ('Reid','Tre Tucker',10.4,0.0,true),
  ('Reid','Harrison Butker',9.5,7.5,true),
  ('Reid','Jonathon Brooks',0.0,0.0,false),
  ('Reid','J.K. Dobbins',9.7,1.3,false),
  ('Reid','Dallas Goedert',9.6,6.2,false),
  ('Reid','Tyjae Spears',0.0,0.0,false),
  ('Reid','Kendre Miller',null,null,false),
  ('Reid','Mike Evans',null,null,false),
  ('Reid','Bo Nix',14.4,19.78,false),
  ('Reid','Travis Etienne Jr.',null,null,false),

  ('JM/Cameron','Malik Willis',16.8,15.14,true),
  ('JM/Cameron','Jahmyr Gibbs',26.1,28.3,true),
  ('JM/Cameron','Josh Jacobs',16.0,22.7,true),
  ('JM/Cameron','Drake London',16.9,1.3,true),
  ('JM/Cameron','Makai Lemon',8.9,9.7,true),
  ('JM/Cameron','Brenton Strange',8.8,7.0,true),
  ('JM/Cameron','Jeremiyah Love',12.3,2.8,true),
  ('JM/Cameron','Ollie Gordon II',15.8,8.9,true),
  ('JM/Cameron','Spencer Shrader',10.8,1.0,true),
  ('JM/Cameron','Cam Skattebo',null,null,false),
  ('JM/Cameron','Quinshon Judkins',12.0,6.9,false),
  ('JM/Cameron','Carnell Tate',0.0,0.0,false),
  ('JM/Cameron','Marvin Harrison Jr.',null,null,false),
  ('JM/Cameron','Brock Purdy',null,null,false),
  ('JM/Cameron','Keon Coleman',6.9,0.9,false),
  ('JM/Cameron','Jaydon Blue',3.5,6.4,false),
  ('JM/Cameron','Tyreek Hill',0.0,0.0,false),

  ('Wally','Caleb Williams',16.2,13.98,true),
  ('Wally','Omarion Hampton',9.0,3.7,true),
  ('Wally','Chase Brown',17.7,13.1,true),
  ('Wally','Jameson Williams',10.5,16.5,true),
  ('Wally','Darius Cooper',9.5,3.4,true),
  ('Wally','Tucker Kraft',9.8,16.3,true),
  ('Wally','Denzel Boston',10.9,8.2,true),
  ('Wally','Jordan Addison',9.3,10.6,true),
  ('Wally','Chad Ryland',10.2,9.9,true),
  ('Wally','DeVonta Smith',0.0,0.0,false),
  ('Wally','Malik Nabers',null,null,false),
  ('Wally','Jadarian Price',8.5,4.7,false),
  ('Wally','Kaelon Black',null,null,false),
  ('Wally','Bryce Young',17.3,10.36,false),
  ('Wally','Tyrone Tracy Jr.',null,null,false),
  ('Wally','Kimani Vidal',8.3,4.5,false),
  ('Wally','Jordyn Tyson',null,null,false),

  ('Big E','Trevor Lawrence',20.8,19.9,true),
  ('Big E','Jonathan Taylor',17.0,5.7,true),
  ('Big E','Chuba Hubbard',16.5,24.4,true),
  ('Big E','George Pickens',13.1,6.8,true),
  ('Big E','Parker Washington',15.6,4.1,true),
  ('Big E','Travis Kelce',8.5,10.2,true),
  ('Big E','Zach Charbonnet',11.5,4.9,true),
  ('Big E','Keenan Allen',8.0,12.7,true),
  ('Big E','Chris Boswell',11.1,8.7,true),
  ('Big E','Emeka Egbuka',0.0,0.0,false),
  ('Big E','Rome Odunze',8.7,12.7,false),
  ('Big E','Rico Dowdle',9.5,14.6,false),
  ('Big E','Isaiah Likely',null,null,false),
  ('Big E','Aaron Rodgers',15.3,4.88,false),
  ('Big E','Roschon Johnson',7.1,4.3,false),
  ('Big E','Devaughn Vele',null,null,false),
  ('Big E','Davante Adams',0.0,0.0,false),

  ('Caden','Josh Allen',24.8,27.56,true),
  ('Caden','Ashton Jeanty',17.1,9.8,true),
  ('Caden','Bucky Irving',18.6,24.0,true),
  ('Caden','Ja''Marr Chase',20.5,29.1,true),
  ('Caden','Omar Cooper Jr.',10.0,0.0,true),
  ('Caden','Hunter Henry',9.4,5.0,true),
  ('Caden','Rhamondre Stevenson',16.6,13.0,true),
  ('Caden','Michael Wilson',11.8,25.8,true),
  ('Caden','Will Reichard',11.9,1.0,true),
  ('Caden','Chris Olave',null,null,false),
  ('Caden','Jordan Mason',10.6,3.0,false),
  ('Caden','Mike Washington Jr.',7.7,10.8,false),
  ('Caden','Malik Washington',10.7,14.5,false),
  ('Caden','Jared Goff',16.3,9.54,false),
  ('Caden','Emanuel Wilson',7.5,0.0,false),
  ('Caden','Caleb Douglas',8.6,7.3,false),

  ('Freed','Kyler Murray',18.0,20.4,true),
  ('Freed','Derrick Henry',21.0,14.0,true),
  ('Freed','Bhayshul Tuten',15.9,31.4,true),
  ('Freed','Puka Nacua',21.6,21.5,true),
  ('Freed','Christian Watson',13.7,14.8,true),
  ('Freed','Brock Bowers',14.9,27.2,true),
  ('Freed','Saquon Barkley',15.0,12.9,true),
  ('Freed','Rachaad White',13.1,14.5,true),
  ('Freed','Jake Bates',9.0,6.2,true),
  ('Freed','Jaylen Waddle',9.9,14.4,false),
  ('Freed','Blake Corum',12.7,14.8,false),
  ('Freed','KC Concepcion',9.3,5.7,false),
  ('Freed','Rashee Rice',11.4,15.8,false),
  ('Freed','Patrick Mahomes',14.8,25.94,false),
  ('Freed','Tyler Goodson',8.9,9.3,false),
  ('Freed','Elijah Mitchell',8.9,6.7,false),
  ('Freed','Terrance Ferguson',0.0,0.0,false),

  ('John','Jacoby Brissett',16.0,3.96,true),
  ('John','James Cook III',20.9,20.6,true),
  ('John','Braelon Allen',19.0,26.8,true),
  ('John','CeeDee Lamb',19.0,11.3,true),
  ('John','DJ Moore',13.0,16.1,true),
  ('John','Trey McBride',15.7,18.7,true),
  ('John','DK Metcalf',11.6,0.9,true),
  ('John','Kyle Pitts Sr.',9.3,1.6,true),
  ('John','Matt Gay',10.7,10.3,true),
  ('John','Breece Hall',0.0,0.0,false),
  ('John','David Montgomery',null,null,false),
  ('John','Kyle Monangai',0.0,0.0,false),
  ('John','Woody Marks',null,null,false),
  ('John','Tyler Allgeier',8.5,37.1,false),
  ('John','C.J. Stroud',null,null,false),
  ('John','DeMario Douglas',10.3,16.6,false),
  ('John','Deebo Samuel Sr.',null,null,false),

  ('Braden','Joe Burrow',23.3,39.98,true),
  ('Braden','Kyren Williams',18.9,14.4,true),
  ('Braden','Seth McGowan',5.9,7.9,true),
  ('Braden','Zay Flowers',19.1,0.0,true),
  ('Braden','Tetairoa McMillan',14.6,10.8,true),
  ('Braden','Tyler Warren',10.1,4.3,true),
  ('Braden','Justin Jefferson',16.5,13.3,true),
  ('Braden','Kendrick Bourne',7.3,3.9,true),
  ('Braden','Tyler Loop',9.2,2.6,true),
  ('Braden','Christian McCaffrey',null,null,false),
  ('Braden','George Kittle',null,null,false),
  ('Braden','Josh Downs',7.6,10.8,false),
  ('Braden','Xavier Worthy',7.4,3.3,false),
  ('Braden','Tyler Shough',null,null,false),
  ('Braden','Alvin Kamara',null,null,false),
  ('Braden','Jordan Love',17.4,21.52,false)
) as v(manager_name, player_name, proj, actual, started);

-- 3. Roster rows for players who don't have one yet
insert into roster_entries (player_id, team_id, season_id, league_id, stats)
select distinct on (regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')) p.id, t.id, s.id, t.league_id, '{}'::jsonb
from week_box_2026 w
join managers m on m.name = w.manager_name
cross join (select id from seasons where year = 2026) s
join teams t on t.manager_id = m.id and t.season_id = s.id
join players p on regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
where w.week = 8
  and not exists (
    select 1 from roster_entries re
    join players p2 on p2.id = re.player_id
    where re.team_id in (select t.id from teams t join seasons s on s.id = t.season_id and s.year = 2026) and regexp_replace(lower(p2.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  )
order by regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g'), p.id;

-- 4. Week 8 stats + ownership snapshot, and point team_id at the current team
update roster_entries re
set team_id = t.id,
    stats = coalesce(re.stats, '{}'::jsonb) || jsonb_build_object(
      'teamId', coalesce(re.stats->'teamId', '{}'::jsonb) || jsonb_build_object('8', t.id::text),
      'started', coalesce(re.stats->'started', '{}'::jsonb) || jsonb_build_object('8', w.started),
      'actual', case when w.actual is null then coalesce(re.stats->'actual', '{}'::jsonb) - '8'
                     else coalesce(re.stats->'actual', '{}'::jsonb) || jsonb_build_object('8', w.actual) end,
      'proj', case when w.proj is null then coalesce(re.stats->'proj', '{}'::jsonb) - '8'
                   else coalesce(re.stats->'proj', '{}'::jsonb) || jsonb_build_object('8', w.proj) end
    )
from week_box_2026 w
join managers m on m.name = w.manager_name
join seasons s on s.year = 2026
join teams t on t.manager_id = m.id and t.season_id = s.id,
players pe
where w.week = 8
  and pe.id = re.player_id
  and regexp_replace(lower(pe.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  and re.team_id in (select t.id from teams t join seasons s on s.id = t.season_id and s.year = 2026);

-- Check 1: players on each team's Week 8 roster by snapshot. Expect 16-17 per
-- team, identical to the ESPN box score (Mamby/Tenner, Caden and Braden have 16).
select m.name as manager, count(*) as wk8_roster
from teams t
join seasons s on s.id = t.season_id and s.year = 2026
join managers m on m.id = t.manager_id
join roster_entries re on re.stats->'teamId'->>'8' = t.id::text
group by m.name order by m.name;

-- Check 2: box-score rows that matched no roster_entries row (send me any).
select w.manager_name, w.player_name
from week_box_2026 w
left join managers m on m.name = w.manager_name
left join seasons s on s.year = 2026
left join teams t on t.manager_id = m.id and t.season_id = s.id
where w.week = 8
  and not exists (
    select 1 from roster_entries re
    join players pe on pe.id = re.player_id
    where re.team_id = t.id and re.stats->'teamId'->>'8' = t.id::text
      and regexp_replace(lower(pe.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  );

drop table week_box_2026;
