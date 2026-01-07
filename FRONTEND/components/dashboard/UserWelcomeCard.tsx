import React from 'react'
import { Clock, Calendar } from 'lucide-react'

interface UserWelcomeCardProps {
    user: {
        email?: string
        name?: string
        id?: string
        last_sign_in_at?: string
    } | null
}

export default function UserWelcomeCard({ user }: UserWelcomeCardProps) {
    const displayName = user?.name || user?.email?.split('@')[0] || 'Guest'

    // Format last login
    const lastLogin = user?.last_sign_in_at
        ? new Date(user.last_sign_in_at).toLocaleString('he-IL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : '--/--/----'

    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'בוקר טוב'
        if (hour < 18) return 'צהריים טובים'
        if (hour < 22) return 'ערב טוב'
        return 'לילה טוב'
    }

    return (
        <div className="bg-gradient-to-br from-[#00A896] to-[#028090] rounded-xl p-6 text-white flex flex-col justify-center h-full min-h-[140px] relative overflow-hidden shadow-md">
            <div className="z-10 relative">
                <h2 className="text-2xl font-bold tracking-wide mb-1">{getGreeting()}, {displayName}</h2>
                <p className="text-blue-50 text-sm mb-4">ברוך הבא למערכת הניהול שלך</p>

                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg text-xs backdrop-blur-sm border border-white/10">
                        <Clock size={14} />
                        <span>התחברות אחרונה: {lastLogin}</span>
                    </div>
                </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl z-0 pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-black/5 pointer-events-none" />
        </div>
    )
}
