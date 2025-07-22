<script lang="js">
export default {
  name: "Header",
  components: {},
};
</script>

<template>
  <nav class="navbar navbar-expand-lg d-flex flex-column fixed-top pt-0">
    <div class="container-fluid acon-bg-primary small">
      <div>
        <span class="navbar-text text-white me-3">
          <i class="bi bi-telephone me-1"></i> +234 708 460 1610
        </span>
        <span class="navbar-text text-white">
          <i class="bi bi-envelope-at me-1"></i> admissions@acon.edu.ng
        </span>
      </div>
      <span class="navbar-text text-white">Omuo Oke, Ekiti State, Nigeria</span>
    </div>
    <div class="container-fluid bg-white py-2">
      <a class="navbar-brand d-flex align-items-center" href="#">
        <img
          src="/src/assets/img/logo.png"
          alt="Logo"
          width="50"
          class="d-inline-block align-text-top me-2"
        />
        <div class="text-start text-uppercase d-flex flex-column">
          <span class="fw-bold acon-text-primary">ALEBIOSU COLLEGE</span>
          <span
            class="fw-light text-secondary fs-6"
            style="letter-spacing: 1.5px"
          >
            OF NURSING Sciences
          </span>
        </div>
      </a>
      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarText"
        aria-controls="navbarText"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarText">
        <ul class="navbar-nav mx-auto mb-2 mb-lg-0">
          <li class="nav-item">
            <a
              class="nav-link"
              :class="{ 'active acon-active': $route.name === 'Home' }"
              aria-current="page"
              href="#"
              >Home</a
            >
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#">About</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#">Programs</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#">Faculty</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#">Admissions</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#">Contact</a>
          </li>
        </ul>
        <button type="button" class="btn btn-outline-acon-primary me-2">
          Apply Now
        </button>
        <button type="button" class="btn btn-acon-secondary">
          Virtual Tour
        </button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.nav-link.acon-active {
  color: #2d7d7d !important;
  font-weight: 500;
}
</style>
