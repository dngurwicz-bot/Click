'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api/client'
import Link from 'next/link'
import { Building2, Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import Logo from '@/components/Logo'

interface Organization {
  id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface OrganizationsContentProps {
  user: any
}

export default function OrganizationsContent({ user }: OrganizationsContentProps) {
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [formData, setFormData] = useState({ name: '', is_active: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadOrganizations()
  }, [])

  const loadOrganizations = async () => {
    try {
      setLoading(true)
      const data = await api.getOrganizations()
      setOrganizations(data)
    } catch (err: any) {
      console.error('Error loading organizations:', err)
      setError(err.message || 'שגיאה בטעינת הארגונים')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingOrg(null)
    setFormData({ name: '', is_active: true })
    setError(null)
    setShowModal(true)
  }

  const handleEdit = (org: Organization) => {
    setEditingOrg(org)
    setFormData({ name: org.name, is_active: org.is_active })
    setError(null)
    setShowModal(true)
  }

  const handleDelete = async (orgId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הארגון הזה? פעולה זו לא ניתנת לביטול!')) {
      return
    }

    try {
      await api.deleteOrganization(orgId)
      await loadOrganizations()
    } catch (err: any) {
      alert(`שגיאה במחיקת הארגון: ${err.message || 'שגיאה לא ידועה'}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (editingOrg) {
        await api.updateOrganization(editingOrg.id, formData)
      } else {
        await api.createOrganization(formData)
      }
      setShowModal(false)
      await loadOrganizations()
    } catch (err: any) {
      setError(err.message || 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <nav className="bg-white shadow-soft border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <Logo size="md" showSubtext={false} />
              <div className="h-6 w-px" style={{ background: 'var(--border-light)' }} />
              <Link href="/dashboard" className="text-sm transition-colors hover:underline" style={{ color: 'var(--text-secondary)' }}>
                ← חזרה לדשבורד
              </Link>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                ניהול ארגונים
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            רשימת ארגונים
          </h2>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-all hover:shadow-md"
            style={{ background: 'var(--button-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--button-primary-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--button-primary)'
            }}
          >
            <Plus size={20} />
            ארגון חדש
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-soft border p-8 text-center" style={{ borderColor: 'var(--border-color)' }}>
            <div style={{ color: 'var(--text-secondary)' }}>טוען...</div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-soft border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead style={{ background: 'var(--background)' }}>
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    שם הארגון
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    סטטוס
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    תאריך יצירה
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ background: 'white', borderColor: 'var(--border-color)' }}>
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center" style={{ color: 'var(--text-secondary)' }}>
                      אין ארגונים
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building2 className="ml-2" size={20} style={{ color: 'var(--gray-medium)' }} />
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{org.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          org.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {org.is_active ? 'פעיל' : 'לא פעיל'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(org.created_at).toLocaleDateString('he-IL')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(org)}
                            style={{ color: 'var(--button-primary)' }}
                            className="hover:opacity-80 transition-opacity"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(org.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingOrg ? 'עריכת ארגון' : 'ארגון חדש'}
                  </h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="p-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {error}
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    שם הארגון
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="mb-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="ml-2"
                    />
                    <span className="text-sm text-gray-700">פעיל</span>
                  </label>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    ביטול
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'שומר...' : 'שמור'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
