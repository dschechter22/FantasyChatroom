import { createClient } from '@supabase/supabase-js'

export const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
