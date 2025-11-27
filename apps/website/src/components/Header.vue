<script lang="js">
export default {
  name: "Header",
  components: {},
  computed: {
    registrationUrl() {
      return import.meta.env.VITE_APP_APPLICATION_PORTAL_URL + "/register";
    },
    applicationPortalUrl() {
      return import.meta.env.VITE_APP_APPLICATION_PORTAL_URL;
    }
  },
  methods: {
    closeNavbar() {
      // Close the navbar collapse when a link is clicked
      const navbarCollapse = document.getElementById('navbarText');
      const navbarToggler = document.querySelector('.navbar-toggler');
      
      if (navbarCollapse && navbarCollapse.classList.contains('show')) {
        // Remove the 'show' class to close the navbar
        navbarCollapse.classList.remove('show');
        
        // Update the toggler button state
        if (navbarToggler) {
          navbarToggler.setAttribute('aria-expanded', 'false');
          navbarToggler.classList.add('collapsed');
        }
      }
    }
  }
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
          <i class="bi bi-envelope-at me-1"></i> admissions@alecons.edu.ng
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
            OF NURSING SCIENCES
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
            <router-link
              to="/"
              class="nav-link"
              :class="{ 'active acon-active': $route.name === 'Home' }"
              @click="closeNavbar"
            >
              Home
            </router-link>
          </li>
          <li class="nav-item">
            <router-link
              to="/about"
              class="nav-link"
              :class="{ 'active acon-active': $route.name === 'About' }"
              @click="closeNavbar"
            >
              About
            </router-link>
          </li>
          <li class="nav-item">
            <router-link
              to="/programs"
              class="nav-link"
              :class="{ 'active acon-active': $route.name === 'Programs' }"
              @click="closeNavbar"
            >
              Programs
            </router-link>
          </li>
          <li class="nav-item">
            <router-link
              to="/faculty"
              class="nav-link"
              :class="{ 'active acon-active': $route.name === 'Faculty' }"
              @click="closeNavbar"
            >
              Faculty
            </router-link>
          </li>
          <li class="nav-item">
            <router-link
              to="/admissions"
              class="nav-link"
              :class="{ 'active acon-active': $route.name === 'Admissions' }"
              @click="closeNavbar"
            >
              Admissions
            </router-link>
          </li>
          <li class="nav-item">
            <router-link
              to="/contact"
              class="nav-link"
              :class="{ 'active acon-active': $route.name === 'Contact' }"
              @click="closeNavbar"
            >
              Contact
            </router-link>
          </li>
        </ul>
        <a
          :href="registrationUrl"
          target="_blank"
          class="btn btn-outline-acon-primary me-2"
          rel="noopener noreferrer"
        >
          Apply Now
        </a>
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
  font-weight: 600 !important;
}
</style>
