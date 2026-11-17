-- Fantasy Chatroom 2026-27 Week 10 individual player fantasy points and roster.
-- Companion to week10_results_seed_2026.sql. Same fields /api/espn-sync writes:
--   stats.actual[10]  -- real fantasy points scored
--   stats.started[10] -- true for a starting slot, false for bench/IR
--   stats.proj[10]    -- ESPN's pre-game projection
--   stats.teamId[10]  -- which team owned the player in Week 10 (roster snapshot)
--
-- Rosters come straight from the Week 10 box scores: players new to a team get
-- teamId[10] and their team_id moved there; players who left a team simply have
-- no Week 10 snapshot. New pickups are added to players / roster_entries first.
-- league_id is taken from the team row, never a managers subquery.
--
-- Bye-week players (*BYE* on the box score) get no actual/proj for Week 10: no
-- game was played, and a 0 would drag down their season average and the
-- bye-week analysis. They are still on the roster and still bench.
--
-- Safe to re-run: every write sets the same absolute Week 10 values and never
-- touches any other week.

-- 1. Players not in the players table yet
insert into players (name, position)
select v.name, v.position from (values
  ('Kaleb Johnson', 'RB'),
  ('Eli Raridon', 'TE'),
  ('Fernando Mendoza', 'QB'),
  ('Darren Waller', 'TE'),
  ('Tank Dell', 'WR'),
  ('Wan''Dale Robinson', 'WR'),
  ('Jacory Croskey-Merritt', 'RB'),
  ('CJ Daniels', 'WR'),
  ('Cam Little', 'K'),
  ('Jason Myers', 'K'),
  ('Tutu Atwell', 'WR'),
  ('Konata Mumpfield', 'WR'),
  ('Corey Kiner', 'RB'),
  ('Malik Nabers', 'WR'),
  ('Caleb Williams', 'QB'),
  ('Dak Prescott', 'QB')
) as v(name, position)
where not exists (
  select 1 from players p where regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(v.name), '[^a-z0-9]', '', 'g')
);

-- 2. Week 10 box scores (168 rows)
create table if not exists week_box_2026 (
  week integer not null,
  manager_name text not null,
  player_name text not null,
  proj numeric,
  actual numeric,
  started boolean not null
);
delete from week_box_2026 where week = 10;
insert into week_box_2026 (week, manager_name, player_name, proj, actual, started)
select 10, v.manager_name, v.player_name, v.proj, v.actual, v.started
from (values
  ('Dan','Kirk Cousins',13.2,15.38,true),
  ('Dan','Emmett Johnson',20.5,36.6,true),
  ('Dan','Kaleb Johnson',7.3,5.2,true),
  ('Dan','Amon-Ra St. Brown',18.7,24.8,true),
  ('Dan','Matthew Golden',16.2,12.0,true),
  ('Dan','Harold Fannin Jr.',9.1,14.6,true),
  ('Dan','Germie Bernard',9.7,1.5,true),
  ('Dan','Malik Nabers',14.8,5.4,true),
  ('Dan','Brandon Aubrey',11.1,11.4,true),
  ('Dan','Kenneth Walker III',0.0,0.0,false),
  ('Dan','Colston Loveland',null,null,false),
  ('Dan','Luther Burden III',null,null,false),
  ('Dan','TreVeyon Henderson',0.0,0.0,false),
  ('Dan','Jonah Coleman',null,null,false),
  ('Dan','Dalton Kincaid',8.2,7.3,false),
  ('Dan','Caleb Williams',null,null,false),
  ('Dan','Tyrone Tracy Jr.',0.0,0.0,false),

  ('Reid','Jayden Daniels',18.7,21.76,true),
  ('Reid','Travis Etienne Jr.',11.0,5.4,true),
  ('Reid','Jaylen Warren',16.8,8.1,true),
  ('Reid','Jaxon Smith-Njigba',21.0,30.1,true),
  ('Reid','Tee Higgins',14.8,11.6,true),
  ('Reid','Sam LaPorta',10.4,2.6,true),
  ('Reid','Dylan Sampson',11.5,6.2,true),
  ('Reid','Keaton Mitchell',7.8,1.9,true),
  ('Reid','Harrison Butker',9.7,5.0,true),
  ('Reid','Ladd McConkey',0.0,0.0,false),
  ('Reid','J.K. Dobbins',null,null,false),
  ('Reid','Dallas Goedert',null,null,false),
  ('Reid','Mike Evans',0.0,0.0,false),
  ('Reid','Tre Tucker',7.9,1.4,false),
  ('Reid','Bo Nix',null,null,false),
  ('Reid','Chris Rodriguez Jr.',7.8,1.0,false),
  ('Reid','Jonathon Brooks',0.0,0.0,false),

  ('Caden','Josh Allen',25.5,24.34,true),
  ('Caden','Ashton Jeanty',13.5,9.4,true),
  ('Caden','Jordan Mason',10.1,7.9,true),
  ('Caden','Ja''Marr Chase',21.1,33.1,true),
  ('Caden','Chris Olave',14.5,6.0,true),
  ('Caden','Hunter Henry',7.9,3.7,true),
  ('Caden','Omar Cooper Jr.',8.6,0.0,true),
  ('Caden','Caleb Douglas',8.1,10.1,true),
  ('Caden','Will Reichard',10.0,11.6,true),
  ('Caden','Bucky Irving',null,null,false),
  ('Caden','Rhamondre Stevenson',13.9,1.0,false),
  ('Caden','Mike Washington Jr.',6.9,3.2,false),
  ('Caden','Jared Goff',17.5,20.92,false),
  ('Caden','Kenny Gainwell',null,null,false),
  ('Caden','Wan''Dale Robinson',9.1,2.5,false),
  ('Caden','Tank Dell',9.8,4.1,false),
  ('Caden','Jacory Croskey-Merritt',0.0,0.0,false),

  ('John','C.J. Stroud',18.7,20.94,true),
  ('John','James Cook III',23.0,24.2,true),
  ('John','Breece Hall',13.1,15.8,true),
  ('John','CeeDee Lamb',19.3,18.7,true),
  ('John','DJ Moore',13.0,18.4,true),
  ('John','Trey McBride',12.1,7.2,true),
  ('John','Deebo Samuel Sr.',14.4,26.9,true),
  ('John','Woody Marks',15.6,9.0,true),
  ('John','Matt Gay',8.8,8.7,true),
  ('John','DK Metcalf',10.1,15.4,false),
  ('John','Kyle Monangai',null,null,false),
  ('John','Braelon Allen',8.2,6.1,false),
  ('John','Tyler Allgeier',9.4,1.9,false),
  ('John','Kyle Pitts Sr.',8.3,5.5,false),
  ('John','DeMario Douglas',9.5,0.9,false),
  ('John','Audric Estime',5.7,2.1,false),
  ('John','David Montgomery',0.0,0.0,false),

  ('Wally','Bryce Young',19.1,8.1,true),
  ('Wally','Chase Brown',13.2,27.8,true),
  ('Wally','Javonte Williams',16.0,9.2,true),
  ('Wally','Jameson Williams',11.5,8.0,true),
  ('Wally','Denzel Boston',12.1,3.6,true),
  ('Wally','Tucker Kraft',8.5,2.9,true),
  ('Wally','Jadarian Price',12.8,12.4,true),
  ('Wally','Jalen Coker',10.6,0.3,true),
  ('Wally','Tyler Bass',11.8,7.7,true),
  ('Wally','Omarion Hampton',8.7,20.5,false),
  ('Wally','DeVonta Smith',null,null,false),
  ('Wally','Kaelon Black',8.5,15.6,false),
  ('Wally','Jordyn Tyson',7.8,15.5,false),
  ('Wally','Jordan Addison',0.0,0.0,false),
  ('Wally','Antonio Williams',7.0,12.2,false),
  ('Wally','Dak Prescott',16.9,35.42,false),

  ('Braden','Joe Burrow',19.4,33.16,true),
  ('Braden','Christian McCaffrey',22.5,47.8,true),
  ('Braden','Kyren Williams',19.7,4.7,true),
  ('Braden','Justin Jefferson',17.5,14.4,true),
  ('Braden','Tetairoa McMillan',15.1,6.0,true),
  ('Braden','George Kittle',14.4,12.4,true),
  ('Braden','Zay Flowers',13.7,9.9,true),
  ('Braden','Tyler Warren',9.4,1.9,true),
  ('Braden','Cam Little',10.3,21.0,true),
  ('Braden','Josh Downs',9.8,14.8,false),
  ('Braden','Xavier Worthy',9.2,0.0,false),
  ('Braden','Tyler Shough',18.1,10.48,false),
  ('Braden','Alvin Kamara',7.9,15.9,false),
  ('Braden','Jordan Love',16.3,10.8,false),
  ('Braden','Chase McLaughlin',null,null,false),
  ('Braden','CJ Daniels',5.6,3.2,false),

  ('JM/Cameron','Brock Purdy',21.5,32.16,true),
  ('JM/Cameron','Jahmyr Gibbs',25.2,46.2,true),
  ('JM/Cameron','Cam Skattebo',13.0,29.7,true),
  ('JM/Cameron','Drake London',13.9,15.9,true),
  ('JM/Cameron','Adonai Mitchell',10.0,8.9,true),
  ('JM/Cameron','Eli Raridon',7.3,1.1,true),
  ('JM/Cameron','Quinshon Judkins',13.0,16.6,true),
  ('JM/Cameron','Ollie Gordon II',17.8,15.5,true),
  ('JM/Cameron','Spencer Shrader',11.3,8.1,true),
  ('JM/Cameron','Jeremiyah Love',0.0,0.0,false),
  ('JM/Cameron','Carnell Tate',0.0,0.0,false),
  ('JM/Cameron','Marvin Harrison Jr.',0.0,0.0,false),
  ('JM/Cameron','Josh Jacobs',0.0,0.0,false),
  ('JM/Cameron','Makai Lemon',null,null,false),
  ('JM/Cameron','Brandon Aiyuk',0.0,0.0,false),
  ('JM/Cameron','Fernando Mendoza',14.0,15.42,false),
  ('JM/Cameron','Lamar Jackson',0.0,0.0,false),

  ('Mamby/Tenner','Drake Maye',22.8,3.52,true),
  ('Mamby/Tenner','Bijan Robinson',19.9,17.7,true),
  ('Mamby/Tenner','Tony Pollard',14.9,22.9,true),
  ('Mamby/Tenner','Nico Collins',13.0,23.4,true),
  ('Mamby/Tenner','Garrett Wilson',11.6,14.1,true),
  ('Mamby/Tenner','Darren Waller',7.9,4.4,true),
  ('Mamby/Tenner','A.J. Brown',12.0,4.2,true),
  ('Mamby/Tenner','Jakobi Meyers',11.0,5.9,true),
  ('Mamby/Tenner','Ka''imi Fairbairn',10.6,7.5,true),
  ('Mamby/Tenner','D''Andre Swift',null,null,false),
  ('Mamby/Tenner','Stefon Diggs',9.4,18.3,false),
  ('Mamby/Tenner','Aaron Jones Sr.',9.0,13.5,false),
  ('Mamby/Tenner','Brian Robinson Jr.',0.0,0.0,false),
  ('Mamby/Tenner','Khalil Shakir',9.4,8.5,false),
  ('Mamby/Tenner','T.J. Hockenson',0.0,0.0,false),
  ('Mamby/Tenner','Devin Singletary',7.4,0.3,false),
  ('Mamby/Tenner','RJ Harvey',null,null,false),

  ('Big E','Trevor Lawrence',21.9,28.28,true),
  ('Big E','Jonathan Taylor',19.2,13.8,true),
  ('Big E','Chuba Hubbard',21.4,36.7,true),
  ('Big E','George Pickens',11.2,41.5,true),
  ('Big E','Parker Washington',14.2,27.7,true),
  ('Big E','Isaiah Likely',11.1,24.7,true),
  ('Big E','Travis Kelce',10.7,4.5,true),
  ('Big E','Zach Charbonnet',15.9,11.9,true),
  ('Big E','Chris Boswell',11.2,5.5,true),
  ('Big E','Emeka Egbuka',null,null,false),
  ('Big E','Rome Odunze',null,null,false),
  ('Big E','Rico Dowdle',10.1,5.4,false),
  ('Big E','Devaughn Vele',6.6,2.9,false),
  ('Big E','Keenan Allen',8.0,10.6,false),
  ('Big E','Dominic Zvada',8.7,2.0,false),
  ('Big E','Seth McGowan',8.1,18.2,false),
  ('Big E','Davante Adams',0.0,0.0,false),

  ('Freed','Patrick Mahomes',19.1,35.92,true),
  ('Freed','Bhayshul Tuten',19.1,21.3,true),
  ('Freed','Rachaad White',12.5,7.7,true),
  ('Freed','Christian Watson',14.6,6.2,true),
  ('Freed','Rashee Rice',12.1,11.7,true),
  ('Freed','Brock Bowers',14.2,3.8,true),
  ('Freed','Derrick Henry',20.7,17.5,true),
  ('Freed','Blake Corum',12.8,23.4,true),
  ('Freed','Jason Myers',9.5,2.0,true),
  ('Freed','Puka Nacua',0.0,0.0,false),
  ('Freed','Jaylen Waddle',null,null,false),
  ('Freed','KC Concepcion',9.8,10.7,false),
  ('Freed','Saquon Barkley',null,null,false),
  ('Freed','Corey Kiner',8.7,6.5,false),
  ('Freed','Tutu Atwell',8.5,4.1,false),
  ('Freed','Konata Mumpfield',8.4,11.1,false),
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
where w.week = 10
  and not exists (
    select 1 from roster_entries re
    join players p2 on p2.id = re.player_id
    where re.team_id in (select t.id from teams t join seasons s on s.id = t.season_id and s.year = 2026) and regexp_replace(lower(p2.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  )
order by regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g'), p.id;

-- 4. Week 10 stats + ownership snapshot, and point team_id at the current team
update roster_entries re
set team_id = t.id,
    stats = coalesce(re.stats, '{}'::jsonb) || jsonb_build_object(
      'teamId', coalesce(re.stats->'teamId', '{}'::jsonb) || jsonb_build_object('10', t.id::text),
      'started', coalesce(re.stats->'started', '{}'::jsonb) || jsonb_build_object('10', w.started),
      'actual', case when w.actual is null then coalesce(re.stats->'actual', '{}'::jsonb) - '10'
                     else coalesce(re.stats->'actual', '{}'::jsonb) || jsonb_build_object('10', w.actual) end,
      'proj', case when w.proj is null then coalesce(re.stats->'proj', '{}'::jsonb) - '10'
                   else coalesce(re.stats->'proj', '{}'::jsonb) || jsonb_build_object('10', w.proj) end
    )
from week_box_2026 w
join managers m on m.name = w.manager_name
join seasons s on s.year = 2026
join teams t on t.manager_id = m.id and t.season_id = s.id,
players pe
where w.week = 10
  and pe.id = re.player_id
  and regexp_replace(lower(pe.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  and re.team_id in (select t.id from teams t join seasons s on s.id = t.season_id and s.year = 2026);

-- Check 1: players on each team's Week 10 roster by snapshot. Expect 16-17 per
-- team, identical to the ESPN box score (Dan, Reid, Caden, Wally, Braden and Mamby/Tenner have 16).
select m.name as manager, count(*) as wk10_roster
from teams t
join seasons s on s.id = t.season_id and s.year = 2026
join managers m on m.id = t.manager_id
join roster_entries re on re.stats->'teamId'->>'10' = t.id::text
group by m.name order by m.name;

-- Check 2: box-score rows that matched no roster_entries row (send me any).
select w.manager_name, w.player_name
from week_box_2026 w
left join managers m on m.name = w.manager_name
left join seasons s on s.year = 2026
left join teams t on t.manager_id = m.id and t.season_id = s.id
where w.week = 10
  and not exists (
    select 1 from roster_entries re
    join players pe on pe.id = re.player_id
    where re.team_id = t.id and re.stats->'teamId'->>'10' = t.id::text
      and regexp_replace(lower(pe.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(w.player_name), '[^a-z0-9]', '', 'g')
  );

drop table week_box_2026;
