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
            <i class="bi bi-question-circle me-2"></i>
            {{ question ? 'Edit Question' : 'Add Question' }}
          </h5>
          <button type="button" class="btn-close" @click="close"></button>
        </div>
        
        <form @submit.prevent="save">
          <div class="modal-body">
            <div class="mb-3">
              <label for="questionText" class="form-label">Question Text</label>
              <textarea 
                id="questionText"
                v-model="form.text" 
                class="form-control" 
                rows="3" 
                required
              ></textarea>
            </div>
            
            <div class="mb-3">
              <label for="questionType" class="form-label">Question Type</label>
              <select 
                id="questionType"
                v-model="form.type" 
                class="form-select" 
                required
              >
                <option value="multiple-choice">Multiple Choice</option>
                <option value="true-false">True/False</option>
                <option value="short-answer">Short Answer</option>
                <option value="essay">Essay</option>
              </select>
            </div>
            
            <div v-if="form.type === 'multiple-choice'" class="mb-3">
              <label class="form-label">Options</label>
              <div v-for="(option, index) in form.options" :key="index" class="input-group mb-2">
                <span class="input-group-text">{{ String.fromCharCode(65 + index) }}</span>
                <input 
                  v-model="option.text" 
                  type="text" 
                  class="form-control" 
                  :placeholder="`Option ${String.fromCharCode(65 + index)}`"
                  required
                >
                <div class="input-group-text">
                  <input 
                    v-model="form.correctAnswer" 
                    :value="index" 
                    type="radio" 
                    :name="`correct-${question?.id || 'new'}`"
                  >
                </div>
              </div>
            </div>
            
            <div v-if="form.type === 'true-false'" class="mb-3">
              <label class="form-label">Correct Answer</label>
              <div class="form-check">
                <input 
                  id="answerTrue" 
                  v-model="form.correctAnswer" 
                  value="true" 
                  type="radio" 
                  class="form-check-input" 
                  name="trueFalse"
                >
                <label for="answerTrue" class="form-check-label">True</label>
              </div>
              <div class="form-check">
                <input 
                  id="answerFalse" 
                  v-model="form.correctAnswer" 
                  value="false" 
                  type="radio" 
                  class="form-check-input" 
                  name="trueFalse"
                >
                <label for="answerFalse" class="form-check-label">False</label>
              </div>
            </div>
            
            <div class="row">
              <div class="col-md-6">
                <label for="points" class="form-label">Points</label>
                <input 
                  id="points"
                  v-model.number="form.points" 
                  type="number" 
                  class="form-control" 
                  min="1" 
                  required
                >
              </div>
              <div class="col-md-6">
                <label for="difficulty" class="form-label">Difficulty</label>
                <select 
                  id="difficulty"
                  v-model="form.difficulty" 
                  class="form-select"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="close">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isLoading">
              <div v-if="isLoading" class="spinner-border spinner-border-sm me-2" role="status"></div>
              {{ question ? 'Update Question' : 'Add Question' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'QuestionFormModal',
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
  emits: ['save', 'close'],
  data() {
    return {
      isLoading: false,
      form: {
        text: '',
        type: 'multiple-choice',
        options: [
          { text: '' },
          { text: '' },
          { text: '' },
          { text: '' }
        ],
        correctAnswer: null,
        points: 1,
        difficulty: 'medium'
      }
    }
  },
  watch: {
    question: {
      handler(newQuestion) {
        if (newQuestion) {
          this.form = { ...newQuestion }
        } else {
          this.resetForm()
        }
      },
      immediate: true
    },
    show(newValue) {
      if (!newValue) {
        this.resetForm()
      }
    }
  },
  methods: {
    resetForm() {
      this.form = {
        text: '',
        type: 'multiple-choice',
        options: [
          { text: '' },
          { text: '' },
          { text: '' },
          { text: '' }
        ],
        correctAnswer: null,
        points: 1,
        difficulty: 'medium'
      }
    },
    save() {
      this.isLoading = true
      this.$emit('save', { ...this.form })
      setTimeout(() => {
        this.isLoading = false
        this.close()
      }, 1000)
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