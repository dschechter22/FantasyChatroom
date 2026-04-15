'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function AllTimeTeamsPage() {
  const [theme, setTheme] = useState('dark')
  const [teams, setTeams] = useState([])
  const [sortKey, setSortKey] = useState('diff')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    const saved = localStorage.getItem('fc-theme') || 'dark'
    setTheme(saved)
    document.body.setAttribute('data-theme', saved)

    supabase
      .from('teams')
      .select('*, season:season_id(year), manager:manager_id(name, slug)')
      .then(({ data }) => setTeams(data || []))
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('fc-theme', next)
    document.body.setAttribute('data-theme', next)
  }

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

  const resultColor = (result) => {
    if (!result) return muted
    if (result === 'Champion') return d ? '#fcd34d' : '#92400e'
    if (result === 'Runner Up') return d ? '#d1d5db' : '#374151'
    if (result === 'Third Place') return d ? '#c084fc' : '#6b21a8'
    if (result === 'Mol Bowl Loser') return d ? '#f87171' : '#9b1c1c'
    if (result === 'Mol Bowl Winner') return d ? '#6ee7b7' : '#065f46'
    return muted
  }

  const rankedTeams = [...teams]
    .map(t => ({
      ...t,
      diff: parseFloat((t.points_for - t.points_against).toFixed(2)),
      games: t.wins + t.losses,
      ppg_diff: t.ppg_diff || parseFloat(((t.points_for - t.points_against) / (t.wins + t.losses || 1)).toFixed(2)),
    }))
    .sort((a, b) => {
      const mult = sortDir === 'desc' ? -1 : 1
      const val = (x) => {
        if (sortKey === 'diff') return x.diff
        if (sortKey === 'ppg_diff') return x.ppg_diff
        if (sortKey === 'points_for') return x.points_for
        if (sortKey === 'points_against') return x.points_against
        if (sortKey === 'wins') return x.wins
        if (sortKey === 'losses') return x.losses
        if (sortKey === 'year') return x.season?.year || 0
        if (sortKey === 'manager') return x.manager?.name || ''
        if (sortKey === 'team_name') return x.team_name || ''
        if (sortKey === 'playoff_result') return x.playoff_result || 'zzz'
        return 0
      }
      const av = val(a), bv = val(b)
      if (typeof av === 'string') return mult * av.localeCompare(bv)
      return mult * (av - bv)
    })

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

  const cStyle = (align = 'right') => ({
    padding: '16px 14px', fontSize: '13px', textAlign: align,
    borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap',
  })

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
          All-Time Teams
        </h1>
        <p style={{ color: muted, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '64px' }}>
          {teams.length} team seasons &nbsp;&middot;&nbsp; Click a column to sort
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
            <thead>
              <tr style={{ background: cardBg }}>
                <th style={hStyle('center')} onClick={() => handleSort('rank')}>Rk</th>
                <th style={hStyle('left')} onClick={() => handleSort('manager')}>Manager <SortIcon col="manager" /></th>
                <th style={hStyle('left')} onClick={() => handleSort('team_name')}>Team Name <SortIcon col="team_name" /></th>
                <th style={hStyle('center')} onClick={() => handleSort('year')}>Year <SortIcon col="year" /></th>
                <th style={hStyle()} onClick={() => handleSort('wins')}>W <SortIcon col="wins" /></th>
                <th style={hStyle()} onClick={() => handleSort('losses')}>L <SortIcon col="losses" /></th>
                <th style={hStyle()} onClick={() => handleSort('points_for')}>PF <SortIcon col="points_for" /></th>
                <th style={hStyle()} onClick={() => handleSort('points_against')}>PA <SortIcon col="points_against" /></th>
                <th style={hStyle()} onClick={() => handleSort('diff')}>Diff <SortIcon col="diff" /></th>
                <th style={hStyle()} onClick={() => handleSort('ppg_diff')}>PPG Diff <SortIcon col="ppg_diff" /></th>
                <th style={hStyle('left')} onClick={() => handleSort('playoff_result')}>Result <SortIcon col="playoff_result" /></th>
              </tr>
            </thead>
            <tbody>
              {rankedTeams.map((t, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                  <td style={{ ...cStyle('center'), color: muted, fontSize: '12px' }}>{i + 1}</td>
                  <td style={{ ...cStyle('left'), fontFamily: "'Playfair Display', serif", fontSize: '15px' }}>{t.manager?.name}</td>
                  <td style={{ ...cStyle('left'), color: muted, fontSize: '12px' }}>{t.team_name}</td>
                  <td style={{ ...cStyle('center'), color: muted }}>{t.season?.year}</td>
                  <td style={cStyle()}>{t.wins}</td>
                  <td style={cStyle()}>{t.losses}</td>
                  <td style={cStyle()}>{t.points_for.toFixed(2)}</td>
                  <td style={cStyle()}>{t.points_against.toFixed(2)}</td>
                  <td style={{
                    ...cStyle(),
                    color: t.diff >= 0 ? (d ? '#6ee7b7' : '#0d6e3f') : (d ? '#fca5a5' : '#9b1c1c'),
                    fontWeight: '500'
                  }}>
                    {t.diff >= 0 ? '+' : ''}{t.diff}
                  </td>
                  <td style={{
                    ...cStyle(),
                    color: t.ppg_diff >= 0 ? (d ? '#6ee7b7' : '#0d6e3f') : (d ? '#fca5a5' : '#9b1c1c'),
                    fontWeight: '500'
                  }}>
                    {t.ppg_diff >= 0 ? '+' : ''}{t.ppg_diff}
                  </td>
                  <td style={{ ...cStyle('left'), color: resultColor(t.playoff_result), fontWeight: t.playoff_result === 'Champion' ? '600' : '400', fontSize: '12px' }}>
                    {t.playoff_result || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
