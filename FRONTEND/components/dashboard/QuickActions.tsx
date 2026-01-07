import React from 'react'
import Link from 'next/link'
import { UserPlus, Building2, FileBarChart, Settings } from 'lucide-react'

export default function QuickActions() {
    const actions = [
        { label: 'הוספת עובד', icon: UserPlus, color: 'text-emerald-500', bg: 'bg-emerald-50', href: '/employees' }, // Temporarily to employees list until create page exists
        { label: 'ניהול ארגונים', icon: Building2, color: 'text-blue-500', bg: 'bg-blue-50', href: '/admin/organizations' },
        { label: 'דוחות', icon: FileBarChart, color: 'text-purple-500', bg: 'bg-purple-50', href: '/dashboard' }, // Placeholder
        { label: 'הגדרות מערכת', icon: Settings, color: 'text-slate-500', bg: 'bg-slate-50', href: '/dashboard' }, // Placeholder
    ]

    return (
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-around h-full min-h-[140px] border border-gray-100">
            {actions.map((action, idx) => (
                <Link key={idx} href={action.href}>
                    <div className="flex flex-col items-center gap-3 cursor-pointer group transition-all hover:-translate-y-1">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${action.bg} ${action.color} shadow-sm group-hover:shadow-md transition-all`}>
                            <action.icon size={24} strokeWidth={1.5} />
                        </div>
                        <span className="text-sm text-gray-700 font-medium text-center group-hover:text-gray-900">{action.label}</span>
                    </div>
                </Link>
            ))}
        </div>
    )
}
