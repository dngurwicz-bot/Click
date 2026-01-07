'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api/client'
import Link from 'next/link'
import { Bell, Plus, Edit2, Trash2, ArrowRight, Loader2 } from 'lucide-react'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'
import Card, { CardHeader, CardContent } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import dynamic from 'next/dynamic'
import 'react-quill/dist/quill.snow.css'

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })

interface Update {
    id: string
    org_id: string
    title: string
    content: string
    link?: string
    link_text?: string
    created_at: string
}

export default function UpdatesManagementPage() {
    const [updates, setUpdates] = useState<Update[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingUpdate, setEditingUpdate] = useState<Update | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedOrgId, setSelectedOrgId] = useState<string>('')

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        link: '',
        link_text: ''
    })

    useEffect(() => {
        loadUpdates()
    }, [])

    // Warn about unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (showModal && (formData.title || formData.content)) {
                e.preventDefault()
                e.returnValue = ''
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [showModal, formData])

    const loadUpdates = async () => {
        try {
            setLoading(true)
            const orgs = await api.getOrganizations()
            if (orgs.length > 0) {
                setSelectedOrgId(orgs[0].id)
                const data = await api.getUpdates(orgs[0].id)
                setUpdates(data as Update[])
            }
        } catch (err: any) {
            console.error('Error loading updates:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = () => {
        setEditingUpdate(null)
        setFormData({ title: '', content: '', link: '', link_text: '' })
        setError(null)
        setShowModal(true)
    }

    const handleEdit = (update: Update) => {
        setEditingUpdate(update)
        setFormData({
            title: update.title,
            content: update.content,
            link: update.link || '',
            link_text: update.link_text || ''
        })
        setError(null)
        setShowModal(true)
    }

    const handleDelete = async (updateId: string) => {
        if (!confirm('האם אתה בטוח שברצונך למחוק עדכון זה?')) return
        try {
            await api.deleteUpdate(updateId)
            await loadUpdates()
        } catch (err: any) {
            alert(`שגיאה במחיקת העדכון: ${err.message}`)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError(null)
        try {
            if (editingUpdate) {
                await api.updateUpdate(editingUpdate.id, formData)
            } else {
                await api.createUpdate({ org_id: selectedOrgId, ...formData })
            }
            setShowModal(false)
            await loadUpdates()
        } catch (err: any) {
            setError(err.message || 'שגיאה בשמירה')
        } finally {
            setSaving(false)
        }
    }

    const quillModules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'align': [] }],
            ['link'],
            ['clean']
        ]
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-6">
                            <Logo size="md" showSubtext={false} />
                            <div className="h-6 w-px bg-gray-300" />
                            <Link href="/settings" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-teal-600">
                                <ArrowRight size={16} />
                                חזרה להגדרות
                            </Link>
                            <h1 className="text-xl font-bold text-gray-900">ניהול עדכונים</h1>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">עדכונים והודעות</h2>
                        <p className="text-sm text-gray-600">נהל הודעות והכרזות לעובדי הארגון</p>
                    </div>
                    <Button onClick={handleCreate} variant="primary" icon={Plus} iconPosition="right">
                        עדכון חדש
                    </Button>
                </div>

                <Card variant="elevated">
                    {loading ? (
                        <CardContent>
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="animate-spin mb-4 text-teal-600" size={32} />
                                <p className="text-sm text-gray-600">טוען עדכונים...</p>
                            </div>
                        </CardContent>
                    ) : updates.length === 0 ? (
                        <CardContent>
                            <div className="text-center py-12">
                                <Bell className="mx-auto mb-4 opacity-50 text-gray-400" size={48} />
                                <h3 className="text-lg font-semibold mb-2 text-gray-900">אין עדכונים</h3>
                                <p className="text-sm mb-4 text-gray-600">התחל על ידי יצירת עדכון ראשון</p>
                                <Button onClick={handleCreate} variant="primary" icon={Plus} iconPosition="right">
                                    צור עדכון ראשון
                                </Button>
                            </div>
                        </CardContent>
                    ) : (
                        <>
                            <CardHeader>
                                <h3 className="text-sm font-semibold text-gray-900">סה&quot;כ עדכונים: {updates.length}</h3>
                            </CardHeader>
                            <div className="divide-y">
                                {updates.map((update) => (
                                    <div key={update.id} className="p-6 hover:bg-gray-50">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <Bell size={18} className="text-teal-600" />
                                                    <h4 className="text-lg font-bold text-gray-900">{update.title}</h4>
                                                </div>
                                                <div className="text-sm text-gray-600 mb-3 rendered-content" dangerouslySetInnerHTML={{ __html: update.content }} />
                                                {update.link && (
                                                    <a href={update.link} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                                                        {update.link_text || 'קרא עוד'} →
                                                    </a>
                                                )}
                                                <div className="mt-3 text-xs text-gray-400">
                                                    {new Date(update.created_at).toLocaleString('he-IL')}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleEdit(update)} className="p-2 rounded-lg hover:bg-gray-100 text-teal-600">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(update.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </Card>

                <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingUpdate ? 'עריכת עדכון' : 'עדכון חדש'} size="lg">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}

                        <Input
                            label="כותרת"
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="הכנס כותרת"
                        />

                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700">תוכן</label>
                            <div dir="rtl">
                                <ReactQuill
                                    theme="snow"
                                    value={formData.content}
                                    onChange={(content) => setFormData({ ...formData, content })}
                                    modules={quillModules}
                                    className="bg-white"
                                    style={{ direction: 'rtl' }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="קישור"
                                type="url"
                                value={formData.link}
                                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                                placeholder="https://example.com"
                            />
                            <Input
                                label="טקסט לקישור"
                                type="text"
                                value={formData.link_text}
                                onChange={(e) => setFormData({ ...formData, link_text: e.target.value })}
                                placeholder="קרא עוד"
                            />
                        </div>

                        <div className="flex gap-3">
                            <Button type="button" onClick={() => setShowModal(false)} variant="outline" className="flex-1">ביטול</Button>
                            <Button type="submit" variant="primary" isLoading={saving} className="flex-1">
                                {editingUpdate ? 'עדכן' : 'פרסם'}
                            </Button>
                        </div>
                    </form>
                </Modal>
            </main>
        </div>
    )
}
