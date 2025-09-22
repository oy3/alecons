<script>
import BrandLogo from "./BrandLogo.vue";
import { useAuth, authManager } from "../services/auth.js";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";

export default {
  name: "MobileSidebar",
  components: { BrandLogo },
  methods: {
    navigateAndClose(routePath, event) {
      // Prevent default anchor link behavior
      if (event) {
        event.preventDefault();
      }
      
      // Navigate to the route
      this.$router
        .push(routePath)
        .then(() => {
          // Close the offcanvas after successful navigation
          this.closeOffcanvas();
        })
        .catch((error) => {
          // Handle navigation errors (e.g., if already on the same route)
          if (error.name !== "NavigationDuplicated") {
            console.error("Navigation error:", error);
          } else {
            // Even if we're already on the route, still close the offcanvas
            this.closeOffcanvas();
          }
        });
    },

    closeOffcanvas() {
      // Use Bootstrap's data-bs-dismiss by programmatically clicking the close button
      const offcanvasElement = document.getElementById("mobileSidebar");
      if (offcanvasElement) {
        const closeButton = offcanvasElement.querySelector('.btn-close');
        if (closeButton) {
          closeButton.click();
        }
      }
    },

    logout() {
      Swal.fire({
        title: "Are you sure?",
        text: "You will be logged out of the application.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, logout",
      }).then((result) => {
        if (result.isConfirmed) {
          logger.info("User confirmed logout");
          authManager.clearAuth();
          this.$router.push({ name: "Login" }).then(() => {
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
      });
    },
  },
};
</script>

<template>
  <div
    class="offcanvas offcanvas-start acon-bg-dark text-white"
    id="mobileSidebar"
  >
    <div class="offcanvas-header">
      <!-- <BrandLogo /> -->
      <!-- <div class="text-center my-4"> -->
      <img src="@shared/assets/logo.png" alt="Logo" width="70" class="" />
      <!-- </div> -->
      <button
        type="button"
        class="btn-close btn-close-white"
        data-bs-dismiss="offcanvas"
      ></button>
    </div>
    <div class="offcanvas-body">
      <nav class="nav flex-column">
        <a
          @click="navigateAndClose('/dashboard', $event)"
          href="#"
          class="nav-link text-white py-4 acon-link"
        >
          <i class="bi bi-house h5 me-2"></i> Home
        </a>
        <a
          @click="navigateAndClose('/payment', $event)"
          href="#"
          class="nav-link text-white py-4 acon-link"
        >
          <i class="bi bi-credit-card h5 me-2"></i> Payments
        </a>
        <a
          @click="navigateAndClose('/settings', $event)"
          href="#"
          class="nav-link text-white py-4 acon-link"
        >
          <i class="bi bi-gear h5 me-2"></i> Settings
        </a>
        <li @click="logout" class="nav-link text-white mt-auto py-4 acon-link">
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
</style>
