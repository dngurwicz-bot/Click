'use client'
import React from 'react'
import Link from 'next/link'

export default function ClickCoreMenu() {
    return (
        <Link
            href="/click-core"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors group"
        >
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
                <span className="text-sm font-bold text-gray-700 leading-tight group-hover:text-blue-600 transition-colors">C.C</span>
            </div>
        </Link>
    )
}
