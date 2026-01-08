'use client'

import React from 'react'
import { OrganizationProvider } from '@/contexts/OrganizationContext'

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <OrganizationProvider>
            {children}
        </OrganizationProvider>
    )
}
