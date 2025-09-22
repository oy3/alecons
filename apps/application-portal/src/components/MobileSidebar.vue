<script>
import BrandLogo from "./BrandLogo.vue";
import { useAuth, authManager } from "../services/auth.js";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";

export default {
  name: "MobileSidebar",
  components: { BrandLogo },
  methods: {
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
          this.$router.push({ name: "Login" });

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
        <router-link 
          to="/dashboard" 
          class="nav-link text-white py-4 acon-link"
          data-bs-dismiss="offcanvas">
          <i class="bi bi-house h5 me-2"></i> Home
        </router-link>
        <router-link 
          to="/payment" 
          class="nav-link text-white py-4 acon-link"
          data-bs-dismiss="offcanvas">
          <i class="bi bi-credit-card h5 me-2"></i> Payments
        </router-link>
        <a 
          href="#" 
          class="nav-link text-white py-4 acon-link"
          data-bs-dismiss="offcanvas">
          <i class="bi bi-gear h5 me-2"></i> Settings
        </a>
       <li
        @click="logout" 
        class="nav-link text-white mt-auto py-4 acon-link"
        data-bs-dismiss="offcanvas">
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
