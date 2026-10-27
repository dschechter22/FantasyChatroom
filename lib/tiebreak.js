// Seeding tiebreak: the league breaks ties in the standings on HEAD-TO-HEAD, not
// points for.
//
// Teams are ordered by wins. Where teams are level on wins, the tied teams are
// ranked by their record in the games they played against EACH OTHER (wins minus
// losses within the group -- the plain "who beat whom" for a two-way tie, a
// mini-league for three or more; two teams can meet twice, in the replayed
// weeks, so 2-0 beats 1-1). If head-to-head can't separate them (a split series,
// or an even mini-league) points for decides, so the order is always complete.

// Seed order, best first. n teams; wins[i]; pf[i]; h2h is a flat n*n array where
// h2h[i*n + j] is how many times team i has beaten team j.
export function orderBySeed(n, wins, pf, h2h) {
  const byWins = [...Array(n).keys()].sort((a, b) => wins[b] - wins[a])
  const out = []
  for (let s = 0; s < n;) {
    let e = s
    while (e + 1 < n && wins[byWins[e + 1]] === wins[byWins[s]]) e++
    if (e === s) {
      out.push(byWins[s])
    } else {
      const group = byWins.slice(s, e + 1)
      const net = new Map(group.map(i => [i, group.reduce((acc, j) => (j === i ? acc : acc + h2h[i * n + j] - h2h[j * n + i]), 0)]))
      group.sort((a, b) => net.get(b) - net.get(a) || pf[b] - pf[a])
      out.push(...group)
    }
    s = e + 1
  }
  return out
}

// n*n head-to-head matrix from rows that carry `id` and `h2h: { opponentId: wins }`.
export function h2hMatrix(rows, idx = new Map(rows.map((r, i) => [r.id, i]))) {
  const n = rows.length
  const m = new Int16Array(n * n)
  rows.forEach((r, i) => {
    Object.entries(r.h2h || {}).forEach(([oppId, wins]) => {
      const j = idx.get(oppId)
      if (j != null) m[i * n + j] = wins
    })
  })
  return m
}

// { teamId: { opponentId: wins } } from played matchups (rows with home_team /
// away_team ids and scores). Ties count for neither side.
export function h2hFromMatchups(matchups) {
  const out = {}
  const bump = (a, b) => { ((out[a] ||= {})[b] = (out[a][b] || 0) + 1) }
  matchups.forEach(m => {
    const h = m.home_team?.id ?? m.home_team_id
    const a = m.away_team?.id ?? m.away_team_id
    if (h == null || a == null || m.home_score == null || m.away_score == null) return
    if (m.home_score > m.away_score) bump(h, a)
    else if (m.away_score > m.home_score) bump(a, h)
  })
  return out
}

// Sort standings rows ({ id, wins, pf }) by wins, then head-to-head, then points for.
export function sortStandings(rows, matchups) {
  const h2h = h2hFromMatchups(matchups)
  const withH2h = rows.map(r => ({ ...r, h2h: h2h[r.id] || {} }))
  const order = orderBySeed(
    withH2h.length,
    withH2h.map(r => r.wins),
    withH2h.map(r => r.pf),
    h2hMatrix(withH2h),
  )
  return order.map(i => rows[i])
}
