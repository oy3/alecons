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
      path:'/dashboard',
      name: 'Dashboard',
      component: () =>import('../views/dashboard/dashboard.vue')
    },
    {
      path: '/register',
      name: 'Registration',
      component: () => import('../views/registration/Registration.vue')
    },
    {
      path: '/application',
      name: 'Application',
      component: () => import('../views/application_form/Index.vue')
    },
    {
      path: '/payment',
      name: 'Payment',
      component: () => import('../views/payment/payment.vue')
    }
  ]
})

export default router