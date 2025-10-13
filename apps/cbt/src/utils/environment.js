/**
 * Environment utility for CBT application
 */

export const Environment = {
    // Environment detection
    isDevelopment: () => import.meta.env.VITE_APP_ENV === 'development',
    isStaging: () => import.meta.env.VITE_APP_ENV === 'staging',
    isProduction: () => import.meta.env.VITE_APP_ENV === 'production',

    // Current environment
    current: () => import.meta.env.VITE_APP_ENV || 'development',

    // Debug mode
    isDebugMode: () => import.meta.env.VITE_APP_DEBUG === 'true',

    // Get environment-specific values
    getApiBaseUrl: () => import.meta.env.VITE_API_BASE_URL,
    getSocketUrl: () => import.meta.env.VITE_SOCKET_URL,
    getAppName: () => import.meta.env.VITE_APP_NAME,
    getAppVersion: () => import.meta.env.VITE_APP_VERSION,
    getLogLevel: () => import.meta.env.VITE_LOG_LEVEL || 'info',

    // Feature flags
    isDevToolsEnabled: () => import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true',

    // Environment info object
    getInfo: () => ({
        environment: import.meta.env.VITE_APP_ENV || 'development',
        debug: import.meta.env.VITE_APP_DEBUG === 'true',
        apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
        appName: import.meta.env.VITE_APP_NAME,
        appVersion: import.meta.env.VITE_APP_VERSION,
        logLevel: import.meta.env.VITE_LOG_LEVEL,
        devTools: import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true'
    })
}

// Export individual functions for convenience
export const {
    isDevelopment,
    isStaging,
    isProduction,
    current,
    isDebugMode,
    getApiBaseUrl,
    getSocketUrl,
    getAppName,
    getAppVersion,
    getLogLevel,
    isDevToolsEnabled,
    getInfo
} = Environment

export default Environment