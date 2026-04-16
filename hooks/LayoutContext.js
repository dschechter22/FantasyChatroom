'use client'
import { createContext, useContext, useState, useEffect } from 'react'

const LayoutContext = createContext(null)

export function LayoutProvider({ children }) {
  const [theme, setThemeState] = useState('light')
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOverride, setMobileOverride] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('fc-theme') || 'light'
    const savedOverride = localStorage.getItem('fc-layout') || null
    setThemeState(savedTheme)
    setMobileOverride(savedOverride)

    const checkSize = () => setIsMobile(window.innerWidth <= 768)
    checkSize()
    window.addEventListener('resize', checkSize)
    setMounted(true)
    return () => window.removeEventListener('resize', checkSize)
  }, [])

  const setTheme = (next) => {
    setThemeState(next)
    localStorage.setItem('fc-theme', next)
  }

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')

  const toggleLayout = () => {
    // effectiveMobile based on current state
    const em = mobileOverride ? mobileOverride === 'mobile' : isMobile
    const next = em ? 'desktop' : 'mobile'
    setMobileOverride(next)
    localStorage.setItem('fc-layout', next)
  }

  // effectiveMobile: use override if set, else use actual screen size
  // Before mount, fall back to CSS media query (isMobile stays false until mounted)
  const effectiveMobile = mounted
    ? (mobileOverride ? mobileOverride === 'mobile' : isMobile)
    : false

  const d = theme === 'dark'

  const tokens = {
    bg:        d ? '#000'                   : '#f4f1ec',
    text:      d ? '#fff'                   : '#0d2152',
    muted:     d ? 'rgba(255,255,255,0.38)' : 'rgba(13,33,82,0.75)',
    border:    d ? 'rgba(255,255,255,0.1)'  : 'rgba(13,33,82,0.14)',
    cardBg:    d ? '#0a0a0a'                : '#ede9e2',
    rowAlt:    d ? '#080808'                : '#e8e4dc',
    statsBg:   d ? '#050505'                : '#e4e0d8',
    highlight: d ? '#0d0d1a'               : '#e8edf5',
    green:     d ? '#6ee7b7'                : '#0d6e3f',
    red:       d ? '#f87171'                : '#9b1c1c',
    gold:      d ? '#fcd34d'                : '#92400e',
    blue:      d ? '#93c5fd'                : '#1e3a8a',
  }

  // Inject global CSS for mobile-first responsive layout
  // Pages use .fc-desktop and .fc-mobile classes to show/hide content
  const globalCSS = `
    body { background: ${tokens.bg}; color: ${tokens.text}; transition: background 0.2s, color 0.2s; font-family: 'Inter', sans-serif; }

    /* Default: CSS media query drives layout */
    .fc-mobile-only { display: none; }
    .fc-desktop-only { display: block; }

    @media (max-width: 768px) {
      .fc-mobile-only { display: block; }
      .fc-desktop-only { display: none; }
    }

    /* JS override takes precedence once mounted */
    ${mounted && effectiveMobile ? `
      .fc-mobile-only { display: block !important; }
      .fc-desktop-only { display: none !important; }
    ` : ''}
    ${mounted && !effectiveMobile ? `
      .fc-mobile-only { display: none !important; }
      .fc-desktop-only { display: block !important; }
    ` : ''}
  `

  return (
    <LayoutContext.Provider value={{
      theme, d, effectiveMobile, isMobile, mobileOverride, mounted,
      toggleTheme, toggleLayout,
      ...tokens,
    }}>
      <style dangerouslySetInnerHTML={{ __html: globalCSS }} />
      {children}
    </LayoutContext.Provider>
  )
}

export function useLayout() {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayout must be used inside LayoutProvider')
  return ctx
}
