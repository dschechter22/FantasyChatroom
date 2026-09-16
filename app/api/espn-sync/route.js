import { createClient } from '@supabase/supabase-js'
import { fetchEspnWeek, parseEspnWeek } from '../../../lib/espnFantasy'
import { fetchSleeperProjections, fetchSleeperCurrentWeek } from '../../../lib/sleeperProjections'
import { scorePlayer } from '../../../lib/scoring'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const SEASON_YEAR = 2026

// This does several hundred sequential Supabase round trips (one per roster
// row touched), which comfortably exceeds Vercel Hobby's fixed 10s function
// limit -- that plan cannot be raised, so on Hobby this route may time out
// before finishing every player. Pro+ can actually use this to extend the
// limit (up to the plan's own cap).
export const maxDuration = 60

const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Pulls the week's real ESPN scores/starters/actual points, plus that same
// week's Sleeper projections (scored under this league's own rules), into
// the same DB fields the rest of the app already reads: matchups.home_score/
// away_score, and roster_entries.stats.actual/started/proj[week]. Meant to
// be hit by a scheduled cron (see vercel.json) rather than the browser --
// protected by CRON_SECRET so it can't be triggered by anyone with the URL.
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
  const week = parseInt(searchParams.get('week') || '') || (await fetchSleeperCurrentWeek()) || 1

  const result = { week, matchupsSynced: 0, playersScored: 0, unmatchedPlayers: [], projectionsSynced: 0, errors: [] }

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

  // One shared fetch of every roster row for this season, used by both the
  // ESPN (name-within-team match) and Sleeper (sleeper_id match) sections
  // below, instead of re-querying per team/player.
  const { data: allEntries } = await supabase.from('roster_entries')
    .select('id, team_id, stats, player:player_id(name, sleeper_id)')
    .in('team_id', teams.map(t => t.id))
  const entryByTeamAndName = new Map((allEntries || []).map(e => [`${e.team_id}|${norm(e.player?.name)}`, e]))
  const entriesBySleeperId = new Map()
  for (const e of allEntries || []) {
    const sid = e.player?.sleeper_id
    if (!sid || sid === 'SKIP') continue
    if (!entriesBySleeperId.has(sid)) entriesBySleeperId.set(sid, [])
    entriesBySleeperId.get(sid).push(e)
  }

  // -- ESPN: authoritative matchup scores, real starters, real actual points --
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
      const entry = entryByTeamAndName.get(`${team.id}|${norm(line.playerName)}`)
      if (!entry) {
        result.unmatchedPlayers.push(`${line.playerName} (${team.manager?.name || team.id})`)
        continue
      }
      const stats = entry.stats || {}
      const nextStats = {
        ...stats,
        actual: { ...(stats.actual || {}), [week]: line.actual },
        started: { ...(stats.started || {}), [week]: line.started },
      }
      await supabase.from('roster_entries').update({ stats: nextStats }).eq('id', entry.id)
      entry.stats = nextStats // keep the in-memory copy current in case Sleeper touches the same row below
      result.playersScored++
    }
  } catch (e) {
    result.errors.push(`ESPN sync failed: ${e.message}`)
  }

  // -- Sleeper: projections for the same week, scored under this league's own rules --
  try {
    const projByPlayerId = await fetchSleeperProjections(SEASON_YEAR, week)
    for (const [sleeperId, rawStats] of Object.entries(projByPlayerId)) {
      const entries = entriesBySleeperId.get(sleeperId)
      if (!entries?.length) continue
      const proj = parseFloat(scorePlayer(rawStats).toFixed(2))
      for (const entry of entries) {
        const stats = entry.stats || {}
        const nextStats = { ...stats, proj: { ...(stats.proj || {}), [week]: proj } }
        await supabase.from('roster_entries').update({ stats: nextStats }).eq('id', entry.id)
        result.projectionsSynced++
      }
    }
  } catch (e) {
    result.errors.push(`Sleeper projections sync failed: ${e.message}`)
  }

  return Response.json(result)
}
