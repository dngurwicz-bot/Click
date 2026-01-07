'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, Mail, Loader2 } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        console.log('Attempting login...')

        try {
            const supabase = createClient()

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                console.error('Login error:', error)
                setError(error.message)
                setLoading(false)
                return
            }

            if (data.user) {
                console.log('Login successful, refreshing and pushing route...')
                router.refresh()
                router.push('/dashboard')
            }
        } catch (err) {
            console.error('Unexpected error:', err)
            setError('An unexpected error occurred')
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex bg-[#F8F9FA]">
            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-24 bg-white">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-8">
                            <h1 className="text-4xl font-bold tracking-tight text-[#2C3E50]">CLICK.</h1>
                            <span className="text-xs text-[#868E96] mt-auto mb-1 ml-2 tracking-widest">DNG HUB</span>
                        </div>
                        <h2 className="text-3xl font-bold text-[#2C3E50]">התחברות למערכת</h2>
                        <p className="text-[#868E96]">הכנס את פרטי ההתחברות שלך</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6 mt-8">
                        <div className="space-y-4">
                            <div className="relative">
                                <label className="block text-sm font-medium mb-1 text-[#2C3E50]">אימייל</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-4 py-3 border border-[#DEE2E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A896] bg-[#F8F9FA] pl-10"
                                        placeholder="your@email.com"
                                        required
                                    />
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ADB5BD] w-5 h-5" />
                                </div>
                            </div>

                            <div className="relative">
                                <label className="block text-sm font-medium mb-1 text-[#2C3E50]">סיסמה</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 border border-[#DEE2E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A896] bg-[#F8F9FA] pl-10"
                                        placeholder="••••••••"
                                        required
                                    />
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ADB5BD] w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-[#FDF2F2] border border-[#E74C3C] text-[#E74C3C] text-sm rounded-lg p-3 text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-[#00A896] hover:bg-[#008B7A] text-white font-medium rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                                    מתחבר...
                                </>
                            ) : (
                                'התחבר'
                            )}
                        </button>
                    </form>

                    <div className="text-center">
                        <a href="#" className="text-sm text-[#00A896] hover:underline">
                            אין לך חשבון? הרשם כאן
                        </a>
                    </div>
                </div>
            </div>

            {/* Left Side - Image/Decoration */}
            <div className="hidden lg:block w-1/2 relative bg-[#2C3E50] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#2C3E50] to-[#1a252f] opacity-90" />
                <div className="absolute inset-0 flex items-center justify-center text-white opacity-10">
                    {/* Abstract pattern or simply empty for now */}
                    <div className="text-9xl font-bold">CLICK</div>
                </div>
            </div>
        </div>
    )
}
