// Derives IMPORTANCE_MU / IMPORTANCE_SIGMA in lib/preweek.js.
//
// MU is the raw leverage of an opening-week game. Before a season starts every
// team rates identically, so all five Week 1 games carry the same leverage and
// every one of them scores 50 — nothing has happened yet that could make one
// opener matter more than another. SIGMA is then solved so the extreme case —
// a final-week game both teams must win to reach the playoffs — lands at the
// target score below.
//
//   node scripts/calibrate-importance.mjs
import { SCHEDULE } from '../lib/schedule.js'
import { simulateLeverage, rawLeverage, importanceScore, IMPORTANCE_MU, IMPORTANCE_SIGMA } from '../lib/preweek.js'
import { normalCdf } from '../lib/predictions.js'

const TARGET_EXTREME = 99
const SIMS = 40000
const NAMES = ['John', 'Caden', 'Mamby/Tenner', 'Dan', 'Freed', 'JM', 'Reid', 'Big E', 'Braden', 'Wally']
// Mid-season strengths for the Week 14 stress case only — thirteen games of
// results have legitimately separated these teams by then.
const RATING = { John: 118, Caden: 122, 'Mamby/Tenner': 116, Dan: 124, Freed: 108, JM: 104, Reid: 114, 'Big E': 102, Braden: 112, Wally: 110 }
const FLAT = 115 // what every team rates before a ball is snapped

const idOf = n => 't' + NAMES.indexOf(n)
const rowsFrom = (record, rating = n => RATING[n]) => NAMES.map(n => ({
  id: idOf(n), name: n, rating: rating(n), sigma: 22,
  wins: record[n]?.[0] ?? 0, losses: record[n]?.[1] ?? 0,
  pf: (record[n]?.[0] ?? 0) * 120 + (record[n]?.[1] ?? 0) * 100,
}))
const fixtures = SCHEDULE.flatMap((wk, i) =>
  wk.map(([h, a]) => ({ week: i + 1, homeId: idOf(h), awayId: idOf(a) })))

// ── Week 1: nothing played, so every team is the same team and every game
// carries identical leverage. Any spread here is Monte Carlo noise.
const openers = simulateLeverage({
  rows: rowsFrom({}, () => FLAT), schedule: fixtures, trackWeek: 1, sims: SIMS,
})
const w1 = openers.games.map(rawLeverage).sort((a, b) => a - b)
const median = w1[Math.floor(w1.length / 2)]

console.log('Week 1 raw leverage:', w1.map(x => x.toFixed(4)).join('  '))
console.log('  median', median.toFixed(4), '· spread', (w1[w1.length - 1] - w1[0]).toFixed(4), '(noise only)')

// ── Week 14, last game: five teams are locked in, three are out, and the two
// left are playing each other for the final spot.
const IN = ['Dan', 'Caden', 'John', 'Mamby/Tenner', 'Reid']
const OUT = ['JM', 'Wally', 'Braden']
const BUBBLE = ['Freed', 'Big E'] // these two meet in Week 14
const record = {}
IN.forEach(n => { record[n] = [11, 2] })
OUT.forEach(n => { record[n] = [2, 11] })
BUBBLE.forEach(n => { record[n] = [7, 6] })

const finale = simulateLeverage({
  rows: rowsFrom(record),
  schedule: fixtures.filter(f => f.week === 14),
  trackWeek: 14,
  sims: SIMS,
})
const bubbleGame = finale.games.find(g =>
  [g.homeId, g.awayId].sort().join() === BUBBLE.map(idOf).sort().join())

if (!bubbleGame) {
  console.error('Week 14 does not pair', BUBBLE.join(' vs '), '— pick a different bubble pair.')
  process.exit(1)
}
const extreme = rawLeverage(bubbleGame)
console.log(`\n${BUBBLE.join(' vs ')} raw leverage:`, extreme.toFixed(4))

// ── Solve SIGMA so importanceScore(extreme) === TARGET_EXTREME.
const zTarget = (() => {
  let lo = 0, hi = 6
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (normalCdf(mid) < TARGET_EXTREME / 100) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
})()
const sigma = Math.log(extreme / median) / zTarget

console.log('\nSuggested constants:')
console.log('  IMPORTANCE_MU    =', median.toFixed(3))
console.log('  IMPORTANCE_SIGMA =', sigma.toFixed(3))
console.log('\nWith the constants currently in lib/preweek.js '
  + `(MU=${IMPORTANCE_MU}, SIGMA=${IMPORTANCE_SIGMA}):`)
console.log('  Week 1 games score', w1.map(x => importanceScore(x)).join(', '))
console.log('  Win-and-in scores ', importanceScore(extreme))
