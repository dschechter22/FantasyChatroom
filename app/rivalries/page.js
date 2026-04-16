'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Interpersonal rivalry weights -- named rivals get a 0.4 boost to normalized score
const INTERPERSONAL = {
  'caden':        ['braden', 'mamby-tenner', 'big-e'],
  'wally':        ['reid', 'john', 'dan', 'mamby-tenner'],
  'mamby-tenner': ['john', 'wally', 'reid', 'dan'],
  'braden':       ['caden', 'reid', 'wally', 'dan'],
  'john':         ['reid', 'mamby-tenner', 'wally'],
  'jm':           ['braden', 'freed', 'dan'],
  'freed':        ['dan', 'braden', 'wally'],
  'reid':         ['wally', 'john', 'mamby-tenner', 'dan'],
  'big-e':        ['wally', 'mamby-tenner', 'caden', 'freed'],
  'dan':          ['caden', 'freed', 'braden', 'wally', 'mamby-tenner', 'reid'],
  'dav':          [],
  'bern-tenner':  [],
}

// One-line narratives for top rivalry only (top interpersonal + stats combined)
const NARRATIVES = {
  'dan-freed':          "Years of arguments, zero rings between them for most of the league's history -- Freed finally has company at the top of the grievance list.",
  'dan-caden':          "Dan runs the league website. Caden lets his dad run his team. The tension writes itself.",
  'dan-mamby-tenner':   "A Knicks beef that spilled into fantasy -- Dan claims authenticity, Mamby claims Jalen Brunson.",
  'dan-braden':         "Roommates and rivals. The chirping never stops and neither does the competition.",
  'dan-wally':          "Two of the league's most consistent managers, perpetually in each other's way come playoff time.",
  'dan-reid':           "Both analytical, both competitive, both convinced the other gets too much credit.",
  'braden-caden':       "The most openly hostile rivalry in the league. No further explanation needed.",
  'braden-wally':       "Wally makes it look easy. Braden makes it look hard. They've been settling it on the field for years.",
  'freed-wally':        "Wally has rings. Freed does not. This fact comes up whenever they play.",
  'freed-braden':       "Two managers who have spent most of the league's history near the bottom, competing for the wrong kind of relevance.",
  'wally-reid':         "High energy meets quiet confidence. Reid wants it more visibly; Wally just keeps winning.",
  'wally-mamby-tenner': "Wally's consistency against Mamby's boom-or-bust swings -- a matchup that's gone every direction over the years.",
  'wally-john':         "John used to be a threat. Wally has been a constant. The gap has grown.",
  'reid-john':          "Two guys who came up together and went very different directions in the standings.",
  'reid-mamby-tenner':  "Both competitive, both vocal, both convinced they should be ranked higher.",
  'john-mamby-tenner':  "Mamby never lets John forget the state championship miss. John plays from Greece and still shows up to this rivalry.",
  'jm-braden':          "A battle for the basement that neither manager wants to be having.",
  'jm-dan':             "Dan talks about football strategy. JM knows every stat ever recorded. Neither can explain JM's record.",
  'big-e-caden':        "Caden is inexplicably obsessed with Big E's mom Lauren. Big E has accepted this.",
  'big-e-wally':        "Big E drifted from the group but never from this rivalry. Wally keeps the score.",
  'big-e-freed':        "Two managers on the outside of the championship conversation, perpetually trying to break in.",
  'caden-mamby-tenner': "The only people Tenner still texts are Caden and his fantasy lineup reminder.",
}

const getNarrative = (slugA, slugB) => {
  const key1 = `${slugA}-${slugB}`
  const key2 = `${slugB}-${slugA}`
  return NARRATIVES[key1] || NARRATIVES[key2] || null
}

const isInterpersonalRival = (slugA, slugB) => {
  return (INTERPERSONAL[slugA] || []).includes(slugB) || (INTERPERSONAL[slugB] || []).includes(slugA)
}

export default function RivalriesPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, green, red, gold, blue } = useLayout()

  const [managers, setManagers] = useState([])
  const [matchups, setMatchups] = useState([])
  const [view, setView] = useState('league') // 'league' | 'manager'
  const [selectedManager, setSelectedManager] = useState(null)

  useEffect(() => {
    supabase.from('managers').select('*').then(({ data }) => setManagers(data || []))
    supabase.from('matchups')
      .select('*, home_team:home_team_id(id, manager_id), away_team:away_team_id(id, manager_id), season:season_id(year)')
      .then(({ data }) => setMatchups(data || []))
  }, [])

  const activeManagers = managers.filter(m => m.active)

  // Compute rivalry stats between two managers
  const getRivalryStats = (managerA, managerB) => {
    const allGames = matchups.filter(m => {
      const hId = m.home_team?.manager_id
      const aId = m.away_team?.manager_id
      return (hId === managerA.id && aId === managerB.id) || (hId === managerB.id && aId === managerA.id)
    })

    if (allGames.length === 0) return null

    let winsA = 0, winsB = 0, totalMargin = 0, playoffMeetings = 0
    const recentYears = [...new Set(allGames.map(m => m.season?.year))].sort((a, b) => b - a).slice(0, 3)
    let recentWinsA = 0, recentWinsB = 0

    allGames.forEach(m => {
      const homeIsA = m.home_team?.manager_id === managerA.id
      const scoreA = homeIsA ? m.home_score : m.away_score
      const scoreB = homeIsA ? m.away_score : m.home_score
      const margin = Math.abs(scoreA - scoreB)
      totalMargin += margin
      if (scoreA > scoreB) winsA++
      else if (scoreB > scoreA) winsB++
      if (m.is_playoff) playoffMeetings++
      if (recentYears.includes(m.season?.year)) {
        if (scoreA > scoreB) recentWinsA++
        else if (scoreB > scoreA) recentWinsB++
      }
    })

    const games = allGames.length
    const avgMargin = parseFloat((totalMargin / games).toFixed(2))
    const closeness = 1 - Math.abs(winsA - winsB) / games // 1 = perfectly even, 0 = one-sided
    const recentMomentum = recentWinsA > recentWinsB ? managerA : recentWinsA < recentWinsB ? managerB : null

    // Biggest game -- largest single margin
    let biggestGame = null
    allGames.forEach(m => {
      const homeIsA = m.home_team?.manager_id === managerA.id
      const scoreA = homeIsA ? m.home_score : m.away_score
      const scoreB = homeIsA ? m.away_score : m.home_score
      const margin = Math.abs(scoreA - scoreB)
      if (!biggestGame || margin > biggestGame.margin) {
        biggestGame = { margin: parseFloat(margin.toFixed(2)), winner: scoreA > scoreB ? managerA : managerB, winnerScore: Math.max(scoreA, scoreB), loserScore: Math.min(scoreA, scoreB), year: m.season?.year, week: m.week, isPlayoff: m.is_playoff }
      }
    })

    // Most recent game
    const mostRecent = [...allGames].sort((a, b) => {
      if (b.season?.year !== a.season?.year) return b.season?.year - a.season?.year
      return b.week - a.week
    })[0]
    let mostRecentWinner = null
    if (mostRecent) {
      const homeIsA = mostRecent.home_team?.manager_id === managerA.id
      const scoreA = homeIsA ? mostRecent.home_score : mostRecent.away_score
      const scoreB = homeIsA ? mostRecent.away_score : mostRecent.home_score
      mostRecentWinner = scoreA > scoreB ? managerA : managerB
    }

    return {
      games, winsA, winsB, avgMargin, closeness, playoffMeetings,
      recentMomentum, biggestGame, mostRecent, mostRecentWinner,
    }
  }

  // Compute rivalry score between two managers
  const getRivalryScore = (managerA, managerB, stats) => {
    if (!stats) return 0

    // Stats component (60%)
    const closenessScore = stats.closeness // 0-1
    const volumeScore = Math.min(stats.games / 20, 1) // normalize to max ~20 games
    const marginScore = Math.max(0, 1 - (stats.avgMargin / 50)) // tighter = higher
    const playoffScore = Math.min(stats.playoffMeetings / 3, 1) // normalize to 3 meetings

    const statsScore = (closenessScore * 0.35 + volumeScore * 0.25 + marginScore * 0.25 + playoffScore * 0.15)

    // Interpersonal component (40%)
    const interpersonal = isInterpersonalRival(managerA.slug, managerB.slug) ? 1 : 0

    return parseFloat(((statsScore * 0.6) + (interpersonal * 0.4)).toFixed(4))
  }

  // Build all rivalry pairs
  const allRivalries = useMemo(() => {
    if (activeManagers.length === 0 || matchups.length === 0) return []
    const pairs = []
    for (let i = 0; i < activeManagers.length; i++) {
      for (let j = i + 1; j < activeManagers.length; j++) {
        const mA = activeManagers[i]
        const mB = activeManagers[j]
        const stats = getRivalryStats(mA, mB)
        if (!stats || stats.games < 3) continue
        const score = getRivalryScore(mA, mB, stats)
        pairs.push({ managerA: mA, managerB: mB, stats, score })
      }
    }
    return pairs.sort((a, b) => b.score - a.score)
  }, [activeManagers, matchups])

  // Top 3 rivals per manager
  const getTop3Rivals = (manager) => {
    return allRivalries
      .filter(r => r.managerA.id === manager.id || r.managerB.id === manager.id)
      .slice(0, 3)
      .map(r => ({
        ...r,
        opponent: r.managerA.id === manager.id ? r.managerB : r.managerA,
        winsForManager: r.managerA.id === manager.id ? r.stats.winsA : r.stats.winsB,
        winsForOpponent: r.managerA.id === manager.id ? r.stats.winsB : r.stats.winsA,
      }))
  }

  const RivalryCard = ({ rivalry, showNarrative = false, compact = false }) => {
    const { managerA, managerB, stats, score } = rivalry
    const narrative = showNarrative ? getNarrative(managerA.slug, managerB.slug) : null
    const isInterpersonal = isInterpersonalRival(managerA.slug, managerB.slug)
    const leadingManager = stats.winsA > stats.winsB ? managerA : stats.winsB > stats.winsA ? managerB : null

    return (
      <div style={{ background: cardBg, border: `1px solid ${border}`, padding: compact ? '16px' : effectiveMobile ? '16px' : '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: compact ? '16px' : effectiveMobile ? '18px' : '22px', color: text, fontWeight: '400', marginBottom: '4px' }}>
              {managerA.name} vs {managerB.name}
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {isInterpersonal && (
                <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: red, border: `1px solid ${red}`, padding: '2px 6px' }}>Named Rival</span>
              )}
              <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted }}>Rivalry Score: {(score * 100).toFixed(0)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: compact ? '18px' : '24px', color: text }}>
              {stats.winsA}–{stats.winsB}
            </div>
            <div style={{ fontSize: '10px', color: muted }}>
              {leadingManager ? `${leadingManager.name} leads` : 'Even'}
            </div>
          </div>
        </div>

        {/* Narrative */}
        {narrative && (
          <p style={{ fontSize: '13px', color: muted, lineHeight: 1.6, marginBottom: '14px', fontStyle: 'italic' }}>
            "{narrative}"
          </p>
        )}

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)', gap: '12px', marginBottom: narrative || stats.playoffMeetings > 0 ? '14px' : '0' }}>
          {[
            ['Games', stats.games],
            ['Avg Margin', `${stats.avgMargin} pts`],
            ['Playoffs', stats.playoffMeetings],
            ...(!compact ? [['Momentum', stats.recentMomentum ? `${stats.recentMomentum.name.split(' ')[0]} (L3Y)` : 'Even']] : []),
          ].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '3px' }}>{label}</div>
              <div style={{ fontSize: '13px', color: text, fontWeight: '500' }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Notable game */}
        {!compact && stats.biggestGame && (
          <div style={{ borderTop: `1px solid ${border}`, paddingTop: '12px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '3px' }}>Biggest Game</div>
              <div style={{ fontSize: '12px', color: text }}>
                {stats.biggestGame.winner.name} won {stats.biggestGame.winnerScore}–{stats.biggestGame.loserScore} in {stats.biggestGame.year} Wk{stats.biggestGame.week}
                {stats.biggestGame.isPlayoff && <span style={{ color: gold, marginLeft: '4px', fontSize: '10px' }}>Playoff</span>}
              </div>
            </div>
            {stats.mostRecent && (
              <div>
                <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '3px' }}>Most Recent</div>
                <div style={{ fontSize: '12px', color: text }}>
                  {stats.mostRecentWinner?.name} won in {stats.mostRecent.season?.year} Wk{stats.mostRecent.week}
                  {stats.mostRecent.is_playoff && <span style={{ color: gold, marginLeft: '4px', fontSize: '10px' }}>Playoff</span>}
                </div>
              </div>
            )}
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
          Rivalries
        </h1>
        <p style={{ color: muted, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '32px' }}>
          Ranked by rivalry score · 60% stats · 40% interpersonal
        </p>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {filterBtn(view === 'league', 'League-Wide', () => { setView('league'); setSelectedManager(null) })}
          {filterBtn(view === 'manager', 'By Manager', () => setView('manager'))}
        </div>

        {/* League view -- top rivalries */}
        {view === 'league' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {allRivalries.slice(0, 20).map((r, i) => (
              <RivalryCard
                key={`${r.managerA.id}-${r.managerB.id}`}
                rivalry={r}
                showNarrative={i === 0 || isInterpersonalRival(r.managerA.slug, r.managerB.slug)}
              />
            ))}
            {allRivalries.length === 0 && (
              <p style={{ color: muted, fontSize: '14px' }}>Loading rivalries...</p>
            )}
          </div>
        )}

        {/* Manager view -- pick a manager, see their top 3 */}
        {view === 'manager' && (
          <>
            {/* Manager selector */}
            <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1px', background: border, marginBottom: '40px' }}>
              {activeManagers.map(m => (
                <div
                  key={m.id}
                  onClick={() => setSelectedManager(selectedManager?.id === m.id ? null : m)}
                  style={{
                    background: selectedManager?.id === m.id ? (d ? '#1a1a2e' : '#dde4f0') : cardBg,
                    padding: '16px', cursor: 'pointer',
                    outline: selectedManager?.id === m.id ? `2px solid ${d ? '#4455aa' : '#0d2152'}` : 'none',
                  }}
                >
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: text }}>{m.name}</div>
                </div>
              ))}
            </div>

            {selectedManager && (
              <>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '24px' : '32px', fontWeight: '400', marginBottom: '24px', color: text }}>
                  {selectedManager.name}'s Top Rivals
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  {getTop3Rivals(selectedManager).map((r, i) => {
                    const rivalry = {
                      managerA: selectedManager,
                      managerB: r.opponent,
                      stats: {
                        ...r.stats,
                        winsA: r.winsForManager,
                        winsB: r.winsForOpponent,
                      },
                      score: r.score,
                    }
                    return (
                      <div key={r.opponent.id} style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '16px', left: '-24px', fontFamily: "'Playfair Display', serif", fontSize: '14px', color: muted, display: effectiveMobile ? 'none' : 'block' }}>#{i + 1}</div>
                        <RivalryCard rivalry={rivalry} showNarrative={i === 0} />
                      </div>
                    )
                  })}
                  {getTop3Rivals(selectedManager).length === 0 && (
                    <p style={{ color: muted, fontSize: '14px' }}>No rivalry data found.</p>
                  )}
                </div>
              </>
            )}

            {!selectedManager && (
              <p style={{ color: muted, fontSize: '13px' }}>Select a manager above to see their top 3 rivals.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
