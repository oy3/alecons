<script lang="js">
import { useAuthStore } from '../../stores/auth.js'
import { apiService } from '../../services/api.js'
import { logger } from '@shared/utils/logger'

export default {
  name: 'ApplicationsManagement',
  setup() {
    const authStore = useAuthStore()
    return {
      authStore
    }
  },
  data() {
    return {
      applications: [],
      isLoading: true,
      searchQuery: '',
      statusFilter: 'all',
      programFilter: 'all',
      currentPage: 1,
      perPage: 10,
      totalApplications: 0,
      
      statusOptions: [
        { value: 'all', label: 'All Statuses' },
        { value: 'pending', label: 'Pending' },
        { value: 'under_review', label: 'Under Review' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' }
      ],
      
      programs: [
        'All Programs',
        'Computer Science',
        'Business Administration',
        'Engineering',
        'Medicine',
        'Law'
      ]
    }
  },
  async mounted() {
    await this.loadApplications()
  },
  computed: {
    filteredApplications() {
      let filtered = this.applications

      // Search filter
      if (this.searchQuery) {
        filtered = filtered.filter(app => 
          app.applicantName.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          app.applicationNumber.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          app.email.toLowerCase().includes(this.searchQuery.toLowerCase())
        )
      }

      // Status filter
      if (this.statusFilter !== 'all') {
        filtered = filtered.filter(app => app.status === this.statusFilter)
      }

      // Program filter
      if (this.programFilter !== 'all') {
        filtered = filtered.filter(app => app.program === this.programFilter)
      }

      return filtered
    },

    paginatedApplications() {
      const start = (this.currentPage - 1) * this.perPage
      const end = start + this.perPage
      return this.filteredApplications.slice(start, end)
    },

    totalPages() {
      return Math.ceil(this.filteredApplications.length / this.perPage)
    }
  },
  methods: {
    async loadApplications() {
      try {
        this.isLoading = true
        logger.info('Loading applications...')

        // Mock data - replace with actual API call
        await new Promise(resolve => setTimeout(resolve, 1000))

        this.applications = [
          {
            id: '1',
            applicationNumber: 'APP-2025-001',
            applicantName: 'John Doe',
            email: 'john.doe@email.com',
            phone: '+1-555-0123',
            program: 'Computer Science',
            status: 'pending',
            submittedAt: '2025-01-15T10:30:00Z',
            lastUpdated: '2025-01-15T10:30:00Z'
          },
          {
            id: '2',
            applicationNumber: 'APP-2025-002',
            applicantName: 'Jane Smith',
            email: 'jane.smith@email.com',
            phone: '+1-555-0124',
            program: 'Business Administration',
            status: 'approved',
            submittedAt: '2025-01-14T14:15:00Z',
            lastUpdated: '2025-01-16T09:20:00Z'
          },
          {
            id: '3',
            applicationNumber: 'APP-2025-003',
            applicantName: 'Mike Johnson',
            email: 'mike.johnson@email.com',
            phone: '+1-555-0125',
            program: 'Engineering',
            status: 'under_review',
            submittedAt: '2025-01-14T09:45:00Z',
            lastUpdated: '2025-01-15T16:30:00Z'
          },
          {
            id: '4',
            applicationNumber: 'APP-2025-004',
            applicantName: 'Sarah Wilson',
            email: 'sarah.wilson@email.com',
            phone: '+1-555-0126',
            program: 'Medicine',
            status: 'rejected',
            submittedAt: '2025-01-13T11:20:00Z',
            lastUpdated: '2025-01-16T08:45:00Z'
          }
        ]

        this.totalApplications = this.applications.length

        logger.info('Applications loaded successfully')
      } catch (error) {
        logger.error('Failed to load applications:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Load Failed',
          text: 'Failed to load applications'
        })
      } finally {
        this.isLoading = false
      }
    },

    getStatusBadgeClass(status) {
      const statusClasses = {
        pending: 'bg-warning text-dark',
        under_review: 'bg-info text-white',
        approved: 'bg-success text-white',
        rejected: 'bg-danger text-white'
      }
      return statusClasses[status] || 'bg-secondary text-white'
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString()
    },

    viewApplication(application) {
      // Navigate to application detail view
      this.$swal.fire({
        title: 'Application Details',
        html: `
          <div class="text-start">
            <p><strong>Application #:</strong> ${application.applicationNumber}</p>
            <p><strong>Applicant:</strong> ${application.applicantName}</p>
            <p><strong>Email:</strong> ${application.email}</p>
            <p><strong>Program:</strong> ${application.program}</p>
            <p><strong>Status:</strong> ${application.status.toUpperCase()}</p>
            <p><strong>Submitted:</strong> ${this.formatDate(application.submittedAt)}</p>
          </div>
        `,
        confirmButtonText: 'Close',
        confirmButtonColor: '#1a5f5f'
      })
    },

    async updateApplicationStatus(application, newStatus) {
      try {
        logger.info(`Updating application ${application.id} status to ${newStatus}`)

        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 500))

        // Update local data
        const index = this.applications.findIndex(app => app.id === application.id)
        if (index !== -1) {
          this.applications[index].status = newStatus
          this.applications[index].lastUpdated = new Date().toISOString()
        }

        this.$swal.fire({
          icon: 'success',
          title: 'Status Updated',
          text: `Application status updated to ${newStatus.replace('_', ' ').toUpperCase()}`,
          timer: 2000,
          showConfirmButton: false
        })

        logger.info('Application status updated successfully')
      } catch (error) {
        logger.error('Failed to update application status:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Update Failed',
          text: 'Failed to update application status'
        })
      }
    },

    exportApplications() {
      this.$swal.fire({
        title: 'Export Applications',
        text: 'This feature will be implemented soon',
        icon: 'info',
        confirmButtonColor: '#1a5f5f'
      })
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
            <h2 class="fw-bold text-staff-primary mb-1">Applications Management</h2>
            <p class="text-muted mb-0">Review and manage student applications</p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-staff-primary btn-sm" @click="exportApplications">
              <i class="bi bi-download me-2"></i>Export
            </button>
            <button class="btn btn-staff-primary btn-sm" @click="loadApplications">
              <i class="bi bi-arrow-clockwise me-2"></i>Refresh
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="staff-card">
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-4">
                <label for="searchQuery" class="form-label">Search</label>
                <input
                  type="text"
                  class="form-control"
                  id="searchQuery"
                  placeholder="Search by name, email, or application number..."
                  v-model="searchQuery"
                >
              </div>
              <div class="col-md-3">
                <label for="statusFilter" class="form-label">Status</label>
                <select class="form-select" id="statusFilter" v-model="statusFilter">
                  <option v-for="status in statusOptions" :key="status.value" :value="status.value">
                    {{ status.label }}
                  </option>
                </select>
              </div>
              <div class="col-md-3">
                <label for="programFilter" class="form-label">Program</label>
                <select class="form-select" id="programFilter" v-model="programFilter">
                  <option value="all">All Programs</option>
                  <option v-for="program in programs.slice(1)" :key="program" :value="program">
                    {{ program }}
                  </option>
                </select>
              </div>
              <div class="col-md-2 d-flex align-items-end">
                <button class="btn btn-outline-staff-primary w-100" @click="loadApplications">
                  <i class="bi bi-funnel me-2"></i>Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-staff-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-3 text-muted">Loading applications...</p>
    </div>

    <!-- Applications Table -->
    <div v-else class="row">
      <div class="col-12">
        <div class="staff-card">
          <div class="card-header bg-transparent border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="mb-0 fw-bold">
                Applications ({{ filteredApplications.length }} of {{ totalApplications }})
              </h5>
            </div>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Application #</th>
                    <th>Applicant</th>
                    <th>Contact</th>
                    <th>Program</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="app in paginatedApplications" :key="app.id">
                    <td>
                      <code class="text-staff-primary">{{ app.applicationNumber }}</code>
                    </td>
                    <td>
                      <div class="d-flex align-items-center">
                        <div class="bg-staff-light rounded-circle p-2 me-2">
                          <i class="bi bi-person text-staff-primary"></i>
                        </div>
                        <span class="fw-medium">{{ app.applicantName }}</span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div class="small">{{ app.email }}</div>
                        <div class="small text-muted">{{ app.phone }}</div>
                      </div>
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
                        <button 
                          class="btn btn-outline-staff-primary btn-sm" 
                          @click="viewApplication(app)"
                          title="View Details"
                        >
                          <i class="bi bi-eye"></i>
                        </button>
                        <div class="btn-group" role="group">
                          <button 
                            type="button" 
                            class="btn btn-outline-success btn-sm dropdown-toggle" 
                            data-bs-toggle="dropdown"
                            title="Update Status"
                          >
                            <i class="bi bi-check-circle"></i>
                          </button>
                          <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="#" @click.prevent="updateApplicationStatus(app, 'pending')">
                              <i class="bi bi-clock text-warning me-2"></i>Pending
                            </a></li>
                            <li><a class="dropdown-item" href="#" @click.prevent="updateApplicationStatus(app, 'under_review')">
                              <i class="bi bi-eye text-info me-2"></i>Under Review
                            </a></li>
                            <li><a class="dropdown-item" href="#" @click.prevent="updateApplicationStatus(app, 'approved')">
                              <i class="bi bi-check-circle text-success me-2"></i>Approved
                            </a></li>
                            <li><a class="dropdown-item" href="#" @click.prevent="updateApplicationStatus(app, 'rejected')">
                              <i class="bi bi-x-circle text-danger me-2"></i>Rejected
                            </a></li>
                          </ul>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Pagination -->
          <div class="card-footer bg-transparent" v-if="totalPages > 1">
            <nav>
              <ul class="pagination pagination-sm mb-0 justify-content-center">
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <button class="page-link" @click="currentPage = currentPage - 1" :disabled="currentPage === 1">
                    Previous
                  </button>
                </li>
                <li 
                  class="page-item" 
                  :class="{ active: currentPage === page }"
                  v-for="page in totalPages" 
                  :key="page"
                >
                  <button class="page-link" @click="currentPage = page">
                    {{ page }}
                  </button>
                </li>
                <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                  <button class="page-link" @click="currentPage = currentPage + 1" :disabled="currentPage === totalPages">
                    Next
                  </button>
                </li>
              </ul>
            </nav>
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

.table th {
  font-weight: 600;
  color: var(--staff-primary);
  border-bottom: 2px solid var(--staff-light);
}

.table td {
  vertical-align: middle;
}

.pagination .page-link {
  color: var(--staff-primary);
  border-color: var(--staff-light);
}

.pagination .page-item.active .page-link {
  background-color: var(--staff-primary);
  border-color: var(--staff-primary);
}

.dropdown-menu {
  border: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

code {
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: var(--staff-light);
}
</style>