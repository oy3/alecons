<template>
  <!-- Modal -->
  <div 
    class="modal fade" 
    :class="{ show: show }" 
    :style="{ display: show ? 'block' : 'none' }"
    tabindex="-1"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header border-bottom-0 text-center">
          <div class="w-100">
            <div class="mb-3">
              <i 
                :class="isAutoSubmit ? 'bi bi-clock-fill text-warning' : 'bi bi-check-circle-fill text-success'" 
                style="font-size: 4rem;"
              ></i>
            </div>
            <h4 class="modal-title mb-0" :class="isAutoSubmit ? 'text-warning' : 'text-success'">
              {{ isAutoSubmit ? "Time's Up! Exam Auto-Submitted" : "Exam Completed Successfully!" }}
            </h4>
          </div>
        </div>
        
        <div class="modal-body text-center">
          <div :class="isAutoSubmit ? 'alert alert-warning border-0' : 'alert alert-success border-0'">
            <h5 class="mb-3">
              {{ isAutoSubmit ? "⏰ Time Expired" : "🎉 Congratulations!" }}
            </h5>
            <p class="mb-2">
              {{ isAutoSubmit ? "Your exam time has expired and has been automatically submitted." : "Your exam has been submitted successfully." }}
            </p>
            <p class="mb-0">
              <strong>{{ gradingMessage || 'Your exam is being graded.' }}</strong>
            </p>
          </div>

          <div class="row text-center mb-4">
            <div class="col-6">
              <div class="card border-0 bg-light">
                <div class="card-body py-3">
                  <div class="h5 text-primary mb-1">{{ answeredCount }}</div>
                  <div class="small text-muted">Questions Answered</div>
                </div>
              </div>
            </div>
            <div class="col-6">
              <div class="card border-0 bg-light">
                <div class="card-body py-3">
                  <div class="h5 text-info mb-1">{{ totalQuestions }}</div>
                  <div class="small text-muted">Total Questions</div>
                </div>
              </div>
            </div>
          </div>

          <div class="alert alert-info border-0">
            <div class="small">
              <i class="bi bi-info-circle me-2"></i>
              <strong>What happens next?</strong>
            </div>
            <ul class="list-unstyled mb-0 mt-2 small text-start">
              <li class="mb-1">
                <i class="bi bi-envelope me-2 text-primary"></i>
                You will receive an email confirmation shortly
              </li>
              <li class="mb-1">
                <i class="bi bi-clock me-2 text-warning"></i>
                Results will be available in your dashboard once grading is complete
              </li>
              <li class="mb-0">
                <i class="bi bi-bell me-2 text-success"></i>
                You'll be notified when your results are ready
              </li>
            </ul>
          </div>
        </div>
        
        <div class="modal-footer border-top-0 justify-content-center">
          <button 
            type="button" 
            class="btn btn-success btn-lg px-5"
            @click="$emit('continue')"
          >
            <i class="bi bi-house-door me-2"></i>
            Go to Dashboard
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
export default {
  name: 'ExamCompletionModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    answeredCount: {
      type: Number,
      default: 0
    },
    totalQuestions: {
      type: Number,
      default: 0
    },
    gradingMessage: {
      type: String,
      default: 'Your exam is being graded.'
    },
    isAutoSubmit: {
      type: Boolean,
      default: false
    }
  },
  emits: ['continue'],
  mounted() {
    // Prevent modal from being closed by clicking outside or pressing escape
    if (this.show) {
      document.body.classList.add('modal-open');
    }
  },
  unmounted() {
    document.body.classList.remove('modal-open');
  }
}
</script>

<style scoped>
.modal-content {
  border-radius: 15px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.modal-header {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 15px 15px 0 0;
}

.card {
  transition: transform 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
}

.btn-success {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  border: none;
  border-radius: 25px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
}

.btn-success:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(40, 167, 69, 0.4);
}

.alert {
  border-radius: 10px;
}

.bi-check-circle-fill {
  animation: bounce 0.6s ease-in-out;
}

@keyframes bounce {
  0%, 20%, 53%, 80%, 100% {
    transform: translateY(0);
  }
  40%, 43% {
    transform: translateY(-10px);
  }
  70% {
    transform: translateY(-5px);
  }
  90% {
    transform: translateY(-2px);
  }
}
</style>
