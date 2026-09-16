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
//
// Every Supabase write here returns its error (if any) into the result's
// `errors` array instead of failing silently -- a table missing a column
// PostgREST hasn't picked up yet (this has bitten this app before) used to
// just look like "nothing happened."
import {
  buildRatings, makeLine, simulateFutures, priceTwoWay,
  projectedStarterPoints, projectedWeekScore, projectedWeekLineup, leagueBaseline,
} from './predictions'
import { buildFixtures, REG_SEASON_WEEKS } from './schedule'

const SIMS = 8000

// "Games' worth" of dampening applied to the fixed team-quality futures
// (playoffs/bye/semis/finals/title) only -- see temperProb below.
const FUTURES_TEMPER_GAMES = 3

// A real book won't post -2000 on "makes the playoffs" three weeks into a
// 14-game season even when its own model is that lopsided -- posting a
// price that sharp on this little evidence is bad bookmaking, not honesty.
// This pulls those five fixed, not-bettor-chosen markets partway back
// toward a pick'em early on, fading out fast as real games accumulate
// (by mid-season it's negligible; a genuinely clinched team still prices
// near-certain). Deliberately NOT applied to the custom win-total/seed/
// head-to-head picks below -- those lines are chosen by the bettor, so an
// obviously lopsided pick (e.g. "Over 1.5 wins" for a team that's already
// 3-0) should correctly show lopsided odds, not get watered down. Also not
// applied to game moneylines or to anything Predictions/Preweek/Postweek
// read from lib/predictions.js directly -- those pages are meant to show
// the model's sharp, honest estimate, not a betting line.
export function temperProb(p, weeksPlayed) {
  const damp = weeksPlayed / (weeksPlayed + FUTURES_TEMPER_GAMES)
  return 0.5 + (p - 0.5) * damp
}

// Win total / final seed / finishes-ahead-of carry a heavier hold than a
// standard -110 line (futures and props are a heavier-hold market at real
// books too), and cap the underdog side at +1000 -- a house-imposed
// ceiling, independent of how extreme the model's own number gets, same as
// a real book won't lay out an unlimited multiple on a longshot.
const CUSTOM_FUTURES_VIG = 0.10
const MAX_UNDERDOG_ODDS = 1000
export function priceCustomMarket(fairP) {
  const [oddsA, oddsB] = priceTwoWay(fairP, CUSTOM_FUTURES_VIG)
  const cap = o => (o > 0 ? Math.min(MAX_UNDERDOG_ODDS, o) : o)
  return [cap(oddsA), cap(oddsB)]
}

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
  const errors = []
  const { ratings, fixtures } = buildModel({ teams, matchups, rosterEntries, week })
  if (!ratings) return { added: 0, errors }
  const { data: existingGames, error: readErr } = await db.from('sb_games').select('team_a, team_b').eq('season', season).eq('week', week)
  if (readErr) errors.push(readErr.message)
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
  if (toInsert.length) {
    const { error } = await db.from('sb_games').insert(toInsert)
    if (error) errors.push(error.message)
  }
  return { added: toInsert.length, errors }
}

// Playoffs/bye/semis/finals/title -- fixed yes/no propositions per team,
// pre-generated same as before. Win total, final seed, and "finishes ahead
// of" are NOT pre-generated as fixed markets any more -- see
// generateTeamSimCache below, which instead caches each team's full
// probability distribution so the sportsbook page can price *any* line or
// pairing a bettor picks from a dropdown, on demand.
//
// Priced with the exact same untempered probability + priceCustomMarket
// policy as those custom picks, on purpose: "Get a Bye" (top 2 seed) and
// "finishes better than seed 2.5" describe the identical event and must
// price the same, and "make the playoffs" should track closely with
// "Over 6.5 wins" since that's roughly this league's real cutoff -- both
// break if the fixed markets use a different probability or vig policy
// than the custom ones. An earlier version tempered these toward a
// pick'em early in the season on top of that; once the rating tuning
// (PROJ_WEIGHT/PRIOR_GAMES) fixed the actual overconfidence problem, that
// extra layer was just double-correcting and pricing these too flat.
export async function generateFutures(db, { season, week, teams, matchups, rosterEntries }) {
  const errors = []
  const { ratings, fixtures, regWeeksCount } = buildModel({ teams, matchups, rosterEntries, week })
  if (!ratings) return { added: 0, updated: 0, errors }
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
      const [oddsYes, oddsNo] = priceCustomMarket(mkt.p)
      rows.push({ season, market_type: key, team_id: r.id, opp_team_id: null, team_name: meta.name, opp_team_name: null, line: null, odds_yes: oddsYes, odds_no: oddsNo, fair_p: mkt.p })
    })
  }

  const { data: existingOpen, error: readErr } = await db.from('sb_futures').select('*').eq('season', season).eq('is_settled', false)
  if (readErr) errors.push(readErr.message)
  const existingMap = new Map((existingOpen || []).map(f => [`${f.market_type}|${f.team_id}|${f.opp_team_id || ''}`, f]))
  const toInsert = [], toUpdate = []
  for (const r of rows) {
    const key = `${r.market_type}|${r.team_id}|${r.opp_team_id || ''}`
    const existing = existingMap.get(key)
    if (existing) toUpdate.push({ id: existing.id, odds_yes: r.odds_yes, odds_no: r.odds_no, fair_p: r.fair_p })
    else toInsert.push(r)
  }
  if (toInsert.length) {
    const { error } = await db.from('sb_futures').insert(toInsert)
    if (error) errors.push(error.message)
  }
  for (const u of toUpdate) {
    const { error } = await db.from('sb_futures').update({ odds_yes: u.odds_yes, odds_no: u.odds_no, fair_p: u.fair_p }).eq('id', u.id)
    if (error) errors.push(error.message)
  }

  const cacheRes = await generateTeamSimCache(db, { season, sim, ratings })
  errors.push(...cacheRes.errors)

  return { added: toInsert.length, updated: toUpdate.length, errors }
}

// Caches each team's full simulated distribution (every win total, every
// finishing seed, and its "finishes ahead of" probability against every
// other team) so the sportsbook can price an arbitrary win-total line, seed
// line, or team-vs-team pairing a bettor picks from a dropdown -- instead
// of only whatever fixed line/pairing got pre-generated.
async function generateTeamSimCache(db, { season, sim, ratings }) {
  const errors = []
  const rows = sim.map(r => {
    const meta = ratings.byId[r.id]
    const winTally = Object.fromEntries(r.winProbs.map(({ wins, p }) => [wins, p]))
    const seedTally = Object.fromEntries(r.seedProbs.map(({ seed, p }) => [seed, p]))
    const aheadTally = Object.fromEntries(
      sim.filter(o => o.id !== r.id).map(o => [o.id, sim.aheadProb(r.id, o.id)]),
    )
    return {
      season, team_id: r.id, team_name: meta?.name || '?',
      win_tally: winTally, seed_probs: seedTally, ahead_probs: aheadTally,
      updated_at: new Date().toISOString(),
    }
  })
  const { error } = await db.from('sb_team_sim').upsert(rows, { onConflict: 'season,team_id' })
  if (error) errors.push(error.message)
  return { errors }
}

// Straight passthrough of each team's optimal-lineup starters' own ESPN
// weekly projection -- no simulation, so this only ever adds a prop the
// first time a player is seen for a given week (never overwrites one
// that's already there, so an in-progress bet's line can't move under it).
export async function generateProps(db, { season, week, teams, rosterEntries }) {
  const errors = []
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
  if (!rows.length) return { added: 0, errors }
  const { data: existingOpen, error: readErr } = await db.from('sb_props').select('id, player_id').eq('season', season).eq('week', week).eq('is_settled', false)
  if (readErr) errors.push(readErr.message)
  const existingIds = new Set((existingOpen || []).map(p => p.player_id))
  const toInsert = rows.filter(r => !existingIds.has(r.player_id))
  if (toInsert.length) {
    const { error } = await db.from('sb_props').insert(toInsert)
    if (error) errors.push(error.message)
  }
  return { added: toInsert.length, errors }
}

// Finds an existing open sb_futures row for a bettor's custom win-total/
// seed/head-to-head pick, or creates one -- so the rest of the app (bet
// placement, action-based juice, settlement) can treat a custom pick
// exactly like any other future without knowing the difference.
export async function getOrCreateFuture(db, { season, marketType, teamId, oppTeamId = null, teamName, oppTeamName = null, line = null, fairP, oddsYes, oddsNo }) {
  let q = db.from('sb_futures').select('*')
    .eq('season', season).eq('market_type', marketType).eq('team_id', teamId).eq('is_settled', false)
  q = oppTeamId == null ? q.is('opp_team_id', null) : q.eq('opp_team_id', oppTeamId)
  q = line == null ? q.is('line', null) : q.eq('line', line)
  const { data: existing } = await q.maybeSingle()
  if (existing) return { future: existing, error: null }

  // odds are computed by the caller (priceCustomMarket) rather than
  // re-derived here, so what a bettor sees before confirming is exactly
  // what gets stored -- no separate pricing path to drift out of sync.
  const { data, error } = await db.from('sb_futures').insert({
    season, market_type: marketType, team_id: teamId, opp_team_id: oppTeamId,
    team_name: teamName, opp_team_name: oppTeamName, line, odds_yes: oddsYes, odds_no: oddsNo, fair_p: fairP,
  }).select().single()
  return { future: data, error: error?.message || null }
}
