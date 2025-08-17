<script>
import BrandLogo from "./BrandLogo.vue";

export default {
  name: "MobileSidebar",
  components: { BrandLogo }
};
</script>


<template>
  <div class="offcanvas offcanvas-start acon-bg-dark text-white" id="mobileSidebar">
    <div class="offcanvas-header">
      <BrandLogo />
      <button
        type="button"
        class="btn-close btn-close-white"
        data-bs-dismiss="offcanvas"
      ></button>
    </div>
    <div class="offcanvas-body">
      <nav class="nav flex-column">
        <a href="#" class="nav-link text-white py-3">
          <i class="bi bi-house me-2"></i> Home
        </a>
        <a href="#" class="nav-link text-white py-3">
          <i class="bi bi-credit-card me-2"></i> Payments
        </a>
        <a href="#" class="nav-link text-white py-3">
          <i class="bi bi-gear me-2"></i> Settings
        </a>
        <a href="#" class="nav-link text-white mt-auto py-3">
          <i class="bi bi-box-arrow-right me-2"></i> Logout
        </a>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.offcanvas {
  width: 250px;
}
</style>
