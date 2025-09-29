<script lang="js">
import { useAuthStore } from '../../stores/auth.js';
import { apiService } from '../../services/api.js';
import { logger } from '@shared/utils/logger';
import Swal from 'sweetalert2';

export default {
  name: "EmailVerification",
  setup() {
    const authStore = useAuthStore();
    return {
      authStore
    };
  },
  data() {
    return {
      token: null,
      verifying: true,
      verificationResult: null,
      error: null,
      resendingEmail: false
    };
  },
  mounted() {
    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    this.token = urlParams.get('token');
    
    if (this.token) {
      this.verifyEmail();
    } else {
      this.verifying = false;
      this.error = 'Invalid verification link';
    }
  },
  methods: {
    async verifyEmail() {
      try {
        this.verifying = true;
        this.error = null;
        
        logger.info('Verifying email with token:', this.token);
        
        const response = await apiService.post('/auth/verify-email', {
          token: this.token
        });
        
        if (response.success) {
          this.verificationResult = response;
          
          // Refresh user data in auth store to update isEmailVerified status
          if (this.authStore.isAuthenticated) {
            logger.info('Refreshing user data after email verification');
            await this.authStore.fetchUserData();
          }
          
          // Show success message
          await Swal.fire({
            title: 'Email Verified!',
            text: 'Your email has been verified successfully. You can now proceed with your application.',
            icon: 'success',
            confirmButtonText: 'Go to Dashboard',
            confirmButtonColor: '#2d7d7d'
          });
          
          // Redirect to dashboard
          this.$router.push('/dashboard');
          
        } else {
          throw new Error(response.message || 'Verification failed');
        }
        
      } catch (error) {
        logger.error('Email verification failed:', error);
        this.error = error.response?.data?.message || error.message || 'Verification failed';
        
        await Swal.fire({
          title: 'Verification Failed',
          text: this.error,
          icon: 'error',
          confirmButtonText: 'OK'
        });
        
      } finally {
        this.verifying = false;
      }
    },
    
    async resendVerificationEmail() {
      try {
        this.resendingEmail = true;
        
        // Get email from user (you might want to get this from auth store)
        const { value: email } = await Swal.fire({
          title: 'Resend Verification Email',
          input: 'email',
          inputLabel: 'Enter your email address',
          inputPlaceholder: 'your.email@example.com',
          showCancelButton: true,
          confirmButtonText: 'Send Email',
          confirmButtonColor: '#2d7d7d'
        });
        
        if (email) {
          const response = await apiService.post('/auth/resend-verification', {
            email: email
          });
          
          if (response.success) {
            await Swal.fire({
              title: 'Email Sent!',
              text: 'A new verification email has been sent to your email address.',
              icon: 'success',
              confirmButtonText: 'OK',
              confirmButtonColor: '#2d7d7d'
            });
          } else {
            throw new Error(response.message || 'Failed to send email');
          }
        }
        
      } catch (error) {
        logger.error('Resend verification email failed:', error);
        
        await Swal.fire({
          title: 'Failed to Send Email',
          text: error.response?.data?.message || error.message || 'Failed to send verification email',
          icon: 'error',
          confirmButtonText: 'OK'
        });
        
      } finally {
        this.resendingEmail = false;
      }
    }
  }
};
</script>

<template>
  <div class="container mt-5 py-5">
    <div class="row justify-content-center">
      <div class="col-md-8 col-lg-6">
        <div class="card shadow-lg border-0 rounded-3">
          <div class="card-body p-5 text-center">
            
            <!-- Verifying State -->
            <div v-if="verifying" class="mb-4">
              <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <h2 class="card-title text-primary mb-3">Verifying Email...</h2>
              <p class="text-muted">Please wait while we verify your email address.</p>
            </div>
            
            <!-- Success State -->
            <div v-else-if="verificationResult && !error" class="mb-4">
              <div class="text-success mb-3">
                <i class="bi bi-check-circle" style="font-size: 4rem;"></i>
              </div>
              <h2 class="card-title text-success mb-3">Email Verified!</h2>
              <p class="text-muted mb-4">
                Your email address has been successfully verified. You can now proceed with your application process.
              </p>
              <button 
                class="btn acon-btn-primary" 
                @click="$router.push('/dashboard')"
              >
                <i class="bi bi-arrow-right me-2"></i>Go to Dashboard
              </button>
            </div>
            
            <!-- Error State -->
            <div v-else class="mb-4">
              <div class="text-danger mb-3">
                <i class="bi bi-exclamation-circle" style="font-size: 4rem;"></i>
              </div>
              <h2 class="card-title text-danger mb-3">Verification Failed</h2>
              <div class="alert alert-danger" role="alert">
                {{ error }}
              </div>
              
              <div class="d-grid gap-2 d-md-flex justify-content-md-center">
                <button 
                  class="btn acon-btn-outline-primary me-md-2" 
                  @click="resendVerificationEmail"
                  :disabled="resendingEmail"
                >
                  <span v-if="resendingEmail" class="spinner-border spinner-border-sm me-2" role="status"></span>
                  <i v-else class="bi bi-envelope me-2"></i>
                  {{ resendingEmail ? 'Sending...' : 'Resend Email' }}
                </button>
                <button 
                  class="btn acon-btn-secondary" 
                  @click="$router.push('/login')"
                >
                  <i class="bi bi-arrow-left me-2"></i>Back to Login
                </button>
              </div>
            </div>
            
          </div>
        </div>
        
        <!-- Help Section -->
        <div class="text-center mt-4">
          <p class="text-muted small">
            Having trouble? Contact our admissions office at 
            <a href="mailto:admissions@acon.edu.ng" class="text-decoration-none">admissions@acon.edu.ng</a>
            or call <a href="tel:+2347084601610" class="text-decoration-none">+234 708 460 1610</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.acon-btn-primary {
  background-color: #2d7d7d;
  border-color: #2d7d7d;
  color: white;
}

.acon-btn-primary:hover {
  background-color: #1f5a5a;
  border-color: #1f5a5a;
}

.acon-btn-outline-primary {
  color: #2d7d7d;
  border-color: #2d7d7d;
}

.acon-btn-outline-primary:hover {
  background-color: #2d7d7d;
  border-color: #2d7d7d;
  color: white;
}

.acon-btn-secondary {
  background-color: #e07a5f;
  border-color: #e07a5f;
  color: white;
}

.acon-btn-secondary:hover {
  background-color: #d16849;
  border-color: #d16849;
}

.card {
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.text-primary {
  color: #2d7d7d !important;
}
</style>