'use client'

import React, { useEffect, useState } from 'react'
import { orgApi } from '@/lib/api/organization'
import { OrganizationSettings } from '@/types/organization'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { Save, AlertCircle, CheckCircle } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'

export default function OrganizationSettingsForm() {
    const { organization } = useOrganization()
    const [settings, setSettings] = useState<OrganizationSettings | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        if (organization?.id) {
            loadSettings(organization.id)
        } else {
            setSettings(null)
        }
    }, [organization])

    const loadSettings = async (orgId: string) => {
        try {
            setLoading(true)
            const data = await orgApi.getSettings(orgId)
            setSettings(data)
        } catch (err) {
            console.error('Failed to load settings', err)
            setError('לא ניתן לטעון הגדרות. וודא שיש לך הרשאות מתאימות.')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!settings || !organization) return

        try {
            setSaving(true)
            setError('')
            setSuccess('')

            await orgApi.updateSettings(organization.id, {
                use_divisions: settings.use_divisions,
                use_departments: settings.use_departments,
                departments_under_divisions: settings.departments_under_divisions,
                positions_are_org_wide: settings.positions_are_org_wide,
                allow_multiple_positions: settings.allow_multiple_positions,
                use_position_levels: settings.use_position_levels
            })

            setSuccess('ההגדרות נשמרו בהצלחה')
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            console.error('Failed to save settings', err)
            setError('שגיאה בשמירת ההגדרות')
        } finally {
            setSaving(false)
        }
    }

    const toggleSetting = (key: keyof OrganizationSettings) => {
        if (!settings) return
        setSettings(prev => prev ? ({ ...prev, [key]: !prev[key] }) : null)
    }

    if (!organization) {
        return (
            <Card className="max-w-4xl mx-auto p-8 text-center text-gray-500">
                <p>אנא בחר ארגון כדי לצפות בהגדרות</p>
            </Card>
        )
    }

    if (loading) return <div className="p-8 text-center text-gray-500">טוען הגדרות...</div>

    if (!settings) return (
        <Card className="max-w-4xl mx-auto p-8 text-center text-red-500">
            <div className="flex flex-col items-center gap-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <p>לא נמצאו הגדרות עבור ארגון זה, או שאין לך הרשאות צפייה.</p>
                <Button variant="outline" onClick={() => loadSettings(organization.id)}>
                    נסה שוב
                </Button>
            </div>
        </Card>
    )

    return (
        <Card className="max-w-4xl mx-auto">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-800">הגדרות מבנה ארגוני</h2>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2"
                    >
                        <Save className="h-4 w-4" />
                        {saving ? 'שומר...' : 'שמור שינויים'}
                    </Button>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        {success}
                    </div>
                )}

                <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <p className="text-sm text-blue-800">
                            הגדרות אלו קובעות את אופן התנהלות המבנה הארגוני עבור <strong>{organization.name}</strong>.
                        </p>
                    </div>

                    <div className="divide-y divide-gray-100">
                        {/* Divisions Section */}
                        <div className="py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-gray-900">שימוש באגפים (Divisions)</h3>
                                    <p className="text-sm text-gray-500">האם הארגון מחולק לאגפים/חטיבות?</p>
                                </div>
                                <Toggle
                                    checked={settings.use_divisions}
                                    onChange={() => toggleSetting('use_divisions')}
                                />
                            </div>
                        </div>

                        {/* Departments Section */}
                        <div className="py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-gray-900">שימוש במחלקות (Departments)</h3>
                                    <p className="text-sm text-gray-500">האם הארגון מחולק למחלקות/צוותים?</p>
                                </div>
                                <Toggle
                                    checked={settings.use_departments}
                                    onChange={() => toggleSetting('use_departments')}
                                />
                            </div>
                        </div>

                        {/* Hierarchy Section - Only show if both are enabled */}
                        {(settings.use_divisions && settings.use_departments) && (
                            <div className="py-4 pl-8 border-r-2 border-blue-100 mr-4 bg-gray-50/50 rounded-l-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-gray-900">מחלקות כפופות לאגפים</h3>
                                        <p className="text-sm text-gray-500">האם כל מחלקה חייבת להיות משויכת לאגף?</p>
                                    </div>
                                    <Toggle
                                        checked={settings.departments_under_divisions}
                                        onChange={() => toggleSetting('departments_under_divisions')}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Positions Section */}
                        <div className="py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-gray-900">תפקידים רוחביים</h3>
                                    <p className="text-sm text-gray-500">האם תפקידים מוגדרים ברמת הארגון (ולא פר אגף/מחלקה)?</p>
                                </div>
                                <Toggle
                                    checked={settings.positions_are_org_wide}
                                    onChange={() => toggleSetting('positions_are_org_wide')}
                                />
                            </div>
                        </div>

                        <div className="py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-gray-900">ריבוי תפקידים לעובד</h3>
                                    <p className="text-sm text-gray-500">האם עובד יכול להחזיק במספר תפקידים במקביל?</p>
                                </div>
                                <Toggle
                                    checked={settings.allow_multiple_positions}
                                    onChange={() => toggleSetting('allow_multiple_positions')}
                                />
                            </div>
                        </div>

                        <div className="py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-gray-900">רמות תפקיד (Levels)</h3>
                                    <p className="text-sm text-gray-500">האם להשתמש ברמות (Junior, Senior וכו')?</p>
                                </div>
                                <Toggle
                                    checked={settings.use_position_levels}
                                    onChange={() => toggleSetting('use_position_levels')}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={onChange}
            className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2
        ${checked ? 'bg-blue-600' : 'bg-gray-200'}
      `}
        >
            <span
                aria-hidden="true"
                className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
          ${checked ? 'translate-x-0' : '-translate-x-5'} 
        `}
                style={{ transform: checked ? 'translateX(0)' : 'translateX(-1.25rem)' }}
            />
        </button>
    )
}
