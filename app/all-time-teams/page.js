'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const RESULT_OPTIONS = ['All', 'Champion', 'Runner Up', 'Third Place', 'Mol Bowl Loser', 'Made Playoffs', 'Missed Playoffs']

export default function AllTimeTeamsPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, green, red, gold, blue } = useLayout()

  const [teams, setTeams] = useState([])
  const [sortKey, setSortKey] = useState('points_for')
  const [sortDir, setSortDir] = useState('desc')
  const [includePlayoffs, setIncludePlayoffs] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filterYear, setFilterYear] = useState('all')
  const [filterManager, setFilterManager] = useState('all')
  const [filterResult, setFilterResult] = useState('All')

  useEffect(() => {
    supabase.from('teams')
      .select('*, manager:manager_id(name, slug), season:season_id(year)')
      .then(({ data }) => setTeams(data || []))
  }, [])

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const allYears = [...new Set(teams.map(t => t.season?.year))].filter(Boolean).sort((a, b) => b - a)
  const allManagers = [...new Map(teams.map(t => [t.manager?.slug, t.manager?.name])).entries()]
    .filter(([slug]) => slug)
    .sort((a, b) => a[1].localeCompare(b[1]))

  const resultColor = (result) => {
    if (!result) return muted
    if (result === 'Champion') return gold
    if (result === 'Runner Up') return d ? 'rgba(192,192,192,0.9)' : '#555'
    if (result === 'Third Place') return d ? '#cd7f32' : '#7c4a00'
    if (result?.includes('Mol Bowl')) return red
    return muted
  }

  const matchesResultFilter = (t) => {
    if (filterResult === 'All') return true
    if (filterResult === 'Champion') return t.playoff_result === 'Champion'
    if (filterResult === 'Runner Up') return t.playoff_result === 'Runner Up'
    if (filterResult === 'Third Place') return t.playoff_result === 'Third Place'
    if (filterResult === 'Mol Bowl Loser') return t.playoff_result?.includes('Mol Bowl')
    if (filterResult === 'Made Playoffs') return t.made_playoffs
    if (filterResult === 'Missed Playoffs') return !t.made_playoffs
    return true
  }

  const filteredTeams = teams
    .filter(t => {
      if (filterYear !== 'all' && t.season?.year !== parseInt(filterYear)) return false
      if (filterManager !== 'all' && t.manager?.slug !== filterManager) return false
      if (!matchesResultFilter(t)) return false
      if (searchText) {
        const q = searchText.toLowerCase()
        if (!t.manager?.name?.toLowerCase().includes(q) && !t.team_name?.toLowerCase().includes(q)) return false
      }
      return true
    })
    .map(t => {
      const pf = t.points_for
      const pa = t.points_against
      const diff = parseFloat((pf - pa).toFixed(2))
      const games = t.wins + t.losses
      const ppgDiff = games > 0 ? parseFloat(((pf - pa) / games).toFixed(2)) : 0
      return { ...t, diff, ppgDiff }
    })
    .sort((a, b) => {
      const mult = sortDir === 'desc' ? -1 : 1
      const val = (x) => {
        if (sortKey === 'year') return x.season?.year
        if (sortKey === 'manager') return x.manager?.name || ''
        if (sortKey === 'team_name') return x.team_name || ''
        if (sortKey === 'winPct') return x.wins / Math.max(x.wins + x.losses, 1)
        return x[sortKey] ?? 0
      }
      const av = val(a), bv = val(b)
      if (typeof av === 'string') return mult * av.localeCompare(bv)
      return mult * (av - bv)
    })

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span style={{ opacity: 0.3, marginLeft: '3px' }}>↕</span>
    return <span style={{ marginLeft: '3px' }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const filterBtn = (active, label, onClick) => (
    <button onClick={onClick} style={{
      background: active ? text : 'none', border: `1px solid ${border}`,
      color: active ? bg : muted, padding: effectiveMobile ? '6px 10px' : '7px 16px',
      cursor: 'pointer', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
      fontFamily: "'Inter', sans-serif", fontWeight: '500', transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>{label}</button>
  )

  const inputStyle = {
    background: cardBg, border: `1px solid ${border}`, color: text,
    padding: '7px 12px', fontSize: '12px', fontFamily: "'Inter', sans-serif",
    outline: 'none', width: effectiveMobile ? '100%' : '180px',
  }

  const selectStyle = { ...inputStyle, cursor: 'pointer' }

  const hStyle = (align = 'right') => ({
    padding: '10px 12px', fontSize: '10px', letterSpacing: '0.14em',
    textTransform: 'uppercase', color: muted, textAlign: align,
    borderBottom: `1px solid ${border}`, fontWeight: '500',
    whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
  })

  const cStyle = (align = 'right') => ({
    padding: '14px 12px', fontSize: '13px', textAlign: align,
    borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap',
  })

  // Mobile card
  const MobileTeamCard = ({ t, i }) => (
    <div style={{ background: i % 2 === 0 ? 'transparent' : cardBg, padding: '14px', borderBottom: `1px solid ${border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: text }}>{t.manager?.name}</div>
          <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>{t.team_name} · {t.season?.year}</div>
        </div>
        <div style={{ fontSize: '12px', color: resultColor(t.playoff_result), textAlign: 'right', fontWeight: '500' }}>
          {t.playoff_result || (t.made_playoffs ? 'Playoffs' : '—')}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          ['Record', `${t.wins}-${t.losses}`],
          ['PF', t.points_for.toFixed(0)],
          ['PA', t.points_against.toFixed(0)],
          ['Diff', `${t.diff >= 0 ? '+' : ''}${t.diff.toFixed(0)}`],
        ].map(([label, val]) => (
          <div key={label}>
            <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '13px', color: label === 'Diff' ? (t.diff >= 0 ? green : red) : text }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>

        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px, 6vw, 72px)', fontWeight: '400', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          All-Time Teams
        </h1>
        <p style={{ color: muted, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '32px' }}>
          {filteredTeams.length} team seasons · click column to sort
        </p>

        {/* Filters */}
        <div style={{ display: 'flex', flexDirection: effectiveMobile ? 'column' : 'row', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <input
            placeholder="Search manager or team..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ ...inputStyle, width: effectiveMobile ? '100%' : '220px' }}
          />
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={selectStyle}>
            <option value="all">All Years</option>
            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterManager} onChange={e => setFilterManager(e.target.value)} style={selectStyle}>
            <option value="all">All Managers</option>
            {allManagers.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
          </select>
          <select value={filterResult} onChange={e => setFilterResult(e.target.value)} style={selectStyle}>
            {RESULT_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {filterBtn(!includePlayoffs, 'Regular Season Only', () => setIncludePlayoffs(false))}
          {filterBtn(includePlayoffs, 'Include Playoffs', () => setIncludePlayoffs(true))}
        </div>

        {/* Mobile card view */}
        {effectiveMobile ? (
          <div style={{ borderTop: `1px solid ${border}` }}>
            {filteredTeams.map((t, i) => <MobileTeamCard key={t.id} t={t} i={i} />)}
            {filteredTeams.length === 0 && (
              <p style={{ color: muted, padding: '24px 0', fontSize: '13px' }}>No teams match your filters.</p>
            )}
          </div>
        ) : (
          /* Desktop table */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
              <thead>
                <tr style={{ background: cardBg }}>
                  <th style={hStyle('center')} onClick={() => handleSort('final_standing')}>Rk <SortIcon col="final_standing" /></th>
                  <th style={hStyle('left')} onClick={() => handleSort('manager')}>Manager <SortIcon col="manager" /></th>
                  <th style={hStyle('left')} onClick={() => handleSort('team_name')}>Team Name <SortIcon col="team_name" /></th>
                  <th style={hStyle('center')} onClick={() => handleSort('year')}>Year <SortIcon col="year" /></th>
                  <th style={hStyle()} onClick={() => handleSort('wins')}>W <SortIcon col="wins" /></th>
                  <th style={hStyle()} onClick={() => handleSort('losses')}>L <SortIcon col="losses" /></th>
                  <th style={hStyle()} onClick={() => handleSort('winPct')}>Win % <SortIcon col="winPct" /></th>
                  <th style={hStyle()} onClick={() => handleSort('points_for')}>PF <SortIcon col="points_for" /></th>
                  <th style={hStyle()} onClick={() => handleSort('points_against')}>PA <SortIcon col="points_against" /></th>
                  <th style={hStyle()} onClick={() => handleSort('diff')}>Diff <SortIcon col="diff" /></th>
                  <th style={hStyle()} onClick={() => handleSort('ppgDiff')}>PPG Diff <SortIcon col="ppgDiff" /></th>
                  <th style={hStyle('center')} onClick={() => handleSort('playoff_result')}>Result <SortIcon col="playoff_result" /></th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((t, i) => (
                  <tr key={t.id} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                    <td style={{ ...cStyle('center'), color: muted }}>{t.final_standing}</td>
                    <td style={{ ...cStyle('left'), fontFamily: "'Playfair Display', serif", fontSize: '15px' }}>{t.manager?.name}</td>
                    <td style={{ ...cStyle('left'), color: muted, fontSize: '12px' }}>{t.team_name}</td>
                    <td style={{ ...cStyle('center'), color: muted }}>{t.season?.year}</td>
                    <td style={cStyle()}>{t.wins}</td>
                    <td style={cStyle()}>{t.losses}</td>
                    <td style={cStyle()}>
                      {((t.wins / Math.max(t.wins + t.losses, 1)) * 100).toFixed(1)}%
                    </td>
                    <td style={cStyle()}>{t.points_for.toFixed(2)}</td>
                    <td style={cStyle()}>{t.points_against.toFixed(2)}</td>
                    <td style={{ ...cStyle(), color: t.diff >= 0 ? green : red, fontWeight: '500' }}>
                      {t.diff >= 0 ? '+' : ''}{t.diff}
                    </td>
                    <td style={{ ...cStyle(), color: t.ppgDiff >= 0 ? green : red, fontWeight: '500' }}>
                      {t.ppgDiff >= 0 ? '+' : ''}{t.ppgDiff}
                    </td>
                    <td style={{ ...cStyle('center'), color: resultColor(t.playoff_result), fontSize: '12px', fontWeight: '500' }}>
                      {t.playoff_result || (t.made_playoffs ? 'Playoffs' : '—')}
                    </td>
                  </tr>
                ))}
                {filteredTeams.length === 0 && (
                  <tr>
                    <td colSpan={12} style={{ padding: '24px', color: muted, textAlign: 'center', fontSize: '13px' }}>
                      No teams match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
