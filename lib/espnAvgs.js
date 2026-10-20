// Client side of /api/player-avgs: ESPN's real season average for every rostered
// player, keyed by normalised name. Resolves to {} if the feed is unavailable, so
// callers can always fall back to the numbers we compute ourselves.
export const normName = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

let promise = null
export function loadEspnAvgs() {
  if (!promise) {
    promise = fetch('/api/player-avgs')
      .then(r => (r.ok ? r.json() : null))
      .then(j => j?.players || {})
      .catch(() => ({}))
  }
  return promise
}
