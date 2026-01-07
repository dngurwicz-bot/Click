/**
 * API Client for Click HR Backend
 * Handles all API calls to the FastAPI backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface ApiError {
  detail: string
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl
  }

  private async getAuthToken(): Promise<string | null> {
    // Get token from Supabase session
    if (typeof window === 'undefined') return null
    
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch (error) {
      console.error('Error getting auth token:', error)
      return null
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken()
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: `HTTP error! status: ${response.status}`,
      }))
      throw new Error(error.detail || 'An error occurred')
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return response.json()
    }
    
    return {} as T
  }

  // Organizations API
  async getOrganizations() {
    return this.request<any[]>('/api/organizations')
  }

  async getOrganization(orgId: string) {
    return this.request<any>(`/api/organizations/${orgId}`)
  }

  async createOrganization(data: { name: string; is_active?: boolean }) {
    return this.request<any>('/api/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateOrganization(orgId: string, data: { name?: string; is_active?: boolean }) {
    return this.request<any>(`/api/organizations/${orgId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteOrganization(orgId: string) {
    return this.request<{ message: string }>(`/api/organizations/${orgId}`, {
      method: 'DELETE',
    })
  }

  // Health check
  async healthCheck() {
    return this.request<{ status: string; timestamp: string }>('/health')
  }
}

export const api = new ApiClient()
