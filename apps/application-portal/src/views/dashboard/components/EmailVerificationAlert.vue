<script lang="js">
import { useAuthStore } from '../../../stores/auth.js';
import { apiService } from '../../../services/api.js';
import { logger } from '@shared/utils/logger';
import Swal from 'sweetalert2';

export default {
  name: "EmailVerificationAlert",
  setup() {
    const authStore = useAuthStore();
    return {
      authStore
    };
  },
  props: {
    user: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      resendingEmail: false,
      refreshingData: false
    };
  },
  computed: {
    needsVerification() {
      return !this.user?.isEmailVerified;
    }
  },
  methods: {
    async resendVerificationEmail() {
      try {
        this.resendingEmail = true;

        logger.info('Resending verification email to:', this.user.email);

        const response = await apiService.post('/auth/resend-verification', {
          email: this.user.email
        });

        if (response.success) {
          await Swal.fire({
            title: 'Email Sent!',
            text: 'A new verification email has been sent to your email address. Please check your inbox and spam folder.',
            icon: 'success',
            confirmButtonText: 'OK',
            confirmButtonColor: '#2d7d7d'
          });
        } else {
          throw new Error(response.message || 'Failed to send email');
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
    },

    async refreshUserData() {
      try {
        this.refreshingData = true;
        logger.info('Manually refreshing user data to check verification status');
        await this.authStore.fetchUserData();

        // Show success message if verification status changed
        if (this.authStore.user?.isEmailVerified) {
          await Swal.fire({
            title: 'Success!',
            text: 'Your email verification status has been updated.',
            icon: 'success',
            confirmButtonText: 'OK',
            confirmButtonColor: '#2d7d7d'
          });
        }
      } catch (error) {
        logger.error('Failed to refresh user data:', error);
        await Swal.fire({
          title: 'Refresh Failed',
          text: 'Failed to refresh verification status. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      } finally {
        this.refreshingData = false;
      }
    }
  }
};
</script>

<template>
  <div
    v-if="needsVerification"
    class="alert alert-warning border-0 shadow-sm mb-4"
    role="alert"
  >
    <div class="d-flex align-items-center">
      <div class="col-md-1">
        <i
          class="bi bi-envelope-exclamation text-warning"
          style="font-size: 1.5rem"
        ></i>
      </div>

      <div class="col-md-11">
        <h6 class="alert-heading mb-2">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Email Verification Required
        </h6>

        <p class="mb-2">
          Please verify your email address to continue with your application
          process. <span class="small">We've sent a verification link to
          <strong>{{ user.email }}.</strong> </span>
          <span class="small text-muted">
            Check your inbox and spam folder for the verification email.
          </span>
        </p>

        <button
          class="btn btn-outline-warning btn-sm mb-2"
          @click="refreshUserData"
          :disabled="resendingEmail || refreshingData"
          title="Check if email was verified"
        >
          <span
            v-if="refreshingData"
            class="spinner-border spinner-border-sm me-2"
            role="status"
          ></span>
          <i v-else class="bi bi-arrow-repeat me-2"></i>
          {{ refreshingData ? "Checking..." : "Refresh Status" }}
        </button>

        <div>
          <small class="text-muted">
            Didn’t receive the email?
            <button
              class="btn btn-link btn-sm p-0"
              @click="resendVerificationEmail"
              :disabled="resendingEmail || refreshingData"
            >
              <span
                v-if="resendingEmail"
                class="spinner-border spinner-border-sm me-2"
                role="status"
              ></span>
              {{ resendingEmail ? "Sending..." : "Resend" }}
            </button>
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alert-warning {
  background-color: #fff8e1;
  border-left: 4px solid #ff9800;
}

.btn-outline-warning {
  --bs-btn-color: #e65100;
  --bs-btn-border-color: #ff9800;
  --bs-btn-hover-bg: #ff9800;
  --bs-btn-hover-border-color: #ff9800;
}

.btn-outline-info {
  --bs-btn-color: #0277bd;
  --bs-btn-border-color: #03a9f4;
  --bs-btn-hover-bg: #03a9f4;
  --bs-btn-hover-border-color: #03a9f4;
}

.text-warning {
  color: #e65100 !important;
}

.btn-group .btn {
  border-radius: 0.375rem;
  margin-left: 0.25rem;
}

.btn-group .btn:first-child {
  margin-left: 0;
}
</style>
