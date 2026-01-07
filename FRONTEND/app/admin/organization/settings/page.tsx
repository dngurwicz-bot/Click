'use client'

import React from 'react'
import OrgStructureLayout from '@/components/organization/OrgStructureLayout'
import OrganizationSettingsForm from '@/components/organization/OrganizationSettingsForm'

export default function OrganizationSettingsPage() {
    return (
        <OrgStructureLayout
            title="הגדרות ארגון"
            description="ניהול הגדרות המבנה הארגוני, היררכיה ותפקידים"
        >
            <OrganizationSettingsForm />
        </OrgStructureLayout>
    )
}
