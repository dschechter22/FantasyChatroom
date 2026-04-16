'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function ManagersPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, green, red, gold, blue } = useLayout()

  const [managers, setManagers] = useState([])
  const [teams, setTeams] = useState([])
  const [seasons, setSeasons] = useState([])
  const [matchups, setMatchups] = useState([])
  const [selectedManager, setSelectedManager] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [showRetired, setShowRetired] = useState(false)

  useEffect(() => {
    supabase.from('managers').select('*').then(({ data }) => setManagers(data || []))
    supabase.from('teams').select('*, season:season_id(year)').then(({ data }) => setTeams(data || []))
    supabase.from('seasons').select('*, champion:champion_id(id), mol_bowl_loser:mol_bowl_loser_id(id)').then(({ data }) => setSeasons(data || []))
    supabase.from('matchups')
      .select('*, home_team:home_team_id(id, manager_id), away_team:away_team_id(id, manager_id), season:season_id(year)')
      .eq('is_playoff', false)
      .then(({ data }) => setMatchups(data || []))
  }, [])

  // Compute power score for each team season
  const powerScores = useMemo(() => {
    if (teams.length === 0 || matchups.length === 0) return {}
    const result = {}

    const matchupsByYear = {}
    matchups.forEach(m => {
      const yr = m.season?.year
      if (!yr) return
      if (!matchupsByYear[yr]) matchupsByYear[yr] = []
      matchupsByYear[yr].push(m)
    })

    const median = (arr) => {
      if (!arr.length) return 0
      const s = [...arr].sort((a, b) => a - b)
      const mid = Math.floor(s.length / 2)
      return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2
    }

    // Group teams by year
    const teamsByYear = {}
    teams.forEach(t => {
      const yr = t.season?.year
      if (!yr) return
      if (!teamsByYear[yr]) teamsByYear[yr] = []
      teamsByYear[yr].push(t)
    })

    Object.entries(teamsByYear).forEach(([yr, yearTeams]) => {
      const yearMatchups = matchupsByYear[yr] || []
      const weeks = [...new Set(yearMatchups.map(m => m.week))].sort((a, b) => a - b)

      const teamMetrics = {}
      yearTeams.forEach(t => {
        teamMetrics[t.id] = { t, scores: [], allPlaySum: 0, wins: t.wins, losses: t.losses }
      })

      yearMatchups.forEach(m => {
        if (teamMetrics[m.home_team?.id]) teamMetrics[m.home_team.id].scores.push(m.home_score)
        if (teamMetrics[m.away_team?.id]) teamMetrics[m.away_team.id].scores.push(m.away_score)
      })

      weeks.forEach(week => {
        const weekGames = yearMatchups.filter(m => m.week === week)
        const allScores = []
        weekGames.forEach(m => {
          allScores.push({ teamId: m.home_team?.id, score: m.home_score })
          allScores.push({ teamId: m.away_team?.id, score: m.away_score })
        })
        const n = allScores.length
        if (n < 2) return
        allScores.forEach(({ teamId, score }) => {
          if (!teamMetrics[teamId]) return
          teamMetrics[teamId].allPlaySum += allScores.filter(o => o.teamId !== teamId && score > o.score).length / (n - 1)
        })
      })

      const rows = Object.values(teamMetrics).map(({ t, scores, allPlaySum, wins, losses }) => {
        const games = wins + losses
        const winPct = games > 0 ? wins / games : 0
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
        const medianScore = median(scores)
        const allPlayWinPct = weeks.length > 0 ? allPlaySum / weeks.length : 0
        return { t, winPct, avgScore, medianScore, allPlayWinPct }
      })

      const maxWin = Math.max(...rows.map(r => r.winPct))
      const maxAvg = Math.max(...rows.map(r => r.avgScore))
      const maxMed = Math.max(...rows.map(r => r.medianScore))
      const maxAp = Math.max(...rows.map(r => r.allPlayWinPct))

      rows.forEach(r => {
        const ps = parseFloat((
          (r.winPct / (maxWin || 1) * 100 * 2) +
          (r.avgScore / (maxAvg || 1) * 100 * 4) +
          (r.allPlayWinPct / (maxAp || 1) * 100 * 2) +
          (r.medianScore / (maxMed || 1) * 100 * 2)
        ) / 10).toFixed(2)
        result[r.t.id] = parseFloat(ps)
      })
    })

    return result
  }, [teams, matchups])

  // Build career stats per manager
  const managerStats = useMemo(() => {
    return managers.map(m => {
      const mTeams = teams.filter(t => t.manager_id === m.id)
      if (mTeams.length === 0) return null

      const wins = mTeams.reduce((s, t) => s + t.wins, 0)
      const losses = mTeams.reduce((s, t) => s + t.losses, 0)
      const pf = parseFloat(mTeams.reduce((s, t) => s + t.points_for, 0).toFixed(2))
      const pa = parseFloat(mTeams.reduce((s, t) => s + t.points_against, 0).toFixed(2))
      const diff = parseFloat((pf - pa).toFixed(2))
      const games = wins + losses
      const winPct = games > 0 ? parseFloat(((wins / games) * 100).toFixed(1)) : 0
      const avgPpg = games > 0 ? parseFloat((pf / games).toFixed(2)) : 0
      const championships = seasons.filter(s => s.champion?.id === m.id).length
      const molBowls = seasons.filter(s => s.mol_bowl_loser?.id === m.id).length
      const playoffAppearances = mTeams.filter(t => t.made_playoffs).length
      const seasonsPlayed = mTeams.length

      // Best and worst season by power score
      const teamWithScores = mTeams.map(t => ({
        ...t,
        ps: powerScores[t.id] ?? 0,
      })).filter(t => t.ps > 0)

      const bestSeason = teamWithScores.length > 0
        ? teamWithScores.sort((a, b) => b.ps - a.ps)[0]
        : null
      const worstSeason = teamWithScores.length > 0
        ? teamWithScores.sort((a, b) => a.ps - b.ps)[0]
        : null

      // Career avg power score
      const avgPowerScore = teamWithScores.length > 0
        ? parseFloat((teamWithScores.reduce((s, t) => s + t.ps, 0) / teamWithScores.length).toFixed(2))
        : 0

      // Season breakdown for expanded view
      const seasonBreakdown = mTeams
        .sort((a, b) => b.season.year - a.season.year)
        .map(t => ({
          year: t.season.year,
          team_name: t.team_name,
          wins: t.wins,
          losses: t.losses,
          pf: parseFloat(t.points_for.toFixed(2)),
          pa: parseFloat(t.points_against.toFixed(2)),
          diff: parseFloat((t.points_for - t.points_against).toFixed(2)),
          made_playoffs: t.made_playoffs,
          playoff_result: t.playoff_result,
          ps: powerScores[t.id] ?? null,
          final_standing: t.final_standing,
        }))

      return {
        ...m, wins, losses, pf, pa, diff, winPct, avgPpg,
        championships, molBowls, playoffAppearances, seasonsPlayed,
        bestSeason, worstSeason, avgPowerScore, seasonBreakdown,
      }
    }).filter(Boolean)
  }, [managers, teams, seasons, powerScores])

  // Career power score rank
  const rankedStats = useMemo(() => {
    if (managerStats.length === 0) return []
    const maxPs = Math.max(...managerStats.map(m => m.avgPowerScore))
    const minPs = Math.min(...managerStats.map(m => m.avgPowerScore))
    const maxChamps = Math.max(...managerStats.map(m => m.championships))

    const withScore = managerStats.map(m => {
      const normPs = maxPs === minPs ? 0.5 : (m.avgPowerScore - minPs) / (maxPs - minPs)
      const normChamps = maxChamps === 0 ? 0 : m.championships / maxChamps
      const careerScore = normPs * 0.5 + normChamps * 0.5
      return { ...m, careerScore }
    })

    const sorted = [...withScore].sort((a, b) => b.careerScore - a.careerScore)
    return withScore.map(m => ({
      ...m,
      careerPowerRank: sorted.findIndex(s => s.id === m.id) + 1,
    }))
  }, [managerStats])

  const displayManagers = rankedStats
    .filter(m => showRetired ? true : m.active)
    .filter(m => !searchText || m.name.toLowerCase().includes(searchText.toLowerCase()))
    .sort((a, b) => a.careerPowerRank - b.careerPowerRank)

  const resultColor = (result) => {
    if (!result) return muted
    if (result === 'Champion') return gold
    if (result === 'Runner Up') return d ? 'rgba(192,192,192,0.9)' : '#555'
    if (result === 'Third Place') return d ? '#cd7f32' : '#7c4a00'
    if (result?.includes('Mol Bowl')) return red
    if (result?.includes('Playoff')) return blue
    return muted
  }

  const StatRow = ({ label, value, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${border}` }}>
      <span style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: muted }}>{label}</span>
      <span style={{ fontSize: '14px', color: color || text, fontWeight: '500' }}>{value}</span>
    </div>
  )

  const ManagerCard = ({ m }) => {
    const isSelected = selectedManager === m.id
    return (
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderTop: `3px solid ${m.championships > 0 ? gold : m.active ? (d ? 'rgba(255,255,255,0.2)' : 'rgba(13,33,82,0.2)') : border}` }}>
        {/* Card header */}
        <div
          onClick={() => setSelectedManager(isSelected ? null : m.id)}
          style={{ padding: effectiveMobile ? '16px' : '20px 24px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '20px' : '24px', color: text, marginBottom: '4px' }}>{m.name}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: m.active ? green : muted }}>
                  {m.active ? 'Active' : 'Retired'}
                </span>
                <span style={{ fontSize: '10px', color: muted }}>·</span>
                <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: muted }}>
                  {m.seasonsPlayed} season{m.seasonsPlayed !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: '10px', color: muted }}>·</span>
                <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: muted }}>
                  #{m.careerPowerRank} all-time power
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
              {m.championships > 0 && (
                <div style={{ fontSize: effectiveMobile ? '20px' : '24px', marginBottom: '2px' }}>
                  {'🏆'.repeat(Math.min(m.championships, 3))}
                  {m.championships > 3 ? ` ×${m.championships}` : ''}
                </div>
              )}
              <div style={{ fontSize: '11px', color: muted }}>{isSelected ? '▲' : '▼'}</div>
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              ['Record', `${m.wins}-${m.losses}`],
              ['Win %', `${m.winPct}%`],
              ['Playoffs', m.playoffAppearances],
              ['Avg PPG', m.avgPpg],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '3px' }}>{label}</div>
                <div style={{ fontSize: effectiveMobile ? '14px' : '16px', color: text, fontWeight: '500' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Expanded detail */}
        {isSelected && (
          <div style={{ borderTop: `1px solid ${border}`, padding: effectiveMobile ? '16px' : '20px 24px' }}>

            {/* Full career stats */}
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '12px' }}>Career Stats</p>
              <StatRow label="All-Time Record" value={`${m.wins}-${m.losses} (${m.winPct}%)`} />
              <StatRow label="Points For" value={m.pf.toFixed(0)} />
              <StatRow label="Points Against" value={m.pa.toFixed(0)} />
              <StatRow label="Point Differential" value={`${m.diff >= 0 ? '+' : ''}${m.diff.toFixed(0)}`} color={m.diff >= 0 ? green : red} />
              <StatRow label="Avg PPG" value={m.avgPpg} />
              <StatRow label="Championships" value={m.championships || '—'} color={m.championships > 0 ? gold : muted} />
              <StatRow label="Playoff Appearances" value={m.playoffAppearances} />
              <StatRow label="Mol Bowl Losses" value={m.molBowls || '—'} color={m.molBowls > 0 ? red : muted} />
              <StatRow label="Avg Power Score" value={m.avgPowerScore} />
              <StatRow label="Career Power Rank" value={`#${m.careerPowerRank}`} color={m.careerPowerRank <= 3 ? gold : text} />
              {m.bestSeason && (
                <StatRow label="Best Season" value={`${m.bestSeason.season?.year || m.bestSeason.year} — ${powerScores[m.bestSeason.id]?.toFixed(1) ?? m.bestSeason.ps?.toFixed(1)} PS`} color={green} />
              )}
              {m.worstSeason && (
                <StatRow label="Worst Season" value={`${m.worstSeason.season?.year || m.worstSeason.year} — ${powerScores[m.worstSeason.id]?.toFixed(1) ?? m.worstSeason.ps?.toFixed(1)} PS`} color={red} />
              )}
            </div>

            {/* Season by season */}
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '12px' }}>Season by Season</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                <thead>
                  <tr style={{ background: d ? '#111' : '#e4e0d8' }}>
                    {['Year', 'Team', 'W', 'L', 'PF', 'Diff', 'PS', 'Result'].map((h, i) => (
                      <th key={h} style={{ padding: '8px 10px', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, textAlign: i <= 1 ? 'left' : 'right', borderBottom: `1px solid ${border}`, fontWeight: '500', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.seasonBreakdown.map((s, i) => (
                    <tr key={s.year} style={{ background: i % 2 === 0 ? 'transparent' : (d ? '#080808' : '#e8e4dc') }}>
                      <td style={{ padding: '10px', fontSize: '12px', color: muted, borderBottom: `1px solid ${border}`, whiteSpace: 'nowrap' }}>{s.year}</td>
                      <td style={{ padding: '10px', fontSize: '12px', color: text, borderBottom: `1px solid ${border}`, fontFamily: "'Playfair Display', serif", whiteSpace: 'nowrap' }}>{s.team_name}</td>
                      <td style={{ padding: '10px', fontSize: '12px', color: text, borderBottom: `1px solid ${border}`, textAlign: 'right', whiteSpace: 'nowrap' }}>{s.wins}</td>
                      <td style={{ padding: '10px', fontSize: '12px', color: text, borderBottom: `1px solid ${border}`, textAlign: 'right', whiteSpace: 'nowrap' }}>{s.losses}</td>
                      <td style={{ padding: '10px', fontSize: '12px', color: text, borderBottom: `1px solid ${border}`, textAlign: 'right', whiteSpace: 'nowrap' }}>{s.pf.toFixed(0)}</td>
                      <td style={{ padding: '10px', fontSize: '12px', color: s.diff >= 0 ? green : red, borderBottom: `1px solid ${border}`, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: '500' }}>
                        {s.diff >= 0 ? '+' : ''}{s.diff.toFixed(0)}
                      </td>
                      <td style={{ padding: '10px', fontSize: '12px', color: text, borderBottom: `1px solid ${border}`, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {s.ps !== null ? s.ps.toFixed(1) : '—'}
                      </td>
                      <td style={{ padding: '10px', fontSize: '11px', color: resultColor(s.playoff_result), borderBottom: `1px solid ${border}`, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: '500' }}>
                        {s.playoff_result || (s.made_playoffs ? 'Playoffs' : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  const filterBtn = (active, label, onClick) => (
    <button onClick={onClick} style={{
      background: active ? text : 'none', border: `1px solid ${border}`,
      color: active ? bg : muted, padding: effectiveMobile ? '6px 10px' : '7px 16px',
      cursor: 'pointer', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
      fontFamily: "'Inter', sans-serif", fontWeight: '500', transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>{label}</button>
  )

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>

        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px, 6vw, 72px)', fontWeight: '400', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          Managers
        </h1>
        <p style={{ color: muted, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '32px' }}>
          {displayManagers.length} managers · sorted by career power score
        </p>

        {/* Filters */}
        <div style={{ display: 'flex', flexDirection: effectiveMobile ? 'column' : 'row', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            placeholder="Search manager..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ background: cardBg, border: `1px solid ${border}`, color: text, padding: '7px 12px', fontSize: '12px', fontFamily: "'Inter', sans-serif", outline: 'none', width: effectiveMobile ? '100%' : '200px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {filterBtn(!showRetired, 'Active Only', () => setShowRetired(false))}
          {filterBtn(showRetired, 'Include Retired', () => setShowRetired(true))}
        </div>

        {/* Manager cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {displayManagers.map(m => <ManagerCard key={m.id} m={m} />)}
        </div>

      </div>
    </div>
  )
}
