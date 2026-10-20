'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, fetchAll, LEAGUE_ID } from '../lib/supabase'
import { resolveSchedule } from '../lib/schedule'
import { buildLeagueProfiles, rankOf, seasonAvg } from '../lib/teamProfile'
import { groupEntriesByTeam } from '../lib/rosters'
import { seasonFeatures, findSimilar } from '../lib/similarTeams'
import { useLayout } from '../hooks/useLayout'

const TABS = [
  ['schedule', 'Schedule'],
  ['roster', 'Roster'],
  ['lj', 'LJ Index'],
  ['stats', 'Key Stats'],
  ['similar', 'Similar Teams'],
]

const GREEN = '#34A853', BLUE = '#4285F4', GOLD = '#FBBC04', RED = '#EA4335', TEAL = '#46BDC6', PURPLE = '#9B72CB', ORANGE = '#F4811F'
const posColor = pos => ({ QB: BLUE, RB: GREEN, WR: GOLD, TE: RED, K: TEAL, 'D/ST': '#7BAAF7' }[pos] || '#888')
// Top three = green, bottom three = red, the middle = gold.
const tierColor = (rank, of) => (rank <= 3 ? GREEN : rank > of - 3 ? RED : GOLD)
const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }

// One season's data is fetched once and shared by every team opened from it
// (opening a second manager shouldn't refetch the whole league).
const cache = new Map()
function loadSeason(teamId) {
  const hit = cache.get(teamId)
  if (hit && Date.now() - hit.at < 60000) return hit.promise
  const promise = (async () => {
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
    return { year: t.season?.year, teams: seasonTeams || [], matchups: matchups || [], entries: entries || [] }
  })()
  cache.set(teamId, { at: Date.now(), promise })
  promise.catch(() => cache.delete(teamId))
  return promise
}

// Every season's teams, matchups and rosters, for the Similar Teams tab. Only
// fetched when that tab is opened, then kept for the rest of the visit.
let historyPromise = null
function loadHistory() {
  if (historyPromise) return historyPromise
  historyPromise = (async () => {
    const [teamsRes, matchupsRes, entriesRes] = await Promise.all([
      fetchAll(() => supabase.from('teams').select('*, manager:manager_id(name, slug), season:season_id(year)').eq('league_id', LEAGUE_ID)),
      fetchAll(() => supabase.from('matchups').select('*, home_team:home_team_id(id), away_team:away_team_id(id), season:season_id(year)').eq('league_id', LEAGUE_ID)),
      fetchAll(() => supabase.from('roster_entries').select('team_id, avg_pts, player:player_id(position)').eq('league_id', LEAGUE_ID)),
    ])
    return { teams: teamsRes.data || [], matchups: matchupsRes.data || [], entries: entriesRes.data || [] }
  })()
  historyPromise.catch(() => { historyPromise = null })
  return historyPromise
}

/**
 * A team's schedule, roster, LJ Index and key stats on tabs, rendered inline
 * (the standings expand to show it under the manager's row). Loads what it
 * needs itself, so any page that can name a team id can drop it in.
 */
export default function TeamPanel({ teamId, startTab = 'schedule' }) {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, accent } = useLayout()
  const router = useRouter()
  const [tab, setTab] = useState(startTab)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    setData(null); setError('')
    loadSeason(teamId)
      .then(res => { if (!cancelled) setData(res) })
      .catch(e => { if (!cancelled) setError(e.message || 'Could not load team') })
    return () => { cancelled = true }
  }, [teamId])

  const { profile, profiles } = useMemo(() => {
    if (!data) return {}
    // The fixed league schedule only applies to the current season.
    const games = data.year === 2026 ? resolveSchedule(data.teams).games : []
    const all = buildLeagueProfiles({ teams: data.teams, matchups: data.matchups, entries: data.entries, games })
    return { profiles: all, profile: all.find(p => p.id === teamId) }
  }, [data, teamId])

  // ── similar historical teams (loaded the first time the tab is opened) ──
  const [hist, setHist] = useState(null)
  const [histError, setHistError] = useState('')
  useEffect(() => {
    if (tab !== 'similar' || hist) return
    loadHistory().then(setHist).catch(e => setHistError(e.message || 'Could not load league history'))
  }, [tab, hist])

  const similar = useMemo(() => {
    if (!hist || !profile || !data) return null
    const week = profile.weekly.length
    if (!week) return { empty: true }
    const players = es => es.filter(e => e.player?.position).map(e => ({ pos: e.player.position, ppg: seasonAvg(e) || 0 }))
    // this team, measured the same way as every historical team: through `week` games
    const currentRosters = new Map(Object.entries(groupEntriesByTeam(data.entries)).map(([id, es]) => [id, players(es)]))
    const target = seasonFeatures({ teams: data.teams, matchups: data.matchups, rosters: currentRosters, week }).get(teamId)
    if (!target) return { empty: true }

    const rostersByTeam = new Map()
    hist.entries.forEach(e => {
      if (!e.player?.position) return
      if (!rostersByTeam.has(e.team_id)) rostersByTeam.set(e.team_id, [])
      rostersByTeam.get(e.team_id).push({ pos: e.player.position, ppg: e.avg_pts || 0 })
    })
    const teamsByYear = {}, matchupsByYear = {}
    hist.teams.forEach(t => { if (t.season?.year) (teamsByYear[t.season.year] ||= []).push(t) })
    hist.matchups.forEach(m => { if (m.season?.year) (matchupsByYear[m.season.year] ||= []).push(m) })
    const byId = new Map(hist.teams.map(t => [t.id, t]))
    const pool = []
    Object.keys(teamsByYear).forEach(year => {
      if (Number(year) === data.year) return
      const feats = seasonFeatures({ teams: teamsByYear[year], matchups: matchupsByYear[year] || [], rosters: rostersByTeam, week })
      feats.forEach((f, id) => pool.push({ id, vector: f.vector, meta: f.meta }))
    })
    if (!pool.length) return { empty: true, week }
    const results = findSimilar({ target, pool, limit: 10 }).map(r => ({ ...r, team: byId.get(r.id) }))
    return { week, pool: pool.length, target: target.meta, results }
  }, [hist, profile, data, teamId])

  const hStyle = (align = 'left') => ({ padding: '8px 12px', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, textAlign: align, borderBottom: `1px solid ${border}`, fontWeight: '500', whiteSpace: 'nowrap' })
  const cStyle = (align = 'left') => ({ padding: '10px 12px', fontSize: '13px', textAlign: align, borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap' })
  const signed = (n, p = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(p)}`
  const tint = (c, a = '16') => c + a

  const Empty = ({ children }) => <div style={{ padding: '28px 16px', color: muted, fontSize: '13px' }}>{children}</div>

  // "#2 of 10" pill, coloured by where in the league the team sits.
  const RankPill = ({ r, size = 11 }) => {
    if (!r) return null
    const c = tierColor(r.rank, r.of)
    return (
      <span style={{ display: 'inline-block', background: tint(c, '26'), color: c, border: `1px solid ${tint(c, '66')}`, borderRadius: '999px', padding: '2px 9px', fontSize: `${size}px`, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
        #{r.rank} of {r.of}
      </span>
    )
  }

  // Ten small blocks, one per team, with this team's place lit up.
  const RankStrip = ({ r }) => {
    if (!r) return null
    const c = tierColor(r.rank, r.of)
    return (
      <div style={{ display: 'flex', gap: '3px', marginTop: '10px' }}>
        {Array.from({ length: r.of }, (_, i) => (
          <span key={i} style={{ flex: 1, height: '6px', borderRadius: '2px', background: i + 1 === r.rank ? c : i + 1 < r.rank ? tint(c, '40') : (d ? 'rgba(255,255,255,0.08)' : 'rgba(13,33,82,0.08)') }} />
        ))}
      </div>
    )
  }

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
            <tr key={g.week} style={{ background: g.played ? (g.tie ? 'transparent' : tint(g.won ? GREEN : RED, '0d')) : (i % 2 ? rowAlt : 'transparent') }}>
              <td style={{ ...cStyle('center'), color: muted }}>{g.week}</td>
              <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>
                {g.oppName}
                {!g.played && g.oppRecord && <span style={{ fontSize: '11px', color: muted, marginLeft: '8px' }}>{g.oppRecord}</span>}
              </td>
              <td style={{ ...cStyle('center'), color: muted, fontSize: '11px' }}>{g.home ? 'HOME' : 'AWAY'}</td>
              <td style={{ ...cStyle('right'), fontWeight: '600', color: g.played ? (g.tie ? muted : g.won ? GREEN : RED) : muted }}>
                {g.played ? `${g.tie ? 'T' : g.won ? 'W' : 'L'} ${g.score.toFixed(1)}–${g.oppScore.toFixed(1)}` : 'upcoming'}
              </td>
              {!effectiveMobile && (
                <td style={{ ...cStyle('right'), fontSize: '12px', color: g.bye?.oppLost > 0 ? GREEN : muted }}>
                  {g.bye && g.bye.oppLost > 0 ? `-${g.bye.oppLost.toFixed(1)} ppg` : g.played ? '' : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {profile.byeLuck && (
        <div style={{ padding: '14px 16px', fontSize: '12px', color: muted, lineHeight: 1.6 }}>
          Opponents lose <span style={{ color: GREEN, fontWeight: 600 }}>{profile.byeLuck.oppLost.toFixed(1)}</span> starter PPG to NFL byes
          over the remaining schedule ({profile.byeLuck.oppEffective.toFixed(1)} once their benches fill in).
        </div>
      )}
    </div>
  )

  const RosterTab = () => {
    const rows = profile.roster
    if (!rows.length) return <Empty>No roster on file.</Empty>
    const cols = effectiveMobile ? '40px 1fr 48px 48px' : '40px 1fr 52px 56px 56px 72px'
    const section = (label, list) => list.length > 0 && (
      <>
        <div style={{ padding: '8px 12px', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: muted, background: cardBg, borderBottom: `1px solid ${border}` }}>{label}</div>
        {list.map((p, i) => (
          <div
            key={p.id}
            onClick={() => p.playerId && router.push(`/players/${p.playerId}`)}
            style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', gap: '4px', padding: '9px 12px', borderBottom: `1px solid ${border}`, background: i % 2 ? rowAlt : 'transparent', cursor: p.playerId ? 'pointer' : 'default' }}
          >
            <span style={{ fontSize: '9px', fontWeight: '700', color: posColor(p.pos), background: posColor(p.pos) + '18', padding: '2px 5px', textAlign: 'center' }}>{p.pos}</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '6px' }}>{p.name}</span>
            {!effectiveMobile && <span style={{ fontSize: '11px', color: muted, textAlign: 'right' }}>{p.nfl || '—'}</span>}
            <span style={{ fontSize: '12px', textAlign: 'right', fontWeight: 500 }}>{p.avg != null ? p.avg.toFixed(1) : '—'}</span>
            <span style={{ fontSize: '12px', textAlign: 'right', color: muted }}>{p.last != null ? p.last.toFixed(1) : '—'}</span>
            {!effectiveMobile && <span style={{ fontSize: '11px', textAlign: 'right', color: p.byeWeek && p.byeWeek >= profile.nextWeek ? GOLD : muted }}>{p.byeWeek && p.byeWeek >= profile.nextWeek ? `bye wk ${p.byeWeek}` : ''}</span>}
          </div>
        ))}
      </>
    )
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '4px', padding: '8px 12px', borderBottom: `1px solid ${border}`, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted }}>
          <span /><span style={{ paddingLeft: '6px' }}>Player</span>
          {!effectiveMobile && <span style={{ textAlign: 'right' }}>NFL</span>}
          <span style={{ textAlign: 'right' }}>Avg</span>
          <span style={{ textAlign: 'right' }}>Wk {profile.nextWeek - 1 || '—'}</span>
          {!effectiveMobile && <span />}
        </div>
        {section('Starters (best lineup by season avg)', rows.filter(p => p.starter))}
        {section('Bench', rows.filter(p => !p.starter))}
      </div>
    )
  }

  // The LJ bubble plot: every team greyed out, this one lit up.
  const LjPlot = () => {
    const W = effectiveMobile ? 360 : 680, H = effectiveMobile ? 300 : 380
    const PAD = { top: 22, right: 18, bottom: 40, left: effectiveMobile ? 42 : 54 }
    const cw = W - PAD.left - PAD.right, ch = H - PAD.top - PAD.bottom
    const lim = v => Math.max(10, Math.ceil(v / 10) * 10)
    const xMax = lim(Math.max(...profiles.map(p => Math.abs(p.ljX))) * 1.15)
    const yMax = lim(Math.max(...profiles.map(p => Math.abs(p.ljY))) * 1.15)
    const sx = x => PAD.left + ((x + xMax) / (2 * xMax)) * cw
    const sy = y => PAD.top + ((yMax - y) / (2 * yMax)) * ch
    const powers = profiles.map(p => p.powerScore)
    const pMin = Math.min(...powers), pMax = Math.max(...powers)
    const rad = p => (effectiveMobile ? 9 : 12) + (pMax === pMin ? 0.5 : (p.powerScore - pMin) / (pMax - pMin)) * (effectiveMobile ? 9 : 13)
    const axis = d ? 'rgba(255,255,255,0.25)' : 'rgba(13,33,82,0.28)'
    const grid = d ? 'rgba(255,255,255,0.06)' : 'rgba(13,33,82,0.08)'
    const grey = d ? '#7c8496' : '#9aa1b2'
    const fs = effectiveMobile ? 9 : 11
    const ticks = v => [-v, -v / 2, 0, v / 2, v]
    const ordered = [...profiles.filter(p => p.id !== teamId), profile] // highlighted bubble drawn last, on top
    const label = p => (p.name || '').split('/')[0].split(' ')[0]
    return (
      <div style={{ padding: '4px 8px 0' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: `${W}px`, height: 'auto', display: 'block', margin: '0 auto' }}>
          <rect x={sx(0)} y={PAD.top} width={cw - (sx(0) - PAD.left)} height={sy(0) - PAD.top} fill={tint(GREEN, '0f')} />
          <rect x={PAD.left} y={PAD.top} width={sx(0) - PAD.left} height={sy(0) - PAD.top} fill={tint(BLUE, '0f')} />
          <rect x={sx(0)} y={sy(0)} width={cw - (sx(0) - PAD.left)} height={PAD.top + ch - sy(0)} fill={tint(GOLD, '0f')} />
          <rect x={PAD.left} y={sy(0)} width={sx(0) - PAD.left} height={PAD.top + ch - sy(0)} fill={tint(RED, '0f')} />
          {ticks(xMax).map(v => <line key={`x${v}`} x1={sx(v)} y1={PAD.top} x2={sx(v)} y2={PAD.top + ch} stroke={v === 0 ? axis : grid} strokeWidth={v === 0 ? 1.4 : 1} />)}
          {ticks(yMax).map(v => <line key={`y${v}`} x1={PAD.left} y1={sy(v)} x2={PAD.left + cw} y2={sy(v)} stroke={v === 0 ? axis : grid} strokeWidth={v === 0 ? 1.4 : 1} />)}
          {ticks(xMax).map(v => <text key={`xt${v}`} x={sx(v)} y={PAD.top + ch + 15} textAnchor="middle" fontSize={fs} fill={muted} fontFamily="Inter, sans-serif">{v > 0 ? '+' : ''}{v}</text>)}
          {ticks(yMax).map(v => <text key={`yt${v}`} x={PAD.left - 6} y={sy(v) + 4} textAnchor="end" fontSize={fs} fill={muted} fontFamily="Inter, sans-serif">{v > 0 ? '+' : ''}{v}</text>)}
          <text x={PAD.left + cw - 4} y={PAD.top + 12} textAnchor="end" fontSize={fs - 1} fill={tint(GREEN, 'cc')} fontFamily="Inter, sans-serif" letterSpacing="1">GOOD &amp; LUCKY</text>
          <text x={PAD.left + 4} y={PAD.top + 12} fontSize={fs - 1} fill={tint(BLUE, 'cc')} fontFamily="Inter, sans-serif" letterSpacing="1">BAD BUT LUCKY</text>
          <text x={PAD.left + cw - 4} y={PAD.top + ch - 6} textAnchor="end" fontSize={fs - 1} fill={tint(GOLD, 'dd')} fontFamily="Inter, sans-serif" letterSpacing="1">GOOD, UNLUCKY</text>
          <text x={PAD.left + 4} y={PAD.top + ch - 6} fontSize={fs - 1} fill={tint(RED, 'cc')} fontFamily="Inter, sans-serif" letterSpacing="1">BAD &amp; UNLUCKY</text>
          <text x={PAD.left + cw / 2} y={H - 4} textAnchor="middle" fontSize={fs} fill={muted} fontFamily="Inter, sans-serif" letterSpacing="1.5">ALL-PLAY WIN % VS LEAGUE AVG (pts)</text>
          <text x={10} y={PAD.top + ch / 2} textAnchor="middle" fontSize={fs} fill={muted} fontFamily="Inter, sans-serif" letterSpacing="1.5" transform={`rotate(-90, 10, ${PAD.top + ch / 2})`}>LUCK PER GAME (pts)</text>
          {ordered.map(p => {
            const on = p.id === teamId
            const r = rad(p)
            return (
              <g key={p.id}>
                <title>{`${p.name} — ${p.record.w}-${p.record.l} · All-play ${p.allPlay.pct.toFixed(1)}% · Luck ${signed(p.allPlay.luck, 2)}`}</title>
                {on && <circle cx={sx(p.ljX)} cy={sy(p.ljY)} r={r + 7} fill={tint(GOLD, '33')} />}
                <circle cx={sx(p.ljX)} cy={sy(p.ljY)} r={r} fill={on ? GOLD : grey} fillOpacity={on ? 0.95 : 0.3} stroke={on ? (d ? '#fff' : '#0d2152') : grey} strokeOpacity={on ? 0.9 : 0.5} strokeWidth={on ? 2 : 1} />
                <text x={sx(p.ljX)} y={sy(p.ljY) + 3} textAnchor="middle" fontSize={on ? fs + 1 : fs - 1} fill={on ? (d ? '#101010' : '#101010') : muted} fontFamily="Inter, sans-serif" fontWeight={on ? 700 : 500} style={{ pointerEvents: 'none' }}>{label(p)}</text>
              </g>
            )
          })}
        </svg>
        <p style={{ color: muted, fontSize: '11px', textAlign: 'center', margin: '4px 0 12px' }}>Bubble size = power score · axes centered on the league average</p>
      </div>
    )
  }

  const LjTab = () => {
    const ap = profile.allPlay
    if (!profile.weekly.length) return <Empty>No games played yet.</Empty>
    const apRank = rankOf(profiles, teamId, p => p.allPlay.pct)
    const luckRank = rankOf(profiles, teamId, p => p.allPlay.luck)
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '14px 12px 4px' }}>
          {[
            ['All-play win %', `${ap.pct.toFixed(1)}%`, `${ap.wins}-${ap.games - ap.wins} vs everyone`, ORANGE, apRank],
            ['Luck', signed(ap.luck, 2), `${ap.actualWins} wins vs ${ap.expectedWins.toFixed(1)} expected`, ap.luck >= 0 ? GREEN : RED, luckRank],
            ['Record', `${profile.record.w}-${profile.record.l}`, 'head-to-head', BLUE, rankOf(profiles, teamId, p => p.winPct)],
          ].map(([label, value, sub, c, r]) => (
            <div key={label} style={{ background: tint(c, '14'), borderTop: `3px solid ${c}`, padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: muted }}>{label}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: effectiveMobile ? '20px' : '26px', color: c, margin: '4px 0 2px' }}>{value}</div>
              <div style={{ fontSize: '11px', color: muted, marginBottom: '6px' }}>{sub}</div>
              <RankPill r={r} size={10} />
            </div>
          ))}
        </div>
        <LjPlot />
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
                    <td style={{ ...cStyle('center'), fontWeight: 600, color: g.won ? GREEN : RED }}>{g.won ? 'W' : 'L'}</td>
                    <td style={{ ...cStyle('right'), color: luck >= 0 ? GREEN : RED }}>{signed(luck, 2)}</td>
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

  // ── key stats: a dashboard, every number ranked against the league ──
  const Donut = ({ pct, color, size = 96 }) => {
    const r = size / 2 - 9, c = 2 * Math.PI * r
    const frac = Math.max(0, Math.min(1, pct / 100))
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d ? 'rgba(255,255,255,0.1)' : 'rgba(13,33,82,0.1)'} strokeWidth="9" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontFamily="'Playfair Display', serif" fontWeight="700" fontSize={size * 0.24} fill={text}>{pct.toFixed(0)}%</text>
      </svg>
    )
  }

  const WeeklyBars = () => {
    const w = profile.weekly
    if (!w.length) return null
    const leagueAvg = w.map(g => {
      const scores = profiles.map(p => p.weekly.find(x => x.week === g.week)?.score).filter(v => v != null)
      return scores.reduce((s, v) => s + v, 0) / (scores.length || 1)
    })
    const W = 520, H = 170, PAD = { top: 14, right: 10, bottom: 26, left: 10 }
    const max = Math.max(...w.map(g => g.score), ...leagueAvg) * 1.12
    const bw = (W - PAD.left - PAD.right) / w.length
    const y = v => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom)
    const line = leagueAvg.map((v, i) => `${i ? 'L' : 'M'} ${PAD.left + bw * i + bw / 2} ${y(v)}`).join(' ')
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[0.25, 0.5, 0.75].map(f => <line key={f} x1={PAD.left} x2={W - PAD.right} y1={PAD.top + f * (H - PAD.top - PAD.bottom)} y2={PAD.top + f * (H - PAD.top - PAD.bottom)} stroke={d ? 'rgba(255,255,255,0.07)' : 'rgba(13,33,82,0.08)'} />)}
        {w.map((g, i) => {
          const x = PAD.left + bw * i + bw * 0.16, ww = bw * 0.68, c = g.won ? GREEN : RED
          return (
            <g key={g.week}>
              <title>{`Week ${g.week}: ${g.score.toFixed(1)} vs ${g.oppName} ${g.oppScore.toFixed(1)}`}</title>
              <rect x={x} y={y(g.score)} width={ww} height={H - PAD.bottom - y(g.score)} fill={c} fillOpacity={0.88} rx="2" />
              <text x={x + ww / 2} y={y(g.score) - 4} textAnchor="middle" fontSize="9.5" fill={text} fontFamily="Inter, sans-serif" fontWeight="600">{g.score.toFixed(0)}</text>
              <text x={x + ww / 2} y={H - 9} textAnchor="middle" fontSize="10" fill={muted} fontFamily="Inter, sans-serif">W{g.week}</text>
            </g>
          )
        })}
        <path d={line} fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="5 4" />
        {leagueAvg.map((v, i) => <circle key={i} cx={PAD.left + bw * i + bw / 2} cy={y(v)} r="3" fill={GOLD} />)}
      </svg>
    )
  }

  const StatsTab = () => {
    const p = profile
    if (!p.games) return <Empty>No games played yet.</Empty>
    const R = (getter, hi = true) => rankOf(profiles, teamId, getter, hi)
    const kpis = [
      { label: 'Record', value: `${p.record.w}-${p.record.l}`, sub: p.streak.type ? `${p.streak.type}${p.streak.len} streak` : '', color: BLUE, r: R(x => x.winPct) },
      { label: 'Points for', value: p.pf.toFixed(1), sub: `${p.avg.toFixed(1)} per game`, color: GREEN, r: R(x => x.pf) },
      { label: 'Points against', value: p.pa.toFixed(1), sub: `${(p.pa / p.games).toFixed(1)} per game · fewer is better`, color: RED, r: R(x => x.pa, false) },
      { label: 'Point diff', value: signed(p.diff), sub: 'PF minus PA', color: p.diff >= 0 ? TEAL : ORANGE, r: R(x => x.diff) },
    ]
    const board = [
      { label: 'Avg PPG', value: p.avg.toFixed(1), r: R(x => x.avg), color: GREEN },
      { label: 'Median score', value: p.median.toFixed(1), r: R(x => x.median), color: BLUE },
      { label: 'Consistency (std dev)', value: p.std.toFixed(1), r: R(x => x.std, false), color: TEAL },
      { label: 'High score', value: p.high ? p.high.score.toFixed(1) : '—', r: R(x => (x.high ? x.high.score : null)), color: GREEN, sub: p.high ? `Wk ${p.high.week} vs ${p.high.oppName}` : '' },
      { label: 'Low score', value: p.low ? p.low.score.toFixed(1) : '—', r: R(x => (x.low ? x.low.score : null)), color: RED, sub: p.low ? `Wk ${p.low.week} vs ${p.low.oppName}` : '' },
      { label: 'Luck', value: signed(p.allPlay.luck, 2), r: R(x => x.allPlay.luck), color: PURPLE },
      { label: 'Max PF (perfect lineups)', value: p.efficiency.maxPf != null ? p.efficiency.maxPf.toFixed(1) : '—', r: R(x => x.efficiency.maxPf), color: ORANGE },
      { label: 'Bye-week schedule luck', value: p.byeLuck ? `${p.byeLuck.oppLost.toFixed(1)} ppg` : '—', r: R(x => (x.byeLuck ? x.byeLuck.oppLost : null)), color: GOLD, sub: "opponents' starters lost to byes" },
      { label: 'Power score', value: p.powerScore.toFixed(1), r: R(x => x.powerScore), color: BLUE },
    ].filter(b => b.r)
    const donuts = [
      { label: 'All-play win %', pct: p.allPlay.pct, color: ORANGE, r: R(x => x.allPlay.pct), sub: `${p.allPlay.wins}-${p.allPlay.games - p.allPlay.wins} vs the whole league` },
      p.efficiency.startPct != null && { label: 'Correct start %', pct: p.efficiency.startPct, color: PURPLE, r: R(x => x.efficiency.startPct), sub: 'real lineup vs the best possible one' },
    ].filter(Boolean)
    const card = { background: d ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)', border: `1px solid ${border}`, padding: '14px 16px' }
    const title = t => <div style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>{t}</div>
    return (
      <div style={{ padding: '14px 12px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* headline numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px' }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: `linear-gradient(160deg, ${tint(k.color, '26')}, ${tint(k.color, '0a')})`, borderTop: `3px solid ${k.color}`, padding: '14px 16px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: muted }}>{k.label}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: effectiveMobile ? '26px' : '32px', color: k.color, lineHeight: 1.1, margin: '6px 0 2px' }}>{k.value}</div>
              <div style={{ fontSize: '11px', color: muted, minHeight: '15px' }}>{k.sub}</div>
              <div style={{ marginTop: '8px' }}><RankPill r={k.r} /></div>
              <RankStrip r={k.r} />
            </div>
          ))}
        </div>

        {/* weekly scores + rings */}
        <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr' : '1.6fr 1fr', gap: '12px' }}>
          <div style={card}>
            {title('Weekly scores · green = win, red = loss, gold line = league average')}
            <WeeklyBars />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {donuts.map(dn => (
              <div key={dn.label} style={{ ...card, display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                <Donut pct={dn.pct} color={dn.color} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: muted, marginBottom: '6px' }}>{dn.label}</div>
                  <RankPill r={dn.r} />
                  <div style={{ fontSize: '11px', color: muted, marginTop: '8px', lineHeight: 1.4 }}>{dn.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* league rank board */}
        <div style={card}>
          {title('Where they rank in the league · longer bar = better')}
          <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr' : '1fr 1fr', gap: '10px 28px' }}>
            {board.map(b => {
              const c = tierColor(b.r.rank, b.r.of)
              return (
                <div key={b.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: text }}>{b.label}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '15px', color: b.color }}>{b.value}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: c, minWidth: '34px', textAlign: 'right' }}>{ordinal(b.r.rank)}</span>
                    </span>
                  </div>
                  <div style={{ height: '8px', background: d ? 'rgba(255,255,255,0.08)' : 'rgba(13,33,82,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${((b.r.of - b.r.rank + 1) / b.r.of) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${tint(b.color, 'aa')}, ${b.color})`, borderRadius: '4px' }} />
                  </div>
                  {b.sub && <div style={{ fontSize: '10px', color: muted, marginTop: '3px' }}>{b.sub}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // How a historical team's season ended, as a label + colour.
  const finishOf = t => {
    if (!t) return { label: '—', color: muted }
    if (t.playoff_result === 'Champion') return { label: '🏆 Champion', color: GOLD }
    if (t.playoff_result === 'Runner Up') return { label: 'Runner-up', color: '#c0c6d4' }
    if (t.playoff_result === 'Third Place') return { label: '3rd place', color: '#cd7f32' }
    if (t.made_playoffs) return { label: t.final_standing ? `Playoffs · #${t.final_standing}` : 'Made playoffs', color: GREEN }
    if (t.playoff_result?.includes('Mol Bowl')) return { label: t.playoff_result, color: RED }
    return { label: t.final_standing ? `Missed · #${t.final_standing}` : 'Missed playoffs', color: RED }
  }

  const SimilarTab = () => {
    if (histError) return <Empty>{histError}</Empty>
    if (!similar) return <Empty>Comparing against every past season…</Empty>
    if (similar.empty) return <Empty>{profile.weekly.length ? 'No past seasons have played this many weeks yet.' : 'No games played yet.'}</Empty>
    const top = similar.results
    const made = top.filter(r => r.team?.made_playoffs).length
    const titles = top.filter(r => r.team?.playoff_result === 'Champion').length
    const standings = top.map(r => r.team?.final_standing).filter(v => v != null)
    const avgFinish = standings.length ? standings.reduce((s, v) => s + v, 0) / standings.length : null
    const chip = (text2, c) => <span key={text2} style={{ display: 'inline-block', fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: tint(c, '22'), color: c, border: `1px solid ${tint(c, '55')}`, marginRight: '5px', whiteSpace: 'nowrap' }}>{text2}</span>
    return (
      <div style={{ padding: '14px 12px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', color: muted, lineHeight: 1.5, maxWidth: '520px' }}>
            Past teams that looked most like {profile.name}'s through <span style={{ color: text, fontWeight: 600 }}>Week {similar.week}</span>, measured
            at the same point in their own seasons ({similar.pool} teams compared): record, scoring, power score, all-play, luck, consistency and how the roster's scoring splits across lineup slots.
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a href={`/similar-teams?team=${teamId}`} style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: d ? '#1b202c' : '#fff', background: accent, textDecoration: 'none', padding: '7px 12px', whiteSpace: 'nowrap', fontWeight: 700 }}>Compare side by side →</a>
            <a href="/all-time-teams" style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: accent, textDecoration: 'none', border: `1px solid ${border}`, padding: '6px 12px', whiteSpace: 'nowrap' }}>All-time teams →</a>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
          {[
            ['Made the playoffs', `${made} of ${top.length}`, made / top.length >= 0.5 ? GREEN : RED],
            ['Won the title', `${titles} of ${top.length}`, GOLD],
            ['Avg final finish', avgFinish != null ? ordinal(Math.round(avgFinish)) : '—', BLUE],
          ].map(([label, value, c]) => (
            <div key={label} style={{ background: `linear-gradient(160deg, ${tint(c, '26')}, ${tint(c, '0a')})`, borderTop: `3px solid ${c}`, padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: muted }}>{label}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: effectiveMobile ? '20px' : '26px', color: c, marginTop: '4px' }}>{value}</div>
              <div style={{ fontSize: '10px', color: muted, marginTop: '2px' }}>the {top.length} closest teams</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {top.map((r, i) => {
            const t = r.team
            const fin = finishOf(t)
            const simColor = r.similarity >= 70 ? GREEN : r.similarity >= 45 ? GOLD : ORANGE
            return (
              <a
                key={r.id}
                href={`/all-time-teams?team=${r.id}`}
                title="Open in All-Time Teams"
                style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '58px 1fr' : '70px 1.4fr 1fr 1.1fr', gap: '12px', alignItems: 'center', padding: '12px 14px', background: d ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)', border: `1px solid ${border}`, borderLeft: `4px solid ${simColor}`, textDecoration: 'none', color: text }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '24px', color: simColor, lineHeight: 1 }}>{Math.round(r.similarity)}<span style={{ fontSize: '12px' }}>%</span></div>
                  <div style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: muted, marginTop: '3px' }}>match</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t?.manager?.name || '?'} <span style={{ color: muted, fontSize: '13px' }}>· {t?.season?.year}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t?.team_name}</div>
                  <div style={{ marginTop: '6px', display: 'inline-block', fontSize: '11px', fontWeight: 700, color: fin.color }}>{fin.label}</div>
                </div>
                {!effectiveMobile && (
                  <div style={{ fontSize: '12px', lineHeight: 1.7 }}>
                    <div><span style={{ color: muted }}>Through wk {similar.week}: </span><span style={{ fontWeight: 600 }}>{r.meta.wins}-{r.meta.losses}</span> <span style={{ color: muted }}>({r.meta.avg.toFixed(1)} ppg)</span></div>
                    <div><span style={{ color: muted }}>Finished: </span><span style={{ fontWeight: 600 }}>{t ? `${t.wins}-${t.losses}` : '—'}</span> <span style={{ color: muted }}>· power {r.meta.power.toFixed(0)}</span></div>
                    <div style={{ color: muted }}>Luck <span style={{ color: r.meta.luck >= 0 ? GREEN : RED, fontWeight: 600 }}>{signed(r.meta.luck * similar.week, 2)}</span> <span style={{ color: muted }}>(you: </span><span style={{ color: similar.target.luck >= 0 ? GREEN : RED, fontWeight: 600 }}>{signed(similar.target.luck * similar.week, 2)}</span><span style={{ color: muted }}>)</span></div>
                  </div>
                )}
                <div style={{ gridColumn: effectiveMobile ? '1 / -1' : 'auto' }}>
                  {r.matched.map(m => chip(`≈ ${m}`, GREEN))}
                  {r.differed.map(m => chip(`≠ ${m}`, ORANGE))}
                </div>
              </a>
            )
          })}
        </div>
        <div style={{ fontSize: '11px', color: muted, marginTop: '12px', lineHeight: 1.6 }}>
          Roster mix compares each team's season-long per-game scoring by lineup slot (QB, RB1, RB2, WR1, WR2, TE, FLEX, K, bench), so older seasons use their season averages while this one uses scoring to date.
        </div>
      </div>
    )
  }

  const body = !profile
    ? <Empty>{error || 'Loading…'}</Empty>
    : tab === 'schedule' ? <ScheduleTab />
    : tab === 'roster' ? <RosterTab />
    : tab === 'lj' ? <LjTab />
    : tab === 'similar' ? <SimilarTab />
    : <StatsTab />

  return (
    <div onClick={e => e.stopPropagation()} style={{ background: bg, borderTop: `2px solid ${accent}`, borderBottom: `1px solid ${border}` }}>
      <div style={{ display: 'flex', gap: '6px', padding: '12px 12px 0', overflowX: 'auto', overflowY: 'hidden', background: cardBg, borderBottom: `1px solid ${border}` }}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              background: tab === key ? bg : 'transparent', color: tab === key ? text : muted,
              border: `1px solid ${tab === key ? border : 'transparent'}`, borderBottom: tab === key ? `1px solid ${bg}` : '1px solid transparent',
              borderTop: tab === key ? `3px solid ${accent}` : '3px solid transparent',
              marginBottom: '-1px', padding: '9px 18px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontWeight: tab === key ? 700 : 400, whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {body}
    </div>
  )
}
