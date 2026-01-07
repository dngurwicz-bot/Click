'use client'

import React, { useEffect, useState } from 'react'
import { ChevronLeft, Bell } from 'lucide-react'
import { api } from '@/lib/api/client'
import Link from 'next/link'

interface UpdateItem {
    id: string
    title: string
    content: string
    link?: string
    link_text?: string
    created_at: string
}

export default function CompanyUpdatesWidget() {
    const [updates, setUpdates] = useState<UpdateItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchUpdates = async () => {
            try {
                // In a real scenario, we might want to pass the selected Org ID here
                // For now, relies on RLS or default view
                const data = await api.getUpdates()
                setUpdates(data as any[])
            } catch (err) {
                console.error('Failed to load updates', err)
            } finally {
                setLoading(false)
            }
        }
        fetchUpdates()
    }, [])

    // Show only first 7 updates
    const displayedUpdates = updates.slice(0, 7)
    const hasMore = updates.length > 7

    return (
        <div className="bg-white rounded-none sm:rounded-md shadow-sm h-full flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
                {hasMore && (
                    <Link
                        href="/settings/updates"
                        className="text-xs text-blue-600 hover:underline font-medium"
                    >
                        לראות את כל ההודעות
                    </Link>
                )}
                <h3 className="text-lg font-bold text-gray-700">עדכונים</h3>
            </div>
            <div className="p-4 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center items-center h-full text-gray-400">
                        <span className="text-sm">טוען עדכונים...</span>
                    </div>
                ) : displayedUpdates.length > 0 ? (
                    displayedUpdates.map((u) => (
                        <div key={u.id} className="border-b last:border-0 pb-4 last:pb-0">
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="font-bold text-gray-800 text-right flex-1">{u.title}</h4>
                                <span className="text-xs text-gray-400 mr-3 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString('he-IL')}</span>
                            </div>

                            <div
                                className="text-sm text-gray-600 leading-relaxed mb-3 text-right rendered-content"
                                dangerouslySetInnerHTML={{ __html: u.content || '' }}
                            />

                            {u.link && (
                                <a
                                    href={u.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-blue-600 font-bold flex items-center justify-end gap-1 hover:underline w-full"
                                >
                                    <ChevronLeft size={12} />
                                    {u.link_text || 'קרא עוד'}
                                </a>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                        <Bell size={32} className="opacity-20" />
                        <p className="text-lg font-medium">אין עדכונים חדשים</p>
                        <p className="text-sm opacity-60">הודעות מערכת יופיעו כאן</p>
                    </div>
                )}
            </div>
        </div>
    )
}

