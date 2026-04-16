'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function PowerRankingsPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, green, red, gold, blue } = useLayout()

  const [seasons, setSeasons] = useState([])
  const [selectedYear, setSelectedYear] = useState(2025)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [matchups, setMatchups] = useState([])
  const [teams, setTeams] = useState([])
  const [managers, setManagers] = useState([])

  useEffect(() => {
    supabase.from('seasons').select('year, season_number').order('year', { ascending: false }).then(({ data }) => setSeasons(data || []))
    supabase.from('managers').select('*').then(({ data }) => setManagers(data || []))
  }, [])

  useEffect(() => {
    setMatchups([])
    setTeams([])
    setSelectedWeek(null)
    supabase.from('matchups')
      .select('*, home_team:home_team_id(id, manager_id, team_name), away_team:away_team_id(id, manager_id, team_name), season:season_id(year)')
      .then(({ data }) => {
        const filtered = (data || []).filter(m => m.season?.year === selectedYear && !m.is_playoff)
        setMatchups(filtered)
        const weeks = [...new Set(filtered.map(m => m.week))].sort((a, b) => a - b)
        if (weeks.length > 0) setSelectedWeek(weeks[weeks.length - 1])
      })
    supabase.from('teams')
      .select('*, manager:manager_id(name, slug, id), season:season_id(year)')
      .then(({ data }) => setTeams((data || []).filter(t => t.season?.year === selectedYear)))
  }, [selectedYear])

  const weeks = useMemo(() => [...new Set(matchups.map(m => m.week))].sort((a, b) => a - b), [matchups])

  // Core calculation: given matchups up to a given week, compute stats per team
  const calcRankingsForWeek = (upToWeek) => {
    if (teams.length === 0 || matchups.length === 0) return []

    const weekMatchups = matchups.filter(m => m.week <= upToWeek)
    const weeksIncluded = [...new Set(weekMatchups.map(m => m.week))].sort((a, b) => a - b)

    // Per-team score history and record
    const teamData = {}
    teams.forEach(t => {
      teamData[t.id] = {
        t,
        scores: [],
        wins: 0,
        losses: 0,
        pf: 0,
        pa: 0,
        allPlaySum: 0,
      }
    })

    weekMatchups.forEach(m => {
      const hId = m.home_team?.id
      const aId = m.away_team?.id
      if (teamData[hId]) {
        teamData[hId].scores.push(m.home_score)
        teamData[hId].pf += m.home_score
        teamData[hId].pa += m.away_score
        if (m.home_score > m.away_score) teamData[hId].wins++
        else if (m.home_score < m.away_score) teamData[hId].losses++
      }
      if (teamData[aId]) {
        teamData[aId].scores.push(m.away_score)
        teamData[aId].pf += m.away_score
        teamData[aId].pa += m.home_score
        if (m.away_score > m.home_score) teamData[aId].wins++
        else if (m.away_score < m.home_score) teamData[aId].losses++
      }
    })

    // All-play win% per week
    weeksIncluded.forEach(week => {
      const weekGames = weekMatchups.filter(m => m.week === week)
      const allScores = []
      weekGames.forEach(m => {
        allScores.push({ teamId: m.home_team?.id, score: m.home_score })
        allScores.push({ teamId: m.away_team?.id, score: m.away_score })
      })
      const n = allScores.length
      if (n < 2) return
      allScores.forEach(({ teamId, score }) => {
        if (!teamData[teamId]) return
        teamData[teamId].allPlaySum += allScores.filter(o => o.teamId !== teamId && score > o.score).length / (n - 1)
      })
    })

    const median = (arr) => {
      if (!arr.length) return 0
      const s = [...arr].sort((a, b) => a - b)
      const mid = Math.floor(s.length / 2)
      return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2
    }

    const rows = Object.values(teamData).map(({ t, scores, wins, losses, pf, pa, allPlaySum }) => {
      const games = wins + losses
      const winPct = games > 0 ? wins / games : 0
      const avgScore = scores.length > 0 ? pf / scores.length : 0
      const medianScore = median(scores)
      const allPlayWinPct = weeksIncluded.length > 0 ? allPlaySum / weeksIncluded.length : 0
      const luck = parseFloat((wins - allPlaySum).toFixed(2))
      return { t, wins, losses, pf: parseFloat(pf.toFixed(2)), pa: parseFloat(pa.toFixed(2)), winPct, avgScore, medianScore, allPlayWinPct, luck, _allPlaySum: allPlaySum }
    })

    // Normalize power score within this week's snapshot
    const maxWin = Math.max(...rows.map(r => r.winPct))
    const maxAvg = Math.max(...rows.map(r => r.avgScore))
    const maxMed = Math.max(...rows.map(r => r.medianScore))
    const maxAp = Math.max(...rows.map(r => r.allPlayWinPct))

    return rows.map(r => {
      const powerScore = parseFloat((
        (r.winPct / (maxWin || 1) * 100 * 2) +
        (r.avgScore / (maxAvg || 1) * 100 * 4) +
        (r.allPlayWinPct / (maxAp || 1) * 100 * 2) +
        (r.medianScore / (maxMed || 1) * 100 * 2)
      ) / 10).toFixed(2)
      return { ...r, powerScore: parseFloat(powerScore) }
    }).sort((a, b) => b.powerScore - a.powerScore)
      .map((r, i) => ({ ...r, rank: i + 1 }))
  }

  const currentRankings = useMemo(() => {
    if (!selectedWeek) return []
    return calcRankingsForWeek(selectedWeek)
  }, [selectedWeek, teams, matchups])

  const prevRankings = useMemo(() => {
    if (!selectedWeek || selectedWeek <= weeks[0]) return []
    const prevWeek = weeks[weeks.indexOf(selectedWeek) - 1]
    if (!prevWeek) return []
    return calcRankingsForWeek(prevWeek)
  }, [selectedWeek, weeks, teams, matchups])

  // Build delta maps from prev week
  const prevRankMap = useMemo(() => {
    const m = {}
    prevRankings.forEach(r => { m[r.t.id] = { rank: r.rank, powerScore: r.powerScore } })
    return m
  }, [prevRankings])

  const deltaRank = (teamId, currentRank) => {
    const prev = prevRankMap[teamId]
    if (!prev) return null
    return prev.rank - currentRank // positive = moved up
  }

  const deltaScore = (teamId, currentScore) => {
    const prev = prevRankMap[teamId]
    if (!prev) return null
    return parseFloat((currentScore - prev.powerScore).toFixed(2))
  }

  const DeltaBadge = ({ val, isRank }) => {
    if (val === null) return <span style={{ color: muted, fontSize: '11px' }}>—</span>
    if (val === 0) return <span style={{ color: muted, fontSize: '11px' }}>—</span>
    const up = val > 0
    const color = up ? green : red
    const prefix = up ? '▲' : '▼'
    return (
      <span style={{ color, fontSize: '11px', fontWeight: '500' }}>
        {prefix} {Math.abs(val)}{isRank ? '' : ''}
      </span>
    )
  }

  const inputStyle = {
    background: cardBg, border: `1px solid ${border}`, color: text,
    padding: '8px 14px', fontSize: '13px', fontFamily: "'Playfair Display', serif",
    cursor: 'pointer', outline: 'none',
  }

  const hStyle = (align = 'right') => ({
    padding: effectiveMobile ? '8px 8px' : '10px 14px',
    fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase',
    color: muted, textAlign: align, borderBottom: `1px solid ${border}`,
    fontWeight: '500', whiteSpace: 'nowrap',
  })

  const cStyle = (align = 'right') => ({
    padding: effectiveMobile ? '12px 8px' : '16px 14px',
    fontSize: effectiveMobile ? '12px' : '13px', textAlign: align,
    borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap',
  })

  // Mobile card
  const MobileCard = ({ r }) => {
    const dRank = deltaRank(r.t.id, r.rank)
    const dScore = deltaScore(r.t.id, r.powerScore)
    const diff = parseFloat((r.pf - r.pa).toFixed(2))
    return (
      <div style={{ background: r.rank % 2 === 0 ? cardBg : 'transparent', padding: '14px', borderBottom: `1px solid ${border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', color: r.rank <= 3 ? gold : muted, lineHeight: 1, minWidth: '28px' }}>{r.rank}</span>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: text }}>{r.t.manager?.name}</div>
              <div style={{ fontSize: '11px', color: muted }}>{r.t.team_name}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '18px', fontWeight: '600', color: text }}>{r.powerScore}</div>
            <DeltaBadge val={dScore} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {[
            ['Record', `${r.wins}-${r.losses}`],
            ['Luck', r.luck > 0 ? `+${r.luck}` : `${r.luck}`],
            ['PF', r.pf.toFixed(0)],
            ['Diff', `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}`],
          ].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '12px', color: label === 'Luck' ? (r.luck >= 0 ? green : red) : label === 'Diff' ? (diff >= 0 ? green : red) : text }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>

        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px, 6vw, 72px)', fontWeight: '400', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          Power Rankings
        </h1>
        <p style={{ color: muted, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '32px' }}>
          Weekly snapshot · cumulative through selected week
        </p>

        {/* Selectors */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '40px', flexWrap: 'wrap' }}>
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} style={inputStyle}>
            {seasons.map(s => <option key={s.year} value={s.year}>{s.year} — Year {s.season_number}</option>)}
          </select>
          <select value={selectedWeek || ''} onChange={e => setSelectedWeek(parseInt(e.target.value))} style={inputStyle} disabled={weeks.length === 0}>
            {weeks.map(w => <option key={w} value={w}>Week {w}</option>)}
          </select>
        </div>

        {/* Rankings */}
        {currentRankings.length > 0 ? (
          effectiveMobile ? (
            <div style={{ borderTop: `1px solid ${border}` }}>
              {currentRankings.map(r => <MobileCard key={r.t.id} r={r} />)}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                <thead>
                  <tr style={{ background: cardBg }}>
                    <th style={hStyle('center')}>Rank</th>
                    <th style={hStyle('center')}>±</th>
                    <th style={hStyle('left')}>Manager</th>
                    <th style={hStyle('left')}>Team</th>
                    <th style={hStyle('center')}>W</th>
                    <th style={hStyle('center')}>L</th>
                    <th style={hStyle()}>PF</th>
                    <th style={hStyle()}>PA</th>
                    <th style={hStyle()}>Diff</th>
                    <th style={hStyle()}>Avg PPG</th>
                    <th style={hStyle()}>All-Play %</th>
                    <th style={hStyle()}>Luck</th>
                    <th style={hStyle()}>Power Score</th>
                    <th style={hStyle()}>Score ±</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRankings.map((r, i) => {
                    const dRank = deltaRank(r.t.id, r.rank)
                    const dScore = deltaScore(r.t.id, r.powerScore)
                    const diff = parseFloat((r.pf - r.pa).toFixed(2))
                    return (
                      <tr key={r.t.id} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                        <td style={{ ...cStyle('center'), fontFamily: "'Playfair Display', serif", fontSize: '20px', color: r.rank <= 3 ? gold : text }}>
                          {r.rank}
                        </td>
                        <td style={{ ...cStyle('center') }}>
                          <DeltaBadge val={dRank} isRank />
                        </td>
                        <td style={{ ...cStyle('left'), fontFamily: "'Playfair Display', serif", fontSize: '15px' }}>{r.t.manager?.name}</td>
                        <td style={{ ...cStyle('left'), color: muted, fontSize: '12px' }}>{r.t.team_name}</td>
                        <td style={cStyle('center')}>{r.wins}</td>
                        <td style={cStyle('center')}>{r.losses}</td>
                        <td style={cStyle()}>{r.pf.toFixed(2)}</td>
                        <td style={cStyle()}>{r.pa.toFixed(2)}</td>
                        <td style={{ ...cStyle(), color: diff >= 0 ? green : red, fontWeight: '500' }}>
                          {diff >= 0 ? '+' : ''}{diff}
                        </td>
                        <td style={cStyle()}>{r.avgScore.toFixed(1)}</td>
                        <td style={cStyle()}>{(r.allPlayWinPct * 100).toFixed(1)}%</td>
                        <td style={{ ...cStyle(), color: r.luck >= 0 ? green : red, fontWeight: '500' }}>
                          {r.luck >= 0 ? '+' : ''}{r.luck}
                        </td>
                        <td style={{ ...cStyle(), fontWeight: '600', color: r.rank === 1 ? gold : text }}>
                          {r.powerScore}
                        </td>
                        <td style={cStyle()}>
                          <DeltaBadge val={dScore} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <p style={{ color: muted, fontSize: '14px' }}>
            {matchups.length === 0 ? 'Loading...' : 'Select a week to view rankings.'}
          </p>
        )}

        {/* Footer note */}
        {currentRankings.length > 0 && (
          <p style={{ color: muted, fontSize: '11px', marginTop: '24px', lineHeight: 1.6 }}>
            Power Score = cumulative Win%, Avg PPG, All-Play Win%, and Median Score through Week {selectedWeek}, normalized within the season.
            Luck = actual wins minus expected wins based on all-play performance.
            Δ columns reflect change from Week {weeks[weeks.indexOf(selectedWeek) - 1] ?? '—'}.
          </p>
        )}
      </div>
    </div>
  )
}
