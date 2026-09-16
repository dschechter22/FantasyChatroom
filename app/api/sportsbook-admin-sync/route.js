// Lets the sportsbook's admin UI trigger a real, live ESPN sync on demand
// instead of waiting for the next scheduled cron tick (see vercel.json --
// espn-sync only runs once a day). This route holds CRON_SECRET server-side
// and forwards it to espn-sync itself, so the secret never has to be sent to
// (or stored in) the browser -- the admin PIN gate on the client is the only
// thing standing between a visitor and this button, same soft protection
// every other admin action on this page already relies on.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const week = searchParams.get('week')

  const target = new URL('/api/espn-sync', request.url)
  if (week) target.searchParams.set('week', week)

  const headers = {}
  if (process.env.CRON_SECRET) headers['Authorization'] = `Bearer ${process.env.CRON_SECRET}`

  const res = await fetch(target.toString(), { headers, cache: 'no-store' })
  const data = await res.json()
  return Response.json(data, { status: res.status })
}
