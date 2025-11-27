import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
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
      path: '/verify-email',
      name: 'EmailVerification',
      component: () => import('../views/auth/EmailVerification.vue'),
      meta: {
        requiresAuth: false
      }
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('../views/dashboard/dashboard.vue'),
      meta: {
        requiresAuth: true,
        requiresApplicant: true  // Allows both applicant and student roles
      }
    },
    {
      path: '/application-form',
      name: 'ApplicationForm',
      component: () => import('../views/application_form/application_form.vue'),
      meta: {
        requiresAuth: true,
        requiresApplicant: true  // Allows both applicant and student roles
      }
    },
    {
      path: '/payment',
      name: 'Payment',
      component: () => import('../views/payment/payment.vue'),
      meta: {
        requiresAuth: true,
        requiresApplicant: true  // Allows both applicant and student roles
      }
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('../views/settings/settings.vue'),
      meta: {
        requiresAuth: true,
        requiresApplicant: true  // Allows both applicant and student roles
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
router.beforeEach(async (to, from, next) => {
  logger.info('Navigation:', { from: from.name, to: to.name });

  const authStore = useAuthStore();

  // Ensure auth store is initialized
  if (!authStore.isInitialized) {
    await authStore.initialize();
  }

  const isAuthenticated = authStore.isAuthenticated;
  const isApplicant = authStore.isApplicant;
  const isLoggingOut = authStore.isLoggingOut;

  // Handle logout navigation - bypass guest-only check during logout
  if (isLoggingOut && to.meta.guestOnly) {
    logger.info('Logout in progress, allowing navigation to guest route');
    return next();
  }

  // Handle guest-only routes (login, register)
  if (to.meta.guestOnly && isAuthenticated) {
    logger.info('Authenticated user trying to access guest-only route, redirecting to dashboard', {
      isAuthenticated,
      hasUser: !!authStore.user,
      hasToken: !!authStore.token,
      route: to.name
    });
    return next({ name: 'Dashboard' });
  }

  // Handle routes that require authentication
  if (to.meta.requiresAuth && !isAuthenticated) {
    logger.info('Unauthenticated user trying to access protected route, redirecting to login');
    return next({ name: 'Login' });
  }

  // Handle routes that require applicant or student role
  if (to.meta.requiresApplicant && (!isAuthenticated || !isApplicant)) {
    logger.info('Non-applicant/student user trying to access application portal route, redirecting to login');
    return next({ name: 'Login' });
  }

  // Allow navigation
  next();
});

export default router