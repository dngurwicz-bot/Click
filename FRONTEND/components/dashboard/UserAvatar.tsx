'use client'

import React from 'react'

interface UserAvatarProps {
    user: {
        email?: string
        name?: string
    } | null
}

export default function UserAvatar({ user }: UserAvatarProps) {
    const displayName = user?.name || user?.email?.split('@')[0] || 'Guest'
    const initials = displayName.substring(0, 2).toUpperCase()

    return (
        <div className="flex items-center gap-3 pl-4 rtl:pl-0 rtl:pr-4 border-l rtl:border-l-0 rtl:border-r border-gray-200 h-8">
            <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-gray-800 leading-none">{displayName}</div>
                <div className="text-[10px] text-gray-500">{user?.email}</div>
            </div>
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm border-2 border-white ring-1 ring-gray-100">
                {initials}
            </div>
        </div>
    )
}
