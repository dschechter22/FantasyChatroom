// Sleeper's public projections API -- no auth needed. Same approach AMFFL
// uses: one request per position (the endpoint doesn't return all positions
// at once), matched to our players via players.sleeper_id, then scored
// under this league's own rules (lib/scoring.js) rather than trusting
// Sleeper's own pts_ppr field.

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']

// These ride along in the same payload as real stat categories but are
// draft-position data, not projections -- scoring against them would award
// fantasy points for where a player was drafted.
const IGNORED_STAT_KEYS = new Set(['adp_dd_ppr', 'pos_adp_dd_ppr'])

/** Returns { [sleeper_player_id]: rawStatsObject }. Best-effort per position -- a failed position is skipped rather than failing the whole sync. */
export async function fetchSleeperProjections(season, week) {
  const byPlayerId = {}
  for (const pos of POSITIONS) {
    try {
      const url = `https://api.sleeper.com/projections/nfl/${season}/${week}`
        + `?season_type=regular&position[]=${encodeURIComponent(pos)}&order_by=ppr`
      const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' })
      if (!res.ok) continue
      const rows = await res.json()
      for (const row of rows || []) {
        if (!row?.player_id || !row.stats) continue
        const stats = { ...row.stats }
        for (const k of IGNORED_STAT_KEYS) delete stats[k]
        byPlayerId[row.player_id] = stats
      }
    } catch {
      // best-effort -- one position's outage shouldn't blank the rest
    }
  }
  return byPlayerId
}

export async function fetchSleeperCurrentWeek() {
  try {
    const res = await fetch('https://api.sleeper.app/v1/state/nfl', { cache: 'no-store' })
    const state = await res.json()
    return state.week || null
  } catch {
    return null
  }
}
