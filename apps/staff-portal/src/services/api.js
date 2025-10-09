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

    // Admission management methods
    async scheduleExam(id, examData) {
        return this.makeRequest(`/staff/applications/${id}/schedule-exam`, {
            method: 'PATCH',
            body: JSON.stringify(examData),
        })
    }

    async updateExamScore(id, scoreData) {
        return this.makeRequest(`/staff/applications/${id}/exam-score`, {
            method: 'PATCH',
            body: JSON.stringify(scoreData),
        })
    }

    async scheduleScreening(id, screeningData) {
        return this.makeRequest(`/staff/applications/${id}/schedule-screening`, {
            method: 'PATCH',
            body: JSON.stringify(screeningData),
        })
    }

    async completeScreening(id) {
        return this.makeRequest(`/staff/applications/${id}/complete-screening`, {
            method: 'PATCH',
        })
    }

    async makeAdmissionDecision(id, decisionData) {
        return this.makeRequest(`/staff/applications/${id}/admission-decision`, {
            method: 'PATCH',
            body: JSON.stringify(decisionData),
        })
    }

    async generateMatriculationNumber(id) {
        return this.makeRequest(`/staff/applications/${id}/generate-matric`, {
            method: 'PATCH',
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

    // Payment Management
    async getPayments(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString()
        return this.makeRequest(`/staff/payments${queryParams ? `?${queryParams}` : ''}`)
    }

    async getPayment(id) {
        return this.makeRequest(`/staff/payments/${id}`)
    }

    async createPayment(paymentData) {
        return this.makeRequest('/staff/payments', {
            method: 'POST',
            body: JSON.stringify(paymentData),
        })
    }

    async updatePayment(id, paymentData) {
        return this.makeRequest(`/staff/payments/${id}`, {
            method: 'PUT',
            body: JSON.stringify(paymentData),
        })
    }

    async togglePaymentStatus(id) {
        return this.makeRequest(`/staff/payments/${id}/toggle-status`, {
            method: 'PATCH',
        })
    }

    async deletePayment(id) {
        return this.makeRequest(`/staff/payments/${id}`, {
            method: 'DELETE',
        })
    }

    // Academic Sessions Management
    async getAcademicSessions(params = {}) {
        const queryParams = new URLSearchParams(params).toString()
        const endpoint = queryParams ? `/academic-sessions?${queryParams}` : '/academic-sessions'
        return this.makeRequest(endpoint)
    }

    async getAcademicSession(id) {
        return this.makeRequest(`/academic-sessions/${id}`)
    }

    async createAcademicSession(sessionData) {
        return this.makeRequest('/academic-sessions', {
            method: 'POST',
            body: JSON.stringify(sessionData),
        })
    }

    async updateAcademicSession(id, sessionData) {
        return this.makeRequest(`/academic-sessions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(sessionData),
        })
    }

    async deleteAcademicSession(id) {
        return this.makeRequest(`/academic-sessions/${id}`, {
            method: 'DELETE',
        })
    }

    async getSessionControls(sessionId) {
        return this.makeRequest(`/academic-sessions/${sessionId}/controls`)
    }

    async updateSessionControls(sessionId, controlsData) {
        return this.makeRequest(`/academic-sessions/${sessionId}/controls`, {
            method: 'PUT',
            body: JSON.stringify(controlsData),
        })
    }

    // Department Management
    async getDepartments(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString()
        return this.makeRequest(`/departments${queryParams ? `?${queryParams}` : ''}`)
    }

    async getDepartment(id) {
        return this.makeRequest(`/departments/${id}`)
    }

    async getActiveDepartments() {
        return this.makeRequest('/departments/active')
    }

    async createDepartment(departmentData) {
        return this.makeRequest('/departments', {
            method: 'POST',
            body: JSON.stringify(departmentData),
        })
    }

    async updateDepartment(id, departmentData) {
        return this.makeRequest(`/departments/${id}`, {
            method: 'PUT',
            body: JSON.stringify(departmentData),
        })
    }

    async deleteDepartment(id) {
        return this.makeRequest(`/departments/${id}`, {
            method: 'DELETE',
        })
    }

    async toggleDepartmentStatus(id) {
        return this.makeRequest(`/departments/${id}/toggle-status`, {
            method: 'PATCH',
        })
    }

    // Program API methods
    async getPrograms(params = {}) {
        const queryString = new URLSearchParams(params).toString()
        return this.makeRequest(`/programs${queryString ? `?${queryString}` : ''}`)
    }

    async getProgram(id) {
        return this.makeRequest(`/programs/${id}`)
    }

    async createProgram(programData) {
        return this.makeRequest('/programs', {
            method: 'POST',
            body: JSON.stringify(programData),
        })
    }

    async updateProgram(id, programData) {
        return this.makeRequest(`/programs/${id}`, {
            method: 'PUT',
            body: JSON.stringify(programData),
        })
    }

    async deleteProgram(id) {
        return this.makeRequest(`/programs/${id}`, {
            method: 'DELETE',
        })
    }

    async toggleProgramStatus(id) {
        return this.makeRequest(`/programs/${id}/toggle-status`, {
            method: 'PUT',
        })
    }

    // Program Type API methods
    async getProgramTypes() {
        return this.makeRequest('/programs/types')
    }

    async createProgramType(typeData) {
        return this.makeRequest('/programs/types', {
            method: 'POST',
            body: JSON.stringify(typeData),
        })
    }

    async updateProgramType(id, typeData) {
        return this.makeRequest(`/programs/types/${id}`, {
            method: 'PUT',
            body: JSON.stringify(typeData),
        })
    }

    async deleteProgramType(id) {
        return this.makeRequest(`/programs/types/${id}`, {
            method: 'DELETE',
        })
    }

    async toggleProgramTypeStatus(id) {
        return this.makeRequest(`/programs/types/${id}/toggle-status`, {
            method: 'PUT',
        })
    }

    // Program Mode API methods
    async getProgramModes() {
        return this.makeRequest('/programs/modes')
    }

    async createProgramMode(modeData) {
        return this.makeRequest('/programs/modes', {
            method: 'POST',
            body: JSON.stringify(modeData),
        })
    }

    async updateProgramMode(id, modeData) {
        return this.makeRequest(`/programs/modes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(modeData),
        })
    }

    async deleteProgramMode(id) {
        return this.makeRequest(`/programs/modes/${id}`, {
            method: 'DELETE',
        })
    }

    async toggleProgramModeStatus(id) {
        return this.makeRequest(`/programs/modes/${id}/toggle-status`, {
            method: 'PUT',
        })
    }
}

export const apiService = new StaffApiService()