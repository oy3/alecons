<script>
import BrandLogo from "./BrandLogo.vue";
import { useAuthStore } from "../stores/auth.js";
import { useRoute } from "vue-router";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";

export default {
  name: "MobileSidebar",
  components: { BrandLogo },
  setup() {
    const authStore = useAuthStore();
    const route = useRoute();
    return {
      authStore,
      route,
    };
  },
  computed: {
    applicationId() {
      return this.route.params.id;
    },
  },
  methods: {
    navigateAndClose(routePath, event) {
      if (event) event.preventDefault();
      this.$router.push(routePath)
        .then(() => this.closeOffcanvas())
        .catch((error) => {
          if (error.name !== "NavigationDuplicated") {
            logger.error("Navigation error:", error);
          } else {
            this.closeOffcanvas();
          }
        });
    },

    closeOffcanvas() {
      const offcanvasElement = document.getElementById("mobileSidebar");
      if (offcanvasElement) {
        const closeButton = offcanvasElement.querySelector(".btn-close");
        if (closeButton) closeButton.click();
      }
    },

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
          this.authStore.completeLogout();
          this.closeOffcanvas();
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
    },
  },
};
</script>

<template>
  <div
    class="offcanvas offcanvas-start acon-bg-primary-dark text-white"
    id="mobileSidebar"
  >
    <div class="offcanvas-header">
      <router-link to="/my-applications">
        <img src="@shared/assets/logo.png" alt="Logo" width="70" class="" />
      </router-link>
      <button
        type="button"
        class="btn-close btn-close-white"
        data-bs-dismiss="offcanvas"
      ></button>
    </div>
    <div class="offcanvas-body">
      <nav class="nav flex-column">
        <router-link
          v-if="applicationId"
          :to="`/applications/${applicationId}/dashboard`"
          class="nav-link text-white py-4"
          active-class="active"
          @click="closeOffcanvas"
        >
          <i class="bi bi-house h5 me-2"></i> Home
        </router-link>
        <router-link
          v-if="applicationId"
          :to="`/applications/${applicationId}/payment`"
          class="nav-link text-white py-4"
          active-class="active"
          @click="closeOffcanvas"
        >
          <i class="bi bi-credit-card h5 me-2"></i> Payments
        </router-link>
        <!-- <router-link
          to="/settings"
          class="nav-link text-white py-4"
          active-class="active"
          @click="closeOffcanvas"
        >
          <i class="bi bi-gear h5 me-2"></i> Settings
        </router-link> -->
        <li
          @click="logout"
          class="nav-link text-white mt-auto py-4"
          active-class="active"
        >
          <i class="bi bi-box-arrow-right h5 me-2"></i> Logout
        </li>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.offcanvas {
  width: 250px;
}

.nav-link.active {
  background-color: rgba(255, 255, 255, 0.2); /* highlight */
  font-weight: bold;
  border-radius: 10px;
}

.nav-link:hover {
  color: var(--acon-secondary) !important;
}
</style>
