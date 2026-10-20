// Each rostered player's real season scoring (points per game PLAYED, all games
// this season -- including ones played before he joined the team he's on now),
// straight from ESPN's own season stat line. Our database only has the weeks a
// player was on a roster, so a new pickup would otherwise show one game as his
// whole season. Cached for ten minutes; callers fall back to their own numbers
// if this fails.
import { espnHeaders, LEAGUE_ID } from '../../../lib/espnFantasy'

export const dynamic = 'force-dynamic'
const SEASON_YEAR = 2026
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export async function GET() {
  try {
    const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON_YEAR}/segments/0/leagues/${LEAGUE_ID}?view=mRoster&view=mTeam`
    const res = await fetch(url, { headers: espnHeaders(null), cache: 'no-store' })
    if (!res.ok) throw new Error(`ESPN returned HTTP ${res.status}`)
    const data = await res.json()
    const players = {}
    for (const team of data.teams || []) {
      for (const entry of team.roster?.entries || []) {
        const p = entry.playerPoolEntry?.player
        if (!p?.fullName) continue
        // the season line: id "00<year>", actual points (source 0), full-season split (0)
        const line = (p.stats || []).find(s => s.id === `00${SEASON_YEAR}` && s.statSourceId === 0 && s.statSplitTypeId === 0)
        if (!line || !(line.appliedAverage > 0)) continue
        players[norm(p.fullName)] = {
          avg: line.appliedAverage,
          total: line.appliedTotal,
          games: Math.round(line.appliedTotal / line.appliedAverage),
        }
      }
    }
    return Response.json({ season: SEASON_YEAR, players }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=600' } })
  } catch (e) {
    return Response.json({ season: SEASON_YEAR, players: {}, error: e.message }, { status: 200 })
  }
}
