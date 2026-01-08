'use client'

import React, { useState, useEffect } from 'react'
import { Position, Department, Division, PositionLevel } from '@/types/organization'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Plus, Trash2 } from 'lucide-react'

interface PositionFormProps {
    initialData?: Position | null
    divisions: Division[]
    departments: Department[]
    onSave: (data: Partial<Position>) => Promise<void>
    onCancel: () => void
}

export default function PositionForm({
    initialData,
    divisions,
    departments,
    onSave,
    onCancel
}: PositionFormProps) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        division_id: '',
        department_id: '',
        is_active: true
    })
    const [levels, setLevels] = useState<Partial<PositionLevel>[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                description: initialData.description || '',
                division_id: initialData.division_id || '',
                department_id: initialData.department_id || '',
                is_active: initialData.is_active
            })
            if (initialData.levels) {
                setLevels(initialData.levels)
            }
        } else {
            // Default levels
            setLevels([
                { level_name: 'Junior', level_order: 1 },
                { level_name: 'Mid', level_order: 2 },
                { level_name: 'Senior', level_order: 3 }
            ])
        }
    }, [initialData])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name.trim()) {
            setError('חובה להזין שם תפקיד')
            return
        }

        try {
            setLoading(true)
            setError('')
            const dataToSave = {
                ...formData,
                division_id: formData.division_id === '' ? null : formData.division_id,
                department_id: formData.department_id === '' ? null : formData.department_id,
                // separate levels handling logic might be needed if backend doesn't support nested insert
                // For now assuming we just save the position logic first
            }

            // Note: Full implementation would require saving levels too. 
            // Current API client might not support saving levels in one go.
            // We will focus on saving the position itself for this MVP phase.

            await onSave(dataToSave)
        } catch (err) {
            console.error('Failed to save', err)
            setError('שגיאה בשמירת הנתונים')
        } finally {
            setLoading(false)
        }
    }

    const addLevel = () => {
        setLevels(prev => [
            ...prev,
            { level_name: '', level_order: prev.length + 1 }
        ])
    }

    const removeLevel = (index: number) => {
        setLevels(prev => prev.filter((_, i) => i !== index))
    }

    const updateLevel = (index: number, field: keyof PositionLevel, value: any) => {
        setLevels(prev => {
            const newLevels = [...prev]
            newLevels[index] = { ...newLevels[index], [field]: value }
            return newLevels
        })
    }

    // Filter departments based on selected division
    const filteredDepartments = formData.division_id
        ? departments.filter(d => d.division_id === formData.division_id)
        : departments

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        שם התפקיד *
                    </label>
                    <Input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                        placeholder="לדוגמה: מפתח תוכנה"
                        className="w-full"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            שייך לאגף
                        </label>
                        <select
                            value={formData.division_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, division_id: e.target.value, department_id: '' }))}
                            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">(ללא אגף - תפקיד כללי)</option>
                            {divisions.map(div => (
                                <option key={div.id} value={div.id}>
                                    {div.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            שייך למחלקה
                        </label>
                        <select
                            value={formData.department_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
                            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">(ללא מחלקה)</option>
                            {filteredDepartments.map(dept => (
                                <option key={dept.id} value={dept.id}>
                                    {dept.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        תיאור
                    </label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={2}
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="תיאור התפקיד..."
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
            </div>

            <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                        רמות תפקיד (Levels)
                    </label>
                    <button
                        type="button"
                        onClick={addLevel}
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                        <Plus className="h-4 w-4" />
                        הוסף רמה
                    </button>
                </div>

                <div className="space-y-2 bg-gray-50 p-3 rounded-md">
                    {levels.map((level, index) => (
                        <div key={index} className="flex gap-2 items-center">
                            <span className="text-xs text-gray-500 w-8 text-center">{level.level_order}</span>
                            <Input
                                type="text"
                                value={level.level_name || ''}
                                onChange={(e) => updateLevel(index, 'level_name', e.target.value)}
                                placeholder="שם הרמה"
                                className="flex-1 text-sm py-1"
                            />
                            <button
                                type="button"
                                onClick={() => removeLevel(index)}
                                className="text-red-500 hover:text-red-700 p-1"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    {levels.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-2">אין רמות מוגדרות</p>
                    )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    * ניהול הרמות ישמר בשלב זה רק בצד הלקוח (הדגמה)
                </p>
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
                    {loading ? 'שומר...' : (initialData ? 'עדכן תפקיד' : 'צור תפקיד')}
                </Button>
            </div>
        </form>
    )
}
