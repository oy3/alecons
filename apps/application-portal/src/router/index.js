import { createRouter, createWebHistory } from 'vue-router'
import { authManager } from '../services/auth.js'
import { logger } from '@shared/utils/logger'

const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    {
      path: '/',
      name: 'Login',
      component: () => import('../views/login/Login.vue'),
      meta: {
        requiresAuth: false,
        guestOnly: true  // Only accessible if not logged in
      }
    },
    {
      path: '/register',
      name: 'Registration',
      component: () => import('../views/registration/Registration.vue'),
      meta: {
        requiresAuth: false,
        guestOnly: true  // Only accessible if not logged in
      }
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('../views/dashboard/dashboard.vue'),
      meta: {
        requiresAuth: true,
        requiresApplicant: true
      }
    },
    {
      path: '/application-form',
      name: 'ApplicationForm',
      component: () => import('../views/application_form/application_form.vue'),
      meta: {
        requiresAuth: true,
        requiresApplicant: true
      }
    },
    {
      path: '/payment',
      name: 'Payment',
      component: () => import('../views/payment/payment.vue'),
      meta: {
        requiresAuth: true,
        requiresApplicant: true
      }
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('../views/settings/settings.vue'),
      meta: {
        requiresAuth: true,
        requiresApplicant: true
      }
    },
    {
      path: '/logout',
      name: 'Logout',
      beforeEnter: (to, from, next) => {
        authManager.clearAuth();
        logger.info('User logged out via route');
        next({ name: 'Login' });
      }
    },
    // Catch-all route - redirect to dashboard if authenticated, login if not
    {
      path: '/:pathMatch(.*)*',
      beforeEnter: (to, from, next) => {
        if (authManager.validateSession()) {
          next({ name: 'Dashboard' });
        } else {
          next({ name: 'Login' });
        }
      }
    }
  ]
})

// Global navigation guard
router.beforeEach((to, from, next) => {
  logger.info('Navigation:', { from: from.name, to: to.name });

  // Validate session on every navigation
  const isAuthenticated = authManager.validateSession();
  const isApplicant = authManager.isApplicant();

  // Handle guest-only routes (login, register)
  if (to.meta.guestOnly && isAuthenticated) {
    logger.info('Authenticated user trying to access guest-only route, redirecting to dashboard');
    return next({ name: 'Dashboard' });
  }

  // Handle routes that require authentication
  if (to.meta.requiresAuth && !isAuthenticated) {
    logger.info('Unauthenticated user trying to access protected route, redirecting to login');
    return next({ name: 'Login' });
  }

  // Handle routes that require applicant role
  if (to.meta.requiresApplicant && (!isAuthenticated || !isApplicant)) {
    logger.info('Non-applicant user trying to access applicant route, redirecting to login');
    return next({ name: 'Login' });
  }

  // Allow navigation
  next();
});

export default router