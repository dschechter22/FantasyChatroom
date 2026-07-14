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

export default function DraftPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, green, red, gold } = useLayout()

  const [picks, setPicks] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('board')
  const [form, setForm] = useState({ pick_number: '', manager_name: '' })
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pinModal, setPinModal] = useState(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { fetchPicks() }, [])

  const fetchPicks = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('draft_order')
      .select('*')
      .eq('season', '2026-27')
      .order('pick_number', { ascending: true })
    setPicks(data || [])
    setLoading(false)
  }

  const handleSubmit = async () => {
    const pickNum = parseInt(form.pick_number)
    if (!pickNum || pickNum < 1) return setFormError('Pick number is required.')
    if (!form.manager_name.trim()) return setFormError('Manager name is required.')
    setFormError('')
    setSubmitting(true)
    const { error } = await supabase.from('draft_order').insert({
      pick_number: pickNum,
      manager_name: form.manager_name.trim(),
      season: '2026-27',
    })
    if (error) {
      setFormError('Failed to save. Try again.')
      setSubmitting(false)
      return
    }
    setFormSuccess('Pick added!')
    setSubmitting(false)
    setForm({ pick_number: '', manager_name: '' })
    setView('board')
    fetchPicks()
  }

  const handlePinSubmit = async () => {
    const { pickId } = pinModal
    if (pinInput !== ADMIN_PIN) { setPinError('Incorrect PIN.'); return }
    setPinError(''); setPinModal(null); setPinInput('')
    await supabase.from('draft_order').delete().eq('id', pickId)
    fetchPicks()
  }

  if (!mounted) return null

  const inputStyle = {
    background: d ? '#111' : '#e8e4dc', border: `1px solid ${border}`, color: text,
    padding: '10px 14px', fontSize: '13px', fontFamily: "'Inter', sans-serif",
    outline: 'none', width: '100%',
  }
  const labelStyle = {
    fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
    color: muted, marginBottom: '6px', display: 'block',
  }

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />

      {pinModal && (
        <>
          <div onClick={() => { setPinModal(null); setPinInput(''); setPinError('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: d ? '#0a0a0a' : '#f4f1ec', border: `1px solid ${border}`, padding: '32px', width: effectiveMobile ? '90vw' : '360px' }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: text, marginBottom: '8px' }}>Delete Pick</h3>
            <p style={{ fontSize: '12px', color: muted, marginBottom: '20px' }}>Enter your PIN to delete this pick.</p>
            <input type="password" placeholder="PIN" value={pinInput} onChange={e => { setPinInput(e.target.value); setPinError('') }} onKeyDown={e => e.key === 'Enter' && handlePinSubmit()} style={{ ...inputStyle, marginBottom: '8px' }} />
            {pinError && <p style={{ fontSize: '12px', color: red, marginBottom: '8px' }}>{pinError}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={handlePinSubmit} style={{ background: red, color: '#fff', border: 'none', padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif", fontWeight: '500', flex: 1 }}>Delete</button>
              <button onClick={() => { setPinModal(null); setPinInput(''); setPinError('') }} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px, 6vw, 72px)', fontWeight: '400', letterSpacing: '-0.02em' }}>2026-27 Draft</h1>
            <p style={{ color: muted, fontSize: '12px', marginTop: '4px' }}>Draft order for the upcoming season</p>
          </div>
          {view === 'board' && (
            <button onClick={() => { setView('new'); setFormError(''); setFormSuccess('') }} style={{ background: text, color: bg, border: 'none', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500', marginBottom: '8px' }}>
              + Add Pick
            </button>
          )}
          {view === 'new' && (
            <button onClick={() => { setView('board'); setFormError(''); setFormSuccess('') }} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '8px 16px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", marginBottom: '8px' }}>← Back</button>
          )}
        </div>

        {view === 'board' && (
          <>
            {loading && <p style={{ color: muted, fontSize: '14px', marginTop: '24px' }}>Loading...</p>}

            {!loading && picks.length === 0 && (
              <div style={{ padding: '48px 0', textAlign: 'center' }}>
                <p style={{ color: muted, fontSize: '14px', marginBottom: '16px' }}>No picks posted yet.</p>
                <button onClick={() => setView('new')} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '8px 20px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>Post draft order</button>
              </div>
            )}

            {!loading && picks.length > 0 && (
              <div style={{ marginTop: '24px', border: `1px solid ${border}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 40px', padding: '8px 16px', borderBottom: `1px solid ${border}`, background: cardBg }}>
                  <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted }}>Pick</span>
                  <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted }}>Manager</span>
                  <span />
                </div>
                {picks.map((pick, i) => (
                  <div key={pick.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 40px', alignItems: 'center', padding: '14px 16px', borderBottom: i < picks.length - 1 ? `1px solid ${border}` : 'none', background: i % 2 === 0 ? 'transparent' : (d ? '#080808' : '#e8e4dc') }}>
                    <span style={{ fontSize: '22px', fontWeight: '700', color: gold, fontFamily: "'Playfair Display', serif" }}>
                      {pick.pick_number}
                    </span>
                    <span style={{ fontSize: '15px', color: text, fontFamily: "'Playfair Display', serif" }}>
                      {pick.manager_name}
                    </span>
                    <button onClick={() => { setPinModal({ pickId: pick.id }); setPinInput(''); setPinError('') }} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '13px', padding: '4px', lineHeight: 1 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view === 'new' && (
          <div style={{ marginTop: '32px' }}>
            <p style={{ color: muted, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '32px' }}>Add draft pick</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr' : '120px 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Pick #</label>
                  <input
                    type="number"
                    min="1"
                    value={form.pick_number}
                    onChange={e => setForm(f => ({ ...f, pick_number: e.target.value }))}
                    placeholder="1"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Manager Name</label>
                  <input
                    value={form.manager_name}
                    onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))}
                    placeholder="e.g. Danny"
                    style={inputStyle}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
              </div>
{formError && <p style={{ fontSize: '12px', color: red }}>{formError}</p>}
              {formSuccess && <p style={{ fontSize: '12px', color: green }}>{formSuccess}</p>}
              <button onClick={handleSubmit} disabled={submitting} style={{ background: text, color: bg, border: 'none', padding: '14px 28px', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500', opacity: submitting ? 0.6 : 1, alignSelf: 'flex-start' }}>
                {submitting ? 'Saving...' : 'Add Pick'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
