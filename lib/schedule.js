// The league runs the same fixture list every year: weeks 1-9 are a full round
// robin, weeks 10-14 replay weeks 1-5 with home/away flipped. Pairs are
// [home, away] by manager name.
export const SCHEDULE = [
  // Week 1
  [['Dan', 'Reid'], ['Caden', 'John'], ['Wally', 'Braden'], ['JM/Cameron', 'Mamby/Tenner'], ['Big E', 'Freed']],
  // Week 2
  [['Reid', 'John'], ['Braden', 'Dan'], ['Mamby/Tenner', 'Caden'], ['Freed', 'Wally'], ['Big E', 'JM/Cameron']],
  // Week 3
  [['Braden', 'Reid'], ['John', 'Mamby/Tenner'], ['Dan', 'Freed'], ['Caden', 'Big E'], ['Wally', 'JM/Cameron']],
  // Week 4
  [['Reid', 'Mamby/Tenner'], ['Freed', 'Braden'], ['Big E', 'John'], ['JM/Cameron', 'Dan'], ['Wally', 'Caden']],
  // Week 5
  [['Freed', 'Reid'], ['Mamby/Tenner', 'Big E'], ['Braden', 'JM/Cameron'], ['John', 'Wally'], ['Dan', 'Caden']],
  // Week 6
  [['Reid', 'Big E'], ['JM/Cameron', 'Freed'], ['Wally', 'Mamby/Tenner'], ['Caden', 'Braden'], ['Dan', 'John']],
  // Week 7
  [['JM/Cameron', 'Reid'], ['Big E', 'Wally'], ['Freed', 'Caden'], ['Mamby/Tenner', 'Dan'], ['Braden', 'John']],
  // Week 8
  [['Reid', 'Wally'], ['Caden', 'JM/Cameron'], ['Dan', 'Big E'], ['John', 'Freed'], ['Braden', 'Mamby/Tenner']],
  // Week 9
  [['Caden', 'Reid'], ['Wally', 'Dan'], ['JM/Cameron', 'John'], ['Big E', 'Braden'], ['Freed', 'Mamby/Tenner']],
  // Week 10 — Week 1 rematch
  [['Reid', 'Dan'], ['John', 'Caden'], ['Braden', 'Wally'], ['Mamby/Tenner', 'JM/Cameron'], ['Freed', 'Big E']],
  // Week 11 — Week 2 rematch
  [['John', 'Reid'], ['Dan', 'Braden'], ['Caden', 'Mamby/Tenner'], ['Wally', 'Freed'], ['JM/Cameron', 'Big E']],
  // Week 12 — Week 3 rematch
  [['Reid', 'Braden'], ['Mamby/Tenner', 'John'], ['Freed', 'Dan'], ['Big E', 'Caden'], ['JM/Cameron', 'Wally']],
  // Week 13 — Week 4 rematch
  [['Mamby/Tenner', 'Reid'], ['Braden', 'Freed'], ['John', 'Big E'], ['Dan', 'JM/Cameron'], ['Caden', 'Wally']],
  // Week 14 — Week 5 rematch
  [['Reid', 'Freed'], ['Big E', 'Mamby/Tenner'], ['JM/Cameron', 'Braden'], ['Wally', 'John'], ['Caden', 'Dan']],
]

export const REG_SEASON_WEEKS = SCHEDULE.length

export const SCHEDULE_MANAGERS = [...new Set(SCHEDULE.flat(2))]

const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Schedule names are shorthand; database managers may be listed more formally
// (and co-managed teams show up under either owner).
function findTeam(name, teams) {
  const n = norm(name)
  const named = teams.map(t => ({ t, n: norm(t.manager?.name), team: norm(t.team_name) }))
  const exact = named.find(x => x.n === n)
  if (exact) return exact.t

  const parts = name.split('/').map(norm).filter(Boolean)
  for (const p of parts) {
    const hit = named.find(x => x.n === p || x.n.startsWith(p) || p.startsWith(x.n))
    if (hit) return hit.t
  }
  return named.find(x => x.n.includes(n) || n.includes(x.n) || x.team.includes(n))?.t || null
}

/**
 * Maps the fixed schedule onto a season's team rows.
 * Returns resolved games plus any manager names that couldn't be matched.
 */
export function resolveSchedule(teams) {
  if (!teams?.length) return { games: [], unresolved: SCHEDULE_MANAGERS }

  const lookup = {}
  const unresolved = []
  SCHEDULE_MANAGERS.forEach(name => {
    const t = findTeam(name, teams)
    if (t) lookup[name] = t
    else unresolved.push(name)
  })

  const games = []
  SCHEDULE.forEach((pairs, i) => {
    pairs.forEach(([home, away]) => {
      const h = lookup[home]
      const a = lookup[away]
      if (h && a) games.push({ week: i + 1, homeId: h.id, awayId: a.id })
    })
  })
  return { games, unresolved }
}

/**
 * Every game of a season: database rows where they exist, the fixed fixture
 * list for weeks that haven't synced. `useFixed` should be false for past
 * seasons, whose schedules are already complete in the database.
 */
export function buildFixtures({ matchups = [], teams = [], useFixed = true }) {
  const weeksWithRows = new Set(matchups.map(m => m.week))
  const out = matchups.map(m => ({
    key: m.id,
    week: m.week,
    homeId: m.home_team?.id,
    awayId: m.away_team?.id,
    m,
  }))
  if (useFixed) {
    resolveSchedule(teams).games.forEach(g => {
      if (weeksWithRows.has(g.week)) return
      out.push({ key: `s-${g.week}-${g.homeId}-${g.awayId}`, ...g, m: null })
    })
  }
  return out.filter(f => f.homeId && f.awayId)
}
