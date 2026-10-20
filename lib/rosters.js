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
// a stored 0.0 usually means out / injured reserve / bye / not rostered / not yet
// played, and counting it would drag a healthy player's average down.
// Bye weeks are stored as no value at all, so they never appear. Pass
// `beforeWeek` (the first week not yet completed): the sync also stores 0.0 for
// games that haven't kicked off, and with a real projection that would otherwise
// look like a game played and scored 0.
export function playedGames(stats, beforeWeek = Infinity) {
  const actual = stats?.actual || {}
  const proj = stats?.proj || {}
  const started = stats?.started || {}
  // Anything that scored points played. An exact 0.0 is only a real game if the
  // player was in the lineup with a real projection; on the bench (or out, on a
  // bye, or for a game not yet played) a 0.0 just means no game.
  const played = g => g.pts > 0 || (g.pts === 0 && g.started === true && g.proj > 0)
  return Object.entries(actual)
    .map(([w, pts]) => ({ week: Number(w), pts, proj: proj[w], started: started[w] }))
    .filter(g => typeof g.pts === 'number' && g.week < beforeWeek && played(g))
    .sort((a, b) => a.week - b.week)
}

export function playedAvg(stats, beforeWeek = Infinity) {
  const games = playedGames(stats, beforeWeek)
  return games.length ? games.reduce((s, g) => s + g.pts, 0) / games.length : null
}
