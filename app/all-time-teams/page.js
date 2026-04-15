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

  useEffect(() => {
    const saved = localStorage.getItem('fc-theme') || 'dark'
    setTheme(saved)
    document.body.setAttribute('data-theme', saved)

    supabase
      .from('teams')
      .select(`team_name, wins, losses, points_for, points_against, season:season_id(year)`)
      .then(({ data }) => setTeams(data || []))
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('fc-theme', next)
    document.body.setAttribute('data-theme', next)
  }

  const d = theme === 'dark'
  const bg = d ? '#000' : '#f4f1ec'
  const text = d ? '#fff' : '#0d2152'
  const muted = d ? 'rgba(255,255,255,0.38)' : 'rgba(13,33,82,0.45)'
  const border = d ? 'rgba(255,255,255,0.1)' : 'rgba(13,33,82,0.14)'
  const cardBg = d ? '#0a0a0a' : '#ede9e2'

  const rankedTeams = [...teams]
    .map(t => ({
      ...t,
      diff: parseFloat((t.points_for - t.points_against).toFixed(2)),
      games: t.wins + t.losses,
      ppg_diff: parseFloat(((t.points_for - t.points_against) / (t.wins + t.losses || 1)).toFixed(2)),
    }))
    .sort((a, b) => b.diff - a.diff)

  const colStyle = (align = 'left') => ({
    padding: '16px 12px',
    fontSize: '13px',
    color: text,
    textAlign: align,
    borderBottom: `1px solid ${border}`,
  })

  const headerStyle = (align = 'left') => ({
    padding: '10px 12px',
    fontSize: '10px',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: muted,
    textAlign: align,
    borderBottom: `1px solid ${border}`,
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

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '120px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: '400', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          All-Time Teams
        </h1>
        <p style={{ color: muted, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '64px' }}>
          {teams.length} team seasons ranked by point differential
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
            <thead>
              <tr style={{ background: cardBg }}>
                <th style={headerStyle('center')}>Rk</th>
                <th style={headerStyle()}>Team</th>
                <th style={headerStyle('center')}>Year</th>
                <th style={headerStyle('center')}>W</th>
                <th style={headerStyle('center')}>L</th>
                <th style={headerStyle('right')}>PF</th>
                <th style={headerStyle('right')}>PA</th>
                <th style={headerStyle('right')}>Diff</th>
                <th style={headerStyle('right')}>PPG Diff</th>
              </tr>
            </thead>
            <tbody>
              {rankedTeams.map((t, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : cardBg }}>
                  <td style={{ ...colStyle('center'), color: muted, fontSize: '12px' }}>{i + 1}</td>
                  <td style={{ ...colStyle(), fontFamily: "'Playfair Display', serif", fontSize: '15px' }}>{t.team_name}</td>
                  <td style={{ ...colStyle('center'), color: muted }}>{t.season?.year}</td>
                  <td style={{ ...colStyle('center') }}>{t.wins}</td>
                  <td style={{ ...colStyle('center') }}>{t.losses}</td>
                  <td style={{ ...colStyle('right') }}>{t.points_for.toFixed(2)}</td>
                  <td style={{ ...colStyle('right') }}>{t.points_against.toFixed(2)}</td>
                  <td style={{
                    ...colStyle('right'),
                    color: t.diff >= 0 ? (d ? '#6ee7b7' : '#0d6e3f') : (d ? '#fca5a5' : '#9b1c1c'),
                    fontWeight: '500'
                  }}>
                    {t.diff >= 0 ? '+' : ''}{t.diff}
                  </td>
                  <td style={{
                    ...colStyle('right'),
                    color: t.ppg_diff >= 0 ? (d ? '#6ee7b7' : '#0d6e3f') : (d ? '#fca5a5' : '#9b1c1c'),
                    fontWeight: '500'
                  }}>
                    {t.ppg_diff >= 0 ? '+' : ''}{t.ppg_diff}
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
