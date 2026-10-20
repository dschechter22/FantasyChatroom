// Data layer for the Similar Teams page: every team-season in the league's
// history with its full-season stats, lineup-slot roster and outcome, plus the
// colour tiers used to read a roster at a glance and helpers to score how alike
// any two teams are.
import { supabase, fetchAll, LEAGUE_ID } from './supabase'
import { seasonFeatures, similarityMetric } from './similarTeams'
import { groupEntriesByTeam } from './rosters'

export const SLOT_ORDER = ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX1', 'FLEX2', 'K']
const SLOT_GROUP = { QB: 'QB', RB1: 'RB1', RB2: 'RB2', WR1: 'WR1', WR2: 'WR2', TE: 'TE', FLEX1: 'FLEX', FLEX2: 'FLEX', K: 'K' }

// Like a PFF roster grade: where a slot's scoring ranks among every team ever.
export const TIERS = [
  { key: 'elite', label: 'Elite', bg: '#4285F4', fg: '#ffffff', min: 0.9 },
  { key: 'high', label: 'High quality', bg: '#2f7d32', fg: '#ffffff', min: 0.7 },
  { key: 'above', label: 'Above average', bg: '#9ccc83', fg: '#10210a', min: 0.5 },
  { key: 'avg', label: 'Average', bg: '#f3e58a', fg: '#2b2606', min: 0.3 },
  { key: 'below', label: 'Below average', bg: '#f6b043', fg: '#2e1c00', min: 0.1 },
  { key: 'poor', label: 'Poor', bg: '#e8504a', fg: '#ffffff', min: 0 },
]

let rawPromise = null
export function loadLeagueHistory() {
  if (rawPromise) return rawPromise
  rawPromise = (async () => {
    const entrySelect = (stats) => supabase.from('roster_entries').select(stats).eq('league_id', LEAGUE_ID)
    const [teamsRes, matchupsRes, entriesRes] = await Promise.all([
      fetchAll(() => supabase.from('teams').select('*, manager:manager_id(name, slug), season:season_id(year)').eq('league_id', LEAGUE_ID)),
      fetchAll(() => supabase.from('matchups').select('*, home_team:home_team_id(id), away_team:away_team_id(id), season:season_id(year)').eq('league_id', LEAGUE_ID)),
      // Pull just the JSON paths we need: the full stats blob is large for old seasons.
      fetchAll(() => entrySelect('team_id, avg_pts, actual:stats->actual, tid:stats->teamId, player:player_id(name, position)')),
    ])
    let entries = entriesRes.data
    if (entriesRes.error || !entries) {
      const fb = await fetchAll(() => entrySelect('team_id, avg_pts, stats, player:player_id(name, position)'))
      entries = (fb.data || []).map(e => ({ ...e, actual: e.stats?.actual, tid: e.stats?.teamId }))
    }
    return { teams: teamsRes.data || [], matchups: matchupsRes.data || [], entries }
  })()
  rawPromise.catch(() => { rawPromise = null })
  return rawPromise
}

const isPlayed = m => m.home_score != null && m.away_score != null && (m.home_score > 0 || m.away_score > 0)

// A player's per-game scoring: this season's logged weeks, or the stored average.
function ppgOf(e) {
  const vals = Object.values(e.actual || {}).filter(v => typeof v === 'number')
  if (vals.length) return vals.reduce((s, v) => s + v, 0) / vals.length
  return e.avg_pts || 0
}

// Slot a roster by per-game scoring: QB, 2 RB, 2 WR, TE, two FLEX (best of the
// leftover RB/WR/TE), K -- everyone else is bench.
export function assignSlots(players) {
  const by = {}
  players.forEach(p => { (by[p.pos] ||= []).push(p) })
  Object.values(by).forEach(a => a.sort((x, y) => y.ppg - x.ppg))
  const slots = {}
  const used = new Set()
  const put = (slot, p) => { if (p) { slots[slot] = p; used.add(p) } }
  put('QB', by.QB?.[0]); put('RB1', by.RB?.[0]); put('RB2', by.RB?.[1])
  put('WR1', by.WR?.[0]); put('WR2', by.WR?.[1]); put('TE', by.TE?.[0]); put('K', by.K?.[0])
  const flex = [...(by.RB || []), ...(by.WR || []), ...(by.TE || [])].filter(p => !used.has(p)).sort((x, y) => y.ppg - x.ppg)
  put('FLEX1', flex[0]); put('FLEX2', flex[1])
  const bench = players.filter(p => !used.has(p)).sort((x, y) => y.ppg - x.ppg)
  return { slots, bench }
}

const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }

export function finishOf(t) {
  if (!t) return { label: '—', kind: 'none' }
  // an unfinished season has no outcome yet -- show where the team stands instead
  if (t.inProgress) return { label: t.currentRank ? `In progress · ${ordinal(t.currentRank)} now` : 'In progress', kind: 'live' }
  if (t.result === 'Champion') return { label: 'Champion', kind: 'champ' }
  if (t.result === 'Runner Up') return { label: 'Runner-up', kind: 'second' }
  if (t.result === 'Third Place') return { label: '3rd place', kind: 'third' }
  if (t.madePlayoffs) return { label: t.finalStanding ? `Playoffs · #${t.finalStanding}` : 'Made playoffs', kind: 'in' }
  if (t.result && t.result.includes('Mol Bowl')) return { label: t.result, kind: 'out' }
  return { label: t.finalStanding ? `Missed · #${t.finalStanding}` : 'Missed playoffs', kind: 'out' }
}

export function buildIndex(raw) {
  const teamsAll = raw.teams.filter(t => t.season?.year)
  const matchupsByYear = {}
  raw.matchups.forEach(m => { if (m.season?.year && !m.is_playoff) (matchupsByYear[m.season.year] ||= []).push(m) })
  const teamsByYear = {}
  teamsAll.forEach(t => { (teamsByYear[t.season.year] ||= []).push(t) })
  const seasonWeeks = {}
  Object.entries(matchupsByYear).forEach(([y, ms]) => { seasonWeeks[y] = new Set(ms.filter(isPlayed).map(m => m.week)).size })

  // Rosters per team. A season with weekly ownership snapshots (the current one)
  // uses who is on the team now; older seasons use the roster row's team.
  const teamIds = new Set(teamsAll.map(t => t.id))
  const snap = [], plain = []
  raw.entries.forEach(e => {
    if (!teamIds.has(e.team_id) || !e.player?.position) return
    const hasSnap = e.tid && Object.keys(e.tid).length > 0
    ;(hasSnap ? snap : plain).push(e)
  })
  const playersByTeam = new Map()
  const addPlayer = (teamId, e) => {
    if (!playersByTeam.has(teamId)) playersByTeam.set(teamId, [])
    playersByTeam.get(teamId).push({ name: e.player.name, pos: e.player.position, ppg: ppgOf(e) })
  }
  plain.forEach(e => addPlayer(e.team_id, e))
  Object.entries(groupEntriesByTeam(snap.map(e => ({ ...e, stats: { teamId: e.tid } })))).forEach(([teamId, es]) => es.forEach(e => addPlayer(teamId, e)))
  // players-with-ppg lists, as the feature code wants them
  const rosters = new Map([...playersByTeam].map(([id, ps]) => [id, ps.map(p => ({ pos: p.pos, ppg: p.ppg }))]))

  // full-season (to date) stats for every team
  const fullFeatures = new Map()
  Object.keys(teamsByYear).forEach(y => {
    if (!seasonWeeks[y]) return
    seasonFeatures({ teams: teamsByYear[y], matchups: matchupsByYear[y], rosters, week: seasonWeeks[y] }).forEach((f, id) => fullFeatures.set(id, f))
  })

  // A season is finished once its teams have final standings on file; until then
  // there is no playoff result, so an empty one doesn't mean "missed".
  const complete = {}
  Object.entries(teamsByYear).forEach(([y, ts]) => { complete[y] = ts.some(t => t.final_standing != null) })
  // current standing for unfinished seasons: wins, then points for
  const currentRank = new Map()
  Object.entries(teamsByYear).forEach(([y, ts]) => {
    if (complete[y]) return
    const stat = ts.map(t => { const f = fullFeatures.get(t.id)?.meta; return { id: t.id, w: f?.wins ?? t.wins ?? 0, pf: f?.pf ?? t.points_for ?? 0 } })
    stat.sort((a, b) => b.w - a.w || b.pf - a.pf).forEach((s, i) => currentRank.set(s.id, i + 1))
  })

  const teams = teamsAll.map(t => {
    const f = fullFeatures.get(t.id)
    const m = f?.meta
    const { slots, bench } = assignSlots(playersByTeam.get(t.id) || [])
    const starterPpg = Object.values(slots).reduce((s, p) => s + p.ppg, 0)
    const rosterPpg = starterPpg + bench.reduce((s, p) => s + p.ppg, 0)
    const games = m?.games ?? ((t.wins || 0) + (t.losses || 0))
    return {
      id: t.id, year: t.season.year, name: t.manager?.name || '?', slug: t.manager?.slug, teamName: t.team_name,
      wins: m?.wins ?? t.wins ?? 0, losses: m?.losses ?? t.losses ?? 0, games,
      pf: m?.pf ?? t.points_for ?? 0, pa: m?.pa ?? t.points_against ?? 0,
      avg: m?.avg ?? (games ? (t.points_for || 0) / games : 0),
      median: m?.median ?? null, std: m?.std ?? null, high: m?.high ?? null, low: m?.low ?? null,
      power: m?.power ?? null, allPlay: null,
      luck: m ? m.luck * m.games : null,
      finalStanding: t.final_standing, madePlayoffs: !!t.made_playoffs, result: t.playoff_result,
      inProgress: !complete[t.season.year], currentRank: currentRank.get(t.id) ?? null,
      slots, bench, starterPpg, rosterPpg,
    }
  })
  // all-play stored per game in features; show it as a percentage
  teams.forEach(t => {
    const f = fullFeatures.get(t.id)
    t.allPlay = f ? f.meta.allPlay * 100 : null
    t.diff = t.pf - t.pa
    // per-game versions, so a 6-game season sits fairly beside a 14-game one
    const g = Math.max(t.games, 1)
    t.papg = t.pa / g
    t.diffpg = t.diff / g
    t.luckpg = t.luck != null ? t.luck / g : null
  })

  // tier cut-offs: every team ever, per slot group
  const slotValues = {}
  teams.forEach(t => SLOT_ORDER.forEach(s => { const p = t.slots[s]; if (p && p.ppg > 0) (slotValues[SLOT_GROUP[s]] ||= []).push(p.ppg) }))
  Object.values(slotValues).forEach(a => a.sort((x, y) => x - y))
  const tierOf = (slot, ppg) => {
    const vals = slotValues[SLOT_GROUP[slot]]
    if (!vals || !(ppg > 0)) return null
    const below = vals.filter(v => v < ppg).length
    const pct = below / vals.length
    return TIERS.find(t => pct >= t.min) || TIERS[TIERS.length - 1]
  }

  const featureCache = new Map()
  const featuresAtWeek = week => {
    if (featureCache.has(week)) return featureCache.get(week)
    const out = new Map()
    Object.keys(teamsByYear).forEach(y => {
      seasonFeatures({ teams: teamsByYear[y], matchups: matchupsByYear[y] || [], rosters, week }).forEach((f, id) => out.set(id, f))
    })
    featureCache.set(week, out)
    return out
  }

  return { teams, byId: new Map(teams.map(t => [t.id, t])), tierOf, featuresAtWeek, years: [...new Set(teams.map(t => t.year))].sort((a, b) => b - a) }
}

// How alike is each team to `anchorId`, measured through the anchor's played
// weeks (so a half-played season compares with others' first half).
export function similarityToAnchor(index, anchorId) {
  const anchor = index.byId.get(anchorId)
  if (!anchor || !anchor.games) return { week: 0, scores: new Map() }
  const feats = index.featuresAtWeek(anchor.games)
  const target = feats.get(anchorId)
  if (!target) return { week: anchor.games, scores: new Map() }
  const pool = [...feats].map(([id, f]) => ({ id, vector: f.vector, meta: f.meta }))
  const metric = similarityMetric(pool)
  const scores = new Map()
  pool.forEach(p => {
    if (p.id === anchorId) return
    const r = metric(target, p)
    if (r) scores.set(p.id, r)
  })
  return { week: anchor.games, scores }
}

// Pairwise similarity between the selected teams, at the most weeks they've all played.
export function similarityMatrix(index, ids) {
  const teams = ids.map(id => index.byId.get(id)).filter(Boolean)
  if (teams.length < 2) return { week: 0, cells: [] }
  const week = Math.min(...teams.map(t => t.games))
  if (!week) return { week: 0, cells: [] }
  const feats = index.featuresAtWeek(week)
  const metric = similarityMetric([...feats].map(([id, f]) => ({ id, vector: f.vector, meta: f.meta })))
  const cells = ids.map(a => ids.map(b => {
    if (a === b) return null
    const fa = feats.get(a), fb = feats.get(b)
    return fa && fb ? metric(fa, fb) : null
  }))
  return { week, cells }
}
