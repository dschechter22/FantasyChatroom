// Everything the team panel shows for one team, computed from a season's
// teams, matchups and roster entries: schedule, current roster, all-play /
// LJ Index breakdown and key stats.
import { weekEntries, latestRosterWeek, playedAvg } from './rosters'
import { actualWeekLineup, lineupEfficiency } from './predictions'
import { NFL_BYES_2026, computeByeImpact, bestLineup } from './byeWeeks'
import { REG_SEASON_WEEKS } from './schedule'

const POS_ORDER = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4 }

const round = (n, p = 1) => parseFloat(n.toFixed(p))
const median = arr => {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// Per-game scoring over the completed weeks a player actually played (see
// playedGames); `beforeWeek` is the first week not yet finished.
export function seasonAvg(entry, beforeWeek = Infinity) {
  return playedAvg(entry.stats, beforeWeek)
}

const isPlayed = m => m.home_score != null && m.away_score != null && (m.home_score > 0 || m.away_score > 0)

export function buildTeamProfile({ teamId, teams, matchups, entries, games = [], avgFor }) {
  const team = teams.find(t => t.id === teamId)
  if (!team) return null
  const nameOf = id => teams.find(t => t.id === id)?.manager?.name || teams.find(t => t.id === id)?.team_name || '?'

  const regular = matchups.filter(m => !m.is_playoff)
  const played = regular.filter(isPlayed)
  const weeks = [...new Set(played.map(m => m.week))].sort((a, b) => a - b)
  const lastWeek = weeks.length ? weeks[weeks.length - 1] : 0

  // week -> every team's score that week
  const scoresByWeek = {}
  played.forEach(m => {
    const w = (scoresByWeek[m.week] ||= {})
    w[m.home_team?.id || m.home_team_id] = m.home_score
    w[m.away_team?.id || m.away_team_id] = m.away_score
  })

  // This team's games, oldest first
  const mine = []
  played.forEach(m => {
    const hId = m.home_team?.id || m.home_team_id
    const aId = m.away_team?.id || m.away_team_id
    if (hId !== teamId && aId !== teamId) return
    const home = hId === teamId
    mine.push({
      week: m.week, home,
      oppId: home ? aId : hId,
      score: home ? m.home_score : m.away_score,
      oppScore: home ? m.away_score : m.home_score,
    })
  })
  mine.sort((a, b) => a.week - b.week)

  // All-play: each week, this team against every other team's score
  let apWins = 0, apGames = 0, apExpected = 0
  const weekly = mine.map(g => {
    const field = scoresByWeek[g.week] || {}
    const others = Object.entries(field).filter(([id]) => id !== teamId).map(([, s]) => s)
    const wins = others.filter(s => g.score > s).length
    const won = g.score > g.oppScore
    apWins += wins; apGames += others.length
    apExpected += others.length ? wins / others.length : 0
    return { ...g, oppName: nameOf(g.oppId), won, apWins: wins, apOf: others.length, rank: others.filter(s => s > g.score).length + 1 }
  })
  const wins = weekly.filter(g => g.won).length
  const losses = weekly.filter(g => g.score < g.oppScore).length
  const scores = weekly.map(g => g.score)
  const pf = scores.reduce((s, x) => s + x, 0)
  const pa = weekly.reduce((s, g) => s + g.oppScore, 0)
  const avg = scores.length ? pf / scores.length : 0
  const std = scores.length > 1 ? Math.sqrt(scores.reduce((s, x) => s + (x - avg) ** 2, 0) / scores.length) : 0
  const high = weekly.reduce((b, g) => (!b || g.score > b.score ? g : b), null)
  const low = weekly.reduce((b, g) => (!b || g.score < b.score ? g : b), null)
  let streak = { type: null, len: 0 }
  for (let i = weekly.length - 1; i >= 0; i--) {
    const w = weekly[i].won
    if (streak.type === null) streak = { type: w ? 'W' : 'L', len: 1 }
    else if ((streak.type === 'W') === w) streak.len++
    else break
  }

  // Rosters / lineup efficiency
  const latest = latestRosterWeek(entries)
  const current = weekEntries(entries, teamId, undefined, latest)
  const effPcts = weeks
    .map(wk => lineupEfficiency(weekEntries(entries, teamId, wk, latest), wk))
    .filter(Boolean).map(e => e.pct)
  const maxTotals = weeks.map(wk => {
    const withActual = weekEntries(entries, teamId, wk, latest).filter(e => e.stats?.actual?.[wk] != null)
    return withActual.length < 9 ? null : actualWeekLineup(withActual, wk).total || null
  }).filter(t => t != null)
  const maxPf = maxTotals.reduce((s, t) => s + t, 0)

  const nextWeek = lastWeek + 1
  // ESPN's real season average when the caller has it, else what we logged ourselves
  const ppgFor = e => (avgFor ? avgFor(e, nextWeek) : null) ?? seasonAvg(e, nextWeek)
  const byeOf = nfl => {
    if (!nfl) return null
    const w = Object.keys(NFL_BYES_2026).find(k => NFL_BYES_2026[k].includes(nfl))
    return w ? Number(w) : null
  }
  const rosterPlayers = current
    .filter(e => e.player?.position)
    .map(e => ({
      id: e.id, playerId: e.player.id, name: e.player.name, pos: e.player.position, nfl: e.player.nfl_team || null,
      ppg: ppgFor(e) || 0, avg: ppgFor(e),
      last: lastWeek ? (e.stats?.actual?.[lastWeek] ?? null) : null,
      byeWeek: byeOf(e.player.nfl_team),
    }))
  const lineup = bestLineup(rosterPlayers.filter(p => POS_ORDER[p.pos] != null))
  const starterIds = new Set(lineup.map(p => p.id))
  const roster = rosterPlayers
    .map(p => ({ ...p, starter: starterIds.has(p.id) }))
    .sort((a, b) => (b.starter - a.starter) || (POS_ORDER[a.pos] - POS_ORDER[b.pos]) || (b.ppg - a.ppg))

  // Remaining schedule + bye-week luck
  let byeRow = null
  const byeWeeksMap = {}
  if (games.length && nextWeek <= REG_SEASON_WEEKS) {
    const impact = computeByeImpact({
      teams, games, fromWeek: nextWeek, toWeek: REG_SEASON_WEEKS,
      getPpg: ppgFor, rosterFor: id => weekEntries(entries, id, undefined, latest),
    })
    byeRow = impact.find(r => r.id === teamId) || null
    byeRow?.weeks.forEach(w => { byeWeeksMap[w.week] = w })
  }
  const schedule = []
  const maxWeek = Math.max(REG_SEASON_WEEKS, ...regular.map(m => m.week))
  for (let wk = 1; wk <= maxWeek; wk++) {
    const g = weekly.find(x => x.week === wk)
    if (g) { schedule.push({ week: wk, played: true, home: g.home, oppName: g.oppName, score: g.score, oppScore: g.oppScore, won: g.won, tie: g.score === g.oppScore }); continue }
    const fixed = games.find(x => x.week === wk && (x.homeId === teamId || x.awayId === teamId))
    if (!fixed) continue
    const home = fixed.homeId === teamId
    const oppId = home ? fixed.awayId : fixed.homeId
    const opp = teams.find(t => t.id === oppId)
    schedule.push({
      week: wk, played: false, home, oppName: nameOf(oppId),
      oppRecord: opp ? `${opp.wins}-${opp.losses}` : null,
      bye: byeWeeksMap[wk] || null,
    })
  }

  return {
    id: team.id, name: team.manager?.name || team.team_name, teamName: team.team_name,
    record: { w: team.wins ?? wins, l: team.losses ?? losses },
    games: weekly.length,
    pf: round(pf, 2), pa: round(pa, 2), diff: round(pf - pa, 1), avg: round(avg), median: round(median(scores)),
    std: round(std, 1), high, low, streak,
    allPlay: { wins: apWins, games: apGames, pct: apGames ? round((apWins / apGames) * 100) : 0, luck: round(wins - apExpected, 2), expectedWins: round(apExpected, 1), actualWins: wins },
    weekly, schedule, roster,
    efficiency: {
      startPct: effPcts.length ? round(effPcts.reduce((s, p) => s + p, 0) / effPcts.length) : null,
      maxPf: maxTotals.length ? round(maxPf, 1) : null,
      maxAvg: maxTotals.length ? round(maxPf / maxTotals.length) : null,
    },
    byeLuck: byeRow ? { oppLost: byeRow.oppLost, oppEffective: byeRow.oppEffective } : null,
    nextWeek,
  }
}

// Profiles for every team in the season, with the league-relative numbers the
// panel ranks against: the LJ plot coordinates (all-play % and luck per game,
// both relative to the league average) and the same power score the Power
// Rankings page uses.
export function buildLeagueProfiles({ teams, matchups, entries, games = [], avgFor }) {
  const profiles = teams
    .map(t => buildTeamProfile({ teamId: t.id, teams, matchups, entries, games, avgFor }))
    .filter(Boolean)
  if (!profiles.length) return []
  const mean = f => profiles.reduce((s, p) => s + f(p), 0) / profiles.length
  const avgAp = mean(p => p.allPlay.pct / 100)
  const avgLuck = mean(p => p.allPlay.luck)
  const winPct = p => { const g = p.record.w + p.record.l; return g ? p.record.w / g : 0 }
  const maxWin = Math.max(...profiles.map(winPct)) || 1
  const maxAvg = Math.max(...profiles.map(p => p.avg)) || 1
  const maxAp = Math.max(...profiles.map(p => p.allPlay.pct / 100)) || 1
  const maxMed = Math.max(...profiles.map(p => p.median)) || 1
  return profiles.map(p => ({
    ...p,
    winPct: winPct(p),
    ljX: round(((p.allPlay.pct / 100 - avgAp) * 100), 1),
    ljY: round(((p.allPlay.luck - avgLuck) / Math.max(p.games, 1)) * 100, 1),
    powerScore: round(((winPct(p) / maxWin * 100 * 2) + (p.avg / maxAvg * 100 * 4) + (p.allPlay.pct / 100 / maxAp * 100 * 2) + (p.median / maxMed * 100 * 2)) / 10, 1),
  }))
}

// { rank, of } for one team on one stat. Ties share the better rank; teams with
// no value for the stat are left out of the field.
export function rankOf(profiles, id, getter, higherIsBetter = true) {
  const mine = getter(profiles.find(p => p.id === id))
  if (mine == null) return null
  const field = profiles.map(getter).filter(v => v != null)
  const better = field.filter(v => (higherIsBetter ? v > mine : v < mine)).length
  return { rank: better + 1, of: field.length }
}
