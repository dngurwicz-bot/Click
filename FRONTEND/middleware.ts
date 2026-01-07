import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            response = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Refresh session to ensure cookies are up to date
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('Session found:', !!session)
    if (session) {
      console.log('Token expires at:', new Date(session.expires_at! * 1000).toISOString())
      console.log('System time:', new Date().toISOString())
      // Log access token characters to verify it's not empty/malformed
      console.log('Token start:', session.access_token.substring(0, 10) + '...')
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    console.log('Middleware Access:', request.nextUrl.pathname)
    console.log('Cookies:', request.cookies.getAll().map(c => c.name))
    console.log('User found:', !!user)
    if (authError) {
      console.error('Auth Error:', authError.message)
    }
    if (user) {
      console.log('User ID:', user.id)
    }

    // Protect dashboard routes
    if (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/admin')) {
      if (!user) {
        console.log('Redirecting to login (no user)')
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
        return NextResponse.redirect(loginUrl)
      }
    }

    // Redirect logged-in users away from login page
    if (request.nextUrl.pathname === '/login' && user) {
      console.log('Redirecting to dashboard (user found)')
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Redirect root to login
    if (request.nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return response
  } catch (error) {
    console.error('Middleware error:', error)
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
