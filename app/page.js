export default function Home() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080808; color: #f0f0f0; font-family: 'Georgia', serif; }
        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 48px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%);
        }
        .nav-logo { font-size: 15px; font-family: sans-serif; letter-spacing: 0.15em; text-transform: uppercase; color: #fff; text-decoration: none; font-weight: 600; }
        .nav-links { display: flex; gap: 32px; }
        .nav-links a { color: rgba(255,255,255,0.8); text-decoration: none; font-size: 13px; font-family: sans-serif; letter-spacing: 0.1em; text-transform: uppercase; transition: color 0.2s; }
        .nav-links a:hover { color: #fff; }
        .hero {
          position: relative; height: 100vh; min-height: 600px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; overflow: hidden;
        }
        .hero-bg {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 60% 40%, #1a1a2e 0%, #080808 70%);
        }
        .hero-grid {
          position: absolute; inset: 0; opacity: 0.07;
          background-image: linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .hero-glow {
          position: absolute; top: 30%; left: 50%; transform: translate(-50%, -50%);
          width: 600px; height: 400px; border-radius: 50%;
          background: radial-gradient(ellipse, rgba(100,120,255,0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .hero-content { position: relative; z-index: 2; padding: 0 24px; }
        .hero-eyebrow {
          font-family: sans-serif; font-size: 12px; letter-spacing: 0.25em;
          text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 20px;
        }
        .hero-title {
          font-size: clamp(48px, 8vw, 96px); font-weight: 400; line-height: 1.0;
          color: #fff; letter-spacing: -0.02em; margin-bottom: 24px;
        }
        .hero-title em { font-style: italic; color: rgba(255,255,255,0.7); }
        .hero-sub {
          font-family: sans-serif; font-size: 15px; color: rgba(255,255,255,0.5);
          letter-spacing: 0.05em; margin-bottom: 48px;
        }
        .hero-cta {
          display: inline-block; padding: 14px 36px;
          border: 1px solid rgba(255,255,255,0.3); color: #fff;
          font-family: sans-serif; font-size: 12px; letter-spacing: 0.2em;
          text-transform: uppercase; text-decoration: none;
          transition: background 0.2s, border-color 0.2s;
        }
        .hero-cta:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.6); }
        .hero-scroll {
          position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          font-family: sans-serif; font-size: 10px; letter-spacing: 0.2em;
          text-transform: uppercase; color: rgba(255,255,255,0.3); z-index: 2;
        }
        .scroll-line {
          width: 1px; height: 40px;
          background: linear-gradient(to bottom, rgba(255,255,255,0.3), transparent);
          animation: scrollPulse 2s ease-in-out infinite;
        }
        @keyframes scrollPulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
        .stats-bar {
          background: #0d0d0d; border-top: 1px solid #1a1a1a; border-bottom: 1px solid #1a1a1a;
          display: flex; justify-content: center; gap: 0;
        }
        .stat-item {
          padding: 32px 64px; text-align: center;
          border-right: 1px solid #1a1a1a;
        }
        .stat-item:last-child { border-right: none; }
        .stat-number { font-size: 36px; font-weight: 400; color: #fff; margin-bottom: 6px; }
        .stat-label { font-family: sans-serif; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.4); }
        .section { padding: 100px 48px; max-width: 1200px; margin: 0 auto; }
        .section-eyebrow {
          font-family: sans-serif; font-size: 11px; letter-spacing: 0.25em;
          text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 16px;
        }
        .section-title { font-size: 42px; font-weight: 400; color: #fff; margin-bottom: 56px; line-height: 1.1; }
        .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #1a1a1a; }
        .card {
          background: #0d0d0d; padding: 40px 36px;
          text-decoration: none; color: #f0f0f0;
          transition: background 0.2s; display: block;
        }
        .card:hover { background: #111; }
        .card-emoji { font-size: 28px; margin-bottom: 20px; display: block; }
        .card-title { font-size: 20px; font-weight: 400; color: #fff; margin-bottom: 10px; }
        .card-desc { font-family: sans-serif; font-size: 13px; color: rgba(255,255,255,0.4); line-height: 1.6; }
        .card-arrow {
          display: inline-block; margin-top: 24px;
          font-family: sans-serif; font-size: 11px; letter-spacing: 0.15em;
          text-transform: uppercase; color: rgba(255,255,255,0.3);
        }
        @media (max-width: 768px) {
          .nav { padding: 16px 24px; }
          .nav-links { display: none; }
          .cards { grid-template-columns: 1fr; }
          .stat-item { padding: 24px 32px; }
          .section { padding: 60px 24px; }
        }
      `}</style>

      <nav className="nav">
        <a href="/" className="nav-logo">Fantasy Chatroom</a>
        <div className="nav-links">
          <a href="/champions">Champions</a>
          <a href="/standings">Standings</a>
          <a href="/h2h">Head to Head</a>
          <a href="/season">Season</a>
          <a href="/rivalries">Rivalries</a>
          <a href="/managers">Managers</a>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid" />
        <div className="hero-glow" />
        <div className="hero-content">
          <p className="hero-eyebrow">Est. 2015 &nbsp;&middot;&nbsp; Year 12</p>
          <h1 className="hero-title">Fantasy<br /><em>Chatroom</em></h1>
          <p className="hero-sub">12 years &nbsp;&middot;&nbsp; 10 managers &nbsp;&middot;&nbsp; one throne</p>
          <a href="/standings" className="hero-cta">View All-Time Standings</a>
        </div>
        <div className="hero-scroll">
          <div className="scroll-line" />
          Scroll
        </div>
      </section>

      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-number">11</div>
          <div className="stat-label">Seasons Played</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">10</div>
          <div className="stat-label">Active Managers</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">12</div>
          <div className="stat-label">Total Managers</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">—</div>
          <div className="stat-label">Points Scored</div>
        </div>
      </div>

      <div className="section">
        <p className="section-eyebrow">Explore the League</p>
        <h2 className="section-title">Everything you need.<br />Nothing you don't.</h2>
        <div className="cards">
          {[
            { emoji: '🏆', label: 'Hall of Champions', desc: 'Every champion since year one. The throne, the drought, the dynasty.', href: '/champions' },
            { emoji: '📊', label: 'All-Time Standings', desc: 'Wins, losses, championships, and playoff appearances across every season.', href: '/standings' },
            { emoji: '⚔️', label: 'Head-to-Head', desc: 'Every matchup between every manager. Who owns who.', href: '/h2h' },
            { emoji: '📅', label: 'Current Season', desc: 'Live standings, weekly scores, and power rankings for 2026.', href: '/season' },
            { emoji: '🔥', label: 'Rivalry Index', desc: 'Grudge matches, heartbreaking losses, and the feuds that define the league.', href: '/rivalries' },
            { emoji: '👤', label: 'Manager Cards', desc: 'Every manager\'s record, signature moments, and legacy.', href: '/managers' },
          ].map(({ emoji, label, desc, href }) => (
            <a key={href} href={href} className="card">
              <span className="card-emoji">{emoji}</span>
              <div className="card-title">{label}</div>
              <div className="card-desc">{desc}</div>
              <span className="card-arrow">Explore →</span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
