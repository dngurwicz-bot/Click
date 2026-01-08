'use client'

import React, { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { orgApi } from '@/lib/api/organization'
import { Department, Division } from '@/types/organization'
import OrgStructureLayout from '@/components/organization/OrgStructureLayout'
import DataTable, { Column } from '@/components/ui/DataTable'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import DepartmentForm from '@/components/organization/DepartmentForm'
import { useOrganization } from '@/contexts/OrganizationContext'

export default function DepartmentsPage() {
    const { organization } = useOrganization()
    const [departments, setDepartments] = useState<Department[]>([])
    const [divisions, setDivisions] = useState<Division[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)

    useEffect(() => {
        if (organization?.id) {
            loadData(organization.id)
        } else {
            setDepartments([])
            setDivisions([])
            setLoading(false)
        }
    }, [organization])

    const loadData = async (orgId: string) => {
        try {
            setLoading(true)
            const [depsData, divsData] = await Promise.all([
                orgApi.getDepartments(orgId),
                orgApi.getDivisions(orgId)
            ])
            setDepartments(depsData)
            setDivisions(divsData)
        } catch (err) {
            console.error('Failed to load data', err)
            setDepartments([])
            setDivisions([])
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = () => {
        setEditingDepartment(null)
        setIsModalOpen(true)
    }

    const handleEdit = (department: Department) => {
        setEditingDepartment(department)
        setIsModalOpen(true)
    }

    const handleDelete = async (department: Department) => {
        if (!window.confirm('האם אתה בטוח שברצונך למחוק מחלקה זו?')) return

        try {
            await orgApi.deleteDepartment(department.id)
            setDepartments(prev => prev.filter(d => d.id !== department.id))
        } catch (err) {
            console.error('Failed to delete department', err)
            alert('שגיאה במחיקת המחלקה')
        }
    }

    const handleSave = async (data: Partial<Department>) => {
        if (!organization) return

        try {
            if (editingDepartment) {
                await orgApi.updateDepartment(editingDepartment.id, data)
            } else {
                await orgApi.createDepartment({
                    ...data,
                    organization_id: organization.id
                })
            }
            setIsModalOpen(false)
            loadData(organization.id) // Reload to get fresh joins
        } catch (err) {
            console.error('Failed to save department', err)
            throw err
        }
    }

    const columns: Column<Department>[] = [
        {
            key: 'name',
            header: 'שם המחלקה',
            sortable: true,
            render: (dept) => (
                <div className="font-medium text-gray-900">{dept.name}</div>
            )
        },
        {
            key: 'division',
            header: 'אגף',
            sortable: true,
            render: (dept) => dept.division?.name || '-'
        },
        {
            key: 'manager',
            header: 'מנהל מחלקה',
            render: (dept) => dept.manager
                ? `${dept.manager.first_name} ${dept.manager.last_name}`
                : '-'
        },
        {
            key: 'is_active',
            header: 'סטטוס',
            sortable: true,
            render: (dept) => (
                <span className={`
          inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
          ${dept.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
        `}>
                    {dept.is_active ? 'פעיל' : 'לא פעיל'}
                </span>
            )
        }
    ]

    if (!organization) {
        return (
            <OrgStructureLayout title="ניהול מחלקות" description="הגדרת מחלקות וצוותים בארגון">
                <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200 mt-6">
                    אנא בחר ארגון כדי לנהל מחלקות
                </div>
            </OrgStructureLayout>
        )
    }

    return (
        <OrgStructureLayout
            title="ניהול מחלקות"
            description={`ניהול מחלקות עבור ${organization.name}`}
            actions={
                <Button onClick={handleCreate} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    הוסף מחלקה
                </Button>
            }
        >
            <div className="mt-6">
                <DataTable
                    data={departments}
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
                title={editingDepartment ? 'עריכת מחלקה' : 'הוספת מחלקה חדשה'}
            >
                <DepartmentForm
                    initialData={editingDepartment}
                    divisions={divisions}
                    onSave={handleSave}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>
        </OrgStructureLayout>
    )
}
