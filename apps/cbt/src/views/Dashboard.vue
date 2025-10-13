<template>
  <div class="container-fluid p-0">
    <!-- Header -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
      <div class="container">
        <a class="navbar-brand" href="#">
          <i class="bi bi-mortarboard me-2"></i>
          CBT Portal
        </a>
        <div class="navbar-nav ms-auto">
          <span class="navbar-text me-3">
            Welcome, {{ authStore.userName }}
          </span>
          <button class="btn btn-outline-light btn-sm" @click="logout">
            <i class="bi bi-box-arrow-right me-1"></i>
            Logout
          </button>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="container my-5">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-3">Loading your exams...</p>
      </div>

      <!-- Dashboard Content -->
      <div v-else>
        <!-- Stats Cards -->
        <div class="row mb-4">
          <div class="col-md-3">
            <div class="card text-center border-primary">
              <div class="card-body">
                <i class="bi bi-clock-history text-primary fs-1"></i>
                <h5 class="card-title mt-2">{{ availableExams.length }}</h5>
                <p class="card-text text-muted">Available Exams</p>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card text-center border-success">
              <div class="card-body">
                <i class="bi bi-check-circle text-success fs-1"></i>
                <h5 class="card-title mt-2">{{ completedExams.length }}</h5>
                <p class="card-text text-muted">Completed</p>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card text-center border-warning">
              <div class="card-body">
                <i class="bi bi-play-circle text-warning fs-1"></i>
                <h5 class="card-title mt-2">{{ inProgressExams.length }}</h5>
                <p class="card-text text-muted">In Progress</p>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card text-center border-info">
              <div class="card-body">
                <i class="bi bi-calendar-event text-info fs-1"></i>
                <h5 class="card-title mt-2">{{ upcomingExams.length }}</h5>
                <p class="card-text text-muted">Upcoming</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Current/In-Progress Exams -->
        <div v-if="inProgressExams.length > 0" class="mb-5">
          <h4 class="mb-3">
            <i class="bi bi-play-fill text-warning me-2"></i>
            Continue Exam
          </h4>
          <div class="row">
            <div v-for="exam in inProgressExams" :key="exam.id" class="col-md-6 mb-3">
              <ExamCard 
                :exam="exam" 
                type="continue"
                @continue="continueExam"
              />
            </div>
          </div>
        </div>

        <!-- Available Exams -->
        <div v-if="availableExams.length > 0" class="mb-5">
          <h4 class="mb-3">
            <i class="bi bi-clock text-primary me-2"></i>
            Available Exams
          </h4>
          <div class="row">
            <div v-for="exam in availableExams" :key="exam.id" class="col-md-6 mb-3">
              <ExamCard 
                :exam="exam" 
                type="available"
                @start="showStartModal"
              />
            </div>
          </div>
        </div>

        <!-- Upcoming Exams -->
        <div v-if="upcomingExams.length > 0" class="mb-5">
          <h4 class="mb-3">
            <i class="bi bi-calendar-event text-info me-2"></i>
            Upcoming Exams
          </h4>
          <div class="row">
            <div v-for="exam in upcomingExams" :key="exam.id" class="col-md-6 mb-3">
              <ExamCard 
                :exam="exam" 
                type="upcoming"
              />
            </div>
          </div>
        </div>

        <!-- Completed Exams -->
        <div v-if="completedExams.length > 0" class="mb-5">
          <h4 class="mb-3">
            <i class="bi bi-check-circle text-success me-2"></i>
            Completed Exams
          </h4>
          <div class="row">
            <div v-for="exam in completedExams" :key="exam.id" class="col-md-6 mb-3">
              <ExamCard 
                :exam="exam" 
                type="completed"
                @viewResults="viewResults"
              />
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="allExams.length === 0" class="text-center py-5">
          <i class="bi bi-inbox text-muted" style="font-size: 4rem;"></i>
          <h4 class="text-muted mt-3">No Exams Available</h4>
          <p class="text-muted">There are currently no exams scheduled for you.</p>
        </div>
      </div>
    </div>

    <!-- Start Exam Modal -->
    <StartExamModal 
      :show="showModal"
      :exam="selectedExam"
      @close="hideStartModal"
      @start="startExam"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { authStore } from '../stores/auth.js'
import { apiService } from '../services/api.js'
import ExamCard from '../components/ExamCard.vue'
import StartExamModal from '../components/StartExamModal.vue'
import Swal from 'sweetalert2'

export default {
  name: 'Dashboard',
  components: {
    ExamCard,
    StartExamModal
  },
  setup() {
    const isLoading = ref(true)
    const allExams = ref([])
    const showModal = ref(false)
    const selectedExam = ref(null)

    // Computed properties for exam categories
    const availableExams = computed(() => {
      if (!allExams.value || !Array.isArray(allExams.value)) return []
      const now = new Date()
      return allExams.value.filter(exam => {
        const examTime = new Date(exam.examTimestamp)
        return exam.status === 'scheduled' && 
               examTime <= now && 
               !exam.userAttempt
      })
    })

    const inProgressExams = computed(() => {
      if (!allExams.value || !Array.isArray(allExams.value)) return []
      return allExams.value.filter(exam => 
        exam.userAttempt && exam.userAttempt.status === 'in-progress'
      )
    })

    const upcomingExams = computed(() => {
      if (!allExams.value || !Array.isArray(allExams.value)) return []
      const now = new Date()
      return allExams.value.filter(exam => {
        const examTime = new Date(exam.examTimestamp)
        return exam.status === 'scheduled' && examTime > now
      })
    })

    const completedExams = computed(() => {
      if (!allExams.value || !Array.isArray(allExams.value)) return []
      return allExams.value.filter(exam => 
        exam.userAttempt && 
        ['submitted', 'auto-submitted', 'graded'].includes(exam.userAttempt.status)
      )
    })

    const loadExams = async () => {
      try {
        isLoading.value = true
        const response = await apiService.getAvailableExams()
        
        if (response.success) {
          allExams.value = response.data
        } else {
          throw new Error(response.message)
        }
      } catch (error) {
        console.error('Error loading exams:', error)
        Swal.fire({
          icon: 'error',
          title: 'Loading Failed',
          text: 'Failed to load exams. Please refresh the page.',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        isLoading.value = false
      }
    }

    const showStartModal = (exam) => {
      selectedExam.value = exam
      showModal.value = true
    }

    const hideStartModal = () => {
      showModal.value = false
      selectedExam.value = null
    }

    const startExam = async (examId, password) => {
      try {
        const response = await apiService.startExam(examId, password)
        
        if (response.success) {
          hideStartModal()
          // Navigate to exam interface
          window.location.href = `/cbt/exam/${examId}/interface?attemptId=${response.data.attemptId}`
        } else {
          throw new Error(response.message)
        }
      } catch (error) {
        console.error('Error starting exam:', error)
        Swal.fire({
          icon: 'error',
          title: 'Start Failed',
          text: error.message || 'Failed to start exam. Please try again.',
          confirmButtonColor: '#1a5f5f'
        })
      }
    }

    const continueExam = (exam) => {
      if (exam.userAttempt) {
        window.location.href = `/cbt/exam/${exam.id}/interface?attemptId=${exam.userAttempt.id}`
      }
    }

    const viewResults = (exam) => {
      window.location.href = `/cbt/exam/${exam.id}/results`
    }

    const logout = async () => {
      const result = await Swal.fire({
        title: 'Confirm Logout',
        text: 'Are you sure you want to logout?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, logout',
        cancelButtonText: 'Cancel'
      })

      if (result.isConfirmed) {
        authStore.logout()
        Swal.fire({
          title: 'Logged Out',
          text: 'You have been successfully logged out.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        })
      }
    }

    onMounted(() => {
      loadExams()
    })

    return {
      authStore,
      isLoading,
      allExams,
      availableExams,
      inProgressExams,
      upcomingExams,
      completedExams,
      showModal,
      selectedExam,
      showStartModal,
      hideStartModal,
      startExam,
      continueExam,
      viewResults,
      logout
    }
  }
}
</script>

<style scoped>
.card {
  transition: transform 0.2s ease-in-out;
}

.card:hover {
  transform: translateY(-5px);
}

.navbar-brand {
  font-weight: bold;
}
</style>