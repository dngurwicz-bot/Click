// API Client for Click HR
// This is a placeholder - you'll need to implement actual API calls based on your backend

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface ApiResponse<T> {
  data?: T
  error?: string
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
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
      return { error: error.message || 'שגיאה בקבלת הנתונים' }
    }
  }

  // Organizations
  async getOrganizations() {
    const response = await this.request<any[]>('/api/organizations')
    return response.data || []
  }

  async createOrganization(data: { name: string; is_active: boolean }) {
    return this.request('/api/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateOrganization(id: string, data: { name: string; is_active: boolean }) {
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

  // Employees
  async getEmployees() {
    const response = await this.request<any[]>('/api/employees')
    return response.data || []
  }

  async getEmployee(employeeId: string) {
    const response = await this.request<any>(`/api/employees/${employeeId}`)
    return response.data
  }

  // Events
  async getEmployeeEvents(employeeId: string) {
    const response = await this.request<any[]>(`/api/employees/${employeeId}/events`)
    return response.data || []
  }

  async getEventData(employeeId: string, eventType: number) {
    const response = await this.request<any>(
      `/api/employees/${employeeId}/events/${eventType}`
    )
    return response.data
  }

  async updateEventData(employeeId: string, eventType: number, data: any) {
    return this.request(`/api/employees/${employeeId}/events/${eventType}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }
}

export const api = new ApiClient()
