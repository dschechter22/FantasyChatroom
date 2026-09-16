'use client'
import { useState, useEffect } from 'react'
import { supabase, LEAGUE_ID } from '../../lib/supabase'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'
export const dynamic = 'force-dynamic'

const SEASON_YEAR = 2026

export default function RosterMovesPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, gold, green } = useLayout()
  const [moves, setMoves] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const load = async () => {
      const { data: season } = await supabase.from('seasons').select('id').eq('year', SEASON_YEAR).single()
      if (!season) { setLoading(false); return }
      const { data, error: err } = await supabase.from('roster_moves')
        .select(`
          id, week, move_type, detected_at,
          player:player_id(name, position),
          from_team:from_team_id(team_name, manager:manager_id(name)),
          to_team:to_team_id(team_name, manager:manager_id(name))
        `)
        .eq('season_id', season.id)
        .order('detected_at', { ascending: false })
      if (err) {
        setError("Could not load roster moves -- run roster_moves_log.sql in Supabase if you haven't yet.")
      } else {
        setMoves(data || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  if (!mounted) return null

  const posColor = pos => ({ QB: '#4285F4', RB: '#34A853', WR: '#FBBC04', TE: '#EA4335', K: '#46BDC6', 'D/ST': '#7BAAF7' }[pos] || muted)

  const fmtDate = ts => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px, 6vw, 72px)', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '8px' }}>
          Roster Moves
        </h1>
        <p style={{ color: muted, fontSize: '13px', marginBottom: '32px', maxWidth: '600px', lineHeight: 1.6 }}>
          Trades and waiver pickups the daily sync detected by comparing ESPN's real rosters against what's on file —
          this is how the site catches up when a manager makes a move, without anyone needing to tell it.
        </p>

        {loading && <p style={{ color: muted, fontSize: '14px' }}>Loading...</p>}
        {error && <p style={{ color: muted, fontSize: '13px' }}>{error}</p>}

        {!loading && !error && moves.length === 0 && (
          <p style={{ color: muted, fontSize: '14px' }}>No roster moves detected yet this season.</p>
        )}

        {!loading && moves.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: border }}>
            {moves.map(m => (
              <div key={m.id} style={{ background: cardBg, padding: effectiveMobile ? '14px 16px' : '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  {m.player?.position && (
                    <span style={{ fontSize: '9px', fontWeight: '700', color: posColor(m.player.position), background: posColor(m.player.position) + '18', padding: '2px 5px', flexShrink: 0 }}>
                      {m.player.position}
                    </span>
                  )}
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: text }}>{m.player?.name || 'Unknown player'}</span>
                </div>
                <div style={{ fontSize: '13px', color: muted, textAlign: 'right' }}>
                  {m.move_type === 'added' ? (
                    <span>Added to <span style={{ color: text, fontWeight: '500' }}>{m.to_team?.manager?.name || m.to_team?.team_name}</span></span>
                  ) : (
                    <span>
                      <span style={{ color: text }}>{m.from_team?.manager?.name || m.from_team?.team_name || '—'}</span>
                      {' → '}
                      <span style={{ color: green, fontWeight: '500' }}>{m.to_team?.manager?.name || m.to_team?.team_name}</span>
                    </span>
                  )}
                  <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>Week {m.week} · {fmtDate(m.detected_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
