import { createRouter, createWebHistory } from 'vue-router'
import { authStore } from '../stores/auth.js'

// Import views
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'

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
            requiresGuest: true,
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
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

// Navigation guards
router.beforeEach((to, from, next) => {
    const auth = authStore()

    // Set page title
    if (to.meta.title) {
        document.title = to.meta.title
    }

    // Check authentication requirements
    if (to.meta.requiresAuth && !auth.isAuthenticated) {
        next({ name: 'Login' })
    } else if (to.meta.requiresGuest && auth.isAuthenticated) {
        next({ name: 'Dashboard' })
    } else if (to.meta.requiresAuth && auth.isAuthenticated) {
        // Verify user is a student and active
        if (auth.user?.role !== 'student' || !auth.user?.isActive) {
            auth.logout()
            next({ name: 'Login' })
        } else {
            next()
        }
    } else {
        next()
    }
})

export default router