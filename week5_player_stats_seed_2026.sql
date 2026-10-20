-- Fantasy Chatroom 2026-27 Week 5 individual player fantasy points and roster.
-- Companion to week5_results_seed_2026.sql. Same fields /api/espn-sync writes:
--   stats.actual[5]  -- real fantasy points scored
--   stats.started[5] -- true for a starting slot, false for bench/IR
--   stats.proj[5]    -- ESPN's pre-game projection
--   stats.teamId[5]  -- which team owned the player in Week 5 (the roster snapshot)
--
-- Rosters come straight from the Week 5 box scores, so this works on its own
-- and agrees with roster_transactions_sync_2026.sql (run that first to also
-- load the transaction log through Oct 13): players new to a team get
-- teamId[5] and their team_id moved there, and players who left a team simply
-- have no Week 5 snapshot. Missing players (new pickups) are added to
-- players / roster_entries first.
--
-- Bye-week players (*BYE* on the box score) get no actual/proj for Week 5 --
-- no game was played, and a 0 would drag down their season average and the
-- bye-week analysis -- but they are still on the roster and still bench.
--
-- Safe to re-run: every write sets the same absolute Week 5 values and never
-- touches any other week.

-- 1. Players not in the players table yet
insert into players (name, position)
select v.name, v.position from (values
  ('Roman Wilson', 'WR'),
  ('Will Shipley', 'RB'),
  ('Jake Bates', 'K'),
  ('Jaylin Noel', 'WR'),
  ('Jacoby Brissett', 'QB'),
  ('Darius Cooper', 'WR'),
  ('Keon Coleman', 'WR'),
  ('Dohnte Meyers', 'WR'),
  ('Roschon Johnson', 'RB')
) as v(name, position)
where not exists (
  select 1 from players p where regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(v.name), '[^a-z0-9]', '', 'g')
);

-- 2. Week 5 box scores (169 rows)
create table if not exists week_box_2026 (
  week integer not null,
  manager_name text not null,
  player_name text not null,
  proj numeric,
  actual numeric,
  started boolean not null
);
delete from week_box_2026 where week = 5;
insert into week_box_2026 (week, manager_name, player_name, proj, actual, started)
select 5, v.manager_name, v.player_name, v.proj, v.actual, v.started
from (values
  ('Caden','Josh Allen',21.0,34.0,true),
  ('Caden','Ashton Jeanty',18.4,10.7,true),
  ('Caden','Bucky Irving',16.6,34.0,true),
  ('Caden','Ja''Marr Chase',20.2,18.2,true),
  ('Caden','Chris Olave',15.3,8.6,true),
  ('Caden','Harold Fannin Jr.',10.9,0.9,true),
  ('Caden','Michael Wilson',15.8,6.28,true),
  ('Caden','Emanuel Wilson',15.0,14.2,true),
  ('Caden','Will Reichard',10.1,16.9,true),
  ('Caden','Terry McLaurin',12.0,11.7,false),
  ('Caden','Rhamondre Stevenson',13.9,17.5,false),
  ('Caden','Jakobi Meyers',9.9,5.7,false),
  ('Caden','Mike Washington Jr.',5.5,1.5,false),
  ('Caden','Malik Washington',11.6,12.6,false),
  ('Caden','Jared Goff',19.6,29.44,false),
  ('Caden','Wan''Dale Robinson',8.1,10.3,false),
  ('Caden','Jordan Mason',0.0,0.0,false),

  ('Dan','Dak Prescott',18.1,12.64,true),
  ('Dan','Javonte Williams',18.8,15.2,true),
  ('Dan','TreVeyon Henderson',11.7,5.3,true),
  ('Dan','Amon-Ra St. Brown',18.5,12.9,true),
  ('Dan','Matthew Golden',12.1,20.8,true),
  ('Dan','Kenyon Sadiq',8.6,-0.7,true),
  ('Dan','Luther Burden III',11.4,8.4,true),
  ('Dan','Roman Wilson',9.5,0.0,true),
  ('Dan','Brandon Aubrey',11.4,5.1,true),
  ('Dan','Kenneth Walker III',null,null,false),
  ('Dan','Colston Loveland',8.9,3.4,false),
  ('Dan','Lamar Jackson',0.0,0.0,false),
  ('Dan','Emmett Johnson',null,null,false),
  ('Dan','Juwan Johnson',9.2,4.1,false),
  ('Dan','Jalen Coker',null,null,false),
  ('Dan','Adonai Mitchell',0.0,0.0,false),
  ('Dan','Alec Pierce',0.0,0.0,false),

  ('Reid','Jayden Daniels',21.8,34.26,true),
  ('Reid','Will Shipley',13.8,8.3,true),
  ('Reid','Jaylen Warren',18.8,36.3,true),
  ('Reid','Jaxon Smith-Njigba',19.0,22.3,true),
  ('Reid','Tee Higgins',11.9,3.7,true),
  ('Reid','Sam LaPorta',12.1,18.8,true),
  ('Reid','J.K. Dobbins',12.0,15.9,true),
  ('Reid','Mike Evans',11.9,25.8,true),
  ('Reid','Cameron Dicker',9.4,6.2,true),
  ('Reid','Ladd McConkey',0.0,0.0,false),
  ('Reid','Jonathon Brooks',null,null,false),
  ('Reid','Dallas Goedert',9.7,8.3,false),
  ('Reid','Tyjae Spears',7.8,6.3,false),
  ('Reid','Keaton Mitchell',9.6,6.9,false),
  ('Reid','Kendre Miller',8.5,10.0,false),
  ('Reid','Antonio Williams',9.0,5.6,false),
  ('Reid','Travis Etienne Jr.',0.0,0.0,false),

  ('Freed','Kyler Murray',18.7,19.76,true),
  ('Freed','Derrick Henry',18.7,22.5,true),
  ('Freed','Bhayshul Tuten',15.4,13.6,true),
  ('Freed','Jaylen Waddle',10.5,4.3,true),
  ('Freed','Christian Watson',13.0,30.8,true),
  ('Freed','Brock Bowers',14.8,21.5,true),
  ('Freed','Puka Nacua',20.5,34.2,true),
  ('Freed','KC Concepcion',9.6,1.0,true),
  ('Freed','Jake Bates',9.5,10.6,true),
  ('Freed','Brian Thomas Jr.',7.2,0.0,false),
  ('Freed','Jacory Croskey-Merritt',10.2,16.2,false),
  ('Freed','Blake Corum',9.3,16.7,false),
  ('Freed','Romeo Doubs',11.5,2.6,false),
  ('Freed','Rashee Rice',null,null,false),
  ('Freed','Patrick Mahomes',null,null,false),
  ('Freed','Jaylin Noel',6.1,13.2,false),
  ('Freed','Saquon Barkley',0.0,0.0,false),

  ('Big E','Trevor Lawrence',19.4,22.24,true),
  ('Big E','Jonathan Taylor',20.6,11.2,true),
  ('Big E','Jaylen Wright',10.4,3.6,true),
  ('Big E','George Pickens',12.3,26.5,true),
  ('Big E','Davante Adams',14.9,21.6,true),
  ('Big E','Isaiah Likely',11.8,29.9,true),
  ('Big E','Rome Odunze',10.3,4.5,true),
  ('Big E','Parker Washington',13.4,28.9,true),
  ('Big E','Jason Myers',9.3,25.0,true),
  ('Big E','Emeka Egbuka',9.3,15.7,false),
  ('Big E','Rico Dowdle',0.0,0.0,false),
  ('Big E','Chuba Hubbard',null,null,false),
  ('Big E','Travis Kelce',null,null,false),
  ('Big E','Jonah Coleman',0.0,0.0,false),
  ('Big E','Devaughn Vele',9.9,5.6,false),
  ('Big E','Keenan Allen',8.9,8.5,false),
  ('Big E','Zach Charbonnet',0.0,0.0,false),

  ('Mamby/Tenner','Drake Maye',19.4,39.96,true),
  ('Mamby/Tenner','Bijan Robinson',24.0,15.8,true),
  ('Mamby/Tenner','D''Andre Swift',18.6,17.3,true),
  ('Mamby/Tenner','Nico Collins',15.4,10.1,true),
  ('Mamby/Tenner','Garrett Wilson',13.4,21.9,true),
  ('Mamby/Tenner','Mark Andrews',8.4,3.8,true),
  ('Mamby/Tenner','Tony Pollard',14.9,6.7,true),
  ('Mamby/Tenner','Aaron Jones Sr.',18.8,19.7,true),
  ('Mamby/Tenner','Ka''imi Fairbairn',9.5,17.9,true),
  ('Mamby/Tenner','Courtland Sutton',9.7,9.8,false),
  ('Mamby/Tenner','Stefon Diggs',0.0,0.0,false),
  ('Mamby/Tenner','RJ Harvey',12.8,1.2,false),
  ('Mamby/Tenner','Brian Robinson Jr.',9.0,3.6,false),
  ('Mamby/Tenner','Khalil Shakir',9.0,10.5,false),
  ('Mamby/Tenner','Matthew Stafford',18.4,27.32,false),
  ('Mamby/Tenner','T.J. Hockenson',9.2,1.7,false),
  ('Mamby/Tenner','A.J. Brown',0.0,0.0,false),

  ('JM/Cameron','Brock Purdy',18.5,16.66,true),
  ('JM/Cameron','Cam Skattebo',14.6,8.1,true),
  ('JM/Cameron','Quinshon Judkins',15.4,7.5,true),
  ('JM/Cameron','Drake London',15.1,18.8,true),
  ('JM/Cameron','Carnell Tate',12.7,1.1,true),
  ('JM/Cameron','Dalton Kincaid',8.0,3.2,true),
  ('JM/Cameron','Jahmyr Gibbs',28.5,40.7,true),
  ('JM/Cameron','Jeremiyah Love',15.4,2.2,true),
  ('JM/Cameron','Spencer Shrader',9.4,21.3,true),
  ('JM/Cameron','Marvin Harrison Jr.',0.0,0.0,false),
  ('JM/Cameron','Josh Jacobs',0.0,0.0,false),
  ('JM/Cameron','Makai Lemon',9.4,7.8,false),
  ('JM/Cameron','Ollie Gordon II',11.9,17.8,false),
  ('JM/Cameron','Kalif Raymond',7.0,1.9,false),
  ('JM/Cameron','Keon Coleman',8.2,7.7,false),
  ('JM/Cameron','Dohnte Meyers',9.0,5.7,false),
  ('JM/Cameron','Tyreek Hill',0.0,0.0,false),

  ('Braden','Joe Burrow',20.5,25.6,true),
  ('Braden','Christian McCaffrey',19.2,17.3,true),
  ('Braden','Kyren Williams',18.6,19.1,true),
  ('Braden','Justin Jefferson',17.6,17.3,true),
  ('Braden','Zay Flowers',12.9,12.6,true),
  ('Braden','Tyler Warren',10.6,20.4,true),
  ('Braden','George Kittle',12.7,5.4,true),
  ('Braden','Josh Downs',11.0,6.7,true),
  ('Braden','Tyler Loop',8.4,13.3,true),
  ('Braden','Tetairoa McMillan',null,null,false),
  ('Braden','Kenny Gainwell',9.1,4.8,false),
  ('Braden','Xavier Worthy',null,null,false),
  ('Braden','Tyler Shough',17.1,-0.16,false),
  ('Braden','Alvin Kamara',11.5,1.6,false),
  ('Braden','Rashod Bateman',5.2,11.2,false),
  ('Braden','George Holani',7.8,3.6,false),

  ('Wally','Jacoby Brissett',19.3,26.28,true),
  ('Wally','Omarion Hampton',13.3,4.9,true),
  ('Wally','Chase Brown',18.1,6.5,true),
  ('Wally','Malik Nabers',12.6,27.1,true),
  ('Wally','Jameson Williams',10.3,18.7,true),
  ('Wally','Tucker Kraft',9.5,11.1,true),
  ('Wally','Denzel Boston',11.1,13.1,true),
  ('Wally','Darius Cooper',8.5,14.6,true),
  ('Wally','Cam Little',10.2,9.1,true),
  ('Wally','DeVonta Smith',0.0,0.0,false),
  ('Wally','Jadarian Price',0.0,0.0,false),
  ('Wally','MarShawn Lloyd',9.7,18.2,false),
  ('Wally','Caleb Williams',0.0,0.0,false),
  ('Wally','Kaelon Black',5.6,2.1,false),
  ('Wally','Quentin Johnston',0.0,0.0,false),
  ('Wally','Bryce Young',null,null,false),
  ('Wally','Jordyn Tyson',0.0,0.0,false),

  ('John','Jalen Hurts',16.8,13.0,true),
  ('John','James Cook III',17.3,25.8,true),
  ('John','Braelon Allen',15.2,20.6,true),
  ('John','CeeDee Lamb',17.6,1.9,true),
  ('John','Deebo Samuel Sr.',13.6,3.5,true),
  ('John','Trey McBride',16.9,19.1,true),
  ('John','David Montgomery',12.9,1.1,true),
  ('John','DK Metcalf',11.7,4.8,true),
  ('John','Evan McPherson',9.1,6.6,true),
  ('John','Breece Hall',0.0,0.0,false),
  ('John','DJ Moore',0.0,0.0,false),
  ('John','Jordan Addison',0.0,0.0,false),
  ('John','Rachaad White',9.1,6.5,false),
  ('John','Woody Marks',8.1,13.0,false),
  ('John','Tyler Allgeier',9.9,2.6,false),
  ('John','Roschon Johnson',7.8,8.0,false),
  ('John','Kyle Monangai',0.0,0.0,false)
) as v(manager_name, player_name, proj, actual, started);

-- 3. Roster rows for players who don't have one yet
insert into roster_entries (player_id, team_id, season_id, league_id, stats)
select distinct on (regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')) p.id, t.id, s.id,
       t.league_id, '{}'::jsonb
from week_box_2026 w
join managers m on m.name = w.manager_name
cross join (select id from seasons where year = 2026) s
join teams t on t.manager_id = m.id and t.season_id = s.id
join players p on regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
where w.week = 5
  and not exists (
    select 1 from roster_entries re
    join players p2 on p2.id = re.player_id
    where re.team_id in (select t.id from teams t join seasons s on s.id = t.season_id and s.year = 2026) and regexp_replace(lower(p2.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  )
order by regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g'), p.id;

-- 4. Week 5 stats + ownership snapshot, and point team_id at the current team
update roster_entries re
set team_id = t.id,
    stats = coalesce(re.stats, '{}'::jsonb) || jsonb_build_object(
      'teamId', coalesce(re.stats->'teamId', '{}'::jsonb) || jsonb_build_object('5', t.id::text),
      'started', coalesce(re.stats->'started', '{}'::jsonb) || jsonb_build_object('5', w.started),
      'actual', case when w.actual is null then coalesce(re.stats->'actual', '{}'::jsonb) - '5'
                     else coalesce(re.stats->'actual', '{}'::jsonb) || jsonb_build_object('5', w.actual) end,
      'proj', case when w.proj is null then coalesce(re.stats->'proj', '{}'::jsonb) - '5'
                   else coalesce(re.stats->'proj', '{}'::jsonb) || jsonb_build_object('5', w.proj) end
    )
from week_box_2026 w
join managers m on m.name = w.manager_name
join seasons s on s.year = 2026
join teams t on t.manager_id = m.id and t.season_id = s.id,
players pe
where w.week = 5
  and pe.id = re.player_id
  and regexp_replace(lower(pe.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  and re.team_id in (select t.id from teams t join seasons s on s.id = t.season_id and s.year = 2026);

-- Check 1: players on each team's Week 5 roster by snapshot. Expect 16-17 per
-- team, identical to the ESPN box score.
select m.name as manager, count(*) as wk5_roster
from teams t
join seasons s on s.id = t.season_id and s.year = 2026
join managers m on m.id = t.manager_id
join roster_entries re on re.stats->'teamId'->>'5' = t.id::text
group by m.name order by m.name;

-- Check 2: box-score rows that matched no roster_entries row (send me any).
select w.manager_name, w.player_name
from week_box_2026 w
left join managers m on m.name = w.manager_name
left join seasons s on s.year = 2026
left join teams t on t.manager_id = m.id and t.season_id = s.id
where w.week = 5
  and not exists (
    select 1 from roster_entries re
    join players pe on pe.id = re.player_id
    where re.team_id = t.id and re.stats->'teamId'->>'5' = t.id::text
      and regexp_replace(lower(pe.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  );

drop table week_box_2026;
