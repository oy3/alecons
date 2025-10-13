<template>
  <div 
    class="modal fade" 
    :class="{ show: show }" 
    :style="{ display: show ? 'block' : 'none' }" 
    tabindex="-1"
  >
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi bi-eye me-2"></i>
            Question Details
          </h5>
          <button type="button" class="btn-close" @click="close"></button>
        </div>
        
        <div class="modal-body">
          <div v-if="question">
            <div class="mb-4">
              <h6>Question Text</h6>
              <p class="border p-3 rounded bg-light">{{ question.text }}</p>
            </div>
            
            <div class="row mb-3">
              <div class="col-md-4">
                <strong>Type:</strong> 
                <span class="badge bg-primary ms-1">{{ formatType(question.type) }}</span>
              </div>
              <div class="col-md-4">
                <strong>Points:</strong> {{ question.points }}
              </div>
              <div class="col-md-4">
                <strong>Difficulty:</strong> 
                <span class="badge" :class="getDifficultyClass(question.difficulty)">
                  {{ question.difficulty }}
                </span>
              </div>
            </div>
            
            <div v-if="question.type === 'multiple-choice'" class="mb-3">
              <h6>Options</h6>
              <div v-for="(option, index) in question.options" :key="index" class="mb-2">
                <div class="d-flex align-items-center">
                  <span class="badge bg-secondary me-2">{{ String.fromCharCode(65 + index) }}</span>
                  <span>{{ option.text }}</span>
                  <i 
                    v-if="question.correctAnswer === index" 
                    class="bi bi-check-circle-fill text-success ms-2"
                  ></i>
                </div>
              </div>
            </div>
            
            <div v-if="question.type === 'true-false'" class="mb-3">
              <h6>Correct Answer</h6>
              <span class="badge bg-success">{{ question.correctAnswer }}</span>
            </div>
            
            <div v-if="question.createdAt" class="text-muted small">
              Created: {{ formatDate(question.createdAt) }}
            </div>
          </div>
          
          <div v-else class="text-center py-5">
            <i class="bi bi-question-circle text-muted" style="font-size: 4rem;"></i>
            <h4 class="text-muted mt-3">No Question Selected</h4>
          </div>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="close">
            Close
          </button>
          <button 
            v-if="question" 
            type="button" 
            class="btn btn-primary" 
            @click="edit"
          >
            <i class="bi bi-pencil me-1"></i>
            Edit Question
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'QuestionViewModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    question: {
      type: Object,
      default: null
    }
  },
  emits: ['edit', 'close'],
  methods: {
    formatType(type) {
      const types = {
        'multiple-choice': 'Multiple Choice',
        'true-false': 'True/False',
        'short-answer': 'Short Answer',
        'essay': 'Essay'
      }
      return types[type] || type
    },
    getDifficultyClass(difficulty) {
      const classes = {
        'easy': 'bg-success',
        'medium': 'bg-warning',
        'hard': 'bg-danger'
      }
      return classes[difficulty] || 'bg-secondary'
    },
    formatDate(date) {
      return new Date(date).toLocaleDateString()
    },
    edit() {
      this.$emit('edit', this.question)
    },
    close() {
      this.$emit('close')
    }
  }
}
</script>

<style scoped>
.modal.show {
  background: rgba(0, 0, 0, 0.5);
}
</style>