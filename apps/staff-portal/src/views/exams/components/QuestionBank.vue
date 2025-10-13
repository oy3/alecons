<template>
  <div class="question-bank">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h4 class="mb-1">Question Bank</h4>
        <p class="text-muted mb-0">Manage questions and bulk import from files</p>
      </div>
      <div class="d-flex gap-2">
        <button 
          class="btn btn-outline-info"
          @click="showFormatGuide = true"
        >
          <i class="bi bi-info-circle me-1"></i>
          Import Format Guide
        </button>
        <button 
          class="btn btn-outline-primary"
          @click="showImportModal = true"
        >
          <i class="bi bi-upload me-1"></i>
          Bulk Import
        </button>
        <button 
          class="btn btn-primary"
          @click="showCreateQuestionModal = true"
        >
          <i class="bi bi-plus-circle me-1"></i>
          Add Question
        </button>
      </div>
    </div>

    <!-- Exam Selection -->
    <div class="row mb-4">
      <div class="col-md-6">
        <label class="form-label">Select Exam</label>
        <select 
          class="form-select" 
          v-model="selectedExamId" 
          @change="loadQuestions"
        >
          <option value="">Choose an exam...</option>
          <option v-for="exam in exams" :key="exam._id" :value="exam._id">
            {{ exam.title }} - {{ exam.academicSession?.sessionYear }}
          </option>
        </select>
      </div>
      <div class="col-md-6" v-if="selectedExamId">
        <label class="form-label">Search Questions</label>
        <div class="input-group">
          <span class="input-group-text">
            <i class="bi bi-search"></i>
          </span>
          <input
            type="text"
            class="form-control"
            placeholder="Search questions..."
            v-model="searchQuery"
          >
        </div>
      </div>
    </div>

    <!-- Questions List -->
    <div v-if="selectedExamId">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-3">Loading questions...</p>
      </div>

      <!-- Questions Table -->
      <div v-else-if="filteredQuestions.length > 0" class="card">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th width="5%">#</th>
                  <th width="40%">Question</th>
                  <th width="15%">Type</th>
                  <th width="10%">Mark</th>
                  <th width="10%">Status</th>
                  <th width="20%">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(question, index) in paginatedQuestions" :key="question._id">
                  <td>{{ (currentPage - 1) * perPage + index + 1 }}</td>
                  <td>
                    <div class="question-preview">
                      <div class="question-text">
                        {{ question.questionText.substring(0, 100) }}
                        {{ question.questionText.length > 100 ? '...' : '' }}
                      </div>
                      <div v-if="question.type === 'mcq' && question.options" class="options-preview mt-2">
                        <small class="text-muted">
                          Options: {{ Object.values(question.options).join(', ').substring(0, 60) }}...
                        </small>
                      </div>
                      <div v-if="question.tags.length > 0" class="tags mt-1">
                        <span 
                          v-for="tag in question.tags.slice(0, 3)" 
                          :key="tag" 
                          class="badge bg-light text-dark me-1"
                        >
                          {{ tag }}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="badge" :class="getQuestionTypeBadge(question.type)">
                      {{ formatQuestionType(question.type) }}
                    </span>
                  </td>
                  <td>
                    <strong>{{ question.mark }}</strong>
                  </td>
                  <td>
                    <span 
                      class="badge"
                      :class="question.status === 'active' ? 'bg-success' : 'bg-secondary'"
                    >
                      {{ question.status }}
                    </span>
                  </td>
                  <td>
                    <div class="btn-group">
                      <button 
                        class="btn btn-sm btn-outline-primary"
                        @click="viewQuestion(question)"
                        title="View Details"
                      >
                        <i class="bi bi-eye"></i>
                      </button>
                      <button 
                        class="btn btn-sm btn-outline-success"
                        @click="editQuestion(question)"
                        title="Edit Question"
                      >
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button 
                        class="btn btn-sm btn-outline-danger"
                        @click="deleteQuestion(question)"
                        title="Delete Question"
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
        <div class="card-footer">
          <nav v-if="totalPages > 1" aria-label="Questions pagination">
            <ul class="pagination pagination-sm justify-content-center mb-0">
              <li class="page-item" :class="{ disabled: currentPage === 1 }">
                <button class="page-link" @click="changePage(currentPage - 1)">
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
                <button class="page-link" @click="changePage(currentPage + 1)">
                  <i class="bi bi-chevron-right"></i>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-5">
        <i class="bi bi-question-circle text-muted" style="font-size: 4rem;"></i>
        <h4 class="text-muted mt-3">No Questions Found</h4>
        <p class="text-muted">Add questions manually or import from a file.</p>
        <div class="d-flex gap-2 justify-content-center">
          <button class="btn btn-primary" @click="showCreateQuestionModal = true">
            <i class="bi bi-plus-circle me-1"></i>
            Add Question
          </button>
          <button class="btn btn-outline-primary" @click="showImportModal = true">
            <i class="bi bi-upload me-1"></i>
            Import Questions
          </button>
        </div>
      </div>
    </div>

    <!-- No Exam Selected -->
    <div v-else class="text-center py-5">
      <i class="bi bi-mortarboard text-muted" style="font-size: 4rem;"></i>
      <h4 class="text-muted mt-3">Select an Exam</h4>
      <p class="text-muted">Choose an exam to manage its questions.</p>
    </div>

    <!-- Bulk Import Modal -->
    <div class="modal fade" :class="{ show: showImportModal }" :style="{ display: showImportModal ? 'block' : 'none' }" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-upload me-2"></i>
              Bulk Import Questions
            </h5>
            <button type="button" class="btn-close" @click="closeImportModal"></button>
          </div>
          <div class="modal-body">
            <div v-if="!selectedExamId" class="alert alert-warning">
              <i class="bi bi-exclamation-triangle me-2"></i>
              Please select an exam first before importing questions.
            </div>
            <div v-else>
              <div class="mb-3">
                <label class="form-label">Select File Format</label>
                <select class="form-select" v-model="importFormat">
                  <option value="excel">Excel (.xlsx, .xls)</option>
                  <option value="csv">CSV (.csv)</option>
                  <option value="pdf">PDF (.pdf)</option>
                  <option value="docx">Word Document (.docx)</option>
                </select>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Choose File</label>
                <input 
                  type="file" 
                  class="form-control" 
                  ref="fileInput"
                  :accept="getFileAccept()"
                  @change="handleFileSelect"
                >
                <small class="form-text text-muted">
                  Maximum file size: 10MB
                </small>
              </div>

              <div v-if="selectedFile" class="mb-3">
                <div class="alert alert-info">
                  <strong>Selected:</strong> {{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})
                </div>
              </div>

              <!-- Format Instructions -->
              <div class="alert alert-light">
                <strong>{{ formatInstructions[importFormat]?.title }}</strong>
                <p class="mb-0 mt-2">{{ formatInstructions[importFormat]?.description }}</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeImportModal">Cancel</button>
            <button 
              type="button" 
              class="btn btn-primary" 
              @click="importQuestions"
              :disabled="!selectedFile || !selectedExamId || isImporting"
            >
              <span v-if="isImporting" class="spinner-border spinner-border-sm me-2"></span>
              {{ isImporting ? 'Importing...' : 'Import Questions' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Format Guide Modal -->
    <QuestionFormatGuide 
      :show="showFormatGuide"
      @close="showFormatGuide = false"
    />

    <!-- Question Form Modal -->
    <QuestionFormModal
      :show="showCreateQuestionModal || showEditQuestionModal"
      :question="selectedQuestion"
      :examId="selectedExamId"
      @close="closeQuestionModal"
      @saved="handleQuestionSaved"
    />

    <!-- Question View Modal -->
    <QuestionViewModal
      :show="showViewQuestionModal"
      :question="selectedQuestion"
      @close="showViewQuestionModal = false"
      @edit="editQuestion"
    />
  </div>
</template>

<script>
import { useAuthStore } from '../../../stores/auth.js'
import { apiService } from '../../../services/api.js'
import { logger } from '@shared/utils/logger'
import QuestionFormatGuide from './QuestionFormatGuide.vue'
import QuestionFormModal from './QuestionFormModal.vue'
import QuestionViewModal from './QuestionViewModal.vue'

export default {
  name: 'QuestionBank',
  components: {
    QuestionFormatGuide,
    QuestionFormModal,
    QuestionViewModal
  },
  setup() {
    const authStore = useAuthStore()
    return { authStore }
  },
  data() {
    return {
      exams: [],
      questions: [],
      selectedExamId: '',
      isLoading: false,
      searchQuery: '',
      currentPage: 1,
      perPage: 15,
      
      // Modals
      showImportModal: false,
      showFormatGuide: false,
      showCreateQuestionModal: false,
      showEditQuestionModal: false,
      showViewQuestionModal: false,
      selectedQuestion: null,
      
      // Import
      importFormat: 'excel',
      selectedFile: null,
      isImporting: false,
      
      formatInstructions: {
        excel: {
          title: 'Excel Format Requirements',
          description: 'Use columns: Question, Type (mcq/multi/essay), Option_A, Option_B, Option_C, Option_D, Option_E, Answer, Mark, Tags'
        },
        csv: {
          title: 'CSV Format Requirements',
          description: 'Same as Excel but in CSV format. Use semicolons (;) for multiple answers and tags.'
        },
        pdf: {
          title: 'PDF Format Requirements',
          description: 'Use AI parsing. Format questions clearly with numbers (1., 2., etc.) and answer choices (a), b), c), d).'
        },
        docx: {
          title: 'Word Document Format Requirements',
          description: 'Similar to PDF. Use numbered questions with clear answer choices. AI will parse the content.'
        }
      }
    }
  },
  computed: {
    filteredQuestions() {
      if (!this.searchQuery) return this.questions
      
      const query = this.searchQuery.toLowerCase()
      return this.questions.filter(question =>
        question.questionText.toLowerCase().includes(query) ||
        question.tags.some(tag => tag.toLowerCase().includes(query))
      )
    },

    paginatedQuestions() {
      const start = (this.currentPage - 1) * this.perPage
      const end = start + this.perPage
      return this.filteredQuestions.slice(start, end)
    },

    totalPages() {
      return Math.ceil(this.filteredQuestions.length / this.perPage)
    },

    visiblePages() {
      const total = this.totalPages
      const current = this.currentPage
      const delta = 2
      const range = []
      
      for (let i = Math.max(1, current - delta); 
           i <= Math.min(total, current + delta); 
           i++) {
        range.push(i)
      }
      
      return range
    }
  },
  async mounted() {
    await this.loadExams()
  },
  methods: {
    async loadExams() {
      try {
        const response = await apiService.getExams()
        if (response.success) {
          this.exams = response.data
        }
      } catch (error) {
        logger.error('Error loading exams:', error)
      }
    },

    async loadQuestions() {
      if (!this.selectedExamId) {
        this.questions = []
        return
      }

      try {
        this.isLoading = true
        const response = await apiService.getQuestions(this.selectedExamId)
        if (response.success) {
          this.questions = response.data
        }
      } catch (error) {
        logger.error('Error loading questions:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Loading Failed',
          text: 'Failed to load questions.',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        this.isLoading = false
      }
    },

    changePage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page
      }
    },

    // Import methods
    getFileAccept() {
      const accepts = {
        excel: '.xlsx,.xls',
        csv: '.csv',
        pdf: '.pdf',
        docx: '.docx'
      }
      return accepts[this.importFormat] || '*'
    },

    handleFileSelect(event) {
      const file = event.target.files[0]
      if (file) {
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          this.$swal.fire({
            icon: 'error',
            title: 'File Too Large',
            text: 'Please select a file smaller than 10MB.',
            confirmButtonColor: '#dc3545'
          })
          this.$refs.fileInput.value = ''
          return
        }
        this.selectedFile = file
      }
    },

    async importQuestions() {
      if (!this.selectedFile || !this.selectedExamId) return

      try {
        this.isImporting = true
        const response = await apiService.bulkImportQuestions(
          this.selectedExamId, 
          this.selectedFile, 
          this.importFormat
        )
        
        if (response.success) {
          this.$swal.fire({
            icon: 'success',
            title: 'Import Successful',
            text: `Successfully imported ${response.imported || 0} questions.`,
            confirmButtonColor: '#1a5f5f'
          })
          this.closeImportModal()
          this.loadQuestions()
        }
      } catch (error) {
        this.$swal.fire({
          icon: 'error',
          title: 'Import Failed',
          text: error.message || 'Failed to import questions.',
          confirmButtonColor: '#dc3545'
        })
      } finally {
        this.isImporting = false
      }
    },

    closeImportModal() {
      this.showImportModal = false
      this.selectedFile = null
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = ''
      }
    },

    // Question CRUD methods
    viewQuestion(question) {
      this.selectedQuestion = question
      this.showViewQuestionModal = true
    },

    editQuestion(question) {
      this.selectedQuestion = question
      this.showEditQuestionModal = true
    },

    async deleteQuestion(question) {
      const result = await this.$swal.fire({
        title: 'Delete Question',
        text: 'Are you sure you want to delete this question?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545'
      })

      if (result.isConfirmed) {
        try {
          const response = await apiService.deleteQuestion(question._id)
          if (response.success) {
            this.$swal.fire({
              icon: 'success',
              title: 'Question Deleted',
              confirmButtonColor: '#1a5f5f',
              timer: 1500,
              showConfirmButton: false
            })
            this.loadQuestions()
          }
        } catch (error) {
          this.$swal.fire({
            icon: 'error',
            title: 'Delete Failed',
            text: 'Failed to delete question.',
            confirmButtonColor: '#dc3545'
          })
        }
      }
    },

    closeQuestionModal() {
      this.showCreateQuestionModal = false
      this.showEditQuestionModal = false
      this.selectedQuestion = null
    },

    handleQuestionSaved() {
      this.closeQuestionModal()
      this.loadQuestions()
    },

    // Utility methods
    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    },

    formatQuestionType(type) {
      const types = {
        mcq: 'Multiple Choice',
        multi: 'Multi-Select',
        essay: 'Essay'
      }
      return types[type] || type
    },

    getQuestionTypeBadge(type) {
      const badges = {
        mcq: 'bg-primary',
        multi: 'bg-info',
        essay: 'bg-warning text-dark'
      }
      return badges[type] || 'bg-secondary'
    }
  }
}
</script>

<style scoped>
.question-bank {
  min-height: 500px;
}

.question-preview {
  max-width: 400px;
}

.question-text {
  font-size: 0.875rem;
  line-height: 1.4;
}

.options-preview {
  font-size: 0.75rem;
}

.tags .badge {
  font-size: 0.65rem;
}

.modal.show {
  background: rgba(0, 0, 0, 0.5);
}

.pagination-sm .page-link {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
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
</style>