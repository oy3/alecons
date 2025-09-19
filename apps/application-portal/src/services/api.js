/**
 * API Service for Alecons Application Portal
 * Handles all backend API calls
 */

const API_BASE_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:8000/api/v1';

class ApiService {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.token = localStorage.getItem('authToken');
    }

    // Set authorization token
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
    }

    // Get authorization headers
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        return headers;
    }

    // Generic API call method
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options,
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }

            // If the backend already returns a success/data structure, return it as-is
            if (data.success !== undefined) {
                return data;
            }

            // Otherwise wrap it in our standard format
            return { success: true, data };
        } catch (error) {
            console.error('API Error:', error);
            return {
                success: false,
                error: error.message || 'Network error occurred'
            };
        }
    }

    // Authentication methods
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
