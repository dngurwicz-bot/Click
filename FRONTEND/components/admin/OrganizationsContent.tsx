'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api/client'
import Link from 'next/link'
import { Building2, Plus, Edit2, Trash2, ArrowRight, Search, Loader2 } from 'lucide-react'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'
import Card, { CardHeader, CardContent } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

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
  const [searchQuery, setSearchQuery] = useState('')

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

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase())
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
                href="/dashboard" 
                className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-accent"
                style={{ color: 'var(--text-secondary)' }}
              >
                <ArrowRight size={16} />
                חזרה לדשבורד
              </Link>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                ניהול ארגונים
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
                רשימת ארגונים
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                ניהול וצפייה בכל הארגונים במערכת
              </p>
            </div>
            <Button
              onClick={handleCreate}
              variant="primary"
              icon={Plus}
              iconPosition="right"
            >
              ארגון חדש
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
              placeholder="חפש ארגון..."
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
                  טוען ארגונים...
                </p>
              </div>
            </CardContent>
          ) : filteredOrganizations.length === 0 ? (
            <CardContent>
              <div className="text-center py-12">
                <Building2 
                  className="mx-auto mb-4 opacity-50" 
                  size={48} 
                  style={{ color: 'var(--text-tertiary)' }}
                />
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {searchQuery ? 'לא נמצאו תוצאות' : 'אין ארגונים'}
                </h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {searchQuery 
                    ? 'נסה לשנות את מילות החיפוש'
                    : 'התחל על ידי יצירת ארגון חדש'
                  }
                </p>
                {!searchQuery && (
                  <Button
                    onClick={handleCreate}
                    variant="primary"
                    icon={Plus}
                    iconPosition="right"
                  >
                    צור ארגון ראשון
                  </Button>
                )}
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    סה&quot;כ ארגונים: {filteredOrganizations.length}
                  </h3>
                </div>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  <thead style={{ background: 'var(--gray-50)' }}>
                    <tr>
                      <th 
                        className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        שם הארגון
                      </th>
                      <th 
                        className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        סטטוס
                      </th>
                      <th 
                        className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        תאריך יצירה
                      </th>
                      <th 
                        className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        פעולות
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white" style={{ borderColor: 'var(--border-color)' }}>
                    {filteredOrganizations.map((org) => (
                      <tr 
                        key={org.id} 
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleEdit(org)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div 
                              className="p-2 rounded-lg"
                              style={{ background: 'var(--accent-teal-light)' }}
                            >
                              <Building2 size={18} style={{ color: 'var(--accent-teal)' }} />
                            </div>
                            <div>
                              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {org.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={org.is_active ? 'success' : 'error'}>
                            {org.is_active ? 'פעיל' : 'לא פעיל'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {new Date(org.created_at).toLocaleDateString('he-IL', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleEdit(org)}
                              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                              style={{ color: 'var(--accent-teal)' }}
                              title="עריכה"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(org.id)}
                              className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                              style={{ color: 'var(--error)' }}
                              title="מחיקה"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
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
          title={editingOrg ? 'עריכת ארגון' : 'ארגון חדש'}
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-lg border" style={{ 
                background: 'var(--error-light)', 
                borderColor: 'var(--error)',
                color: 'var(--error)'
              }}>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <Input
              label="שם הארגון"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="הכנס שם ארגון"
              error={error && !formData.name ? 'שדה חובה' : undefined}
            />

            <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: 'var(--gray-50)' }}>
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-2 focus:ring-accent"
              />
              <label 
                htmlFor="is_active" 
                className="text-sm font-medium cursor-pointer"
                style={{ color: 'var(--text-primary)' }}
              >
                ארגון פעיל
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={() => setShowModal(false)}
                variant="outline"
                className="flex-1"
              >
                ביטול
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={saving}
                className="flex-1"
              >
                {editingOrg ? 'עדכן' : 'צור ארגון'}
              </Button>
            </div>
          </form>
        </Modal>
      </main>
    </div>
  )
}
