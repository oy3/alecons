import { reactive } from 'vue'
import { apiService } from '../services/api.js'
import { logger } from '@shared/utils/logger'

export const authStore = reactive({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  async initialize() {
    this.isLoading = true
    try {
      const token = localStorage.getItem('cbt_auth_token')
      if (token) {
        this.token = token
        // Verify token with backend
        const response = await apiService.verifyToken()
        if (response.success) {
          this.user = response.data.user
          this.isAuthenticated = true
        } else {
          this.logout()
        }
      }
    } catch (error) {
      logger.error('Auth initialization error:', error)
      this.logout()
    } finally {
      this.isLoading = false
    }
  },

  async login(email, password, userType = 'student') {
    try {
      this.isLoading = true
      const response = await apiService.login({ email, password, userType })
      
      // Backend returns direct object: { access_token, user, application, applicationId }
      if (response.access_token && response.user) {
        this.token = response.access_token
        this.user = response.user
        this.isAuthenticated = true
        localStorage.setItem('cbt_auth_token', this.token)
        return { success: true }
      } else {
        return { success: false, message: 'Invalid response format from server' }
      }
    } catch (error) {
      logger.error('Login error:', error)
      return { success: false, message: 'Login failed. Please try again.' }
    } finally {
      this.isLoading = false
    }
  },

  logout() {
    this.user = null
    this.token = null
    this.isAuthenticated = false
    localStorage.removeItem('cbt_auth_token')
    window.location.href = '/cbt/login'
  },

  hasRole(role) {
    return this.user?.role === role
  },

  hasAnyRole(roles) {
    return roles.includes(this.user?.role)
  },

  hasPermission(permission) {
    return this.user?.permissions?.includes(permission)
  },

  hasAnyPermission(permissions) {
    return permissions.some(permission => this.hasPermission(permission))
  },

  get userRole() {
    return this.user?.role
  },

  get userName() {
    return this.user ? `${this.user.firstName} ${this.user.lastName}` : ''
  }
})