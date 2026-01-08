'use client'

import React, { useState, useEffect } from 'react'
import { Department, Division } from '@/types/organization'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface DepartmentFormProps {
    initialData?: Department | null
    divisions: Division[]
    onSave: (data: Partial<Department>) => Promise<void>
    onCancel: () => void
}

export default function DepartmentForm({
    initialData,
    divisions,
    onSave,
    onCancel
}: DepartmentFormProps) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        division_id: '',
        manager_id: '', // TODO: Add manager selection
        is_active: true
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                description: initialData.description || '',
                division_id: initialData.division_id || '',
                manager_id: initialData.manager_id || '',
                is_active: initialData.is_active
            })
        }
    }, [initialData])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name.trim()) {
            setError('חובה להזין שם מחלקה')
            return
        }

        try {
            setLoading(true)
            setError('')
            const dataToSave = {
                ...formData,
                division_id: formData.division_id === '' ? null : formData.division_id,
                manager_id: formData.manager_id === '' ? null : formData.manager_id
            }
            await onSave(dataToSave)
        } catch (err) {
            console.error('Failed to save', err)
            setError('שגיאה בשמירת הנתונים')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
                    {error}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    שם המחלקה *
                </label>
                <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    placeholder="לדוגמה: צוות פיתוח תשתיות"
                    className="w-full"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    שייך לאגף
                </label>
                {divisions.length > 0 ? (
                    <select
                        value={formData.division_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, division_id: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">(ללא אגף - מחלקה עצמאית)</option>
                        {divisions.map(div => (
                            <option key={div.id} value={div.id}>
                                {div.name}
                            </option>
                        ))}
                    </select>
                ) : (
                    <div className="text-gray-500 text-sm p-2 bg-gray-50 rounded border">
                        לא הוגדרו אגפים עדיין. ניתן לשייך מחלקה לאגף רק לאחר יצירת אגפים.
                    </div>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    תיאור
                </label>
                <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="תיאור קצר של המחלקה..."
                />
            </div>

            <div>
                <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                    <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">פעיל</span>
                </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onCancel}
                    disabled={loading}
                >
                    ביטול
                </Button>
                <Button
                    type="submit"
                    disabled={loading}
                >
                    {loading ? 'שומר...' : (initialData ? 'עדכן מחלקה' : 'צור מחלקה')}
                </Button>
            </div>
        </form>
    )
}
