import { createClient } from '@/lib/supabase/server'
import DashboardNavbar from '@/components/dashboard/DashboardNavbar'
import GlobalMessagePopup from '@/components/GlobalMessagePopup'
import { redirect } from 'next/navigation'

export default async function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    return (
        <div className="min-h-screen app-layout-container" style={{ background: 'var(--background)' }}>
            <DashboardNavbar user={user} />
            <GlobalMessagePopup />
            <main className="w-full px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
                {children}
            </main>
        </div>
    )
}
