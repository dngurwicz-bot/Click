'use client'

import React, { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { orgApi } from '@/lib/api/organization'
import { Position, Department, Division } from '@/types/organization'
import OrgStructureLayout from '@/components/organization/OrgStructureLayout'
import DataTable, { Column } from '@/components/ui/DataTable'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import PositionForm from '@/components/organization/PositionForm'
import { useOrganization } from '@/contexts/OrganizationContext'

export default function PositionsPage() {
    const { organization } = useOrganization()
    const [positions, setPositions] = useState<Position[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [divisions, setDivisions] = useState<Division[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingPosition, setEditingPosition] = useState<Position | null>(null)

    useEffect(() => {
        if (organization?.id) {
            loadData(organization.id)
        } else {
            setPositions([])
            setDepartments([])
            setDivisions([])
            setLoading(false)
        }
    }, [organization])

    const loadData = async (orgId: string) => {
        try {
            setLoading(true)
            const [posData, depsData, divsData] = await Promise.all([
                orgApi.getPositions(orgId),
                orgApi.getDepartments(orgId),
                orgApi.getDivisions(orgId)
            ])
            setPositions(posData)
            setDepartments(depsData)
            setDivisions(divsData)
        } catch (err) {
            console.error('Failed to load data', err)
            setPositions([])
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = () => {
        setEditingPosition(null)
        setIsModalOpen(true)
    }

    const handleEdit = (position: Position) => {
        setEditingPosition(position)
        setIsModalOpen(true)
    }

    const handleDelete = async (position: Position) => {
        if (!window.confirm('האם אתה בטוח שברצונך למחוק תפקיד זה?')) return

        try {
            await orgApi.deletePosition(position.id)
            setPositions(prev => prev.filter(p => p.id !== position.id))
        } catch (err) {
            console.error('Failed to delete position', err)
            alert('שגיאה במחיקת התפקיד')
        }
    }

    const handleSave = async (data: Partial<Position>) => {
        if (!organization) return

        try {
            let savedPosition;
            if (editingPosition) {
                savedPosition = await orgApi.updatePosition(editingPosition.id, data)
            } else {
                savedPosition = await orgApi.createPosition({
                    ...data,
                    organization_id: organization.id
                })
            }

            setIsModalOpen(false)
            loadData(organization.id)
        } catch (err) {
            console.error('Failed to save position', err)
            throw err
        }
    }

    const columns: Column<Position>[] = [
        {
            key: 'name',
            header: 'שם התפקיד',
            sortable: true,
            render: (pos) => (
                <div className="font-medium text-gray-900">{pos.name}</div>
            )
        },
        {
            key: 'division',
            header: 'שיוך לאגף',
            sortable: true,
            render: (pos) => pos.division?.name || '-'
        },
        {
            key: 'department',
            header: 'שיוך למחלקה',
            sortable: true,
            render: (pos) => pos.department?.name || '-'
        },
        {
            key: 'levels',
            header: 'רמות',
            render: (pos) => pos.levels?.length ? `${pos.levels.length} רמות` : '-'
        },
        {
            key: 'is_active',
            header: 'סטטוס',
            sortable: true,
            render: (pos) => (
                <span className={`
          inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
          ${pos.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
        `}>
                    {pos.is_active ? 'פעיל' : 'לא פעיל'}
                </span>
            )
        }
    ]

    if (!organization) {
        return (
            <OrgStructureLayout title="ניהול תפקידים" description="הגדרת תפקידים ודרגות מקצועיות">
                <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200 mt-6">
                    אנא בחר ארגון כדי לנהל תפקידים
                </div>
            </OrgStructureLayout>
        )
    }

    return (
        <OrgStructureLayout
            title="ניהול תפקידים"
            description={`ניהול תפקידים עבור ${organization.name}`}
            actions={
                <Button onClick={handleCreate} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    הוסף תפקיד
                </Button>
            }
        >
            <div className="mt-6">
                <DataTable
                    data={positions}
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
                title={editingPosition ? 'עריכת תפקיד' : 'הוספת תפקיד חדש'}
            >
                <PositionForm
                    initialData={editingPosition}
                    divisions={divisions}
                    departments={departments}
                    onSave={handleSave}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>
        </OrgStructureLayout>
    )
}
