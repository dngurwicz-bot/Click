'use client'
import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Users, History, Network, ChevronDown } from 'lucide-react'

export default function ClickCoreMenu() {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [menuRef])

    const menuItems = [
        { label: 'תיק עובד חכם', subLabel: 'פרופיל 360, פרטים אישיים', href: '/employees', icon: Users },
        { label: 'ציר זמן היסטורי', subLabel: 'תיעוד שינויי תפקיד וסטטוס', href: '/employees', icon: History },
        { label: 'ניהול מבנה ארגוני', subLabel: 'מחלקות, כפיפויות ומנהלים', href: '/admin/organizations', icon: Network },
    ]

    return (
        <div className="relative" ref={menuRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors group"
            >
                <div className="p-1.5 bg-blue-500 rounded-md text-white group-hover:scale-105 transition-transform">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
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
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-blue-900 leading-none">C.C</span>
                    <span className="text-[10px] text-blue-600 font-medium pt-0.5">ניהול ארגוני מתקדם</span>
                </div>
                <ChevronDown size={14} className={`text-blue-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                    <div className="p-2 space-y-1">
                        {menuItems.map((item, idx) => (
                            <Link
                                key={idx}
                                href={item.href}
                                className="flex items-start gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors group"
                                onClick={() => setIsOpen(false)}
                            >
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-200 transition-colors">
                                    <item.icon size={18} />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-gray-800 group-hover:text-blue-700">{item.label}</div>
                                    <div className="text-xs text-gray-500">{item.subLabel}</div>
                                </div>
                            </Link>
                        ))}
                    </div>
                    <div className="p-2 bg-gray-50 text-center border-t">
                        <span className="text-[10px] text-gray-400 font-medium">CLICK CORE MODULE</span>
                    </div>
                </div>
            )}
        </div>
    )
}
