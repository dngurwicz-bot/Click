'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import Link from 'next/link'
import { Bell, Plus, Edit2, Trash2, ArrowRight, Loader2, Search, Calendar, Filter } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card, { CardHeader, CardContent } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import dynamic from 'next/dynamic'
import 'react-quill-new/dist/quill.snow.css'

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })

interface Update {
    id: string
    org_id: string
    title: string
    content: string
    link?: string
    link_text?: string
    created_at: string
    is_global: boolean
}

export default function UpdatesManagementPage() {
    const { organization } = useOrganization()
    const [updates, setUpdates] = useState<Update[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingUpdate, setEditingUpdate] = useState<Update | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)

    // Search and Filter State
    const [searchQuery, setSearchQuery] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        link: '',
        link_text: '',
        is_global: false
    })

    const [activeTab, setActiveTab] = useState<'org' | 'global'>('org')

    // Filter updates
    const filteredUpdates = updates.filter(update => {
        // 1. Tab Filter
        if (activeTab === 'global' && !update.is_global) return false
        if (activeTab === 'org' && update.is_global) return false

        // 2. Search Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            const matchesTitle = update.title.toLowerCase().includes(query)
            const matchesContent = update.content.toLowerCase().includes(query)
            if (!matchesTitle && !matchesContent) return false
        }

        // 3. Date Filter
        if (startDate) {
            const updateDate = new Date(update.created_at)
            const start = new Date(startDate)
            start.setHours(0, 0, 0, 0)
            if (updateDate < start) return false
        }

        if (endDate) {
            const updateDate = new Date(update.created_at)
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            if (updateDate > end) return false
        }

        return true
    })

    useEffect(() => {
        checkSuperAdmin()
    }, [])

    useEffect(() => {
        loadUpdates()
    }, [organization])

    const checkSuperAdmin = async () => {
        const employee = await api.getCurrentEmployee()
        if (employee && employee.is_super_admin) {
            setIsSuperAdmin(true)
        }
    }

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
        if (!organization) return

        try {
            setLoading(true)
            const data = await api.getUpdates(organization.id)
            setUpdates(data as Update[])
        } catch (err: any) {
            console.error('Error loading updates:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = () => {
        setEditingUpdate(null)
        setFormData({
            title: '',
            content: '',
            link: '',
            link_text: '',
            is_global: activeTab === 'global'
        })
        setError(null)
        setShowModal(true)
    }

    const handleEdit = (update: Update) => {
        setEditingUpdate(update)
        setFormData({
            title: update.title,
            content: update.content,
            link: update.link || '',
            link_text: update.link_text || '',
            is_global: update.is_global || false
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
            } else if (organization) {
                await api.createUpdate({ org_id: organization.id, ...formData })
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
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-6">
                            <Link href="/settings" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-teal-600">
                                <ArrowRight size={16} />
                                חזרה להגדרות
                            </Link>
                            <div className="h-6 w-px bg-gray-300" />
                            <h1 className="text-xl font-bold text-gray-900">ניהול עדכונים</h1>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">
                            {activeTab === 'global' ? 'הודעות מערכת' : 'עדכוני ארגון'}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {activeTab === 'global'
                                ? 'ניהול הודעות גלובליות לכלל לקוחות המערכת'
                                : 'ניהול הודעות פנימיות לעובדי הארגון שלך'
                            }
                        </p>
                    </div>
                    <Button onClick={handleCreate} variant="primary" icon={Plus} iconPosition="right">
                        {activeTab === 'global' ? 'הודעה חדשה' : 'עדכון חדש'}
                    </Button>
                </div>

                {/* Tabs & Filters Container */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                    {/* Tabs */}
                    {isSuperAdmin && (
                        <div className="flex border-b border-gray-100 px-6">
                            <button
                                onClick={() => setActiveTab('org')}
                                className={`pb-4 pt-4 px-2 text-sm font-medium border-b-2 transition-colors duration-200 ${activeTab === 'org'
                                    ? 'border-teal-500 text-teal-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                עדכוני ארגון
                            </button>
                            <div className="w-8"></div>
                            <button
                                onClick={() => setActiveTab('global')}
                                className={`pb-4 pt-4 px-2 text-sm font-medium border-b-2 transition-colors duration-200 ${activeTab === 'global'
                                    ? 'border-purple-500 text-purple-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                הודעות מערכת
                            </button>
                        </div>
                    )}

                    {/* Filters Bar */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-gray-50/50 rounded-b-xl">
                        {/* Search */}
                        <div className="md:col-span-5 relative">
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder={activeTab === 'global' ? "חפש בהודעות מערכת..." : "חפש בעדכונים..."}
                                className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition duration-150 ease-in-out"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Date Range */}
                        <div className="md:col-span-3">
                            <div className="relative">
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    type="date"
                                    className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg sm:text-sm focus:ring-teal-500 focus:border-teal-500"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    placeholder="מתאריך"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-1 text-center text-gray-400 text-sm hidden md:block">
                            עד
                        </div>
                        <div className="md:col-span-3">
                            <div className="relative">
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    type="date"
                                    className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg sm:text-sm focus:ring-teal-500 focus:border-teal-500"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    placeholder="עד תאריך"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results */}
                <Card variant="elevated" className="border-0 shadow-md">
                    {loading ? (
                        <CardContent>
                            <div className="flex flex-col items-center justify-center py-16">
                                <Loader2 className="animate-spin mb-4 text-teal-600" size={32} />
                                <p className="text-sm text-gray-600">טוען נתונים...</p>
                            </div>
                        </CardContent>
                    ) : filteredUpdates.length === 0 ? (
                        <CardContent>
                            <div className="text-center py-16">
                                <div className="mx-auto h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                    <Bell className="opacity-40 text-gray-400" size={32} />
                                </div>
                                <h3 className="text-lg font-semibold mb-2 text-gray-900">
                                    {(searchQuery || startDate || endDate) ? 'לא נמצאו תוצאות' : (activeTab === 'global' ? 'אין הודעות מערכת' : 'אין עדכונים')}
                                </h3>
                                <p className="text-sm mb-6 text-gray-500 max-w-sm mx-auto">
                                    {(searchQuery || startDate || endDate)
                                        ? 'נסה לשנות את סינון החיפוש או התאריכים כדי לראות תוצאות'
                                        : (activeTab === 'global' ? 'לא נשלחו הודעות גלובליות עדיין' : 'צור את העדכון הראשון כדי להתחיל לתקשר עם העובדים שלך')
                                    }
                                </p>
                                {!(searchQuery || startDate || endDate) && (
                                    <Button onClick={handleCreate} variant="primary" icon={Plus} iconPosition="right">
                                        {activeTab === 'global' ? 'צור הודעה חדשה' : 'צור עדכון ראשון'}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    ) : (
                        <>
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                                <div className="text-sm font-medium text-gray-500">
                                    מציג {filteredUpdates.length} תוצאות
                                </div>
                                <div className="text-xs text-gray-400">
                                    ממוין לפי תאריך (מהחדש לישן)
                                </div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {filteredUpdates.map((update) => (
                                    <div key={update.id} className="p-6 hover:bg-gray-50 transition-colors duration-150 group">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className={`p-2 rounded-full ${update.is_global ? 'bg-purple-100 text-purple-600' : 'bg-teal-100 text-teal-600'}`}>
                                                        <Bell size={16} />
                                                    </div>
                                                    <h4 className="text-lg font-bold text-gray-900 group-hover:text-teal-700 transition-colors">
                                                        {update.title}
                                                    </h4>
                                                    {update.is_global && (
                                                        <span className="px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-700 rounded-full">
                                                            מערכת
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-600 mb-3 rendered-content pr-11" dangerouslySetInnerHTML={{ __html: update.content }} />

                                                <div className="flex items-center gap-4 pr-11">
                                                    {update.link && (
                                                        <a href={update.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
                                                            {update.link_text || 'קרא עוד'}
                                                            <ArrowRight size={14} className="rotate-180" />
                                                        </a>
                                                    )}
                                                    <span className="text-xs text-gray-400 border-r border-gray-200 pr-4 mr-1">
                                                        {new Date(update.created_at).toLocaleString('he-IL', { dateStyle: 'long', timeStyle: 'short' })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(update)}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-all"
                                                    title="ערוך"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(update.id)}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                                    title="מחק"
                                                >
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

                <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingUpdate ? 'עריכת עדכון' : (activeTab === 'global' ? 'הודעת מערכת חדשה' : 'עדכון חדש')} size="lg">
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

                        <div className="flex gap-3 pt-2">
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
