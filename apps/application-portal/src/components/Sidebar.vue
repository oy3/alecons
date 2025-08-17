<script>
import BrandLogo from "./BrandLogo.vue";

export default {
  name: "Sidebar",
  components: { BrandLogo }, 
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
      <router-link to="/dashboard" class="nav-link text-white py-4 acon-link">
        <i class="bi bi-house h5 me-2"></i> Home
      </router-link>
      <router-link to="/payments" class="nav-link text-white py-4 acon-link">
        <i class="bi bi-credit-card h5 me-2"></i> Payments
      </router-link>
      <a href="#" class="nav-link text-white py-4 acon-link">
        <i class="bi bi-gear h5 me-2"></i> Settings
      </a>
      <router-link to="/" class="nav-link text-white mt-auto py-4 acon-link">
        <i class="bi bi-box-arrow-right h5 me-2"></i> Logout
      </router-link>
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
</style>
