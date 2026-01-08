'use client'

import React from 'react'
import Logo from '@/components/Logo'
import LogoutButton from '@/components/LogoutButton'
import OrganizationSwitcher from '@/components/dashboard/OrganizationSwitcher'
import UserAvatar from '@/components/dashboard/UserAvatar'
import { User } from '@supabase/supabase-js'

interface DashboardNavbarProps {
    user: User | null
}

export default function DashboardNavbar({ user }: DashboardNavbarProps) {
    return (
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
    )
}
