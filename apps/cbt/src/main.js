import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import routes from './router/index.js'
import { authStore } from './stores/auth.js'

// Import Bootstrap CSS and JS
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './style.css'

// Bootstrap JS
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

const router = createRouter({
  history: createWebHistory('/cbt/'),
  routes
})

// Router guards
router.beforeEach(async (to, from, next) => {
  // Initialize auth store
  await authStore.initialize()

  // Check if route requires authentication
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
    return
  }

  // Check if route requires specific permissions
  if (to.meta.permissions && !authStore.hasAnyPermission(to.meta.permissions)) {
    next('/unauthorized')
    return
  }

  next()
})

const app = createApp(App)
app.use(router)
app.mount('#app')