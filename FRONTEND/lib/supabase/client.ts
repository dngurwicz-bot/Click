import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please check your .env.local file.\n' +
      'Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
      'Get them from: https://supabase.com/dashboard/project/_/settings/api'
    )
  }

  if (supabaseAnonKey === 'your-anon-key-here' || supabaseAnonKey.length < 50) {
    throw new Error(
      'Invalid API key. Please update NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local with your actual Supabase anon key.\n' +
      'Get it from: https://supabase.com/dashboard/project/ighrmrvhtgihhsaztmma/settings/api'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
