// What-if schedule engine.
//
// Every team in a season scored the same points no matter who they played, so a
// different schedule only changes who each score is compared against. Taking
// someone else's schedule means: each week you play whoever they played, with
// one rule for the week they played you -- you play THEM (you "play yourself"
// from their point of view). Everyone else's results stay as they actually were.
//
// A season is { teams: [{ id, managerId, ... }], games: [{ week, homeId, awayId,
// homeScore, awayScore }] } -- regular season only.

import { orderBySeed } from './tiebreak'

/** Per-team weekly picture: scores[teamId][week], opp[teamId][week]. */
export function buildSeasonGrid(teams, games) {
  const scores = {}, opp = {}
  teams.forEach(t => { scores[t.id] = {}; opp[t.id] = {} })
  games.forEach(g => {
    if (!scores[g.homeId] || !scores[g.awayId]) return
    scores[g.homeId][g.week] = g.homeScore
    scores[g.awayId][g.week] = g.awayScore
    opp[g.homeId][g.week] = g.awayId
    opp[g.awayId][g.week] = g.homeId
  })
  const weeks = [...new Set(games.map(g => g.week))].sort((a, b) => a - b)
  return { scores, opp, weeks }
}

/** Record of `teamId` if it had played `scheduleOfId`'s schedule. */
export function playSchedule(grid, teamId, scheduleOfId) {
  let wins = 0, losses = 0, ties = 0, pf = 0, pa = 0
  const log = []
  grid.weeks.forEach(w => {
    const mine = grid.scores[teamId][w]
    let oppId = grid.opp[scheduleOfId][w]
    if (mine == null || oppId == null) return
    if (oppId === teamId) oppId = scheduleOfId // they played you, so you play them
    const theirs = grid.scores[oppId]?.[w]
    if (theirs == null) return
    pf += mine; pa += theirs
    const result = mine > theirs ? 'W' : mine < theirs ? 'L' : 'T'
    if (result === 'W') wins++; else if (result === 'L') losses++; else ties++
    log.push({ week: w, oppId, mine, theirs, result, actualOppId: grid.opp[teamId][w] })
  })
  return { wins, losses, ties, pf, pa, log }
}

/** N x N: matrix[teamId][scheduleOfId] = record. */
export function scheduleMatrix(teams, grid) {
  const m = {}
  teams.forEach(t => {
    m[t.id] = {}
    teams.forEach(s => { m[t.id][s.id] = playSchedule(grid, t.id, s.id) })
  })
  return m
}

const winsOf = r => r.wins + (r.ties || 0) / 2

/**
 * Seeds for a season given each team's (possibly what-if) record. Wins, then
 * points for.
 */
export function seedOrder(entries) {
  return [...entries].sort((a, b) => winsOf(b) - winsOf(a) || b.pf - a.pf)
}

// ── playoff title odds ──
const erf = x => {
  const s = Math.sign(x); x = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * x)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return s * y
}
const phi = z => 0.5 * (1 + erf(z / Math.SQRT2))

// Standard bracket order for a power-of-two field: [1,8,4,5,3,6,2,7] for 8.
function bracketOrder(size) {
  let order = [1]
  while (order.length < size) {
    const n = order.length * 2
    order = order.flatMap(s => [s, n + 1 - s])
  }
  return order
}

/**
 * Chance each seed wins the title in a single-elimination bracket, top seeds
 * getting byes when the field isn't a power of two. `strength[i]` is seed i's
 * average score, `sd` the spread of a single team-week.
 */
export function titleOdds(strength, sd) {
  const spots = strength.length
  if (spots < 2) return strength.map(() => 1)
  let size = 1
  while (size < spots) size *= 2
  const slot = bracketOrder(size).map(s => (s <= spots ? s - 1 : null))
  const win = (a, b) => phi((strength[a] - strength[b]) / (sd * Math.SQRT2))
  // dist[i] = { seedIndex: probability this seed reaches here }
  let field = slot.map(i => (i == null ? null : { [i]: 1 }))
  while (field.length > 1) {
    const next = []
    for (let k = 0; k < field.length; k += 2) {
      const a = field[k], b = field[k + 1]
      if (!a || !b) { next.push(a || b); continue }
      const out = {}
      for (const [i, pi] of Object.entries(a)) for (const [j, pj] of Object.entries(b)) {
        const p = win(Number(i), Number(j))
        out[i] = (out[i] || 0) + pi * pj * p
        out[j] = (out[j] || 0) + pi * pj * (1 - p)
      }
      next.push(out)
    }
    field = next
  }
  const final = field[0] || {}
  return strength.map((_, i) => final[i] || 0)
}

// ── bracket replay ──
//
// The league's bracket: the top seeds get byes when the field isn't a power of
// two; in every round the best remaining seed plays the worst (3v6 and 4v5, then
// 1 vs the worst survivor and 2 vs the other, then the final). A game goes to the
// higher score that week, the better seed on a tie. Scores come from what each
// team actually scored in the playoff weeks -- consolation and Mol Bowl games
// are played by the teams that missed out, so most teams have a score on file.
// A team with nothing on file for a week it would have played is scored at its
// season average, and the result is flagged approximate.
const LABELS = ['Runner Up', 'Lost in semis', 'Lost in quarters', 'Lost in round 1']

/**
 * poScores[teamId][week]; poWeeks sorted playoff weeks. mode 'reseed' pairs the
 * best remaining seed with the worst each round; 'fixed' keeps the standard
 * bracket (1v8 meets 4v5, 2v7 meets 3v6). Returns null if the format doesn't fit.
 */
export function runBracket(order, spots, poWeeks, poScores, avg, mode = 'reseed') {
  let size = 1, rounds = 0
  while (size < spots) { size *= 2; rounds++ }
  if (spots < 2 || poWeeks.length < rounds) return null
  const weeks = poWeeks.slice(-rounds)
  const byes = size - spots
  const seeded = order.slice(0, spots)
  const finish = {}
  let approx = false
  const score = (id, w) => {
    const v = poScores[id]?.[w]
    if (v == null) { approx = true; return avg[id] || 0 }
    return v
  }
  const play = (a, b, r) => {
    const sa = score(a, weeks[r]), sb = score(b, weeks[r])
    const win = sa >= sb ? a : b, lose = win === a ? b : a
    finish[lose] = LABELS[rounds - 1 - r] || 'Lost early'
    return win
  }
  let champion
  if (mode === 'fixed') {
    let field = bracketOrder(size).map(sd => (sd <= spots ? seeded[sd - 1] : null))
    for (let r = 0; r < rounds; r++) {
      const next = []
      for (let k = 0; k < field.length; k += 2) {
        const a = field[k], b = field[k + 1]
        next.push(a && b ? play(a, b, r) : (a || b))
      }
      field = next
    }
    champion = field[0]
  } else {
    let alive = seeded.slice(0, byes)
    for (let r = 0; r < rounds; r++) {
      const players = r === 0 ? seeded.slice(byes) : alive
      const next = r === 0 ? [...alive] : []
      const sorted = [...players].sort((x, y) => seeded.indexOf(x) - seeded.indexOf(y))
      for (let i = 0, j = sorted.length - 1; i < j; i++, j--) next.push(play(sorted[i], sorted[j], r))
      alive = next
    }
    champion = alive[0]
  }
  finish[champion] = 'Champion'
  return { champion, finish, approx }
}

/**
 * Where `teamId` would finish with `rec` (a what-if record) while everyone else
 * keeps their actual record. `model` is a season model: { teams, actual, avg,
 * sd, spots, h2h, poWeeks, poScores, replay }.
 */
export function playoffPicture(model, teamId, rec) {
  const { teams, actual, avg, sd, spots, h2h, poWeeks, poScores, replay, bracketMode } = model
  const n = teams.length
  const idx = new Map(teams.map((t, i) => [t.id, i]))
  const wins = teams.map(t => (t.id === teamId ? winsOf(rec) : winsOf(actual[t.id])))
  const pf = teams.map(t => (t.id === teamId ? rec.pf : actual[t.id].pf))
  const m = Int16Array.from(h2h)
  const x = idx.get(teamId)
  if (rec.log) {
    for (let j = 0; j < n; j++) { m[x * n + j] = 0; m[j * n + x] = 0 }
    rec.log.forEach(g => {
      const j = idx.get(g.oppId)
      if (j == null) return
      if (g.result === 'W') m[x * n + j]++
      else if (g.result === 'L') m[j * n + x]++
    })
  }
  const order = orderBySeed(n, wins, pf, m).map(i => teams[i].id)
  const seed = order.indexOf(teamId) + 1
  const made = seed <= spots
  let size = 1
  while (size < spots) size *= 2
  const bye = made && seed <= size - spots
  let finish = made ? null : 'Missed playoffs', champion = false, approx = false, titleProb = 0
  if (made) {
    const run = replay ? runBracket(order, spots, poWeeks, poScores, avg, bracketMode) : null
    if (run) {
      finish = run.finish[teamId]; champion = run.champion === teamId; approx = run.approx
      titleProb = champion ? 1 : 0
    } else {
      titleProb = titleOdds(order.slice(0, spots).map(id => avg[id]), sd)[seed - 1]
    }
  }
  return { seed, made, bye, finish, champion, approx, titleProb, estimated: made && !(replay && finish) }
}

/** Standard deviation of a team-week score across the season. */
export function scoreSd(grid) {
  const all = Object.values(grid.scores).flatMap(o => Object.values(o))
  if (all.length < 2) return 25
  const mean = all.reduce((a, b) => a + b, 0) / all.length
  return Math.sqrt(all.reduce((a, b) => a + (b - mean) ** 2, 0) / all.length) || 25
}

/** n*n head-to-head wins matrix (row beat column) from the season grid, in `teams` order. */
export function h2hFromGrid(teams, grid) {
  const n = teams.length
  const idx = new Map(teams.map((t, i) => [t.id, i]))
  const m = new Int16Array(n * n)
  teams.forEach(t => {
    grid.weeks.forEach(w => {
      const o = grid.opp[t.id][w]
      if (o == null || !idx.has(o)) return
      if (grid.scores[t.id][w] > grid.scores[o][w]) m[idx.get(t.id) * n + idx.get(o)]++
    })
  })
  return m
}

/** Playoff weeks and every team's score in them, from all of a season's matchups. */
export function buildPlayoffData(allGames) {
  const poWeeks = [...new Set(allGames.filter(g => g.isPlayoff).map(g => g.week))].sort((a, b) => a - b)
  const set = new Set(poWeeks)
  const poScores = {}
  allGames.forEach(g => {
    if (!set.has(g.week)) return
    ;(poScores[g.homeId] ||= {})[g.week] = g.homeScore
    ;(poScores[g.awayId] ||= {})[g.week] = g.awayScore
  })
  return { poWeeks, poScores }
}
