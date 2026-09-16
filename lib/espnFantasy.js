// ESPN's fantasy football API (v3), scoped to this league. A public league
// (this one is, as of Week 2 2026) can be read with no auth at all; ESPN_S2/
// ESPN_SWID (the league owner's own session cookies) are only needed if the
// league is ever switched back to private, so they're optional here -- the
// Cookie header is only sent when both are actually set.
//
// The mBoxscore/mMatchupScore/mRoster view shape used below is the same one
// widely documented by community tools (e.g. the espn-api Python library).
// The league/members shape has been confirmed live against this exact
// league; the boxscore/roster shape specifically (matchup scores, starters,
// per-player actual points) has not been -- verify parseEspnWeek() output
// against a real sync run and adjust if any of it looks off.

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

// ESPN's player.defaultPositionId -> our position labels.
const ESPN_POSITION = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' }

export function espnHeaders(week) {
  const headers = {
    'Accept': 'application/json',
    'Referer': 'https://fantasy.espn.com/',
    'Origin': 'https://fantasy.espn.com',
    'X-Fantasy-Source': 'kona',
    // An empty filter on the mBoxscore view appears to make ESPN's backend
    // try to compute box scores for every matchup period in the season
    // instead of just the one requested -- a computation heavy enough that
    // it seemingly never finishes inside a normal request (persistent 202
    // Accepted / empty body, not a transient "still working on it"). Scoping
    // the filter to the one matchup period being asked for is the fix
    // documented by community tools that talk to this same endpoint.
    'X-Fantasy-Filter': week != null
      ? JSON.stringify({ schedule: { filterMatchupPeriodIds: { value: [week] } } })
      : '{}',
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

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ESPN's kona backend computes some heavy views (mBoxscore in particular)
// asynchronously: a request can come back 202 Accepted with an empty body
// while the result is still being assembled, and the client is expected to
// just ask again shortly after -- this is not an error condition, it's the
// documented shape of a "still working on it" response.
const MAX_202_RETRIES = 3
const RETRY_DELAY_MS = 1500

export async function fetchEspnWeek(year, week) {
  // ESPN migrated fantasy reads off fantasy.espn.com to this host at some
  // point; the old host still resolves and even accepts the request, but
  // serves a generic placeholder (a persistent 202 with an empty body to an
  // API-shaped request, a redirect to the app for a browser navigation)
  // instead of an error that would have made the move obvious sooner.
  // Confirmed live against this league on 2026-09-16.
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${LEAGUE_ID}`
    + `?view=mMatchupScore&view=mBoxscore&view=mRoster&view=mTeam&scoringPeriodId=${week}`

  for (let attempt = 0; attempt <= MAX_202_RETRIES; attempt++) {
    const res = await fetch(url, { headers: espnHeaders(week), cache: 'no-store' })
    const bodyText = await res.text()

    if (res.status === 202 && attempt < MAX_202_RETRIES) {
      await sleep(RETRY_DELAY_MS * (attempt + 1))
      continue
    }
    if (!res.ok) throw new Error(`ESPN returned HTTP ${res.status}: ${bodyText.slice(0, 200)}`)
    if (!bodyText) throw new Error(`ESPN returned HTTP ${res.status} with an empty body after ${attempt + 1} attempt(s)`)
    try {
      return JSON.parse(bodyText)
    } catch {
      throw new Error(`ESPN returned non-JSON (HTTP ${res.status}): ${bodyText.slice(0, 200)}`)
    }
  }
}

// Each player carries a stats[] array with one entry per (scoringPeriodId,
// statSourceId) pair -- statSourceId 0 is actual, 1 is projected. This reads
// ESPN's own projection for the requested week, straight from the same
// payload already being fetched for scores, rather than a second call to a
// different provider. Well-documented shape (this is the same mechanism
// espn-api and similar tools use); not yet confirmed against a live sync
// here since it's brand new -- check a real response for stats.proj values
// that look sane before trusting it fully.
function espnProjectedPoints(player, week) {
  const entry = (player.stats || []).find(s => s.scoringPeriodId === week && s.statSourceId === 1)
  return entry?.appliedTotal ?? null
}

/**
 * Parses one week's ESPN league payload into:
 *  - matchups: [{ espnHomeId, espnAwayId, homeScore, awayScore }]
 *  - playerLines: [{ espnTeamId, playerName, position, actual, proj, started }]
 *
 * playerLines comes from rosterForCurrentScoringPeriod, which reflects each
 * team's actual roster as of that week -- not just who scored -- so it also
 * doubles as the source of truth for roster reconciliation (trades, waiver
 * pickups/drops) in the sync route, not just that week's stats. It also
 * reflects whatever lineup is currently set even before kickoff, so a not-
 * yet-played week already shows real starters + ESPN's own projections, not
 * just a blank matchup.
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
          position: ESPN_POSITION[player.defaultPositionId] || null,
          actual: e.playerPoolEntry?.appliedStatTotal ?? 0,
          proj: espnProjectedPoints(player, week),
          started: STARTER_SLOT_IDS.has(e.lineupSlotId),
          slot: LINEUP_SLOT[e.lineupSlotId] || null,
        })
      }
    }
  }

  return { matchups, playerLines }
}
