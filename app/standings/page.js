'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function StandingsPage() {
  const [theme, setTheme] = useState('dark')
  const [managers, setManagers] = useState([])
  const [teams, setTeams] = useState([])
  const [seasons, setSeasons] = useState([])
  const [matchups, setMatchups] = useState([])
  const [expanded, setExpanded] = useState({})
  const [sortKey, setSortKey] = useState('championships')
  const [sortDir, setSortDir] = useState('desc')
  const [era, setEra] = useState('all')
  const [includePlayoffs, setIncludePlayoffs] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('fc-theme') || 'dark'
    setTheme(saved)
    document.body.setAttribute('data-theme', saved)
    supabase.from('managers').select('*').then(({ data }) => setManagers(data || []))
    supabase.from('teams').select('*, season:season_id(year)').then(({ data }) => setTeams(data || []))
    supabase.from('seasons').select('*, champion:champion_id(id), mol_bowl_winner:mol_bowl_winner_id(id), mol_bowl_loser:mol_bowl_loser_id(id)').then(({ data }) => setSeasons(data || []))
    supabase.from('matchups').select('*, home_team:home_team_id(id, manager_id), away_team:away_team_id(id, manager_id), season:season_id(year)').eq('is_playoff', true).then(({ data }) => setMatchups(data || []))
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('fc-theme', next)
    document.body.setAttribute('data-theme', next)
  }

  const toggleExpand = (slug) => setExpanded(prev => ({ ...prev, [slug]: !prev[slug] }))

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const d = theme === 'dark'
  const bg = d ? '#000' : '#f4f1ec'
  const text = d ? '#fff' : '#0d2152'
  const muted = d ? 'rgba(255,255,255,0.38)' : 'rgba(13,33,82,0.75)'
  const border = d ? 'rgba(255,255,255,0.1)' : 'rgba(13,33,82,0.14)'
  const cardBg = d ? '#0a0a0a' : '#ede9e2'
  const rowAlt = d ? '#080808' : '#e8e4dc'

  const eraYears = {
    all: null,
    pre: [2017, 2023],
    post: [2024, 2025],
  }

  const filteredTeams = teams.filter(t => {
    const range = eraYears[era]
    if (!range) return true
    return t.season.year >= range[0] && t.season.year <= range[1]
  })

  const filteredSeasons = seasons.filter(s => {
    const range = eraYears[era]
    if (!range) return true
    return s.year >= range[0] && s.year <= range[1]
  })

  const filteredMatchups = matchups.filter(m => {
    const range = eraYears[era]
    if (!range) return true
    return m.season?.year >= range[0] && m.season?.year <= range[1]
  })

  const getPlayoffStats = (managerId, seasonYear) => {
    const games = filteredMatchups.filter(m =>
      m.season?.year === seasonYear &&
      (m.home_team?.manager_id === managerId || m.away_team?.manager_id === managerId)
    )
    let pf = 0, pa = 0, wins = 0, losses = 0
    games.forEach(m => {
      const iAmHome = m.home_team?.manager_id === managerId
      const myScore = iAmHome ? m.home_score : m.away_score
      const theirScore = iAmHome ? m.away_score : m.home_score
      pf += myScore
      pa += theirScore
      if (myScore > theirScore) wins++
      else if (myScore < theirScore) losses++
    })
    return { pf, pa, wins, losses, games: games.length }
  }

  const buildManagerStats = () => {
    return managers.map(m => {
      const mTeams = filteredTeams.filter(t => t.manager_id === m.id)
      if (mTeams.length === 0) return null

      const regWins = mTeams.reduce((s, t) => s + t.wins, 0)
      const regLosses = mTeams.reduce((s, t) => s + t.losses, 0)
      const regPf = mTeams.reduce((s, t) => s + t.points_for, 0)
      const regPa = mTeams.reduce((s, t) => s + t.points_against, 0)

      let playoffWins = 0, playoffLosses = 0, playoffPf = 0, playoffPa = 0
      if (includePlayoffs) {
        mTeams.forEach(t => {
          const ps = getPlayoffStats(m.id, t.season.year)
          playoffWins += ps.wins
          playoffLosses += ps.losses
          playoffPf += ps.pf
          playoffPa += ps.pa
        })
      }

      const wins = regWins + playoffWins
      const losses = regLosses + playoffLosses
      const pf = regPf + playoffPf
      const pa = regPa + playoffPa
      const championships = filteredSeasons.filter(s => s.champion?.id === m.id).length
      const playoffAppearances = mTeams.filter(t => t.made_playoffs).length
      const molBowlLosses = filteredSeasons.filter(s => s.mol_bowl_loser?.id === m.id).length
      const winPct = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0'
      const diff = parseFloat((pf - pa).toFixed(2))
      const totalGames = wins + losses
      const ppgDiff = totalGames > 0 ? parseFloat(((pf - pa) / totalGames).toFixed(2)) : 0

      const seasonBreakdown = mTeams
        .sort((a, b) => b.season.year - a.season.year)
        .map(t => {
          const ps = includePlayoffs ? getPlayoffStats(m.id, t.season.year) : { pf: 0, pa: 0, wins: 0, losses: 0 }
          const tWins = t.wins + ps.wins
          const tLosses = t.losses + ps.losses
          const tPf = parseFloat((t.points_for + ps.pf).toFixed(2))
          const tPa = parseFloat((t.points_against + ps.pa).toFixed(2))
          const tDiff = parseFloat((tPf - tPa).toFixed(2))
          const tGames = tWins + tLosses
          const tPpgDiff = tGames > 0 ? parseFloat(((tPf - tPa) / tGames).toFixed(2)) : 0
          return {
            year: t.season.year,
            team_name: t.team_name,
            wins: tWins,
            losses: tLosses,
            pf: tPf,
            pa: tPa,
            diff: tDiff,
            ppg_diff: tPpgDiff,
            made_playoffs: t.made_playoffs,
            champion: filteredSeasons.find(s => s.year === t.season.year)?.champion?.id === m.id,
            mol_bowl_loss: filteredSeasons.find(s => s.year === t.season.year)?.mol_bowl_loser?.id === m.id,
          }
        })

      return { ...m, wins, losses, pf, pa, diff, ppgDiff, championships, playoffAppearances, molBowlLosses, winPct, seasonBreakdown, games: wins + losses }
    })
    .filter(Boolean)
    .sort((a, b) => {
      const mult = sortDir === 'desc' ? -1 : 1
      const val = (x) => {
        if (sortKey === 'winPct') return parseFloat(x.winPct)
        if (sortKey === 'diff') return x.diff
        if (sortKey === 'ppgDiff') return x.ppgDiff
        if (sortKey === 'pf') return x.pf
        if (sortKey === 'pa') return x.pa
        return x[sortKey]
      }
      return mult * (val(a) - val(b))
    })
  }

  const managerStats = buildManagerStats()

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>
    return <span style={{ marginLeft: '4px' }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const hStyle = (align = 'right') => ({
    padding: '10px 14px', fontSize: '10px', letterSpacing: '0.18em',
    textTransform: 'uppercase', color: muted, textAlign: align,
    borderBottom: `1px solid ${border}`, fontWeight: '500',
    whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
  })

  const cStyle = (align = 'right', bold = false) => ({
    padding: '18px 14px', fontSize: '13px', textAlign: align,
    borderBottom: `1px solid ${border}`, color: text,
    fontWeight: bold ? '600' : '400', whiteSpace: 'nowrap',
  })

  const scStyle = (align = 'right') => ({
    padding: '12px 14px', fontSize: '12px', textAlign: align,
    borderBottom: `1px solid ${border}`, color: muted, whiteSpace: 'nowrap',
  })

  const filterBtn = (active, label, onClick) => (
    <button onClick={onClick} style={{
      background: active ? text : 'none',
      border: `1px solid ${border}`,
      color: active ? bg : muted,
      padding: '7px 18px', cursor: 'pointer',
      fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase',
      fontFamily: "'Inter', sans-serif", fontWeight: '500', transition: 'all 0.15s',
    }}>{label}</button>
  )

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

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: '400', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          All-Time Standings
        </h1>
        <p style={{ color: muted, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '40px' }}>
          Career records across all seasons &nbsp;&middot;&nbsp; Click a row to expand &nbsp;&middot;&nbsp; Click a column to sort
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {filterBtn(era === 'all', 'All Years', () => setEra('all'))}
          {filterBtn(era === 'pre', 'Pre-Danflation (2017-2023)', () => setEra('pre'))}
          {filterBtn(era === 'post', 'Danflation Era (2024-2025)', () => setEra('post'))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '40px', flexWrap: 'wrap' }}>
          {filterBtn(!includePlayoffs, 'Regular Season Only', () => setIncludePlayoffs(false))}
          {filterBtn(includePlayoffs, 'Include Playoffs', () => setIncludePlayoffs(true))}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
            <thead>
              <tr style={{ background: cardBg }}>
                <th style={hStyle('left')} onClick={() => handleSort('name')}>Manager <SortIcon col="name" /></th>
                <th style={hStyle()} onClick={() => handleSort('wins')}>W <SortIcon col="wins" /></th>
                <th style={hStyle()} onClick={() => handleSort('losses')}>L <SortIcon col="losses" /></th>
                <th style={hStyle()} onClick={() => handleSort('winPct')}>Win % <SortIcon col="winPct" /></th>
                <th style={hStyle()} onClick={() => handleSort('pf')}>PF <SortIcon col="pf" /></th>
                <th style={hStyle()} onClick={() => handleSort('pa')}>PA <SortIcon col="pa" /></th>
                <th style={hStyle()} onClick={() => handleSort('diff')}>Diff <SortIcon col="diff" /></th>
                <th style={hStyle()} onClick={() => handleSort('ppgDiff')}>PPG Diff <SortIcon col="ppgDiff" /></th>
                <th style={hStyle()} onClick={() => handleSort('championships')}>Titles <SortIcon col="championships" /></th>
                <th style={hStyle()} onClick={() => handleSort('playoffAppearances')}>Playoffs <SortIcon col="playoffAppearances" /></th>
                <th style={hStyle()} onClick={() => handleSort('molBowlLosses')}>Mol Bowls <SortIcon col="molBowlLosses" /></th>
                <th style={hStyle('center')}></th>
              </tr>
            </thead>
            <tbody>
              {managerStats.map((m, i) => (
                <>
                  <tr key={m.slug} onClick={() => toggleExpand(m.slug)} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt, cursor: 'pointer' }}>
                    <td style={{ ...cStyle('left', true), fontFamily: "'Playfair Display', serif", fontSize: '16px' }}>
                      {m.name}
                      {!m.active && <span style={{ fontSize: '10px', color: muted, marginLeft: '8px', letterSpacing: '0.1em' }}>retired</span>}
                    </td>
                    <td style={cStyle()}>{m.wins}</td>
                    <td style={cStyle()}>{m.losses}</td>
                    <td style={cStyle()}>{m.winPct}%</td>
                    <td style={cStyle()}>{m.pf.toFixed(0)}</td>
                    <td style={cStyle()}>{m.pa.toFixed(0)}</td>
                    <td style={{ ...cStyle(), color: m.diff >= 0 ? (d ? '#6ee7b7' : '#0d6e3f') : (d ? '#fca5a5' : '#9b1c1c'), fontWeight: '500' }}>
                      {m.diff >= 0 ? '+' : ''}{m.diff.toFixed(0)}
                    </td>
                    <td style={{ ...cStyle(), color: m.ppgDiff >= 0 ? (d ? '#6ee7b7' : '#0d6e3f') : (d ? '#fca5a5' : '#9b1c1c'), fontWeight: '500' }}>
                      {m.ppgDiff >= 0 ? '+' : ''}{m.ppgDiff}
                    </td>
                    <td style={{ ...cStyle(), color: m.championships > 0 ? (d ? '#fcd34d' : '#92400e') : text }}>
                      {m.championships > 0 ? m.championships : '—'}
                    </td>
                    <td style={cStyle()}>{m.playoffAppearances}</td>
                    <td style={{ ...cStyle(), color: m.molBowlLosses > 0 ? (d ? '#f87171' : '#9b1c1c') : text }}>
                      {m.molBowlLosses > 0 ? m.molBowlLosses : '—'}
                    </td>
                    <td style={{ ...cStyle('center'), color: muted, fontSize: '11px' }}>
                      {expanded[m.slug] ? '▲' : '▼'}
                    </td>
                  </tr>

                  {expanded[m.slug] && (
                    <tr key={`${m.slug}-expanded`}>
                      <td colSpan={12} style={{ padding: '0', borderBottom: `1px solid ${border}` }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: d ? '#050505' : '#e4e0d8' }}>
                          <thead>
                            <tr>
                              <th style={hStyle('left')}>Year</th>
                              <th style={hStyle('left')}>Team Name</th>
                              <th style={hStyle()}>W</th>
                              <th style={hStyle()}>L</th>
                              <th style={hStyle()}>PF</th>
                              <th style={hStyle()}>PA</th>
                              <th style={hStyle()}>Diff</th>
                              <th style={hStyle()}>PPG Diff</th>
                              <th style={hStyle()}>Playoffs</th>
                              <th style={hStyle()}>Title</th>
                              <th style={hStyle()}>Mol Bowl</th>
                              <th style={hStyle()}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {m.seasonBreakdown.map(s => (
                              <tr key={s.year}>
                                <td style={scStyle('left')}>{s.year}</td>
                                <td style={{ ...scStyle('left'), fontFamily: "'Playfair Display', serif", fontSize: '13px', color: text }}>{s.team_name}</td>
                                <td style={scStyle()}>{s.wins}</td>
                                <td style={scStyle()}>{s.losses}</td>
                                <td style={scStyle()}>{s.pf.toFixed(2)}</td>
                                <td style={scStyle()}>{s.pa.toFixed(2)}</td>
                                <td style={{ ...scStyle(), color: s.diff >= 0 ? (d ? '#6ee7b7' : '#0d6e3f') : (d ? '#fca5a5' : '#9b1c1c') }}>
                                  {s.diff >= 0 ? '+' : ''}{s.diff}
                                </td>
                                <td style={{ ...scStyle(), color: s.ppg_diff >= 0 ? (d ? '#6ee7b7' : '#0d6e3f') : (d ? '#fca5a5' : '#9b1c1c') }}>
                                  {s.ppg_diff >= 0 ? '+' : ''}{s.ppg_diff}
                                </td>
                                <td style={{ ...scStyle(), color: s.made_playoffs ? (d ? '#6ee7b7' : '#0d6e3f') : muted }}>
                                  {s.made_playoffs ? 'Yes' : 'No'}
                                </td>
                                <td style={{ ...scStyle(), color: s.champion ? (d ? '#fcd34d' : '#92400e') : muted }}>
                                  {s.champion ? 'Champion' : '—'}
                                </td>
                                <td style={{ ...scStyle(), color: s.mol_bowl_loss ? (d ? '#f87171' : '#9b1c1c') : muted }}>
                                  {s.mol_bowl_loss ? 'Loser' : '—'}
                                </td>
                                <td style={scStyle()}></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
