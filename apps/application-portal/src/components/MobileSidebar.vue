<script>
import BrandLogo from "./BrandLogo.vue";

export default {
  name: "MobileSidebar",
  components: { BrandLogo },
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
        <router-link to="/dashboard" class="nav-link text-white py-4 acon-link">
          <i class="bi bi-house h5 me-2"></i> Home
        </router-link>
        <router-link to="/payment" class="nav-link text-white py-4 acon-link">
          <i class="bi bi-credit-card h5 me-2"></i> Payments
        </router-link>
        <a href="#" class="nav-link text-white py-4 acon-link">
          <i class="bi bi-gear h5 me-2"></i> Settings
        </a>
        <router-link to="/" class="nav-link text-white mt-auto py-4 acon-link">
          <i class="bi bi-box-arrow-right h5 me-2"></i> Logout
        </router-link>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.offcanvas {
  width: 250px;
}
</style>
