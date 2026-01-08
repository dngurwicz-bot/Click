'use client'

import React, { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { orgApi } from '@/lib/api/organization'
import { Division } from '@/types/organization'
import OrgStructureLayout from '@/components/organization/OrgStructureLayout'
import DataTable, { Column } from '@/components/ui/DataTable'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import DivisionForm from '@/components/organization/DivisionForm'
import { useOrganization } from '@/contexts/OrganizationContext'

export default function DivisionsPage() {
    const { organization } = useOrganization()
    const [divisions, setDivisions] = useState<Division[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingDivision, setEditingDivision] = useState<Division | null>(null)

    useEffect(() => {
        if (organization?.id) {
            loadDivisions(organization.id)
        } else {
            setDivisions([])
            setLoading(false)
        }
    }, [organization])

    const loadDivisions = async (orgId: string) => {
        try {
            setLoading(true)
            const data = await orgApi.getDivisions(orgId)
            setDivisions(data)
        } catch (err) {
            console.error('Failed to load divisions', err)
            setDivisions([])
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = () => {
        if (!organization) return
        setEditingDivision(null)
        setIsModalOpen(true)
    }

    const handleEdit = (division: Division) => {
        setEditingDivision(division)
        setIsModalOpen(true)
    }

    const handleDelete = async (division: Division) => {
        if (!window.confirm('האם אתה בטוח שברצונך למחוק אגף זה?')) return

        try {
            await orgApi.deleteDivision(division.id)
            setDivisions(prev => prev.filter(d => d.id !== division.id))
        } catch (err) {
            console.error('Failed to delete division', err)
            alert('שגיאה במחיקת האגף')
        }
    }

    const handleSave = async (data: Partial<Division>) => {
        if (!organization) return

        try {
            if (editingDivision) {
                await orgApi.updateDivision(editingDivision.id, data)
            } else {
                await orgApi.createDivision({
                    ...data,
                    organization_id: organization.id
                })
            }
            setIsModalOpen(false)
            loadDivisions(organization.id)
        } catch (err) {
            console.error('Failed to save division', err)
            throw err // Form handles error display
        }
    }

    const columns: Column<Division>[] = [
        {
            key: 'name',
            header: 'שם האגף',
            sortable: true,
            render: (division) => (
                <div className="font-medium text-gray-900">{division.name}</div>
            )
        },
        {
            key: 'manager',
            header: 'מנהל אגף',
            render: (division) => division.manager
                ? `${division.manager.first_name} ${division.manager.last_name}`
                : '-'
        },
        {
            key: 'parent_division',
            header: 'כפוף ל',
            render: (division) => division.parent_division?.name || '-'
        },
        {
            key: 'is_active',
            header: 'סטטוס',
            sortable: true,
            render: (division) => (
                <span className={`
          inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
          ${division.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
        `}>
                    {division.is_active ? 'פעיל' : 'לא פעיל'}
                </span>
            )
        }
    ]

    if (!organization) {
        return (
            <OrgStructureLayout title="ניהול אגפים" description="הגדרת אגפים ויחידות ארגוניות ראשיות">
                <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200 mt-6">
                    אנא בחר ארגון כדי לנהל אגפים
                </div>
            </OrgStructureLayout>
        )
    }

    return (
        <OrgStructureLayout
            title="ניהול אגפים"
            description={`ניהול אגפים עבור ${organization.name}`}
            actions={
                <Button onClick={handleCreate} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    הוסף אגף
                </Button>
            }
        >
            <div className="mt-6">
                <DataTable
                    data={divisions}
                    columns={columns}
                    keyField="id"
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    searchable
                    searchFields={['name']}
                />
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingDivision ? 'עריכת אגף' : 'הוספת אגף חדש'}
            >
                <DivisionForm
                    initialData={editingDivision}
                    allDivisions={divisions} // Pass for parent selection
                    onSave={handleSave}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>
        </OrgStructureLayout>
    )
}
