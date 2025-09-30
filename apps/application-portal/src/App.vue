<script lang="js">
import { RouterView, useRoute } from 'vue-router';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useAuthStore } from './stores/auth.js';
import { logger } from '@shared/utils/logger';
import Sidebar from "./components/Sidebar.vue";
import Navbar from "./components/Navbar.vue";
import MobileSidebar from "./components/MobileSidebar.vue";

export default {
  name: 'App',
  setup() {
    const authStore = useAuthStore();
    const route = useRoute();
    const refreshInterval = ref(null);
    const lastRefreshTime = ref(Date.now());

    // Refresh user data with intelligent debouncing and priority system
    const refreshUserData = async (reason = 'manual', priority = 'normal') => {
      // Only refresh if user is authenticated
      if (!authStore.isAuthenticated) {
        logger.info('Skipping refresh - user not authenticated', { reason });
        return;
      }

      // Intelligent debouncing based on priority and reason
      const timeSinceLastRefresh = Date.now() - lastRefreshTime.value;
      let minInterval = 30000; // Default 30 seconds

      // Adjust debouncing based on priority and reason
      if (priority === 'high' || reason === 'window-focus' || reason === 'manual') {
        minInterval = 10000; // 10 seconds for high priority
      } else if (reason === 'periodic') {
        minInterval = 60000; // 1 minute for periodic (more conservative)
      }

      if (timeSinceLastRefresh < minInterval) {
        logger.info('Skipping refresh - too recent', {
          reason,
          priority,
          timeSinceLastRefresh,
          minInterval
        });
        return;
      }

      try {
        logger.info('Refreshing user data from App.vue', { reason, priority });
        await authStore.refreshUserData();
        lastRefreshTime.value = Date.now();
        logger.info('User data refreshed successfully', { reason, priority });
      } catch (error) {
        logger.error('Failed to refresh user data in App.vue:', { error: error.message, reason, priority });
      }
    };

    // Handle window focus to refresh data when user returns to tab
    const handleWindowFocus = () => {
      refreshUserData('window-focus', 'high');
    };

    // Handle visibility change (when tab becomes active/inactive)
    const handleVisibilityChange = () => {
      if (!document.hidden && authStore.isAuthenticated) {
        refreshUserData('visibility-change', 'high');
      }
    };

    // Setup more conservative periodic refresh every 10 minutes for active sessions
    const setupPeriodicRefresh = () => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value);
      }
      
      refreshInterval.value = setInterval(() => {
        if (authStore.isAuthenticated && !document.hidden) {
          refreshUserData('periodic', 'low');
        }
      }, 10 * 60 * 1000); // 10 minutes (more conservative)
    };

    // Watch for authentication state changes
    watch(() => authStore.isAuthenticated, (newValue) => {
      if (newValue) {
        logger.info('User authenticated, setting up data refresh');
        refreshUserData('auth-change', 'high');
        setupPeriodicRefresh();
      } else {
        logger.info('User not authenticated, clearing refresh interval');
        if (refreshInterval.value) {
          clearInterval(refreshInterval.value);
          refreshInterval.value = null;
        }
      }
    });

    // Watch for route changes with smart refresh logic
    watch(() => route.path, (newPath, oldPath) => {
      if (newPath !== oldPath && authStore.isAuthenticated) {
        // Prioritize critical pages that always need fresh data
        const highPriorityRoutes = ['/dashboard', '/payment', '/settings'];
        const normalPriorityRoutes = ['/application-form'];
        
        if (highPriorityRoutes.includes(newPath)) {
          refreshUserData('route-change', 'high');
        } else if (normalPriorityRoutes.includes(newPath)) {
          refreshUserData('route-change', 'normal');
        }
        // For other routes, rely on existing fresh data or periodic refresh
      }
    });

    // Expose refresh function globally for manual calls
    const forceRefresh = () => {
      refreshUserData('manual', 'high');
    };

    // Make refresh function available globally for other components
    if (typeof window !== 'undefined') {
      window.forceUserDataRefresh = forceRefresh;
    }

    onMounted(async () => {
      // Initialize auth store on app mount
      await authStore.initialize();
      
      // Set up event listeners for data freshness
      window.addEventListener('focus', handleWindowFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Setup periodic refresh if user is authenticated
      if (authStore.isAuthenticated) {
        setupPeriodicRefresh();
      }
      
      logger.info('App.vue mounted with data refresh listeners');
    });

    onUnmounted(() => {
      // Clean up event listeners and intervals
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value);
      }
      
      logger.info('App.vue unmounted, cleaned up refresh listeners');
    });

    return {
      authStore
    };
  },
  methods: {
  },
  computed: {
    showLayout() {
      const hideLayoutRoutes = ["/", "/register"];
      return !hideLayoutRoutes.includes(this.$route.path);
    }
  },
  components: { RouterView, Navbar, Sidebar, MobileSidebar }
}
</script>

<template>
  <div class="d-flex vh-100">
    <!-- Sidebar (Desktop) -->
    <Sidebar v-if="showLayout" />

    <!-- Main Content -->
    <main class="flex-grow-1 bg-white d-flex flex-column min-vh-100">
      <!-- Navbar -->
      <Navbar v-if="showLayout" />
      <div class="flex-grow-1 overflow-auto">
        <RouterView v-slot="{ Component }">
          <component :is="Component" />
        </RouterView>
      </div>
    </main>

    <!-- Offcanvas Sidebar (Mobile) -->
    <MobileSidebar v-if="showLayout" />
  </div>
</template>

<style>
</style>
