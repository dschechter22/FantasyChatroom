'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function H2HPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt } = useLayout()

  const [managers, setManagers] = useState([])
  const [matchups, setMatchups] = useState([])
  const [selected, setSelected] = useState(null)
  const [includePlayoffs, setIncludePlayoffs] = useState(true)
  const [showRetired, setShowRetired] = useState(false)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    supabase.from('managers').select('*').then(({ data }) => setManagers(data || []))
    supabase.from('matchups').select('*, home_team:home_team_id(id, manager_id), away_team:away_team_id(id, manager_id), season:season_id(year)').then(({ data }) => setMatchups(data || []))
  }, [])

  const displayManagers = (showRetired ? managers : managers.filter(m => m.active))
    .filter(m => !searchText || m.name.toLowerCase().includes(searchText.toLowerCase()))

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
      pf += myScore; pa += theirScore
      if (myScore > theirScore) wins++
      else if (myScore < theirScore) losses++
      else ties++
    })
    return { wins, losses, ties, games: games.length, pf: parseFloat(pf.toFixed(2)), pa: parseFloat(pa.toFixed(2)) }
  }

  const getRecord = (managerAId) => {
    let wins = 0, losses = 0, ties = 0
    displayManagers.filter(m => m.id !== managerAId).forEach(opponent => {
      const h = getH2H(managerAId, opponent.id)
      wins += h.wins; losses += h.losses; ties += h.ties
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
      background: active ? text : 'none', border: `1px solid ${border}`,
      color: active ? bg : muted, padding: effectiveMobile ? '6px 10px' : '7px 18px',
      cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase',
      fontFamily: "'Inter', sans-serif", fontWeight: '500', transition: 'all 0.15s',
    }}>{label}</button>
  )

  const inputStyle = {
    background: cardBg, border: `1px solid ${border}`, color: text,
    padding: '7px 12px', fontSize: '12px', fontFamily: "'Inter', sans-serif",
    outline: 'none', width: effectiveMobile ? '100%' : '200px',
  }

  const hStyle = (align = 'right') => ({
    padding: effectiveMobile ? '8px 8px' : '10px 14px',
    fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
    color: muted, textAlign: align, borderBottom: `1px solid ${border}`,
    fontWeight: '500', whiteSpace: 'nowrap',
  })

  const cStyle = (align = 'right') => ({
    padding: effectiveMobile ? '10px 8px' : '14px',
    fontSize: effectiveMobile ? '12px' : '13px', textAlign: align,
    borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap',
  })

  const green = d ? '#6ee7b7' : '#0d6e3f'
  const red = d ? '#f87171' : '#9b1c1c'

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>

        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px, 6vw, 72px)', fontWeight: '400', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          Head-to-Head
        </h1>
        <p style={{ color: muted, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '32px' }}>
          All-time records between every manager
        </p>

        <div style={{ display: 'flex', flexDirection: effectiveMobile ? 'column' : 'row', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            placeholder="Search manager..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '40px', flexWrap: 'wrap' }}>
          {toggleBtn(includePlayoffs, 'Include Playoffs', () => setIncludePlayoffs(true))}
          {toggleBtn(!includePlayoffs, 'Regular Season Only', () => setIncludePlayoffs(false))}
          {toggleBtn(showRetired, 'Include Retired', () => setShowRetired(!showRetired))}
        </div>

        {!selected ? (
          <>
            <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '24px' }}>
              Select a manager to see their full record
            </p>

            {/* Manager cards */}
            <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1px', background: border, marginBottom: '60px' }}>
              {displayManagers.map(m => {
                const rec = getRecord(m.id)
                const pct = rec.wins + rec.losses > 0 ? ((rec.wins / (rec.wins + rec.losses)) * 100).toFixed(0) : 0
                return (
                  <div key={m.id} onClick={() => setSelected(m.id)} style={{ background: cardBg, padding: effectiveMobile ? '16px' : '24px 20px', cursor: 'pointer' }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '15px' : '18px', color: text, marginBottom: '8px' }}>
                      {m.name}
                      {!m.active && <span style={{ fontSize: '10px', color: muted, marginLeft: '6px' }}>retired</span>}
                    </div>
                    <div style={{ fontSize: '13px', color: muted }}>{rec.wins}-{rec.losses}</div>
                    <div style={{ fontSize: '11px', color: muted, marginTop: '4px' }}>{pct}% vs shown</div>
                  </div>
                )
              })}
            </div>

            {/* Matrix table -- desktop only */}
            {!effectiveMobile && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                  <thead>
                    <tr style={{ background: cardBg }}>
                      <th style={hStyle('left')}>Manager</th>
                      {displayManagers.map(m => (
                        <th key={m.id} style={hStyle('center')}>{m.name.split('/')[0]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayManagers.map((rowManager, i) => (
                      <tr key={rowManager.id} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                        <td style={{ ...cStyle('left'), fontFamily: "'Playfair Display', serif", fontSize: '15px', cursor: 'pointer' }} onClick={() => setSelected(rowManager.id)}>
                          {rowManager.name}
                          {!rowManager.active && <span style={{ fontSize: '10px', color: muted, marginLeft: '8px' }}>retired</span>}
                        </td>
                        {displayManagers.map(colManager => {
                          if (rowManager.id === colManager.id) {
                            return <td key={colManager.id} style={{ ...cStyle('center'), background: d ? '#111' : '#e0dbd3', color: muted }}>—</td>
                          }
                          const h = getH2H(rowManager.id, colManager.id)
                          const winning = h.wins > h.losses
                          const losing = h.wins < h.losses
                          return (
                            <td key={colManager.id} style={{
                              ...cStyle('center'),
                              color: h.games === 0 ? muted : winning ? green : losing ? red : text,
                              fontWeight: h.games > 0 ? '500' : '400', cursor: 'pointer',
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
            )}
          </>
        ) : (
          <>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '8px 18px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", marginBottom: '32px' }}>
              ← All Managers
            </button>

            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '28px' : '36px', fontWeight: '400', marginBottom: '32px' }}>
              {selectedManager?.name}
            </h2>

            {/* H2H breakdown */}
            <div style={{ overflowX: 'auto', marginBottom: '48px' }}>
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
                    const winPct = ((h.wins / h.games) * 100).toFixed(1)
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
                        <td style={{ ...cStyle(), color: diff >= 0 ? green : red, fontWeight: '500' }}>
                          {diff >= 0 ? '+' : ''}{diff}
                        </td>
                      </tr>
                    )
                  }).filter(Boolean)}
                </tbody>
              </table>
            </div>

            {/* Game log */}
            <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '16px' }}>Game Log</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                <thead>
                  <tr style={{ background: cardBg }}>
                    <th style={hStyle('center')}>Year</th>
                    <th style={hStyle('center')}>Wk</th>
                    <th style={hStyle('left')}>Opponent</th>
                    <th style={hStyle()}>Score</th>
                    <th style={hStyle()}>Opp</th>
                    <th style={hStyle('center')}>Result</th>
                    <th style={hStyle('center')}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {matchupHistory.map((m, i) => {
                    const iAmHome = m.home_team?.manager_id === selected
                    const myScore = iAmHome ? m.home_score : m.away_score
                    const theirScore = iAmHome ? m.away_score : m.home_score
                    const oppId = iAmHome ? m.away_team?.manager_id : m.home_team?.manager_id
                    const opp = managers.find(mg => mg.id === oppId)
                    const win = myScore > theirScore
                    const tie = myScore === theirScore
                    return (
                      <tr key={m.id} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                        <td style={{ ...cStyle('center'), color: muted }}>{m.season?.year}</td>
                        <td style={{ ...cStyle('center'), color: muted }}>{m.week}</td>
                        <td style={{ ...cStyle('left'), fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>{opp?.name || '—'}</td>
                        <td style={cStyle()}>{myScore}</td>
                        <td style={cStyle()}>{theirScore}</td>
                        <td style={{ ...cStyle('center'), color: tie ? text : win ? green : red, fontWeight: '500' }}>
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
