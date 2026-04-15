import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function ChampionsPage() {
  const { data: seasons } = await supabase
    .from('seasons')
    .select(`
      year,
      season_number,
      champion:champion_id(name, slug),
      mol_bowl_winner:mol_bowl_winner_id(name, slug),
      mol_bowl_loser:mol_bowl_loser_id(name, slug)
    `)
    .order('year', { ascending: false })

  const championCounts = {}
  seasons?.forEach(s => {
    if (s.champion) {
      championCounts[s.champion.name] = (championCounts[s.champion.name] || 0) + 1
    }
  })

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 24px' }}>
        <a href="/" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: "'Inter', sans-serif" }}>
          ← Back
        </a>

        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: '400', marginTop: '32px', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          Hall of Champions
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '64px' }}>
          {seasons?.length} seasons &nbsp;&middot;&nbsp; Est. 2015
        </p>

        <div style={{ marginBottom: '80px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '24px' }}>Championship Count</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {Object.entries(championCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => (
                <div key={name} style={{
                  padding: '12px 20px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontWeight: '400' }}>{count}</span>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{name}</span>
                </div>
              ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {seasons?.map((season, i) => (
            <div key={season.year} style={{
              display: 'grid', gridTemplateColumns: '80px 1fr 1fr',
              padding: '28px 0',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              alignItems: 'center',
              gap: '24px'
            }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', fontWeight: '400', color: i === 0 ? '#fff' : 'rgba(255,255,255,0.5)' }}>{season.year}</div>
                <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>Year {season.season_number}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '6px' }}>Champion</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: '400' }}>
                  {season.champion?.name || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '6px' }}>Mol Bowl</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                  {season.mol_bowl_winner ? `${season.mol_bowl_winner.name} def. ${season.mol_bowl_loser?.name}` : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
