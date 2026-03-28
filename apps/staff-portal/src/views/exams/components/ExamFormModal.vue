<script>
import { apiService } from '../../../services/api.js'
import { logger } from '@shared/utils/logger'
import Swal from 'sweetalert2'

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
        academicSession: '',
        target: {
          type: 'applicants',
          filter: {
            programs: [],
            departments: [],
            courses: []
          }
        },
        examTimestamp: '',
        duration: 60,
        totalQuestions: 100,
        attemptLimit: 1,
        totalMark: 100,
        cutOffMark: 50,
        randomizeQuestions: false,
        randomizeOptions: false,
        security: {
          disableRightClick: true,
          disableCopy: true,
          disablePaste: true,
          disablePrint: true,
          enableFullscreen: true,
          enableProctoring: false,
          allowCalculator: false,
          allowNotes: false,
          blockTabSwitching: true,
          showTimer: true,
          autoSubmit: true
        }
      },
      academicSessions: [],
      programs: [],
      departments: [],
      courses: [],
      isLoading: false,
      loadingData: false,
      errors: {}
    }
  },
  computed: {
    isEditing() {
      return this.exam !== null
    },

    targetTypeOptions() {
      return [
        { value: 'applicants', label: 'Applicants' },
        { value: 'students', label: 'Students' },
        { value: 'staff', label: 'Staff' },
        { value: 'custom', label: 'Custom Filter' }
      ]
    },

    showProgramFilter() {
      return this.form.target.type === 'applicants' || this.form.target.type === 'students'
    },

    showDepartmentFilter() {
      return this.form.target.type === 'staff' || this.form.target.type === 'students'
    },

    showCourseFilter() {
      return this.form.target.type === 'students'
    },

    formattedExamDate() {
      if (!this.form.examTimestamp) return ''
      
      // Handle both ISO string and Date object inputs
      const date = typeof this.form.examTimestamp === 'string' 
        ? new Date(this.form.examTimestamp) 
        : this.form.examTimestamp
        
      // Check if date is valid
      if (isNaN(date.getTime())) return ''
      
      // Format for datetime-local input (YYYY-MM-DDTHH:mm)
      // Use local timezone to avoid offset issues
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      return `${year}-${month}-${day}T${hours}:${minutes}`
    },

    minExamDate() {
      // Set minimum to 5 minutes from now to give reasonable buffer
      const minDate = new Date()
      minDate.setMinutes(minDate.getMinutes() + 5)
      
      // Format for datetime-local input using local timezone
      const year = minDate.getFullYear()
      const month = String(minDate.getMonth() + 1).padStart(2, '0')
      const day = String(minDate.getDate()).padStart(2, '0')
      const hours = String(minDate.getHours()).padStart(2, '0')
      const minutes = String(minDate.getMinutes()).padStart(2, '0')
      
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }
  },
  watch: {
    exam: {
      handler() {
        this.initializeForm()
      },
      immediate: true
    },

    show: {
      handler(newVal) {
        if (newVal) {
          this.loadFormData()
        }
      },
      immediate: true
    },

    'form.target.type'() {
      this.form.target.filter = {
        programs: [],
        departments: [],
        courses: []
      }
    }
  },
  methods: {
    async loadFormData() {
      this.loadingData = true
      try {
        const [sessionsRes, programsRes, departmentsRes] = await Promise.all([
          apiService.getAcademicSessions(),
          apiService.getPrograms({ limit: 100 }),
          apiService.getDepartments()
        ])

        if (sessionsRes.success) {
          this.academicSessions = sessionsRes.data.sessions || []
          logger.debug('Academic sessions loaded for exam form:', sessionsRes.data.sessions)
        }

        if (programsRes.success) {
          this.programs = programsRes.data || []
        }

        if (departmentsRes.success) {
          this.departments = departmentsRes.data.departments || []
        }

      } catch (error) {
        logger.error('Error loading form data:', error)
        Swal.fire('Error', 'Failed to load form data', 'error')
      } finally {
        this.loadingData = false
      }
    },

    initializeForm() {
      if (this.exam) {
        Object.assign(this.form, {
          title: this.exam.title || '',
          description: this.exam.description || '',
          academicSession: this.exam.academicSession?._id || this.exam.academicSession || '',
          target: {
            type: this.exam.target?.type || 'applicants',
            filter: {
              programs: this.exam.target?.filter?.programs || [],
              departments: this.exam.target?.filter?.departments || [],
              courses: this.exam.target?.filter?.courses || []
            }
          },
          examTimestamp: this.exam.examTimestamp ? new Date(this.exam.examTimestamp).toISOString() : '',
          duration: this.exam.duration || 60,
          totalQuestions: this.exam.totalQuestions || 100,
          attemptLimit: this.exam.attemptLimit || 1,
          totalMark: this.exam.totalMark || 100,
          cutOffMark: this.exam.cutOffMark || 50,
          randomizeQuestions: this.exam.randomizeQuestions || false,
          randomizeOptions: this.exam.randomizeOptions || false,
          security: {
            ...this.form.security,
            ...this.exam.security
          }
        })
      } else {
        this.resetForm()
      }
      this.errors = {}
    },

    resetForm() {
      Object.assign(this.form, {
        title: '',
        description: '',
        academicSession: '',
        target: {
          type: 'applicants',
          filter: {
            programs: [],
            departments: [],
            courses: []
          }
        },
        examTimestamp: '',
        duration: 60,
        totalQuestions: 100,
        attemptLimit: 1,
        totalMark: 100,
        cutOffMark: 50,
        randomizeQuestions: false,
        randomizeOptions: false,
        security: {
          disableRightClick: true,
          disableCopy: true,
          disablePaste: true,
          disablePrint: true,
          enableFullscreen: true,
          enableProctoring: false,
          allowCalculator: false,
          allowNotes: false,
          blockTabSwitching: true,
          showTimer: true,
          autoSubmit: true
        }
      })
      this.errors = {}
    },

    validateForm() {
      this.errors = {}

      if (!this.form.title.trim()) {
        this.errors.title = 'Title is required'
      }

      if (!this.form.academicSession) {
        this.errors.academicSession = 'Academic session is required'
      }

      if (!this.form.examTimestamp) {
        this.errors.examTimestamp = 'Exam date and time is required'
      } else {
        const examDate = new Date(this.form.examTimestamp)
        const now = new Date()
        
        // Give a 1 minute buffer to account for processing time
        const minimumTime = new Date(now.getTime() + (1 * 60 * 1000))
        
        if (examDate <= minimumTime) {
          this.errors.examTimestamp = 'Exam date must be at least 1 minute in the future'
        }
      }

      if (this.form.duration < 5 || this.form.duration > 480) {
        this.errors.duration = 'Duration must be between 5 and 480 minutes'
      }

      if (this.form.totalQuestions < 1 || this.form.totalQuestions > 500) {
        this.errors.totalQuestions = 'Total questions must be between 1 and 500'
      }

      if (this.form.attemptLimit < 1 || this.form.attemptLimit > 10) {
        this.errors.attemptLimit = 'Attempt limit must be between 1 and 10'
      }

      if (this.form.totalMark < 1) {
        this.errors.totalMark = 'Total mark must be at least 1'
      }

      if (this.form.cutOffMark < 0) {
        this.errors.cutOffMark = 'Cut off mark cannot be negative'
      }

      if (this.form.cutOffMark > this.form.totalMark) {
        this.errors.cutOffMark = 'Cut off mark cannot exceed total mark'
      }

      return Object.keys(this.errors).length === 0
    },

    async handleSubmit() {
      if (!this.validateForm()) {
        Swal.fire('Validation Error', 'Please correct the errors in the form', 'error')
        return
      }

      this.isLoading = true

      try {
        logger.debug('Form data before conversion:', {
          duration: this.form.duration,
          totalQuestions: this.form.totalQuestions,
          attemptLimit: this.form.attemptLimit,
          totalMark: this.form.totalMark,
          cutOffMark: this.form.cutOffMark,
          examTimestamp: this.form.examTimestamp
        })
        
        const examData = {
          title: this.form.title.trim(),
          description: this.form.description.trim(),
          academicSession: this.form.academicSession, // This should be ObjectId string
          target: {
            type: this.form.target.type,
            filter: {}
          },
          examTimestamp: new Date(this.form.examTimestamp).toISOString(), // Convert to ISO string
          duration: Number(this.form.duration),
          totalQuestions: Number(this.form.totalQuestions),
          attemptLimit: Number(this.form.attemptLimit),
          totalMark: Number(this.form.totalMark),
          cutOffMark: Number(this.form.cutOffMark),
          randomizeQuestions: this.form.randomizeQuestions,
          randomizeOptions: this.form.randomizeOptions,
          security: this.form.security
        }
        
        logger.debug('Exam data after conversion:', examData)

        if (this.showProgramFilter && this.form.target.filter.programs.length > 0) {
          examData.target.filter.programs = this.form.target.filter.programs
        }

        if (this.showDepartmentFilter && this.form.target.filter.departments.length > 0) {
          examData.target.filter.departments = this.form.target.filter.departments
        }

        if (this.showCourseFilter && this.form.target.filter.courses.length > 0) {
          examData.target.filter.courses = this.form.target.filter.courses
        }

        if (this.exam) {
          examData.id = this.exam._id || this.exam.id
        }

        this.$emit('save', examData)
        this.close()
      } catch (error) {
        logger.error('Error saving exam:', error)
        Swal.fire('Error', 'Failed to save exam', 'error')
      } finally {
        this.isLoading = false
      }
    },

    close() {
      this.resetForm()
      this.$emit('close')
    },

    onExamDateChange(event) {
      const inputValue = event.target.value
      
      if (!inputValue) {
        this.form.examTimestamp = ''
        this.clearFieldError('examTimestamp')
        return
      }
      
      // Create date from datetime-local input (already in local timezone)
      const selectedDate = new Date(inputValue)
      
      // Validate the date is valid
      if (isNaN(selectedDate.getTime())) {
        this.errors.examTimestamp = 'Please enter a valid date and time'
        return
      }
      
      // Store as ISO string for consistency with backend
      this.form.examTimestamp = selectedDate.toISOString()
      
      // Clear previous error when user selects a valid date
      this.clearFieldError('examTimestamp')
      
      // Real-time validation feedback
      const now = new Date()
      // Add 1 minute buffer for current time comparison
      if (selectedDate <= new Date(now.getTime() + 60000)) {
        this.errors.examTimestamp = 'Exam date must be at least 1 minute in the future'
      }
    },

    // Utility method to clear field errors
    clearFieldError(fieldName) {
      logger.debug('Clearing error for field:', fieldName, this.errors)
      if (this.errors[fieldName]) {
        delete this.errors[fieldName]
        logger.debug('Error cleared. Remaining errors:', this.errors)
      }
    }
  }
}
</script>

<template>
  <div class="modal fade" :class="{ show: show }" :style="{ display: show ? 'block' : 'none' }" tabindex="-1">
    <div class="modal-dialog modal-xl">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            {{ isEditing ? 'Edit Exam' : 'Create New Exam' }}
          </h5>
          <button type="button" class="btn-close" @click="close"></button>
        </div>

        <div class="modal-body" style="max-height: 80vh; overflow-y: auto;">
          <div v-if="loadingData" class="text-center py-3">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading form data...</p>
          </div>

          <form v-else @submit.prevent="handleSubmit">
            <div class="card p-0 mb-4">
              <div class="card-header">
                <h6 class="mb-0"><i class="bi bi-info-circle me-2"></i>Basic Information</h6>
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <label for="title" class="form-label">Exam Title <span class="text-danger">*</span></label>
                  <input v-model="form.title" type="text" id="title" class="form-control"
                    :class="{ 'is-invalid': errors.title }" placeholder="Enter exam title" 
                    @input="clearFieldError('title')" required />
                  <div v-if="errors.title" class="invalid-feedback">{{ errors.title }}</div>
                </div>

                <div class="mb-3">
                  <label for="description" class="form-label">Description</label>
                  <textarea v-model="form.description" id="description" class="form-control" rows="3"
                    placeholder="Brief description of the exam"></textarea>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="academicSession" class="form-label">Academic Session <span
                        class="text-danger">*</span></label>
                    <select v-model="form.academicSession" id="academicSession" class="form-select"
                      :class="{ 'is-invalid': errors.academicSession }" 
                      @change="clearFieldError('academicSession')" required>
                      <option value="">Select Academic Session</option>
                      <option v-for="session in academicSessions" :key="session._id" :value="session._id">
                      {{ session.sessionYear }}
                      </option>
                    </select>
                    <div v-if="errors.academicSession" class="invalid-feedback">{{ errors.academicSession }}</div>
                  </div>

                  <div class="col-md-6 mb-3">
                    <label for="examTimestamp" class="form-label">Exam Date & Time <span
                        class="text-danger">*</span></label>
                    <input :value="formattedExamDate" @input="onExamDateChange" type="datetime-local" id="examTimestamp"
                      class="form-control" :class="{ 'is-invalid': errors.examTimestamp }" :min="minExamDate"
                      required />
                    <div class="form-text text-muted">
                      <i class="bi bi-info-circle me-1"></i>
                      Select a future date and time for the exam
                    </div>
                    <div v-if="errors.examTimestamp" class="invalid-feedback">
                      <i class="bi bi-exclamation-triangle me-1"></i>
                      {{ errors.examTimestamp }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="card p-0 mb-4">
              <div class="card-header">
                <h6 class="mb-0"><i class="bi bi-people me-2"></i>Target Audience</h6>
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <label for="targetType" class="form-label">Target Type <span class="text-danger">*</span></label>
                  <select v-model="form.target.type" id="targetType" class="form-select" required>
                    <option v-for="option in targetTypeOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <div class="form-text">
                    Choose who can take this exam: Applicants (admission candidates), Students (enrolled), or Staff
                    members.
                  </div>
                </div>

                <div v-if="showProgramFilter" class="mb-3">
                  <label class="form-label">Programs</label>
                  <select v-model="form.target.filter.programs" class="form-select" multiple size="4">
                    <option v-for="program in programs.slice().sort((a, b) => a.name.localeCompare(b.name))"
                      :key="program.id" :value="program.id">
                      {{ (program.programType || '') + ' ' + program.name + ' ' + (program.programMode || '') }}
                    </option>
                  </select>
                  <div class="form-text">
                    Select specific programs (leave empty for all {{ form.target.type }})
                  </div>
                </div>

                <div v-if="showDepartmentFilter" class="mb-3">
                  <label class="form-label">Departments</label>
                  <select v-model="form.target.filter.departments" class="form-select" multiple size="4">
                    <option v-for="department in departments" :key="department._id" :value="department._id">
                      {{ department.name }}
                    </option>
                  </select>
                  <div class="form-text">
                    Select specific departments (leave empty for all {{ form.target.type }})
                  </div>
                </div>

                <div v-if="showCourseFilter" class="mb-3">
                  <label class="form-label">Courses</label>
                  <select v-model="form.target.filter.courses" class="form-select" multiple size="3">
                    <option disabled>Course filtering will be implemented when course management is available</option>
                  </select>
                  <div class="form-text">
                    Select specific courses (leave empty for all students in selected departments)
                  </div>
                </div>
              </div>
            </div>

            <div class="card p-0 mb-4">
              <div class="card-header">
                <h6 class="mb-0"><i class="bi bi-gear me-2"></i>Exam Configuration</h6>
              </div>
              <div class="card-body">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="duration" class="form-label">Duration (minutes) <span
                        class="text-danger">*</span></label>
                    <input v-model.number="form.duration" type="number" id="duration" class="form-control"
                      :class="{ 'is-invalid': errors.duration }" min="5" max="480" 
                      @input="clearFieldError('duration')" required />
                    <div v-if="errors.duration" class="invalid-feedback">{{ errors.duration }}</div>
                    <div class="form-text">Between 5 and 480 minutes</div>
                  </div>

                  <div class="col-md-6 mb-3">
                    <label for="totalQuestions" class="form-label">Total Questions <span
                        class="text-danger">*</span></label>
                    <input v-model.number="form.totalQuestions" type="number" id="totalQuestions" class="form-control"
                      :class="{ 'is-invalid': errors.totalQuestions }" min="1" max="500" step="1" 
                      @input="clearFieldError('totalQuestions')" required />
                    <div v-if="errors.totalQuestions" class="invalid-feedback">{{ errors.totalQuestions }}</div>
                    <div class="form-text">Between 1 and 500 questions</div>
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-4 mb-3">
                    <label for="totalMark" class="form-label">Total Mark <span class="text-danger">*</span></label>
                    <input v-model.number="form.totalMark" type="number" id="totalMark" class="form-control"
                      :class="{ 'is-invalid': errors.totalMark }" min="1" step="1" 
                      @input="clearFieldError('totalMark')" required />
                    <div v-if="errors.totalMark" class="invalid-feedback">{{ errors.totalMark }}</div>
                  </div>

                  <div class="col-md-4 mb-3">
                    <label for="cutOffMark" class="form-label">Cut Off Mark <span class="text-danger">*</span></label>
                    <input v-model.number="form.cutOffMark" type="number" id="cutOffMark" class="form-control"
                      :class="{ 'is-invalid': errors.cutOffMark }" min="0" :max="form.totalMark" step="1" 
                      @input="clearFieldError('cutOffMark')" required />
                    <div v-if="errors.cutOffMark" class="invalid-feedback">{{ errors.cutOffMark }}</div>
                    <div class="form-text">Minimum score to pass</div>
                  </div>

                  <div class="col-md-4 mb-3">
                    <label for="attemptLimit" class="form-label">Attempt Limit <span
                        class="text-danger">*</span></label>
                    <input v-model.number="form.attemptLimit" type="number" id="attemptLimit" class="form-control"
                      :class="{ 'is-invalid': errors.attemptLimit }" min="1" max="10" required />
                    <div v-if="errors.attemptLimit" class="invalid-feedback">{{ errors.attemptLimit }}</div>
                    <div class="form-text">Between 1 and 10 attempts</div>
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6">
                    <div class="form-check mb-3">
                      <input v-model="form.randomizeQuestions" class="form-check-input" type="checkbox"
                        id="randomizeQuestions" />
                      <label class="form-check-label" for="randomizeQuestions">
                        Randomize Question Order
                      </label>
                      <div class="form-text">Questions will appear in random order for each student</div>
                    </div>
                  </div>

                  <div class="col-md-6">
                    <div class="form-check mb-3">
                      <input v-model="form.randomizeOptions" class="form-check-input" type="checkbox"
                        id="randomizeOptions" />
                      <label class="form-check-label" for="randomizeOptions">
                        Randomize Answer Options
                      </label>
                      <div class="form-text">Answer choices will be shuffled for each question</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="card p-0 mb-4">
              <div class="card-header">
                <h6 class="mb-0"><i class="bi bi-shield-check me-2"></i>Security Settings</h6>
              </div>
              <div class="card-body">
                <div class="row">
                  <div class="col-md-6">
                    <div class="form-check mb-3">
                      <input v-model="form.security.enableFullscreen" class="form-check-input" type="checkbox"
                        id="enableFullscreen" />
                      <label class="form-check-label" for="enableFullscreen">
                        Force Fullscreen Mode
                      </label>
                    </div>

                    <div class="form-check mb-3">
                      <input v-model="form.security.disableRightClick" class="form-check-input" type="checkbox"
                        id="disableRightClick" />
                      <label class="form-check-label" for="disableRightClick">
                        Disable Right Click
                      </label>
                    </div>

                    <div class="form-check mb-3">
                      <input v-model="form.security.disableCopy" class="form-check-input" type="checkbox"
                        id="disableCopy" />
                      <label class="form-check-label" for="disableCopy">
                        Disable Copy (Ctrl+C)
                      </label>
                    </div>

                    <div class="form-check mb-3">
                      <input v-model="form.security.disablePaste" class="form-check-input" type="checkbox"
                        id="disablePaste" />
                      <label class="form-check-label" for="disablePaste">
                        Disable Paste (Ctrl+V)
                      </label>
                    </div>

                    <div class="form-check mb-3">
                      <input v-model="form.security.blockTabSwitching" class="form-check-input" type="checkbox"
                        id="blockTabSwitching" />
                      <label class="form-check-label" for="blockTabSwitching">
                        Block Tab Switching
                      </label>
                    </div>
                  </div>

                  <div class="col-md-6">
                    <div class="form-check mb-3">
                      <input v-model="form.security.showTimer" class="form-check-input" type="checkbox"
                        id="showTimer" />
                      <label class="form-check-label" for="showTimer">
                        Show Timer
                      </label>
                    </div>

                    <div class="form-check mb-3">
                      <input v-model="form.security.autoSubmit" class="form-check-input" type="checkbox"
                        id="autoSubmit" />
                      <label class="form-check-label" for="autoSubmit">
                        Auto Submit on Time Up
                      </label>
                    </div>

                    <div class="form-check mb-3">
                      <input v-model="form.security.allowCalculator" class="form-check-input" type="checkbox"
                        id="allowCalculator" />
                      <label class="form-check-label" for="allowCalculator">
                        Allow Calculator
                      </label>
                    </div>

                    <div class="form-check mb-3">
                      <input v-model="form.security.allowNotes" class="form-check-input" type="checkbox"
                        id="allowNotes" />
                      <label class="form-check-label" for="allowNotes">
                        Allow Notes
                      </label>
                    </div>

                    <div class="form-check mb-3">
                      <input v-model="form.security.enableProctoring" class="form-check-input" type="checkbox"
                        id="enableProctoring" />
                      <label class="form-check-label" for="enableProctoring">
                        Enable Proctoring
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="close">
            Cancel
          </button>
          <button type="button" class="btn btn-primary" @click="handleSubmit" :disabled="isLoading || loadingData">
            <span v-if="isLoading" class="spinner-border spinner-border-sm me-2"></span>
            {{ isEditing ? 'Update Exam' : 'Create Exam' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal.show {
  background: rgba(0, 0, 0, 0.5);
}
</style>
