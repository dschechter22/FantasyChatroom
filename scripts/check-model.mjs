// Invariants the rating and leverage model has to hold.
//
//   node scripts/check-model.mjs
//
// The properties worth pinning are the ones that were previously violated: a
// season that has not started must not pretend to know anything, and the
// before/after swing on a played week must track what happened on the field.
import { buildRatings, leagueBaseline, simulateFutures, makeLine } from '../lib/predictions.js'
import { simulateLeverage, rawLeverage, importanceScore } from '../lib/preweek.js'
import { SCHEDULE } from '../lib/schedule.js'

const SIMS = 8000 // what the pages actually run
const NAMES = ['John', 'Caden', 'Mamby/Tenner', 'Dan', 'Freed', 'JM', 'Reid', 'Big E', 'Braden', 'Wally']
const teams = NAMES.map((n, i) => ({ id: 't' + i, team_name: n, manager: { name: n, id: 'm' + i } }))
const idOf = n => 't' + NAMES.indexOf(n)
const fixtures = SCHEDULE.flatMap((wk, i) => wk.map(([h, a]) => ({ week: i + 1, homeId: idOf(h), awayId: idOf(a) })))

// Deterministic pseudo-history so runs are comparable.
let seed = 7
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const game = (w, h, a, hs, as) => ({
  week: w, home_team: { id: idOf(h) }, away_team: { id: idOf(a) }, home_score: hs, away_score: as,
})
const baseline = leagueBaseline(
  SCHEDULE.flatMap(wk => wk.map(([h, a]) => game(1, h, a, +(100 + rnd() * 70).toFixed(1), +(100 + rnd() * 70).toFixed(1)))))

// A season with genuine talent gaps, so the mid-season checks have something to find.
const STRENGTH = { Dan: 1.18, Caden: 1.12, John: 1.08, Reid: 1.03, Braden: 1.0,
  'Mamby/Tenner': 0.97, Freed: 0.95, Wally: 0.92, JM: 0.88, 'Big E': 0.85 }
const weekOf = w => SCHEDULE[w - 1].map(([h, a]) =>
  game(w, h, a, +(115 * STRENGTH[h] + rnd() * 40 - 20).toFixed(1), +(115 * STRENGTH[a] + rnd() * 40 - 20).toFixed(1)))

let failures = 0
const check = (label, ok, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
}
const spread = a => Math.max(...a) - Math.min(...a)
// Monte Carlo slack for the *range* of ten estimates of a proportion near p,
// in percentage points. The range of ten normal draws averages about 3.1 sigma
// on its own, so bound it at seven and let a real asymmetry — which ran to tens
// of points when roster projections were still feeding Week 1 — be what trips.
const slack = p => 7 * Math.sqrt((p * (1 - p)) / SIMS) * 100

console.log('Week 1 — nothing played, so nothing is known')
const pre = buildRatings({ teams, matchups: [], throughWeek: 0, baseline })
const opening = simulateLeverage({ rows: pre.rows, schedule: fixtures, trackWeek: 1, sims: SIMS })
const odds = k => NAMES.map(n => opening.base[idOf(n)][k] * 100)
const stakes = opening.games.map(g => importanceScore(rawLeverage(g)))
const line = makeLine(pre.byId[idOf('Dan')], pre.byId[idOf('Big E')])

check('every team rates identically', new Set(pre.rows.map(r => r.rating)).size === 1)
check('every team is equally volatile', new Set(pre.rows.map(r => r.sigma)).size === 1)
check('no power rank is claimed', pre.rows.every(r => r.powerRank === null))
check("lines are pick'em", Math.abs(line.spread) < 0.01 && line.mlA === line.mlB, `spread ${line.spread}, ${line.mlA}/${line.mlB}`)
check('playoff odds sit at 6-of-10 for everyone', spread(odds('playoffs')) < slack(0.6),
  odds('playoffs').map(x => x.toFixed(1)).join(' / '))
check('bye odds sit at 2-of-10 for everyone', spread(odds('bye')) < slack(0.2),
  odds('bye').map(x => x.toFixed(1)).join(' / '))
check('every opener carries the same stakes', spread(stakes) <= 4, stakes.join(', '))
check('and that shared value is 50', stakes.every(s => Math.abs(s - 50) <= 3), stakes.join(', '))

console.log('\nWeek 8 — results are in, so the model has to discriminate')
const through7 = [1, 2, 3, 4, 5, 6, 7].flatMap(weekOf)
const mid = buildRatings({ teams, matchups: through7, throughWeek: 7, baseline })
const midSim = simulateLeverage({ rows: mid.rows, schedule: fixtures.filter(f => f.week >= 8), trackWeek: 8, sims: SIMS })
const midOdds = NAMES.map(n => midSim.base[idOf(n)].playoffs * 100)
const midStakes = midSim.games.map(g => importanceScore(rawLeverage(g)))
check('ratings have separated', new Set(mid.rows.map(r => r.rating)).size > 5)
check('playoff odds have separated', spread(midOdds) > 30, `${Math.min(...midOdds).toFixed(0)}–${Math.max(...midOdds).toFixed(0)}%`)
check('stakes now tell games apart', spread(midStakes) > 6, midStakes.join(', '))
check('power ranks are assigned', mid.rows.every(r => r.powerRank >= 1))

console.log('\nWeek 1 swing — the before/after table has to track the field')
const played = weekOf(1)
const before = buildRatings({ teams, matchups: played, throughWeek: 0, baseline })
const after = buildRatings({ teams, matchups: played, throughWeek: 1, baseline })
const project = (rows, from) => Object.fromEntries(simulateFutures({
  rows,
  schedule: fixtures.filter(f => f.week >= from).map(f => ({ homeId: f.homeId, awayId: f.awayId })),
  sims: SIMS,
}).map(r => [r.id, r]))
const b = project(before.rows, 1)
const a = project(after.rows, 2)
const winners = new Set(played.map(m => (m.home_score > m.away_score ? m.home_team.id : m.away_team.id)))
const deltas = NAMES.map(n => ({
  name: n,
  won: winners.has(idOf(n)),
  d: (a[idOf(n)].markets.playoffs.p - b[idOf(n)].markets.playoffs.p) * 100,
}))
const backwards = deltas.filter(x => (x.won ? x.d < 0 : x.d > 0))
// Week 1 is the clean test: everyone starts level, so a team's own result is
// the only thing that can have moved it.
check('winners gain and losers lose, all ten', backwards.length === 0,
  backwards.map(x => `${x.name} ${x.won ? 'won' : 'lost'} ${x.d.toFixed(1)}pp`).join('; '))
check('the swing is zero-sum', Math.abs(deltas.reduce((s, x) => s + x.d, 0)) < 0.5)
check('nobody starts the week already decided',
  NAMES.every(n => { const p = b[idOf(n)].markets.playoffs.p; return p > 0.55 && p < 0.65 }))

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
