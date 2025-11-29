import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiService } from '../services/api.js';
import { logger } from '@shared/utils/logger';

export const useAuthStore = defineStore('auth', () => {
    // State
    const user = ref(null);
    const application = ref(null);
    const token = ref(null);
    const isLoading = ref(false);
    const isInitialized = ref(false);
    const isLoggingOut = ref(false); // Flag to handle logout navigation

    // Getters
    const isAuthenticated = computed(() => !!user.value && !!token.value);
    const userName = computed(() => {
        if (!user.value) return '';
        return `${user.value.firstName} ${user.value.lastName}`.trim();
    });
    const userFirstName = computed(() => user.value.firstName || 'n/a');
    const userEmail = computed(() => user.value?.email || '');
    const isStudent = computed(() => user.value?.role === 'student');

    // Actions
    async function initialize() {
        if (isInitialized.value) {
            return;
        }

        try {
            isLoading.value = true;

            // Get token from localStorage
            const storedToken = localStorage.getItem('student_token');

            if (!storedToken) {
                isInitialized.value = true;
                return;
            }

            // Set token and fetch fresh user data
            token.value = storedToken;
            await fetchUserData();

        } catch (error) {
            logger.error('Failed to initialize auth store:', error.message);
            // If initialization fails, clear everything
            await logout();
        } finally {
            isLoading.value = false;
            isInitialized.value = true;
        }
    }

    async function login(credentials) {
        try {
            isLoading.value = true;

            const response = await apiService.login(credentials);

            // Handle both wrapped (success/data) and unwrapped responses
            const loginData = response.success ? response.data : response;

            if (response.success || loginData.access_token) {
                // Validate user role - only students can access student portal
                const userRole = loginData.user?.role;
                if (userRole !== 'student') {
                    const errorMsg = `Access denied. This portal is for students only. Your role: ${userRole}`;
                    return { success: false, error: errorMsg };
                }

                // Set token
                const accessToken = loginData.access_token;
                token.value = accessToken;
                localStorage.setItem('student_token', accessToken);

                // Set user data
                user.value = loginData.user;
                application.value = loginData.application || null;

                return { success: true };
            } else {
                const errorMsg = response.error || response.message || 'Login failed';
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            logger.error('Login error:', error.message);
            return { success: false, error: error.message || 'Login failed' };
        } finally {
            isLoading.value = false;
        }
    }

    async function fetchUserData() {
        try {
            if (!token.value) {
                throw new Error('No authentication token available');
            }

            // Get current user profile
            const profileResponse = await apiService.getProfile();

            if (profileResponse.success) {
                user.value = profileResponse.data.user;
                application.value = profileResponse.data.application || null;
            } else {
                const errorMsg = profileResponse.error || 'Failed to fetch user data';
                throw new Error(errorMsg);
            }
        } catch (error) {
            logger.error('Failed to fetch user data:', error.message);

            // If we can't fetch user data with a valid token, it's likely expired
            if (error.message.includes('Authentication') || error.message.includes('Unauthorized')) {
                await logout();
                throw new Error('Session expired. Please login again.');
            }

            throw error;
        }
    }

    async function refreshUserData() {
        try {
            await fetchUserData();
            return { success: true };
        } catch (error) {
            logger.error('Failed to refresh user data:', error.message);
            return { success: false, error: error.message };
        }
    }

    async function logout() {
        try {
            isLoggingOut.value = true;

            // Clear state
            user.value = null;
            application.value = null;
            token.value = null;

            // Clear localStorage
            localStorage.removeItem('student_token');

            // Wait a tick for reactivity to update
            await new Promise(resolve => setTimeout(resolve, 10));

        } catch (error) {
            logger.error('Error during logout:', error.message);
        } finally {
            // Keep the logging out flag until navigation completes
            // It will be cleared in the component after navigation
        }
    }

    // Helper to complete logout navigation
    function completeLogout() {
        isLoggingOut.value = false;
    }


    // Helper to handle authentication errors from API calls
    function handleAuthError() {
        logout();
    }

    return {
        // State
        user,
        application,
        token,
        isLoading,
        isInitialized,
        isLoggingOut,

        // Getters
        isAuthenticated,
        userName,
        userFirstName,
        userEmail,
        isStudent,

        // Actions
        initialize,
        login,
        logout,
        completeLogout,
        fetchUserData,
        refreshUserData,
        handleAuthError
    };
});