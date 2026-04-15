import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const LEAGUE_ID = 95898
const ESPN_S2 = process.env.ESPN_S2
const ESPN_SWID = process.env.ESPN_SWID

async function fetchSeason(year) {
  const url = `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${LEAGUE_ID}?view=mTeam&view=mMatchupScore&view=mSettings`
  const res = await fetch(url, {
    headers: {
      Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}`,
    },
  })
  if (!res.ok) {
    throw new Error(`ESPN API failed for ${year}: ${res.status}`)
  }
  return res.json()
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '2024')

  try {
    const data = await fetchSeason(year)

    const teams = data.teams || []
    const members = data.members || []

    const memberMap = {}
    members.forEach(m => {
      memberMap[m.id] = `${m.firstName} ${m.lastName}`.trim()
    })

    const teamSummaries = teams.map(t => ({
      espn_team_id: t.id,
      team_name: t.name,
      owner_id: t.primaryOwner,
      owner_name: memberMap[t.primaryOwner] || 'Unknown',
      wins: t.record?.overall?.wins || 0,
      losses: t.record?.overall?.losses || 0,
      points_for: t.record?.overall?.pointsFor || 0,
      points_against: t.record?.overall?.pointsAgainst || 0,
      standing: t.rankCalculatedFinal || null,
    }))

    return Response.json({
      year,
      team_count: teamSummaries.length,
      teams: teamSummaries,
      settings: {
        name: data.settings?.name,
        playoff_teams: data.settings?.scheduleSettings?.playoffTeamCount,
        reg_season_weeks: data.settings?.scheduleSettings?.matchupPeriodCount,
      }
    })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
