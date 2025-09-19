<script lang="js">
import { RouterView, useRoute } from 'vue-router';
import Sidebar from "./components/Sidebar.vue";
import Navbar from "./components/Navbar.vue";
import MobileSidebar from "./components/MobileSidebar.vue";

export default {
  name: 'App',
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

<style scoped></style>
