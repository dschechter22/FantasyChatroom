import { createClient } from '@supabase/supabase-js'

export const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || 'f35680a1-3392-47e5-abf2-0e81ae662f88'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Supabase returns at most 1,000 rows per request, and a query over every
// season's matchups has no ORDER BY -- once the league's history passes 1,000
// games the newest rows (this week's scores) are the ones silently dropped.
// buildQuery returns an un-awaited select; this pages through it in order and
// resolves to the same { data, error } shape a single request would.
export async function fetchAll(buildQuery, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().order('id').range(from, from + pageSize - 1)
    if (error) return { data: rows.length ? rows : null, error }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return { data: rows, error: null }
}
