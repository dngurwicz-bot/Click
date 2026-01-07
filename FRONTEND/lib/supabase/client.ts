import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  if (typeof window === 'undefined') {
    throw new Error('createClient can only be called from client-side code')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    const error = new Error(
      'Missing Supabase environment variables. Please check your .env.local file.'
    )
    if (process.env.NODE_ENV === 'development') {
      console.error('Supabase configuration error:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey,
      })
    }
    throw error
  }

  if (supabaseAnonKey === 'your-anon-key-here' || supabaseAnonKey.length < 50) {
    const error = new Error('Invalid API key. Please update NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
    if (process.env.NODE_ENV === 'development') {
      console.error('Invalid Supabase API key detected')
    }
    throw error
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
