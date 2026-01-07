import React from 'react'
import { User as UserIcon } from 'lucide-react'

interface UserWelcomeCardProps {
    user: {
        email?: string
        name?: string
        id?: string
    } | null
}

export default function UserWelcomeCard({ user }: UserWelcomeCardProps) {
    // Determine display name: metadata name > user metadata full_name > email > 'אורח'
    const displayName = user?.name || user?.email?.split('@')[0] || 'אורח'

    // Get initials or first letter
    const initials = displayName.substring(0, 2).toUpperCase()

    return (
        <div className="bg-gradient-to-br from-[#00A896] to-[#028090] rounded-xl p-6 text-white flex flex-col justify-between h-auto min-h-[140px] relative overflow-hidden shadow-md">
            <div className="flex justify-between items-center z-10">
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold backdrop-blur-sm border border-white/10 shadow-inner">
                        {initials}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-wide">{displayName}</h2>
                        <p className="text-sm opacity-80 font-medium">{user?.email || 'מנהל מערכת'}</p>
                    </div>
                </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl z-0 pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-black/5 pointer-events-none" />
        </div>
    )
}
