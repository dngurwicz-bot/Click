'use client'

import React from 'react'
import { Building2, Users, Shield, ArrowRight, Bell, Settings, Search } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
    const [isSuperAdmin, setIsSuperAdmin] = React.useState(false)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        async function checkRole() {
            try {
                const { api } = await import('@/lib/api/client')
                const employee = await api.getCurrentEmployee()
                if (employee?.is_super_admin) {
                    setIsSuperAdmin(true)
                }
            } catch (error) {
                console.error('Failed to fetch role:', error)
            } finally {
                setLoading(false)
            }
        }
        checkRole()
    }, [])

    const settingsSections = [
        {
            title: 'ניהול מערכת',
            items: [
                ...(isSuperAdmin ? [{ label: 'ניהול ארגונים', icon: Building2, href: '/admin/organizations', description: 'הוספה ועריכה של ארגונים במערכת' }] : []),
                { label: 'ניהול עדכונים', icon: Bell, href: '/settings/updates', description: 'פרסום הודעות ועדכונים לעובדי הארגון' },
                { label: 'ניהול משתמשים', icon: Users, href: '#', description: 'ניהול הרשאות ומשתמשי מערכת' },
            ]
        },
        {
            title: 'אבטחה',
            items: [
                { label: 'הגדרות אבטחה', icon: Shield, href: '/settings/reset-password', description: 'מדיניות סיסמאות ואימות דו-שלבי' },
            ]
        }
    ]

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8" dir="rtl">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/dashboard" className="p-2 rounded-full hover:bg-gray-200 transition-colors">
                        <ArrowRight className="text-gray-600" />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">הגדרות מערכת</h1>
                </div>

                <div className="max-w-7xl mx-auto">
                    {/* Search Bar Placeholder - Right Aligned */}
                    <div className="max-w-md ml-auto mb-8 relative">
                        <input
                            type="text"
                            placeholder="חיפוש..."
                            className="w-full pl-4 pr-10 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                        />
                        <div className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400">
                            <Search size={18} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                        {settingsSections.map((section, idx) => (
                            <div key={idx} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200">
                                <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-blue-50/30">
                                    <h2 className="text-lg font-bold text-gray-800">{section.title}</h2>
                                    {/* Using first item's icon as section icon if technically needed, or a generic one */}
                                    <div className="text-blue-500 bg-white p-1.5 rounded-md shadow-sm">
                                        {section.title.includes('אבטחה') ? <Shield size={18} /> :
                                            section.title.includes('ניהול') ? <Settings size={18} /> :
                                                <Users size={18} />}
                                    </div>
                                </div>
                                <div className="p-2">
                                    {section.items.map((item, itemIdx) => (
                                        <Link
                                            key={itemIdx}
                                            href={item.href}
                                            className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 transition-colors text-gray-700 hover:text-blue-600 group"
                                        >
                                            <div className="text-gray-300 group-hover:text-blue-500 transition-colors">
                                                {/* Star/Icon placeholder */}
                                                <item.icon size={16} />
                                            </div>
                                            <span className="text-sm font-medium">{item.label}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
