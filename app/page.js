'use client'
import { useState, useEffect } from 'react'

export default function Home() {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    const saved = localStorage.getItem('fc-theme') || 'dark'
    setTheme(saved)
    document.body.setAttribute('data-theme', saved)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('fc-theme', next)
    document.body.setAttribute('data-theme', next)
  }

  const d = theme === 'dark'

  const styles = {
    body: {
      background: d ? '#080808' : '#f5f2ee',
      color: d ? '#f0f0f0' : '#1a1a1a',
      fontFamily: "'Inter', sans-serif",
      minHeight: '100vh',
    },
    nav: {
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 48px',
      background: d
        ? 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)'
        : 'rgba(245,242,238,0.95)',
      borderBottom: d ? 'none' : '1px solid #e0dbd3',
      backdropFilter: 'blur(8px)',
    },
    navLogo: {
      fontFamily: "'Playfair Display', serif",
      fontSize: '18px', fontWeight: '700',
      color: d ? '#fff' : '#1a1a1a',
      textDecoration: 'none', letterSpacing: '-0.01em',
    },
    navLinks: { display: 'flex', gap: '28px', alignItems: 'center' },
    navLink: {
      color: d ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)',
      textDecoration: 'none', fontSize: '12px',
      letterSpacing: '0.12em', textTransform: 'uppercase',
      fontWeight: '500', transition: 'color 0.2s',
    },
    themeBtn: {
      background: 'none', border: `1px solid ${d ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
      color: d ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)',
      padding: '6px 14px', cursor: 'pointer',
      fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase',
      fontFamily: "'Inter', sans-serif", fontWeight: '500',
      transition: 'all 0.2s',
    },
    hero: {
      position: 'relative', height: '100vh', minHeight: '600px',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', overflow: 'hidden',
    },
    heroBg: {
      position: 'absolute', inset: 0,
      background: d
        ? 'radial-gradient(ellipse at 60% 40%, #1a1a2e 0%, #080808 70%)'
        : 'radial-gradient(ellipse at 60% 40%, #e8e0d5 0%, #f5f2ee 70%)',
    },
    heroGrid: {
      position: 'absolute', inset: 0,
      opacity: d ? 0.06 : 0.15,
      backgroundImage: `linear-gradient(${d ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)'} 1px, transparent 1px), linear-gradient(90deg, ${d ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)'} 1px, transparent 1px)`,
      backgroundSize: '60px 60px',
    },
    heroGlow: {
      position: 'absolute', top: '30%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '600px', height: '400px', borderRadius: '50%',
      background: d
        ? 'radial-gradient(ellipse, rgba(100,120,255,0.1) 0%, transparent 70%)'
        : 'radial-gradient(ellipse, rgba(180,140,80,0.12) 0%, transparent 70%)',
      pointerEvents: 'none',
    },
    heroContent: { position: 'relative', zIndex: 2, padding: '0 24px' },
    heroEyebrow: {
      fontFamily: "'Inter', sans-serif",
      fontSize: '11px', letterSpacing: '0.28em',
      textTransform: 'uppercase',
      color: d ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
      marginBottom: '20px',
    },
    heroTitle: {
      fontFamily: "'Playfair Display', serif",
      fontSize: 'clamp(56px, 10vw, 108px)',
      fontWeight: '900', lineHeight: '0.95',
      color: d ? '#fff' : '#1a1a1a',
      letterSpacing: '-0.03em', marginBottom: '24px',
    },
    heroTitleEm: {
      fontStyle: 'italic', fontWeight: '400',
      color: d ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)',
    },
    heroSub: {
      fontFamily: "'Inter', sans-serif",
      fontSize: '13px', letterSpacing: '0.18em',
      color: d ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
      marginBottom: '44px', textTransform: 'uppercase',
    },
    heroCta: {
      display: 'inline-block', padding: '14px 36px',
      border: `1px solid ${d ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}`,
      color: d ? '#fff' : '#1a1a1a',
      fontFamily: "'Inter', sans-serif",
      fontSize: '11px', letterSpacing: '0.2em',
      textTransform: 'uppercase', textDecoration: 'none',
      fontWeight: '500',
    },
    statsBar: {
      background: d ? '#0d0d0d' : '#ede8e1',
      borderTop: `1px solid ${d ? '#1a1a1a' : '#ddd8d0'}`,
      borderBottom: `1px solid ${d ? '#1a1a1a' : '#ddd8d0'}`,
      display: 'flex', justifyContent: 'center',
    },
    statItem: {
      padding: '32px 64px', textAlign: 'center',
      borderRight: `1px solid ${d ? '#1a1a1a' : '#ddd8d0'}`,
    },
    statNumber: {
      fontFamily: "'Playfair Display', serif",
      fontSize: '40px', fontWeight: '700',
      color: d ? '#fff' : '#1a1a1a', marginBottom: '6px',
    },
    statLabel: {
      fontFamily: "'Inter', sans-serif",
      fontSize: '10px', letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: d ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)',
    },
    section: { padding: '100px 48px', maxWidth: '1200px', margin: '0 auto' },
    sectionEyebrow: {
      fontFamily: "'Inter', sans-serif",
      fontSize: '10px', letterSpacing: '0.28em',
      textTransform: 'uppercase',
      color: d ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)',
      marginBottom: '14px',
    },
    sectionTitle: {
      fontFamily: "'Playfair Display', serif",
      fontSize: '44px', fontWeight: '700',
      color: d ? '#fff' : '#1a1a1a',
      marginBottom: '52px', lineHeight: '1.1',
      letterSpacing: '-0.02em',
    },
    cards: {
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1px', background: d ? '#1f1f1f' : '#d8d3cb',
    },
    card: {
      background: d ? '#0d0d0d' : '#f0ece5',
      padding: '40px 36px', textDecoration: 'none',
      color: d ? '#f0f0f0' : '#1a1a1a', display: 'block',
    },
    cardEmoji: { fontSize: '26px', marginBottom: '20px', display: 'block' },
    cardTitle: {
      fontFamily: "'Playfair Display', serif",
      fontSize: '22px', fontWeight: '700',
      color: d ? '#fff' : '#1a1a1a',
      marginBottom: '10px', letterSpacing: '-0.01em',
    },
    cardDesc: {
      fontFamily: "'Inter', sans-serif",
      fontSize: '13px', lineHeight: '1.65',
      color: d ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)',
    },
    cardArrow: {
      display: 'inline-block', marginTop: '24px',
      fontFamily: "'Inter', sans-serif",
      fontSize: '10px', letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: d ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)',
    },
    scrollIndicator: {
      position: 'absolute', bottom: '40px', left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      fontFamily: "'Inter', sans-serif",
      fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase',
      color: d ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)', zIndex: 2,
    },
  }

  const navItems = [
    { label: 'Champions', href: '/champions' },
    { label: 'Standings', href: '/standings' },
    { label: 'H2H', href: '/h2h' },
    { label: 'Season', href: '/season' },
    { label: 'Rivalries', href: '/rivalries' },
    { label: 'Managers', href: '/managers' },
  ]

  const cards = [
    { emoji: '🏆', label: 'Hall of Champions', desc: 'Every champion since year one. The throne, the drought, the dynasty.', href: '/champions' },
    { emoji: '📊', label: 'All-Time Standings', desc: 'Wins, losses, championships, and playoff appearances across every season.', href: '/standings' },
    { emoji: '⚔️', label: 'Head-to-Head', desc: 'Every matchup between every manager. Who owns who.', href: '/h2h' },
    { emoji: '📅', label: 'Current Season', desc: 'Live standings, weekly scores, and power rankings for 2026.', href: '/season' },
    { emoji: '🔥', label: 'Rivalry Index', desc: 'Grudge matches, heartbreaking losses, and the feuds that define the league.', href: '/rivalries' },
    { emoji: '👤', label: 'Manager Cards', desc: "Every manager's record, signature moments, and legacy.", href: '/managers' },
  ]

  return (
    <div style={styles.body}>
      <nav style={styles.nav}>
        <a href="/" style={styles.navLogo}>Fantasy Chatroom</a>
        <div style={styles.navLinks}>
          {navItems.map(({ label, href }) => (
            <a key={href} href={href} style={styles.navLink}>{label}</a>
          ))}
          <button onClick={toggleTheme} style={styles.themeBtn}>
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
        </div>
      </nav>

      <section style={styles.hero}>
        <div style={styles.heroBg} />
        <div style={styles.heroGrid} />
        <div style={styles.heroGlow} />
        <div style={styles.heroContent}>
          <p style={styles.heroEyebrow}>Est. 2015 &nbsp;&middot;&nbsp; Year 12</p>
          <h1 style={styles.heroTitle}>
            Fantasy<br />
            <span style={styles.heroTitleEm}>Chatroom</span>
          </h1>
          <p style={styles.heroSub}>12 years &nbsp;&middot;&nbsp; 10 managers &nbsp;&middot;&nbsp; one throne</p>
          <a href="/standings" style={styles.heroCta}>View All-Time Standings</a>
        </div>
        <div style={styles.scrollIndicator}>
          <div style={{
            width: '1px', height: '40px',
            background: `linear-gradient(to bottom, ${d ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}, transparent)`
          }} />
          Scroll
        </div>
      </section>

      <div style={styles.statsBar}>
        {[
          { number: '11', label: 'Seasons Played' },
          { number: '10', label: 'Active Managers' },
          { number: '12', label: 'Total Managers' },
          { number: '—', label: 'Points Scored' },
        ].map(({ number, label }, i, arr) => (
          <div key={label} style={{
            ...styles.statItem,
            borderRight: i === arr.length - 1 ? 'none' : styles.statItem.borderRight,
          }}>
            <div style={styles.statNumber}>{number}</div>
            <div style={styles.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <p style={styles.sectionEyebrow}>Explore the League</p>
        <h2 style={styles.sectionTitle}>Everything you need.<br />Nothing you don't.</h2>
        <div style={styles.cards}>
          {cards.map(({ emoji, label, desc, href }) => (
            <a key={href} href={href} style={styles.card}>
              <span style={styles.cardEmoji}>{emoji}</span>
              <div style={styles.cardTitle}>{label}</div>
              <div style={styles.cardDesc}>{desc}</div>
              <span style={styles.cardArrow}>Explore →</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
