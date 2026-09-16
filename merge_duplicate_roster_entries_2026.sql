-- Several players ended up with two roster_entries rows on the same team
-- this season -- two separate `players` rows with the identical name, each
-- rostered independently. Almost certainly leftover from the season's
-- original multi-script manual box-score seed (roster_seed_2026.sql,
-- week1_actual_seed_2026.sql, week1_proj_seed_2026.sql,
-- week2_proj_seed_2026.sql each ran separately, apparently without checking
-- whether the player already existed before inserting one) rather than
-- anything the ESPN sync is doing -- the sync matches by normalized name
-- against every existing roster row and will find a single merged row fine
-- going forward.
--
-- This merges each pair's stats (union of every week's proj/actual/started/
-- teamId, the two sides agree wherever they overlap in the data seen so
-- far) into the older roster_entries row and deletes the now-redundant one.
-- The extra `players` row is left in place -- unreferenced, harmless --
-- rather than trying to repoint every table that could reference players.id.
--
-- Run the SELECT first. Only run the UPDATE + DELETE below it once the
-- preview looks right. If any group has more than 2 duplicate rows, this
-- only merges the first two and drops the rest -- re-run the SELECT
-- afterward to confirm nothing was left behind.

-- 1) Preview
with dupes as (
  select re.id as entry_id, re.team_id, re.player_id, p.name, re.stats,
         row_number() over (partition by re.team_id, p.name order by re.id) as rn
  from roster_entries re
  join players p on p.id = re.player_id
  join teams t on t.id = re.team_id
  join seasons s on s.id = t.season_id
  where s.year = 2026
)
select * from dupes d
where exists (select 1 from dupes d2 where d2.team_id = d.team_id and d2.name = d.name and d2.entry_id <> d.entry_id)
order by team_id, name, rn;

-- 2) Merge stats into the row we're keeping (run after reviewing the preview)
with dupes as (
  select re.id as entry_id, re.team_id, re.player_id, p.name, re.stats,
         row_number() over (partition by re.team_id, p.name order by re.id) as rn
  from roster_entries re
  join players p on p.id = re.player_id
  join teams t on t.id = re.team_id
  join seasons s on s.id = t.season_id
  where s.year = 2026
),
groups as (
  select team_id, name,
         (array_agg(entry_id order by rn))[1] as keep_id,
         (array_agg(stats order by rn))[1] as keep_stats,
         (array_agg(stats order by rn))[2] as drop_stats
  from dupes
  group by team_id, name
  having count(*) > 1
)
update roster_entries re
set stats = jsonb_build_object(
  'proj', coalesce(g.keep_stats->'proj', '{}'::jsonb) || coalesce(g.drop_stats->'proj', '{}'::jsonb),
  'actual', coalesce(g.keep_stats->'actual', '{}'::jsonb) || coalesce(g.drop_stats->'actual', '{}'::jsonb),
  'started', coalesce(g.keep_stats->'started', '{}'::jsonb) || coalesce(g.drop_stats->'started', '{}'::jsonb),
  'teamId', coalesce(g.keep_stats->'teamId', '{}'::jsonb) || coalesce(g.drop_stats->'teamId', '{}'::jsonb)
)
from groups g
where re.id = g.keep_id;

-- 3) Delete the now-redundant row(s)
with dupes as (
  select re.id as entry_id, re.team_id, re.player_id, p.name, re.stats,
         row_number() over (partition by re.team_id, p.name order by re.id) as rn
  from roster_entries re
  join players p on p.id = re.player_id
  join teams t on t.id = re.team_id
  join seasons s on s.id = t.season_id
  where s.year = 2026
),
groups as (
  select team_id, name, (array_agg(entry_id order by rn))[2:] as drop_ids
  from dupes
  group by team_id, name
  having count(*) > 1
)
delete from roster_entries
where id in (select unnest(drop_ids) from groups);
