// "Teams like this one": find historical team-seasons that looked most like a
// team did at the same point in its season.
//
// Every team is described by the same feature vector measured through week N
// (so a 6-game team is compared with other teams' first 6 games, not their
// whole season): record, scoring relative to that season's league average,
// power score, all-play %, luck per game, consistency, and how its roster's
// per-game scoring splits across the lineup (QB / RB1 / RB2 / WR1 / WR2 / TE /
// FLEX / K / bench). Features are standardised across the candidate pool and
// compared with a weighted distance, so no single stat dominates.

const isPlayed = m => m.home_score != null && m.away_score != null && (m.home_score > 0 || m.away_score > 0)

const ROSTER_KEYS = ['qb', 'rb1', 'rb2', 'wr1', 'wr2', 'te', 'flex', 'k', 'bench']

export const FEATURES = [
  { key: 'winPct', label: 'Record', weight: 1.0 },
  { key: 'scoring', label: 'Scoring', weight: 1.5 },
  { key: 'power', label: 'Power score', weight: 2.0 },
  { key: 'allPlay', label: 'All-play %', weight: 2.0 },
  { key: 'luck', label: 'Luck', weight: 1.0 },
  { key: 'cv', label: 'Consistency', weight: 0.5 },
  ...ROSTER_KEYS.map(k => ({ key: k, label: `${k.toUpperCase()} share`, weight: 0.3, roster: true })),
]
const KEYS = FEATURES.map(f => f.key)

// Share of a roster's per-game scoring that comes from each lineup slot.
// players: [{ pos, ppg }]. Returns null when there isn't enough data.
export function slotShares(players) {
  const by = {}
  players.filter(p => p.ppg > 0).forEach(p => { (by[p.pos] ||= []).push(p.ppg) })
  Object.values(by).forEach(a => a.sort((x, y) => y - x))
  const total = players.reduce((s, p) => s + Math.max(p.ppg, 0), 0)
  if (!total || !by.QB) return null
  const out = { qb: 0, rb1: 0, rb2: 0, wr1: 0, wr2: 0, te: 0, flex: 0, k: 0, bench: 0 }
  out.qb = (by.QB?.[0] || 0)
  out.rb1 = by.RB?.[0] || 0; out.rb2 = by.RB?.[1] || 0
  out.wr1 = by.WR?.[0] || 0; out.wr2 = by.WR?.[1] || 0
  out.te = by.TE?.[0] || 0
  out.k = by.K?.[0] || 0
  // two FLEX spots: best two of what's left among RB / WR / TE
  const leftovers = [...(by.RB?.slice(2) || []), ...(by.WR?.slice(2) || []), ...(by.TE?.slice(1) || [])].sort((a, b) => b - a)
  out.flex = (leftovers[0] || 0) + (leftovers[1] || 0)
  const used = out.qb + out.rb1 + out.rb2 + out.wr1 + out.wr2 + out.te + out.k + out.flex
  out.bench = Math.max(0, total - used)
  Object.keys(out).forEach(k => { out[k] = out[k] / total })
  return out
}

/**
 * Feature vectors for every team in ONE season, measured through `week`.
 * teams: [{ id }]; matchups: that season's rows; rosters: Map teamId -> [{ pos, ppg }].
 * Returns Map teamId -> { vector: number[] (null where unknown), meta }, or an
 * empty Map if the season hasn't played `week` weeks.
 */
export function seasonFeatures({ teams, matchups, rosters, week }) {
  const played = matchups.filter(m => !m.is_playoff && isPlayed(m) && m.week <= week)
  const weeks = [...new Set(played.map(m => m.week))].sort((a, b) => a - b)
  if (weeks.length < week) return new Map()
  const idOf = (m, side) => m[`${side}_team`]?.id || m[`${side}_team_id`]

  const stat = {}
  teams.forEach(t => { stat[t.id] = { scores: [], wins: 0, losses: 0, apSum: 0 } })
  played.forEach(m => {
    const h = idOf(m, 'home'), a = idOf(m, 'away')
    if (stat[h]) { stat[h].scores.push(m.home_score); if (m.home_score > m.away_score) stat[h].wins++; else if (m.home_score < m.away_score) stat[h].losses++ }
    if (stat[a]) { stat[a].scores.push(m.away_score); if (m.away_score > m.home_score) stat[a].wins++; else if (m.away_score < m.home_score) stat[a].losses++ }
  })
  weeks.forEach(wk => {
    const field = []
    played.filter(m => m.week === wk).forEach(m => {
      field.push({ id: idOf(m, 'home'), score: m.home_score }, { id: idOf(m, 'away'), score: m.away_score })
    })
    if (field.length < 2) return
    field.forEach(({ id, score }) => {
      if (stat[id]) stat[id].apSum += field.filter(o => o.id !== id && score > o.score).length / (field.length - 1)
    })
  })

  const rows = teams.map(t => {
    const s = stat[t.id]
    const n = s.scores.length
    if (!n) return null
    const avg = s.scores.reduce((x, y) => x + y, 0) / n
    const std = Math.sqrt(s.scores.reduce((x, y) => x + (y - avg) ** 2, 0) / n)
    const sorted = [...s.scores].sort((a, b) => a - b)
    const mid = Math.floor(n / 2)
    const median = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    const g = s.wins + s.losses
    return {
      id: t.id, n, avg, std, median, wins: s.wins, losses: s.losses,
      winPct: g ? s.wins / g : 0.5,
      allPlay: s.apSum / n,
      luck: (s.wins - s.apSum) / n,
      pf: s.scores.reduce((x, y) => x + y, 0),
    }
  }).filter(Boolean)
  if (!rows.length) return new Map()

  const leagueAvg = rows.reduce((s, r) => s + r.avg, 0) / rows.length
  const maxWin = Math.max(...rows.map(r => r.winPct)) || 1
  const maxAvg = Math.max(...rows.map(r => r.avg)) || 1
  const maxAp = Math.max(...rows.map(r => r.allPlay)) || 1
  const maxMed = Math.max(...rows.map(r => r.median)) || 1

  const out = new Map()
  rows.forEach(r => {
    const power = ((r.winPct / maxWin * 100 * 2) + (r.avg / maxAvg * 100 * 4) + (r.allPlay / maxAp * 100 * 2) + (r.median / maxMed * 100 * 2)) / 10
    const shares = rosters?.get(r.id) ? slotShares(rosters.get(r.id)) : null
    const f = {
      winPct: r.winPct, scoring: r.avg / leagueAvg, power, allPlay: r.allPlay, luck: r.luck, cv: r.avg ? r.std / r.avg : 0,
      ...Object.fromEntries(ROSTER_KEYS.map(k => [k, shares ? shares[k] : null])),
    }
    out.set(r.id, {
      vector: KEYS.map(k => f[k]),
      meta: { wins: r.wins, losses: r.losses, avg: r.avg, power, luck: r.luck, allPlay: r.allPlay, pf: r.pf, std: r.std },
    })
  })
  return out
}

/**
 * Rank candidates by similarity to `target`.
 * target: { vector, meta }; pool: [{ id, vector, meta }].
 * similarity = 100 * exp(-d), where d is the weighted RMS difference in
 * standard deviations (0 = identical, 1 sd apart -> 37%).
 * Returns [{ id, similarity, meta, matched: [labels], differed: [labels] }].
 */
export function findSimilar({ target, pool, limit = 10 }) {
  const dims = FEATURES.length
  const mean = [], sd = []
  for (let i = 0; i < dims; i++) {
    const vals = pool.map(p => p.vector[i]).filter(v => v != null)
    const m = vals.reduce((s, v) => s + v, 0) / (vals.length || 1)
    mean[i] = m
    sd[i] = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length || 1)) || 1
  }
  return pool.map(p => {
    let num = 0, den = 0
    const per = []
    for (let i = 0; i < dims; i++) {
      const a = target.vector[i], b = p.vector[i]
      if (a == null || b == null) continue
      const w = FEATURES[i].weight
      const z = (a - b) / sd[i]
      num += w * z * z; den += w
      per.push({ i, z: Math.abs(z), w })
    }
    if (!den) return null
    const dist = Math.sqrt(num / den)
    // group roster dims so "matched" reads as "roster mix", not nine entries
    const labelFor = i => (FEATURES[i].roster ? 'Roster mix' : FEATURES[i].label)
    const groups = {}
    per.forEach(({ i, z, w }) => { const l = labelFor(i); (groups[l] ||= { z: 0, w: 0 }); groups[l].z += z * w; groups[l].w += w })
    const ranked = Object.entries(groups).map(([label, g]) => [label, g.z / g.w]).sort((x, y) => x[1] - y[1])
    return {
      id: p.id, meta: p.meta, similarity: 100 * Math.exp(-dist), dist,
      matched: ranked.slice(0, 3).filter(([, z]) => z < 0.6).map(([l]) => l),
      differed: ranked.slice(-2).filter(([, z]) => z > 1).map(([l]) => l).reverse(),
    }
  }).filter(Boolean).sort((a, b) => b.similarity - a.similarity).slice(0, limit)
}
