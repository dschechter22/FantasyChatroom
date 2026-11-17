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

const winsOf = r => r.wins + r.ties / 2

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

/**
 * Where `teamId` would finish with `rec` (a what-if record) while everyone else
 * keeps their actual record. Returns seed (1-based), whether it makes the
 * playoffs, whether it gets a first-round bye, and its title odds.
 */
export function playoffPicture(teams, actualRecords, avgScores, sd, spots, teamId, rec) {
  const entries = teams.map(t => (t.id === teamId
    ? { id: t.id, wins: rec.wins, ties: rec.ties, pf: rec.pf }
    : { id: t.id, wins: actualRecords[t.id].wins, ties: actualRecords[t.id].ties, pf: actualRecords[t.id].pf }))
  const order = seedOrder(entries)
  const seed = order.findIndex(e => e.id === teamId) + 1
  const made = seed <= spots
  let size = 1
  while (size < spots) size *= 2
  const bye = made && seed <= size - spots
  let titleProb = 0
  if (made) {
    const field = order.slice(0, spots).map(e => avgScores[e.id])
    titleProb = titleOdds(field, sd)[seed - 1]
  }
  return { seed, made, bye, titleProb }
}

/** Standard deviation of a team-week score across the season. */
export function scoreSd(grid) {
  const all = Object.values(grid.scores).flatMap(o => Object.values(o))
  if (all.length < 2) return 25
  const mean = all.reduce((a, b) => a + b, 0) / all.length
  return Math.sqrt(all.reduce((a, b) => a + (b - mean) ** 2, 0) / all.length) || 25
}
