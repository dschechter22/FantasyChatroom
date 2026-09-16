// Shared sportsbook auto-generation logic -- computes and upserts the
// week's game board, season futures, and weekly player props from the same
// rating/projection engine Predictions and Preweek use. Used by both the
// daily ESPN sync cron (so the book fills in on its own, no admin click
// required) and the sportsbook page's admin "Generate/Refresh" buttons (a
// manual override -- useful for regenerating ahead of the next cron run).
//
// Player props are the one exception: they're ESPN's own per-player
// projection, not a simulation, so there's nothing to "generate" beyond
// what the sync already wrote to roster_entries.stats.proj[week] -- this
// module's generateProps() is only ever called from the cron now.
import {
  buildRatings, makeLine, simulateFutures, priceTwoWay,
  projectedStarterPoints, projectedWeekScore, projectedWeekLineup, leagueBaseline,
} from './predictions'
import { buildFixtures, REG_SEASON_WEEKS } from './schedule'

const SIMS = 8000

function buildModel({ teams, matchups, rosterEntries, week }) {
  const entriesByTeam = {}
  rosterEntries.forEach(e => { (entriesByTeam[e.team_id] ||= []).push(e) })
  const rosterProj = Object.fromEntries(Object.entries(entriesByTeam).map(([k, v]) => [k, projectedStarterPoints(v)]))
  const weeklyProj = Object.fromEntries(Object.entries(entriesByTeam).map(([k, v]) => [k, projectedWeekScore(v, week)]))
  const baseline = leagueBaseline([])
  const ratings = teams.length ? buildRatings({ teams, matchups, throughWeek: week - 1, rosterProj, weeklyProj, baseline }) : null
  const fixtures = buildFixtures({ matchups, teams, useFixed: true })
  const maxWeekWithRows = matchups.length ? Math.max(...matchups.map(m => m.week)) : 0
  const regWeeksCount = Math.max(maxWeekWithRows, REG_SEASON_WEEKS)
  return { entriesByTeam, ratings, fixtures, regWeeksCount }
}

export async function generateWeekBoard(db, { season, week, teams, matchups, rosterEntries }) {
  const { ratings, fixtures } = buildModel({ teams, matchups, rosterEntries, week })
  if (!ratings) return { added: 0 }
  const { data: existingGames } = await db.from('sb_games').select('team_a, team_b').eq('season', season).eq('week', week)
  const weekFixtures = fixtures.filter(f => f.week === week)
  const toInsert = []
  for (const f of weekFixtures) {
    const a = ratings.byId[f.homeId], b = ratings.byId[f.awayId]
    if (!a || !b) continue
    const already = (existingGames || []).some(g => (g.team_a === a.name && g.team_b === b.name) || (g.team_a === b.name && g.team_b === a.name))
    if (already) continue
    const line = makeLine(a, b)
    toInsert.push({ season, week, team_a: a.name, team_b: b.name, spread: line.spread, over_under: line.total, ml_a: line.mlA, ml_b: line.mlB, fair_p_a: line.pA })
  }
  if (toInsert.length) await db.from('sb_games').insert(toInsert)
  return { added: toInsert.length }
}

export async function generateFutures(db, { season, week, teams, matchups, rosterEntries }) {
  const { ratings, fixtures, regWeeksCount } = buildModel({ teams, matchups, rosterEntries, week })
  if (!ratings) return { added: 0, updated: 0 }
  const rest = fixtures.filter(f => f.week >= week && f.week <= regWeeksCount)
  const covered = new Set(rest.map(f => f.week))
  let randomWeeks = 0
  for (let w = week; w <= regWeeksCount; w++) if (!covered.has(w)) randomWeeks++
  const sim = simulateFutures({ rows: ratings.rows, schedule: rest.map(f => ({ homeId: f.homeId, awayId: f.awayId })), randomWeeks, sims: SIMS })

  const rows = []
  for (const r of sim) {
    const meta = ratings.byId[r.id]
    if (!meta) continue
    ;['playoffs', 'bye', 'semis', 'finals', 'title'].forEach(key => {
      const mkt = r.markets[key]
      rows.push({ season, market_type: key, team_id: r.id, opp_team_id: null, team_name: meta.name, opp_team_name: null, line: null, odds_yes: mkt.oddsYes, odds_no: mkt.oddsNo, fair_p: mkt.p })
    })
    rows.push({ season, market_type: 'win_total', team_id: r.id, opp_team_id: null, team_name: meta.name, opp_team_name: null, line: r.winTotal, odds_yes: r.oddsOver, odds_no: r.oddsUnder, fair_p: r.pOver })

    let cum = 0, seedLine = r.seedProbs.length + 0.5
    for (const { seed, p } of r.seedProbs) { cum += p; if (cum >= 0.5) { seedLine = seed + 0.5; break } }
    const pUnder = r.seedProbs.filter(s => s.seed < seedLine).reduce((s, x) => s + x.p, 0)
    const [oddsUnder, oddsOver] = priceTwoWay(pUnder)
    rows.push({ season, market_type: 'seed_total', team_id: r.id, opp_team_id: null, team_name: meta.name, opp_team_name: null, line: seedLine, odds_yes: oddsOver, odds_no: oddsUnder, fair_p: 1 - pUnder })
  }
  fixtures.filter(f => f.week === week).forEach(f => {
    const a = ratings.byId[f.homeId], b = ratings.byId[f.awayId]
    if (!a || !b) return
    const p = sim.aheadProb(f.homeId, f.awayId)
    if (p == null) return
    const [oddsYes, oddsNo] = priceTwoWay(p)
    rows.push({ season, market_type: 'h2h_finish', team_id: f.homeId, opp_team_id: f.awayId, team_name: a.name, opp_team_name: b.name, line: null, odds_yes: oddsYes, odds_no: oddsNo, fair_p: p })
  })

  const { data: existingOpen } = await db.from('sb_futures').select('*').eq('season', season).eq('is_settled', false)
  const existingMap = new Map((existingOpen || []).map(f => [`${f.market_type}|${f.team_id}|${f.opp_team_id || ''}`, f]))
  const toInsert = [], toUpdate = []
  for (const r of rows) {
    const key = `${r.market_type}|${r.team_id}|${r.opp_team_id || ''}`
    const existing = existingMap.get(key)
    if (existing) toUpdate.push({ id: existing.id, line: r.line, odds_yes: r.odds_yes, odds_no: r.odds_no, fair_p: r.fair_p })
    else toInsert.push(r)
  }
  if (toInsert.length) await db.from('sb_futures').insert(toInsert)
  for (const u of toUpdate) await db.from('sb_futures').update({ line: u.line, odds_yes: u.odds_yes, odds_no: u.odds_no, fair_p: u.fair_p }).eq('id', u.id)
  return { added: toInsert.length, updated: toUpdate.length }
}

// Straight passthrough of each team's optimal-lineup starters' own ESPN
// weekly projection -- no simulation, so this only ever adds a prop the
// first time a player is seen for a given week (never overwrites one
// that's already there, so an in-progress bet's line can't move under it).
export async function generateProps(db, { season, week, teams, rosterEntries }) {
  const entriesByTeam = {}
  rosterEntries.forEach(e => { (entriesByTeam[e.team_id] ||= []).push(e) })
  const rows = []
  Object.entries(entriesByTeam).forEach(([teamId, entries]) => {
    const teamMeta = teams.find(t => t.id === teamId)
    const lineup = projectedWeekLineup(entries, week)
    lineup.starters.forEach(e => {
      if (e.proj == null) return
      rows.push({
        season, week, player_id: e.player_id, player_name: e.player?.name || 'Unknown',
        position: e.player?.position || null, team_id: teamId, team_name: teamMeta?.manager?.name || teamMeta?.team_name || null,
        line: parseFloat(e.proj.toFixed(1)), odds_over: -110, odds_under: -110,
      })
    })
  })
  if (!rows.length) return { added: 0 }
  const { data: existingOpen } = await db.from('sb_props').select('id, player_id').eq('season', season).eq('week', week).eq('is_settled', false)
  const existingIds = new Set((existingOpen || []).map(p => p.player_id))
  const toInsert = rows.filter(r => !existingIds.has(r.player_id))
  if (toInsert.length) await db.from('sb_props').insert(toInsert)
  return { added: toInsert.length }
}
