'use client'
import Nav from '../../components/Nav'
import { useLayout } from '../../hooks/useLayout'

export default function StatsPage() {
  const { d, effectiveMobile, bg, text, muted, border, cardBg, gold, blue, green, red } = useLayout()

  const Section = ({ title, color, children }) => (
    <div style={{ marginBottom: '48px' }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '22px' : '28px', fontWeight: '400', color: text, marginBottom: '20px', paddingBottom: '12px', borderBottom: `2px solid ${color || border}` }}>
        {title}
      </h2>
      {children}
    </div>
  )

  const Metric = ({ name, tagline, formula, inputs, notes }) => (
    <div style={{ background: cardBg, padding: effectiveMobile ? '16px' : '24px', marginBottom: '1px', borderLeft: `3px solid ${border}` }}>
      <div style={{ marginBottom: '10px' }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '16px' : '20px', color: text }}>{name}</span>
        {tagline && <span style={{ fontSize: '12px', color: muted, marginLeft: '12px' }}>{tagline}</span>}
      </div>
      {formula && (
        <div style={{ background: d ? '#111' : '#e4e0d8', padding: '12px 16px', fontFamily: 'monospace', fontSize: effectiveMobile ? '11px' : '13px', color: text, marginBottom: '12px', lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre' }}>
          {formula}
        </div>
      )}
      {inputs && (
        <div style={{ marginBottom: '10px' }}>
          {inputs.map(([label, desc]) => (
            <div key={label} style={{ display: 'flex', gap: '12px', padding: '6px 0', borderBottom: `1px solid ${border}`, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: gold, minWidth: '140px', flexShrink: 0, fontFamily: 'monospace' }}>{label}</span>
              <span style={{ fontSize: '12px', color: muted, flex: 1 }}>{desc}</span>
            </div>
          ))}
        </div>
      )}
      {notes && <p style={{ fontSize: '12px', color: muted, lineHeight: 1.6, marginTop: '8px' }}>{notes}</p>}
    </div>
  )

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: effectiveMobile ? '90px 16px 60px' : '120px 24px 80px' }}>

        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '36px' : 'clamp(40px, 6vw, 72px)', fontWeight: '400', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          Stats
        </h1>
        <p style={{ color: muted, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '48px' }}>
          How every metric on this site is calculated
        </p>

        <Section title="Power Score" color={gold}>
          <Metric
            name="Power Score"
            tagline="Normalized season strength metric"
            formula={`PowerScore = (
  (WinPct      / max_WinPct      × 100 × 2) +
  (AvgScore    / max_AvgScore    × 100 × 4) +
  (AllPlayWin% / max_AllPlayWin% × 100 × 2) +
  (MedianScore / max_MedianScore × 100 × 2)
) / 10`}
            inputs={[
              ['WinPct', 'Regular season wins divided by total games played'],
              ['AvgScore', 'Average points scored per regular season game'],
              ['AllPlayWin%', 'Average weekly all-play win rate (see below) over the full season'],
              ['MedianScore', 'Median of all regular season scores'],
              ['/ max_X', 'Each component is normalized against the best value in the league that season'],
            ]}
            notes="All four components are normalized within the season so the top team always scores 100. The top team in any season has a Power Score of 100. AvgScore is weighted 4x because it best captures raw team quality independent of schedule luck. The result is a number between 0 and 100."
          />
        </Section>

        <Section title="Luck" color={green}>
          <Metric
            name="Luck"
            tagline="Wins above or below expectation"
            formula={`Luck = ActualWins - ExpectedWins

ExpectedWins = Σ (AllPlayWinRate per week)`}
            inputs={[
              ['ActualWins', 'Real wins recorded in the regular season standings'],
              ['ExpectedWins', 'Sum of all-play win rate across all weeks -- how many wins a team "deserved" based on scoring'],
              ['AllPlayWinRate', 'In a given week: (number of teams you would have beaten) / (total teams - 1)'],
            ]}
            notes="A positive Luck score means the team won more games than their scoring deserved. A negative Luck score means they were good but got unlucky with scheduling. For example, a team that scores above the median every week but keeps facing the one team that scores higher will have negative luck. Luck is always relative to the league average that season."
          />
          <Metric
            name="All-Play Win %"
            tagline="How you would do against every team every week"
            formula={`AllPlayWin% = Average of weekly all-play win rates

Weekly rate = (teams beaten that week) / (total teams - 1)`}
            notes="All-play win rate is the purest measure of team strength because it removes schedule luck entirely. A team that scores above the median 12 out of 14 weeks has a high all-play rate regardless of their actual record. Used as an input to both Power Score and Luck."
          />
        </Section>

        <Section title="LJ Index" color={blue}>
          <Metric
            name="LJ Index"
            tagline="Luck vs skill scatter plot"
            formula={`X axis = All-Play Win% relative to league average
Y axis = Luck (winning % over expected) relative to league average
Bubble size = Power Score`}
            inputs={[
              ['X > 0', 'Above-average all-play performance -- team is genuinely strong'],
              ['X < 0', 'Below-average all-play performance -- team is weak relative to league'],
              ['Y > 0', 'Won more games than scoring deserved -- lucky schedule'],
              ['Y < 0', 'Won fewer games than scoring deserved -- unlucky schedule'],
            ]}
            notes="Both axes are centered at zero (league average). The four quadrants tell the story: top-right is good and lucky, bottom-right is good but unlucky, top-left is lucky but not actually strong, bottom-left is bad and unlucky. The all-time view aggregates data across multiple seasons, giving each manager a career position on the chart."
          />
        </Section>

        <Section title="Rivalry Score" color={red}>
          <Metric
            name="Rivalry Score"
            tagline="How intense is this matchup?"
            formula={`RivalryScore = (StatsScore × 0.60) + (InterpersonalScore × 0.40)

StatsScore = (
  Closeness    × 0.35 +
  Volume       × 0.25 +
  AvgMargin    × 0.25 +
  PlayoffMeets × 0.15
)`}
            inputs={[
              ['Closeness', '1 minus the ratio of win differential to total games. A 10-10 record = 1.0, a 18-2 record ≈ 0.2'],
              ['Volume', 'Total games played, normalized to a max of ~20 games'],
              ['AvgMargin', 'Inverse of average point margin -- tighter games score higher, normalized to 50 pts max'],
              ['PlayoffMeets', 'Number of playoff matchups between the two managers, normalized to 3 meetings'],
              ['InterpersonalScore', '1 if either manager named the other as a rival, 0 otherwise'],
            ]}
            notes="The rivalry score is on a 0-100 scale. A pure stats rivalry with no interpersonal history maxes out at 60. A named rivalry with no head-to-head history scores 40. Most top rivalries combine both. The score determines the ordering on the rivalry page and each manager's top 3 rivals."
          />
        </Section>

        <Section title="Career Power Rank" color={gold}>
          <Metric
            name="Career Power Rank"
            tagline="All-time manager ranking"
            formula={`CareerScore = (NormAvgPowerScore × 0.50) + (NormChampionships × 0.50)

Normalized = (value - min) / (max - min)`}
            inputs={[
              ['NormAvgPowerScore', 'Career average Power Score, normalized against the best and worst career averages in the league'],
              ['NormChampionships', 'Championship count, normalized against the manager with the most rings'],
            ]}
            notes="Career rank gives equal weight to sustained excellence (power score) and winning when it counts (championships). A manager who wins 3 rings but plays inconsistently will rank similarly to a manager who plays at an elite level every season but never wins. Both are considered equally valid paths to the top."
          />
        </Section>

        <Section title="Draft" color={blue}>
          <Metric
            name="Pick Grade  (A+ → F)"
            tagline="Per-pick grade based on where a player finished vs where they were drafted"
            formula={`delta = fptsRank − draftPosRank

  negative delta  →  outperformed draft slot  (good)
  positive delta  →  underperformed draft slot (bad)`}
            inputs={[
              ['fptsRank', 'Where this player finished in half-PPR scoring at their position that season (WR12 = 12th-best WR)'],
              ['draftPosRank', 'Where this player was drafted positionally across the whole league (WR3 = 3rd WR off the board)'],
              ['delta', 'fptsRank − draftPosRank. A pick drafted WR3 who finishes as WR1 has delta = −2 (great). A WR1 pick who finishes WR18 has delta = +17 (bust).'],
            ]}
            notes="Thresholds are tighter in early rounds because those picks carry higher expectations. A delta of 0 in round 1 (you got exactly what the market expected) grades B+. The same delta in round 10 grades A. Picks without fpts data — injured players, guys who were cut, anyone missing from PFR records — are treated as scoring 0 actual points and grade F or D in early rounds."
          />

          {/* Grade threshold table */}
          <div style={{ background: cardBg, padding: effectiveMobile ? '16px' : '24px', marginBottom: '1px', borderLeft: `3px solid ${blue}` }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: effectiveMobile ? '16px' : '20px', color: text, marginBottom: '16px' }}>Grade Thresholds by Round</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: d ? '#111' : '#e4e0d8' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: muted, fontWeight: '600', letterSpacing: '0.08em', fontSize: '10px', textTransform: 'uppercase', borderBottom: `1px solid ${border}` }}>Grade</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: muted, fontWeight: '600', letterSpacing: '0.08em', fontSize: '10px', textTransform: 'uppercase', borderBottom: `1px solid ${border}` }}>Rds 1–4 (delta ≤)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: muted, fontWeight: '600', letterSpacing: '0.08em', fontSize: '10px', textTransform: 'uppercase', borderBottom: `1px solid ${border}` }}>Rds 5–9 (delta ≤)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: muted, fontWeight: '600', letterSpacing: '0.08em', fontSize: '10px', textTransform: 'uppercase', borderBottom: `1px solid ${border}` }}>Rd 10+ (delta ≤)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: muted, fontWeight: '600', letterSpacing: '0.08em', fontSize: '10px', textTransform: 'uppercase', borderBottom: `1px solid ${border}` }}>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['A+', '−3', '−2', '−5', green, 'Significantly outperformed slot — elite find'],
                    ['A',  '0',  '−1', '−3', green, 'Outperformed or matched at the top — clear hit'],
                    ['B+', '1',  '0',  '−1', green, 'Slightly outperformed — solid pick'],
                    ['B−', '2',  '1',  '0',  green, 'Matched expectation — acceptable'],
                    ['C+', '5',  '3',  '2',  muted, 'Minor miss — got most of the value'],
                    ['C−', '8',  '5',  '3',  muted, 'Meaningful miss — below expectations'],
                    ['D+', '11', '7',  '6',  red,   'Significant underperformance'],
                    ['D−', '15', '10', '9',  red,   'Near-bust — little value relative to slot'],
                    ['F',  '16+','11+','10+', red,   'Bust — did not contribute at their draft cost'],
                  ].map(([grade, r4, r9, r10, color, meaning], i) => (
                    <tr key={grade} style={{ background: i % 2 === 0 ? 'transparent' : (d ? '#0d0d0d' : '#f0ede6') }}>
                      <td style={{ padding: '8px 12px', fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: '700', color }}>{grade}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: text, fontFamily: 'monospace' }}>{r4}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: text, fontFamily: 'monospace' }}>{r9}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: text, fontFamily: 'monospace' }}>{r10}</td>
                      <td style={{ padding: '8px 12px', color: muted }}>{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '11px', color: muted, marginTop: '12px', lineHeight: 1.6 }}>
              B− or better = "hit." A+ through B− count toward a manager's hit rate. Note: grades in rounds 10+ are easier to achieve because the expectation bar is lower — even a modest contributor can beat their slot.
            </p>
          </div>

          <Metric
            name="Pts vs Slot  (rawValue)"
            tagline="Actual fantasy points minus the expected fantasy points at that draft slot"
            formula={`rawValue = fpts − expectedFpts

expectedFpts = season fpts of whoever finished at the same
               positional rank as your pick was drafted`}
            inputs={[
              ['fpts', 'Half-PPR fantasy points for the full season, sourced from Pro Football Reference'],
              ['expectedFpts', 'If you drafted the 3rd WR in the league, expectedFpts = the half-PPR total of whoever actually finished as WR3 that year'],
              ['Pool cap', 'Top 70 RB/WR by fpts; top 32 QB/TE by fpts. Picks beyond the cap are evaluated against the last pool value.'],
              ['Null fpts', 'If no fpts data exists (injured, cut, not in PFR), the pick is treated as scoring 0. rawValue = 0 − expectedFpts.'],
            ]}
            notes="A positive rawValue means the player outscored what a pick at their slot should have produced. This is the foundational metric underlying most draft intelligence stats on the site. It is capped to prevent fringe players from dominating the pool."
          />

          <Metric
            name="Draft Grade  (per-draft or career)"
            tagline="Aggregate grade across an entire draft or a manager's career — same A+ → F scale"
            formula={`valueScore  = z-score of rawValue (across all picks, all seasons)
Draft Grade = gradeLabel( avg valueScore for all picks in draft )`}
            inputs={[
              ['valueScore', 'rawValue normalized to a bell curve. 0 = exactly league average. +1 = one standard deviation above average.'],
              ['avg valueScore', 'Average valueScore across all graded picks in a single draft or across a manager\'s career'],
            ]}
            notes="Z-scoring makes draft grades comparable across seasons with different scoring environments. A 2019 draft and a 2023 draft are graded on the same relative scale regardless of how fantasy scores changed."
          />

          <Metric
            name="Hit Rate"
            tagline="Percentage of picks graded B− or better"
            formula={`Hit = grade is A+, A, B+, or B−
Hit Rate = Hits ÷ Total graded picks`}
            notes="A hit means the pick at least matched its slot's expectation. Hit rate rewards consistency — a manager who finds solid contributors throughout the draft will outscore one who lands one star and busts everything else."
          />

          <Metric
            name="Blended Value Score"
            tagline="Used in Position ROI and Positional Value Cliff — corrects for round bias"
            formula={`BlendedScore = 0.5 × z(rawValue) + 0.5 × z(fpts)

z(rawValue)  captures efficiency vs slot expectation
z(fpts)      captures absolute fantasy impact`}
            notes="Pure rawValue is biased by round: early picks look worse because busts are costly against a high expectation, and late picks look better because any contribution beats a near-zero floor. The blended score corrects this — a round-12 player who scores 200 pts gets credit for real impact even if they only barely beat their slot. Both components are z-scored so they're on the same scale before averaging."
          />

          <Metric
            name="Strategy Tags"
            tagline="Draft archetype labels based on positional distribution in the first 4–5 rounds"
            inputs={[
              ['Zero RB', 'Fewer than 2 RBs in rounds 1–5, no Hero RB — leaning away from the position early'],
              ['Zero WR', 'Fewer than 2 WRs in rounds 1–5, no Hero WR'],
              ['Early RBs', '3 or more RBs drafted in rounds 1–4'],
              ['Early WRs', '3 or more WRs drafted in rounds 1–4'],
              ['Hero RB', 'RB drafted in round 1, but only 1 total RB in rounds 1–5 — bet big on one player'],
              ['Hero WR', 'WR drafted in round 1, but only 1 total WR in rounds 1–5'],
              ['Balanced', 'At least 2 RBs and 2 WRs in rounds 1–4, no single-position lean — mutually exclusive with RB/WR tags'],
              ['Early QB', 'First QB drafted in rounds 1–4'],
              ['Late QB', 'First QB not drafted until round 10 or later'],
              ['Early TE', 'First TE drafted in rounds 1–4'],
              ['Late TE', 'First TE not drafted until round 10 or later'],
            ]}
            notes="A draft can have multiple tags. Hero RB/WR takes precedence over Early/Zero tags for that position. QB and TE tags are evaluated independently from the RB/WR tags."
          />

          <Metric
            name="Carry Rate"
            tagline="What % of a team's season scoring came from their top 3 drafted players"
            formula={`CarryRate = fpts(top-3 picks by season score) ÷ total team fpts
Career carry rate = average CarryRate across all seasons`}
            notes="High carry rate (>55%) means the roster was star-dependent — great if those players hit, risky if they bust. Low carry rate (<45%) suggests the team built depth rather than relying on stars. Carry rate reflects the result of the draft, not the intent."
          />

          <Metric
            name="Sleeper Pick"
            tagline="A late-round pick that finished top 12 at their position"
            formula={`Sleeper = drafted in round 8 or later
          AND finished top-12 at position (fptsRank ≤ 12)`}
            notes="Sleepers are the best-case late-round outcome — real value the rest of the league missed at the draft table. Sleeper rate measures how often a manager finds these relative to their total late-round skill-position picks."
          />

          <Metric
            name="QB–WR Stack ROI"
            tagline="Whether pairing a QB and WR from the same NFL team in a draft improves overall draft results"
            formula={`Stack = a draft that contains both a QB and a WR
        from the same NFL team
Stack ROI = avg blended score of stacked drafts
          − avg blended score of unstacked drafts`}
            notes="Stacking exploits real-game target share: a QB and their top WR benefit from the same big game. Positive stack ROI means stacked drafts historically outperform in this league. Negative means no advantage — or that the commitment cost more than it returned."
          />
        </Section>

        <Section title="Other Stats" color={muted}>
          <Metric
            name="Points For (PF) / Points Against (PA)"
            tagline="Raw scoring totals"
            formula="PF = Sum of all scores in regular season games\nPA = Sum of all opponent scores in regular season games\nDiff = PF - PA\nPPG Diff = Diff / Games played"
            notes="All point totals on this site are regular season only unless explicitly noted. Playoff games and Mol Bowl games are excluded from career and season totals."
          />
          <Metric
            name="Win %"
            formula="Win% = Wins / (Wins + Losses)"
            notes="Ties are excluded from win percentage calculations. Playoff games are excluded unless the toggle is enabled."
          />
          <Metric
            name="Mol Bowl"
            tagline="The consolation bracket final"
            formula="The Mol Bowl is the final game of the consolation bracket -- played between the two teams that lost their first two playoff games. The loser of the Mol Bowl finishes last."
            notes="Mol Bowl games are tracked separately from the winner's bracket and are excluded from power score, luck, and all-play calculations. On the H2H page, Mol Bowl games are labeled separately from playoff games."
          />
        </Section>

      </div>
    </div>
  )
}
