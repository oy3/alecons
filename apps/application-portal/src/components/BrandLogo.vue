<script lang="js">
export default {
  name: "BrandLogo",
};
</script>

<template>
  <router-link class="d-flex align-items-center" to="/">
    <img src="@shared/assets/logo.png" alt="Logo" width="50" class="me-2" />
    <div class="text-start text-uppercase d-flex flex-column">
      <span class="fw-bold acon-text-primary">ALEBIOSU COLLEGE</span>
      <span
        class="fw-light text-secondary fs-6"
        style="letter-spacing: 1.5px"
      >
        OF NURSING SCIENCES
      </span>
    </div>
  </router-link>
</template>

<style scoped>
</style>
