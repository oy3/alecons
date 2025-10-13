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
            {{ isEditing ? 'Edit Exam' : 'Create New Exam' }}
          </h5>
          <button type="button" class="btn-close" @click="close"></button>
        </div>
        
        <div class="modal-body">
          <form @submit.prevent="handleSubmit">
            <!-- Basic Information -->
            <div class="mb-3">
              <label for="title" class="form-label">Exam Title *</label>
              <input
                v-model="form.title"
                type="text"
                id="title"
                class="form-control"
                placeholder="Enter exam title"
                required
              />
            </div>
            
            <div class="mb-3">
              <label for="description" class="form-label">Description</label>
              <textarea
                v-model="form.description"
                id="description"
                class="form-control"
                rows="3"
                placeholder="Brief description of the exam"
              ></textarea>
            </div>
            
            <div class="row">
              <div class="col-md-6 mb-3">
                <label for="subject" class="form-label">Subject *</label>
                <input
                  v-model="form.subject"
                  type="text"
                  id="subject"
                  class="form-control"
                  placeholder="e.g., Mathematics"
                  required
                />
              </div>
              
              <div class="col-md-6 mb-3">
                <label for="duration" class="form-label">Duration (minutes) *</label>
                <input
                  v-model.number="form.duration"
                  type="number"
                  id="duration"
                  class="form-control"
                  min="1"
                  required
                />
              </div>
            </div>
            
            <div class="row">
              <div class="col-md-6 mb-3">
                <label for="totalMarks" class="form-label">Total Marks *</label>
                <input
                  v-model.number="form.totalMarks"
                  type="number"
                  id="totalMarks"
                  class="form-control"
                  min="1"
                  required
                />
              </div>
              
              <div class="col-md-6 mb-3">
                <label for="passingMarks" class="form-label">Passing Marks *</label>
                <input
                  v-model.number="form.passingMarks"
                  type="number"
                  id="passingMarks"
                  class="form-control"
                  min="0"
                  :max="form.totalMarks"
                  required
                />
              </div>
            </div>
          </form>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="close">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            @click="handleSubmit"
            :disabled="isLoading"
          >
            <span v-if="isLoading" class="spinner-border spinner-border-sm me-2"></span>
            {{ isEditing ? 'Update Exam' : 'Create Exam' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ExamFormModal',
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
  emits: ['save', 'close'],
  data() {
    return {
      form: {
        title: '',
        description: '',
        subject: '',
        duration: 60,
        totalMarks: 100,
        passingMarks: 40
      },
      isLoading: false
    }
  },
  computed: {
    isEditing() {
      return this.exam !== null
    }
  },
  watch: {
    exam: {
      handler() {
        this.initializeForm()
      },
      immediate: true
    }
  },
  methods: {
    initializeForm() {
      if (this.exam) {
        Object.assign(this.form, {
          title: this.exam.title || '',
          description: this.exam.description || '',
          subject: this.exam.subject || '',
          duration: this.exam.duration || 60,
          totalMarks: this.exam.totalMarks || 100,
          passingMarks: this.exam.passingMarks || 40
        })
      } else {
        this.resetForm()
      }
    },
    
    resetForm() {
      Object.assign(this.form, {
        title: '',
        description: '',
        subject: '',
        duration: 60,
        totalMarks: 100,
        passingMarks: 40
      })
    },
    
    async handleSubmit() {
      this.isLoading = true
      
      try {
        const examData = { ...this.form }
        
        if (this.exam) {
          examData.id = this.exam.id
        }
        
        this.$emit('save', examData)
        this.close()
      } catch (error) {
        console.error('Error saving exam:', error)
      } finally {
        this.isLoading = false
      }
    },
    
    close() {
      this.resetForm()
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