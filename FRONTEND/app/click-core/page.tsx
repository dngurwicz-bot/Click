import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Logo from '@/components/Logo'
import Link from 'next/link'
import { Users, History, Network, ArrowRight } from 'lucide-react'
import LogoutButton from '@/components/LogoutButton'
import OrganizationSwitcher from '@/components/dashboard/OrganizationSwitcher'
import UserAvatar from '@/components/dashboard/UserAvatar'

export default async function ClickCorePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const quickAccessCards = [
        {
            title: 'תיק עובד חכם',
            description: 'פרופיל 360, פרטים אישיים ומסמכים',
            icon: Users,
            href: '/employees',
            color: 'blue'
        },
        {
            title: 'ציר זמן היסטורי',
            description: 'תיעוד שינויי תפקיד, סטטוס והיסטוריה',
            icon: History,
            href: '/employees',
            color: 'purple'
        },
        {
            title: 'ניהול מבנה ארגוני',
            description: 'מחלקות, כפיפויות ומנהלים',
            icon: Network,
            href: '/admin/organizations',
            color: 'green'
        }
    ]

    const colorClasses = {
        blue: {
            bg: 'bg-blue-50',
            iconBg: 'bg-blue-100',
            iconText: 'text-blue-600',
            hoverBg: 'hover:bg-blue-100',
            border: 'border-blue-200'
        },
        purple: {
            bg: 'bg-purple-50',
            iconBg: 'bg-purple-100',
            iconText: 'text-purple-600',
            hoverBg: 'hover:bg-purple-100',
            border: 'border-purple-200'
        },
        green: {
            bg: 'bg-green-50',
            iconBg: 'bg-green-100',
            iconText: 'text-green-600',
            hoverBg: 'hover:bg-green-100',
            border: 'border-green-200'
        }
    }

    return (
        <div className="min-h-screen" style={{ background: 'var(--background)' }}>
            {/* Navigation Bar */}
            <nav className="bg-white shadow-sm border-b sticky top-0 z-40" style={{ borderColor: 'var(--border-color)' }}>
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-6">
                            <Logo size="md" />
                            {/* Organization Switcher */}
                            <div className="ml-4">
                                <OrganizationSwitcher />
                            </div>
                            {/* Active Module Indicator */}
                            <div className="hidden md:flex items-center gap-6 mr-4">
                                <div className="h-6 w-px bg-gray-200" />
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border-2 border-blue-200">
                                    <div className="p-1 bg-blue-600 rounded text-white shadow-sm">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <rect width="7" height="7" x="3" y="3" rx="1" />
                                            <rect width="7" height="7" x="14" y="3" rx="1" />
                                            <rect width="7" height="7" x="14" y="14" rx="1" />
                                            <rect width="7" height="7" x="3" y="14" rx="1" />
                                        </svg>
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <span className="text-sm font-bold text-blue-600 leading-tight">C.C</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <LogoutButton />
                            <UserAvatar user={user} />
                        </div>
                    </div>
                </div>
            </nav>

            <main className="w-full px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-600 rounded-lg text-white shadow-md">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect width="7" height="7" x="3" y="3" rx="1" />
                                <rect width="7" height="7" x="14" y="3" rx="1" />
                                <rect width="7" height="7" x="14" y="14" rx="1" />
                                <rect width="7" height="7" x="3" y="14" rx="1" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900">Click Core</h1>
                    </div>
                    <p className="text-gray-600 text-lg">מערכת ליבה לניהול עובדים ומבנה ארגוני</p>
                </div>

                {/* Quick Access Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {quickAccessCards.map((card, idx) => {
                        const colors = colorClasses[card.color as keyof typeof colorClasses]
                        return (
                            <Link
                                key={idx}
                                href={card.href}
                                className={`${colors.bg} ${colors.border} border-2 rounded-xl p-6 transition-all duration-200 ${colors.hoverBg} hover:shadow-lg group`}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-3 ${colors.iconBg} ${colors.iconText} rounded-lg group-hover:scale-110 transition-transform`}>
                                        <card.icon size={24} />
                                    </div>
                                    <ArrowRight className={`${colors.iconText} opacity-0 group-hover:opacity-100 transition-opacity`} size={20} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{card.title}</h3>
                                <p className="text-gray-600 text-sm">{card.description}</p>
                            </Link>
                        )
                    })}
                </div>

                {/* Stats Overview */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">סטטיסטיקות כלליות</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <div className="text-3xl font-bold text-blue-600 mb-1">-</div>
                            <div className="text-sm text-gray-600">סך עובדים פעילים</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <div className="text-3xl font-bold text-purple-600 mb-1">-</div>
                            <div className="text-sm text-gray-600">מחלקות</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-3xl font-bold text-green-600 mb-1">-</div>
                            <div className="text-sm text-gray-600">עדכונים השבוע</div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
