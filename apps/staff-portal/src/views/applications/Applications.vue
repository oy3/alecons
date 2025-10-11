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
      searchTimeout: null,
      statusFilter: 'all',
      programFilter: 'all',
      currentPage: 1,
      perPage: 10,
      totalApplications: 0,
      apiTotalPages: 0,

      statusOptions: [
        { value: 'all', label: 'All Statuses' },
        { value: 'pending', label: 'Pending' },
        { value: 'admitted', label: 'Admitted' },
        { value: 'cleared', label: 'Cleared' },
        { value: 'completed', label: 'Completed' },
        { value: 'rejected', label: 'Rejected' }
      ],

      programs: ['All Programs'] // Will be populated from API
    }
  },
  async mounted() {
    // Initialize auth store first
    await this.authStore.initialize()

    // Check permissions before loading
    if (!this.authStore.hasAnyPermission(['applications:view', 'view'])) {
      this.$swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'You do not have permission to view applications',
        confirmButtonColor: '#1a5f5f'
      })
      return
    }

    // Load programs and applications
    await Promise.all([
      this.loadPrograms(),
      this.loadApplications()
    ])
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
      // Use totalPages from API response if available, otherwise calculate
      const calculated = Math.ceil(this.filteredApplications.length / this.perPage)
      return this.apiTotalPages || Math.max(1, calculated)
    }
  },
  watch: {
    // Reload applications when filters change
    statusFilter() {
      this.currentPage = 1
      this.loadApplications()
    },
    programFilter() {
      this.currentPage = 1
      this.loadApplications()
    },
    searchQuery() {
      // Debounce search to avoid too many requests
      clearTimeout(this.searchTimeout)
      this.searchTimeout = setTimeout(() => {
        this.currentPage = 1
        this.loadApplications()
      }, 500)
    },
    currentPage() {
      this.loadApplications()
    }
  },
  methods: {
    async loadApplications() {
      try {
        this.isLoading = true

        // Debug authentication state
        logger.info('Authentication state:', {
          isAuthenticated: this.authStore.isAuthenticated,
          hasUser: !!this.authStore.user,
          hasToken: !!this.authStore.token,
          userRole: this.authStore.userRole
        })

        logger.info('Loading applications...', {
          filters: {
            status: this.statusFilter,
            program: this.programFilter,
            search: this.searchQuery,
            page: this.currentPage,
            limit: this.perPage
          }
        })

        // Prepare query parameters
        const params = {
          page: this.currentPage,
          limit: this.perPage,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        }

        if (this.statusFilter && this.statusFilter !== 'all') {
          params.status = this.statusFilter
        }

        if (this.programFilter && this.programFilter !== 'all') {
          params.program = this.programFilter
        }

        if (this.searchQuery && this.searchQuery.trim()) {
          params.search = this.searchQuery.trim()
        }

        // Make API call to get applications
        const response = await apiService.getApplications(params)

        if (response.success) {
          this.applications = response.data.applications.map(app => ({
            id: app._id,
            applicationNumber: app.applicationNumber,
            applicantName: app.applicantName,
            email: app.email,
            phone: app.phone || 'N/A',
            program: app.programName,
            status: app.status,
            profileImageUrl: app.profileImageUrl,
            submittedAt: app.createdAt,
            lastUpdated: app.updatedAt,
            matriculationNumber: app.matriculationNumber
          }))

          this.totalApplications = response.data.pagination.totalItems
          this.currentPage = response.data.pagination.currentPage
          this.apiTotalPages = response.data.pagination.totalPages

          logger.info('Applications loaded successfully', {
            count: this.applications.length,
            total: this.totalApplications,
            page: this.currentPage
          })
        } else {
          throw new Error(response.message || 'Failed to load applications')
        }
      } catch (error) {
        logger.error('Failed to load applications:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Load Failed',
          text: error.message || 'Failed to load applications',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        this.isLoading = false
      }
    },

    getStatusBadgeClass(status) {
      const statusClasses = {
        pending: 'bg-warning text-dark',
        admitted: 'bg-success text-white',
        cleared: 'bg-info text-white',
        completed: 'bg-primary text-white',
        rejected: 'bg-danger text-white'
      }
      return statusClasses[status] || 'bg-secondary text-white'
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString()
    },

    calculateAge(dateOfBirth) {
      if (!dateOfBirth) return 'N/A'
      
      const today = new Date()
      const birthDate = new Date(dateOfBirth)
      
      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }
      
      return age
    },

    async viewApplication(application) {
      try {
        logger.info('Viewing application details:', {
          applicationId: application.id,
          applicationNumber: application.applicationNumber
        })

        // Show loading state
        this.$swal.fire({
          title: 'Loading Application Details...',
          allowOutsideClick: false,
          didOpen: () => {
            this.$swal.showLoading()
          }
        })

        // Fetch detailed application data
        const response = await apiService.getApplication(application.id)

        if (response.success && response.data?.application) {
          const app = response.data.application
          const user = app.userId
          const program = app.programId

          this.$swal.fire({
            title: 'Application Details',
            html: `

            <div class="clearfix text-start">
  <img src="${app.profileImageUrl || 'https://placehold.co/400'}" class="col-md-2 float-md-start mb-3 ms-md-3 rounded-circle border border-staff-primary border-2 me-3" alt="Student's profile picture" />

  <div class="">
  <strong>${user?.firstName || ''} ${user?.otherName || ''} ${user?.lastName || ''}</strong>
 <span class="badge ${this.getStatusBadgeClass(app.status)}"
      > ${app.status.toUpperCase()} </span
    >
    </div>

    <div class="fs-6 d-flex align-items-center mb-1">
          <span>Age ${this.calculateAge(app.dob)}</span>
          <i class="bi bi-dot fs-4"></i>
                <span> ${user?.role}</span>
                      <i class="bi bi-dot fs-4"></i>
                       <span> ${app.nationality || 'N/A'}</span>
      </div>



    <div class="fs-6 d-flex align-items-center mb-3">
        <span class="me-4"> Submitted ${this.formatDate(app.createdAt)} </span>
        <span class="">Last Updated ${this.formatDate(app.updatedAt)}</span>
      </div>

<div class="mb-3">
<button class="btn btn-sm btn-outline-dark me-2"> <i class="bi bi-envelope-at"></i> ${user?.email}</button>
<button class="btn btn-sm btn-outline-dark"> <i class="bi bi-telephone"></i> ${app.phone}</button>
</div>

</div>

<div>

  <ul class="nav nav-underline">
  <li class="nav-item">
    <a class="nav-link active" aria-current="page" href="#">Active</a>
  </li>
  <li class="nav-item">
    <a class="nav-link" href="#">Link</a>
  </li>
  <li class="nav-item">
    <a class="nav-link" href="#">Link</a>
  </li>
  <li class="nav-item">
    <a class="nav-link disabled" aria-disabled="true">Disabled</a>
  </li>
</ul>
  
</div>


              <div class="text-start">
                <div class="row">
                  <div class="col-12 mb-3">
                    <h6 class="text-staff-primary fw-bold mb-2">Basic Information</h6>
                    <p class="mb-1"><strong>Application #:</strong> ${app.applicationNumber}</p>
                    <p class="mb-1"><strong>Applicant:</strong> ${user?.firstName || ''} ${user?.lastName || ''}</p>
                    <p class="mb-1"><strong>Email:</strong> ${user?.email || 'N/A'}</p>
                    <p class="mb-1"><strong>Phone:</strong> ${app.phone || 'N/A'}</p>
                    <p class="mb-1"><strong>Program:</strong> ${program?.name || 'N/A'}</p>
                    <p class="mb-1"><strong>Status:</strong> <span class="badge ${this.getStatusBadgeClass(app.status)}">${app.status.toUpperCase()}</span></p>
                  </div>
                  ${app.address ? `
                    <div class="col-12 mb-3">
                      <h6 class="text-staff-primary fw-bold mb-2">Address Information</h6>
                      <p class="mb-1"><strong>Address:</strong> ${app.address}</p>
                      <p class="mb-1"><strong>State of Origin:</strong> ${app.stateOfOrigin || 'N/A'}</p>
                      <p class="mb-1"><strong>LGA:</strong> ${app.lga || 'N/A'}</p>
                      <p class="mb-1"><strong>Nationality:</strong> ${app.nationality || 'N/A'}</p>
                    </div>
                  ` : ''}
                  <div class="col-12">
                    <h6 class="text-staff-primary fw-bold mb-2">Application Timeline</h6>

          
                    ${app.documents?.length ? `<p class="mb-1"><strong>Documents:</strong> ${app.documents.length} uploaded</p>` : ''}
                  </div>
                </div>
              </div>
            `,
            confirmButtonText: 'Close',
            confirmButtonColor: '#1a5f5f',
            width: '600px'
          })

          logger.info('Application details displayed successfully')
        } else {
          throw new Error(response.message || 'Failed to load application details')
        }
      } catch (error) {
        logger.error('Failed to view application details:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to load application details',
          confirmButtonColor: '#1a5f5f'
        })
      }
    },

    async updateApplicationStatus(application, newStatus) {
      try {
        // Check permissions
        if (!this.authStore.hasAnyPermission(['applications:update', 'update'])) {
          this.$swal.fire({
            icon: 'error',
            title: 'Access Denied',
            text: 'You do not have permission to update application status',
            confirmButtonColor: '#1a5f5f'
          })
          return
        }

        logger.info('Updating application status:', {
          applicationId: application.id,
          applicationNumber: application.applicationNumber,
          oldStatus: application.status,
          newStatus
        })

        // Show confirmation dialog
        const result = await this.$swal.fire({
          title: 'Confirm Status Update',
          text: `Change status from ${application.status.toUpperCase()} to ${newStatus.toUpperCase()}?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#1a5f5f',
          cancelButtonColor: '#6c757d',
          confirmButtonText: 'Yes, update it!'
        })

        if (!result.isConfirmed) {
          return
        }

        // Make API call to update status
        const response = await apiService.updateApplicationStatus(
          application.id,
          newStatus
        )

        if (response.success) {
          // Update local data
          const index = this.applications.findIndex(app => app.id === application.id)
          if (index !== -1) {
            this.applications[index].status = newStatus
            this.applications[index].lastUpdated = new Date().toISOString()
          }

          this.$swal.fire({
            icon: 'success',
            title: 'Status Updated',
            text: `Application status updated to ${newStatus.toUpperCase()}`,
            timer: 2000,
            showConfirmButton: false
          })

          logger.info('Application status updated successfully', {
            applicationId: application.id,
            newStatus
          })
        } else {
          throw new Error(response.message || 'Failed to update status')
        }
      } catch (error) {
        logger.error('Failed to update application status:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Update Failed',
          text: error.message || 'Failed to update application status',
          confirmButtonColor: '#1a5f5f'
        })
      }
    },

    exportApplications() {
      // Check permissions
      if (!this.authStore.hasAnyPermission(['applications:export', 'export'])) {
        this.$swal.fire({
          icon: 'error',
          title: 'Access Denied',
          text: 'You do not have permission to export applications',
          confirmButtonColor: '#1a5f5f'
        })
        return
      }

      this.$swal.fire({
        title: 'Export Applications',
        text: 'This feature will be implemented soon',
        icon: 'info',
        confirmButtonColor: '#1a5f5f'
      })
    },

    async loadPrograms() {
      try {
        logger.info('Loading programs for filter...')
        logger.info('API Service token:', { hasToken: !!apiService.token })

        // Use the programs endpoint to get available programs
        const response = await apiService.makeRequest('/programs')

        if (response.success && response.data) {
          this.programs = ['All Programs', ...response.data.map(program => program.name)]
          logger.info('Programs loaded successfully', { count: response.data.length })
        }
      } catch (error) {
        logger.error('Failed to load programs:', error)
        // Keep default programs if API fails
      }
    },

    resetFilters() {
      logger.info('Resetting all filters')

      // Reset all filter values
      this.searchQuery = ''
      this.statusFilter = 'all'
      this.programFilter = 'all'
      this.currentPage = 1

      // Clear any pending search timeout
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
        this.searchTimeout = null
      }

      // Reload applications with reset filters
      this.loadApplications()

      logger.info('Filters reset successfully')
    },

    async sendMatriculationEmail(application) {
      try {
        // Show confirmation dialog
        const result = await this.$swal.fire({
          icon: 'question',
          title: 'Send Matriculation Email',
          text: `Send matriculation email to ${application.applicantName}?`,
          showCancelButton: true,
          confirmButtonText: 'Send Email',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#1a5f5f',
          cancelButtonColor: '#6c757d'
        })

        if (!result.isConfirmed) {
          return
        }

        // Show loading
        this.$swal.fire({
          title: 'Sending Email...',
          text: 'Please wait while we send the matriculation email.',
          allowOutsideClick: false,
          showConfirmButton: false,
          willOpen: () => {
            this.$swal.showLoading()
          }
        })

        // Make API call
        const response = await apiService.sendMatriculationEmail(application.id)

        if (response.success) {
          this.$swal.fire({
            icon: 'success',
            title: 'Email Sent Successfully!',
            text: `Matriculation email sent to ${application.email}`,
            confirmButtonColor: '#1a5f5f'
          })

          logger.info('Matriculation email sent successfully:', {
            applicationId: application.id,
            email: application.email,
            matricNumber: response.data?.matriculationNumber
          })
        } else {
          throw new Error(response.message || 'Failed to send email')
        }

      } catch (error) {
        logger.error('Error sending matriculation email:', error)
        
        this.$swal.fire({
          icon: 'error',
          title: 'Failed to Send Email',
          text: error.message || 'An error occurred while sending the matriculation email',
          confirmButtonColor: '#dc3545'
        })
      }
    },

    async handleMatriculationAction(application) {
      if (application.matriculationNumber) {
        // If matriculation number exists, send email
        await this.sendMatriculationEmail(application)
      } else {
        // If matriculation number doesn't exist, generate it first
        await this.generateMatriculationNumber(application)
      }
    },

    async generateMatriculationNumber(application) {
      try {
        // Show confirmation dialog
        const result = await this.$swal.fire({
          icon: 'question',
          title: 'Generate Matriculation Number',
          text: `Generate matriculation number for ${application.applicantName}? This will also send the email automatically.`,
          showCancelButton: true,
          confirmButtonText: 'Generate',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#1a5f5f',
          cancelButtonColor: '#6c757d'
        })

        if (!result.isConfirmed) {
          return
        }

        // Show loading
        this.$swal.fire({
          title: 'Generating Matriculation Number...',
          text: 'Please wait while we generate the matriculation number and send the email.',
          allowOutsideClick: false,
          showConfirmButton: false,
          willOpen: () => {
            this.$swal.showLoading()
          }
        })

        // Make API call
        const response = await apiService.generateMatriculationNumber(application.id)

        if (response.success) {
          this.$swal.fire({
            icon: 'success',
            title: 'Matriculation Number Generated!',
            text: `Matriculation number generated and email sent to ${application.email}`,
            confirmButtonColor: '#1a5f5f'
          })

          logger.info('Matriculation number generated successfully:', {
            applicationId: application.id,
            email: application.email,
            matricNumber: response.data?.matriculationNumber
          })

          // Refresh the applications list to show updated data
          await this.loadApplications()
        } else {
          throw new Error(response.message || 'Failed to generate matriculation number')
        }

      } catch (error) {
        logger.error('Error generating matriculation number:', error)
        
        this.$swal.fire({
          icon: 'error',
          title: 'Failed to Generate Matriculation Number',
          text: error.message || 'An error occurred while generating the matriculation number',
          confirmButtonColor: '#dc3545'
        })
      }
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
              Applications Management
            </h2>
            <p class="text-muted mb-0">
              Review and manage student applications
            </p>
          </div>
          <div class="d-flex gap-2">
            <button
              class="btn btn-outline-staff-primary btn-sm"
              @click="exportApplications"
            >
              <i class="bi bi-download me-2"></i>Export
            </button>
            <button
              class="btn btn-staff-primary btn-sm"
              @click="loadApplications"
            >
              <i class="bi bi-arrow-clockwise me-2"></i>Refresh
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
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
                />
              </div>
              <div class="col-md-3">
                <label for="statusFilter" class="form-label">Status</label>
                <select
                  class="form-select"
                  id="statusFilter"
                  v-model="statusFilter"
                >
                  <option
                    v-for="status in statusOptions"
                    :key="status.value"
                    :value="status.value"
                  >
                    {{ status.label }}
                  </option>
                </select>
              </div>
              <div class="col-md-3">
                <label for="programFilter" class="form-label">Program</label>
                <select
                  class="form-select"
                  id="programFilter"
                  v-model="programFilter"
                >
                  <option value="all">All Programs</option>
                  <option
                    v-for="program in programs.slice(1)"
                    :key="program"
                    :value="program"
                  >
                    {{ program }}
                  </option>
                </select>
              </div>
              <div class="col-md-2 d-flex align-items-end">
                <button
                  class="btn btn-outline-staff-primary w-100"
                  @click="resetFilters"
                >
                  <i class="bi bi-funnel-fill me-2"></i>Reset
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
        <div class="card border-0 p-0 shadow-sm">
          <!-- <div class="card-header bg-transparent border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="mb-0 fw-bold">
                Applications ({{ filteredApplications.length }} of {{ totalApplications }})
              </h5>
            </div>
          </div> -->
          <div class="card-body p-0">
              <table class="table table-hover mb-0">
                <thead class="">
                  <tr>
                    <th>#</th>
                    <th>Applicant</th>
                    <th>Contact</th>
                    <th>Program</th>
                    <th class="text-center">Status</th>
                    <th class="text-center">Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <!-- No data message when no applications found -->
                  <tr v-if="paginatedApplications.length === 0">
                    <td colspan="7" class="text-center py-5">
                      <div class="text-muted">
                        <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
                        <h5 class="mb-2">No Applications Found</h5>
                        <p
                          class="mb-0"
                          v-if="
                            searchQuery ||
                            statusFilter !== 'all' ||
                            programFilter !== 'all'
                          "
                        >
                          No applications match your current filters.
                          <button
                            class="btn btn-link p-0 text-staff-primary"
                            @click="resetFilters"
                          >
                            Reset filters
                          </button>
                          to see all applications.
                        </p>
                        <p class="mb-0" v-else>
                          No applications have been submitted yet.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <!-- Application rows -->
                  <tr v-for="app in paginatedApplications" :key="app.id">
                    <td>
                      <code class="text-staff-primary">{{
                        app.applicationNumber
                      }}</code>
                    </td>
                    <td>
                      <div class="d-flex align-items-center">
                        <div
                          class="border border-staff-primary bg-staff-light rounded-circle me-2 d-flex align-items-center justify-content-center"
                          style="height: 40px; width: 40px"
                        >
                          <img
                            v-if="app.profileImageUrl"
                            :src="app.profileImageUrl"
                            alt=""
                            class="rounded-circle"
                            style="height: 100%; width: 100%"
                          />

                          <i
                            v-else
                            class="bi bi-person text-staff-primary fs-4"
                          ></i>
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
                    <td class="text-center">
                      <span
                        class="badge rounded-pill"
                        :class="getStatusBadgeClass(app.status)"
                      >
                        {{ app.status.replace("_", " ").toUpperCase() }}
                      </span>
                    </td>
                    <td class="text-center">
                      {{ formatDate(app.submittedAt) }}
                    </td>
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
                            <i class="bi bi-three-dots-vertical"></i>
                          </button>
                          <ul class="dropdown-menu">
                            <li v-if="app.status === 'completed'" class="">
                                <a
                                class="dropdown-item"
                                href="#"
                                @click.prevent="handleMatriculationAction(app)"
                              >
                              <i class="bi bi-envelope text-success me-2" v-if="app.matriculationNumber"></i>
                              <i class="bi bi-plus-circle text-primary me-2" v-else></i>
                               {{ app.matriculationNumber ? 'Send matric no.' : 'Generate matric no.' }}
                            </a>                      
                            </li>
<!-- 
                            <li>
                              <a
                                class="dropdown-item"
                                href="#"
                                @click.prevent="
                                  updateApplicationStatus(app, 'pending')
                                "
                              >
                                <i class="bi bi-clock text-warning me-2"></i
                                >Pending
                              </a>
                            </li>
                            <li>
                              <a
                                class="dropdown-item"
                                href="#"
                                @click.prevent="
                                  updateApplicationStatus(app, 'admitted')
                                "
                              >
                                <i
                                  class="bi bi-check-circle text-success me-2"
                                ></i
                                >Admitted
                              </a>
                            </li>
                            <li>
                              <a
                                class="dropdown-item"
                                href="#"
                                @click.prevent="
                                  updateApplicationStatus(app, 'cleared')
                                "
                              >
                                <i class="bi bi-shield-check text-info me-2"></i
                                >Cleared
                              </a>
                            </li>
                            <li>
                              <a
                                class="dropdown-item"
                                href="#"
                                @click.prevent="
                                  updateApplicationStatus(app, 'completed')
                                "
                              >
                                <i class="bi bi-check-all text-primary me-2"></i
                                >Completed
                              </a>
                            </li>
                            <li>
                              <a
                                class="dropdown-item"
                                href="#"
                                @click.prevent="
                                  updateApplicationStatus(app, 'rejected')
                                "
                              >
                                <i class="bi bi-x-circle text-danger me-2"></i
                                >Rejected
                              </a>
                            </li> -->


                          </ul>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
          </div>

          <!-- Pagination -->
          <div class="card-footer border-top-0 bg-transparent">
            <nav>
              <ul class="pagination pagination-sm mb-0 justify-content-center">
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <button
                    class="page-link"
                    @click="currentPage = currentPage - 1"
                    :disabled="currentPage === 1"
                  >
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
                <li
                  class="page-item"
                  :class="{ disabled: currentPage >= totalPages || filteredApplications.length === 0 }"
                >
                  <button
                    class="page-link"
                    @click="currentPage = currentPage + 1"
                    :disabled="currentPage >= totalPages || filteredApplications.length === 0"
                  >
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
  color: white;
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
