'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, Loader2 } from 'lucide-react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        // Clear cookies on mount to prevent stale session issues
        if (typeof document !== 'undefined') {
            document.cookie.split(';').forEach((c) => {
                const name = c.trim().split('=')[0]
                if (name.startsWith('sb-')) {
                    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;`
                }
            })
        }
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        console.log('Login button clicked')
        console.log('Env Check:', {
            url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        })

        setLoading(true)
        setError(null)

        try {
            console.log('Creating client...')
            const supabase = createClient()

            console.log('Sending signIn request...')
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            console.log('SignIn Response:', { data: !!data, error })

            if (error) {
                console.error('Login error:', error)
                setError(error.message)
                setLoading(false)
                return
            }

            if (data.user) {
                console.log('User found, redirecting...')
                router.refresh()
                // Wait a small amount to ensuring cookies are set
                setTimeout(() => {
                    window.location.href = '/dashboard'
                }, 300)
            } else {
                console.warn('No user in response data')
            }
        } catch (err) {
            console.error('Unexpected error trace:', err)
            setError('An unexpected error occurred')
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex bg-[#F8F9FA]">
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-24 bg-white">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center space-y-2">
                        <h1 className="text-4xl font-bold text-[#2C3E50] mb-2">CLICK.</h1>
                        <h2 className="text-2xl font-bold text-[#2C3E50]">התחברות למערכת</h2>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6 mt-8">
                        <div className="space-y-4">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 border rounded-lg"
                                placeholder="your@email.com"
                                required
                            />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 border rounded-lg"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-[#00A896] text-white rounded-lg hover:bg-[#008B7A] disabled:opacity-50"
                        >
                            {loading ? 'מתחבר...' : 'התחבר'}
                        </button>
                    </form>
                </div>
            </div>
            <div className="absolute top-4 right-4">
                <a href="/dashboard" className="text-xs text-gray-300 hover:text-gray-500">Manual Dashboard Link</a>
            </div>
            <div className="hidden lg:flex w-1/2 bg-[#2C3E50] items-center justify-center">
                <div className="text-white text-9xl font-bold tracking-wider select-none">
                    CLICK
                </div>
            </div>
        </div>
    )
}
