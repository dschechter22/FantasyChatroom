import { createClient } from '@supabase/supabase-js'

export const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || 'f35680a1-3392-47e5-abf2-0e81ae662f88'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
