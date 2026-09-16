'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'
import { LEAGUE_ID } from '../../lib/supabase'
import { priceTwoWay, actualWeekLineup, projectedWeekLineup } from '../../lib/predictions'
import { buildFixtures, REG_SEASON_WEEKS } from '../../lib/schedule'
import { generateWeekBoard, generateFutures, generateProps, getOrCreateFuture, priceCustomMarket, temperProb } from '../../lib/sportsbookGen'
export const dynamic = 'force-dynamic'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const ADMIN_PIN = '2910'
const SEASON = '2026-27'
// Pure action alone (no re-run of the model) can move a market's odds at
// most this far off its stored fair probability -- keeps a single big bet
// from swinging a line to something absurd.
const MAX_ACTION_SHIFT = 0.12
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K']
const PICKEM_PRIZE = 10

const toDecimal = o => o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o)
const toAmerican = d => d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1))
const calcWin = (amt, odds) => odds > 0 ? Math.floor(amt * odds / 100) : Math.floor(amt * 100 / Math.abs(odds))
const fmtOdds = o => o > 0 ? `+${o}` : `${o}`

const FUTURE_LABELS = {
  playoffs: 'Make the Playoffs', bye: 'Get a Bye', semis: 'Make the Semifinals',
  finals: 'Make the Finals', title: 'Win the Title',
}

export default function SportsbookPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, green, red, gold } = useLayout()

  const [tab, setTab] = useState('lines')
  const [week, setWeek] = useState(1)
  const [games, setGames] = useState([])
  const [futures, setFutures] = useState([])
  const [teamSim, setTeamSim] = useState([])
  const [props, setProps] = useState([])
  const [accounts, setAccounts] = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [balanceAdjustAccountId, setBalanceAdjustAccountId] = useState('')
  const [balanceAdjustAmount, setBalanceAdjustAmount] = useState('')
  const [deleteAccountId, setDeleteAccountId] = useState('')
  const [confirmResetProps, setConfirmResetProps] = useState(false)
  const [allPendingBets, setAllPendingBets] = useState([])
  const [allBets, setAllBets] = useState([])
  const [allParlays, setAllParlays] = useState([])
  const [myBets, setMyBets] = useState([])
  const [myParlays, setMyParlays] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const [playerName, setPlayerName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [nameStep, setNameStep] = useState('name') // 'name' | 'pin'
  const [pendingName, setPendingName] = useState('')
  const [isNewAccount, setIsNewAccount] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [showForgotPin, setShowForgotPin] = useState(false)
  const [resetPinInput, setResetPinInput] = useState('')
  const [resetPinError, setResetPinError] = useState('')
  const [resetPinSubmitted, setResetPinSubmitted] = useState(false)
  const [pendingPinResets, setPendingPinResets] = useState([])

  // ── bet slip (a floating, closable popup -- see near the bottom of the
  // render for its markup -- shared across every tab so a game leg, a
  // futures leg and a player-prop leg can all land in the same parlay) ──
  const [slip, setSlip] = useState([])
  const [slipAmounts, setSlipAmounts] = useState({})
  const [isParlay, setIsParlay] = useState(false)
  const [parlayAmt, setParlayAmt] = useState('')
  const [slipOpen, setSlipOpen] = useState(false)
  const [keepSlipAfterBet, setKeepSlipAfterBet] = useState(false)

  const [pickemPicks, setPickemPicks] = useState({})
  const [hoveredBetKey, setHoveredBetKey] = useState(null)
  const [propMatchupFilter, setPropMatchupFilter] = useState('all')
  const [propPositionFilter, setPropPositionFilter] = useState('all')
  const [wtTeam, setWtTeam] = useState('')
  const [wtLine, setWtLine] = useState('')
  const [seedTeam, setSeedTeam] = useState('')
  const [seedLine, setSeedLine] = useState('')
  const [aheadTeamA, setAheadTeamA] = useState('')
  const [aheadTeamB, setAheadTeamB] = useState('')

  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [adminPinInput, setAdminPinInput] = useState('')
  const [adminPinError, setAdminPinError] = useState('')

  const [showGameForm, setShowGameForm] = useState(false)
  const [gameForm, setGameForm] = useState({ team_a: '', team_b: '', spread: '', over_under: '', ml_a: '-110', ml_b: '-110' })
  const [gameFormError, setGameFormError] = useState('')

  const [settleTarget, setSettleTarget] = useState(null)
  const [settleScores, setSettleScores] = useState({ a: '', b: '' })

  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState({ msg: '', ok: true })
  const [mounted, setMounted] = useState(false)

  // ── model data, for the admin "generate" buttons on Lines/Futures/Props --
  // this is the same rating/projection engine Predictions and Preweek use,
  // fetched independently here so the sportsbook can build its own board
  // without a trip through /predictions first ──
  const [latestSeasonYear, setLatestSeasonYear] = useState(null)
  const [leagueTeams, setLeagueTeams] = useState([])
  const [leagueMatchups, setLeagueMatchups] = useState([])
  const [rosterEntries, setRosterEntries] = useState([])
  const [nflGames, setNflGames] = useState([])

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    db.from('sb_games').select('week').eq('season', SEASON).order('week', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.length) setWeek(data[0].week) })
  }, [])
  useEffect(() => { if (mounted) { fetchGames(); fetchFutures(); fetchTeamSim(); fetchProps(); fetchAccounts() } }, [mounted, week])
  // Real NFL schedule for the Props tab's "who do they play this week"
  // column -- a separate public ESPN endpoint, not the fantasy API, so it's
  // fetched independently and only matters while on Props.
  useEffect(() => {
    if (!mounted || tab !== 'props') return
    fetch(`/api/nfl-schedule?week=${week}`).then(r => r.json()).then(d => setNflGames(d.games || [])).catch(() => setNflGames([]))
  }, [mounted, tab, week])
  useEffect(() => { if (mounted) { fetchActivityLog(); fetchAllPendingBets(); fetchPendingPinResets() } }, [mounted])
  // If adding/removing a leg turns an in-progress parlay into a same-team
  // futures ladder, drop back to Singles rather than leaving Parlay mode
  // selected with no legal way to submit it.
  useEffect(() => { if (isParlay && slipHasSameTeamFutures(slip)) setIsParlay(false) }, [slip])
  useEffect(() => { if (mounted && tab === 'allbets') fetchAllBets() }, [mounted, tab])

  useEffect(() => {
    db.from('seasons').select('year').eq('league_id', LEAGUE_ID).order('year', { ascending: false }).limit(1)
      .then(({ data }) => setLatestSeasonYear(data?.[0]?.year || null))
  }, [])

  useEffect(() => {
    if (!latestSeasonYear) return
    Promise.all([
      db.from('teams').select('*, manager:manager_id(name), season:season_id(year)').eq('league_id', LEAGUE_ID),
      db.from('matchups')
        .select('*, home_team:home_team_id(id, team_name), away_team:away_team_id(id, team_name), season:season_id(year)')
        .eq('league_id', LEAGUE_ID).eq('is_playoff', false),
    ]).then(async ([tRes, mRes]) => {
      const t = (tRes.data || []).filter(x => x.season?.year === latestSeasonYear)
      setLeagueTeams(t)
      setLeagueMatchups((mRes.data || []).filter(x => x.season?.year === latestSeasonYear))
      if (t.length) {
        const { data, error } = await db.from('roster_entries')
          .select('id, team_id, player_id, stats, player:player_id(id, name, position, nfl_team)')
          .in('team_id', t.map(x => x.id))
        // A single unrecognized column (e.g. nfl_team before its migration
        // has run) fails this whole query, not just that field -- surface it
        // instead of silently leaving rosterEntries empty, which quietly
        // breaks every prop stat downstream (avg/last-week/L3/position rank),
        // not just the one new column.
        if (error) console.error('roster_entries fetch failed:', error.message)
        setRosterEntries(data || [])
      }
    })
  }, [latestSeasonYear])

  const showFlash = (msg, ok = true) => {
    setFlash({ msg, ok })
    setTimeout(() => setFlash({ msg: '', ok: true }), 3500)
  }

  const fetchGames = async () => {
    setLoading(true)
    const { data } = await db.from('sb_games').select('*').eq('season', SEASON).eq('week', week).order('created_at')
    setGames(data || [])
    setLoading(false)
  }

  const fetchFutures = async () => {
    const { data } = await db.from('sb_futures').select('*').eq('season', SEASON).order('created_at')
    setFutures(data || [])
  }

  const fetchTeamSim = async () => {
    const { data } = await db.from('sb_team_sim').select('*').eq('season', SEASON)
    setTeamSim(data || [])
  }

  const fetchProps = async () => {
    const { data } = await db.from('sb_props').select('*').eq('season', SEASON).eq('week', week).order('created_at')
    setProps(data || [])
  }

  const fetchAccounts = async () => {
    const { data } = await db.from('gb_accounts').select('*').eq('season', SEASON).order('balance', { ascending: false })
    setAccounts(data || [])
  }

  // Best-effort audit trail -- never blocks the action it's logging if the
  // insert itself fails (e.g. before the migration's run).
  const logActivity = async (eventType, actor, description) => {
    try { await db.from('sb_activity_log').insert({ season: SEASON, event_type: eventType, actor, description }) }
    catch { /* logging is a courtesy, not a dependency */ }
  }

  const fetchActivityLog = async () => {
    const { data } = await db.from('sb_activity_log').select('*').eq('season', SEASON).order('created_at', { ascending: false }).limit(200)
    setActivityLog(data || [])
  }

  // Every pending bet across every account, for the admin override list --
  // "My Bets" only ever shows the logged-in admin's own bets.
  const fetchAllPendingBets = async () => {
    const { data } = await db.from('sb_bets')
      .select(`*,
        account:account_id(manager_name),
        game:game_id(team_a, team_b, week),
        future:future_id(market_type, team_name, opp_team_name, line),
        prop:prop_id(player_name, line, week)`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setAllPendingBets(data || [])
  }

  // Every bet and parlay across every account, any status -- the public
  // "All Bets" tab. Unlike fetchAllPendingBets (admin override queue, pending
  // only) this is a read-only activity feed anyone can see.
  const fetchAllBets = async () => {
    const { data: bets } = await db.from('sb_bets')
      .select(`*,
        account:account_id(manager_name),
        game:game_id(team_a, team_b, week),
        future:future_id(market_type, team_name, opp_team_name, line),
        prop:prop_id(player_name, line, week)`)
      .order('created_at', { ascending: false })
      .limit(300)
    const { data: parlays } = await db.from('sb_parlays')
      .select('*, account:account_id(manager_name)')
      .order('created_at', { ascending: false })
      .limit(150)
    setAllBets(bets || [])
    setAllParlays(parlays || [])
  }

  const fetchPendingPinResets = async () => {
    const { data } = await db.from('sb_pin_resets')
      .select('*, account:account_id(manager_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setPendingPinResets(data || [])
  }

  const fetchMyBets = async (accountId) => {
    const { data: bets } = await db.from('sb_bets')
      .select(`*,
        game:game_id(team_a, team_b, week, spread, over_under, score_a, score_b, is_settled),
        future:future_id(market_type, team_name, opp_team_name, line, is_settled, result),
        prop:prop_id(player_name, position, line, week, is_settled, result, actual_points)`)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
    const { data: parlays } = await db.from('sb_parlays')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
    const betList = bets || []
    setMyBets(betList)
    setMyParlays((parlays || []).map(p => ({ ...p, legs: betList.filter(b => b.parlay_id === p.id) })))
  }

  const sameName = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
  const myAccount = accounts.find(a => sameName(a.manager_name, playerName))

  const handleNameNext = () => {
    const name = nameInput.trim()
    if (!name) return
    const existing = accounts.find(a => sameName(a.manager_name, name))
    setPendingName(name)
    setIsNewAccount(!existing)
    setPinInput(''); setPinError('')
    setNameStep('pin')
  }

  const handlePinSubmit = async () => {
    if (!pinInput || pinInput.length < 4) return setPinError('PIN must be 4+ digits')
    if (isNewAccount) {
      const { data, error } = await db.from('gb_accounts').insert({ manager_name: pendingName, season: SEASON, balance: 200, pin: pinInput }).select().single()
      if (error) {
        // 23505 is Postgres's real unique-violation code (this table is
        // unique on manager_name+season) -- anything else is a different
        // failure (RLS, a missing column, etc.) and showing the same "taken"
        // message for it just hides what's actually wrong.
        if (error.code === '23505') return setPinError('Name already taken — try logging in')
        console.error('gb_accounts insert failed:', error)
        return setPinError(`Couldn't create account: ${error.message}`)
      }
      setPlayerName(pendingName)
      setNameStep('name'); setNameInput(''); setPinInput('')
      await fetchAccounts()
      fetchMyBets(data.id)
      logActivity('account_created', pendingName, `${pendingName} created an account`)
    } else {
      // Case-insensitive lookup -- "Dan", "dan" and "DAN" are the same
      // account. ilike also needs literal %/_ escaped since those are
      // wildcards to it, unlike a plain eq.
      const escaped = pendingName.replace(/[%_]/g, c => `\\${c}`)
      const { data } = await db.from('gb_accounts').select('*').ilike('manager_name', escaped).eq('season', SEASON).maybeSingle()
      if (!data || data.pin !== pinInput) return setPinError('Incorrect PIN')
      // Use the account's actual stored casing, not whatever was typed this
      // time, so every later `manager_name === playerName` match keeps working.
      setPlayerName(data.manager_name)
      setNameStep('name'); setNameInput(''); setPinInput('')
      fetchMyBets(data.id)
    }
  }

  // Forgot-PIN: sits pending until an admin approves it from the Activity
  // tab -- the account's real PIN never changes until then, so a wrong
  // guess at "whose account is this" can't lock someone else out.
  const requestPinReset = async () => {
    if (!resetPinInput || resetPinInput.length < 4) return setResetPinError('New PIN must be 4+ digits')
    const escaped = pendingName.replace(/[%_]/g, c => `\\${c}`)
    const { data: acc } = await db.from('gb_accounts').select('id, manager_name').ilike('manager_name', escaped).eq('season', SEASON).maybeSingle()
    if (!acc) return setResetPinError("Couldn't find that account — check the name")
    const { error } = await db.from('sb_pin_resets').insert({ account_id: acc.id, requested_pin: resetPinInput })
    if (error) return setResetPinError(`Couldn't submit request: ${error.message}`)
    logActivity('pin_reset_requested', acc.manager_name, `${acc.manager_name} requested a PIN reset`)
    setResetPinSubmitted(true)
  }

  const resolvePinReset = async (reset, approve) => {
    if (approve) await db.from('gb_accounts').update({ pin: reset.requested_pin }).eq('id', reset.account_id)
    await db.from('sb_pin_resets').update({ status: approve ? 'approved' : 'denied', resolved_at: new Date().toISOString() }).eq('id', reset.id)
    logActivity('pin_reset_resolved', 'Admin', `Admin ${approve ? 'approved' : 'denied'} ${reset.account?.manager_name || 'a'} PIN reset`)
    fetchPendingPinResets(); fetchActivityLog()
  }

  // Fixtures for this season -- used only to build the Props tab's "this
  // week's matchup" filter. The actual rating/simulation model now lives
  // entirely in lib/sportsbookGen.js, shared with the daily sync cron.
  const fixtures = useMemo(
    () => buildFixtures({ matchups: leagueMatchups, teams: leagueTeams, useFixed: true }),
    [leagueMatchups, leagueTeams],
  )
  const weekFixtures = useMemo(() => fixtures.filter(f => f.week === week), [fixtures, week])
  const teamNameById = useMemo(() => Object.fromEntries(leagueTeams.map(t => [t.id, t.manager?.name || t.team_name])), [leagueTeams])
  const weeksPlayed = useMemo(
    () => new Set(leagueMatchups.filter(m => (m.home_score ?? 0) > 0 || (m.away_score ?? 0) > 0).map(m => m.week)).size,
    [leagueMatchups],
  )
  // Half-integer lines only, spaced by 1 -- a push is never possible, so
  // "over/under" (or "better/worse") always actually resolves one way.
  const winTotalLines = useMemo(() => Array.from({ length: REG_SEASON_WEEKS }, (_, i) => i + 0.5), [])
  const seedLines = useMemo(() => Array.from({ length: Math.max(leagueTeams.length - 1, 0) }, (_, i) => i + 1.5), [leagueTeams])

  const genArgs = () => ({ season: SEASON, week, teams: leagueTeams, matchups: leagueMatchups, rosterEntries })

  const entriesByTeamId = useMemo(() => {
    const byTeam = {}
    rosterEntries.forEach(e => { (byTeam[e.team_id] ||= []).push(e) })
    return byTeam
  }, [rosterEntries])

  // Real NFL team abbreviation -> this week's opponent, from the site-wide
  // schedule endpoint (unrelated to the fantasy league's own matchups).
  const nflOppByAbbr = useMemo(() => {
    const m = {}
    nflGames.forEach(g => {
      if (g.home?.abbreviation && g.away?.abbreviation) {
        m[g.home.abbreviation] = { opp: g.away.abbreviation, homeAway: 'vs' }
        m[g.away.abbreviation] = { opp: g.home.abbreviation, homeAway: '@' }
      }
    })
    return m
  }, [nflGames])

  // Per-player season log (through the week before `week`, i.e. completed
  // weeks only) -- season avg, last week's points, last-3-week avg, and
  // position rank by season avg among every rostered player at that
  // position league-wide. Backs the Props tab's stat columns.
  const playerSeasonStats = useMemo(() => {
    const byPlayer = {}
    rosterEntries.forEach(e => {
      const played = Object.entries(e.stats?.actual || {})
        .map(([w, v]) => ({ week: parseInt(w), actual: v }))
        .filter(x => x.week < week && typeof x.actual === 'number')
        .sort((a, b) => a.week - b.week)
      const avgPts = played.length ? played.reduce((s, x) => s + x.actual, 0) / played.length : null
      const last3 = played.slice(-3)
      byPlayer[e.player_id] = {
        avgPts,
        lastWeekPts: played.length ? played[played.length - 1].actual : null,
        l3Avg: last3.length ? last3.reduce((s, x) => s + x.actual, 0) / last3.length : null,
        position: e.player?.position,
        nflTeam: e.player?.nfl_team || null,
      }
    })
    const byPos = {}
    Object.entries(byPlayer).forEach(([pid, s]) => { if (s.avgPts != null) (byPos[s.position] ||= []).push({ pid, avgPts: s.avgPts }) })
    Object.values(byPos).forEach(arr => {
      arr.sort((a, b) => b.avgPts - a.avgPts)
      arr.forEach((x, i) => { byPlayer[x.pid].posRank = i + 1 })
    })
    return byPlayer
  }, [rosterEntries, week])

  // Record/avg PF for the team-snapshot table on the Futures tab -- a plain
  // tally off the real matchup rows, same as every other page's version of
  // this.
  const teamRecord = useMemo(() => {
    const td = {}
    leagueTeams.forEach(t => { td[t.id] = { wins: 0, losses: 0, pf: 0, gp: 0 } })
    leagueMatchups.forEach(m => {
      const played = (m.home_score ?? 0) > 0 || (m.away_score ?? 0) > 0
      if (!played) return
      const h = td[m.home_team?.id], a = td[m.away_team?.id]
      if (h) { h.pf += m.home_score; h.gp++; if (m.home_score > m.away_score) h.wins++; else if (m.home_score < m.away_score) h.losses++ }
      if (a) { a.pf += m.away_score; a.gp++; if (m.away_score > m.home_score) a.wins++; else if (m.away_score < m.home_score) a.losses++ }
    })
    return td
  }, [leagueTeams, leagueMatchups])

  // This week's projected total per team -- summed straight from the props
  // already generated for the week (each is an optimal-lineup starter's own
  // ESPN projection), so no separate model computation is needed here.
  const weekProjByTeam = useMemo(() => {
    const byTeam = {}
    props.forEach(p => { if (p.team_id) byTeam[p.team_id] = (byTeam[p.team_id] || 0) + p.line })
    return byTeam
  }, [props])

  const [projModalTeamId, setProjModalTeamId] = useState(null)

  // ── admin: manual override for the board/futures the daily sync also
  // generates automatically -- useful to regenerate on demand without
  // waiting for the next cron tick (e.g. right after fixing roster data). ──
  const runGenerateWeekBoard = async () => {
    if (!leagueTeams.length) return showFlash('No model data yet -- check back once teams/matchups are on file', false)
    setGenerating(true)
    const { added, errors } = await generateWeekBoard(db, genArgs())
    if (errors?.length) { console.error('generateWeekBoard errors:', errors); showFlash(`Failed: ${errors[0]}`, false) }
    else showFlash(added ? `Added ${added} game(s) to the board` : 'No new games to add -- board already generated, or no matchups this week', !!added)
    fetchGames()
    setGenerating(false)
  }

  const runGenerateFutures = async () => {
    if (!leagueTeams.length) return showFlash('No model data yet', false)
    setGenerating(true)
    const { added, updated, errors } = await generateFutures(db, genArgs())
    if (errors?.length) { console.error('generateFutures errors:', errors); showFlash(`Failed: ${errors[0]}`, false) }
    else showFlash(`Futures updated — ${added} new, ${updated} refreshed`)
    fetchFutures(); fetchTeamSim()
    setGenerating(false)
  }

  // Manual override for the daily cron's own generateProps -- lets a fix to
  // that logic (or a fresh ESPN sync) take effect on an already-generated
  // week immediately, instead of waiting for the next scheduled cron tick.
  // Only ever adds props for players who don't already have one this week
  // (see generateProps itself), so it can't move a line under a live bet.
  const runGenerateProps = async () => {
    if (!leagueTeams.length) return showFlash('No model data yet', false)
    setGenerating(true)
    const { added, errors } = await generateProps(db, genArgs())
    if (errors?.length) { console.error('generateProps errors:', errors); showFlash(`Failed: ${errors[0]}`, false) }
    else showFlash(added ? `Added ${added} prop(s) for Week ${week}` : 'No new props to add -- everyone already has one, or nobody has a real ESPN projection yet')
    fetchProps()
    setGenerating(false)
  }

  // Shared by every settlement path -- a parlay only grades once every leg
  // touching it (game, future, or prop alike) has a final status, since all
  // of them live in sb_bets together.
  const settleTouchedParlays = async (betRows) => {
    const parlayIds = [...new Set((betRows || []).filter(b => b.parlay_id).map(b => b.parlay_id))]
    for (const pid of parlayIds) {
      const { data: legs } = await db.from('sb_bets').select('status').eq('parlay_id', pid)
      if (!legs || legs.some(l => l.status === 'pending')) continue
      const { data: p } = await db.from('sb_parlays').select('*').eq('id', pid).single()
      if (!p) continue
      const won = legs.every(l => l.status === 'won')
      const winAmt = won ? calcWin(p.amount, p.combined_odds) : 0
      await db.from('sb_parlays').update({ status: won ? 'won' : 'lost', win_amount: winAmt }).eq('id', pid)
      if (won) {
        const { data: acc } = await db.from('gb_accounts').select('balance').eq('id', p.account_id).single()
        await db.from('gb_accounts').update({ balance: acc.balance + p.amount + winAmt }).eq('id', p.account_id)
      }
    }
  }

  // ── admin: manual account/bet controls ──
  const adjustBalance = async (acc) => {
    const delta = parseInt(balanceAdjustAmount)
    if (!delta) return showFlash('Enter a non-zero amount', false)
    await db.from('gb_accounts').update({ balance: acc.balance + delta }).eq('id', acc.id)
    logActivity('balance_adjusted', 'Admin', `Admin ${delta > 0 ? 'added' : 'removed'} ${Math.abs(delta)} GB ${delta > 0 ? 'to' : 'from'} ${acc.manager_name}`)
    setBalanceAdjustAmount(''); setBalanceAdjustAccountId('')
    showFlash(`${acc.manager_name}'s balance ${delta > 0 ? '+' : ''}${delta} GB`)
    fetchAccounts(); fetchActivityLog()
  }

  const deleteAccountAction = async (acc) => {
    // sb_bets/sb_parlays both cascade on gb_accounts.id, so their bet
    // history goes with them -- that's the point of the confirm step.
    await db.from('gb_accounts').delete().eq('id', acc.id)
    logActivity('account_deleted', 'Admin', `Admin deleted ${acc.manager_name}'s account (${acc.balance} GB, all bet history)`)
    setDeleteAccountId('')
    showFlash(`${acc.manager_name}'s account deleted`)
    fetchAccounts(); fetchActivityLog()
    if (myAccount?.id === acc.id) { setPlayerName(''); setNameInput(''); setNameStep('name') }
  }

  const overrideBet = async (bet, status) => {
    if (bet.status !== 'pending') return
    const winAmt = status === 'won' ? (bet.bet_type === 'pickem' ? PICKEM_PRIZE : calcWin(bet.amount, bet.odds)) : 0
    await db.from('sb_bets').update({ status, win_amount: winAmt }).eq('id', bet.id)
    if (status === 'won' || status === 'push') {
      const { data: acc } = await db.from('gb_accounts').select('balance').eq('id', bet.account_id).single()
      const back = status === 'won' ? bet.amount + winAmt : bet.amount
      await db.from('gb_accounts').update({ balance: acc.balance + back }).eq('id', bet.account_id)
    }
    await settleTouchedParlays([bet])
    logActivity('bet_overridden', 'Admin', `Admin marked ${bet.account?.manager_name || 'a'} bet as ${status}`)
    fetchAccounts(); fetchAllPendingBets(); fetchActivityLog()
    if (myAccount) fetchMyBets(myAccount.id)
  }

  const settleFuture = async (future, result) => {
    setGenerating(true)
    await db.from('sb_futures').update({ is_settled: true, result }).eq('id', future.id)
    const { data: futureBets } = await db.from('sb_bets').select('*').eq('future_id', future.id).eq('status', 'pending')
    for (const bet of (futureBets || [])) {
      const status = bet.pick === result ? 'won' : 'lost'
      const winAmt = status === 'won' ? calcWin(bet.amount, bet.odds) : 0
      await db.from('sb_bets').update({ status, win_amount: winAmt }).eq('id', bet.id)
      if (status === 'won') {
        const { data: acc } = await db.from('gb_accounts').select('balance').eq('id', bet.account_id).single()
        await db.from('gb_accounts').update({ balance: acc.balance + bet.amount + winAmt }).eq('id', bet.account_id)
      }
    }
    await settleTouchedParlays(futureBets || [])
    showFlash(`Settled: ${future.team_name}${future.opp_team_name ? ` vs ${future.opp_team_name}` : ''} — ${result}`)
    fetchFutures(); fetchAccounts()
    if (myAccount) fetchMyBets(myAccount.id)
    setGenerating(false)
  }

  const autoSettleProps = async () => {
    setGenerating(true)
    const { data: openProps } = await db.from('sb_props').select('*').eq('season', SEASON).eq('week', week).eq('is_settled', false)
    if (!openProps?.length) { showFlash('No open props for this week', false); setGenerating(false); return }

    const { data: entries } = await db.from('roster_entries').select('player_id, stats').in('player_id', openProps.map(p => p.player_id))
    const actualByPlayer = new Map((entries || []).map(e => [e.player_id, e.stats?.actual?.[week]]))

    let settledCount = 0
    for (const prop of openProps) {
      const actual = actualByPlayer.get(prop.player_id)
      if (actual == null) continue
      const result = actual > prop.line ? 'over' : actual < prop.line ? 'under' : 'push'
      await db.from('sb_props').update({ is_settled: true, result, actual_points: actual }).eq('id', prop.id)

      const { data: propBets } = await db.from('sb_bets').select('*').eq('prop_id', prop.id).eq('status', 'pending')
      for (const bet of (propBets || [])) {
        const status = result === 'push' ? 'push' : bet.pick === result ? 'won' : 'lost'
        const winAmt = status === 'won' ? calcWin(bet.amount, bet.odds) : 0
        await db.from('sb_bets').update({ status, win_amount: winAmt }).eq('id', bet.id)
        if (status === 'won') {
          const { data: acc } = await db.from('gb_accounts').select('balance').eq('id', bet.account_id).single()
          await db.from('gb_accounts').update({ balance: acc.balance + bet.amount + winAmt }).eq('id', bet.account_id)
        } else if (status === 'push') {
          const { data: acc } = await db.from('gb_accounts').select('balance').eq('id', bet.account_id).single()
          await db.from('gb_accounts').update({ balance: acc.balance + bet.amount }).eq('id', bet.account_id)
        }
      }
      await settleTouchedParlays(propBets || [])
      settledCount++
    }
    showFlash(`Auto-settled ${settledCount} prop(s) from Week ${week} actuals`)
    fetchProps(); fetchAccounts()
    if (myAccount) fetchMyBets(myAccount.id)
    setGenerating(false)
  }

  // Undoes autoSettleProps/manual settlement for this week -- reverses every
  // affected bet (and, if it finished a parlay, that parlay too) back to
  // pending and claws back whatever balance the settlement paid out, then
  // reopens the prop itself. For when a settlement ran off bad/stale actual
  // points and needs to be redone once the real numbers are in.
  const resetSettledProps = async () => {
    setGenerating(true)
    const { data: settledProps } = await db.from('sb_props').select('*').eq('season', SEASON).eq('week', week).eq('is_settled', true)
    if (!settledProps?.length) { showFlash('No settled props for this week', false); setGenerating(false); return }

    let resetCount = 0
    for (const prop of settledProps) {
      const { data: propBets } = await db.from('sb_bets').select('*').eq('prop_id', prop.id).neq('status', 'pending')
      for (const bet of (propBets || [])) {
        if (bet.status === 'won' || bet.status === 'push') {
          const back = bet.status === 'won' ? bet.amount + bet.win_amount : bet.amount
          const { data: acc } = await db.from('gb_accounts').select('balance').eq('id', bet.account_id).single()
          await db.from('gb_accounts').update({ balance: acc.balance - back }).eq('id', bet.account_id)
        }
        await db.from('sb_bets').update({ status: 'pending', win_amount: 0 }).eq('id', bet.id)

        // A parlay only ever finalizes once every leg is final -- reopening
        // one leg means the parlay can't be final either, so undo its own
        // payout (if any) and reopen it too. Its other, unrelated legs keep
        // whatever real result they already have.
        if (bet.parlay_id) {
          const { data: parlay } = await db.from('sb_parlays').select('*').eq('id', bet.parlay_id).single()
          if (parlay && parlay.status !== 'pending') {
            if (parlay.status === 'won') {
              const { data: acc } = await db.from('gb_accounts').select('balance').eq('id', parlay.account_id).single()
              await db.from('gb_accounts').update({ balance: acc.balance - (parlay.amount + parlay.win_amount) }).eq('id', parlay.account_id)
            }
            await db.from('sb_parlays').update({ status: 'pending', win_amount: 0 }).eq('id', parlay.id)
          }
        }
      }
      await db.from('sb_props').update({ is_settled: false, result: null, actual_points: null }).eq('id', prop.id)
      resetCount++
    }
    showFlash(`Reset ${resetCount} prop${resetCount === 1 ? '' : 's'} back to pending`)
    logActivity('props_reset', 'Admin', `Admin reset ${resetCount} settled Week ${week} prop${resetCount === 1 ? '' : 's'} back to pending`)
    fetchProps(); fetchAccounts(); fetchAllPendingBets(); fetchActivityLog()
    if (myAccount) fetchMyBets(myAccount.id)
    setGenerating(false)
    setConfirmResetProps(false)
  }

  // ── bet slip: generalized across games, futures and props so any
  // combination of them can ride together in one parlay ──
  const inSlip = (family, refId, betType, pick) => slip.some(s => s.family === family && s.refId === refId && s.betType === betType && s.pick === pick)
  const toggleBet = ({ family, refId, betType, pick, odds, label, subLabel, teamId = null, oppTeamId = null }) => {
    const key = `${family}-${refId}-${betType}-${pick}`
    if (slip.find(s => s.key === key)) {
      const idx = slip.findIndex(s => s.key === key)
      setSlip(sl => sl.filter(s => s.key !== key))
      setSlipAmounts(a => { const n = { ...a }; delete n[idx]; return n })
    } else {
      setSlip(sl => [...sl, { key, family, refId, betType, pick, odds, label, gameName: subLabel, teamId, oppTeamId }])
      setSlipOpen(true)
    }
  }
  // A team's own playoffs/bye/semis/finals/title/win-total/seed markets are
  // all the same underlying event ladder -- "makes the finals" is nearly
  // implied by "wins the title", etc -- so parlaying two of a team's own
  // futures together is closer to free money against the book than a real
  // combined bet. Only checked for futures; games/props from the same real
  // matchup are still allowed to ride together.
  const futureTeamIds = leg => [leg.teamId, leg.oppTeamId].filter(Boolean)
  const slipHasSameTeamFutures = legs => {
    const futures = legs.filter(s => s.family === 'future')
    for (let i = 0; i < futures.length; i++) {
      for (let j = i + 1; j < futures.length; j++) {
        if (futureTeamIds(futures[i]).some(t => futureTeamIds(futures[j]).includes(t))) return true
      }
    }
    return false
  }
  const legInsertRow = (accountId, leg, amount, extra = {}) => ({
    account_id: accountId,
    game_id: leg.family === 'game' ? leg.refId : null,
    future_id: leg.family === 'future' ? leg.refId : null,
    prop_id: leg.family === 'prop' ? leg.refId : null,
    bet_type: leg.betType,
    pick: leg.pick,
    amount,
    odds: leg.odds,
    status: 'pending',
    ...extra,
  })

  const stakeTotal = isParlay ? (parseInt(parlayAmt) || 0) : slip.reduce((s, _, i) => s + (parseInt(slipAmounts[i]) || 0), 0)
  const overBalance = !!myAccount && stakeTotal > myAccount.balance

  // ── action-based juice: after a bet lands, reprice that market from its
  // stored fair probability plus the CURRENT pending-bet split (never by
  // nudging the previous displayed odds), so repeated bets can't compound
  // drift away from the model. Spreads/totals are untouched -- only the
  // two-sided probability markets (moneylines, futures, props) move. ──
  const clampP = p => Math.min(0.97, Math.max(0.03, p))

  const rebalanceGameMl = async (gameId) => {
    const { data: game } = await db.from('sb_games').select('fair_p_a').eq('id', gameId).single()
    if (!game || game.fair_p_a == null) return
    const { data: bets } = await db.from('sb_bets').select('pick, amount').eq('game_id', gameId).eq('bet_type', 'ml').eq('status', 'pending')
    const amtA = (bets || []).filter(b => b.pick === 'team_a').reduce((s, b) => s + b.amount, 0)
    const amtB = (bets || []).filter(b => b.pick === 'team_b').reduce((s, b) => s + b.amount, 0)
    const total = amtA + amtB
    const imbalance = total ? (amtA - amtB) / total : 0
    const [mlA, mlB] = priceTwoWay(clampP(game.fair_p_a - MAX_ACTION_SHIFT * imbalance))
    await db.from('sb_games').update({ ml_a: mlA, ml_b: mlB }).eq('id', gameId)
  }

  const rebalanceFuture = async (futureId) => {
    const { data: f } = await db.from('sb_futures').select('fair_p').eq('id', futureId).single()
    if (!f || f.fair_p == null) return
    const { data: bets } = await db.from('sb_bets').select('pick, amount').eq('future_id', futureId).eq('status', 'pending')
    const amtYes = (bets || []).filter(b => b.pick === 'yes').reduce((s, b) => s + b.amount, 0)
    const amtNo = (bets || []).filter(b => b.pick === 'no').reduce((s, b) => s + b.amount, 0)
    const total = amtYes + amtNo
    const imbalance = total ? (amtYes - amtNo) / total : 0
    // fair_p already has any temper (finishes-ahead-of) baked in from when
    // it was first computed -- action only ever nudges from there, never
    // re-applies it. Every future (fixed or custom) shares the same heavier
    // hold + underdog cap on every reprice, same as at generation time.
    const adjP = clampP(f.fair_p - MAX_ACTION_SHIFT * imbalance)
    const [oddsYes, oddsNo] = priceCustomMarket(adjP)
    await db.from('sb_futures').update({ odds_yes: oddsYes, odds_no: oddsNo }).eq('id', futureId)
  }

  const rebalanceProp = async (propId) => {
    const { data: bets } = await db.from('sb_bets').select('pick, amount').eq('prop_id', propId).eq('status', 'pending')
    const amtOver = (bets || []).filter(b => b.pick === 'over').reduce((s, b) => s + b.amount, 0)
    const amtUnder = (bets || []).filter(b => b.pick === 'under').reduce((s, b) => s + b.amount, 0)
    const total = amtOver + amtUnder
    const imbalance = total ? (amtOver - amtUnder) / total : 0
    // A player's own O/U line is their own projection -- a true pick'em
    // (fair_p = 0.5) before any action moves it.
    const [oddsOver, oddsUnder] = priceTwoWay(clampP(0.5 - MAX_ACTION_SHIFT * imbalance))
    await db.from('sb_props').update({ odds_over: oddsOver, odds_under: oddsUnder }).eq('id', propId)
  }

  const rebalanceLeg = leg => {
    if (leg.family === 'game' && leg.betType === 'ml') return rebalanceGameMl(leg.refId)
    if (leg.family === 'future') return rebalanceFuture(leg.refId)
    if (leg.family === 'prop') return rebalanceProp(leg.refId)
    return Promise.resolve()
  }
  const refreshBoards = () => { fetchGames(); fetchFutures(); fetchProps() }

  // ── custom futures: win total, final seed, and "finishes ahead of" are
  // priced live from the cached simulation (sb_team_sim) for whatever
  // team(s)/line a bettor picks, rather than only a fixed pre-generated
  // one -- getOrCreateFuture() materializes the actual sb_futures row the
  // first time anyone picks that exact combination. ──
  const simFor = teamId => teamSim.find(t => t.team_id === teamId)
  const teamLabel = teamId => { const t = leagueTeams.find(x => x.id === teamId); return t?.manager?.name || t?.team_name || '?' }
  const winOverProb = (teamId, line) => {
    const t = simFor(teamId)
    if (!t) return null
    return Object.entries(t.win_tally || {}).reduce((s, [w, p]) => s + (parseFloat(w) > line ? p : 0), 0)
  }
  const seedOverProb = (teamId, line) => {
    const t = simFor(teamId)
    if (!t) return null
    const pUnder = Object.entries(t.seed_probs || {}).reduce((s, [seed, p]) => s + (parseFloat(seed) < line ? p : 0), 0)
    return 1 - pUnder
  }
  // "Finishes ahead of" is a team-quality read (you pick two teams, not a
  // number), same as playoffs/bye/semis/finals/title -- so it gets the same
  // early-season tempering they do, unlike win total/final seed where you
  // deliberately chose the line yourself.
  const aheadProbOf = (teamId, oppId) => {
    const t = simFor(teamId)
    if (!t) return null
    const raw = t.ahead_probs?.[oppId]
    return raw == null ? null : temperProb(raw, weeksPlayed)
  }

  const addCustomFuture = async ({ marketType, teamId, oppTeamId = null, teamName, oppTeamName = null, line = null, fairP, pick, label, subLabel }) => {
    const p = clampP(fairP)
    const [oddsYes, oddsNo] = priceCustomMarket(p)
    const { future, error } = await getOrCreateFuture(db, { season: SEASON, marketType, teamId, oppTeamId, teamName, oppTeamName, line, fairP: p, oddsYes, oddsNo })
    if (error || !future) return showFlash(`Failed: ${error || 'unknown error'}`, false)
    toggleBet({ family: 'future', refId: future.id, betType: 'future', pick, odds: pick === 'yes' ? future.odds_yes : future.odds_no, label, subLabel, teamId, oppTeamId })
    fetchFutures()
  }

  const placeSingles = async () => {
    if (!myAccount) return showFlash('Log in first', false)
    const amounts = slip.map((_, i) => parseInt(slipAmounts[i]) || 0)
    if (amounts.some(a => a <= 0)) return showFlash('Enter amounts for all bets', false)
    const total = amounts.reduce((a, b) => a + b, 0)
    if (total > myAccount.balance) return showFlash('Insufficient Gimre Bucks', false)
    setSubmitting(true)
    await db.from('sb_bets').insert(slip.map((s, i) => legInsertRow(myAccount.id, s, amounts[i])))
    const { data: fresh } = await db.from('gb_accounts').select('balance').eq('id', myAccount.id).single()
    await db.from('gb_accounts').update({ balance: fresh.balance - total }).eq('id', myAccount.id)
    await Promise.all(slip.map(rebalanceLeg))
    if (!keepSlipAfterBet) { setSlip([]); setSlipAmounts({}) }
    showFlash(`${slip.length} bet${slip.length > 1 ? 's' : ''} placed!`)
    fetchAccounts(); fetchMyBets(myAccount.id); refreshBoards()
    logActivity('bet_placed', playerName, `${playerName} placed ${slip.length} bet${slip.length > 1 ? 's' : ''} totaling ${total} GB`)
    setSubmitting(false)
  }

  const placeParlay = async () => {
    if (!myAccount) return showFlash('Log in first', false)
    if (slip.length < 2) return showFlash('Parlays need 2+ legs', false)
    if (slipHasSameTeamFutures(slip)) return showFlash("Can't parlay two of the same team's futures together", false)
    const amt = parseInt(parlayAmt)
    if (!amt || amt <= 0) return showFlash('Enter parlay amount', false)
    if (amt > myAccount.balance) return showFlash('Insufficient Gimre Bucks', false)
    setSubmitting(true)
    const combinedOdds = toAmerican(slip.reduce((a, s) => a * toDecimal(s.odds), 1))
    const { data: parlay } = await db.from('sb_parlays').insert({ account_id: myAccount.id, amount: amt, legs: slip.length, combined_odds: combinedOdds, status: 'pending' }).select().single()
    await db.from('sb_bets').insert(slip.map(s => legInsertRow(myAccount.id, s, 0, { parlay_id: parlay.id })))
    const { data: fresh } = await db.from('gb_accounts').select('balance').eq('id', myAccount.id).single()
    await db.from('gb_accounts').update({ balance: fresh.balance - amt }).eq('id', myAccount.id)
    await Promise.all(slip.map(rebalanceLeg))
    if (!keepSlipAfterBet) { setSlip([]); setParlayAmt(''); setIsParlay(false) }
    showFlash(`Parlay placed! ${fmtOdds(combinedOdds)}`)
    fetchAccounts(); fetchMyBets(myAccount.id); refreshBoards()
    logActivity('parlay_placed', playerName, `${playerName} placed a ${slip.length}-leg parlay for ${amt} GB (${fmtOdds(combinedOdds)})`)
    setSubmitting(false)
  }

  const submitPickem = async () => {
    if (!myAccount) return showFlash('Log in first', false)
    const newPicks = Object.entries(pickemPicks).filter(([gameId]) => !myBets.some(b => b.bet_type === 'pickem' && b.game_id === gameId))
    if (!newPicks.length) return showFlash('No new picks to submit', false)
    setSubmitting(true)
    await db.from('sb_bets').insert(newPicks.map(([gameId, pick]) => ({ account_id: myAccount.id, game_id: gameId, bet_type: 'pickem', pick, amount: 0, odds: 0, status: 'pending' })))
    showFlash('Picks submitted!')
    fetchMyBets(myAccount.id)
    logActivity('pickem_submitted', playerName, `${playerName} submitted ${newPicks.length} pick'em pick${newPicks.length > 1 ? 's' : ''}`)
    setSubmitting(false)
  }

  const handleAddGame = async () => {
    if (!gameForm.team_a.trim() || !gameForm.team_b.trim()) return setGameFormError('Both team names required')
    setSubmitting(true)
    const { error } = await db.from('sb_games').insert({ season: SEASON, week, team_a: gameForm.team_a.trim(), team_b: gameForm.team_b.trim(), spread: gameForm.spread ? parseFloat(gameForm.spread) : null, over_under: gameForm.over_under ? parseFloat(gameForm.over_under) : null, ml_a: parseInt(gameForm.ml_a) || -110, ml_b: parseInt(gameForm.ml_b) || -110 })
    if (error) { setGameFormError('Failed to add'); setSubmitting(false); return }
    setGameForm({ team_a: '', team_b: '', spread: '', over_under: '', ml_a: '-110', ml_b: '-110' })
    setShowGameForm(false); setGameFormError('')
    fetchGames(); setSubmitting(false)
  }

  const handleSettle = async () => {
    const sA = parseFloat(settleScores.a), sB = parseFloat(settleScores.b)
    if (isNaN(sA) || isNaN(sB)) return showFlash('Enter valid scores', false)
    setSubmitting(true)
    const game = settleTarget
    const { data: gameBets } = await db.from('sb_bets').select('*').eq('game_id', game.id).eq('status', 'pending')
    const total = sA + sB

    for (const bet of (gameBets || [])) {
      let status = 'push'
      if (bet.bet_type === 'spread' && game.spread != null) {
        if (bet.pick === 'team_a') status = sA + game.spread > sB ? 'won' : sA + game.spread < sB ? 'lost' : 'push'
        else status = sB - game.spread > sA ? 'won' : sB - game.spread < sA ? 'lost' : 'push'
      }
      if (bet.bet_type === 'ou' && game.over_under != null) {
        if (bet.pick === 'over') status = total > game.over_under ? 'won' : total < game.over_under ? 'lost' : 'push'
        else status = total < game.over_under ? 'won' : total > game.over_under ? 'lost' : 'push'
      }
      if (bet.bet_type === 'ml') {
        if (bet.pick === 'team_a') status = sA > sB ? 'won' : sA < sB ? 'lost' : 'push'
        else status = sB > sA ? 'won' : sB < sA ? 'lost' : 'push'
      }
      if (bet.bet_type === 'pickem') {
        status = (bet.pick === 'team_a' ? sA > sB : sB > sA) ? 'won' : 'lost'
      }
      const winAmt = status === 'won' ? (bet.bet_type === 'pickem' ? PICKEM_PRIZE : calcWin(bet.amount, bet.odds)) : 0
      await db.from('sb_bets').update({ status, win_amount: winAmt }).eq('id', bet.id)
      const { data: a } = await db.from('gb_accounts').select('balance').eq('id', bet.account_id).single()
      if (status === 'won') await db.from('gb_accounts').update({ balance: a.balance + bet.amount + winAmt }).eq('id', bet.account_id)
      else if (status === 'push') await db.from('gb_accounts').update({ balance: a.balance + bet.amount }).eq('id', bet.account_id)
    }

    await settleTouchedParlays(gameBets || [])

    await db.from('sb_games').update({ is_settled: true, is_locked: true, score_a: sA, score_b: sB }).eq('id', game.id)
    setSettleTarget(null); setSettleScores({ a: '', b: '' })
    showFlash('Game settled!')
    fetchGames(); fetchAccounts()
    if (myAccount) fetchMyBets(myAccount.id)
    setSubmitting(false)
  }

  if (!mounted) return null

  const inp = { background: d ? '#111' : '#e8e4dc', border: `1px solid ${border}`, color: text, padding: '8px 12px', fontSize: '13px', fontFamily: "'Inter', sans-serif", outline: 'none' }
  const lbl = { fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, display: 'block', marginBottom: '4px' }
  const tabBtn = active => ({ background: active ? text : 'none', color: active ? bg : muted, border: `1px solid ${border}`, padding: '6px 14px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: active ? '600' : '400' })
  const betBtn = active => ({ background: active ? text : 'none', color: active ? bg : muted, border: `1px solid ${active ? text : border}`, padding: '5px 10px', cursor: 'pointer', fontSize: '11px', fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' })
  // A bolder, tinted, hover-reactive odds button for the futures markets --
  // green-tinted for the "yes" side, red-tinted for "no", filled solid once
  // selected, with a lift on hover so the row reads as clickable rather than
  // a flat label.
  const oddsBtn = (key, tint, active) => {
    const hovered = hoveredBetKey === key
    return active
      ? { background: tint, border: `1px solid ${tint}`, color: bg, padding: '9px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap', boxShadow: `0 2px 10px ${tint}50` }
      : { background: hovered ? tint + '28' : tint + '14', border: `1px solid ${hovered ? tint : tint + '45'}`, color: tint, padding: '9px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap', transition: 'transform 0.12s ease, background 0.12s ease', transform: hovered ? 'translateY(-1px)' : 'none' }
  }
  const adminBtn = { background: 'none', border: `1px solid ${gold}`, color: gold, padding: '8px 16px', cursor: generating ? 'not-allowed' : 'pointer', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", opacity: generating ? 0.6 : 1 }
  const weeks = Array.from({ length: 17 }, (_, i) => i + 1)

  const futureLabel = (f, pick) => {
    if (f.market_type === 'win_total') return `${f.team_name} ${pick === 'yes' ? 'Over' : 'Under'} ${f.line} Wins`
    if (f.market_type === 'seed_total') return `${f.team_name} ${pick === 'yes' ? 'Worse' : 'Better'} than Seed ${f.line}`
    if (f.market_type === 'h2h_finish') return pick === 'yes' ? `${f.team_name} finishes ahead of ${f.opp_team_name}` : `${f.opp_team_name} finishes ahead of ${f.team_name}`
    return `${f.team_name} — ${FUTURE_LABELS[f.market_type] || f.market_type} (${pick === 'yes' ? 'Yes' : 'No'})`
  }

  // A parlay leg's own bet_type (spread/ou/ml) has to be in the label --
  // "Reid" alone doesn't say whether that's Reid's spread or Reid's
  // moneyline, and a parlay can carry both on the same matchup.
  const gameLegDesc = leg => {
    const typeLabel = leg.bet_type === 'spread' ? 'Spread' : leg.bet_type === 'ou' ? 'O/U' : 'ML'
    const sideLabel = leg.pick === 'team_a' ? leg.game.team_a : leg.pick === 'team_b' ? leg.game.team_b : leg.pick === 'over' ? 'Over' : leg.pick === 'under' ? 'Under' : leg.pick
    return `${leg.game.team_a} vs ${leg.game.team_b} — ${typeLabel}: ${sideLabel}`
  }

  // ── the bet slip: shared across every tab. Desktop sits vertically
  // centered just right of the (900px, centered) content column, rather
  // than pinned to the screen edge, so it never overlaps the lines. Mobile
  // collapses into a bottom sheet -- a full-width bar (always the tap
  // target, whether open or closed) with the content expanding below it. ──
  const SlipContent = () => {
    const sameTeamConflict = slipHasSameTeamFutures(slip)
    const eligibleForParlay = slip.length >= 2 && !sameTeamConflict
    if (slip.length === 0) return <div style={{ padding: '20px 16px', fontSize: '12px', color: muted }}>No picks yet — tap any line to add it.</div>
    return (
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          <button onClick={() => setIsParlay(false)} style={tabBtn(!isParlay)}>Singles</button>
          <button onClick={() => setIsParlay(true)} disabled={!eligibleForParlay} style={{ ...tabBtn(isParlay), opacity: eligibleForParlay ? 1 : 0.4 }}>Parlay</button>
        </div>
        {sameTeamConflict && (
          <p style={{ fontSize: '11px', color: red, marginBottom: '10px' }}>Two of these futures share the same team — parlaying a team's own markets together (e.g. make the playoffs + win the title) isn't allowed. Place them as singles, or drop one.</p>
        )}
        {slip.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => toggleBet(s)} style={{ background: 'none', border: 'none', color: red, cursor: 'pointer', fontSize: '14px', padding: 0, marginTop: '2px' }}>✕</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', color: text }}>{s.label}</div>
              <div style={{ fontSize: '11px', color: muted }}>{s.gameName} · {fmtOdds(s.odds)}</div>
            </div>
            {!isParlay && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <input type="number" min="1" value={slipAmounts[i] || ''} onChange={e => setSlipAmounts(a => ({ ...a, [i]: e.target.value }))} placeholder="GB" style={{ ...inp, width: '70px', padding: '6px 8px' }} />
                {slipAmounts[i] && parseInt(slipAmounts[i]) > 0 && (
                  <span style={{ fontSize: '10px', color: green, whiteSpace: 'nowrap' }}>pays {parseInt(slipAmounts[i]) + calcWin(parseInt(slipAmounts[i]), s.odds)}</span>
                )}
              </div>
            )}
          </div>
        ))}
        {isParlay && (
          <div style={{ borderTop: `1px solid ${border}`, paddingTop: '12px', marginTop: '4px' }}>
            <div style={{ fontSize: '12px', color: muted, marginBottom: '8px' }}>
              Combined odds: <strong style={{ color: text }}>{fmtOdds(toAmerican(slip.reduce((a, s) => a * toDecimal(s.odds), 1)))}</strong>
            </div>
            <input type="number" min="1" value={parlayAmt} onChange={e => setParlayAmt(e.target.value)} placeholder="Stake (GB)" style={{ ...inp, width: '100%', marginBottom: '8px' }} />
            {parlayAmt && parseInt(parlayAmt) > 0 && (
              <div style={{ fontSize: '12px', color: muted }}>
                Risk <strong style={{ color: text }}>{parseInt(parlayAmt)} GB</strong> to win <strong style={{ color: green }}>{calcWin(parseInt(parlayAmt), toAmerican(slip.reduce((a, s) => a * toDecimal(s.odds), 1)))} GB</strong>
                {' '}(payout {parseInt(parlayAmt) + calcWin(parseInt(parlayAmt), toAmerican(slip.reduce((a, s) => a * toDecimal(s.odds), 1)))} GB)
              </div>
            )}
          </div>
        )}
        {!isParlay && stakeTotal > 0 && (
          <div style={{ fontSize: '12px', color: muted, borderTop: `1px solid ${border}`, paddingTop: '10px', marginTop: '4px' }}>
            Total risk <strong style={{ color: text }}>{stakeTotal} GB</strong>
          </div>
        )}
        {myAccount && (
          <div style={{ fontSize: '11px', color: overBalance ? red : muted, marginTop: '6px' }}>
            Balance: {myAccount.balance.toLocaleString()} GB{overBalance ? ' — exceeds your balance' : ''}
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: muted, marginTop: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={keepSlipAfterBet} onChange={e => setKeepSlipAfterBet(e.target.checked)} />
          Keep picks in slip after placing a bet
        </label>
        {flash.msg && <p style={{ fontSize: '12px', color: flash.ok ? green : red, marginTop: '10px' }}>{flash.msg}</p>}
        <button
          onClick={isParlay ? placeParlay : placeSingles}
          disabled={submitting || !myAccount || stakeTotal <= 0 || overBalance || (isParlay && sameTeamConflict)}
          style={{ background: text, color: bg, border: 'none', padding: '12px 24px', width: '100%', cursor: (submitting || overBalance || stakeTotal <= 0 || (isParlay && sameTeamConflict)) ? 'not-allowed' : 'pointer', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500', marginTop: '12px', opacity: (submitting || overBalance || stakeTotal <= 0 || (isParlay && sameTeamConflict)) ? 0.5 : 1 }}
        >
          {!myAccount ? 'Log in first' : submitting ? 'Placing...' : isParlay ? 'Place Parlay' : 'Place Bets'}
        </button>
      </div>
    )
  }

  // Record/PF/playoff odds/this-week projection per team, plus a click into
  // the full matchup projections popup -- a compact card list rather than a
  // wide table so it fits the gutter beside the futures list on desktop.
  const TeamSnapshotList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {leagueTeams.map(t => {
        const rec = teamRecord[t.id] || { wins: 0, losses: 0, pf: 0, gp: 0 }
        const playoffFuture = futures.find(f => f.team_id === t.id && f.market_type === 'playoffs' && !f.is_settled)
        const playoffPct = playoffFuture?.fair_p != null ? Math.round(playoffFuture.fair_p * 100) : null
        const projPts = weekProjByTeam[t.id]
        return (
          <div
            key={t.id}
            onClick={() => setProjModalTeamId(t.id)}
            style={{ background: cardBg, border: `1px solid ${border}`, borderLeft: `3px solid ${playoffPct != null ? (playoffPct >= 50 ? green : red) : border}`, borderRadius: '4px', padding: '10px 12px', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: text }}>{teamLabel(t.id)}</span>
              <span style={{ fontSize: '11px', color: muted }}>{rec.wins}-{rec.losses}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: muted, gap: '6px' }}>
              <span>{rec.gp ? `${(rec.pf / rec.gp).toFixed(1)} PF` : '— PF'}</span>
              <span>{playoffPct != null ? `${playoffPct}% playoffs` : '—'}</span>
              <span>{projPts != null ? `${projPts.toFixed(1)} proj` : '—'}</span>
            </div>
          </div>
        )
      })}
    </div>
  )

  // Desktop-only: mirrors the bet slip's placement in the right gutter, just
  // on the left, so it's out of the vertical flow entirely instead of
  // pushing the market list down the page.
  const TeamSnapshotPanel = () => {
    if (effectiveMobile || tab !== 'futures' || !leagueTeams.length) return null
    return (
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-774px, -50%)', zIndex: 90, width: '300px', maxHeight: '80vh', overflowY: 'auto', paddingRight: '4px' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Team Snapshot</p>
        <TeamSnapshotList />
      </div>
    )
  }

  const SlipPanel = () => {
    if (slip.length === 0) return null
    const caret = slipOpen ? '▲' : '▼'

    if (effectiveMobile) {
      return (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 150, background: d ? '#0f1524' : '#f4f1ec', boxShadow: '0 -8px 24px rgba(0,0,0,0.35)' }}>
          <button
            onClick={() => setSlipOpen(o => !o)}
            style={{ width: '100%', background: text, color: bg, border: 'none', padding: '14px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", cursor: 'pointer' }}
          >
            Bet Slip <span style={{ color: gold }}>({slip.length})</span> <span style={{ fontSize: '10px' }}>{caret}</span>
          </button>
          {slipOpen && <div style={{ maxHeight: '60vh', overflowY: 'auto', borderTop: `1px solid ${border}` }}><SlipContent /></div>}
        </div>
      )
    }

    // Desktop: vertically centered just right of the 900px-wide centered
    // content column (450px half-width + a gap), so it sits in the open
    // gutter next to the lines instead of pinned to the browser edge.
    return (
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(474px, -50%)', zIndex: 150, width: '340px' }}>
        <button
          onClick={() => setSlipOpen(o => !o)}
          style={{ width: '100%', background: text, color: bg, border: 'none', padding: '12px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif", letterSpacing: '0.05em', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
        >
          Bet Slip <span style={{ color: gold }}>({slip.length})</span> <span style={{ fontSize: '10px' }}>{caret}</span>
        </button>
        {slipOpen && (
          <div style={{ background: d ? '#0f1524' : '#f4f1ec', border: `1px solid ${border}`, marginTop: '10px', maxHeight: '70vh', overflowY: 'auto', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
            <SlipContent />
          </div>
        )}
      </div>
    )
  }

  // Sign in / create an account before anything else in the sportsbook is
  // usable -- same name+PIN system as before, now a gate instead of a small
  // corner widget so "who's betting" is unambiguous from the start.
  if (!playerName) {
    return (
      <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
        <Nav />
        <div style={{ maxWidth: '380px', margin: '0 auto', padding: effectiveMobile ? '100px 24px 80px' : '160px 24px 80px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : '48px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '8px' }}>Sportsbook</h1>
          <p style={{ fontSize: '13px', color: muted, marginBottom: '32px', lineHeight: 1.6 }}>
            Sign in to bet Gimre Bucks. New here? Type a name and set a PIN to create an account.
          </p>

          {nameStep === 'name' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNameNext()}
                placeholder="Your name..."
                autoFocus
                style={{ ...inp, width: '100%', textAlign: 'center', padding: '12px' }}
              />
              <button
                onClick={handleNameNext}
                style={{ background: text, color: bg, border: 'none', padding: '12px 24px', cursor: 'pointer', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500' }}
              >
                Next
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '13px', color: muted, margin: 0 }}>
                {isNewAccount ? `Create account for ` : `Welcome back, `}
                <strong style={{ color: text }}>{pendingName}</strong>
                {' '}
                <button onClick={() => { setNameStep('name'); setPinError(''); setShowForgotPin(false); setResetPinInput(''); setResetPinError(''); setResetPinSubmitted(false) }} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif", textDecoration: 'underline', padding: 0 }}>change</button>
              </p>
              <input
                type="password"
                value={pinInput}
                onChange={e => { setPinInput(e.target.value); setPinError('') }}
                onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                placeholder={isNewAccount ? 'Set a PIN (4+ digits)' : 'PIN'}
                autoFocus
                style={{ ...inp, width: '100%', textAlign: 'center', padding: '12px' }}
              />
              {pinError && <p style={{ fontSize: '12px', color: red, margin: 0 }}>{pinError}</p>}
              <button
                onClick={handlePinSubmit}
                style={{ background: text, color: bg, border: 'none', padding: '12px 24px', cursor: 'pointer', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500' }}
              >
                {isNewAccount ? 'Create Account' : 'Log In'}
              </button>

              {!isNewAccount && !resetPinSubmitted && (
                showForgotPin ? (
                  <div style={{ borderTop: `1px solid ${border}`, marginTop: '8px', paddingTop: '14px', textAlign: 'left' }}>
                    <p style={{ fontSize: '11px', color: muted, marginBottom: '8px' }}>
                      Pick a new PIN — it won't take effect until an admin approves it.
                    </p>
                    <input
                      type="password"
                      value={resetPinInput}
                      onChange={e => { setResetPinInput(e.target.value); setResetPinError('') }}
                      onKeyDown={e => e.key === 'Enter' && requestPinReset()}
                      placeholder="New PIN (4+ digits)"
                      style={{ ...inp, width: '100%', textAlign: 'center', padding: '10px', marginBottom: '8px' }}
                    />
                    {resetPinError && <p style={{ fontSize: '12px', color: red, margin: '0 0 8px' }}>{resetPinError}</p>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={requestPinReset} style={{ background: gold, color: '#000', border: 'none', padding: '10px 16px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif", fontWeight: '600', flex: 1 }}>Request Reset</button>
                      <button onClick={() => { setShowForgotPin(false); setResetPinInput(''); setResetPinError('') }} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '10px 16px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowForgotPin(true)} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif", textDecoration: 'underline', padding: 0, marginTop: '4px' }}>Forgot PIN?</button>
                )
              )}
              {resetPinSubmitted && (
                <p style={{ fontSize: '12px', color: green, margin: 0 }}>Reset requested — check back once an admin approves it.</p>
              )}
            </div>
          )}

          <p style={{ fontSize: '11px', color: muted, marginTop: '32px' }}>
            Everyone starts with 1,000 Gimre Bucks. Year-end total sets next season's draft order.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <SlipPanel />
      <TeamSnapshotPanel />

      {/* Admin PIN modal */}
      {showPinModal && (
        <>
          <div onClick={() => setShowPinModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: d ? '#0f1524' : '#f4f1ec', border: `1px solid ${border}`, padding: '28px', width: effectiveMobile ? '90vw' : '320px' }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', marginBottom: '16px', color: text }}>Admin Access</h3>
            <input type="password" placeholder="PIN" value={adminPinInput}
              onChange={e => { setAdminPinInput(e.target.value); setAdminPinError('') }}
              onKeyDown={e => { if (e.key === 'Enter') { if (adminPinInput === ADMIN_PIN) { setAdminUnlocked(true); setShowPinModal(false); setAdminPinInput('') } else setAdminPinError('Wrong PIN') }}}
              style={{ ...inp, width: '100%', marginBottom: '8px' }} />
            {adminPinError && <p style={{ fontSize: '12px', color: red, marginBottom: '8px' }}>{adminPinError}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => { if (adminPinInput === ADMIN_PIN) { setAdminUnlocked(true); setShowPinModal(false); setAdminPinInput('') } else setAdminPinError('Wrong PIN') }}
                style={{ background: text, color: bg, border: 'none', padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif", flex: 1 }}>Unlock</button>
              <button onClick={() => setShowPinModal(false)} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Help modal -- a plain-English explainer for anyone new to the book. */}
      {showHelpModal && (
        <>
          <div onClick={() => setShowHelpModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: d ? '#0f1524' : '#f4f1ec', border: `1px solid ${border}`, width: effectiveMobile ? '92vw' : '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: text, margin: 0 }}>How the Sportsbook Works</h3>
              <button onClick={() => setShowHelpModal(false)} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '18px', padding: 0 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '20px', fontSize: '13px', lineHeight: 1.6, color: text }}>
              <p style={{ marginBottom: '14px' }}>
                Everyone plays with <strong>Gimre Bucks (GB)</strong> — fake money, no real cash involved. New accounts start with <strong>200 GB</strong>. Your year-end GB total sets next season's draft order (most GB picks first).
              </p>

              <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginTop: '18px', marginBottom: '6px' }}>Odds, Wager &amp; To Win</p>
              <p style={{ marginBottom: '10px' }}>
                Odds are American-style. A <strong>negative</strong> number (e.g. −150) is a favorite: bet 150 GB to win 100. A <strong>positive</strong> number (e.g. +150) is an underdog: bet 100 GB to win 150. <strong>Wager</strong> is what you're risking; <strong>To Win</strong> is the profit if it hits (your wager comes back on top of that).
              </p>

              <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginTop: '18px', marginBottom: '6px' }}>The Tabs</p>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                <li style={{ marginBottom: '8px' }}><strong>Lines</strong> — this week's real head-to-head matchups: moneyline (pick the winner), spread, and over/under.</li>
                <li style={{ marginBottom: '8px' }}><strong>Pick'em</strong> — free, no wager required. Just pick the straight-up winner of each matchup for a flat prize.</li>
                <li style={{ marginBottom: '8px' }}><strong>Futures</strong> — season-long bets: make the playoffs, get a bye, make the semis/finals, or win the title. Also lets you build a custom bet (a team's win total, final seed, or "finishes ahead of" another team) — pick the team(s) and line yourself and it prices the odds live.</li>
                <li style={{ marginBottom: '8px' }}><strong>Props</strong> — player-level bets on this week's projected stats (over/under a specific player's points). Filter by matchup or position to narrow the list.</li>
                <li style={{ marginBottom: '8px' }}><strong>Parlay</strong> — while building a bet slip, toggle "Parlay" to combine multiple legs (from any tab) into one bet with combined odds. Every leg has to hit for the parlay to pay out.</li>
                <li style={{ marginBottom: '8px' }}><strong>My Bets</strong> — your own bet history and results.</li>
                <li style={{ marginBottom: '8px' }}><strong>All Bets</strong> — everyone's bets across every account: what was bet, the odds, the wager, and the potential winnings.</li>
                <li style={{ marginBottom: '8px' }}><strong>Leaderboard</strong> — everyone's current GB balance, ranked.</li>
                <li style={{ marginBottom: '8px' }}><strong>Activity</strong> — a running log of account creation, bets placed, and admin actions.</li>
              </ul>

              <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginTop: '18px', marginBottom: '6px' }}>Accounts &amp; PIN</p>
              <p style={{ margin: 0 }}>
                Enter your name once to create an account (protected by a PIN you set) or log into an existing one — name matching isn't case-sensitive. Forgot your PIN? Use "Forgot PIN?" on the login screen to request a reset; an admin has to approve it before it takes effect.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Settle modal (games) */}
      {settleTarget && (
        <>
          <div onClick={() => setSettleTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: d ? '#0f1524' : '#f4f1ec', border: `1px solid ${border}`, padding: '28px', width: effectiveMobile ? '90vw' : '380px' }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', marginBottom: '4px', color: text }}>Settle Game</h3>
            <p style={{ fontSize: '12px', color: muted, marginBottom: '20px' }}>{settleTarget.team_a} vs {settleTarget.team_b}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div><label style={lbl}>{settleTarget.team_a}</label><input value={settleScores.a} onChange={e => setSettleScores(s => ({ ...s, a: e.target.value }))} style={{ ...inp, width: '100%' }} /></div>
              <div><label style={lbl}>{settleTarget.team_b}</label><input value={settleScores.b} onChange={e => setSettleScores(s => ({ ...s, b: e.target.value }))} style={{ ...inp, width: '100%' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSettle} disabled={submitting} style={{ background: green, color: '#fff', border: 'none', padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif", fontWeight: '500', flex: 1 }}>Settle</button>
              <button onClick={() => setSettleTarget(null)} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Matchup projections popup -- reachable from the Futures tab's team
      snapshot table. Always shows the projection (not actual), regardless
      of whether the week's already kicked off, since that's what a bettor
      deciding on a future wants to see. */}
      {projModalTeamId && (() => {
        const oppFixture = weekFixtures.find(f => f.homeId === projModalTeamId || f.awayId === projModalTeamId)
        const oppId = oppFixture ? (oppFixture.homeId === projModalTeamId ? oppFixture.awayId : oppFixture.homeId) : null
        const sides = [projModalTeamId, oppId].filter(Boolean).map(id => ({
          id, name: teamLabel(id), lineup: projectedWeekLineup(entriesByTeamId[id] || [], week),
        }))
        return (
          <>
            <div onClick={() => setProjModalTeamId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: d ? '#0f1524' : '#f4f1ec', border: `1px solid ${border}`, width: effectiveMobile ? '92vw' : '640px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: text, margin: 0 }}>
                  Week {week} Projections {oppId ? `— ${teamLabel(projModalTeamId)} vs ${teamLabel(oppId)}` : `— ${teamLabel(projModalTeamId)}`}
                </h3>
                <button onClick={() => setProjModalTeamId(null)} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '18px', padding: 0 }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: effectiveMobile ? 'column' : 'row' }}>
                {sides.map(side => (
                  <div key={side.id} style={{ flex: 1, borderRight: effectiveMobile ? 'none' : `1px solid ${border}` }}>
                    <div style={{ padding: '10px 16px', background: cardBg, borderBottom: `1px solid ${border}`, fontFamily: "'Playfair Display', serif", fontSize: '14px', color: text }}>{side.name}</div>
                    {side.lineup.starters.map((e, i) => (
                      <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 50px', alignItems: 'center', padding: '6px 16px', background: i % 2 === 0 ? 'transparent' : (d ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') }}>
                        <span style={{ fontSize: '9px', fontWeight: '700', color: muted }}>{e.slot}</span>
                        <span style={{ fontSize: '12px', color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.player?.name || '—'}</span>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: text, textAlign: 'right' }}>{e.proj != null ? e.proj.toFixed(1) : '—'}</span>
                      </div>
                    ))}
                    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 50px', padding: '8px 16px', background: d ? 'rgba(255,255,255,0.03)' : 'rgba(13,33,82,0.04)' }}>
                      <span />
                      <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: muted }}>Total</span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: gold, textAlign: 'right' }}>{side.lineup.total.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      })()}

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 160px' : '120px 24px 160px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px,6vw,64px)', fontWeight: '400', letterSpacing: '-0.02em' }}>Sportsbook</h1>
              <button onClick={() => setShowHelpModal(true)} title="How this works" style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'none', border: `1px solid ${border}`, color: muted, cursor: 'pointer', fontSize: '13px', fontFamily: "'Inter', sans-serif", fontWeight: '600', lineHeight: 1 }}>?</button>
            </div>
            {myAccount && <p style={{ fontSize: '13px', color: gold, marginTop: '4px' }}>💰 {myAccount.balance.toLocaleString()} Gimre Bucks</p>}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: muted }}>Playing as <strong style={{ color: text }}>{playerName}</strong></span>
            <button onClick={() => { setPlayerName(''); setNameInput(''); setNameStep('name') }} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>Switch</button>
            {!adminUnlocked
              ? <button onClick={() => setShowPinModal(true)} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '8px 14px', cursor: 'pointer', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>Admin</button>
              : <button onClick={() => setAdminUnlocked(false)} style={{ background: 'none', border: `1px solid ${gold}`, color: gold, padding: '8px 14px', cursor: 'pointer', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>Admin ✓</button>
            }
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[['lines', 'Lines'], ['pickem', "Pick'em"], ['futures', 'Futures'], ['props', 'Props'], ['mybets', 'My Bets'], ['allbets', 'All Bets'], ['leaderboard', 'Leaderboard'], ['activity', 'Activity']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>{label}</button>
          ))}
        </div>

        {/* ── LINES ── */}
        {tab === 'lines' && (
          <>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '4px' }}>Week</span>
              {weeks.map(w => <button key={w} onClick={() => setWeek(w)} style={{ background: week === w ? text : 'none', color: week === w ? bg : muted, border: `1px solid ${border}`, padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontFamily: "'Inter', sans-serif" }}>{w}</button>)}
            </div>

            {adminUnlocked && (
              <div style={{ marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={runGenerateWeekBoard} disabled={generating} style={adminBtn}>{generating ? 'Working…' : `Generate Week ${week} Board`}</button>
                {!showGameForm
                  ? <button onClick={() => setShowGameForm(true)} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '8px 16px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>+ Add Game Manually</button>
                  : null}
              </div>
            )}
            {adminUnlocked && showGameForm && (
              <div style={{ background: cardBg, border: `1px solid ${border}`, padding: '20px', marginBottom: '16px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: gold, marginBottom: '16px' }}>New Game — Week {week}</p>
                <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div><label style={lbl}>Team A (Favorite)</label><input value={gameForm.team_a} onChange={e => setGameForm(f => ({ ...f, team_a: e.target.value }))} placeholder="e.g. Danny" style={{ ...inp, width: '100%' }} /></div>
                  <div><label style={lbl}>Team B</label><input value={gameForm.team_b} onChange={e => setGameForm(f => ({ ...f, team_b: e.target.value }))} placeholder="e.g. Mike" style={{ ...inp, width: '100%' }} /></div>
                  <div><label style={lbl}>Spread (Team A, e.g. -6.5)</label><input value={gameForm.spread} onChange={e => setGameForm(f => ({ ...f, spread: e.target.value }))} placeholder="-6.5" style={{ ...inp, width: '100%' }} /></div>
                  <div><label style={lbl}>Over/Under</label><input value={gameForm.over_under} onChange={e => setGameForm(f => ({ ...f, over_under: e.target.value }))} placeholder="220.5" style={{ ...inp, width: '100%' }} /></div>
                  <div><label style={lbl}>ML Team A</label><input value={gameForm.ml_a} onChange={e => setGameForm(f => ({ ...f, ml_a: e.target.value }))} placeholder="-150" style={{ ...inp, width: '100%' }} /></div>
                  <div><label style={lbl}>ML Team B</label><input value={gameForm.ml_b} onChange={e => setGameForm(f => ({ ...f, ml_b: e.target.value }))} placeholder="+130" style={{ ...inp, width: '100%' }} /></div>
                </div>
                {gameFormError && <p style={{ fontSize: '12px', color: red, marginBottom: '8px' }}>{gameFormError}</p>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleAddGame} disabled={submitting} style={{ background: gold, color: '#000', border: 'none', padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif", fontWeight: '500' }}>Add Game</button>
                  <button onClick={() => { setShowGameForm(false); setGameFormError('') }} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '10px 16px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                </div>
              </div>
            )}

            {loading && <p style={{ color: muted, fontSize: '13px' }}>Loading...</p>}
            {!loading && games.length === 0 && <p style={{ color: muted, fontSize: '13px', padding: '32px 0' }}>No games for Week {week} yet{adminUnlocked ? ' — generate the board above.' : '.'}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {games.map(game => (
                <div key={game.id} style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '17px', color: text }}>{game.team_a} <span style={{ color: muted, fontSize: '13px' }}>vs</span> {game.team_b}</div>
                      {game.is_settled && <div style={{ fontSize: '12px', color: gold, marginTop: '2px' }}>Final: {game.score_a} – {game.score_b}</div>}
                      {game.is_locked && !game.is_settled && <div style={{ fontSize: '10px', color: red, marginTop: '2px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Locked</div>}
                    </div>
                    {adminUnlocked && !game.is_settled && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={async () => { await db.from('sb_games').update({ is_locked: !game.is_locked }).eq('id', game.id); fetchGames() }} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>{game.is_locked ? 'Unlock' : 'Lock'}</button>
                        <button onClick={() => setSettleTarget(game)} style={{ background: 'none', border: `1px solid ${green}`, color: green, padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>Settle</button>
                      </div>
                    )}
                  </div>
                  {!game.is_locked && !game.is_settled && (
                    <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {game.spread != null && <>
                        <button onClick={() => toggleBet({ family: 'game', refId: game.id, betType: 'spread', pick: 'team_a', odds: -110, label: `Spread: ${game.team_a} ${game.spread > 0 ? `+${game.spread}` : game.spread}`, subLabel: `${game.team_a} vs ${game.team_b}` })} style={betBtn(inSlip('game', game.id, 'spread', 'team_a'))}>{game.team_a} {game.spread > 0 ? `+${game.spread}` : game.spread} <span style={{ color: muted, fontSize: '10px' }}>(-110)</span></button>
                        <button onClick={() => toggleBet({ family: 'game', refId: game.id, betType: 'spread', pick: 'team_b', odds: -110, label: `Spread: ${game.team_b} ${game.spread < 0 ? `+${Math.abs(game.spread)}` : `-${game.spread}`}`, subLabel: `${game.team_a} vs ${game.team_b}` })} style={betBtn(inSlip('game', game.id, 'spread', 'team_b'))}>{game.team_b} {game.spread < 0 ? `+${Math.abs(game.spread)}` : `-${game.spread}`} <span style={{ color: muted, fontSize: '10px' }}>(-110)</span></button>
                      </>}
                      {game.over_under != null && <>
                        <button onClick={() => toggleBet({ family: 'game', refId: game.id, betType: 'ou', pick: 'over', odds: -110, label: `O/U: Over ${game.over_under}`, subLabel: `${game.team_a} vs ${game.team_b}` })} style={betBtn(inSlip('game', game.id, 'ou', 'over'))}>Over {game.over_under} <span style={{ color: muted, fontSize: '10px' }}>(-110)</span></button>
                        <button onClick={() => toggleBet({ family: 'game', refId: game.id, betType: 'ou', pick: 'under', odds: -110, label: `O/U: Under ${game.over_under}`, subLabel: `${game.team_a} vs ${game.team_b}` })} style={betBtn(inSlip('game', game.id, 'ou', 'under'))}>Under {game.over_under} <span style={{ color: muted, fontSize: '10px' }}>(-110)</span></button>
                      </>}
                      <button onClick={() => toggleBet({ family: 'game', refId: game.id, betType: 'ml', pick: 'team_a', odds: game.ml_a, label: `ML: ${game.team_a}`, subLabel: `${game.team_a} vs ${game.team_b}` })} style={betBtn(inSlip('game', game.id, 'ml', 'team_a'))}>{game.team_a} ML <span style={{ color: muted, fontSize: '10px' }}>{fmtOdds(game.ml_a)}</span></button>
                      <button onClick={() => toggleBet({ family: 'game', refId: game.id, betType: 'ml', pick: 'team_b', odds: game.ml_b, label: `ML: ${game.team_b}`, subLabel: `${game.team_a} vs ${game.team_b}` })} style={betBtn(inSlip('game', game.id, 'ml', 'team_b'))}>{game.team_b} ML <span style={{ color: muted, fontSize: '10px' }}>{fmtOdds(game.ml_b)}</span></button>
                    </div>
                  )}
                  {game.is_settled && (
                    <div style={{ padding: '10px 16px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {game.spread != null && <span style={{ fontSize: '12px', color: muted }}>Spread: {game.team_a} {game.spread > 0 ? `+${game.spread}` : game.spread}</span>}
                      {game.over_under != null && <span style={{ fontSize: '12px', color: muted }}>O/U: {game.over_under} · Total: {game.score_a + game.score_b}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── PICK'EM ── */}
        {tab === 'pickem' && (
          <>
            <p style={{ fontSize: '13px', color: muted, marginBottom: '20px' }}>Pick the straight-up winner. Correct pick = <strong style={{ color: gold }}>+20 Gimre Bucks</strong>. Free to enter.</p>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '4px' }}>Week</span>
              {weeks.map(w => <button key={w} onClick={() => setWeek(w)} style={{ background: week === w ? text : 'none', color: week === w ? bg : muted, border: `1px solid ${border}`, padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontFamily: "'Inter', sans-serif" }}>{w}</button>)}
            </div>
            {games.length === 0 && <p style={{ color: muted, fontSize: '13px' }}>No Week {week} games on the board yet — generate the board on the Lines tab first.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {games.map(game => {
                const existingPick = myBets.find(b => b.bet_type === 'pickem' && b.game_id === game.id)
                return (
                  <div key={game.id} style={{ background: cardBg, border: `1px solid ${border}`, padding: '16px' }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: text, marginBottom: '10px' }}>
                      {game.team_a} vs {game.team_b}
                      {game.is_settled && <span style={{ fontSize: '12px', color: gold, marginLeft: '12px' }}>Final: {game.score_a}–{game.score_b}</span>}
                    </div>
                    {existingPick ? (
                      <div style={{ fontSize: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ color: muted }}>Picked: <strong style={{ color: text }}>{existingPick.pick === 'team_a' ? game.team_a : game.team_b}</strong></span>
                        {existingPick.status !== 'pending' && <span style={{ fontWeight: '600', color: existingPick.status === 'won' ? green : red }}>{existingPick.status === 'won' ? `+${PICKEM_PRIZE} GB ✓` : 'Lost'}</span>}
                      </div>
                    ) : game.is_locked || game.is_settled ? (
                      <span style={{ fontSize: '12px', color: muted }}>Locked — no pick submitted</span>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setPickemPicks(p => ({ ...p, [game.id]: 'team_a' }))} style={betBtn(pickemPicks[game.id] === 'team_a')}>{game.team_a}</button>
                        <button onClick={() => setPickemPicks(p => ({ ...p, [game.id]: 'team_b' }))} style={betBtn(pickemPicks[game.id] === 'team_b')}>{game.team_b}</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {Object.keys(pickemPicks).some(id => !myBets.some(b => b.bet_type === 'pickem' && b.game_id === id)) && (
              <>
                {flash.msg && <p style={{ fontSize: '12px', color: flash.ok ? green : red, marginBottom: '8px' }}>{flash.msg}</p>}
                <button onClick={submitPickem} disabled={submitting} style={{ background: text, color: bg, border: 'none', padding: '12px 24px', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500', opacity: submitting ? 0.6 : 1 }}>Submit Picks</button>
              </>
            )}
          </>
        )}

        {/* ── FUTURES ── */}
        {tab === 'futures' && (
          <>
            <p style={{ fontSize: '13px', color: muted, marginBottom: '20px' }}>
              Season-long markets — playoffs, byes, rounds, the title, win totals, final seed, and head-to-heads on this week's matchups.
            </p>
            {adminUnlocked && (
              <button onClick={runGenerateFutures} disabled={generating} style={{ ...adminBtn, marginBottom: '20px' }}>{generating ? 'Working…' : 'Generate / Refresh Season Futures'}</button>
            )}

            {/* Team Snapshot lives in the left gutter on desktop (see
            TeamSnapshotPanel near the bet slip) so it doesn't compete with
            the markets below for vertical space; on mobile, where there's no
            gutter to use, it renders inline here instead. */}
            {effectiveMobile && leagueTeams.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Team Snapshot</p>
                <TeamSnapshotList />
              </div>
            )}

            {/* ── Build a Bet: win total / final seed / finishes ahead of are
            priced live from the cached simulation for whatever team(s) and
            line you pick, instead of a fixed pre-generated market. ── */}
            <div style={{ marginBottom: '32px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Build a Bet</p>
              {!teamSim.length && <p style={{ fontSize: '12px', color: muted, marginBottom: '12px' }}>No simulation data yet{adminUnlocked ? ' — generate futures above first.' : '.'}</p>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Win Total */}
                <div style={{ background: cardBg, border: `1px solid ${border}`, padding: '14px 16px' }}>
                  <div style={{ fontSize: '11px', color: muted, marginBottom: '2px' }}>Win Total</div>
                  <div style={{ fontSize: '10px', color: muted, marginBottom: '8px' }}>Regular-season wins only — playoff games don't count.</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={wtTeam} onChange={e => setWtTeam(e.target.value)} style={inp}>
                      <option value="">Team…</option>
                      {leagueTeams.map(t => <option key={t.id} value={t.id}>{teamLabel(t.id)}</option>)}
                    </select>
                    <select value={wtLine} onChange={e => setWtLine(e.target.value)} style={inp}>
                      <option value="">Line…</option>
                      {winTotalLines.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    {wtTeam && wtLine !== '' && (() => {
                      const p = winOverProb(wtTeam, parseFloat(wtLine))
                      if (p == null) return <span style={{ fontSize: '12px', color: muted }}>No sim data for this team yet</span>
                      const [oddsYes, oddsNo] = priceCustomMarket(clampP(p))
                      const name = teamLabel(wtTeam)
                      return (
                        <>
                          <button onClick={() => addCustomFuture({ marketType: 'win_total', teamId: wtTeam, teamName: name, line: parseFloat(wtLine), fairP: p, pick: 'yes', label: `${name} Over ${wtLine} Wins`, subLabel: 'Win Total' })} style={betBtn(false)}>Over <span style={{ color: muted, fontSize: '10px' }}>{fmtOdds(oddsYes)}</span></button>
                          <button onClick={() => addCustomFuture({ marketType: 'win_total', teamId: wtTeam, teamName: name, line: parseFloat(wtLine), fairP: p, pick: 'no', label: `${name} Under ${wtLine} Wins`, subLabel: 'Win Total' })} style={betBtn(false)}>Under <span style={{ color: muted, fontSize: '10px' }}>{fmtOdds(oddsNo)}</span></button>
                        </>
                      )
                    })()}
                  </div>
                </div>

                {/* Final Seed */}
                <div style={{ background: cardBg, border: `1px solid ${border}`, padding: '14px 16px' }}>
                  <div style={{ fontSize: '11px', color: muted, marginBottom: '2px' }}>Final Regular-Season Seed</div>
                  <div style={{ fontSize: '10px', color: muted, marginBottom: '8px' }}>1 seed is the top seed — "Better than 1.5" is a bet they finish as the 1 seed.</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={seedTeam} onChange={e => setSeedTeam(e.target.value)} style={inp}>
                      <option value="">Team…</option>
                      {leagueTeams.map(t => <option key={t.id} value={t.id}>{teamLabel(t.id)}</option>)}
                    </select>
                    <select value={seedLine} onChange={e => setSeedLine(e.target.value)} style={inp}>
                      <option value="">Line…</option>
                      {seedLines.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    {seedTeam && seedLine !== '' && (() => {
                      const pWorse = seedOverProb(seedTeam, parseFloat(seedLine))
                      if (pWorse == null) return <span style={{ fontSize: '12px', color: muted }}>No sim data for this team yet</span>
                      const [oddsWorse, oddsBetter] = priceCustomMarket(clampP(pWorse))
                      const name = teamLabel(seedTeam)
                      return (
                        <>
                          <button onClick={() => addCustomFuture({ marketType: 'seed_total', teamId: seedTeam, teamName: name, line: parseFloat(seedLine), fairP: pWorse, pick: 'yes', label: `${name} Worse than Seed ${seedLine}`, subLabel: 'Final Seed' })} style={betBtn(false)}>Worse <span style={{ color: muted, fontSize: '10px' }}>{fmtOdds(oddsWorse)}</span></button>
                          <button onClick={() => addCustomFuture({ marketType: 'seed_total', teamId: seedTeam, teamName: name, line: parseFloat(seedLine), fairP: 1 - pWorse, pick: 'no', label: `${name} Better than Seed ${seedLine}`, subLabel: 'Final Seed' })} style={betBtn(false)}>Better <span style={{ color: muted, fontSize: '10px' }}>{fmtOdds(oddsBetter)}</span></button>
                        </>
                      )
                    })()}
                  </div>
                </div>

                {/* Finishes Ahead Of */}
                <div style={{ background: cardBg, border: `1px solid ${border}`, padding: '14px 16px' }}>
                  <div style={{ fontSize: '11px', color: muted, marginBottom: '8px' }}>Finishes Ahead Of</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={aheadTeamA} onChange={e => setAheadTeamA(e.target.value)} style={inp}>
                      <option value="">Team A…</option>
                      {leagueTeams.map(t => <option key={t.id} value={t.id}>{teamLabel(t.id)}</option>)}
                    </select>
                    <select value={aheadTeamB} onChange={e => setAheadTeamB(e.target.value)} style={inp}>
                      <option value="">Team B…</option>
                      {leagueTeams.filter(t => t.id !== aheadTeamA).map(t => <option key={t.id} value={t.id}>{teamLabel(t.id)}</option>)}
                    </select>
                    {aheadTeamA && aheadTeamB && aheadTeamA !== aheadTeamB && (() => {
                      const p = aheadProbOf(aheadTeamA, aheadTeamB)
                      if (p == null) return <span style={{ fontSize: '12px', color: muted }}>No sim data yet</span>
                      const [oddsYes, oddsNo] = priceCustomMarket(clampP(p))
                      const nameA = teamLabel(aheadTeamA), nameB = teamLabel(aheadTeamB)
                      return (
                        <>
                          <button onClick={() => addCustomFuture({ marketType: 'h2h_finish', teamId: aheadTeamA, oppTeamId: aheadTeamB, teamName: nameA, oppTeamName: nameB, fairP: p, pick: 'yes', label: `${nameA} finishes ahead of ${nameB}`, subLabel: 'Finishes Ahead Of' })} style={betBtn(false)}>{nameA} <span style={{ color: muted, fontSize: '10px' }}>{fmtOdds(oddsYes)}</span></button>
                          <button onClick={() => addCustomFuture({ marketType: 'h2h_finish', teamId: aheadTeamA, oppTeamId: aheadTeamB, teamName: nameA, oppTeamName: nameB, fairP: 1 - p, pick: 'no', label: `${nameB} finishes ahead of ${nameA}`, subLabel: 'Finishes Ahead Of' })} style={betBtn(false)}>{nameB} <span style={{ color: muted, fontSize: '10px' }}>{fmtOdds(oddsNo)}</span></button>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {futures.length === 0 && <p style={{ color: muted, fontSize: '13px' }}>No futures on the board yet{adminUnlocked ? ' — generate them above.' : '.'}</p>}

            {['playoffs', 'bye', 'semis', 'finals', 'title'].map(mt => {
              const rows = [...futures.filter(f => f.market_type === mt && !f.is_settled)].sort((a, b) => (b.fair_p ?? 0) - (a.fair_p ?? 0))
              if (!rows.length) return null
              const heading = FUTURE_LABELS[mt]
              return (
                <div key={mt} style={{ marginBottom: '28px' }}>
                  <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>{heading}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {rows.map(f => {
                      const pct = f.fair_p != null ? Math.round(f.fair_p * 100) : null
                      const yesKey = `future-${f.id}-yes`, noKey = `future-${f.id}-no`
                      return (
                        <div key={f.id} style={{ background: cardBg, border: `1px solid ${border}`, borderLeft: `3px solid ${pct != null && pct >= 50 ? green : pct != null ? red : border}`, borderRadius: '4px', padding: '14px 16px', boxShadow: d ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: pct != null ? '10px' : 0 }}>
                            <div style={{ fontSize: '15px', color: text, fontFamily: "'Playfair Display', serif" }}>{f.team_name}</div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => toggleBet({ family: 'future', refId: f.id, betType: 'future', pick: 'yes', odds: f.odds_yes, label: futureLabel(f, 'yes'), subLabel: heading, teamId: f.team_id, oppTeamId: f.opp_team_id })}
                                onMouseEnter={() => setHoveredBetKey(yesKey)} onMouseLeave={() => setHoveredBetKey(null)}
                                style={oddsBtn(yesKey, green, inSlip('future', f.id, 'future', 'yes'))}
                              >
                                Yes {fmtOdds(f.odds_yes)}
                              </button>
                              <button
                                onClick={() => toggleBet({ family: 'future', refId: f.id, betType: 'future', pick: 'no', odds: f.odds_no, label: futureLabel(f, 'no'), subLabel: heading, teamId: f.team_id, oppTeamId: f.opp_team_id })}
                                onMouseEnter={() => setHoveredBetKey(noKey)} onMouseLeave={() => setHoveredBetKey(null)}
                                style={oddsBtn(noKey, red, inSlip('future', f.id, 'future', 'no'))}
                              >
                                No {fmtOdds(f.odds_no)}
                              </button>
                              {adminUnlocked && (
                                <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
                                  <button onClick={() => settleFuture(f, 'yes')} disabled={generating} style={{ background: 'none', border: `1px solid ${green}`, color: green, padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>Settle Yes</button>
                                  <button onClick={() => settleFuture(f, 'no')} disabled={generating} style={{ background: 'none', border: `1px solid ${red}`, color: red, padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>Settle No</button>
                                </div>
                              )}
                            </div>
                          </div>
                          {pct != null && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: d ? '#1a1a1a' : '#e0dbd0', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: green, transition: 'width 0.3s ease' }} />
                              </div>
                              <span style={{ fontSize: '10px', color: muted, minWidth: '30px', textAlign: 'right' }}>{pct}%</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Custom win-total/seed/head-to-head picks a bettor has already
            added -- these only resolve at season's end, so admin settles
            them here rather than from a pre-generated list. */}
            {adminUnlocked && futures.some(f => !f.is_settled && !FUTURE_LABELS[f.market_type]) && (
              <div style={{ marginBottom: '28px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Custom Picks Awaiting Settlement</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {futures.filter(f => !f.is_settled && !FUTURE_LABELS[f.market_type]).map(f => (
                    <div key={f.id} style={{ background: cardBg, border: `1px solid ${border}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ fontSize: '13px', color: text }}>
                        {futureLabel(f, 'yes')}
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => settleFuture(f, 'yes')} disabled={generating} style={{ background: 'none', border: `1px solid ${green}`, color: green, padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>Settle Yes</button>
                        <button onClick={() => settleFuture(f, 'no')} disabled={generating} style={{ background: 'none', border: `1px solid ${red}`, color: red, padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>Settle No</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {futures.some(f => f.is_settled) && (
              <div style={{ marginTop: '32px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Settled</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {futures.filter(f => f.is_settled).map(f => (
                    <div key={f.id} style={{ fontSize: '12px', color: muted, padding: '8px 0', borderBottom: `1px solid ${border}` }}>
                      {f.team_name}{f.opp_team_name ? ` vs ${f.opp_team_name}` : ''} — <span style={{ color: f.result === 'yes' ? green : red }}>{f.result === 'yes' ? 'Yes' : 'No'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── PROPS ── */}
        {tab === 'props' && (
          <>
            <p style={{ fontSize: '13px', color: muted, marginBottom: '20px' }}>
              Over/under a player's own weekly fantasy-point projection, straight from ESPN — no simulation, so these fill in
              automatically from the daily sync as soon as that week's projections are in.
            </p>
            {adminUnlocked && (
              <div style={{ marginBottom: '12px' }}>
                <button onClick={runGenerateProps} disabled={generating} style={adminBtn}>{generating ? 'Working…' : `Generate Week ${week} Props Now`}</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '4px' }}>Week</span>
              {weeks.map(w => <button key={w} onClick={() => setWeek(w)} style={{ background: week === w ? text : 'none', color: week === w ? bg : muted, border: `1px solid ${border}`, padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontFamily: "'Inter', sans-serif" }}>{w}</button>)}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={propMatchupFilter} onChange={e => setPropMatchupFilter(e.target.value)} style={inp}>
                <option value="all">All matchups</option>
                {weekFixtures.map(f => (
                  <option key={f.key} value={f.key}>{teamNameById[f.homeId] || '?'} vs {teamNameById[f.awayId] || '?'}</option>
                ))}
              </select>
              <select value={propPositionFilter} onChange={e => setPropPositionFilter(e.target.value)} style={inp}>
                <option value="all">All positions</option>
                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
              {adminUnlocked && (
                <button onClick={autoSettleProps} disabled={generating} style={{ ...adminBtn, borderColor: green, color: green }}>{generating ? 'Working…' : `Auto-Settle Week ${week} Props`}</button>
              )}
              {adminUnlocked && props.some(p => p.is_settled) && !confirmResetProps && (
                <button onClick={() => setConfirmResetProps(true)} disabled={generating} style={{ ...adminBtn, borderColor: red, color: red }}>Reset Settled Week {week} Props</button>
              )}
              {adminUnlocked && confirmResetProps && (
                <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: red }}>Undo settlement and reverse balance changes for Week {week}'s settled props?</span>
                  <button onClick={resetSettledProps} disabled={generating} style={{ ...adminBtn, borderColor: red, color: red }}>{generating ? 'Working…' : 'Confirm Reset'}</button>
                  <button onClick={() => setConfirmResetProps(false)} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '8px 16px', cursor: 'pointer', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                </span>
              )}
            </div>
            {props.length === 0 && <p style={{ color: muted, fontSize: '13px' }}>No props for Week {week} yet — these fill in from the daily sync once that week's ESPN projections are available.</p>}

            {(() => {
              const matchupTeamIds = propMatchupFilter === 'all'
                ? null
                : new Set([weekFixtures.find(f => f.key === propMatchupFilter)?.homeId, weekFixtures.find(f => f.key === propMatchupFilter)?.awayId])
              const visible = props
                .filter(p => !p.is_settled)
                .filter(p => propPositionFilter === 'all' || p.position === propPositionFilter)
                .filter(p => !matchupTeamIds || matchupTeamIds.has(p.team_id))
                .sort((a, b) => b.line - a.line)
              if (props.filter(p => !p.is_settled).length > 0 && visible.length === 0) {
                return <p style={{ color: muted, fontSize: '13px' }}>No props match this filter.</p>
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {visible.map(p => {
                    const s = playerSeasonStats[p.player_id]
                    const opp = s?.nflTeam ? nflOppByAbbr[s.nflTeam] : null
                    const fmt1 = v => (v == null ? '—' : v.toFixed(1))
                    return (
                    <div key={p.id} style={{ background: cardBg, border: `1px solid ${border}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ fontSize: '13px', color: text }}>{p.player_name} <span style={{ color: muted, fontSize: '11px' }}>{p.position}{p.team_name ? ` · ${p.team_name}` : ''}</span></div>
                        <div style={{ fontSize: '11px', color: muted }}>Line: {p.line} pts</div>
                        <div style={{ fontSize: '11px', color: muted, marginTop: '4px' }}>
                          Avg {fmt1(s?.avgPts)} · Last Wk {fmt1(s?.lastWeekPts)} · L3 {fmt1(s?.l3Avg)}
                          {s?.posRank ? ` · ${p.position}${s.posRank}` : ''}
                          {opp ? ` · ${s.nflTeam} ${opp.homeAway} ${opp.opp}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => toggleBet({ family: 'prop', refId: p.id, betType: 'prop', pick: 'over', odds: p.odds_over, label: `${p.player_name} Over ${p.line}`, subLabel: `Week ${p.week} prop` })} style={betBtn(inSlip('prop', p.id, 'prop', 'over'))}>Over <span style={{ color: muted, fontSize: '10px' }}>{fmtOdds(p.odds_over)}</span></button>
                        <button onClick={() => toggleBet({ family: 'prop', refId: p.id, betType: 'prop', pick: 'under', odds: p.odds_under, label: `${p.player_name} Under ${p.line}`, subLabel: `Week ${p.week} prop` })} style={betBtn(inSlip('prop', p.id, 'prop', 'under'))}>Under <span style={{ color: muted, fontSize: '10px' }}>{fmtOdds(p.odds_under)}</span></button>
                      </div>
                    </div>
                    )
                  })}
                </div>
              )
            })()}

            {props.some(p => p.is_settled) && (
              <div style={{ marginTop: '32px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Settled</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {props.filter(p => p.is_settled).map(p => (
                    <div key={p.id} style={{ fontSize: '12px', color: muted, padding: '8px 0', borderBottom: `1px solid ${border}` }}>
                      {p.player_name} — line {p.line}, actual {p.actual_points} · <span style={{ color: p.result === 'over' ? green : p.result === 'under' ? red : muted }}>{p.result}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── MY BETS ── */}
        {tab === 'mybets' && (
          <>
            {!playerName && <p style={{ color: muted, fontSize: '13px' }}>Enter your name above to see your bets.</p>}
            {playerName && myBets.length === 0 && myParlays.length === 0 && <p style={{ color: muted, fontSize: '13px' }}>No bets yet.</p>}

            {myBets.filter(b => !b.parlay_id && b.bet_type !== 'pickem').length > 0 && (
              <>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Singles</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                  {myBets.filter(b => !b.parlay_id && b.bet_type !== 'pickem').map(bet => {
                    let desc = '—', sub = ''
                    if (bet.bet_type === 'future' && bet.future) {
                      desc = futureLabel({ ...bet.future }, bet.pick)
                      sub = FUTURE_LABELS[bet.future.market_type] || bet.future.market_type
                    } else if (bet.bet_type === 'prop' && bet.prop) {
                      desc = `${bet.prop.player_name} ${bet.pick === 'over' ? 'Over' : 'Under'} ${bet.prop.line}`
                      sub = `Week ${bet.prop.week} prop`
                    } else if (bet.game) {
                      desc = `${bet.bet_type === 'spread' ? 'Spread' : bet.bet_type === 'ou' ? 'O/U' : 'ML'}: ${bet.pick === 'team_a' ? bet.game.team_a : bet.pick === 'team_b' ? bet.game.team_b : bet.pick === 'over' ? 'Over' : 'Under'} ${fmtOdds(bet.odds)}`
                      sub = `${bet.game.team_a} vs ${bet.game.team_b} · Wk ${bet.game.week}`
                    }
                    return (
                      <div key={bet.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', alignItems: 'center', padding: '12px 16px', background: cardBg, border: `1px solid ${border}` }}>
                        <div>
                          <div style={{ fontSize: '13px', color: text }}>{desc}</div>
                          <div style={{ fontSize: '11px', color: muted }}>{sub}</div>
                        </div>
                        <span style={{ fontSize: '12px', color: muted }}>{bet.amount} GB</span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: bet.status === 'won' ? green : bet.status === 'lost' ? red : bet.status === 'push' ? muted : gold }}>
                          {bet.status === 'won' ? `+${bet.win_amount} GB` : bet.status === 'lost' ? 'Lost' : bet.status === 'push' ? 'Push' : 'Pending'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {myParlays.length > 0 && (
              <>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Parlays</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {myParlays.map(p => (
                    <div key={p.id} style={{ background: cardBg, border: `1px solid ${border}`, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: text }}>{p.legs.length}-Leg Parlay · {fmtOdds(p.combined_odds)} · {p.amount} GB</span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: p.status === 'won' ? green : p.status === 'lost' ? red : gold }}>
                          {p.status === 'won' ? `+${p.win_amount} GB` : p.status === 'lost' ? 'Lost' : 'Pending'}
                        </span>
                      </div>
                      {p.legs.map((leg, i) => {
                        let legDesc = '—'
                        if (leg.bet_type === 'future' && leg.future) legDesc = futureLabel({ ...leg.future }, leg.pick)
                        else if (leg.bet_type === 'prop' && leg.prop) legDesc = `${leg.prop.player_name} ${leg.pick === 'over' ? 'Over' : 'Under'} ${leg.prop.line}`
                        else if (leg.game) legDesc = gameLegDesc(leg)
                        return (
                          <div key={i} style={{ fontSize: '11px', color: muted, paddingLeft: '8px', marginBottom: '2px' }}>
                            {legDesc}
                            {' '}<span style={{ color: leg.status === 'won' ? green : leg.status === 'lost' ? red : muted }}>({leg.status})</span>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}

            {myBets.filter(b => b.bet_type === 'pickem').length > 0 && (
              <>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Pick'em</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {myBets.filter(b => b.bet_type === 'pickem').map(bet => (
                    <div key={bet.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center', padding: '12px 16px', background: cardBg, border: `1px solid ${border}` }}>
                      <div>
                        <div style={{ fontSize: '13px', color: text }}>Picked: {bet.pick === 'team_a' ? bet.game?.team_a : bet.game?.team_b}</div>
                        <div style={{ fontSize: '11px', color: muted }}>{bet.game?.team_a} vs {bet.game?.team_b} · Wk {bet.game?.week}</div>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: bet.status === 'won' ? green : bet.status === 'lost' ? red : gold }}>
                        {bet.status === 'won' ? `+${PICKEM_PRIZE} GB` : bet.status === 'lost' ? 'Lost' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── ALL BETS (every account, read-only activity feed) ── */}
        {tab === 'allbets' && (
          <>
            <p style={{ fontSize: '12px', color: muted, marginBottom: '20px' }}>Every bet placed across all accounts, with odds, wager, and potential winnings.</p>
            {allBets.length === 0 && allParlays.length === 0 && <p style={{ color: muted, fontSize: '13px' }}>No bets yet.</p>}

            {allBets.filter(b => !b.parlay_id && b.bet_type !== 'pickem').length > 0 && (
              <>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Singles</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,max-content) 1fr auto auto auto auto', gap: '12px', padding: '0 16px 4px' }}>
                    {['Bettor', 'Bet', 'Odds', 'Wager', 'To Win', 'Status'].map(h => (
                      <span key={h} style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: muted }}>{h}</span>
                    ))}
                  </div>
                  {allBets.filter(b => !b.parlay_id && b.bet_type !== 'pickem').map(bet => {
                    let desc = '—', sub = ''
                    if (bet.bet_type === 'future' && bet.future) {
                      desc = futureLabel({ ...bet.future }, bet.pick)
                      sub = FUTURE_LABELS[bet.future.market_type] || bet.future.market_type
                    } else if (bet.bet_type === 'prop' && bet.prop) {
                      desc = `${bet.prop.player_name} ${bet.pick === 'over' ? 'Over' : 'Under'} ${bet.prop.line}`
                      sub = `Week ${bet.prop.week} prop`
                    } else if (bet.game) {
                      desc = `${bet.bet_type === 'spread' ? 'Spread' : bet.bet_type === 'ou' ? 'O/U' : 'ML'}: ${bet.pick === 'team_a' ? bet.game.team_a : bet.pick === 'team_b' ? bet.game.team_b : bet.pick === 'over' ? 'Over' : 'Under'}`
                      sub = `${bet.game.team_a} vs ${bet.game.team_b} · Wk ${bet.game.week}`
                    }
                    const toWin = bet.status === 'won' ? bet.win_amount : calcWin(bet.amount, bet.odds)
                    return (
                      <div key={bet.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,max-content) 1fr auto auto auto auto', gap: '12px', alignItems: 'center', padding: '12px 16px', background: cardBg, border: `1px solid ${border}` }}>
                        <span style={{ fontSize: '12px', color: text, fontWeight: '600' }}>{bet.account?.manager_name || '—'}</span>
                        <div>
                          <div style={{ fontSize: '13px', color: text }}>{desc}</div>
                          <div style={{ fontSize: '11px', color: muted }}>{sub}</div>
                        </div>
                        <span style={{ fontSize: '12px', color: muted }}>{fmtOdds(bet.odds)}</span>
                        <span style={{ fontSize: '12px', color: muted }}>{bet.amount} GB</span>
                        <span style={{ fontSize: '12px', color: muted }}>{toWin} GB</span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: bet.status === 'won' ? green : bet.status === 'lost' ? red : bet.status === 'push' ? muted : gold }}>
                          {bet.status === 'won' ? 'Won' : bet.status === 'lost' ? 'Lost' : bet.status === 'push' ? 'Push' : 'Pending'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {allParlays.length > 0 && (
              <>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Parlays</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {allParlays.map(p => {
                    const legs = allBets.filter(b => b.parlay_id === p.id)
                    const toWin = p.status === 'won' ? p.win_amount : calcWin(p.amount, p.combined_odds)
                    return (
                      <div key={p.id} style={{ background: cardBg, border: `1px solid ${border}`, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: text, fontWeight: '600' }}>{p.account?.manager_name || '—'}</span>
                          <span style={{ fontSize: '12px', color: muted }}>{legs.length || p.legs}-Leg Parlay · {fmtOdds(p.combined_odds)} · Wager {p.amount} GB · To win {toWin} GB</span>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: p.status === 'won' ? green : p.status === 'lost' ? red : gold }}>
                            {p.status === 'won' ? `+${p.win_amount} GB` : p.status === 'lost' ? 'Lost' : 'Pending'}
                          </span>
                        </div>
                        {legs.map((leg, i) => {
                          let legDesc = '—'
                          if (leg.bet_type === 'future' && leg.future) legDesc = futureLabel({ ...leg.future }, leg.pick)
                          else if (leg.bet_type === 'prop' && leg.prop) legDesc = `${leg.prop.player_name} ${leg.pick === 'over' ? 'Over' : 'Under'} ${leg.prop.line}`
                          else if (leg.game) legDesc = gameLegDesc(leg)
                          return (
                            <div key={i} style={{ fontSize: '11px', color: muted, paddingLeft: '8px', marginBottom: '2px' }}>
                              {legDesc}
                              {' '}<span style={{ color: leg.status === 'won' ? green : leg.status === 'lost' ? red : muted }}>({leg.status})</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {allBets.filter(b => b.bet_type === 'pickem').length > 0 && (
              <>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Pick'em</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {allBets.filter(b => b.bet_type === 'pickem').map(bet => (
                    <div key={bet.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,max-content) 1fr auto', gap: '12px', alignItems: 'center', padding: '12px 16px', background: cardBg, border: `1px solid ${border}` }}>
                      <span style={{ fontSize: '12px', color: text, fontWeight: '600' }}>{bet.account?.manager_name || '—'}</span>
                      <div>
                        <div style={{ fontSize: '13px', color: text }}>Picked: {bet.pick === 'team_a' ? bet.game?.team_a : bet.game?.team_b}</div>
                        <div style={{ fontSize: '11px', color: muted }}>{bet.game?.team_a} vs {bet.game?.team_b} · Wk {bet.game?.week}</div>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: bet.status === 'won' ? green : bet.status === 'lost' ? red : gold }}>
                        {bet.status === 'won' ? `+${PICKEM_PRIZE} GB` : bet.status === 'lost' ? 'Lost' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── LEADERBOARD ── */}
        {tab === 'leaderboard' && (
          <>
            <p style={{ fontSize: '12px', color: muted, marginBottom: '20px' }}>Year-end Gimre Bucks total determines next season's draft order. Highest GB = first pick.</p>
            {accounts.length === 0 && <p style={{ color: muted, fontSize: '13px' }}>No accounts yet. Place a bet or make a pick to start.</p>}
            <div style={{ border: `1px solid ${border}` }}>
              {accounts.map((acc, i) => (
                <div key={acc.id} style={{ borderBottom: i < accounts.length - 1 ? `1px solid ${border}` : 'none', background: acc.manager_name === playerName ? (d ? 'rgba(255,255,255,0.04)' : 'rgba(13,33,82,0.04)') : 'transparent' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: adminUnlocked ? '56px 1fr auto auto' : '56px 1fr auto', alignItems: 'center', padding: '14px 16px', gap: '10px' }}>
                    <span style={{ fontSize: i < 3 ? '18px' : '13px', fontWeight: '700', color: i === 0 ? gold : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : muted }}>
                      {i + 1}{['st','nd','rd'][i] ?? 'th'}
                    </span>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: text }}>{acc.manager_name}</span>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: gold }}>{acc.balance.toLocaleString()} GB</span>
                    {adminUnlocked && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setBalanceAdjustAccountId(id => id === acc.id ? '' : acc.id); setDeleteAccountId('') }} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>±GB</button>
                        <button onClick={() => { setDeleteAccountId(id => id === acc.id ? '' : acc.id); setBalanceAdjustAccountId('') }} style={{ background: 'none', border: `1px solid ${red}`, color: red, padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>Delete</button>
                      </div>
                    )}
                  </div>
                  {balanceAdjustAccountId === acc.id && (
                    <div style={{ padding: '0 16px 14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input type="number" value={balanceAdjustAmount} onChange={e => setBalanceAdjustAmount(e.target.value)} placeholder="+/- amount" style={{ ...inp, width: '140px' }} />
                      <button onClick={() => adjustBalance(acc)} style={{ background: gold, color: '#000', border: 'none', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontFamily: "'Inter', sans-serif", fontWeight: '600' }}>Apply</button>
                      <span style={{ fontSize: '11px', color: muted }}>e.g. -100 or 250</span>
                    </div>
                  )}
                  {deleteAccountId === acc.id && (
                    <div style={{ padding: '0 16px 14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: red }}>Delete {acc.manager_name}'s account and all bet history? This can't be undone.</span>
                      <button onClick={() => deleteAccountAction(acc)} style={{ background: red, color: '#fff', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontFamily: "'Inter', sans-serif", fontWeight: '600' }}>Confirm Delete</button>
                      <button onClick={() => setDeleteAccountId('')} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── ACTIVITY ── */}
        {tab === 'activity' && (
          <>
            <p style={{ fontSize: '12px', color: muted, marginBottom: '20px' }}>Everything that's happened in the sportsbook — accounts created, bets and parlays placed, picks submitted, and admin actions.</p>

            {adminUnlocked && pendingPinResets.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Pending PIN Resets</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pendingPinResets.map(r => (
                    <div key={r.id} style={{ background: cardBg, border: `1px solid ${border}`, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: text }}>{r.account?.manager_name || '—'} wants a new PIN</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => resolvePinReset(r, true)} style={{ background: 'none', border: `1px solid ${green}`, color: green, padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>Approve</button>
                        <button onClick={() => resolvePinReset(r, false)} style={{ background: 'none', border: `1px solid ${red}`, color: red, padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>Deny</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {adminUnlocked && (
              <div style={{ marginBottom: '28px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Pending Bets — Override</p>
                {allPendingBets.length === 0 ? (
                  <p style={{ fontSize: '12px', color: muted }}>No pending bets.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {allPendingBets.map(bet => {
                      let desc = '—'
                      if (bet.bet_type === 'future' && bet.future) desc = futureLabel(bet.future, bet.pick)
                      else if (bet.bet_type === 'prop' && bet.prop) desc = `${bet.prop.player_name} ${bet.pick === 'over' ? 'Over' : 'Under'} ${bet.prop.line} (Wk ${bet.prop.week})`
                      else if (bet.game) desc = `${bet.bet_type === 'spread' ? 'Spread' : bet.bet_type === 'ou' ? 'O/U' : bet.bet_type === 'pickem' ? "Pick'em" : 'ML'}: ${bet.pick === 'team_a' ? bet.game.team_a : bet.pick === 'team_b' ? bet.game.team_b : bet.pick} (Wk ${bet.game.week})`
                      return (
                        <div key={bet.id} style={{ background: cardBg, border: `1px solid ${border}`, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <div style={{ fontSize: '12px', color: text }}>{bet.account?.manager_name || '—'} · {desc}</div>
                            <div style={{ fontSize: '11px', color: muted }}>{bet.amount} GB · {fmtOdds(bet.odds)}{bet.parlay_id ? ' · parlay leg' : ''}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => overrideBet(bet, 'won')} style={{ background: 'none', border: `1px solid ${green}`, color: green, padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>Won</button>
                            <button onClick={() => overrideBet(bet, 'lost')} style={{ background: 'none', border: `1px solid ${red}`, color: red, padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>Lost</button>
                            <button onClick={() => overrideBet(bet, 'push')} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>Push</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>Feed</p>
            {activityLog.length === 0 ? (
              <p style={{ fontSize: '13px', color: muted }}>No activity yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: border }}>
                {activityLog.map(a => (
                  <div key={a.id} style={{ background: cardBg, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', color: text }}>{a.description}</span>
                    <span style={{ fontSize: '11px', color: muted, whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
