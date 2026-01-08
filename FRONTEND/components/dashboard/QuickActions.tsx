import React from 'react'
import Link from 'next/link'
import { UserPlus, Building2, FileBarChart, Settings } from 'lucide-react'

export default function QuickActions() {
    const actions = [
        { label: 'הוספת עובד', icon: UserPlus, color: 'text-emerald-500', bg: 'bg-emerald-50', href: '/employees' },
        { label: 'דוחות', icon: FileBarChart, color: 'text-purple-500', bg: 'bg-purple-50', href: '/dashboard' },
    ]

    return (
        <div className="bg-white rounded-xl shadow-sm h-full min-h-[140px] border border-gray-100 flex flex-col">
            <div className="px-4 py-3 border-b">
                <h3 className="text-sm font-bold text-gray-700 text-right">פעולות מהירות</h3>
            </div>
            <div className="p-4 flex items-center justify-around flex-1">
                {actions.map((action, idx) => (
                    <Link key={idx} href={action.href}>
                        <div className="flex flex-col items-center gap-3 cursor-pointer group transition-all hover:-translate-y-1">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${action.bg} ${action.color} shadow-sm group-hover:shadow-md transition-all`}>
                                <action.icon size={22} strokeWidth={1.5} />
                            </div>
                            <span className="text-xs text-gray-700 font-medium text-center group-hover:text-gray-900">{action.label}</span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
