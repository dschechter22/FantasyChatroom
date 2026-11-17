'use client'
import { Fragment, useState, useEffect, useMemo } from 'react'
import { supabase, LEAGUE_ID, fetchAll } from '../../lib/supabase'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'
import { isPlayed } from '../../lib/predictions'
import { buildSeasonGrid, playSchedule, scheduleMatrix, playoffPicture, scoreSd } from '../../lib/whatIf'

const rec = r => `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ''}`
const winsOf = r => r.wins + (r.ties || 0) / 2
const pct = p => `${(p * 100).toFixed(p > 0 && p < 0.1 ? 1 : 0)}%`
const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }

export default function WhatIfPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, green, red, gold } = useLayout()
  const [seasons, setSeasons] = useState([])
  const [allTeams, setAllTeams] = useState([])
  const [matchups, setMatchups] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState('season')
  const [year, setYear] = useState(null)
  const [xId, setXId] = useState('')
  const [yId, setYId] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('seasons')
        .select('id, year, season_number, champion_id')
        .eq('league_id', LEAGUE_ID).order('year', { ascending: false }),
      supabase.from('teams')
        .select('id, manager_id, team_name, made_playoffs, season_id, manager:manager_id(id, name, slug)')
        .eq('league_id', LEAGUE_ID).limit(5000),
      fetchAll(() => supabase.from('matchups')
        .select('season_id, week, home_team_id, away_team_id, home_score, away_score, is_playoff, is_mol_bowl, is_consolation')
        .eq('league_id', LEAGUE_ID)),
    ]).then(([s, t, m]) => {
      const seasonRows = s.data || []
      setSeasons(seasonRows)
      setAllTeams(t.data || [])
      setMatchups((m.data || []).filter(x => !x.is_playoff && !x.is_mol_bowl && !x.is_consolation && isPlayed(x)))
      if (seasonRows.length) setYear(seasonRows[0].year)
      setLoaded(true)
    })
  }, [])

  // One model per season: grid, every team-on-every-schedule record, spread.
  const models = useMemo(() => {
    const out = {}
    seasons.forEach(s => {
      const teams = allTeams.filter(t => t.season_id === s.id)
      const games = matchups.filter(m => m.season_id === s.id).map(m => ({
        week: m.week, homeId: m.home_team_id, awayId: m.away_team_id, homeScore: Number(m.home_score), awayScore: Number(m.away_score),
      }))
      if (teams.length < 2 || !games.length) return
      const grid = buildSeasonGrid(teams, games)
      const matrix = scheduleMatrix(teams, grid)
      const actual = {}, avg = {}
      teams.forEach(t => {
        actual[t.id] = matrix[t.id][t.id]
        const n = actual[t.id].log.length
        avg[t.id] = n ? actual[t.id].pf / n : 0
      })
      const sd = scoreSd(grid)
      const flagged = teams.filter(t => t.made_playoffs).length
      const spots = flagged >= 2 ? flagged : Math.min(6, teams.length)
      const done = !!s.champion_id
      out[s.year] = { season: s, teams, grid, matrix, actual, avg, sd, spots, done }
    })
    return out
  }, [seasons, allTeams, matchups])

  const pic = (model, teamId, r) => playoffPicture(model.teams, model.actual, model.avg, model.sd, model.spots, teamId, r)

  // Easiest / hardest schedule for a team: most / fewest wins on any schedule,
  // fewer / more points against breaking ties.
  const extremes = (model, teamId) => {
    const cands = model.teams.map(s => ({ s, r: model.matrix[teamId][s.id] }))
    const key = c => winsOf(c.r) * 1e6 - c.r.pa
    const easy = cands.reduce((a, b) => (key(b) > key(a) ? b : a))
    const hard = cands.reduce((a, b) => (key(b) < key(a) ? b : a))
    return { easy, hard }
  }

  const years = seasons.filter(s => models[s.year]).map(s => s.year)
  const model = year != null ? models[year] : null

  useEffect(() => {
    if (!model) return
    const ids = model.teams.map(t => t.id)
    const x = ids.includes(xId) ? xId : ids[0]
    const y = ids.includes(yId) && yId !== x ? yId : ids.find(i => i !== x)
    if (x !== xId) setXId(x)
    if (y !== yId) setYId(y)
  }, [model, xId, yId])

  const name = t => t?.manager?.name || t?.team_name || '?'

  // ── career ──
  const career = useMemo(() => {
    const by = {}
    Object.values(models).filter(m => m.done).forEach(m => {
      m.teams.forEach(t => {
        const mid = t.manager_id
        const o = (by[mid] ||= {
          name: t.manager?.name || '?', seasons: 0, rings: 0,
          act: { w: 0, l: 0, t: 0, po: 0, titles: 0 }, easy: { w: 0, l: 0, t: 0, po: 0, titles: 0 }, hard: { w: 0, l: 0, t: 0, po: 0, titles: 0 },
          byYear: [],
        })
        const { easy, hard } = extremes(m, t.id)
        const a = m.actual[t.id]
        const pa = pic(m, t.id, a), pe = pic(m, t.id, easy.r), ph = pic(m, t.id, hard.r)
        const add = (k, r, p) => { k.w += r.wins; k.l += r.losses; k.t += r.ties; k.po += p.made ? 1 : 0; k.titles += p.titleProb }
        add(o.act, a, pa); add(o.easy, easy.r, pe); add(o.hard, hard.r, ph)
        o.seasons++
        if (m.season.champion_id === mid) o.rings++
        o.byYear.push({ year: m.season.year, act: a, easy: easy.r, hard: hard.r, easyOwner: name(easy.s), hardOwner: name(hard.s), pa, pe, ph })
      })
    })
    return Object.values(by).sort((a, b) => b.seasons - a.seasons || a.name.localeCompare(b.name))
  }, [models]) // eslint-disable-line react-hooks/exhaustive-deps

  const [careerOpen, setCareerOpen] = useState(null)

  const hStyle = (align = 'left') => ({
    padding: effectiveMobile ? '8px 8px' : '10px 12px', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase',
    color: muted, textAlign: align, borderBottom: `1px solid ${border}`, fontWeight: '500', whiteSpace: 'nowrap',
  })
  const cStyle = (align = 'left') => ({
    padding: effectiveMobile ? '9px 8px' : '11px 12px', fontSize: effectiveMobile ? '12px' : '13px', textAlign: align,
    borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap',
  })
  const selectStyle = {
    background: cardBg, border: `1px solid ${border}`, color: text, padding: '8px 12px', fontSize: '13px',
    fontFamily: "'Inter', sans-serif", outline: 'none', minWidth: '140px',
  }
  const tabStyle = on => ({
    background: on ? text : 'transparent', color: on ? bg : muted, border: `1px solid ${on ? text : border}`,
    padding: '8px 18px', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  })
  const sectionTitle = (t, sub) => (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '22px' : '28px' }}>{t}</div>
      {sub && <p style={{ color: muted, fontSize: '12px', lineHeight: 1.6, maxWidth: '760px', marginTop: '6px' }}>{sub}</p>}
    </div>
  )
  const delta = (v) => (v === 0 ? muted : v > 0 ? green : red)

  const seasonView = () => {
    if (!model) return null
    const teams = [...model.teams].sort((a, b) => winsOf(model.actual[b.id]) - winsOf(model.actual[a.id]) || model.actual[b.id].pf - model.actual[a.id].pf)
    const x = model.teams.find(t => t.id === xId), y = model.teams.find(t => t.id === yId)
    const xr = x && y ? playSchedule(model.grid, x.id, y.id) : null
    const yr = x && y ? playSchedule(model.grid, y.id, x.id) : null
    const xp = xr ? pic(model, x.id, xr) : null
    const yp = yr ? pic(model, y.id, yr) : null
    const xa = x ? pic(model, x.id, model.actual[x.id]) : null
    const ya = y ? pic(model, y.id, model.actual[y.id]) : null
    const rings = model.teams.filter(t => model.season.champion_id === t.manager_id)[0]

    const pill = (label, color) => (
      <span style={{ fontSize: '9px', color, border: `1px solid ${color}`, padding: '1px 5px', letterSpacing: '0.1em', marginLeft: '6px' }}>{label}</span>
    )

    const card = (who, sched, r, p, a, ap) => (
      <div style={{ background: cardBg, border: `1px solid ${border}`, padding: '18px 20px', flex: 1, minWidth: effectiveMobile ? '100%' : '300px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '6px' }}>{name(who)} with {name(sched)}&apos;s schedule</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '40px', lineHeight: 1 }}>{rec(r)}</span>
          <span style={{ color: muted, fontSize: '13px' }}>was {rec(model.actual[who.id])}</span>
          <span style={{ color: delta(winsOf(r) - winsOf(model.actual[who.id])), fontWeight: 600 }}>
            {winsOf(r) - winsOf(model.actual[who.id]) > 0 ? '+' : ''}{winsOf(r) - winsOf(model.actual[who.id])} W
          </span>
        </div>
        <div style={{ marginTop: '10px', fontSize: '13px', lineHeight: 1.8 }}>
          <div>Seed: <b>{ordinal(p.seed)}</b> <span style={{ color: muted }}>(was {ordinal(ap.seed)})</span>
            {p.made ? pill(p.bye ? 'BYE' : 'IN', green) : pill('OUT', red)}</div>
          <div>Title odds: <b>{pct(p.titleProb)}</b> <span style={{ color: muted }}>(was {pct(ap.titleProb)})</span></div>
        </div>
      </div>
    )

    const logTable = (who, sched, r) => (
      <div style={{ overflowX: 'auto', flex: 1, minWidth: effectiveMobile ? '100%' : '420px' }}>
        <div style={{ fontSize: '11px', color: muted, marginBottom: '6px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{name(who)} week by week</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
          <thead>
            <tr style={{ background: cardBg }}>
              <th style={hStyle('center')}>Wk</th>
              <th style={hStyle()}>Actual</th>
              <th style={hStyle()}>With {name(sched)}&apos;s</th>
            </tr>
          </thead>
          <tbody>
            {r.log.map((g, i) => {
              const actualG = model.matrix[who.id][who.id].log.find(l => l.week === g.week)
              const changed = actualG && (actualG.result !== g.result)
              const oppName = id => name(model.teams.find(t => t.id === id))
              const cell = (L) => L && (
                <>
                  <span style={{ color: L.result === 'W' ? green : L.result === 'L' ? red : muted, fontWeight: 600, marginRight: '6px' }}>{L.result}</span>
                  vs {oppName(L.oppId)} <span style={{ color: muted }}>{L.mine.toFixed(1)}–{L.theirs.toFixed(1)}</span>
                </>
              )
              return (
                <tr key={g.week} style={{ background: changed ? (d ? '#2b3242' : '#efe9dc') : (i % 2 === 0 ? 'transparent' : rowAlt) }}>
                  <td style={{ ...cStyle('center'), color: muted }}>{g.week}</td>
                  <td style={cStyle()}>{cell(actualG)}</td>
                  <td style={cStyle()}>{cell(g)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )

    return (
      <>
        {/* Swap */}
        <div style={{ marginBottom: '56px' }}>
          {sectionTitle('Take Their Schedule', 'Pick a team and whose schedule it plays. The week their schedule had them facing you, you face them instead. Both teams swap, everyone else keeps their real record.')}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
            <select value={xId} onChange={e => setXId(e.target.value)} style={selectStyle}>
              {model.teams.map(t => <option key={t.id} value={t.id}>{name(t)}</option>)}
            </select>
            <span style={{ color: muted, fontSize: '12px' }}>swaps schedules with</span>
            <select value={yId} onChange={e => setYId(e.target.value)} style={selectStyle}>
              {model.teams.filter(t => t.id !== xId).map(t => <option key={t.id} value={t.id}>{name(t)}</option>)}
            </select>
          </div>
          {x && y && xr && yr && (
            <>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {card(x, y, xr, xp, model.actual[x.id], xa)}
                {card(y, x, yr, yp, model.actual[y.id], ya)}
              </div>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {logTable(x, y, xr)}
                {logTable(y, x, yr)}
              </div>
            </>
          )}
        </div>

        {/* Matrix */}
        <div style={{ marginBottom: '56px' }}>
          {sectionTitle('Every Team on Every Schedule', 'Read across: a team (row) playing each other team’s schedule (column). Green is better than the real record, red is worse, and the highlighted cell is what actually happened.')}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', borderTop: `1px solid ${border}`, minWidth: '100%' }}>
              <thead>
                <tr style={{ background: cardBg }}>
                  <th style={hStyle()}>Team \ Schedule</th>
                  {teams.map(s => <th key={s.id} style={hStyle('center')}>{name(s)}</th>)}
                </tr>
              </thead>
              <tbody>
                {teams.map((t, i) => (
                  <tr key={t.id} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                    <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>{name(t)}</td>
                    {teams.map(s => {
                      const r = model.matrix[t.id][s.id]
                      const dl = winsOf(r) - winsOf(model.actual[t.id])
                      const own = s.id === t.id
                      return (
                        <td key={s.id} style={{
                          ...cStyle('center'), color: own ? text : delta(dl), fontWeight: own ? 700 : 500,
                          background: own ? (d ? '#3a4256' : '#e4dccb') : undefined,
                        }}>{rec(r)}</td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Easiest / hardest */}
        <div style={{ marginBottom: '56px' }}>
          {sectionTitle('Best and Worst Case', 'For each team, the schedule in the league that would have given them the most wins, and the one that would have given them the fewest.')}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
              <thead>
                <tr style={{ background: cardBg }}>
                  <th style={hStyle()}>Team</th>
                  <th style={hStyle('center')}>Actual</th>
                  <th style={hStyle('center')}>Seed</th>
                  <th style={hStyle('center')}>Easiest</th>
                  <th style={hStyle()}>Whose</th>
                  <th style={hStyle('center')}>Seed</th>
                  <th style={hStyle('right')}>Title %</th>
                  <th style={hStyle('center')}>Hardest</th>
                  <th style={hStyle()}>Whose</th>
                  <th style={hStyle('center')}>Seed</th>
                  <th style={hStyle('right')}>Title %</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t, i) => {
                  const { easy, hard } = extremes(model, t.id)
                  const pa = pic(model, t.id, model.actual[t.id]), pe = pic(model, t.id, easy.r), ph = pic(model, t.id, hard.r)
                  const seedCell = p => <span style={{ color: p.made ? green : muted }}>{ordinal(p.seed)}{p.made ? '' : ' ✕'}</span>
                  return (
                    <tr key={t.id} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt }}>
                      <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif", fontSize: '14px' }}>
                        {name(t)}{model.season.champion_id === t.manager_id && <span style={{ marginLeft: '6px' }}>🏆</span>}
                      </td>
                      <td style={{ ...cStyle('center'), fontWeight: 600 }}>{rec(model.actual[t.id])}</td>
                      <td style={cStyle('center')}>{seedCell(pa)}</td>
                      <td style={{ ...cStyle('center'), color: green, fontWeight: 600 }}>{rec(easy.r)}</td>
                      <td style={{ ...cStyle(), color: muted, fontSize: '12px' }}>{easy.s.id === t.id ? 'own' : name(easy.s)}</td>
                      <td style={cStyle('center')}>{seedCell(pe)}</td>
                      <td style={cStyle('right')}>{pct(pe.titleProb)}</td>
                      <td style={{ ...cStyle('center'), color: red, fontWeight: 600 }}>{rec(hard.r)}</td>
                      <td style={{ ...cStyle(), color: muted, fontSize: '12px' }}>{hard.s.id === t.id ? 'own' : name(hard.s)}</td>
                      <td style={cStyle('center')}>{seedCell(ph)}</td>
                      <td style={cStyle('right')}>{pct(ph.titleProb)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p style={{ color: muted, fontSize: '11px', marginTop: '10px', lineHeight: 1.6, maxWidth: '760px' }}>
            Seeds come from wins, then points for, with {model.spots} playoff spots{model.season.champion_id ? '' : ' (season in progress)'}.
            Title % is an estimate: a single-elimination bracket where each game is decided by the two teams&apos; average scores and this season&apos;s week-to-week spread. It cannot replay the real playoffs, so it is odds, not a verdict.
            {rings ? ` Real champion: ${name(rings)}.` : ''}
          </p>
        </div>
      </>
    )
  }

  const careerView = () => {
    const rows = career
    const sumRow = (k) => `${k.w}-${k.l}${k.t ? `-${k.t}` : ''}`
    const best = [...rows].sort((a, b) => (b.easy.titles - b.act.titles) - (a.easy.titles - a.act.titles))[0]
    return (
      <>
        {sectionTitle('Career What-If', 'Every completed season, each manager replayed on the easiest and the hardest schedule in the league that year. Titles are expected titles from the bracket estimate, next to the rings actually won.')}
        {best && (
          <p style={{ color: muted, fontSize: '13px', marginBottom: '20px', lineHeight: 1.7 }}>
            Biggest beneficiary of a soft schedule: <b style={{ color: text }}>{best.name}</b>, who would be about {(best.easy.titles - best.act.titles).toFixed(1)} titles and {best.easy.w - best.act.w} wins richer.
          </p>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${border}` }}>
            <thead>
              <tr style={{ background: cardBg }}>
                <th style={hStyle()}>Manager</th>
                <th style={hStyle('center')}>Seasons</th>
                <th style={hStyle('center')}>Actual</th>
                <th style={hStyle('center')}>Playoffs</th>
                <th style={hStyle('center')}>Rings</th>
                <th style={hStyle('center')}>Easiest</th>
                <th style={hStyle('center')}>Playoffs</th>
                <th style={hStyle('center')}>Est. Titles</th>
                <th style={hStyle('center')}>Hardest</th>
                <th style={hStyle('center')}>Playoffs</th>
                <th style={hStyle('center')}>Est. Titles</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <Fragment key={r.name}>
                  <tr onClick={() => setCareerOpen(careerOpen === r.name ? null : r.name)} style={{ background: i % 2 === 0 ? 'transparent' : rowAlt, cursor: 'pointer' }}>
                    <td style={{ ...cStyle(), fontFamily: "'Playfair Display', serif", fontSize: '15px' }}>
                      <span style={{ color: muted, fontSize: '10px', marginRight: '6px' }}>{careerOpen === r.name ? '▾' : '▸'}</span>{r.name}
                    </td>
                    <td style={{ ...cStyle('center'), color: muted }}>{r.seasons}</td>
                    <td style={{ ...cStyle('center'), fontWeight: 600 }}>{sumRow(r.act)}</td>
                    <td style={cStyle('center')}>{r.act.po}</td>
                    <td style={{ ...cStyle('center'), color: gold, fontWeight: 700 }}>{r.rings}</td>
                    <td style={{ ...cStyle('center'), color: green, fontWeight: 600 }}>{sumRow(r.easy)}</td>
                    <td style={cStyle('center')}>{r.easy.po}</td>
                    <td style={{ ...cStyle('center'), color: green }}>{r.easy.titles.toFixed(1)}</td>
                    <td style={{ ...cStyle('center'), color: red, fontWeight: 600 }}>{sumRow(r.hard)}</td>
                    <td style={cStyle('center')}>{r.hard.po}</td>
                    <td style={{ ...cStyle('center'), color: red }}>{r.hard.titles.toFixed(1)}</td>
                  </tr>
                  {careerOpen === r.name && (
                    <tr>
                      <td colSpan={11} style={{ padding: 0, borderBottom: `1px solid ${border}`, background: cardBg }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={hStyle('center')}>Year</th>
                              <th style={hStyle('center')}>Actual</th>
                              <th style={hStyle('center')}>Easiest</th>
                              <th style={hStyle()}>Whose</th>
                              <th style={hStyle('center')}>Hardest</th>
                              <th style={hStyle()}>Whose</th>
                              <th style={hStyle('center')}>Seeds (act / easy / hard)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...r.byYear].sort((a, b) => b.year - a.year).map(y => (
                              <tr key={y.year}>
                                <td style={{ ...cStyle('center'), color: muted }}>{y.year}</td>
                                <td style={{ ...cStyle('center'), fontWeight: 600 }}>{rec(y.act)}</td>
                                <td style={{ ...cStyle('center'), color: green }}>{rec(y.easy)}</td>
                                <td style={{ ...cStyle(), color: muted, fontSize: '12px' }}>{y.easyOwner}</td>
                                <td style={{ ...cStyle('center'), color: red }}>{rec(y.hard)}</td>
                                <td style={{ ...cStyle(), color: muted, fontSize: '12px' }}>{y.hardOwner}</td>
                                <td style={{ ...cStyle('center'), color: muted }}>{y.pa.seed} / {y.pe.seed} / {y.ph.seed}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ color: muted, fontSize: '11px', marginTop: '10px', lineHeight: 1.6, maxWidth: '760px' }}>
          Click a manager for the year-by-year. Easiest and hardest are chosen per season, so these are bounds, not a schedule anyone could really have had. Est. Titles for the real schedule are the same bracket estimate, so compare them with each other, and with Rings as a sanity check.
        </p>
      </>
    )
  }

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px, 6vw, 72px)', fontWeight: '400', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          What If
        </h1>
        <p style={{ color: muted, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '32px' }}>
          Same scores, someone else&apos;s schedule
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '36px' }}>
          <button style={tabStyle(view === 'season')} onClick={() => setView('season')}>Season</button>
          <button style={tabStyle(view === 'career')} onClick={() => setView('career')}>Career</button>
          {view === 'season' && years.length > 0 && (
            <select value={year ?? ''} onChange={e => setYear(Number(e.target.value))} style={{ ...selectStyle, minWidth: '100px', marginLeft: '8px' }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>

        {!loaded ? <div style={{ color: muted }}>Loading…</div> : view === 'season' ? seasonView() : careerView()}
      </div>
    </div>
  )
}
