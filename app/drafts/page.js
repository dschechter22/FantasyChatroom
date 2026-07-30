'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase, LEAGUE_ID } from '../../lib/supabase'
import { FPTS_STATIC } from '../../lib/fptsStatic'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'
export const dynamic = 'force-dynamic'

const POS_COLORS = { QB: '#4285F4', RB: '#34A853', WR: '#FBBC04', TE: '#EA4335', K: '#46BDC6', 'D/ST': '#888888' }
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST']
const SKILL_POS = ['QB', 'RB', 'WR', 'TE']

const getPickGradeLabel = (delta, round) => {
  if (delta == null) return null
  if (round <= 4) {
    if (delta <= -3) return 'A+'
    if (delta <= 0) return 'A'
    if (delta <= 1) return 'B+'
    if (delta <= 2) return 'B-'
    if (delta <= 5) return 'C+'
    if (delta <= 8) return 'C-'
    if (delta <= 11) return 'D+'
    if (delta <= 15) return 'D-'
    return 'F'
  }
  if (round <= 9) {
    if (delta <= -2) return 'A+'
    if (delta <= -1) return 'A'
    if (delta <= 0) return 'B+'
    if (delta <= 1) return 'B-'
    if (delta <= 3) return 'C+'
    if (delta <= 5) return 'C-'
    if (delta <= 7) return 'D+'
    if (delta <= 10) return 'D-'
    return 'F'
  }
  if (delta <= -5) return 'A+'
  if (delta <= -3) return 'A'
  if (delta <= -1) return 'B+'
  if (delta <= 0) return 'B-'
  if (delta <= 2) return 'C+'
  if (delta <= 3) return 'C-'
  if (delta <= 6) return 'D+'
  if (delta <= 9) return 'D-'
  return 'F'
}

const classifyStrategy = (picks) => {
  const sorted = [...picks].sort((a, b) => a.overall_pick - b.overall_pick)
  const first4 = sorted.filter(p => p.round <= 4)
  const first5 = sorted.filter(p => p.round <= 5)
  const rd1 = sorted.find(p => p.round === 1)
  const rbIn4 = first4.filter(p => p.position === 'RB').length
  const wrIn4 = first4.filter(p => p.position === 'WR').length
  const rbIn5 = first5.filter(p => p.position === 'RB').length
  const wrIn5 = first5.filter(p => p.position === 'WR').length
  const firstQB = sorted.find(p => p.position === 'QB')
  const firstTE = sorted.find(p => p.position === 'TE')
  const tags = []
  // Hero RB = RB in rd 1 AND only 1 RB in first 5 rounds (one elite RB, then Zero RB after)
  const heroRB = rd1?.position === 'RB' && rbIn5 <= 1
  const heroWR = rd1?.position === 'WR' && wrIn5 <= 1
  if (heroRB) tags.push('Hero RB')
  else if (rbIn4 >= 3) tags.push('Early RBs')
  else if (rbIn5 <= 1) tags.push('Zero RB')
  if (heroWR) tags.push('Hero WR')
  else if (wrIn4 >= 3) tags.push('Early WRs')
  else if (wrIn5 <= 1) tags.push('Zero WR')
  if (firstQB?.round <= 4) tags.push('Early QB')
  if (firstTE?.round <= 4) tags.push('Early TE')
  if (firstQB?.round >= 10) tags.push('Late QB')
  if (firstTE?.round >= 10) tags.push('Late TE')
  const hasRbTag = tags.some(t => t.includes('RB'))
  const hasWrTag = tags.some(t => t.includes('WR'))
  if (!hasRbTag && !hasWrTag && rbIn4 >= 2 && wrIn4 >= 2) tags.push('Balanced')
  return tags
}

const normName = (s) => (s || '')
  .toLowerCase()
  .replace(/['.,-]/g, '')
  .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
  .replace(/\s+/g, ' ')
  .trim()

export default function DraftsPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, green, red, gold, blue } = useLayout()
  const [tab, setTab] = useState('by-year')
  const [expanded, setExpanded] = useState(null) // { manager, year }
  const [intelExpanded, setIntelExpanded] = useState(null) // { mgr, yr } for draft intel tab
  const [selectedManager, setSelectedManager] = useState(null)
  const [allPicks, setAllPicks] = useState([])
  const [dbSeasons, setDbSeasons] = useState([])
  const [selectedYear, setSelectedYear] = useState(2025)
  const [mounted, setMounted] = useState(false)

  // enrichment
  const [playerList, setPlayerList] = useState([])
  const [fptsMap, setFptsMap] = useState({})
  const [enrichmentReady, setEnrichmentReady] = useState(false)
  const [unmatchedPicks, setUnmatchedPicks] = useState([])

  // team performance data
  const [teamSeasons, setTeamSeasons] = useState([])
  const [seasonMatchups, setSeasonMatchups] = useState([])

  // positional focus controls (trends tab)
  const [focusRoundFrom, setFocusRoundFrom] = useState(1)
  const [focusRounds, setFocusRounds] = useState(16)
  const [focusYearFrom, setFocusYearFrom] = useState(null)
  const [focusYearTo, setFocusYearTo] = useState(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const load = async () => {
      let all = [], from = 0
      while (true) {
        const { data: batch } = await supabase.from('draft_picks').select('*').eq('league_id', LEAGUE_ID).order('overall_pick').range(from, from + 999)
        if (!batch?.length) break
        all = [...all, ...batch]
        if (batch.length < 1000) break
        from += 1000
      }
      const rows = all.map(p => ({
        ...p,
        season: parseInt(p.season),
        round: parseInt(p.round),
        overall_pick: parseInt(p.overall_pick),
        pick_in_round: parseInt(p.pick_in_round),
      }))
      setAllPicks(rows)
      const years = [...new Set(rows.map(p => p.season))].sort((a, b) => b - a)
      setDbSeasons(years)
      if (years.length) setSelectedYear(years[0])
    }
    load()
  }, [])

  useEffect(() => {
    const load = async () => {
      // Paginate players — Sleeper DB has thousands of rows
      let allPlayers = [], pFrom = 0
      while (true) {
        const { data: batch } = await supabase.from('players').select('id, name').range(pFrom, pFrom + 999)
        if (!batch?.length) break
        allPlayers = [...allPlayers, ...batch]
        if (batch.length < 1000) break
        pFrom += 1000
      }
      setPlayerList(allPlayers)

      // Embed year via join — same pattern the player page uses — avoids teamYearMap FK gaps
      let allEntries = [], from = 0
      while (true) {
        const { data: batch } = await supabase
          .from('roster_entries')
          .select('player_id, fpts, team:team_id(season:season_id(year))')
          .eq('league_id', LEAGUE_ID)
          .range(from, from + 999)
        if (!batch?.length) break
        allEntries = [...allEntries, ...batch]
        if (batch.length < 1000) break
        from += 1000
      }
      const fm = {}
      allEntries.forEach(e => {
        const yr = e.team?.season?.year
        if (yr && e.player_id) fm[`${e.player_id}_${yr}`] = e.fpts || 0
      })
      setFptsMap(fm)
      setEnrichmentReady(true)
    }
    load()
  }, [])

  useEffect(() => {
    const load = async () => {
      const [{ data: teams }, { data: mups }] = await Promise.all([
        supabase.from('teams').select('id, manager_id, wins, losses, points_for, final_standing, playoff_result, made_playoffs, season:season_id(year), manager:manager_id(name)').eq('league_id', LEAGUE_ID).limit(500),
        supabase.from('matchups').select('week, home_score, away_score, home_team:home_team_id(manager_id), away_team:away_team_id(manager_id), season:season_id(year)').eq('league_id', LEAGUE_ID).eq('is_playoff', false).limit(2000),
      ])
      if (teams) setTeamSeasons(teams)
      if (mups) setSeasonMatchups(mups)
    }
    load()
  }, [])

  // Fuzzy-match draft picks to player IDs, attach fpts
  const enrichedPicks = useMemo(() => {
    if (!enrichmentReady || !allPicks.length || !playerList.length) return []

    const exactMap = {}
    playerList.forEach(p => { exactMap[normName(p.name)] = p })

    const match = (draftName) => {
      const norm = normName(draftName)
      if (exactMap[norm]) return exactMap[norm]
      const parts = norm.split(' ')
      if (parts.length >= 2) {
        const last = parts[parts.length - 1]
        const init = parts[0][0]
        const cands = playerList.filter(p => {
          const np = normName(p.name).split(' ')
          return np[np.length - 1] === last && np[0]?.[0] === init
        })
        if (cands.length === 1) return cands[0]
      }
      return null
    }

    return allPicks.map(p => {
      const pl = match(p.player_name)
      // Skill positions: static XLS data is the primary source
      // K/D/ST: fall back to DB roster_entries
      const fpts = SKILL_POS.includes(p.position)
        ? (FPTS_STATIC[`${normName(p.player_name)}_${p.season}`] ?? null)
        : (pl ? (fptsMap[`${pl.id}_${p.season}`] ?? null) : null)
      return { ...p, playerId: pl?.id || null, fpts, matched: !!pl }
    })
  }, [allPicks, playerList, fptsMap, enrichmentReady])

  useEffect(() => {
    if (!enrichedPicks.length) return
    // Only flag skill-pos picks with no static fpts data (very rare — missing from PFR)
    setUnmatchedPicks(enrichedPicks.filter(p => SKILL_POS.includes(p.position) && p.fpts == null))
  }, [enrichedPicks])

  // Value: actualFpts - expectedFpts, where expected = fpts of whoever finished at draft rank
  // Pool capped at top 70 (WR/RB) and top 32 (QB/TE) to exclude fantasy-irrelevant players
  // valueScore = z-score of rawValue across all picks (bell curve)
  const enrichedWithValue = useMemo(() => {
    if (!enrichedPicks.length) return []
    const CAP = { QB: 32, RB: 70, WR: 70, TE: 32 }
    const seasons = [...new Set(enrichedPicks.map(p => p.season))]

    const fptsByRankArr = {}   // `${yr}_${pos}` → [fpts sorted desc, capped]
    const fptsRankById = {}    // `${yr}_${pos}` → { playerId → rank }
    const draftRankMap = {}    // `${overall_pick}_${yr}` → draftPosRank

    seasons.forEach(yr => {
      SKILL_POS.forEach(pos => {
        const sp = enrichedPicks.filter(p => p.season === yr && p.position === pos)
        ;[...sp].sort((a, b) => a.overall_pick - b.overall_pick).forEach((p, i) => {
          draftRankMap[`${p.overall_pick}_${yr}`] = i + 1
        })
        const pool = sp.filter(p => p.fpts != null).sort((a, b) => b.fpts - a.fpts).slice(0, CAP[pos])
        fptsByRankArr[`${yr}_${pos}`] = pool.map(p => p.fpts)
        const rankById = {}
        pool.forEach((p, i) => { rankById[p.playerId ?? `_n_${normName(p.player_name)}`] = i + 1 })
        fptsRankById[`${yr}_${pos}`] = rankById
      })
    })

    const withRaw = enrichedPicks.map(p => {
      if (!SKILL_POS.includes(p.position)) return { ...p, valueScore: null, rawValue: null, fptsRank: null, draftPosRank: null }
      const pool = fptsByRankArr[`${p.season}_${p.position}`] || []
      const draftPosRank = draftRankMap[`${p.overall_pick}_${p.season}`]
      if (!draftPosRank || !pool.length) return { ...p, valueScore: null, rawValue: null, fptsRank: null, draftPosRank: draftPosRank ?? null }
      const expectedFpts = pool[Math.min(draftPosRank, pool.length) - 1]
      const pKey = p.playerId ?? `_n_${normName(p.player_name)}`
      const fptsRank = fptsRankById[`${p.season}_${p.position}`]?.[pKey] ?? (p.fpts != null ? pool.length + 1 : null)
      // No fpts = can't compute value — don't substitute 0 or it creates fake negatives
      if (p.fpts == null) return { ...p, rawValue: null, expectedFpts, fptsRank, draftPosRank }
      return { ...p, rawValue: p.fpts - expectedFpts, expectedFpts, fptsRank, draftPosRank }
    })

    const allRaw = withRaw.filter(p => p.rawValue != null).map(p => p.rawValue)
    if (!allRaw.length) return withRaw
    const mean = allRaw.reduce((s, v) => s + v, 0) / allRaw.length
    const stddev = Math.sqrt(allRaw.reduce((s, v) => s + (v - mean) ** 2, 0) / allRaw.length)

    return withRaw.map(p =>
      p.rawValue != null ? { ...p, valueScore: stddev > 0 ? (p.rawValue - mean) / stddev : 0 } : p
    )
  }, [enrichedPicks])

  const teamByManagerYear = useMemo(() => {
    if (!teamSeasons.length) return {}

    // Weekly scores per manager per year from matchups
    const weeklyScores = {}
    const weekAllScores = {}
    seasonMatchups.forEach(m => {
      const yr = m.season?.year
      if (!yr) return
      const wk = `${yr}_${m.week}`
      if (!weekAllScores[wk]) weekAllScores[wk] = []
      weekAllScores[wk].push(m.home_score, m.away_score)
      if (m.home_team?.manager_id) {
        const k = `${m.home_team.manager_id}_${yr}`
        if (!weeklyScores[k]) weeklyScores[k] = []
        weeklyScores[k].push({ week: m.week, score: m.home_score })
      }
      if (m.away_team?.manager_id) {
        const k = `${m.away_team.manager_id}_${yr}`
        if (!weeklyScores[k]) weeklyScores[k] = []
        weeklyScores[k].push({ week: m.week, score: m.away_score })
      }
    })

    const raw = {}
    teamSeasons.forEach(t => {
      const yr = t.season?.year
      const name = t.manager?.name
      if (!yr || !name) return
      const scores = weeklyScores[`${t.manager_id}_${yr}`] || []
      const games = t.wins + t.losses
      const avgPF = games > 0 ? t.points_for / games : 0
      const winPct = games > 0 ? t.wins / games : 0
      let apWins = 0, apGames = 0
      scores.forEach(({ week, score }) => {
        const others = (weekAllScores[`${yr}_${week}`] || []).filter(s => s !== score)
        apWins += others.filter(s => score > s).length
        apGames += others.length
      })
      const sorted = scores.map(s => s.score).sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const medianScore = sorted.length ? (sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]) : 0
      raw[`${name.toLowerCase().trim()}_${yr}`] = {
        wins: t.wins, losses: t.losses, avgPF: parseFloat(avgPF.toFixed(1)),
        finalStanding: t.final_standing, playoffResult: t.playoff_result, madePlayoffs: t.made_playoffs,
        winPct, allPlayWinPct: apGames > 0 ? apWins / apGames : 0, medianScore, _yr: yr,
      }
    })

    // Power score relative to year peers
    const byYear = {}
    Object.entries(raw).forEach(([k, v]) => { if (!byYear[v._yr]) byYear[v._yr] = []; byYear[v._yr].push({ k, v }) })
    Object.values(byYear).forEach(entries => {
      const vals = entries.map(e => e.v)
      const mxW = Math.max(...vals.map(v => v.winPct)) || 1
      const mxA = Math.max(...vals.map(v => v.avgPF)) || 1
      const mxP = Math.max(...vals.map(v => v.allPlayWinPct)) || 1
      const mxM = Math.max(...vals.map(v => v.medianScore)) || 1
      entries.forEach(({ k, v }) => {
        raw[k].powerScore = parseFloat(((v.winPct / mxW * 100 * 2) + (v.avgPF / mxA * 100 * 4) + (v.allPlayWinPct / mxP * 100 * 2) + (v.medianScore / mxM * 100 * 2)) / 10)
      })
    })

    return raw
  }, [teamSeasons, seasonMatchups])

  // Board data for selected year
  const picks = useMemo(() => allPicks.filter(p => p.season === selectedYear), [allPicks, selectedYear])
  const boardManagers = useMemo(() => picks.filter(p => p.round === 1).sort((a, b) => a.overall_pick - b.overall_pick).map(p => p.manager_name), [picks])
  const rounds = useMemo(() => [...new Set(picks.map(p => p.round))].sort((a, b) => a - b), [picks])

  // Trends
  const POS_N = { QB: 2, RB: 4, WR: 4, TE: 2, K: 1, 'D/ST': 1 }

  const trendData = useMemo(() => {
    if (!allPicks.length) return []
    return [...new Set(allPicks.map(p => p.manager_name))].sort().map(mgr => {
      const mp = allPicks.filter(p => p.manager_name === mgr)
      const years = [...new Set(mp.map(p => p.season))]
      const avgRound = {}
      POSITIONS.forEach(pos => {
        const vals = years.map(yr => mp.filter(p => p.season === yr && p.position === pos).sort((a, b) => a.overall_pick - b.overall_pick)[0]?.round).filter(Boolean)
        avgRound[pos] = vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null
      })
      const avgRoundByN = {}
      Object.entries(POS_N).forEach(([pos, max]) => {
        for (let n = 1; n <= max; n++) {
          const vals = years.map(yr => {
            const sorted = mp.filter(p => p.season === yr && p.position === pos).sort((a, b) => a.overall_pick - b.overall_pick)
            return sorted[n - 1]?.round
          }).filter(Boolean)
          if (vals.length) avgRoundByN[`${pos}${n}`] = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
        }
      })
      const r1 = mp.filter(p => p.round === 1)
      const r1c = {}; r1.forEach(p => { r1c[p.position] = (r1c[p.position] || 0) + 1 })
      const topR1 = Object.entries(r1c).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
      const earlyPos = {}
      mp.filter(p => p.round <= 3).forEach(p => { earlyPos[p.position] = (earlyPos[p.position] || 0) + 1 })
      const strategyByYear = {}
      years.forEach(yr => { strategyByYear[yr] = classifyStrategy(mp.filter(p => p.season === yr)) })
      return { name: mgr, seasons: years.length, avgRound, avgRoundByN, topR1, earlyPos, strategyByYear, years: years.sort((a, b) => a - b) }
    })
  }, [allPicks])

  const superlatives = useMemo(() => {
    if (!enrichedWithValue.length) return null
    const HIT = new Set(['A+', 'A', 'B+', 'B-'])

    const gradedPicks = enrichedWithValue
      .filter(p => p.fptsRank != null && p.draftPosRank != null)
      .map(p => ({ ...p, delta: p.fptsRank - p.draftPosRank, gl: getPickGradeLabel(p.fptsRank - p.draftPosRank, p.round) }))

    // Per-draft stats
    const draftKeys = [...new Set(gradedPicks.map(p => `${p.manager_name}|||${p.season}`))]
    const draftStats = draftKeys.map(key => {
      const [mgr, yrStr] = key.split('|||'); const yr = parseInt(yrStr)
      const dp = gradedPicks.filter(p => p.manager_name === mgr && p.season === yr)
      if (!dp.length) return null
      const aPlus = dp.filter(p => p.gl === 'A+').length
      const fCount = dp.filter(p => p.gl === 'F').length
      const hits = dp.filter(p => HIT.has(p.gl)).length
      const totalRaw = dp.reduce((s, p) => s + (p.rawValue || 0), 0)
      const vs = enrichedWithValue.filter(p => p.manager_name === mgr && p.season === yr && p.valueScore != null)
      const avgVS = vs.length ? vs.reduce((s, p) => s + p.valueScore, 0) / vs.length : null
      return { mgr, yr, aPlus, fCount, hits, hitRate: hits / dp.length, totalPicks: dp.length, totalRaw, avgVS }
    }).filter(Boolean)

    const withRaw = enrichedWithValue.filter(p => p.rawValue != null)
    const bestPickEver = [...withRaw].sort((a, b) => b.rawValue - a.rawValue)[0] || null
    const bestEarlyPick = [...withRaw].filter(p => p.round <= 4).sort((a, b) => b.rawValue - a.rawValue)[0] || null
    const worstBust = [...withRaw].filter(p => p.round <= 4).sort((a, b) => a.rawValue - b.rawValue)[0] || null
    const bestLatePick = [...withRaw].filter(p => p.round >= 10).sort((a, b) => b.rawValue - a.rawValue)[0] || null

    const mostAplusDraft = [...draftStats].sort((a, b) => b.aPlus - a.aPlus)[0] || null
    const mostFDraft = [...draftStats].sort((a, b) => b.fCount - a.fCount)[0] || null
    const bestSingleDraft = [...draftStats].filter(d => d.avgVS != null).sort((a, b) => b.avgVS - a.avgVS)[0] || null
    const worstSingleDraft = [...draftStats].filter(d => d.avgVS != null).sort((a, b) => a.avgVS - b.avgVS)[0] || null
    const highestHitRate = [...draftStats].filter(d => d.totalPicks >= 5).sort((a, b) => b.hitRate - a.hitRate)[0] || null
    const mostPtsAbove = [...draftStats].sort((a, b) => b.totalRaw - a.totalRaw)[0] || null
    const mostPtsBelow = [...draftStats].sort((a, b) => a.totalRaw - b.totalRaw)[0] || null

    // Per-manager career stats
    const managers = [...new Set(gradedPicks.map(p => p.manager_name))]
    const careerStats = managers.map(mgr => {
      const mp = gradedPicks.filter(p => p.manager_name === mgr)
      const aPlus = mp.filter(p => p.gl === 'A+').length
      const fCount = mp.filter(p => p.gl === 'F').length
      const hits = mp.filter(p => HIT.has(p.gl)).length
      const totalRaw = mp.reduce((s, p) => s + (p.rawValue || 0), 0)
      const vs = enrichedWithValue.filter(p => p.manager_name === mgr && p.valueScore != null)
      const avgVS = vs.length ? vs.reduce((s, p) => s + p.valueScore, 0) / vs.length : null
      const seasons = [...new Set(vs.map(p => p.season))].length
      return { name: mgr, aPlus, fCount, hits, hitRate: mp.length ? hits / mp.length : 0, totalPicks: mp.length, totalRaw, avgVS, seasons }
    }).sort((a, b) => (b.avgVS ?? -Infinity) - (a.avgVS ?? -Infinity))

    // Grade grid (used in trends and success tabs)
    const ws = enrichedWithValue.filter(p => p.valueScore != null)
    const gradeMgrs = [...new Set(ws.map(p => p.manager_name))].sort()
    const gradeSeasons = [...new Set(ws.map(p => p.season))].sort()
    const grades = {}
    gradeSeasons.forEach(yr => {
      grades[yr] = {}
      gradeMgrs.forEach(mgr => {
        const mw = ws.filter(p => p.manager_name === mgr && p.season === yr)
        if (mw.length) grades[yr][mgr] = mw.reduce((s, p) => s + p.valueScore, 0) / mw.length
      })
    })

    // draftSuccessRates kept for Draft Success tab
    const draftSuccessRates = careerStats.map(s => ({
      name: s.name, hitRate: s.hitRate,
      avgValue: s.avgVS ?? 0,
      avgRaw: s.totalPicks ? s.totalRaw / s.totalPicks : 0,
      count: s.totalPicks, hits: s.hits,
    }))

    return {
      bestPickEver, bestEarlyPick, worstBust, bestLatePick,
      mostAplusDraft, mostFDraft, bestSingleDraft, worstSingleDraft, highestHitRate, mostPtsAbove, mostPtsBelow,
      careerStats, gradeData: { seasons: gradeSeasons, managers: gradeMgrs, grades }, draftSuccessRates, draftStats,
    }
  }, [enrichedWithValue])

  const seasonSuperlatives = useMemo(() => {
    if (!selectedYear || !enrichedWithValue.length) return null
    const HIT = new Set(['A+', 'A', 'B+', 'B-'])
    const yp = enrichedWithValue.filter(p => p.season === selectedYear)
    const gp = yp.filter(p => p.fptsRank != null && p.draftPosRank != null)
      .map(p => ({ ...p, gl: getPickGradeLabel(p.fptsRank - p.draftPosRank, p.round) }))
    if (!gp.length) return null
    const mgrs = [...new Set(gp.map(p => p.manager_name))]
    const ms = mgrs.map(mgr => {
      const mp = gp.filter(p => p.manager_name === mgr)
      const aPlus = mp.filter(p => p.gl === 'A+').length
      const fCount = mp.filter(p => p.gl === 'F').length
      const hits = mp.filter(p => HIT.has(p.gl)).length
      const totalRaw = mp.reduce((s, p) => s + (p.rawValue || 0), 0)
      const vs = yp.filter(p => p.manager_name === mgr && p.valueScore != null)
      const avgVS = vs.length ? vs.reduce((s, p) => s + p.valueScore, 0) / vs.length : null
      return { name: mgr, aPlus, fCount, hits, hitRate: mp.length ? hits / mp.length : 0, totalPicks: mp.length, totalRaw, avgVS }
    })
    const wr = yp.filter(p => p.rawValue != null)
    const by = (arr, fn) => [...arr].sort(fn)[0] || null
    return {
      bestDraft:   by(ms.filter(m => m.avgVS != null), (a, b) => b.avgVS - a.avgVS),
      worstDraft:  by(ms.filter(m => m.avgVS != null), (a, b) => a.avgVS - b.avgVS),
      mostAplus:   by(ms, (a, b) => b.aPlus - a.aPlus),
      mostF:       by(ms, (a, b) => b.fCount - a.fCount),
      highestHit:  by(ms.filter(m => m.totalPicks >= 4), (a, b) => b.hitRate - a.hitRate),
      mostAbove:   by(ms, (a, b) => b.totalRaw - a.totalRaw),
      mostBelow:   by(ms, (a, b) => a.totalRaw - b.totalRaw),
      bestPick:    by(wr, (a, b) => b.rawValue - a.rawValue),
      worstPick:   by(wr.filter(p => p.round <= 4), (a, b) => a.rawValue - b.rawValue),
    }
  }, [enrichedWithValue, selectedYear])

  const draftIntel = useMemo(() => {
    if (!enrichedWithValue.length || !allPicks.length) return null
    const skilled = enrichedWithValue.filter(p => SKILL_POS.includes(p.position) && p.rawValue != null)
    const draftKeys = [...new Set(enrichedWithValue.map(p => `${p.manager_name}|||${p.season}`))]

    // 1. Draft grade → wins correlation
    const gradeVsWins = []
    if (superlatives?.gradeData) {
      Object.entries(superlatives.gradeData.grades).forEach(([yr, mgrs]) => {
        Object.entries(mgrs).forEach(([mgr, grade]) => {
          const team = teamByManagerYear[`${mgr.toLowerCase().trim()}_${parseInt(yr)}`]
          if (team) gradeVsWins.push({ mgr, yr: parseInt(yr), grade, wins: team.wins, losses: team.losses, madePlayoffs: team.madePlayoffs })
        })
      })
    }
    let correlation = null
    if (gradeVsWins.length >= 4) {
      const xs = gradeVsWins.map(d => d.grade), ys = gradeVsWins.map(d => d.wins)
      const n = xs.length, mx = xs.reduce((a,b)=>a+b)/n, my = ys.reduce((a,b)=>a+b)/n
      const num = xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)
      const den = Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0)*ys.reduce((s,y)=>s+(y-my)**2,0))
      correlation = den > 0 ? parseFloat((num/den).toFixed(2)) : 0
    }

    // 2. Draft slot ROI
    const slotMap = {}
    skilled.forEach(p => {
      const s = p.pick_in_round; if (s == null) return
      if (!slotMap[s]) slotMap[s] = []
      slotMap[s].push(p.rawValue)
    })
    const slotRoi = Object.entries(slotMap)
      .map(([slot, vals]) => ({ slot: parseInt(slot), avg: vals.reduce((a,b)=>a+b)/vals.length, count: vals.length }))
      .sort((a,b) => a.slot - b.slot)

    // 3. Breakout finder (drafted outside top 20 at pos, finished top 5)
    const breakouts = skilled
      .filter(p => p.draftPosRank != null && p.draftPosRank > 15 && p.fptsRank != null && p.fptsRank <= 5)
      .sort((a,b) => a.fptsRank - b.fptsRank)

    // 4. Manager trajectory (draft grade by year, already in gradeData)
    const trajectory = superlatives?.gradeData ? superlatives.gradeData.managers.map(mgr => ({
      mgr,
      points: superlatives.gradeData.seasons.map(yr => ({ yr, v: superlatives.gradeData.grades[yr]?.[mgr] ?? null })),
    })) : []

    // 5. Carry rate (% of team fpts from top-3 drafted players)
    const carryByDraft = draftKeys.map(key => {
      const [mgr, yrStr] = key.split('|||'); const yr = parseInt(yrStr)
      const dp = enrichedWithValue.filter(p => p.manager_name === mgr && p.season === yr && p.fpts != null)
      if (!dp.length) return null
      const total = dp.reduce((s,p)=>s+p.fpts, 0); if (!total) return null
      const top3 = [...dp].sort((a,b)=>b.fpts-a.fpts).slice(0,3)
      return { mgr, yr, rate: top3.reduce((s,p)=>s+p.fpts,0)/total, topPlayer: top3[0]?.player_name }
    }).filter(Boolean)
    const carryByMgr = {}
    carryByDraft.forEach(d => { if (!carryByMgr[d.mgr]) carryByMgr[d.mgr] = []; carryByMgr[d.mgr].push(d.rate) })
    const carryArr = Object.entries(carryByMgr)
      .map(([mgr, rates]) => ({ mgr, avg: rates.reduce((a,b)=>a+b)/rates.length, seasons: rates.length }))
      .sort((a,b) => b.avg - a.avg)

    // Blended score: 50% pts-vs-slot z-score + 50% actual fpts z-score
    // Corrects the bias where early rds look bad (high bust variance) and
    // late rds look good (low floor = easy to beat slot) by weighting actual impact equally.
    const allSkilledFpts = skilled.filter(p => p.fpts != null).map(p => p.fpts)
    const fptsMu = allSkilledFpts.reduce((a,b)=>a+b,0) / allSkilledFpts.length
    const fptsSig = Math.sqrt(allSkilledFpts.reduce((s,v)=>s+(v-fptsMu)**2,0)/allSkilledFpts.length) || 1
    const blended = p => p.fpts != null ? 0.5 * (p.valueScore ?? 0) + 0.5 * ((p.fpts - fptsMu) / fptsSig) : null

    // 6. Position ROI by round tier
    const posRoiMap = {}
    SKILL_POS.forEach(pos => { posRoiMap[pos] = { early: [], mid: [], late: [] } })
    skilled.forEach(p => {
      const b = blended(p); if (b == null) return
      const tier = p.round <= 4 ? 'early' : p.round <= 9 ? 'mid' : 'late'
      posRoiMap[p.position]?.[tier].push({ b, rawValue: p.rawValue, fpts: p.fpts })
    })
    const posRoi = {}
    SKILL_POS.forEach(pos => {
      posRoi[pos] = {}
      ;['early','mid','late'].forEach(t => {
        const v = posRoiMap[pos][t]
        if (!v.length) { posRoi[pos][t] = null; return }
        posRoi[pos][t] = {
          score: v.reduce((a,c)=>a+c.b,0)/v.length,
          avgRaw: v.reduce((a,c)=>a+c.rawValue,0)/v.length,
          avgFpts: v.reduce((a,c)=>a+c.fpts,0)/v.length,
        }
      })
    })

    // 7. Positional value cliff (blended score by round per position)
    const cliffData = {}
    SKILL_POS.forEach(pos => {
      const byRd = {}
      skilled.filter(p => p.position === pos).forEach(p => {
        const b = blended(p); if (b == null) return
        if (!byRd[p.round]) byRd[p.round] = []
        byRd[p.round].push({ b, rawValue: p.rawValue, fpts: p.fpts })
      })
      cliffData[pos] = Object.entries(byRd)
        .map(([rd, vals]) => ({
          rd: parseInt(rd),
          avg: vals.reduce((a,c)=>a+c.b,0)/vals.length,
          avgRaw: vals.reduce((a,c)=>a+c.rawValue,0)/vals.length,
          avgFpts: vals.reduce((a,c)=>a+c.fpts,0)/vals.length,
          count: vals.length,
        }))
        .sort((a,b) => a.rd - b.rd)
    })

    // 8. NFL team draft value (min 3 picks)
    const nflMap = {}
    skilled.filter(p => p.nfl_team).forEach(p => {
      if (!nflMap[p.nfl_team]) nflMap[p.nfl_team] = []
      nflMap[p.nfl_team].push(p.rawValue)
    })
    const nflArr = Object.entries(nflMap)
      .filter(([,v]) => v.length >= 3)
      .map(([team, vals]) => ({ team, avg: vals.reduce((a,b)=>a+b)/vals.length, count: vals.length }))
      .sort((a,b) => b.avg - a.avg)

    // 9. Sleeper rate (rd 8+, finished top 12 at position)
    const sleeperMap = {}
    skilled.filter(p => p.round >= 8 && p.fptsRank != null && p.fptsRank <= 12).forEach(p => {
      if (!sleeperMap[p.manager_name]) sleeperMap[p.manager_name] = []
      sleeperMap[p.manager_name].push(p)
    })
    const sleeperArr = Object.entries(sleeperMap).map(([mgr, picks]) => {
      const totalLate = skilled.filter(p => p.manager_name === mgr && p.round >= 8).length
      return { mgr, count: picks.length, rate: totalLate ? picks.length/totalLate : 0, totalLate, picks: picks.sort((a,b)=>a.fptsRank-b.fptsRank) }
    }).sort((a,b) => b.count - a.count)

    // 10. Round 1 dependence (avg % of team fpts from rd1 pick)
    const rd1DepMap = {}
    draftKeys.forEach(key => {
      const [mgr, yrStr] = key.split('|||'); const yr = parseInt(yrStr)
      const dp = enrichedWithValue.filter(p => p.manager_name === mgr && p.season === yr && p.fpts != null)
      const rd1 = dp.find(p => p.round === 1)
      const total = dp.reduce((s,p)=>s+p.fpts, 0)
      if (!rd1 || !total) return
      if (!rd1DepMap[mgr]) rd1DepMap[mgr] = []
      rd1DepMap[mgr].push({ rate: rd1.fpts/total, player: rd1.player_name, yr, fpts: rd1.fpts })
    })
    const rd1DepArr = Object.entries(rd1DepMap)
      .map(([mgr, seasons]) => ({ mgr, avg: seasons.reduce((s,d)=>s+d.rate,0)/seasons.length, seasons, count: seasons.length }))
      .sort((a,b) => b.avg - a.avg)

    // 11. Stack ROI (QB + same-team WR in same draft)
    const stackedDrafts = [], unStackedDrafts = []
    draftKeys.forEach(key => {
      const [mgr, yrStr] = key.split('|||'); const yr = parseInt(yrStr)
      const dp = enrichedWithValue.filter(p => p.manager_name === mgr && p.season === yr)
      const qb = dp.find(p => p.position === 'QB')
      if (!qb?.nfl_team) return
      const stackedWRs = dp.filter(p => p.position === 'WR' && p.nfl_team === qb.nfl_team)
      const graded = dp.filter(p => p.rawValue != null)
      if (!graded.length) return
      const avgRaw = graded.reduce((s,p)=>s+p.rawValue,0)/graded.length
      if (stackedWRs.length) stackedDrafts.push({ mgr, yr, avgRaw, qb: qb.player_name, wrs: stackedWRs.map(w=>w.player_name) })
      else unStackedDrafts.push({ mgr, yr, avgRaw })
    })
    const stackAvg = stackedDrafts.length ? stackedDrafts.reduce((s,d)=>s+d.avgRaw,0)/stackedDrafts.length : null
    const noStackAvg = unStackedDrafts.length ? unStackedDrafts.reduce((s,d)=>s+d.avgRaw,0)/unStackedDrafts.length : null

    // 12. Pick #1 all-time
    const pick1s = allPicks.filter(p => p.overall_pick === 1).map(p => {
      const e = enrichedWithValue.find(e => e.manager_name === p.manager_name && e.season === p.season && e.player_name === p.player_name)
      const delta = e?.fptsRank != null && e?.draftPosRank != null ? e.fptsRank - e.draftPosRank : null
      return { ...p, fpts: e?.fpts ?? null, rawValue: e?.rawValue ?? null, fptsRank: e?.fptsRank ?? null, gl: delta != null ? getPickGradeLabel(delta, 1) : null }
    }).sort((a,b) => b.season - a.season)

    return { gradeVsWins, correlation, slotRoi, breakouts, trajectory, carryArr, posRoi, cliffData, nflArr, sleeperArr, rd1DepArr, stackedDrafts, unStackedDrafts, stackAvg, noStackAvg, pick1s }
  }, [enrichedWithValue, allPicks, superlatives, teamByManagerYear])

  if (!mounted) return null

  const hStyle = (a = 'left') => ({ padding: '8px 12px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, textAlign: a, borderBottom: `1px solid ${border}`, whiteSpace: 'nowrap' })
  const cStyle = (a = 'left') => ({ padding: '10px 12px', fontSize: '12px', textAlign: a, borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap' })

  // z-score thresholds with +/− modifiers
  const gradeLabel = (v) => {
    if (v == null) return { label: '—', color: muted }
    if (v > 0.6) return { label: 'A+', color: green }
    if (v > 0.45) return { label: 'A', color: green }
    if (v > 0.35) return { label: 'A-', color: green }
    if (v > 0.25) return { label: 'B+', color: green }
    if (v > 0.15) return { label: 'B', color: green }
    if (v > 0.05) return { label: 'B-', color: green }
    if (v > 0) return { label: 'C+', color: text }
    if (v > -0.05) return { label: 'C', color: text }
    if (v > -0.15) return { label: 'C-', color: text }
    if (v > -0.25) return { label: 'D+', color: red }
    if (v > -0.35) return { label: 'D', color: red }
    if (v > -0.4) return { label: 'D-', color: red }
    return { label: 'F', color: red }
  }

  // delta = eoyPosRank - draftPosRank (negative = outperformed, positive = underperformed)
  const pickGrade = (delta, round) => {
    if (delta == null) return { label: '—', color: muted }
    if (round <= 4) {
      if (delta <= -3) return { label: 'A+', color: green }
      if (delta <= 0) return { label: 'A', color: green }
      if (delta <= 1) return { label: 'B+', color: green }
      if (delta <= 2) return { label: 'B-', color: green }
      if (delta <= 5) return { label: 'C+', color: text }
      if (delta <= 8) return { label: 'C-', color: text }
      if (delta <= 11) return { label: 'D+', color: red }
      if (delta <= 15) return { label: 'D-', color: red }
      return { label: 'F', color: red }
    }
    if (round <= 9) {
      if (delta <= -2) return { label: 'A+', color: green }
      if (delta <= -1) return { label: 'A', color: green }
      if (delta <= 0) return { label: 'B+', color: green }
      if (delta <= 1) return { label: 'B-', color: green }
      if (delta <= 3) return { label: 'C+', color: text }
      if (delta <= 5) return { label: 'C-', color: text }
      if (delta <= 7) return { label: 'D+', color: red }
      if (delta <= 10) return { label: 'D-', color: red }
      return { label: 'F', color: red }
    }
    // Late rounds (10+)
    if (delta <= -5) return { label: 'A+', color: green }
    if (delta <= -3) return { label: 'A', color: green }
    if (delta <= -1) return { label: 'B+', color: green }
    if (delta <= 0) return { label: 'B-', color: green }
    if (delta <= 2) return { label: 'C+', color: text }
    if (delta <= 3) return { label: 'C-', color: text }
    if (delta <= 6) return { label: 'D+', color: red }
    if (delta <= 9) return { label: 'D-', color: red }
    return { label: 'F', color: red }
  }

  const StatCard = ({ label, value, sub, color }) => (
    <div style={{ background: cardBg, padding: '18px 20px', borderTop: `2px solid ${color || border}` }}>
      <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '8px' }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: text, marginBottom: '4px', lineHeight: 1.3 }}>{value || '—'}</div>
      {sub && <div style={{ fontSize: '11px', color: muted, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  )

  const TABS = [['by-year', 'Draft by Year'], ['success', 'Draft Success'], ['trends', 'Manager Trends'], ['records', 'Draft Records'], ['intel', 'Draft Intelligence']]

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px,6vw,72px)', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '4px' }}>Draft History</h1>
        <p style={{ color: muted, fontSize: '13px', marginBottom: '36px' }}>All-time draft archive · 2017–present</p>

        <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, marginBottom: '36px', overflowX: 'auto' }}>
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ background: 'none', border: 'none', borderBottom: tab === key ? `2px solid ${text}` : '2px solid transparent', color: tab === key ? text : muted, padding: '12px 20px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: tab === key ? '600' : '400', whiteSpace: 'nowrap', marginBottom: '-1px' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── DRAFT BY YEAR ── */}
        {tab === 'by-year' && (
          <div>
            {dbSeasons.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} style={{ background: cardBg, border: `1px solid ${border}`, color: text, padding: '8px 16px', fontSize: '14px', fontFamily: "'Playfair Display', serif", cursor: 'pointer', outline: 'none' }}>
                  {dbSeasons.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}
            {picks.length === 0 ? (
              <p style={{ color: muted, padding: '40px 0' }}>No draft data for {selectedYear}.</p>
            ) : (
              <>
                <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                  <table style={{ borderCollapse: 'collapse', minWidth: `${boardManagers.length * 105 + 56}px` }}>
                    <thead>
                      <tr style={{ background: cardBg }}>
                        <th style={{ ...hStyle('center'), minWidth: '44px', position: 'sticky', left: 0, background: cardBg, zIndex: 1 }}>Rd</th>
                        {boardManagers.map(mgr => <th key={mgr} style={{ ...hStyle('center'), minWidth: '105px' }}>{mgr}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rounds.map(round => (
                        <tr key={round} style={{ background: round % 2 === 0 ? (d ? '#090909' : '#e8e4dc') : 'transparent' }}>
                          <td style={{ ...cStyle('center'), color: muted, fontWeight: '700', fontSize: '16px', fontFamily: "'Playfair Display', serif", position: 'sticky', left: 0, background: round % 2 === 0 ? (d ? '#090909' : '#e8e4dc') : bg }}>
                            {round}
                          </td>
                          {boardManagers.map(mgr => {
                            const pick = picks.find(p => p.manager_name === mgr && p.round === round)
                            const pc = pick ? (POS_COLORS[pick.position] || '#888') : 'transparent'
                            return (
                              <td key={mgr} style={{ padding: '4px 5px', borderBottom: `1px solid ${border}`, verticalAlign: 'top' }}>
                                {pick ? (
                                  <div style={{ borderLeft: `3px solid ${pc}`, paddingLeft: '6px', paddingTop: '3px', paddingBottom: '3px' }}>
                                    <div style={{ fontSize: '12px', color: text, lineHeight: 1.3, fontWeight: '700' }}>{pick.player_name}</div>
                                    <div style={{ fontSize: '10px', color: pc, letterSpacing: '0.04em', marginTop: '2px' }}>{pick.position} · {pick.nfl_team}</div>
                                    <div style={{ fontSize: '9px', color: muted, marginTop: '1px' }}>#{pick.overall_pick}</div>
                                  </div>
                                ) : <span style={{ color: muted, fontSize: '11px', padding: '4px 0', display: 'block' }}>—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {Object.entries(POS_COLORS).map(([pos, color]) => (
                    <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '3px', height: '14px', background: color }} />
                      <span style={{ fontSize: '11px', color: muted }}>{pos}</span>
                    </div>
                  ))}
                </div>

                {/* Seasonal superlatives */}
                {seasonSuperlatives && enrichmentReady && (
                  <div style={{ marginTop: '48px', paddingTop: '36px', borderTop: `1px solid ${border}` }}>
                    <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '16px' }}>{selectedYear} Draft Superlatives</p>
                    <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1px', background: border }}>
                      <StatCard label="Best Draft" value={seasonSuperlatives.bestDraft?.name} sub={seasonSuperlatives.bestDraft ? `${gradeLabel(seasonSuperlatives.bestDraft.avgVS).label} · ${(seasonSuperlatives.bestDraft.hitRate * 100).toFixed(0)}% hit rate` : ''} color={green} />
                      <StatCard label="Worst Draft" value={seasonSuperlatives.worstDraft?.name} sub={seasonSuperlatives.worstDraft ? `${gradeLabel(seasonSuperlatives.worstDraft.avgVS).label} · ${(seasonSuperlatives.worstDraft.hitRate * 100).toFixed(0)}% hit rate` : ''} color={red} />
                      <StatCard label="Most A+ Picks" value={seasonSuperlatives.mostAplus?.name} sub={seasonSuperlatives.mostAplus ? `${seasonSuperlatives.mostAplus.aPlus} A+ picks` : ''} color={green} />
                      <StatCard label="Most F Picks" value={seasonSuperlatives.mostF?.name} sub={seasonSuperlatives.mostF ? `${seasonSuperlatives.mostF.fCount} F picks` : ''} color={red} />
                      <StatCard label="Highest Hit Rate" value={seasonSuperlatives.highestHit?.name} sub={seasonSuperlatives.highestHit ? `${(seasonSuperlatives.highestHit.hitRate * 100).toFixed(0)}% B or better` : ''} color={gold} />
                      <StatCard label="Most Pts Above Slot" value={seasonSuperlatives.mostAbove?.name} sub={seasonSuperlatives.mostAbove?.totalRaw > 0 ? `+${seasonSuperlatives.mostAbove.totalRaw.toFixed(1)} pts above expectation` : ''} color={green} />
                      <StatCard label="Most Pts Below Slot" value={seasonSuperlatives.mostBelow?.name} sub={seasonSuperlatives.mostBelow?.totalRaw < 0 ? `${seasonSuperlatives.mostBelow.totalRaw.toFixed(1)} pts below expectation` : ''} color={red} />
                      <StatCard label="Best Pick" value={seasonSuperlatives.bestPick?.player_name} sub={seasonSuperlatives.bestPick ? `${seasonSuperlatives.bestPick.manager_name} · Rd ${seasonSuperlatives.bestPick.round} · +${seasonSuperlatives.bestPick.rawValue.toFixed(1)} pts vs slot` : ''} color={green} />
                      <StatCard label="Biggest Bust (Rds 1–4)" value={seasonSuperlatives.worstPick?.player_name} sub={seasonSuperlatives.worstPick ? `${seasonSuperlatives.worstPick.manager_name} · Rd ${seasonSuperlatives.worstPick.round} · ${seasonSuperlatives.worstPick.rawValue.toFixed(1)} pts vs slot` : ''} color={red} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── DRAFT SUCCESS ── */}
        {tab === 'success' && (
          <div>
            {trendData.length === 0 ? <p style={{ color: muted }}>No data yet.</p> : (
              <>
                {superlatives?.draftSuccessRates?.length > 0 && (
                  <div style={{ marginBottom: '48px' }}>
                    <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '20px' }}>Draft Success Rate — Skill Positions (QB/RB/WR/TE)</p>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                        <thead>
                          <tr style={{ background: cardBg }}>
                            <th style={hStyle()}>Manager</th>
                            <th style={hStyle('center')}>Avg Pts Above/Below Slot</th>
                            <th style={hStyle('center')}>Hit Rate</th>
                            <th style={hStyle('center')}>Picks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {superlatives.draftSuccessRates.map((m, i) => (
                            <tr key={m.name} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                              <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>{m.name}</td>
                              <td style={{ ...cStyle('center'), color: m.avgRaw > 0 ? green : red, fontWeight: '600' }}>
                                {m.avgRaw > 0 ? '+' : ''}{m.avgRaw.toFixed(1)} pts
                              </td>
                              <td style={{ ...cStyle('center'), color: m.hitRate >= 0.5 ? green : red }}>
                                {(m.hitRate * 100).toFixed(0)}% ({m.hits}/{m.count})
                              </td>
                              <td style={{ ...cStyle('center'), color: muted }}>{m.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: '10px', color: muted, marginTop: '8px', lineHeight: 1.6 }}>
                      Avg Pts = actual fpts vs what the player who finished at your pick's positional slot scored that season. Early misses cost more; late finds pay more. Capped pools: top 70 WR/RB, top 32 QB/TE. Hit Rate = % of picks that outscored their draft slot.
                    </p>
                  </div>
                )}

              </>
            )}
          </div>
        )}

        {/* ── MANAGER TRENDS ── */}
        {tab === 'trends' && (
          <div>
            {trendData.length === 0 ? <p style={{ color: muted }}>No data yet.</p> : (
              <>
                {/* Manager picker */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '36px' }}>
                  {trendData.map(m => {
                    const isSelected = selectedManager === m.name
                    return (
                      <button key={m.name} onClick={() => setSelectedManager(isSelected ? null : m.name)} style={{ background: isSelected ? text : 'none', color: isSelected ? bg : muted, border: `1px solid ${isSelected ? text : border}`, padding: '8px 18px', cursor: 'pointer', fontFamily: "'Playfair Display', serif", fontSize: '14px', transition: 'none' }}>
                        {m.name}
                      </button>
                    )
                  })}
                </div>

                {/* Selected manager detail */}
                {selectedManager && (() => {
                  const m = trendData.find(td => td.name === selectedManager)
                  if (!m) return null

                  const stratSummary = {}
                  m.years.forEach(yr => {
                    const tags = m.strategyByYear[yr] || []
                    const grade = superlatives?.gradeData?.grades?.[yr]?.[m.name]
                    tags.forEach(tag => {
                      if (!stratSummary[tag]) stratSummary[tag] = { count: 0, grades: [] }
                      stratSummary[tag].count++
                      if (grade != null) stratSummary[tag].grades.push(grade)
                    })
                  })
                  const stratRows = Object.entries(stratSummary).map(([tag, { count, grades }]) => ({
                    tag, count, avg: grades.length ? grades.reduce((s, v) => s + v, 0) / grades.length : null,
                  })).sort((a, b) => b.count - a.count)

                  const tagChip = (tag) => (
                    <span key={tag} style={{ fontSize: '10px', padding: '2px 7px', background: tag === 'Balanced' ? (d ? '#1a1a1a' : '#e0ddd6') : (d ? '#1a1a2a' : '#e8eaf6'), color: tag === 'Balanced' ? muted : blue, border: `1px solid ${tag === 'Balanced' ? border : blue + '44'}`, letterSpacing: '0.05em' }}>{tag}</span>
                  )

                  return (
                    <div>
                      <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                          <thead>
                            <tr style={{ background: cardBg }}>
                              <th style={hStyle()}>Year</th>
                              <th style={hStyle('center')}>Grade</th>
                              <th style={hStyle()}>Strategies</th>
                              <th style={{ ...hStyle('center'), width: '28px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {m.years.flatMap(yr => {
                              const isOpen = expanded?.manager === m.name && expanded?.year === yr
                              const grade = superlatives?.gradeData?.grades?.[yr]?.[m.name]
                              const { label: gradeStr, color: gradeColor } = gradeLabel(grade)
                              const tags = m.strategyByYear[yr] || []

                              let drawerPicks = []
                              if (isOpen && enrichedWithValue.length) {
                                const mgrPicks = enrichedWithValue.filter(p => p.manager_name === m.name && p.season === yr)
                                const allSeason = enrichedWithValue.filter(p => p.season === yr)
                                const fptsByPos = {}, draftPosByPick = {}
                                SKILL_POS.forEach(pos => {
                                  ;[...allSeason].filter(p => p.position === pos && p.fpts != null).sort((a, b) => b.fpts - a.fpts).forEach((p, i) => { fptsByPos[`${p.playerId ?? '_n_' + normName(p.player_name)}_${pos}`] = i + 1 })
                                  ;[...allSeason].filter(p => p.position === pos).sort((a, b) => a.overall_pick - b.overall_pick).forEach((p, i) => { draftPosByPick[`${p.overall_pick}_${pos}`] = i + 1 })
                                })
                                drawerPicks = [...mgrPicks].sort((a, b) => a.overall_pick - b.overall_pick).map(p => {
                                  const pKey = p.playerId ?? `_n_${normName(p.player_name)}`
                                  const eoyPosRank = SKILL_POS.includes(p.position) ? (fptsByPos[`${pKey}_${p.position}`] ?? null) : null
                                  const draftPosRank = SKILL_POS.includes(p.position) ? (draftPosByPick[`${p.overall_pick}_${p.position}`] ?? null) : null
                                  const delta = eoyPosRank != null && draftPosRank != null ? eoyPosRank - draftPosRank : null
                                  return { ...p, eoyPosRank, draftPosRank, delta }
                                })
                              }

                              const drawerTotalFpts = drawerPicks.filter(p => p.fpts != null).reduce((s, p) => s + p.fpts, 0)
                              const skillDrawerPicks = drawerPicks.filter(p => SKILL_POS.includes(p.position) && p.rawValue != null)
                              const drawerTotalRaw = skillDrawerPicks.reduce((s, p) => s + p.rawValue, 0)
                              const drawerHits = skillDrawerPicks.filter(p => p.rawValue > 0).length
                              const drawerHitRate = skillDrawerPicks.length ? drawerHits / skillDrawerPicks.length : null

                              const yearRow = (
                                <tr key={`yr-${yr}`} onClick={() => setExpanded(isOpen ? null : { manager: m.name, year: yr })} style={{ cursor: 'pointer', background: isOpen ? (d ? '#0d0d0d' : '#f0ede6') : 'transparent' }}>
                                  <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif" }}>
                                    <span style={{ marginRight: '8px' }}>{yr}</span>
                                    <a href={`/season?year=${yr}`} onClick={e => e.stopPropagation()} style={{ fontSize: '9px', color: muted, textDecoration: 'none', letterSpacing: '0.05em', borderBottom: `1px solid ${border}` }} onMouseOver={e => e.currentTarget.style.color=text} onMouseOut={e => e.currentTarget.style.color=muted}>season</a>
                                  </td>
                                  <td style={{ ...cStyle('center'), color: gradeColor, fontWeight: '700', fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>{gradeStr}</td>
                                  <td style={{ ...cStyle(), paddingTop: '8px', paddingBottom: '8px' }}>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{tags.map(tagChip)}</div>
                                  </td>
                                  <td style={{ ...cStyle('center'), color: muted, fontSize: '10px' }}>{isOpen ? '▲' : '▼'}</td>
                                </tr>
                              )

                              const teamPerf = teamByManagerYear[`${m.name.toLowerCase().trim()}_${yr}`] || null

                              if (!isOpen) return [yearRow]

                              const drawerRow = (
                                <tr key={`drawer-${yr}`}>
                                  <td colSpan={4} style={{ padding: 0, borderBottom: `1px solid ${border}` }}>
                                    <div style={{ background: d ? '#080808' : '#f8f5ee' }}>
                                      <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                          <thead>
                                            <tr style={{ background: d ? '#111' : '#edeae3' }}>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>Pick</th>
                                              <th style={{ ...hStyle(), fontSize: '9px' }}>Player</th>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>Pos</th>
                                              <th style={{ ...hStyle('right'), fontSize: '9px' }}>EOY Pts</th>
                                              <th style={{ ...hStyle('right'), fontSize: '9px' }}>Exp Pts</th>
                                              <th style={{ ...hStyle('right'), fontSize: '9px' }}>Pts Δ</th>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>EOY Rank</th>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>Draft Rank</th>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>Rank Δ</th>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>Grade</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {drawerPicks.map(p => {
                                              const pg = pickGrade(p.delta, p.round)
                                              const pc = POS_COLORS[p.position] || muted
                                              const posLabel = (rank, pos) => rank != null ? `${pos}${rank}` : '—'
                                              const ptsColor = p.rawValue != null ? (p.rawValue > 0 ? green : p.rawValue < 0 ? red : text) : muted
                                              return (
                                                <tr key={p.overall_pick}>
                                                  <td style={{ ...cStyle('center'), fontSize: '11px', color: muted }}>#{p.overall_pick}</td>
                                                  <td style={{ ...cStyle(), fontSize: '11px' }}>
                                                    {p.playerId
                                                      ? <a href={`/players/${p.playerId}`} style={{ color: text, textDecoration: 'none' }} onMouseOver={e => e.currentTarget.style.textDecoration='underline'} onMouseOut={e => e.currentTarget.style.textDecoration='none'}>{p.player_name}</a>
                                                      : p.player_name}
                                                  </td>
                                                  <td style={{ ...cStyle('center'), fontSize: '10px', color: pc, fontWeight: '600', letterSpacing: '0.06em' }}>{p.position}</td>
                                                  <td style={{ ...cStyle('right'), fontSize: '11px', color: p.fpts != null ? text : muted }}>{p.fpts != null ? p.fpts.toFixed(1) : '—'}</td>
                                                  <td style={{ ...cStyle('right'), fontSize: '11px', color: muted }}>{p.expectedFpts != null ? p.expectedFpts.toFixed(1) : '—'}</td>
                                                  <td style={{ ...cStyle('right'), fontSize: '11px', fontWeight: p.rawValue != null && p.rawValue !== 0 ? '700' : '400', color: ptsColor }}>
                                                    {p.rawValue != null ? (p.rawValue > 0 ? `+${p.rawValue.toFixed(1)}` : p.rawValue.toFixed(1)) : '—'}
                                                  </td>
                                                  <td style={{ ...cStyle('center'), fontSize: '11px', color: muted }}>{posLabel(p.eoyPosRank, p.position)}</td>
                                                  <td style={{ ...cStyle('center'), fontSize: '11px', color: muted }}>{posLabel(p.draftPosRank, p.position)}</td>
                                                  <td style={{ ...cStyle('center'), fontSize: '11px', fontWeight: p.delta != null && p.delta !== 0 ? '600' : '400', color: p.delta != null ? (p.delta < 0 ? green : p.delta > 0 ? red : text) : muted }}>
                                                    {p.delta != null ? (p.delta > 0 ? `+${p.delta}` : `${p.delta}`) : '—'}
                                                  </td>
                                                  <td style={{ ...cStyle('center'), fontSize: '12px', fontWeight: '700', color: pg.color, fontFamily: "'Playfair Display', serif" }}>{pg.label}</td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                      {/* Draft totals strip */}
                                      <div style={{ padding: '10px 16px', borderTop: `1px solid ${border}`, display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                        <div>
                                          <div style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, marginBottom: '2px' }}>Total EOY Pts</div>
                                          <div style={{ fontSize: '14px', fontWeight: '700', color: text, fontFamily: "'Playfair Display', serif" }}>{drawerTotalFpts.toFixed(1)}</div>
                                        </div>
                                        <div>
                                          <div style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, marginBottom: '2px' }}>Pts vs Slot</div>
                                          <div style={{ fontSize: '14px', fontWeight: '700', color: drawerTotalRaw >= 0 ? green : red, fontFamily: "'Playfair Display', serif" }}>{drawerTotalRaw >= 0 ? '+' : ''}{drawerTotalRaw.toFixed(1)}</div>
                                        </div>
                                        {drawerHitRate != null && (
                                          <div>
                                            <div style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, marginBottom: '2px' }}>Hit Rate</div>
                                            <div style={{ fontSize: '14px', fontWeight: '700', color: drawerHitRate >= 0.5 ? green : red, fontFamily: "'Playfair Display', serif" }}>{(drawerHitRate * 100).toFixed(0)}%</div>
                                          </div>
                                        )}
                                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: '11px', color: muted }}>Draft Grade:</span>
                                          <span style={{ fontSize: '16px', fontWeight: '700', color: gradeColor, fontFamily: "'Playfair Display', serif" }}>{gradeStr}</span>
                                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{tags.map(tagChip)}</div>
                                        </div>
                                      </div>
                                      {/* Team performance strip */}
                                      {teamPerf && (
                                        <div style={{ padding: '10px 16px', borderTop: `1px solid ${border}`, display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
                                          <div style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, marginRight: '4px' }}>Season Result</div>
                                          <div>
                                            <div style={{ fontSize: '9px', color: muted, marginBottom: '2px' }}>Record</div>
                                            <div style={{ fontSize: '14px', fontWeight: '700', color: text, fontFamily: "'Playfair Display', serif" }}>{teamPerf.wins}–{teamPerf.losses}</div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: '9px', color: muted, marginBottom: '2px' }}>Avg PF</div>
                                            <div style={{ fontSize: '14px', fontWeight: '700', color: text, fontFamily: "'Playfair Display', serif" }}>{teamPerf.avgPF.toFixed(1)}</div>
                                          </div>
                                          {teamPerf.powerScore != null && (
                                            <div>
                                              <div style={{ fontSize: '9px', color: muted, marginBottom: '2px' }}>Power Score</div>
                                              <div style={{ fontSize: '14px', fontWeight: '700', color: text, fontFamily: "'Playfair Display', serif" }}>{teamPerf.powerScore.toFixed(1)}</div>
                                            </div>
                                          )}
                                          <div>
                                            <div style={{ fontSize: '9px', color: muted, marginBottom: '2px' }}>Finish</div>
                                            <div style={{ fontSize: '14px', fontWeight: '700', color: teamPerf.madePlayoffs ? green : text, fontFamily: "'Playfair Display', serif" }}>
                                              {teamPerf.playoffResult || (() => { const n = teamPerf.finalStanding; if (!n) return '—'; const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th','st','nd','rd'][Math.min(n % 10, 3)]; return `${n}${s} place` })()}
                                            </div>
                                          </div>
                                          <a href={`/all-time-teams?year=${yr}`} style={{ marginLeft: 'auto', fontSize: '9px', color: muted, textDecoration: 'none', letterSpacing: '0.05em', borderBottom: `1px solid ${border}` }} onMouseOver={e => e.currentTarget.style.color=text} onMouseOut={e => e.currentTarget.style.color=muted}>all-time teams →</a>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )

                              return [yearRow, drawerRow]
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Positional Focus */}
                      {(() => {
                        const selSt = { background: cardBg, border: `1px solid ${border}`, color: text, padding: '4px 8px', fontSize: '12px', cursor: 'pointer', outline: 'none', fontFamily: "'Inter', sans-serif" }
                        const fp = allPicks.filter(p =>
                          p.manager_name === m.name &&
                          p.round >= focusRoundFrom &&
                          p.round <= focusRounds &&
                          (!focusYearFrom || (p.season >= focusYearFrom && p.season <= (focusYearTo ?? Math.max(...dbSeasons))))
                        )
                        const total = fp.length
                        const posCounts = {}
                        fp.forEach(p => { posCounts[p.position] = (posCounts[p.position] || 0) + 1 })
                        const hasPicks = POSITIONS.filter(pos => posCounts[pos])

                        // Pie chart arc computation
                        const pieSize = 200, pieR = pieSize / 2 - 6, pieCx = pieSize / 2, pieCy = pieSize / 2
                        let pieAngle = -Math.PI / 2
                        const arcs = hasPicks.map(pos => {
                          const count = posCounts[pos]
                          const sweep = (count / total) * 2 * Math.PI
                          const sa = pieAngle, ea = pieAngle + sweep
                          pieAngle = ea
                          const x1 = pieCx + pieR * Math.cos(sa), y1 = pieCy + pieR * Math.sin(sa)
                          const x2 = pieCx + pieR * Math.cos(ea), y2 = pieCy + pieR * Math.sin(ea)
                          const large = sweep > Math.PI ? 1 : 0
                          const path = `M${pieCx},${pieCy} L${x1},${y1} A${pieR},${pieR} 0 ${large},1 ${x2},${y2} Z`
                          const ma = sa + sweep / 2
                          const lr = pieR * 0.62
                          return { pos, count, color: POS_COLORS[pos], path, sweep, lx: pieCx + lr * Math.cos(ma), ly: pieCy + lr * Math.sin(ma) }
                        })

                        return (
                          <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: `1px solid ${border}` }}>
                            {/* Controls */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, margin: 0 }}>Positional Focus</p>
                              <span style={{ fontSize: '11px', color: muted }}>Rds</span>
                              <select value={focusRoundFrom} onChange={e => { const v = parseInt(e.target.value); setFocusRoundFrom(v); if (v > focusRounds) setFocusRounds(v) }} style={selSt}>
                                {Array.from({ length: 16 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                              <span style={{ fontSize: '11px', color: muted }}>–</span>
                              <select value={focusRounds} onChange={e => setFocusRounds(parseInt(e.target.value))} style={selSt}>
                                {Array.from({ length: 16 }, (_, i) => i + 1).filter(n => n >= focusRoundFrom).map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                              <span style={{ fontSize: '11px', color: muted, marginLeft: '8px' }}>Years:</span>
                              <select value={focusYearFrom ?? ''} onChange={e => { const v = e.target.value ? parseInt(e.target.value) : null; setFocusYearFrom(v); if (!v) setFocusYearTo(null) }} style={selSt}>
                                <option value="">All</option>
                                {[...dbSeasons].reverse().map(y => <option key={y} value={y}>{y}</option>)}
                              </select>
                              {focusYearFrom && (
                                <>
                                  <span style={{ fontSize: '11px', color: muted }}>–</span>
                                  <select value={focusYearTo ?? ''} onChange={e => setFocusYearTo(e.target.value ? parseInt(e.target.value) : null)} style={selSt}>
                                    <option value="">Latest</option>
                                    {[...dbSeasons].reverse().filter(y => y >= focusYearFrom).map(y => <option key={y} value={y}>{y}</option>)}
                                  </select>
                                </>
                              )}
                            </div>

                            {total === 0 ? <p style={{ color: muted, fontSize: '13px' }}>No picks in this range.</p> : (
                              <>
                                {/* Stacked bar */}
                                <div style={{ display: 'flex', height: '40px', gap: '2px', marginBottom: '28px', overflow: 'hidden' }}>
                                  {hasPicks.map(pos => (
                                    <div key={pos} style={{ flex: posCounts[pos], background: POS_COLORS[pos], display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0, overflow: 'hidden' }}>
                                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#fff', letterSpacing: '0.05em', whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{pos}</span>
                                    </div>
                                  ))}
                                </div>

                                {/* Pie chart + stat cards */}
                                <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '28px' }}>
                                  <div style={{ flexShrink: 0 }}>
                                    <svg width={pieSize} height={pieSize} viewBox={`0 0 ${pieSize} ${pieSize}`}>
                                      {arcs.map(a => (
                                        <g key={a.pos}>
                                          <path d={a.path} fill={a.color} stroke={d ? '#0a0a0a' : '#fff'} strokeWidth="1.5" />
                                          {a.sweep > 0.28 && (
                                            <>
                                              <text x={a.lx} y={a.ly} textAnchor="middle" dominantBaseline="middle" fill="rgba(0,0,0,0.35)" fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif">{a.pos}</text>
                                              <text x={a.lx} y={a.ly} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="12" fontWeight="700" fontFamily="Inter, sans-serif">{a.pos}</text>
                                            </>
                                          )}
                                        </g>
                                      ))}
                                    </svg>
                                    {/* Legend for small slices */}
                                    {arcs.filter(a => a.sweep <= 0.28).map(a => (
                                      <div key={a.pos} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                        <div style={{ width: '10px', height: '10px', background: a.color, flexShrink: 0 }} />
                                        <span style={{ fontSize: '11px', color: muted }}>{a.pos} — {a.count} pick{a.count !== 1 ? 's' : ''}</span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Stat cards */}
                                  <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1px', background: border, alignContent: 'start' }}>
                                    {hasPicks.map(pos => (
                                      <div key={pos} style={{ background: cardBg, padding: '16px 20px' }}>
                                        <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: POS_COLORS[pos], fontWeight: '700', marginBottom: '6px' }}>{pos}</div>
                                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '30px', color: text, lineHeight: 1, marginBottom: '4px' }}>{posCounts[pos]}</div>
                                        <div style={{ fontSize: '11px', color: muted }}>{(posCounts[pos] / total * 100).toFixed(0)}%</div>
                                      </div>
                                    ))}
                                    <div style={{ background: cardBg, padding: '16px 20px' }}>
                                      <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, marginBottom: '6px' }}>Total</div>
                                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '30px', color: text, lineHeight: 1, marginBottom: '4px' }}>{total}</div>
                                      <div style={{ fontSize: '11px', color: muted }}>rds {focusRoundFrom}–{focusRounds}</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Per-round breakdown */}
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                                    <thead>
                                      <tr style={{ background: cardBg }}>
                                        <th style={hStyle()}>Round</th>
                                        {hasPicks.map(pos => <th key={pos} style={{ ...hStyle('center'), color: POS_COLORS[pos] }}>{pos}</th>)}
                                        <th style={hStyle('center')}>Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Array.from({ length: focusRounds - focusRoundFrom + 1 }, (_, i) => focusRoundFrom + i).map((rd, i) => {
                                        const rdPicks = fp.filter(p => p.round === rd)
                                        const rdCounts = {}
                                        rdPicks.forEach(p => { rdCounts[p.position] = (rdCounts[p.position] || 0) + 1 })
                                        return (
                                          <tr key={rd} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                                            <td style={{ ...cStyle(), color: muted }}>Round {rd}</td>
                                            {hasPicks.map(pos => (
                                              <td key={pos} style={{ ...cStyle('center'), color: rdCounts[pos] ? POS_COLORS[pos] : muted, fontWeight: rdCounts[pos] ? '700' : '400', fontSize: rdCounts[pos] ? '14px' : '11px' }}>
                                                {rdCounts[pos] || '—'}
                                              </td>
                                            ))}
                                            <td style={{ ...cStyle('center'), color: muted, fontSize: '11px' }}>{rdPicks.length || '—'}</td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })()}

                      {/* Avg draft round by positional rank */}
                      <div style={{ marginTop: '24px', marginBottom: '24px' }}>
                        <p style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '12px' }}>Avg Draft Round by Positional Pick</p>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                            <thead>
                              <tr style={{ background: cardBg }}>
                                {Object.entries(POS_N).flatMap(([pos, max]) =>
                                  Array.from({ length: max }, (_, i) => (
                                    <th key={`${pos}${i+1}`} style={{ ...hStyle('center'), fontSize: '9px', color: POS_COLORS[pos] }}>{pos}{max > 1 ? i + 1 : ''}</th>
                                  ))
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                {Object.entries(POS_N).flatMap(([pos, max]) =>
                                  Array.from({ length: max }, (_, i) => {
                                    const key = `${pos}${i + 1}`
                                    const r = m.avgRoundByN[key]
                                    const isEarly = r && r <= 5, isLate = r && r >= 12
                                    return (
                                      <td key={key} style={{ ...cStyle('center'), fontSize: '12px', color: r == null ? muted : isEarly ? green : isLate ? red : text, fontWeight: (isEarly || isLate) ? '600' : '400' }}>
                                        {r != null ? `Rd ${r}` : '—'}
                                      </td>
                                    )
                                  })
                                )}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p style={{ fontSize: '10px', color: muted, marginTop: '6px' }}>Avg round across all seasons · green ≤ 5, red ≥ 12</p>
                      </div>

                      {stratRows.length > 0 && (
                        <div>
                          <p style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '8px' }}>Strategy Summary</p>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                              <thead>
                                <tr style={{ background: cardBg }}>
                                  <th style={{ ...hStyle(), fontSize: '9px' }}>Strategy</th>
                                  <th style={{ ...hStyle('center'), fontSize: '9px' }}>Used</th>
                                  <th style={{ ...hStyle('center'), fontSize: '9px' }}>Avg Grade</th>
                                </tr>
                              </thead>
                              <tbody>
                                {stratRows.map((s, i) => {
                                  const { label: gl, color: gc } = gradeLabel(s.avg)
                                  return (
                                    <tr key={s.tag} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                                      <td style={{ ...cStyle(), fontSize: '11px', color: s.tag === 'Balanced' ? muted : blue }}>{s.tag}</td>
                                      <td style={{ ...cStyle('center'), fontSize: '11px', color: muted }}>{s.count}×</td>
                                      <td style={{ ...cStyle('center'), fontSize: '12px', fontWeight: '700', color: gc, fontFamily: "'Playfair Display', serif" }}>{gl}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {!selectedManager && (
                  <p style={{ color: muted, fontSize: '13px' }}>Select a manager above to see their draft history.</p>
                )}

              </>
            )}
          </div>
        )}

        {/* ── DRAFT RECORDS ── */}
        {tab === 'records' && (
          <div>
            {!superlatives ? <p style={{ color: muted }}>No data yet.</p> : (
              <>
                {/* Individual picks */}
                <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '16px' }}>Individual Picks</p>
                <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1px', background: border, marginBottom: '48px' }}>
                  <StatCard label="Best Pick Ever" value={superlatives.bestPickEver?.player_name} sub={superlatives.bestPickEver ? `${superlatives.bestPickEver.manager_name} · ${superlatives.bestPickEver.season} · Rd ${superlatives.bestPickEver.round} · +${superlatives.bestPickEver.rawValue.toFixed(1)} pts vs slot` : ''} color={green} />
                  <StatCard label="Biggest Bust (Rds 1–4)" value={superlatives.worstBust?.player_name} sub={superlatives.worstBust ? `${superlatives.worstBust.manager_name} · ${superlatives.worstBust.season} · Rd ${superlatives.worstBust.round} · ${superlatives.worstBust.rawValue.toFixed(1)} pts vs slot` : ''} color={red} />
                  <StatCard label="Best Early Pick (Rds 1–4)" value={superlatives.bestEarlyPick?.player_name} sub={superlatives.bestEarlyPick ? `${superlatives.bestEarlyPick.manager_name} · ${superlatives.bestEarlyPick.season} · Rd ${superlatives.bestEarlyPick.round} · +${superlatives.bestEarlyPick.rawValue.toFixed(1)} pts` : ''} color={green} />
                  <StatCard label="Best Late Pick (Rd 10+)" value={superlatives.bestLatePick?.player_name} sub={superlatives.bestLatePick ? `${superlatives.bestLatePick.manager_name} · ${superlatives.bestLatePick.season} · Rd ${superlatives.bestLatePick.round} · +${superlatives.bestLatePick.rawValue.toFixed(1)} pts` : ''} color={gold} />
                </div>

                {/* Single draft records */}
                <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '16px' }}>Single Draft Records</p>
                <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1px', background: border, marginBottom: '48px' }}>
                  <StatCard label="Best Draft Grade" value={superlatives.bestSingleDraft ? `${superlatives.bestSingleDraft.mgr} — ${superlatives.bestSingleDraft.yr}` : '—'} sub={superlatives.bestSingleDraft ? `${gradeLabel(superlatives.bestSingleDraft.avgVS).label} · ${(superlatives.bestSingleDraft.hitRate * 100).toFixed(0)}% hit rate` : ''} color={green} />
                  <StatCard label="Worst Draft Grade" value={superlatives.worstSingleDraft ? `${superlatives.worstSingleDraft.mgr} — ${superlatives.worstSingleDraft.yr}` : '—'} sub={superlatives.worstSingleDraft ? `${gradeLabel(superlatives.worstSingleDraft.avgVS).label} · ${(superlatives.worstSingleDraft.hitRate * 100).toFixed(0)}% hit rate` : ''} color={red} />
                  <StatCard label="Most A+ Picks — Single Draft" value={superlatives.mostAplusDraft ? `${superlatives.mostAplusDraft.mgr} — ${superlatives.mostAplusDraft.yr}` : '—'} sub={superlatives.mostAplusDraft ? `${superlatives.mostAplusDraft.aPlus} A+ picks out of ${superlatives.mostAplusDraft.totalPicks} graded` : ''} color={green} />
                  <StatCard label="Most F Picks — Single Draft" value={superlatives.mostFDraft ? `${superlatives.mostFDraft.mgr} — ${superlatives.mostFDraft.yr}` : '—'} sub={superlatives.mostFDraft ? `${superlatives.mostFDraft.fCount} F picks out of ${superlatives.mostFDraft.totalPicks} graded` : ''} color={red} />
                  <StatCard label="Highest Hit Rate — Single Draft" value={superlatives.highestHitRate ? `${superlatives.highestHitRate.mgr} — ${superlatives.highestHitRate.yr}` : '—'} sub={superlatives.highestHitRate ? `${(superlatives.highestHitRate.hitRate * 100).toFixed(0)}% B or better (${superlatives.highestHitRate.hits}/${superlatives.highestHitRate.totalPicks})` : ''} color={gold} />
                  <StatCard label="Most Pts Above Slot" value={superlatives.mostPtsAbove ? `${superlatives.mostPtsAbove.mgr} — ${superlatives.mostPtsAbove.yr}` : '—'} sub={superlatives.mostPtsAbove ? `+${superlatives.mostPtsAbove.totalRaw.toFixed(1)} pts above expectation` : ''} color={green} />
                  <StatCard label="Most Pts Below Slot" value={superlatives.mostPtsBelow ? `${superlatives.mostPtsBelow.mgr} — ${superlatives.mostPtsBelow.yr}` : '—'} sub={superlatives.mostPtsBelow ? `${superlatives.mostPtsBelow.totalRaw.toFixed(1)} pts below expectation` : ''} color={red} />
                </div>

                {/* Career records */}
                <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '16px' }}>Career Records</p>
                <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1px', background: border, marginBottom: '32px' }}>
                  <StatCard label="Best Career Drafter" value={superlatives.careerStats[0]?.name} sub={superlatives.careerStats[0] ? `${gradeLabel(superlatives.careerStats[0].avgVS).label} avg · ${(superlatives.careerStats[0].hitRate * 100).toFixed(0)}% hit rate` : ''} color={gold} />
                  <StatCard label="Worst Career Drafter" value={superlatives.careerStats[superlatives.careerStats.length - 1]?.name} sub={superlatives.careerStats.length ? `${gradeLabel(superlatives.careerStats[superlatives.careerStats.length - 1].avgVS).label} avg · ${(superlatives.careerStats[superlatives.careerStats.length - 1].hitRate * 100).toFixed(0)}% hit rate` : ''} color={red} />
                  <StatCard label="Most A+ Picks All-Time" value={superlatives.careerStats.slice().sort((a, b) => b.aPlus - a.aPlus)[0]?.name} sub={`${superlatives.careerStats.slice().sort((a, b) => b.aPlus - a.aPlus)[0]?.aPlus ?? 0} A+ picks all-time`} color={green} />
                  <StatCard label="Most F Picks All-Time" value={superlatives.careerStats.slice().sort((a, b) => b.fCount - a.fCount)[0]?.name} sub={`${superlatives.careerStats.slice().sort((a, b) => b.fCount - a.fCount)[0]?.fCount ?? 0} F picks all-time`} color={red} />
                </div>

                {/* Career table */}
                <div style={{ overflowX: 'auto', marginBottom: '48px' }}>
                  <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                    <thead>
                      <tr style={{ background: cardBg }}>
                        <th style={hStyle()}>Manager</th>
                        <th style={hStyle('center')}>Avg Grade</th>
                        <th style={hStyle('center')}>A+</th>
                        <th style={hStyle('center')}>F</th>
                        <th style={hStyle('center')}>Hit Rate</th>
                        <th style={hStyle('right')}>Pts vs Slot</th>
                        <th style={hStyle('center')}>Seasons</th>
                      </tr>
                    </thead>
                    <tbody>
                      {superlatives.careerStats.map((s, i) => {
                        const { label: gl, color: gc } = gradeLabel(s.avgVS)
                        return (
                          <tr key={s.name} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                            <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>{s.name}</td>
                            <td style={{ ...cStyle('center'), color: gc, fontWeight: '700', fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>{gl}</td>
                            <td style={{ ...cStyle('center'), color: s.aPlus > 0 ? green : muted }}>{s.aPlus}</td>
                            <td style={{ ...cStyle('center'), color: s.fCount > 0 ? red : muted }}>{s.fCount}</td>
                            <td style={{ ...cStyle('center'), color: s.hitRate >= 0.5 ? green : red }}>{(s.hitRate * 100).toFixed(0)}%</td>
                            <td style={{ ...cStyle('right'), color: s.totalRaw >= 0 ? green : red, fontWeight: '600' }}>{s.totalRaw >= 0 ? '+' : ''}{s.totalRaw.toFixed(0)}</td>
                            <td style={{ ...cStyle('center'), color: muted }}>{s.seasons}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Draft grade grid */}
                {superlatives.gradeData && (
                  <div>
                    <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '20px' }}>Draft Grade by Season</p>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                        <thead>
                          <tr style={{ background: cardBg }}>
                            <th style={{ padding: '8px 14px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, textAlign: 'left', borderBottom: `1px solid ${border}`, whiteSpace: 'nowrap' }}>Season</th>
                            {superlatives.gradeData.managers.map(mgr => (
                              <th key={mgr} style={{ padding: '8px 14px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, textAlign: 'center', borderBottom: `1px solid ${border}`, whiteSpace: 'nowrap' }}>{mgr}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {superlatives.gradeData.seasons.map((yr, i) => (
                            <tr key={yr} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                              <td style={{ padding: '10px 14px', fontSize: '12px', color: muted, borderBottom: `1px solid ${border}`, whiteSpace: 'nowrap', fontFamily: "'Playfair Display', serif" }}>{yr}</td>
                              {superlatives.gradeData.managers.map(mgr => {
                                const val = superlatives.gradeData.grades[yr]?.[mgr]
                                const { label, color } = gradeLabel(val)
                                return (
                                  <td key={mgr} style={{ padding: '10px 14px', textAlign: 'center', borderBottom: `1px solid ${border}`, whiteSpace: 'nowrap' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color, fontFamily: "'Playfair Display', serif" }} title={val != null ? `z=${val.toFixed(2)}` : ''}>{label}</span>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: '10px', color: muted, marginTop: '8px' }}>Grade based on avg pick value z-score · hover for exact score</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {/* ── DRAFT INTELLIGENCE ── */}
        {tab === 'intel' && (
          <div>
            {!draftIntel ? <p style={{ color: muted }}>Loading…</p> : (() => {
              const Section = ({ title, children, mb = 48 }) => (
                <div style={{ marginBottom: mb }}>
                  <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '16px' }}>{title}</p>
                  {children}
                </div>
              )
              const ptsColor = v => v == null ? muted : v > 0 ? green : v < 0 ? red : text
              const fmtPts = v => v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(1)

              return (
                <>
                  {/* 1. Draft grade → wins correlation */}
                  <Section title="Draft Grade vs Wins Correlation">
                    <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr' : '200px 1fr', gap: '24px', alignItems: 'start' }}>
                      <div style={{ background: cardBg, padding: '20px', borderTop: `2px solid ${draftIntel.correlation > 0.3 ? green : draftIntel.correlation < 0 ? red : gold}` }}>
                        <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '8px' }}>Correlation (r)</div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '36px', color: draftIntel.correlation > 0.3 ? green : draftIntel.correlation < 0 ? red : text }}>
                          {draftIntel.correlation != null ? draftIntel.correlation.toFixed(2) : '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: muted, marginTop: '6px' }}>
                          {draftIntel.correlation > 0.5 ? 'Strong positive — drafting well predicts wins' : draftIntel.correlation > 0.2 ? 'Moderate — some signal' : draftIntel.correlation > 0 ? 'Weak — mostly noise' : 'Negative — luck dominates'}
                        </div>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}`, width: '100%' }}>
                          <thead><tr style={{ background: cardBg }}>
                            <th style={hStyle()}>Manager</th>
                            <th style={hStyle('center')}>Year</th>
                            <th style={hStyle('center')}>Draft Grade</th>
                            <th style={hStyle('center')}>Record</th>
                            <th style={hStyle('center')}>Playoffs</th>
                            <th style={{ ...hStyle('center'), width: '28px' }}></th>
                          </tr></thead>
                          <tbody>
                            {[...draftIntel.gradeVsWins].sort((a,b) => b.grade - a.grade).flatMap((gw, i) => {
                              const { label: gl, color: gc } = gradeLabel(gw.grade)
                              const isOpen = intelExpanded?.mgr === gw.mgr && intelExpanded?.yr === gw.yr
                              const rowKey = `${gw.mgr}${gw.yr}`

                              const mainRow = (
                                <tr key={rowKey} onClick={() => setIntelExpanded(isOpen ? null : { mgr: gw.mgr, yr: gw.yr })} style={{ cursor: 'pointer', background: isOpen ? (d ? '#0d0d0d' : '#f0ede6') : i % 2 === 0 ? 'transparent' : rowAlt }}>
                                  <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif" }}>{gw.mgr}</td>
                                  <td style={{ ...cStyle('center'), color: muted }}>{gw.yr}</td>
                                  <td style={{ ...cStyle('center'), color: gc, fontWeight: '700', fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>{gl}</td>
                                  <td style={{ ...cStyle('center') }}>{gw.wins}–{gw.losses}</td>
                                  <td style={{ ...cStyle('center'), color: gw.madePlayoffs ? green : muted, fontSize: '11px' }}>{gw.madePlayoffs ? '✓' : '—'}</td>
                                  <td style={{ ...cStyle('center'), color: muted, fontSize: '10px' }}>{isOpen ? '▲' : '▼'}</td>
                                </tr>
                              )

                              if (!isOpen) return [mainRow]

                              // Build drawer picks (same logic as Manager Trends drawer)
                              const mgrPicks = enrichedWithValue.filter(p => p.manager_name === gw.mgr && p.season === gw.yr)
                              const allSeason = enrichedWithValue.filter(p => p.season === gw.yr)
                              const fptsByPos = {}, draftPosByPick = {}
                              SKILL_POS.forEach(pos => {
                                ;[...allSeason].filter(p => p.position === pos && p.fpts != null).sort((a,b) => b.fpts - a.fpts).forEach((p, idx) => { fptsByPos[`${p.playerId ?? '_n_' + normName(p.player_name)}_${pos}`] = idx + 1 })
                                ;[...allSeason].filter(p => p.position === pos).sort((a,b) => a.overall_pick - b.overall_pick).forEach((p, idx) => { draftPosByPick[`${p.overall_pick}_${pos}`] = idx + 1 })
                              })
                              const drawerPicks = [...mgrPicks].sort((a,b) => a.overall_pick - b.overall_pick).map(p => {
                                const pKey = p.playerId ?? `_n_${normName(p.player_name)}`
                                const eoyPosRank = SKILL_POS.includes(p.position) ? (fptsByPos[`${pKey}_${p.position}`] ?? null) : null
                                const draftPosRank = SKILL_POS.includes(p.position) ? (draftPosByPick[`${p.overall_pick}_${p.position}`] ?? null) : null
                                const delta = eoyPosRank != null && draftPosRank != null ? eoyPosRank - draftPosRank : null
                                return { ...p, eoyPosRank, draftPosRank, delta }
                              })
                              const drawerTotalFpts = drawerPicks.filter(p => p.fpts != null).reduce((s,p) => s + p.fpts, 0)
                              const skillDrawerPicks = drawerPicks.filter(p => SKILL_POS.includes(p.position) && p.rawValue != null)
                              const drawerTotalRaw = skillDrawerPicks.reduce((s,p) => s + p.rawValue, 0)
                              const drawerHits = skillDrawerPicks.filter(p => p.rawValue > 0).length
                              const drawerHitRate = skillDrawerPicks.length ? drawerHits / skillDrawerPicks.length : null
                              const teamPerf = teamByManagerYear[`${gw.mgr.toLowerCase().trim()}_${gw.yr}`] || null
                              const tags = trendData.find(td => td.name === gw.mgr)?.strategyByYear?.[gw.yr] || []
                              const tagChipI = (tag) => (
                                <span key={tag} style={{ fontSize: '10px', padding: '2px 7px', background: tag === 'Balanced' ? (d ? '#1a1a1a' : '#e0ddd6') : (d ? '#1a1a2a' : '#e8eaf6'), color: tag === 'Balanced' ? muted : blue, border: `1px solid ${tag === 'Balanced' ? border : blue + '44'}`, letterSpacing: '0.05em' }}>{tag}</span>
                              )

                              const drawerRow = (
                                <tr key={`${rowKey}-drawer`}>
                                  <td colSpan={6} style={{ padding: 0, borderBottom: `1px solid ${border}` }}>
                                    <div style={{ background: d ? '#080808' : '#f8f5ee' }}>
                                      <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                          <thead>
                                            <tr style={{ background: d ? '#111' : '#edeae3' }}>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>Pick</th>
                                              <th style={{ ...hStyle(), fontSize: '9px' }}>Player</th>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>Pos</th>
                                              <th style={{ ...hStyle('right'), fontSize: '9px' }}>EOY Pts</th>
                                              <th style={{ ...hStyle('right'), fontSize: '9px' }}>Exp Pts</th>
                                              <th style={{ ...hStyle('right'), fontSize: '9px' }}>Pts Δ</th>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>EOY Rank</th>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>Draft Rank</th>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>Rank Δ</th>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>Grade</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {drawerPicks.map(p => {
                                              const pg = pickGrade(p.delta, p.round)
                                              const pc = POS_COLORS[p.position] || muted
                                              const posLabel = (rank, pos) => rank != null ? `${pos}${rank}` : '—'
                                              const ptsC = p.rawValue != null ? (p.rawValue > 0 ? green : p.rawValue < 0 ? red : text) : muted
                                              return (
                                                <tr key={p.overall_pick}>
                                                  <td style={{ ...cStyle('center'), fontSize: '11px', color: muted }}>#{p.overall_pick}</td>
                                                  <td style={{ ...cStyle(), fontSize: '11px' }}>
                                                    {p.playerId ? <a href={`/players/${p.playerId}`} style={{ color: text, textDecoration: 'none' }} onMouseOver={e=>e.currentTarget.style.textDecoration='underline'} onMouseOut={e=>e.currentTarget.style.textDecoration='none'}>{p.player_name}</a> : p.player_name}
                                                  </td>
                                                  <td style={{ ...cStyle('center'), fontSize: '10px', color: pc, fontWeight: '600', letterSpacing: '0.06em' }}>{p.position}</td>
                                                  <td style={{ ...cStyle('right'), fontSize: '11px', color: p.fpts != null ? text : muted }}>{p.fpts != null ? p.fpts.toFixed(1) : '—'}</td>
                                                  <td style={{ ...cStyle('right'), fontSize: '11px', color: muted }}>{p.expectedFpts != null ? p.expectedFpts.toFixed(1) : '—'}</td>
                                                  <td style={{ ...cStyle('right'), fontSize: '11px', fontWeight: p.rawValue != null && p.rawValue !== 0 ? '700' : '400', color: ptsC }}>
                                                    {p.rawValue != null ? (p.rawValue > 0 ? `+${p.rawValue.toFixed(1)}` : p.rawValue.toFixed(1)) : '—'}
                                                  </td>
                                                  <td style={{ ...cStyle('center'), fontSize: '11px', color: muted }}>{posLabel(p.eoyPosRank, p.position)}</td>
                                                  <td style={{ ...cStyle('center'), fontSize: '11px', color: muted }}>{posLabel(p.draftPosRank, p.position)}</td>
                                                  <td style={{ ...cStyle('center'), fontSize: '11px', fontWeight: p.delta != null && p.delta !== 0 ? '600' : '400', color: p.delta != null ? (p.delta < 0 ? green : p.delta > 0 ? red : text) : muted }}>
                                                    {p.delta != null ? (p.delta > 0 ? `+${p.delta}` : `${p.delta}`) : '—'}
                                                  </td>
                                                  <td style={{ ...cStyle('center'), fontSize: '12px', fontWeight: '700', color: pg.color, fontFamily: "'Playfair Display', serif" }}>{pg.label}</td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                      <div style={{ padding: '10px 16px', borderTop: `1px solid ${border}`, display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                        <div>
                                          <div style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, marginBottom: '2px' }}>Total EOY Pts</div>
                                          <div style={{ fontSize: '14px', fontWeight: '700', color: text, fontFamily: "'Playfair Display', serif" }}>{drawerTotalFpts.toFixed(1)}</div>
                                        </div>
                                        <div>
                                          <div style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, marginBottom: '2px' }}>Pts vs Slot</div>
                                          <div style={{ fontSize: '14px', fontWeight: '700', color: drawerTotalRaw >= 0 ? green : red, fontFamily: "'Playfair Display', serif" }}>{drawerTotalRaw >= 0 ? '+' : ''}{drawerTotalRaw.toFixed(1)}</div>
                                        </div>
                                        {drawerHitRate != null && (
                                          <div>
                                            <div style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, marginBottom: '2px' }}>Hit Rate</div>
                                            <div style={{ fontSize: '14px', fontWeight: '700', color: drawerHitRate >= 0.5 ? green : red, fontFamily: "'Playfair Display', serif" }}>{(drawerHitRate * 100).toFixed(0)}%</div>
                                          </div>
                                        )}
                                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: '11px', color: muted }}>Draft Grade:</span>
                                          <span style={{ fontSize: '16px', fontWeight: '700', color: gc, fontFamily: "'Playfair Display', serif" }}>{gl}</span>
                                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{tags.map(tagChipI)}</div>
                                        </div>
                                      </div>
                                      {teamPerf && (
                                        <div style={{ padding: '10px 16px', borderTop: `1px solid ${border}`, display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
                                          <div style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, marginRight: '4px' }}>Season Result</div>
                                          <div><div style={{ fontSize: '9px', color: muted, marginBottom: '2px' }}>Record</div><div style={{ fontSize: '14px', fontWeight: '700', color: text, fontFamily: "'Playfair Display', serif" }}>{teamPerf.wins}–{teamPerf.losses}</div></div>
                                          <div><div style={{ fontSize: '9px', color: muted, marginBottom: '2px' }}>Avg PF</div><div style={{ fontSize: '14px', fontWeight: '700', color: text, fontFamily: "'Playfair Display', serif" }}>{teamPerf.avgPF.toFixed(1)}</div></div>
                                          {teamPerf.powerScore != null && <div><div style={{ fontSize: '9px', color: muted, marginBottom: '2px' }}>Power Score</div><div style={{ fontSize: '14px', fontWeight: '700', color: text, fontFamily: "'Playfair Display', serif" }}>{teamPerf.powerScore.toFixed(1)}</div></div>}
                                          <div><div style={{ fontSize: '9px', color: muted, marginBottom: '2px' }}>Finish</div><div style={{ fontSize: '14px', fontWeight: '700', color: teamPerf.madePlayoffs ? green : text, fontFamily: "'Playfair Display', serif" }}>{teamPerf.playoffResult || (() => { const n = teamPerf.finalStanding; if (!n) return '—'; const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th','st','nd','rd'][Math.min(n % 10, 3)]; return `${n}${s} place` })()}</div></div>
                                          <a href={`/all-time-teams?year=${gw.yr}`} style={{ marginLeft: 'auto', fontSize: '9px', color: muted, textDecoration: 'none', letterSpacing: '0.05em', borderBottom: `1px solid ${border}` }} onMouseOver={e=>e.currentTarget.style.color=text} onMouseOut={e=>e.currentTarget.style.color=muted}>all-time teams →</a>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )

                              return [mainRow, drawerRow]
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </Section>

                  {/* 2. Draft slot ROI */}
                  <Section title="Draft Slot ROI — Avg Pts vs Slot by Pick Number">
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                        <thead><tr style={{ background: cardBg }}>
                          {draftIntel.slotRoi.map(s => <th key={s.slot} style={hStyle('center')}>#{s.slot}</th>)}
                        </tr></thead>
                        <tbody><tr>
                          {draftIntel.slotRoi.map(s => (
                            <td key={s.slot} style={{ ...cStyle('center'), color: ptsColor(s.avg), fontWeight: '600' }}>
                              {fmtPts(s.avg)}
                              <div style={{ fontSize: '10px', color: muted, fontWeight: '400' }}>{s.count} picks</div>
                            </td>
                          ))}
                        </tr></tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: '10px', color: muted, marginTop: '8px' }}>Avg pts above/below slot expectation for each draft position within a round · snake draft normalizes pick order</p>
                  </Section>

                  {/* 3. Breakout finder */}
                  <Section title="Breakout Finder — Drafted Outside Top 15, Finished Top 5">
                    {draftIntel.breakouts.length === 0 ? <p style={{ color: muted, fontSize: '13px' }}>No breakouts found.</p> : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}`, width: '100%' }}>
                          <thead><tr style={{ background: cardBg }}>
                            <th style={hStyle()}>Player</th>
                            <th style={hStyle('center')}>Pos</th>
                            <th style={hStyle()}>Manager</th>
                            <th style={hStyle('center')}>Year</th>
                            <th style={hStyle('center')}>Rd</th>
                            <th style={hStyle('center')}>Draft Rank</th>
                            <th style={hStyle('center')}>EOY Rank</th>
                            <th style={hStyle('right')}>Pts vs Slot</th>
                          </tr></thead>
                          <tbody>
                            {draftIntel.breakouts.map((p, i) => (
                              <tr key={`${p.player_name}${p.season}`} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                                <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif" }}>
                                  {p.playerId ? <a href={`/players/${p.playerId}`} style={{ color: text, textDecoration: 'none' }} onMouseOver={e=>e.currentTarget.style.textDecoration='underline'} onMouseOut={e=>e.currentTarget.style.textDecoration='none'}>{p.player_name}</a> : p.player_name}
                                </td>
                                <td style={{ ...cStyle('center'), color: POS_COLORS[p.position], fontWeight: '600', fontSize: '11px' }}>{p.position}</td>
                                <td style={cStyle()}>{p.manager_name}</td>
                                <td style={{ ...cStyle('center'), color: muted }}>{p.season}</td>
                                <td style={{ ...cStyle('center'), color: muted }}>{p.round}</td>
                                <td style={{ ...cStyle('center'), color: muted }}>{p.position}{p.draftPosRank}</td>
                                <td style={{ ...cStyle('center'), color: green, fontWeight: '700' }}>{p.position}{p.fptsRank}</td>
                                <td style={{ ...cStyle('right'), color: green, fontWeight: '600' }}>+{p.rawValue.toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Section>

                  {/* 4. Manager trajectory */}
                  <Section title="Manager Trajectory — Draft Grade Year over Year">
                    <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1px', background: border }}>
                      {draftIntel.trajectory.map(({ mgr, points }) => {
                        const valid = points.filter(p => p.v != null)
                        if (!valid.length) return null
                        const first = valid[0].v, last = valid[valid.length - 1].v
                        const trend = last - first
                        return (
                          <div key={mgr} style={{ background: cardBg, padding: '16px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: text }}>{mgr}</span>
                              <span style={{ fontSize: '11px', color: trend > 0.05 ? green : trend < -0.05 ? red : muted }}>
                                {trend > 0.05 ? '↑ Improving' : trend < -0.05 ? '↓ Declining' : '→ Stable'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                              {points.map(({ yr, v }) => {
                                const { label: gl, color: gc } = gradeLabel(v)
                                return (
                                  <div key={yr} style={{ textAlign: 'center', minWidth: '32px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: gc, fontFamily: "'Playfair Display', serif" }}>{gl}</div>
                                    <div style={{ fontSize: '9px', color: muted, marginTop: '2px' }}>{String(yr).slice(2)}</div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Section>

                  {/* 5. Carry rate */}
                  <Section title="Carry Rate — Avg % of Team Pts from Top 3 Drafted Players">
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}`, width: '100%' }}>
                        <thead><tr style={{ background: cardBg }}>
                          <th style={hStyle()}>Manager</th>
                          <th style={hStyle('center')}>Avg Carry Rate</th>
                          <th style={hStyle('center')}>Seasons</th>
                        </tr></thead>
                        <tbody>
                          {draftIntel.carryArr.map((s, i) => (
                            <tr key={s.mgr} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                              <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>{s.mgr}</td>
                              <td style={{ ...cStyle('center'), fontWeight: '700', fontFamily: "'Playfair Display', serif", fontSize: '14px', color: s.avg > 0.55 ? red : s.avg < 0.45 ? green : text }}>
                                {(s.avg * 100).toFixed(0)}%
                              </td>
                              <td style={{ ...cStyle('center'), color: muted }}>{s.seasons}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: '10px', color: muted, marginTop: '8px' }}>High % = star-dependent · Low % = balanced depth</p>
                  </Section>

                  {/* 6. Position ROI by round tier */}
                  <Section title="Position ROI by Round Tier — Blended Value Score">
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                        <thead><tr style={{ background: cardBg }}>
                          <th style={hStyle()}>Position</th>
                          <th style={{ ...hStyle('center'), color: text }}>Early (Rds 1–4)</th>
                          <th style={{ ...hStyle('center'), color: muted }}>Mid (Rds 5–9)</th>
                          <th style={{ ...hStyle('center'), color: muted }}>Late (Rd 10+)</th>
                        </tr></thead>
                        <tbody>
                          {SKILL_POS.map((pos, i) => (
                            <tr key={pos} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                              <td style={{ ...cStyle(), color: POS_COLORS[pos], fontWeight: '600', letterSpacing: '0.06em' }}>{pos}</td>
                              {['early','mid','late'].map(t => {
                                const cell = draftIntel.posRoi[pos][t]
                                const sc = cell?.score ?? null
                                return (
                                  <td key={t} style={{ ...cStyle('center'), color: ptsColor(sc), fontWeight: '600' }}>
                                    <div>{sc != null ? (sc >= 0 ? '+' : '') + sc.toFixed(2) : '—'}</div>
                                    {cell?.avgFpts != null && <div style={{ fontSize: '10px', color: muted, fontWeight: '400', marginTop: '2px' }}>{cell.avgFpts.toFixed(0)} pts avg</div>}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: '10px', color: muted, marginTop: '8px' }}>Score = z-score blend of pts vs slot (50%) + avg fpts scored (50%) · positive = good round tier for this position</p>
                  </Section>

                  {/* 7. Positional value cliff */}
                  <Section title="Positional Value Cliff — Blended Value Score by Round">
                    <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '1px', background: border }}>
                      {SKILL_POS.map(pos => (
                        <div key={pos} style={{ background: cardBg, padding: '14px 16px' }}>
                          <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: POS_COLORS[pos], marginBottom: '10px', fontWeight: '700' }}>{pos}</div>
                          {draftIntel.cliffData[pos].map(({ rd, avg, avgFpts, count }) => (
                            <div key={rd} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                              <span style={{ fontSize: '10px', color: muted, minWidth: '36px' }}>Rd {rd}</span>
                              <div style={{ flex: 1, height: '4px', background: border, margin: '0 8px', position: 'relative' }}>
                                {avg !== 0 && <div style={{ position: 'absolute', top: 0, width: `${Math.min(Math.abs(avg) / 1.5 * 100, 100)}%`, height: '100%', background: avg > 0 ? green : red, [avg > 0 ? 'left' : 'right']: 0 }} />}
                              </div>
                              <div style={{ minWidth: '52px', textAlign: 'right' }}>
                                <div style={{ fontSize: '10px', color: ptsColor(avg), fontWeight: '600' }}>{avg >= 0 ? '+' : ''}{avg.toFixed(2)}</div>
                                <div style={{ fontSize: '9px', color: muted }}>{avgFpts?.toFixed(0)} pts</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: '10px', color: muted, marginTop: '10px' }}>Score = z-score blend of pts vs slot (50%) + avg fpts scored (50%) · captures both value efficiency and real impact</p>
                  </Section>

                  {/* 8. NFL team draft value */}
                  <Section title="NFL Team Draft Value — Avg Pts vs Slot (min 3 picks)">
                    <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr 1fr' : '1fr 1fr', gap: '24px' }}>
                      <div>
                        <p style={{ fontSize: '10px', color: green, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>Best to Draft From</p>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}`, width: '100%' }}>
                            <thead><tr style={{ background: cardBg }}>
                              <th style={hStyle()}>Team</th><th style={hStyle('right')}>Avg vs Slot</th><th style={hStyle('center')}>Picks</th>
                            </tr></thead>
                            <tbody>{draftIntel.nflArr.slice(0, 8).map((t, i) => (
                              <tr key={t.team} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                                <td style={{ ...cStyle(), fontWeight: '600' }}>{t.team}</td>
                                <td style={{ ...cStyle('right'), color: green, fontWeight: '700' }}>+{t.avg.toFixed(1)}</td>
                                <td style={{ ...cStyle('center'), color: muted }}>{t.count}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize: '10px', color: red, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>Avoid Drafting From</p>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}`, width: '100%' }}>
                            <thead><tr style={{ background: cardBg }}>
                              <th style={hStyle()}>Team</th><th style={hStyle('right')}>Avg vs Slot</th><th style={hStyle('center')}>Picks</th>
                            </tr></thead>
                            <tbody>{[...draftIntel.nflArr].reverse().slice(0, 8).map((t, i) => (
                              <tr key={t.team} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                                <td style={{ ...cStyle(), fontWeight: '600' }}>{t.team}</td>
                                <td style={{ ...cStyle('right'), color: red, fontWeight: '700' }}>{t.avg.toFixed(1)}</td>
                                <td style={{ ...cStyle('center'), color: muted }}>{t.count}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </Section>

                  {/* 9. Sleeper rate */}
                  <Section title="Sleeper Rate — Rd 8+ Picks Finishing Top 12 at Position">
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}`, width: '100%' }}>
                        <thead><tr style={{ background: cardBg }}>
                          <th style={hStyle()}>Manager</th>
                          <th style={hStyle('center')}>Sleepers Found</th>
                          <th style={hStyle('center')}>Late Picks</th>
                          <th style={hStyle('center')}>Rate</th>
                          <th style={hStyle()}>Best Late Find</th>
                        </tr></thead>
                        <tbody>
                          {draftIntel.sleeperArr.map((s, i) => (
                            <tr key={s.mgr} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                              <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>{s.mgr}</td>
                              <td style={{ ...cStyle('center'), color: s.count > 0 ? green : muted, fontWeight: '700' }}>{s.count}</td>
                              <td style={{ ...cStyle('center'), color: muted }}>{s.totalLate}</td>
                              <td style={{ ...cStyle('center'), color: s.rate > 0.1 ? green : muted }}>{(s.rate * 100).toFixed(0)}%</td>
                              <td style={{ ...cStyle(), fontSize: '11px', color: muted }}>
                                {s.picks[0] ? `${s.picks[0].player_name} (${s.picks[0].season} · ${s.picks[0].position}${s.picks[0].fptsRank})` : '—'}
                              </td>
                            </tr>
                          ))}
                          {draftIntel.sleeperArr.length === 0 && (
                            <tr><td colSpan={5} style={{ ...cStyle(), color: muted }}>No sleeper picks found (rd 8+ top-12 finishes)</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Section>

                  {/* 10. Round 1 dependence */}
                  <Section title="Round 1 Dependence — Avg % of Season Pts from First Pick">
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}`, width: '100%' }}>
                        <thead><tr style={{ background: cardBg }}>
                          <th style={hStyle()}>Manager</th>
                          <th style={hStyle('center')}>Avg % from Rd 1</th>
                          <th style={hStyle('center')}>Seasons</th>
                          <th style={hStyle()}>Highest Single Year</th>
                        </tr></thead>
                        <tbody>
                          {draftIntel.rd1DepArr.map((s, i) => {
                            const peak = [...s.seasons].sort((a, b) => b.rate - a.rate)[0]
                            return (
                              <tr key={s.mgr} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                                <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>{s.mgr}</td>
                                <td style={{ ...cStyle('center'), fontWeight: '700', fontFamily: "'Playfair Display', serif", fontSize: '14px', color: s.avg > 0.22 ? red : s.avg < 0.14 ? green : text }}>
                                  {(s.avg * 100).toFixed(0)}%
                                </td>
                                <td style={{ ...cStyle('center'), color: muted }}>{s.count}</td>
                                <td style={{ ...cStyle(), fontSize: '11px', color: muted }}>
                                  {peak ? `${peak.player} ${(peak.rate * 100).toFixed(0)}% (${peak.yr})` : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: '10px', color: muted, marginTop: '8px' }}>High % = star-dependent roster · Low % = well-distributed value</p>
                  </Section>

                  {/* 11. Stack ROI */}
                  <Section title="QB–WR Stack ROI">
                    <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '1px', background: border, marginBottom: '24px' }}>
                      <StatCard label="Avg Value — Stacked Drafts" value={draftIntel.stackAvg != null ? fmtPts(draftIntel.stackAvg) + ' pts/pick' : '—'} sub={`${draftIntel.stackedDrafts.length} stacked drafts`} color={ptsColor(draftIntel.stackAvg)} />
                      <StatCard label="Avg Value — Unstacked Drafts" value={draftIntel.noStackAvg != null ? fmtPts(draftIntel.noStackAvg) + ' pts/pick' : '—'} sub={`${draftIntel.unStackedDrafts.length} unstacked drafts`} color={ptsColor(draftIntel.noStackAvg)} />
                      <StatCard
                        label="Stack Edge"
                        value={draftIntel.stackAvg != null && draftIntel.noStackAvg != null ? fmtPts(draftIntel.stackAvg - draftIntel.noStackAvg) + ' pts/pick' : '—'}
                        sub={draftIntel.stackAvg != null && draftIntel.noStackAvg != null ? (draftIntel.stackAvg > draftIntel.noStackAvg ? 'Stacking pays off in this league' : 'No clear stack advantage') : ''}
                        color={draftIntel.stackAvg != null && draftIntel.noStackAvg != null ? ptsColor(draftIntel.stackAvg - draftIntel.noStackAvg) : muted}
                      />
                    </div>
                    {draftIntel.stackedDrafts.length > 0 && (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}`, width: '100%' }}>
                          <thead><tr style={{ background: cardBg }}>
                            <th style={hStyle()}>Manager</th><th style={hStyle('center')}>Year</th><th style={hStyle()}>QB</th><th style={hStyle()}>Stacked WR(s)</th><th style={hStyle('right')}>Avg Pts vs Slot</th>
                          </tr></thead>
                          <tbody>{draftIntel.stackedDrafts.sort((a,b)=>b.avgRaw-a.avgRaw).map((d, i) => (
                            <tr key={`${d.mgr}${d.yr}`} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                              <td style={cStyle()}>{d.mgr}</td>
                              <td style={{ ...cStyle('center'), color: muted }}>{d.yr}</td>
                              <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif" }}>{d.qb}</td>
                              <td style={{ ...cStyle(), color: muted, fontSize: '11px' }}>{d.wrs.join(', ')}</td>
                              <td style={{ ...cStyle('right'), color: ptsColor(d.avgRaw), fontWeight: '600' }}>{fmtPts(d.avgRaw)}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    )}
                  </Section>

                  {/* 12. Pick #1 all-time */}
                  <Section title="Pick #1 All-Time" mb={0}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}`, width: '100%' }}>
                        <thead><tr style={{ background: cardBg }}>
                          <th style={hStyle('center')}>Year</th>
                          <th style={hStyle()}>Player</th>
                          <th style={hStyle('center')}>Pos</th>
                          <th style={hStyle()}>Manager</th>
                          <th style={hStyle('right')}>EOY Pts</th>
                          <th style={hStyle('right')}>Pts vs Slot</th>
                          <th style={hStyle('center')}>EOY Rank</th>
                          <th style={hStyle('center')}>Grade</th>
                        </tr></thead>
                        <tbody>
                          {draftIntel.pick1s.map((p, i) => {
                            const glColor = p.gl ? (p.gl === 'A+' || p.gl === 'A' || p.gl === 'B+' || p.gl === 'B-' ? green : p.gl === 'F' || p.gl === 'D-' || p.gl === 'D+' ? red : text) : muted
                            return (
                              <tr key={p.season} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                                <td style={{ ...cStyle('center'), color: muted }}>{p.season}</td>
                                <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif" }}>
                                  {p.playerId ? <a href={`/players/${p.playerId}`} style={{ color: text, textDecoration: 'none' }} onMouseOver={e=>e.currentTarget.style.textDecoration='underline'} onMouseOut={e=>e.currentTarget.style.textDecoration='none'}>{p.player_name}</a> : p.player_name}
                                </td>
                                <td style={{ ...cStyle('center'), color: POS_COLORS[p.position], fontWeight: '600', fontSize: '11px' }}>{p.position}</td>
                                <td style={cStyle()}>{p.manager_name}</td>
                                <td style={{ ...cStyle('right'), color: p.fpts != null ? text : muted }}>{p.fpts != null ? p.fpts.toFixed(1) : '—'}</td>
                                <td style={{ ...cStyle('right'), color: ptsColor(p.rawValue), fontWeight: '600' }}>{fmtPts(p.rawValue)}</td>
                                <td style={{ ...cStyle('center'), color: muted }}>{p.fptsRank != null ? `${p.position}${p.fptsRank}` : '—'}</td>
                                <td style={{ ...cStyle('center'), color: glColor, fontWeight: '700', fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>{p.gl || '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Section>
                </>
              )
            })()}
          </div>
        )}

      </div>
    </div>
  )
}
