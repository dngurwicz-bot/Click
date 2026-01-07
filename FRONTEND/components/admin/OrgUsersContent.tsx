'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api, OrgUser } from '@/lib/api/client'
import Link from 'next/link'
import { UserPlus, Trash2, ArrowRight, Search, Loader2, Mail, Shield, User } from 'lucide-react'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'
import Card, { CardHeader, CardContent } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'

interface OrgUsersContentProps {
    user: any
    orgId: string
}

const ROLES = [
    { id: 'admin', label: 'מנהל מערכת' },
    { id: 'manager', label: 'מנהל' },
    { id: 'employee', label: 'עובד' }
]

export default function OrgUsersContent({ user, orgId }: OrgUsersContentProps) {
    const router = useRouter()
    const [users, setUsers] = useState<OrgUser[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)

    // Form State
    const [formData, setFormData] = useState({ name: '', email: '', role: 'employee' })

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        loadUsers()
    }, [])

    const loadUsers = async () => {
        try {
            setLoading(true)
            const data = await api.getOrgUsers(orgId)
            setUsers(data)
        } catch (err: any) {
            console.error('Error loading users:', err)
            setError(err.message || 'שגיאה בטעינת משתמשים')
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = () => {
        setFormData({ name: '', email: '', role: 'employee' })
        setError(null)
        setShowModal(true)
    }

    const handleDelete = async (userId: string) => {
        if (!confirm('האם אתה בטוח שברצונך למחוק משתמש זה?')) {
            return
        }
        // Api implementation for delete user pending
        alert('מחיקת משתמש תיושם בגרסה הבאה')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError(null)

        try {
            await api.createOrgUser(orgId, formData)
            setShowModal(false)
            await loadUsers()
        } catch (err: any) {
            setError(err.message || 'שגיאה בשמירה')
        } finally {
            setSaving(false)
        }
    }

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="min-h-screen" style={{ background: 'var(--background)' }}>
            {/* Navigation Bar */}
            <nav className="bg-white shadow-sm border-b sticky top-0 z-40" style={{ borderColor: 'var(--border-color)' }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-6">
                            <Logo size="md" showSubtext={false} />
                            <div className="h-6 w-px bg-gray-300" />
                            <Link
                                href="/admin/organizations"
                                className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-accent"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                <ArrowRight size={16} />
                                חזרה לארגונים
                            </Link>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                ניהול משתמשים
                            </h1>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                        <div>
                            <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                                משתמשי ארגון
                            </h2>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                ניהול המשתמשים בארגון הנבחר
                            </p>
                        </div>
                        <Button
                            onClick={handleCreate}
                            variant="primary"
                            icon={UserPlus}
                            iconPosition="right"
                        >
                            משתמש חדש
                        </Button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative max-w-md">
                        <Search
                            className="absolute right-3 top-1/2 transform -translate-y-1/2"
                            size={18}
                            style={{ color: 'var(--text-tertiary)' }}
                        />
                        <Input
                            type="text"
                            placeholder="חפש משתמש..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pr-10"
                        />
                    </div>
                </div>

                {/* Content Card */}
                <Card variant="elevated">
                    {loading ? (
                        <CardContent>
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="animate-spin mb-4" size={32} style={{ color: 'var(--accent-teal)' }} />
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    טוען משתמשים...
                                </p>
                            </div>
                        </CardContent>
                    ) : filteredUsers.length === 0 ? (
                        <CardContent>
                            <div className="text-center py-12">
                                <User
                                    className="mx-auto mb-4 opacity-50"
                                    size={48}
                                    style={{ color: 'var(--text-tertiary)' }}
                                />
                                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                                    {searchQuery ? 'לא נמצאו תוצאות' : 'אין משתמשים בארגון'}
                                </h3>
                                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                                    {searchQuery
                                        ? 'נסה לשנות את מילות החיפוש'
                                        : 'התחל על ידי הוספת משתמש חדש'
                                    }
                                </p>
                                {!searchQuery && (
                                    <Button
                                        onClick={handleCreate}
                                        variant="primary"
                                        icon={UserPlus}
                                        iconPosition="right"
                                    >
                                        צור משתמש ראשון
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    ) : (
                        <>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                        סה&quot;כ משתמשים: {filteredUsers.length}
                                    </h3>
                                </div>
                            </CardHeader>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-color)' }}>
                                    <thead style={{ background: 'var(--gray-50)' }}>
                                        <tr>
                                            <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>שם</th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>אימייל</th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>תפקיד</th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>פעולות</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y bg-white" style={{ borderColor: 'var(--border-color)' }}>
                                        {filteredUsers.map((u) => (
                                            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-full bg-blue-50 text-blue-600 font-bold w-10 h-10 flex items-center justify-center">
                                                            {u.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="text-sm font-semibold text-gray-900">{u.name}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {u.email}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <Badge variant="default" className="text-xs">
                                                        {ROLES.find(r => r.id === u.role)?.label || u.role}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <button onClick={() => handleDelete(u.id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors text-red-600" title="מחיקה">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </Card>

                {/* Modal */}
                <Modal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    title="משתמש חדש"
                    size="md"
                >
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 rounded-lg border bg-red-50 border-red-200 text-red-600">
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}

                        <Input
                            label="שם מלא"
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="ישראל ישראלי"
                        />

                        <Input
                            label="כתובת אימייל"
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="email@example.com"
                        />

                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700">תפקיד</label>
                            <select
                                className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            >
                                {ROLES.map(r => (
                                    <option key={r.id} value={r.id}>{r.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button type="button" onClick={() => setShowModal(false)} variant="outline" className="flex-1">
                                ביטול
                            </Button>
                            <Button type="submit" variant="primary" isLoading={saving} className="flex-1">
                                צור משתמש
                            </Button>
                        </div>
                    </form>
                </Modal>
            </main>
        </div>
    )
}
