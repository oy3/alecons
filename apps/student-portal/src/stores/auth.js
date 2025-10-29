import { defineStore } from 'pinia'
import { apiService } from '../services/api.js'

export const authStore = defineStore('auth', {
    state: () => ({
        user: null,
        token: localStorage.getItem('student_token'),
        loading: false,
        error: null
    }),

    getters: {
        isAuthenticated: (state) => !!state.token && !!state.user,
        userName: (state) => {
            if (!state.user) return ''
            return `${state.user.firstName} ${state.user.lastName}`.trim()
        },
        userEmail: (state) => state.user?.email || '',
        isStudent: (state) => state.user?.role === 'student',
        isActive: (state) => state.user?.isActive === true
    },

    actions: {
        async login(credentials) {
            this.loading = true
            this.error = null

            try {
                console.log('Attempting login with:', { email: credentials.email })

                const response = await apiService.login(credentials)
                console.log('Login response:', response)

                if (response.success) {
                    // Verify user is a student and active
                    if (response.user.role !== 'student') {
                        throw new Error('Access denied. This portal is for students only.')
                    }

                    if (!response.user.isActive) {
                        throw new Error('Your account is not active. Please contact support.')
                    }

                    this.token = response.token
                    this.user = response.user

                    // Store token in localStorage
                    localStorage.setItem('student_token', response.token)

                    console.log('Login successful, user:', this.user)
                    return { success: true }
                } else {
                    throw new Error(response.message || 'Login failed')
                }
            } catch (error) {
                console.error('Login error:', error)
                this.error = error.message || 'Login failed. Please try again.'
                return { success: false, message: this.error }
            } finally {
                this.loading = false
            }
        },

        async loadUserProfile() {
            if (!this.token) return

            try {
                const response = await apiService.getProfile()
                if (response.success) {
                    // Verify user is still a student and active
                    if (response.data.role !== 'student' || !response.data.isActive) {
                        this.logout()
                        return
                    }

                    this.user = response.data
                } else {
                    this.logout()
                }
            } catch (error) {
                console.error('Failed to load user profile:', error)
                this.logout()
            }
        },

        logout() {
            this.user = null
            this.token = null
            this.error = null

            // Remove token from localStorage
            localStorage.removeItem('student_token')

            // Redirect to login
            window.location.href = '/login'
        },

        clearError() {
            this.error = null
        },

        // Initialize store on app load
        async initialize() {
            if (this.token) {
                await this.loadUserProfile()
            }
        }
    }
})