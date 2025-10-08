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
      currentPage: 1,
      perPage: 10
    }
  },
  computed: {
    filteredSessions() {
      if (!this.searchQuery) return this.sessions

      return this.sessions.filter(session =>
        session.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        session.academicYear.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (session.description && session.description.toLowerCase().includes(this.searchQuery.toLowerCase()))
      )
    },

    paginatedSessions() {
      const start = (this.currentPage - 1) * this.perPage
      const end = start + this.perPage
      return this.filteredSessions.slice(start, end)
    },

    totalPages() {
      return Math.ceil(this.filteredSessions.length / this.perPage)
    }
  },
  watch: {
    searchQuery() {
      this.currentPage = 1
    }
  },
  async mounted() {
    await this.loadSessions()
  },
  methods: {
    async loadSessions() {
      try {
        this.isLoading = true
        logger.info('Loading academic sessions...')

        // Mock data for now - replace with actual API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        this.sessions = [
          {
            id: '1',
            name: '2024/2025 Academic Session',
            academicYear: '2024/2025',
            description: 'Main academic session for 2024-2025',
            startDate: '2024-09-01',
            endDate: '2025-08-31',
            isActive: true,
            applicationsOpen: true,
            controlsCount: 5
          },
          {
            id: '2',
            name: '2023/2024 Academic Session',
            academicYear: '2023/2024',
            description: 'Previous academic session',
            startDate: '2023-09-01',
            endDate: '2024-08-31',
            isActive: false,
            applicationsOpen: false,
            controlsCount: 3
          }
        ]

        logger.info('Academic sessions loaded successfully', { count: this.sessions.length })
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

    formatDate(dateString) {
      if (!dateString) return 'N/A'
      return new Date(dateString).toLocaleDateString()
    },

    async showAddSessionModal() {
      const { value: formValues } = await this.$swal.fire({
        title: 'Add New Academic Session',
        html: `
          <div class="row text-start">
            <div class="col-12 mb-3">
              <label class="form-label">Academic Session Year</label>
              <input id="academicYear" class="form-control" placeholder="e.g., 2024/2025" readonly>
            </div>
                        <div class="col-6 mb-3">
              <label class="form-label">Start Date</label>
              <input id="startDate" type="date" class="form-control">
            </div>
            <div class="col-6 mb-3">
              <label class="form-label">End Date</label>
              <input id="endDate" type="date" class="form-control">
            </div>
            <div class="col-12 mb-3">
              <label class="form-label">Description</label>
              <textarea id="description" class="form-control" placeholder="Session description..."></textarea>
            </div>

            <div class="col-12 mb-3">
                <label class="form-label" for="status">Status</label>
                <select class="form-select" aria-label="Default select example">
  <option disabled>--Select status--</option>
  <option value="1" selected>Open</option>
  <option value="2">Ongoing</option>
  <option value="3">Closed</option>
</select>
                </div>
            <div class="col-6">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="isActive" checked>
                <label class="form-check-label" for="isActive">Active Session</label>
              </div>
            </div>

          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Add Session',
        confirmButtonColor: '#1a5f5f',
        preConfirm: () => {
          const sessionName = document.getElementById('sessionName').value
          const academicYear = document.getElementById('academicYear').value
          const description = document.getElementById('description').value
          const startDate = document.getElementById('startDate').value
          const endDate = document.getElementById('endDate').value
          const isActive = document.getElementById('isActive').checked
          const status = document.getElementById('status').value

          if (!sessionName || !academicYear || !startDate || !endDate) {
            this.$swal.showValidationMessage('Please fill in all required fields')
            return false
          }

          return {
            sessionName,
            academicYear,
            description,
            startDate,
            endDate,
            isActive,
            status
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

        // Mock API call - replace with actual implementation
        const newSession = {
          id: Date.now().toString(),
          name: sessionData.sessionName,
          academicYear: sessionData.academicYear,
          description: sessionData.description,
          startDate: sessionData.startDate,
          endDate: sessionData.endDate,
          isActive: sessionData.isActive,
          applicationsOpen: sessionData.applicationsOpen,
          controlsCount: 0
        }

        this.sessions.unshift(newSession)

        this.$swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Academic session added successfully',
          timer: 2000,
          showConfirmButton: false
        })

        this.$emit('refresh')
      } catch (error) {
        logger.error('Failed to add academic session:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to add academic session',
          confirmButtonColor: '#1a5f5f'
        })
      }
    },

    async editSession(session) {
      const { value: formValues } = await this.$swal.fire({
        title: 'Edit Academic Session',
        html: `
          <div class="row g-3 text-start">
            <div class="col-12">
              <label class="form-label">Academic Year</label>
              <input id="academicYear" class="form-control" value="${session.academicYear}" readonly>
            </div>
            <div class="col-12">
              <label class="form-label">Description</label>
              <textarea id="description" class="form-control">${session.description || ''}</textarea>
            </div>
            <div class="col-6">
              <label class="form-label">Start Date</label>
              <input id="startDate" type="date" class="form-control" value="${session.startDate}">
            </div>
            <div class="col-6">
              <label class="form-label">End Date</label>  
              <input id="endDate" type="date" class="form-control" value="${session.endDate}">
            </div>

            <div class="col-12">
                <label class="form-label" for="status">Status</label>
                <select class="form-select" aria-label="Default select example">
  <option disabled>--Select status--</option>
  <option value="1" selected>Open</option>
  <option value="2">Ongoing</option>
  <option value="3">Closed</option>
</select>
                </div>
            <div class="col-12">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="isActive" ${session.isActive ? 'checked' : ''}>
                <label class="form-check-label" for="isActive">Active Session</label>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Update Session',
        confirmButtonColor: '#1a5f5f',
        preConfirm: () => {
          const sessionName = document.getElementById('sessionName').value
          const academicYear = document.getElementById('academicYear').value
          const description = document.getElementById('description').value
          const startDate = document.getElementById('startDate').value
          const endDate = document.getElementById('endDate').value
          const isActive = document.getElementById('isActive').checked
          const applicationsOpen = document.getElementById('applicationsOpen').checked

          if (!sessionName || !academicYear || !startDate || !endDate) {
            this.$swal.showValidationMessage('Please fill in all required fields')
            return false
          }

          return {
            sessionName,
            academicYear,
            description,
            startDate,
            endDate,
            isActive,
            applicationsOpen
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

        // Mock API call - replace with actual implementation
        const sessionIndex = this.sessions.findIndex(s => s.id === sessionId)
        if (sessionIndex !== -1) {
          this.sessions[sessionIndex] = {
            ...this.sessions[sessionIndex],
            name: sessionData.sessionName,
            academicYear: sessionData.academicYear,
            description: sessionData.description,
            startDate: sessionData.startDate,
            endDate: sessionData.endDate,
            isActive: sessionData.isActive,
            applicationsOpen: sessionData.applicationsOpen
          }
        }

        this.$swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Academic session updated successfully',
          timer: 2000,
          showConfirmButton: false
        })

        this.$emit('refresh')
      } catch (error) {
        logger.error('Failed to update academic session:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to update academic session',
          confirmButtonColor: '#1a5f5f'
        })
      }
    },

    async deleteSession(session) {
      const result = await this.$swal.fire({
        title: 'Delete Academic Session',
        text: `Are you sure you want to delete "${session.name}"? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it!'
      })

      if (result.isConfirmed) {
        try {
          logger.info('Deleting academic session:', session.id)

          // Mock API call - replace with actual implementation
          this.sessions = this.sessions.filter(s => s.id !== session.id)

          this.$swal.fire({
            icon: 'success',
            title: 'Deleted!',
            text: 'Academic session has been deleted.',
            timer: 2000,
            showConfirmButton: false
          })

          this.$emit('refresh')
        } catch (error) {
          logger.error('Failed to delete academic session:', error)
          this.$swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to delete academic session',
            confirmButtonColor: '#1a5f5f'
          })
        }
      }
    },

    async viewControls(session) {
      // This will show a modal with controls management
      await this.showControlsModal(session)
    },

    async showControlsModal(session) {
      const { value: action } = await this.$swal.fire({
        title: `Session Controls - ${session.name}`,
        html: `
          <div class="text-start">
            <div class="mb-3">
              <input type="text" id="controlSearch" class="form-control" placeholder="Search controls...">
            </div>
            <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
              <table class="table table-sm table-hover">
                <thead class="table-light sticky-top">
                  <tr>
                    <th>Control Name</th>
                    <th>Type</th>
                    <th>Value</th>
                    <th class="text-center">Active</th>
                  </tr>
                </thead>
                <tbody id="controlsTableBody">
                  <tr>
                    <td>Application Fee</td>
                    <td>Amount</td>
                    <td>₦5,000</td>
                    <td class="text-center">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" checked>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>Max Applications</td>
                    <td>Number</td>
                    <td>1000</td>
                    <td class="text-center">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" checked>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>Application Deadline</td>
                    <td>Date</td>
                    <td>2024-12-31</td>
                    <td class="text-center">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox">
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        `,
        showCloseButton: true,
        showConfirmButton: false,
        width: '800px',
        didOpen: () => {
          // Add search functionality for controls
          const searchInput = document.getElementById('controlSearch')
          searchInput.addEventListener('input', (e) => {
            // Implement search functionality here
            console.log('Searching controls:', e.target.value)
          })
        }
      })
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
                    <th>Session Name</th>
                    <th>Academic Year</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th class="text-center">Status</th>
                    <th class="text-center">Applications Open</th>
                    <th class="text-center">Controls</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="paginatedSessions.length === 0">
                    <td colspan="8" class="text-center py-5">
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
                      <div class="fw-medium">{{ session.name }}</div>
                      <small class="text-muted">{{ session.description }}</small>
                    </td>
                    <td>{{ session.academicYear }}</td>
                    <td>{{ formatDate(session.startDate) }}</td>
                    <td>{{ formatDate(session.endDate) }}</td>
                    <td class="text-center">
                      <span
                        class="badge rounded-pill"
                        :class="session.isActive ? 'bg-success' : 'bg-secondary'"
                      >
                        {{ session.isActive ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                    <td class="text-center">
                      <span
                        class="badge rounded-pill"
                        :class="session.applicationsOpen ? 'bg-info' : 'bg-warning'"
                      >
                        {{ session.applicationsOpen ? 'Open' : 'Closed' }}
                      </span>
                    </td>
                    <td class="text-center">
                      <button
                        class="btn btn-outline-primary btn-sm"
                        @click="viewControls(session)"
                        title="View Controls"
                      >
                        <i class="bi bi-sliders"></i>
                        <span class="badge bg-primary ms-1">{{ session.controlsCount || 0 }}</span>
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
                  :class="{ disabled: currentPage === totalPages }"
                >
                  <button
                    class="page-link"
                    @click="currentPage = currentPage + 1"
                    :disabled="currentPage === totalPages"
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