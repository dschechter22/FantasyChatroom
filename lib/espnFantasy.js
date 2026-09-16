// ESPN's fantasy football API (v3), scoped to this league. A public league
// (this one is, as of Week 2 2026) can be read with no auth at all; ESPN_S2/
// ESPN_SWID (the league owner's own session cookies) are only needed if the
// league is ever switched back to private, so they're optional here -- the
// Cookie header is only sent when both are actually set.
//
// The mBoxscore/mMatchupScore/mRoster view shape used below is the same one
// widely documented by community tools (e.g. the espn-api Python library)
// and has been stable for years, but it has NOT been exercised against a
// live league from this codebase -- there were no valid cookies available
// while writing this. Treat field names as "should be right, not yet
// confirmed" until the first real sync run, and expect to adjust
// parseEspnWeek() if ESPN's shape has drifted.

const LEAGUE_ID = 95898

// ESPN's lineupSlotId -> our position labels. 20/21 are non-starting slots;
// everything else in this map is a slot this league actually uses (no D/ST
// slot exists on any roster in this league, per its rosters).
const LINEUP_SLOT = {
  0: 'QB',
  2: 'RB',
  4: 'WR',
  6: 'TE',
  16: 'D/ST',
  17: 'K',
  23: 'FLEX',
  20: 'BENCH',
  21: 'IR',
}
const STARTER_SLOT_IDS = new Set([0, 2, 4, 6, 16, 17, 23])

export function espnHeaders() {
  const headers = {
    'Accept': 'application/json',
    'Referer': 'https://fantasy.espn.com/',
    'Origin': 'https://fantasy.espn.com',
    'X-Fantasy-Source': 'kona',
    'X-Fantasy-Filter': '{}',
    // A server-side fetch with no/generic User-Agent reads as a bot to a
    // lot of front-door protection (Akamai, etc.) and gets served an HTML
    // challenge/block page instead of JSON -- a real browser UA avoids that.
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
  if (process.env.ESPN_S2 && process.env.ESPN_SWID) {
    headers['Cookie'] = `espn_s2=${process.env.ESPN_S2}; SWID=${process.env.ESPN_SWID}`
  }
  return headers
}

export async function fetchEspnWeek(year, week) {
  const url = `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${LEAGUE_ID}`
    + `?view=mMatchupScore&view=mBoxscore&view=mRoster&view=mTeam&scoringPeriodId=${week}`
  const res = await fetch(url, { headers: espnHeaders(), cache: 'no-store' })
  const bodyText = await res.text()
  if (!res.ok) throw new Error(`ESPN returned HTTP ${res.status}: ${bodyText.slice(0, 200)}`)
  try {
    return JSON.parse(bodyText)
  } catch {
    throw new Error(`ESPN returned non-JSON (HTTP ${res.status}): ${bodyText.slice(0, 200)}`)
  }
}

/**
 * Parses one week's ESPN league payload into:
 *  - matchups: [{ espnHomeId, espnAwayId, homeScore, awayScore }]
 *  - playerLines: [{ espnTeamId, playerName, actual, started }]
 */
export function parseEspnWeek(data, week) {
  const matchups = []
  const playerLines = []

  for (const m of data.schedule || []) {
    if (m.matchupPeriodId !== week) continue
    if (m.home?.teamId != null && m.away?.teamId != null) {
      matchups.push({
        espnHomeId: m.home.teamId,
        espnAwayId: m.away.teamId,
        homeScore: m.home.totalPoints ?? 0,
        awayScore: m.away.totalPoints ?? 0,
      })
    }
    for (const side of [m.home, m.away]) {
      if (!side) continue
      const entries = side.rosterForCurrentScoringPeriod?.entries || []
      for (const e of entries) {
        const player = e.playerPoolEntry?.player
        if (!player?.fullName) continue
        playerLines.push({
          espnTeamId: side.teamId,
          playerName: player.fullName,
          actual: e.playerPoolEntry?.appliedStatTotal ?? 0,
          started: STARTER_SLOT_IDS.has(e.lineupSlotId),
          slot: LINEUP_SLOT[e.lineupSlotId] || null,
        })
      }
    }
  }

  return { matchups, playerLines }
}
