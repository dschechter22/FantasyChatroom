'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'
import { LEAGUE_ID } from '../../lib/supabase'
import {
  isPlayed, buildRatings, makeLine, simulateFutures, leagueBaseline,
  projectedStarterPoints, projectedWeekScore, projectedWeekLineup, priceTwoWay,
} from '../../lib/predictions'
import { REG_SEASON_WEEKS, buildFixtures } from '../../lib/schedule'
export const dynamic = 'force-dynamic'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const ADMIN_PIN = '2910'
const SEASON = '2026-27'
const SIMS = 8000

const toDecimal = o => o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o)
const toAmerican = d => d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1))
const calcWin = (amt, odds) => odds > 0 ? Math.floor(amt * odds / 100) : Math.floor(amt * 100 / Math.abs(odds))
const fmtOdds = o => o > 0 ? `+${o}` : `${o}`

const FUTURE_LABELS = {
  playoffs: 'Make the Playoffs', bye: 'Get a Bye', semis: 'Make the Semifinals',
  finals: 'Make the Finals', title: 'Win the Title',
}

export default function SportsbookPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, green, red, gold } = useLayout()

  const [tab, setTab] = useState('lines')
  const [week, setWeek] = useState(1)
  const [games, setGames] = useState([])
  const [futures, setFutures] = useState([])
  const [props, setProps] = useState([])
  const [accounts, setAccounts] = useState([])
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

  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
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

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    db.from('sb_games').select('week').eq('season', SEASON).order('week', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.length) setWeek(data[0].week) })
  }, [])
  useEffect(() => { if (mounted) { fetchGames(); fetchFutures(); fetchProps(); fetchAccounts() } }, [mounted, week])

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
        const { data } = await db.from('roster_entries')
          .select('team_id, player_id, stats, player:player_id(id, name, position)')
          .in('team_id', t.map(x => x.id))
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

  const fetchProps = async () => {
    const { data } = await db.from('sb_props').select('*').eq('season', SEASON).eq('week', week).order('created_at')
    setProps(data || [])
  }

  const fetchAccounts = async () => {
    const { data } = await db.from('gb_accounts').select('*').eq('season', SEASON).order('balance', { ascending: false })
    setAccounts(data || [])
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

  const myAccount = accounts.find(a => a.manager_name === playerName)

  const handleNameNext = () => {
    const name = nameInput.trim()
    if (!name) return
    const existing = accounts.find(a => a.manager_name === name)
    setPendingName(name)
    setIsNewAccount(!existing)
    setPinInput(''); setPinError('')
    setNameStep('pin')
  }

  const handlePinSubmit = async () => {
    if (!pinInput || pinInput.length < 4) return setPinError('PIN must be 4+ digits')
    if (isNewAccount) {
      const { data, error } = await db.from('gb_accounts').insert({ manager_name: pendingName, season: SEASON, balance: 1000, pin: pinInput }).select().single()
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
    } else {
      const { data } = await db.from('gb_accounts').select('*').eq('manager_name', pendingName).eq('season', SEASON).single()
      if (!data || data.pin !== pinInput) return setPinError('Incorrect PIN')
      setPlayerName(pendingName)
      setNameStep('name'); setNameInput(''); setPinInput('')
      fetchMyBets(data.id)
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Model: the same rating/projection engine Predictions and Preweek run,
  // fetched independently above so the sportsbook can generate its own
  // board and futures without a trip through another page first. Baseline
  // uses the fallback league-average scale (no prior-season query here) --
  // it converges to real results within a few weeks either way.
  // ────────────────────────────────────────────────────────────────────────
  const entriesByTeam = useMemo(() => {
    const byTeam = {}
    rosterEntries.forEach(e => { (byTeam[e.team_id] ||= []).push(e) })
    return byTeam
  }, [rosterEntries])

  const rosterProj = useMemo(
    () => Object.fromEntries(Object.entries(entriesByTeam).map(([k, v]) => [k, projectedStarterPoints(v)])),
    [entriesByTeam],
  )
  const weeklyProj = useMemo(
    () => Object.fromEntries(Object.entries(entriesByTeam).map(([k, v]) => [k, projectedWeekScore(v, week)])),
    [entriesByTeam, week],
  )
  const baseline = useMemo(() => leagueBaseline([]), [])

  const ratings = useMemo(
    () => (leagueTeams.length ? buildRatings({ teams: leagueTeams, matchups: leagueMatchups, throughWeek: week - 1, rosterProj, weeklyProj, baseline }) : null),
    [leagueTeams, leagueMatchups, week, rosterProj, weeklyProj, baseline],
  )

  const fixtures = useMemo(
    () => buildFixtures({ matchups: leagueMatchups, teams: leagueTeams, useFixed: true }),
    [leagueMatchups, leagueTeams],
  )

  const regWeeksCount = useMemo(() => {
    const maxWeekWithRows = leagueMatchups.length ? Math.max(...leagueMatchups.map(m => m.week)) : 0
    return Math.max(maxWeekWithRows, REG_SEASON_WEEKS)
  }, [leagueMatchups])

  // ── admin: generate the week's game board from the model ──
  const generateWeekBoard = async () => {
    if (!ratings) return showFlash('No model data yet -- check back once teams/matchups are on file', false)
    setGenerating(true)
    const weekFixtures = fixtures.filter(f => f.week === week)
    const toInsert = []
    for (const f of weekFixtures) {
      const a = ratings.byId[f.homeId], b = ratings.byId[f.awayId]
      if (!a || !b) continue
      const already = games.some(g => (g.team_a === a.name && g.team_b === b.name) || (g.team_a === b.name && g.team_b === a.name))
      if (already) continue
      const line = makeLine(a, b)
      toInsert.push({ season: SEASON, week, team_a: a.name, team_b: b.name, spread: line.spread, over_under: line.total, ml_a: line.mlA, ml_b: line.mlB })
    }
    if (!toInsert.length) {
      showFlash('No new games to add -- board already generated, or no matchups this week', false)
      setGenerating(false)
      return
    }
    const { error } = await db.from('sb_games').insert(toInsert)
    showFlash(error ? 'Failed to generate board' : `Added ${toInsert.length} game(s) to the board`, !error)
    fetchGames()
    setGenerating(false)
  }

  // ── admin: generate/refresh season futures. Existing OPEN markets are
  // updated in place (same row id) rather than deleted+recreated, so a bet
  // already placed against one keeps working -- its own captured odds don't
  // change even if the line moves for the next person ──
  const generateFutures = async () => {
    if (!ratings) return showFlash('No model data yet', false)
    setGenerating(true)
    const rest = fixtures.filter(f => f.week >= week && f.week <= regWeeksCount)
    const covered = new Set(rest.map(f => f.week))
    let randomWeeks = 0
    for (let w = week; w <= regWeeksCount; w++) if (!covered.has(w)) randomWeeks++
    const sim = simulateFutures({
      rows: ratings.rows,
      schedule: rest.map(f => ({ homeId: f.homeId, awayId: f.awayId })),
      randomWeeks, sims: SIMS,
    })

    const rows = []
    for (const r of sim) {
      const meta = ratings.byId[r.id]
      if (!meta) continue
      ;['playoffs', 'bye', 'semis', 'finals', 'title'].forEach(key => {
        const mkt = r.markets[key]
        rows.push({ season: SEASON, market_type: key, team_id: r.id, opp_team_id: null, team_name: meta.name, opp_team_name: null, line: null, odds_yes: mkt.oddsYes, odds_no: mkt.oddsNo })
      })
      rows.push({ season: SEASON, market_type: 'win_total', team_id: r.id, opp_team_id: null, team_name: meta.name, opp_team_name: null, line: r.winTotal, odds_yes: r.oddsOver, odds_no: r.oddsUnder })

      // Seed O/U: pick the half-integer line closest to the sim's own 50/50 split.
      let cum = 0, seedLine = r.seedProbs.length + 0.5
      for (const { seed, p } of r.seedProbs) { cum += p; if (cum >= 0.5) { seedLine = seed + 0.5; break } }
      const pUnder = r.seedProbs.filter(s => s.seed < seedLine).reduce((s, x) => s + x.p, 0)
      const [oddsUnder, oddsOver] = priceTwoWay(pUnder)
      rows.push({ season: SEASON, market_type: 'seed_total', team_id: r.id, opp_team_id: null, team_name: meta.name, opp_team_name: null, line: seedLine, odds_yes: oddsOver, odds_no: oddsUnder })
    }

    // "Finishes ahead of" -- one per this week's real matchup, so the market
    // list stays tied to something relevant rather than every possible pair.
    fixtures.filter(f => f.week === week).forEach(f => {
      const a = ratings.byId[f.homeId], b = ratings.byId[f.awayId]
      if (!a || !b) return
      const p = sim.aheadProb(f.homeId, f.awayId)
      if (p == null) return
      const [oddsYes, oddsNo] = priceTwoWay(p)
      rows.push({ season: SEASON, market_type: 'h2h_finish', team_id: f.homeId, opp_team_id: f.awayId, team_name: a.name, opp_team_name: b.name, line: null, odds_yes: oddsYes, odds_no: oddsNo })
    })

    const { data: existingOpen } = await db.from('sb_futures').select('*').eq('season', SEASON).eq('is_settled', false)
    const existingMap = new Map((existingOpen || []).map(f => [`${f.market_type}|${f.team_id}|${f.opp_team_id || ''}`, f]))
    const toInsert = [], toUpdate = []
    for (const r of rows) {
      const key = `${r.market_type}|${r.team_id}|${r.opp_team_id || ''}`
      const existing = existingMap.get(key)
      if (existing) toUpdate.push({ id: existing.id, line: r.line, odds_yes: r.odds_yes, odds_no: r.odds_no })
      else toInsert.push(r)
    }
    if (toInsert.length) await db.from('sb_futures').insert(toInsert)
    for (const u of toUpdate) await db.from('sb_futures').update({ line: u.line, odds_yes: u.odds_yes, odds_no: u.odds_no }).eq('id', u.id)

    showFlash(`Futures updated — ${toInsert.length} new, ${toUpdate.length} refreshed`)
    fetchFutures()
    setGenerating(false)
  }

  // ── admin: generate weekly player props off each team's optimal-lineup
  // starters (same selection Preweek/Predictions use), line = ESPN's own
  // weekly projection for that player ──
  const generateProps = async () => {
    if (!Object.keys(entriesByTeam).length) return showFlash('No roster data yet', false)
    setGenerating(true)
    const rows = []
    Object.entries(entriesByTeam).forEach(([teamId, entries]) => {
      const teamMeta = leagueTeams.find(t => t.id === teamId)
      const lineup = projectedWeekLineup(entries, week)
      lineup.starters.forEach(e => {
        if (e.proj == null) return
        rows.push({
          season: SEASON, week, player_id: e.player_id, player_name: e.player?.name || 'Unknown',
          position: e.player?.position || null, team_name: teamMeta?.manager?.name || teamMeta?.team_name || null,
          line: parseFloat(e.proj.toFixed(1)), odds_over: -110, odds_under: -110,
        })
      })
    })
    if (!rows.length) { showFlash('No player projections on file for this week yet', false); setGenerating(false); return }

    const { data: existingOpen } = await db.from('sb_props').select('id, player_id').eq('season', SEASON).eq('week', week).eq('is_settled', false)
    const existingIds = new Set((existingOpen || []).map(p => p.player_id))
    const toInsert = rows.filter(r => !existingIds.has(r.player_id))
    if (!toInsert.length) { showFlash('Props already generated for this week', false); setGenerating(false); return }
    const { error } = await db.from('sb_props').insert(toInsert)
    showFlash(error ? 'Failed to generate props' : `Added ${toInsert.length} player prop(s)`, !error)
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

  // ── bet slip: generalized across games, futures and props so any
  // combination of them can ride together in one parlay ──
  const inSlip = (family, refId, betType, pick) => slip.some(s => s.family === family && s.refId === refId && s.betType === betType && s.pick === pick)
  const toggleBet = ({ family, refId, betType, pick, odds, label, subLabel }) => {
    const key = `${family}-${refId}-${betType}-${pick}`
    if (slip.find(s => s.key === key)) {
      const idx = slip.findIndex(s => s.key === key)
      setSlip(sl => sl.filter(s => s.key !== key))
      setSlipAmounts(a => { const n = { ...a }; delete n[idx]; return n })
    } else {
      setSlip(sl => [...sl, { key, family, refId, betType, pick, odds, label, gameName: subLabel }])
      setSlipOpen(true)
    }
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
    if (!keepSlipAfterBet) { setSlip([]); setSlipAmounts({}) }
    showFlash(`${slip.length} bet${slip.length > 1 ? 's' : ''} placed!`)
    fetchAccounts(); fetchMyBets(myAccount.id)
    setSubmitting(false)
  }

  const placeParlay = async () => {
    if (!myAccount) return showFlash('Log in first', false)
    if (slip.length < 2) return showFlash('Parlays need 2+ legs', false)
    const amt = parseInt(parlayAmt)
    if (!amt || amt <= 0) return showFlash('Enter parlay amount', false)
    if (amt > myAccount.balance) return showFlash('Insufficient Gimre Bucks', false)
    setSubmitting(true)
    const combinedOdds = toAmerican(slip.reduce((a, s) => a * toDecimal(s.odds), 1))
    const { data: parlay } = await db.from('sb_parlays').insert({ account_id: myAccount.id, amount: amt, legs: slip.length, combined_odds: combinedOdds, status: 'pending' }).select().single()
    await db.from('sb_bets').insert(slip.map(s => legInsertRow(myAccount.id, s, 0, { parlay_id: parlay.id })))
    const { data: fresh } = await db.from('gb_accounts').select('balance').eq('id', myAccount.id).single()
    await db.from('gb_accounts').update({ balance: fresh.balance - amt }).eq('id', myAccount.id)
    if (!keepSlipAfterBet) { setSlip([]); setParlayAmt(''); setIsParlay(false) }
    showFlash(`Parlay placed! ${fmtOdds(combinedOdds)}`)
    fetchAccounts(); fetchMyBets(myAccount.id)
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
      const winAmt = status === 'won' ? (bet.bet_type === 'pickem' ? 20 : calcWin(bet.amount, bet.odds)) : 0
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
  const adminBtn = { background: 'none', border: `1px solid ${gold}`, color: gold, padding: '8px 16px', cursor: generating ? 'not-allowed' : 'pointer', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", opacity: generating ? 0.6 : 1 }
  const weeks = Array.from({ length: 17 }, (_, i) => i + 1)

  const futureLabel = (f, pick) => {
    if (f.market_type === 'win_total') return `${f.team_name} ${pick === 'yes' ? 'Over' : 'Under'} ${f.line} Wins`
    if (f.market_type === 'seed_total') return `${f.team_name} ${pick === 'yes' ? 'Over' : 'Under'} Seed ${f.line}`
    if (f.market_type === 'h2h_finish') return pick === 'yes' ? `${f.team_name} finishes ahead of ${f.opp_team_name}` : `${f.opp_team_name} finishes ahead of ${f.team_name}`
    return `${f.team_name} — ${FUTURE_LABELS[f.market_type] || f.market_type} (${pick === 'yes' ? 'Yes' : 'No'})`
  }

  // ── the bet slip popup: shared across every tab ──
  const SlipPanel = () => {
    const eligibleForParlay = slip.length >= 2
    return (
      <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 150, width: effectiveMobile ? 'calc(100vw - 32px)' : '360px' }}>
        {slipOpen && (
          <div style={{ background: d ? '#0a0a0a' : '#f4f1ec', border: `1px solid ${border}`, marginBottom: '10px', maxHeight: '75vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: text, fontWeight: '600' }}>Bet Slip ({slip.length})</span>
              <button onClick={() => setSlipOpen(false)} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '16px', padding: 0 }}>✕</button>
            </div>
            {slip.length === 0 ? (
              <div style={{ padding: '20px 16px', fontSize: '12px', color: muted }}>No picks yet — tap any line to add it.</div>
            ) : (
              <div style={{ overflowY: 'auto', padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                  <button onClick={() => setIsParlay(false)} style={tabBtn(!isParlay)}>Singles</button>
                  <button onClick={() => setIsParlay(true)} disabled={!eligibleForParlay} style={{ ...tabBtn(isParlay), opacity: eligibleForParlay ? 1 : 0.4 }}>Parlay</button>
                </div>
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
                  disabled={submitting || !myAccount || stakeTotal <= 0 || overBalance}
                  style={{ background: text, color: bg, border: 'none', padding: '12px 24px', width: '100%', cursor: (submitting || overBalance || stakeTotal <= 0) ? 'not-allowed' : 'pointer', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500', marginTop: '12px', opacity: (submitting || overBalance || stakeTotal <= 0) ? 0.5 : 1 }}
                >
                  {!myAccount ? 'Log in first' : submitting ? 'Placing...' : isParlay ? 'Place Parlay' : 'Place Bets'}
                </button>
              </div>
            )}
          </div>
        )}
        {slip.length > 0 && (
          <button onClick={() => setSlipOpen(o => !o)} style={{ background: gold, color: '#000', border: 'none', padding: '12px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif", letterSpacing: '0.05em', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', width: '100%' }}>
            {slipOpen ? 'Hide Slip' : `Bet Slip (${slip.length})`}
          </button>
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
                <button onClick={() => { setNameStep('name'); setPinError('') }} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif", textDecoration: 'underline', padding: 0 }}>change</button>
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

      {/* Admin PIN modal */}
      {showPinModal && (
        <>
          <div onClick={() => setShowPinModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: d ? '#0a0a0a' : '#f4f1ec', border: `1px solid ${border}`, padding: '28px', width: effectiveMobile ? '90vw' : '320px' }}>
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

      {/* Settle modal (games) */}
      {settleTarget && (
        <>
          <div onClick={() => setSettleTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: d ? '#0a0a0a' : '#f4f1ec', border: `1px solid ${border}`, padding: '28px', width: effectiveMobile ? '90vw' : '380px' }}>
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

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 160px' : '120px 24px 160px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px,6vw,64px)', fontWeight: '400', letterSpacing: '-0.02em' }}>Sportsbook</h1>
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
          {[['lines', 'Lines'], ['pickem', "Pick'em"], ['futures', 'Futures'], ['props', 'Props'], ['mybets', 'My Bets'], ['leaderboard', 'Leaderboard']].map(([t, label]) => (
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
                <button onClick={generateWeekBoard} disabled={generating} style={adminBtn}>{generating ? 'Working…' : `Generate Week ${week} Board`}</button>
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
                        {existingPick.status !== 'pending' && <span style={{ fontWeight: '600', color: existingPick.status === 'won' ? green : red }}>{existingPick.status === 'won' ? '+20 GB ✓' : 'Lost'}</span>}
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
              <button onClick={generateFutures} disabled={generating} style={{ ...adminBtn, marginBottom: '20px' }}>{generating ? 'Working…' : 'Generate / Refresh Season Futures'}</button>
            )}
            {futures.length === 0 && <p style={{ color: muted, fontSize: '13px' }}>No futures on the board yet{adminUnlocked ? ' — generate them above.' : '.'}</p>}

            {['playoffs', 'bye', 'semis', 'finals', 'title', 'win_total', 'seed_total', 'h2h_finish'].map(mt => {
              const rows = futures.filter(f => f.market_type === mt && !f.is_settled)
              if (!rows.length) return null
              const heading = mt === 'win_total' ? 'Win Totals' : mt === 'seed_total' ? 'Final Seed' : mt === 'h2h_finish' ? "Finishes Ahead Of" : FUTURE_LABELS[mt]
              return (
                <div key={mt} style={{ marginBottom: '28px' }}>
                  <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '10px' }}>{heading}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {rows.map(f => (
                      <div key={f.id} style={{ background: cardBg, border: `1px solid ${border}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ fontSize: '13px', color: text }}>
                          {f.team_name}{f.opp_team_name ? ` vs ${f.opp_team_name}` : ''}{f.line != null ? ` — ${f.line}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button onClick={() => toggleBet({ family: 'future', refId: f.id, betType: 'future', pick: 'yes', odds: f.odds_yes, label: futureLabel(f, 'yes'), subLabel: heading })} style={betBtn(inSlip('future', f.id, 'future', 'yes'))}>
                            {mt === 'win_total' || mt === 'seed_total' ? 'Over' : mt === 'h2h_finish' ? f.team_name : 'Yes'} <span style={{ color: muted, fontSize: '10px' }}>{fmtOdds(f.odds_yes)}</span>
                          </button>
                          <button onClick={() => toggleBet({ family: 'future', refId: f.id, betType: 'future', pick: 'no', odds: f.odds_no, label: futureLabel(f, 'no'), subLabel: heading })} style={betBtn(inSlip('future', f.id, 'future', 'no'))}>
                            {mt === 'win_total' || mt === 'seed_total' ? 'Under' : mt === 'h2h_finish' ? f.opp_team_name : 'No'} <span style={{ color: muted, fontSize: '10px' }}>{fmtOdds(f.odds_no)}</span>
                          </button>
                          {adminUnlocked && (
                            <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
                              <button onClick={() => settleFuture(f, 'yes')} disabled={generating} style={{ background: 'none', border: `1px solid ${green}`, color: green, padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>Settle Yes</button>
                              <button onClick={() => settleFuture(f, 'no')} disabled={generating} style={{ background: 'none', border: `1px solid ${red}`, color: red, padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>Settle No</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

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
              Over/under a player's own weekly fantasy-point projection — pulled from each team's optimal starting lineup.
            </p>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '4px' }}>Week</span>
              {weeks.map(w => <button key={w} onClick={() => setWeek(w)} style={{ background: week === w ? text : 'none', color: week === w ? bg : muted, border: `1px solid ${border}`, padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontFamily: "'Inter', sans-serif" }}>{w}</button>)}
            </div>
            {adminUnlocked && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button onClick={generateProps} disabled={generating} style={adminBtn}>{generating ? 'Working…' : `Generate Week ${week} Props`}</button>
                <button onClick={autoSettleProps} disabled={generating} style={{ ...adminBtn, borderColor: green, color: green }}>{generating ? 'Working…' : `Auto-Settle Week ${week} Props`}</button>
              </div>
            )}
            {props.length === 0 && <p style={{ color: muted, fontSize: '13px' }}>No props for Week {week} yet{adminUnlocked ? ' — generate them above.' : '.'}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {props.filter(p => !p.is_settled).map(p => (
                <div key={p.id} style={{ background: cardBg, border: `1px solid ${border}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '13px', color: text }}>{p.player_name} <span style={{ color: muted, fontSize: '11px' }}>{p.position}{p.team_name ? ` · ${p.team_name}` : ''}</span></div>
                    <div style={{ fontSize: '11px', color: muted }}>Line: {p.line} pts</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => toggleBet({ family: 'prop', refId: p.id, betType: 'prop', pick: 'over', odds: p.odds_over, label: `${p.player_name} Over ${p.line}`, subLabel: `Week ${p.week} prop` })} style={betBtn(inSlip('prop', p.id, 'prop', 'over'))}>Over <span style={{ color: muted, fontSize: '10px' }}>{fmtOdds(p.odds_over)}</span></button>
                    <button onClick={() => toggleBet({ family: 'prop', refId: p.id, betType: 'prop', pick: 'under', odds: p.odds_under, label: `${p.player_name} Under ${p.line}`, subLabel: `Week ${p.week} prop` })} style={betBtn(inSlip('prop', p.id, 'prop', 'under'))}>Under <span style={{ color: muted, fontSize: '10px' }}>{fmtOdds(p.odds_under)}</span></button>
                  </div>
                </div>
              ))}
            </div>

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
                        else if (leg.game) legDesc = `${leg.game.team_a} vs ${leg.game.team_b}: ${leg.pick === 'team_a' ? leg.game.team_a : leg.pick === 'team_b' ? leg.game.team_b : leg.pick}`
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
                        {bet.status === 'won' ? '+20 GB' : bet.status === 'lost' ? 'Lost' : 'Pending'}
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
                <div key={acc.id} style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', alignItems: 'center', padding: '14px 16px', borderBottom: i < accounts.length - 1 ? `1px solid ${border}` : 'none', background: acc.manager_name === playerName ? (d ? 'rgba(255,255,255,0.04)' : 'rgba(13,33,82,0.04)') : 'transparent' }}>
                  <span style={{ fontSize: i < 3 ? '18px' : '13px', fontWeight: '700', color: i === 0 ? gold : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : muted }}>
                    {i + 1}{['st','nd','rd'][i] ?? 'th'}
                  </span>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: text }}>{acc.manager_name}</span>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: gold }}>{acc.balance.toLocaleString()} GB</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
