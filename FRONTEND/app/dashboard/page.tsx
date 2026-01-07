import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { CardHeader, CardContent } from '@/components/ui/Card'
import Link from 'next/link'
import { Building2, Users, FileText, Settings, Search } from 'lucide-react'
import LogoutButton from '@/components/LogoutButton'
import UserWelcomeCard from '@/components/dashboard/UserWelcomeCard'
import QuickActions from '@/components/dashboard/QuickActions'
import TasksWidget from '@/components/dashboard/TasksWidget'
import CompanyUpdatesWidget from '@/components/dashboard/CompanyUpdatesWidget'
import ClickCoreMenu from '@/components/dashboard/ClickCoreMenu'

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
              {/* Modules Navigation */}
              <div className="hidden md:flex items-center gap-6 mr-8">
                <ClickCoreMenu />
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
        <div className="grid grid-cols-12 gap-6">
          {/* Top Row: User Card + Quick Actions */}
          <div className="col-span-12 lg:col-span-4">
            <UserWelcomeCard user={user} />
          </div>
          <div className="col-span-12 lg:col-span-8">
            <QuickActions />
          </div>

          {/* Main Content: Tasks vs Updates */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 h-[600px]">
            <TasksWidget />
            {/* Lower section could be 'Employee Management' or similar from original request, keeping space for it or expansion */}
            <div className="bg-white rounded-md shadow-sm p-4 flex-1">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-700">ניהול עובדים</h3>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="חיפוש עובד"
                    className="pl-8 pr-3 py-1 text-sm border rounded bg-gray-50"
                  />
                  <Search className="absolute left-2 top-1.5 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div className="flex border-b text-sm mb-4">
                <button className="px-4 py-2 text-blue-600 border-b-2 border-blue-600 font-bold">העובדים שלי</button>
                <button className="px-4 py-2 text-gray-500 hover:text-blue-600">לוח היעדרויות</button>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 h-[600px]">
            <CompanyUpdatesWidget />
          </div>
        </div>
      </main>
    </div>
  )
}
