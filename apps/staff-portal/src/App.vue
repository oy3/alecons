<script lang="js">
import { RouterView, useRoute } from 'vue-router'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from './stores/auth.js'
import { logger } from '@shared/utils/logger'
import Sidebar from "./components/Sidebar.vue"
import Navbar from "./components/Navbar.vue"
import MobileSidebar from "./components/MobileSidebar.vue"

export default {
  name: 'StaffApp',
  setup() {
    const authStore = useAuthStore()
    const route = useRoute()
    const refreshInterval = ref(null)
    const lastRefreshTime = ref(Date.now())

    // Refresh user data with intelligent debouncing
    const refreshUserData = async (reason = 'manual', priority = 'normal') => {
      if (!authStore.isAuthenticated) {
        logger.info('Skipping staff refresh - user not authenticated', { reason })
        return
      }

      const timeSinceLastRefresh = Date.now() - lastRefreshTime.value
      let minInterval = 45000 // Default 45 seconds for staff portal

      if (priority === 'high' || reason === 'window-focus' || reason === 'manual') {
        minInterval = 15000 // 15 seconds for high priority
      } else if (reason === 'periodic') {
        minInterval = 90000 // 1.5 minutes for periodic
      }

      if (timeSinceLastRefresh < minInterval) {
        logger.info('Skipping staff refresh - too recent', {
          reason, priority, timeSinceLastRefresh, minInterval
        })
        return
      }

      try {
        logger.info('Refreshing staff user data from App.vue', { reason, priority })
        await authStore.refreshUserData()
        lastRefreshTime.value = Date.now()
        logger.info('Staff user data refreshed successfully', { reason, priority })
      } catch (error) {
        logger.error('Failed to refresh staff user data:', { error: error.message, reason, priority })
      }
    }

    // Handle window focus
    const handleWindowFocus = () => {
      refreshUserData('window-focus', 'high')
    }

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden && authStore.isAuthenticated) {
        refreshUserData('visibility-change', 'high')
      }
    }

    // Setup periodic refresh every 15 minutes for staff portal
    const setupPeriodicRefresh = () => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
      }
      
      refreshInterval.value = setInterval(() => {
        if (authStore.isAuthenticated && !document.hidden) {
          refreshUserData('periodic', 'low')
        }
      }, 15 * 60 * 1000) // 15 minutes
    }

    // Watch for authentication state changes
    watch(() => authStore.isAuthenticated, (newValue) => {
      if (newValue) {
        logger.info('Staff user authenticated, setting up data refresh')
        refreshUserData('auth-change', 'high')
        setupPeriodicRefresh()
      } else {
        logger.info('Staff user not authenticated, clearing refresh interval')
        if (refreshInterval.value) {
          clearInterval(refreshInterval.value)
          refreshInterval.value = null
        }
      }
    })

    // Watch for route changes
    watch(() => route.path, (newPath, oldPath) => {
      if (newPath !== oldPath && authStore.isAuthenticated) {
        const highPriorityRoutes = ['/dashboard', '/settings']
        const normalPriorityRoutes = ['/applications', '/users', '/reports', '/utilities']
        
        if (highPriorityRoutes.includes(newPath)) {
          refreshUserData('route-change', 'high')
        } else if (normalPriorityRoutes.includes(newPath)) {
          refreshUserData('route-change', 'normal')
        }
      }
    })

    // Force refresh function
    const forceRefresh = () => {
      refreshUserData('manual', 'high')
    }

    // Make refresh function available globally
    if (typeof window !== 'undefined') {
      window.forceStaffDataRefresh = forceRefresh
    }

    onMounted(async () => {
      await authStore.initialize()
      
      window.addEventListener('focus', handleWindowFocus)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      
      if (authStore.isAuthenticated) {
        setupPeriodicRefresh()
      }
      
      logger.info('Staff App.vue mounted with data refresh listeners')
    })

    onUnmounted(() => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
      }
      
      logger.info('Staff App.vue unmounted, cleaned up refresh listeners')
    })

    return {
      authStore
    }
  },
  computed: {
    showLayout() {
      const hideLayoutRoutes = ["/", "/login"]
      return !hideLayoutRoutes.includes(this.$route.path) && !this.$route.meta.hideLayout
    }
  },
  components: { RouterView, Navbar, Sidebar, MobileSidebar }
}
</script>

<template>
  <div class="d-flex vh-100 bg-light">
    <!-- Sidebar (Desktop) -->
    <Sidebar v-if="showLayout" />

    <!-- Main Content -->
    <main class="flex-grow-1 d-flex flex-column min-vh-100">
      <!-- Navbar -->
      <Navbar v-if="showLayout" />
      
      <!-- Content Area -->
      <div class="flex-grow-1 overflow-auto p-0">
        <RouterView v-slot="{ Component }">
          <div class="fade-in">
            <component :is="Component" />
          </div>
        </RouterView>
      </div>
    </main>

    <!-- Mobile Sidebar -->
    <MobileSidebar v-if="showLayout" />
  </div>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { 
    opacity: 0; 
    transform: translateY(10px); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
}
</style>