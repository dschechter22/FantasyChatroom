'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const MANAGER_COLORS = {
  'dan':          '#4285F4',
  'wally':        '#EA4335',
  'john':         '#FBBC04',
  'braden':       '#34A853',
  'jm':           '#FF6D00',
  'big-e':        '#46BDC6',
  'mamby-tenner': '#7BAAF7',
  'reid':         '#F07B72',
  'freed':        '#FCD04F',
  'caden':        '#71C287',
  'dav':          '#aaaaaa',
  'bern-tenner':  '#cccccc',
}

export default function LJIndexPage() {
  const [theme, setTheme] = useState('dark')
  const [seasons, setSeasons] = useState([])
  const [selectedYear, setSelectedYear] = useState(2025)
  const [matchups, setMatchups] = useState([])
  const [teams, setTeams] = useState([])
  const [managers, setManagers] = useState([])
  const [tooltip, setTooltip] = useState(null)
  const svgRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('fc-theme') || 'dark'
    setTheme(saved)
    document.body.setAttribute('data-theme', saved)
    supabase.from('seasons').select('year, season_number').order('year', { ascending: false }).then(({ data }) => setSeasons(data || []))
    supabase.from('managers').select('*').then(({ data }) => setManagers(data || []))
  }, [])

  useEffect(() => {
    setMatchups([])
    setTeams([])
    supabase.from('matchups')
      .select('*, home_team:home_team_id(id, manager_id, team_name), away_team:away_team_id(id, manager_id, team_name), season:season_id(year)')
      .then(({ data }) => setMatchups((data || []).filter(m => m.season?.year === selectedYear && !m.is_playoff)))
    supabase.from('teams')
      .select('*, manager:manager_id(name, slug, id), season:season_id(year)')
      .then(({ data }) => setTeams((data || []).filter(t => t.season?.year === selectedYear)))
  }, [selectedYear])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('fc-theme', next)
    document.body.setAttribute('data-theme', next)
  }

  const d = theme === 'dark'
  const bg = d ? '#000' : '#f4f1ec'
  const text = d ? '#fff' : '#0d2152'
  const muted = d ? 'rgba(255,255,255,0.38)' : 'rgba(13,33,82,0.55)'
  const border = d ? 'rgba(255,255,255,0.1)' : 'rgba(13,33,82,0.14)'
  const cardBg = d ? '#0a0a0a' : '#ede9e2'
  const gridColor = d ? 'rgba(255,255,255,0.06)' : 'rgba(13,33,82,0.08)'
  const axisColor = d ? 'rgba(255,255,255,0.2)' : 'rgba(13,33,82,0.25)'

  // ---- COMPUTE LJ INDEX DATA ----
  const computeData = () => {
    if (matchups.length === 0 || teams.length === 0) return []

    const weeks = [...new Set(matchups.map(m => m.week))].sort((a, b) => a - b)

    // All-play win% per team per week
    const allPlaySum = {}
    teams.forEach(t => { allPlaySum[t.id] = 0 })

    weeks.forEach(week => {
      const weekGames = matchups.filter(m => m.week === week)
      const allScores = []
      weekGames.forEach(m => {
        allScores.push({ teamId: m.home_team?.id, score: m.home_score })
        allScores.push({ teamId: m.away_team?.id, score: m.away_score })
      })
      const n = allScores.length
      if (n < 2) return
      allScores.forEach(({ teamId, score }) => {
        if (allPlaySum[teamId] === undefined) return
        const wins = allScores.filter(o => o.teamId !== teamId && score > o.score).length
        allPlaySum[teamId] += wins / (n - 1)
      })
    })

    // Power score inputs for bubble size
    const median = (arr) => {
      if (!arr.length) return 0
      const s = [...arr].sort((a, b) => a - b)
      const mid = Math.floor(s.length / 2)
      return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2
    }

    const teamScores = {}
    teams.forEach(t => { teamScores[t.id] = [] })
    matchups.forEach(m => {
      if (teamScores[m.home_team?.id] !== undefined) teamScores[m.home_team.id].push(m.home_score)
      if (teamScores[m.away_team?.id] !== undefined) teamScores[m.away_team.id].push(m.away_score)
    })

    const teamData = teams.map(t => {
      const scores = teamScores[t.id] || []
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      const medianScore = median(scores)
      const winPct = (t.wins + t.losses) > 0 ? t.wins / (t.wins + t.losses) : 0
      const allPlayWinPct = weeks.length > 0 ? allPlaySum[t.id] / weeks.length : 0
      const expectedWins = allPlaySum[t.id]
      const luck = t.wins - expectedWins

      // Power score for bubble size
      const powerRaw = winPct * 2 + avgScore * 4 + allPlayWinPct * 2 + medianScore * 2
      return { t, winPct, allPlayWinPct, avgScore, medianScore, expectedWins, luck, powerRaw }
    })

    // League averages
    const avgAllPlay = teamData.reduce((s, r) => s + r.allPlayWinPct, 0) / teamData.length
    const avgLuck = teamData.reduce((s, r) => s + r.luck, 0) / teamData.length
    const maxPower = Math.max(...teamData.map(r => r.powerRaw))
    const minPower = Math.min(...teamData.map(r => r.powerRaw))

    return teamData.map(r => ({
      managerId: r.t.manager?.id,
      managerName: r.t.manager?.name,
      managerSlug: r.t.manager?.slug,
      teamName: r.t.team_name,
      wins: r.t.wins,
      losses: r.t.losses,
      // X: all-play win% relative to league avg, as percentage points
      x: parseFloat(((r.allPlayWinPct - avgAllPlay) * 100).toFixed(1)),
      // Y: luck relative to league avg, as percentage points of win%
      y: parseFloat(((r.luck - avgLuck) / Math.max(r.t.wins + r.t.losses, 1) * 100).toFixed(1)),
      // Raw luck (wins over expected)
      luckRaw: parseFloat(r.luck.toFixed(2)),
      allPlayWinPct: parseFloat((r.allPlayWinPct * 100).toFixed(1)),
      // Bubble size normalized 0-1
      powerNorm: maxPower === minPower ? 0.5 : (r.powerRaw - minPower) / (maxPower - minPower),
      winPct: parseFloat((r.winPct * 100).toFixed(1)),
      avgScore: parseFloat(r.avgScore.toFixed(1)),
    }))
  }

  const plotData = computeData()

  // ---- CHART DIMENSIONS ----
  const W = 680
  const H = 480
  const PAD = { top: 40, right: 40, bottom: 60, left: 70 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  // Axis range: symmetric around 0, based on data
  const xVals = plotData.map(r => r.x)
  const yVals = plotData.map(r => r.y)
  const xMax = Math.max(50, ...xVals.map(Math.abs)) * 1.2
  const yMax = Math.max(50, ...yVals.map(Math.abs)) * 1.2

  const toSvgX = (x) => PAD.left + ((x + xMax) / (2 * xMax)) * chartW
  const toSvgY = (y) => PAD.top + ((yMax - y) / (2 * yMax)) * chartH

  const minBubble = 14
  const maxBubble = 32

  const quadrantLabels = [
    { x: PAD.left + chartW * 0.75, y: PAD.top + chartH * 0.15, label: 'Good & Lucky', color: d ? 'rgba(110,231,183,0.5)' : 'rgba(13,110,63,0.5)' },
    { x: PAD.left + chartW * 0.15, y: PAD.top + chartH * 0.15, label: 'Lucky, Not Good', color: d ? 'rgba(147,197,253,0.5)' : 'rgba(30,58,138,0.4)' },
    { x: PAD.left + chartW * 0.75, y: PAD.top + chartH * 0.85, label: 'Good, Unlucky', color: d ? 'rgba(252,211,77,0.5)' : 'rgba(146,64,14,0.5)' },
    { x: PAD.left + chartW * 0.15, y: PAD.top + chartH * 0.85, label: 'Bad & Unlucky', color: d ? 'rgba(248,113,113,0.5)' : 'rgba(155,28,28,0.5)' },
  ]

  const gridLines = [-50, -25, 0, 25, 50]

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif", transition: 'background 0.2s, color 0.2s' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', background: d ? 'rgba(0,0,0,0.88)' : 'rgba(244,241,236,0.95)', borderBottom: `1px solid ${border}`, backdropFilter: 'blur(10px)' }}>
        <a href="/" style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: '400', color: text, textDecoration: 'none' }}>Fantasy Chatroom</a>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {[['Champions','/champions'],['Standings','/standings'],['H2H','/h2h'],['Season','/season'],['Rivalries','/rivalries'],['Managers','/managers'],['Writeups','/writeups'],['Power Rankings','/power-rankings'],['LJ Index','/lj-index'],['All-Time Teams','/all-time-teams']].map(([label, href]) => (
            <a key={href} href={href} style={{ color: muted, textDecoration: 'none', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: '500' }}>{label}</a>
          ))}
          <button onClick={toggleTheme} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '6px 14px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500' }}>
            {d ? 'Light' : 'Dark'}
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '120px 24px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: '400', letterSpacing: '-0.02em' }}>LJ Index</h1>
          <div style={{ paddingBottom: '8px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} style={{ background: cardBg, color: text, border: `1px solid ${border}`, padding: '10px 16px', fontSize: '14px', fontFamily: "'Playfair Display', serif", cursor: 'pointer', outline: 'none' }}>
              {seasons.map(s => <option key={s.year} value={s.year}>{s.year} — Year {s.season_number}</option>)}
            </select>
          </div>
        </div>
        <p style={{ color: muted, fontSize: '13px', letterSpacing: '0.06em', marginBottom: '40px', maxWidth: '600px' }}>
          All-Play Win% vs Luck. Bubble size reflects power score. Both axes centered at league average.
        </p>

        {/* Chart */}
        {plotData.length > 0 ? (
          <div style={{ position: 'relative', marginBottom: '48px' }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: '100%', maxWidth: `${W}px`, height: 'auto', display: 'block', overflow: 'visible' }}
            >
              {/* Quadrant backgrounds */}
              <rect x={toSvgX(0)} y={PAD.top} width={chartW - (toSvgX(0) - PAD.left)} height={chartH / 2} fill={d ? 'rgba(110,231,183,0.04)' : 'rgba(13,110,63,0.03)'} />
              <rect x={PAD.left} y={PAD.top} width={toSvgX(0) - PAD.left} height={chartH / 2} fill={d ? 'rgba(147,197,253,0.04)' : 'rgba(30,58,138,0.03)'} />
              <rect x={toSvgX(0)} y={toSvgY(0)} width={chartW - (toSvgX(0) - PAD.left)} height={chartH / 2} fill={d ? 'rgba(252,211,77,0.04)' : 'rgba(146,64,14,0.03)'} />
              <rect x={PAD.left} y={toSvgY(0)} width={toSvgX(0) - PAD.left} height={chartH / 2} fill={d ? 'rgba(248,113,113,0.04)' : 'rgba(155,28,28,0.03)'} />

              {/* Grid lines */}
              {gridLines.map(v => (
                <g key={`gx-${v}`}>
                  <line x1={toSvgX(v)} y1={PAD.top} x2={toSvgX(v)} y2={PAD.top + chartH} stroke={v === 0 ? axisColor : gridColor} strokeWidth={v === 0 ? 1.5 : 1} />
                  <line x1={PAD.left} y1={toSvgY(v)} x2={PAD.left + chartW} y2={toSvgY(v)} stroke={v === 0 ? axisColor : gridColor} strokeWidth={v === 0 ? 1.5 : 1} />
                </g>
              ))}

              {/* Axis tick labels */}
              {gridLines.map(v => (
                <g key={`tl-${v}`}>
                  <text x={toSvgX(v)} y={PAD.top + chartH + 20} textAnchor="middle" fontSize="11" fill={muted} fontFamily="Inter, sans-serif">{v}%</text>
                  <text x={PAD.left - 10} y={toSvgY(v) + 4} textAnchor="end" fontSize="11" fill={muted} fontFamily="Inter, sans-serif">{v}%</text>
                </g>
              ))}

              {/* Axis labels */}
              <text x={PAD.left + chartW / 2} y={H - 8} textAnchor="middle" fontSize="12" fill={muted} fontFamily="Inter, sans-serif" letterSpacing="2">ALL-PLAY WIN %</text>
              <text x={14} y={PAD.top + chartH / 2} textAnchor="middle" fontSize="12" fill={muted} fontFamily="Inter, sans-serif" letterSpacing="2" transform={`rotate(-90, 14, ${PAD.top + chartH / 2})`}>LUCK</text>

              {/* Quadrant labels */}
              {quadrantLabels.map((q, i) => (
                <text key={i} x={q.x} y={q.y} textAnchor="middle" fontSize="10" fill={q.color} fontFamily="Inter, sans-serif" letterSpacing="1.5" fontWeight="500">
                  {q.label.toUpperCase()}
                </text>
              ))}

              {/* Bubbles */}
              {plotData.map((r, i) => {
                const cx = toSvgX(r.x)
                const cy = toSvgY(r.y)
                const radius = minBubble + r.powerNorm * (maxBubble - minBubble)
                const color = MANAGER_COLORS[r.managerSlug] || '#888'
                return (
                  <g key={r.managerId || i}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => setTooltip({ r, cx, cy })}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <circle cx={cx} cy={cy} r={radius} fill={color} fillOpacity={0.85} stroke={d ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'} strokeWidth={1.5} />
                    {radius > 18 && (
                      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fill="white" fontFamily="Inter, sans-serif" fontWeight="600" style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                        {r.managerName?.split('/')[0]?.split(' ')[0]}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* Tooltip */}
              {tooltip && (() => {
                const { r, cx, cy } = tooltip
                const tw = 190, th = 110
                let tx = cx + 14
                let ty = cy - th / 2
                if (tx + tw > W) tx = cx - tw - 14
                if (ty < 0) ty = 4
                if (ty + th > H) ty = H - th - 4
                return (
                  <g>
                    <rect x={tx} y={ty} width={tw} height={th} rx={4} fill={d ? '#111' : '#fff'} stroke={border} strokeWidth={1} />
                    <text x={tx + 12} y={ty + 20} fontSize="13" fontFamily="Playfair Display, serif" fill={text}>{r.managerName}</text>
                    <text x={tx + 12} y={ty + 35} fontSize="10" fontFamily="Inter, sans-serif" fill={muted}>{r.teamName}</text>
                    <text x={tx + 12} y={ty + 54} fontSize="11" fontFamily="Inter, sans-serif" fill={text}>Record: {r.wins}-{r.losses} ({r.winPct}%)</text>
                    <text x={tx + 12} y={ty + 70} fontSize="11" fontFamily="Inter, sans-serif" fill={text}>All-Play Win%: {r.allPlayWinPct}%</text>
                    <text x={tx + 12} y={ty + 86} fontSize="11" fontFamily="Inter, sans-serif" fill={text}>Luck: {r.luckRaw > 0 ? '+' : ''}{r.luckRaw} wins</text>
                    <text x={tx + 12} y={ty + 102} fontSize="11" fontFamily="Inter, sans-serif" fill={text}>Avg PPG: {r.avgScore}</text>
                  </g>
                )
              })()}
            </svg>
          </div>
        ) : (
          <p style={{ color: muted, fontSize: '14px' }}>Loading data...</p>
        )}

        {/* Legend */}
        {plotData.length > 0 && (
          <div style={{ marginBottom: '48px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: muted, marginBottom: '16px' }}>Teams</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {plotData.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: MANAGER_COLORS[r.managerSlug] || '#888', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: muted }}>{r.managerName} <span style={{ color: text }}>{r.teamName}</span></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data table */}
        {plotData.length > 0 && (
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: muted, marginBottom: '16px' }}>Full Breakdown</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                <thead>
                  <tr style={{ background: cardBg }}>
                    {['Manager', 'Team', 'Record', 'Win %', 'All-Play Win %', 'Luck (wins)', 'Avg PPG'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: muted, textAlign: h === 'Manager' || h === 'Team' ? 'left' : 'right', borderBottom: `1px solid ${border}`, fontWeight: '500', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...plotData].sort((a, b) => b.allPlayWinPct - a.allPlayWinPct).map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : (d ? '#080808' : '#e8e4dc') }}>
                      <td style={{ padding: '14px', fontSize: '13px', borderBottom: `1px solid ${border}`, color: text, fontFamily: "'Playfair Display', serif" }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: MANAGER_COLORS[r.managerSlug] || '#888', flexShrink: 0 }} />
                          {r.managerName}
                        </div>
                      </td>
                      <td style={{ padding: '14px', fontSize: '12px', borderBottom: `1px solid ${border}`, color: muted }}>{r.teamName}</td>
                      <td style={{ padding: '14px', fontSize: '13px', borderBottom: `1px solid ${border}`, color: text, textAlign: 'right' }}>{r.wins}-{r.losses}</td>
                      <td style={{ padding: '14px', fontSize: '13px', borderBottom: `1px solid ${border}`, color: text, textAlign: 'right' }}>{r.winPct}%</td>
                      <td style={{ padding: '14px', fontSize: '13px', borderBottom: `1px solid ${border}`, color: text, textAlign: 'right' }}>{r.allPlayWinPct}%</td>
                      <td style={{ padding: '14px', fontSize: '13px', borderBottom: `1px solid ${border}`, textAlign: 'right', color: r.luckRaw > 0 ? (d ? '#6ee7b7' : '#0d6e3f') : r.luckRaw < 0 ? (d ? '#f87171' : '#9b1c1c') : text, fontWeight: '500' }}>
                        {r.luckRaw > 0 ? '+' : ''}{r.luckRaw}
                      </td>
                      <td style={{ padding: '14px', fontSize: '13px', borderBottom: `1px solid ${border}`, color: text, textAlign: 'right' }}>{r.avgScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
