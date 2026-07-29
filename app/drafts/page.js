'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase, LEAGUE_ID } from '../../lib/supabase'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'
export const dynamic = 'force-dynamic'

const POS_COLORS = { QB: '#4285F4', RB: '#34A853', WR: '#FBBC04', TE: '#EA4335', K: '#46BDC6', 'D/ST': '#888888' }
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST']
const SKILL_POS = ['QB', 'RB', 'WR', 'TE']

const classifyStrategy = (picks) => {
  const sorted = [...picks].sort((a, b) => a.overall_pick - b.overall_pick)
  const first3 = sorted.filter(p => p.round <= 3)
  const first5 = sorted.filter(p => p.round <= 5)
  const rd1 = sorted.find(p => p.round === 1)
  const rbIn3 = first3.filter(p => p.position === 'RB').length
  const wrIn3 = first3.filter(p => p.position === 'WR').length
  const rbIn5 = first5.filter(p => p.position === 'RB').length
  const wrIn5 = first5.filter(p => p.position === 'WR').length
  const firstQB = sorted.find(p => p.position === 'QB')
  const firstTE = sorted.find(p => p.position === 'TE')
  const tags = []
  if (rd1?.position === 'RB') tags.push('Hero RB')
  if (rd1?.position === 'WR') tags.push('Hero WR')
  if (rbIn3 >= 2 || rbIn5 >= 3) tags.push('Early RBs')
  if (wrIn3 >= 2 || wrIn5 >= 3) tags.push('Early WRs')
  if (rbIn5 <= 1) tags.push('Zero RB')
  if (wrIn5 <= 1) tags.push('Zero WR')
  if (firstQB?.round <= 4) tags.push('Early QB')
  if (firstTE?.round <= 4) tags.push('Early TE')
  if (firstQB?.round >= 10) tags.push('Late QB')
  if (firstTE?.round >= 10) tags.push('Late TE')
  if (!tags.length) tags.push('Balanced')
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
      const [{ data: players }, { data: teams }] = await Promise.all([
        supabase.from('players').select('id, name').limit(2000),
        supabase.from('teams').select('id, season:season_id(year)').eq('league_id', LEAGUE_ID).limit(200),
      ])
      if (!players || !teams) return
      setPlayerList(players)

      const teamYearMap = {}
      teams.forEach(t => { teamYearMap[t.id] = t.season?.year })

      let allEntries = [], from = 0
      while (true) {
        const { data: batch } = await supabase.from('roster_entries').select('player_id, fpts, team_id').eq('league_id', LEAGUE_ID).range(from, from + 999)
        if (!batch?.length) break
        allEntries = [...allEntries, ...batch]
        if (batch.length < 1000) break
        from += 1000
      }
      const fm = {}
      allEntries.forEach(e => {
        const yr = teamYearMap[e.team_id]
        if (yr && e.player_id) fm[`${e.player_id}_${yr}`] = e.fpts || 0
      })
      setFptsMap(fm)
      setEnrichmentReady(true)
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
      const fpts = pl ? (fptsMap[`${pl.id}_${p.season}`] ?? null) : null
      return { ...p, playerId: pl?.id || null, fpts, matched: !!pl }
    })
  }, [allPicks, playerList, fptsMap, enrichmentReady])

  useEffect(() => {
    if (!enrichedPicks.length) return
    setUnmatchedPicks(enrichedPicks.filter(p => !p.matched && SKILL_POS.includes(p.position)))
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
        const pool = sp.filter(p => p.fpts != null && p.playerId).sort((a, b) => b.fpts - a.fpts).slice(0, CAP[pos])
        fptsByRankArr[`${yr}_${pos}`] = pool.map(p => p.fpts)
        const rankById = {}
        pool.forEach((p, i) => { rankById[p.playerId] = i + 1 })
        fptsRankById[`${yr}_${pos}`] = rankById
      })
    })

    const withRaw = enrichedPicks.map(p => {
      if (!SKILL_POS.includes(p.position)) return { ...p, valueScore: null, rawValue: null, fptsRank: null, draftPosRank: null }
      const pool = fptsByRankArr[`${p.season}_${p.position}`] || []
      const draftPosRank = draftRankMap[`${p.overall_pick}_${p.season}`]
      if (!draftPosRank || !pool.length) return { ...p, valueScore: null, rawValue: null, fptsRank: null, draftPosRank: draftPosRank ?? null }
      const expectedFpts = pool[Math.min(draftPosRank, pool.length) - 1]
      const actualFpts = p.fpts ?? 0
      const fptsRank = p.playerId ? (fptsRankById[`${p.season}_${p.position}`]?.[p.playerId] ?? (p.fpts != null ? pool.length + 1 : null)) : null
      return { ...p, rawValue: actualFpts - expectedFpts, expectedFpts, fptsRank, draftPosRank }
    })

    const allRaw = withRaw.filter(p => p.rawValue != null).map(p => p.rawValue)
    if (!allRaw.length) return withRaw
    const mean = allRaw.reduce((s, v) => s + v, 0) / allRaw.length
    const stddev = Math.sqrt(allRaw.reduce((s, v) => s + (v - mean) ** 2, 0) / allRaw.length)

    return withRaw.map(p =>
      p.rawValue != null ? { ...p, valueScore: stddev > 0 ? (p.rawValue - mean) / stddev : 0 } : p
    )
  }, [enrichedPicks])

  // Board data for selected year
  const picks = useMemo(() => allPicks.filter(p => p.season === selectedYear), [allPicks, selectedYear])
  const boardManagers = useMemo(() => picks.filter(p => p.round === 1).sort((a, b) => a.overall_pick - b.overall_pick).map(p => p.manager_name), [picks])
  const rounds = useMemo(() => [...new Set(picks.map(p => p.round))].sort((a, b) => a - b), [picks])

  // Trends
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
      const r1 = mp.filter(p => p.round === 1)
      const r1c = {}; r1.forEach(p => { r1c[p.position] = (r1c[p.position] || 0) + 1 })
      const topR1 = Object.entries(r1c).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
      const early = mp.filter(p => p.round <= 3)
      const earlyPos = {}; early.forEach(p => { earlyPos[p.position] = (earlyPos[p.position] || 0) + 1 })
      const strategyByYear = {}
      years.forEach(yr => { strategyByYear[yr] = classifyStrategy(mp.filter(p => p.season === yr)) })
      return { name: mgr, seasons: years.length, avgRound, topR1, earlyPos, strategyByYear, years: years.sort((a, b) => a - b) }
    })
  }, [allPicks])

  // Superlatives (draft-data only + performance-based)
  const superlatives = useMemo(() => {
    if (!allPicks.length) return null
    const keys = [...new Set(allPicks.map(p => `${p.manager_name}|||${p.season}`))]

    const earlyQB = [...allPicks].filter(p => p.position === 'QB').sort((a, b) => a.overall_pick - b.overall_pick)[0]
    const earlyTE = [...allPicks].filter(p => p.position === 'TE').sort((a, b) => a.overall_pick - b.overall_pick)[0]
    const latestK = [...allPicks].filter(p => p.position === 'K').sort((a, b) => b.overall_pick - a.overall_pick)[0]
    const earlyDST = [...allPicks].filter(p => p.position === 'D/ST').sort((a, b) => a.overall_pick - b.overall_pick)[0]

    let latestFirstQB = null, mostRBsEarly = null, mostWRsEarly = null
    const zeroRBSeasons = []
    keys.forEach(key => {
      const [mgr, yr] = key.split('|||'); const yrN = parseInt(yr)
      const ms = allPicks.filter(p => p.manager_name === mgr && p.season === yrN)
      const firstQB = ms.filter(p => p.position === 'QB').sort((a, b) => a.overall_pick - b.overall_pick)[0]
      if (firstQB && (!latestFirstQB || firstQB.round > latestFirstQB.round)) latestFirstQB = { ...firstQB, manager_name: mgr, season: yrN }
      const rbE = ms.filter(p => p.round <= 3 && p.position === 'RB').length
      if (!mostRBsEarly || rbE > mostRBsEarly.count) mostRBsEarly = { manager: mgr, season: yrN, count: rbE }
      const wrE = ms.filter(p => p.round <= 3 && p.position === 'WR').length
      if (!mostWRsEarly || wrE > mostWRsEarly.count) mostWRsEarly = { manager: mgr, season: yrN, count: wrE }
      if (rbE === 0) zeroRBSeasons.push({ manager: mgr, season: yrN })
    })

    const playerCount = {}
    allPicks.forEach(p => { playerCount[p.player_name] = (playerCount[p.player_name] || 0) + 1 })
    const mostDrafted = Object.entries(playerCount).sort((a, b) => b[1] - a[1])[0]

    const fastestDST = trendData.filter(m => m.avgRound['D/ST'] != null).sort((a, b) => a.avgRound['D/ST'] - b.avgRound['D/ST'])[0]
    const slowestDST = trendData.filter(m => m.avgRound['D/ST'] != null).sort((a, b) => b.avgRound['D/ST'] - a.avgRound['D/ST'])[0]
    const fastestQB = trendData.filter(m => m.avgRound['QB'] != null).sort((a, b) => a.avgRound['QB'] - b.avgRound['QB'])[0]
    const slowestQB = trendData.filter(m => m.avgRound['QB'] != null).sort((a, b) => b.avgRound['QB'] - a.avgRound['QB'])[0]
    const earlyTEManager = trendData.filter(m => m.avgRound['TE'] != null).sort((a, b) => a.avgRound['TE'] - b.avgRound['TE'])[0]

    // Re-draft favorites — per manager
    const reDraftCount = {}
    allPicks.forEach(p => {
      const key = `${p.manager_name}|||${p.player_name}`
      reDraftCount[key] = (reDraftCount[key] || 0) + 1
    })
    const mgrsAll = [...new Set(allPicks.map(p => p.manager_name))].sort()
    const reDraftByManager = mgrsAll.map(mgr => {
      const picks = Object.entries(reDraftCount).filter(([k]) => k.startsWith(`${mgr}|||`)).sort((a, b) => b[1] - a[1])
      const top = picks[0]
      if (!top || top[1] < 2) return { manager: mgr, player: null, count: 0 }
      return { manager: mgr, player: top[0].split('|||')[1], count: top[1] }
    })

    // Performance-based (needs enrichedWithValue)
    let bestValue = null, biggestBust = null, bestDraftManager = null, worstDraftManager = null, draftSuccessRates = []
    let mostFptsManager = null, bestEarly = null, bestMid = null, bestLate = null, gradeData = null
    if (enrichedWithValue.length) {
      const ws = enrichedWithValue.filter(p => p.valueScore != null)
      bestValue = [...ws].sort((a, b) => b.valueScore - a.valueScore)[0] || null
      biggestBust = [...ws].filter(p => p.round <= 3).sort((a, b) => a.valueScore - b.valueScore)[0] || null
      bestEarly = [...ws].filter(p => p.round <= 4).sort((a, b) => b.valueScore - a.valueScore)[0] || null
      bestMid = [...ws].filter(p => p.round >= 5 && p.round <= 9).sort((a, b) => b.valueScore - a.valueScore)[0] || null
      bestLate = [...ws].filter(p => p.round >= 10).sort((a, b) => b.valueScore - a.valueScore)[0] || null

      const mgrs = [...new Set(ws.map(p => p.manager_name))]
      draftSuccessRates = mgrs.map(mgr => {
        const mp = ws.filter(p => p.manager_name === mgr)
        if (!mp.length) return null
        const hits = mp.filter(p => p.valueScore > 0).length
        const avgValue = mp.reduce((s, p) => s + p.valueScore, 0) / mp.length
        const avgRaw = mp.reduce((s, p) => s + (p.rawValue ?? 0), 0) / mp.length
        return { name: mgr, hitRate: hits / mp.length, avgValue, avgRaw, count: mp.length, hits }
      }).filter(Boolean).sort((a, b) => b.avgValue - a.avgValue)
      bestDraftManager = draftSuccessRates[0] || null
      worstDraftManager = draftSuccessRates[draftSuccessRates.length - 1] || null

      // Most total fpts from drafted players
      const totals = {}
      enrichedWithValue.filter(p => p.fpts != null).forEach(p => { totals[p.manager_name] = (totals[p.manager_name] || 0) + p.fpts })
      const topFpts = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]
      if (topFpts) mostFptsManager = { name: topFpts[0], total: Math.round(topFpts[1]) }

      // Draft grades per manager per season
      const gradeMgrs = [...new Set(ws.map(p => p.manager_name))].sort()
      const gradeSeasons = [...new Set(ws.map(p => p.season))].sort()
      const grades = {}
      gradeSeasons.forEach(yr => {
        grades[yr] = {}
        gradeMgrs.forEach(mgr => {
          const mp = ws.filter(p => p.manager_name === mgr && p.season === yr)
          if (!mp.length) return
          grades[yr][mgr] = mp.reduce((s, p) => s + p.valueScore, 0) / mp.length
        })
      })
      gradeData = { seasons: gradeSeasons, managers: gradeMgrs, grades }
    }

    return { earlyQB, earlyTE, latestK, earlyDST, latestFirstQB, mostRBsEarly, mostWRsEarly, zeroRBSeasons, mostDrafted, fastestDST, slowestDST, fastestQB, slowestQB, earlyTEManager, reDraftByManager, bestValue, biggestBust, bestDraftManager, worstDraftManager, draftSuccessRates, mostFptsManager, bestEarly, bestMid, bestLate, gradeData }
  }, [allPicks, trendData, enrichedWithValue])

  if (!mounted) return null

  const hStyle = (a = 'left') => ({ padding: '8px 12px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, textAlign: a, borderBottom: `1px solid ${border}`, whiteSpace: 'nowrap' })
  const cStyle = (a = 'left') => ({ padding: '10px 12px', fontSize: '12px', textAlign: a, borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap' })

  // Both use z-scores (standard deviations from mean across all picks)
  const gradeLabel = (v) => {
    if (v == null) return { label: '—', color: muted }
    if (v > 0.7) return { label: 'A', color: green }
    if (v > 0.3) return { label: 'B', color: green }
    if (v > 0) return { label: 'C+', color: text }
    if (v > -0.3) return { label: 'C-', color: text }
    if (v > -0.7) return { label: 'D', color: red }
    return { label: 'F', color: red }
  }

  const pickGrade = (v) => {
    if (v == null) return { label: '—', color: muted }
    if (v > 1.0) return { label: 'A', color: green }
    if (v > 0.5) return { label: 'B', color: green }
    if (v > 0) return { label: 'C+', color: text }
    if (v > -0.5) return { label: 'C-', color: text }
    if (v > -1.0) return { label: 'D', color: red }
    return { label: 'F', color: red }
  }

  const StatCard = ({ label, value, sub, color }) => (
    <div style={{ background: cardBg, padding: '18px 20px', borderTop: `2px solid ${color || border}` }}>
      <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '8px' }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: text, marginBottom: '4px', lineHeight: 1.3 }}>{value || '—'}</div>
      {sub && <div style={{ fontSize: '11px', color: muted, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  )

  const TABS = [['by-year', 'Draft by Year'], ['success', 'Draft Success'], ['trends', 'Manager Trends'], ['superlatives', 'All-Time Superlatives']]

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

                <p style={{ fontSize: '11px', color: muted, marginBottom: '24px' }}>Avg round each manager first drafts each position · green = early, red = late</p>
                <div style={{ overflowX: 'auto', marginBottom: '56px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                    <thead>
                      <tr style={{ background: cardBg }}>
                        <th style={hStyle()}>Manager</th>
                        <th style={hStyle('center')}>Seasons</th>
                        {POSITIONS.map(pos => <th key={pos} style={{ ...hStyle('center'), color: POS_COLORS[pos] }}>{pos}</th>)}
                        <th style={hStyle('center')}>Rd1 Fav.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendData.map((m, i) => (
                        <tr key={m.name} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                          <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>{m.name}</td>
                          <td style={{ ...cStyle('center'), color: muted }}>{m.seasons}</td>
                          {POSITIONS.map(pos => {
                            const r = m.avgRound[pos]
                            const isEarly = r && r <= 5, isLate = r && r >= 12
                            return (
                              <td key={pos} style={{ ...cStyle('center'), color: isEarly ? green : isLate ? red : text, fontWeight: (isEarly || isLate) ? '600' : '400' }}>
                                {r != null ? `Rd ${r}` : <span style={{ color: muted }}>—</span>}
                              </td>
                            )
                          })}
                          <td style={{ ...cStyle('center'), color: POS_COLORS[m.topR1] || text, fontWeight: '600', fontSize: '11px', letterSpacing: '0.08em' }}>{m.topR1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '20px' }}>Rounds 1–3 Positional Focus</p>
                <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1px', background: border }}>
                  {trendData.map(m => {
                    const total = Object.values(m.earlyPos).reduce((s, v) => s + v, 0)
                    return (
                      <div key={m.name} style={{ background: cardBg, padding: '16px' }}>
                        <div style={{ fontSize: '11px', color: muted, marginBottom: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{m.name}</div>
                        {total === 0 ? <span style={{ color: muted, fontSize: '11px' }}>No data</span> : (
                          <>
                            <div style={{ display: 'flex', height: '10px', marginBottom: '8px', borderRadius: '2px', overflow: 'hidden', gap: '1px' }}>
                              {POSITIONS.filter(pos => m.earlyPos[pos]).map(pos => (
                                <div key={pos} style={{ width: `${(m.earlyPos[pos] / total) * 100}%`, background: POS_COLORS[pos] }} />
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {POSITIONS.filter(pos => m.earlyPos[pos]).map(pos => (
                                <span key={pos} style={{ fontSize: '10px', color: POS_COLORS[pos] }}>{pos} {m.earlyPos[pos]}</span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
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
                                  ;[...allSeason].filter(p => p.position === pos && p.fpts != null).sort((a, b) => b.fpts - a.fpts).forEach((p, i) => { fptsByPos[`${p.playerId}_${pos}`] = i + 1 })
                                  ;[...allSeason].filter(p => p.position === pos).sort((a, b) => a.overall_pick - b.overall_pick).forEach((p, i) => { draftPosByPick[`${p.overall_pick}_${pos}`] = i + 1 })
                                })
                                drawerPicks = [...mgrPicks].sort((a, b) => a.overall_pick - b.overall_pick).map(p => {
                                  const eoyPosRank = SKILL_POS.includes(p.position) ? (fptsByPos[`${p.playerId}_${p.position}`] ?? null) : null
                                  const draftPosRank = SKILL_POS.includes(p.position) ? (draftPosByPick[`${p.overall_pick}_${p.position}`] ?? null) : null
                                  const delta = eoyPosRank != null && draftPosRank != null ? eoyPosRank - draftPosRank : null
                                  return { ...p, eoyPosRank, draftPosRank, delta }
                                })
                              }

                              const yearRow = (
                                <tr key={`yr-${yr}`} onClick={() => setExpanded(isOpen ? null : { manager: m.name, year: yr })} style={{ cursor: 'pointer', background: isOpen ? (d ? '#0d0d0d' : '#f0ede6') : 'transparent' }}>
                                  <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif" }}>{yr}</td>
                                  <td style={{ ...cStyle('center'), color: gradeColor, fontWeight: '700', fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>{gradeStr}</td>
                                  <td style={{ ...cStyle(), paddingTop: '8px', paddingBottom: '8px' }}>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{tags.map(tagChip)}</div>
                                  </td>
                                  <td style={{ ...cStyle('center'), color: muted, fontSize: '10px' }}>{isOpen ? '▲' : '▼'}</td>
                                </tr>
                              )

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
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>EOY Rank</th>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>Draft Rank</th>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>Δ</th>
                                              <th style={{ ...hStyle('center'), fontSize: '9px' }}>Grade</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {drawerPicks.map(p => {
                                              const pg = pickGrade(p.valueScore)
                                              const pc = POS_COLORS[p.position] || muted
                                              const posLabel = (rank, pos) => rank != null ? `${pos}${rank}` : '—'
                                              return (
                                                <tr key={p.overall_pick}>
                                                  <td style={{ ...cStyle('center'), fontSize: '11px', color: muted }}>#{p.overall_pick}</td>
                                                  <td style={{ ...cStyle(), fontSize: '11px' }}>{p.player_name}</td>
                                                  <td style={{ ...cStyle('center'), fontSize: '10px', color: pc, fontWeight: '600', letterSpacing: '0.06em' }}>{p.position}</td>
                                                  <td style={{ ...cStyle('right'), fontSize: '11px', color: p.fpts != null ? text : muted }}>{p.fpts != null ? p.fpts.toFixed(1) : '—'}</td>
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
                                      <div style={{ padding: '10px 16px', borderTop: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '11px', color: muted }}>Overall Grade:</span>
                                        <span style={{ fontSize: '14px', fontWeight: '700', color: gradeColor, fontFamily: "'Playfair Display', serif" }}>{gradeStr}</span>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{tags.map(tagChip)}</div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )

                              return [yearRow, drawerRow]
                            })}
                          </tbody>
                        </table>
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

        {/* ── ALL-TIME SUPERLATIVES ── */}
        {tab === 'superlatives' && (
          <div>
            {!superlatives ? <p style={{ color: muted }}>No data yet.</p> : (
              <>
                {unmatchedPicks.length > 0 && (
                  <div style={{ background: d ? '#1a1200' : '#fffbeb', border: `1px solid ${gold}`, padding: '12px 16px', marginBottom: '28px', fontSize: '12px' }}>
                    <span style={{ color: gold, fontWeight: '600' }}>⚠ {unmatchedPicks.length} skill-position picks</span>
                    <span style={{ color: muted }}> couldn't be matched to Sleeper performance data — value/bust cards may be incomplete.</span>
                    <details style={{ marginTop: '6px' }}>
                      <summary style={{ cursor: 'pointer', fontSize: '11px', color: muted }}>Show unmatched picks</summary>
                      <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {unmatchedPicks.slice(0, 30).map((p, i) => (
                          <span key={i} style={{ fontSize: '10px', background: cardBg, padding: '2px 6px', border: `1px solid ${border}`, color: muted }}>{p.player_name} ({p.season})</span>
                        ))}
                        {unmatchedPicks.length > 30 && <span style={{ fontSize: '10px', color: muted }}>+{unmatchedPicks.length - 30} more</span>}
                      </div>
                    </details>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1px', background: border }}>
                  {/* Performance-based */}
                  <StatCard label="📦 Most Fpts from Drafted Players" value={superlatives.mostFptsManager?.name} sub={superlatives.mostFptsManager ? `${superlatives.mostFptsManager.total.toLocaleString()} total pts from own draft picks (all seasons)` : 'Loading…'} color={gold} />
                  <StatCard label="💎 Best Value Pick Ever" value={superlatives.bestValue?.player_name} sub={superlatives.bestValue ? `Rd ${superlatives.bestValue.round}, Pick #${superlatives.bestValue.overall_pick} · ${superlatives.bestValue.manager_name} · ${superlatives.bestValue.season} · ${superlatives.bestValue.fpts?.toFixed(1)} pts` : 'Loading…'} color={green} />
                  <StatCard label="💀 Biggest Bust (Rds 1–3)" value={superlatives.biggestBust?.player_name} sub={superlatives.biggestBust ? `Rd ${superlatives.biggestBust.round}, Pick #${superlatives.biggestBust.overall_pick} · ${superlatives.biggestBust.manager_name} · ${superlatives.biggestBust.season} · ${superlatives.biggestBust.fpts?.toFixed(1)} pts` : 'Loading…'} color={red} />
                  <StatCard label="🏆 Best Drafter All-Time" value={superlatives.bestDraftManager?.name} sub={superlatives.bestDraftManager ? `${(superlatives.bestDraftManager.hitRate * 100).toFixed(0)}% hit rate · Avg ${superlatives.bestDraftManager.avgRaw > 0 ? '+' : ''}${superlatives.bestDraftManager.avgRaw?.toFixed(1)} pts per pick` : 'Loading…'} color={gold} />
                  <StatCard label="📉 Worst Drafter All-Time" value={superlatives.worstDraftManager?.name} sub={superlatives.worstDraftManager ? `${(superlatives.worstDraftManager.hitRate * 100).toFixed(0)}% hit rate · Avg ${superlatives.worstDraftManager.avgRaw?.toFixed(1)} pts per pick` : 'Loading…'} color={red} />
                  <StatCard label="🎯 Best Early Pick (Rds 1–4)" value={superlatives.bestEarly?.player_name} sub={superlatives.bestEarly ? `Rd ${superlatives.bestEarly.round}, #${superlatives.bestEarly.overall_pick} · ${superlatives.bestEarly.manager_name} · ${superlatives.bestEarly.season} · ${superlatives.bestEarly.fpts?.toFixed(1)} pts` : 'Loading…'} color={POS_COLORS[superlatives.bestEarly?.position] || green} />
                  <StatCard label="🔍 Best Mid Pick (Rds 5–9)" value={superlatives.bestMid?.player_name} sub={superlatives.bestMid ? `Rd ${superlatives.bestMid.round}, #${superlatives.bestMid.overall_pick} · ${superlatives.bestMid.manager_name} · ${superlatives.bestMid.season} · ${superlatives.bestMid.fpts?.toFixed(1)} pts` : 'Loading…'} color={POS_COLORS[superlatives.bestMid?.position] || gold} />
                  <StatCard label="💡 Best Late Pick (Rd 10+)" value={superlatives.bestLate?.player_name} sub={superlatives.bestLate ? `Rd ${superlatives.bestLate.round}, #${superlatives.bestLate.overall_pick} · ${superlatives.bestLate.manager_name} · ${superlatives.bestLate.season} · ${superlatives.bestLate.fpts?.toFixed(1)} pts` : 'Loading…'} color={POS_COLORS[superlatives.bestLate?.position] || blue} />
                  <div style={{ background: cardBg, padding: '18px 20px', borderTop: `2px solid ${blue}`, gridColumn: effectiveMobile ? 'span 2' : 'span 2' }}>
                    <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '12px' }}>🔁 Favorite Re-Draft Target — By Manager</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(superlatives.reDraftByManager || []).map(r => (
                        <div key={r.manager} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                          <span style={{ color: muted, minWidth: '80px' }}>{r.manager}</span>
                          {r.player
                            ? <><span style={{ color: text, fontFamily: "'Playfair Display', serif", flex: 1, paddingLeft: '12px' }}>{r.player}</span><span style={{ color: blue, fontWeight: '600', fontSize: '11px', marginLeft: '8px' }}>{r.count}×</span></>
                            : <span style={{ color: muted, fontSize: '11px', paddingLeft: '12px' }}>No repeat picks</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Draft-data only */}
                  <StatCard label="🏈 First QB Off the Board" value={superlatives.earlyQB?.player_name} sub={superlatives.earlyQB ? `Pick #${superlatives.earlyQB.overall_pick} (Rd ${superlatives.earlyQB.round}) · ${superlatives.earlyQB.manager_name} · ${superlatives.earlyQB.season}` : ''} color={POS_COLORS.QB} />
                  <StatCard label="⏰ Latest First QB Drafted" value={superlatives.latestFirstQB?.player_name} sub={superlatives.latestFirstQB ? `Round ${superlatives.latestFirstQB.round} · ${superlatives.latestFirstQB.manager_name} · ${superlatives.latestFirstQB.season}` : ''} color={red} />
                  <StatCard label="⚡ Earliest QB Drafter (Avg)" value={superlatives.fastestQB?.name} sub={`Avg Rd ${superlatives.fastestQB?.avgRound?.QB} for first QB`} color={POS_COLORS.QB} />
                  <StatCard label="⏳ Latest QB Drafter (Avg)" value={superlatives.slowestQB?.name} sub={`Avg Rd ${superlatives.slowestQB?.avgRound?.QB} for first QB`} color={red} />
                  <StatCard label="💍 Earliest TE Off the Board" value={superlatives.earlyTE?.player_name} sub={superlatives.earlyTE ? `Pick #${superlatives.earlyTE.overall_pick} (Rd ${superlatives.earlyTE.round}) · ${superlatives.earlyTE.manager_name} · ${superlatives.earlyTE.season}` : ''} color={POS_COLORS.TE} />
                  <StatCard label="🎯 TE Premium Manager" value={superlatives.earlyTEManager?.name} sub={`Avg Rd ${superlatives.earlyTEManager?.avgRound?.TE} for first TE`} color={POS_COLORS.TE} />
                  <StatCard label="🦵 Latest Kicker Drafted" value={superlatives.latestK?.player_name} sub={superlatives.latestK ? `Pick #${superlatives.latestK.overall_pick} (Rd ${superlatives.latestK.round}) · ${superlatives.latestK.manager_name} · ${superlatives.latestK.season}` : ''} color={muted} />
                  <StatCard label="🚨 Earliest D/ST Drafted" value={superlatives.earlyDST?.player_name} sub={superlatives.earlyDST ? `Pick #${superlatives.earlyDST.overall_pick} (Rd ${superlatives.earlyDST.round}) · ${superlatives.earlyDST.manager_name} · ${superlatives.earlyDST.season}` : ''} color={muted} />
                  <StatCard label="⚡ D/ST Earliest Drafter (Avg)" value={superlatives.fastestDST?.name} sub={`Avg Rd ${superlatives.fastestDST?.avgRound?.['D/ST']} for first D/ST`} color={gold} />
                  <StatCard label="😴 D/ST Latest Drafter (Avg)" value={superlatives.slowestDST?.name} sub={`Avg Rd ${superlatives.slowestDST?.avgRound?.['D/ST']} for first D/ST`} color={muted} />
                  <StatCard label="🐂 Most RBs in Rounds 1–3" value={superlatives.mostRBsEarly ? `${superlatives.mostRBsEarly.manager} — ${superlatives.mostRBsEarly.count} RBs` : '—'} sub={superlatives.mostRBsEarly ? `${superlatives.mostRBsEarly.season} season` : ''} color={POS_COLORS.RB} />
                  <StatCard label="🏹 Most WRs in Rounds 1–3" value={superlatives.mostWRsEarly ? `${superlatives.mostWRsEarly.manager} — ${superlatives.mostWRsEarly.count} WRs` : '—'} sub={superlatives.mostWRsEarly ? `${superlatives.mostWRsEarly.season} season` : ''} color={POS_COLORS.WR} />
                  <StatCard label="🤡 Zero RB Drafter(s)" value={superlatives.zeroRBSeasons.length ? superlatives.zeroRBSeasons.map(z => `${z.manager} (${z.season})`).join(', ') : 'None'} sub="0 RBs taken in rounds 1–3" color={red} />
                  <StatCard label="🔄 Most Drafted Player" value={superlatives.mostDrafted?.[0]} sub={superlatives.mostDrafted ? `Drafted ${superlatives.mostDrafted[1]}× across all seasons` : ''} color={gold} />
                </div>

                {/* Draft grade grid */}
                {superlatives.gradeData && (
                  <div style={{ marginTop: '48px' }}>
                    <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '20px' }}>Draft Grade by Season — Skill Positions</p>
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
                                    <span style={{ fontSize: '13px', fontWeight: '700', color, fontFamily: "'Playfair Display', serif" }} title={val != null ? `${(val * 100).toFixed(1)}% avg value` : ''}>{label}</span>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: '10px', color: muted, marginTop: '8px' }}>A = great value picks, F = busted picks · hover grade for exact score</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
