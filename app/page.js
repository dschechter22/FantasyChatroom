export default function Home() {
  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '60px 24px' }}>
      <h1 style={{ fontSize: '48px', fontWeight: '700', marginBottom: '8px' }}>
        🏈 Fantasy League
      </h1>
      <p style={{ color: '#888', fontSize: '18px', marginBottom: '48px' }}>
        12 years. 10 managers. One throne.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Hall of Champions', href: '/champions', emoji: '🏆' },
          { label: 'All-Time Standings', href: '/standings', emoji: '📊' },
          { label: 'Head-to-Head', href: '/h2h', emoji: '⚔️' },
          { label: 'Current Season', href: '/season', emoji: '📅' },
          { label: 'Rivalry Index', href: '/rivalries', emoji: '🔥' },
          { label: 'Manager Cards', href: '/managers', emoji: '👤' },
        ].map(({ label, href, emoji }) => (
          <a key={href} href={href} style={{
            display: 'block',
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            padding: '24px',
            textDecoration: 'none',
            color: '#f0f0f0',
            transition: 'border-color 0.2s',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>{emoji}</div>
            <div style={{ fontWeight: '600', fontSize: '16px' }}>{label}</div>
          </a>
        ))}
      </div>
    </main>
  )
}
