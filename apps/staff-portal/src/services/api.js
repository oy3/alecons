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
        const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

        const config = {
            method: 'GET',
            headers: {
                ...options.headers,
            },
            ...options,
        }

        if (!isFormData) {
            config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json'
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
                    // Try to get the specific error message from the response
                    const errorData = await response.json().catch(() => ({}))
                    const errorMessage = errorData.message || 'Unauthorized access'

                    // Only handle token expiration for authenticated requests (when we have a token)
                    if (this.token && (errorMessage === 'Unauthorized access' || errorMessage.includes('token') || errorMessage.includes('expired'))) {
                        this.handleTokenExpiration()
                    }

                    throw new Error(errorMessage)
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

    async postForm(endpoint, formData) {
        return this.makeRequest(endpoint, {
            method: 'POST',
            body: formData,
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

    async exportApplicationDetailsPDF(id) {
        const url = `${this.baseURL}/staff/applications/${id}/export-details-pdf`

        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        }

        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`
        }

        try {
            logger.info('Staff API request (Application details export PDF):', {
                method: config.method,
                url,
                hasAuth: !!this.token,
            })

            const response = await fetch(url, config)

            if (!response.ok) {
                if (response.status === 401) {
                    this.handleTokenExpiration()
                    throw new Error('Authentication required for PDF export')
                }

                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
            }

            const blob = await response.blob()

            if (blob.size === 0) {
                throw new Error('Export file is empty')
            }

            const contentDisposition = response.headers.get('content-disposition') || ''
            const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i)
            const fileName = decodeURIComponent(fileNameMatch?.[1] || fileNameMatch?.[2] || `application-details-${id}.pdf`)

            const downloadUrl = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = downloadUrl
            link.download = fileName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(downloadUrl)

            logger.info('Application details export PDF download successful:', {
                id,
                fileSize: blob.size,
                fileName,
            })

            return { success: true, message: 'Application details exported successfully' }
        } catch (error) {
            logger.error('Application details export PDF failed:', {
                id,
                error: error.message,
            })
            throw error
        }
    }

    async getApplicationsStats() {
        return this.makeRequest('/staff/applications/stats/summary')
    }

    async updateApplicationStatus(id, status, remarks = '') {
        return this.makeRequest(`/staff/applications/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status, remarks }),
        })
    }

    async updateApplication(id, payload) {
        return this.makeRequest(`/staff/applications/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        })
    }

    async deleteApplication(id) {
        return this.makeRequest(`/staff/applications/${id}`, {
            method: 'DELETE',
        })
    }

    async uploadApplicationProfilePhoto(id, formData) {
        return this.postForm(`/staff/applications/${id}/upload-profile-photo`, formData)
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

    async sendAdmissionLetter(id) {
        return this.makeRequest(`/staff/applications/${id}/send-admission-letter`, {
            method: 'PATCH',
        })
    }

    async generateMatriculationNumber(id) {
        return this.makeRequest(`/staff/applications/${id}/generate-matric`, {
            method: 'PATCH',
        })
    }

    async sendMatriculationEmail(id) {
        return this.makeRequest(`/staff/applications/${id}/send-matric-email`, {
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

    async getUserPublicVerification(id) {
        return this.makeRequest(`/staff/users/${id}/public-verification`)
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

    // Utilities
    async getApplicationNumberStats(year) {
        const query = year ? `?year=${encodeURIComponent(year)}` : ''
        return this.makeRequest(`/admin/application-numbers/stats${query}`)
    }

    async getApplicationCounterStatus({ academicSessionId, year } = {}) {
        const params = new URLSearchParams()
        if (academicSessionId) params.set('academicSessionId', academicSessionId)
        if (year) params.set('year', year)
        const query = params.toString()
        return this.makeRequest(`/admin/application-numbers/counter${query ? `?${query}` : ''}`)
    }

    async repairApplicationCounters(year) {
        return this.makeRequest('/admin/application-numbers/repair', {
            method: 'POST',
            body: JSON.stringify(year ? { year } : {}),
        })
    }

    async getProgramDriftSummary(sampleLimit = 20) {
        const query = sampleLimit ? `?sampleLimit=${encodeURIComponent(sampleLimit)}` : ''
        return this.makeRequest(`/admin/application-numbers/program-drift${query}`)
    }

    async repairProgramDrift({ apply = false, sampleLimit = 20 } = {}) {
        return this.makeRequest('/admin/application-numbers/program-drift/repair', {
            method: 'POST',
            body: JSON.stringify({ apply, sampleLimit }),
        })
    }

    async backfillPublicVerificationTokens() {
        return this.makeRequest('/admin/application-numbers/public-verification/backfill', {
            method: 'POST',
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

    async getPaymentDestinationAccounts() {
        return this.makeRequest('/staff/payments/destination-accounts')
    }

    async createPaymentDestinationAccount(accountData) {
        return this.makeRequest('/staff/payments/destination-accounts', {
            method: 'POST',
            body: JSON.stringify(accountData),
        })
    }

    async updatePaymentDestinationAccount(id, accountData) {
        return this.makeRequest(`/staff/payments/destination-accounts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(accountData),
        })
    }

    async deletePaymentDestinationAccount(id) {
        return this.makeRequest(`/staff/payments/destination-accounts/${id}`, {
            method: 'DELETE',
        })
    }

    // Student Payments
    async getStudentPayments(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString()
        return this.makeRequest(`/staff/payments/student-payments${queryParams ? `?${queryParams}` : ''}`)
    }

    async exportStudentPaymentsPDF(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString()
        const url = queryParams
            ? `${this.baseURL}/staff/payments/student-payments/export-pdf?${queryParams}`
            : `${this.baseURL}/staff/payments/student-payments/export-pdf`

        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        }

        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`
        }

        try {
            logger.info('Staff API request (Student payments PDF export):', {
                method: config.method,
                url,
                hasAuth: !!this.token,
            })

            const response = await fetch(url, config)

            if (!response.ok) {
                if (response.status === 401) {
                    this.handleTokenExpiration()
                    throw new Error('Authentication required for PDF export')
                }

                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
            }

            const blob = await response.blob()

            if (blob.size === 0) {
                throw new Error('Export file is empty')
            }

            const contentDisposition = response.headers.get('content-disposition') || ''
            const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i)
            const fileName = decodeURIComponent(fileNameMatch?.[1] || fileNameMatch?.[2] || 'student-payments.pdf')

            const downloadUrl = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = downloadUrl
            link.download = fileName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(downloadUrl)

            logger.info('Student payments PDF export download successful:', {
                fileSize: blob.size,
                fileName,
            })

            return { success: true, message: 'Student payments PDF exported successfully' }
        } catch (error) {
            logger.error('Student payments PDF export failed:', {
                error: error.message,
            })
            throw error
        }
    }

    // Student Payments Statistics
    async getStudentPaymentsStats(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString()
        return this.makeRequest(`/staff/payments/student-payments/stats${queryParams ? `?${queryParams}` : ''}`)
    }

    async syncStudentPaymentRemittance(payload = {}) {
        return this.makeRequest('/staff/payments/remittance/sync', {
            method: 'POST',
            body: JSON.stringify(payload),
        })
    }

    async getStudentPaymentRemittanceRecords(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString()
        return this.makeRequest(`/staff/payments/remittance-records${queryParams ? `?${queryParams}` : ''}`)
    }

    async verifyManualTransferPayment(id, data = {}) {
        return this.makeRequest(`/staff/payments/student-payments/${id}/verify-manual`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        })
    }

    async rejectManualTransferPayment(id, data = {}) {
        return this.makeRequest(`/staff/payments/student-payments/${id}/reject-manual`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        })
    }

    async reconcileStudentPayment(id) {
        return this.makeRequest(`/staff/payments/student-payments/${id}/reconcile`, {
            method: 'PATCH',
        })
    }

    async reconcilePendingPaystackPayments(payload = {}) {
        return this.makeRequest('/staff/payments/student-payments/reconcile-pending', {
            method: 'POST',
            body: JSON.stringify(payload),
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
        return this.makeRequest(`/programs/management${queryString ? `?${queryString}` : ''}`)
    }

    async getAdvisorCourseRegistrationPrograms() {
        return this.makeRequest('/staff/course-registrations/programs')
    }

    async getAdvisorCourseRegistrations(params = {}) {
        const queryString = new URLSearchParams(
            Object.entries(params).reduce((acc, [key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    acc[key] = String(value)
                }
                return acc
            }, {})
        ).toString()
        return this.makeRequest(`/staff/course-registrations${queryString ? `?${queryString}` : ''}`)
    }

    async getAdvisorCourseRegistration(id) {
        return this.makeRequest(`/staff/course-registrations/${id}`)
    }

    async approveAdvisorCourseRegistration(id, payload = {}) {
        return this.makeRequest(`/staff/course-registrations/${id}/approve`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        })
    }

    async rejectAdvisorCourseRegistration(id, payload = {}) {
        return this.makeRequest(`/staff/course-registrations/${id}/reject`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        })
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

    // Course Catalog API methods
    async getCourseCatalog(params = {}) {
        const queryString = new URLSearchParams(params).toString()
        return this.makeRequest(`/courses/catalog${queryString ? `?${queryString}` : ''}`)
    }

    async getCourseCatalogOptions() {
        return this.makeRequest('/courses/catalog/options')
    }

    async createCourse(courseData) {
        return this.makeRequest('/courses/catalog', {
            method: 'POST',
            body: JSON.stringify(courseData),
        })
    }

    async updateCourse(id, courseData) {
        return this.makeRequest(`/courses/catalog/${id}`, {
            method: 'PUT',
            body: JSON.stringify(courseData),
        })
    }

    async deleteCourse(id) {
        return this.makeRequest(`/courses/catalog/${id}`, {
            method: 'DELETE',
        })
    }

    async getProgramCourses(params = {}) {
        const queryString = new URLSearchParams(params).toString()
        return this.makeRequest(`/courses/program-mappings${queryString ? `?${queryString}` : ''}`)
    }

    async createProgramCourse(programCourseData) {
        return this.makeRequest('/courses/program-mappings', {
            method: 'POST',
            body: JSON.stringify(programCourseData),
        })
    }

    async updateProgramCourse(id, programCourseData) {
        return this.makeRequest(`/courses/program-mappings/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(programCourseData),
        })
    }

    async deleteProgramCourse(id) {
        return this.makeRequest(`/courses/program-mappings/${id}`, {
            method: 'DELETE',
        })
    }

    // Exam API methods
    async getExams(params = {}) {
        const queryString = new URLSearchParams(params).toString()
        const endpoint = queryString ? `/exams?${queryString}` : '/exams'
        return this.makeRequest(endpoint)
    }

    async getExam(examId) {
        return this.makeRequest(`/exams/${examId}`)
    }

    async createExam(examData) {
        return this.makeRequest('/exams', {
            method: 'POST',
            body: JSON.stringify(examData),
        })
    }

    async updateExam(examId, examData) {
        return this.makeRequest(`/exams/${examId}`, {
            method: 'PUT',
            body: JSON.stringify(examData),
        })
    }

    async deleteExam(examId) {
        return this.makeRequest(`/exams/${examId}`, {
            method: 'DELETE',
        })
    }

    async regenerateExamPassword(examId) {
        return this.makeRequest(`/exams/${examId}/regenerate-password`, {
            method: 'POST',
        })
    }

    async sendScheduledExamEmail(examId) {
        return this.makeRequest(`/exams/${examId}/send-scheduled-email`, {
            method: 'POST',
        })
    }

    async gradeExam(examId) {
        return this.makeRequest(`/exams/${examId}/grade-all`, {
            method: 'POST',
        })
    }

    async regradeExam(examId) {
        return this.makeRequest(`/exams/${examId}/regrade-all`, {
            method: 'POST',
        })
    }

    async getExamGradingStatus(examId) {
        return this.makeRequest(`/exams/${examId}/grading-status`, {
            method: 'GET',
        })
    }

    async releaseExamResults(examId, releaseAll = true) {
        return this.makeRequest(`/exams/${examId}/release-results`, {
            method: 'POST',
            body: JSON.stringify({ releaseAll }),
        })
    }

    async retractExamResults(examId) {
        return this.makeRequest(`/exams/${examId}/retract-results`, {
            method: 'POST',
        })
    }

    async getExamStatistics(examId) {
        return this.makeRequest(`/exams/${examId}/statistics`)
    }

    async getExamResults(examId, params = {}) {
        const queryString = new URLSearchParams(params).toString()
        const endpoint = queryString ? `/exams/${examId}/results?${queryString}` : `/exams/${examId}/results`
        return this.makeRequest(endpoint)
    }

    async getExamResultDetails(resultId) {
        return this.makeRequest(`/exam-results/${resultId}`)
    }

    async getManualReviewPayload(examId, resultId) {
        return this.makeRequest(`/exams/${examId}/results/${resultId}/review`, {
            method: 'GET',
        })
    }

    async saveManualExamScores(examId, resultId, payload = {}) {
        return this.makeRequest(`/exams/${examId}/results/${resultId}/manual-score`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        })
    }

    async releaseSingleExamResult(examId, resultId) {
        return this.makeRequest(`/exams/${examId}/results/${resultId}/release`, {
            method: 'POST',
        })
    }

    async retractSingleExamResult(examId, resultId) {
        return this.makeRequest(`/exams/${examId}/results/${resultId}/retract`, {
            method: 'POST',
        })
    }

    async regradeUserExam(examId, userId) {
        return this.makeRequest(`/exams/${examId}/regrade-user`, {
            method: 'POST',
            body: JSON.stringify({ userId })
        })
    }

    async downloadExamResultPDF(resultId) {
        const url = `${this.baseURL}/exam-results/${resultId}/download-pdf`

        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        }

        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`
        }

        try {
            logger.info('Staff API request (PDF download):', {
                method: config.method,
                url,
                hasAuth: !!this.token,
            })

            const response = await fetch(url, config)

            if (!response.ok) {
                if (response.status === 401) {
                    // For PDF downloads, treat 401 as authentication required
                    this.handleTokenExpiration()
                    throw new Error('Authentication required for PDF download')
                }

                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
            }

            // Get the blob data
            const blob = await response.blob()

            // Validate blob size
            if (blob.size === 0) {
                throw new Error('PDF file is empty')
            }

            // Validate blob type
            if (!blob.type.includes('pdf')) {
                logger.warn('Unexpected blob type:', blob.type)
            }

            // Create a download link
            const downloadUrl = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = downloadUrl
            link.download = `exam-result-${resultId}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(downloadUrl)

            logger.info('PDF download successful:', {
                resultId,
                fileSize: blob.size,
                blobType: blob.type
            })

            return { success: true, message: 'PDF downloaded successfully' }
        } catch (error) {
            logger.error('PDF download failed:', {
                resultId,
                error: error.message
            })
            throw error
        }
    }

    async exportExamResultsPDF(examId, params = {}) {
        const queryString = new URLSearchParams(params).toString()
        const url = queryString ?
            `${this.baseURL}/exams/${examId}/export-results-pdf?${queryString}` :
            `${this.baseURL}/exams/${examId}/export-results-pdf`

        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        }

        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`
        }

        try {
            logger.info('Staff API request (Export Results PDF):', {
                method: config.method,
                url,
                hasAuth: !!this.token,
            })

            const response = await fetch(url, config)

            if (!response.ok) {
                if (response.status === 401) {
                    // For PDF exports, treat 401 as authentication required
                    this.handleTokenExpiration()
                    throw new Error('Authentication required for PDF export')
                }

                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
            }

            // Get the blob data
            const blob = await response.blob()

            // Validate blob size
            if (blob.size === 0) {
                throw new Error('Export file is empty')
            }

            // Validate blob type
            if (!blob.type.includes('pdf')) {
                logger.warn('Unexpected blob type:', blob.type)
            }

            // Create a download link
            const downloadUrl = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = downloadUrl
            link.download = `exam-results-${examId}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(downloadUrl)

            logger.info('Export PDF download successful:', {
                examId,
                fileSize: blob.size,
                blobType: blob.type
            })

            return { success: true, message: 'Export PDF downloaded successfully' }
        } catch (error) {
            logger.error('Export PDF download failed:', {
                examId,
                error: error.message
            })
            throw error
        }
    }

    async getJobStatus(queueName, jobId) {
        return this.makeRequest(`/exams/jobs/${queueName}/${jobId}`)
    }

    // Question Bank API methods
    async getQuestions(examId, params = {}) {
        const queryString = new URLSearchParams(params).toString()
        const endpoint = queryString ? `/exams/${examId}/questions/manage?${queryString}` : `/exams/${examId}/questions/manage`
        return this.makeRequest(endpoint)
    }

    async createQuestion(examId, questionData) {
        return this.makeRequest(`/exams/${examId}/questions`, {
            method: 'POST',
            body: JSON.stringify(questionData),
        })
    }

    async updateQuestion(questionId, questionData) {
        return this.makeRequest(`/questions/${questionId}`, {
            method: 'PUT',
            body: JSON.stringify(questionData),
        })
    }

    async deleteQuestion(questionId) {
        return this.makeRequest(`/questions/${questionId}`, {
            method: 'DELETE',
        })
    }

    async bulkImportQuestions(examId, file, format) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('examId', examId)
        formData.append('format', format)

        return this.makeRequest('/questions/bulk-import', {
            method: 'POST',
            body: formData,
            headers: {
                // Remove Content-Type to let browser set it with boundary for FormData
            }
        })
    }

    async bulkImportPreview(file, format) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('format', format)

        return this.makeRequest('/questions/bulk-import-preview', {
            method: 'POST',
            body: formData,
            headers: {
                // Remove Content-Type to let browser set it with boundary for FormData
            }
        })
    }

    async saveBulkImportQuestions(examId, questions) {
        return this.makeRequest('/questions/bulk-import-save', {
            method: 'POST',
            body: JSON.stringify({
                examId,
                questions
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        })
    }

    // User Management API methods
    async getUsers(params = {}) {
        const queryParams = new URLSearchParams()

        if (params.page) queryParams.append('page', params.page)
        if (params.limit) queryParams.append('limit', params.limit)
        if (params.role) queryParams.append('role', params.role)
        if (params.status) queryParams.append('status', params.status)
        if (params.search) queryParams.append('search', params.search)

        return this.makeRequest(`/staff/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`)
    }

    async getUser(id) {
        return this.makeRequest(`/staff/users/${id}`)
    }

    async getRoles() {
        return this.makeRequest('/staff/users/roles')
    }

    // Role Management Methods
    async createRole(roleData) {
        return this.post('/staff/roles', roleData)
    }

    async updateRole(id, roleData) {
        return this.put(`/staff/roles/${id}`, roleData)
    }

    async deleteRole(id) {
        return this.delete(`/staff/roles/${id}`)
    }

    async createUser(userData) {
        return this.makeRequest('/staff/users', {
            method: 'POST',
            body: JSON.stringify(userData),
        })
    }

    async createAdminUser(userData) {
        // Use unified endpoint - admin is just staff with admin role
        const unifiedData = {
            ...userData,
            type: 'admin'
        }
        return this.post('/staff/users', unifiedData)
    }

    async createStaffUser(staffData) {
        // Use unified endpoint - handles both admin and staff
        return this.post('/staff/users', staffData)
    }

    // Unified method for creating any staff member (admin or staff)
    async createUnifiedUser(userData) {
        return this.post('/staff/users', userData)
    }

    async updateUser(id, userData) {
        return this.put(`/staff/users/${id}`, userData)
    }

    async updateStaff(id, staffData) {
        return this.put(`/staff/users/${id}/staff`, staffData)
    }

    async updateUserStatus(id, isActive) {
        return this.put(`/staff/users/${id}/status`, { isActive })
    }

    async resetUserPassword(id) {
        return this.post(`/staff/users/${id}/reset-password`)
    }

    async deleteUser(id) {
        return this.delete(`/staff/users/${id}`)
    }

    // -------------------------------------------------------------------------
    // ID Card Generation
    // -------------------------------------------------------------------------

    async getIdCardProgramTypes() {
        return this.makeRequest('/staff/id-cards/filters/program-types')
    }

    async getIdCardProgramModes() {
        return this.makeRequest('/staff/id-cards/filters/program-modes')
    }

    async getIdCardPrograms(filters = {}) {
        const params = new URLSearchParams()
        if (filters.programTypeId) params.append('programTypeId', filters.programTypeId)
        if (filters.programModeId) params.append('programModeId', filters.programModeId)
        const qs = params.toString()
        return this.makeRequest(`/staff/id-cards/filters/programs${qs ? `?${qs}` : ''}`)
    }

    async getIdCardDepartments() {
        return this.makeRequest('/staff/id-cards/filters/departments')
    }

    async getIdCardStaffDepartments() {
        return this.makeRequest('/staff/id-cards/filters/staff-departments')
    }

    async getIdCardStudents(filters = {}) {
        const params = new URLSearchParams()
        if (filters.programId) params.append('programId', filters.programId)
        if (filters.level) params.append('level', String(filters.level))
        const qs = params.toString()
        return this.makeRequest(`/staff/id-cards/students${qs ? `?${qs}` : ''}`)
    }

    async getIdCardStaff(filters = {}) {
        const params = new URLSearchParams()
        if (filters.department) params.append('department', filters.department)
        const qs = params.toString()
        return this.makeRequest(`/staff/id-cards/staff${qs ? `?${qs}` : ''}`)
    }

    async getStudentCardPreviewData(studentId) {
        return this.makeRequest(`/staff/id-cards/student/${studentId}/preview-data`)
    }

    async getStaffCardPreviewData(staffId) {
        return this.makeRequest(`/staff/id-cards/staff/${staffId}/preview-data`)
    }

    async getIdCardGenerationLog(userId) {
        return this.makeRequest(`/staff/id-cards/log/${userId}`)
    }

    /**
     * Export an ID card (PNG or PDF). Returns a Blob and triggers a download.
     * @param {Object} params
     * @param {'student'|'staff'} params.entityType
     * @param {string} params.entityId
     * @param {'front'|'back'} params.side
     * @param {'png'|'pdf'} params.format
     * @param {string} params.dateOfIssue  - ISO date string
     * @param {string} [params.validUntil] - ISO date string (student only)
     * @param {string} [params.dateOfBirth] - ISO date string (staff only)
     * @param {string} [params.overridePhotoDataUrl] - data: URL for custom photo
     * @param {string} [params.filenamePrefix] - prefix for downloaded filename
     */
    async exportIdCard(params) {
        const {
            entityType, entityId, side, format,
            dateOfIssue, validUntil, dateOfBirth,
            overridePhotoDataUrl, filenamePrefix,
        } = params

        const url = `${this.baseURL}/staff/id-cards/export`
        const config = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entityType, entityId, side, format,
                dateOfIssue, validUntil, dateOfBirth, overridePhotoDataUrl,
            }),
        }
        if (this.token) config.headers.Authorization = `Bearer ${this.token}`

        logger.info('ID card export request:', { entityType, entityId, side, format })

        const response = await fetch(url, config)
        if (!response.ok) {
            if (response.status === 401) {
                this.handleTokenExpiration()
                throw new Error('Authentication required for ID card export')
            }
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
        }

        const blob = await response.blob()
        if (blob.size === 0) throw new Error('Generated ID card file is empty')

        const prefix = filenamePrefix || entityId
        const ext = format === 'pdf' ? 'pdf' : 'png'
        const fileName = format === 'pdf'
            ? `${prefix}-id-card.pdf`
            : `${prefix}-id-card-${side}.png`

        const downloadUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(downloadUrl)

        logger.info('ID card download successful:', { fileName, size: blob.size })
        return { success: true, message: 'ID card downloaded successfully' }
    }
}

export const apiService = new StaffApiService()