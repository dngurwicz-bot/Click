import { createClient } from '@/lib/supabase/client'
import {
    OrganizationSettings,
    Division,
    Department,
    Position,
    PositionLevel,
    EmployeeAssignment
} from '../../types/organization'

class OrganizationApiClient {
    private supabase = createClient()

    // Settings
    async getSettings(orgId: string) {
        const { data, error } = await this.supabase
            .rpc('get_org_settings', { org_id: orgId })

        if (error) throw error
        return data as OrganizationSettings
    }

    async updateSettings(orgId: string, settings: Partial<OrganizationSettings>) {
        const { data, error } = await this.supabase
            .from('organization_settings')
            .update(settings)
            .eq('organization_id', orgId)
            .select()
            .single()

        if (error) throw error
        return data as OrganizationSettings
    }

    // Divisions
    async getDivisions(orgId: string) {
        const { data, error } = await this.supabase
            .from('divisions')
            .select(`
        *,
        parent_division:parent_division_id(id, name),
        manager:manager_id(first_name, last_name)
      `)
            .eq('organization_id', orgId)
            .order('name')

        if (error) throw error
        return data as Division[]
    }

    async createDivision(division: Partial<Division>) {
        const { data, error } = await this.supabase
            .from('divisions')
            .insert([division])
            .select()
            .single()

        if (error) throw error
        return data as Division
    }

    async updateDivision(id: string, updates: Partial<Division>) {
        const { data, error } = await this.supabase
            .from('divisions')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as Division
    }

    async deleteDivision(id: string) {
        const { error } = await this.supabase
            .from('divisions')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }

    // Departments
    async getDepartments(orgId: string) {
        const { data, error } = await this.supabase
            .from('departments')
            .select(`
        *,
        division:division_id(id, name),
        manager:manager_id(first_name, last_name)
      `)
            .eq('organization_id', orgId)
            .order('name')

        if (error) throw error
        return data as Department[]
    }

    async createDepartment(department: Partial<Department>) {
        const { data, error } = await this.supabase
            .from('departments')
            .insert([department])
            .select()
            .single()

        if (error) throw error
        return data as Department
    }

    async updateDepartment(id: string, updates: Partial<Department>) {
        const { data, error } = await this.supabase
            .from('departments')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as Department
    }

    async deleteDepartment(id: string) {
        const { error } = await this.supabase
            .from('departments')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }

    // Positions
    async getPositions(orgId: string) {
        const { data, error } = await this.supabase
            .from('positions')
            .select(`
        *,
        division:division_id(id, name),
        department:department_id(id, name),
        levels:position_levels(*)
      `)
            .eq('organization_id', orgId)
            .order('name')

        if (error) throw error
        return data as Position[]
    }

    async createPosition(position: Partial<Position>) {
        const { data, error } = await this.supabase
            .from('positions')
            .insert([position])
            .select()
            .single()

        if (error) throw error
        return data as Position
    }

    async updatePosition(id: string, updates: Partial<Position>) {
        const { data, error } = await this.supabase
            .from('positions')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as Position
    }

    async deletePosition(id: string) {
        const { error } = await this.supabase
            .from('positions')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }

    // Position Levels
    async addPositionLevel(level: Partial<PositionLevel>) {
        const { data, error } = await this.supabase
            .from('position_levels')
            .insert([level])
            .select()
            .single()

        if (error) throw error
        return data as PositionLevel
    }

    async deletePositionLevel(id: string) {
        const { error } = await this.supabase
            .from('position_levels')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }
}

export const orgApi = new OrganizationApiClient()
