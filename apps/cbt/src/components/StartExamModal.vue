<template>
  <!-- Modal -->
  <div 
    class="modal fade" 
    :class="{ show: show }" 
    :style="{ display: show ? 'block' : 'none' }"
    tabindex="-1"
    @click="handleBackdropClick"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi bi-shield-lock me-2"></i>
            Start Exam: {{ exam?.title }}
          </h5>
          <button 
            type="button" 
            class="btn-close" 
            @click="$emit('close')"
          ></button>
        </div>
        
        <div class="modal-body">
          <!-- Exam Information -->
          <div class="alert alert-info">
            <h6><i class="bi bi-info-circle me-2"></i>Exam Details</h6>
            <ul class="mb-0">
              <li>Duration: <strong>{{ exam?.duration }} minutes</strong></li>
              <li>Total Questions: <strong>{{ exam?.totalQuestions }}</strong></li>
              <li>Total Marks: <strong>{{ exam?.totalMark }}</strong></li>
              <li>Pass Mark: <strong>{{ exam?.cutOffMark }}</strong></li>
            </ul>
          </div>

          <!-- Security Warning -->
          <div class="alert alert-warning">
            <h6><i class="bi bi-exclamation-triangle me-2"></i>Security Notice</h6>
            <ul class="mb-0">
              <li>This exam requires <strong>full-screen mode</strong></li>
              <li>Tab switching and window minimizing are <strong>monitored</strong></li>
              <li>Right-click and copy/paste are <strong>disabled</strong></li>
              <li>Excessive violations may result in <strong>exam termination</strong></li>
            </ul>
          </div>

          <!-- Password Input -->
          <div class="mb-3">
            <label for="examPassword" class="form-label">
              <i class="bi bi-key me-1"></i>
              Exam Password <span class="text-danger">*</span>
            </label>
            <input
              id="examPassword"
              v-model="password"
              type="password"
              class="form-control"
              :class="{ 'is-invalid': passwordError }"
              placeholder="Enter exam password"
              @keyup.enter="handleStart"
              @input="clearPasswordError"
            >
            <div v-if="passwordError" class="invalid-feedback">
              {{ passwordError }}
            </div>
          </div>

          <!-- System Check -->
          <div class="card bg-light">
            <div class="card-body">
              <h6 class="card-title">
                <i class="bi bi-gear me-2"></i>
                System Check
              </h6>
              <div class="row">
                <div class="col-6">
                  <div class="d-flex align-items-center">
                    <i class="bi bi-check-circle text-success me-2"></i>
                    <small>Browser Supported</small>
                  </div>
                </div>
                <div class="col-6">
                  <div class="d-flex align-items-center">
                    <i class="bi bi-check-circle text-success me-2"></i>
                    <small>JavaScript Enabled</small>
                  </div>
                </div>
                <div class="col-6">
                  <div class="d-flex align-items-center">
                    <i :class="fullscreenSupported ? 'bi-check-circle text-success' : 'bi-x-circle text-danger'" class="bi me-2"></i>
                    <small>Fullscreen Support</small>
                  </div>
                </div>
                <div class="col-6">
                  <div class="d-flex align-items-center">
                    <i class="bi bi-check-circle text-success me-2"></i>
                    <small>Internet Connected</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Instructions -->
          <div class="mt-3">
            <h6><i class="bi bi-list-check me-2"></i>Instructions</h6>
            <ol class="small">
              <li>Ensure you have a stable internet connection</li>
              <li>Close all unnecessary applications and browser tabs</li>
              <li>Find a quiet, well-lit environment</li>
              <li>Have your materials ready (if allowed)</li>
              <li>Click "Start Exam" to begin in full-screen mode</li>
            </ol>
          </div>
        </div>
        
        <div class="modal-footer">
          <button 
            type="button" 
            class="btn btn-secondary" 
            @click="$emit('close')"
          >
            Cancel
          </button>
          <button 
            type="button" 
            class="btn btn-primary"
            :disabled="!password || isStarting"
            @click="handleStart"
          >
            <span v-if="isStarting">
              <span class="spinner-border spinner-border-sm me-2"></span>
              Starting...
            </span>
            <span v-else>
              <i class="bi bi-play-fill me-2"></i>
              Start Exam
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Modal Backdrop -->
  <div 
    v-if="show" 
    class="modal-backdrop fade show"
  ></div>
</template>

<script>
import { ref, computed, watch } from 'vue'

export default {
  name: 'StartExamModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    exam: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'start'],
  setup(props, { emit }) {
    const password = ref('')
    const passwordError = ref('')
    const isStarting = ref(false)

    const fullscreenSupported = computed(() => {
      return !!(
        document.fullscreenEnabled ||
        document.webkitFullscreenEnabled ||
        document.mozFullScreenEnabled ||
        document.msFullscreenEnabled
      )
    })

    const clearPasswordError = () => {
      passwordError.value = ''
    }

    const validatePassword = () => {
      if (!password.value.trim()) {
        passwordError.value = 'Password is required'
        return false
      }
      if (password.value.length < 3) {
        passwordError.value = 'Password is too short'
        return false
      }
      return true
    }

    const handleStart = async () => {
      if (!validatePassword()) return

      isStarting.value = true
      
      try {
        // Check if mobile device
        if (window.innerWidth < 768) {
          passwordError.value = 'Mobile devices are not supported for exams'
          return
        }

        // Check fullscreen capability
        if (!fullscreenSupported.value) {
          passwordError.value = 'Your browser does not support fullscreen mode'
          return
        }

        // Emit start event with exam ID and password
        emit('start', props.exam.id, password.value)
      } catch (error) {
        passwordError.value = 'An error occurred. Please try again.'
      } finally {
        isStarting.value = false
      }
    }

    const handleBackdropClick = (event) => {
      if (event.target === event.currentTarget) {
        emit('close')
      }
    }

    // Reset form when modal is closed
    watch(() => props.show, (newValue) => {
      if (!newValue) {
        password.value = ''
        passwordError.value = ''
        isStarting.value = false
      }
    })

    return {
      password,
      passwordError,
      isStarting,
      fullscreenSupported,
      clearPasswordError,
      handleStart,
      handleBackdropClick
    }
  }
}
</script>

<style scoped>
.modal {
  background: rgba(0, 0, 0, 0.5);
}

.modal.show {
  display: block !important;
}

.card {
  border: none;
}

.alert ul {
  padding-left: 1.2rem;
}

.alert ul li {
  margin-bottom: 0.25rem;
}

/* Custom scrollbar for modal body */
.modal-body {
  max-height: 70vh;
  overflow-y: auto;
}

.modal-body::-webkit-scrollbar {
  width: 6px;
}

.modal-body::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.modal-body::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>