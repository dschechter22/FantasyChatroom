const LEAGUE_ID = 95898
const ESPN_S2 = process.env.ESPN_S2
const ESPN_SWID = process.env.ESPN_SWID

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '2024')

  const url = `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${LEAGUE_ID}?view=mTeam&view=mMatchupScore&view=mSettings`

  const res = await fetch(url, {
    headers: {
      'Cookie': `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}`,
      'Accept': 'application/json',
      'Referer': 'https://fantasy.espn.com/',
      'Origin': 'https://fantasy.espn.com',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'X-Fantasy-Source': 'kona',
      'X-Fantasy-Filter': '{}',
    },
  })

  const raw = await res.text()

  return Response.json({
    status: res.status,
    raw_preview: raw.slice(0, 500),
  })
}
