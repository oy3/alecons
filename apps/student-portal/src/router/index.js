import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { trackPortalActivity } from '@shared/utils/portalActivity'

// Import views
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import Academics from '../views/Academics.vue'
import Resources from '../views/Resources.vue'
import Finance from '../views/Finance.vue'
import Settings from '../views/Settings.vue'
import TenancyAgreement from '../views/TenancyAgreement.vue'
import PaymentVerification from '../views/PaymentVerification.vue'

const routes = [
    {
        path: '/',
        redirect: '/dashboard'
    },
    {
        path: '/login',
        name: 'Login',
        component: Login,
        meta: {
            requiresAuth: false,
            guestOnly: true,  // Only accessible if not logged in
            title: 'Login - Student Portal'
        }
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: Dashboard,
        meta: {
            requiresAuth: true,
            title: 'Dashboard - Student Portal'
        }
    },
    {
        path: '/academics',
        name: 'Academics',
        component: Academics,
        meta: {
            requiresAuth: true,
            title: 'Academics - Student Portal'
        }
    },
    {
        path: '/resources',
        name: 'Resources',
        component: Resources,
        meta: {
            requiresAuth: true,
            title: 'Resources - Student Portal'
        }
    },
    {
        path: '/finance',
        name: 'Finance',
        component: Finance,
        meta: {
            requiresAuth: true,
            title: 'Finance - Student Portal'
        }
    },
    {
        path: '/tenancy-agreement',
        name: 'TenancyAgreement',
        component: TenancyAgreement,
        meta: {
            requiresAuth: true,
            title: 'Tenancy Agreement - Student Portal'
        }
    },
    {
        path: '/payment/verify/:reference',
        name: 'PaymentVerification',
        component: PaymentVerification,
        meta: {
            requiresAuth: true,
            title: 'Payment Verification - Student Portal'
        }
    },
    {
        path: '/settings',
        name: 'Settings',
        component: Settings,
        meta: {
            requiresAuth: true,
            title: 'Settings - Student Portal'
        }
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

// Navigation guards
router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore();

    // Ensure auth store is initialized
    if (!authStore.isInitialized) {
        await authStore.initialize();
    }

    const isAuthenticated = authStore.isAuthenticated;
    const isStudent = authStore.isStudent;
    const isLoggingOut = authStore.isLoggingOut;

    // Handle logout navigation - bypass guest-only check during logout
    if (isLoggingOut && to.meta.guestOnly) {
        return next();
    }

    // Handle guest-only routes (login)
    if (to.meta.guestOnly && isAuthenticated) {
        return next({ name: 'Dashboard' });
    }

    // Handle routes that require authentication
    if (to.meta.requiresAuth && !isAuthenticated) {
        return next({ name: 'Login' });
    }

    // Handle routes that require student role (only if we have user data loaded)
    if (to.meta.requiresAuth && isAuthenticated && authStore.user && !isStudent) {
        return next({ name: 'Login' });
    }

    // Set page title
    if (to.meta?.title) {
        document.title = to.meta.title
    }

    // Allow navigation
    next();
})

router.afterEach((to) => {
    const token = localStorage.getItem('student_token')
    if (!token || !to.meta.requiresAuth) return
    trackPortalActivity({
        baseUrl: import.meta.env.VITE_APP_API_URL || 'http://localhost:8000/api/v1',
        token,
        portal: 'student',
        routeName: to.name || 'unknown',
        pathTemplate: to.matched.at(-1)?.path,
    })
})

export default router
