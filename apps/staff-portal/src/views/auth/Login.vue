<script lang="js">
import BrandLogo from '../../components/BrandLogo.vue'
import { logger } from '@shared/utils/logger'
import { useAuthStore } from '../../stores/auth.js'
import Swal from 'sweetalert2'

export default {
  name: 'StaffLogin',
  setup() {
    const authStore = useAuthStore()
    return {
      authStore
    }
  },
  data() {
    return {
      email: '',
      password: '',
      showPassword: false,
      resetEmail: ''
    }
  },
  methods: {
    async onSubmit() {
      try {
        if (!this.email || !this.password) {
          await Swal.fire({
            icon: 'warning',
            title: 'Missing Information',
            text: 'Please enter both email and password',
            confirmButtonColor: '#1a5f5f',
          })
          return
        }

        Swal.fire({
          title: 'Logging in...',
          html: 'Please wait',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading()
          },
        })

        logger.info('Attempting staff login...')

        const result = await this.authStore.login({
          email: this.email,
          password: this.password,
        })

        if (result.success) {
          logger.info('Staff login successful')

          await Swal.fire({
            icon: 'success',
            title: 'Welcome to Staff Portal!',
            text: `Hello ${this.authStore.user?.firstName}!`,
            confirmButtonColor: '#1a5f5f',
            timer: 1500,
            showConfirmButton: false
          })

          this.$router.push('/dashboard')
        } else {
          logger.error('Staff login failed:', result.error)
          await Swal.fire({
            icon: 'error',
            title: 'Login Failed',
            text: result.error || 'Invalid email or password',
            confirmButtonColor: '#1a5f5f',
          })
        }
      } catch (error) {
        logger.error('Staff login error:', error)

        await Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Something went wrong! Please try again.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#1a5f5f',
        })
      }
    },

    togglePasswordVisibility() {
      this.showPassword = !this.showPassword
    },

    async submitForgotPassword() {
      try {
        if (!this.resetEmail) {
          await Swal.fire({
            icon: 'warning',
            title: 'Email Required',
            text: 'Please enter your email address',
            confirmButtonColor: '#1a5f5f',
          })
          return
        }

        Swal.fire({
          title: 'Sending Reset Link...',
          html: 'Please wait',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading()
          },
        })

        // Simulate API call for password reset
        await new Promise(resolve => setTimeout(resolve, 1500))

        logger.info("Sending staff password reset link to:", this.resetEmail)

        await Swal.fire({
          icon: 'success',
          title: 'Reset Link Sent!',
          text: `Password reset instructions have been sent to ${this.resetEmail}`,
          confirmButtonColor: '#1a5f5f',
        })

        const modal = bootstrap.Modal.getInstance(
          document.getElementById("forgotPasswordModal")
        )
        modal.hide()
        this.resetEmail = ''
      } catch (error) {
        logger.error('Staff password reset error:', error)

        await Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Failed to send reset link. Please try again.',
          confirmButtonColor: '#1a5f5f',
        })
      }
    }
  },
  components: { BrandLogo },
}
</script>

<template>
  <div class="staff-login-page d-flex align-items-center justify-content-center p-3">
    <div class="overlay"></div>
    <div class="staff-login-card p-4 shadow-lg" style="min-width: 320px; max-width: 400px; width: 100%;">
      <BrandLogo class="mx-auto mb-4" />
      <h3 class="mb-2 text-center text-staff-primary fw-bold">Staff Portal</h3>
      <p class="text-center text-muted mb-4 small">Enter your assigned login credentials</p>
      
      <form @submit.prevent="onSubmit">
        <div class="mb-3">
          <label for="email" class="form-label text-dark fw-medium">Email Address</label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="form-control"
            placeholder="Enter your email"
            required
            autocomplete="email"
          />
        </div>

        <div class="mb-1">
          <label for="password" class="form-label text-dark fw-medium">Password</label>
          <div class="input-group">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="form-control border-end-0"
              placeholder="Enter your password"
              required
              autocomplete="current-password"
              aria-describedby="password-toggle"
            />
            <button
              class="btn bg-white border border-start-0 text-muted"
              type="button"
              id="password-toggle"
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
            class="text-staff-primary text-decoration-none small"
            data-bs-toggle="modal"
            data-bs-target="#forgotPasswordModal"
          >
            Forgot password?
          </a>
        </div>

        <button
          type="submit"
          class="btn btn-staff-primary w-100 fw-bold"
          :disabled="authStore.isLoading"
        >
          <span v-if="authStore.isLoading">
            <i class="spinner-border spinner-border-sm me-2"></i>
            Logging in...
          </span>
          <span v-else>
            Login
          </span>
        </button>
      </form>

      <div class="text-center mt-4">
        <small class="text-muted">
          <i class="bi bi-shield-check me-1"></i>
          Secure staff access only
        </small>
      </div>
    </div>
  </div>

  <!-- Forgot Password Modal -->
  <div
    class="modal fade"
    id="forgotPasswordModal"
    tabindex="-1"
    aria-labelledby="forgotPasswordLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header border-bottom-0">
          <h5 class="modal-title text-staff-primary fw-bold" id="forgotPasswordLabel">
            Reset Password
          </h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <div class="text-center mb-4">
            <i class="bi bi-shield-lock h1 text-staff-primary"></i>
            <p class="text-muted small mt-2">
              Enter your email address to receive password reset instructions.
            </p>
          </div>

          <div class="mb-3">
            <label for="resetEmail" class="form-label fw-medium">Email Address</label>
            <input
              type="email"
              id="resetEmail"
              class="form-control"
              v-model="resetEmail"
              placeholder="Enter your email"
            />
          </div>
        </div>
        <div class="modal-footer border-top-0">
          <button
            type="button"
            class="btn btn-outline-secondary"
            data-bs-dismiss="modal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-staff-primary"
            @click="submitForgotPassword"
          >
            <i class="bi bi-envelope me-2"></i>
            Send Reset Link
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.staff-login-page {
  background: linear-gradient(135deg, var(--staff-primary) 0%, var(--staff-secondary) 50%, var(--staff-accent) 100%);
  min-height: 100vh;
  position: relative;
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.1);
  z-index: 1;
}

.staff-login-card {
  position: relative;
  z-index: 2;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);
}

.form-control:focus {
  border-color: var(--staff-primary);
  box-shadow: 0 0 0 0.25rem rgba(26, 95, 95, 0.25);
}

.btn-outline-secondary:hover {
  background-color: #6c757d;
  border-color: #6c757d;
}
</style>