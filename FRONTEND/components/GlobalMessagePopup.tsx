'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api/client'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Bell } from 'lucide-react'

interface Update {
    id: string
    title: string
    content: string
    link?: string
    link_text?: string
    created_at: string
    is_global: boolean
}

export default function GlobalMessagePopup() {
    const [messages, setMessages] = useState<Update[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        checkMessages()
    }, [])

    const checkMessages = async () => {
        try {
            const unread = await api.getUnreadGlobalUpdates()
            if (unread && unread.length > 0) {
                setMessages(unread as Update[])
                setIsOpen(true)
            }
        } catch (err) {
            console.error('Failed to check global messages:', err)
        }
    }

    const handleClose = async () => {
        if (messages.length === 0) return

        const currentMessage = messages[currentIndex]
        try {
            await api.markUpdateAsRead(currentMessage.id)

            if (currentIndex < messages.length - 1) {
                setCurrentIndex(prev => prev + 1)
            } else {
                setIsOpen(false)
            }
        } catch (err) {
            console.error('Failed to mark message as read:', err)
            // Still close/advance UI even if API fails to avoid stuck loop for user
            if (currentIndex < messages.length - 1) {
                setCurrentIndex(prev => prev + 1)
            } else {
                setIsOpen(false)
            }
        }
    }

    if (!isOpen || messages.length === 0) return null

    const message = messages[currentIndex]

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => { }} // Disallow closing by clicking outside? Or should we allow it and it marks as read? Let's force explicit interaction for now.
            title={
                <div className="flex items-center gap-2 text-purple-700">
                    <Bell className="h-5 w-5" />
                    <span>הודעת מערכת</span>
                </div>
            }
            size="md"
        >
            <div className="space-y-4">
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{message.title}</h3>
                    <div
                        className="text-gray-700 text-sm leading-relaxed rendered-content"
                        dangerouslySetInnerHTML={{ __html: message.content }}
                    />

                    {message.link && (
                        <div className="mt-4 pt-3 border-t border-purple-200/50">
                            <a
                                href={message.link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-purple-600 font-medium hover:underline text-sm inline-flex items-center gap-1"
                            >
                                {message.link_text || 'לחץ כאן לפרטים נוספים'} →
                            </a>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center text-xs text-gray-400 px-1">
                    <span>{currentIndex + 1} מתוך {messages.length}</span>
                    <span>{new Date(message.created_at).toLocaleDateString('he-IL')}</span>
                </div>

                <div className="flex justify-end pt-2">
                    <Button
                        onClick={handleClose}
                        variant="primary"
                        className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto"
                    >
                        {currentIndex < messages.length - 1 ? 'הבא' : 'קראתי וסגור'}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
