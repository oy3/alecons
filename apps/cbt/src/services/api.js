import axios from 'axios'
import { authStore } from '../stores/auth.js'
import { Environment } from '../utils/environment.js'
import { logger } from '@shared/utils/logger'

// Create axios instance with base configuration
const apiBaseUrl = Environment.getApiBaseUrl() || 'http://localhost:8000/api/v1'
const apiClient = axios.create({
    baseURL: apiBaseUrl,
    timeout: Environment.isProduction() ? 60000 : 30000, // Longer timeout for production
    headers: {
        'Content-Type': 'application/json'
    }
})

// Debug logging (only in development/staging)
logger.info('Environment Variables Debug:', {
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    VITE_APP_DEBUG: import.meta.env.VITE_APP_DEBUG,
    MODE: import.meta.env.MODE
})

if (Environment.isDebugMode()) {
    logger.info('CBT API Configuration:', Environment.getInfo())
    logger.info('Axios Instance Configuration:', {
        baseURL: apiClient.defaults.baseURL,
        timeout: apiClient.defaults.timeout
    })
}

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    (config) => {
        const token = authStore.token || localStorage.getItem('cbt_auth_token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Response interceptor to handle auth errors
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            authStore.logout()
        }
        return Promise.reject(error)
    }
)

export const apiService = {
    // Authentication
    async login(credentials) {
        try {
            if (Environment.isDebugMode()) {
                logger.info('CBT login attempt:', {
                    email: credentials.email,
                    userType: credentials.userType,
                    environment: Environment.current()
                })
            }

            // Only send email and password to API (userType not expected by backend)
            const loginPayload = {
                email: credentials.email,
                password: credentials.password
            }

            const response = await apiClient.post('/auth/login', loginPayload)

            if (Environment.isDebugMode()) {
                logger.success('CBT login successful:', { email: credentials.email })
            }

            return response.data
        } catch (error) {
            // Enhanced error logging with environment context
            const errorDetails = {
                email: credentials.email,
                error: error.message,
                environment: Environment.current(),
                apiUrl: Environment.getApiBaseUrl()
            }

            // Add detailed error info only in development/staging
            if (!Environment.isProduction()) {
                errorDetails.status = error.response?.status
                errorDetails.statusText = error.response?.statusText
                errorDetails.url = error.config?.url
                errorDetails.fullError = error.response?.data
            }

            logger.error('CBT login failed:', errorDetails)
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed'
            }
        }
    },

    async verifyToken() {
        try {
            const response = await apiClient.get('/auth/profile')
            return response.data
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Token verification failed'
            }
        }
    },

    // Exam management
    async getAvailableExams() {
        try {
            const response = await apiClient.get('/exams/available')
            // Backend returns direct array, wrap it for frontend consistency
            return {
                success: true,
                data: response.data
            }
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to fetch available exams'
            }
        }
    },

    async getExamDetails(examId) {
        try {
            const response = await apiClient.get(`/exams/${examId}`)
            return response.data
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to fetch exam details'
            }
        }
    },

    async startExam(examId, password) {
        try {
            const response = await apiClient.post(`/exams/${examId}/start`, { password })
            return response.data
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to start exam'
            }
        }
    },

    async getExamQuestions(examId, attemptId) {
        try {
            const response = await apiClient.get(`/exams/${examId}/questions?attemptId=${attemptId}`)
            return response.data
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to fetch exam questions'
            }
        }
    },

    // Exam attempts
    async saveAnswers(examId, attemptId, answers) {
        try {
            const response = await apiClient.post(`/exams/${examId}/attempts/${attemptId}/save`, {
                answers,
                timestamp: new Date()
            })
            return response.data
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to save answers'
            }
        }
    },

    async submitExam(examId, attemptId, finalAnswers, securityViolations = []) {
        try {
            const response = await apiClient.post(`/exams/${examId}/attempts/${attemptId}/submit`, {
                answers: finalAnswers,
                securityViolations,
                submittedAt: new Date()
            })
            return response.data
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to submit exam'
            }
        }
    },

    async getAttemptDetails(examId, attemptId) {
        try {
            const response = await apiClient.get(`/exams/${examId}/attempts/${attemptId}`)
            return response.data
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to fetch attempt details'
            }
        }
    },

    // Results
    async getExamResults(examId) {
        try {
            const response = await apiClient.get(`/exams/${examId}/results`)
            return response.data
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to fetch exam results'
            }
        }
    },

    async getUserExamHistory() {
        try {
            const response = await apiClient.get('/exams/history')
            return response.data
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to fetch exam history'
            }
        }
    },

    // Security monitoring
    async reportSecurityViolation(examId, attemptId, violation) {
        try {
            const response = await apiClient.post(`/exams/${examId}/attempts/${attemptId}/security-violation`, violation)
            return response.data
        } catch (error) {
            console.error('Failed to report security violation:', error)
            return { success: false }
        }
    },

    // Heartbeat for exam monitoring
    async sendHeartbeat(examId, attemptId) {
        try {
            const response = await apiClient.post(`/exams/${examId}/attempts/${attemptId}/heartbeat`, {
                timestamp: new Date(),
                userAgent: navigator.userAgent,
                screenResolution: `${screen.width}x${screen.height}`
            })
            return response.data
        } catch (error) {
            console.error('Heartbeat failed:', error)
            return { success: false }
        }
    }
}