import axios from 'axios'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
})

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('student_token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Response interceptor to handle errors
api.interceptors.response.use(
    (response) => {
        return response
    },
    (error) => {
        console.error('API Error:', error)

        // Handle 401 errors (unauthorized)
        if (error.response?.status === 401) {
            localStorage.removeItem('student_token')
            window.location.href = '/login'
        }

        return Promise.reject(error)
    }
)

export const apiService = {
    // Authentication
    async login(credentials) {
        try {
            console.log('Making login request to:', `${API_BASE_URL}/auth/login`)

            const response = await api.post('/auth/login', credentials)
            console.log('Login API response:', response.data)

            return {
                success: true,
                token: response.data.token,
                user: response.data.user,
                message: 'Login successful'
            }
        } catch (error) {
            console.error('Login API error:', error)

            const message = error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                'Login failed'

            return {
                success: false,
                message: message
            }
        }
    },

    async getProfile() {
        try {
            const response = await api.get('/auth/profile')
            return {
                success: true,
                data: response.data
            }
        } catch (error) {
            console.error('Get profile error:', error)
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to load profile'
            }
        }
    },

    // Student-specific endpoints
    async getDashboardStats() {
        try {
            const response = await api.get('/student/dashboard/stats')
            return {
                success: true,
                data: response.data
            }
        } catch (error) {
            console.error('Get dashboard stats error:', error)
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to load dashboard stats',
                data: {
                    totalCourses: 0,
                    activeCourses: 0,
                    completedAssignments: 0,
                    pendingAssignments: 0,
                    upcomingExams: 0,
                    averageGrade: 0
                }
            }
        }
    },

    async getCourses() {
        try {
            const response = await api.get('/student/courses')
            return {
                success: true,
                data: response.data || []
            }
        } catch (error) {
            console.error('Get courses error:', error)
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to load courses',
                data: []
            }
        }
    },

    async getAssignments() {
        try {
            const response = await api.get('/student/assignments')
            return {
                success: true,
                data: response.data || []
            }
        } catch (error) {
            console.error('Get assignments error:', error)
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to load assignments',
                data: []
            }
        }
    },

    async getExams() {
        try {
            const response = await api.get('/student/exams')
            return {
                success: true,
                data: response.data || []
            }
        } catch (error) {
            console.error('Get exams error:', error)
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to load exams',
                data: []
            }
        }
    },

    async getGrades() {
        try {
            const response = await api.get('/student/grades')
            return {
                success: true,
                data: response.data || []
            }
        } catch (error) {
            console.error('Get grades error:', error)
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to load grades',
                data: []
            }
        }
    }
}