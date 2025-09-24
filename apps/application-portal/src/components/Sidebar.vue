<script lang="js">
import BrandLogo from "./BrandLogo.vue";
import { useAuthStore } from "../stores/auth.js";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";

export default {
  name: "Sidebar",
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
    <nav class="nav flex-column">
      <router-link
        to="/dashboard"
        class="nav-link text-white py-4 acon-link"
        active-class="active"
      >
        <i class="bi bi-house h5 me-2"></i> Home
      </router-link>
      <router-link
        to="/payment"
        class="nav-link text-white py-4 acon-link"
        active-class="active"
      >
        <i class="bi bi-credit-card h5 me-2"></i> Payments
      </router-link>
      <router-link
        to="/settings"
        class="nav-link text-white py-4 acon-link"
        active-class="active"
      >
        <i class="bi bi-gear h5 me-2"></i> Settings
      </router-link>
      <li
        @click="logout"
        class="nav-link text-white mt-auto py-4 acon-link"
        active-class="active"
      >
        <i class="bi bi-box-arrow-right h5 me-2"></i> Logout
      </li>
    </nav>
  </aside>
</template>

<style scoped>
.nav-custom-rounded {
  border-radius: 90px;
}

.sidebar {
  width: 200px;
  min-width: 200px;
  max-width: 200px;
}

.nav-link.active {
  background-color: rgba(255, 255, 255, 0.2); /* highlight */
  font-weight: bold;
  border-radius: 10px;
}
</style>
