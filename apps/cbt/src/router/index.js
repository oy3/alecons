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
      title: 'Login - CBT Portal'
    }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { 
      requiresAuth: true,
      title: 'Dashboard - CBT Portal'
    }
  },
  {
    path: '/exam/:examId/interface',
    name: 'ExamInterface',
    component: ExamInterface,
    meta: { 
      requiresAuth: true,
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
      title: 'Results - CBT Portal'
    }
  },
  {
    path: '/unauthorized',
    name: 'Unauthorized',
    component: Unauthorized,
    meta: { 
      requiresAuth: false,
      title: 'Access Denied'
    }
  }
]