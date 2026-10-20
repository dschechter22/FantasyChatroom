'use client'
import { createContext, useContext, useState, useEffect } from 'react'
const LayoutContext = createContext(null)
export function LayoutProvider({ children }) {
  const [theme, setThemeState] = useState('light')
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOverride, setMobileOverride] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setThemeState(localStorage.getItem('fc-theme') || 'light')
    setIsMobile(window.innerWidth <= 768)
    setMobileOverride(localStorage.getItem('fc-layout') || null)
    setMounted(true)
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
    bg:        d ? '#1b202c'                : '#f4f1ec',
    text:      d ? '#f2ead8'                : '#0d2152',
    muted:     d ? 'rgba(242,234,216,0.6)'  : 'rgba(13,33,82,0.75)',
    border:    d ? 'rgba(242,234,216,0.16)' : 'rgba(13,33,82,0.14)',
    cardBg:    d ? '#252b39'                : '#ede9e2',
    rowAlt:    d ? '#212634'                : '#e8e4dc',
    statsBg:   d ? '#161a24'                : '#e4e0d8',
    highlight: d ? '#2e3546'                : '#e8edf5',
    green:     d ? '#6ee7b7'                : '#0d6e3f',
    red:       d ? '#f87171'                : '#9b1c1c',
    gold:      d ? '#fcd34d'                : '#92400e',
    blue:      d ? '#9db8dc'                : '#1e3a8a',
    // cream in dark mode, the site's navy in light -- for chrome accents (tabs, panel edges)
    accent:    d ? '#e8dcc0'                : '#0d2152',
  }

  return (
    <LayoutContext.Provider value={{
      theme, d, effectiveMobile, isMobile, mobileOverride, mounted,
      toggleTheme, toggleLayout,
      ...tokens,
    }}>
      {children}
    </LayoutContext.Provider>
  )
}
export function useLayout() {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayout must be used inside LayoutProvider')
  return ctx
}
