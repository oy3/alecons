<script lang="js">
import BrandLogo from '../../components/BrandLogo.vue';
import { logger } from '@shared/utils/logger';
import { apiService } from '../../services/api.js';
import { authManager } from '../../services/auth.js';
import Swal from 'sweetalert2';

export default {
  name: 'LoginPage',
  inheritAttrs: false, // Add this to handle non-prop attributes
  data() {
    return {
      email: '',
      password: '',
      resetEmail: ''
    };
  },
  methods: {
    async onSubmit() {
      try {
        // Validate inputs
        if (!this.email || !this.password) {
          await Swal.fire({
            icon: 'warning',
            title: 'Missing Information',
            text: 'Please enter both email and password',
            confirmButtonColor: '#2d7d7d',
          });
          return;
        }

        // Show loading state
        Swal.fire({
          title: 'Logging in...',
          html: 'Please wait',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        // Call backend API
        const result = await apiService.login({
          email: this.email,
          password: this.password,
        });

        if (result.success) {
          logger.info('Login successful:', result.data.user);
          
          // Set authentication using auth manager
          authManager.setAuth(
            result.data.user,
            result.data.access_token,
            result.data.application
          );
          
          // Success message
          await Swal.fire({
            icon: 'success',
            title: 'Welcome!',
            text: `Welcome back, ${result.data.user.firstName}!`,
            timer: 1500,
            showConfirmButton: false,
          });
          
          this.$router.push({ name: 'Dashboard' });
        } else {
          // Handle API errors
          await Swal.fire({
            icon: 'error',
            title: 'Login Failed',
            text: result.error || 'Please check your credentials and try again',
            confirmButtonColor: '#2d7d7d',
          });
        }
      } catch (error) {
        logger.error('Login error:', error);
        
        // Show error message
        await Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Something went wrong! Please try again.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#2d7d7d',
        });
      }
    },
     async submitForgotPassword() {
      try {
        if (!this.resetEmail) {
          await Swal.fire({
            icon: 'warning',
            title: 'Email Required',
            text: 'Please enter your email address',
            confirmButtonColor: '#2d7d7d',
          });
          return;
        }

        // Show loading state
        Swal.fire({
          title: 'Sending Reset Link...',
          html: 'Please wait',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        // Simulate API call (replace with actual API call)
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        logger.info("Sending reset link to:", this.resetEmail);

        // Show success message
        await Swal.fire({
          icon: 'success',
          title: 'Reset Link Sent!',
          text: `Password reset instructions have been sent to ${this.resetEmail}`,
          confirmButtonColor: '#2d7d7d',
        });

        // Close modal programmatically
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("forgotPasswordModal")
        );
        modal.hide();

        // Clear email field
        this.resetEmail = '';
      } catch (error) {
        logger.error('Password reset error:', error);
        
        await Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Failed to send reset link. Please try again.',
          confirmButtonColor: '#2d7d7d',
        });
      }
    }
  },
  components: {BrandLogo},
};
</script>

<template>
  <div class="login-page d-flex align-items-center justify-content-center" v-bind="$attrs">
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
          <label for="email" class="form-label text-white"
            >Email Address</label
          >
          <input
            id="email"
            v-model="email"
            type="email"
            class="form-control bg-dark bg-opacity-25 text-white border-light border-opacity-25"
            placeholder="Enter your email"
            required
            autocomplete="email"
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
                <label for="resetEmail" class="form-label small fw-semibold"
                  >Email Address</label
                >
                <input
                  type="email"
                  id="resetEmail"
                  class="form-control"
                  v-model="resetEmail"
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
