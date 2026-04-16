'use client'
import { createContext, useContext, useState, useEffect } from 'react'

const LayoutContext = createContext(null)

export function LayoutProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return localStorage.getItem('fc-theme') || 'light'
  })

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 768
  })

  const [mobileOverride, setMobileOverride] = useState(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('fc-layout') || null
  })

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', checkSize)
    return () => window.removeEventListener('resize', checkSize)
  }, [])

  const setTheme = (next) => {
    setThemeState(next)
    localStorage.setItem('fc-theme', next)
  }

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')

  const toggleLayout = () => {
    const next = effectiveMobile ? 'desktop' : 'mobile'
    setMobileOverride(next)
    localStorage.setItem('fc-layout', next)
  }

  const effectiveMobile = mobileOverride ? mobileOverride === 'mobile' : isMobile

  const d = theme === 'dark'

  const tokens = {
    bg:        d ? '#000'                   : '#f4f1ec',
    text:      d ? '#fff'                   : '#0d2152',
    muted:     d ? 'rgba(255,255,255,0.38)' : 'rgba(13,33,82,0.75)',
    border:    d ? 'rgba(255,255,255,0.1)'  : 'rgba(13,33,82,0.14)',
    cardBg:    d ? '#0a0a0a'                : '#ede9e2',
    rowAlt:    d ? '#080808'                : '#e8e4dc',
    statsBg:   d ? '#050505'                : '#e4e0d8',
    highlight: d ? '#0d0d1a'                : '#e8edf5',
    green:     d ? '#6ee7b7'                : '#0d6e3f',
    red:       d ? '#f87171'                : '#9b1c1c',
    gold:      d ? '#fcd34d'                : '#92400e',
    blue:      d ? '#93c5fd'                : '#1e3a8a',
  }

  const globalCSS = `
    body {
      background: ${tokens.bg};
      color: ${tokens.text};
      transition: background 0.2s, color 0.2s;
      font-family: 'Inter', sans-serif;
    }
  `

  return (
    <LayoutContext.Provider value={{
      theme, d, effectiveMobile, isMobile, mobileOverride,
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
