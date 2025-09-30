<script lang="js">
import { useAuthStore } from '../../stores/auth.js'
import { apiService } from '../../services/api.js'
import { logger } from '@shared/utils/logger'

export default {
  name: 'StaffDashboard',
  setup() {
    const authStore = useAuthStore()
    return {
      authStore
    }
  },
  data() {
    return {
      stats: {
        totalApplications: 0,
        pendingApplications: 0,
        approvedApplications: 0,
        rejectedApplications: 0,
        totalUsers: 0,
        activeUsers: 0,
        systemHealth: 'Good'
      },
      recentApplications: [],
      isLoading: true,
      chartData: null
    }
  },
  async mounted() {
    await this.loadDashboardData()
  },
  methods: {
    async loadDashboardData() {
      try {
        this.isLoading = true
        logger.info('Loading staff dashboard data...')

        // Simulate API call - replace with actual API calls
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Mock data - replace with actual API responses
        this.stats = {
          totalApplications: 1247,
          pendingApplications: 89,
          approvedApplications: 1098,
          rejectedApplications: 60,
          totalUsers: 2340,
          activeUsers: 1876,
          systemHealth: 'Excellent'
        }

        this.recentApplications = [
          {
            id: '1',
            applicantName: 'John Doe',
            applicationNumber: 'APP-2025-001',
            program: 'Computer Science',
            status: 'pending',
            submittedAt: '2025-09-30T10:30:00Z'
          },
          {
            id: '2',
            applicantName: 'Jane Smith',
            applicationNumber: 'APP-2025-002',
            program: 'Business Administration',
            status: 'approved',
            submittedAt: '2025-09-29T14:15:00Z'
          },
          {
            id: '3',
            applicantName: 'Mike Johnson',
            applicationNumber: 'APP-2025-003',
            program: 'Engineering',
            status: 'under_review',
            submittedAt: '2025-09-29T09:45:00Z'
          }
        ]

        logger.info('Staff dashboard data loaded successfully')
      } catch (error) {
        logger.error('Failed to load staff dashboard data:', error)
      } finally {
        this.isLoading = false
      }
    },

    getStatusBadgeClass(status) {
      const statusClasses = {
        pending: 'bg-warning text-dark',
        approved: 'bg-success text-white',
        rejected: 'bg-danger text-white',
        under_review: 'bg-info text-white'
      }
      return statusClasses[status] || 'bg-secondary text-white'
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString()
    },

    navigateToApplications() {
      this.$router.push('/applications')
    },

    navigateToUsers() {
      this.$router.push('/users')
    }
  }
}
</script>

<template>
    <!-- staff-main-content  -->
  <div class="container-fluid p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h2 class="fw-bold text-staff-primary mb-1">Dashboard</h2>
            <p class="text-muted mb-0">Welcome back, {{ authStore.user?.firstName }}!</p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-staff-primary btn-sm">
              <i class="bi bi-download me-2"></i>Export Report
            </button>
            <button class="btn btn-staff-primary btn-sm" @click="loadDashboardData">
              <i class="bi bi-arrow-clockwise me-2"></i>Refresh
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-staff-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-3 text-muted">Loading dashboard data...</p>
    </div>

    <!-- Dashboard Content -->
    <div v-else>
      <!-- Stats Cards Row -->
      <div class="row mb-4">
        <div class="col-lg-3 col-md-6 mb-3">
          <div class="staff-card h-100">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="card-title text-muted mb-2">Total Applications</h6>
                  <h3 class="fw-bold text-staff-primary mb-0">{{ stats.totalApplications.toLocaleString() }}</h3>
                </div>
                <div class="bg-staff-light rounded-circle p-3">
                  <i class="bi bi-file-earmark-text fs-4 text-staff-primary"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-3 col-md-6 mb-3">
          <div class="staff-card h-100">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="card-title text-muted mb-2">Pending Review</h6>
                  <h3 class="fw-bold text-warning mb-0">{{ stats.pendingApplications }}</h3>
                </div>
                <div class="bg-warning bg-opacity-25 rounded-circle p-3">
                  <i class="bi bi-clock fs-4 text-warning"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-3 col-md-6 mb-3">
          <div class="staff-card h-100">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="card-title text-muted mb-2">Approved</h6>
                  <h3 class="fw-bold text-success mb-0">{{ stats.approvedApplications.toLocaleString() }}</h3>
                </div>
                <div class="bg-success bg-opacity-25 rounded-circle p-3">
                  <i class="bi bi-check-circle fs-4 text-success"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-3 col-md-6 mb-3">
          <div class="staff-card h-100">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="card-title text-muted mb-2">Total Users</h6>
                  <h3 class="fw-bold text-info mb-0">{{ stats.totalUsers.toLocaleString() }}</h3>
                </div>
                <div class="bg-info bg-opacity-25 rounded-circle p-3">
                  <i class="bi bi-people fs-4 text-info"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content Row -->
      <div class="row">
        <!-- Recent Applications -->
        <div class="col-lg-8 mb-4">
          <div class="staff-card h-100">
            <div class="card-header bg-transparent border-bottom">
              <div class="d-flex justify-content-between align-items-center">
                <h5 class="mb-0 fw-bold">Recent Applications</h5>
                <button class="btn btn-outline-staff-primary btn-sm" @click="navigateToApplications">
                  View All
                </button>
              </div>
            </div>
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>Applicant</th>
                      <th>Application #</th>
                      <th>Program</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="app in recentApplications" :key="app.id">
                      <td>
                        <div class="d-flex align-items-center">
                          <div class="bg-staff-light rounded-circle p-2 me-2">
                            <i class="bi bi-person text-staff-primary"></i>
                          </div>
                          <span class="fw-medium">{{ app.applicantName }}</span>
                        </div>
                      </td>
                      <td>
                        <code class="text-staff-primary">{{ app.applicationNumber }}</code>
                      </td>
                      <td>{{ app.program }}</td>
                      <td>
                        <span class="badge rounded-pill" :class="getStatusBadgeClass(app.status)">
                          {{ app.status.replace('_', ' ').toUpperCase() }}
                        </span>
                      </td>
                      <td>{{ formatDate(app.submittedAt) }}</td>
                      <td>
                        <div class="btn-group btn-group-sm">
                          <button class="btn btn-outline-staff-primary btn-sm">
                            <i class="bi bi-eye"></i>
                          </button>
                          <button class="btn btn-outline-success btn-sm">
                            <i class="bi bi-check"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions & System Status -->
        <div class="col-lg-4 mb-4">
          <!-- Quick Actions -->
          <div class="staff-card mb-4">
            <div class="card-header bg-transparent border-bottom">
              <h5 class="mb-0 fw-bold">Quick Actions</h5>
            </div>
            <div class="card-body">
              <div class="d-grid gap-2">
                <button class="btn btn-staff-primary" @click="navigateToApplications">
                  <i class="bi bi-plus-circle me-2"></i>Review Applications
                </button>
                <button class="btn btn-outline-staff-primary" @click="navigateToUsers">
                  <i class="bi bi-person-plus me-2"></i>Manage Users
                </button>
                <button class="btn btn-outline-staff-primary">
                  <i class="bi bi-graph-up me-2"></i>Generate Report
                </button>
                <button class="btn btn-outline-staff-primary">
                  <i class="bi bi-gear me-2"></i>System Settings
                </button>
              </div>
            </div>
          </div>

          <!-- System Status -->
          <div class="staff-card">
            <div class="card-header bg-transparent border-bottom">
              <h5 class="mb-0 fw-bold">System Status</h5>
            </div>
            <div class="card-body">
              <div class="d-flex align-items-center mb-3">
                <div class="bg-success bg-opacity-25 rounded-circle p-2 me-3">
                  <i class="bi bi-server text-success"></i>
                </div>
                <div>
                  <div class="fw-medium">System Health</div>
                  <span class="badge bg-success">{{ stats.systemHealth }}</span>
                </div>
              </div>

              <div class="d-flex align-items-center mb-3">
                <div class="bg-info bg-opacity-25 rounded-circle p-2 me-3">
                  <i class="bi bi-people text-info"></i>
                </div>
                <div>
                  <div class="fw-medium">Active Users</div>
                  <div class="text-muted small">{{ stats.activeUsers }} online</div>
                </div>
              </div>

              <div class="d-flex align-items-center">
                <div class="bg-warning bg-opacity-25 rounded-circle p-2 me-3">
                  <i class="bi bi-clock text-warning"></i>
                </div>
                <div>
                  <div class="fw-medium">Pending Tasks</div>
                  <div class="text-muted small">{{ stats.pendingApplications }} items</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.staff-card {
  border: none;
  box-shadow: 0 2px 10px rgba(26, 95, 95, 0.1);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.staff-card:hover {
  box-shadow: 0 4px 20px rgba(26, 95, 95, 0.15);
  transform: translateY(-2px);
}

.table th {
  font-weight: 600;
  color: var(--staff-primary);
  border-bottom: 2px solid var(--staff-light);
}

.table td {
  vertical-align: middle;
}

.btn-group-sm .btn {
  padding: 0.25rem 0.5rem;
}

code {
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: var(--staff-light);
}
</style>