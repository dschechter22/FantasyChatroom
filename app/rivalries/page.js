'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const INTERPERSONAL = {
  'caden':        ['braden', 'mamby-tenner', 'big-e'],
  'wally':        ['reid', 'john', 'dan', 'mamby-tenner'],
  'mamby-tenner': ['john', 'wally', 'reid', 'dan'],
  'braden':       ['caden', 'reid', 'wally', 'dan'],
  'john':         ['reid', 'mamby-tenner', 'wally', 'freed'],
  'jm':           ['braden', 'freed', 'dan'],
  'freed':        ['dan', 'braden', 'wally', 'john', 'jm'],
  'reid':         ['wally', 'john', 'mamby-tenner', 'dan'],
  'big-e':        ['wally', 'mamby-tenner', 'caden', 'freed'],
  'dan':          ['caden', 'freed', 'braden', 'wally', 'mamby-tenner', 'reid'],
  'dav':          [],
  'bern-tenner':  [],
}

// Fact-checked narratives -- fantasy claims backed by stats
const NARRATIVES = {
  'dan-freed':            "Dan spent nine seasons obsessing over fantasy football before finally winning in 2025. Freed won in 2021. The gap between how much each cares and how long it took them both is the entire story of this rivalry.",
  'dan-caden':            "Dan runs the league website. Caden has two championships, at least one of which the league credits to Greg. Dan has one. The scoreboard is closer than it should be.",
  'dan-mamby-tenner':     "Mamby missed the game-winning three to send them to state. Dan was in the gym. Neither has let the other forget either thing.",
  'dan-braden':           "They live together. Dan has a ring, Braden doesn't. The daily reminder is built into the living arrangement.",
  'dan-wally':            "Two of the league's most consistent managers. Wally has two rings and makes it look easy. Dan has one and makes it look like a decade of work.",
  'dan-reid':             "Both competitive, both analytical, both with one ring. The rivalry is mostly about who deserves more credit for it.",
  'braden-caden':         "The most openly hostile matchup in the league. Braden has zero rings, Caden has two -- but the league agrees at least one belongs to Greg.",
  'braden-wally':         "Braden has zero rings and one of the worst historical records in the league. Wally has two rings and makes terrible rosters look like contenders. The gap in results has never made sense given the gap in effort.",
  'braden-jm':            "The league's two historically worst records, meeting regularly to determine who has the worst season. Both ringless, both somehow still optimistic every August.",
  'freed-wally':          "Freed has one ring. Wally has two. Freed would prefer not to discuss this.",
  'freed-dan':            "Dan spent nine seasons chasing his first ring. Freed won his in 2021 and has been waiting for Dan to catch up ever since. Dan finally did in 2025.",
  'freed-braden':         "Freed has a ring. Braden doesn't. In a rivalry defined mostly by proximity and shared suffering, that is currently the only meaningful difference.",
  'wally-reid':           "Reid has one ring and brings the energy of someone who has five. Wally has two rings and acts like it's nothing. The difference in presentation has always been part of the rivalry.",
  'wally-mamby-tenner':   "Wally consistently finishes above where his roster suggests he should. Mamby's team is boom-or-bust and has one ring to show for it. The head-to-head has gone both ways.",
  'wally-john':           "John used to be a genuine threat. Wally has been consistent for a decade. The gap in recent results tells most of the story.",
  'wally-dan':            "Both two-time champions in terms of combined rings but Wally got there first and made it look easier. Dan took nine seasons.",
  'reid-john':            "John moved to Greece and his teams have declined steadily since. Reid has one ring and is still very much in the conversation. The gap has been growing.",
  'reid-mamby-tenner':    "Both have one ring each. Both think they should have more. The h2h record between them has been the tiebreaker neither will accept.",
  'reid-dan':             "Both got their first ring recently -- Reid in 2023, Dan in 2025. The debate over who the better manager is has no clean answer yet.",
  'john-mamby-tenner':    "John has no rings and manages from Greece. Mamby has one ring and manages from wherever Tenner isn't. Both have reasons to be frustrated with their situation.",
  'jm-dan':               "JM knows more about football than almost anyone in the league and has the worst career record to show for it. Dan spent nine seasons building spreadsheets and just won his first ring. The gap between knowledge and results is the whole rivalry.",
  'jm-braden':            "Two managers who have spent most of the league's history near the bottom of the standings, meeting regularly to determine who has the worse season. Neither has a ring. Both somehow stay optimistic.",
  'big-e-caden':          "Big E has three rings -- the most in the league. Caden has two, though the league debates how many he actually earned. Caden is also inexplicably invested in Big E's personal life in ways that have never been explained.",
  'big-e-wally':          "Big E has three rings. Wally has two. Between them they account for five of the league's eleven championships. When these two play it means something.",
  'big-e-freed':          "Big E has three rings. Freed has one. Both have been legitimate contenders for most of the league's history and the h2h between them reflects that.",
  'big-e-mamby-tenner':   "Big E has three championships. Mamby-Tenner has one. The history between them is long and the ring count makes Big E the clear winner of this rivalry so far.",
  'caden-mamby-tenner':   "Two rings for Caden, one for Mamby-Tenner. Tenner and Caden are reportedly still on speaking terms, which is more than can be said for most of Caden's relationships in the league.",
  'freed-jm':             "Freed has a ring. JM does not. But what happened in DC suggests the scoreboard doesn't tell the whole story of who the dominant one is in this matchup.",
  'freed-john':           "John has made claims about the nature of Freed's relationship with his dog that are still being discussed in the group chat. The Springfield trip didn't help Freed's reputation either. The fantasy record is almost secondary at this point.",
}

const getNarrative = (slugA, slugB) => {
  const key1 = `${slugA}-${slugB}`
  const key2 = `${slugB}-${slugA}`
  return NARRATIVES[key1] || NARRATIVES[key2] || null
}

const isInterpersonalRival = (slugA, slugB) =>
  (INTERPERSONAL[slugA] || []).includes(slugB) || (INTERPERSONAL[slugB] || []).includes(slugA)

export default function RivalriesPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, green, red, gold, blue } = useLayout()

  const [managers, setManagers] = useState([])
  const [matchups, setMatchups] = useState([])
  const [view, setView] = useState('league')
  const [selectedManager, setSelectedManager] = useState(null)

  useEffect(() => {
    supabase.from('managers').select('*').then(({ data }) => setManagers(data || []))
    supabase.from('matchups')
      .select('*, home_team:home_team_id(id, manager_id), away_team:away_team_id(id, manager_id), season:season_id(year)')
      .then(({ data }) => setMatchups(data || []))
  }, [])

  const activeManagers = managers.filter(m => m.active)

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
      totalMargin += Math.abs(scoreA - scoreB)
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
    const closeness = 1 - Math.abs(winsA - winsB) / games
    const recentMomentum = recentWinsA > recentWinsB ? managerA : recentWinsA < recentWinsB ? managerB : null

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

    return { games, winsA, winsB, avgMargin, closeness, playoffMeetings, recentMomentum, biggestGame, mostRecent, mostRecentWinner }
  }

  const getRivalryScore = (managerA, managerB, stats) => {
    if (!stats) return 0
    const closenessScore = stats.closeness
    const volumeScore = Math.min(stats.games / 20, 1)
    const marginScore = Math.max(0, 1 - (stats.avgMargin / 50))
    const playoffScore = Math.min(stats.playoffMeetings / 3, 1)
    const statsScore = closenessScore * 0.35 + volumeScore * 0.25 + marginScore * 0.25 + playoffScore * 0.15
    const interpersonal = isInterpersonalRival(managerA.slug, managerB.slug) ? 1 : 0
    return parseFloat(((statsScore * 0.6) + (interpersonal * 0.4)).toFixed(4))
  }

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
      <div style={{ background: cardBg, border: `1px solid ${border}`, padding: compact ? '16px' : effectiveMobile ? '16px' : '24px', marginBottom: '1px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: compact ? '16px' : effectiveMobile ? '18px' : '22px', color: text, fontWeight: '400', marginBottom: '6px' }}>
              {managerA.name} vs {managerB.name}
            </h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Rivalry score -- big and prominent */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: compact ? '28px' : effectiveMobile ? '32px' : '40px', color: text, lineHeight: 1, fontWeight: '400' }}>
                  {(score * 100).toFixed(0)}
                </span>
                <span style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted }}>/ 100</span>
              </div>
              {isInterpersonal && (
                <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: red, border: `1px solid ${red}`, padding: '2px 6px' }}>Named Rival</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '16px' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: compact ? '22px' : effectiveMobile ? '24px' : '28px', color: text, marginBottom: '2px' }}>
              {stats.winsA}–{stats.winsB}
            </div>
            <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: muted }}>
              {leadingManager ? `${leadingManager.name.split(' ')[0]} leads` : 'Even'}
            </div>
          </div>
        </div>

        {narrative && (
          <p style={{ fontSize: '13px', color: muted, lineHeight: 1.6, marginBottom: '14px', fontStyle: 'italic' }}>
            "{narrative}"
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(3, 1fr)' : `repeat(${effectiveMobile ? 3 : 4}, 1fr)`, gap: '12px', marginBottom: '12px' }}>
          {[
            ['Games', stats.games],
            ['Avg Margin', `${stats.avgMargin} pts`],
            ['Playoffs', stats.playoffMeetings],
            ...(!compact && !effectiveMobile ? [['Momentum', stats.recentMomentum ? `${stats.recentMomentum.name.split(' ')[0]} (L3Y)` : 'Even']] : []),
          ].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '3px' }}>{label}</div>
              <div style={{ fontSize: '13px', color: text, fontWeight: '500' }}>{val}</div>
            </div>
          ))}
        </div>

        {!compact && stats.biggestGame && (
          <div style={{ borderTop: `1px solid ${border}`, paddingTop: '12px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '3px' }}>Biggest Game</div>
              <div style={{ fontSize: '12px', color: text }}>
                {stats.biggestGame.winner.name.split(' ')[0]} won {stats.biggestGame.winnerScore}–{stats.biggestGame.loserScore} · {stats.biggestGame.year} Wk{stats.biggestGame.week}
                {stats.biggestGame.isPlayoff && <span style={{ color: gold, marginLeft: '6px', fontSize: '10px' }}>Playoff</span>}
              </div>
            </div>
            {stats.mostRecent && (
              <div>
                <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '3px' }}>Most Recent</div>
                <div style={{ fontSize: '12px', color: text }}>
                  {stats.mostRecentWinner?.name.split(' ')[0]} won · {stats.mostRecent.season?.year} Wk{stats.mostRecent.week}
                  {stats.mostRecent.is_playoff && <span style={{ color: gold, marginLeft: '6px', fontSize: '10px' }}>Playoff</span>}
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
          Rivalry score · 60% stats · 40% interpersonal
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {filterBtn(view === 'league', 'League-Wide', () => { setView('league'); setSelectedManager(null) })}
          {filterBtn(view === 'manager', 'By Manager', () => setView('manager'))}
        </div>

        {view === 'league' && (
          <div>
            {allRivalries.slice(0, 20).map((r, i) => (
              <RivalryCard
                key={`${r.managerA.id}-${r.managerB.id}`}
                rivalry={r}
                showNarrative={true}
              />
            ))}
            {allRivalries.length === 0 && (
              <p style={{ color: muted, fontSize: '14px' }}>Loading rivalries...</p>
            )}
          </div>
        )}

        {view === 'manager' && (
          <>
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

            {selectedManager ? (
              <>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '24px' : '32px', fontWeight: '400', marginBottom: '24px', color: text }}>
                  {selectedManager.name}'s Top 3 Rivals
                </h2>
                {getTop3Rivals(selectedManager).map((r, i) => {
                  const rivalry = {
                    managerA: selectedManager,
                    managerB: r.opponent,
                    stats: { ...r.stats, winsA: r.winsForManager, winsB: r.winsForOpponent },
                    score: r.score,
                  }
                  return (
                    <div key={r.opponent.id} style={{ position: 'relative', marginBottom: '2px' }}>
                      {!effectiveMobile && (
                        <div style={{ position: 'absolute', top: '24px', left: '-32px', fontFamily: "'Playfair Display', serif", fontSize: '18px', color: i === 0 ? gold : muted }}>
                          #{i + 1}
                        </div>
                      )}
                      {effectiveMobile && (
                        <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: i === 0 ? gold : muted, marginBottom: '6px' }}>
                          Rival #{i + 1}
                        </div>
                      )}
                      <RivalryCard rivalry={rivalry} showNarrative={true} />
                    </div>
                  )
                })}
                {getTop3Rivals(selectedManager).length === 0 && (
                  <p style={{ color: muted, fontSize: '14px' }}>No rivalry data found.</p>
                )}
              </>
            ) : (
              <p style={{ color: muted, fontSize: '13px' }}>Select a manager to see their top 3 rivals.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
