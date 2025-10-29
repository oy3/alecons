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
      errors: {},
      form: {
        questionText: '',
        type: '',
        options: [],
        answer: null,
        mark: 1,
        difficulty: ''
      }
    }
  },
  computed: {
    isValid() {
      return !Object.keys(this.errors).length
    }
  },
  watch: {
    question: {
      handler(newQuestion) {
        if (newQuestion) {
          // Convert options object to array and answer letter to index
          let options = [];
          let answer = null;

          if (newQuestion.options) {
            // Convert options from {a: 'text', b: 'text'} to ['text', 'text']
            options = Object.keys(newQuestion.options)
              .sort() // Sort keys (a,b,c,d,e)
              .map(key => newQuestion.options[key]);

            // Convert answer from letter to index (a -> 0, b -> 1, etc.)
            if (newQuestion.type === 'mcq' && newQuestion.answer) {
              answer = newQuestion.answer.charCodeAt(0) - 97; // 'a' -> 0, 'b' -> 1, etc.
            } else if (newQuestion.type === 'multi' && Array.isArray(newQuestion.answer)) {
              answer = newQuestion.answer.map(letter => letter.charCodeAt(0) - 97);
            }
          }

          this.form = {
            questionText: newQuestion.questionText || '',
            type: newQuestion.type || '',
            options: options,
            answer: answer,
            mark: newQuestion.mark || 1,
            difficulty: newQuestion.metadata?.difficulty?.toLowerCase() || ''
          }
        } else {
          this.resetForm()
        }
      },
      immediate: true
    },
    show(newValue) {
      if (!newValue) {
        this.resetForm()
        this.errors = {}
      }
    }
  },
  methods: {
    resetForm() {
      this.form = {
        questionText: '',
        type: '',
        options: [],
        answer: null,
        mark: 1,
        difficulty: ''
      }
      this.errors = {}
    },
    handleTypeChange() {
      this.form.options = []
      this.form.answer = null
      
      if (['mcq', 'multi'].includes(this.form.type)) {
        // Initialize with 2 empty options for multiple choice
        this.form.options = ['', '', '', '', '']
      }
    },
    addOption() {
      if (this.form.options.length < 6) {
        this.form.options.push('')
      }
    },
    removeOption(index) {
      if (this.form.options.length > 2) {
        this.form.options.splice(index, 1)
        
        // Adjust answer indices if needed
        if (this.form.type === 'mcq') {
          if (this.form.answer === index) {
            this.form.answer = null
          } else if (this.form.answer > index) {
            this.form.answer--
          }
        } else if (this.form.type === 'multi') {
          this.form.answer = this.form.answer.filter(ans => {
            if (ans === index) return false
            if (ans > index) ans--
            return true
          })
        }
      }
    },
    validate() {
      const errors = {}
      
      // Required fields
      if (!this.form.questionText?.trim()) {
        errors.questionText = 'Question text is required'
      }
      
      if (!this.form.type) {
        errors.type = 'Question type is required'
      }
      
      if (!this.form.mark || this.form.mark < 1) {
        errors.mark = 'Mark must be a positive number'
      }
      
      if (!this.form.difficulty) {
        errors.difficulty = 'Difficulty level is required'
      }
      
      // Validate options for MCQ/multi questions
      if (['mcq', 'multi'].includes(this.form.type)) {
        if (!this.form.options?.length || this.form.options.length < 2) {
          errors.options = ['At least 2 options are required']
        } else {
          const optionErrors = {}
          this.form.options.forEach((opt, idx) => {
            if (!opt?.trim()) {
              optionErrors[idx] = 'Option text is required'
            }
          })
          if (Object.keys(optionErrors).length) {
            errors.options = optionErrors
          }
        }
        
        // Validate answer selection
        if (this.form.type === 'mcq' && this.form.answer === null) {
          errors.answer = 'Please select the correct answer'
        } else if (this.form.type === 'multi' && (!this.form.answer?.length)) {
          errors.answer = 'Please select at least one correct answer'
        }
      }
      
      this.errors = errors
      return Object.keys(errors).length === 0
    },
    async handleSubmit(e) {
      if (!this.validate()) {
        e.preventDefault()
        return
      }
      
      try {
        this.isLoading = true
        await this.$emit('save', { ...this.form })
        this.close()
      } catch (err) {
        console.error('Error saving question:', err)
        // Handle API error
      } finally {
        this.isLoading = false
      }
    },
    close() {
      this.$emit('close')
    }
  }
}
</script>

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
        
        <form @submit.prevent="handleSubmit" ref="form" class="needs-validation" novalidate>
          <div class="modal-body">
            <div class="mb-3">
              <label for="questionText" class="form-label">Question Text</label>
              <textarea 
                id="questionText"
                v-model="form.questionText" 
                class="form-control" 
                :class="{ 'is-invalid': errors.questionText }"
                rows="3" 
                required
              ></textarea>
              <div class="invalid-feedback">
                {{ errors.questionText || 'Question text is required' }}
              </div>
            </div>
            
            <div class="mb-3">
              <label for="questionType" class="form-label">Question Type</label>
              <select 
                id="questionType"
                v-model="form.type" 
                class="form-select"
                :class="{ 'is-invalid': errors.type }"
                required
                @change="handleTypeChange"
              >
                <option value="">Select a type...</option>
                <option value="mcq">Multiple Choice</option>
                <option value="multi">Multi-Select</option>
                <option value="essay">Essay</option>
              </select>
              <div class="invalid-feedback">
                {{ errors.type || 'Question type is required' }}
              </div>
            </div>
            
            <div v-if="['mcq', 'multi'].includes(form.type)" class="mb-3">
              <label class="form-label d-block">Options</label>
              <div v-for="(option, index) in form.options" :key="index" class="input-group mb-2">
                <div class="input-group-text">
                  <input 
                    v-if="form.type === 'mcq'"
                    type="radio" 
                    :name="'answer'" 
                    :value="index"
                    v-model="form.answer"
                    required
                  >
                  <input 
                    v-else
                    type="checkbox" 
                    :value="index"
                    v-model="form.answer"
                    required
                  >
                </div>
                <input 
                  v-model="form.options[index]" 
                  type="text" 
                  class="form-control"
                  :class="{ 'is-invalid': errors.options?.[index] }"
                  :placeholder="`Option ${String.fromCharCode(65 + index)}`"
                  required
                >
                <button 
                  type="button"
                  class="btn btn-outline-danger"
                  @click="removeOption(index)"
                  :disabled="form.options.length <= 2"
                >
                  <i class="bi bi-trash"></i>
                </button>
                <div class="invalid-feedback">
                  {{ errors.options?.[index] || 'Option text is required' }}
                </div>
              </div>
              
              <button 
                type="button" 
                class="btn btn-outline-primary mt-2"
                @click="addOption"
                :disabled="form.options.length >= 6"
              >
                <i class="bi bi-plus-circle me-2"></i>
                Add Option
              </button>
              <div v-if="errors.answer" class="text-danger mt-2">
                {{ errors.answer }}
              </div>
            </div>

            <div class="mb-3">
              <label for="mark" class="form-label">Mark</label>
              <input 
                type="number"
                id="mark"
                v-model.number="form.mark"
                class="form-control"
                :class="{ 'is-invalid': errors.mark }"
                min="1"
                required
              >
              <div class="invalid-feedback">
                {{ errors.mark || 'Mark must be a positive number' }}
              </div>
            </div>

            <div class="mb-3">
              <label for="difficulty" class="form-label">Difficulty</label>
              <select 
                id="difficulty"
                v-model="form.difficulty" 
                class="form-select"
                :class="{ 'is-invalid': errors.difficulty }"
                required
              >
                <option value="">Select difficulty...</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <div class="invalid-feedback">
                {{ errors.difficulty || 'Difficulty level is required' }}
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


<style scoped>
.modal.show {
  background: rgba(0, 0, 0, 0.5);
}
</style>