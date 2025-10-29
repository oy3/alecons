<script>
import { useAuthStore } from '../../stores/auth.js'
import { logger } from '@shared/utils/logger'
import { apiService } from '../../services/api.js'
import Swal from 'sweetalert2'
import ExamsList from './components/ExamsList.vue'
import QuestionBank from './components/QuestionBank.vue'
import ExamResults from './components/ExamResults.vue'
import ExamAnalytics from './components/ExamAnalytics.vue'
import ExamFormModal from './components/ExamFormModal.vue'
import ExamStatisticsModal from './components/ExamStatisticsModal.vue'

export default {
  name: 'ExamManagement',
  components: {
    ExamsList,
    QuestionBank,
    ExamResults,
    ExamAnalytics,
    ExamFormModal,
    ExamStatisticsModal
  },
  setup() {
    const authStore = useAuthStore()
    return {
      authStore
    }
  },
  data() {
    return {
      activeTab: 'exams',
      showCreateExamModal: false,
      showEditExamModal: false,
      showStatisticsModal: false,
      selectedExam: null
    }
  },
  async mounted() {
    await this.authStore.initialize()

    // Check permissions
    if (!this.authStore.hasAnyPermission(['exams:manage', 'staff', 'admin'])) {
      this.$swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'You do not have permission to manage exams',
        confirmButtonColor: '#1a5f5f'
      })
      this.$router.push('/dashboard')
      return
    }

    logger.info('Exam management page loaded')
  },
  methods: {
    setActiveTab(tab) {
      this.activeTab = tab
      logger.info('Switched to exam tab:', tab)
    },
    
    handleEditExam(exam) {
      this.selectedExam = exam
      this.showEditExamModal = true
    },
    
    handleViewStatistics(exam) {
      this.selectedExam = exam
      this.showStatisticsModal = true
    },
    
    closeExamModal() {
      this.showCreateExamModal = false
      this.showEditExamModal = false
      this.selectedExam = null
    },
    
    async handleExamSave(examData) {
      try {
        let result
        if (this.selectedExam) {
          // Update existing exam - remove id from data object since it goes in the URL
          const updateData = { ...examData }
          delete updateData.id
          result = await apiService.updateExam(examData.id, updateData)
        } else {
          // Create new exam
          result = await apiService.createExam(examData)
        }

        if (result.success) {
          Swal.fire('Success', 
            this.selectedExam ? 'Exam updated successfully' : 'Exam created successfully', 
            'success')
          this.closeExamModal()
          // Refresh exams list
          this.$refs.examsList?.loadExams()
        } else {
          Swal.fire('Error', result.message || 'Failed to save exam', 'error')
        }
      } catch (error) {
        console.error('Error saving exam:', error)
        Swal.fire('Error', 'Failed to save exam', 'error')
      }
    }
  }
}
</script>

<template>
  <div class="exam-management">
    <!-- Header Section -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1 class="h3 mb-0">Exam Management</h1>
        <p class="text-muted">Create, manage, and analyze examinations</p>
      </div>
      <div class="d-flex gap-2">
        <button 
          class="btn btn-outline-acon-primary"
          @click="activeTab = 'questionBank'"
          :class="{ active: activeTab === 'questionBank' }"
        >
          <i class="bi bi-bank me-1"></i>
          Question Bank
        </button>
        <button 
          class="btn btn-acon-primary"
          @click="showCreateExamModal = true"
          v-if="authStore.hasAnyPermission(['staff', 'admin', 'exams:create'])"
        >
          <i class="bi bi-plus-circle me-1"></i>
          Create Exam
        </button>
      </div>
    </div>

    <!-- Tab Navigation -->
    <ul class="nav nav-tabs mb-4">
      <li class="nav-item">
        <button 
          class="nav-link"
          :class="{ active: activeTab === 'exams' }"
          @click="setActiveTab('exams')"
        >
          <i class="bi bi-file-text me-1"></i>
          Exams
        </button>
      </li>
      <li class="nav-item">
        <button 
          class="nav-link"
          :class="{ active: activeTab === 'questionBank' }"
          @click="setActiveTab('questionBank')"
        >
          <i class="bi bi-bank me-1"></i>
          Question Bank
        </button>
      </li>
      <li class="nav-item">
        <button 
          class="nav-link"
          :class="{ active: activeTab === 'results' }"
          @click="setActiveTab('results')"
        >
          <i class="bi bi-clipboard-data me-1"></i>
          Results
        </button>
      </li>
      <li class="nav-item">
        <button 
          class="nav-link"
          :class="{ active: activeTab === 'analytics' }"
          @click="setActiveTab('analytics')"
        >
          <i class="bi bi-graph-up me-1"></i>
          Analytics
        </button>
      </li>
    </ul>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Exams List Tab -->
            <!-- Exams Tab -->
      <div v-if="activeTab === 'exams'" class="tab-pane active">
        <ExamsList 
          ref="examsList"
          @edit-exam="handleEditExam"
          @view-statistics="handleViewStatistics"
          @create-exam="showCreateExamModal = true"
        />
      </div>

      <!-- Question Bank Tab -->
      <div v-if="activeTab === 'questionBank'" class="tab-pane active">
        <QuestionBank />
      </div>

      <!-- Results Tab -->
      <div v-if="activeTab === 'results'" class="tab-pane active">
        <ExamResults />
      </div>

      <!-- Analytics Tab -->
      <div v-if="activeTab === 'analytics'" class="tab-pane active">
        <ExamAnalytics />
      </div>
    </div>

    <!-- Create/Edit Exam Modal -->
    <ExamFormModal 
      :show="showCreateExamModal || showEditExamModal"
      :exam="selectedExam"
      @close="closeExamModal"
      @save="handleExamSave"
    />

    <!-- Statistics Modal -->
    <ExamStatisticsModal 
      :show="showStatisticsModal"
      :exam="selectedExam"
      @close="showStatisticsModal = false"
    />
  </div>
</template>

<style scoped>
.exam-management {
  padding: 1.5rem;
}

.nav-tabs .nav-link {
  color: #6c757d;
  border: none;
  background: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.375rem 0.375rem 0 0;
  margin-right: 0.25rem;
  transition: all 0.15s ease-in-out;
}

.nav-tabs .nav-link:hover {
  background-color: #f8f9fa;
  color: #1a5f5f;
  border-bottom: 1px solid #1a5f5f;
}

.nav-tabs .nav-link.active {
  background-color: #1a5f5f;
  color: white;
  border-color: #1a5f5f;
}

.btn.active {
  background-color: #1a5f5f;
  border-color: #1a5f5f;
  color: white;
}

.tab-content {
  background: white;
  border-radius: 0.375rem 0.375rem 0.375rem 0.375rem;
  padding: 1.5rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}
</style>