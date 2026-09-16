'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase, LEAGUE_ID } from '../../lib/supabase'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'
import { lineupEfficiency, actualWeekLineup, projectedWeekLineup } from '../../lib/predictions'
import { resolveSchedule, REG_SEASON_WEEKS } from '../../lib/schedule'
export const dynamic = 'force-dynamic'

const SEASON_YEAR = 2026

const posColor = pos => ({ QB: '#4285F4', RB: '#34A853', WR: '#FBBC04', TE: '#EA4335', K: '#46BDC6', 'D/ST': '#7BAAF7' }[pos] || '#888')

export default function ScoreboardPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, gold, green, red } = useLayout()

  const [mounted, setMounted] = useState(false)
  const [teams, setTeams] = useState([])
  const [matchups, setMatchups] = useState([])
  const [rosterEntries, setRosterEntries] = useState([])
  const [week, setWeek] = useState(1)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    supabase.from('teams')
      .select('*, manager:manager_id(name, slug, id), season:season_id(year)')
      .eq('league_id', LEAGUE_ID)
      .then(({ data }) => setTeams((data || []).filter(t => t.season?.year === SEASON_YEAR)))
    supabase.from('matchups')
      .select('*, home_team:home_team_id(id, manager_id, team_name), away_team:away_team_id(id, manager_id, team_name), season:season_id(year)')
      .eq('league_id', LEAGUE_ID)
      .eq('is_playoff', false)
      .then(({ data }) => {
        const rows = (data || []).filter(m => m.season?.year === SEASON_YEAR)
        setMatchups(rows)
        if (rows.length) setWeek(Math.max(...rows.map(m => m.week)))
      })
  }, [])

  useEffect(() => {
    if (!teams.length) { setRosterEntries([]); return }
    supabase.from('roster_entries')
      .select('*, player:player_id(id, name, position)')
      .in('team_id', teams.map(t => t.id))
      .then(({ data }) => setRosterEntries(data || []))
  }, [teams])

  // Real matchup rows come from the DB once results are entered; until then,
  // the league's known fixed schedule fills in so an unplayed week still
  // shows a scoreboard instead of "no matchups."
  const fixedGames = useMemo(() => (teams.length ? resolveSchedule(teams).games : []), [teams])

  const weekMatchups = useMemo(() => {
    const real = matchups.filter(m => m.week === week)
    const realPairs = new Set(real.map(m => `${m.home_team_id}-${m.away_team_id}`))
    const teamsById = Object.fromEntries(teams.map(t => [t.id, t]))
    const fixed = fixedGames
      .filter(g => g.week === week && !realPairs.has(`${g.homeId}-${g.awayId}`))
      .map(g => ({
        id: `fixed-${g.homeId}-${g.awayId}`,
        home_team_id: g.homeId, away_team_id: g.awayId,
        home_team: teamsById[g.homeId], away_team: teamsById[g.awayId],
        home_score: null, away_score: null,
      }))
      .filter(g => g.home_team && g.away_team)
    return [...real, ...fixed]
  }, [matchups, week, fixedGames, teams])

  const regWeeks = Math.max(matchups.length ? Math.max(...matchups.map(m => m.week)) : 0, REG_SEASON_WEEKS)

  const entriesByTeam = useMemo(() => {
    const byTeam = {}
    teams.forEach(t => { byTeam[t.id] = rosterEntries.filter(e => e.team_id === t.id) })
    return byTeam
  }, [teams, rosterEntries])

  if (!mounted) return null

  const inp = { background: d ? '#111' : '#e8e4dc', border: `1px solid ${border}`, color: text, padding: '8px 12px', fontSize: '13px', fontFamily: "'Inter', sans-serif", outline: 'none' }

  const TeamPlayers = ({ entries, played }) => {
    // ESPN reports 0 (not missing) for a player who simply hasn't kicked off
    // yet, so `actual` is never actually null once a week has synced --
    // `played` (the matchup's own score, not any one player's) is what
    // actually distinguishes "still projected" from "final."
    const eff = played ? lineupEfficiency(entries, week) : null
    const withStats = entries.map(e => ({
      ...e,
      actual: e.stats?.actual?.[week] ?? null,
      proj: e.stats?.proj?.[week] ?? null,
      started: e.stats?.started?.[week] === true,
    }))

    // A normal roster reads QB/RB/RB/WR/WR/TE/FLEX/FLEX/D-ST/K, not sorted
    // by score -- run the real starters (not the whole roster) through the
    // same slot-assignment lib/predictions.js uses elsewhere, so whichever
    // RB/WR/TE ends up in a FLEX slot is at least a stable, sensible pick
    // rather than DB order, then list the bench below by score.
    const startedOnly = withStats.filter(e => e.started)
    const benchOnly = withStats.filter(e => !e.started)
    const lineup = played ? actualWeekLineup(startedOnly, week) : projectedWeekLineup(startedOnly, week)
    const sorted = [
      ...lineup.starters,
      ...lineup.bench, // any started entries the 9 standard slots didn't have room for
      ...[...benchOnly].sort((a, b) => (played ? (b.actual ?? -1) - (a.actual ?? -1) : (b.proj ?? -1) - (a.proj ?? -1))),
    ]
    const hasAnyData = withStats.some(e => e.proj != null || e.actual != null)

    return (
      <div style={{ flex: 1, background: cardBg }}>
        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${border}`, fontSize: '11px', color: muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {played ? (
            <>Start %: {eff ? (
              <span style={{ color: eff.pct >= 90 ? green : eff.pct < 70 ? red : text, fontWeight: '600' }}>
                {eff.pct}% <span style={{ color: muted, fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>({eff.actualTotal} of {eff.optimalTotal} possible)</span>
              </span>
            ) : (
              <span style={{ color: muted }}>not enough data yet</span>
            )}</>
          ) : (
            <span style={{ color: muted }}>Not yet played — showing projections</span>
          )}
        </div>
        {!hasAnyData ? (
          <div style={{ padding: '16px', fontSize: '12px', color: muted }}>No per-player stats uploaded for Week {week} yet.</div>
        ) : (
          sorted.map((e, i) => (
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px 44px', alignItems: 'center', padding: '7px 16px', background: i % 2 === 0 ? 'transparent' : rowAlt, opacity: e.started ? 1 : 0.6 }}>
              <span style={{ fontSize: '9px', fontWeight: '700', color: e.started ? posColor(e.player?.position) : muted, background: (e.started ? posColor(e.player?.position) : muted) + '18', padding: '2px 4px', textAlign: 'center' }}>
                {e.started ? (e.slot || e.player?.position || '—') : 'BEN'}
              </span>
              <span style={{ fontSize: '12px', color: text, paddingLeft: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.player?.name || '—'}
              </span>
              {played ? (
                <>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: text, textAlign: 'right' }}>
                    {e.actual != null ? e.actual.toFixed(1) : '—'}
                  </span>
                  <span style={{ fontSize: '11px', textAlign: 'right', color: e.actual != null && e.proj != null ? (e.actual >= e.proj ? green : red) : muted }}>
                    {e.actual != null && e.proj != null ? `${e.actual >= e.proj ? '+' : ''}${(e.actual - e.proj).toFixed(1)}` : '—'}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: text, textAlign: 'right' }}>
                    {e.proj != null ? e.proj.toFixed(1) : '—'}
                  </span>
                  <span style={{ fontSize: '10px', textAlign: 'right', color: muted }}>proj</span>
                </>
              )}
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px, 6vw, 72px)', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '8px' }}>
          Scoreboard
        </h1>
        <p style={{ color: muted, fontSize: '13px', marginBottom: '8px', maxWidth: '640px', lineHeight: 1.6 }}>
          Final scores from the league's own records. Click a matchup to see each player's actual points against
          their projection, and that week's Start % — the points your real starters scored versus what the best
          possible lineup would have scored.
        </p>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '32px' }}>
          <select value={week} onChange={e => setWeek(parseInt(e.target.value))} style={inp}>
            {Array.from({ length: regWeeks }, (_, i) => i + 1).map(w => <option key={w} value={w}>Week {w}</option>)}
          </select>
        </div>

        {weekMatchups.length === 0 ? (
          <p style={{ color: muted, fontSize: '13px' }}>No Week {week} matchups on file yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: border }}>
            {weekMatchups.map(m => {
              const isOpen = expanded === m.id
              const played = (m.home_score ?? 0) > 0 || (m.away_score ?? 0) > 0
              return (
                <div key={m.id} style={{ background: cardBg }}>
                  <div
                    onClick={() => setExpanded(isOpen ? null : m.id)}
                    style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', cursor: 'pointer', flexWrap: 'wrap' }}
                  >
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '17px', color: text }}>
                      {m.home_team?.team_name || '—'} <span style={{ color: muted, fontSize: '12px' }}>vs</span> {m.away_team?.team_name || '—'}
                    </div>
                    <div style={{ display: 'flex', gap: '18px', alignItems: 'baseline' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: played ? gold : muted }}>
                          {played ? m.home_score?.toFixed(2) : '—'}
                        </div>
                      </div>
                      <span style={{ color: muted, fontSize: '12px' }}>–</span>
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: played ? gold : muted }}>
                          {played ? m.away_score?.toFixed(2) : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                  {!played && (
                    <div style={{ padding: '0 20px 14px', fontSize: '11px', color: muted }}>Not yet played</div>
                  )}

                  {isOpen && (
                    <div style={{ display: 'flex', flexDirection: effectiveMobile ? 'column' : 'row', gap: '1px', background: border, borderTop: `1px solid ${border}` }}>
                      {[
                        { label: m.home_team?.team_name, entries: entriesByTeam[m.home_team_id] || [] },
                        { label: m.away_team?.team_name, entries: entriesByTeam[m.away_team_id] || [] },
                      ].map((side, si) => (
                        <div key={si} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ padding: '10px 16px', background: cardBg, borderBottom: `1px solid ${border}`, fontFamily: "'Playfair Display', serif", fontSize: '14px', color: text }}>
                            {side.label}
                          </div>
                          <TeamPlayers entries={side.entries} played={played} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
