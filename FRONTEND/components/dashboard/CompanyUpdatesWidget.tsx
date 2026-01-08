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
    is_global?: boolean
}

import { useOrganization } from '@/contexts/OrganizationContext'

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

    // Show only first 7 updates total, but prioritize sorting or keeping them visible?
    // User wants separation. Let's keep all fetched (limit is usually small from API or slice here).
    // Let's filter first.

    const systemUpdates = updates.filter(u => u.is_global)
    const orgUpdates = updates.filter(u => !u.is_global)

    const hasMore = updates.length > 7

    // We can show up to X of each? Or just scroll.
    // Let's keep the hasMore logic simple or base it on total.

    return (
        <div className="bg-white rounded-none sm:rounded-md shadow-sm h-full flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
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

            <div className="p-0 flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center items-center h-full text-gray-400">
                        <span className="text-sm">טוען עדכונים...</span>
                    </div>
                ) : updates.length > 0 ? (
                    <div className="flex flex-col">

                        {/* System Updates Section */}
                        {systemUpdates.length > 0 && (
                            <div className="mb-2">
                                <div className="bg-purple-50 px-4 py-2 border-b border-purple-100 flex items-center gap-2 sticky top-0 z-10 backdrop-blur-sm">
                                    <Bell size={14} className="text-purple-600" />
                                    <span className="text-xs font-bold text-purple-800 uppercase tracking-wide">הודעות מערכת</span>
                                </div>
                                <div className="divide-y divide-purple-100/50">
                                    {systemUpdates.map((u) => (
                                        <div key={u.id} className="p-4 bg-purple-50/10 hover:bg-purple-50/30 transition-colors">
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
                                                    className="text-xs text-purple-600 font-bold flex items-center justify-end gap-1 hover:underline w-full"
                                                >
                                                    <ChevronLeft size={12} />
                                                    {u.link_text || 'קרא עוד'}
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Organization Updates Section */}
                        {orgUpdates.length > 0 ? (
                            <div>
                                {systemUpdates.length > 0 && (
                                    <div className="bg-gray-50 px-4 py-2 border-y border-gray-100 flex items-center gap-2 sticky top-0 z-10">
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">עדכוני ארגון</span>
                                    </div>
                                )}
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
                            /* Show empty state only if NO company updates AND no system updates? 
                               Or if system updates exist but no company updates, maybe show "No company updates"? 
                               User probably just wants the lists separated. */
                            systemUpdates.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2 p-4">
                                    <Bell size={32} className="opacity-20" />
                                    <p className="text-lg font-medium">אין עדכונים חדשים</p>
                                    <p className="text-sm opacity-60">הודעות מערכת יופיעו כאן</p>
                                </div>
                            )
                        )}

                        {systemUpdates.length > 0 && orgUpdates.length === 0 && (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                אין עדכוני ארגון נוספים
                            </div>
                        )}

                    </div>
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

