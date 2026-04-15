'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function H2HPage() {
  const [theme, setTheme] = useState('dark')
  const [managers, setManagers] = useState([])
  const [matchups, setMatchups] = useState([])
  const [selected, setSelected] = useState(null)
  const [includePlayoffs, setIncludePlayoffs] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('fc-theme') || 'dark'
    setTheme(saved)
    document.body.setAttribute('data-theme', saved)

    supabase.from('managers').select('*').then(({ data }) => setManagers(data || []))
    supabase.from('matchups').select('*, home_team:home_team_id(id, manager_id), away_team:away_team_id(id, manager_id), season:season_id(year)').then(({ data }) => setMatchups(data || []))
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
  const muted = d ? 'rgba(255,255,255,0.38)' : 'rgba(13,33,82,0.75)'
  const border = d ? 'rgba(255,255,255,0.1)' : 'rgba(13,33,82,0.14)'
  const cardBg = d ? '#0a0a0a' : '#ede9e2'
  const rowAlt = d ? '#080808' : '#e8e4dc'

  const activeManagers = managers.filter(m => m.active)

  const filteredMatchups = matchups.filter(m => includePlayoffs ? true : !m.is_playoff)

  const getH2H = (managerA, managerB) => {
    const games = filteredMatchups.filter(m => {
      const homeId = m.home_team?.manager_id
      const awayId = m.away_team?.manager_id
      return (homeId === managerA && awayId === managerB) || (homeId === managerB && awayId === managerA)
    })

    let wins = 0, losses = 0, ties = 0, pf = 0, pa = 0
    games.forEach(m => {
      const iAmHome = m.home_team?.manager_id === managerA
      const myScore = iAmHome ? m.home_score : m.away_score
      const theirScore = iAmHome ? m.away_score : m.home_score
      pf += myScore
      pa += theirScore
      if (myScore > theirScore) wins++
      else if (myScore < theirScore) losses++
      else ties++
    })

    return { wins, losses, ties, games: games.length, pf: parseFloat(pf.toFixed(2)), pa: parseFloat(pa.toFixed(2)) }
  }

  const getRecord = (managerAId) => {
    let wins = 0, losses = 0, ties = 0
    activeManagers.filter(m => m.id !== managerAId).forEach(opponent => {
      const h = getH2H(managerAId, opponent.id)
      wins += h.wins
      losses += h.losses
      ties += h.ties
    })
    return { wins, losses, ties }
  }

  const selectedManager = managers.find(m => m.id === selected)

  const matchupHistory = selected ? filteredMatchups.filter(m => {
    const homeId = m.home_team?.manager_id
    const awayId = m.away_team?.manager_id
    return homeId === selected || awayId === selected
  }).sort((a, b) => {
    if (a.season?.year !== b.season?.year) return b.season?.year - a.season?.year
    return b.week - a.week
  }) : []

  const toggleBtn = (active, label, onClick) => (
    <button onClick={onClick} style={{
      background: active ? text : 'none',
      border: `1px solid ${border}`,
      color: active ? bg : muted,
      padding: '7px 18px', cursor: 'pointer',
      fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase',
      fontFamily: "'Inter', sans-serif", fontWeight: '500', transition: 'all 0.15s',
    }}>{label}</button>
  )

  const hStyle = (align = 'right') => ({
    padding: '10px 14px', fontSize: '10px', letterSpacing: '0.18em',
    textTransform: 'uppercase', color: muted, textAlign: align,
    borderBottom: `1px solid ${border}`, fontWeight: '500', whiteSpace: 'nowrap',
  })

  const cStyle = (align = 'right') => ({
    padding: '14px', fontSize: '13px', textAlign: align,
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
          Head-to-Head
        </h1>
        <p style={{ color: muted, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '40px' }}>
          All-time records between every manager
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '40px' }}>
          {toggleBtn(includePlayoffs, 'Include Playoffs', () => setIncludePlayoffs(true))}
          {toggleBtn(!includePlayoffs, 'Regular Season Only', () => setIncludePlayoffs(false))}
        </div>

        {!selected ? (
          <>
            <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '24px' }}>
              Select a manager to see their full record
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1px', background: border, marginBottom: '60px' }}>
              {activeManagers.map(m => {
                const rec = getRecord(m.id)
                const pct = rec.wins + rec.losses > 0 ? ((rec.wins / (rec.wins + rec.losses)) * 100).toFixed(0) : 0
                return (
                  <div key={m.id} onClick={() => setSelected(m.id)} style={{ background: cardBg, padding: '24px 20px', cursor: 'pointer' }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: text, marginBottom: '8px' }}>{m.name}</div>
                    <div style={{ fontSize: '13px', color: muted }}>{rec.wins}-{rec.losses}</div>
                    <div style={{ fontSize: '11px', color: muted, marginTop: '4px' }}>{pct}% vs active</div>
                  </div>
                )
              })}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                <thead>
                  <tr style={{ background: cardBg }}>
                    <th style={hStyle('left')}>Manager</th>
                    {activeManagers.map(m => (
                      <th key={m.id} style={hStyle('center')}>{m.name.split('/')[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeManagers.map((rowManager, i) => (
                    <tr key={rowManager.id} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                      <td style={{ ...cStyle('left'), fontFamily: "'Playfair Display', serif", fontSize: '15px', cursor: 'pointer' }} onClick={() => setSelected(rowManager.id)}>
                        {rowManager.name}
                      </td>
                      {activeManagers.map(colManager => {
                        if (rowManager.id === colManager.id) {
                          return <td key={colManager.id} style={{ ...cStyle('center'), background: d ? '#111' : '#e0dbd3', color: muted }}>—</td>
                        }
                        const h = getH2H(rowManager.id, colManager.id)
                        const winning = h.wins > h.losses
                        const losing = h.wins < h.losses
                        return (
                          <td key={colManager.id} style={{
                            ...cStyle('center'),
                            color: h.games === 0 ? muted : winning ? (d ? '#6ee7b7' : '#0d6e3f') : losing ? (d ? '#f87171' : '#9b1c1c') : text,
                            fontWeight: h.games > 0 ? '500' : '400',
                            cursor: 'pointer',
                          }} onClick={() => setSelected(rowManager.id)}>
                            {h.games === 0 ? '—' : `${h.wins}-${h.losses}`}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '8px 18px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", marginBottom: '32px' }}>
              ← All Managers
            </button>

            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '36px', fontWeight: '400', marginBottom: '40px' }}>
              {selectedManager?.name}
            </h2>

            <div style={{ overflowX: 'auto', marginBottom: '60px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                <thead>
                  <tr style={{ background: cardBg }}>
                    <th style={hStyle('left')}>Opponent</th>
                    <th style={hStyle()}>W</th>
                    <th style={hStyle()}>L</th>
                    <th style={hStyle()}>Games</th>
                    <th style={hStyle()}>Win %</th>
                    <th style={hStyle()}>PF</th>
                    <th style={hStyle()}>PA</th>
                    <th style={hStyle()}>Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {managers.filter(m => m.id !== selected).map((opponent, i) => {
                    const h = getH2H(selected, opponent.id)
                    if (h.games === 0) return null
                    const winPct = h.games > 0 ? ((h.wins / h.games) * 100).toFixed(1) : '0.0'
                    const diff = parseFloat((h.pf - h.pa).toFixed(2))
                    return (
                      <tr key={opponent.id} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                        <td style={{ ...cStyle('left'), fontFamily: "'Playfair Display', serif", fontSize: '15px' }}>
                          {opponent.name}
                          {!opponent.active && <span style={{ fontSize: '10px', color: muted, marginLeft: '8px' }}>retired</span>}
                        </td>
                        <td style={cStyle()}>{h.wins}</td>
                        <td style={cStyle()}>{h.losses}</td>
                        <td style={cStyle()}>{h.games}</td>
                        <td style={cStyle()}>{winPct}%</td>
                        <td style={cStyle()}>{h.pf.toFixed(2)}</td>
                        <td style={cStyle()}>{h.pa.toFixed(2)}</td>
                        <td style={{ ...cStyle(), color: diff >= 0 ? (d ? '#6ee7b7' : '#0d6e3f') : (d ? '#f87171' : '#9b1c1c'), fontWeight: '500' }}>
                          {diff >= 0 ? '+' : ''}{diff}
                        </td>
                      </tr>
                    )
                  }).filter(Boolean)}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '24px' }}>
              Game Log
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                <thead>
                  <tr style={{ background: cardBg }}>
                    <th style={hStyle('center')}>Year</th>
                    <th style={hStyle('center')}>Week</th>
                    <th style={hStyle('left')}>Opponent</th>
                    <th style={hStyle()}>Score</th>
                    <th style={hStyle()}>Opp Score</th>
                    <th style={hStyle('center')}>Result</th>
                    <th style={hStyle('center')}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {matchupHistory.map((m, i) => {
                    const iAmHome = m.home_team?.manager_id === selected
                    const myScore = iAmHome ? m.home_score : m.away_score
                    const theirScore = iAmHome ? m.away_score : m.home_score
                    const opponentId = iAmHome ? m.away_team?.manager_id : m.home_team?.manager_id
                    const opponent = managers.find(mg => mg.id === opponentId)
                    const win = myScore > theirScore
                    const tie = myScore === theirScore
                    return (
                      <tr key={m.id} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                        <td style={{ ...cStyle('center'), color: muted }}>{m.season?.year}</td>
                        <td style={{ ...cStyle('center'), color: muted }}>{m.week}</td>
                        <td style={{ ...cStyle('left'), fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>{opponent?.name || '—'}</td>
                        <td style={cStyle()}>{myScore}</td>
                        <td style={cStyle()}>{theirScore}</td>
                        <td style={{ ...cStyle('center'), color: tie ? text : win ? (d ? '#6ee7b7' : '#0d6e3f') : (d ? '#f87171' : '#9b1c1c'), fontWeight: '500' }}>
                          {tie ? 'T' : win ? 'W' : 'L'}
                        </td>
                        <td style={{ ...cStyle('center'), color: muted, fontSize: '11px' }}>
                          {m.is_playoff ? 'Playoff' : 'Reg'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
