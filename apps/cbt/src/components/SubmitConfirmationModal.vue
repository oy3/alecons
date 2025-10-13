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
        <div class="modal-header border-bottom-0">
          <h5 class="modal-title text-warning">
            <i class="bi bi-exclamation-triangle me-2"></i>
            Submit Exam
          </h5>
        </div>
        
        <div class="modal-body text-center">
          <div class="mb-4">
            <i class="bi bi-question-circle text-warning" style="font-size: 4rem;"></i>
          </div>
          
          <h5 class="mb-3">Are you sure you want to submit your exam?</h5>
          
          <div class="alert alert-info">
            <div class="row text-center">
              <div class="col-6">
                <div class="h4 text-success mb-1">{{ answeredCount }}</div>
                <div class="small text-muted">Questions Answered</div>
              </div>
              <div class="col-6">
                <div class="h4 text-warning mb-1">{{ unansweredCount }}</div>
                <div class="small text-muted">Questions Unanswered</div>
              </div>
            </div>
          </div>

          <div v-if="unansweredCount > 0" class="alert alert-warning">
            <i class="bi bi-exclamation-triangle me-2"></i>
            You have <strong>{{ unansweredCount }}</strong> unanswered question{{ unansweredCount > 1 ? 's' : '' }}.
            You can still review and answer them before submitting.
          </div>

          <p class="text-muted">
            Once submitted, you cannot make any changes to your answers.
            Please review your responses before proceeding.
          </p>
        </div>
        
        <div class="modal-footer border-top-0 justify-content-center">
          <button 
            type="button" 
            class="btn btn-secondary me-3"
            @click="$emit('cancel')"
          >
            <i class="bi bi-arrow-left me-1"></i>
            Review Answers
          </button>
          <button 
            type="button" 
            class="btn btn-danger"
            @click="$emit('confirm')"
          >
            <i class="bi bi-check-circle me-1"></i>
            Submit Exam
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
import { computed } from 'vue'

export default {
  name: 'SubmitConfirmationModal',
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
    }
  },
  emits: ['confirm', 'cancel'],
  setup(props) {
    const unansweredCount = computed(() => {
      return props.totalQuestions - props.answeredCount
    })

    return {
      unansweredCount
    }
  }
}
</script>

<style scoped>
.modal {
  background: rgba(0, 0, 0, 0.6);
}

.modal.show {
  display: block !important;
}

.modal-content {
  border: none;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header,
.modal-footer {
  background: transparent;
}

.alert {
  border-radius: 10px;
}

.btn {
  border-radius: 25px;
  padding: 0.6rem 1.5rem;
  font-weight: 500;
}
</style>