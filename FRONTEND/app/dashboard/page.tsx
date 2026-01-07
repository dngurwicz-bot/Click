import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { CardHeader, CardContent } from '@/components/ui/Card'
import Link from 'next/link'
import { Building2, Users, FileText, Settings } from 'lucide-react'
import LogoutButton from '@/components/LogoutButton'

import HilanIcon from '@/components/HilanIcon'

// ... existing imports

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // if (!user) {
  //   redirect('/login')
  // }

  // Debug log
  console.log('Dashboard Rendered. User:', user ? user.id : 'None')

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-40" style={{ borderColor: 'var(--border-color)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <Logo size="md" />
              {/* Hilan-style Icons */}
              <div className="hidden md:flex items-center gap-4 mr-8">
                <HilanIcon letter="A" label="ניהול מערכת" variant="yellow" />
                <HilanIcon letter="N" label="שירותי נט" variant="green" />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {user?.email || 'Guest User'}
              </span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            דשבורד
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            ברוך הבא למערכת Click HR
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/admin/organizations">
            <Card variant="elevated" className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg" style={{ background: 'var(--accent-teal-light)' }}>
                    <Building2 size={24} style={{ color: 'var(--accent-teal)' }} />
                  </div>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    ניהול ארגונים
                  </h3>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  צפייה וניהול כל הארגונים במערכת
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/employees">
            <Card variant="elevated" className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg" style={{ background: 'var(--accent-teal-light)' }}>
                    <Users size={24} style={{ color: 'var(--accent-teal)' }} />
                  </div>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    עובדים
                  </h3>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  ניהול עובדים ותיקי עובדים
                </p>
              </CardContent>
            </Card>
          </Link>

          <Card variant="elevated" className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg" style={{ background: 'var(--accent-teal-light)' }}>
                  <Settings size={24} style={{ color: 'var(--accent-teal)' }} />
                </div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  הגדרות
                </h3>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                הגדרות מערכת והרשאות
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
