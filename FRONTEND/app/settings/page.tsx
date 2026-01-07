'use client'

import React from 'react'
import { Building2, Users, Shield, ArrowRight, Bell } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
    const settingsSections = [
        {
            title: 'ניהול מערכת',
            items: [
                { label: 'ניהול ארגונים', icon: Building2, href: '/admin/organizations', description: 'הוספה ועריכה של ארגונים במערכת' },
                { label: 'ניהול עדכונים', icon: Bell, href: '/settings/updates', description: 'פרסום הודעות ועדכונים לעובדי הארגון' },
                { label: 'ניהול משתמשים', icon: Users, href: '#', description: 'ניהול הרשאות ומשתמשי מערכת' },
            ]
        },
        {
            title: 'אבטחה',
            items: [
                { label: 'הגדרות אבטחה', icon: Shield, href: '#', description: 'מדיניות סיסמאות ואימות דו-שלבי' },
            ]
        }
    ]

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8" dir="rtl">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/dashboard" className="p-2 rounded-full hover:bg-gray-200 transition-colors">
                        <ArrowRight className="text-gray-600" />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">הגדרות מערכת</h1>
                </div>

                <div className="space-y-6">
                    {settingsSections.map((section, idx) => (
                        <div key={idx} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                                <h2 className="text-lg font-medium text-gray-800">{section.title}</h2>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {section.items.map((item, itemIdx) => (
                                    <Link key={itemIdx} href={item.href} className="flex items-center p-6 hover:bg-gray-50 transition-colors group">
                                        <div className="bg-blue-50 p-3 rounded-lg text-blue-600 group-hover:bg-blue-100 transition-colors">
                                            <item.icon size={24} />
                                        </div>
                                        <div className="mr-4 flex-1">
                                            <h3 className="text-base font-semibold text-gray-900">{item.label}</h3>
                                            <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                                        </div>
                                        <ArrowRight className="text-gray-300 group-hover:text-blue-500 rotate-180 transition-colors" />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
