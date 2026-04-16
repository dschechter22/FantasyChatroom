'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  ['Champions', '/champions'],
  ['Standings', '/standings'],
  ['H2H', '/h2h'],
  ['Season', '/season'],
  ['Rivalries', '/rivalries'],
  ['Managers', '/managers'],
  ['Writeups', '/writeups'],
  ['Power Rankings', '/power-rankings'],
  ['LJ Index', '/lj-index'],
  ['All-Time Teams', '/all-time-teams'],
]

export default function Nav() {
  const pathname = usePathname()
  const [theme, setTheme] = useState('light')
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOverride, setMobileOverride] = useState(null) // 'mobile' | 'desktop' | null
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    // Theme
    const savedTheme = localStorage.getItem('fc-theme') || 'light'
    setTheme(savedTheme)
    document.body.setAttribute('data-theme', savedTheme)

    // Mobile override
    const savedOverride = localStorage.getItem('fc-layout')
    if (savedOverride) setMobileOverride(savedOverride)

    // Auto-detect
    const checkSize = () => setIsMobile(window.innerWidth < 768)
    checkSize()
    window.addEventListener('resize', checkSize)
    return () => window.removeEventListener('resize', checkSize)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('fc-theme', next)
    document.body.setAttribute('data-theme', next)
    window.dispatchEvent(new CustomEvent('fc-theme-change', { detail: next }))
  }

  const toggleLayout = () => {
    const effectiveMobile = mobileOverride ? mobileOverride === 'mobile' : isMobile
    const next = effectiveMobile ? 'desktop' : 'mobile'
    setMobileOverride(next)
    localStorage.setItem('fc-layout', next)
    window.dispatchEvent(new CustomEvent('fc-layout-change', { detail: next }))
  }

  const effectiveMobile = mobileOverride ? mobileOverride === 'mobile' : isMobile

  const d = theme === 'dark'
  const bg = d ? 'rgba(0,0,0,0.92)' : 'rgba(244,241,236,0.97)'
  const textColor = d ? '#fff' : '#0d2152'
  const mutedColor = d ? 'rgba(255,255,255,0.4)' : 'rgba(13,33,82,0.6)'
  const borderColor = d ? 'rgba(255,255,255,0.1)' : 'rgba(13,33,82,0.14)'
  const activeColor = d ? '#fff' : '#0d2152'

  const btnStyle = {
    background: 'none',
    border: `1px solid ${borderColor}`,
    color: mutedColor,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '11px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontFamily: "'Inter', sans-serif",
    fontWeight: '500',
    whiteSpace: 'nowrap',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${d ? '#000' : '#f4f1ec'}; color: ${textColor}; transition: background 0.2s, color 0.2s; }
      `}</style>

      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: bg, borderBottom: `1px solid ${borderColor}`,
        backdropFilter: 'blur(12px)', fontFamily: "'Inter', sans-serif",
      }}>
        {/* Main nav bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: effectiveMobile ? '16px 20px' : '18px 48px' }}>
          <a href="/" style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '16px' : '18px', fontWeight: '400', color: textColor, textDecoration: 'none', flexShrink: 0 }}>
            Fantasy Chatroom
          </a>

          {/* Desktop nav links */}
          {!effectiveMobile && (
            <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1, marginLeft: '24px' }}>
              {NAV_LINKS.map(([label, href]) => (
                <a key={href} href={href} style={{
                  color: pathname === href ? activeColor : mutedColor,
                  textDecoration: 'none', fontSize: '11px', letterSpacing: '0.12em',
                  textTransform: 'uppercase', fontWeight: pathname === href ? '600' : '500',
                  borderBottom: pathname === href ? `1px solid ${activeColor}` : 'none',
                  paddingBottom: '1px',
                }}>{label}</a>
              ))}
              <button onClick={toggleTheme} style={btnStyle}>{d ? 'Light' : 'Dark'}</button>
              <button onClick={toggleLayout} style={btnStyle}>{effectiveMobile ? 'Desktop' : 'Mobile'}</button>
            </div>
          )}

          {/* Mobile: controls + hamburger */}
          {effectiveMobile && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={toggleTheme} style={{ ...btnStyle, padding: '6px 10px' }}>{d ? '☀️' : '🌙'}</button>
              <button onClick={toggleLayout} style={{ ...btnStyle, padding: '6px 10px' }}>🖥</button>
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{ ...btnStyle, padding: '6px 12px', fontSize: '18px', lineHeight: 1 }}
                aria-label="Menu"
              >
                {menuOpen ? '✕' : '☰'}
              </button>
            </div>
          )}
        </div>

        {/* Mobile dropdown menu */}
        {effectiveMobile && menuOpen && (
          <div style={{ background: bg, borderTop: `1px solid ${borderColor}`, padding: '12px 20px 20px' }}>
            {NAV_LINKS.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block', padding: '12px 0',
                  borderBottom: `1px solid ${borderColor}`,
                  color: pathname === href ? activeColor : mutedColor,
                  textDecoration: 'none', fontSize: '13px',
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  fontWeight: pathname === href ? '600' : '400',
                }}
              >
                {label}
              </a>
            ))}
          </div>
        )}
      </nav>
    </>
  )
}
