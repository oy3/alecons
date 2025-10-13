<template>
  <div class="exam-interface" :class="{ 'exam-fullscreen': isFullscreen }">
    <!-- Security Warning (if any violations) -->
    <div v-if="showSecurityWarning" class="security-warning">
      <i class="bi bi-exclamation-triangle me-2"></i>
      {{ securityWarningMessage }}
    </div>

    <!-- Auto-save Indicator -->
    <div class="autosave-indicator" :class="autoSaveStatus">
      <i v-if="autoSaveStatus === 'saving'" class="bi bi-arrow-clockwise spinning me-1"></i>
      <i v-else-if="autoSaveStatus === 'saved'" class="bi bi-check-circle me-1"></i>
      <i v-else-if="autoSaveStatus === 'error'" class="bi bi-exclamation-circle me-1"></i>
      {{ autoSaveText }}
    </div>

    <!-- Timer -->
    <div class="exam-timer" :class="timerClass">
      <i class="bi bi-clock me-2"></i>
      {{ timeRemainingFormatted }}
    </div>

    <!-- Exam Header -->
    <div class="exam-header">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h5 class="mb-0">{{ exam?.title }}</h5>
          <small>{{ exam?.description }}</small>
        </div>
        <div class="text-end">
          <div>Question {{ currentQuestionNumber }} of {{ totalQuestions }}</div>
          <small>{{ answeredCount }} answered</small>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="exam-content">
      <!-- Question Panel -->
      <div class="question-panel">
        <div v-if="currentQuestion" class="question-container">
          <!-- Question Text -->
          <div class="question-text mb-4">
            <h6 class="question-number">Question {{ currentQuestionNumber }}</h6>
            <div class="question-content" v-html="currentQuestion.questionText"></div>
            
            <!-- Question Media -->
            <div v-if="currentQuestion.mediaUrls && currentQuestion.mediaUrls.length > 0" class="question-media mt-3">
              <div v-for="(url, index) in currentQuestion.mediaUrls" :key="index" class="media-item">
                <img v-if="isImage(url)" :src="url" class="img-fluid" alt="Question media">
                <video v-else-if="isVideo(url)" :src="url" controls class="video-fluid"></video>
                <audio v-else-if="isAudio(url)" :src="url" controls></audio>
              </div>
            </div>
          </div>

          <!-- Answer Options -->
          <div class="answer-options">
            <!-- MCQ Options -->
            <div v-if="currentQuestion.type === 'mcq'" class="mcq-options">
              <div 
                v-for="(option, key) in currentQuestion.options" 
                :key="key"
                class="option-item mb-3"
              >
                <div class="form-check">
                  <input
                    :id="`option-${key}`"
                    v-model="currentAnswer"
                    :value="key"
                    type="radio"
                    class="form-check-input"
                    :name="`question-${currentQuestion._id}`"
                    @change="handleAnswerChange"
                  >
                  <label :for="`option-${key}`" class="form-check-label">
                    <span class="option-letter">{{ key.toUpperCase() }}.</span>
                    <span class="option-text">{{ option }}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Multi-select Options -->
            <div v-else-if="currentQuestion.type === 'multi'" class="multi-options">
              <p class="text-muted small">Select all that apply:</p>
              <div 
                v-for="(option, key) in currentQuestion.options" 
                :key="key"
                class="option-item mb-3"
              >
                <div class="form-check">
                  <input
                    :id="`multi-option-${key}`"
                    v-model="currentAnswer"
                    :value="key"
                    type="checkbox"
                    class="form-check-input"
                    @change="handleAnswerChange"
                  >
                  <label :for="`multi-option-${key}`" class="form-check-label">
                    <span class="option-letter">{{ key.toUpperCase() }}.</span>
                    <span class="option-text">{{ option }}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Essay Answer -->
            <div v-else-if="currentQuestion.type === 'essay'" class="essay-answer">
              <textarea
                v-model="currentAnswer"
                class="form-control"
                rows="10"
                placeholder="Type your answer here..."
                @input="handleAnswerChange"
              ></textarea>
              <div class="text-end mt-2">
                <small class="text-muted">{{ currentAnswer?.length || 0 }} characters</small>
              </div>
            </div>
          </div>

          <!-- Question Mark -->
          <div class="question-mark mt-4">
            <span class="badge bg-info">{{ currentQuestion.mark }} mark{{ currentQuestion.mark > 1 ? 's' : '' }}</span>
          </div>
        </div>

        <div v-else class="loading-container">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading question...</span>
          </div>
        </div>
      </div>

      <!-- Navigation Panel -->
      <div class="navigation-panel">
        <!-- Question Navigator -->
        <div class="question-navigator mb-4">
          <h6><i class="bi bi-grid me-2"></i>Question Navigator</h6>
          <div class="question-nav">
            <button
              v-for="(question, index) in questions"
              :key="question._id"
              class="question-nav-item"
              :class="{
                'current': index === currentQuestionIndex,
                'answered': isQuestionAnswered(index),
                'unanswered': !isQuestionAnswered(index)
              }"
              @click="goToQuestion(index)"
            >
              {{ index + 1 }}
            </button>
          </div>
        </div>

        <!-- Exam Summary -->
        <div class="exam-summary mb-4">
          <h6><i class="bi bi-info-circle me-2"></i>Summary</h6>
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-value text-success">{{ answeredCount }}</span>
              <span class="stat-label">Answered</span>
            </div>
            <div class="stat-item">
              <span class="stat-value text-warning">{{ unansweredCount }}</span>
              <span class="stat-label">Unanswered</span>
            </div>
            <div class="stat-item">
              <span class="stat-value text-info">{{ totalQuestions }}</span>
              <span class="stat-label">Total</span>
            </div>
          </div>
        </div>

        <!-- Instructions -->
        <div class="instructions">
          <h6><i class="bi bi-info-square me-2"></i>Instructions</h6>
          <ul class="instruction-list">
            <li>Click on question numbers to navigate</li>
            <li>Your answers are saved automatically</li>
            <li>You can change answers before submitting</li>
            <li>Submit the exam before time runs out</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Exam Footer -->
    <div class="exam-footer">
      <div class="d-flex justify-content-between align-items-center">
        <!-- Navigation Buttons -->
        <div>
          <button 
            class="btn btn-outline-secondary me-2"
            :disabled="currentQuestionIndex === 0"
            @click="previousQuestion"
          >
            <i class="bi bi-arrow-left me-1"></i>
            Previous
          </button>
          <button 
            class="btn btn-outline-secondary"
            :disabled="currentQuestionIndex === questions.length - 1"
            @click="nextQuestion"
          >
            Next
            <i class="bi bi-arrow-right ms-1"></i>
          </button>
        </div>

        <!-- Submit Button -->
        <button 
          class="btn btn-danger"
          @click="showSubmitConfirmation"
        >
          <i class="bi bi-check-circle me-1"></i>
          Submit Exam
        </button>
      </div>
    </div>

    <!-- Submit Confirmation Modal -->
    <SubmitConfirmationModal
      :show="showSubmitModal"
      :answered-count="answeredCount"
      :total-questions="totalQuestions"
      @confirm="submitExam"
      @cancel="hideSubmitModal"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { examStore } from '../stores/exam.js'
import { apiService } from '../services/api.js'
import SubmitConfirmationModal from '../components/SubmitConfirmationModal.vue'
import Swal from 'sweetalert2'

export default {
  name: 'ExamInterface',
  components: {
    SubmitConfirmationModal
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    
    const exam = ref(null)
    const questions = ref([])
    const currentQuestionIndex = ref(0)
    const currentAnswer = ref(null)
    const answers = ref({})
    const isFullscreen = ref(false)
    const showSubmitModal = ref(false)
    const autoSaveStatus = ref('saved')
    const showSecurityWarning = ref(false)
    const securityWarningMessage = ref('')
    
    // Auto-save timer
    let autoSaveTimer = null
    let heartbeatTimer = null
    let securityWarningTimer = null

    // Computed properties
    const currentQuestion = computed(() => {
      return questions.value[currentQuestionIndex.value] || null
    })

    const currentQuestionNumber = computed(() => {
      return currentQuestionIndex.value + 1
    })

    const totalQuestions = computed(() => {
      return questions.value.length
    })

    const answeredCount = computed(() => {
      return Object.keys(answers.value).length
    })

    const unansweredCount = computed(() => {
      return totalQuestions.value - answeredCount.value
    })

    const timeRemainingFormatted = computed(() => {
      return examStore.timeRemainingFormatted
    })

    const timerClass = computed(() => {
      return examStore.timeStatus === 'danger' ? 'danger' : 
             examStore.timeStatus === 'warning' ? 'warning' : ''
    })

    const autoSaveText = computed(() => {
      switch (autoSaveStatus.value) {
        case 'saving': return 'Saving...'
        case 'saved': return 'Saved'
        case 'error': return 'Save failed'
        default: return ''
      }
    })

    // Security and lifecycle methods
    const enterFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen()
        }
        isFullscreen.value = true
        examStore.isFullscreen = true
      } catch (error) {
        console.error('Failed to enter fullscreen:', error)
      }
    }

    const exitFullscreen = async () => {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        }
        isFullscreen.value = false
        examStore.isFullscreen = false
      } catch (error) {
        console.error('Failed to exit fullscreen:', error)
      }
    }

    const handleFullscreenChange = () => {
      const isInFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      )
      
      if (!isInFullscreen && examStore.currentExam) {
        // User exited fullscreen
        recordSecurityViolation('fullscreen_exit')
        showSecurityWarning.value = true
        securityWarningMessage.value = 'You have exited fullscreen mode. Please return to fullscreen.'
        
        // Auto-hide warning after 5 seconds
        if (securityWarningTimer) clearTimeout(securityWarningTimer)
        securityWarningTimer = setTimeout(() => {
          showSecurityWarning.value = false
        }, 5000)
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordSecurityViolation('window_blur')
        examStore.recordSecurityViolation('window_blur')
      }
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = 'Are you sure you want to leave? Your exam progress will be lost.'
      return event.returnValue
    }

    const recordSecurityViolation = async (type, details = {}) => {
      try {
        await apiService.reportSecurityViolation(
          route.params.examId,
          route.query.attemptId,
          { type, details, timestamp: new Date() }
        )
      } catch (error) {
        console.error('Failed to record security violation:', error)
      }
    }

    // Exam logic methods
    const loadExamData = async () => {
      try {
        // Load exam details
        const examResponse = await apiService.getExamDetails(route.params.examId)
        if (!examResponse.success) {
          throw new Error(examResponse.message)
        }
        exam.value = examResponse.data

        // Load questions
        const questionsResponse = await apiService.getExamQuestions(
          route.params.examId, 
          route.query.attemptId
        )
        if (!questionsResponse.success) {
          throw new Error(questionsResponse.message)
        }
        questions.value = questionsResponse.data

        // Set up exam store
        examStore.setExam(exam.value)
        examStore.setQuestions(questions.value)
        examStore.startTimer()

        // Load existing answers if any
        const attemptResponse = await apiService.getAttemptDetails(
          route.params.examId,
          route.query.attemptId
        )
        if (attemptResponse.success && attemptResponse.data.answers) {
          attemptResponse.data.answers.forEach(answer => {
            answers.value[answer.questionId] = answer.selected
          })
          examStore.answers = answers.value
        }

        // Set current answer for first question
        if (currentQuestion.value) {
          currentAnswer.value = answers.value[currentQuestion.value._id] || getDefaultAnswer()
        }

      } catch (error) {
        console.error('Error loading exam data:', error)
        Swal.fire({
          icon: 'error',
          title: 'Loading Failed',
          text: error.message || 'Failed to load exam data',
          confirmButtonColor: '#1a5f5f'
        }).then(() => {
          router.push('/dashboard')
        })
      }
    }

    const getDefaultAnswer = () => {
      if (!currentQuestion.value) return null
      
      switch (currentQuestion.value.type) {
        case 'mcq': return null
        case 'multi': return []
        case 'essay': return ''
        default: return null
      }
    }

    const handleAnswerChange = () => {
      if (!currentQuestion.value) return

      answers.value[currentQuestion.value._id] = currentAnswer.value
      examStore.setAnswer(currentQuestion.value._id, currentAnswer.value)
      
      // Trigger auto-save
      scheduleAutoSave()
    }

    const scheduleAutoSave = () => {
      if (autoSaveTimer) clearTimeout(autoSaveTimer)
      
      autoSaveTimer = setTimeout(async () => {
        await saveAnswers()
      }, 2000) // Save after 2 seconds of inactivity
    }

    const saveAnswers = async () => {
      try {
        autoSaveStatus.value = 'saving'
        
        const formattedAnswers = Object.entries(answers.value).map(([questionId, selected]) => ({
          questionId,
          selected,
          answeredAt: new Date()
        }))

        const response = await apiService.saveAnswers(
          route.params.examId,
          route.query.attemptId,
          formattedAnswers
        )

        autoSaveStatus.value = response.success ? 'saved' : 'error'
      } catch (error) {
        console.error('Auto-save failed:', error)
        autoSaveStatus.value = 'error'
      }
    }

    const isQuestionAnswered = (index) => {
      const question = questions.value[index]
      return question && answers.value[question._id] !== undefined && answers.value[question._id] !== null && answers.value[question._id] !== ''
    }

    const goToQuestion = (index) => {
      if (index >= 0 && index < questions.value.length) {
        currentQuestionIndex.value = index
        const question = questions.value[index]
        currentAnswer.value = answers.value[question._id] || getDefaultAnswer()
      }
    }

    const nextQuestion = () => {
      if (currentQuestionIndex.value < questions.value.length - 1) {
        goToQuestion(currentQuestionIndex.value + 1)
      }
    }

    const previousQuestion = () => {
      if (currentQuestionIndex.value > 0) {
        goToQuestion(currentQuestionIndex.value - 1)
      }
    }

    const showSubmitConfirmation = () => {
      showSubmitModal.value = true
    }

    const hideSubmitModal = () => {
      showSubmitModal.value = false
    }

    const submitExam = async () => {
      try {
        hideSubmitModal.value = false
        
        // Final save before submission
        await saveAnswers()

        const formattedAnswers = Object.entries(answers.value).map(([questionId, selected]) => ({
          questionId,
          selected,
          answeredAt: new Date()
        }))

        const response = await apiService.submitExam(
          route.params.examId,
          route.query.attemptId,
          formattedAnswers,
          examStore.securityViolations
        )

        if (response.success) {
          // Stop timer and cleanup
          examStore.stopTimer()
          await exitFullscreen()
          
          // Show success message
          await Swal.fire({
            icon: 'success',
            title: 'Exam Submitted!',
            text: 'Your exam has been submitted successfully.',
            confirmButtonColor: '#1a5f5f'
          })

          // Navigate to results
          router.push(`/exam/${route.params.examId}/results`)
        } else {
          throw new Error(response.message)
        }
      } catch (error) {
        console.error('Error submitting exam:', error)
        Swal.fire({
          icon: 'error',
          title: 'Submission Failed',
          text: error.message || 'Failed to submit exam. Please try again.',
          confirmButtonColor: '#1a5f5f'
        })
      }
    }

    const startHeartbeat = () => {
      heartbeatTimer = setInterval(async () => {
        try {
          await apiService.sendHeartbeat(route.params.examId, route.query.attemptId)
        } catch (error) {
          console.error('Heartbeat failed:', error)
        }
      }, 30000) // Every 30 seconds
    }

    const stopHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
    }

    // Media type checkers
    const isImage = (url) => {
      return /\.(jpg|jpeg|png|gif|webp)$/i.test(url)
    }

    const isVideo = (url) => {
      return /\.(mp4|webm|ogg)$/i.test(url)
    }

    const isAudio = (url) => {
      return /\.(mp3|wav|ogg)$/i.test(url)
    }

    // Lifecycle hooks
    onMounted(async () => {
      // Set up security measures
      await enterFullscreen()
      
      // Add event listeners
      document.addEventListener('fullscreenchange', handleFullscreenChange)
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.addEventListener('mozfullscreenchange', handleFullscreenChange)
      document.addEventListener('MSFullscreenChange', handleFullscreenChange)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('beforeunload', handleBeforeUnload)

      // Disable right-click
      document.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        recordSecurityViolation('right_click')
      })

      // Disable certain key combinations
      document.addEventListener('keydown', (e) => {
        if (
          (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'x' || e.key === 'a')) ||
          e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && e.key === 'I')
        ) {
          e.preventDefault()
          recordSecurityViolation('key_combination', { key: e.key, ctrlKey: e.ctrlKey })
        }
      })

      // Load exam data
      await loadExamData()
      
      // Start heartbeat
      startHeartbeat()
    })

    onUnmounted(() => {
      // Cleanup
      examStore.stopTimer()
      stopHeartbeat()
      
      if (autoSaveTimer) clearTimeout(autoSaveTimer)
      if (securityWarningTimer) clearTimeout(securityWarningTimer)

      // Remove event listeners
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    })

    return {
      exam,
      questions,
      currentQuestion,
      currentQuestionIndex,
      currentQuestionNumber,
      currentAnswer,
      answers,
      totalQuestions,
      answeredCount,
      unansweredCount,
      isFullscreen,
      showSubmitModal,
      autoSaveStatus,
      autoSaveText,
      timeRemainingFormatted,
      timerClass,
      showSecurityWarning,
      securityWarningMessage,
      handleAnswerChange,
      isQuestionAnswered,
      goToQuestion,
      nextQuestion,
      previousQuestion,
      showSubmitConfirmation,
      hideSubmitModal,
      submitExam,
      isImage,
      isVideo,
      isAudio
    }
  }
}
</script>

<style scoped>
@keyframes spinning {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spinning {
  animation: spinning 1s linear infinite;
}

.question-container {
  max-width: 800px;
}

.question-number {
  color: #1a5f5f;
  font-weight: bold;
  margin-bottom: 1rem;
}

.question-content {
  font-size: 1.1rem;
  line-height: 1.6;
}

.option-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
  padding: 0.75rem;
  border-radius: 0.5rem;
}

.option-item:hover {
  background-color: #f8f9fa;
}

.option-letter {
  font-weight: bold;
  margin-right: 0.5rem;
  color: #1a5f5f;
}

.option-text {
  font-size: 1rem;
}

.form-check-input:checked ~ .form-check-label {
  color: #1a5f5f;
}

.summary-stats {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
}

.stat-label {
  font-size: 0.8rem;
  color: #6c757d;
}

.instruction-list {
  font-size: 0.9rem;
  padding-left: 1.2rem;
}

.instruction-list li {
  margin-bottom: 0.5rem;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.question-media .media-item {
  margin-bottom: 1rem;
}

.question-media img,
.question-media video {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
}

.video-fluid {
  width: 100%;
  max-width: 600px;
}
</style>