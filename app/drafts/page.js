'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase, LEAGUE_ID } from '../../lib/supabase'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'
export const dynamic = 'force-dynamic'

const POS_COLORS = { QB: '#4285F4', RB: '#34A853', WR: '#FBBC04', TE: '#EA4335', K: '#46BDC6', 'D/ST': '#888888' }
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST']

export default function DraftsPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, green, red, gold, blue } = useLayout()
  const [tab, setTab] = useState('board')
  const [allPicks, setAllPicks] = useState([])
  const [dbSeasons, setDbSeasons] = useState([])
  const [selectedYear, setSelectedYear] = useState(2025)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    supabase.from('draft_picks').select('*').eq('league_id', LEAGUE_ID).order('overall_pick').limit(2000)
      .then(({ data }) => {
        const rows = (data || []).map(p => ({ ...p, season: parseInt(p.season), round: parseInt(p.round), overall_pick: parseInt(p.overall_pick), pick_in_round: parseInt(p.pick_in_round) }))
        setAllPicks(rows)
        const years = [...new Set(rows.map(p => p.season))].sort((a, b) => b - a)
        setDbSeasons(years)
        if (years.length) setSelectedYear(years[0])
      })
  }, [])

  const picks = useMemo(() => allPicks.filter(p => p.season === selectedYear), [allPicks, selectedYear])
  const boardManagers = useMemo(() => picks.filter(p => p.round === 1).sort((a, b) => a.overall_pick - b.overall_pick).map(p => p.manager_name), [picks])
  const rounds = useMemo(() => [...new Set(picks.map(p => p.round))].sort((a, b) => a - b), [picks])

  // ── TRENDS ──
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
      return { name: mgr, seasons: years.length, avgRound, topR1, earlyPos }
    })
  }, [allPicks])

  // ── SUPERLATIVES ──
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

    // most drafted player overall (appears in most drafts)
    const playerCount = {}
    allPicks.forEach(p => { playerCount[p.player_name] = (playerCount[p.player_name] || 0) + 1 })
    const mostDrafted = Object.entries(playerCount).sort((a, b) => b[1] - a[1])[0]

    // manager who most often takes D/ST earliest (lowest avg round for D/ST)
    const fastestDST = trendData.filter(m => m.avgRound['D/ST'] != null).sort((a, b) => a.avgRound['D/ST'] - b.avgRound['D/ST'])[0]
    const slowestDST = trendData.filter(m => m.avgRound['D/ST'] != null).sort((a, b) => b.avgRound['D/ST'] - a.avgRound['D/ST'])[0]
    const fastestQB = trendData.filter(m => m.avgRound['QB'] != null).sort((a, b) => a.avgRound['QB'] - b.avgRound['QB'])[0]
    const slowestQB = trendData.filter(m => m.avgRound['QB'] != null).sort((a, b) => b.avgRound['QB'] - a.avgRound['QB'])[0]
    const earlyTEManager = trendData.filter(m => m.avgRound['TE'] != null).sort((a, b) => a.avgRound['TE'] - b.avgRound['TE'])[0]

    return { earlyQB, earlyTE, latestK, earlyDST, latestFirstQB, mostRBsEarly, mostWRsEarly, zeroRBSeasons, mostDrafted, fastestDST, slowestDST, fastestQB, slowestQB, earlyTEManager }
  }, [allPicks, trendData])

  if (!mounted) return null

  const hStyle = (a = 'left') => ({ padding: '8px 12px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, textAlign: a, borderBottom: `1px solid ${border}`, whiteSpace: 'nowrap' })
  const cStyle = (a = 'left') => ({ padding: '10px 12px', fontSize: '12px', textAlign: a, borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap' })
  const StatCard = ({ label, value, sub, color }) => (
    <div style={{ background: cardBg, padding: '18px 20px', borderTop: `2px solid ${color || border}` }}>
      <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '8px' }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: text, marginBottom: '4px', lineHeight: 1.3 }}>{value || '—'}</div>
      {sub && <div style={{ fontSize: '11px', color: muted, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  )

  const TABS = [['board', 'Draft Board'], ['trends', 'Trends'], ['superlatives', 'Superlatives']]

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px,6vw,72px)', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '4px' }}>Draft History</h1>
        <p style={{ color: muted, fontSize: '13px', marginBottom: '36px' }}>All-time draft archive · 2017–present</p>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, marginBottom: '36px', overflowX: 'auto' }}>
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ background: 'none', border: 'none', borderBottom: tab === key ? `2px solid ${text}` : '2px solid transparent', color: tab === key ? text : muted, padding: '12px 20px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: tab === key ? '600' : '400', whiteSpace: 'nowrap', marginBottom: '-1px' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Year selector */}
        {tab === 'board' && dbSeasons.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} style={{ background: cardBg, border: `1px solid ${border}`, color: text, padding: '8px 16px', fontSize: '14px', fontFamily: "'Playfair Display', serif", cursor: 'pointer', outline: 'none' }}>
              {dbSeasons.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {/* ── BOARD TAB ── */}
        {tab === 'board' && (
          <div>
            {picks.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center' }}>
                <p style={{ color: muted }}>No draft data for {selectedYear}.</p>
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                  <table style={{ borderCollapse: 'collapse', minWidth: `${boardManagers.length * 130 + 60}px` }}>
                    <thead>
                      <tr style={{ background: cardBg }}>
                        <th style={{ ...hStyle('center'), minWidth: '48px', position: 'sticky', left: 0, background: cardBg, zIndex: 1 }}>Rd</th>
                        {boardManagers.map(mgr => (
                          <th key={mgr} style={{ ...hStyle('center'), minWidth: '120px' }}>{mgr}</th>
                        ))}
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
                              <td key={mgr} style={{ padding: '5px 6px', borderBottom: `1px solid ${border}`, verticalAlign: 'top' }}>
                                {pick ? (
                                  <div style={{ borderLeft: `3px solid ${pc}`, paddingLeft: '7px', paddingTop: '4px', paddingBottom: '4px' }}>
                                    <div style={{ fontSize: '11px', color: text, lineHeight: 1.3, fontWeight: '500' }}>{pick.player_name}</div>
                                    <div style={{ fontSize: '9px', color: pc, letterSpacing: '0.06em', marginTop: '2px' }}>{pick.position} · {pick.nfl_team}</div>
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

        {/* ── TRENDS TAB ── */}
        {tab === 'trends' && (
          <div>
            {trendData.length === 0 ? (
              <p style={{ color: muted }}>No data yet — import some drafts first.</p>
            ) : (
              <>
                <p style={{ fontSize: '11px', color: muted, marginBottom: '24px' }}>Avg round each manager first drafts each position · green = early, red = late · across all imported seasons</p>
                <div style={{ overflowX: 'auto', marginBottom: '56px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                    <thead>
                      <tr style={{ background: cardBg }}>
                        <th style={hStyle()}>Manager</th>
                        <th style={hStyle('center')}>Seasons</th>
                        {POSITIONS.map(pos => (
                          <th key={pos} style={{ ...hStyle('center'), color: POS_COLORS[pos] }}>{pos}</th>
                        ))}
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
                            const isEarly = r && r <= 5
                            const isLate = r && r >= 12
                            return (
                              <td key={pos} style={{ ...cStyle('center'), color: isEarly ? green : isLate ? red : text, fontWeight: (isEarly || isLate) ? '600' : '400' }}>
                                {r != null ? `Rd ${r}` : <span style={{ color: muted }}>—</span>}
                              </td>
                            )
                          })}
                          <td style={{ ...cStyle('center'), color: POS_COLORS[m.topR1] || text, fontWeight: '600', fontSize: '11px', letterSpacing: '0.08em' }}>
                            {m.topR1}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Early pick breakdown */}
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

        {/* ── SUPERLATIVES TAB ── */}
        {tab === 'superlatives' && (
          <div>
            {!superlatives ? (
              <p style={{ color: muted }}>No data yet — import some drafts first.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1px', background: border }}>
                <StatCard label="🏈 First QB Off the Board" value={superlatives.earlyQB ? `${superlatives.earlyQB.player_name}` : '—'} sub={superlatives.earlyQB ? `Pick ${superlatives.earlyQB.overall_pick} (Rd ${superlatives.earlyQB.round}) · ${superlatives.earlyQB.manager_name} · ${superlatives.earlyQB.season}` : ''} color={POS_COLORS.QB} />
                <StatCard label="⏰ Latest First QB Drafted" value={superlatives.latestFirstQB ? superlatives.latestFirstQB.player_name : '—'} sub={superlatives.latestFirstQB ? `Round ${superlatives.latestFirstQB.round} · ${superlatives.latestFirstQB.manager_name} · ${superlatives.latestFirstQB.season}` : ''} color={red} />
                <StatCard label="🏆 Earliest QB Drafter (Avg)" value={superlatives.fastestQB?.name} sub={`Avg Rd ${superlatives.fastestQB?.avgRound?.QB} for first QB`} color={POS_COLORS.QB} />
                <StatCard label="⏳ Latest QB Drafter (Avg)" value={superlatives.slowestQB?.name} sub={`Avg Rd ${superlatives.slowestQB?.avgRound?.QB} for first QB`} color={red} />
                <StatCard label="💎 Earliest TE Off the Board" value={superlatives.earlyTE?.player_name} sub={superlatives.earlyTE ? `Pick ${superlatives.earlyTE.overall_pick} (Rd ${superlatives.earlyTE.round}) · ${superlatives.earlyTE.manager_name} · ${superlatives.earlyTE.season}` : ''} color={POS_COLORS.TE} />
                <StatCard label="🎯 TE Premium Manager" value={superlatives.earlyTEManager?.name} sub={`Avg Rd ${superlatives.earlyTEManager?.avgRound?.TE} for first TE`} color={POS_COLORS.TE} />
                <StatCard label="🦵 Latest Kicker Drafted" value={superlatives.latestK?.player_name} sub={superlatives.latestK ? `Pick ${superlatives.latestK.overall_pick} (Rd ${superlatives.latestK.round}) · ${superlatives.latestK.manager_name} · ${superlatives.latestK.season}` : ''} color={muted} />
                <StatCard label="🚨 Earliest D/ST Drafted" value={superlatives.earlyDST?.player_name} sub={superlatives.earlyDST ? `Pick ${superlatives.earlyDST.overall_pick} (Rd ${superlatives.earlyDST.round}) · ${superlatives.earlyDST.manager_name} · ${superlatives.earlyDST.season}` : ''} color={muted} />
                <StatCard label="⚡ D/ST Earliest Drafter (Avg)" value={superlatives.fastestDST?.name} sub={`Avg Rd ${superlatives.fastestDST?.avgRound?.['D/ST']} for first D/ST`} color={gold} />
                <StatCard label="😴 D/ST Latest Drafter (Avg)" value={superlatives.slowestDST?.name} sub={`Avg Rd ${superlatives.slowestDST?.avgRound?.['D/ST']} for first D/ST`} color={muted} />
                <StatCard label="🐂 Most RBs in Rounds 1–3" value={superlatives.mostRBsEarly ? `${superlatives.mostRBsEarly.manager} — ${superlatives.mostRBsEarly.count} RBs` : '—'} sub={superlatives.mostRBsEarly ? `${superlatives.mostRBsEarly.season} season` : ''} color={POS_COLORS.RB} />
                <StatCard label="🏹 Most WRs in Rounds 1–3" value={superlatives.mostWRsEarly ? `${superlatives.mostWRsEarly.manager} — ${superlatives.mostWRsEarly.count} WRs` : '—'} sub={superlatives.mostWRsEarly ? `${superlatives.mostWRsEarly.season} season` : ''} color={POS_COLORS.WR} />
                <StatCard label="🤡 Zero RB Drafter(s)" value={superlatives.zeroRBSeasons.length ? superlatives.zeroRBSeasons.map(z => `${z.manager} (${z.season})`).join(', ') : 'None'} sub="0 RBs taken in rounds 1–3" color={red} />
                <StatCard label="🔄 Most Drafted Player" value={superlatives.mostDrafted ? superlatives.mostDrafted[0] : '—'} sub={superlatives.mostDrafted ? `Drafted ${superlatives.mostDrafted[1]} time${superlatives.mostDrafted[1] > 1 ? 's' : ''} across all seasons` : ''} color={gold} />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
