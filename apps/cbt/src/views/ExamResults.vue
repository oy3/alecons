<template>
  <div class="container py-5">
    <div class="row justify-content-center">
      <div class="col-md-10">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3>
              <i class="bi bi-trophy me-2"></i>
              Exam Results
            </h3>
            <p class="text-muted mb-0">{{ exam?.title }}</p>
          </div>
          <button class="btn btn-outline-primary" @click="goToDashboard">
            <i class="bi bi-arrow-left me-1"></i>
            Back to Dashboard
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading results...</span>
          </div>
          <p class="mt-3">Loading your exam results...</p>
        </div>

        <!-- Results Content -->
        <div v-else-if="result" class="row">
          <!-- Score Summary -->
          <div class="col-md-4 mb-4">
            <div class="card h-100 border-0 shadow-sm">
              <div class="card-header text-center" :class="result.status === 'pass' ? 'bg-success text-white' : 'bg-danger text-white'">
                <h5 class="mb-0">
                  <i :class="result.status === 'pass' ? 'bi-check-circle' : 'bi-x-circle'" class="bi me-2"></i>
                  {{ result.status === 'pass' ? 'PASSED' : 'FAILED' }}
                </h5>
              </div>
              <div class="card-body text-center">
                <div class="display-4 fw-bold mb-3" :class="scoreClass">
                  {{ result.percentage }}%
                </div>
                <div class="row text-center">
                  <div class="col-6">
                    <div class="h5 text-primary">{{ result.totalScore }}</div>
                    <small class="text-muted">Your Score</small>
                  </div>
                  <div class="col-6">
                    <div class="h5 text-secondary">{{ result.maxScore }}</div>
                    <small class="text-muted">Max Score</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Statistics -->
          <div class="col-md-8 mb-4">
            <div class="card h-100 border-0 shadow-sm">
              <div class="card-header">
                <h6 class="mb-0">
                  <i class="bi bi-bar-chart me-2"></i>
                  Exam Statistics
                </h6>
              </div>
              <div class="card-body">
                <div class="row">
                  <div class="col-md-6">
                    <div class="stat-item mb-3">
                      <div class="d-flex justify-content-between">
                        <span>Total Questions:</span>
                        <span class="fw-bold">{{ result.totalQuestions }}</span>
                      </div>
                    </div>
                    <div class="stat-item mb-3">
                      <div class="d-flex justify-content-between">
                        <span>Questions Attempted:</span>
                        <span class="fw-bold">{{ result.questionsAttempted }}</span>
                      </div>
                    </div>
                    <div class="stat-item mb-3">
                      <div class="d-flex justify-content-between">
                        <span>Correct Answers:</span>
                        <span class="fw-bold text-success">{{ result.correctAnswers }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="stat-item mb-3">
                      <div class="d-flex justify-content-between">
                        <span>Grading Type:</span>
                        <span class="fw-bold">{{ result.gradingType }}</span>
                      </div>
                    </div>
                    <div class="stat-item mb-3">
                      <div class="d-flex justify-content-between">
                        <span>Submission Time:</span>
                        <span class="fw-bold">{{ formatDateTime(result.gradedAt) }}</span>
                      </div>
                    </div>
                    <div class="stat-item mb-3" v-if="result.statistics">
                      <div class="d-flex justify-content-between">
                        <span>Rank:</span>
                        <span class="fw-bold">{{ result.statistics.rank }} / {{ result.statistics.totalParticipants }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Progress Bar -->
                <div class="mt-4">
                  <label class="form-label small text-muted">Score Breakdown</label>
                  <div class="progress" style="height: 25px;">
                    <div 
                      class="progress-bar bg-success" 
                      :style="{ width: correctPercentage + '%' }"
                    >
                      {{ result.correctAnswers }} Correct
                    </div>
                    <div 
                      class="progress-bar bg-warning" 
                      :style="{ width: partialPercentage + '%' }"
                    >
                      {{ result.partialCorrectAnswers || 0 }} Partial
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Detailed Results -->
          <div class="col-12" v-if="result.questionResults && result.questionResults.length > 0">
            <div class="card border-0 shadow-sm">
              <div class="card-header">
                <h6 class="mb-0">
                  <i class="bi bi-list-check me-2"></i>
                  Question-wise Results
                </h6>
              </div>
              <div class="card-body">
                <div class="table-responsive">
                  <table class="table table-hover">
                    <thead>
                      <tr>
                        <th>Question #</th>
                        <th>Your Answer</th>
                        <th>Correct Answer</th>
                        <th>Points</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(qResult, index) in result.questionResults" :key="qResult.questionId">
                        <td>{{ index + 1 }}</td>
                        <td>
                          <span v-if="qResult.userAnswer">{{ qResult.userAnswer }}</span>
                          <span v-else class="text-muted">Not answered</span>
                        </td>
                        <td>
                          <span v-if="qResult.correctAnswer && result.released">
                            {{ qResult.correctAnswer }}
                          </span>
                          <span v-else class="text-muted">Hidden</span>
                        </td>
                        <td>
                          {{ qResult.pointsAwarded }} / {{ qResult.maxPoints }}
                        </td>
                        <td>
                          <span 
                            class="badge"
                            :class="{
                              'bg-success': qResult.isCorrect,
                              'bg-danger': qResult.isCorrect === false,
                              'bg-secondary': qResult.isCorrect === null
                            }"
                          >
                            {{ qResult.isCorrect ? 'Correct' : qResult.isCorrect === false ? 'Incorrect' : 'Pending' }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- Feedback -->
          <div class="col-12 mt-4" v-if="result.overallFeedback">
            <div class="card border-0 shadow-sm">
              <div class="card-header">
                <h6 class="mb-0">
                  <i class="bi bi-chat-left-text me-2"></i>
                  Feedback
                </h6>
              </div>
              <div class="card-body">
                <p class="mb-0">{{ result.overallFeedback }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else class="text-center py-5">
          <i class="bi bi-exclamation-circle text-warning" style="font-size: 4rem;"></i>
          <h4 class="mt-3">Results Not Available</h4>
          <p class="text-muted">
            Your exam results are not yet available. Please check back later or contact your instructor.
          </p>
          <button class="btn btn-primary" @click="goToDashboard">
            <i class="bi bi-arrow-left me-1"></i>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiService } from '../services/api.js'
import Swal from 'sweetalert2'

export default {
  name: 'ExamResults',
  setup() {
    const route = useRoute()
    const router = useRouter()
    
    const isLoading = ref(true)
    const exam = ref(null)
    const result = ref(null)

    const scoreClass = computed(() => {
      if (!result.value) return ''
      return result.value.percentage >= 70 ? 'text-success' : 
             result.value.percentage >= 50 ? 'text-warning' : 'text-danger'
    })

    const correctPercentage = computed(() => {
      if (!result.value) return 0
      return (result.value.correctAnswers / result.value.totalQuestions) * 100
    })

    const partialPercentage = computed(() => {
      if (!result.value) return 0
      return ((result.value.partialCorrectAnswers || 0) / result.value.totalQuestions) * 100
    })

    const loadResults = async () => {
      try {
        isLoading.value = true
        
        const response = await apiService.getExamResults(route.params.examId)
        
        if (response.success) {
          exam.value = response.data.exam
          result.value = response.data.result
        } else {
          throw new Error(response.message)
        }
      } catch (error) {
        console.error('Error loading results:', error)
        Swal.fire({
          icon: 'error',
          title: 'Loading Failed',
          text: error.message || 'Failed to load exam results.',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        isLoading.value = false
      }
    }

    const formatDateTime = (dateStr) => {
      if (!dateStr) return 'N/A'
      const date = new Date(dateStr)
      return date.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const goToDashboard = () => {
      router.push('/dashboard')
    }

    onMounted(() => {
      loadResults()
    })

    return {
      isLoading,
      exam,
      result,
      scoreClass,
      correctPercentage,
      partialPercentage,
      formatDateTime,
      goToDashboard
    }
  }
}
</script>

<style scoped>
.display-4 {
  font-size: 3rem;
}

.stat-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.stat-item:last-child {
  border-bottom: none;
}

.progress {
  border-radius: 15px;
  overflow: hidden;
}

.progress-bar {
  font-size: 0.8rem;
  font-weight: 500;
}

.table th {
  background-color: #f8f9fa;
  border-top: none;
  font-weight: 600;
}

.table td {
  vertical-align: middle;
}

.card {
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1) !important;
}

.badge {
  font-size: 0.75rem;
  padding: 0.4rem 0.6rem;
}
</style>