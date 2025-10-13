<script>
import { useAuthStore } from '../../../stores/auth.js'
import { apiService } from '../../../services/api.js'
import { logger } from '@shared/utils/logger'
import Swal from 'sweetalert2'

export default {
  name: 'ExamsList',
  emits: ['edit-exam', 'view-statistics', 'create-exam'],
  setup() {
    const authStore = useAuthStore()
    return { authStore }
  },
  data() {
    return {
      exams: [],
      academicSessions: [],
      isLoading: true,
      searchQuery: '',
      searchTimeout: null,
      statusFilter: 'all',
      sessionFilter: 'all',
      currentPage: 1,
      perPage: 10,
      totalExams: 0
    }
  },
  computed: {
    filteredExams() {
      let filtered = this.exams || []

      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase()
        filtered = filtered.filter(exam =>
          exam.title.toLowerCase().includes(query) ||
          exam.description.toLowerCase().includes(query)
        )
      }

      if (this.statusFilter !== 'all') {
        filtered = filtered.filter(exam => exam.status === this.statusFilter)
      }

      if (this.sessionFilter !== 'all') {
        filtered = filtered.filter(exam => exam.academicSession?._id === this.sessionFilter)
      }

      return filtered
    },

    paginatedExams() {
      const start = (this.currentPage - 1) * this.perPage
      const end = start + this.perPage
      const paginated = this.filteredExams.slice(start, end)

      return paginated
    },

    totalPages() {
      return Math.ceil(this.filteredExams.length / this.perPage)
    },

    visiblePages() {
      const total = this.totalPages
      const current = this.currentPage
      const delta = 2
      const range = []
      const rangeWithDots = []

      for (let i = Math.max(2, current - delta); 
           i <= Math.min(total - 1, current + delta); 
           i++) {
        range.push(i)
      }

      if (current - delta > 2) {
        rangeWithDots.push(1, '...')
      } else {
        rangeWithDots.push(1)
      }

      rangeWithDots.push(...range)

      if (current + delta < total - 1) {
        rangeWithDots.push('...', total)
      } else {
        rangeWithDots.push(total)
      }

      return rangeWithDots
    }
  },
  async mounted() {
    await this.loadData()
  },
  methods: {
    async loadData() {
      await Promise.all([
        this.loadAcademicSessions(),
        this.loadExams()
      ])
    },

    async loadAcademicSessions() {
      try {
        const response = await apiService.getAcademicSessions()
        if (response.success) {
          this.academicSessions = response.data.sessions || []
        }
      } catch (error) {
        logger.error('Error loading academic sessions:', error)
      }
    },

    async loadExams() {
      try {
        logger.info('Loading exams with auth token:', !!this.authStore.token)
        this.isLoading = true
        const params = {
          page: this.currentPage,
          limit: this.perPage
        }

        if (this.statusFilter !== 'all') {
          params.status = this.statusFilter
        }
        if (this.sessionFilter !== 'all') {
          params.academicSession = this.sessionFilter
        }

        const response = await apiService.getExams(params)
        
        if (response.success) {
          this.exams = response.exams || []
          this.totalExams = response.total || response.exams?.length || 0
          logger.info('Exams loaded successfully:', this.exams.length, 'exams')
        } else {
          logger.error('API returned unsuccessful response:', response)
        }
      } catch (error) {
        logger.error('Error loading exams:', error)
        
        // Handle authentication errors
        if (error.message.includes('Unauthorized') || error.message.includes('401')) {
          this.authStore.handleAuthError()
          return
        }
        
        Swal.fire({
          icon: 'error',
          title: 'Loading Failed', 
          text: error.message || 'Failed to load exams. Please try again.',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        this.isLoading = false
      }
    },

    handleSearch() {
      clearTimeout(this.searchTimeout)
      this.searchTimeout = setTimeout(() => {
        this.currentPage = 1 // Reset to first page
      }, 500)
    },

    refreshExams() {
      this.currentPage = 1
      this.loadExams()
    },

    changePage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page
      }
    },

    viewExam(exam) {
      // Navigate to exam details page or show modal
      this.$router.push(`/exams/${exam._id}`)
    },

    editExam(exam) {
      this.$emit('edit-exam', exam)
    },

    viewStatistics(exam) {
      this.$emit('view-statistics', exam)
    },

    async gradeExam(exam) {
      const result = await Swal.fire({
        title: 'Grade All Attempts',
        text: `This will grade all attempts for "${exam.title}". Continue?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Grade All',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#1a5f5f'
      })

      if (result.isConfirmed) {
        try {
          const response = await apiService.gradeExam(exam._id)
          if (response.success) {
            Swal.fire({
              icon: 'success',
              title: 'Grading Started',
              text: 'Grading job has been queued. Results will be available shortly.',
              confirmButtonColor: '#1a5f5f'
            })
            this.loadExams()
          }
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'Grading Failed',
            text: 'Failed to start grading process.',
            confirmButtonColor: '#dc3545'
          })
        }
      }
    },

    async releaseResults(exam) {
      const result = await Swal.fire({
        title: 'Release Results',
        text: `Release results for "${exam.title}" to students?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Release',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#1a5f5f'
      })

      if (result.isConfirmed) {
        try {
          const response = await apiService.releaseExamResults(exam._id)
          if (response.success) {
            Swal.fire({
              icon: 'success',
              title: 'Results Released',
              text: 'Results have been released to students.',
              confirmButtonColor: '#1a5f5f'
            })
            this.loadExams()
          }
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'Release Failed',
            text: 'Failed to release results.',
            confirmButtonColor: '#dc3545'
          })
        }
      }
    },

    async deleteExam(exam) {
      const result = await Swal.fire({
        title: 'Delete Exam',
        text: `Are you sure you want to delete "${exam.title}"? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545'
      })

      if (result.isConfirmed) {
        try {
          const response = await apiService.deleteExam(exam._id)
          if (response.success) {
            Swal.fire({
              icon: 'success',
              title: 'Exam Deleted',
              text: 'Exam has been deleted successfully.',
              confirmButtonColor: '#1a5f5f'
            })
            this.loadExams()
          }
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'Delete Failed',
            text: 'Failed to delete exam.',
            confirmButtonColor: '#dc3545'
          })
        }
      }
    },

    // Utility methods
    formatDateTime(dateString) {
      return new Date(dateString).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    },

    formatTargetType(type) {
      const types = {
        applicants: 'Applicants',
        students: 'Students', 
        staff: 'Staff',
        custom: 'Custom'
      }
      return types[type] || type
    },

    getStatusBadgeClass(status) {
      const classes = {
        draft: 'bg-secondary',
        scheduled: 'bg-primary',
        'in-progress': 'bg-warning text-dark',
        completed: 'bg-info',
        graded: 'bg-success'
      }
      return classes[status] || 'bg-secondary'
    },

    canEditExam(exam) {
      return ['draft', 'scheduled'].includes(exam.status) && 
             this.authStore.hasAnyPermission(['exams:edit', 'staff', 'admin'])
    },

    canDeleteExam(exam) {
      return exam.status === 'draft' && 
             this.authStore.hasAnyPermission(['exams:delete', 'admin'])
    }
  }
}
</script>

<template>
  <div class="exams-list">
    <!-- Filters and Search -->
    <div class="row mb-4">
      <div class="col-md-4">
        <div class="input-group">
          <span class="input-group-text">
            <i class="bi bi-search"></i>
          </span>
          <input
            type="text"
            class="form-control"
            placeholder="Search exams..."
            v-model="searchQuery"
            @input="handleSearch"
          >
        </div>
      </div>
      <div class="col-md-3">
        <select class="form-select" v-model="statusFilter" @change="loadExams">
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="graded">Graded</option>
        </select>
      </div>
      <div class="col-md-3">
        <select class="form-select" v-model="sessionFilter" @change="loadExams">
          <option value="all">All Sessions</option>
          <option v-for="session in academicSessions" :key="session._id" :value="session._id">
            {{ session.sessionYear }}
          </option>
        </select>
      </div>
      <div class="col-md-2">
        <button class="btn btn-outline-secondary w-100" @click="refreshExams">
          <i class="bi bi-arrow-clockwise me-1"></i>
          Refresh
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-3">Loading exams...</p>
    </div>

    <!-- Exams Table -->
    <div v-else-if="exams && exams.length > 0" class="card p-0">
      <div class="card-body p-0">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Title</th>
                <th>Session</th>
                <th>Target</th>
                <th>Schedule</th>
                <th>Duration</th>
                <th>Questions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="exam in paginatedExams" :key="exam._id">
                <td>
                  <div>
                    <strong>{{ exam.title }}</strong>
                    <br>
                    <small class="text-muted">{{ exam.description.substring(0, 60) }}{{ exam.description.length > 60 ? '...' : '' }}</small>
                  </div>
                </td>
                <td>
                  <span class="badge bg-light text-dark">
                    {{ exam.academicSession?.sessionYear || 'N/A' }}
                  </span>
                </td>
                <td>
                  <div>
                    <small class="text-muted d-block">{{ formatTargetType(exam.target.type) }}</small>
                    <span v-if="exam.target?.filter?.programs?.length > 0" class="badge bg-info">
                      {{ exam.target.filter.programs.length }} Program(s)
                    </span>
                  </div>
                </td>
                <td>
                  <div>
                    <strong>{{ formatDateTime(exam.examTimestamp) }}</strong>
                    <br>
                    <small class="text-muted">{{ formatDate(exam.examTimestamp) }}</small>
                  </div>
                </td>
                <td>
                  <span class="badge bg-secondary">{{ exam.duration }}min</span>
                </td>
                <td>
                  <div class="text-center">
                    <strong>{{ exam.totalQuestions }}</strong>
                    <br>
                    <small class="text-muted">{{ exam.totalMark }} marks</small>
                  </div>
                </td>
                <td>
                  <span 
                    class="badge"
                    :class="getStatusBadgeClass(exam.status)"
                  >
                    {{ exam.status.charAt(0).toUpperCase() + exam.status.slice(1) }}
                  </span>
                </td>
                <td>
                  <div class="btn-group">
                    <button 
                      class="btn btn-sm btn-outline-primary"
                      @click="viewExam(exam)"
                      title="View Details"
                    >
                      <i class="bi bi-eye"></i>
                    </button>
                    <button 
                      class="btn btn-sm btn-outline-success"
                      @click="editExam(exam)"
                      title="Edit Exam"
                      v-if="canEditExam(exam)"
                    >
                      <i class="bi bi-pencil"></i>
                    </button>
                    <div class="btn-group dropdown">
                      <button 
                        class="btn btn-sm btn-outline-secondary dropdown-toggle"
                        data-bs-toggle="dropdown"
                      >
                        <!-- <i class="bi bi-three-dots"></i> -->
                      </button>
                      <ul class="dropdown-menu">
                        <li>
                          <button 
                            class="dropdown-item"
                            @click="viewStatistics(exam)"
                          >
                            <i class="bi bi-graph-up me-2"></i>
                            Statistics
                          </button>
                        </li>
                        <li v-if="exam.status === 'completed'">
                          <button 
                            class="dropdown-item"
                            @click="gradeExam(exam)"
                          >
                            <i class="bi bi-check-circle me-2"></i>
                            Grade All
                          </button>
                        </li>
                        <li v-if="exam.status === 'graded'">
                          <button 
                            class="dropdown-item"
                            @click="releaseResults(exam)"
                          >
                            <i class="bi bi-send me-2"></i>
                            Release Results
                          </button>
                        </li>
                        <li v-if="canDeleteExam(exam)">
                          <hr class="dropdown-divider">
                          <button 
                            class="dropdown-item text-danger"
                            @click="deleteExam(exam)"
                          >
                            <i class="bi bi-trash me-2"></i>
                            Delete
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-5">
      <i class="bi bi-file-text text-muted" style="font-size: 4rem;"></i>
      <h4 class="text-muted mt-3">No Exams Found</h4>
      <p class="text-muted">Create your first exam to get started.</p>
      <button class="btn btn-primary" @click="$emit('create-exam')">
        <i class="bi bi-plus-circle me-1"></i>
        Create Exam
      </button>
    </div>

    <!-- Pagination -->
    <nav v-if="totalPages > 1" class="mt-4" aria-label="Exams pagination">
      <ul class="pagination justify-content-center">
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <button class="page-link" @click="changePage(currentPage - 1)" :disabled="currentPage === 1">
            <i class="bi bi-chevron-left"></i>
          </button>
        </li>
        <li 
          v-for="page in visiblePages" 
          :key="page" 
          class="page-item" 
          :class="{ active: page === currentPage }"
        >
          <button class="page-link" @click="changePage(page)">{{ page }}</button>
        </li>
        <li class="page-item" :class="{ disabled: currentPage === totalPages }">
          <button class="page-link" @click="changePage(currentPage + 1)" :disabled="currentPage === totalPages">
            <i class="bi bi-chevron-right"></i>
          </button>
        </li>
      </ul>
    </nav>
  </div>
</template>

<style scoped>
.exams-list {
  min-height: 400px;
}

.table th {
  border-top: none;
  font-weight: 600;
  color: #495057;
  font-size: 0.875rem;
}

.table td {
  vertical-align: middle;
  font-size: 0.875rem;
}

.btn-group .btn {
  padding: 0.25rem 0.5rem;
}

.pagination .page-link {
  color: #1a5f5f;
  border-color: #dee2e6;
}

.pagination .page-item.active .page-link {
  background-color: #1a5f5f;
  border-color: #1a5f5f;
}

.pagination .page-link:hover {
  background-color: #f8f9fa;
  border-color: #1a5f5f;
}
</style>