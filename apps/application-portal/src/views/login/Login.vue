<script lang="js">
import BrandLogo from '../../components/BrandLogo.vue';

export default {
  name: 'LoginPage',
  data() {
    return {
      appNumber: '',
      password: '',
        email: ''
    };
  },
  methods: {
    onSubmit() {
      // Handle login submission logic here
      alert(`Logging in with Application Number: ${this.appNumber}`);
      this.$router.push({ name: 'Dashboard' });
    },
     submitForgotPassword() {
      if (!this.email) {
        alert("Please enter your email address");
        return;
      }
      // Example: Call API
      console.log("Sending reset link to:", this.email);
      alert(`Password reset link sent to ${this.email}`);

      // Close modal programmatically
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("forgotPasswordModal")
      );
      modal.hide();
    }
  },
  components: {BrandLogo},
};
</script>

<template>
  <div class="login-page d-flex align-items-center justify-content-center">
    <div class="overlay"></div>
    <div
      class="login-card card p-4 shadow-lg text-white bg-dark bg-opacity-25 border border-light border-opacity-25"
      style="
        min-width: 320px;
        max-width: 400px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      "
    >
      <BrandLogo class="mx-auto mb-4" />
      <h3 class="mb-4 text-center">Application Login</h3>
      <form @submit.prevent="onSubmit">
        <div class="mb-3">
          <label for="appNumber" class="form-label text-white"
            >Application Number</label
          >
          <input
            id="appNumber"
            v-model="appNumber"
            type="text"
            class="form-control bg-dark bg-opacity-25 text-white border-light border-opacity-25"
            placeholder="Enter application number"
            required
            autocomplete="off"
          />
        </div>

        <div class="mb-1">
          <label for="password" class="form-label text-white">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="form-control bg-dark bg-opacity-25 text-white border-light border-opacity-25"
            placeholder="********"
            required
            autocomplete="current-password"
          />
        </div>

        <div class="text-end mb-3">
          <a
            href="#"
            class="acon-link acon-text-primary text-opacity-75 text-decoration-none small"
            data-bs-toggle="modal"
            data-bs-target="#forgotPasswordModal"
          >
            Forgot password?
          </a>
        </div>

        <button
          type="submit"
          class="btn btn-outline-light btn-lg w-100 fw-bold mt-2"
          style="--bs-btn-hover-color: #2d7d7d"
        >
          Login
        </button>
      </form>
    </div>
  </div>

  <!-- Fullscreen Modal -->
  <div
    class="modal fade"
    id="forgotPasswordModal"
    tabindex="-1"
    aria-labelledby="forgotPasswordLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-fullscreen">
      <div class="modal-content acon-bg-dark">
        <div class="modal-header border-bottom-0">
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="d-flex align-items-center justify-content-center h-100">
          <div
            class="border-0 p-4 rounded-4"
            style="max-width: 500px; width: 100%"
          >
            <div class="card-body">
              <div class="text-center mb-5">
                <i
                  class="bi bi-fingerprint h1 acon-bg-primary rounded p-2"
                ></i>
              </div>
              <h4 class="fw-bold text-center mb-3">Forgot password?</h4>
              <p class="text-center small mb-4">
                Enter your email address to receive password reset instructions.
              </p>

              <!-- Email Input -->
              <div class="mb-3">
                <label for="email" class="form-label small fw-semibold"
                  >Email Address</label
                >
                <input
                  type="email"
                  id="email"
                  class="form-control"
                  v-model="email"
                  placeholder="Enter your email"
                />
              </div>

              <button
                class="btn btn-acon-primary w-100 mb-5"
                @click="submitForgotPassword"
              >
                Reset password
              </button>

              <div class="text-center">
                <a
                  class="acon-text-secondary acon-primary-link"
                  href="#"
                  data-bs-dismiss="modal"
                >
                  <i class="bi bi-arrow-left"></i> Back to log in
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  height: 100vh;
  width: 100vw;
  background-image: url("@shared/assets/campus.jpg");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  overflow: hidden;
}

.overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(38, 70, 83, 0.8);
  z-index: 1;
}

.login-card {
  position: relative;
  z-index: 2;
  border-radius: 1rem;
}

.form-control::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.form-control:focus {
  background-color: rgba(0, 0, 0, 0.4) !important;
  border-color: rgba(255, 255, 255, 0.5) !important;
  color: white;
  box-shadow: 0 0 0 0.25rem rgba(255, 255, 255, 0.1);
}
</style>
