<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import Swal from 'sweetalert2'
import { logger } from '@shared/utils/logger'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const auth = useAuthStore()

    const form = ref({
      email: '',
      password: '',
      remember: false
    })

    const showPassword = ref(false)
    const loginError = ref('')

    const isFormValid = computed(() => {
      return form.value.email && form.value.password
    })

    const togglePassword = () => {
      showPassword.value = !showPassword.value
    }

    const handleLogin = async () => {
      if (!isFormValid.value) return
      
      // Clear any previous error
      loginError.value = ''

      try {
        const result = await auth.login({
          email: form.value.email,
          password: form.value.password
        })

        if (result.success) {
          await Swal.fire({
            icon: 'success',
            title: 'Welcome Back!',
            text: `Hello ${auth.userName}, welcome to your student portal.`,
            timer: 2000,
            showConfirmButton: false,
            background: '#fff',
            color: '#1a5f5f'
          })

          router.push({ name: 'Dashboard' })
        } else {
          loginError.value = result.error || 'Please check your credentials and try again.'
        }
      } catch (error) {
        logger.error('Login error:', error)
        loginError.value = 'An unexpected error occurred. Please try again.'
      }
    }

    onMounted(() => {
      // Set focus on email input
      const emailInput = document.getElementById('email')
      if (emailInput) {
        emailInput.focus()
      }
    })

    return {
      auth,
      form,
      showPassword,
      loginError,
      isFormValid,
      togglePassword,
      handleLogin
    }
  }
}
</script>

<template>
  <div class="login-container d-flex align-items-center justify-content-center">
    <div class="login-card card shadow-lg">
      <div class="card-body p-5">
        <div class="login-header">
          <div class="mb-4">
          <img src="@shared/assets/logo.png" alt="Logo" width="70" class="" />
          </div>
          <h2>Student Portal</h2>
          <p>Sign in to access your courses and academic progress</p>
        </div>

        <!-- Error Alert -->
        <div v-if="loginError" class="alert alert-danger" role="alert">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>
          {{ loginError }}
        </div>

        <!-- Login Form -->
        <form @submit.prevent="handleLogin">
          <div class="mb-3">
            <label for="email" class="form-label">
              <i class="bi bi-envelope me-2"></i>Email Address
            </label>
            <input
              type="email"
              class="form-control"
              id="email"
              v-model="form.email"
              :disabled="auth.loading"
              required
              autocomplete="email"
              placeholder="Enter your email"
            />
          </div>

          <div class="mb-4">
            <label for="password" class="form-label">
              <i class="bi bi-lock me-2"></i>Password
            </label>
            <div class="input-group">
              <input
                :type="showPassword ? 'text' : 'password'"
                class="form-control border-end-0"
                id="password"
                v-model="form.password"
                :disabled="auth.loading"
                required
                autocomplete="current-password"
                placeholder="Enter your password"
              />
              <button
                type="button"
                class="btn bg-white border-2 border-light-subtle border-start-0"
                @click="togglePassword"
                :disabled="auth.loading"
              >
                <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
              </button>
            </div>
          </div>

          <div class="mb-3 form-check">
            <input
              type="checkbox"
              class="form-check-input"
              id="remember"
              v-model="form.remember"
              :disabled="auth.loading"
            />
            <label class="form-check-label" for="remember">
              Remember me
            </label>
          </div>

          <button
            type="submit"
            class="btn btn-primary w-100 mb-3"
            :disabled="auth.loading || !isFormValid"
          >
            <span v-if="auth.loading">
              <span class="loading-spinner me-2"></span>
              Signing in...
            </span>
            <span v-else>
              <i class="bi bi-box-arrow-in-right me-2"></i>
              Sign In
            </span>
          </button>
        </form>

        <div class="text-center">
          <small class="text-muted">
            Need help? Contact <a href="mailto:support@alecons.edu" class="text-primary">support@alecons.edu</a>
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  position: relative;
  overflow: hidden;
}

.login-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)" /></svg>');
}

.login-card {
  position: relative;
  z-index: 1;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.input-group .btn {
  border-left: none;
}

.form-control:focus + .btn,
.form-control:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 0.2rem rgba(26, 95, 95, 0.15);
}

@media (max-width: 576px) {
  .login-card {
    margin: 1rem;
  }
  
  .card-body {
    padding: 2rem !important;
  }
}
</style>