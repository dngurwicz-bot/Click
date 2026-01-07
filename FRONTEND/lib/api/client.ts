
// API Client for Click HR
// Implementation with Mock Data for standalone development

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const USE_MOCK = true // Toggle this to switch between Mock and Real API

interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface Organization {
  id: string
  name: string
  is_active: boolean
  modules: string[] // 'core' | 'time' | 'salary' | 'welfare' | 'recruitment'
  created_at: string
  updated_at: string
}

export interface OrgUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'manager' | 'employee'
  org_id: string
}

// Mock Data Store
let mockOrgs: Organization[] = [
  { id: '1', name: 'Click HR Demo', is_active: true, modules: ['core', 'time'], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', name: 'Acme Corp', is_active: true, modules: ['core', 'salary'], created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
]

let mockUsers: OrgUser[] = [
  { id: '1', email: 'admin@example.com', name: 'Admin User', role: 'admin', org_id: '1' }
]

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    if (USE_MOCK) return this.mockRequest<T>(endpoint, options)

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data }
    } catch (error: any) {
      console.error(`API Error (${endpoint}):`, error)
      return { error: error.message || 'שגיאה בקבלת הנתונים' }
    }
  }

  // Mock Request Handler
  private async mockRequest<T>(endpoint: string, options: RequestInit): Promise<ApiResponse<T>> {
    await new Promise(resolve => setTimeout(resolve, 500)) // Simulate network latency

    // Organizations
    if (endpoint === '/api/organizations' && options.method === 'GET') {
      return { data: mockOrgs as any }
    }
    if (endpoint === '/api/organizations' && options.method === 'POST') {
      const body = JSON.parse(options.body as string)
      const newOrg = {
        id: Math.random().toString(36).substr(2, 9),
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      mockOrgs.push(newOrg)
      return { data: newOrg as any }
    }
    if (endpoint.startsWith('/api/organizations/') && options.method === 'PUT') {
      const id = endpoint.split('/')[3]
      const body = JSON.parse(options.body as string)
      const index = mockOrgs.findIndex(o => o.id === id)
      if (index !== -1) {
        mockOrgs[index] = { ...mockOrgs[index], ...body, updated_at: new Date().toISOString() }
        return { data: mockOrgs[index] as any }
      }
    }
    if (endpoint.startsWith('/api/organizations/') && options.method === 'DELETE') {
      const id = endpoint.split('/')[3]
      mockOrgs = mockOrgs.filter(o => o.id !== id)
      return { data: { success: true } as any }
    }

    // Org Users
    if (endpoint.startsWith('/api/organizations/') && endpoint.endsWith('/users') && options.method === 'GET') {
      const orgId = endpoint.split('/')[3]
      const users = mockUsers.filter(u => u.org_id === orgId)
      return { data: users as any }
    }
    if (endpoint.startsWith('/api/organizations/') && endpoint.endsWith('/users') && options.method === 'POST') {
      const orgId = endpoint.split('/')[3]
      const body = JSON.parse(options.body as string)
      const newUser = {
        id: Math.random().toString(36).substr(2, 9),
        org_id: orgId,
        ...body
      }
      mockUsers.push(newUser)
      return { data: newUser as any }
    }

    // Employees (Mock)
    if (endpoint === '/api/employees') {
      return { data: [] as any }
    }

    return { error: 'Mock endpoint not found' }
  }

  // Organizations
  async getOrganizations() {
    return (await this.request<Organization[]>('/api/organizations')).data || []
  }

  async createOrganization(data: { name: string; is_active: boolean; modules: string[] }) {
    return this.request('/api/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateOrganization(id: string, data: { name: string; is_active: boolean; modules: string[] }) {
    return this.request(`/api/organizations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteOrganization(id: string) {
    return this.request(`/api/organizations/${id}`, {
      method: 'DELETE',
    })
  }

  // Organization Users
  async getOrgUsers(orgId: string) {
    return (await this.request<OrgUser[]>(`/api/organizations/${orgId}/users`)).data || []
  }

  async createOrgUser(orgId: string, data: { name: string; email: string; role: string }) {
    return this.request(`/api/organizations/${orgId}/users`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

export const api = new ApiClient()
