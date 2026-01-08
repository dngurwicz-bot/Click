'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(false)

        try {
            const supabase = createClient()
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/settings/reset-password`,
            })

            if (error) {
                throw error
            }

            setSuccess(true)
        } catch (err: any) {
            console.error('Reset password error:', err)
            setError(err.message || 'אירעה שגיאה בשליחת המייל')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex bg-[#F8F9FA]">
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-24 bg-white">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center space-y-2">
                        <Link href="/login" className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-6 transition-colors">
                            <ArrowLeft size={16} className="ml-2" />
                            חזרה להתחברות
                        </Link>
                        <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">איפוס סיסמה</h1>
                        <h2 className="text-lg text-gray-600">הזן את המייל שלך ונשלח לך קישור לאיפוס</h2>
                    </div>

                    {!success ? (
                        <form onSubmit={handleReset} className="space-y-6 mt-8">
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#00A896] focus:border-transparent outline-none transition-shadow"
                                        placeholder="your@email.com"
                                        required
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-[#00A896] text-white rounded-lg hover:bg-[#008B7A] disabled:opacity-50 transition-colors font-medium shadow-sm hover:shadow-md"
                            >
                                {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
                            </button>
                        </form>
                    ) : (
                        <div className="text-center bg-green-50 p-6 rounded-xl border border-green-100">
                            <div className="flex justify-center mb-4">
                                <div className="p-3 bg-green-100 rounded-full text-green-600">
                                    <CheckCircle size={32} />
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-green-800 mb-2">המייל נשלח בהצלחה!</h3>
                            <p className="text-green-700 mb-6">
                                בדוק את תיבת הדואר שלך (וגם את תיבת הספאם) עבור ההוראות לאיפוס הסיסמה.
                            </p>
                            <Link
                                href="/login"
                                className="inline-block w-full py-3 bg-white border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition-colors font-medium"
                            >
                                חזרה להתחברות
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            <div className="hidden lg:flex w-1/2 bg-[#2C3E50] items-center justify-center">
                <Logo size="2xl" variant="light" />
            </div>
        </div>
    )
}
