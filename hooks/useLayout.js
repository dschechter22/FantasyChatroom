'use client'
import { useState, useEffect } from 'react'

export function useLayout() {
  const [theme, setTheme] = useState('light')
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOverride, setMobileOverride] = useState(null)

  useEffect(() => {
    // Init theme
    const savedTheme = localStorage.getItem('fc-theme') || 'light'
    setTheme(savedTheme)

    // Init layout override
    const savedOverride = localStorage.getItem('fc-layout')
    if (savedOverride) setMobileOverride(savedOverride)

    // Auto-detect screen size
    const checkSize = () => setIsMobile(window.innerWidth < 768)
    checkSize()
    window.addEventListener('resize', checkSize)

    // Listen for nav toggle events
    const onTheme = (e) => setTheme(e.detail)
    const onLayout = (e) => setMobileOverride(e.detail)
    window.addEventListener('fc-theme-change', onTheme)
    window.addEventListener('fc-layout-change', onLayout)

    return () => {
      window.removeEventListener('resize', checkSize)
      window.removeEventListener('fc-theme-change', onTheme)
      window.removeEventListener('fc-layout-change', onLayout)
    }
  }, [])

  const effectiveMobile = mobileOverride ? mobileOverride === 'mobile' : isMobile
  const d = theme === 'dark'

  // Design tokens
  const tokens = {
    bg:       d ? '#000'                      : '#f4f1ec',
    text:     d ? '#fff'                      : '#0d2152',
    muted:    d ? 'rgba(255,255,255,0.38)'    : 'rgba(13,33,82,0.75)',
    border:   d ? 'rgba(255,255,255,0.1)'     : 'rgba(13,33,82,0.14)',
    cardBg:   d ? '#0a0a0a'                   : '#ede9e2',
    rowAlt:   d ? '#080808'                   : '#e8e4dc',
    statsBg:  d ? '#050505'                   : '#e4e0d8',
    highlight:d ? '#0d0d1a'                   : '#e8edf5',
    green:    d ? '#6ee7b7'                   : '#0d6e3f',
    red:      d ? '#f87171'                   : '#9b1c1c',
    gold:     d ? '#fcd34d'                   : '#92400e',
    blue:     d ? '#93c5fd'                   : '#1e3a8a',
  }

  return { theme, d, effectiveMobile, ...tokens }
}
