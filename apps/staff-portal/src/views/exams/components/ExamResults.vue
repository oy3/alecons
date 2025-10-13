<template>
  <div class="exam-results">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h4>
        <i class="bi bi-trophy me-2"></i>
        Exam Results
      </h4>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-primary">
          <i class="bi bi-download me-1"></i>
          Export Results
        </button>
        <button class="btn btn-primary">
          <i class="bi bi-send me-1"></i>
          Release Results
        </button>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="row mb-4">
      <div class="col-md-6">
        <div class="input-group">
          <span class="input-group-text">
            <i class="bi bi-search"></i>
          </span>
          <input 
            v-model="searchTerm" 
            type="text" 
            class="form-control" 
            placeholder="Search by student name or email..."
          >
        </div>
      </div>
      <div class="col-md-3">
        <select v-model="examFilter" class="form-select">
          <option value="">All Exams</option>
          <option value="midterm">Midterm Exam</option>
          <option value="final">Final Exam</option>
        </select>
      </div>
      <div class="col-md-3">
        <select v-model="statusFilter" class="form-select">
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="in-progress">In Progress</option>
          <option value="not-started">Not Started</option>
        </select>
      </div>
    </div>

    <!-- Results Table -->
    <div class="card">
      <div class="card-body">
        <div class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>Student</th>
                <th>Exam</th>
                <th>Score</th>
                <th>Grade</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="result in filteredResults" :key="result.id">
                <td>
                  <div class="d-flex align-items-center">
                    <div class="avatar-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2">
                      {{ result.student.name.charAt(0) }}
                    </div>
                    <div>
                      <div class="fw-semibold">{{ result.student.name }}</div>
                      <small class="text-muted">{{ result.student.email }}</small>
                    </div>
                  </div>
                </td>
                <td>{{ result.exam.title }}</td>
                <td>
                  <span class="fw-semibold">{{ result.score }}%</span>
                  <small class="text-muted d-block">{{ result.correctAnswers }}/{{ result.totalQuestions }}</small>
                </td>
                <td>
                  <span class="badge" :class="getGradeClass(result.grade)">
                    {{ result.grade }}
                  </span>
                </td>
                <td>
                  <span class="badge" :class="getStatusClass(result.status)">
                    {{ result.status }}
                  </span>
                </td>
                <td>
                  <span v-if="result.submittedAt">{{ formatDate(result.submittedAt) }}</span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <div class="dropdown">
                    <button 
                      class="btn btn-sm btn-outline-secondary dropdown-toggle" 
                      type="button" 
                      data-bs-toggle="dropdown"
                    >
                      Actions
                    </button>
                    <ul class="dropdown-menu">
                      <li>
                        <a class="dropdown-item" href="#" @click="viewDetails(result)">
                          <i class="bi bi-eye me-2"></i>View Details
                        </a>
                      </li>
                      <li>
                        <a class="dropdown-item" href="#" @click="downloadResult(result)">
                          <i class="bi bi-download me-2"></i>Download
                        </a>
                      </li>
                      <li><hr class="dropdown-divider"></li>
                      <li>
                        <a class="dropdown-item text-warning" href="#" @click="regrade(result)">
                          <i class="bi bi-arrow-clockwise me-2"></i>Regrade
                        </a>
                      </li>
                    </ul>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <nav v-if="totalPages > 1" class="mt-4">
          <ul class="pagination justify-content-center">
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <a class="page-link" href="#" @click.prevent="changePage(currentPage - 1)">Previous</a>
            </li>
            <li 
              v-for="page in visiblePages" 
              :key="page" 
              class="page-item" 
              :class="{ active: page === currentPage }"
            >
              <a class="page-link" href="#" @click.prevent="changePage(page)">{{ page }}</a>
            </li>
            <li class="page-item" :class="{ disabled: currentPage === totalPages }">
              <a class="page-link" href="#" @click.prevent="changePage(currentPage + 1)">Next</a>
            </li>
          </ul>
        </nav>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="row mt-4">
      <div class="col-md-3">
        <div class="card bg-primary text-white">
          <div class="card-body text-center">
            <h3 class="mb-1">{{ summaryStats.totalSubmissions }}</h3>
            <small>Total Submissions</small>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card bg-success text-white">
          <div class="card-body text-center">
            <h3 class="mb-1">{{ summaryStats.averageScore }}%</h3>
            <small>Average Score</small>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card bg-info text-white">
          <div class="card-body text-center">
            <h3 class="mb-1">{{ summaryStats.passRate }}%</h3>
            <small>Pass Rate</small>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card bg-warning text-white">
          <div class="card-body text-center">
            <h3 class="mb-1">{{ summaryStats.highestScore }}%</h3>
            <small>Highest Score</small>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ExamResults',
  data() {
    return {
      searchTerm: '',
      examFilter: '',
      statusFilter: '',
      currentPage: 1,
      itemsPerPage: 10,
      results: [
        {
          id: 1,
          student: { name: 'John Doe', email: 'john@example.com' },
          exam: { title: 'Midterm Exam' },
          score: 85,
          grade: 'B',
          status: 'completed',
          correctAnswers: 17,
          totalQuestions: 20,
          submittedAt: '2024-01-15T10:30:00Z'
        },
        {
          id: 2,
          student: { name: 'Jane Smith', email: 'jane@example.com' },
          exam: { title: 'Final Exam' },
          score: 92,
          grade: 'A',
          status: 'completed',
          correctAnswers: 18,
          totalQuestions: 20,
          submittedAt: '2024-01-16T14:20:00Z'
        }
      ],
      summaryStats: {
        totalSubmissions: 150,
        averageScore: 78,
        passRate: 82,
        highestScore: 98
      }
    }
  },
  computed: {
    filteredResults() {
      let filtered = this.results

      if (this.searchTerm) {
        const term = this.searchTerm.toLowerCase()
        filtered = filtered.filter(result => 
          result.student.name.toLowerCase().includes(term) ||
          result.student.email.toLowerCase().includes(term)
        )
      }

      if (this.examFilter) {
        filtered = filtered.filter(result => 
          result.exam.title.toLowerCase().includes(this.examFilter.toLowerCase())
        )
      }

      if (this.statusFilter) {
        filtered = filtered.filter(result => result.status === this.statusFilter)
      }

      const start = (this.currentPage - 1) * this.itemsPerPage
      return filtered.slice(start, start + this.itemsPerPage)
    },
    totalPages() {
      return Math.ceil(this.results.length / this.itemsPerPage)
    },
    visiblePages() {
      const delta = 2
      const range = []
      const rangeWithDots = []

      for (let i = Math.max(2, this.currentPage - delta); 
           i <= Math.min(this.totalPages - 1, this.currentPage + delta); 
           i++) {
        range.push(i)
      }

      if (this.currentPage - delta > 2) {
        rangeWithDots.push(1, '...')
      } else {
        rangeWithDots.push(1)
      }

      rangeWithDots.push(...range)

      if (this.currentPage + delta < this.totalPages - 1) {
        rangeWithDots.push('...', this.totalPages)
      } else {
        rangeWithDots.push(this.totalPages)
      }

      return rangeWithDots
    }
  },
  methods: {
    getGradeClass(grade) {
      const classes = {
        'A': 'bg-success',
        'B': 'bg-primary',
        'C': 'bg-warning',
        'D': 'bg-orange',
        'F': 'bg-danger'
      }
      return classes[grade] || 'bg-secondary'
    },
    getStatusClass(status) {
      const classes = {
        'completed': 'bg-success',
        'in-progress': 'bg-warning',
        'not-started': 'bg-secondary'
      }
      return classes[status] || 'bg-secondary'
    },
    formatDate(date) {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    changePage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page
      }
    },
    viewDetails(result) {
      console.log('View details for:', result)
    },
    downloadResult(result) {
      console.log('Download result for:', result)
    },
    regrade(result) {
      console.log('Regrade for:', result)
    }
  }
}
</script>

<style scoped>
.avatar-sm {
  width: 32px;
  height: 32px;
  font-size: 14px;
}

.table th {
  border-top: none;
  font-weight: 600;
  color: #495057;
}

.dropdown-toggle::after {
  margin-left: 0.5em;
}
</style>