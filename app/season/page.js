'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function SeasonPage() {
  const [theme, setTheme] = useState('dark')
  const [seasons, setSeasons] = useState([])
  const [selectedYear, setSelectedYear] = useState(2025)
  const [matchups, setMatchups] = useState([])
  const [teams, setTeams] = useState([])
  const [managers, setManagers] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('fc-theme') || 'dark'
    setTheme(saved)
    document.body.setAttribute('data-theme', saved)
    supabase.from('seasons').select('year, season_number').order('year', { ascending: false }).then(({ data }) => setSeasons(data || []))
    supabase.from('managers').select('*').then(({ data }) => setManagers(data || []))
  }, [])

  useEffect(() => {
    setSelectedTeam(null)
    supabase
      .from('matchups')
      .select('*, home_team:home_team_id(id, manager_id, team_name), away_team:away_team_id(id, manager_id, team_name)')
      .eq('season_id', `(select id from seasons where year=${selectedYear})`)
      .then(() => {})

    supabase
      .from('matchups')
      .select('*, home_team:home_team_id(id, manager_id, team_name), away_team:away_team_id(id, manager_id, team_name), season:season_id(year)')
      .eq('season.year', selectedYear)
      .then(({ data }) => setMatchups((data || []).filter(m => m.season?.year === selectedYear)))

    supabase
      .from('teams')
      .select('*, manager:manager_id(name, slug), season:season_id(year)')
      .eq('season.year', selectedYear)
      .then(({ data }) => setTeams((data || []).filter(t => t.season?.year === selectedYear).sort((a, b) => a.final_standing - b.final_standing)))
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
  const muted = d ? 'rgba(255,255,255,0.38)' : 'rgba(13,33,82,0.75)'
  const border = d ? 'rgba(255,255,255,0.1)' : 'rgba(13,33,82,0.14)'
  const cardBg = d ? '#0a0a0a' : '#ede9e2'
  const rowAlt = d ? '#080808' : '#e8e4dc'

  const regMatchups = matchups.filter(m => !m.is_playoff)
  const playoffMatchups = matchups.filter(m => m.is_playoff)

  const weeks = [...new Set(regMatchups.map(m => m.week))].sort((a, b) => a - b)
  const playoffWeeks = [...new Set(playoffMatchups.map(m => m.week))].sort((a, b) => a - b)

  const filteredReg = selectedTeam
    ? regMatchups.filter(m => m.home_team?.id === selectedTeam || m.away_team?.id === selectedTeam)
    : regMatchups

  const filteredPlayoff = selectedTeam
    ? playoffMatchups.filter(m => m.home_team?.id === selectedTeam || m.away_team?.id === selectedTeam)
    : playoffMatchups

  const getManagerName = (managerId) => managers.find(m => m.id === managerId)?.name || '—'

  const hStyle = (align = 'left') => ({
    padding: '10px 14px', fontSize: '10px', letterSpacing: '0.18em',
    textTransform: 'uppercase', color: muted, textAlign: align,
    borderBottom: `1px solid ${border}`, fontWeight: '500', whiteSpace: 'nowrap',
  })

  const cStyle = (align = 'left') => ({
    padding: '14px', fontSize: '13px', textAlign: align,
    borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap',
  })

  const selectedTeamData = teams.find(t => t.id === selectedTeam)

  const weekLabel = (week, isPlayoff) => {
    if (!isPlayoff) return `Week ${week}`
    const playoffWeeksSorted = [...new Set(playoffMatchups.map(m => m.week))].sort((a, b) => a - b)
    const idx = playoffWeeksSorted.indexOf(week)
    const labels = ['Round 1', 'Round 2', 'Championship']
    return labels[idx] !== undefined ? labels[idx] : `Playoff Week ${week}`
  }

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

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', marginBottom: '48px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: '400', letterSpacing: '-0.02em' }}>
              Season
            </h1>
          </div>
          <div style={{ paddingBottom: '8px' }}>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              style={{
                background: cardBg, color: text, border: `1px solid ${border}`,
                padding: '10px 16px', fontSize: '14px', fontFamily: "'Playfair Display', serif",
                cursor: 'pointer', outline: 'none', appearance: 'none',
                paddingRight: '32px',
              }}
            >
              {seasons.map(s => (
                <option key={s.year} value={s.year}>{s.year} — Year {s.season_number}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Standings bar */}
        {teams.length > 0 && (
          <div style={{ marginBottom: '48px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: muted, marginBottom: '16px' }}>Final Standings</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                <thead>
                  <tr style={{ background: cardBg }}>
                    <th style={hStyle('center')}>Rk</th>
                    <th style={hStyle()}>Manager</th>
                    <th style={hStyle()}>Team</th>
                    <th style={hStyle('center')}>W</th>
                    <th style={hStyle('center')}>L</th>
                    <th style={hStyle('right')}>PF</th>
                    <th style={hStyle('right')}>PA</th>
                    <th style={hStyle('right')}>Diff</th>
                    <th style={hStyle('center')}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t, i) => {
                    const diff = parseFloat((t.points_for - t.points_against).toFixed(2))
                    const isSelected = selectedTeam === t.id
                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTeam(isSelected ? null : t.id)}
                        style={{
                          background: isSelected ? (d ? '#1a1a2e' : '#dde4f0') : i % 2 === 0 ? 'transparent' : rowAlt,
                          cursor: 'pointer',
                          outline: isSelected ? `1px solid ${d ? '#4455aa' : '#0d2152'}` : 'none',
                        }}
                      >
                        <td style={{ ...cStyle('center'), color: muted }}>{t.final_standing}</td>
                        <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif", fontSize: '15px' }}>{t.manager?.name}</td>
                        <td style={{ ...cStyle(), color: muted, fontSize: '12px' }}>{t.team_name}</td>
                        <td style={cStyle('center')}>{t.wins}</td>
                        <td style={cStyle('center')}>{t.losses}</td>
                        <td style={cStyle('right')}>{t.points_for.toFixed(2)}</td>
                        <td style={cStyle('right')}>{t.points_against.toFixed(2)}</td>
                        <td style={{ ...cStyle('right'), color: diff >= 0 ? (d ? '#6ee7b7' : '#0d6e3f') : (d ? '#f87171' : '#9b1c1c'), fontWeight: '500' }}>
                          {diff >= 0 ? '+' : ''}{diff}
                        </td>
                        <td style={{ ...cStyle('center'), fontSize: '12px', color: t.playoff_result === 'Champion' ? (d ? '#fcd34d' : '#92400e') : t.playoff_result?.includes('Mol Bowl') ? (d ? '#f87171' : '#9b1c1c') : muted }}>
                          {t.playoff_result || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {selectedTeam && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: muted }}>
                  Showing schedule for <span style={{ color: text, fontFamily: "'Playfair Display', serif" }}>{selectedTeamData?.manager?.name}</span>
                </span>
                <button onClick={() => setSelectedTeam(null)} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '4px 12px', cursor: 'pointer', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {/* Regular season schedule */}
        {weeks.length > 0 && (
          <div style={{ marginBottom: '60px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: muted, marginBottom: '24px' }}>Regular Season</p>
            {weeks.map(week => {
              const weekGames = filteredReg.filter(m => m.week === week)
              if (weekGames.length === 0) return null
              return (
                <div key={week} style={{ marginBottom: '32px' }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: muted, marginBottom: '10px', paddingLeft: '14px' }}>
                    Week {week}
                  </p>
                  <div style={{ borderTop: `1px solid ${border}` }}>
                    {weekGames.map((m, i) => {
                      const homeManager = getManagerName(m.home_team?.manager_id)
                      const awayManager = getManagerName(m.away_team?.manager_id)
                      const homeWon = m.home_score > m.away_score
                      const awayWon = m.away_score > m.home_score
                      const isHighlighted = selectedTeam && (m.home_team?.id === selectedTeam || m.away_team?.id === selectedTeam)
                      return (
                        <div key={m.id} style={{
                          display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                          alignItems: 'center', padding: '14px',
                          borderBottom: `1px solid ${border}`,
                          background: isHighlighted ? (d ? '#0d0d1a' : '#e8edf5') : i % 2 === 0 ? 'transparent' : rowAlt,
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: awayWon ? muted : text }}>{awayManager}</span>
                            <span style={{ fontSize: '11px', color: muted }}>{m.away_team?.team_name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '0 20px' }}>
                            <span style={{ fontSize: '16px', fontWeight: '600', color: awayWon ? text : muted, minWidth: '60px', textAlign: 'right' }}>{m.away_score}</span>
                            <span style={{ fontSize: '11px', color: muted }}>–</span>
                            <span style={{ fontSize: '16px', fontWeight: '600', color: homeWon ? text : muted, minWidth: '60px', textAlign: 'left' }}>{m.home_score}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'right' }}>
                            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: homeWon ? text : muted }}>{homeManager}</span>
                            <span style={{ fontSize: '11px', color: muted }}>{m.home_team?.team_name}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Playoffs */}
        {playoffWeeks.length > 0 && (
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: muted, marginBottom: '24px' }}>Playoffs</p>
            {playoffWeeks.map(week => {
              const weekGames = filteredPlayoff.filter(m => m.week === week)
              if (weekGames.length === 0) return null
              return (
                <div key={week} style={{ marginBottom: '32px' }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: muted, marginBottom: '10px', paddingLeft: '14px' }}>
                    {weekLabel(week, true)}
                  </p>
                  <div style={{ borderTop: `1px solid ${border}` }}>
                    {weekGames.map((m, i) => {
                      const homeManager = getManagerName(m.home_team?.manager_id)
                      const awayManager = getManagerName(m.away_team?.manager_id)
                      const homeWon = m.home_score > m.away_score
                      const awayWon = m.away_score > m.home_score
                      const isHighlighted = selectedTeam && (m.home_team?.id === selectedTeam || m.away_team?.id === selectedTeam)
                      return (
                        <div key={m.id} style={{
                          display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                          alignItems: 'center', padding: '14px',
                          borderBottom: `1px solid ${border}`,
                          background: isHighlighted ? (d ? '#0d0d1a' : '#e8edf5') : i % 2 === 0 ? 'transparent' : rowAlt,
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: awayWon ? muted : text }}>{awayManager}</span>
                            <span style={{ fontSize: '11px', color: muted }}>{m.away_team?.team_name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '0 20px' }}>
                            <span style={{ fontSize: '16px', fontWeight: '600', color: awayWon ? text : muted, minWidth: '60px', textAlign: 'right' }}>{m.away_score}</span>
                            <span style={{ fontSize: '11px', color: muted }}>–</span>
                            <span style={{ fontSize: '16px', fontWeight: '600', color: homeWon ? text : muted, minWidth: '60px', textAlign: 'left' }}>{m.home_score}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'right' }}>
                            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: homeWon ? text : muted }}>{homeManager}</span>
                            <span style={{ fontSize: '11px', color: muted }}>{m.home_team?.team_name}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {matchups.length === 0 && teams.length === 0 && (
          <p style={{ color: muted, fontSize: '14px' }}>No data available for this season yet.</p>
        )}
      </div>
    </div>
  )
}
