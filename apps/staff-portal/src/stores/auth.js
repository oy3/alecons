import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '../services/api.js'
import { logger } from '@shared/utils/logger'

export const useAuthStore = defineStore('auth', () => {
    // State
    const user = ref(null)
    const token = ref(null)
    const isLoading = ref(false)
    const isInitialized = ref(false)
    const isLoggingOut = ref(false)

    // Getters
    const isAuthenticated = computed(() => !!user.value && !!token.value)
    const userRole = computed(() => user.value?.role || null)
    const userPermissions = computed(() => user.value?.permissions || [])
    const isAdmin = computed(() => userRole.value === 'admin')
    const isStaff = computed(() => ['admin', 'staff', 'manager'].includes(userRole.value))

    const userModules = computed(() => user.value?.modules || [])

    // Check if user has access to a module at all (used by sidebar, router guard)
    const hasModuleAccess = computed(() => (moduleName) => {
        if (!user.value) return false
        if (isAdmin.value) return true
        return userModules.value.includes(moduleName)
    })

    // Check a specific action within a module, e.g. hasPermission('applications', 'approve')
    // manage on a module implies all actions on that module
    const hasPermission = computed(() => (module, action) => {
        if (!user.value) return false
        if (isAdmin.value) return true
        const permissions = userPermissions.value
        if (permissions.includes(`${module}:manage`)) return true
        return permissions.includes(`${module}:${action}`)
    })

    // Actions
    async function initialize() {
        if (isInitialized.value) {
            logger.info('Auth store already initialized, skipping')
            return
        }

        try {
            isLoading.value = true
            logger.info('Initializing staff portal auth store...')

            const storedToken = localStorage.getItem('staffAuthToken')

            if (!storedToken) {
                logger.info('No staff token found, user not authenticated')
                isInitialized.value = true
                return
            }

            token.value = storedToken
            apiService.setToken(storedToken)

            await fetchUserData()

            logger.info('Staff auth store initialized successfully', {
                userId: user.value?.id,
                role: user.value?.role,
                permissions: user.value?.permissions
            })
        } catch (error) {
            logger.error('Failed to initialize staff auth store:', error)
            await logout()
        } finally {
            isLoading.value = false
            isInitialized.value = true
        }
    }

    async function login(credentials) {
        try {
            isLoading.value = true
            logger.info('Attempting staff login:', { email: credentials.email })

            const response = await apiService.staffLogin(credentials)

            if (response.success) {
                const { access_token, user: userData } = response.data

                // Validate user role
                if (!['admin', 'staff', 'manager'].includes(userData.role)) {
                    throw new Error('Access denied: Invalid role for staff portal')
                }

                token.value = access_token
                user.value = userData

                localStorage.setItem('staffAuthToken', access_token)
                apiService.setToken(access_token)

                logger.info('Staff login successful:', {
                    userId: userData.id,
                    role: userData.role,
                    permissions: userData.permissions
                })

                return { success: true }
            } else {
                throw new Error(response.error || 'Login failed')
            }
        } catch (error) {
            logger.error('Staff login failed:', error)
            return { success: false, error: error.message }
        } finally {
            isLoading.value = false
        }
    }

    async function fetchUserData() {
        try {
            if (!token.value) {
                throw new Error('No authentication token available')
            }

            const response = await apiService.getStaffProfile()

            if (response.success) {
                user.value = response.data.user

                // Validate staff role
                if (!['admin', 'staff', 'manager'].includes(user.value.role)) {
                    throw new Error('Access denied: Invalid role for staff portal')
                }

                logger.info('Staff user data refreshed:', {
                    userId: user.value.id,
                    role: user.value.role,
                    permissions: user.value.permissions
                })
            } else {
                throw new Error(response.error || 'Failed to fetch user data')
            }
        } catch (error) {
            logger.error('Failed to fetch staff user data:', error)
            if (error.message.includes('token') || error.message.includes('unauthorized')) {
                await logout()
                throw new Error('Session expired. Please login again.')
            }
            throw error
        }
    }

    async function refreshUserData() {
        try {
            logger.info('Refreshing staff user data...')
            await fetchUserData()
            return { success: true }
        } catch (error) {
            logger.error('Failed to refresh staff user data:', error)
            return { success: false, error: error.message }
        }
    }

    async function logout() {
        try {
            logger.info('Logging out staff user...')
            isLoggingOut.value = true

            // Clear state
            user.value = null
            token.value = null

            // Clear localStorage
            localStorage.removeItem('staffAuthToken')

            // Clear API service token
            apiService.setToken(null)

            logger.info('Staff user logged out successfully')
        } catch (error) {
            logger.error('Error during staff logout:', error)
        } finally {
            // Keep logging out flag until navigation completes
        }
    }

    function completeLogout() {
        isLoggingOut.value = false
    }

    async function changePassword(currentPassword, newPassword) {
        try {
            isLoading.value = true

            const response = await apiService.changeStaffPassword({
                currentPassword,
                newPassword
            })

            if (response.success) {
                logger.info('Staff password changed successfully')
                return { success: true }
            } else {
                throw new Error(response.error || 'Failed to change password')
            }
        } catch (error) {
            logger.error('Failed to change staff password:', error)
            return { success: false, error: error.message }
        } finally {
            isLoading.value = false
        }
    }

    function handleAuthError() {
        logger.warn('Staff authentication error detected, logging out...')
        logout()
    }

    return {
        // State
        user,
        token,
        isLoading,
        isInitialized,
        isLoggingOut,

        // Getters
        isAuthenticated,
        userRole,
        userPermissions,
        userModules,
        isAdmin,
        isStaff,
        hasModuleAccess,
        hasPermission,

        // Actions
        initialize,
        login,
        logout,
        completeLogout,
        fetchUserData,
        refreshUserData,
        changePassword,
        handleAuthError
    }
})