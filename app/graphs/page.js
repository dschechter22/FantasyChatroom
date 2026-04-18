'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const MANAGER_COLORS = [
  '#4285F4', '#34A853', '#FBBC04', '#EA4335', '#46BDC6',
  '#7BAAF7', '#a78bfa', '#f97316', '#10b981', '#f43f5e'
]

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST']
const POS_COLORS = {
  QB: '#4285F4', RB: '#34A853', WR: '#FBBC04',
  TE: '#EA4335', K: '#46BDC6', 'D/ST': '#7BAAF7'
}

export default function GraphsPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, gold } = useLayout()
  const [mounted, setMounted] = useState(false)

  // Raw data
  const [teams, setTeams] = useState([])
  const [matchups, setMatchups] = useState([])
  const [rosterEntries, setRosterEntries] = useState([])
  const [teamsMap, setTeamsMap] = useState({})

  // Filters
  const [selectedManagers, setSelectedManagers] = useState([])
  const [varianceManager, setVarianceManager] = useState('all')
  const [varianceYearFrom, setVarianceYearFrom] = useState('all')
  const [varianceYearTo, setVarianceYearTo] = useState('all')

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const load = async () => {
      const [{ data: teamsData }, { data: matchupsData }] = await Promise.all([
        supabase.from('teams').select('*, manager:manager_id(name, slug), season:season_id(year)'),
        supabase.from('matchups').select('*, season:season_id(year), home_team:home_team_id(id, manager_id), away_team:away_team_id(id, manager_id)').eq('is_playoff', false),
      ])

      const teams = teamsData || []
      const matchups = matchupsData || []
      setTeams(teams)
      setMatchups(matchups)

      // Build team id -> {manager, year} map
      const tmap = {}
      teams.forEach(t => { tmap[t.id] = t })
      setTeamsMap(tmap)

      // Set all managers selected by default
      const slugs = [...new Set(teams.map(t => t.manager?.slug).filter(Boolean))]
      setSelectedManagers(slugs)

      // Fetch roster entries in batches
      let allEntries = []
      let from = 0
      while (true) {
        const { data: batch } = await supabase
          .from('roster_entries')
          .select('player_id, fpts, avg_pts, team_id, player:player_id(position)')
          .range(from, from + 999)
        if (!batch || batch.length === 0) break
        allEntries = [...allEntries, ...batch]
        if (batch.length < 1000) break
        from += 1000
      }
      setRosterEntries(allEntries)
    }
    load()
  }, [])

  const allManagers = useMemo(() => {
    const seen = new Map()
    teams.forEach(t => {
      if (t.manager?.slug && !seen.has(t.manager.slug)) {
        seen.set(t.manager.slug, t.manager.name)
      }
    })
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [teams])

  const allYears = useMemo(() =>
    [...new Set(teams.map(t => t.season?.year).filter(Boolean))].sort((a, b) => a - b),
    [teams]
  )

  const managerColor = (slug) => {
    const idx = allManagers.findIndex(([s]) => s === slug)
    return MANAGER_COLORS[idx % MANAGER_COLORS.length]
  }

  // ---- CHART 1: League avg PPG by year ----
  const leagueAvgPPG = useMemo(() => {
    const byYear = {}
    matchups.forEach(m => {
      const yr = m.season?.year
      if (!yr) return
      if (!byYear[yr]) byYear[yr] = []
      byYear[yr].push(m.home_score, m.away_score)
    })
    return allYears.map(yr => {
      const scores = byYear[yr] || []
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      return { year: yr, avg: parseFloat(avg.toFixed(1)) }
    })
  }, [matchups, allYears])

  // ---- CHART 2: Score variance per year (filterable) ----
  const varianceData = useMemo(() => {
    const fromYear = varianceYearFrom !== 'all' ? parseInt(varianceYearFrom) : null
    const toYear = varianceYearTo !== 'all' ? parseInt(varianceYearTo) : null

    const byYearTeam = {}
    matchups.forEach(m => {
      const yr = m.season?.year
      if (!yr) return
      if (fromYear && yr < fromYear) return
      if (toYear && yr > toYear) return

      const addScore = (teamId, score) => {
        const team = teamsMap[teamId]
        if (!team) return
        const slug = team.manager?.slug
        if (varianceManager !== 'all' && slug !== varianceManager) return
        const key = `${yr}-${slug}`
        if (!byYearTeam[key]) byYearTeam[key] = { yr, slug, name: team.manager?.name, scores: [] }
        byYearTeam[key].scores.push(score)
      }
      addScore(m.home_team?.id, m.home_score)
      addScore(m.away_team?.id, m.away_score)
    })

    // Group by year, compute avg std dev
    const byYear = {}
    Object.values(byYearTeam).forEach(({ yr, slug, scores }) => {
      if (!byYear[yr]) byYear[yr] = []
      if (scores.length < 2) return
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length
      const std = Math.sqrt(scores.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / scores.length)
      byYear[yr].push(std)
    })

    return allYears
      .filter(yr => {
        if (fromYear && yr < fromYear) return false
        if (toYear && yr > toYear) return false
        return true
      })
      .map(yr => {
        const stds = byYear[yr] || []
        const avg = stds.length > 0 ? stds.reduce((a, b) => a + b, 0) / stds.length : 0
        return { year: yr, variance: parseFloat(avg.toFixed(2)) }
      })
  }, [matchups, teamsMap, varianceManager, varianceYearFrom, varianceYearTo, allYears])

  // ---- CHART 3: PPG by position per year ----
  const positionPPG = useMemo(() => {
    const byYearPos = {}
    rosterEntries.forEach(e => {
      const team = teamsMap[e.team_id]
      if (!team) return
      const yr = team.season?.year
      const pos = e.player?.position
      if (!yr || !pos || !POSITIONS.includes(pos)) return
      if (!byYearPos[yr]) byYearPos[yr] = {}
      if (!byYearPos[yr][pos]) byYearPos[yr][pos] = []
      byYearPos[yr][pos].push(e.avg_pts || 0)
    })
    return allYears.map(yr => {
      const row = { year: yr }
      POSITIONS.forEach(pos => {
        const vals = byYearPos[yr]?.[pos] || []
        row[pos] = vals.length > 0 ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : 0
      })
      return row
    })
  }, [rosterEntries, teamsMap, allYears])

  // ---- CHARTS 4/5/6: Per-manager trends ----
  const managerPPG = useMemo(() => {
    const byYearSlug = {}
    matchups.forEach(m => {
      const yr = m.season?.year
      if (!yr) return
      const addScore = (teamId, score) => {
        const team = teamsMap[teamId]
        if (!team) return
        const slug = team.manager?.slug
        const key = `${yr}-${slug}`
        if (!byYearSlug[key]) byYearSlug[key] = { yr, slug, name: team.manager?.name, scores: [] }
        byYearSlug[key].scores.push(score)
      }
      addScore(m.home_team?.id, m.home_score)
      addScore(m.away_team?.id, m.away_score)
    })
    const byYear = {}
    Object.values(byYearSlug).forEach(({ yr, slug, name, scores }) => {
      if (!byYear[yr]) byYear[yr] = { year: yr }
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      byYear[yr][slug] = parseFloat(avg.toFixed(1))
    })
    return allYears.map(yr => byYear[yr] || { year: yr })
  }, [matchups, teamsMap, allYears])

  const managerPowerScore = useMemo(() => {
    // Compute power score per team per year
    const matchupsByYear = {}
    matchups.forEach(m => {
      const yr = m.season?.year
      if (!yr) return
      if (!matchupsByYear[yr]) matchupsByYear[yr] = []
      matchupsByYear[yr].push(m)
    })

    const byYear = {}
    teams.forEach(t => {
      const yr = t.season?.year
      const slug = t.manager?.slug
      if (!yr || !slug) return
      const seasonMatchups = matchupsByYear[yr] || []
      const weeks = [...new Set(seasonMatchups.map(m => m.week))].sort((a, b) => a - b)
      const myScores = []
      seasonMatchups.forEach(m => {
        if (m.home_team?.manager_id === t.manager_id) myScores.push({ week: m.week, score: m.home_score })
        else if (m.away_team?.manager_id === t.manager_id) myScores.push({ week: m.week, score: m.away_score })
      })
      if (myScores.length === 0) return
      let allPlayTotal = 0
      weeks.forEach(week => {
        const weekGames = seasonMatchups.filter(m => m.week === week)
        const allScores = []
        weekGames.forEach(m => {
          allScores.push({ managerId: m.home_team?.manager_id, score: m.home_score })
          allScores.push({ managerId: m.away_team?.manager_id, score: m.away_score })
        })
        const myWeekScore = myScores.find(s => s.week === week)?.score
        if (myWeekScore === undefined || allScores.length < 2) return
        const wins = allScores.filter(o => o.managerId !== t.manager_id && myWeekScore > o.score).length
        allPlayTotal += wins / (allScores.length - 1)
      })
      const scores = myScores.map(s => s.score)
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
      const sorted = [...scores].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const medianScore = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
      const winPct = (t.wins + t.losses) > 0 ? t.wins / (t.wins + t.losses) : 0
      const allPlayWinPct = weeks.length > 0 ? allPlayTotal / weeks.length : 0
      if (!byYear[yr]) byYear[yr] = { _raw: {} }
      byYear[yr]._raw[slug] = { winPct, avgScore, medianScore, allPlayWinPct }
    })

    // Normalize per year
    const result = {}
    allYears.forEach(yr => {
      const raw = byYear[yr]?._raw || {}
      const slugs = Object.keys(raw)
      if (slugs.length === 0) return
      const maxWin = Math.max(...slugs.map(s => raw[s].winPct))
      const maxAvg = Math.max(...slugs.map(s => raw[s].avgScore))
      const maxMed = Math.max(...slugs.map(s => raw[s].medianScore))
      const maxAp = Math.max(...slugs.map(s => raw[s].allPlayWinPct))
      if (!result[yr]) result[yr] = { year: yr }
      slugs.forEach(slug => {
        const s = raw[slug]
        const ps = ((s.winPct / (maxWin || 1) * 100 * 2) + (s.avgScore / (maxAvg || 1) * 100 * 4) + (s.allPlayWinPct / (maxAp || 1) * 100 * 2) + (s.medianScore / (maxMed || 1) * 100 * 2)) / 10
        result[yr][slug] = parseFloat(ps.toFixed(1))
      })
    })
    return allYears.map(yr => result[yr] || { year: yr })
  }, [teams, matchups, allYears])

  const managerLuck = useMemo(() => {
    const matchupsByYear = {}
    matchups.forEach(m => {
      const yr = m.season?.year
      if (!yr) return
      if (!matchupsByYear[yr]) matchupsByYear[yr] = []
      matchupsByYear[yr].push(m)
    })
    const byYear = {}
    teams.forEach(t => {
      const yr = t.season?.year
      const slug = t.manager?.slug
      if (!yr || !slug) return
      const seasonMatchups = matchupsByYear[yr] || []
      const weeks = [...new Set(seasonMatchups.map(m => m.week))].sort((a, b) => a - b)
      const myScores = []
      seasonMatchups.forEach(m => {
        if (m.home_team?.manager_id === t.manager_id) myScores.push({ week: m.week, score: m.home_score })
        else if (m.away_team?.manager_id === t.manager_id) myScores.push({ week: m.week, score: m.away_score })
      })
      if (myScores.length === 0) return
      let allPlayTotal = 0
      weeks.forEach(week => {
        const weekGames = seasonMatchups.filter(m => m.week === week)
        const allScores = []
        weekGames.forEach(m => {
          allScores.push({ managerId: m.home_team?.manager_id, score: m.home_score })
          allScores.push({ managerId: m.away_team?.manager_id, score: m.away_score })
        })
        const myWeekScore = myScores.find(s => s.week === week)?.score
        if (myWeekScore === undefined || allScores.length < 2) return
        const wins = allScores.filter(o => o.managerId !== t.manager_id && myWeekScore > o.score).length
        allPlayTotal += wins / (allScores.length - 1)
      })
      const luck = parseFloat((t.wins - allPlayTotal).toFixed(2))
      if (!byYear[yr]) byYear[yr] = { year: yr }
      byYear[yr][slug] = luck
    })
    return allYears.map(yr => byYear[yr] || { year: yr })
  }, [teams, matchups, allYears])

  if (!mounted || teams.length === 0) return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: effectiveMobile ? '90px 16px' : '120px 24px' }}>
        <p style={{ color: muted }}>Loading charts...</p>
      </div>
    </div>
  )

  const chartBg = d ? '#0a0a0a' : '#ede9e2'
  const gridColor = d ? 'rgba(255,255,255,0.06)' : 'rgba(13,33,82,0.08)'
  const tooltipStyle = {
    background: d ? '#111' : '#fff',
    border: `1px solid ${border}`,
    borderRadius: 0,
    fontSize: '12px',
    color: text,
  }

  const ChartCard = ({ title, subtitle, children, filters }) => (
    <div style={{ marginBottom: '60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: muted, marginBottom: '4px' }}>{title}</p>
          {subtitle && <p style={{ fontSize: '12px', color: muted }}>{subtitle}</p>}
        </div>
        {filters && <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{filters}</div>}
      </div>
      <div style={{ background: chartBg, padding: effectiveMobile ? '16px 8px' : '24px', border: `1px solid ${border}` }}>
        {children}
      </div>
    </div>
  )

  const selectStyle = {
    background: cardBg, border: `1px solid ${border}`, color: text,
    padding: '5px 10px', fontSize: '11px', fontFamily: "'Inter', sans-serif",
    outline: 'none', cursor: 'pointer',
  }

  const ManagerToggle = () => (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
      <button
        onClick={() => setSelectedManagers(allManagers.map(([s]) => s))}
        style={{ ...selectStyle, padding: '4px 10px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >All</button>
      <button
        onClick={() => setSelectedManagers([])}
        style={{ ...selectStyle, padding: '4px 10px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >None</button>
      {allManagers.map(([slug, name]) => {
        const active = selectedManagers.includes(slug)
        return (
          <button
            key={slug}
            onClick={() => setSelectedManagers(prev =>
              prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
            )}
            style={{
              padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              background: active ? managerColor(slug) : 'none',
              border: `1px solid ${active ? managerColor(slug) : border}`,
              color: active ? '#fff' : muted,
            }}
          >
            {name}
          </button>
        )
      })}
    </div>
  )

  const chartHeight = effectiveMobile ? 260 : 340

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>

        <div style={{ marginBottom: '48px' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px, 6vw, 72px)', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '8px' }}>
            Graphs
          </h1>
          <p style={{ color: muted, fontSize: '13px' }}>League trends across {allYears.length} seasons</p>
        </div>

        {/* Chart 1: League avg PPG */}
        <ChartCard title="League Average PPG" subtitle="Mean score per game across all teams each season">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={leagueAvgPPG} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="year" tick={{ fill: muted, fontSize: 11 }} axisLine={{ stroke: border }} tickLine={false} />
              <YAxis tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="avg" stroke={gold} strokeWidth={2} dot={{ fill: gold, r: 4 }} activeDot={{ r: 6 }} name="Avg PPG" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Score variance */}
        <ChartCard
          title="Score Variance (Boom or Bust)"
          subtitle="Average weekly score standard deviation per season — higher = more unpredictable"
          filters={
            <>
              <select value={varianceManager} onChange={e => setVarianceManager(e.target.value)} style={selectStyle}>
                <option value="all">All Managers</option>
                {allManagers.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
              </select>
              <select value={varianceYearFrom} onChange={e => setVarianceYearFrom(e.target.value)} style={selectStyle}>
                <option value="all">From Year</option>
                {allYears.map(yr => <option key={yr} value={yr}>{yr}</option>)}
              </select>
              <select value={varianceYearTo} onChange={e => setVarianceYearTo(e.target.value)} style={selectStyle}>
                <option value="all">To Year</option>
                {allYears.map(yr => <option key={yr} value={yr}>{yr}</option>)}
              </select>
            </>
          }
        >
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={varianceData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="year" tick={{ fill: muted, fontSize: 11 }} axisLine={{ stroke: border }} tickLine={false} />
              <YAxis tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="variance" fill={d ? '#4285F4' : '#1e3a8a'} name="Std Dev" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Position PPG */}
        <ChartCard title="Average PPG by Position" subtitle="How scoring has shifted across positions over the years">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={positionPPG} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="year" tick={{ fill: muted, fontSize: 11 }} axisLine={{ stroke: border }} tickLine={false} />
              <YAxis tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', color: muted }} />
              {POSITIONS.map(pos => (
                <Line key={pos} type="monotone" dataKey={pos} stroke={POS_COLORS[pos]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Charts 4/5/6: Manager trends -- shared toggle */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: muted, marginBottom: '12px' }}>Manager Filter</p>
          <ManagerToggle />
        </div>

        {/* Chart 4: Manager PPG */}
        <ChartCard title="PPG by Manager Over Time" subtitle="Average weekly score per season per manager">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={managerPPG} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="year" tick={{ fill: muted, fontSize: 11 }} axisLine={{ stroke: border }} tickLine={false} />
              <YAxis tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', color: muted }} />
              {allManagers.filter(([slug]) => selectedManagers.includes(slug)).map(([slug, name]) => (
                <Line key={slug} type="monotone" dataKey={slug} stroke={managerColor(slug)} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name={name} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Power Score */}
        <ChartCard title="Power Score by Manager Over Time" subtitle="Season strength metric — normalized within each year (top = 100)">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={managerPowerScore} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="year" tick={{ fill: muted, fontSize: 11 }} axisLine={{ stroke: border }} tickLine={false} />
              <YAxis tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', color: muted }} />
              {allManagers.filter(([slug]) => selectedManagers.includes(slug)).map(([slug, name]) => (
                <Line key={slug} type="monotone" dataKey={slug} stroke={managerColor(slug)} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name={name} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 6: Luck */}
        <ChartCard title="Luck by Manager Over Time" subtitle="Wins above or below expectation based on all-play win rate">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={managerLuck} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="year" tick={{ fill: muted, fontSize: 11 }} axisLine={{ stroke: border }} tickLine={false} />
              <YAxis tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(val) => [val > 0 ? `+${val}` : val, 'Luck']} />
              <Legend wrapperStyle={{ fontSize: '11px', color: muted }} />
              {allManagers.filter(([slug]) => selectedManagers.includes(slug)).map(([slug, name]) => (
                <Line key={slug} type="monotone" dataKey={slug} stroke={managerColor(slug)} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name={name} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>
    </div>
  )
}
