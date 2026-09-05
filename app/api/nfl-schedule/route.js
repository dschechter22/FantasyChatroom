// Real NFL game schedule for the current week, from ESPN's public scoreboard
// endpoint (no auth needed -- this is the same one ESPN.com's own scoreboard
// page calls, not the private fantasy API in ../espn-sync). Proxied through
// our own route rather than fetched client-side to avoid CORS issues in the
// browser and to keep the parsing in one place.
//
// Pass ?week=N to ask for a specific week; omit it to get whatever ESPN
// considers "this week" right now, which is also how the app figures out
// which week to show without doing its own date math.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const week = searchParams.get('week')

  const url = new URL('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard')
  if (week) url.searchParams.set('week', week)

  const res = await fetch(url.toString())
  if (!res.ok) {
    return Response.json({ error: `ESPN returned ${res.status}` }, { status: 502 })
  }
  const data = await res.json()

  const games = (data.events || []).map(ev => {
    const comp = ev.competitions?.[0]
    const home = comp?.competitors?.find(c => c.homeAway === 'home')
    const away = comp?.competitors?.find(c => c.homeAway === 'away')
    return {
      id: ev.id,
      date: comp?.date || ev.date,
      shortName: ev.shortName || ev.name,
      home: { name: home?.team?.displayName, abbreviation: home?.team?.abbreviation, score: home?.score },
      away: { name: away?.team?.displayName, abbreviation: away?.team?.abbreviation, score: away?.score },
      state: comp?.status?.type?.state,
      statusDetail: comp?.status?.type?.shortDetail,
      broadcast: comp?.broadcasts?.[0]?.names?.[0] || null,
    }
  })

  return Response.json({ week: data.week?.number ?? null, games })
}
