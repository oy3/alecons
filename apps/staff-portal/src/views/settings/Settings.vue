<script lang="js">
import { useAuthStore } from '../../stores/auth.js'
import { apiService } from '../../services/api.js'
import { logger } from '@shared/utils/logger'

export default {
  name: 'StaffSettings',
  setup() {
    const authStore = useAuthStore()
    return {
      authStore
    }
  },
  data() {
    return {
      activeTab: 'profile',
      isLoading: false,
      isSaving: false,
      
      // Profile Settings
      profileForm: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        department: '',
        position: ''
      },

      // Password Change
      passwordForm: {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      },

      // System Settings
      systemSettings: {
        emailNotifications: true,
        smsNotifications: false,
        applicationAlerts: true,
        systemMaintenance: false,
        autoLogout: 30,
        sessionTimeout: 60
      },

      // Application Settings
      applicationSettings: {
        allowFileUploads: true,
        maxFileSize: 10,
        allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'png'],
        autoApproval: false,
        requireEmailVerification: true
      },

      showCurrentPassword: false,
      showNewPassword: false,
      showConfirmPassword: false,
      
      departments: [
        'Admissions',
        'Academic Affairs',
        'Student Services',
        'Finance',
        'IT Support',
        'Administration'
      ],

      positions: [
        'Administrator',
        'Manager',
        'Staff',
        'Supervisor'
      ]
    }
  },
  async mounted() {
    await this.loadUserProfile()
    await this.loadSystemSettings()
  },
  methods: {
    async loadUserProfile() {
      try {
        this.isLoading = true
        logger.info('Loading user profile...')

        // Populate from auth store if available
        if (this.authStore.user) {
          this.profileForm = {
            firstName: this.authStore.user.firstName || '',
            lastName: this.authStore.user.lastName || '',
            email: this.authStore.user.email || '',
            phone: this.authStore.user.phone || '',
            department: this.authStore.user.department || '',
            position: this.authStore.user.position || ''
          }
        }

        logger.info('User profile loaded successfully')
      } catch (error) {
        logger.error('Failed to load user profile:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Load Failed',
          text: 'Failed to load user profile settings'
        })
      } finally {
        this.isLoading = false
      }
    },

    async loadSystemSettings() {
      try {
        logger.info('Loading system settings...')
        // Mock API call - replace with actual API
        await new Promise(resolve => setTimeout(resolve, 500))
        
        logger.info('System settings loaded successfully')
      } catch (error) {
        logger.error('Failed to load system settings:', error)
      }
    },

    async saveProfile() {
      try {
        this.isSaving = true
        logger.info('Saving profile settings...')

        // Validate form
        if (!this.profileForm.firstName || !this.profileForm.lastName || !this.profileForm.email) {
          this.$swal.fire({
            icon: 'warning',
            title: 'Validation Error',
            text: 'Please fill in all required fields'
          })
          return
        }

        // Mock API call - replace with actual API
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Update auth store
        await this.authStore.updateProfile(this.profileForm)

        this.$swal.fire({
          icon: 'success',
          title: 'Profile Updated',
          text: 'Your profile has been updated successfully',
          timer: 2000,
          showConfirmButton: false
        })

        logger.info('Profile settings saved successfully')
      } catch (error) {
        logger.error('Failed to save profile settings:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: 'Failed to update profile settings'
        })
      } finally {
        this.isSaving = false
      }
    },

    async changePassword() {
      try {
        this.isSaving = true
        logger.info('Changing password...')

        // Validate passwords
        if (!this.passwordForm.currentPassword || !this.passwordForm.newPassword || !this.passwordForm.confirmPassword) {
          this.$swal.fire({
            icon: 'warning',
            title: 'Validation Error',
            text: 'Please fill in all password fields'
          })
          return
        }

        if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
          this.$swal.fire({
            icon: 'warning',
            title: 'Password Mismatch',
            text: 'New password and confirmation do not match'
          })
          return
        }

        if (this.passwordForm.newPassword.length < 8) {
          this.$swal.fire({
            icon: 'warning',
            title: 'Weak Password',
            text: 'Password must be at least 8 characters long'
          })
          return
        }

        // Mock API call - replace with actual API
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Clear form
        this.passwordForm = {
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }

        this.$swal.fire({
          icon: 'success',
          title: 'Password Changed',
          text: 'Your password has been changed successfully',
          timer: 2000,
          showConfirmButton: false
        })

        logger.info('Password changed successfully')
      } catch (error) {
        logger.error('Failed to change password:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Change Failed',
          text: 'Failed to change password'
        })
      } finally {
        this.isSaving = false
      }
    },

    async saveSystemSettings() {
      try {
        this.isSaving = true
        logger.info('Saving system settings...')

        // Mock API call - replace with actual API
        await new Promise(resolve => setTimeout(resolve, 1000))

        this.$swal.fire({
          icon: 'success',
          title: 'Settings Saved',
          text: 'System settings have been updated successfully',
          timer: 2000,
          showConfirmButton: false
        })

        logger.info('System settings saved successfully')
      } catch (error) {
        logger.error('Failed to save system settings:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: 'Failed to update system settings'
        })
      } finally {
        this.isSaving = false
      }
    },

    async saveApplicationSettings() {
      try {
        this.isSaving = true
        logger.info('Saving application settings...')

        // Mock API call - replace with actual API
        await new Promise(resolve => setTimeout(resolve, 1000))

        this.$swal.fire({
          icon: 'success',
          title: 'Settings Saved',
          text: 'Application settings have been updated successfully',
          timer: 2000,
          showConfirmButton: false
        })

        logger.info('Application settings saved successfully')
      } catch (error) {
        logger.error('Failed to save application settings:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: 'Failed to update application settings'
        })
      } finally {
        this.isSaving = false
      }
    },

    setActiveTab(tab) {
      this.activeTab = tab
    }
  }
}
</script>

<template>
  <div class="container-fluid p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h2 class="fw-bold text-staff-primary mb-1">Settings</h2>
            <p class="text-muted mb-0">Manage your profile and system preferences</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Settings Tabs -->
    <div class="row">
      <div class="col-12">
        <div class="staff-card">
          <!-- Tab Navigation -->
          <div class="card-header bg-transparent border-bottom">
            <ul class="nav nav-tabs card-header-tabs">
              <li class="nav-item">
                <button 
                  class="nav-link" 
                  :class="{ active: activeTab === 'profile' }"
                  @click="setActiveTab('profile')"
                >
                  <i class="bi bi-person me-2"></i>Profile
                </button>
              </li>
              <li class="nav-item">
                <button 
                  class="nav-link" 
                  :class="{ active: activeTab === 'security' }"
                  @click="setActiveTab('security')"
                >
                  <i class="bi bi-shield-lock me-2"></i>Security
                </button>
              </li>
              <li class="nav-item" v-if="authStore.hasPermission('settings', 'manage')">
                <button 
                  class="nav-link" 
                  :class="{ active: activeTab === 'system' }"
                  @click="setActiveTab('system')"
                >
                  <i class="bi bi-gear me-2"></i>System
                </button>
              </li>
              <li class="nav-item" v-if="authStore.hasPermission('settings', 'manage') || authStore.hasPermission('applications', 'manage')">
                <button 
                  class="nav-link" 
                  :class="{ active: activeTab === 'applications' }"
                  @click="setActiveTab('applications')"
                >
                  <i class="bi bi-file-earmark-text me-2"></i>Applications
                </button>
              </li>
            </ul>
          </div>

          <!-- Tab Content -->
          <div class="card-body">
            <!-- Profile Tab -->
            <div v-if="activeTab === 'profile'" class="tab-content">
              <h5 class="fw-bold mb-4">Profile Information</h5>
              <form @submit.prevent="saveProfile">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="firstName" class="form-label">First Name *</label>
                    <input
                      type="text"
                      class="form-control"
                      id="firstName"
                      v-model="profileForm.firstName"
                      required
                    >
                  </div>
                  <div class="col-md-6 mb-3">
                    <label for="lastName" class="form-label">Last Name *</label>
                    <input
                      type="text"
                      class="form-control"
                      id="lastName"
                      v-model="profileForm.lastName"
                      required
                    >
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="email" class="form-label">Email Address *</label>
                    <input
                      type="email"
                      class="form-control"
                      id="email"
                      v-model="profileForm.email"
                      required
                    >
                  </div>
                  <div class="col-md-6 mb-3">
                    <label for="phone" class="form-label">Phone Number</label>
                    <input
                      type="tel"
                      class="form-control"
                      id="phone"
                      v-model="profileForm.phone"
                    >
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="department" class="form-label">Department</label>
                    <select class="form-select" id="department" v-model="profileForm.department">
                      <option value="">Select Department</option>
                      <option v-for="dept in departments" :key="dept" :value="dept">
                        {{ dept }}
                      </option>
                    </select>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label for="position" class="form-label">Position</label>
                    <select class="form-select" id="position" v-model="profileForm.position">
                      <option value="">Select Position</option>
                      <option v-for="pos in positions" :key="pos" :value="pos">
                        {{ pos }}
                      </option>
                    </select>
                  </div>
                </div>

                <div class="d-flex justify-content-end">
                  <button 
                    type="submit" 
                    class="btn btn-staff-primary"
                    :disabled="isSaving"
                  >
                    <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="bi bi-check me-2"></i>
                    {{ isSaving ? 'Saving...' : 'Save Profile' }}
                  </button>
                </div>
              </form>
            </div>

            <!-- Security Tab -->
            <div v-if="activeTab === 'security'" class="tab-content">
              <h5 class="fw-bold mb-4">Change Password</h5>
              <form @submit.prevent="changePassword">
                <div class="row">
                  <div class="col-md-8">
                    <div class="mb-3">
                      <label for="currentPassword" class="form-label">Current Password *</label>
                      <div class="input-group">
                        <input
                          :type="showCurrentPassword ? 'text' : 'password'"
                          class="form-control"
                          id="currentPassword"
                          v-model="passwordForm.currentPassword"
                          required
                        >
                        <button
                          type="button"
                          class="btn btn-outline-secondary"
                          @click="showCurrentPassword = !showCurrentPassword"
                        >
                          <i :class="showCurrentPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                        </button>
                      </div>
                    </div>

                    <div class="mb-3">
                      <label for="newPassword" class="form-label">New Password *</label>
                      <div class="input-group">
                        <input
                          :type="showNewPassword ? 'text' : 'password'"
                          class="form-control"
                          id="newPassword"
                          v-model="passwordForm.newPassword"
                          required
                          minlength="8"
                        >
                        <button
                          type="button"
                          class="btn btn-outline-secondary"
                          @click="showNewPassword = !showNewPassword"
                        >
                          <i :class="showNewPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                        </button>
                      </div>
                      <div class="form-text">Password must be at least 8 characters long</div>
                    </div>

                    <div class="mb-3">
                      <label for="confirmPassword" class="form-label">Confirm New Password *</label>
                      <div class="input-group">
                        <input
                          :type="showConfirmPassword ? 'text' : 'password'"
                          class="form-control"
                          id="confirmPassword"
                          v-model="passwordForm.confirmPassword"
                          required
                        >
                        <button
                          type="button"
                          class="btn btn-outline-secondary"
                          @click="showConfirmPassword = !showConfirmPassword"
                        >
                          <i :class="showConfirmPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                        </button>
                      </div>
                    </div>

                    <div class="d-flex justify-content-end">
                      <button 
                        type="submit" 
                        class="btn btn-staff-primary"
                        :disabled="isSaving"
                      >
                        <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                        <i v-else class="bi bi-shield-check me-2"></i>
                        {{ isSaving ? 'Changing...' : 'Change Password' }}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <!-- System Tab -->
            <div v-if="activeTab === 'system' && authStore.hasPermission('settings', 'manage')" class="tab-content">
              <h5 class="fw-bold mb-4">System Settings</h5>
              <form @submit.prevent="saveSystemSettings">
                <div class="row">
                  <div class="col-md-6">
                    <h6 class="fw-bold mb-3">Notifications</h6>
                    <div class="mb-3">
                      <div class="form-check form-switch">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          id="emailNotifications"
                          v-model="systemSettings.emailNotifications"
                        >
                        <label class="form-check-label" for="emailNotifications">
                          Email Notifications
                        </label>
                      </div>
                    </div>
                    <div class="mb-3">
                      <div class="form-check form-switch">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          id="smsNotifications"
                          v-model="systemSettings.smsNotifications"
                        >
                        <label class="form-check-label" for="smsNotifications">
                          SMS Notifications
                        </label>
                      </div>
                    </div>
                    <div class="mb-3">
                      <div class="form-check form-switch">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          id="applicationAlerts"
                          v-model="systemSettings.applicationAlerts"
                        >
                        <label class="form-check-label" for="applicationAlerts">
                          Application Alerts
                        </label>
                      </div>
                    </div>
                  </div>

                  <div class="col-md-6">
                    <h6 class="fw-bold mb-3">Security</h6>
                    <div class="mb-3">
                      <label for="autoLogout" class="form-label">Auto Logout (minutes)</label>
                      <input
                        type="number"
                        class="form-control"
                        id="autoLogout"
                        v-model="systemSettings.autoLogout"
                        min="5"
                        max="120"
                      >
                    </div>
                    <div class="mb-3">
                      <label for="sessionTimeout" class="form-label">Session Timeout (minutes)</label>
                      <input
                        type="number"
                        class="form-control"
                        id="sessionTimeout"
                        v-model="systemSettings.sessionTimeout"
                        min="30"
                        max="480"
                      >
                    </div>
                  </div>
                </div>

                <div class="d-flex justify-content-end">
                  <button 
                    type="submit" 
                    class="btn btn-staff-primary"
                    :disabled="isSaving"
                  >
                    <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="bi bi-check me-2"></i>
                    {{ isSaving ? 'Saving...' : 'Save Settings' }}
                  </button>
                </div>
              </form>
            </div>

            <!-- Applications Tab -->
            <div v-if="activeTab === 'applications' && (authStore.hasPermission('settings', 'manage') || authStore.hasPermission('applications', 'manage'))" class="tab-content">
              <h5 class="fw-bold mb-4">Application Settings</h5>
              <form @submit.prevent="saveApplicationSettings">
                <div class="row">
                  <div class="col-md-6">
                    <h6 class="fw-bold mb-3">File Upload Settings</h6>
                    <div class="mb-3">
                      <div class="form-check form-switch">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          id="allowFileUploads"
                          v-model="applicationSettings.allowFileUploads"
                        >
                        <label class="form-check-label" for="allowFileUploads">
                          Allow File Uploads
                        </label>
                      </div>
                    </div>
                    <div class="mb-3">
                      <label for="maxFileSize" class="form-label">Max File Size (MB)</label>
                      <input
                        type="number"
                        class="form-control"
                        id="maxFileSize"
                        v-model="applicationSettings.maxFileSize"
                        min="1"
                        max="100"
                      >
                    </div>
                  </div>

                  <div class="col-md-6">
                    <h6 class="fw-bold mb-3">Processing Settings</h6>
                    <div class="mb-3">
                      <div class="form-check form-switch">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          id="autoApproval"
                          v-model="applicationSettings.autoApproval"
                        >
                        <label class="form-check-label" for="autoApproval">
                          Auto Approval (for eligible applications)
                        </label>
                      </div>
                    </div>
                    <div class="mb-3">
                      <div class="form-check form-switch">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          id="requireEmailVerification"
                          v-model="applicationSettings.requireEmailVerification"
                        >
                        <label class="form-check-label" for="requireEmailVerification">
                          Require Email Verification
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="d-flex justify-content-end">
                  <button 
                    type="submit" 
                    class="btn btn-staff-primary"
                    :disabled="isSaving"
                  >
                    <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="bi bi-check me-2"></i>
                    {{ isSaving ? 'Saving...' : 'Save Settings' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nav-tabs .nav-link {
  border: none;
  color: var(--staff-secondary);
  font-weight: 500;
}

.nav-tabs .nav-link.active {
  background-color: transparent;
  border-bottom: 2px solid var(--staff-primary);
  color: var(--staff-primary);
}

.nav-tabs .nav-link:hover {
  border: none;
  color: var(--staff-primary);
}

.tab-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.form-check-input:checked {
  background-color: var(--staff-primary);
  border-color: var(--staff-primary);
}

.input-group .btn {
  border-left: none;
}

.form-control:focus + .btn {
  border-color: var(--staff-primary);
}
</style>