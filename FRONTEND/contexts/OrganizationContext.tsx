'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { api, Organization } from '@/lib/api/client'

interface OrganizationContextType {
    organization: Organization | null
    setOrganization: (org: Organization) => void
    isLoading: boolean
    error: Error | null
    organizations: Organization[] // Also expose list so switcher doesn't need to refetch
    refreshOrganizations: () => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
    const [organization, setOrganization] = useState<Organization | null>(null)
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const loadOrganizations = async () => {
        try {
            setIsLoading(true)
            const data = await api.getOrganizations()
            setOrganizations(data)

            // If we don't have a selected organization, or the selected one is not in the new list
            // (though usually we'd want to persist selection in localStorage or URL)
            if (data.length > 0 && !organization) {
                setOrganization(data[0])
            }
        } catch (err) {
            console.error('Failed to load organizations context', err)
            setError(err instanceof Error ? err : new Error('Failed to load organizations'))
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadOrganizations()
    }, [])

    return (
        <OrganizationContext.Provider
            value={{
                organization,
                setOrganization,
                isLoading,
                error,
                organizations,
                refreshOrganizations: loadOrganizations
            }}
        >
            {children}
        </OrganizationContext.Provider>
    )
}

export function useOrganization() {
    const context = useContext(OrganizationContext)
    if (context === undefined) {
        throw new Error('useOrganization must be used within an OrganizationProvider')
    }
    return context
}
