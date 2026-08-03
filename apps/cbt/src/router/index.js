import Dashboard from '../views/Dashboard.vue'
import Login from '../views/Login.vue'
import ExamInterface from '../views/ExamInterface.vue'
import ExamResults from '../views/ExamResults.vue'
import Unauthorized from '../views/Unauthorized.vue'

export default [
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
            idlePolicy: 'none',
            title: 'Login - CBT Portal'
        }
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: Dashboard,
        meta: {
            requiresAuth: true,
            idlePolicy: 'protected',
            title: 'Dashboard - CBT Portal'
        }
    },
    {
        path: '/exam/take',
        name: 'ExamInterface',
        component: ExamInterface,
        meta: {
            requiresAuth: true,
            idlePolicy: 'exam',
            title: 'Exam - CBT Portal',
            fullscreen: true
        }
    },
    {
        path: '/exam/:examId/results',
        name: 'ExamResults',
        component: ExamResults,
        meta: {
            requiresAuth: true,
            idlePolicy: 'protected',
            title: 'Results - CBT Portal'
        }
    },
    {
        path: '/unauthorized',
        name: 'Unauthorized',
        component: Unauthorized,
        meta: {
            requiresAuth: false,
            idlePolicy: 'none',
            title: 'Access Denied'
        }
    }
]