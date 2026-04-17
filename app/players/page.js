'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'K', 'D/ST']

export default function PlayersPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, highlight, green, red, gold, blue } = useLayout()
  const router = useRouter()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('All')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const fetchPlayers = async () => {
      // Get all roster entries joined to players, aggregate stats
      const { data: entries } = await supabase
        .from('roster_entries')
        .select('player_id, fpts, avg_pts, player:player_id(id, name, position, sleeper_id)')
        .limit(10000)

      if (!entries) { setLoading(false); return }

      // Aggregate per player
      const agg = {}
      for (const e of entries) {
        const p = e.player
        if (!p) continue
        if (!agg[p.id]) {
          agg[p.id] = {
            id: p.id,
            name: p.name,
            position: p.position,
            sleeper_id: p.sleeper_id,
            totalFpts: 0,
            seasons: 0,
            avgPts: 0,
            entries: [],
          }
        }
        agg[p.id].totalFpts += e.fpts || 0
        agg[p.id].seasons++
        agg[p.id].entries.push(e.avg_pts || 0)
      }

      // Compute career avg PPG
      const result = Object.values(agg).map(p => ({
        ...p,
        totalFpts: parseFloat(p.totalFpts.toFixed(1)),
        careerAvg: p.entries.length > 0
          ? parseFloat((p.entries.reduce((a, b) => a + b, 0) / p.entries.length).toFixed(1))
          : 0,
      })).sort((a, b) => b.careerAvg - a.careerAvg)

      setPlayers(result)
      setLoading(false)
    }
    fetchPlayers()
  }, [])

  const filtered = useMemo(() => {
    return players.filter(p => {
      const matchPos = posFilter === 'All' || p.position === posFilter
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
      return matchPos && matchSearch
    })
  }, [players, search, posFilter])

  const hStyle = (align = 'left') => ({
    padding: effectiveMobile ? '8px 10px' : '10px 14px',
    fontSize: '10px',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: muted,
    textAlign: align,
    borderBottom: `1px solid ${border}`,
    fontWeight: '500',
    whiteSpace: 'nowrap',
  })

  const cStyle = (align = 'left') => ({
    padding: effectiveMobile ? '10px' : '13px 14px',
    fontSize: effectiveMobile ? '12px' : '13px',
    textAlign: align,
    borderBottom: `1px solid ${border}`,
    color: text,
    whiteSpace: 'nowrap',
  })

  const posColor = pos => {
    const map = { QB: '#4285F4', RB: '#34A853', WR: '#FBBC04', TE: '#EA4335', K: '#46BDC6', 'D/ST': '#7BAAF7' }
    return map[pos] || muted
  }

  if (!mounted) return null

  const displayData = mounted ? filtered : []

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>

        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px, 6vw, 72px)', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '8px' }}>
            Players
          </h1>
          <p style={{ color: muted, fontSize: '13px' }}>
            {players.length} players across all seasons · sorted by career avg PPG
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search players..."
            style={{
              background: cardBg, border: `1px solid ${border}`, color: text,
              padding: '9px 14px', fontSize: '13px', fontFamily: "'Inter', sans-serif",
              outline: 'none', width: effectiveMobile ? '100%' : '220px',
            }}
          />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {POSITIONS.map(pos => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                style={{
                  background: posFilter === pos ? text : 'none',
                  border: `1px solid ${posFilter === pos ? text : border}`,
                  color: posFilter === pos ? bg : muted,
                  padding: '6px 12px', cursor: 'pointer', fontSize: '10px',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  fontFamily: "'Inter', sans-serif", fontWeight: '500',
                }}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <p style={{ color: muted }}>Loading players...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
              <thead>
                <tr style={{ background: cardBg }}>
                  <th style={hStyle('center')}>#</th>
                  <th style={hStyle()}>Player</th>
                  <th style={hStyle('center')}>Pos</th>
                  {!effectiveMobile && <th style={hStyle('right')}>Seasons</th>}
                  <th style={hStyle('right')}>Career FPTS</th>
                  <th style={hStyle('right')}>Avg PPG</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((p, i) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/players/${p.id}`)}
                    style={{
                      background: i % 2 === 0 ? 'transparent' : rowAlt,
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = highlight}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : rowAlt}
                  >
                    <td style={{ ...cStyle('center'), color: muted, fontSize: '11px' }}>{i + 1}</td>
                    <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '13px' : '15px' }}>
                      {p.name}
                    </td>
                    <td style={{ ...cStyle('center') }}>
                      <span style={{
                        fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em',
                        color: posColor(p.position),
                        background: posColor(p.position) + '18',
                        padding: '2px 7px',
                      }}>
                        {p.position}
                      </span>
                    </td>
                    {!effectiveMobile && <td style={{ ...cStyle('right'), color: muted }}>{p.seasons}</td>}
                    <td style={cStyle('right')}>{p.totalFpts.toLocaleString()}</td>
                    <td style={{ ...cStyle('right'), fontWeight: '600', color: p.careerAvg >= 15 ? gold : p.careerAvg >= 10 ? text : muted }}>
                      {p.careerAvg}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayData.length === 0 && (
              <p style={{ color: muted, padding: '24px 0', textAlign: 'center' }}>No players found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
