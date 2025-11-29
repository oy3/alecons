<script>
import { useAuthStore } from "../stores/auth.js";

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
      },
      showCurrentPassword: false,
      showNewPassword: false,
    };
  },
  methods: {
    updateProfile() {
      // Handle profile update
      // Implementation will be added later
    },
    changePassword() {
      // Handle password change
      // Implementation will be added later
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
                class="list-group-item list-group-item-action active border-0"
                @click="activeTab = 'profile'"
              >
                <i class="bi bi-person me-2"></i>Profile Information
              </button>
              <button
                class="list-group-item list-group-item-action border-0"
                @click="activeTab = 'academic'"
              >
                <i class="bi bi-mortarboard me-2"></i>Academic Details
              </button>
              <button
                class="list-group-item list-group-item-action border-0"
                @click="activeTab = 'security'"
              >
                <i class="bi bi-shield-lock me-2"></i>Security
              </button>
              <button
                class="list-group-item list-group-item-action border-0"
                @click="activeTab = 'notifications'"
              >
                <i class="bi bi-bell me-2"></i>Notifications
              </button>
              <button
                class="list-group-item list-group-item-action border-0"
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
                        auth.user?.profileImageUrl ||
                        'https://ui-avatars.com/api/?name=' +
                          encodeURIComponent(auth.userName) +
                          '&background=2d7d7d&color=fff'
                      "
                      width="150"
                      height="150"
                      alt="Profile"
                      class="rounded-circle border border-3 border-primary"
                    />
                    <button
                      type="button"
                      class="btn btn-sm btn-primary position-absolute bottom-0 end-0 rounded-circle"
                    >
                      <i class="bi bi-camera"></i>
                    </button>
                  </div>
                  <div class="mt-3">
                    <button
                      type="button"
                      class="btn btn-outline-primary btn-sm"
                    >
                      Change Photo
                    </button>
                  </div>
                </div>
                <div class="col-md-8">
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label class="form-label fw-bold">First Name</label>
                      <input
                        type="text"
                        class="form-control"
                        :value="auth.user?.firstName || ''"
                      />
                    </div>
                    <div class="col-md-6 mb-3">
                      <label class="form-label fw-bold">Last Name</label>
                      <input
                        type="text"
                        class="form-control"
                        :value="auth.user?.lastName || ''"
                      />
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
                        placeholder="+234 XXX XXX XXXX"
                      />
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
                  value="STU2024001234"
                  readonly
                />
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Program</label>
                <input
                  type="text"
                  class="form-control"
                  value="Bachelor of Nursing Science"
                  readonly
                />
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Current Level</label>
                <input
                  type="text"
                  class="form-control"
                  value="200 Level"
                  readonly
                />
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Academic Session</label>
                <input
                  type="text"
                  class="form-control"
                  value="2024/2025"
                  readonly
                />
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Current GPA</label>
                <input type="text" class="form-control" value="3.85" readonly />
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label fw-bold">Expected Graduation</label>
                <input
                  type="text"
                  class="form-control"
                  value="June 2027"
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
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label fw-bold">Current Password</label>
                  <div class="input-group">
                    <input
                      :type="showCurrentPassword ? 'text' : 'password'"
                      class="form-control"
                      v-model="passwordForm.currentPassword"
                    />
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
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
                    />
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
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
              </div>
              <button type="submit" class="btn btn-primary">
                Update Password
              </button>
            </form>

            <hr />

            <!-- Two-Factor Authentication -->
            <div class="mb-4">
              <h6 class="fw-bold mb-3">Two-Factor Authentication</h6>
              <div
                class="d-flex justify-content-between align-items-center p-3 border rounded"
              >
                <div>
                  <div class="fw-bold">SMS Authentication</div>
                  <small class="text-muted"
                    >Receive verification codes via SMS</small
                  >
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

            <!-- Login Sessions -->
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
          </div>
        </div>

        <!-- Preferences Tab -->
        <div v-if="activeTab === 'preferences'" class="card border-0 shadow-sm">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">System Preferences</h5>
          </div>
          <div class="card-body">
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
  background-color: #0d6efd;
  border-color: #0d6efd;
}
</style>
