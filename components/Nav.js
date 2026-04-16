'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLayout } from '../hooks/LayoutContext'

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
  const { d, effectiveMobile, theme, toggleTheme, toggleLayout, mobileOverride, isMobile, text, muted, border, cardBg, bg } = useLayout()
  const [menuOpen, setMenuOpen] = useState(false)

  const navBg = d ? 'rgba(0,0,0,0.92)' : 'rgba(244,241,236,0.97)'

  const btnStyle = {
    background: 'none',
    border: `1px solid ${border}`,
    color: muted,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '11px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontFamily: "'Inter', sans-serif",
    fontWeight: '500',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }

  // Label for layout toggle -- always show what it will switch TO
  const layoutLabel = effectiveMobile ? 'Desktop View' : 'Mobile View'
  const themeLabel = d ? 'Light' : 'Dark'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: navBg, borderBottom: `1px solid ${border}`,
        backdropFilter: 'blur(12px)', fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: effectiveMobile ? '14px 16px' : '18px 48px',
          minHeight: effectiveMobile ? '56px' : '64px',
        }}>
          {/* Logo */}
          <a href="/" style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: effectiveMobile ? '15px' : '18px',
            fontWeight: '400', color: text, textDecoration: 'none', flexShrink: 0,
          }}>
            Fantasy Chatroom
          </a>

          {/* Desktop: links + controls */}
          {!effectiveMobile && (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1, marginLeft: '24px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {NAV_LINKS.map(([label, href]) => (
                <a key={href} href={href} style={{
                  color: pathname === href ? text : muted,
                  textDecoration: 'none', fontSize: '11px',
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  fontWeight: pathname === href ? '600' : '500',
                  borderBottom: pathname === href ? `1px solid ${text}` : '1px solid transparent',
                  paddingBottom: '1px',
                }}>{label}</a>
              ))}
              <button onClick={toggleTheme} style={btnStyle}>{themeLabel}</button>
              <button onClick={toggleLayout} style={btnStyle}>{layoutLabel}</button>
            </div>
          )}

          {/* Mobile: always-visible controls + hamburger */}
          {effectiveMobile && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button onClick={toggleTheme} style={{ ...btnStyle, padding: '6px 10px', fontSize: '13px' }}>
                {d ? '☀️' : '🌙'}
              </button>
              <button onClick={toggleLayout} style={{ ...btnStyle, padding: '6px 8px', fontSize: '10px' }}>
                🖥 Desktop
              </button>
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{ ...btnStyle, padding: '6px 12px', fontSize: '16px', lineHeight: 1 }}
              >
                {menuOpen ? '✕' : '☰'}
              </button>
            </div>
          )}

          {/* Desktop-on-mobile: always show a small "mobile view" button so user can escape */}
          {!effectiveMobile && isMobile && (
            <button onClick={toggleLayout} style={{ ...btnStyle, marginLeft: '8px', fontSize: '10px', padding: '5px 8px' }}>
              📱 Mobile
            </button>
          )}
        </div>

        {/* Mobile dropdown */}
        {effectiveMobile && menuOpen && (
          <div style={{ background: navBg, borderTop: `1px solid ${border}`, paddingBottom: '8px' }}>
            {NAV_LINKS.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block',
                  padding: '13px 16px',
                  borderBottom: `1px solid ${border}`,
                  color: pathname === href ? text : muted,
                  textDecoration: 'none',
                  fontSize: '13px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: pathname === href ? '600' : '400',
                  background: pathname === href ? (d ? 'rgba(255,255,255,0.04)' : 'rgba(13,33,82,0.04)') : 'transparent',
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
