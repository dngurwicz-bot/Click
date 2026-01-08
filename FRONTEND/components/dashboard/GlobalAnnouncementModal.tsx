'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api/client'
import { X, Bell, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface Update {
    id: string
    title: string
    content: string
    link?: string
    link_text?: string
    created_at: string
}

export default function GlobalAnnouncementModal() {
    const [updates, setUpdates] = useState<Update[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        checkUnreadUpdates()
    }, [])

    const checkUnreadUpdates = async () => {
        try {
            const unread = await api.getUnreadGlobalUpdates()
            if (unread && unread.length > 0) {
                setUpdates(unread as Update[])
                setIsOpen(true)
            }
        } catch (err) {
            console.error('Failed to check announcements', err)
        } finally {
            setLoading(false)
        }
    }

    const handleMarkAsRead = async () => {
        const currentUpdate = updates[currentIndex]
        if (!currentUpdate) return

        try {
            await api.markUpdateAsRead(currentUpdate.id)

            // Remove from list or move to next
            const remaining = updates.filter(u => u.id !== currentUpdate.id)

            if (remaining.length === 0) {
                setIsOpen(false)
                setUpdates([])
            } else {
                setUpdates(remaining)
                if (currentIndex >= remaining.length) {
                    setCurrentIndex(0)
                }
            }
        } catch (err) {
            console.error('Failed to mark as read', err)
        }
    }

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % updates.length)
    }

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + updates.length) % updates.length)
    }

    if (!isOpen || updates.length === 0) return null

    const currentUpdate = updates[currentIndex]

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 relative">

                {/* Decorative Header */}
                <div className="h-32 bg-gradient-to-br from-purple-600 to-indigo-600 relative overflow-hidden flex items-center justify-center shrink-0">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="absolute top-4 left-4 text-white/70 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full transition-colors z-20"
                    >
                        <X size={20} />
                    </button>
                    <div className="absolute inset-0 bg-white/10 opacity-50" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
                    <div className="z-10 bg-white/20 p-4 rounded-full backdrop-blur-sm border border-white/20 shadow-xl">
                        <Bell size={40} className="text-white" />
                    </div>
                </div>

                <div className="p-8 flex-1 overflow-y-auto">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentUpdate.title}</h2>
                        <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider bg-purple-50 inline-block px-3 py-1 rounded-full">
                            עדכון מערכת חשוב
                        </p>
                    </div>

                    <div
                        className="text-gray-600 leading-relaxed text-right rendered-content prose prose-purple max-w-none"
                        dangerouslySetInnerHTML={{ __html: currentUpdate.content }}
                    />

                    {currentUpdate.link && (
                        <div className="mt-6 text-center">
                            <a
                                href={currentUpdate.link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-700 hover:underline"
                            >
                                {currentUpdate.link_text || 'לחץ כאן לפרטים נוספים'}
                                <ChevronLeft size={16} />
                            </a>
                        </div>
                    )}
                </div>

                {/* Footer / Controls */}
                <div className="p-6 bg-gray-50 border-t flex flex-col gap-3 shrink-0">

                    <Button
                        onClick={handleMarkAsRead}
                        variant="primary"
                        className="w-full justify-center py-4 text-lg shadow-lg bg-indigo-600 hover:bg-indigo-700"
                        icon={Check}
                    >
                        קראתי והבנתי
                    </Button>

                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        סגור והזכר לי מאוחר יותר
                    </button>

                    {updates.length > 1 && (
                        <div className="flex justify-between items-center text-sm text-gray-500 mt-2">
                            <button onClick={handlePrev} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <ChevronRight size={20} />
                            </button>
                            <span>עדכון {currentIndex + 1} מתוך {updates.length}</span>
                            <button onClick={handleNext} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <ChevronLeft size={20} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
