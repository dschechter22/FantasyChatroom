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
  const bg = d ? '#000' : '#fff'
  const text = d ? '#fff' : '#0a1628'
  const muted = d ? 'rgba(255,255,255,0.38)' : 'rgba(10,22,40,0.45)'
  const border = d ? 'rgba(255,255,255,0.1)' : 'rgba(10,22,40,0.12)'
  const cardBg = d ? '#0a0a0a' : '#f7f8fc'
  const statsBg = d ? '#080808' : '#f0f2f8'

  const styles = {
    body: {
      background: bg, color: text,
      fontFamily: "'Inter', sans-serif", minHeight: '100vh',
    },
    nav: {
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 48px',
      background: d ? 'rgba(0,0,0,0.88)' : 'rgba(255,255,255,0.95)',
      borderBottom: `1px solid ${border}`,
      backdropFilter: 'blur(10px)',
    },
    navLogo: {
      fontFamily: "'Playfair Display', serif",
      fontSize: '18px', fontWeight: '400',
      color: text, textDecoration: 'none', letterSpacing: '-0.01em',
    },
    navLinks: { display: 'flex', gap: '20px', alignItems: 'center' },
    navLink: {
      color: muted, textDecoration: 'none', fontSize: '11px',
      letterSpacing: '0.14em', textTransform: 'uppercase',
      fontWeight: '500',
    },
    themeBtn: {
      background: 'none', border: `1px solid ${border}`,
      color: muted, padding: '6px 14px', cursor: 'pointer',
      fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase',
      fontFamily: "'Inter', sans-serif", fontWeight: '500',
    },
    hero: {
      position: 'relative', height: '100vh', minHeight: '600px',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', overflow: 'hidden',
    },
    heroBg: {
      position: 'absolute', inset: 0, background: bg,
    },
    heroGrid: {
      position: 'absolute', inset: 0,
      opacity: d ? 0.05 : 0.07,
      backgroundImage: `linear-gradient(${border} 1px, transparent 1px), linear-gradient(90deg, ${border} 1px, transparent 1px)`,
      backgroundSize: '60px 60px',
    },
    heroContent: { position: 'relative', zIndex: 2, padding: '0 24px' },
    heroEyebrow: {
      fontFamily: "'Inter', sans-serif",
      fontSize: '11px', letterSpacing: '0.28em',
      textTransform: 'uppercase', color: muted, marginBottom: '24px',
    },
    heroTitle: {
      fontFamily: "'Playfair Display', serif",
      fontSize: 'clamp(64px, 11vw, 120px)',
      fontWeight: '400', lineHeight: '0.92',
      color: text, letterSpacing: '-0.03em', marginBottom: '28px',
    },
    heroTitleEm: {
      fontStyle: 'italic', fontWeight: '400', color: muted,
    },
    heroSub: {
      fontFamily: "'Inter', sans-serif",
      fontSize: '11px', letterSpacing: '0.22em',
      color: muted, marginBottom: '48px', textTransform: 'uppercase',
    },
    heroCta: {
      display: 'inline-block', padding: '13px 32px',
      border: `1px solid ${border}`,
      color: text, fontFamily: "'Inter', sans-serif",
      fontSize: '11px', letterSpacing: '0.18em',
      textTransform: 'uppercase', textDecoration: 'none', fontWeight: '500',
    },
    scrollIndicator: {
      position: 'absolute', bottom: '40px', left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      fontFamily: "'Inter', sans-serif",
      fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase',
      color: muted, zIndex: 2,
    },
    statsBar: {
      background: statsBg,
      borderTop: `1px solid ${border}`,
      borderBottom: `1px solid ${border}`,
      display: 'flex', justifyContent: 'center',
    },
    statItem: {
      padding: '32px 64px', textAlign: 'center',
      borderRight: `1px solid ${border}`,
    },
    statNumber: {
      fontFamily: "'Playfair Display', serif",
      fontSize: '40px', fontWeight: '400',
      color: text, marginBottom: '6px',
    },
    statLabel: {
      fontFamily: "'Inter', sans-serif",
      fontSize: '10px', letterSpacing: '0.18em',
      textTransform: 'uppercase', color: muted,
    },
    section: { padding: '100px 48px', maxWidth: '1200px', margin: '0 auto' },
    sectionEyebrow: {
      fontFamily: "'Inter', sans-serif",
      fontSize: '10px', letterSpacing: '0.28em',
      textTransform: 'uppercase', color: muted, marginBottom: '14px',
    },
    sectionTitle: {
      fontFamily: "'Playfair Display', serif",
      fontSize: '44px', fontWeight: '400',
      color: text, marginBottom: '52px',
      lineHeight: '1.1', letterSpacing: '-0.02em',
    },
    cards: {
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1px', background: border,
    },
    card: {
      background: cardBg, padding: '40px 36px',
      textDecoration: 'none', color: text, display: 'block',
    },
    cardTitle: {
      fontFamily: "'Playfair Display', serif",
      fontSize: '21px', fontWeight: '400',
      color: text, marginBottom: '10px', letterSpacing: '-0.01em',
    },
    cardDesc: {
      fontFamily: "'Inter', sans-serif",
      fontSize: '13px', lineHeight: '1.65', color: muted,
    },
    cardArrow: {
      display: 'inline-block', marginTop: '24px',
      fontFamily: "'Inter', sans-serif",
      fontSize: '10px', letterSpacing: '0.18em',
      textTransform: 'uppercase', color: muted,
    },
  }

  const navItems = [
    { label: 'Champions', href: '/champions' },
    { label: 'Standings', href: '/standings' },
    { label: 'H2H', href: '/h2h' },
    { label: 'Season', href: '/season' },
    { label: 'Rivalries', href: '/rivalries' },
    { label: 'Managers', href: '/managers' },
    { label: 'Writeups', href: '/writeups' },
    { label: 'Power Rankings', href: '/power-rankings' },
    { label: 'LJ Index', href: '/lj-index' },
  ]

  const cards = [
    { label: 'Hall of Champions', desc: 'Every champion since year one. The throne, the drought, the dynasty.', href: '/champions' },
    { label: 'All-Time Standings', desc: 'Wins, losses, championships, and playoff appearances across every season.', href: '/standings' },
    { label: 'Head-to-Head', desc: 'Every matchup between every manager. Who owns who.', href: '/h2h' },
    { label: 'Current Season', desc: 'Live standings, weekly scores, and power rankings for 2026.', href: '/season' },
    { label: 'Rivalry Index', desc: 'Grudge matches, heartbreaking losses, and the feuds that define the league.', href: '/rivalries' },
    { label: 'Manager Cards', desc: "Every manager's record, signature moments, and legacy.", href: '/managers' },
    { label: 'Weekly Writeups', desc: 'Manager-submitted recaps, hot takes, and postgame analysis every week.', href: '/writeups' },
    { label: 'Power Rankings', desc: 'Weekly rankings built from a custom formula. No gut feelings, just math.', href: '/power-rankings' },
    { label: 'LJ Index', desc: 'A proprietary metric tracking something deeper than wins and losses.', href: '/lj-index' },
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
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </nav>

      <section style={styles.hero}>
        <div style={styles.heroBg} />
        <div style={styles.heroGrid} />
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
          <div style={{ width: '1px', height: '40px', background: `linear-gradient(to bottom, ${border}, transparent)` }} />
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
          {cards.map(({ label, desc, href }) => (
            <a key={href} href={href} style={styles.card}>
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
