<script lang="js">
import BrandLogo from '../../components/BrandLogo.vue';
import { logger } from '@shared/utils/logger';
import { useAuthStore } from '../../stores/auth.js';
import { apiService } from '../../services/api.js';
import Swal from 'sweetalert2';

export default {
  name: 'LoginPage',
  inheritAttrs: false,
  setup() {
    const authStore = useAuthStore();
    return {
      authStore
    };
  },
  data() {
    return {
      email: '',
      password: '',
      resetEmail: '',
      showPassword: false
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

        // Use Pinia store login
        logger.info('Attempting login with auth store...');

        const result = await this.authStore.login({
          email: this.email,
          password: this.password,
        });

        if (result.success) {
          logger.info('Login successful');

          // Success message
          await Swal.fire({
            icon: 'success',
            title: 'Welcome!',
            text: `Hello ${this.authStore.user?.firstName}!`,
            confirmButtonColor: '#2d7d7d',
            timer: 1500,
            showConfirmButton: false
          });

          // Navigate to the My Applications landing page
          this.$router.push('/my-applications');
        } else {
          // Login failed
          logger.error('Login failed:', result.error);
          await Swal.fire({
            icon: 'error',
            title: 'Login Failed',
            text: result.error || 'Invalid email or password',
            confirmButtonColor: '#2d7d7d',
          });
        }
      } catch (error) {
        logger.error('Login error:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });

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
    togglePasswordVisibility() {
      this.showPassword = !this.showPassword;
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

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.resetEmail)) {
          await Swal.fire({
            icon: 'warning',
            title: 'Invalid Email',
            text: 'Please enter a valid email address',
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

        logger.info("Requesting password reset for:", this.resetEmail);

        // Call API to reset password
        const result = await apiService.forgotPassword(this.resetEmail);

        if (result.success) {
          // Clear email field
          this.resetEmail = '';
          
          // Close modal programmatically using the close button
          const closeButton = document.querySelector('#forgotPasswordModal .btn-close');
          if (closeButton) {
            closeButton.click();
          }

          // Show success message after modal starts closing
          await Swal.fire({
            icon: 'success',
            title: 'Password Reset Sent!',
            text: `A new password has been sent to ${this.resetEmail}. Please check your email.`,
            confirmButtonColor: '#2d7d7d',
          });
          
          logger.info('Password reset successful');
        } else {
          // Handle API error
          throw new Error(result.error || 'Failed to reset password');
        }
      } catch (error) {
        logger.error('Password reset error:', error);

        await Swal.fire({
          icon: 'error',
          title: 'Reset Failed',
          text: error.message || 'Failed to send reset link. Please try again.',
          confirmButtonColor: '#2d7d7d',
        });
      }
    }
  },
  components: {BrandLogo},
};
</script>

<template>
  <div
    class="login-page d-flex align-items-center justify-content-center"
    v-bind="$attrs"
  >
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
          <label for="email" class="form-label text-white">Email Address</label>
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
          <div class="input-group">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="form-control bg-dark bg-opacity-25 text-white  border-end-0 border-light border-opacity-25"
              placeholder="********"
              required
              autocomplete="current-password"
              aria-describedby="password-addon2"
            />
            <button
              class="btn bg-dark bg-opacity-25 border-start-0 border-light border-opacity-25 text-light"
              type="button"
              id="password-addon2"
              @click="togglePasswordVisibility"
              :title="showPassword ? 'Hide password' : 'Show password'"
            >
              <i :class="showPassword ? 'bi bi-eye' : 'bi bi-eye-slash'"></i>
            </button>
          </div>
        </div>

        <div class="text-end mb-3">
          <a
            href="#"
            class="acon-link acon-text-secondary text-opacity-75 text-decoration-none small"
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
                <i class="bi bi-fingerprint h1 acon-bg-primary rounded p-2"></i>
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
