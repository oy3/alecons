import { ref, computed } from 'vue';
import { logger } from '@shared/utils/logger';

// Global reactive state for authentication
const user = ref(null);
const token = ref(null);
const application = ref(null);

class AuthManager {
    constructor() {
        // Initialize from localStorage on app start
        this.initializeFromStorage();
    }

    // Initialize auth state from localStorage
    initializeFromStorage() {
        try {
            const storedUser = localStorage.getItem('user');
            const storedToken = localStorage.getItem('authToken');
            const storedApplication = localStorage.getItem('application');

            if (storedUser && storedToken) {
                user.value = JSON.parse(storedUser);
                token.value = storedToken;
                if (storedApplication) {
                    application.value = JSON.parse(storedApplication);
                }

                logger.info('Auth state restored from localStorage:', {
                    userId: user.value?.id,
                    email: user.value?.email,
                    hasToken: !!token.value,
                    applicationNumber: application.value?.applicationNumber
                });
            }
        } catch (error) {
            logger.error('Error restoring auth state:', error);
            this.clearAuth();
        }
    }

    // Set user session after login/registration
    setAuth(userData, authToken, applicationData = null) {
        user.value = userData;
        token.value = authToken;
        application.value = applicationData;

        // Persist to localStorage
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('authToken', authToken);
        if (applicationData) {
            localStorage.setItem('application', JSON.stringify(applicationData));
        }

        logger.info('User authenticated:', {
            userId: userData.id,
            email: userData.email,
            role: userData.role,
            applicationNumber: applicationData?.applicationNumber
        });
    }    // Clear authentication
    clearAuth() {
        user.value = null;
        token.value = null;
        application.value = null;

        // Clear localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        localStorage.removeItem('application');

        logger.info('User logged out - auth cleared');
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!user.value && !!token.value;
    }

    // Check if current user is an applicant or student (both can access application portal)
    isApplicant() {
        return user.value?.role === 'applicant' || user.value?.role === 'student';
    }

    // Get current user
    getCurrentUser() {
        return user.value;
    }

    // Get auth token
    getToken() {
        return token.value;
    }

    // Get application data
    getApplication() {
        return application.value;
    }

    // Check if token is expired (basic check)
    isTokenExpired() {
        if (!token.value) return true;

        try {
            // Decode JWT token to check expiration
            const payload = JSON.parse(atob(token.value.split('.')[1]));
            const currentTime = Date.now() / 1000;

            if (payload.exp && payload.exp < currentTime) {
                logger.warn('Token expired, clearing auth');
                this.clearAuth();
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Error checking token expiration:', error);
            this.clearAuth();
            return true;
        }
    }

    // Validate current session
    validateSession() {
        if (!this.isAuthenticated() || this.isTokenExpired()) {
            this.clearAuth();
            return false;
        }
        return true;
    }
}

// Create singleton instance
const authManager = new AuthManager();

// Export reactive computed properties for components
export const useAuth = () => {
    return {
        user: computed(() => user.value),
        token: computed(() => token.value),
        application: computed(() => application.value),
        isAuthenticated: computed(() => authManager.isAuthenticated()),
        isApplicant: computed(() => authManager.isApplicant()),
    };
};

// Export auth manager methods
export { authManager };
