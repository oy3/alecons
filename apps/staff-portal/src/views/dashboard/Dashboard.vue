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
          totalRevenue: 12050000,
          systemHealth: 'Excellent'
        }

        this.recentApplications = [
          {
            id: '1',
            applicantName: 'John Doe',
            applicationNumber: 'APP-2025-001',
            program: 'Nursing',
            status: 'pending',
            submittedAt: '2025-09-30T10:30:00Z'
          },
          {
            id: '2',
            applicantName: 'Jane Smith',
            applicationNumber: 'APP-2025-002',
            program: 'Nursing',
            status: 'approved',
            submittedAt: '2025-09-29T14:15:00Z'
          },
          {
            id: '3',
            applicantName: 'Mike Johnson',
            applicationNumber: 'APP-2025-003',
            program: 'Nursing',
            status: 'under_review',
            submittedAt: '2025-09-29T09:45:00Z'
          },
          {
            id: '4',
            applicantName: 'Jenny Johnson',
            applicationNumber: 'APP-2025-004',
            program: 'Nursing',
            status: 'rejected',
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

    formatRevenue(value) {
      if (value >= 1_000_000_000) {
        return (Math.floor(value / 10_000_000) / 100) + 'B'; // 2 decimals truncated
      }
      if (value >= 1_000_000) {
        return (Math.floor(value / 10_000) / 100) + 'M'; // 2 decimals truncated
      }
      if (value >= 1_000) {
        return (Math.floor(value / 10) / 100) + 'K'; // 2 decimals truncated
      }
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
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
  <div class="container-fluid p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h2 class="fw-bold text-staff-primary mb-1">
              Welcome, {{ authStore.user?.firstName }}!
            </h2>
            <p class="text-muted mb-0">
              Here's a summary of the portal's activity.
            </p>
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
          <div class="card p-0 h-100 border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex align-items-center justify-content-center">
                <div
                  class="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center"
                  style="width: 60px; height: 60px">
                  <i class="bi bi-hourglass-split fs-4"></i>
                </div>
                <div class="ms-3">
                  <h6 class="card-title text-body-secondary">
                    Pending Applications
                  </h6>
                  <h3 class="fw-bold text-dark mb-0">
                    {{ stats.pendingApplications }}
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-3 col-md-6 mb-3">
          <div class="card p-0 h-100 border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex align-items-center justify-content-center">
                <div
                  class="bg-success-subtle text-success rounded-circle d-flex align-items-center justify-content-center"
                  style="width: 60px; height: 60px">
                  <i class="bi bi bi-person-check fs-4"></i>
                </div>
                <div class="ms-3">
                  <h6 class="card-title text-body-secondary">
                    Admitted Students
                  </h6>
                  <h3 class="fw-bold text-dark mb-0">
                    {{ stats.approvedApplications.toLocaleString() }}
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-3 col-md-6 mb-3">
          <div class="card p-0 h-100 border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex align-items-center justify-content-center">
                <div
                  class="bg-warning-subtle text-warning rounded-circle d-flex align-items-center justify-content-center"
                  style="width: 60px; height: 60px">
                  <i class="bi bi-cash-stack fs-4"></i>
                </div>
                <div class="ms-3">
                  <h6 class="card-title text-body-secondary">Total Revenue</h6>
                  <h3 class="fw-bold text-dark mb-0">
                    ₦{{ formatRevenue(stats.totalRevenue) }}
                  </h3>
                  <small class="text-body-tertiary">This session</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-3 col-md-6 mb-3">
          <div class="card p-0 h-100 border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex align-items-center justify-content-center">
                <div
                  class="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center"
                  style="width: 60px; height: 60px">
                  <i class="bi bi-people fs-4"></i>
                </div>
                <div class="ms-3">
                  <h6 class="card-title text-body-secondary">Total Users</h6>
                  <h3 class="fw-bold text-dark mb-0">
                    {{ stats.totalUsers.toLocaleString() }}
                  </h3>
                  <small class="text-body-tertiary">Across all roles</small>
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
          <div class="card border-0 shadow-sm p-0">
            <div class="card-header bg-transparent border-bottom-0">
              <div class="d-flex justify-content-between align-items-center">
                <h5 class="my-3 fw-bold">Recent Applications</h5>
              </div>
            </div>
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>#</th>
                      <th>Applicant</th>
                      <th>Program</th>
                      <th class="text-center">Date Applied</th>
                      <th class="text-center">Status</th>
                      <th class="text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="app in recentApplications" :key="app.id">
                      <td>
                        <code class="text-staff-primary">{{
                          app.applicationNumber
                        }}</code>
                      </td>
                      <td>
                        <div class="d-flex align-items-center">
                          <span class="fw-medium">{{ app.applicantName }}</span>
                        </div>
                      </td>
                      <td>{{ app.program }}</td>
                      <td class="text-center">
                        {{ formatDate(app.submittedAt) }}
                      </td>
                      <td class="text-center">
                        <span class="badge rounded-pill" :class="getStatusBadgeClass(app.status)">
                          {{ app.status.replace("_", " ").toUpperCase() }}
                        </span>
                      </td>
                      <td class="text-center">
                        <button class="btn btn-outline-staff-primary btn-sm">
                          <i class="bi bi-eye"></i>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="card-footer bg-transparent border-top-0 text-end py-3">
              <button class="btn btn-link text-decoration-none text-staff-primary btn-sm fw-bold"
                @click="navigateToApplications">
                View all applications
                <i class="bi bi-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Quick Actions & -->
        <div class="col-lg-4">
          <h5 class="mb-3 fw-bold">Quick Actions</h5>


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
