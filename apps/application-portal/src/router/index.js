import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    {
      path: '/',
      name: 'Login',
      component: () => import('../views/login/Login.vue')
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('../views/dashboard/dashboard.vue')
    },
    {
      path: '/register',
      name: 'Registration',
      component: () => import('../views/registration/Registration.vue')
    },
    {
      path: '/application-form',
      name: 'ApplicationForm',
      component: () => import('../views/application_form/application_form.vue')
    },
    {
      path: '/payment',
      name: 'Payment',
      component: () => import('../views/payment/payment.vue')
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('../views/settings/settings.vue')
    }
  ]
})

export default router