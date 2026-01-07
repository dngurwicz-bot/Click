'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import { CardHeader, CardContent } from '@/components/ui/Card'
import { Mail, Lock, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message || 'שגיאה בהתחברות')
        setLoading(false)
        return
      }

      if (data.user && data.session) {
        // Wait for cookies to be set by Supabase
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Verify session is set
        const { data: { session: verifySession } } = await supabase.auth.getSession()
        
        if (verifySession) {
          // Use router.push first, then force reload if needed
          router.push('/dashboard')
          // Force a full page reload after a short delay to ensure middleware sees the session
          setTimeout(() => {
            window.location.href = '/dashboard'
          }, 200)
        } else {
          setError('שגיאה בשמירת ה-session - נסה שוב')
          setLoading(false)
        }
      } else {
        setError('התחברות נכשלה - אין session')
        setLoading(false)
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'שגיאה בהתחברות')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-md px-4">
        <Card variant="elevated" className="mb-6">
          <CardHeader>
            <div className="flex flex-col items-center gap-4">
              <Logo size="lg" />
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                התחברות למערכת
              </h1>
              <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                הכנס את פרטי ההתחברות שלך
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-4 rounded-lg border" style={{
                  background: 'var(--error-light)',
                  borderColor: 'var(--error)',
                  color: 'var(--error)'
                }}>
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <Input
                type="email"
                label="אימייל"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                icon={Mail}
              />

              <Input
                type="password"
                label="סיסמה"
                placeholder="הכנס סיסמה"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                icon={Lock}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={loading}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    מתחבר...
                  </>
                ) : (
                  'התחבר'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                אין לך חשבון?{' '}
                <a
                  href="#"
                  className="font-medium hover:underline"
                  style={{ color: 'var(--accent-teal)' }}
                  onClick={(e) => {
                    e.preventDefault()
                    // TODO: Add signup page
                    alert('עמוד הרשמה יגיע בקרוב')
                  }}
                >
                  הירשם כאן
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <a
            href="/"
            className="text-sm hover:underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            ← חזרה לדף הבית
          </a>
        </div>
      </div>
    </div>
  )
}
