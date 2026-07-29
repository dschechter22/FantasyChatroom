'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase, LEAGUE_ID } from '../../lib/supabase'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'
export const dynamic = 'force-dynamic'

const ADMIN_PIN = '2910'
const IMPORT_YEARS = Array.from({ length: 12 }, (_, i) => 2015 + i)
const POS_COLORS = { QB: '#4285F4', RB: '#34A853', WR: '#FBBC04', TE: '#EA4335', K: '#46BDC6', 'D/ST': '#888888' }
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST']
const SKIP = ['Draft Recap', 'Season:', 'Draft Date:', 'Time:', 'Type:', 'Seconds', 'View:', 'By Round', 'By Team', 'NO.', 'Player', 'ROUND']

const parseESPNText = (raw, season) => {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const picks = []
  let currentTeam = null
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (SKIP.some(s => line.startsWith(s))) { i++; continue }
    const isNum = /^\d+$/.test(line)
    const isPlayer = /,\s*(WR|RB|QB|TE|K|D\/ST)$/.test(line)
    if (!isNum && !isPlayer) { currentTeam = line; i++; continue }
    if (isNum && i + 2 < lines.length) {
      const pLine = lines[i + 1], rLine = lines[i + 2]
      if (/,\s*(WR|RB|QB|TE|K|D\/ST)$/.test(pLine) && /^\d+$/.test(rLine)) {
        const overall = parseInt(line), round = parseInt(rLine)
        const lastComma = pLine.lastIndexOf(', ')
        const position = pLine.slice(lastComma + 2)
        const nameTeam = pLine.slice(0, lastComma).trim()
        const parts = nameTeam.split(' ')
        const nflTeam = parts[parts.length - 1]
        const playerName = parts.slice(0, -1).join(' ')
        picks.push({ season, overall_pick: overall, round, pick_in_round: null, espnTeam: currentTeam, player_name: playerName, nfl_team: nflTeam, position })
        i += 3; continue
      }
    }
    i++
  }
  const rc = {}
  picks.sort((a, b) => a.overall_pick - b.overall_pick)
  picks.forEach(p => { rc[p.round] = (rc[p.round] || 0) + 1; p.pick_in_round = rc[p.round] })
  return picks
}

export default function DraftsPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, green, red, gold, blue } = useLayout()
  const [tab, setTab] = useState('board')
  const [allPicks, setAllPicks] = useState([])
  const [managers, setManagers] = useState([])
  const [dbSeasons, setDbSeasons] = useState([])
  const [selectedYear, setSelectedYear] = useState(2025)
  const [mounted, setMounted] = useState(false)

  // import state
  const [importText, setImportText] = useState('')
  const [importYear, setImportYear] = useState(2025)
  const [parsed, setParsed] = useState(null)
  const [mapping, setMapping] = useState({})
  const [importStep, setImportStep] = useState('paste')
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinModal, setPinModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => { setMounted(true) }, [])

  const fetchPicks = () =>
    supabase.from('draft_picks').select('*').eq('league_id', LEAGUE_ID).order('overall_pick')
      .then(({ data }) => {
        setAllPicks(data || [])
        const years = [...new Set((data || []).map(p => p.season))].sort((a, b) => b - a)
        setDbSeasons(years)
        if (years.length) setSelectedYear(years[0])
      })

  useEffect(() => {
    supabase.from('managers').select('id, name').eq('league_id', LEAGUE_ID).order('name').then(({ data }) => setManagers(data || []))
    fetchPicks()
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

  // ── IMPORT ──
  const handleParse = () => {
    const p = parseESPNText(importText, importYear)
    if (!p.length) { alert('No picks found — make sure you pasted the full ESPN draft recap text.'); return }
    const espnTeams = [...new Set(p.map(x => x.espnTeam).filter(Boolean))]
    const initMap = {}
    espnTeams.forEach(t => {
      const match = managers.find(m =>
        m.name.toLowerCase().split(' ').some(w => t.toLowerCase().includes(w)) ||
        t.toLowerCase().split(' ').some(w => m.name.toLowerCase().includes(w))
      )
      initMap[t] = match?.name || managers[0]?.name || t
    })
    setMapping(initMap); setParsed({ picks: p, espnTeams }); setImportStep('map'); setSaveMsg('')
  }

  const handleSave = async () => {
    if (pinInput !== ADMIN_PIN) { setPinError('Incorrect PIN'); return }
    if (!parsed) return
    setSaving(true)
    const inserts = parsed.picks.map(p => ({
      league_id: LEAGUE_ID, season: p.season, overall_pick: p.overall_pick,
      round: p.round, pick_in_round: p.pick_in_round,
      manager_name: mapping[p.espnTeam] || p.espnTeam,
      player_name: p.player_name, nfl_team: p.nfl_team, position: p.position,
    }))
    await supabase.from('draft_picks').delete().eq('league_id', LEAGUE_ID).eq('season', importYear)
    const { error } = await supabase.from('draft_picks').insert(inserts)
    setSaving(false); setPinModal(false); setPinInput('')
    if (error) { setSaveMsg('Error: ' + error.message) }
    else { setSaveMsg(`✓ Saved ${inserts.length} picks for ${importYear}`); fetchPicks(); setImportStep('paste'); setImportText(''); setParsed(null) }
  }

  if (!mounted) return null

  const hStyle = (a = 'left') => ({ padding: '8px 12px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, textAlign: a, borderBottom: `1px solid ${border}`, whiteSpace: 'nowrap' })
  const cStyle = (a = 'left') => ({ padding: '10px 12px', fontSize: '12px', textAlign: a, borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap' })
  const inp = { background: d ? '#111' : '#e8e4dc', border: `1px solid ${border}`, color: text, padding: '8px 12px', fontSize: '13px', fontFamily: "'Inter', sans-serif", outline: 'none' }

  const StatCard = ({ label, value, sub, color }) => (
    <div style={{ background: cardBg, padding: '18px 20px', borderTop: `2px solid ${color || border}` }}>
      <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '8px' }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: text, marginBottom: '4px', lineHeight: 1.3 }}>{value || '—'}</div>
      {sub && <div style={{ fontSize: '11px', color: muted, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  )

  const TABS = [['board', 'Draft Board'], ['trends', 'Trends'], ['superlatives', 'Superlatives'], ['import', 'Import']]

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />

      {/* PIN modal */}
      {pinModal && (
        <>
          <div onClick={() => { setPinModal(false); setPinInput(''); setPinError('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: d ? '#0a0a0a' : '#f4f1ec', border: `1px solid ${border}`, padding: '32px', width: effectiveMobile ? '90vw' : '340px' }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', marginBottom: '8px', color: text }}>Admin PIN</h3>
            <p style={{ fontSize: '12px', color: muted, marginBottom: '20px' }}>Enter PIN to save {parsed?.picks?.length} picks for {importYear}.</p>
            <input type="password" placeholder="PIN" value={pinInput} onChange={e => { setPinInput(e.target.value); setPinError('') }} onKeyDown={e => e.key === 'Enter' && handleSave()} style={{ ...inp, width: '100%', boxSizing: 'border-box', marginBottom: '8px' }} />
            {pinError && <p style={{ color: red, fontSize: '12px', marginBottom: '8px' }}>{pinError}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={handleSave} disabled={saving} style={{ background: text, color: bg, border: 'none', padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif", flex: 1, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save Picks'}
              </button>
              <button onClick={() => { setPinModal(false); setPinInput(''); setPinError('') }} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px,6vw,72px)', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '4px' }}>Draft History</h1>
        <p style={{ color: muted, fontSize: '13px', marginBottom: '36px' }}>All-time draft archive — paste ESPN recap to import any year</p>

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
                <p style={{ color: muted, marginBottom: '16px' }}>No draft data yet.</p>
                <button onClick={() => setTab('import')} style={{ background: text, color: bg, border: 'none', padding: '10px 24px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>Import a Draft →</button>
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

        {/* ── IMPORT TAB ── */}
        {tab === 'import' && (
          <div style={{ maxWidth: '720px' }}>
            {saveMsg && <p style={{ color: green, fontSize: '12px', marginBottom: '20px' }}>{saveMsg}</p>}

            {importStep === 'paste' && (
              <>
                <p style={{ fontSize: '12px', color: muted, marginBottom: '20px', lineHeight: 1.6 }}>
                  On ESPN: go to <strong style={{ color: text }}>My Team → Draft Recap</strong>, select the year, then select all text and paste below. The parser will auto-detect picks, positions, and teams.
                </p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Season Year</span>
                  <select value={importYear} onChange={e => setImportYear(parseInt(e.target.value))} style={{ ...inp, cursor: 'pointer' }}>
                    {IMPORT_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste ESPN draft recap text here…" style={{ width: '100%', minHeight: '280px', background: d ? '#111' : '#e8e4dc', border: `1px solid ${border}`, color: text, padding: '12px', fontSize: '12px', fontFamily: "'Courier New', monospace", outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
                <button onClick={handleParse} disabled={!importText.trim()} style={{ marginTop: '12px', background: text, color: bg, border: 'none', padding: '12px 28px', cursor: importText.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500', opacity: importText.trim() ? 1 : 0.4 }}>
                  Parse Draft →
                </button>
              </>
            )}

            {importStep === 'map' && parsed && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', gap: '12px' }}>
                  <div>
                    <p style={{ fontSize: '13px', color: text, marginBottom: '4px' }}>Map ESPN team names → managers</p>
                    <p style={{ fontSize: '12px', color: muted }}>{parsed.picks.length} picks parsed · {parsed.espnTeams.length} teams detected</p>
                  </div>
                  <button onClick={() => setImportStep('paste')} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' }}>← Back</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                  {parsed.espnTeams.map(teamName => (
                    <div key={teamName} style={{ display: 'grid', gridTemplateColumns: '1fr 20px 1fr', gap: '10px', alignItems: 'center' }}>
                      <div style={{ background: cardBg, border: `1px solid ${border}`, padding: '10px 14px', fontSize: '13px', color: muted, fontFamily: "'Playfair Display', serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teamName}</div>
                      <span style={{ color: muted, textAlign: 'center', fontSize: '12px' }}>→</span>
                      <select value={mapping[teamName] || ''} onChange={e => setMapping(m => ({ ...m, [teamName]: e.target.value }))} style={{ ...inp, cursor: 'pointer', width: '100%' }}>
                        {managers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <button onClick={() => setImportStep('preview')} style={{ background: text, color: bg, border: 'none', padding: '12px 28px', cursor: 'pointer', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500' }}>
                  Preview →
                </button>
              </>
            )}

            {importStep === 'preview' && parsed && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <p style={{ fontSize: '12px', color: muted }}>{parsed.picks.length} picks for {importYear} — saving will overwrite any existing data for this year.</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setImportStep('map')} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontFamily: "'Inter', sans-serif" }}>← Back</button>
                    <button onClick={() => setPinModal(true)} style={{ background: text, color: bg, border: 'none', padding: '8px 24px', cursor: 'pointer', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500' }}>Save</button>
                  </div>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto', border: `1px solid ${border}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr style={{ background: cardBg }}>
                        <th style={hStyle('center')}>Pick</th>
                        <th style={hStyle('center')}>Rd</th>
                        <th style={hStyle()}>Player</th>
                        <th style={hStyle('center')}>Pos</th>
                        <th style={hStyle()}>NFL</th>
                        <th style={hStyle()}>Manager</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.picks.map((p, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                          <td style={{ ...cStyle('center'), color: muted }}>{p.overall_pick}</td>
                          <td style={{ ...cStyle('center'), color: muted }}>{p.round}</td>
                          <td style={cStyle()}>{p.player_name}</td>
                          <td style={{ ...cStyle('center'), color: POS_COLORS[p.position] || text, fontWeight: '600', fontSize: '11px' }}>{p.position}</td>
                          <td style={{ ...cStyle(), color: muted }}>{p.nfl_team}</td>
                          <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif" }}>{mapping[p.espnTeam] || p.espnTeam}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
