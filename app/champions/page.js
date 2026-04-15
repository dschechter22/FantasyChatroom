'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function ChampionsPage() {
  const [theme, setTheme] = useState('dark')
  const [seasons, setSeasons] = useState([])

  useEffect(() => {
    const saved = localStorage.getItem('fc-theme') || 'dark'
    setTheme(saved)
    document.body.setAttribute('data-theme', saved)

    supabase
      .from('seasons')
      .select(`
        year, season_number,
        champion:champion_id(name, slug),
        mol_bowl_winner:mol_bowl_winner_id(name, slug),
        mol_bowl_loser:mol_bowl_loser_id(name, slug)
      `)
      .order('year', { ascending: false })
      .then(({ data }) => setSeasons(data || []))
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('fc-theme', next)
    document.body.setAttribute('data-theme', next)
  }

  const d = theme === 'dark'
  const bg = d ? '#000' : '#f4f1ec'
  const text = d ? '#fff' : '#0d2152'
  const muted = d ? 'rgba(255,255,255,0.38)' : 'rgba(13,33,82,0.85)'
  const border = d ? 'rgba(255,255,255,0.1)' : 'rgba(13,33,82,0.14)'
  const cardBg = d ? '#0a0a0a' : '#ede9e2'
  const statsBg = d ? '#080808' : '#e8e4dc'

  const championCounts = {}
  seasons.forEach(s => {
    if (s.champion) {
      championCounts[s.champion.name] = (championCounts[s.champion.name] || 0) + 1
    }
  })

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif", transition: 'background 0.2s, color 0.2s' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 48px',
        background: d ? 'rgba(0,0,0,0.88)' : 'rgba(244,241,236,0.95)',
        borderBottom: `1px solid ${border}`,
        backdropFilter: 'blur(10px)',
      }}>
        <a href="/" style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: '400', color: text, textDecoration: 'none' }}>Fantasy Chatroom</a>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {[['Champions','/champions'],['Standings','/standings'],['H2H','/h2h'],['Season','/season'],['Rivalries','/rivalries'],['Managers','/managers'],['Writeups','/writeups'],['Power Rankings','/power-rankings'],['LJ Index','/lj-index']].map(([label, href]) => (
            <a key={href} href={href} style={{ color: muted, textDecoration: 'none', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: '500' }}>{label}</a>
          ))}
          <button onClick={toggleTheme} style={{ background: 'none', border: `1px solid ${border}`, color: muted, padding: '6px 14px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", fontWeight: '500' }}>
            {d ? 'Light' : 'Dark'}
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '120px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: '400', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          Hall of Champions
        </h1>
        <p style={{ color: muted, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '64px' }}>
          {seasons.length} seasons &nbsp;&middot;&nbsp; Est. 2015
        </p>

        <div style={{ marginBottom: '80px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: muted, marginBottom: '24px' }}>Championship Count</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {Object.entries(championCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => (
                <div key={name} style={{ padding: '12px 20px', border: `1px solid ${border}`, background: cardBg, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontWeight: '400', color: text }}>{count}</span>
                  <span style={{ fontSize: '13px', color: muted }}>{name}</span>
                </div>
              ))}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${border}` }}>
          {seasons.map((season, i) => (
            <div key={season.year} style={{
              display: 'grid', gridTemplateColumns: '80px 1fr 1fr',
              padding: '28px 0',
              borderBottom: `1px solid ${border}`,
              alignItems: 'center',
              gap: '24px'
            }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', fontWeight: '400', color: i === 0 ? text : muted }}>{season.year}</div>
                <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginTop: '2px' }}>Year {season.season_number}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '6px' }}>Champion</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: '400', color: text }}>
                  {season.champion?.name || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: '6px' }}>Mol Bowl</div>
                <div style={{ fontSize: '14px', color: muted }}>
                  {season.mol_bowl_winner ? `${season.mol_bowl_winner.name} def. ${season.mol_bowl_loser?.name}` : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
