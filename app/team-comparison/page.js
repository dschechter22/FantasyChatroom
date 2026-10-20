'use client'
import { useState, useEffect, useMemo } from 'react'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'
import { loadLeagueHistory, buildIndex, similarityToAnchor, similarityMatrix, finishOf, TIERS, SLOT_ORDER } from '../../lib/teamCompare'

const MAX_TEAMS = 4
const GREEN = '#34A853', GOLD = '#FBBC04', RED = '#EA4335', BLUE = '#4285F4', TEAL = '#46BDC6', ORANGE = '#F4811F', PURPLE = '#9B72CB'
const MANAGER_COLORS = {
  dan: '#4285F4', wally: '#EA4335', john: '#FBBC04', braden: '#34A853', jm: '#FF6D00', 'big-e': '#46BDC6',
  'mamby-tenner': '#7BAAF7', reid: '#F07B72', freed: '#FCD04F', caden: '#71C287',
}
const colorOf = t => MANAGER_COLORS[t?.slug] || '#8d93a5'
const initials = name => (name || '?').split(/[\s/]+/).map(s => s[0]).join('').slice(0, 2).toUpperCase()
const f1 = n => (n == null ? '—' : n.toFixed(1))
const signed = (n, p = 1) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(p)}`)

export default function SimilarTeamsPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, accent } = useLayout()
  const [index, setIndex] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState([])
  const [mode, setMode] = useState('similar')
  const [q, setQ] = useState('')
  const [year, setYear] = useState('all')
  const [manager, setManager] = useState('all')
  const [ppgMin, setPpgMin] = useState('')
  const [ppgMax, setPpgMax] = useState('')
  const [powMin, setPowMin] = useState('')
  const [powMax, setPowMax] = useState('')
  const [sortKey, setSortKey] = useState('similarity')
  const [limit, setLimit] = useState(40)

  useEffect(() => {
    let cancelled = false
    loadLeagueHistory()
      .then(raw => {
        if (cancelled) return
        const idx = buildIndex(raw)
        setIndex(idx)
        // /team-comparison?team=<id> (linked from a team's Similar Teams tab) starts with that team
        const id = new URLSearchParams(window.location.search).get('team')
        if (id && idx.byId.has(id)) setSelected([id])
      })
      .catch(e => { if (!cancelled) setError(e.message || 'Could not load league history') })
    return () => { cancelled = true }
  }, [])

  const anchorId = selected[0]
  const anchor = index && anchorId ? index.byId.get(anchorId) : null
  const sim = useMemo(() => (index && anchorId ? similarityToAnchor(index, anchorId) : { week: 0, scores: new Map() }), [index, anchorId])
  const matrix = useMemo(() => (index && selected.length > 1 ? similarityMatrix(index, selected) : { week: 0, cells: [] }), [index, selected])
  const team = id => index?.byId.get(id)
  const chosen = selected.map(team).filter(Boolean)

  // switch to "browse" with the sort that makes sense when there is no anchor yet
  useEffect(() => { if (!anchorId && sortKey === 'similarity') setSortKey('avg') }, [anchorId, sortKey])
  useEffect(() => { if (anchorId && mode === 'similar') setSortKey('similarity') }, [anchorId, mode])

  const add = id => setSelected(s => (s.includes(id) || s.length >= MAX_TEAMS ? s : [...s, id]))
  const remove = id => setSelected(s => s.filter(x => x !== id))
  const makeAnchor = id => setSelected(s => [id, ...s.filter(x => x !== id)])

  const list = useMemo(() => {
    if (!index) return []
    let rows = index.teams.filter(t => t.games > 0)
    if (mode === 'similar') {
      rows = rows.filter(t => sim.scores.has(t.id))
    } else {
      const s = q.trim().toLowerCase()
      if (s) rows = rows.filter(t => `${t.name} ${t.teamName} ${t.year}`.toLowerCase().includes(s))
      if (year !== 'all') rows = rows.filter(t => String(t.year) === year)
      if (manager !== 'all') rows = rows.filter(t => t.slug === manager)
      if (ppgMin !== '') rows = rows.filter(t => t.avg >= parseFloat(ppgMin))
      if (ppgMax !== '') rows = rows.filter(t => t.avg <= parseFloat(ppgMax))
      if (powMin !== '') rows = rows.filter(t => (t.power ?? -1) >= parseFloat(powMin))
      if (powMax !== '') rows = rows.filter(t => (t.power ?? 1e9) <= parseFloat(powMax))
    }
    const simOf = t => sim.scores.get(t.id)?.similarity ?? -1
    const key = mode === 'similar' ? 'similarity' : sortKey
    const val = { similarity: simOf, avg: t => t.avg, power: t => t.power ?? -1, year: t => t.year, wins: t => t.wins / Math.max(t.wins + t.losses, 1), luck: t => t.luck ?? -99 }[key] || (t => t.avg)
    return [...rows].sort((a, b) => val(b) - val(a))
  }, [index, mode, sim, q, year, manager, ppgMin, ppgMax, powMin, powMax, sortKey])

  const managers = useMemo(() => (index ? [...new Map(index.teams.map(t => [t.slug, t.name])).entries()].filter(([s]) => s).sort((a, b) => a[1].localeCompare(b[1])) : []), [index])

  const inputStyle = { background: d ? '#2b3242' : '#e8e4dc', border: `1px solid ${border}`, color: text, padding: '8px 10px', fontSize: '13px', fontFamily: "'Inter', sans-serif", outline: 'none', minWidth: 0 }
  const kicker = { fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: muted }
  const tint = (c, a = '22') => c + a

  const Finish = ({ t, size = 11 }) => {
    const f = finishOf(t)
    const c = { champ: GOLD, second: '#c0c6d4', third: '#cd7f32', in: GREEN, out: RED, live: BLUE, none: muted }[f.kind]
    return <span style={{ fontSize: `${size}px`, fontWeight: 700, color: c }}>{f.kind === 'champ' ? '🏆 ' : ''}{f.label}</span>
  }

  const Avatar = ({ t, size = 44 }) => (
    <div style={{ width: size, height: size, borderRadius: '10px', background: `linear-gradient(145deg, ${colorOf(t)}, ${colorOf(t)}99)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: `${size * 0.4}px`, flexShrink: 0, boxShadow: `0 0 0 2px ${tint(colorOf(t), '55')}` }}>
      {initials(t.name)}
    </div>
  )

  // ── the four selection slots ──
  const Tray = () => (
    <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
      {Array.from({ length: MAX_TEAMS }, (_, i) => {
        const t = chosen[i]
        if (!t) {
          return (
            <div key={i} style={{ border: `2px dashed ${border}`, padding: '18px 14px', minHeight: '104px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '6px', color: muted, textAlign: 'center' }}>
              <div style={{ fontSize: '22px', lineHeight: 1 }}>＋</div>
              <div style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{i === 0 ? 'Pick a team to start' : `Team ${i + 1}`}</div>
            </div>
          )
        }
        const s = i === 0 ? null : sim.scores.get(t.id)
        return (
          <div key={t.id} style={{ background: `linear-gradient(160deg, ${tint(colorOf(t), '30')}, ${tint(colorOf(t), '0c')})`, borderTop: `3px solid ${colorOf(t)}`, padding: '12px 14px', minHeight: '104px', position: 'relative' }}>
            <button onClick={() => remove(t.id)} title="Remove" style={{ position: 'absolute', top: '6px', right: '6px', background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '14px' }}>✕</button>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Avatar t={t} size={40} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name} <span style={{ color: muted, fontSize: '13px' }}>{t.year}</span></div>
                <div style={{ fontSize: '11px', color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.teamName}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '12px' }}>
              <span><b>{t.wins}-{t.losses}</b> <span style={{ color: muted }}>· {f1(t.avg)} ppg</span></span>
              {i === 0
                ? <span style={{ fontSize: '10px', letterSpacing: '0.14em', color: accent, fontWeight: 700 }}>★ ANCHOR</span>
                : <button onClick={() => makeAnchor(t.id)} style={{ background: 'none', border: 'none', color: s ? (s.similarity >= 60 ? GREEN : s.similarity >= 40 ? GOLD : ORANGE) : muted, cursor: 'pointer', fontSize: '11px', fontWeight: 700, padding: 0 }} title="Make this the anchor">{s ? `${Math.round(s.similarity)}% match` : 'make anchor'}</button>}
            </div>
          </div>
        )
      })}
    </div>
  )

  // ── picker ──
  const Picker = () => {
    const shown = list.slice(0, limit)
    const full = selected.length >= MAX_TEAMS
    return (
      <div style={{ marginBottom: '32px', border: `1px solid ${border}`, background: cardBg }}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, flexWrap: 'wrap' }}>
          {[['similar', anchor ? `Most similar to ${anchor.name} ${anchor.year}` : 'Most similar', !anchor], ['browse', 'Browse every team ever', false]].map(([key, label, disabled]) => (
            <button key={key} disabled={disabled} onClick={() => { setMode(key); setLimit(40) }} style={{ background: mode === key ? bg : 'transparent', color: mode === key ? text : muted, border: 'none', borderTop: `3px solid ${mode === key ? accent : 'transparent'}`, padding: '12px 18px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, fontWeight: mode === key ? 700 : 400, fontFamily: "'Inter', sans-serif" }}>{label}</button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ ...kicker, padding: '14px 16px' }}>{full ? 'Four teams selected — remove one to add another' : `${selected.length} of ${MAX_TEAMS} selected`}</div>
        </div>

        {mode === 'browse' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '12px 14px', borderBottom: `1px solid ${border}`, background: bg }}>
            <input placeholder="Search manager, team or year" value={q} onChange={e => setQ(e.target.value)} style={{ ...inputStyle, width: effectiveMobile ? '100%' : '220px' }} />
            <select value={year} onChange={e => setYear(e.target.value)} style={inputStyle}>
              <option value="all">All years</option>
              {index.years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={manager} onChange={e => setManager(e.target.value)} style={inputStyle}>
              <option value="all">All managers</option>
              {managers.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
            </select>
            <input placeholder="PPG min" value={ppgMin} onChange={e => setPpgMin(e.target.value)} inputMode="decimal" style={{ ...inputStyle, width: '84px' }} />
            <input placeholder="PPG max" value={ppgMax} onChange={e => setPpgMax(e.target.value)} inputMode="decimal" style={{ ...inputStyle, width: '84px' }} />
            <input placeholder="Power min" value={powMin} onChange={e => setPowMin(e.target.value)} inputMode="decimal" style={{ ...inputStyle, width: '92px' }} />
            <input placeholder="Power max" value={powMax} onChange={e => setPowMax(e.target.value)} inputMode="decimal" style={{ ...inputStyle, width: '92px' }} />
            <select value={sortKey} onChange={e => setSortKey(e.target.value)} style={inputStyle}>
              {anchor && <option value="similarity">Sort: similarity</option>}
              <option value="avg">Sort: PPG</option>
              <option value="power">Sort: power score</option>
              <option value="wins">Sort: win %</option>
              <option value="luck">Sort: luck</option>
              <option value="year">Sort: year</option>
            </select>
          </div>
        )}
        {mode === 'similar' && anchor && (
          <div style={{ padding: '10px 14px', fontSize: '11px', color: muted, borderBottom: `1px solid ${border}`, lineHeight: 1.5 }}>
            Measured through week {sim.week} — each candidate's first {sim.week} games vs the anchor's. Pick up to {MAX_TEAMS - 1} more.
          </div>
        )}

        <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
          {!shown.length && <div style={{ padding: '24px', color: muted, fontSize: '13px' }}>{mode === 'similar' ? 'Pick a team first and its closest matches show up here.' : 'No teams match those filters.'}</div>}
          {shown.map((t, i) => {
            const s = sim.scores.get(t.id)
            const on = selected.includes(t.id)
            const sc = s ? (s.similarity >= 60 ? GREEN : s.similarity >= 40 ? GOLD : ORANGE) : muted
            return (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '40px 1fr 70px 64px' : '44px 1.3fr 90px 70px 70px 1.1fr 110px 74px', gap: '10px', alignItems: 'center', padding: '9px 14px', borderBottom: `1px solid ${border}`, background: i % 2 ? rowAlt : 'transparent' }}>
                <Avatar t={t} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name} <span style={{ color: muted, fontSize: '12px' }}>· {t.year}</span></div>
                  <div style={{ fontSize: '11px', color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.teamName}</div>
                </div>
                {!effectiveMobile && <div style={{ fontSize: '13px' }}><b>{t.wins}-{t.losses}</b></div>}
                {!effectiveMobile && <div style={{ fontSize: '12px', color: muted }}>{f1(t.avg)} ppg</div>}
                {!effectiveMobile && <div style={{ fontSize: '12px', color: muted }}>pwr {t.power != null ? t.power.toFixed(0) : '—'}</div>}
                {!effectiveMobile && <div><Finish t={t} size={11} /></div>}
                {effectiveMobile
                  ? <div style={{ fontSize: '11px', color: muted }}>{t.wins}-{t.losses}<br />{f1(t.avg)} ppg</div>
                  : <div>{s ? (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: sc }}>{Math.round(s.similarity)}% match</div>
                        <div style={{ height: '4px', background: d ? 'rgba(255,255,255,0.1)' : 'rgba(13,33,82,0.1)', borderRadius: '2px', marginTop: '3px' }}><div style={{ width: `${Math.min(100, s.similarity)}%`, height: '100%', background: sc, borderRadius: '2px' }} /></div>
                      </div>
                    ) : <span style={{ fontSize: '11px', color: muted }}>{t.id === anchorId ? 'anchor' : ''}</span>}</div>}
                <button disabled={on || full} onClick={() => add(t.id)} style={{ background: on ? 'transparent' : accent, color: on ? muted : (d ? '#1b202c' : '#fff'), border: on ? `1px solid ${border}` : 'none', padding: '6px 0', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, cursor: on || full ? 'not-allowed' : 'pointer', opacity: !on && full ? 0.35 : 1, fontFamily: "'Inter', sans-serif" }}>{on ? 'Added' : 'Add'}</button>
              </div>
            )
          })}
          {list.length > limit && (
            <button onClick={() => setLimit(l => l + 40)} style={{ width: '100%', background: 'none', border: 'none', color: muted, padding: '12px', cursor: 'pointer', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Show more ({list.length - limit} left)</button>
          )}
        </div>
      </div>
    )
  }

  // ── comparison ──
  const cols = `${effectiveMobile ? '104px' : '168px'} repeat(${Math.max(chosen.length, 1)}, minmax(${effectiveMobile ? '118px' : '150px'}, 1fr))`
  const Section = ({ title, children }) => (
    <div style={{ marginBottom: '28px', overflowX: 'auto' }}>
      <div style={{ minWidth: effectiveMobile ? `${104 + chosen.length * 118}px` : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ width: '3px', height: '14px', background: accent }} />
          <span style={{ fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: text, fontWeight: 600 }}>{title}</span>
        </div>
        <div style={{ border: `1px solid ${border}` }}>{children}</div>
      </div>
    </div>
  )

  // one stat across the selected teams; the best value in the row is shaded green
  const StatRow = ({ label, get, fmt = f1, higher = true, i = 0, alt, plain = false }) => {
    const vals = chosen.map(get)
    const nums = vals.filter(v => v != null)
    const best = nums.length > 1 && !plain ? (higher ? Math.max(...nums) : Math.min(...nums)) : null
    return (
      <div style={{ display: 'grid', gridTemplateColumns: cols, background: i % 2 ? rowAlt : 'transparent', borderTop: i ? `1px solid ${border}` : 'none' }}>
        <div style={{ padding: '10px 12px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: muted, display: 'flex', alignItems: 'center' }}>{label}</div>
        {vals.map((v, k) => {
          const isBest = best != null && v === best
          return <div key={chosen[k].id} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '15px', fontWeight: isBest ? 700 : 400, background: isBest ? tint(GREEN, '30') : 'transparent', color: isBest ? (d ? '#9fe3b3' : '#136b2d') : text, fontFamily: "'Playfair Display', serif" }}>{v == null ? (alt ? (alt(chosen[k]) ?? '—') : '—') : fmt(v)}</div>
        })}
      </div>
    )
  }

  const Comparison = () => {
    if (!chosen.length) return null
    const simCell = (id, k) => {
      if (k === 0) return <span style={{ fontSize: '10px', letterSpacing: '0.16em', color: accent, fontWeight: 700 }}>★ ANCHOR</span>
      const s = sim.scores.get(id)
      if (!s) return <span style={{ fontSize: '11px', color: muted }}>—</span>
      const c = s.similarity >= 60 ? GREEN : s.similarity >= 40 ? GOLD : ORANGE
      return <span style={{ fontSize: '12px', fontWeight: 700, color: c }}>{Math.round(s.similarity)}% match</span>
    }
    const slotWins = chosen.map(() => 0)
    SLOT_ORDER.forEach(slot => {
      const vals = chosen.map(t => t.slots[slot]?.ppg ?? 0)
      const best = Math.max(...vals)
      if (best > 0 && vals.filter(v => v === best).length === 1) slotWins[vals.indexOf(best)]++
    })
    const tierCounts = chosen.map(t => {
      const c = Object.fromEntries(TIERS.map(x => [x.key, 0]))
      SLOT_ORDER.forEach(slot => { const p = t.slots[slot]; const tr = p && index.tierOf(slot, p.ppg); if (tr) c[tr.key]++ })
      return c
    })
    const benchRows = Math.min(7, Math.max(...chosen.map(t => t.bench.length), 0))
    return (
      <div>
        {/* header */}
        <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
          <div style={{ minWidth: effectiveMobile ? `${104 + chosen.length * 118}px` : undefined, display: 'grid', gridTemplateColumns: cols, border: `1px solid ${border}` }}>
            <div style={{ padding: '14px 12px', background: cardBg, display: 'flex', alignItems: 'flex-end' }}><span style={kicker}>Teams</span></div>
            {chosen.map((t, k) => (
              <div key={t.id} style={{ padding: '16px 10px 14px', textAlign: 'center', background: `linear-gradient(180deg, ${tint(colorOf(t), '33')}, ${tint(colorOf(t), '08')})`, borderTop: `3px solid ${colorOf(t)}`, borderLeft: `1px solid ${border}` }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><Avatar t={t} size={56} /></div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: text }}>{t.name}</div>
                <div style={{ fontSize: '13px', color: colorOf(t), fontWeight: 700 }}>{t.year}</div>
                <div style={{ fontSize: '11px', color: muted, margin: '2px 0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.teamName}</div>
                <div style={{ marginBottom: '6px' }}><Finish t={t} size={12} /></div>
                {simCell(t.id, k)}
              </div>
            ))}
          </div>
        </div>

        <Section title="Overall stats">
          <RecordRow />
          <StatRow i={1} label="Win %" get={t => (t.wins + t.losses ? (t.wins / (t.wins + t.losses)) * 100 : null)} fmt={v => `${v.toFixed(1)}%`} />
          <StatRow i={2} label="Games played" get={t => t.games} fmt={v => String(v)} plain />
          <StatRow i={3} label="Points for / game" get={t => t.avg} />
          <StatRow i={4} label="Points against / game" get={t => t.papg} higher={false} />
          <StatRow i={5} label="Point diff / game" get={t => t.diffpg} fmt={v => signed(v)} />
          <StatRow i={6} label="Median score" get={t => t.median} />
          <StatRow i={7} label="High score" get={t => t.high} />
          <StatRow i={8} label="Low score" get={t => t.low} />
          <StatRow i={9} label="Consistency (std dev)" get={t => t.std} higher={false} />
          <StatRow i={10} label="Power score" get={t => t.power} />
          <StatRow i={11} label="All-play %" get={t => t.allPlay} fmt={v => `${v.toFixed(1)}%`} />
          <StatRow i={12} label="Luck / game" get={t => t.luckpg} fmt={v => signed(v, 2)} />
          {chosen.some(t => t.inProgress) && (
            <div style={{ padding: '10px 12px', fontSize: '11px', color: muted, lineHeight: 1.6, borderTop: `1px solid ${border}`, background: cardBg }}>
              {chosen.filter(t => t.inProgress).map(t => `${t.name} ${t.year}`).join(', ')} {chosen.filter(t => t.inProgress).length > 1 ? 'are' : 'is'} still in progress, so every number is per game (through {Math.max(...chosen.filter(t => t.inProgress).map(t => t.games))} games) and has no final outcome yet.
            </div>
          )}
        </Section>

        <Section title="Outcome">
          <StatRow i={0} label="Final standing" get={t => (t.inProgress ? null : t.finalStanding)} fmt={v => `#${v}`} higher={false} alt={t => (t.inProgress ? (t.currentRank ? `#${t.currentRank} right now` : 'in progress') : null)} />
          <StatRow i={1} label="Made playoffs" get={t => (t.inProgress ? null : t.madePlayoffs ? 1 : 0)} fmt={v => (v ? '✓' : '—')} alt={t => (t.inProgress ? 'in progress' : null)} />
          <StatRow i={2} label="Champion" get={t => (t.inProgress ? null : t.result === 'Champion' ? 1 : 0)} fmt={v => (v ? '🏆' : '—')} alt={t => (t.inProgress ? 'in progress' : null)} />
        </Section>

        <Section title="Roster · season scoring by lineup slot">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '10px 12px', borderBottom: `1px solid ${border}`, background: cardBg }}>
            {TIERS.map(tr => <span key={tr.key} style={{ background: tr.bg, color: tr.fg, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', padding: '3px 9px' }}>{tr.label}</span>)}
            <span style={{ fontSize: '10px', color: muted, alignSelf: 'center' }}>tier = where the slot ranks among every team ever · outlined = best in the row</span>
          </div>
          {SLOT_ORDER.map((slot, i) => {
            const vals = chosen.map(t => t.slots[slot]?.ppg ?? 0)
            const best = Math.max(...vals)
            return (
              <div key={slot} style={{ display: 'grid', gridTemplateColumns: cols, borderTop: i ? `1px solid ${border}` : 'none' }}>
                <div style={{ padding: '10px 12px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: muted, display: 'flex', alignItems: 'center' }}>{slot}</div>
                {chosen.map((t, k) => {
                  const p = t.slots[slot]
                  const tr = p && index.tierOf(slot, p.ppg)
                  const isBest = p && best > 0 && p.ppg === best && chosen.length > 1
                  return (
                    <div key={t.id} title={p ? `${p.name} · ${p.ppg.toFixed(1)} ppg${p.games ? ` over ${p.games} games` : ' (season average)'}` : ''} style={{ padding: '8px 8px', textAlign: 'center', background: tr ? tr.bg : 'transparent', color: tr ? tr.fg : muted, boxShadow: isBest ? `inset 0 0 0 2px ${d ? '#fff' : '#0d2152'}` : 'none', minHeight: '46px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '15px', fontWeight: 700 }}>{p ? p.ppg.toFixed(1) : '—'}</div>
                      <div style={{ fontSize: '10px', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p?.name || ''}</div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {Array.from({ length: benchRows }, (_, b) => (
            <div key={`bn${b}`} style={{ display: 'grid', gridTemplateColumns: cols, borderTop: `1px solid ${border}`, background: b % 2 ? rowAlt : 'transparent' }}>
              <div style={{ padding: '8px 12px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: muted }}>{b === 0 ? 'Bench 1' : `BN ${b + 1}`}</div>
              {chosen.map(t => { const p = t.bench[b]; return (
                <div key={t.id} style={{ padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: p ? text : muted }}>{p ? p.ppg.toFixed(1) : '—'}</div>
                  <div style={{ fontSize: '10px', color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p?.name || ''}</div>
                </div>
              ) })}
            </div>
          ))}
          <div style={{ borderTop: `2px solid ${border}` }}>
            <StatRow i={0} label="Starters PPG" get={t => t.starterPpg} />
            <StatRow i={1} label="Avg per slot" get={t => t.starterPpg / SLOT_ORDER.length} />
            <StatRow i={2} label="Whole roster PPG" get={t => t.rosterPpg} />
            <div style={{ display: 'grid', gridTemplateColumns: cols, borderTop: `1px solid ${border}` }}>
              <div style={{ padding: '10px 12px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: muted }}>Slots won</div>
              {slotWins.map((w, k) => { const best = Math.max(...slotWins); return <div key={chosen[k].id} style={{ padding: '10px', textAlign: 'center', fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: w === best && best > 0 ? 700 : 400, background: w === best && best > 0 ? tint(GREEN, '30') : 'transparent' }}>{w} <span style={{ fontSize: '11px', color: muted }}>of {SLOT_ORDER.length}</span></div> })}
            </div>
            {TIERS.map(tr => (
              <div key={tr.key} style={{ display: 'grid', gridTemplateColumns: cols, borderTop: `1px solid ${border}` }}>
                <div style={{ padding: '7px 12px', fontSize: '11px', background: tr.bg, color: tr.fg, fontWeight: 700 }}>{tr.label}</div>
                {chosen.map((t, k) => <div key={t.id} style={{ padding: '7px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>{tierCounts[k][tr.key]}</div>)}
              </div>
            ))}
          </div>
        </Section>

        {chosen.length > 1 && matrix.week > 0 && (
          <Section title={`Similarity matrix · through week ${matrix.week}`}>
            <div style={{ display: 'grid', gridTemplateColumns: cols, background: cardBg }}>
              <div style={{ padding: '10px 12px' }} />
              {chosen.map(t => <div key={t.id} style={{ padding: '10px 8px', textAlign: 'center', fontSize: '12px', color: colorOf(t), fontWeight: 700 }}>{t.name} {t.year}</div>)}
            </div>
            {chosen.map((a, i) => (
              <div key={a.id} style={{ display: 'grid', gridTemplateColumns: cols, borderTop: `1px solid ${border}` }}>
                <div style={{ padding: '10px 12px', fontSize: '12px', color: colorOf(a), fontWeight: 700 }}>{a.name} {a.year}</div>
                {chosen.map((b, j) => {
                  const r = matrix.cells[i]?.[j]
                  if (i === j) return <div key={b.id} style={{ padding: '10px', textAlign: 'center', color: muted }}>—</div>
                  if (!r) return <div key={b.id} style={{ padding: '10px', textAlign: 'center', color: muted }}>n/a</div>
                  const c = r.similarity >= 60 ? GREEN : r.similarity >= 40 ? GOLD : ORANGE
                  return (
                    <div key={b.id} style={{ padding: '8px', textAlign: 'center', background: tint(c, '1c') }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '16px', color: c }}>{Math.round(r.similarity)}%</div>
                      <div style={{ fontSize: '9px', color: muted }}>{r.matched.length ? `≈ ${r.matched.join(', ')}` : ''}</div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div style={{ padding: '10px 12px', fontSize: '11px', color: muted, lineHeight: 1.6, borderTop: `1px solid ${border}` }}>
              Similarity weighs record, scoring, power score, all-play %, luck, consistency and the roster's scoring split; 100% is identical and about 37% is one standard deviation apart on average.
            </div>
          </Section>
        )}
      </div>
    )
  }

  // The record needs both W and L in one cell, so it has its own row.
  function RecordRow() {
    const pcts = chosen.map(t => (t.wins + t.losses ? t.wins / (t.wins + t.losses) : null))
    const best = chosen.length > 1 ? Math.max(...pcts.filter(v => v != null)) : null
    return (
      <div style={{ display: 'grid', gridTemplateColumns: cols, background: rowAlt, borderTop: `1px solid ${border}` }}>
        <div style={{ padding: '10px 12px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: muted, display: 'flex', alignItems: 'center' }}>Record</div>
        {chosen.map((t, k) => {
          const isBest = best != null && pcts[k] === best
          return <div key={t.id} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '15px', fontWeight: isBest ? 700 : 400, background: isBest ? tint(GREEN, '30') : 'transparent', color: isBest ? (d ? '#9fe3b3' : '#136b2d') : text, fontFamily: "'Playfair Display', serif" }}>{t.wins}-{t.losses}</div>
        })}
      </div>
    )
  }

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '34px' : 'clamp(36px, 5vw, 60px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: '6px' }}>All-Time Team Comparison</h1>
        <p style={{ color: muted, fontSize: '13px', maxWidth: '640px', lineHeight: 1.6, marginBottom: '28px' }}>
          Put up to four team-seasons side by side — any manager, any year. Pick one and the most similar teams in league history are one click away, or search every team ever by PPG, power score, year or manager.
        </p>
        {error && <p style={{ color: RED, fontSize: '13px' }}>{error}</p>}
        {!index && !error && <p style={{ color: muted, fontSize: '13px' }}>Loading every season…</p>}
        {index && (
          <>
            {/* called, not rendered as <Components/>: they close over page state, and a
                component type recreated each render would remount the filter inputs
                (losing focus) on every keystroke */}
            {Tray()}
            {Picker()}
            {Comparison()}
          </>
        )}
      </div>
    </div>
  )
}
