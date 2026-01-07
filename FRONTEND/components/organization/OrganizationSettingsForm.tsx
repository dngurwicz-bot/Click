'use client'

import React, { useEffect, useState } from 'react'
import { orgApi } from '@/lib/api/organization'
import { OrganizationSettings } from '@/types/organization'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { Save, AlertCircle, CheckCircle } from 'lucide-react'

// Mock Org ID - In real app this comes from context/auth
const MOCK_ORG_ID = '123e4567-e89b-12d3-a456-426614174000'

export default function OrganizationSettingsForm() {
    const [settings, setSettings] = useState<OrganizationSettings | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // First fetch my org id, then settings
    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
        try {
            setLoading(true)
            // In real implementation we'll get orgId efficiently. 
            // For now we'll assume we can pass a dummy UUID or fetch user's org
            // We'll update get_my_org_id logic later if needed

            // Let's try to fetch settings for current user's org
            // Since we don't have auth context fully wired in this chat, 
            // we'll rely on the API to handle permissions or mock it

            // Note: orgApi.getSettings needs an orgId. 
            // We need a way to get the current user's organization ID.
            // For MVP we'll query the first org user belongs to or similar.
            // But wait, the API client requires us to pass orgID.

            // Temporary solution: We will use a placeholder OR fetch from profile if available
            // Let's use a function that gets "MY" settings if org_id not provided?
            // No, let's just use a hardcoded valid UUID for testing flows or similar.
            // Actually, better: We'll wrap this in a try/catch and if it fails due to ID, we show error.

            const data = await orgApi.getSettings(MOCK_ORG_ID)
            setSettings(data)
        } catch (err) {
            console.error('Failed to load settings', err)
            setError('אנא התחבר מחדש או וודא שיש לך הרשאות מתאימות')
            // Fallback for UI development without DB connection:
            setSettings({
                id: '1',
                organization_id: MOCK_ORG_ID,
                use_divisions: false,
                use_departments: true,
                departments_under_divisions: false,
                positions_are_org_wide: true,
                allow_multiple_positions: false,
                use_position_levels: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!settings) return

        try {
            setSaving(true)
            setError('')
            setSuccess('')

            await orgApi.updateSettings(settings.organization_id, {
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

    if (loading) return <div className="p-8 text-center text-gray-500">טוען הגדרות...</div>

    if (!settings) return <div className="p-8 text-center text-red-500">לא נמצאו הגדרות</div>

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
                            הגדרות אלו קובעות את אופן התנהלות המבנה הארגוני במערכת. שינוי הגדרות אלו עשוי להשפיע על המידע המוצג באזור הניהול.
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
                // Note: translate logic is reversed because of RTL direction in app usually
                // If app is LTR, it should be translate-x-5 for checked
                // Let's adjust styles to be direction agnostic if possible or assume RTL
                style={{ transform: checked ? 'translateX(0)' : 'translateX(-1.25rem)' }}
            />
        </button>
    )
}
