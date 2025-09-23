<script lang="js">
import { useAuth, authManager } from "../../services/auth.js";
import { logger } from '@shared/utils/logger';
import Swal from "sweetalert2";
import { apiService } from "../../services/api.js";

export default {
  name: "Settings",
  setup() {
    const { user, isAuthenticated, application } = useAuth();
    return {
      user,
      isAuthenticated,
      application
    };
  },
  data() {
    return {
      passwordForm: {
        currentPassword: '',
        newPassword: ''
      },
      showCurrentPassword: false,
      showNewPassword: false,
      isChangingPassword: false
    };
  },
  methods: {
    togglePasswordVisibility(field) {
      if (field === 'current') {
        this.showCurrentPassword = !this.showCurrentPassword;
      } else if (field === 'new') {
        this.showNewPassword = !this.showNewPassword;
      }
    },

    async changePassword() {
      // Check authentication first
      if (!this.isAuthenticated || !this.user) {
        await Swal.fire({
          icon: 'warning',
          title: 'Authentication Required',
          text: 'Please log in to change your password.',
        });
        return;
      }

      // Validation
      if (!this.passwordForm.currentPassword || !this.passwordForm.newPassword) {
        Swal.fire({
          icon: 'warning',
          title: 'Missing Information',
          text: 'Please fill in both current and new password fields.',
        });
        return;
      }

      if (this.passwordForm.newPassword.length < 6) {
        Swal.fire({
          icon: 'warning',
          title: 'Password Too Short',
          text: 'New password must be at least 6 characters long.',
        });
        return;
      }

      if (this.passwordForm.currentPassword === this.passwordForm.newPassword) {
        Swal.fire({
          icon: 'warning',
          title: 'Same Password',
          text: 'New password must be different from current password.',
        });
        return;
      }

      // Confirmation dialog
      const result = await Swal.fire({
        title: 'Change Password?',
        text: 'Are you sure you want to change your password?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, change it!'
      });

      if (!result.isConfirmed) {
        return;
      }

      try {
        this.isChangingPassword = true;

        // Make API call to change password
        const response = await apiService.post('/auth/change-password', {
          currentPassword: this.passwordForm.currentPassword,
          newPassword: this.passwordForm.newPassword
        });

        if (response.success) {
          // Success
          await Swal.fire({
            icon: 'success',
            title: 'Password Changed!',
            text: 'Your password has been updated successfully.',
            confirmButtonColor: '#3085d6'
          });

          // Clear form
          this.passwordForm.currentPassword = '';
          this.passwordForm.newPassword = '';
          this.showCurrentPassword = false;
          this.showNewPassword = false;

          logger.info('Password changed successfully for user:', this.user?.email);
        } else {
          throw new Error(response.message || 'Failed to change password');
        }
      } catch (error) {
        logger.error('Password change error:', error);

        await Swal.fire({
          icon: 'error',
          title: 'Password Change Failed',
          text: error.response?.data?.message || error.message || 'An error occurred while changing your password. Please try again.',
          confirmButtonColor: '#d33'
        });
      } finally {
        this.isChangingPassword = false;
      }
    }
  },
  components: {},
};
</script>

<template>
  <div class="mt-3 p-5">
    <h5>Account</h5>
    <p class="small text-muted">Manage your profile</p>
    <hr />

    <div class="row">
      <div class="col-md-8">
        <div class="d-flex align-items-center mb-5">
          <img
            src="https://placehold.co/100"
            class="rounded-circle me-3"
            width="100"
            height="100"
          />
          <div>
            <h6>Profile picture</h6>
            <p class="small text-muted mb-0">PNG, JPG up to 5MB</p>
            <a
              class="small link-offset-2 link-offset-3-hover link-underline link-underline-opacity-0 link-underline-opacity-75-hover"
              href="#"
            >
              Update
            </a>
          </div>
        </div>

        <h6>Details</h6>
        <div class="mb-5 row g-3">
          <div class="col-md-6">
            <label for="settingsFirstName" class="form-label small">
              First Name
            </label>
            <input
              type="email"
              class="form-control"
              id="settingsFirstName"
              v-model="user.firstName"
              placeholder="Enter your first name"
              disabled
            />
          </div>
          <div class="col-md-6">
            <label for="settingsLastName" class="form-label small">
              Last Name
            </label>
            <input
              type="email"
              class="form-control"
              id="settingsLastName"
              v-model="user.lastName"
              placeholder="Enter your last name"
              disabled
            />
          </div>
          <div class="col-md-12">
            <label for="settingsEmail" class="form-label small">
              Email address
            </label>
            <input
              type="email"
              class="form-control"
              id="settingsEmail"
              v-model="user.email"
              placeholder="name@example.com"
              disabled
            />
          </div>
        </div>

        <h6>Change Password</h6>
        <form @submit.prevent="changePassword">
          <div class="mb-5 row g-3">
            <div class="col-md-12">
              <label for="currentPassword" class="form-label small">
                Current Password
              </label>

              <div class="input-group">
                <input
                  :type="showCurrentPassword ? 'text' : 'password'"
                  class="form-control border-end-0"
                  id="currentPassword"
                  v-model="passwordForm.currentPassword"
                  placeholder="Enter current password"
                  aria-label="Current password"
                  aria-describedby="toggle-current-pwd"
                  :disabled="isChangingPassword"
                />
                <button
                  class="btn border border-start-0 text-muted"
                  type="button"
                  id="toggle-current-pwd"
                  @click="togglePasswordVisibility('current')"
                  :disabled="isChangingPassword"
                >
                  <i
                    :class="
                      showCurrentPassword ? 'bi bi-eye-slash' : 'bi bi-eye'
                    "
                  ></i>
                </button>
              </div>
            </div>

            <div class="col-md-12">
              <label for="newPassword" class="form-label small">
                New Password
              </label>
              <div class="input-group">
                <input
                  :type="showNewPassword ? 'text' : 'password'"
                  class="form-control border-end-0"
                  id="newPassword"
                  v-model="passwordForm.newPassword"
                  minlength="6"
                  placeholder="Enter new password"
                  aria-label="New password"
                  aria-describedby="toggle-new-pwd"
                  :disabled="isChangingPassword"
                />
                <button
                  class="btn border border-start-0 text-muted"
                  type="button"
                  id="toggle-new-pwd"
                  @click="togglePasswordVisibility('new')"
                  :disabled="isChangingPassword"
                >
                  <i
                    :class="showNewPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"
                  ></i>
                </button>
              </div>
              <small class="form-text text-muted">
                Password must be at least 6 characters long.
              </small>
            </div>

            <div class="col-md-12">
              <button
                type="submit"
                class="btn btn-acon-dark"
                :disabled="
                  isChangingPassword ||
                  !passwordForm.currentPassword ||
                  !passwordForm.newPassword
                "
              >
                <span
                  v-if="isChangingPassword"
                  class="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                {{
                  isChangingPassword
                    ? "Changing Password..."
                    : "Change Password"
                }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.input-group input:disabled {
  background-color: #f8f9fa;
}

.input-group button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-control:disabled {
  background-color: #e9ecef;
  opacity: 1;
}
</style>
