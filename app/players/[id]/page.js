'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams, useRouter } from 'next/navigation'
import Nav from '../../../components/Nav'
import { useLayout } from '../../../hooks/useLayout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const STAT_FIELDS = {
  QB: [
    { key: 'pass_yd', label: 'Pass Yds' },
    { key: 'pass_td', label: 'Pass TD' },
    { key: 'pass_int', label: 'INT' },
    { key: 'rush_yd', label: 'Rush Yds' },
    { key: 'rush_td', label: 'Rush TD' },
    { key: 'pass_2pt', label: '2PT Pass' },
  ],
  RB: [
    { key: 'rush_yd', label: 'Rush Yds' },
    { key: 'rush_td', label: 'Rush TD' },
    { key: 'rec', label: 'Rec' },
    { key: 'rec_yd', label: 'Rec Yds' },
    { key: 'rec_td', label: 'Rec TD' },
    { key: 'rush_fd', label: 'Rush 1D' },
    { key: 'rec_fd', label: 'Rec 1D' },
    { key: 'fum_lost', label: 'Fum Lost' },
    { key: 'rush_2pt', label: '2PT Rush' },
  ],
  WR: [
    { key: 'rec', label: 'Rec' },
    { key: 'rec_yd', label: 'Rec Yds' },
    { key: 'rec_td', label: 'Rec TD' },
    { key: 'rec_fd', label: 'Rec 1D' },
    { key: 'rush_yd', label: 'Rush Yds' },
    { key: 'rush_td', label: 'Rush TD' },
    { key: 'fum_lost', label: 'Fum Lost' },
    { key: 'rec_2pt', label: '2PT Rec' },
  ],
  TE: [
    { key: 'rec', label: 'Rec' },
    { key: 'rec_yd', label: 'Rec Yds' },
    { key: 'rec_td', label: 'Rec TD' },
    { key: 'rec_fd', label: 'Rec 1D' },
    { key: 'fum_lost', label: 'Fum Lost' },
    { key: 'rec_2pt', label: '2PT Rec' },
  ],
  K: [],
  'D/ST': [],
}

export default function PlayerProfilePage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, highlight, green, red, gold, blue } = useLayout()
  const params = useParams()
  const router = useRouter()
  const [player, setPlayer] = useState(null)
  const [entries, setEntries] = useState([])
  const [statsCache, setStatsCache] = useState({})
  const [loadingStats, setLoadingStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!params?.id) return
    const fetchData = async () => {
      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('id', params.id)
        .single()
      if (!playerData) { setLoading(false); return }
      setPlayer(playerData)

      const { data: entriesData } = await supabase
        .from('roster_entries')
        .select(`
          *,
          team:team_id(
            id, team_name, wins, losses, points_for, final_standing, playoff_result,
            manager:manager_id(name, slug),
            season:season_id(year)
          )
        `)
        .eq('player_id', params.id)
        .limit(1000)

      if (entriesData) {
        const sorted = [...entriesData].sort((a, b) => (b.team?.season?.year || 0) - (a.team?.season?.year || 0))
        setEntries(sorted)

        // Load stats from Sleeper or DB cache
        if (playerData.sleeper_id && playerData.sleeper_id !== 'SKIP' && !['K', 'D/ST'].includes(playerData.position)) {
          for (const entry of sorted) {
            const year = entry.team?.season?.year
            if (!year) continue
            if (entry.stats && Object.keys(entry.stats).length > 0) {
              setStatsCache(prev => ({ ...prev, [`${year}`]: entry.stats }))
            }
          }
          // Fetch missing years from Sleeper
          const yearsNeedingFetch = sorted
            .map(e => e.team?.season?.year)
            .filter(Boolean)
            .filter(y => !sorted.find(e => e.team?.season?.year === y && e.stats && Object.keys(e.stats).length > 0))
          const uniqueYears = [...new Set(yearsNeedingFetch)]
          for (const year of uniqueYears) {
            fetchSleeperStats(playerData.sleeper_id, year, entriesData.filter(e => e.team?.season?.year === year).map(e => e.id))
          }
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [params?.id])

  const fetchSleeperStats = async (sleeperId, year, entryIds) => {
    setLoadingStats(prev => ({ ...prev, [year]: true }))
    try {
      const res = await fetch(`https://api.sleeper.com/stats/nfl/player/${sleeperId}?season_type=regular&season=${year}&grouping=season`)
      const data = await res.json()
      const stats = data?.stats || {}
      setStatsCache(prev => ({ ...prev, [year]: stats }))
      // Persist to DB
      for (const entryId of entryIds) {
        await supabase.from('roster_entries').update({ stats }).eq('id', entryId)
      }
    } catch (e) {
      console.error('Sleeper fetch failed', year, e)
    }
    setLoadingStats(prev => ({ ...prev, [year]: false }))
  }

  const hStyle = (align = 'left') => ({
    padding: effectiveMobile ? '7px 8px' : '9px 12px',
    fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase',
    color: muted, textAlign: align, borderBottom: `1px solid ${border}`,
    fontWeight: '500', whiteSpace: 'nowrap',
  })
  const cStyle = (align = 'left') => ({
    padding: effectiveMobile ? '9px 8px' : '11px 12px',
    fontSize: effectiveMobile ? '11px' : '12px',
    textAlign: align, borderBottom: `1px solid ${border}`,
    color: text, whiteSpace: 'nowrap',
  })

  const posColor = pos => {
    const map = { QB: '#4285F4', RB: '#34A853', WR: '#FBBC04', TE: '#EA4335', K: '#46BDC6', 'D/ST': '#7BAAF7' }
    return map[pos] || muted
  }

  const statFields = player ? (STAT_FIELDS[player.position] || []) : []

  // Career totals
  const careerFpts = entries.reduce((sum, e) => sum + (e.fpts || 0), 0)
  const careerAvg = entries.length > 0
    ? entries.reduce((sum, e) => sum + (e.avg_pts || 0), 0) / entries.length
    : 0
  const uniqueOwners = [...new Set(entries.map(e => e.team?.manager?.name).filter(Boolean))]
  const uniqueSeasons = [...new Set(entries.map(e => e.team?.season?.year).filter(Boolean))]

  if (!mounted) return null

  if (loading) {
    return (
      <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
        <Nav />
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: effectiveMobile ? '90px 16px' : '120px 24px' }}>
          <p style={{ color: muted }}>Loading player...</p>
        </div>
      </div>
    )
  }

  if (!player) {
    return (
      <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
        <Nav />
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: effectiveMobile ? '90px 16px' : '120px 24px' }}>
          <p style={{ color: muted }}>Player not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>

        {/* Back */}
        <button
          onClick={() => router.push('/players')}
          style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0', marginBottom: '32px', fontFamily: "'Inter', sans-serif" }}
        >
          ← Players
        </button>

        {/* Header */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '32px' : 'clamp(36px, 5vw, 60px)', fontWeight: '400', letterSpacing: '-0.02em', margin: 0 }}>
              {player.name}
            </h1>
            <span style={{
              fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em',
              color: posColor(player.position),
              background: posColor(player.position) + '20',
              padding: '4px 10px',
            }}>
              {player.position}
            </span>
          </div>

          {/* Career stat bar */}
          <div style={{ display: 'flex', gap: effectiveMobile ? '20px' : '40px', flexWrap: 'wrap', marginTop: '20px' }}>
            {[
              { label: 'Career FPTS', value: careerFpts.toFixed(1) },
              { label: 'Avg PPG', value: careerAvg.toFixed(1) },
              { label: 'Seasons', value: uniqueSeasons.length },
              { label: 'Owners', value: uniqueOwners.length },
            ].map(stat => (
              <div key={stat.label}>
                <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '4px' }}>{stat.label}</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '22px' : '28px', color: text }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Owner history */}
        {uniqueOwners.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: muted, marginBottom: '12px' }}>Owner History</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {uniqueOwners.map(owner => {
                const ownerEntries = entries.filter(e => e.team?.manager?.name === owner)
                const years = ownerEntries.map(e => e.team?.season?.year).filter(Boolean).sort()
                return (
                  <div key={owner} style={{ background: cardBg, border: `1px solid ${border}`, padding: '8px 14px' }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '13px', color: text }}>{owner}</div>
                    <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>{years.join(', ')}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Season-by-season table */}
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: muted, marginBottom: '16px' }}>Season Stats</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
              <thead>
                <tr style={{ background: cardBg }}>
                  <th style={hStyle('center')}>Year</th>
                  <th style={hStyle()}>Owner</th>
                  {!effectiveMobile && <th style={hStyle()}>Team</th>}
                  <th style={hStyle('right')}>FPTS</th>
                  <th style={hStyle('right')}>Avg</th>
                  {!effectiveMobile && <th style={hStyle('right')}>PRK</th>}
                  {statFields.map(f => (
                    <th key={f.key} style={hStyle('right')}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const year = entry.team?.season?.year
                  const stats = year ? (statsCache[year] || entry.stats || {}) : {}
                  const isLoadingYear = year && loadingStats[year]
                  return (
                    <tr key={entry.id} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                      <td style={{ ...cStyle('center'), fontWeight: '600' }}>{year}</td>
                      <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif" }}>
                        <span
                          style={{ cursor: 'pointer', color: text }}
                          onClick={() => router.push(`/managers`)}
                        >
                          {entry.team?.manager?.name || '—'}
                        </span>
                      </td>
                      {!effectiveMobile && <td style={{ ...cStyle(), color: muted, fontSize: '11px' }}>{entry.team?.team_name || '—'}</td>}
                      <td style={{ ...cStyle('right'), fontWeight: '500' }}>{entry.fpts?.toFixed(1) || '—'}</td>
                      <td style={cStyle('right')}>{entry.avg_pts?.toFixed(1) || '—'}</td>
                      {!effectiveMobile && <td style={{ ...cStyle('right'), color: muted }}>{entry.prk || '—'}</td>}
                      {statFields.map(f => (
                        <td key={f.key} style={{ ...cStyle('right'), color: muted }}>
                          {isLoadingYear ? '...' : (stats[f.key] != null ? stats[f.key] : '—')}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
