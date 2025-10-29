import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { logger } from '@shared/utils/logger'

const routes = [
    {
        path: '/login',
        name: 'Login',
        component: () => import('../views/auth/Login.vue'),
        meta: { requiresAuth: false, hideLayout: true }
    },
    {
        path: '/',
        redirect: '/dashboard'
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('../views/dashboard/Dashboard.vue'),
        meta: { requiresAuth: true, permissions: ['view', 'dashboard:view'] }
    },
    {
        path: '/settings',
        name: 'Settings',
        component: () => import('../views/settings/Settings.vue'),
        meta: { requiresAuth: true, permissions: ['view', 'settings:view'] }
    },
    {
        path: '/applications',
        name: 'Applications',
        component: () => import('../views/applications/Applications.vue'),
        meta: { requiresAuth: true, permissions: ['view', 'applications:view'] }
    },
    {
        path: '/admission',
        name: 'Admission',
        component: () => import('../views/applications/Admission.vue'),
        meta: { requiresAuth: true, permissions: ['staff', 'admin', 'applications:manage'] }
    },
    {
        path: '/academics',
        name: 'Academics',
        component: () => import('../views/academics/Academics.vue'),
        meta: { requiresAuth: true, permissions: ['staff', 'admin', 'academics:manage'] }
    },
    {
        path: '/exams',
        name: 'ExamManagement',
        component: () => import('../views/exams/ExamManagement.vue'),
        meta: { requiresAuth: true, permissions: ['staff', 'admin', 'exams:manage'] }
    },
    {
        path: '/exams/:id',
        name: 'ExamView',
        component: () => import('../views/exams/ExamView.vue'),
        meta: { requiresAuth: true, permissions: ['staff', 'admin', 'exams:manage'] }
    },
    {
        path: '/users',
        name: 'Users',
        component: () => import('../views/users/Users.vue'),
        meta: { requiresAuth: true, permissions: ['view', 'users:view'] }
    },
    //   {
    //     path: '/reports',
    //     name: 'Reports',
    //     component: () => import('../views/reports/Reports.vue'),
    //     meta: { requiresAuth: true, permissions: ['read:reports'] }
    //   },
    //   {
    //     path: '/:pathMatch(.*)*',
    //     name: 'NotFound',
    //     component: () => import('../views/NotFound.vue'),
    //     meta: { requiresAuth: false, hideLayout: true }
    //   }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

// Navigation guard for authentication and permissions
router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()

    // Initialize auth store if not already initialized
    if (!authStore.isInitialized) {
        await authStore.initialize()
    }

    const requiresAuth = to.meta.requiresAuth !== false
    const isAuthenticated = authStore.isAuthenticated
    const userPermissions = authStore.user?.permissions || []
    const requiredPermissions = to.meta.permissions || []

    logger.info('Navigation guard:', {
        to: to.path,
        requiresAuth,
        isAuthenticated,
        userPermissions,
        requiredPermissions
    })

    if (requiresAuth && !isAuthenticated) {
        logger.warn('Access denied: User not authenticated')
        next({ path: '/login', query: { redirect: to.fullPath } })
        return
    }

    if (isAuthenticated && to.path === '/login') {
        logger.info('User already authenticated, redirecting to dashboard')
        next({ path: '/dashboard' })
        return
    }

    // Check permissions - more flexible permission checking
    if (requiredPermissions.length > 0) {
        const hasPermission = requiredPermissions.some(permission => {
            // Check for exact match or admin permissions
            return userPermissions.includes(permission) ||
                userPermissions.includes('admin:all') ||
                userPermissions.includes('manage') ||
                userPermissions.includes('all')
        })

        if (!hasPermission) {
            logger.warn('Access denied: Insufficient permissions', {
                required: requiredPermissions,
                user: userPermissions
            })
            // Don't redirect to dashboard if we're already trying to access dashboard
            if (to.name !== 'Dashboard') {
                next({ path: '/dashboard' })
            } else {
                // If user doesn't have dashboard access, redirect to login
                next({ path: '/login' })
            }
            return
        }
    }

    next()
})

export default router