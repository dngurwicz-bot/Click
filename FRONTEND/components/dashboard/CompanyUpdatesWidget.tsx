'use client'

import React, { useEffect, useState } from 'react'
import { ChevronLeft, Bell } from 'lucide-react'
import { api } from '@/lib/api/client'
import Link from 'next/link'
import { useOrganization } from '@/contexts/OrganizationContext'

interface UpdateItem {
    id: string
    title: string
    content: string
    link?: string
    link_text?: string
    created_at: string
    is_global?: boolean
}

export default function CompanyUpdatesWidget() {
    const { organization } = useOrganization()
    const [updates, setUpdates] = useState<UpdateItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchUpdates = async () => {
            if (!organization) return;

            try {
                setLoading(true)
                const data = await api.getUpdates(organization.id)
                setUpdates(data as any[])
            } catch (err) {
                console.error('Failed to load updates', err)
            } finally {
                setLoading(false)
            }
        }
        fetchUpdates()
    }, [organization])

    // Filter to show ONLY Organization updates (not global)
    const orgUpdates = updates.filter(u => !u.is_global)
    const hasMore = orgUpdates.length > 7

    return (
        <div className="bg-white rounded-none sm:rounded-md shadow-sm h-full flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
                {hasMore && (
                    <Link
                        href="/settings/updates"
                        className="text-xs text-blue-600 hover:underline font-medium"
                    >
                        לראות את כל העדכונים
                    </Link>
                )}
                <h3 className="text-lg font-bold text-gray-700">עדכונים</h3>
            </div>

            <div className="p-0 flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center items-center h-full text-gray-400">
                        <span className="text-sm">טוען עדכונים...</span>
                    </div>
                ) : orgUpdates.length > 0 ? (
                    <div className="flex flex-col">
                        <div className="divide-y divide-gray-100">
                            {orgUpdates.map((u) => (
                                <div key={u.id} className="p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex-1 text-right">
                                            <h4 className="font-bold text-gray-800 inline-block ml-2">{u.title}</h4>
                                        </div>
                                        <span className="text-xs text-gray-400 mr-3 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString('he-IL')}</span>
                                    </div>
                                    <div
                                        className="text-sm text-gray-600 leading-relaxed mb-2 text-right rendered-content"
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
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 p-4">
                        <Bell size={32} className="opacity-20" />
                        <p className="text-lg font-medium">אין עדכונים חדשים</p>
                        <p className="text-sm opacity-60">הודעות ארגון יופיעו כאן</p>
                    </div>
                )}
            </div>
        </div>
    )
}
