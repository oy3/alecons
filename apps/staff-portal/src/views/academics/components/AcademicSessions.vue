<script>
import { apiService } from '../../../services/api.js'
import { logger } from '@shared/utils/logger'

export default {
  name: 'AcademicSessions',
  data() {
    return {
      sessions: [],
      isLoading: true,
      searchQuery: '',
      searchTimeout: null,
      currentPage: 1,
      perPage: 10,
      totalSessions: 0,
      apiTotalPages: 0,
      
      // Status options
      statusOptions: [
        { value: 'draft', label: 'Draft', class: 'bg-secondary' },
        { value: 'open', label: 'Open', class: 'bg-success' },
        { value: 'ongoing', label: 'Ongoing', class: 'bg-primary' },
        { value: 'closed', label: 'Closed', class: 'bg-danger' }
      ],

      // Session controls data
      selectedSession: null,
      sessionControls: null,
      controlsLoading: false,
      availablePayments: []
    }
  },
  computed: {
    filteredSessions() {
      return this.sessions
    },

    paginatedSessions() {
      return this.sessions
    },

    totalPages() {
      const calculated = Math.ceil(this.totalSessions / this.perPage)
      return this.apiTotalPages || Math.max(1, calculated)
    }
  },
  watch: {
    searchQuery() {
      this.currentPage = 1
      this.debouncedLoadSessions()
    },
    currentPage() {
      this.loadSessions()
    }
  },
  async mounted() {
    await this.loadSessions()
  },
  methods: {
    debouncedLoadSessions() {
      clearTimeout(this.searchTimeout)
      this.searchTimeout = setTimeout(() => {
        this.loadSessions()
      }, 500)
    },

    async loadSessions() {
      try {
        this.isLoading = true
        logger.info('Loading academic sessions...')

        const params = {
          page: this.currentPage,
          limit: this.perPage,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        }

        if (this.searchQuery && this.searchQuery.trim()) {
          params.search = this.searchQuery.trim()
        }

        const response = await apiService.getAcademicSessions(params)

        if (response.success) {
          this.sessions = response.data.sessions.map(session => ({
            id: session._id,
            sessionYear: session.sessionYear,
            title: session.title || '',
            description: session.description || '',
            startDate: session.startDate,
            endDate: session.endDate,
            status: session.status,
            active: session.active,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
          }))

          this.totalSessions = response.data.pagination.totalItems
          this.currentPage = response.data.pagination.currentPage
          this.apiTotalPages = response.data.pagination.totalPages

          logger.info('Academic sessions loaded successfully', { 
            count: this.sessions.length,
            total: this.totalSessions 
          })
        }
      } catch (error) {
        logger.error('Failed to load academic sessions:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to load academic sessions',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        this.isLoading = false
      }
    },

    generateSessionYear(startDate, endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      return `${start.getFullYear()}/${end.getFullYear()}`
    },

    formatDate(dateString) {
      if (!dateString) return 'N/A'
      return new Date(dateString).toLocaleDateString()
    },

    getStatusBadgeClass(status) {
      const statusOption = this.statusOptions.find(s => s.value === status)
      return statusOption ? statusOption.class : 'bg-secondary'
    },

    async showAddSessionModal() {
      const { value: formValues } = await this.$swal.fire({
        title: 'Add New Academic Session',
        html: `
          <div class="row text-start">
            <div class="col-12 mb-3">
              <label class="form-label">Academic Session Year</label>
              <input id="sessionYear" class="form-control" placeholder="Auto-generated from dates" readonly>
            </div>
            <div class="col-6 mb-3">
              <label class="form-label">Start Date</label>
              <input id="startDate" type="date" class="form-control" required>
            </div>
            <div class="col-6 mb-3">
              <label class="form-label">End Date</label>
              <input id="endDate" type="date" class="form-control" required>
            </div>
            <div class="col-12 mb-3">
              <label class="form-label">Session Title</label>
              <input id="title" class="form-control" placeholder="e.g. 2026/2027 Batch A">
            </div>
            <div class="col-12 mb-3">
              <label class="form-label">Description</label>
              <textarea id="description" class="form-control" placeholder="Session description..." rows="3"></textarea>
            </div>
            <div class="col-6 mb-3">
              <label class="form-label">Status</label>
              <select id="status" class="form-select" required>
                <option value="">--Select status--</option>
                <option value="draft">Draft</option>
                <option value="open" selected>Open</option>
                <option value="ongoing">Ongoing</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div class="col-6 mb-3">
              <div class="form-check mt-4">
                <input class="form-check-input" type="checkbox" id="active" checked>
                <label class="form-check-label" for="active">Active Session</label>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Add Session',
        confirmButtonColor: '#1a5f5f',
        didOpen: () => {
          // Auto-generate session year when dates change
          const startDateInput = document.getElementById('startDate')
          const endDateInput = document.getElementById('endDate')
          const sessionYearInput = document.getElementById('sessionYear')

          const updateSessionYear = () => {
            if (startDateInput.value && endDateInput.value) {
              const sessionYear = this.generateSessionYear(startDateInput.value, endDateInput.value)
              sessionYearInput.value = sessionYear
            }
          }

          startDateInput.addEventListener('change', updateSessionYear)
          endDateInput.addEventListener('change', updateSessionYear)
        },
        preConfirm: () => {
          const startDate = document.getElementById('startDate').value
          const endDate = document.getElementById('endDate').value
          const title = document.getElementById('title').value
          const description = document.getElementById('description').value
          const status = document.getElementById('status').value
          const active = document.getElementById('active').checked

          if (!startDate || !endDate || !status) {
            this.$swal.showValidationMessage('Please fill in all required fields')
            return false
          }

          if (new Date(endDate) <= new Date(startDate)) {
            this.$swal.showValidationMessage('End date must be after start date')
            return false
          }

          return {
            startDate,
            endDate,
            title: title || undefined,
            description: description || undefined,
            status,
            active
          }
        }
      })

      if (formValues) {
        await this.addSession(formValues)
      }
    },

    async addSession(sessionData) {
      try {
        logger.info('Adding new academic session:', sessionData)

        const response = await apiService.createAcademicSession(sessionData)

        if (response.success) {
          this.$swal.fire({
            icon: 'success',
            title: 'Success',
            text: 'Academic session added successfully',
            timer: 2000,
            showConfirmButton: false
          })

          await this.loadSessions()
          this.$emit('refresh')
        } else {
          throw new Error(response.message)
        }
      } catch (error) {
        logger.error('Failed to add academic session:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to add academic session',
          confirmButtonColor: '#1a5f5f'
        })
      }
    },

    async editSession(session) {
      const { value: formValues } = await this.$swal.fire({
        title: 'Edit Academic Session',
        html: `
          <div class="row g-3 text-start">
            <div class="col-12 mb-3">
              <label class="form-label">Academic Session Year</label>
              <input id="sessionYear" class="form-control" value="${session.sessionYear}" readonly>
            </div>
            <div class="col-6 mb-3">
              <label class="form-label">Start Date</label>
              <input id="startDate" type="date" class="form-control" value="${session.startDate?.split('T')[0]}" required>
            </div>
            <div class="col-6 mb-3">
              <label class="form-label">End Date</label>  
              <input id="endDate" type="date" class="form-control" value="${session.endDate?.split('T')[0]}" required>
            </div>
            <div class="col-12 mb-3">
              <label class="form-label">Session Title</label>
              <input id="title" class="form-control" value="${session.title || ''}" placeholder="e.g. 2026/2027 Batch A">
            </div>
            <div class="col-12 mb-3">
              <label class="form-label">Description</label>
              <textarea id="description" class="form-control" rows="3">${session.description || ''}</textarea>
            </div>
            <div class="col-6 mb-3">
              <label class="form-label">Status</label>
              <select id="status" class="form-select" required>
                <option value="">--Select status--</option>
                <option value="draft" ${session.status === 'draft' ? 'selected' : ''}>Draft</option>
                <option value="open" ${session.status === 'open' ? 'selected' : ''}>Open</option>
                <option value="ongoing" ${session.status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
                <option value="closed" ${session.status === 'closed' ? 'selected' : ''}>Closed</option>
              </select>
            </div>
            <div class="col-6 mb-3">
              <div class="form-check mt-4">
                <input class="form-check-input" type="checkbox" id="active" ${session.active ? 'checked' : ''}>
                <label class="form-check-label" for="active">Active Session</label>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Update Session',
        confirmButtonColor: '#1a5f5f',
        didOpen: () => {
          // Auto-generate session year when dates change
          const startDateInput = document.getElementById('startDate')
          const endDateInput = document.getElementById('endDate')
          const sessionYearInput = document.getElementById('sessionYear')

          const updateSessionYear = () => {
            if (startDateInput.value && endDateInput.value) {
              const sessionYear = this.generateSessionYear(startDateInput.value, endDateInput.value)
              sessionYearInput.value = sessionYear
            }
          }

          startDateInput.addEventListener('change', updateSessionYear)
          endDateInput.addEventListener('change', updateSessionYear)
        },
        preConfirm: () => {
          const startDate = document.getElementById('startDate').value
          const endDate = document.getElementById('endDate').value
          const title = document.getElementById('title').value
          const description = document.getElementById('description').value
          const status = document.getElementById('status').value
          const active = document.getElementById('active').checked

          if (!startDate || !endDate || !status) {
            this.$swal.showValidationMessage('Please fill in all required fields')
            return false
          }

          if (new Date(endDate) <= new Date(startDate)) {
            this.$swal.showValidationMessage('End date must be after start date')
            return false
          }

          return {
            startDate,
            endDate,
            title: title || undefined,
            description: description || undefined,
            status,
            active
          }
        }
      })

      if (formValues) {
        await this.updateSession(session.id, formValues)
      }
    },

    async updateSession(sessionId, sessionData) {
      try {
        logger.info('Updating academic session:', { sessionId, sessionData })

        const response = await apiService.updateAcademicSession(sessionId, sessionData)

        if (response.success) {
          this.$swal.fire({
            icon: 'success',
            title: 'Success',
            text: 'Academic session updated successfully',
            timer: 2000,
            showConfirmButton: false
          })

          await this.loadSessions()
          this.$emit('refresh')
        } else {
          throw new Error(response.message)
        }
      } catch (error) {
        logger.error('Failed to update academic session:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to update academic session',
          confirmButtonColor: '#1a5f5f'
        })
      }
    },

    async deleteSession(session) {
      const result = await this.$swal.fire({
        title: 'Delete Academic Session',
        text: `Are you sure you want to delete "${session.sessionYear}"? This action cannot be undone and will also delete all associated session controls.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it!'
      })

      if (result.isConfirmed) {
        try {
          logger.info('Deleting academic session:', session.id)

          const response = await apiService.deleteAcademicSession(session.id)

          if (response.success) {
            this.$swal.fire({
              icon: 'success',
              title: 'Deleted!',
              text: 'Academic session has been deleted.',
              timer: 2000,
              showConfirmButton: false
            })

            await this.loadSessions()
            this.$emit('refresh')
          } else {
            throw new Error(response.message)
          }
        } catch (error) {
          logger.error('Failed to delete academic session:', error)
          this.$swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Failed to delete academic session',
            confirmButtonColor: '#1a5f5f'
          })
        }
      }
    },

    async viewControls(session) {
      await this.showControlsModal(session)
    },

    async showControlsModal(session) {
      try {
        this.selectedSession = session
        this.controlsLoading = true

        logger.info('Loading session controls for session:', session.id)

        // Load session controls
        const response = await apiService.getSessionControls(session.id)
        logger.info('Session controls response:', response)
        
        if (response.success) {
          this.sessionControls = response.data.controls
          logger.info('Loaded session controls:', this.sessionControls)
        } else {
          logger.error('Failed to load session controls:', response)
          throw new Error(response.message || 'Failed to load session controls')
        }

        // Load available payments for dropdown
        const paymentsResponse = await apiService.getPayments({ limit: 100 })
        logger.info('Payments response:', paymentsResponse)
        
        if (paymentsResponse.success) {
          this.availablePayments = paymentsResponse.data.payments
          logger.info('Loaded payments:', this.availablePayments)
        } else {
          logger.warn('Failed to load payments:', paymentsResponse)
          this.availablePayments = []
        }

        this.controlsLoading = false

        const { value: action } = await this.$swal.fire({
          title: `Session Controls - ${session.title}`,
          html: this.getControlsModalHTML(),
          showCloseButton: true,
          showConfirmButton: false,
          width: '900px',
          customClass: {
            htmlContainer: 'p-0'
          },
          didOpen: () => {
            this.initializeControlsModal()
          }
        })
      } catch (error) {
        this.controlsLoading = false
        logger.error('Failed to load session controls:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to load session controls',
          confirmButtonColor: '#1a5f5f'
        })
      }
    },

    getControlsModalHTML() {
      if (this.controlsLoading) {
        return `
          <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3 text-muted">Loading session controls...</p>
          </div>
        `
      }

      const controls = this.sessionControls?.controls || []
      const payments = this.sessionControls?.payments || []

      // Debug logging
      logger.info('Rendering controls modal with:', {
        sessionControls: this.sessionControls,
        controls: controls,
        payments: payments,
        controlsLength: controls.length,
        paymentsLength: payments.length
      })

      // If no session controls data, show message
      if (!this.sessionControls) {
        return `
          <div class="p-4">
            <div class="alert alert-warning">
              <i class="bi bi-exclamation-triangle me-2"></i>
              No session controls found for this academic session. Please try refreshing or contact support.
            </div>
          </div>
        `
      }

      return `
        <div class="p-4">
          <div class="alert alert-info mb-4">
            <i class="bi bi-info-circle me-2"></i>
            Disable <strong>Entrance Exam</strong> or <strong>Screening</strong> to automatically skip that step in the admission flow for this session.
          </div>
          <div class="alert alert-warning mb-4">
            <i class="bi bi-wallet2 me-2"></i>
            Use the payment method toggles below to control whether <strong>applicants</strong> and <strong>students</strong> can pay with Paystack or Manual Transfer for this session.
          </div>
          <div class="row">
            <!-- Session Controls -->
            <div class="col-md-6">
              <h6 class="fw-bold mb-3">
                <i class="bi bi-toggles me-2"></i>Session Controls
              </h6>
              <div class="controls-container">
                ${controls.length > 0 ? controls.map(control => `
                  <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                    <div>
                      <strong>${this.formatControlName(control.name)}</strong>
                    </div>
                    <div class="form-check form-switch">
                      <input 
                        class="form-check-input control-switch" 
                        type="checkbox" 
                        data-control="${control.name}"
                        ${control.active ? 'checked' : ''}
                      >
                    </div>
                  </div>
                `).join('') : '<p class="text-muted">No session controls available</p>'}
              </div>
            </div>

            <!-- Payment Controls -->
            <div class="col-md-6">
              <h6 class="fw-bold mb-3">
                <i class="bi bi-credit-card me-2"></i>Payment Controls
              </h6>
              <div class="payments-container">
                ${payments.length > 0 ? payments.map(payment => `
                  <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                    <div>
                      <strong>${payment.paymentId?.name || 'Unknown Payment'}</strong>
                    </div>
                    <div class="form-check form-switch">
                      <input 
                        class="form-check-input payment-switch" 
                        type="checkbox" 
                        data-payment="${payment.paymentId?._id}"
                        ${payment.active ? 'checked' : ''}
                      >
                    </div>
                  </div>
                `).join('') : '<p class="text-muted">No payment controls available</p>'}
              </div>
            </div>
          </div>

          <div class="row mt-4">
            <div class="col-12">
              <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-secondary" id="closeControlsBtn">Close</button>
                <button type="button" class="btn btn-primary" id="saveControlsBtn">
                  <i class="bi bi-check me-2"></i>Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      `
    },

    formatControlName(controlName) {
      const names = {
        application: 'Application',
        admissionProcessing: 'Admission Processing',
        entranceExam: 'Entrance Exam',
        screening: 'Screening & Interview',
        courseRegistration: 'Course Registration',
        resultUpload: 'Result Upload',
        resultRelease: 'Result Release',
        applicantPaystackPayments: 'Applicant Paystack Payments',
        applicantManualTransferPayments: 'Applicant Manual Transfer Payments',
        studentPaystackPayments: 'Student Paystack Payments',
        studentManualTransferPayments: 'Student Manual Transfer Payments'
      }
      return names[controlName] || controlName
    },

    initializeControlsModal() {
      // Add event listeners for control switches
      document.querySelectorAll('.control-switch').forEach(switchEl => {
        switchEl.addEventListener('change', (e) => {
          this.updateControlSwitch(e.target.dataset.control, e.target.checked)
        })
      })

      // Add event listeners for payment switches
      document.querySelectorAll('.payment-switch').forEach(switchEl => {
        switchEl.addEventListener('change', (e) => {
          this.updatePaymentSwitch(e.target.dataset.payment, e.target.checked)
        })
      })

      // Add close button listener
      document.getElementById('closeControlsBtn')?.addEventListener('click', () => {
        this.$swal.close()
      })

      // Add save button listener
      document.getElementById('saveControlsBtn')?.addEventListener('click', () => {
        this.saveSessionControls()
      })
    },

    updateControlSwitch(controlName, active) {
      if (this.sessionControls && this.sessionControls.controls) {
        const control = this.sessionControls.controls.find(c => c.name === controlName)
        if (control) {
          control.active = active
        }
      }
    },

    updatePaymentSwitch(paymentId, active) {
      if (this.sessionControls && this.sessionControls.payments) {
        const payment = this.sessionControls.payments.find(p => p.paymentId._id === paymentId)
        if (payment) {
          payment.active = active
        }
      }
    },

    async saveSessionControls() {
      try {
        const controlsData = {
          controls: this.sessionControls.controls,
          payments: this.sessionControls.payments.map(p => ({
            paymentId: p.paymentId._id,
            active: p.active
          }))
        }

        const response = await apiService.updateSessionControls(this.selectedSession.id, controlsData)

        if (response.success) {
          this.$swal.fire({
            icon: 'success',
            title: 'Success',
            text: 'Session controls updated successfully',
            timer: 2000,
            showConfirmButton: false
          })
        } else {
          throw new Error(response.message)
        }
      } catch (error) {
        logger.error('Failed to save session controls:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to save session controls',
          confirmButtonColor: '#1a5f5f'
        })
      }
    }
  }
}
</script>

<template>
  <div>
    <!-- Search and Add Button -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body">
            <div class="row g-3 align-items-end">
              <div class="col-md-8">
                <label class="form-label">Search Academic Sessions</label>
                <input
                  v-model="searchQuery"
                  type="text"
                  class="form-control"
                  placeholder="Search by session name, year, or description..."
                >
              </div>
              <div class="col-md-4">
                <button
                  class="btn btn-staff-primary w-100"
                  @click="showAddSessionModal"
                >
                  <i class="bi bi-plus-circle me-2"></i>Add New Session
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
      <p class="mt-3 text-muted">Loading academic sessions...</p>
    </div>

    <!-- Sessions Table -->
    <div v-else class="row">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Session Year</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th class="text-center">Status</th>
                    <th class="text-center">Active</th>
                    <th class="text-center">Controls</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="paginatedSessions.length === 0">
                    <td colspan="7" class="text-center py-5">
                      <div class="text-muted">
                        <i class="bi bi-calendar-x fs-1 mb-3 d-block"></i>
                        <h5 class="mb-2">No Academic Sessions Found</h5>
                        <p class="mb-0" v-if="searchQuery">
                          No sessions match your search criteria.
                        </p>
                        <p class="mb-0" v-else>
                          No academic sessions have been created yet.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <tr v-for="session in paginatedSessions" :key="session.id">
                    <td>
                      <div class="fw-medium">{{ session.sessionYear }}</div>
                      <small class="text-muted">{{ session.title || session.description || 'No title provided' }}</small>
                    </td>
                    <td>{{ formatDate(session.startDate) }}</td>
                    <td>{{ formatDate(session.endDate) }}</td>
                    <td class="text-center">
                      <span
                        class="badge rounded-pill"
                        :class="getStatusBadgeClass(session.status)"
                      >
                        {{ session.status?.toUpperCase() }}
                      </span>
                    </td>
                    <td class="text-center">
                      <span
                        class="badge rounded-pill"
                        :class="session.active ? 'bg-success' : 'bg-secondary'"
                      >
                        {{ session.active ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                    <td class="text-center">
                      <button
                        class="btn btn-outline-primary btn-sm"
                        @click="viewControls(session)"
                        title="Manage Controls"
                      >
                        <i class="bi bi-sliders"></i>
                        Controls
                      </button>
                    </td>
                    <td>
                      <div class="btn-group btn-group-sm">
                        <button
                          class="btn btn-outline-success btn-sm"
                          @click="editSession(session)"
                          title="Edit Session"
                        >
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button
                          class="btn btn-outline-danger btn-sm"
                          @click="deleteSession(session)"
                          title="Delete Session"
                        >
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
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
                  :class="{ disabled: currentPage >= totalPages || sessions.length === 0 }"
                >
                  <button
                    class="page-link"
                    @click="currentPage = currentPage + 1"
                    :disabled="currentPage >= totalPages || sessions.length === 0"
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

.badge {
  font-size: 0.75rem;
}
</style>