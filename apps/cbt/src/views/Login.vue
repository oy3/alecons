<template>
  <div class="container">
    <div class="row justify-content-center align-items-center vh-100">
      <div class="col-md-6">
        <div class="card shadow">
          <div class="card-header bg-primary text-white text-center">
            <h4 class="mb-0">
              <i class="bi bi-mortarboard me-2"></i>
              CBT Portal Login
            </h4>
          </div>
          <div class="card-body p-5">
            <form @submit.prevent="handleLogin">
              <!-- Email Input -->
              <div class="mb-3">
                <label for="email" class="form-label">
                  <i class="bi bi-envelope me-1"></i>
                  Email Address
                </label>
                <input
                  id="email"
                  v-model="email"
                  type="email"
                  class="form-control"
                  :class="{ 'is-invalid': emailError }"
                  placeholder="Enter your email"
                  required
                >
                <div v-if="emailError" class="invalid-feedback">
                  {{ emailError }}
                </div>
              </div>

              <!-- Password Input -->
              <div class="mb-4">
                <label for="password" class="form-label">
                  <i class="bi bi-lock me-1"></i>
                  Password
                </label>
                <div class="input-group">
                  <input
                    id="password"
                    v-model="password"
                    :type="showPassword ? 'text' : 'password'"
                    class="form-control"
                    :class="{ 'is-invalid': passwordError }"
                    placeholder="Enter your password"
                    required
                  >
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    @click="togglePasswordVisibility"
                  >
                    <i :class="showPassword ? 'bi-eye-slash' : 'bi-eye'"></i>
                  </button>
                </div>
                <div v-if="passwordError" class="invalid-feedback">
                  {{ passwordError }}
                </div>
              </div>

              <!-- Login Button -->
              <button
                type="submit"
                class="btn btn-primary w-100"
                :disabled="isLoading"
              >
                <span v-if="isLoading">
                  <span class="spinner-border spinner-border-sm me-2"></span>
                  Signing in...
                </span>
                <span v-else>
                  <i class="bi bi-box-arrow-in-right me-2"></i>
                  Sign In
                </span>
              </button>
            </form>
          </div>
          <div class="card-footer text-center text-muted">
            <small>
              <i class="bi bi-shield-lock me-1"></i>
              Secure login for exam access
            </small>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../stores/auth.js'
import { logger } from '@shared/utils/logger'
import Swal from 'sweetalert2'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    
    const email = ref('')
    const password = ref('')
    const showPassword = ref(false)
    const isLoading = ref(false)
    const emailError = ref('')
    const passwordError = ref('')

    const validateForm = () => {
      let isValid = true
      
      // Reset errors
      emailError.value = ''
      passwordError.value = ''

      // Email validation
      if (!email.value.trim()) {
        emailError.value = 'Email is required'
        isValid = false
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        emailError.value = 'Please enter a valid email address'
        isValid = false
      }

      // Password validation
      if (!password.value.trim()) {
        passwordError.value = 'Password is required'
        isValid = false
      } else if (password.value.length < 6) {
        passwordError.value = 'Password must be at least 6 characters'
        isValid = false
      }

      return isValid
    }

    const handleLogin = async () => {
      if (!validateForm()) return

      try {
        isLoading.value = true
        
        const result = await authStore.login(
          email.value.trim(),
          password.value
        )

        if (result.success) {
          // Show success message and redirect
          await Swal.fire({
            title: 'Login Successful!',
            text: 'Welcome to CBT Portal',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          })
          router.push('/dashboard')
        } else {
          // Show error with SweetAlert2
          await Swal.fire({
            title: 'Login Failed',
            text: result.message || 'Please check your credentials and try again.',
            icon: 'error',
            confirmButtonColor: '#dc3545'
          })
        }
      } catch (error) {
        logger.error('Login error:', error)
        await Swal.fire({
          title: 'Login Error',
          text: 'An unexpected error occurred. Please try again.',
          icon: 'error',
          confirmButtonColor: '#dc3545'
        })
      } finally {
        isLoading.value = false
      }
    }

    const togglePasswordVisibility = () => {
      showPassword.value = !showPassword.value
    }

    return {
      email,
      password,
      showPassword,
      isLoading,
      emailError,
      passwordError,
      handleLogin,
      togglePasswordVisibility
    }
  }
}
</script>

<style scoped>
.card {
  border: none;
  border-radius: 15px;
}

.card-header {
  border-radius: 15px 15px 0 0 !important;
}

.input-group .btn {
  border-left: none;
}

.form-control:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 0.2rem rgba(26, 95, 95, 0.25);
}

.btn-primary {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  border-radius: 25px;
  padding: 0.75rem 1.5rem;
  font-weight: 500;
}

.btn-primary:hover {
  background-color: var(--secondary-color);
  border-color: var(--secondary-color);
}

.alert {
  border-radius: 10px;
}
</style>