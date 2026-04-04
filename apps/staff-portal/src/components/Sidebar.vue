<script lang="js">
import BrandLogo from "./BrandLogo.vue";
import { useAuthStore } from "../stores/auth.js";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";
import { staffNavigationItems } from "../services/navigation.js";

export default {
  name: "StaffSidebar",
  computed: {
    menuItems() {
      return staffNavigationItems.filter(item =>
        this.authStore.hasAnyPermission(item.permissions)
      )
    }
  },
  components: { BrandLogo },
  setup() {
    const authStore = useAuthStore();
    return {
      authStore
    };
  },
  methods: {
    async logout() {
      const result = await Swal.fire({
        title: "Are you sure?",
        text: "You will be logged out of the application.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, logout",
      });

      if (result.isConfirmed) {
          logger.info("User confirmed logout");
          await this.authStore.logout();

          this.$router.push({ name: "Login" }).then(() => {
            // Complete the logout process after navigation
            this.authStore.completeLogout();
          });

          Swal.fire({
            toast: true,
            position: "top-end",
            icon: "success",
            title: "Logged out successfully.",
            showConfirmButton: false,
            timer: 2000,
          });
        }
    }
  }
};
</script>

<template>
  <aside
    class="sidebar d-none d-md-flex flex-column acon-bg-dark rounded-start-0 nav-custom-rounded text-white p-3"
  >
    <div class="text-center my-4">
      <!-- <BrandLogo /> -->
      <img src="@shared/assets/logo.png" alt="Logo" width="70" class="" />
    </div>

    <!-- Navigation Menu -->
    <div class="flex-grow-1">
      <nav class="nav flex-column">
        <div class="nav-item mb-3" v-for="item in menuItems" :key="item.route">
          <router-link
            :to="item.route"
            class="nav-link d-flex align-items-center py-2 px-3"
            :class="{ active: $route.path === item.route }"
          >
            <i :class="item.icon" class="me-3"></i>
            <span>{{ item.title }}</span>
          </router-link>
        </div>
      </nav>
    </div>

    <div class="p-3 border-top border-light border-opacity-25">
      <button
        @click="logout"
        class="d-flex align-items-center nav-link text-white acon-link"
        active-class="active"
      >
        <i class="bi bi-box-arrow-right h5 mb-0 me-3"></i>
        <span>Logout</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.nav-custom-rounded {
  border-radius: 50px;
}

.sidebar {
  width: 200px;
  min-width: 200px;
  max-width: 200px;
}
.nav-link {
  color: rgba(255, 255, 255, 0.7);
  transition: all 0.3s ease;
}

.nav-link.active,
.nav-link:hover {
  background-color: rgba(255, 255, 255, 0.2); /* highlight */
  color: white;
  font-weight: 550;
  border-radius: 10px;
}
</style>
