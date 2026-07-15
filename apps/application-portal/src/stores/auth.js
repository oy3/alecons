import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiService } from '../services/api.js';
import { logger } from '@shared/utils/logger';

export const useAuthStore = defineStore('auth', () => {
    // State
    const user = ref(null);
    const applications = ref([]);
    const token = ref(null);
    const isLoading = ref(false);
    const isInitialized = ref(false);
    const isLoggingOut = ref(false); // Flag to handle logout navigation

    // Getters
    const isAuthenticated = computed(() => !!user.value && !!token.value);
    // Note: isApplicant allows both 'applicant' and 'student' roles to access the application portal
    const isApplicant = computed(() => user.value?.role === 'applicant' || user.value?.role === 'student');

    // Actions
    async function initialize() {
        if (isInitialized.value) {
            logger.info('Auth store already initialized, skipping');
            return;
        }

        try {
            isLoading.value = true;
            logger.info('Initializing auth store...');

            // Get token from localStorage
            const storedToken = localStorage.getItem('authToken');
            logger.info('Stored token check:', {
                hasToken: !!storedToken,
                tokenLength: storedToken?.length
            });

            if (!storedToken) {
                logger.info('No token found, user not authenticated');
                isInitialized.value = true;
                return;
            }

            // Set token and fetch fresh user data
            token.value = storedToken;
            apiService.setToken(storedToken);
            logger.info('Token set in API service:', {
                tokenSet: !!apiService.token,
                tokensMatch: storedToken === apiService.token
            });
            logger.info('Token set, attempting to fetch user data...');

            await fetchUserData();

            logger.info('Auth store initialized successfully', {
                userId: user.value?.id,
                email: user.value?.email,
                isAuthenticated: isAuthenticated.value
            });
        } catch (error) {
            logger.error('Failed to initialize auth store:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            // If initialization fails, clear everything
            logger.warn('Initialization failed, clearing auth state');
            await logout();
        } finally {
            isLoading.value = false;
            isInitialized.value = true;
            logger.info('Auth store initialization complete');
        }
    }

    async function login(credentials) {
        try {
            isLoading.value = true;
            logger.info('Attempting login:', { email: credentials.email });

            const response = await apiService.login(credentials);
            logger.info('Login API response:', {
                success: response.success,
                hasData: !!response.data,
                hasToken: !!(response.data?.access_token || response.access_token),
                hasUser: !!(response.data?.user || response.user)
            });

            // Handle both wrapped (success/data) and unwrapped responses
            const loginData = response.success ? response.data : response;

            if (response.success || loginData.access_token) {
                // Validate user role - only applicants and students can access application portal
                const userRole = loginData.user?.role;
                if (userRole !== 'applicant' && userRole !== 'student') {
                    const errorMsg = `Access denied. This portal is for applicants and students only. Your role: ${userRole}`;
                    logger.warn('Role access denied:', { userRole, allowedRoles: ['applicant', 'student'] });
                    return { success: false, error: errorMsg };
                }

                // Set token
                const accessToken = loginData.access_token;
                token.value = accessToken;
                localStorage.setItem('authToken', accessToken);

                // Set user data
                user.value = loginData.user;
                applications.value = loginData.applications || [];

                logger.info('Login successful:', {
                    userId: user.value.id,
                    email: user.value.email,
                    applicationCount: applications.value.length,
                });

                return { success: true };
            } else {
                const errorMsg = response.error || response.message || 'Login failed';
                logger.warn('Login failed:', errorMsg);
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            logger.error('Login error:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            return { success: false, error: error.message || 'Login failed' };
        } finally {
            isLoading.value = false;
        }
    }

    async function register(userData) {
        try {
            isLoading.value = true;
            logger.info('Attempting registration:', { email: userData.email });

            const response = await apiService.register(userData);

            if (response.success) {
                // Set token
                token.value = response.data.access_token;
                localStorage.setItem('authToken', response.data.access_token);

                // Set user data
                user.value = response.data.user;
                applications.value = response.data.applications || (response.data.application ? [response.data.application] : []);

                logger.info('Registration successful:', {
                    userId: user.value.id,
                    email: user.value.email,
                });

                return { success: true };
            } else {
                logger.warn('Registration failed:', response.error);
                return { success: false, error: response.error };
            }
        } catch (error) {
            logger.error('Registration error:', error);
            return { success: false, error: error.message || 'Registration failed' };
        } finally {
            isLoading.value = false;
        }
    }

    async function fetchUserData() {
        try {
            logger.info('Fetching fresh user data...');

            if (!token.value) {
                throw new Error('No authentication token available');
            }

            // Get current user profile
            const profileResponse = await apiService.getProfile();
            logger.info('Profile API response:', {
                success: profileResponse.success,
                hasData: !!profileResponse.data,
                hasUser: !!(profileResponse.data?.user || profileResponse.user)
            });

            if (profileResponse.success) {
                user.value = profileResponse.data.user;
                applications.value = profileResponse.data.applications || [];

                logger.info('User data refreshed:', {
                    userId: user.value.id,
                    email: user.value.email,
                    applicationCount: applications.value.length,
                });
            } else {
                const errorMsg = profileResponse.error || 'Failed to fetch user data';
                throw new Error(errorMsg);
            }
        } catch (error) {
            logger.error('Failed to fetch user data:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });

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
            logger.info('Refreshing user data...');
            await fetchUserData();
            return { success: true };
        } catch (error) {
            logger.error('Failed to refresh user data:', error);
            return { success: false, error: error.message };
        }
    }

    // Force immediate refresh without debouncing (for manual triggers)
    async function forceRefreshUserData() {
        try {
            logger.info('Force refreshing user data (no debouncing)...');
            await fetchUserData();
            return { success: true };
        } catch (error) {
            logger.error('Failed to force refresh user data:', error);
            return { success: false, error: error.message };
        }
    }

    async function logout() {
        try {
            logger.info('Logging out user...');
            isLoggingOut.value = true;

            // Clear state
            user.value = null;
            applications.value = [];
            token.value = null;

            // Clear localStorage
            localStorage.removeItem('authToken');

            // Clear API service token
            apiService.setToken(null);

            // Wait a tick for reactivity to update
            await new Promise(resolve => setTimeout(resolve, 10));

            logger.info('User logged out successfully');
        } catch (error) {
            logger.error('Error during logout:', error);
        } finally {
            // Keep the logging out flag until navigation completes
            // It will be cleared in the component after navigation
        }
    }

    // Helper to complete logout navigation
    function completeLogout() {
        isLoggingOut.value = false;
    }
    function getApplicationFromList(id) {
        return applications.value.find(a => a.id === id || a.id?.toString() === id) || null;
    }

    // Helper to handle authentication errors from API calls
    function handleAuthError() {
        logger.warn('Authentication error detected, logging out...');
        logout();
    }

    return {
        // State
        user,
        applications,
        token,
        isLoading,
        isInitialized,
        isLoggingOut,

        // Getters
        isAuthenticated,
        isApplicant,

        // Actions
        initialize,
        login,
        register,
        logout,
        completeLogout,
        fetchUserData,
        refreshUserData,
        forceRefreshUserData,
        getApplicationFromList,
        handleAuthError
    };
});
