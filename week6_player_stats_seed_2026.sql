-- Fantasy Chatroom 2026-27 Week 6 individual player fantasy points and roster.
-- Companion to week6_results_seed_2026.sql. Same fields /api/espn-sync writes:
--   stats.actual[6]  -- real fantasy points scored
--   stats.started[6] -- true for a starting slot, false for bench/IR
--   stats.proj[6]    -- ESPN's pre-game projection
--   stats.teamId[6]  -- which team owned the player in Week 6 (roster snapshot)
--
-- Rosters come straight from the Week 6 box scores: players new to a team get
-- teamId[6] and their team_id moved there; players who left a team simply have
-- no Week 6 snapshot. New pickups are added to players / roster_entries first.
-- league_id is taken from the team row, never a managers subquery.
--
-- Bye-week players (*BYE* on the box score) get no actual/proj for Week 6: no
-- game was played, and a 0 would drag down their season average and the
-- bye-week analysis. They are still on the roster and still bench.
--
-- Safe to re-run: every write sets the same absolute Week 6 values and never
-- touches any other week.

-- 1. Players not in the players table yet
insert into players (name, position)
select v.name, v.position from (values
  ('Kirk Cousins', 'QB'),
  ('Jacob Cowing', 'WR'),
  ('Matt Gay', 'K'),
  ('Pat Freiermuth', 'TE'),
  ('Germie Bernard', 'WR'),
  ('Dameon Pierce', 'RB'),
  ('Dominic Zvada', 'K'),
  ('Austin Ekeler', 'RB'),
  ('Jaleel McLaughlin', 'RB'),
  ('Tyler Higbee', 'TE'),
  ('Brenton Strange', 'TE'),
  ('Jordan Love', 'QB'),
  ('Kendrick Bourne', 'WR'),
  ('Chris Boswell', 'K'),
  ('Rashid Shaheed', 'WR'),
  ('Tre Tucker', 'WR')
) as v(name, position)
where not exists (
  select 1 from players p where regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(v.name), '[^a-z0-9]', '', 'g')
);

-- 2. Week 6 box scores (167 rows)
create table if not exists week_box_2026 (
  week integer not null,
  manager_name text not null,
  player_name text not null,
  proj numeric,
  actual numeric,
  started boolean not null
);
delete from week_box_2026 where week = 6;
insert into week_box_2026 (week, manager_name, player_name, proj, actual, started)
select 6, v.manager_name, v.player_name, v.proj, v.actual, v.started
from (values
  ('Dan','Dak Prescott',17.5,11.02,true),
  ('Dan','Kenneth Walker III',25.3,30.9,true),
  ('Dan','Javonte Williams',18.1,14.0,true),
  ('Dan','Matthew Golden',15.0,21.9,true),
  ('Dan','Jalen Coker',12.8,14.7,true),
  ('Dan','Juwan Johnson',9.7,0.0,true),
  ('Dan','Luther Burden III',11.9,14.5,true),
  ('Dan','Germie Bernard',8.9,22.7,true),
  ('Dan','Brandon Aubrey',10.8,1.0,true),
  ('Dan','Amon-Ra St. Brown',null,null,false),
  ('Dan','Colston Loveland',7.9,16.5,false),
  ('Dan','Lamar Jackson',0.0,0.0,false),
  ('Dan','TreVeyon Henderson',9.5,3.0,false),
  ('Dan','Emmett Johnson',5.5,5.9,false),
  ('Dan','Adonai Mitchell',0.0,0.0,false),
  ('Dan','Kenyon Sadiq',5.6,2.2,false),
  ('Dan','Alec Pierce',0.0,0.0,false),

  ('John','Kirk Cousins',18.5,18.52,true),
  ('John','James Cook III',21.7,27.3,true),
  ('John','Braelon Allen',15.6,15.4,true),
  ('John','CeeDee Lamb',17.1,13.5,true),
  ('John','Jacob Cowing',7.6,0.0,true),
  ('John','Trey McBride',15.1,10.8,true),
  ('John','Woody Marks',12.3,10.1,true),
  ('John','Tyler Allgeier',13.2,6.8,true),
  ('John','Matt Gay',11.3,11.5,true),
  ('John','Breece Hall',0.0,0.0,false),
  ('John','David Montgomery',0.0,0.0,false),
  ('John','DJ Moore',0.0,0.0,false),
  ('John','DK Metcalf',10.9,17.3,false),
  ('John','Jalen Hurts',0.0,0.0,false),
  ('John','Kyle Monangai',0.0,0.0,false),
  ('John','Pat Freiermuth',10.3,2.6,false),
  ('John','Deebo Samuel Sr.',0.0,0.0,false),

  ('Big E','Trevor Lawrence',18.1,27.34,true),
  ('Big E','Jonathan Taylor',21.4,24.1,true),
  ('Big E','Chuba Hubbard',16.2,22.6,true),
  ('Big E','George Pickens',12.5,12.8,true),
  ('Big E','Davante Adams',15.5,6.9,true),
  ('Big E','Isaiah Likely',13.5,23.4,true),
  ('Big E','Parker Washington',14.7,9.9,true),
  ('Big E','Travis Kelce',10.6,8.8,true),
  ('Big E','Jason Myers',7.1,7.9,true),
  ('Big E','Emeka Egbuka',10.4,15.3,false),
  ('Big E','Rome Odunze',9.9,6.9,false),
  ('Big E','Rico Dowdle',6.7,7.9,false),
  ('Big E','Jonah Coleman',0.0,0.0,false),
  ('Big E','Devaughn Vele',10.1,6.2,false),
  ('Big E','Jaylen Wright',null,null,false),
  ('Big E','Keenan Allen',8.3,14.2,false),
  ('Big E','Zach Charbonnet',0.0,0.0,false),

  ('Reid','Jayden Daniels',21.3,21.0,true),
  ('Reid','J.K. Dobbins',11.6,13.1,true),
  ('Reid','Jaylen Warren',15.7,11.3,true),
  ('Reid','Jaxon Smith-Njigba',18.5,23.4,true),
  ('Reid','Ladd McConkey',9.6,2.7,true),
  ('Reid','Dallas Goedert',9.1,10.6,true),
  ('Reid','Kendre Miller',12.0,9.0,true),
  ('Reid','Mike Evans',14.1,12.4,true),
  ('Reid','Cameron Dicker',8.2,5.3,true),
  ('Reid','Tee Higgins',null,null,false),
  ('Reid','Jonathon Brooks',0.0,0.0,false),
  ('Reid','Sam LaPorta',null,null,false),
  ('Reid','Tyjae Spears',8.8,1.8,false),
  ('Reid','Keaton Mitchell',9.7,3.4,false),
  ('Reid','Tre Tucker',9.8,26.2,false),
  ('Reid','Travis Etienne Jr.',0.0,0.0,false),

  ('Freed','Patrick Mahomes',19.3,10.98,true),
  ('Freed','Derrick Henry',20.7,6.0,true),
  ('Freed','Bhayshul Tuten',13.9,25.2,true),
  ('Freed','Puka Nacua',21.7,12.0,true),
  ('Freed','Christian Watson',15.4,9.4,true),
  ('Freed','Brock Bowers',18.2,10.5,true),
  ('Freed','Dameon Pierce',14.5,15.5,true),
  ('Freed','Rachaad White',13.0,14.7,true),
  ('Freed','Dominic Zvada',11.5,8.5,true),
  ('Freed','Jaylen Waddle',8.6,4.4,false),
  ('Freed','Jacory Croskey-Merritt',0.0,0.0,false),
  ('Freed','Blake Corum',9.8,15.0,false),
  ('Freed','KC Concepcion',7.4,6.9,false),
  ('Freed','Kyler Murray',null,null,false),
  ('Freed','Rashee Rice',0.0,0.0,false),
  ('Freed','Austin Ekeler',7.9,1.7,false),
  ('Freed','Saquon Barkley',0.0,0.0,false),

  ('JM/Cameron','Brock Purdy',22.0,19.36,true),
  ('JM/Cameron','Cam Skattebo',9.8,0.0,true),
  ('JM/Cameron','Jaleel McLaughlin',10.9,7.5,true),
  ('JM/Cameron','Drake London',14.8,11.2,true),
  ('JM/Cameron','Carnell Tate',10.0,18.0,true),
  ('JM/Cameron','Tyler Higbee',6.5,2.2,true),
  ('JM/Cameron','Makai Lemon',5.1,3.9,true),
  ('JM/Cameron','Keon Coleman',10.2,15.9,true),
  ('JM/Cameron','Spencer Shrader',11.6,9.0,true),
  ('JM/Cameron','Jahmyr Gibbs',null,null,false),
  ('JM/Cameron','Jeremiyah Love',0.0,0.0,false),
  ('JM/Cameron','Quinshon Judkins',0.0,0.0,false),
  ('JM/Cameron','Marvin Harrison Jr.',3.3,6.4,false),
  ('JM/Cameron','Josh Jacobs',0.0,0.0,false),
  ('JM/Cameron','Ollie Gordon II',null,null,false),
  ('JM/Cameron','Brenton Strange',8.8,8.4,false),
  ('JM/Cameron','Tyreek Hill',0.0,0.0,false),

  ('Mamby/Tenner','Drake Maye',21.2,24.3,true),
  ('Mamby/Tenner','Bijan Robinson',24.9,6.8,true),
  ('Mamby/Tenner','D''Andre Swift',16.3,23.5,true),
  ('Mamby/Tenner','Nico Collins',15.8,10.9,true),
  ('Mamby/Tenner','Garrett Wilson',13.4,7.9,true),
  ('Mamby/Tenner','Mark Andrews',7.7,1.4,true),
  ('Mamby/Tenner','A.J. Brown',11.9,4.7,true),
  ('Mamby/Tenner','Tony Pollard',15.8,9.6,true),
  ('Mamby/Tenner','Ka''imi Fairbairn',8.8,11.4,true),
  ('Mamby/Tenner','Courtland Sutton',7.9,3.9,false),
  ('Mamby/Tenner','Stefon Diggs',9.5,14.9,false),
  ('Mamby/Tenner','Aaron Jones Sr.',null,null,false),
  ('Mamby/Tenner','RJ Harvey',9.9,15.6,false),
  ('Mamby/Tenner','Brian Robinson Jr.',9.5,2.0,false),
  ('Mamby/Tenner','Khalil Shakir',10.7,12.4,false),
  ('Mamby/Tenner','Matthew Stafford',19.8,16.88,false),

  ('Wally','Caleb Williams',17.5,17.0,true),
  ('Wally','Omarion Hampton',10.0,6.4,true),
  ('Wally','MarShawn Lloyd',11.8,1.0,true),
  ('Wally','DeVonta Smith',12.4,18.5,true),
  ('Wally','Malik Nabers',16.4,26.0,true),
  ('Wally','Tucker Kraft',11.1,7.2,true),
  ('Wally','Denzel Boston',12.9,2.5,true),
  ('Wally','Rashid Shaheed',10.9,14.3,true),
  ('Wally','Cam Little',7.8,10.0,true),
  ('Wally','Chase Brown',null,null,false),
  ('Wally','Jameson Williams',null,null,false),
  ('Wally','Jadarian Price',0.0,0.0,false),
  ('Wally','Kaelon Black',6.5,5.2,false),
  ('Wally','Quentin Johnston',7.0,6.7,false),
  ('Wally','Bryce Young',18.7,19.84,false),
  ('Wally','Jacoby Brissett',15.6,7.42,false),
  ('Wally','Jordyn Tyson',0.0,0.0,false),

  ('Braden','Jordan Love',21.2,21.24,true),
  ('Braden','Christian McCaffrey',22.2,29.2,true),
  ('Braden','Kyren Williams',22.1,10.7,true),
  ('Braden','Zay Flowers',12.9,10.7,true),
  ('Braden','Tetairoa McMillan',15.0,13.1,true),
  ('Braden','George Kittle',14.0,16.4,true),
  ('Braden','Josh Downs',9.0,8.2,true),
  ('Braden','Xavier Worthy',10.4,12.3,true),
  ('Braden','Tyler Loop',9.7,3.4,true),
  ('Braden','Justin Jefferson',null,null,false),
  ('Braden','Tyler Warren',0.0,0.0,false),
  ('Braden','Joe Burrow',null,null,false),
  ('Braden','Tyler Shough',17.4,28.46,false),
  ('Braden','Alvin Kamara',10.1,15.4,false),
  ('Braden','Rashod Bateman',5.6,0.0,false),
  ('Braden','Kendrick Bourne',5.0,8.7,false),

  ('Caden','Josh Allen',26.5,18.8,true),
  ('Caden','Ashton Jeanty',19.8,15.8,true),
  ('Caden','Bucky Irving',17.4,6.9,true),
  ('Caden','Chris Olave',15.9,13.8,true),
  ('Caden','Michael Wilson',13.0,6.2,true),
  ('Caden','Harold Fannin Jr.',9.3,1.4,true),
  ('Caden','Rhamondre Stevenson',14.0,5.1,true),
  ('Caden','Emanuel Wilson',16.5,7.7,true),
  ('Caden','Chris Boswell',9.3,17.9,true),
  ('Caden','Ja''Marr Chase',null,null,false),
  ('Caden','Terry McLaurin',11.5,3.7,false),
  ('Caden','Mike Washington Jr.',4.4,6.5,false),
  ('Caden','Malik Washington',null,null,false),
  ('Caden','Jared Goff',null,null,false),
  ('Caden','Will Reichard',null,null,false),
  ('Caden','Wan''Dale Robinson',8.4,4.2,false),
  ('Caden','Jordan Mason',null,null,false)
) as v(manager_name, player_name, proj, actual, started);

-- 3. Roster rows for players who don't have one yet
insert into roster_entries (player_id, team_id, season_id, league_id, stats)
select distinct on (regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')) p.id, t.id, s.id, t.league_id, '{}'::jsonb
from week_box_2026 w
join managers m on m.name = w.manager_name
cross join (select id from seasons where year = 2026) s
join teams t on t.manager_id = m.id and t.season_id = s.id
join players p on regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
where w.week = 6
  and not exists (
    select 1 from roster_entries re
    join players p2 on p2.id = re.player_id
    where re.team_id in (select t.id from teams t join seasons s on s.id = t.season_id and s.year = 2026) and regexp_replace(lower(p2.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  )
order by regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g'), p.id;

-- 4. Week 6 stats + ownership snapshot, and point team_id at the current team
update roster_entries re
set team_id = t.id,
    stats = coalesce(re.stats, '{}'::jsonb) || jsonb_build_object(
      'teamId', coalesce(re.stats->'teamId', '{}'::jsonb) || jsonb_build_object('6', t.id::text),
      'started', coalesce(re.stats->'started', '{}'::jsonb) || jsonb_build_object('6', w.started),
      'actual', case when w.actual is null then coalesce(re.stats->'actual', '{}'::jsonb) - '6'
                     else coalesce(re.stats->'actual', '{}'::jsonb) || jsonb_build_object('6', w.actual) end,
      'proj', case when w.proj is null then coalesce(re.stats->'proj', '{}'::jsonb) - '6'
                   else coalesce(re.stats->'proj', '{}'::jsonb) || jsonb_build_object('6', w.proj) end
    )
from week_box_2026 w
join managers m on m.name = w.manager_name
join seasons s on s.year = 2026
join teams t on t.manager_id = m.id and t.season_id = s.id,
players pe
where w.week = 6
  and pe.id = re.player_id
  and regexp_replace(lower(pe.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  and re.team_id in (select t.id from teams t join seasons s on s.id = t.season_id and s.year = 2026);

-- Check 1: players on each team's Week 6 roster by snapshot. Expect 16-17 per
-- team, identical to the ESPN box score (Reid, Mamby/Tenner and Braden have 16).
select m.name as manager, count(*) as wk6_roster
from teams t
join seasons s on s.id = t.season_id and s.year = 2026
join managers m on m.id = t.manager_id
join roster_entries re on re.stats->'teamId'->>'6' = t.id::text
group by m.name order by m.name;

-- Check 2: box-score rows that matched no roster_entries row (send me any).
select w.manager_name, w.player_name
from week_box_2026 w
left join managers m on m.name = w.manager_name
left join seasons s on s.year = 2026
left join teams t on t.manager_id = m.id and t.season_id = s.id
where w.week = 6
  and not exists (
    select 1 from roster_entries re
    join players pe on pe.id = re.player_id
    where re.team_id = t.id and re.stats->'teamId'->>'6' = t.id::text
      and regexp_replace(lower(pe.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  );

drop table week_box_2026;
