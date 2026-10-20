// Week-by-week rosters.
//
// roster_entries has one row per player with team_id = the team that most
// recently held them, so after a drop or a pickup team_id alone can't say who
// was on which roster in a given week. stats.teamId[week] is the real record:
// the team that owned the player in that week (written by /api/espn-sync and
// by roster_transactions_sync_2026.sql). A player who was on no roster in a
// week has no key for it.
//
// Seasons with no snapshots at all (earlier years) fall back to team_id.

// Highest week that has an ownership snapshot on any entry (0 = none).
export function latestRosterWeek(entries) {
  let latest = 0
  for (const e of entries) {
    for (const k of Object.keys(e.stats?.teamId || {})) {
      const w = Number(k)
      if (w > latest) latest = w
    }
  }
  return latest
}

function ownerFor(e, week, latest) {
  if (!latest) return e.team_id
  // A week past the last snapshot (e.g. next week's projections before the
  // sync has run) uses the most recent roster, since rosters carry forward.
  return e.stats?.teamId?.[Math.min(week ?? latest, latest)] ?? null
}

// Entries that belonged to `teamId` in `week` (omit week for the current roster).
export function weekEntries(entries, teamId, week, latest = latestRosterWeek(entries)) {
  return entries.filter(e => ownerFor(e, week, latest) === teamId)
}

// { teamId: [entries] } for `week` (omit week for current rosters).
export function groupEntriesByTeam(entries, week) {
  const latest = latestRosterWeek(entries)
  const byTeam = {}
  entries.forEach(e => {
    const owner = ownerFor(e, week, latest)
    if (owner) (byTeam[owner] ||= []).push(e)
  })
  return byTeam
}

// Everyone on a roster right now, dropped players excluded.
export function currentEntries(entries) {
  const latest = latestRosterWeek(entries)
  return entries.filter(e => ownerFor(e, undefined, latest) != null)
}

// A player's real games, from stats.actual. A week counts only if they played:
// a stored 0.0 with a 0.0 projection means out / injured reserve / not rostered
// that week, and counting it would drag a healthy player's average down. A game
// they played and scored 0 in (projection above 0) still counts, as ESPN's does.
// Bye weeks are stored as no value at all, so they never appear.
export function playedGames(stats, beforeWeek = Infinity) {
  const actual = stats?.actual || {}
  const proj = stats?.proj || {}
  return Object.entries(actual)
    .map(([w, pts]) => ({ week: Number(w), pts, proj: proj[w] }))
    .filter(g => typeof g.pts === 'number' && g.week < beforeWeek && !(g.pts === 0 && !(g.proj > 0)))
    .sort((a, b) => a.week - b.week)
}

export function playedAvg(stats) {
  const games = playedGames(stats)
  return games.length ? games.reduce((s, g) => s + g.pts, 0) / games.length : null
}
