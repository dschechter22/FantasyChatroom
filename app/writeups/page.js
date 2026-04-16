'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const ADMIN_PIN = '2910'
const TYPES = ['power_rankings', 'weekly_summary', 'other']
const TYPE_LABELS = { power_rankings: 'Power Rankings', weekly_summary: 'Weekly Summary', other: 'Other' }
const WEEKS = Array.from({ length: 17 }, (_, i) => i + 1)
const YEARS = Array.from({ length: 11 }, (_, i) => 2015 + i)

export default function WriteupsPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, rowAlt, green, red, gold } = useLayout()

  const [writeups, setWriteups] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('feed') // 'feed' | 'new' | 'edit'
  const [editTarget, setEditTarget] = useState(null)

  // Feed filters
  const [filterYear, setFilterYear] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterAuthor, setFilterAuthor] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  // PIN modal
  const [pinModal, setPinModal] = useState(null) // { writeupId, action: 'edit'|'delete' }
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')

  // Form state
  const [form, setForm] = useState({
    season_year: 2025, week: '', type: 'power_rankings',
    title: '', content: '', author_name: '', pin: '',
  })
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchWriteups()
  }, [])

  const fetchWriteups = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('writeups')
      .select('*')
      .order('season_year', { ascending: false })
      .order('week', { ascending: false })
      .order('created_at', { ascending: false })
    setWriteups(data || [])
    setLoading(false)
  }

  const allAuthors = [...new Set(writeups.map(w => w.author_name))].filter(Boolean).sort()

  const filteredWriteups = writeups.filter(w => {
    if (filterYear !== 'all' && w.season_year !== parseInt(filterYear)) return false
    if (filterType !== 'all' && w.type !== filterType) return false
    if (filterAuthor !== 'all' && w.author_name !== filterAuthor) return false
    return true
  })

  const handleSubmit = async () => {
    if (!form.title.trim()) return setFormError('Title is required.')
    if (!form.content.trim()) return setFormError('Content is required.')
    if (!form.author_name.trim()) return setFormError('Author name is required.')
    if (!form.pin.trim() || form.pin.length < 4) return setFormError('PIN must be at least 4 digits.')
    setFormError('')
    setSubmitting(true)

    if (editTarget) {
      const { error } = await supabase
        .from('writeups')
        .update({
          season_year: form.season_year,
          week: form.week || null,
          type: form.type,
          title: form.title,
          content: form.content,
          author_name: form.author_name,
        })
        .eq('id', editTarget.id)
      if (error) { setFormError('Failed to save. Try again.'); setSubmitting(false); return }
      setFormSuccess('Writeup updated.')
    } else {
      const { error } = await supabase
        .from('writeups')
        .insert({
          season_year: form.season_year,
          week: form.week || null,
          type: form.type,
          title: form.title,
          content: form.content,
          author_name: form.author_name,
          pin: form.pin,
        })
      if (error) { setFormError('Failed to save. Try again.'); setSubmitting(false); return }
      setFormSuccess('Writeup posted!')
    }

    setSubmitting(false)
    setForm({ season_year: 2025, week: '', type: 'power_rankings', title: '', content: '', author_name: '', pin: '' })
    setEditTarget(null)
    setView('feed')
    fetchWriteups()
  }

  const handlePinSubmit = async () => {
    const { writeupId, action } = pinModal
    const writeup = writeups.find(w => w.id === writeupId)
    if (!writeup) return

    const isValid = pinInput === writeup.pin || pinInput === ADMIN_PIN
    if (!isValid) { setPinError('Incorrect PIN.'); return }

    setPinError('')
    setPinModal(null)
    setPinInput('')

    if (action === 'delete') {
      await supabase.from('writeups').delete().eq('id', writeupId)
      fetchWriteups()
    } else if (action === 'edit') {
      setForm({
        season_year: writeup.season_year,
        week: writeup.week || '',
        type: writeup.type,
        title: writeup.title,
        content: writeup.content,
        author_name: writeup.author_name,
        pin: writeup.pin,
      })
      setEditTarget(writeup)
      setView('edit')
    }
  }

  const inputStyle = {
    background: d ? '#111' : '#e8e4dc', border: `1px solid ${border}`, color: text,
    padding: '10px 14px', fontSize: '13px', fontFamily: "'Inter', sans-serif",
    outline: 'none', width: '100%',
  }

  const selectStyle = { ...inputStyle, cursor: 'pointer' }

  const labelStyle = {
    fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
    color: muted, marginBottom: '6px', display: 'block',
  }

  const filterBtn = (active, label, onClick) => (
    <button onClick={onClick} style={{
      background: active ? text : 'none', border: `1px solid ${border}`,
      color: active ? bg : muted, padding: effectiveMobile ? '5px 10px' : '6px 14px',
      cursor: 'pointer', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
      fontFamily: "'Inter', sans-serif", fontWeight: '500', transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>{label}</button>
  )

  const typeColor = (type) => {
    if (type === 'power_rankings') return gold
    if (type === 'weekly_summary') return d ? '#93c5fd' : '#1e3a8a'
    return muted
  }

  // Simple markdown renderer -- bold, italic, line breaks
  const renderContent = (content) => {
    if (!content) return ''
    return content
      .split('\n')
      .map((line, i) => {
        const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        const italic = bold.replace(/\*(.*?)\*/g, '<em>$1</em>')
        return `<p key="${i}" style="margin-bottom:10px;line-height:1.7">${italic || '&nbsp;'}</p>`
      })
      .join('')
  }

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />

      {/* PIN Modal */}
      {pinModal && (
        <>
          <div onClick={() => { setPinModal(null); setPinInput(''); setPinError('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: d ? '#0a0a0a' : '#f4f1ec', border: `1px solid ${border}`, padding: '32px', width: effectiveMobile ? '90vw' : '360px' }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: text, marginBottom: '8px' }}>
              {pinModal.action === 'delete' ? 'Delete Writeup' : 'Edit Writeup'}
            </h3>
            <p style={{ fontSize: '12px', color: muted, marginBottom: '20px' }}>Enter your PIN to continue.</p>
            <input
              type="password"
              placeholder="PIN"
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError('') }}
              onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
              style={{ ...inputStyle, marginBottom: '8px' }}
            />
            {pinError && <p style={{ fontSize: '12px', color: red, marginBottom: '8px' }}>{pinError}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={handlePinSubmit} style={{ background: pinModal.action === 'delete' ? red : text, color: pinModal.action === 'delete' ? '#fff' : bg, border: 'none', padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif", fontWeight: '500', flex: 1 }}>
                {pinModal.action === 'delete' ? 'Delete' : 'Edit'}
              </button>
              <button onClick={() => { setPinModal(null); setPinInput(''); setPinError('') }} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px, 6vw, 72px)', fontWeight: '400', letterSpacing: '-0.02em' }}>
            Writeups
          </h1>
          {view === 'feed' && (
            <button
              onClick={() => { setView('new'); setEditTarget(null); setForm({ season_year: 2025, week: '', type: 'power_rankings', title: '', content: '', author_name: '', pin: '' }); setFormError(''); setFormSuccess('') }}
              style={{ background: text, color: bg, border: 'none', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500', marginBottom: '8px' }}
            >
              + New Writeup
            </button>
          )}
          {(view === 'new' || view === 'edit') && (
            <button onClick={() => { setView('feed'); setEditTarget(null); setFormError(''); setFormSuccess('') }} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '8px 16px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", marginBottom: '8px' }}>
              ← Back
            </button>
          )}
        </div>

        {/* FEED VIEW */}
        {view === 'feed' && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', flexDirection: effectiveMobile ? 'column' : 'row', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ ...selectStyle, width: effectiveMobile ? '100%' : '140px' }}>
                <option value="all">All Years</option>
                {YEARS.slice().reverse().map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...selectStyle, width: effectiveMobile ? '100%' : '180px' }}>
                <option value="all">All Types</option>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
              <select value={filterAuthor} onChange={e => setFilterAuthor(e.target.value)} style={{ ...selectStyle, width: effectiveMobile ? '100%' : '160px' }}>
                <option value="all">All Authors</option>
                {allAuthors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {loading && <p style={{ color: muted, fontSize: '14px' }}>Loading...</p>}

            {!loading && filteredWriteups.length === 0 && (
              <div style={{ padding: '48px 0', textAlign: 'center' }}>
                <p style={{ color: muted, fontSize: '14px', marginBottom: '16px' }}>No writeups yet.</p>
                <button onClick={() => setView('new')} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '8px 20px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>
                  Be the first to write one
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {filteredWriteups.map((w, i) => {
                const isExpanded = expandedId === w.id
                return (
                  <div key={w.id} style={{ background: cardBg, border: `1px solid ${border}` }}>
                    {/* Header */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : w.id)}
                      style={{ padding: effectiveMobile ? '16px' : '20px 24px', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: typeColor(w.type), border: `1px solid ${typeColor(w.type)}`, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                              {TYPE_LABELS[w.type]}
                            </span>
                            <span style={{ fontSize: '11px', color: muted }}>
                              {w.season_year}{w.week ? ` · Week ${w.week}` : ''}
                            </span>
                            <span style={{ fontSize: '11px', color: muted }}>· {w.author_name}</span>
                          </div>
                          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '17px' : '20px', color: text, fontWeight: '400' }}>
                            {w.title}
                          </h3>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '11px', color: muted }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    {isExpanded && (
                      <div style={{ borderTop: `1px solid ${border}`, padding: effectiveMobile ? '16px' : '20px 24px' }}>
                        <div
                          style={{ fontSize: '14px', color: text, lineHeight: 1.7, marginBottom: '20px' }}
                          dangerouslySetInnerHTML={{ __html: renderContent(w.content) }}
                        />
                        <div style={{ display: 'flex', gap: '8px', borderTop: `1px solid ${border}`, paddingTop: '16px' }}>
                          <button
                            onClick={() => { setPinModal({ writeupId: w.id, action: 'edit' }); setPinInput(''); setPinError('') }}
                            style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '6px 14px', cursor: 'pointer', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { setPinModal({ writeupId: w.id, action: 'delete' }); setPinInput(''); setPinError('') }}
                            style={{ background: 'none', border: `1px solid ${red}`, color: red, padding: '6px 14px', cursor: 'pointer', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* NEW / EDIT FORM */}
        {(view === 'new' || view === 'edit') && (
          <div>
            <p style={{ color: muted, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '32px' }}>
              {view === 'edit' ? 'Editing writeup' : 'New writeup'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Row 1: year, week, type */}
              <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Season Year</label>
                  <select value={form.season_year} onChange={e => setForm(f => ({ ...f, season_year: parseInt(e.target.value) }))} style={selectStyle}>
                    {YEARS.slice().reverse().map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Week (optional)</label>
                  <select value={form.week} onChange={e => setForm(f => ({ ...f, week: e.target.value }))} style={selectStyle}>
                    <option value="">Season-level</option>
                    {WEEKS.map(w => <option key={w} value={w}>Week {w}</option>)}
                  </select>
                </div>
                <div style={effectiveMobile ? { gridColumn: '1 / -1' } : {}}>
                  <label style={labelStyle}>Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={selectStyle}>
                    {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label style={labelStyle}>Title</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Week 7 Power Rankings"
                  style={inputStyle}
                />
              </div>

              {/* Content */}
              <div>
                <label style={labelStyle}>Content · supports **bold** and *italic*</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Write your writeup here..."
                  rows={effectiveMobile ? 12 : 18}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                />
              </div>

              {/* Author + PIN */}
              <div style={{ display: 'grid', gridTemplateColumns: effectiveMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Your Name</label>
                  <input
                    value={form.author_name}
                    onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
                    placeholder="e.g. Dan"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{view === 'edit' ? 'Current PIN (to verify)' : 'Set a PIN (to edit/delete later)'}</label>
                  <input
                    type="password"
                    value={form.pin}
                    onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
                    placeholder="4+ digit PIN"
                    style={inputStyle}
                  />
                </div>
              </div>

              {formError && <p style={{ fontSize: '12px', color: red }}>{formError}</p>}
              {formSuccess && <p style={{ fontSize: '12px', color: green }}>{formSuccess}</p>}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ background: text, color: bg, border: 'none', padding: '14px 28px', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500', opacity: submitting ? 0.6 : 1, alignSelf: 'flex-start' }}
              >
                {submitting ? 'Saving...' : view === 'edit' ? 'Save Changes' : 'Post Writeup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
