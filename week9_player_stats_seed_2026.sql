-- Fantasy Chatroom 2026-27 Week 9 individual player fantasy points and roster.
-- Companion to week9_results_seed_2026.sql. Same fields /api/espn-sync writes:
--   stats.actual[9]  -- real fantasy points scored
--   stats.started[9] -- true for a starting slot, false for bench/IR
--   stats.proj[9]    -- ESPN's pre-game projection
--   stats.teamId[9]  -- which team owned the player in Week 9 (roster snapshot)
--
-- Rosters come straight from the Week 9 box scores: players new to a team get
-- teamId[9] and their team_id moved there; players who left a team simply have
-- no Week 9 snapshot. New pickups are added to players / roster_entries first.
-- league_id is taken from the team row, never a managers subquery.
--
-- Bye-week players (*BYE* on the box score) get no actual/proj for Week 9: no
-- game was played, and a 0 would drag down their season average and the
-- bye-week analysis. They are still on the roster and still bench.
--
-- Safe to re-run: every write sets the same absolute Week 9 values and never
-- touches any other week.

-- 1. Players not in the players table yet
insert into players (name, position)
select v.name, v.position from (values
  ('Kirk Cousins', 'QB'),
  ('Dylan Sampson', 'RB'),
  ('Keaton Mitchell', 'RB'),
  ('Chris Rodriguez Jr.', 'RB'),
  ('Kenny Gainwell', 'RB'),
  ('Audric Estime', 'RB'),
  ('Adonai Mitchell', 'WR'),
  ('Lamar Jackson', 'QB'),
  ('Brandon Aiyuk', 'WR'),
  ('Chase McLaughlin', 'K'),
  ('Dominic Zvada', 'K'),
  ('Devin Singletary', 'RB'),
  ('Jakobi Meyers', 'WR'),
  ('Wil Lutz', 'K')
) as v(name, position)
where not exists (
  select 1 from players p where regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(v.name), '[^a-z0-9]', '', 'g')
);

-- 2. Week 9 box scores (167 rows)
create table if not exists week_box_2026 (
  week integer not null,
  manager_name text not null,
  player_name text not null,
  proj numeric,
  actual numeric,
  started boolean not null
);
delete from week_box_2026 where week = 9;
insert into week_box_2026 (week, manager_name, player_name, proj, actual, started)
select 9, v.manager_name, v.player_name, v.proj, v.actual, v.started
from (values
  ('Dan','Dak Prescott',19.6,19.5,true),
  ('Dan','Kenneth Walker III',24.9,38.3,true),
  ('Dan','Javonte Williams',19.2,22.9,true),
  ('Dan','Amon-Ra St. Brown',19.1,14.6,true),
  ('Dan','Matthew Golden',16.3,30.9,true),
  ('Dan','Colston Loveland',11.1,7.9,true),
  ('Dan','Luther Burden III',13.0,18.2,true),
  ('Dan','Jonah Coleman',15.2,18.8,true),
  ('Dan','Brandon Aubrey',11.1,10.3,true),
  ('Dan','Emmett Johnson',8.3,11.4,false),
  ('Dan','Jalen Coker',11.2,5.6,false),
  ('Dan','Germie Bernard',null,null,false),
  ('Dan','Antonio Williams',9.2,4.5,false),
  ('Dan','Dalton Kincaid',7.9,5.3,false),
  ('Dan','Harold Fannin Jr.',10.5,11.7,false),
  ('Dan','Kirk Cousins',15.0,13.14,false),
  ('Dan','TreVeyon Henderson',0.0,0.0,false),

  ('Wally','Caleb Williams',17.5,13.76,true),
  ('Wally','Omarion Hampton',9.5,7.0,true),
  ('Wally','Chase Brown',17.1,11.0,true),
  ('Wally','Malik Nabers',16.0,7.8,true),
  ('Wally','Jameson Williams',13.3,5.0,true),
  ('Wally','Tucker Kraft',9.6,1.4,true),
  ('Wally','Jadarian Price',12.0,13.8,true),
  ('Wally','Kaelon Black',12.0,9.0,true),
  ('Wally','Chad Ryland',10.2,2.8,true),
  ('Wally','DeVonta Smith',0.0,0.0,false),
  ('Wally','Bryce Young',16.1,20.84,false),
  ('Wally','Denzel Boston',12.0,14.3,false),
  ('Wally','Tyrone Tracy Jr.',0.0,0.0,false),
  ('Wally','Kimani Vidal',9.4,7.1,false),
  ('Wally','Jordan Addison',10.5,4.8,false),
  ('Wally','Darius Cooper',8.1,4.0,false),
  ('Wally','Jordyn Tyson',5.4,4.0,false),

  ('Reid','Jayden Daniels',20.8,14.56,true),
  ('Reid','Dylan Sampson',10.5,7.3,true),
  ('Reid','Keaton Mitchell',7.5,8.2,true),
  ('Reid','Jaxon Smith-Njigba',21.4,9.6,true),
  ('Reid','Tee Higgins',15.4,19.7,true),
  ('Reid','Sam LaPorta',11.1,5.7,true),
  ('Reid','Ladd McConkey',10.0,0.0,true),
  ('Reid','Tre Tucker',8.8,9.0,true),
  ('Reid','Harrison Butker',9.6,5.0,true),
  ('Reid','Travis Etienne Jr.',0.0,0.0,false),
  ('Reid','J.K. Dobbins',9.0,3.2,false),
  ('Reid','Dallas Goedert',7.5,8.5,false),
  ('Reid','Jaylen Warren',null,null,false),
  ('Reid','Mike Evans',0.0,0.0,false),
  ('Reid','Bo Nix',16.3,16.18,false),
  ('Reid','Chris Rodriguez Jr.',6.5,11.7,false),
  ('Reid','Jonathon Brooks',0.0,0.0,false),

  ('Caden','Josh Allen',21.1,13.86,true),
  ('Caden','Ashton Jeanty',14.6,5.5,true),
  ('Caden','Bucky Irving',16.9,29.5,true),
  ('Caden','Ja''Marr Chase',20.8,30.5,true),
  ('Caden','Chris Olave',12.8,14.8,true),
  ('Caden','Hunter Henry',8.6,6.0,true),
  ('Caden','Rhamondre Stevenson',15.5,15.3,true),
  ('Caden','Michael Wilson',12.2,10.5,true),
  ('Caden','Will Reichard',11.4,9.6,true),
  ('Caden','Jordan Mason',9.1,5.7,false),
  ('Caden','Mike Washington Jr.',7.9,-0.3,false),
  ('Caden','Malik Washington',11.4,4.1,false),
  ('Caden','Jared Goff',19.6,5.3,false),
  ('Caden','Omar Cooper Jr.',10.2,11.8,false),
  ('Caden','Caleb Douglas',8.9,12.0,false),
  ('Caden','Kenny Gainwell',9.6,10.1,false),

  ('John','C.J. Stroud',17.4,36.36,true),
  ('John','Breece Hall',11.4,12.7,true),
  ('John','Woody Marks',16.0,8.4,true),
  ('John','CeeDee Lamb',20.0,30.5,true),
  ('John','DJ Moore',12.0,6.6,true),
  ('John','Trey McBride',12.4,9.9,true),
  ('John','James Cook III',20.6,19.2,true),
  ('John','Tyler Allgeier',14.1,7.6,true),
  ('John','Matt Gay',9.9,7.0,true),
  ('John','DK Metcalf',null,null,false),
  ('John','Kyle Monangai',0.0,0.0,false),
  ('John','Deebo Samuel Sr.',0.0,0.0,false),
  ('John','Braelon Allen',9.7,5.9,false),
  ('John','Kyle Pitts Sr.',9.2,3.8,false),
  ('John','DeMario Douglas',10.5,14.2,false),
  ('John','Audric Estime',12.4,16.7,false),
  ('John','David Montgomery',0.0,0.0,false),

  ('JM/Cameron','Brock Purdy',22.9,27.78,true),
  ('JM/Cameron','Jahmyr Gibbs',28.1,15.9,true),
  ('JM/Cameron','Quinshon Judkins',15.6,6.0,true),
  ('JM/Cameron','Drake London',15.6,10.8,true),
  ('JM/Cameron','Adonai Mitchell',10.7,0.0,true),
  ('JM/Cameron','Brenton Strange',8.4,3.7,true),
  ('JM/Cameron','Josh Jacobs',17.1,0.5,true),
  ('JM/Cameron','Ollie Gordon II',18.3,7.9,true),
  ('JM/Cameron','Spencer Shrader',11.5,17.6,true),
  ('JM/Cameron','Jeremiyah Love',0.0,0.0,false),
  ('JM/Cameron','Cam Skattebo',0.0,0.0,false),
  ('JM/Cameron','Carnell Tate',null,null,false),
  ('JM/Cameron','Marvin Harrison Jr.',7.1,3.5,false),
  ('JM/Cameron','Makai Lemon',9.0,10.6,false),
  ('JM/Cameron','Malik Willis',18.3,3.82,false),
  ('JM/Cameron','Lamar Jackson',0.0,0.0,false),
  ('JM/Cameron','Brandon Aiyuk',0.0,0.0,false),

  ('Braden','Joe Burrow',21.7,30.04,true),
  ('Braden','Christian McCaffrey',22.7,24.7,true),
  ('Braden','Kyren Williams',17.7,9.1,true),
  ('Braden','Zay Flowers',12.3,3.8,true),
  ('Braden','Tetairoa McMillan',12.7,15.6,true),
  ('Braden','George Kittle',15.2,9.3,true),
  ('Braden','Justin Jefferson',17.0,8.8,true),
  ('Braden','Tyler Warren',10.7,7.4,true),
  ('Braden','Chase McLaughlin',9.3,9.3,true),
  ('Braden','Josh Downs',7.9,4.4,false),
  ('Braden','Xavier Worthy',8.6,9.8,false),
  ('Braden','Tyler Shough',15.8,21.2,false),
  ('Braden','Alvin Kamara',12.4,7.4,false),
  ('Braden','Jordan Love',17.3,36.68,false),
  ('Braden','Seth McGowan',9.4,12.2,false),

  ('Big E','Trevor Lawrence',20.5,13.58,true),
  ('Big E','Jonathan Taylor',21.3,7.9,true),
  ('Big E','Chuba Hubbard',19.1,14.6,true),
  ('Big E','Emeka Egbuka',10.8,6.4,true),
  ('Big E','Parker Washington',12.3,14.1,true),
  ('Big E','Isaiah Likely',11.8,14.8,true),
  ('Big E','Rome Odunze',9.5,16.0,true),
  ('Big E','Zach Charbonnet',12.0,11.1,true),
  ('Big E','Dominic Zvada',11.1,19.9,true),
  ('Big E','George Pickens',0.0,0.0,false),
  ('Big E','Rico Dowdle',null,null,false),
  ('Big E','Travis Kelce',9.8,17.3,false),
  ('Big E','Chris Boswell',null,null,false),
  ('Big E','Roschon Johnson',5.7,0.0,false),
  ('Big E','Devaughn Vele',7.9,2.7,false),
  ('Big E','Keenan Allen',9.0,5.6,false),
  ('Big E','Davante Adams',0.0,0.0,false),

  ('Mamby/Tenner','Drake Maye',21.7,18.76,true),
  ('Mamby/Tenner','Bijan Robinson',21.1,28.2,true),
  ('Mamby/Tenner','D''Andre Swift',20.1,4.1,true),
  ('Mamby/Tenner','Nico Collins',13.0,15.0,true),
  ('Mamby/Tenner','Stefon Diggs',11.6,7.1,true),
  ('Mamby/Tenner','T.J. Hockenson',9.5,5.8,true),
  ('Mamby/Tenner','Devin Singletary',14.4,5.4,true),
  ('Mamby/Tenner','Jakobi Meyers',10.1,10.5,true),
  ('Mamby/Tenner','Ka''imi Fairbairn',10.4,17.8,true),
  ('Mamby/Tenner','A.J. Brown',0.0,0.0,false),
  ('Mamby/Tenner','Garrett Wilson',0.0,0.0,false),
  ('Mamby/Tenner','Tony Pollard',null,null,false),
  ('Mamby/Tenner','Aaron Jones Sr.',8.7,2.6,false),
  ('Mamby/Tenner','Brian Robinson Jr.',0.0,0.0,false),
  ('Mamby/Tenner','Khalil Shakir',8.3,9.8,false),
  ('Mamby/Tenner','Matthew Stafford',17.1,11.22,false),
  ('Mamby/Tenner','RJ Harvey',0.0,0.0,false),

  ('Freed','Patrick Mahomes',18.7,16.48,true),
  ('Freed','Derrick Henry',15.8,7.08,true),
  ('Freed','Bhayshul Tuten',17.0,9.4,true),
  ('Freed','Puka Nacua',22.7,33.0,true),
  ('Freed','Rashee Rice',12.7,8.9,true),
  ('Freed','Brock Bowers',16.6,21.3,true),
  ('Freed','Christian Watson',14.6,29.1,true),
  ('Freed','Saquon Barkley',13.9,9.2,true),
  ('Freed','Wil Lutz',9.4,9.4,true),
  ('Freed','Jaylen Waddle',10.6,3.2,false),
  ('Freed','Blake Corum',10.9,13.8,false),
  ('Freed','KC Concepcion',10.3,18.3,false),
  ('Freed','Kyler Murray',0.0,0.0,false),
  ('Freed','Rachaad White',13.5,6.9,false),
  ('Freed','Tyler Goodson',8.0,9.7,false),
  ('Freed','Elijah Mitchell',10.2,4.1,false),
  ('Freed','Terrance Ferguson',0.0,0.0,false)
) as v(manager_name, player_name, proj, actual, started);

-- 3. Roster rows for players who don't have one yet
insert into roster_entries (player_id, team_id, season_id, league_id, stats)
select distinct on (regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')) p.id, t.id, s.id, t.league_id, '{}'::jsonb
from week_box_2026 w
join managers m on m.name = w.manager_name
cross join (select id from seasons where year = 2026) s
join teams t on t.manager_id = m.id and t.season_id = s.id
join players p on regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
where w.week = 9
  and not exists (
    select 1 from roster_entries re
    join players p2 on p2.id = re.player_id
    where re.team_id in (select t.id from teams t join seasons s on s.id = t.season_id and s.year = 2026) and regexp_replace(lower(p2.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  )
order by regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g'), p.id;

-- 4. Week 9 stats + ownership snapshot, and point team_id at the current team
update roster_entries re
set team_id = t.id,
    stats = coalesce(re.stats, '{}'::jsonb) || jsonb_build_object(
      'teamId', coalesce(re.stats->'teamId', '{}'::jsonb) || jsonb_build_object('9', t.id::text),
      'started', coalesce(re.stats->'started', '{}'::jsonb) || jsonb_build_object('9', w.started),
      'actual', case when w.actual is null then coalesce(re.stats->'actual', '{}'::jsonb) - '9'
                     else coalesce(re.stats->'actual', '{}'::jsonb) || jsonb_build_object('9', w.actual) end,
      'proj', case when w.proj is null then coalesce(re.stats->'proj', '{}'::jsonb) - '9'
                   else coalesce(re.stats->'proj', '{}'::jsonb) || jsonb_build_object('9', w.proj) end
    )
from week_box_2026 w
join managers m on m.name = w.manager_name
join seasons s on s.year = 2026
join teams t on t.manager_id = m.id and t.season_id = s.id,
players pe
where w.week = 9
  and pe.id = re.player_id
  and regexp_replace(lower(pe.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  and re.team_id in (select t.id from teams t join seasons s on s.id = t.season_id and s.year = 2026);

-- Check 1: players on each team's Week 9 roster by snapshot. Expect 15-17 per
-- team, identical to the ESPN box score (Caden has 16 and Braden 15).
select m.name as manager, count(*) as wk9_roster
from teams t
join seasons s on s.id = t.season_id and s.year = 2026
join managers m on m.id = t.manager_id
join roster_entries re on re.stats->'teamId'->>'9' = t.id::text
group by m.name order by m.name;

-- Check 2: box-score rows that matched no roster_entries row (send me any).
select w.manager_name, w.player_name
from week_box_2026 w
left join managers m on m.name = w.manager_name
left join seasons s on s.year = 2026
left join teams t on t.manager_id = m.id and t.season_id = s.id
where w.week = 9
  and not exists (
    select 1 from roster_entries re
    join players pe on pe.id = re.player_id
    where re.team_id = t.id and re.stats->'teamId'->>'9' = t.id::text
      and regexp_replace(lower(pe.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  );

drop table week_box_2026;
