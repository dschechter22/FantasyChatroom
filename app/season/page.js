'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function SeasonPage() {
  const [theme, setTheme] = useState('dark')
  const [seasons, setSeasons] = useState([])
  const [selectedYear, setSelectedYear] = useState(2025)
  const [matchups, setMatchups] = useState([])
  const [teams, setTeams] = useState([])
  const [managers, setManagers] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [seasonData, setSeasonData] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('fc-theme') || 'dark'
    setTheme(saved)
    document.body.setAttribute('data-theme', saved)
    supabase.from('seasons').select('*, champion:champion_id(name), mol_bowl_loser:mol_bowl_loser_id(name)').order('year', { ascending: false }).then(({ data }) => setSeasons(data || []))
    supabase.from('managers').select('*').then(({ data }) => setManagers(data || []))
  }, [])

  useEffect(() => {
    setSelectedTeam(null)
    setMatchups([])
    setTeams([])
    setSeasonData(null)

    supabase.from('seasons').select('*, champion:champion_id(name, id), mol_bowl_loser:mol_bowl_loser_id(name, id)').eq('year', selectedYear).single().then(({ data }) => setSeasonData(data))

    supabase.from('matchups').select('*, home_team:home_team_id(id, manager_id, team_name), away_team:away_team_id(id, manager_id, team_name), season:season_id(year)').then(({ data }) => {
      setMatchups((data || []).filter(m => m.season?.year === selectedYear))
    })

    supabase.from('teams').select('*, manager:manager_id(name, slug, id), season:season_id(year)').then(({ data }) => {
      setTeams((data || []).filter(t => t.season?.year === selectedYear).sort((a, b) => a.final_standing - b.final_standing))
    })
  }, [selectedYear])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('fc-theme', next)
    document.body.setAttribute('data-theme', next)
  }

  const d = theme === 'dark'
  const bg = d ? '#000' : '#f4f1ec'
  const text = d ? '#fff' : '#0d2152'
  const muted = d ? 'rgba(255,255,255,0.38)' : 'rgba(13,33,82,0.75)'
  const border = d ? 'rgba(255,255,255,0.1)' : 'rgba(13,33,82,0.14)'
  const cardBg = d ? '#0a0a0a' : '#ede9e2'
  const rowAlt = d ? '#080808' : '#e8e4dc'
  const highlight = d ? '#0d0d1a' : '#e8edf5'

  const getManagerName = (managerId) => managers.find(m => m.id === managerId)?.name || '—'

  const regMatchups = matchups.filter(m => !m.is_playoff)
  const playoffMatchups = matchups.filter(m => m.is_playoff)
  const weeks = [...new Set(regMatchups.map(m => m.week))].sort((a, b) => a - b)
  const playoffWeeks = [...new Set(playoffMatchups.map(m => m.week))].sort((a, b) => a - b)

  const filteredReg = selectedTeam ? regMatchups.filter(m => m.home_team?.id === selectedTeam || m.away_team?.id === selectedTeam) : regMatchups
  const filteredPlayoff = selectedTeam ? playoffMatchups.filter(m => m.home_team?.id === selectedTeam || m.away_team?.id === selectedTeam) : playoffMatchups

  // ---- STATS CALCULATIONS ----
  const calcStats = () => {
    if (regMatchups.length === 0 || teams.length === 0) return null

    // Weekly scores per team
    const teamWeeklyScores = {}
    teams.forEach(t => { teamWeeklyScores[t.id] = [] })
    regMatchups.forEach(m => {
      if (teamWeeklyScores[m.home_team?.id] !== undefined) teamWeeklyScores[m.home_team.id].push({ score: m.home_score, week: m.week, oppScore: m.away_score, oppId: m.away_team?.id })
      if (teamWeeklyScores[m.away_team?.id] !== undefined) teamWeeklyScores[m.away_team.id].push({ score: m.away_score, week: m.week, oppScore: m.home_score, oppId: m.home_team?.id })
    })

    // 1. Highest single week score
    let highGame = null
    regMatchups.forEach(m => {
      if (!highGame || m.home_score > highGame.score) highGame = { score: m.home_score, managerId: m.home_team?.manager_id, teamName: m.home_team?.team_name, week: m.week, oppScore: m.away_score, oppManager: getManagerName(m.away_team?.manager_id) }
      if (!highGame || m.away_score > highGame.score) highGame = { score: m.away_score, managerId: m.away_team?.manager_id, teamName: m.away_team?.team_name, week: m.week, oppScore: m.home_score, oppManager: getManagerName(m.home_team?.manager_id) }
    })

    // 2. Lowest single week score
    let lowGame = null
    regMatchups.forEach(m => {
      if (!lowGame || m.home_score < lowGame.score) lowGame = { score: m.home_score, managerId: m.home_team?.manager_id, teamName: m.home_team?.team_name, week: m.week, oppScore: m.away_score, oppManager: getManagerName(m.away_team?.manager_id) }
      if (!lowGame || m.away_score < lowGame.score) lowGame = { score: m.away_score, managerId: m.away_team?.manager_id, teamName: m.away_team?.team_name, week: m.week, oppScore: m.home_score, oppManager: getManagerName(m.home_team?.manager_id) }
    })

    // 3. Biggest blowout
    let bigBlowout = null
    regMatchups.forEach(m => {
      const diff = Math.abs(m.home_score - m.away_score)
      if (!bigBlowout || diff > bigBlowout.diff) {
        const winnerScore = m.home_score > m.away_score ? m.home_score : m.away_score
        const loserScore = m.home_score > m.away_score ? m.away_score : m.home_score
        const winnerId = m.home_score > m.away_score ? m.home_team?.manager_id : m.away_team?.manager_id
        const loserId = m.home_score > m.away_score ? m.away_team?.manager_id : m.home_team?.manager_id
        bigBlowout = { diff: parseFloat(diff.toFixed(2)), winnerScore, loserScore, winnerId, loserId, week: m.week }
      }
    })

    // 4. Closest game
    let closestGame = null
    regMatchups.forEach(m => {
      const diff = Math.abs(m.home_score - m.away_score)
      if (!closestGame || diff < closestGame.diff) {
        const winnerScore = m.home_score > m.away_score ? m.home_score : m.away_score
        const loserScore = m.home_score > m.away_score ? m.away_score : m.home_score
        const winnerId = m.home_score > m.away_score ? m.home_team?.manager_id : m.away_team?.manager_id
        const loserId = m.home_score > m.away_score ? m.away_team?.manager_id : m.home_team?.manager_id
        closestGame = { diff: parseFloat(diff.toFixed(2)), winnerScore, loserScore, winnerId, loserId, week: m.week }
      }
    })

    // 5 & 6. Most consistent / Boom or Bust (std deviation)
    const stdDevs = teams.map(t => {
      const scores = teamWeeklyScores[t.id]?.map(g => g.score) || []
      if (scores.length === 0) return { t, std: 0 }
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length
      const std = Math.sqrt(scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length)
      return { t, std: parseFloat(std.toFixed(2)), mean: parseFloat(mean.toFixed(2)) }
    }).filter(x => x.std > 0)
    const mostConsistent = stdDevs.sort((a, b) => a.std - b.std)[0]
    const boomOrBust = stdDevs.sort((a, b) => b.std - a.std)[0]

    // 7 & 8. Lucky / Unlucky (expected wins)
    const expectedWins = {}
    teams.forEach(t => { expectedWins[t.id] = 0 })
    weeks.forEach(week => {
      const weekGames = regMatchups.filter(m => m.week === week)
      const allScores = []
      weekGames.forEach(m => {
        allScores.push({ teamId: m.home_team?.id, score: m.home_score })
        allScores.push({ teamId: m.away_team?.id, score: m.away_score })
      })
      allScores.forEach(({ teamId, score }) => {
        const winsVsAll = allScores.filter(other => other.teamId !== teamId && score > other.score).length
        expectedWins[teamId] = (expectedWins[teamId] || 0) + winsVsAll / (allScores.length - 1)
      })
    })

    let unluckiest = null, luckiest = null
    teams.forEach(t => {
      const exp = expectedWins[t.id] || 0
      const diff = t.wins - exp
      if (!unluckiest || diff < unluckiest.diff) unluckiest = { t, diff: parseFloat(diff.toFixed(1)), expected: parseFloat(exp.toFixed(1)), actual: t.wins }
      if (!luckiest || diff > luckiest.diff) luckiest = { t, diff: parseFloat(diff.toFixed(1)), expected: parseFloat(exp.toFixed(1)), actual: t.wins }
    })

    // 9. Best second half
    const halfPoint = Math.floor(weeks.length / 2)
    const firstHalfWeeks = weeks.slice(0, halfPoint)
    const secondHalfWeeks = weeks.slice(halfPoint)
    let bestSecondHalf = null
    teams.forEach(t => {
      const scores = teamWeeklyScores[t.id] || []
      const firstHalfWins = regMatchups.filter(m => firstHalfWeeks.includes(m.week)).filter(m => {
        if (m.home_team?.id === t.id) return m.home_score > m.away_score
        if (m.away_team?.id === t.id) return m.away_score > m.home_score
        return false
      }).length
      const secondHalfWins = regMatchups.filter(m => secondHalfWeeks.includes(m.week)).filter(m => {
        if (m.home_team?.id === t.id) return m.home_score > m.away_score
        if (m.away_team?.id === t.id) return m.away_score > m.home_score
        return false
      }).length
      const improvement = secondHalfWins - firstHalfWins
      if (!bestSecondHalf || improvement > bestSecondHalf.improvement) {
        bestSecondHalf = { t, improvement, firstHalfWins, secondHalfWins }
      }
    })

    // 10 & 11. Composite score: (win_pct * 0.6) + (normalized_ppg * 0.4)
    const ppgs = teams.map(t => (t.wins + t.losses) > 0 ? t.points_for / (t.wins + t.losses) : 0)
    const maxPpg = Math.max(...ppgs)
    const minPpg = Math.min(...ppgs)
    const composites = teams.map(t => {
      const winPct = (t.wins + t.losses) > 0 ? t.wins / (t.wins + t.losses) : 0
      const ppg = (t.wins + t.losses) > 0 ? t.points_for / (t.wins + t.losses) : 0
      const normPpg = maxPpg === minPpg ? 0.5 : (ppg - minPpg) / (maxPpg - minPpg)
      const composite = parseFloat((winPct * 0.6 + normPpg * 0.4).toFixed(4))
      return { t, composite, winPct: parseFloat((winPct * 100).toFixed(1)), ppg: parseFloat(ppg.toFixed(2)) }
    })
    const mostDominant = [...composites].sort((a, b) => b.composite - a.composite)[0]
    const worstSeason = [...composites].sort((a, b) => a.composite - b.composite)[0]

    // 12. Most games decided by under 10 points
    const closeGamesCount = {}
    teams.forEach(t => { closeGamesCount[t.id] = 0 })
    regMatchups.forEach(m => {
      const diff = Math.abs(m.home_score - m.away_score)
      if (diff < 10) {
        if (closeGamesCount[m.home_team?.id] !== undefined) closeGamesCount[m.home_team.id]++
        if (closeGamesCount[m.away_team?.id] !== undefined) closeGamesCount[m.away_team.id]++
      }
    })
    let mostCloseGames = null
    teams.forEach(t => {
      const count = closeGamesCount[t.id] || 0
      if (!mostCloseGames || count > mostCloseGames.count) mostCloseGames = { t, count }
    })

    // 13. The Choker -- best composite that lost R1 or R2
    let choker = null
    if (playoffMatchups.length > 0) {
      const r1Week = playoffWeeks[0]
      const r2Week = playoffWeeks[1]
      const earlyLosers = []
      playoffMatchups.filter(m => m.week === r1Week || m.week === r2Week).forEach(m => {
        const loserManagerId = m.home_score > m.away_score ? m.away_team?.manager_id : m.home_team?.manager_id
        const winnerManagerId = m.home_score > m.away_score ? m.home_team?.manager_id : m.away_team?.manager_id
        const loserTeam = teams.find(t => t.manager?.id === loserManagerId)
        const winnerTeam = teams.find(t => t.manager?.id === winnerManagerId)
        const loserComp = composites.find(c => c.t.id === loserTeam?.id)
        const winnerComp = composites.find(c => c.t.id === winnerTeam?.id)
        if (loserComp && winnerComp && loserComp.composite > winnerComp.composite) {
          earlyLosers.push({ loserTeam, loserComp, winnerTeam, winnerComp, gap: parseFloat((loserComp.composite - winnerComp.composite).toFixed(4)), week: m.week })
        }
      })
      if (earlyLosers.length > 0) {
        choker = earlyLosers.sort((a, b) => b.gap - a.gap)[0]
      }
    }

    return { highGame, lowGame, bigBlowout, closestGame, mostConsistent, boomOrBust, unluckiest, luckiest, bestSecondHalf, mostDominant, worstSeason, mostCloseGames, choker }
  }

  const stats = calcStats()

  const playoffRoundLabel = (weekIdx) => {
    const labels = ['Round 1', 'Semifinals', 'Championship']
    return labels[weekIdx] || `Round ${weekIdx + 1}`
  }

  const isSixTeam = seasonData?.playoff_teams === 6

  const StatCard = ({ label, value, sub, color }) => (
    <div style={{ background: cardBg, padding: '20px 24px', borderTop: `2px solid ${color || border}` }}>
      <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: text, marginBottom: '4px' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: muted }}>{sub}</div>}
    </div>
  )

  const hStyle = (align = 'left') => ({
    padding: '10px 14px', fontSize: '10px', letterSpacing: '0.18em',
    textTransform: 'uppercase', color: muted, textAlign: align,
    borderBottom: `1px solid ${border}`, fontWeight: '500', whiteSpace: 'nowrap',
  })

  const cStyle = (align = 'left') => ({
    padding: '14px', fontSize: '13px', textAlign: align,
    borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap',
  })

  const MatchupRow = ({ m, i }) => {
    const homeManager = getManagerName(m.home_team?.manager_id)
    const awayManager = getManagerName(m.away_team?.manager_id)
    const homeWon = m.home_score > m.away_score
    const awayWon = m.away_score > m.home_score
    const isHighlighted = selectedTeam && (m.home_team?.id === selectedTeam || m.away_team?.id === selectedTeam)
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center', padding: '14px',
        borderBottom: `1px solid ${border}`,
        background: isHighlighted ? highlight : i % 2 === 0 ? 'transparent' : rowAlt,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: awayWon ? muted : text, fontWeight: awayWon ? '400' : '400' }}>{awayManager}</span>
          <span style={{ fontSize: '11px', color: muted }}>{m.away_team?.team_name}</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '0 20px' }}>
          <span style={{ fontSize: '16px', fontWeight: '600', color: awayWon ? text : muted, minWidth: '60px', textAlign: 'right' }}>{m.away_score}</span>
          <span style={{ fontSize: '11px', color: muted }}>–</span>
          <span style={{ fontSize: '16px', fontWeight: '600', color: homeWon ? text : muted, minWidth: '60px', textAlign: 'left' }}>{m.home_score}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'right' }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: homeWon ? text : muted }}>{homeManager}</span>
          <span style={{ fontSize: '11px', color: muted }}>{m.home_team?.team_name}</span>
        </div>
      </div>
    )
  }

  const BracketRound = ({ label, games, isBye, byeTeams }) => (
    <div style={{ flex: 1, minWidth: '220px' }}>
      <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted, marginBottom: '16px', textAlign: 'center' }}>{label}</p>
      {isBye && byeTeams && byeTeams.map((t, i) => (
        <div key={i} style={{ border: `1px solid ${border}`, padding: '12px 16px', marginBottom: '8px', background: cardBg }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '4px' }}>Bye</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: text }}>{t.manager?.name}</div>
          <div style={{ fontSize: '11px', color: muted }}>{t.team_name}</div>
        </div>
      ))}
      {games.map((m, i) => {
        const homeManager = getManagerName(m.home_team?.manager_id)
        const awayManager = getManagerName(m.away_team?.manager_id)
        const homeWon = m.home_score > m.away_score
        const awayWon = m.away_score > m.home_score
        return (
          <div key={m.id} style={{ border: `1px solid ${border}`, marginBottom: '12px', background: cardBg }}>
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: awayWon ? text : muted }}>{awayManager}</div>
                <div style={{ fontSize: '10px', color: muted }}>{m.away_team?.team_name}</div>
              </div>
              <span style={{ fontSize: '16px', fontWeight: '600', color: awayWon ? text : muted }}>{m.away_score}</span>
            </div>
            <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: homeWon ? text : muted }}>{homeManager}</div>
                <div style={{ fontSize: '10px', color: muted }}>{m.home_team?.team_name}</div>
              </div>
              <span style={{ fontSize: '16px', fontWeight: '600', color: homeWon ? text : muted }}>{m.home_score}</span>
            </div>
          </div>
        )
      })}
    </div>
  )

  // Separate winner bracket from consolation
  const getWinnerBracketGames = (week) => {
    const allWeekGames = playoffMatchups.filter(m => m.week === week)
    // In our data, consolation games are tracked separately
    // We'll show all playoff games grouped by week since is_mol_bowl distinguishes consolation
    return allWeekGames.filter(m => !m.is_mol_bowl)
  }

  const getMolBowlGames = (week) => playoffMatchups.filter(m => m.week === week && m.is_mol_bowl)

  // Bye teams for 6-team format (top 2 seeds skip R1)
  const getByeTeams = () => {
    if (!isSixTeam) return []
    const r1Week = playoffWeeks[0]
    const r1Games = playoffMatchups.filter(m => m.week === r1Week)
    const teamsInR1 = new Set()
    r1Games.forEach(m => {
      if (m.home_team?.manager_id) teamsInR1.add(m.home_team.manager_id)
      if (m.away_team?.manager_id) teamsInR1.add(m.away_team.manager_id)
    })
    return teams.filter(t => t.made_playoffs && !teamsInR1.has(t.manager?.id)).slice(0, 2)
  }

  const byeTeams = getByeTeams()

  const accentGreen = d ? '#6ee7b7' : '#0d6e3f'
  const accentRed = d ? '#f87171' : '#9b1c1c'
  const accentGold = d ? '#fcd34d' : '#92400e'
  const accentBlue = d ? '#93c5fd' : '#1e3a8a'

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif", transition: 'background 0.2s, color 0.2s' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', background: d ? 'rgba(0,0,0,0.88)' : 'rgba(244,241,236,0.95)', borderBottom: `1px solid ${border}`, backdropFilter: 'blur(10px)' }}>
        <a href="/" style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: '400', color: text, textDecoration: 'none' }}>Fantasy Chatroom</a>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {[['Champions','/champions'],['Standings','/standings'],['H2H','/h2h'],['Season','/season'],['Rivalries','/rivalries'],['Managers','/managers'],['Writeups','/writeups'],['Power Rankings','/power-rankings'],['LJ Index','/lj-index'],['All-Time Teams','/all-time-teams']].map(([label, href]) => (
            <a key={href} href={href} style={{ color: muted, textDecoration: 'none', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: '500' }}>{label}</a>
          ))}
          <button onClick={toggleTheme} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '6px 14px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500' }}>
            {d ? 'Light' : 'Dark'}
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '120px 24px 80px' }}>

        {/* Header + Year Selector */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', marginBottom: '48px', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: '400', letterSpacing: '-0.02em' }}>Season</h1>
          <div style={{ paddingBottom: '8px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} style={{ background: cardBg, color: text, border: `1px solid ${border}`, padding: '10px 16px', fontSize: '14px', fontFamily: "'Playfair Display', serif", cursor: 'pointer', outline: 'none' }}>
              {seasons.map(s => (
                <option key={s.year} value={s.year}>{s.year} — Year {s.season_number}</option>
              ))}
            </select>
          </div>
        </div>

        {/* PLAYOFF BRACKET */}
        {playoffMatchups.length > 0 && (
          <div style={{ marginBottom: '60px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: muted, marginBottom: '24px' }}>Playoff Bracket</p>
            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
              {playoffWeeks.map((week, idx) => (
                <BracketRound
                  key={week}
                  label={playoffRoundLabel(idx)}
                  games={getWinnerBracketGames(week)}
                  isBye={isSixTeam && idx === 0}
                  byeTeams={isSixTeam && idx === 0 ? byeTeams : null}
                />
              ))}
            </div>

            {/* Mol Bowl */}
            {playoffMatchups.some(m => m.is_mol_bowl) && (
              <div style={{ marginTop: '32px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: accentRed, marginBottom: '16px' }}>Mol Bowl</p>
                <div style={{ maxWidth: '400px' }}>
                  {playoffMatchups.filter(m => m.is_mol_bowl).map((m, i) => (
                    <MatchupRow key={m.id} m={m} i={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STANDINGS */}
        {teams.length > 0 && (
          <div style={{ marginBottom: '48px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: muted, marginBottom: '16px' }}>Final Standings</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
                <thead>
                  <tr style={{ background: cardBg }}>
                    <th style={hStyle('center')}>Rk</th>
                    <th style={hStyle()}>Manager</th>
                    <th style={hStyle()}>Team</th>
                    <th style={hStyle('center')}>W</th>
                    <th style={hStyle('center')}>L</th>
                    <th style={hStyle('right')}>PF</th>
                    <th style={hStyle('right')}>PA</th>
                    <th style={hStyle('right')}>Diff</th>
                    <th style={hStyle('center')}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t, i) => {
                    const diff = parseFloat((t.points_for - t.points_against).toFixed(2))
                    const isSelected = selectedTeam === t.id
                    return (
                      <tr key={t.id} onClick={() => setSelectedTeam(isSelected ? null : t.id)} style={{ background: isSelected ? highlight : i % 2 === 0 ? 'transparent' : rowAlt, cursor: 'pointer', outline: isSelected ? `1px solid ${d ? '#4455aa' : '#0d2152'}` : 'none' }}>
                        <td style={{ ...cStyle('center'), color: muted }}>{t.final_standing}</td>
                        <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif", fontSize: '15px' }}>{t.manager?.name}</td>
                        <td style={{ ...cStyle(), color: muted, fontSize: '12px' }}>{t.team_name}</td>
                        <td style={cStyle('center')}>{t.wins}</td>
                        <td style={cStyle('center')}>{t.losses}</td>
                        <td style={cStyle('right')}>{t.points_for.toFixed(2)}</td>
                        <td style={cStyle('right')}>{t.points_against.toFixed(2)}</td>
                        <td style={{ ...cStyle('right'), color: diff >= 0 ? accentGreen : accentRed, fontWeight: '500' }}>
                          {diff >= 0 ? '+' : ''}{diff}
                        </td>
                        <td style={{ ...cStyle('center'), fontSize: '12px', color: t.playoff_result === 'Champion' ? accentGold : t.playoff_result?.includes('Mol Bowl') ? accentRed : muted }}>
                          {t.playoff_result || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {selectedTeam && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: muted }}>
                  Showing schedule for <span style={{ color: text, fontFamily: "'Playfair Display', serif" }}>{teams.find(t => t.id === selectedTeam)?.manager?.name}</span>
                </span>
                <button onClick={() => setSelectedTeam(null)} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '4px 12px', cursor: 'pointer', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>Clear</button>
              </div>
            )}
          </div>
        )}

        {/* SEASON STATS */}
        {stats && (
          <div style={{ marginBottom: '60px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: muted, marginBottom: '24px' }}>Season Highlights</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1px', background: border }}>

              <StatCard
                label="Highest Score"
                value={`${getManagerName(stats.highGame?.managerId)} — ${stats.highGame?.score}`}
                sub={`Week ${stats.highGame?.week} · Lost to ${stats.highGame?.oppManager} (${stats.highGame?.oppScore}) · ${stats.highGame?.oppScore > stats.highGame?.score ? '(Still lost)' : '(Won)'}`}
                color={accentGreen}
              />

              <StatCard
                label="Lowest Score"
                value={`${getManagerName(stats.lowGame?.managerId)} — ${stats.lowGame?.score}`}
                sub={`Week ${stats.lowGame?.week} · vs ${stats.lowGame?.oppManager} (${stats.lowGame?.oppScore})`}
                color={accentRed}
              />

              <StatCard
                label="Biggest Blowout"
                value={`${getManagerName(stats.bigBlowout?.winnerId)} def. ${getManagerName(stats.bigBlowout?.loserId)}`}
                sub={`${stats.bigBlowout?.winnerScore} – ${stats.bigBlowout?.loserScore} · Margin: ${stats.bigBlowout?.diff} · Week ${stats.bigBlowout?.week}`}
                color={accentGold}
              />

              <StatCard
                label="Closest Game"
                value={`${getManagerName(stats.closestGame?.winnerId)} def. ${getManagerName(stats.closestGame?.loserId)}`}
                sub={`${stats.closestGame?.winnerScore} – ${stats.closestGame?.loserScore} · Margin: ${stats.closestGame?.diff} · Week ${stats.closestGame?.week}`}
                color={accentBlue}
              />

              <StatCard
                label="Most Consistent"
                value={stats.mostConsistent?.t?.manager?.name || '—'}
                sub={`Std dev: ${stats.mostConsistent?.std} · Avg: ${stats.mostConsistent?.mean} PPG`}
                color={accentGreen}
              />

              <StatCard
                label="Boom or Bust"
                value={stats.boomOrBust?.t?.manager?.name || '—'}
                sub={`Std dev: ${stats.boomOrBust?.std} · Avg: ${stats.boomOrBust?.mean} PPG`}
                color={accentRed}
              />

              <StatCard
                label="Unluckiest Team"
                value={stats.unluckiest?.t?.manager?.name || '—'}
                sub={`Actual: ${stats.unluckiest?.actual}W · Expected: ${stats.unluckiest?.expected}W · ${stats.unluckiest?.diff > 0 ? '+' : ''}${stats.unluckiest?.diff} wins`}
                color={accentRed}
              />

              <StatCard
                label="Luckiest Team"
                value={stats.luckiest?.t?.manager?.name || '—'}
                sub={`Actual: ${stats.luckiest?.actual}W · Expected: ${stats.luckiest?.expected}W · +${stats.luckiest?.diff} wins`}
                color={accentGreen}
              />

              <StatCard
                label="Best Second Half"
                value={stats.bestSecondHalf?.t?.manager?.name || '—'}
                sub={`First half: ${stats.bestSecondHalf?.firstHalfWins}W · Second half: ${stats.bestSecondHalf?.secondHalfWins}W · +${stats.bestSecondHalf?.improvement}`}
                color={accentBlue}
              />

              <StatCard
                label="Most Dominant Season"
                value={stats.mostDominant?.t?.manager?.name || '—'}
                sub={`Composite: ${stats.mostDominant?.composite} · ${stats.mostDominant?.winPct}% win rate · ${stats.mostDominant?.ppg} PPG`}
                color={accentGold}
              />

              <StatCard
                label="Worst Season"
                value={stats.worstSeason?.t?.manager?.name || '—'}
                sub={`Composite: ${stats.worstSeason?.composite} · ${stats.worstSeason?.winPct}% win rate · ${stats.worstSeason?.ppg} PPG`}
                color={accentRed}
              />

              <StatCard
                label="Most Close Games"
                value={`${stats.mostCloseGames?.t?.manager?.name || '—'} — ${stats.mostCloseGames?.count}`}
                sub={`Games decided by under 10 points`}
                color={accentBlue}
              />

              {stats.choker && (
                <StatCard
                  label="The Choker"
                  value={stats.choker.loserTeam?.manager?.name || '—'}
                  sub={`Composite ${stats.choker.loserComp?.composite} upset by ${stats.choker.winnerTeam?.manager?.name} (${stats.choker.winnerComp?.composite}) · Gap: ${stats.choker.gap}`}
                  color={accentRed}
                />
              )}

            </div>
          </div>
        )}

        {/* REGULAR SEASON SCHEDULE */}
        {weeks.length > 0 && (
          <div style={{ marginBottom: '60px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: muted, marginBottom: '24px' }}>Regular Season Schedule</p>
            {weeks.map(week => {
              const weekGames = filteredReg.filter(m => m.week === week)
              if (weekGames.length === 0) return null
              return (
                <div key={week} style={{ marginBottom: '32px' }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: muted, marginBottom: '10px', paddingLeft: '14px' }}>Week {week}</p>
                  <div style={{ borderTop: `1px solid ${border}` }}>
                    {weekGames.map((m, i) => <MatchupRow key={m.id} m={m} i={i} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {matchups.length === 0 && teams.length === 0 && (
          <p style={{ color: muted, fontSize: '14px' }}>No data available for this season yet.</p>
        )}
      </div>
    </div>
  )
}
