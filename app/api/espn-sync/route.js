import { createClient } from '@supabase/supabase-js'
import { fetchEspnWeek, parseEspnWeek } from '../../../lib/espnFantasy'
import { fetchSleeperCurrentWeek } from '../../../lib/sleeperProjections'
import { generateWeekBoard, generateFutures, generateProps } from '../../../lib/sportsbookGen'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const SEASON_YEAR = 2026

// This does several hundred sequential Supabase round trips (one per roster
// row touched), which comfortably exceeds Vercel Hobby's fixed 10s function
// limit -- that plan cannot be raised, so on Hobby this route may time out
// before finishing every player. Pro+ can actually use this to extend the
// limit (up to the plan's own cap).
export const maxDuration = 60

const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Pulls the week's real ESPN scores, real starters, real actual points, and
// ESPN's own per-player projection -- all from the same payload -- into the
// same DB fields the rest of the app already reads: matchups.home_score/
// away_score, and roster_entries.stats.actual/started/proj/teamId[week].
// Meant to be hit by a scheduled cron (see vercel.json) rather than the
// browser -- protected by CRON_SECRET so it can't be triggered by anyone
// with the URL.
//
// Also reconciles roster membership against ESPN's current roster for each
// team (trades, waiver pickups/drops) rather than only updating stats on
// whatever roster_entries happened to exist from the season's initial seed
// -- a player who moved teams gets their existing row re-homed, and a
// player who was never seeded (a free-agent pickup) gets a new players/
// roster_entries row created. This reconciliation ONLY happens when `week`
// is the actual current week;
// hit with an older `?week=N` (e.g. to backfill a week whose roster_entries
// didn't exist yet at the time), it only fills in that week's stats for
// whoever's already on file, and never touches team_id -- otherwise a
// backfill of an old week would undo a real move that happened since, since
// that old week's data still shows the player on their previous team.
//
// Every ESPN/Supabase call here is best-effort and independently caught so
// one feed's outage (or one bad team/player match) can't block the rest --
// same posture the reference implementation (AMFFL) uses for its hourly
// sync.
export async function GET(request) {
  if (process.env.CRON_SECRET) {
    const auth = request.headers.get('authorization') || ''
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const { searchParams } = new URL(request.url)
  const currentWeek = (await fetchSleeperCurrentWeek()) || 1
  const requestedWeek = parseInt(searchParams.get('week') || '')
  const week = requestedWeek || currentWeek
  // Team assignment only ever reflects *right now* -- reconciling it against
  // an older week's roster snapshot would undo a real move that happened
  // since (e.g. backfilling Week 1 after a Week 2 sync already moved a
  // player to a new team would move them back, because Week 1's data still
  // shows their old team). So only the current week's sync is allowed to
  // create players or move team_id; a backfill of a past week only ever
  // fills in that week's stats for whichever roster_entries row already
  // exists, wherever it currently lives.
  const isBackfill = week < currentWeek

  const result = {
    week, isBackfill, matchupsSynced: 0, playersScored: 0, unmatchedPlayers: [],
    rosterMoves: [], newRosterEntries: [], projectionsSynced: 0, errors: [],
    // ^ projectionsSynced counts players who got ESPN's own per-player
    // projection for this week, from the same payload as everything else.
  }

  const { data: season } = await supabase.from('seasons').select('id').eq('year', SEASON_YEAR).single()
  if (!season) {
    result.errors.push(`No seasons row for year ${SEASON_YEAR}`)
    return Response.json(result, { status: 400 })
  }

  const { data: teams } = await supabase.from('teams')
    .select('id, espn_team_id, manager:manager_id(name)')
    .eq('season_id', season.id)
  const teamsByEspnId = Object.fromEntries((teams || []).filter(t => t.espn_team_id != null).map(t => [t.espn_team_id, t]))
  if (!teams?.length) {
    result.errors.push(`No teams found for season ${SEASON_YEAR}`)
    return Response.json(result, { status: 400 })
  }
  if (!Object.keys(teamsByEspnId).length) {
    result.errors.push('No team has espn_team_id set -- run espn_team_id_seed_2026.sql first')
  }

  // One shared fetch of every roster row for this season.
  const { data: allEntries } = await supabase.from('roster_entries')
    .select('id, team_id, player_id, stats, player:player_id(name)')
    .in('team_id', teams.map(t => t.id))
  const entryByTeamAndName = new Map((allEntries || []).map(e => [`${e.team_id}|${norm(e.player?.name)}`, e]))
  // Season-wide (not team-scoped) name lookup, so a player who moved teams
  // (trade/waiver) can be detected and re-homed instead of reported as
  // unmatched. Ties (rare -- two same-named NFL players) resolve to
  // whichever row was seen last; not worth a more careful merge for how
  // infrequently that happens.
  const entryByAnyTeamAndName = new Map((allEntries || []).map(e => [norm(e.player?.name), e]))

  // -- ESPN: authoritative matchup scores, real starters, real actual points, real projections --
  try {
    const raw = await fetchEspnWeek(SEASON_YEAR, week)
    const { matchups, playerLines } = parseEspnWeek(raw, week)

    for (const m of matchups) {
      const home = teamsByEspnId[m.espnHomeId]
      const away = teamsByEspnId[m.espnAwayId]
      if (!home || !away) {
        result.errors.push(`Unmatched ESPN team id in a Week ${week} matchup: ${m.espnHomeId} vs ${m.espnAwayId}`)
        continue
      }
      const { data: existing } = await supabase.from('matchups').select('id')
        .eq('season_id', season.id).eq('week', week)
        .eq('home_team_id', home.id).eq('away_team_id', away.id)
        .maybeSingle()
      if (existing) {
        await supabase.from('matchups').update({ home_score: m.homeScore, away_score: m.awayScore }).eq('id', existing.id)
      } else {
        await supabase.from('matchups').insert({
          season_id: season.id, week, home_team_id: home.id, away_team_id: away.id,
          home_score: m.homeScore, away_score: m.awayScore,
        })
      }
      result.matchupsSynced++
    }

    for (const line of playerLines) {
      const team = teamsByEspnId[line.espnTeamId]
      if (!team) continue
      const key = norm(line.playerName)
      let entry = entryByTeamAndName.get(`${team.id}|${key}`)

      // Not on this team's roster in our DB.
      if (!entry) {
        if (isBackfill) {
          // A backfill only ever attaches this week's stats to wherever the
          // player already sits today -- never moves team_id (see the note
          // on isBackfill above) and never creates a brand-new row (we'd
          // have no reliable way to know whether their team back then still
          // is their team now, so it's safer to report them unmatched than
          // guess).
          entry = entryByAnyTeamAndName.get(key) || null
        } else {
          // Current-week sync: either they moved here from another of our
          // tracked teams (trade/waiver claim), or they're new to the
          // league entirely (a free-agent pickup we've never seeded).
          const elsewhere = entryByAnyTeamAndName.get(key)
          if (elsewhere && elsewhere.team_id !== team.id) {
            const fromTeamId = elsewhere.team_id
            await supabase.from('roster_entries').update({ team_id: team.id }).eq('id', elsewhere.id)
            elsewhere.team_id = team.id
            entry = elsewhere
            result.rosterMoves.push(`${line.playerName} -> ${team.manager?.name || team.id}`)
            await supabase.from('roster_moves').insert({
              season_id: season.id, week, player_id: elsewhere.player_id,
              from_team_id: fromTeamId, to_team_id: team.id, move_type: 'moved',
            })
          } else if (!elsewhere) {
            let { data: player } = await supabase.from('players').select('id').eq('name', line.playerName).maybeSingle()
            if (!player) {
              const { data: newPlayer, error: playerErr } = await supabase.from('players')
                .insert({ name: line.playerName, position: line.position }).select('id').single()
              if (playerErr) { result.errors.push(`Could not create player ${line.playerName}: ${playerErr.message}`); continue }
              player = newPlayer
            }
            const { data: newEntry, error: entryErr } = await supabase.from('roster_entries')
              .insert({ team_id: team.id, player_id: player.id, stats: {} }).select('id, stats').single()
            if (entryErr) { result.errors.push(`Could not roster ${line.playerName}: ${entryErr.message}`); continue }
            entry = { ...newEntry, team_id: team.id, player_id: player.id, player: { name: line.playerName } }
            result.newRosterEntries.push(`${line.playerName} -> ${team.manager?.name || team.id}`)
            await supabase.from('roster_moves').insert({
              season_id: season.id, week, player_id: player.id,
              from_team_id: null, to_team_id: team.id, move_type: 'added',
            })
          }
        }
        if (entry) {
          entryByTeamAndName.set(`${team.id}|${key}`, entry)
          entryByAnyTeamAndName.set(key, entry)
        }
      }

      if (!entry) {
        result.unmatchedPlayers.push(`${line.playerName} (${team.manager?.name || team.id})`)
        continue
      }
      const stats = entry.stats || {}
      const nextStats = {
        ...stats,
        actual: { ...(stats.actual || {}), [week]: line.actual },
        started: { ...(stats.started || {}), [week]: line.started },
        // Immutable per-week ownership snapshot -- separate from team_id
        // (which is allowed to change going forward). This is what lets a
        // later trade move team_id without rewriting who owned this player
        // in a week that's already happened.
        teamId: { ...(stats.teamId || {}), [week]: team.id },
      }
      if (line.proj != null) {
        nextStats.proj = { ...(stats.proj || {}), [week]: line.proj }
        result.projectionsSynced++
      }
      await supabase.from('roster_entries').update({ stats: nextStats }).eq('id', entry.id)
      entry.stats = nextStats
      result.playersScored++
    }
  } catch (e) {
    result.errors.push(`ESPN sync failed: ${e.message}`)
  }

  // Auto-fill the sportsbook's board/futures/props from the same data this
  // sync just refreshed -- current-week only, same reasoning as roster
  // reconciliation above: a backfill of an old week has nothing useful to
  // say about "now," so it never touches the book.
  if (!isBackfill) {
    try {
      const sbSeason = `${SEASON_YEAR}-${String(SEASON_YEAR + 1).slice(2)}`
      const [{ data: sbTeams }, { data: sbMatchupsRaw }, { data: sbRosterEntries }] = await Promise.all([
        supabase.from('teams').select('id, team_name, manager:manager_id(name)').eq('season_id', season.id),
        supabase.from('matchups').select('id, week, home_team_id, away_team_id, home_score, away_score').eq('season_id', season.id).eq('is_playoff', false),
        supabase.from('roster_entries').select('id, team_id, player_id, stats, player:player_id(id, name, position)').in('team_id', teams.map(t => t.id)),
      ])
      const sbMatchups = (sbMatchupsRaw || []).map(m => ({ ...m, home_team: { id: m.home_team_id }, away_team: { id: m.away_team_id } }))
      const genArgs = { season: sbSeason, week, teams: sbTeams || [], matchups: sbMatchups, rosterEntries: sbRosterEntries || [] }
      const [board, futures, props] = await Promise.all([
        generateWeekBoard(supabase, genArgs),
        generateFutures(supabase, genArgs),
        generateProps(supabase, genArgs),
      ])
      result.sportsbook = { board, futures, props }
    } catch (e) {
      result.errors.push(`Sportsbook auto-generation failed: ${e.message}`)
    }
  }

  return Response.json(result)
}
