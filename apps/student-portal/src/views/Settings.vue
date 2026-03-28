<script>
import { useAuthStore } from "../stores/auth.js";
import { apiService } from "../services/api.js";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";

export default {
  name: "Settings",
  setup() {
    const auth = useAuthStore();
    return { auth };
  },
  data() {
    return {
      activeTab: "profile",
      passwordForm: {
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      },
      showCurrentPassword: false,
      showNewPassword: false,
      showConfirmPassword: false,
      isChangingPassword: false,
      passwordErrors: [],
    };
  },
  methods: {
    updateProfile() {
      // Handle profile update
      // Implementation will be added later
    },

    validatePassword(password) {
      const errors = [];

      if (password.length < 8) {
        errors.push("Password must be at least 8 characters long");
      }

      if (!/[A-Z]/.test(password)) {
        errors.push("Password must contain at least one uppercase letter");
      }

      if (!/[a-z]/.test(password)) {
        errors.push("Password must contain at least one lowercase letter");
      }

      if (!/\d/.test(password)) {
        errors.push("Password must contain at least one number");
      }

      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)) {
        errors.push(
          "Password must contain at least one special character (!@#$%^&*()_+-=[]{};':\"\\|,.<>?)"
        );
      }

      return errors;
    },

    async changePassword() {
      try {
        this.isChangingPassword = true;
        this.passwordErrors = [];

        // Validate form
        if (!this.passwordForm.currentPassword) {
          this.passwordErrors.push("Current password is required");
          return;
        }

        if (!this.passwordForm.newPassword) {
          this.passwordErrors.push("New password is required");
          return;
        }

        if (!this.passwordForm.confirmPassword) {
          this.passwordErrors.push("Confirm password is required");
          return;
        }

        // Validate new password strength
        const passwordValidationErrors = this.validatePassword(
          this.passwordForm.newPassword
        );
        if (passwordValidationErrors.length > 0) {
          this.passwordErrors = passwordValidationErrors;
          return;
        }

        // Check if passwords match
        if (
          this.passwordForm.newPassword !== this.passwordForm.confirmPassword
        ) {
          this.passwordErrors.push(
            "New password and confirm password do not match"
          );
          return;
        }

        // Check if new password is different from current
        if (
          this.passwordForm.currentPassword === this.passwordForm.newPassword
        ) {
          this.passwordErrors.push(
            "New password must be different from current password"
          );
          return;
        }

        // Call API
        const response = await apiService.changePassword({
          currentPassword: this.passwordForm.currentPassword,
          newPassword: this.passwordForm.newPassword,
        });

        if (response.success) {
          // Show success message
          await Swal.fire({
            icon: "success",
            title: "Password Changed Successfully!",
            text: "Your password has been updated. A confirmation email has been sent to your email address.",
            timer: 4000,
            showConfirmButton: true,
            confirmButtonColor: "#2d7d7d",
            background: "#fff",
            color: "#1a5f5f",
          });

          // Clear form
          this.passwordForm = {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
          };

          // Hide password fields
          this.showCurrentPassword = false;
          this.showNewPassword = false;
          this.showConfirmPassword = false;
        } else {
          this.passwordErrors.push(
            response.error || "Failed to change password"
          );
        }
      } catch (error) {
        logger.error("Change password error:", error);
        this.passwordErrors.push(error.message || "Failed to change password");
      } finally {
        this.isChangingPassword = false;
      }
    },
  },
};
</script>

<template>
  <div class="settings p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h2 class="h3 fw-bold text-dark mb-1">
              <i class="bi bi-gear me-2 text-primary"></i>
              Account Settings
            </h2>
            <p class="text-muted mb-0">
              Manage your profile, preferences, and security settings.
            </p>
            <!-- <div v-if="auth.fullProgramName !== 'Not Available'" class="mt-2">
              <span class="badge bg-primary">{{ auth.fullProgramName }}</span>
              <span v-if="auth.matriculationNumber" class="badge bg-secondary ms-2">{{ auth.matriculationNumber }}</span>
            </div> -->
          </div>
        </div>
      </div>
    </div>

    <div class="row">
      <!-- Settings Navigation -->
      <div class="col-lg-3 mb-4">
        <div class="card border-0 shadow-sm">
          <div class="card-body p-0">
            <div class="list-group list-group-flush">
              <button
                :class="[
                  'list-group-item',
                  'list-group-item-action',
                  'border-0',
                  { active: activeTab === 'profile' },
                ]"
                @click="activeTab = 'profile'"
              >
                <i class="bi bi-person me-2"></i>Profile Information
              </button>
              <button
                :class="[
                  'list-group-item',
                  'list-group-item-action',
                  'border-0',
                  { active: activeTab === 'academic' },
                ]"
                @click="activeTab = 'academic'"
              >
                <i class="bi bi-mortarboard me-2"></i>Academic Details
              </button>
              <button
                :class="[
                  'list-group-item',
                  'list-group-item-action',
                  'border-0',
                  { active: activeTab === 'security' },
                ]"
                @click="activeTab = 'security'"
              >
                <i class="bi bi-shield-lock me-2"></i>Security
              </button>
              <button
                :class="[
                  'list-group-item',
                  'list-group-item-action',
                  'border-0',
                  { active: activeTab === 'notifications' },
                ]"
                @click="activeTab = 'notifications'"
              >
                <i class="bi bi-bell me-2"></i>Notifications
              </button>
              <button
                :class="[
                  'list-group-item',
                  'list-group-item-action',
                  'border-0',
                  { active: activeTab === 'preferences' },
                ]"
                @click="activeTab = 'preferences'"
              >
                <i class="bi bi-sliders me-2"></i>Preferences
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Content -->
      <div class="col-lg-9">
        <!-- Profile Information Tab -->
        <div v-if="activeTab === 'profile'" class="card border-0 shadow-sm">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Profile Information</h5>
          </div>
          <div class="card-body">
            <form @submit.prevent="updateProfile">
              <div class="row mb-4">
                <div class="col-md-4 text-center">
                  <div class="position-relative d-inline-block">
                    <img
                      :src="
                        auth.student?.profileImageUrl ||
                        'https://ui-avatars.com/api/?name=' +
                          encodeURIComponent(auth.userName) +
                          '&background=2d7d7d&color=fff'
                      "
                      width="150"
                      height="150"
                      alt="Profile"
                      class="rounded-circle border border-3 border-primary"
                    />
                    <!-- <button
                      type="button"
                      class="btn btn-sm btn-primary position-absolute bottom-0 end-0 rounded-circle"
                    >
                      <i class="bi bi-camera"></i>
                    </button> -->
                  </div>
                  <!-- <div class="mt-3">
                    <button
                      type="button"
                      class="btn btn-outline-primary btn-sm"
                    >
                      Change Photo
                    </button>
                  </div> -->
                </div>
                <div class="col-md-8">
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label class="form-label fw-bold">First Name</label>
                      <input
                        type="text"
                        class="form-control"
                        :value="auth.user?.firstName || ''"
                        readonly
                      />
                      <small class="text-muted"
                        >First name cannot be changed</small
                      >
                    </div>
                    <div class="col-md-6 mb-3">
                      <label class="form-label fw-bold">Last Name</label>
                      <input
                        type="text"
                        class="form-control"
                        :value="auth.user?.lastName || ''"
                        readonly
                      />
                      <small class="text-muted"
                        >Last name cannot be changed</small
                      >
                    </div>
                    <div class="col-md-6 mb-3">
                      <label class="form-label fw-bold">Email Address</label>
                      <input
                        type="email"
                        class="form-control"
                        :value="auth.user?.email || ''"
                        readonly
                      />
                      <small class="text-muted">Email cannot be changed</small>
                    </div>
                    <div class="col-md-6 mb-3">
                      <label class="form-label fw-bold">Phone Number</label>
                      <input
                        type="tel"
                        class="form-control"
                        :value="auth.application?.phone || ''"
                        readonly
                      />
                      <small class="text-muted">Phone cannot be changed</small>
                    </div>
                    <div class="col-12 mb-3">
                      <label class="form-label fw-bold">Bio</label>
                      <textarea
                        class="form-control"
                        rows="3"
                        placeholder="Tell us about yourself..."
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>

              <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-outline-secondary">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Academic Details Tab -->
        <div v-if="activeTab === 'academic'" class="card border-0 shadow-sm">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Academic Information</h5>
          </div>
          <div class="card-body">
            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Student ID</label>
                <input
                  type="text"
                  class="form-control"
                  :value="auth.matriculationNumber"
                  readonly
                />
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Program</label>
                <input
                  type="text"
                  class="form-control"
                  :value="auth.fullProgramName"
                  readonly
                />
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Program Mode</label>
                <input
                  type="text"
                  class="form-control"
                  :value="auth.programMode || 'Not Available'"
                  readonly
                />
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Current Level</label>
                <input
                  type="text"
                  class="form-control"
                  :value="
                    auth.currentLevel && auth.currentSemester
                      ? `Year ${auth.currentLevel} Semester ${auth.currentSemester}`
                      : 'Not Available'
                  "
                  readonly
                />
              </div>
              <!-- <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Academic Session</label>
                <input
                  type="text"
                  class="form-control"
                  :value="
                    auth.student?.academicSession?.sessionYear ||
                    'Not Available'
                  "
                  readonly
                />
              </div> -->
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Current GPA</label>
                <input
                  type="text"
                  class="form-control"
                  :value="
                    auth.cumulativeGPA ? auth.cumulativeGPA.toFixed(2) : '0.00'
                  "
                  readonly
                />
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Admission Year</label>
                <input
                  type="text"
                  class="form-control"
                  :value="auth.student?.admissionYear || 'Not Available'"
                  readonly
                />
              </div>
            </div>

            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i>
              Academic information is managed by the academic office and cannot
              be modified here. Contact the registrar for any changes.
            </div>
          </div>
        </div>

        <!-- Security Tab -->
        <div v-if="activeTab === 'security'" class="card border-0 shadow-sm">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Security Settings</h5>
          </div>
          <div class="card-body">
            <!-- Change Password -->
            <form @submit.prevent="changePassword" class="mb-4">
              <h6 class="fw-bold mb-3">Change Password</h6>

              <!-- Error Messages -->
              <div
                v-if="passwordErrors.length > 0"
                class="alert alert-danger alert-dismissible fade show"
                role="alert"
              >
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                <strong>Please fix the following errors:</strong>
                <ul class="mb-0 mt-2">
                  <li v-for="error in passwordErrors" :key="error">
                    {{ error }}
                  </li>
                </ul>
                <button
                  type="button"
                  class="btn-close"
                  @click="passwordErrors = []"
                  aria-label="Close"
                ></button>
              </div>

              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label fw-bold">Current Password</label>
                  <div class="input-group">
                    <input
                      :type="showCurrentPassword ? 'text' : 'password'"
                      class="form-control"
                      v-model="passwordForm.currentPassword"
                      :class="{
                        'is-invalid': passwordErrors.some((e) =>
                          e.includes('current password')
                        ),
                      }"
                      placeholder="Enter your current password"
                      required
                    />
                    <button
                      type="button"
                      class="btn btn-primary"
                      @click="showCurrentPassword = !showCurrentPassword"
                    >
                      <i
                        :class="
                          showCurrentPassword ? 'bi bi-eye-slash' : 'bi bi-eye'
                        "
                      ></i>
                    </button>
                  </div>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label fw-bold">New Password</label>
                  <div class="input-group">
                    <input
                      :type="showNewPassword ? 'text' : 'password'"
                      class="form-control"
                      v-model="passwordForm.newPassword"
                      :class="{
                        'is-invalid': passwordErrors.some((e) =>
                          e.toLowerCase().includes('password must')
                        ),
                      }"
                      placeholder="Enter your new password"
                      required
                    />
                    <button
                      type="button"
                      class="btn btn-primary"
                      @click="showNewPassword = !showNewPassword"
                    >
                      <i
                        :class="
                          showNewPassword ? 'bi bi-eye-slash' : 'bi bi-eye'
                        "
                      ></i>
                    </button>
                  </div>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label fw-bold">Confirm New Password</label>
                  <div class="input-group">
                    <input
                      :type="showConfirmPassword ? 'text' : 'password'"
                      class="form-control"
                      v-model="passwordForm.confirmPassword"
                      :class="{
                        'is-invalid': passwordErrors.some(
                          (e) =>
                            e.includes('do not match') ||
                            e.includes('Confirm password')
                        ),
                      }"
                      placeholder="Confirm your new password"
                      required
                    />
                    <button
                      type="button"
                      class="btn btn-primary"
                      @click="showConfirmPassword = !showConfirmPassword"
                    >
                      <i
                        :class="
                          showConfirmPassword ? 'bi bi-eye-slash' : 'bi bi-eye'
                        "
                      ></i>
                    </button>
                  </div>
                </div>
                <div class="col-md-6 mb-3 d-flex align-items-end  justify-content-end">
                  <button
                    type="submit"
                    class="btn btn-primary"
                    :disabled="isChangingPassword"
                  >
                    <span
                      v-if="isChangingPassword"
                      class="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    {{
                      isChangingPassword
                        ? "Updating Password..."
                        : "Update Password"
                    }}
                  </button>
                </div>
              </div>

              <!-- Password Requirements -->
              <div class="alert alert-info mb-3">
                <h6 class="alert-heading">Password Requirements:</h6>
                <ul class="mb-0">
                  <li>At least 8 characters long</li>
                  <li>At least one uppercase letter (A-Z)</li>
                  <li>At least one lowercase letter (a-z)</li>
                  <li>At least one number (0-9)</li>
                  <li>
                    At least one special character
                    (!@#$%^&*()_+-=[]{};\':"|,.<>?)
                  </li>
                </ul>
              </div>
            </form>

            <hr />

            <!-- Coming Soon Message for Advanced Security -->
            <div class="text-center py-4">
              <i
                class="bi bi-shield-check text-muted mb-3"
                style="font-size: 3rem"
              ></i>
              <h5 class="text-muted mb-2">Advanced Security Features</h5>
              <p class="text-muted mb-0">
                Two-factor authentication and session management are coming
                soon!
              </p>
            </div>

            <!-- Commented out advanced security features - will be activated later -->
            <!--
            <div class="mb-4">
              <h6 class="fw-bold mb-3">Two-Factor Authentication</h6>
              <div
                class="d-flex justify-content-between align-items-center p-3 border rounded"
              >
                <div>
                  <div class="fw-bold">SMS Authentication</div>
                  <small class="text-muted">
                    Receive verification codes via Email
                  </small>
                </div>
                <div class="form-check form-switch">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    id="smsAuth"
                  />
                  <label class="form-check-label" for="smsAuth"></label>
                </div>
              </div>
            </div>

            <div>
              <h6 class="fw-bold mb-3">Active Sessions</h6>
              <div class="border rounded p-3 mb-2">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <div class="fw-bold">Current Session</div>
                    <small class="text-muted"
                      >Chrome on Windows • IP: 192.168.1.100</small
                    >
                  </div>
                  <span class="badge bg-success">Active</span>
                </div>
              </div>
              <div class="border rounded p-3">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <div class="fw-bold">Mobile App</div>
                    <small class="text-muted"
                      >Android • Last active: 2 hours ago</small
                    >
                  </div>
                  <button class="btn btn-sm btn-outline-danger">Revoke</button>
                </div>
              </div>
            </div>
            -->
          </div>
        </div>

        <!-- Notifications Tab -->
        <div
          v-if="activeTab === 'notifications'"
          class="card border-0 shadow-sm"
        >
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Notification Preferences</h5>
          </div>
          <div class="card-body">
            <!-- Coming Soon Message -->
            <div class="text-center py-5">
              <i
                class="bi bi-bell-slash text-muted mb-3"
                style="font-size: 4rem"
              ></i>
              <h4 class="text-muted mb-2">Notification Settings</h4>
              <p class="text-muted mb-0">
                This feature is coming soon! Stay tuned for updates.
              </p>
            </div>

            <!-- Commented out notification settings - will be activated later -->
            <!-- 
            <div class="mb-4">
              <h6 class="fw-bold mb-3">Email Notifications</h6>
              <div class="form-check mb-2">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="emailAssignments"
                  checked
                />
                <label class="form-check-label" for="emailAssignments">
                  <div class="fw-bold">Assignment Reminders</div>
                  <small class="text-muted"
                    >Get notified about upcoming assignment deadlines</small
                  >
                </label>
              </div>
              <div class="form-check mb-2">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="emailGrades"
                  checked
                />
                <label class="form-check-label" for="emailGrades">
                  <div class="fw-bold">Grade Updates</div>
                  <small class="text-muted"
                    >Receive notifications when grades are posted</small
                  >
                </label>
              </div>
              <div class="form-check mb-2">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="emailAnnouncements"
                />
                <label class="form-check-label" for="emailAnnouncements">
                  <div class="fw-bold">Course Announcements</div>
                  <small class="text-muted"
                    >Get notified about course updates and announcements</small
                  >
                </label>
              </div>
            </div>

            <div class="mb-4">
              <h6 class="fw-bold mb-3">SMS Notifications</h6>
              <div class="form-check mb-2">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="smsPayments"
                  checked
                />
                <label class="form-check-label" for="smsPayments">
                  <div class="fw-bold">Payment Confirmations</div>
                  <small class="text-muted"
                    >Receive SMS confirmations for successful payments</small
                  >
                </label>
              </div>
              <div class="form-check mb-2">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="smsEmergency"
                  checked
                />
                <label class="form-check-label" for="smsEmergency">
                  <div class="fw-bold">Emergency Alerts</div>
                  <small class="text-muted"
                    >Important school-wide notifications</small
                  >
                </label>
              </div>
            </div>

            <button type="button" class="btn btn-primary">
              Save Notification Settings
            </button>
            -->
          </div>
        </div>

        <!-- Preferences Tab -->
        <div v-if="activeTab === 'preferences'" class="card border-0 shadow-sm">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">System Preferences</h5>
          </div>
          <div class="card-body">
            <!-- Coming Soon Message -->
            <div class="text-center py-5">
              <i
                class="bi bi-sliders text-muted mb-3"
                style="font-size: 4rem"
              ></i>
              <h4 class="text-muted mb-2">System Preferences</h4>
              <p class="text-muted mb-0">
                This feature is coming soon! Stay tuned for updates.
              </p>
            </div>

            <!-- Commented out preferences settings - will be activated later -->
            <!--
            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Language</label>
                <select class="form-select">
                  <option selected>English</option>
                  <option>Yoruba</option>
                  <option>Hausa</option>
                  <option>Igbo</option>
                </select>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Timezone</label>
                <select class="form-select">
                  <option selected>Africa/Lagos (WAT)</option>
                  <option>UTC</option>
                  <option>America/New_York</option>
                </select>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Theme</label>
                <select class="form-select">
                  <option selected>Light</option>
                  <option>Dark</option>
                  <option>Auto (System)</option>
                </select>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Dashboard Layout</label>
                <select class="form-select">
                  <option selected>Default</option>
                  <option>Compact</option>
                  <option>Detailed</option>
                </select>
              </div>
            </div>

            <div class="mb-4">
              <h6 class="fw-bold mb-3">Privacy Settings</h6>
              <div class="form-check mb-2">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="profileVisible"
                  checked
                />
                <label class="form-check-label" for="profileVisible">
                  <div class="fw-bold">Make Profile Visible</div>
                  <small class="text-muted"
                    >Allow other students to see your profile</small
                  >
                </label>
              </div>
              <div class="form-check mb-2">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="showOnlineStatus"
                />
                <label class="form-check-label" for="showOnlineStatus">
                  <div class="fw-bold">Show Online Status</div>
                  <small class="text-muted"
                    >Let others see when you're online</small
                  >
                </label>
              </div>
            </div>

            <button type="button" class="btn btn-primary">
              Save Preferences
            </button>
            -->
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings {
  background-color: #f8f9fa;
  min-height: calc(100vh - 70px);
}

.list-group-item {
  transition: all 0.2s ease;
}

.list-group-item:hover {
  background-color: #f8f9fa;
}

.list-group-item.active {
  background-color: var(--primary-dark);
  border-color: var(--primary-dark);
}
</style>
