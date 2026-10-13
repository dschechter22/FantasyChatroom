// NFL bye weeks and how they land on each fantasy team's schedule.
//
// 2026 byes, read off ESPN's NFL schedule (a team with no game that week).
// Abbreviations match players.nfl_team, which the ESPN sync keeps current.
export const NFL_BYES_2026 = {
  5: ['CAR', 'KC'],
  6: ['CIN', 'DET', 'MIA', 'MIN'],
  7: ['JAX', 'BUF', 'WSH', 'LAC'],
  8: ['SF', 'NO', 'HOU', 'NYG'],
  9: ['TEN', 'PIT'],
  10: ['TB', 'CHI', 'PHI', 'DEN'],
  11: ['SEA', 'NE', 'LAR', 'ATL', 'CLE', 'GB'],
  13: ['NYJ', 'IND', 'BAL', 'LV'],
  14: ['ARI', 'DAL'],
}

// The league's lineup: QB, 2 RB, 2 WR, TE, K and two RB/WR/TE flex spots.
function bestLineup(players) {
  const byPos = {}
  players.forEach(p => { (byPos[p.pos] ||= []).push(p) })
  Object.values(byPos).forEach(a => a.sort((x, y) => y.ppg - x.ppg))
  const used = new Set()
  const starters = []
  const take = (pos, n) => {
    for (let i = 0; i < n; i++) {
      const p = (byPos[pos] || []).find(x => !used.has(x))
      if (p) { used.add(p); starters.push(p) }
    }
  }
  take('QB', 1); take('RB', 2); take('WR', 2); take('TE', 1); take('K', 1)
  ;[...(byPos.RB || []), ...(byPos.WR || []), ...(byPos.TE || [])]
    .filter(x => !used.has(x))
    .sort((a, b) => b.ppg - a.ppg)
    .slice(0, 2)
    .forEach(p => { used.add(p); starters.push(p) })
  return starters
}

const sum = a => a.reduce((s, p) => s + p.ppg, 0)
const r1 = n => parseFloat(n.toFixed(1))

/**
 * For every team, the starting-lineup scoring its OPPONENTS lose to NFL byes
 * across the rest of the schedule. Only opponents count: a team's own bye
 * losses scale with how strong its roster is, which says nothing about how
 * kind its schedule is.
 *
 * A team's starters are its best lineup by season ppg from its current roster.
 * "Lost" is the summed ppg of starters whose NFL team is on bye that week;
 * "effective" lets the next-best bench player step in, so it is what the bye
 * actually costs once the manager sets a lineup.
 *
 * teams: season team rows (id, manager.name, team_name)
 * entries: roster_entries with player {name, position, nfl_team}
 * games: [{ week, homeId, awayId }] (resolveSchedule(teams).games)
 * getPpg(entry): the entry's season ppg
 * rosterFor(teamId): the team's current entries
 */
export function computeByeImpact({ teams, games, fromWeek, toWeek, getPpg, rosterFor, byes = NFL_BYES_2026 }) {
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]))
  const roster = {}
  teams.forEach(t => {
    roster[t.id] = rosterFor(t.id)
      .filter(e => e.player?.position && ['QB', 'RB', 'WR', 'TE', 'K'].includes(e.player.position))
      .map(e => ({ name: e.player.name, pos: e.player.position, nfl: e.player.nfl_team || null, ppg: getPpg(e) || 0 }))
  })
  const starters = Object.fromEntries(teams.map(t => [t.id, bestLineup(roster[t.id])]))
  const base = Object.fromEntries(teams.map(t => [t.id, sum(starters[t.id])]))

  const onBye = (p, week) => !!p.nfl && (byes[week] || []).includes(p.nfl)
  const lost = (id, week) => {
    const out = starters[id].filter(p => onBye(p, week))
    const withoutBye = bestLineup(roster[id].filter(p => !onBye(p, week)))
    return {
      raw: sum(out),
      effective: Math.max(0, base[id] - sum(withoutBye)),
      players: out.map(p => ({ name: p.name, nfl: p.nfl, ppg: r1(p.ppg) })),
    }
  }

  const rows = Object.fromEntries(teams.map(t => [t.id, {
    id: t.id, name: t.manager?.name || t.team_name, teamName: t.team_name,
    oppLost: 0, oppEffective: 0, weeks: [],
  }]))

  games.filter(g => g.week >= fromWeek && g.week <= toWeek).forEach(g => {
    ;[[g.homeId, g.awayId], [g.awayId, g.homeId]].forEach(([meId, oppId]) => {
      if (!rows[meId] || !rows[oppId]) return
      const opp = lost(oppId, g.week)
      const r = rows[meId]
      r.oppLost += opp.raw
      r.oppEffective += opp.effective
      r.weeks.push({
        week: g.week, oppName: teamById[oppId]?.manager?.name || teamById[oppId]?.team_name,
        byeTeams: byes[g.week] || [],
        oppLost: r1(opp.raw), oppEffective: r1(opp.effective), oppPlayers: opp.players,
      })
    })
  })

  return Object.values(rows).map(r => ({
    ...r,
    oppLost: r1(r.oppLost),
    oppEffective: r1(r.oppEffective),
    weeks: r.weeks.sort((a, b) => a.week - b.week),
  }))
}
