'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const ADMIN_PIN = '2910'
const NUM_PICKS = 10

export default function DraftPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, green, red, gold } = useLayout()

  const [picks, setPicks] = useState([])
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  // draft slots: array of 10 manager names (or '' if unassigned)
  const [slots, setSlots] = useState(Array(NUM_PICKS).fill(''))

  // admin pin modal for edit/clear
  const [pinModal, setPinModal] = useState(null) // 'edit' | 'clear-one' | 'clear-all'
  const [clearTarget, setClearTarget] = useState(null) // pick_id for clear-one
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('draft_order').select('*').eq('season', '2026-27').order('pick_number'),
      supabase.from('managers').select('id, name').order('name'),
    ])
    setPicks(p || [])
    setManagers(m || [])
    setLoading(false)
  }

  const handlePinSubmit = () => {
    if (pinInput !== ADMIN_PIN) { setPinError('Incorrect PIN'); return }
    setPinError(''); setPinInput('')
    if (pinModal === 'edit') {
      const current = Array(NUM_PICKS).fill('')
      picks.forEach(p => { if (p.pick_number >= 1 && p.pick_number <= NUM_PICKS) current[p.pick_number - 1] = p.manager_name })
      setSlots(current)
      setEditing(true)
      setPinModal(null)
    } else if (pinModal === 'clear-one' && clearTarget) {
      supabase.from('draft_order').delete().eq('id', clearTarget).then(() => { setClearTarget(null); setPinModal(null); fetchAll() })
    } else if (pinModal === 'clear-all') {
      supabase.from('draft_order').delete().eq('season', '2026-27').then(() => { setPinModal(null); fetchAll() })
    }
  }

  const handleSave = async () => {
    if (slots.every(s => !s)) return setSaveError('Assign at least one pick.')
    setSaveError('')
    setSubmitting(true)
    // Delete existing and re-insert all assigned picks
    await supabase.from('draft_order').delete().eq('season', '2026-27')
    const inserts = slots
      .map((name, i) => name ? { pick_number: i + 1, manager_name: name, season: '2026-27' } : null)
      .filter(Boolean)
    const { error } = await supabase.from('draft_order').insert(inserts)
    if (error) { setSaveError('Failed to save. Try again.'); setSubmitting(false); return }
    setEditing(false)
    setSubmitting(false)
    fetchAll()
  }

  if (!mounted) return null

  const inp = {
    background: d ? '#111' : '#e8e4dc', border: `1px solid ${border}`, color: text,
    padding: '8px 12px', fontSize: '13px', fontFamily: "'Inter', sans-serif", outline: 'none', width: '100%',
  }

  const managerOptions = managers.map(m => m.name)

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />

      {/* PIN modal */}
      {pinModal && (
        <>
          <div onClick={() => { setPinModal(null); setPinInput(''); setPinError('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: d ? '#0a0a0a' : '#f4f1ec', border: `1px solid ${border}`, padding: '32px', width: effectiveMobile ? '90vw' : '340px' }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: text, marginBottom: '8px' }}>
              {pinModal === 'edit' ? 'Edit Draft Order' : pinModal === 'clear-all' ? 'Clear All Picks' : 'Remove Pick'}
            </h3>
            <p style={{ fontSize: '12px', color: muted, marginBottom: '20px' }}>Admin PIN required.</p>
            <input type="password" placeholder="PIN" value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError('') }}
              onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
              style={{ ...inp, marginBottom: '8px' }} />
            {pinError && <p style={{ fontSize: '12px', color: red, marginBottom: '8px' }}>{pinError}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={handlePinSubmit} style={{ background: pinModal === 'edit' ? text : red, color: pinModal === 'edit' ? bg : '#fff', border: 'none', padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif", fontWeight: '500', flex: 1 }}>
                {pinModal === 'edit' ? 'Unlock' : 'Confirm'}
              </button>
              <button onClick={() => { setPinModal(null); setPinInput(''); setPinError('') }} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px,6vw,72px)', fontWeight: '400', letterSpacing: '-0.02em' }}>2026-27 Draft</h1>
            <p style={{ color: muted, fontSize: '12px', marginTop: '4px' }}>Draft order for the upcoming season</p>
          </div>
          {!editing && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setPinModal('edit'); setPinInput(''); setPinError('') }} style={{ background: text, color: bg, border: 'none', padding: '10px 18px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500' }}>
                {picks.length > 0 ? 'Edit Order' : 'Set Draft Order'}
              </button>
              {picks.length > 0 && (
                <button onClick={() => { setPinModal('clear-all'); setPinInput(''); setPinError('') }} style={{ background: 'none', border: `1px solid ${red}`, color: red, padding: '10px 14px', cursor: 'pointer', fontSize: '11px', fontFamily: "'Inter', sans-serif" }}>Clear</button>
              )}
            </div>
          )}
          {editing && (
            <button onClick={() => { setEditing(false); setSaveError('') }} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '8px 16px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>← Cancel</button>
          )}
        </div>

        {loading && <p style={{ color: muted, fontSize: '13px' }}>Loading...</p>}

        {/* Read-only board */}
        {!loading && !editing && (
          <>
            {picks.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center' }}>
                <p style={{ color: muted, fontSize: '14px', marginBottom: '16px' }}>No draft order set yet.</p>
                <button onClick={() => { setPinModal('edit'); setPinInput(''); setPinError('') }} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '8px 20px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>Set Draft Order</button>
              </div>
            ) : (
              <div style={{ border: `1px solid ${border}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', padding: '8px 16px', borderBottom: `1px solid ${border}`, background: cardBg }}>
                  <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted }}>Pick</span>
                  <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted }}>Manager</span>
                </div>
                {picks.map((pick, i) => (
                  <div key={pick.id} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', alignItems: 'center', padding: '14px 16px', borderBottom: i < picks.length - 1 ? `1px solid ${border}` : 'none', background: i % 2 === 0 ? 'transparent' : (d ? '#080808' : '#e8e4dc') }}>
                    <span style={{ fontSize: '24px', fontWeight: '700', color: gold, fontFamily: "'Playfair Display', serif" }}>{pick.pick_number}</span>
                    <span style={{ fontSize: '16px', color: text, fontFamily: "'Playfair Display', serif" }}>{pick.manager_name}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Edit form */}
        {editing && (
          <div>
            <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, marginBottom: '16px' }}>Assign managers to each pick slot</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {slots.map((val, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '48px 1fr', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '22px', fontWeight: '700', color: gold, fontFamily: "'Playfair Display', serif", textAlign: 'right' }}>{i + 1}</span>
                  <select
                    value={val}
                    onChange={e => setSlots(s => { const n = [...s]; n[i] = e.target.value; return n })}
                    style={{ ...inp, cursor: 'pointer' }}
                  >
                    <option value="">— unassigned —</option>
                    {managerOptions.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {saveError && <p style={{ fontSize: '12px', color: red, marginBottom: '12px' }}>{saveError}</p>}
            <button onClick={handleSave} disabled={submitting} style={{ background: text, color: bg, border: 'none', padding: '14px 28px', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Saving...' : 'Save Draft Order'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
