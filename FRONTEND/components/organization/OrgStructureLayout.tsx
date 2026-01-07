'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, GitBranch, Users, Layers } from 'lucide-react'
import Card from '@/components/ui/Card'

interface OrgStructureLayoutProps {
    children: React.ReactNode
    title: string
    description?: string
    actions?: React.ReactNode
}

export default function OrgStructureLayout({
    children,
    title,
    description,
    actions
}: OrgStructureLayoutProps) {
    const pathname = usePathname()

    const tabs = [
        {
            name: 'הגדרות',
            href: '/admin/organization/settings',
            icon: Settings
        },
        {
            name: 'אגפים',
            href: '/admin/organization/divisions',
            icon: Layers
        },
        {
            name: 'מחלקות',
            href: '/admin/organization/departments',
            icon: GitBranch
        },
        {
            name: 'תפקידים',
            href: '/admin/organization/positions',
            icon: Users
        },
    ]

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                        {title}
                    </h1>
                    {description && (
                        <p className="text-gray-500 mt-1">
                            {description}
                        </p>
                    )}
                </div>
                {actions && (
                    <div className="flex items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 rtl:space-x-reverse overflow-x-auto" aria-label="Tabs">
                    {tabs.map((tab) => {
                        const isActive = pathname === tab.href
                        return (
                            <Link
                                key={tab.name}
                                href={tab.href}
                                className={`
                  group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                  ${isActive
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                `}
                            >
                                <tab.icon
                                    className={`
                    ml-2 -mr-0.5 h-5 w-5
                    ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}
                  `}
                                />
                                {tab.name}
                            </Link>
                        )
                    })}
                </nav>
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {children}
            </div>
        </div>
    )
}
