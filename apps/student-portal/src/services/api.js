/**
 * Alecons Student Portal
 * Handles all backend API calls
 */

import { logger } from '@shared/utils/logger';

const API_BASE_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:8000/api/v1';

class ApiService {
    constructor() {
        this.baseURL = API_BASE_URL;
    }

    // Get current token dynamically from localStorage
    get token() {
        return localStorage.getItem('student_token');
    }

    // Set authorization token
    setToken(token) {
        if (token) {
            localStorage.setItem('student_token', token);
        } else {
            localStorage.removeItem('student_token');
        }
    }

    // Get authorization headers
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
            logger.debug('Authorization header set:', {
                hasToken: !!this.token,
                tokenPreview: this.token?.substring(0, 20) + '...'
            });
        } else {
            logger.warn('No token available for authorization header');
        }

        return headers;
    }

    // Generic API call method
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;

        // Handle FormData differently - don't set Content-Type header
        let headers;
        if (options.body instanceof FormData) {
            headers = {};
            if (this.token) {
                headers.Authorization = `Bearer ${this.token}`;
            }
        } else {
            headers = this.getHeaders();
        }

        const config = {
            headers,
            ...options,
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            // Handle authentication errors
            if (response.status === 401) {
                // Check if this is a login attempt with wrong credentials
                if (endpoint === '/auth/login') {
                    // This is wrong login credentials, not token expiration
                    throw new Error(data.message || 'Invalid email or password');
                }
                // Check if this is a token expiration or just wrong credentials
                else if (endpoint === '/auth/change-password' && data.message &&
                    (data.message.includes('Current password is incorrect') ||
                        data.message.includes('incorrect'))) {
                    // This is just wrong current password, don't logout
                    throw new Error(data.message || 'Current password is incorrect');
                } else {
                    // This is likely token expiration, handle logout
                    this.handleTokenExpiration();
                    throw new Error('Authentication required');
                }
            }

            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }

            // If the backend already returns a success/data structure, return it as-is
            if (data.success !== undefined) {
                logger.debug('Backend returned success/data structure:', data);
                return data;
            }

            // Otherwise wrap it in our standard format
            const wrappedResult = { success: true, data };
            logger.debug('Wrapped result:', wrappedResult);
            return wrappedResult;
        } catch (error) {
            logger.error('API Error:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                url: url,
                method: config.method || 'GET'
            });

            // Handle network errors or other issues
            if (error.message === 'Authentication required') {
                return {
                    success: false,
                    error: 'Session expired. Please login again.',
                    requiresAuth: true
                };
            }

            return {
                success: false,
                error: error.message || 'Network error occurred'
            };
        }
    }

    // HTTP method helpers
    async get(endpoint) {
        return this.makeRequest(endpoint, { method: 'GET' });
    }

    async post(endpoint, data = {}, customOptions = {}) {
        const options = {
            method: 'POST',
            body: JSON.stringify(data),
            ...customOptions
        };

        // If custom headers are provided, merge them but don't override Content-Type for FormData
        if (customOptions.headers) {
            // For FormData uploads, don't set Content-Type (let browser set it)
            if (data instanceof FormData) {
                delete options.headers; // Let browser set proper Content-Type with boundary
                options.body = data; // Don't JSON.stringify FormData
            } else {
                options.headers = { ...this.getHeaders(), ...customOptions.headers };
            }
        }

        return this.makeRequest(endpoint, options);
    }

    async put(endpoint, data = {}) {
        return this.makeRequest(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async patch(endpoint, data = {}) {
        return this.makeRequest(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async delete(endpoint) {
        return this.makeRequest(endpoint, { method: 'DELETE' });
    }

    // Handle token expiration
    handleTokenExpiration() {
        // Import dynamically to avoid circular dependency
        import('../stores/auth.js').then(({ useAuthStore }) => {
            const authStore = useAuthStore();
            authStore.handleAuthError();
        });
    }

    // Authentication methods
    async checkRegistrationEligibility() {
        return this.makeRequest('/auth/check-eligibility');
    }

    async register(userData) {
        return this.makeRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    }

    async login(credentials) {
        const result = await this.makeRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        });

        // Store token if login successful
        if (result.success && result.data.access_token) {
            this.setToken(result.data.access_token);
        }

        return result;
    }

    // Logout
    logout() {
        this.setToken(null);
    }

    // Get current user profile
    async getProfile() {
        return this.makeRequest('/auth/profile');
    }

    // Health check
    async healthCheck() {
        return this.makeRequest('/health');
    }

    // Programs methods
    async getProgramTypes() {
        return this.makeRequest('/programs/types');
    }

    async getProgramModes() {
        return this.makeRequest('/programs/modes');
    }

    async getPrograms() {
        return this.makeRequest('/programs');
    }

    // Application methods (for future use)
    async getApplication(id) {
        return this.makeRequest(`/applications/${id}`);
    }

    async updateApplication(id, data) {
        return this.makeRequest(`/applications/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }
}

// Create and export a singleton instance
export const apiService = new ApiService();

// Export the class for creating new instances if needed
export default ApiService;
