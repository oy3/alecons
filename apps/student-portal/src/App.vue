<script lang="js">
import { RouterView, useRoute } from 'vue-router';
import { ref, computed } from 'vue';
import { useAuthStore } from './stores/auth.js';
import Sidebar from "./components/Sidebar.vue";
import Navbar from "./components/Navbar.vue";
import MobileSidebar from "./components/MobileSidebar.vue";

export default {
  name: 'App',
  components: {
    RouterView,
    Sidebar,
    Navbar,
    MobileSidebar
  },
  setup() {
    const auth = useAuthStore();
    const route = useRoute();

    // Check if current route should show the layout
    const showLayout = computed(() => {
      return auth.isAuthenticated && route.name !== 'Login';
    });

        // Auth initialization is handled in main.js, no need to duplicate here

    return {
      auth,
      showLayout
    };
  }
};
</script>

<template>
  <div id="app">
    <!-- Layout for authenticated users -->
    <div v-if="showLayout" class="d-flex">
      <!-- Desktop Sidebar -->
      <Sidebar />
      
      <!-- Main Content Area -->
      <div class="flex-grow-1 d-flex flex-column">
        <!-- Top Navbar -->
        <Navbar />
        
        <!-- Page Content -->
        <main class="flex-grow-1 bg-light">
          <RouterView />
        </main>
      </div>
      
      <!-- Mobile Sidebar -->
      <MobileSidebar />
    </div>

    <!-- Login page (no layout) -->
    <div v-else>
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
#app {
  min-height: 100vh;
}

main {
  min-height: calc(100vh - 70px); /* Adjust based on navbar height */
}
</style>