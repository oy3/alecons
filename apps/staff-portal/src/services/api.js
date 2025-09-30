import { logger } from '@shared/utils/logger'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

class StaffApiService {
    constructor() {
        this.baseURL = API_BASE_URL
        this.token = null
    }

    setToken(token) {
        this.token = token
        logger.info('Staff API token set:', { hasToken: !!token })
    }

    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`

        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        }

        // Add authorization header if token exists
        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`
        }

        try {
            logger.info('Staff API request:', {
                method: config.method,
                url,
                hasAuth: !!this.token,
            })

            const response = await fetch(url, config)

            if (!response.ok) {
                if (response.status === 401) {
                    this.handleTokenExpiration()
                    throw new Error('Unauthorized access')
                }

                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
            }

            const data = await response.json()

            logger.info('Staff API response:', {
                method: config.method,
                url,
                success: data.success !== false,
                hasData: !!data.data
            })

            return data
        } catch (error) {
            logger.error('Staff API request failed:', {
                method: config.method,
                url,
                error: error.message
            })

            if (error.message.includes('fetch')) {
                throw new Error('Network error. Please check your connection.')
            }

            throw error
        }
    }

    async post(endpoint, data = {}) {
        return this.makeRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    async put(endpoint, data = {}) {
        return this.makeRequest(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }

    async patch(endpoint, data = {}) {
        return this.makeRequest(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data),
        })
    }

    async delete(endpoint) {
        return this.makeRequest(endpoint, { method: 'DELETE' })
    }

    handleTokenExpiration() {
        import('../stores/auth.js').then(({ useAuthStore }) => {
            const authStore = useAuthStore()
            authStore.handleAuthError()
        })
    }

    // Authentication methods
    async staffLogin(credentials) {
        return this.makeRequest('/auth/staff/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        })
    }

    async getStaffProfile() {
        return this.makeRequest('/auth/staff/profile')
    }

    async changeStaffPassword(passwordData) {
        return this.makeRequest('/auth/staff/change-password', {
            method: 'POST',
            body: JSON.stringify(passwordData),
        })
    }

    // Application management
    async getApplications(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString()
        return this.makeRequest(`/staff/applications${queryParams ? `?${queryParams}` : ''}`)
    }

    async getApplication(id) {
        return this.makeRequest(`/staff/applications/${id}`)
    }

    async updateApplicationStatus(id, status, remarks = '') {
        return this.makeRequest(`/staff/applications/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status, remarks }),
        })
    }

    // User management
    async getUsers(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString()
        return this.makeRequest(`/staff/users${queryParams ? `?${queryParams}` : ''}`)
    }

    async getUser(id) {
        return this.makeRequest(`/staff/users/${id}`)
    }

    async updateUser(id, userData) {
        return this.makeRequest(`/staff/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(userData),
        })
    }

    async createStaffUser(userData) {
        return this.makeRequest('/staff/users', {
            method: 'POST',
            body: JSON.stringify(userData),
        })
    }

    // Reports and analytics
    async getDashboardStats() {
        return this.makeRequest('/staff/dashboard/stats')
    }

    async getReports(type, filters = {}) {
        const queryParams = new URLSearchParams(filters).toString()
        return this.makeRequest(`/staff/reports/${type}${queryParams ? `?${queryParams}` : ''}`)
    }

    // System settings
    async getSystemSettings() {
        return this.makeRequest('/staff/settings')
    }

    async updateSystemSettings(settings) {
        return this.makeRequest('/staff/settings', {
            method: 'PATCH',
            body: JSON.stringify(settings),
        })
    }

    // Health check
    async healthCheck() {
        return this.makeRequest('/health')
    }
}

export const apiService = new StaffApiService()