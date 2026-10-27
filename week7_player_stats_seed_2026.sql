-- Fantasy Chatroom 2026-27 Week 7 individual player fantasy points and roster.
-- Companion to week7_results_seed_2026.sql. Same fields /api/espn-sync writes:
--   stats.actual[7]  -- real fantasy points scored
--   stats.started[7] -- true for a starting slot, false for bench/IR
--   stats.proj[7]    -- ESPN's pre-game projection
--   stats.teamId[7]  -- which team owned the player in Week 7 (roster snapshot)
--
-- Rosters come straight from the Week 7 box scores: players new to a team get
-- teamId[7] and their team_id moved there; players who left a team simply have
-- no Week 7 snapshot. New pickups are added to players / roster_entries first.
-- league_id is taken from the team row, never a managers subquery.
--
-- Bye-week players (*BYE* on the box score) get no actual/proj for Week 7: no
-- game was played, and a 0 would drag down their season average and the
-- bye-week analysis. They are still on the roster and still bench.
--
-- Safe to re-run: every write sets the same absolute Week 7 values and never
-- touches any other week.

-- 1. Players not in the players table yet
insert into players (name, position)
select v.name, v.position from (values
  ('Bam Knight', 'RB'),
  ('Aaron Rodgers', 'QB'),
  ('Tyrone Tracy Jr.', 'RB'),
  ('Chad Ryland', 'K'),
  ('Omar Cooper Jr.', 'WR'),
  ('DeMario Douglas', 'WR'),
  ('Konata Mumpfield', 'WR'),
  ('C.J. Stroud', 'QB')
) as v(name, position)
where not exists (
  select 1 from players p where regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(v.name), '[^a-z0-9]', '', 'g')
);

-- 2. Week 7 box scores (168 rows)
create table if not exists week_box_2026 (
  week integer not null,
  manager_name text not null,
  player_name text not null,
  proj numeric,
  actual numeric,
  started boolean not null
);
delete from week_box_2026 where week = 7;
insert into week_box_2026 (week, manager_name, player_name, proj, actual, started)
select 7, v.manager_name, v.player_name, v.proj, v.actual, v.started
from (values
  ('Dan','Dak Prescott',17.1,23.78,true),
  ('Dan','Kenneth Walker III',20.7,8.7,true),
  ('Dan','Javonte Williams',18.1,25.5,true),
  ('Dan','Amon-Ra St. Brown',17.9,23.7,true),
  ('Dan','Luther Burden III',11.8,23.7,true),
  ('Dan','Colston Loveland',10.6,18.4,true),
  ('Dan','Matthew Golden',16.2,7.4,true),
  ('Dan','Jalen Coker',14.3,1.4,true),
  ('Dan','Brandon Aubrey',8.5,13.6,true),
  ('Dan','Lamar Jackson',0.0,0.0,false),
  ('Dan','TreVeyon Henderson',7.9,3.3,false),
  ('Dan','Emmett Johnson',6.3,5.7,false),
  ('Dan','Juwan Johnson',7.8,1.7,false),
  ('Dan','Adonai Mitchell',7.6,0.0,false),
  ('Dan','Germie Bernard',12.3,4.7,false),
  ('Dan','Bam Knight',8.9,8.8,false),
  ('Dan','Alec Pierce',0.0,0.0,false),

  ('Mamby/Tenner','Drake Maye',21.4,28.44,true),
  ('Mamby/Tenner','Bijan Robinson',22.5,18.2,true),
  ('Mamby/Tenner','D''Andre Swift',17.2,19.5,true),
  ('Mamby/Tenner','Nico Collins',15.8,1.6,true),
  ('Mamby/Tenner','Garrett Wilson',13.9,4.1,true),
  ('Mamby/Tenner','T.J. Hockenson',9.2,12.5,true),
  ('Mamby/Tenner','A.J. Brown',15.1,7.8,true),
  ('Mamby/Tenner','Aaron Jones Sr.',12.8,3.6,true),
  ('Mamby/Tenner','Ka''imi Fairbairn',11.8,12.5,true),
  ('Mamby/Tenner','Courtland Sutton',8.5,7.0,false),
  ('Mamby/Tenner','Tony Pollard',15.5,38.5,false),
  ('Mamby/Tenner','Stefon Diggs',null,null,false),
  ('Mamby/Tenner','RJ Harvey',11.0,13.5,false),
  ('Mamby/Tenner','Brian Robinson Jr.',0.0,0.0,false),
  ('Mamby/Tenner','Khalil Shakir',null,null,false),
  ('Mamby/Tenner','Matthew Stafford',18.8,17.5,false),

  ('Reid','Bo Nix',16.7,27.68,true),
  ('Reid','J.K. Dobbins',15.0,8.8,true),
  ('Reid','Jaylen Warren',18.8,19.2,true),
  ('Reid','Jaxon Smith-Njigba',18.6,30.8,true),
  ('Reid','Tee Higgins',13.2,26.8,true),
  ('Reid','Sam LaPorta',11.5,2.8,true),
  ('Reid','Dallas Goedert',10.1,8.3,true),
  ('Reid','Kendre Miller',10.4,5.8,true),
  ('Reid','Harrison Butker',10.9,4.0,true),
  ('Reid','Ladd McConkey',null,null,false),
  ('Reid','Jayden Daniels',null,null,false),
  ('Reid','Jonathon Brooks',0.0,0.0,false),
  ('Reid','Tyjae Spears',0.0,0.0,false),
  ('Reid','Keaton Mitchell',null,null,false),
  ('Reid','Mike Evans',0.0,0.0,false),
  ('Reid','Tre Tucker',9.9,20.8,false),
  ('Reid','Travis Etienne Jr.',0.0,0.0,false),

  ('JM/Cameron','Brock Purdy',21.1,13.02,true),
  ('JM/Cameron','Quinshon Judkins',14.2,26.4,true),
  ('JM/Cameron','Ollie Gordon II',13.1,20.3,true),
  ('JM/Cameron','Drake London',16.0,18.1,true),
  ('JM/Cameron','Carnell Tate',10.2,8.9,true),
  ('JM/Cameron','Tyler Higbee',6.6,2.9,true),
  ('JM/Cameron','Jahmyr Gibbs',27.2,18.3,true),
  ('JM/Cameron','Josh Jacobs',13.6,20.6,true),
  ('JM/Cameron','Spencer Shrader',10.3,4.3,true),
  ('JM/Cameron','Jeremiyah Love',0.0,0.0,false),
  ('JM/Cameron','Cam Skattebo',8.8,21.1,false),
  ('JM/Cameron','Marvin Harrison Jr.',7.0,7.6,false),
  ('JM/Cameron','Keon Coleman',null,null,false),
  ('JM/Cameron','Brenton Strange',null,null,false),
  ('JM/Cameron','Konata Mumpfield',7.0,2.5,false),
  ('JM/Cameron','Jaylin Noel',10.2,0.7,false),
  ('JM/Cameron','Tyreek Hill',0.0,0.0,false),

  ('Wally','Caleb Williams',18.4,22.62,true),
  ('Wally','Chase Brown',14.9,9.3,true),
  ('Wally','Tyrone Tracy Jr.',7.0,11.2,true),
  ('Wally','Malik Nabers',16.5,16.6,true),
  ('Wally','Jameson Williams',10.1,25.6,true),
  ('Wally','Tucker Kraft',11.0,13.8,true),
  ('Wally','Denzel Boston',11.4,5.2,true),
  ('Wally','Darius Cooper',9.6,2.7,true),
  ('Wally','Chad Ryland',10.0,10.7,true),
  ('Wally','Omarion Hampton',null,null,false),
  ('Wally','DeVonta Smith',0.0,0.0,false),
  ('Wally','Jadarian Price',0.0,0.0,false),
  ('Wally','Kaelon Black',7.1,12.4,false),
  ('Wally','Cam Little',null,null,false),
  ('Wally','Bryce Young',18.1,5.42,false),
  ('Wally','Rashid Shaheed',10.6,2.1,false),
  ('Wally','Jordyn Tyson',0.0,0.0,false),

  ('Big E','Aaron Rodgers',19.7,13.58,true),
  ('Big E','Jonathan Taylor',16.6,20.0,true),
  ('Big E','Chuba Hubbard',16.4,10.0,true),
  ('Big E','George Pickens',12.2,15.2,true),
  ('Big E','Ted Hurst III',9.4,0.0,true),
  ('Big E','Isaiah Likely',13.0,2.7,true),
  ('Big E','Rome Odunze',9.7,10.4,true),
  ('Big E','Devaughn Vele',9.3,15.9,true),
  ('Big E','Chris Boswell',12.0,12.4,true),
  ('Big E','Emeka Egbuka',0.0,0.0,false),
  ('Big E','Parker Washington',null,null,false),
  ('Big E','Rico Dowdle',8.3,14.1,false),
  ('Big E','Travis Kelce',9.1,7.9,false),
  ('Big E','Trevor Lawrence',null,null,false),
  ('Big E','Zach Charbonnet',0.0,0.0,false),
  ('Big E','Roschon Johnson',9.8,1.3,false),
  ('Big E','Davante Adams',0.0,0.0,false),

  ('Caden','Jared Goff',18.7,18.02,true),
  ('Caden','Ashton Jeanty',17.7,18.6,true),
  ('Caden','Bucky Irving',15.1,28.5,true),
  ('Caden','Ja''Marr Chase',20.1,16.7,true),
  ('Caden','Chris Olave',14.4,10.6,true),
  ('Caden','Harold Fannin Jr.',7.4,12.1,true),
  ('Caden','Rhamondre Stevenson',12.0,21.5,true),
  ('Caden','Emanuel Wilson',12.0,19.5,true),
  ('Caden','Will Reichard',12.2,13.7,true),
  ('Caden','Josh Allen',null,null,false),
  ('Caden','Michael Wilson',11.5,10.6,false),
  ('Caden','Mike Washington Jr.',6.5,3.2,false),
  ('Caden','Malik Washington',10.7,6.0,false),
  ('Caden','Wan''Dale Robinson',7.6,2.7,false),
  ('Caden','Omar Cooper Jr.',7.5,21.5,false),
  ('Caden','Jordan Addison',10.3,3.8,false),
  ('Caden','Jordan Mason',11.6,8.3,false),

  ('Freed','Kyler Murray',18.8,14.9,true),
  ('Freed','Derrick Henry',20.3,6.4,true),
  ('Freed','Saquon Barkley',16.3,16.1,true),
  ('Freed','Jaylen Waddle',10.3,7.8,true),
  ('Freed','Christian Watson',15.7,9.7,true),
  ('Freed','Brock Bowers',17.1,11.8,true),
  ('Freed','Puka Nacua',21.3,19.3,true),
  ('Freed','Chris Godwin Jr.',10.0,5.2,true),
  ('Freed','Dominic Zvada',11.5,2.0,true),
  ('Freed','Bhayshul Tuten',null,null,false),
  ('Freed','Blake Corum',10.8,20.1,false),
  ('Freed','KC Concepcion',8.0,22.7,false),
  ('Freed','Rashee Rice',0.0,0.0,false),
  ('Freed','Patrick Mahomes',16.1,6.5,false),
  ('Freed','Dameon Pierce',6.9,14.3,false),
  ('Freed','Rachaad White',null,null,false),
  ('Freed','Terrance Ferguson',0.0,0.0,false),

  ('John','C.J. Stroud',20.0,17.52,true),
  ('John','Woody Marks',15.3,10.1,true),
  ('John','Braelon Allen',16.1,19.4,true),
  ('John','CeeDee Lamb',17.1,24.4,true),
  ('John','DK Metcalf',14.2,7.1,true),
  ('John','Trey McBride',14.0,24.1,true),
  ('John','Tyler Allgeier',11.9,7.4,true),
  ('John','DeMario Douglas',9.8,4.3,true),
  ('John','Matt Gay',10.2,9.3,true),
  ('John','James Cook III',null,null,false),
  ('John','Breece Hall',0.0,0.0,false),
  ('John','David Montgomery',0.0,0.0,false),
  ('John','DJ Moore',null,null,false),
  ('John','Kyle Monangai',0.0,0.0,false),
  ('John','Kyle Pitts Sr.',8.9,11.2,false),
  ('John','Baker Mayfield',15.7,6.66,false),
  ('John','Deebo Samuel Sr.',0.0,0.0,false),

  ('Braden','Jordan Love',19.9,16.96,true),
  ('Braden','Christian McCaffrey',22.4,21.5,true),
  ('Braden','Kyren Williams',20.3,20.1,true),
  ('Braden','Zay Flowers',13.9,26.2,true),
  ('Braden','Tetairoa McMillan',14.7,7.5,true),
  ('Braden','George Kittle',15.6,13.3,true),
  ('Braden','Justin Jefferson',17.4,7.9,true),
  ('Braden','Xavier Worthy',11.3,3.1,true),
  ('Braden','Tyler Loop',9.0,6.8,true),
  ('Braden','Joe Burrow',19.7,29.38,false),
  ('Braden','Josh Downs',7.5,3.8,false),
  ('Braden','Tyler Shough',15.8,14.32,false),
  ('Braden','Alvin Kamara',7.8,11.2,false),
  ('Braden','Kendrick Bourne',6.9,2.4,false),
  ('Braden','Seth McGowan',5.0,11.3,false),
  ('Braden','Tyler Warren',0.0,0.0,false)
) as v(manager_name, player_name, proj, actual, started);

-- 3. Roster rows for players who don't have one yet
insert into roster_entries (player_id, team_id, season_id, league_id, stats)
select distinct on (regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')) p.id, t.id, s.id, t.league_id, '{}'::jsonb
from week_box_2026 w
join managers m on m.name = w.manager_name
cross join (select id from seasons where year = 2026) s
join teams t on t.manager_id = m.id and t.season_id = s.id
join players p on regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
where w.week = 7
  and not exists (
    select 1 from roster_entries re
    join players p2 on p2.id = re.player_id
    where re.team_id in (select t.id from teams t join seasons s on s.id = t.season_id and s.year = 2026) and regexp_replace(lower(p2.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  )
order by regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g'), p.id;

-- 4. Week 7 stats + ownership snapshot, and point team_id at the current team
update roster_entries re
set team_id = t.id,
    stats = coalesce(re.stats, '{}'::jsonb) || jsonb_build_object(
      'teamId', coalesce(re.stats->'teamId', '{}'::jsonb) || jsonb_build_object('7', t.id::text),
      'started', coalesce(re.stats->'started', '{}'::jsonb) || jsonb_build_object('7', w.started),
      'actual', case when w.actual is null then coalesce(re.stats->'actual', '{}'::jsonb) - '7'
                     else coalesce(re.stats->'actual', '{}'::jsonb) || jsonb_build_object('7', w.actual) end,
      'proj', case when w.proj is null then coalesce(re.stats->'proj', '{}'::jsonb) - '7'
                   else coalesce(re.stats->'proj', '{}'::jsonb) || jsonb_build_object('7', w.proj) end
    )
from week_box_2026 w
join managers m on m.name = w.manager_name
join seasons s on s.year = 2026
join teams t on t.manager_id = m.id and t.season_id = s.id,
players pe
where w.week = 7
  and pe.id = re.player_id
  and regexp_replace(lower(pe.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  and re.team_id in (select t.id from teams t join seasons s on s.id = t.season_id and s.year = 2026);

-- Check 1: players on each team's Week 7 roster by snapshot. Expect 16-17 per
-- team, identical to the ESPN box score (Reid, Mamby/Tenner and Braden have 16).
select m.name as manager, count(*) as wk7_roster
from teams t
join seasons s on s.id = t.season_id and s.year = 2026
join managers m on m.id = t.manager_id
join roster_entries re on re.stats->'teamId'->>'7' = t.id::text
group by m.name order by m.name;

-- Check 2: box-score rows that matched no roster_entries row (send me any).
select w.manager_name, w.player_name
from week_box_2026 w
left join managers m on m.name = w.manager_name
left join seasons s on s.year = 2026
left join teams t on t.manager_id = m.id and t.season_id = s.id
where w.week = 7
  and not exists (
    select 1 from roster_entries re
    join players pe on pe.id = re.player_id
    where re.team_id = t.id and re.stats->'teamId'->>'7' = t.id::text
      and regexp_replace(lower(pe.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  );

drop table week_box_2026;
