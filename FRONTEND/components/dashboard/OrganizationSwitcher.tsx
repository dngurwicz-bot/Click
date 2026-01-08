'use client'

import { useState } from 'react'
import { Organization } from '@/lib/api/client'
import { ChevronDown, Building2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/contexts/OrganizationContext'

export default function OrganizationSwitcher() {
    const { organization, organizations, setOrganization, isLoading } = useOrganization()
    const [isOpen, setIsOpen] = useState(false)

    const handleSelect = (org: Organization) => {
        setOrganization(org)
        setIsOpen(false)
    }

    if (isLoading) {
        return <div className="h-10 w-48 bg-gray-100/50 animate-pulse rounded-full" />
    }

    if (organizations.length === 0) {
        return null
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-200 transition-colors text-sm font-medium text-gray-700 h-9 min-w-[180px]"
            >
                <div className="p-1 rounded-full bg-blue-100 text-blue-600">
                    <Building2 size={14} />
                </div>
                <span className="flex-1 text-right truncate">
                    {organization ? organization.name : 'בחר ארגון'}
                </span>
                <ChevronDown size={14} className={cn("text-gray-400 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-11 right-0 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 overflow-hidden">
                        <div className="px-3 py-2 border-b bg-gray-50/50">
                            <span className="text-xs font-semibold text-gray-500">הארגונים שלי</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {organizations.map((org) => (
                                <button
                                    key={org.id}
                                    onClick={() => handleSelect(org)}
                                    className="w-full text-right px-4 py-2.5 flex items-center justify-between hover:bg-blue-50 transition-colors group"
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            organization?.id === org.id ? "bg-blue-500" : "bg-gray-300 group-hover:bg-blue-300"
                                        )} />
                                        <span className={cn(
                                            "text-sm truncate",
                                            organization?.id === org.id ? "font-semibold text-blue-700" : "text-gray-700"
                                        )}>
                                            {org.name}
                                        </span>
                                    </div>
                                    {organization?.id === org.id && (
                                        <Check size={14} className="text-blue-600" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
