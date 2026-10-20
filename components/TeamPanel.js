'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, fetchAll } from '../lib/supabase'
import { resolveSchedule } from '../lib/schedule'
import { buildTeamProfile } from '../lib/teamProfile'
import { useLayout } from '../hooks/useLayout'

const TABS = [
  ['schedule', 'Schedule'],
  ['roster', 'Roster'],
  ['lj', 'LJ Index'],
  ['stats', 'Key Stats'],
]

const posColor = pos => ({ QB: '#4285F4', RB: '#34A853', WR: '#FBBC04', TE: '#EA4335', K: '#46BDC6', 'D/ST': '#7BAAF7' }[pos] || '#888')

/**
 * Click-through for one team: schedule, current roster, LJ Index (all-play)
 * breakdown and key stats on tabs. Loads everything it needs itself, so it
 * works from any page that can name a team id.
 */
export default function TeamPanel({ teamId, onClose, startTab = 'schedule' }) {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, gold, green, red } = useLayout()
  const router = useRouter()
  const [tab, setTab] = useState(startTab)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    setData(null); setError(''); setTab(startTab)
    ;(async () => {
      try {
        const teamSel = '*, manager:manager_id(name, slug, id), season:season_id(year)'
        const { data: t } = await supabase.from('teams').select(teamSel).eq('id', teamId).single()
        if (!t) throw new Error('Team not found')
        const { data: seasonTeams } = await supabase.from('teams').select(teamSel).eq('season_id', t.season_id)
        const ids = (seasonTeams || []).map(x => x.id)
        const [{ data: matchups }, rosterRes] = await Promise.all([
          fetchAll(() => supabase.from('matchups').select('*, home_team:home_team_id(id), away_team:away_team_id(id)').eq('season_id', t.season_id)),
          supabase.from('roster_entries').select('*, player:player_id(id, name, position, nfl_team)').in('team_id', ids),
        ])
        // nfl_team needs its migration; if the select errors, retry without it.
        let entries = rosterRes.data
        if (rosterRes.error) {
          const fb = await supabase.from('roster_entries').select('*, player:player_id(id, name, position)').in('team_id', ids)
          entries = fb.data
        }
        if (cancelled) return
        setData({ year: t.season?.year, teams: seasonTeams || [], matchups: matchups || [], entries: entries || [] })
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load team')
      }
    })()
    return () => { cancelled = true }
  }, [teamId, startTab])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const profile = useMemo(() => {
    if (!data) return null
    // The fixed league schedule only applies to the current season.
    const games = data.year === 2026 ? resolveSchedule(data.teams).games : []
    return buildTeamProfile({ teamId, teams: data.teams, matchups: data.matchups, entries: data.entries, games })
  }, [data, teamId])

  const hStyle = (align = 'left') => ({ padding: '8px 12px', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, textAlign: align, borderBottom: `1px solid ${border}`, fontWeight: '500', whiteSpace: 'nowrap' })
  const cStyle = (align = 'left') => ({ padding: '10px 12px', fontSize: '13px', textAlign: align, borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap' })
  const signed = (n, p = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(p)}`

  const Empty = ({ children }) => <div style={{ padding: '28px 16px', color: muted, fontSize: '13px' }}>{children}</div>

  const Stat = ({ label, value, sub, color }) => (
    <div style={{ background: cardBg, padding: '14px 16px', borderTop: `2px solid ${color || border}` }}>
      <div style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: muted, marginBottom: '6px' }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: '700', fontSize: '20px', color: text }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: muted, marginTop: '4px', lineHeight: 1.4 }}>{sub}</div>}
    </div>
  )

  // ── tabs ──
  const ScheduleTab = () => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: cardBg }}>
            <th style={hStyle('center')}>Wk</th>
            <th style={hStyle()}>Opponent</th>
            <th style={hStyle('center')}>H/A</th>
            <th style={hStyle('right')}>Result</th>
            {!effectiveMobile && <th style={hStyle('right')}>Opp. byes</th>}
          </tr>
        </thead>
        <tbody>
          {profile.schedule.map((g, i) => (
            <tr key={g.week} style={{ background: i % 2 ? rowAlt : 'transparent' }}>
              <td style={{ ...cStyle('center'), color: muted }}>{g.week}</td>
              <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>
                {g.oppName}
                {!g.played && g.oppRecord && <span style={{ fontSize: '11px', color: muted, marginLeft: '8px' }}>{g.oppRecord}</span>}
              </td>
              <td style={{ ...cStyle('center'), color: muted, fontSize: '11px' }}>{g.home ? 'HOME' : 'AWAY'}</td>
              <td style={{ ...cStyle('right'), fontWeight: '600', color: g.played ? (g.tie ? muted : g.won ? green : red) : muted }}>
                {g.played
                  ? `${g.tie ? 'T' : g.won ? 'W' : 'L'} ${g.score.toFixed(1)}–${g.oppScore.toFixed(1)}`
                  : 'upcoming'}
              </td>
              {!effectiveMobile && (
                <td style={{ ...cStyle('right'), fontSize: '12px', color: g.bye?.oppLost > 0 ? green : muted }}>
                  {g.bye && g.bye.oppLost > 0 ? `-${g.bye.oppLost.toFixed(1)} ppg` : g.played ? '' : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {profile.byeLuck && (
        <div style={{ padding: '14px 16px', fontSize: '12px', color: muted, lineHeight: 1.6 }}>
          Opponents lose <span style={{ color: green, fontWeight: 600 }}>{profile.byeLuck.oppLost.toFixed(1)}</span> starter PPG to NFL byes
          over the remaining schedule ({profile.byeLuck.oppEffective.toFixed(1)} once their benches fill in).
        </div>
      )}
    </div>
  )

  const RosterTab = () => {
    const rows = profile.roster
    if (!rows.length) return <Empty>No roster on file.</Empty>
    const section = (label, list) => list.length > 0 && (
      <>
        <div style={{ padding: '8px 12px', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: muted, background: cardBg, borderBottom: `1px solid ${border}` }}>{label}</div>
        {list.map((p, i) => (
          <div
            key={p.id}
            onClick={() => p.playerId && router.push(`/players/${p.playerId}`)}
            style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '40px 1fr 48px 48px' : '40px 1fr 52px 56px 56px 64px', alignItems: 'center', gap: '4px', padding: '9px 12px', borderBottom: `1px solid ${border}`, background: i % 2 ? rowAlt : 'transparent', cursor: p.playerId ? 'pointer' : 'default' }}
          >
            <span style={{ fontSize: '9px', fontWeight: '700', color: posColor(p.pos), background: posColor(p.pos) + '18', padding: '2px 5px', textAlign: 'center' }}>{p.pos}</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '6px' }}>{p.name}</span>
            {!effectiveMobile && <span style={{ fontSize: '11px', color: muted, textAlign: 'right' }}>{p.nfl || '—'}</span>}
            <span style={{ fontSize: '12px', textAlign: 'right', fontWeight: 500 }}>{p.avg != null ? p.avg.toFixed(1) : '—'}</span>
            <span style={{ fontSize: '12px', textAlign: 'right', color: muted }}>{p.last != null ? p.last.toFixed(1) : '—'}</span>
            {!effectiveMobile && <span style={{ fontSize: '11px', textAlign: 'right', color: p.byeWeek && p.byeWeek >= profile.nextWeek ? gold : muted }}>{p.byeWeek && p.byeWeek >= profile.nextWeek ? `bye wk ${p.byeWeek}` : ''}</span>}
          </div>
        ))}
      </>
    )
    const header = (
      <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '40px 1fr 48px 48px' : '40px 1fr 52px 56px 56px 64px', gap: '4px', padding: '8px 12px', borderBottom: `1px solid ${border}`, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted }}>
        <span /><span style={{ paddingLeft: '6px' }}>Player</span>
        {!effectiveMobile && <span style={{ textAlign: 'right' }}>NFL</span>}
        <span style={{ textAlign: 'right' }}>Avg</span>
        <span style={{ textAlign: 'right' }}>Wk {profile.nextWeek - 1 || '—'}</span>
        {!effectiveMobile && <span />}
      </div>
    )
    return (
      <div>
        {header}
        {section('Starters (best lineup by season avg)', rows.filter(p => p.starter))}
        {section('Bench', rows.filter(p => !p.starter))}
      </div>
    )
  }

  const LjTab = () => {
    const ap = profile.allPlay
    if (!profile.weekly.length) return <Empty>No games played yet.</Empty>
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: border }}>
          <Stat label="All-play win %" value={`${ap.pct.toFixed(1)}%`} sub={`${ap.wins}-${ap.games - ap.wins} vs the whole league`} color={gold} />
          <Stat label="Luck" value={signed(ap.luck, 2)} sub={`${ap.actualWins} actual wins vs ${ap.expectedWins.toFixed(1)} expected`} color={ap.luck >= 0 ? green : red} />
          <Stat label="Record" value={`${profile.record.w}-${profile.record.l}`} sub="head-to-head" />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: cardBg }}>
                <th style={hStyle('center')}>Wk</th>
                <th style={hStyle('right')}>Score</th>
                <th style={hStyle('center')}>Rank</th>
                <th style={hStyle('center')}>All-play</th>
                <th style={hStyle('center')}>H2H</th>
                <th style={hStyle('right')}>Luck</th>
              </tr>
            </thead>
            <tbody>
              {profile.weekly.map((g, i) => {
                const exp = g.apOf ? g.apWins / g.apOf : 0
                const luck = (g.won ? 1 : 0) - exp
                return (
                  <tr key={g.week} style={{ background: i % 2 ? rowAlt : 'transparent' }}>
                    <td style={{ ...cStyle('center'), color: muted }}>{g.week}</td>
                    <td style={cStyle('right')}>{g.score.toFixed(1)}</td>
                    <td style={{ ...cStyle('center'), color: muted }}>{g.rank} of {g.apOf + 1}</td>
                    <td style={cStyle('center')}>{g.apWins}-{g.apOf - g.apWins}</td>
                    <td style={{ ...cStyle('center'), fontWeight: 600, color: g.won ? green : red }}>{g.won ? 'W' : 'L'}</td>
                    <td style={{ ...cStyle('right'), color: luck >= 0 ? green : red }}>{signed(luck, 2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 16px', fontSize: '11px', color: muted, lineHeight: 1.6 }}>
          Luck is what a week's win was worth minus what the score earned against the whole league: a win with the 8th-best score is lucky, a loss with the 2nd-best is not.
        </div>
      </div>
    )
  }

  const StatsTab = () => {
    const p = profile
    if (!p.games) return <Empty>No games played yet.</Empty>
    return (
      <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '1px', background: border }}>
        <Stat label="Record" value={`${p.record.w}-${p.record.l}`} sub={p.streak.type ? `${p.streak.type}${p.streak.len} streak` : ''} color={gold} />
        <Stat label="Points for" value={p.pf.toFixed(1)} sub={`${p.avg.toFixed(1)} per game`} color={green} />
        <Stat label="Points against" value={p.pa.toFixed(1)} sub={`${(p.pa / p.games).toFixed(1)} per game`} color={red} />
        <Stat label="Point diff" value={signed(p.diff)} color={p.diff >= 0 ? green : red} />
        <Stat label="Median score" value={p.median.toFixed(1)} sub={`Std dev ${p.std}`} />
        <Stat label="All-play" value={`${p.allPlay.pct.toFixed(1)}%`} sub={`Luck ${signed(p.allPlay.luck, 2)}`} />
        <Stat label="High score" value={p.high ? p.high.score.toFixed(1) : '—'} sub={p.high ? `Week ${p.high.week} vs ${p.high.oppName}` : ''} color={green} />
        <Stat label="Low score" value={p.low ? p.low.score.toFixed(1) : '—'} sub={p.low ? `Week ${p.low.week} vs ${p.low.oppName}` : ''} color={red} />
        <Stat label="Correct start %" value={p.efficiency.startPct != null ? `${p.efficiency.startPct}%` : '—'} sub="real lineup vs best possible" />
        <Stat label="Max PF" value={p.efficiency.maxPf != null ? p.efficiency.maxPf.toFixed(1) : '—'} sub={p.efficiency.maxAvg != null ? `${p.efficiency.maxAvg} per week with a perfect lineup` : ''} />
        <Stat label="Bye-week schedule" value={p.byeLuck ? `${p.byeLuck.oppLost.toFixed(1)} ppg` : '—'} sub="opponents' starters lost to byes, rest of season" color={green} />
      </div>
    )
  }

  const body = !profile
    ? <Empty>{error || 'Loading…'}</Empty>
    : tab === 'schedule' ? <ScheduleTab />
    : tab === 'roster' ? <RosterTab />
    : tab === 'lj' ? <LjTab />
    : <StatsTab />

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: effectiveMobile ? '96vw' : '720px', maxHeight: '88vh',
        background: bg, border: `1px solid ${border}`, zIndex: 301, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 16px 0', background: cardBg, borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', color: text, marginBottom: '4px' }}>{profile?.name || '…'}</div>
              <div style={{ fontSize: '12px', color: muted }}>
                {profile?.teamName}{profile ? ` · ${profile.record.w}-${profile.record.l} · ${profile.pf.toFixed(1)} PF` : ''}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: '2px', marginTop: '14px', overflowX: 'auto' }}>
            {TABS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  background: tab === key ? bg : 'transparent', color: tab === key ? text : muted,
                  border: `1px solid ${tab === key ? border : 'transparent'}`, borderBottom: tab === key ? `1px solid ${bg}` : '1px solid transparent',
                  marginBottom: '-1px', padding: '9px 16px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontWeight: tab === key ? 600 : 400, whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>{body}</div>
      </div>
    </>
  )
}
