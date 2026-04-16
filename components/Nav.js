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
  const { d, effectiveMobile, isMobile, text, muted, border, bg, toggleTheme, toggleLayout } = useLayout()
  const [menuOpen, setMenuOpen] = useState(false)

  const navBg = d ? 'rgba(0,0,0,0.95)' : 'rgba(244,241,236,0.97)'

  const btnStyle = {
    background: 'none',
    border: `1px solid ${border}`,
    color: muted,
    padding: '5px 10px',
    cursor: 'pointer',
    fontSize: '10px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontFamily: "'Inter', sans-serif",
    fontWeight: '500',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .fc-nav-links::-webkit-scrollbar { display: none; }
        .fc-nav-links { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: navBg, borderBottom: `1px solid ${border}`,
        backdropFilter: 'blur(12px)', fontFamily: "'Inter', sans-serif",
      }}>
        {/* Top row: logo + controls */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: effectiveMobile ? '12px 16px' : '14px 24px',
          gap: '12px',
        }}>
          <a href="/" style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '16px',
            fontWeight: '400', color: text, textDecoration: 'none', flexShrink: 0,
          }}>
            Fantasy Chatroom
          </a>

          {/* Controls -- always visible */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={toggleTheme} style={btnStyle}>
              {d ? 'Light' : 'Dark'}
            </button>
            <button onClick={toggleLayout} style={btnStyle}>
              {effectiveMobile ? 'Desktop' : 'Mobile'}
            </button>
            {/* Hamburger only on mobile */}
            {effectiveMobile && (
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{ ...btnStyle, padding: '5px 10px', fontSize: '15px', lineHeight: 1 }}
              >
                {menuOpen ? '✕' : '☰'}
              </button>
            )}
          </div>
        </div>

        {/* Desktop: horizontally scrollable link row */}
        {!effectiveMobile && (
          <div
            className="fc-nav-links"
            style={{
              display: 'flex', alignItems: 'center', gap: '0',
              overflowX: 'auto', borderTop: `1px solid ${border}`,
              padding: '0 24px',
            }}
          >
            {NAV_LINKS.map(([label, href]) => {
              const active = pathname === href
              return (
                <a key={href} href={href} style={{
                  color: active ? text : muted,
                  textDecoration: 'none',
                  fontSize: '11px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: active ? '600' : '400',
                  padding: '10px 14px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  borderBottom: active ? `2px solid ${text}` : '2px solid transparent',
                }}>
                  {label}
                </a>
              )
            })}
          </div>
        )}

        {/* Mobile dropdown */}
        {effectiveMobile && menuOpen && (
          <div style={{ borderTop: `1px solid ${border}` }}>
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
                  background: pathname === href
                    ? (d ? 'rgba(255,255,255,0.04)' : 'rgba(13,33,82,0.04)')
                    : 'transparent',
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
