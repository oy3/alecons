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
        meta: { requiresAuth: true }
    },
    {
        path: '/settings',
        name: 'Settings',
        component: () => import('../views/settings/Settings.vue'),
        meta: { requiresAuth: true, module: 'settings' }
    },
    {
        path: '/applications',
        name: 'Applications',
        component: () => import('../views/applications/Applications.vue'),
        meta: { requiresAuth: true, module: 'applications' }
    },
    {
        path: '/admission',
        name: 'Admission',
        component: () => import('../views/applications/Admission.vue'),
        meta: { requiresAuth: true, module: 'admissions' }
    },
    {
        path: '/students',
        name: 'Students',
        component: () => import('../views/students/Students.vue'),
        meta: { requiresAuth: true, module: 'students' }
    },
    {
        path: '/students/:id',
        name: 'StudentDetail',
        component: () => import('../views/students/StudentDetail.vue'),
        meta: { requiresAuth: true, module: 'students' }
    },
    {
        path: '/academics',
        name: 'Academics',
        component: () => import('../views/academics/Academics.vue'),
        meta: { requiresAuth: true, module: 'academics' }
    },
    {
        path: '/course-registrations',
        name: 'CourseRegistrations',
        component: () => import('../views/course-registrations/CourseRegistrations.vue'),
        meta: { requiresAuth: true, module: 'courseRegistrations' }
    },
    {
        path: '/exams',
        name: 'ExamManagement',
        component: () => import('../views/exams/ExamManagement.vue'),
        meta: { requiresAuth: true, module: 'exams' }
    },
    {
        path: '/exams/:id',
        name: 'ExamView',
        component: () => import('../views/exams/ExamView.vue'),
        meta: { requiresAuth: true, module: 'exams' }
    },
    {
        path: '/users',
        name: 'Users',
        component: () => import('../views/users/Users.vue'),
        meta: { requiresAuth: true, module: 'users' }
    },
    {
        path: '/payments',
        name: 'Payments',
        component: () => import('../views/payments/Payments.vue'),
        meta: { requiresAuth: true, module: 'payments' }
    },
    {
        path: '/utilities',
        name: 'Utilities',
        component: () => import('../views/utilities/Utilities.vue'),
        meta: { requiresAuth: true, module: 'utilities' }
    },
    {
        path: '/id-cards',
        name: 'IdCards',
        component: () => import('../views/id-cards/IdCardGenerator.vue'),
        meta: { requiresAuth: true, module: 'idCards' }
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
    logger.info('Navigation guard:', {
        to: to.path,
        requiresAuth,
        isAuthenticated,
        requiredModule: to.meta.module
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

    // Check module access
    const requiredModule = to.meta.module
    if (requiredModule && !authStore.hasModuleAccess(requiredModule)) {
        logger.warn('Access denied: Insufficient module access', {
            requiredModule,
            userModules: authStore.userModules
        })
        if (to.name !== 'Dashboard') {
            next({ path: '/dashboard' })
        } else {
            next({ path: '/login' })
        }
        return
    }

    next()
})

export default router
