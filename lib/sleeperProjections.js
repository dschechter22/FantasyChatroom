// Sleeper's public /state/nfl endpoint -- no auth needed. Used only to know
// which NFL week is "current" (for app/api/espn-sync to decide whether a
// requested week is a same-day sync or a backfill of an already-passed
// week). Per-player projections used to come from Sleeper too, but that's
// been replaced by ESPN's own per-player projection, which comes from the
// same payload already being fetched for scores/starters and has full
// coverage (Sleeper matching required a sleeper_id, which a freshly-added
// player never has).

export async function fetchSleeperCurrentWeek() {
  try {
    const res = await fetch('https://api.sleeper.app/v1/state/nfl', { cache: 'no-store' })
    const state = await res.json()
    return state.week || null
  } catch {
    return null
  }
}
