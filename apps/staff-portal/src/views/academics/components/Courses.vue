<script>
import { apiService } from '../../../services/api.js'
import { logger } from '@shared/utils/logger'

const createDefaultAssessmentComponents = () => Array.from({ length: 4 }, (_, index) => ({
  title: `Assessment ${index + 1}`,
  maximumMark: null,
  weightPercent: null,
  componentType: 'assessment',
  displayOrder: index + 1,
  description: '',
  assessmentDate: null,
  active: true,
  mandatory: true,
  absenceAllowed: false,
}))

const createEmptyProgramCourseForm = () => ({
  id: null,
  courseId: '',
  programId: '',
  units: 2,
  hours: 2,
  lecturerIds: [],
  level: null,
  semester: null,
  category: 'compulsory',
  active: true,
  assessmentComponents: createDefaultAssessmentComponents(),
})

const createEmptyCourseForm = () => ({
  id: null,
  code: '',
  title: '',
  description: '',
  active: true
})

export default {
  name: 'CoursesManagement',
  data() {
    return {
      isLoading: true,
      isCatalogLoading: false,
      isSavingProgramCourse: false,
      isSavingCourse: false,
      programCourses: [],
      courseCatalog: [],
      courseOptions: [],
      programs: [],
      lecturers: [],
      currentPage: 1,
      perPage: 10,
      totalProgramCourses: 0,
      programCourseSearchTimeout: null,
      programCourseFilters: {
        search: '',
        programId: '',
        level: '',
        semester: '',
        category: '',
      },
      catalogSearchQuery: '',
      catalogSearchTimeout: null,
      catalogCurrentPage: 1,
      catalogPerPage: 10,
      totalCatalogItems: 0,
      showProgramCourseModal: false,
      showCatalogModal: false,
      showCourseFormModal: false,
      selectedProgramCourse: null,
      programCourseForm: createEmptyProgramCourseForm(),
      courseForm: createEmptyCourseForm(),
      semesterOptions: [
        { value: 1, label: 'First Semester' },
        { value: 2, label: 'Second Semester' }
      ],
      categoryOptions: [
        { value: 'compulsory', label: 'Compulsory' },
        { value: 'elective', label: 'Elective' }
      ]
    }
  },
  computed: {
    totalPages() {
      return Math.max(1, Math.ceil(this.totalProgramCourses / this.perPage))
    },
    catalogTotalPages() {
      return Math.max(1, Math.ceil(this.totalCatalogItems / this.catalogPerPage))
    },
    catalogPreview() {
      return this.courseCatalog.slice(0, 5)
    },
    selectedProgramVariant() {
      return this.programs.find((program) => program.id === this.programCourseForm.programId) || null
    },
    assignmentLevelOptions() {
      const durationYears = Number(this.selectedProgramVariant?.durationYears || 0)

      if (!durationYears || durationYears < 1) {
        return []
      }

      return Array.from({ length: durationYears }, (_, index) => index + 1)
    },
    hasSelectedProgramVariant() {
      return Boolean(this.programCourseForm.programId)
    },
    assessmentWeightTotal() {
      return this.programCourseForm.assessmentComponents
        .filter((component) => component.active !== false)
        .reduce((total, component) => total + Number(component.weightPercent || 0), 0)
    },
    assessmentWeightRemaining() {
      return Number((100 - this.assessmentWeightTotal).toFixed(4))
    },
    hasValidAssessmentComponents() {
      const active = this.programCourseForm.assessmentComponents.filter((component) => component.active !== false)
      return active.length > 0 && this.assessmentWeightRemaining === 0 && active.every((component, index) => component.title?.trim() && Number(component.maximumMark) > 0 && Number(component.weightPercent) > 0 && component.displayOrder === index + 1)
    }
  },
  watch: {
    currentPage() {
      this.loadProgramCourses()
    },
    catalogCurrentPage() {
      if (this.showCatalogModal) {
        this.loadCourseCatalog()
      }
    },
    'programCourseFilters.search'() {
      this.debounceProgramCourseReload()
    },
    'programCourseFilters.programId'() {
      this.currentPage = 1
      this.loadProgramCourses()
    },
    'programCourseFilters.level'() {
      this.currentPage = 1
      this.loadProgramCourses()
    },
    'programCourseFilters.semester'() {
      this.currentPage = 1
      this.loadProgramCourses()
    },
    'programCourseFilters.category'() {
      this.currentPage = 1
      this.loadProgramCourses()
    },
    'programCourseForm.programId'(newProgramId) {
      if (!newProgramId) {
        this.programCourseForm.level = null
        this.programCourseForm.semester = null
        return
      }

      if (!this.assignmentLevelOptions.includes(this.programCourseForm.level)) {
        this.programCourseForm.level = null
      }

      if (!this.semesterOptions.some((semester) => semester.value === this.programCourseForm.semester)) {
        this.programCourseForm.semester = null
      }
    },
    catalogSearchQuery() {
      this.debounceCourseCatalogReload()
    }
  },
  async mounted() {
    await this.loadInitialData()
  },
  methods: {
    async loadInitialData() {
      try {
        this.isLoading = true
        await Promise.all([
          this.loadProgramCourses(),
          this.loadPrograms(),
          this.loadCourseOptions(),
          this.loadLecturers()
        ])
      } finally {
        this.isLoading = false
      }
    },

    debounceProgramCourseReload() {
      clearTimeout(this.programCourseSearchTimeout)
      this.programCourseSearchTimeout = setTimeout(() => {
        this.currentPage = 1
        this.loadProgramCourses()
      }, 300)
    },

    debounceCourseCatalogReload() {
      clearTimeout(this.catalogSearchTimeout)
      this.catalogSearchTimeout = setTimeout(() => {
        this.catalogCurrentPage = 1
        this.loadCourseCatalog()
      }, 300)
    },

    async loadProgramCourses() {
      try {
        this.isLoading = true
        const params = {
          page: this.currentPage,
          limit: this.perPage,
        }

        if (this.programCourseFilters.search.trim()) {
          params.search = this.programCourseFilters.search.trim()
        }
        if (this.programCourseFilters.programId) {
          params.programId = this.programCourseFilters.programId
        }
        if (this.programCourseFilters.level) {
          params.level = this.programCourseFilters.level
        }
        if (this.programCourseFilters.semester) {
          params.semester = this.programCourseFilters.semester
        }
        if (this.programCourseFilters.category) {
          params.category = this.programCourseFilters.category
        }

        const response = await apiService.getProgramCourses(params)
        if (!response.success) {
          throw new Error(response.message || 'Failed to load program courses')
        }

        this.programCourses = response.data || []
        this.totalProgramCourses = response.pagination?.total || 0
      } catch (error) {
        logger.error('Failed to load program courses:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Load Failed',
          text: error.message || 'Failed to load program courses',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        this.isLoading = false
      }
    },

    async loadCourseCatalog() {
      try {
        this.isCatalogLoading = true
        const params = {
          page: this.catalogCurrentPage,
          limit: this.catalogPerPage,
        }

        if (this.catalogSearchQuery.trim()) {
          params.search = this.catalogSearchQuery.trim()
        }

        const response = await apiService.getCourseCatalog(params)
        if (!response.success) {
          throw new Error(response.message || 'Failed to load course catalog')
        }

        this.courseCatalog = response.data || []
        this.totalCatalogItems = response.pagination?.total || 0
      } catch (error) {
        logger.error('Failed to load course catalog:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Load Failed',
          text: error.message || 'Failed to load course catalog',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        this.isCatalogLoading = false
      }
    },

    async loadCourseOptions() {
      try {
        const response = await apiService.getCourseCatalogOptions()
        if (response.success) {
          this.courseOptions = response.data || []
        }
      } catch (error) {
        logger.error('Failed to load course options:', error)
        this.courseOptions = []
      }
    },

    async loadPrograms() {
      try {
        const response = await apiService.getPrograms({ page: 1, limit: 500, active: true })
        if (response.success) {
          this.programs = response.data || []
        }
      } catch (error) {
        logger.error('Failed to load programs for course forms:', error)
        this.programs = []
      }
    },

    async loadLecturers() {
      try {
        const response = await apiService.getUsers({ page: 1, limit: 200, role: 'staff', status: 'active' })
        if (response.success) {
          this.lecturers = (response.data?.users || []).filter((user) => user.isActive !== false)
        }
      } catch (error) {
        logger.error('Failed to load lecturers:', error)
        this.lecturers = []
      }
    },

    getProgramLabel(program) {
      if (!program) return 'N/A'
      return `${program.name} · ${program.programType || 'Type N/A'} · ${program.programMode || 'Mode N/A'}`
    },

    getProgramMappingLabel(programCourse) {
      const program = programCourse.program
      if (!program) return 'N/A'
      return `${program.name} · ${program.programType?.type || 'Type N/A'} · ${program.programMode?.mode || 'Mode N/A'}`
    },

    getLecturerName(lecturer) {
      return [lecturer.firstName, lecturer.otherName, lecturer.lastName].filter(Boolean).join(' ')
    },

    getCategoryBadgeClass(category) {
      return category === 'compulsory'
        ? 'bg-danger-subtle text-danger-emphasis'
        : 'bg-primary-subtle text-primary-emphasis'
    },

    getStatusBadgeClass(active) {
      return active ? 'bg-success' : 'bg-secondary'
    },

    resetProgramCourseFilters() {
      this.programCourseFilters = {
        search: '',
        programId: '',
        level: '',
        semester: '',
        category: '',
      }
      this.currentPage = 1
      this.loadProgramCourses()
    },

    openProgramCourseModal(programCourse = null) {
      this.selectedProgramCourse = programCourse
      this.programCourseForm = programCourse
        ? {
          id: programCourse.id,
          courseId: programCourse.course?.id || '',
          programId: programCourse.program?.id || '',
          units: programCourse.units,
          hours: programCourse.hours,
          lecturerIds: (programCourse.lecturers || []).map((lecturer) => lecturer.id),
          level: programCourse.level,
          semester: programCourse.semester,
          category: programCourse.category,
          active: programCourse.active,
          assessmentComponents: (programCourse.assessmentComponents?.length ? programCourse.assessmentComponents : createDefaultAssessmentComponents()).map((component) => ({ ...component })),
        }
        : createEmptyProgramCourseForm()
      this.showProgramCourseModal = true
    },

    duplicateProgramCourse(programCourse) {
      this.selectedProgramCourse = null
      this.programCourseForm = {
        id: null,
        courseId: programCourse.course?.id || '',
        programId: '',
        units: programCourse.units,
        hours: programCourse.hours,
        lecturerIds: (programCourse.lecturers || []).map((lecturer) => lecturer.id),
        level: programCourse.level,
        semester: programCourse.semester,
        category: programCourse.category,
        active: programCourse.active,
        assessmentComponents: (programCourse.assessmentComponents?.length ? programCourse.assessmentComponents : createDefaultAssessmentComponents()).map((component) => ({ ...component })),
      }
      this.showProgramCourseModal = true
    },

    closeProgramCourseModal() {
      this.showProgramCourseModal = false
      this.selectedProgramCourse = null
      this.programCourseForm = createEmptyProgramCourseForm()
    },

    addAssessmentComponent() {
      if (this.assessmentWeightRemaining <= 0) return
      const order = this.programCourseForm.assessmentComponents.length + 1
      this.programCourseForm.assessmentComponents.push({ title: `Assessment ${order}`, maximumMark: null, weightPercent: null, componentType: 'assessment', displayOrder: order, description: '', assessmentDate: null, active: true, mandatory: true, absenceAllowed: false })
    },

    removeAssessmentComponent(index) {
      this.programCourseForm.assessmentComponents.splice(index, 1)
      this.programCourseForm.assessmentComponents.forEach((component, componentIndex) => { component.displayOrder = componentIndex + 1 })
    },

    moveAssessmentComponent(index, direction) {
      const target = index + direction
      if (target < 0 || target >= this.programCourseForm.assessmentComponents.length) return
      const component = this.programCourseForm.assessmentComponents.splice(index, 1)[0]
      this.programCourseForm.assessmentComponents.splice(target, 0, component)
      this.programCourseForm.assessmentComponents.forEach((item, itemIndex) => { item.displayOrder = itemIndex + 1 })
    },

    async saveProgramCourse() {
      try {
        if (!this.programCourseForm.courseId || !this.programCourseForm.programId) {
          throw new Error('Please select both course and program variant.')
        }

        if (this.programCourseForm.level === null || this.programCourseForm.level === undefined) {
          throw new Error('Please select a level.')
        }

        if (this.programCourseForm.semester === null || this.programCourseForm.semester === undefined) {
          throw new Error('Please select a semester.')
        }

        if (!this.hasValidAssessmentComponents) {
          throw new Error('Assessment components must have titles, positive maximum marks, and active weights totalling exactly 100%.')
        }

        this.isSavingProgramCourse = true
        const { id, ...programCoursePayload } = this.programCourseForm
        const payload = {
          ...programCoursePayload,
          units: Number(programCoursePayload.units),
          hours: Number(programCoursePayload.hours),
          level: Number(programCoursePayload.level),
          semester: Number(programCoursePayload.semester),
        }

        if (this.selectedProgramCourse?.id) {
          await apiService.updateProgramCourse(this.selectedProgramCourse.id, payload)
        } else {
          await apiService.createProgramCourse(payload)
        }

        this.closeProgramCourseModal()
        await Promise.all([
          this.loadProgramCourses(),
          this.loadCourseOptions()
        ])
        this.$emit('refresh')
      } catch (error) {
        logger.error('Failed to save program course:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: error.message || 'Failed to save program course',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        this.isSavingProgramCourse = false
      }
    },

    async confirmDeleteProgramCourse(programCourse) {
      const result = await this.$swal.fire({
        icon: 'warning',
        title: 'Delete Program Course',
        text: `Remove ${programCourse.course?.code || 'this course'} from ${this.getProgramMappingLabel(programCourse)}?`,
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Delete'
      })

      if (!result.isConfirmed) {
        return
      }

      try {
        await apiService.deleteProgramCourse(programCourse.id)
        await this.loadProgramCourses()
      } catch (error) {
        logger.error('Failed to delete program course:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Delete Failed',
          text: error.message || 'Failed to delete program course',
          confirmButtonColor: '#1a5f5f'
        })
      }
    },

    async openCatalogModal() {
      this.showCatalogModal = true
      this.catalogCurrentPage = 1
      await this.loadCourseCatalog()
    },

    closeCatalogModal() {
      this.showCatalogModal = false
      this.catalogSearchQuery = ''
      this.catalogCurrentPage = 1
    },

    openCourseFormModal(course = null) {
      this.courseForm = course
        ? {
          id: course.id,
          code: course.code,
          title: course.title,
          description: course.description || '',
          active: course.active,
        }
        : createEmptyCourseForm()
      this.showCourseFormModal = true
    },

    closeCourseFormModal() {
      this.showCourseFormModal = false
      this.courseForm = createEmptyCourseForm()
    },

    async saveCourse() {
      try {
        this.isSavingCourse = true
        const { id, ...courseFormPayload } = this.courseForm
        const payload = {
          ...courseFormPayload,
          code: courseFormPayload.code.trim().toUpperCase(),
          title: courseFormPayload.title.trim(),
          description: courseFormPayload.description.trim(),
        }

        if (id) {
          await apiService.updateCourse(id, payload)
        } else {
          await apiService.createCourse(payload)
        }

        this.closeCourseFormModal()
        await Promise.all([
          this.loadCourseCatalog(),
          this.loadCourseOptions()
        ])
      } catch (error) {
        logger.error('Failed to save course:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: error.message || 'Failed to save course',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        this.isSavingCourse = false
      }
    },

    async confirmDeleteCourse(course) {
      const result = await this.$swal.fire({
        icon: 'warning',
        title: 'Delete Course',
        text: `Delete ${course.code} - ${course.title}?`,
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Delete'
      })

      if (!result.isConfirmed) {
        return
      }

      try {
        await apiService.deleteCourse(course.id)
        await Promise.all([
          this.loadCourseCatalog(),
          this.loadCourseOptions()
        ])
      } catch (error) {
        logger.error('Failed to delete course:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Delete Failed',
          text: error.message || 'Failed to delete course',
          confirmButtonColor: '#1a5f5f'
        })
      }
    }
  }
}
</script>

<template>
  <div>
    <div class="row mb-4">
      <div class="col-12">
        <div class="card border-0 shadow-sm p-0">
          <div class="card-body">
            <div class="row g-3 align-items-end">
              <div class="col-md-4">
                <label class="form-label">Search Program Courses</label>
                <input
                  v-model="programCourseFilters.search"
                  type="text"
                  class="form-control"
                  placeholder="Search by code, title, or program..."
                />
              </div>
              <div class="col-md-3">
                <label class="form-label">Program</label>
                <select v-model="programCourseFilters.programId" class="form-select">
                  <option value="">All Programs</option>
                  <option v-for="program in programs" :key="program.id" :value="program.id">
                    {{ getProgramLabel(program) }}
                  </option>
                </select>
              </div>
              <div class="col-md-2">
                <label class="form-label">Level</label>
                <select v-model="programCourseFilters.level" class="form-select">
                  <option value="">All Levels</option>
                  <option v-for="level in levelOptions" :key="level" :value="level">
                    Level {{ level }}
                  </option>
                </select>
              </div>
              <div class="col-md-3 d-flex gap-2">
                <button class="btn btn-outline-staff-primary flex-grow-1" @click="resetProgramCourseFilters">
                  <i class="bi bi-arrow-counterclockwise me-2"></i>Reset
                </button>
                <button class="btn btn-outline-staff-primary flex-grow-1" @click="openCatalogModal">
                  <i class="bi bi-journal-bookmark me-2"></i>Catalog
                </button>
                <button class="btn btn-staff-primary flex-grow-1" @click="openProgramCourseModal()">
                  <i class="bi bi-plus-circle me-2"></i>Assign Course
                </button>
              </div>
            </div>

            <div class="row g-3 mt-1">
              <div class="col-md-3">
                <label class="form-label">Semester</label>
                <select v-model="programCourseFilters.semester" class="form-select">
                  <option value="">All Semesters</option>
                  <option v-for="semester in semesterOptions" :key="semester.value" :value="semester.value">
                    {{ semester.label }}
                  </option>
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label">Category</label>
                <select v-model="programCourseFilters.category" class="form-select">
                  <option value="">All Categories</option>
                  <option v-for="category in categoryOptions" :key="category.value" :value="category.value">
                    {{ category.label }}
                  </option>
                </select>
              </div>
              <div class="col-md-6">
                <div class="catalog-preview-panel h-100">
                  <div>
                    <small class="text-muted text-uppercase fw-semibold">Catalog Preview</small>
                    <div class="d-flex flex-wrap gap-2 mt-2">
                      <span v-for="course in catalogPreview" :key="course.id" class="badge bg-light text-dark border">
                        {{ course.code }}
                      </span>
                    </div>
                  </div>
                  <small class="text-muted">Manage shared course definitions from the catalog.</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-staff-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-3 text-muted">Loading course assignments...</p>
    </div>

    <div v-else class="row">
      <div class="col-12">
        <div class="card border-0 shadow-sm p-0">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0 align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Course</th>
                    <th>Program</th>
                    <th>Curriculum</th>
                    <th>Lecturers</th>
                    <th class="text-center">Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="programCourses.length === 0">
                    <td colspan="6" class="text-center py-5">
                      <div class="text-muted">
                        <i class="bi bi-journal-x fs-1 mb-3 d-block"></i>
                        <h5 class="mb-2">No Program Courses Found</h5>
                        <p class="mb-0">Assign courses to programs to build your curriculum.</p>
                      </div>
                    </td>
                  </tr>

                  <tr v-for="programCourse in programCourses" :key="programCourse.id">
                    <td>
                      <div class="fw-semibold">{{ programCourse.course?.code }}</div>
                      <div>{{ programCourse.course?.title }}</div>
                      <small class="text-muted">{{ programCourse.course?.description || 'No description' }}</small>
                    </td>
                    <td>
                      <div class="fw-medium">{{ programCourse.program?.name }}</div>
                      <small class="text-muted">
                        {{ programCourse.program?.department?.name || 'Department N/A' }} ·
                        {{ programCourse.program?.programType?.type || 'Type N/A' }} ·
                        {{ programCourse.program?.programMode?.mode || 'Mode N/A' }}
                      </small>
                    </td>
                    <td>
                      <div class="d-flex flex-column gap-1">
                        <span class="badge bg-light text-dark curriculum-chip">Level {{ programCourse.level }}</span>
                        <span class="badge bg-light text-dark curriculum-chip">Semester {{ programCourse.semester }}</span>
                        <span class="badge" :class="getCategoryBadgeClass(programCourse.category)">
                          {{ programCourse.category.toUpperCase() }}
                        </span>
                        <small class="text-muted">{{ programCourse.units }} unit(s) · {{ programCourse.hours }} hour(s)</small>
                      </div>
                    </td>
                    <td>
                      <div class="d-flex flex-column gap-1">
                        <span v-for="lecturer in programCourse.lecturers" :key="lecturer.id" class="small text-muted">
                          {{ getLecturerName(lecturer) }}
                        </span>
                        <span v-if="!programCourse.lecturers?.length" class="text-muted small">Not assigned</span>
                      </div>
                    </td>
                    <td class="text-center">
                      <span class="badge rounded-pill" :class="getStatusBadgeClass(programCourse.active)">
                        {{ programCourse.active ? 'ACTIVE' : 'INACTIVE' }}
                      </span>
                    </td>
                    <td>
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-success" @click="openProgramCourseModal(programCourse)">
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-staff-primary" @click="duplicateProgramCourse(programCourse)">
                          <i class="bi bi-copy"></i>
                        </button>
                        <button class="btn btn-outline-danger" @click="confirmDeleteProgramCourse(programCourse)">
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card-footer border-top-0 bg-transparent" v-if="totalPages > 1">
            <nav>
              <ul class="pagination pagination-sm mb-0 justify-content-center">
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <button class="page-link" :disabled="currentPage === 1" @click="currentPage -= 1">Previous</button>
                </li>
                <li v-for="page in totalPages" :key="page" class="page-item" :class="{ active: currentPage === page }">
                  <button class="page-link" @click="currentPage = page">{{ page }}</button>
                </li>
                <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                  <button class="page-link" :disabled="currentPage === totalPages" @click="currentPage += 1">Next</button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" :class="{ show: showProgramCourseModal }" :style="{ display: showProgramCourseModal ? 'block' : 'none' }" tabindex="-1">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content border-0 course-modal">
          <div class="modal-header border-0 pb-0">
            <div>
              <h5 class="modal-title fw-bold text-staff-primary">
                {{ selectedProgramCourse ? 'Edit Program Course' : 'Assign Course to Program' }}
              </h5>
              <p class="text-muted mb-0">Define units, hours, lecturers, and curriculum placement for this program course.</p>
            </div>
            <button type="button" class="btn-close" @click="closeProgramCourseModal"></button>
          </div>
          <div class="modal-body px-4 pb-4">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Course</label>
                <select v-model="programCourseForm.courseId" class="form-select">
                  <option value="" disabled>Select course</option>
                  <option v-for="course in courseOptions" :key="course.id" :value="course.id">
                    {{ course.code }} - {{ course.title }}
                  </option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Program Variant</label>
                <select v-model="programCourseForm.programId" class="form-select">
                  <option value="" disabled>Select program</option>
                  <option v-for="program in programs" :key="program.id" :value="program.id">
                    {{ getProgramLabel(program) }}
                  </option>
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label">Units</label>
                <input v-model.number="programCourseForm.units" type="number" min="1" class="form-control" />
              </div>
              <div class="col-md-3">
                <label class="form-label">Hours</label>
                <input v-model.number="programCourseForm.hours" type="number" min="1" class="form-control" />
              </div>
              <div class="col-md-3">
                <label class="form-label">Level</label>
                <select v-model.number="programCourseForm.level" class="form-select" :disabled="!hasSelectedProgramVariant">
                  <option v-if="!hasSelectedProgramVariant" value="">Select program variant first</option>
                  <option v-else :value="null" disabled>Select level</option>
                  <option v-for="level in assignmentLevelOptions" :key="level" :value="level">Level {{ level }}</option>
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label">Semester</label>
                <select v-model.number="programCourseForm.semester" class="form-select" :disabled="!hasSelectedProgramVariant">
                  <option v-if="!hasSelectedProgramVariant" value="">Select program variant first</option>
                  <option v-else :value="null" disabled>Select semester</option>
                  <option v-for="semester in semesterOptions" :key="semester.value" :value="semester.value">{{ semester.label }}</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Category</label>
                <select v-model="programCourseForm.category" class="form-select">
                  <option v-for="category in categoryOptions" :key="category.value" :value="category.value">{{ category.label }}</option>
                </select>
              </div>
              <div class="col-md-6 d-flex align-items-end">
                <div class="form-check course-toggle-card w-100">
                  <input v-model="programCourseForm.active" class="form-check-input" type="checkbox" id="programCourseActive" />
                  <label class="form-check-label fw-semibold" for="programCourseActive">Active program course</label>
                  <div class="small text-muted">Inactive mappings stay in history but won’t be treated as live curriculum.</div>
                </div>
              </div>
              <div class="col-12">
                <label class="form-label">Lecturers</label>
                <select v-model="programCourseForm.lecturerIds" class="form-select" multiple size="5">
                  <option v-for="lecturer in lecturers" :key="lecturer._id" :value="lecturer._id">
                    {{ getLecturerName(lecturer) }} · {{ lecturer.email }}
                  </option>
                </select>
                <small class="text-muted">Hold Command to select multiple lecturers.</small>
              </div>
              <div class="col-12">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                  <div><label class="form-label mb-0">Assessment Components</label><div class="small text-muted">These columns will be used for score entry. Active weights must total exactly 100%.</div></div>
                  <div class="d-flex align-items-center gap-2"><span class="badge" :class="hasValidAssessmentComponents ? 'text-bg-success' : 'text-bg-warning'">{{ assessmentWeightTotal.toFixed(2) }}% total · {{ assessmentWeightRemaining.toFixed(2) }}% remaining</span><button class="btn btn-sm btn-outline-primary" :disabled="assessmentWeightRemaining <= 0" @click="addAssessmentComponent"><i class="bi bi-plus-lg me-1"></i>Add component</button></div>
                </div>
                <div class="table-responsive border rounded"><table class="table table-sm align-middle mb-0"><thead class="table-light"><tr><th>Order</th><th>Title</th><th>Type</th><th>Maximum Mark</th><th>Weight %</th><th>Mandatory</th><th>Absence</th><th></th></tr></thead><tbody><tr v-for="(component, index) in programCourseForm.assessmentComponents" :key="component.displayOrder"><td>{{ component.displayOrder }}</td><td><input v-model.trim="component.title" class="form-control form-control-sm" :placeholder="`Assessment ${index + 1}`"></td><td><select v-model="component.componentType" class="form-select form-select-sm"><option value="assessment">Assessment</option><option value="quiz">Quiz</option><option value="assignment">Assignment</option><option value="practical">Practical</option><option value="test">Test</option><option value="attendance">Attendance</option><option value="project">Project</option><option value="examination">Examination</option></select></td><td><input v-model.number="component.maximumMark" class="form-control form-control-sm" type="number" min="0.01" step="0.01"></td><td><input v-model.number="component.weightPercent" class="form-control form-control-sm" type="number" min="0.01" max="100" step="0.01"></td><td class="text-center"><input v-model="component.mandatory" class="form-check-input" type="checkbox"></td><td class="text-center"><input v-model="component.absenceAllowed" class="form-check-input" type="checkbox"></td><td class="text-nowrap"><button class="btn btn-sm btn-outline-secondary me-1" :disabled="index === 0" title="Move up" @click="moveAssessmentComponent(index, -1)"><i class="bi bi-arrow-up"></i></button><button class="btn btn-sm btn-outline-secondary me-1" :disabled="index === programCourseForm.assessmentComponents.length - 1" title="Move down" @click="moveAssessmentComponent(index, 1)"><i class="bi bi-arrow-down"></i></button><button class="btn btn-sm btn-outline-danger" title="Remove" @click="removeAssessmentComponent(index)"><i class="bi bi-trash"></i></button></td></tr></tbody></table></div>
              </div>
            </div>
          </div>
          <div class="modal-footer border-0 pt-0">
            <button type="button" class="btn btn-outline-secondary" @click="closeProgramCourseModal">Cancel</button>
            <button type="button" class="btn btn-staff-primary" @click="saveProgramCourse" :disabled="isSavingProgramCourse || !hasValidAssessmentComponents">
              <span v-if="isSavingProgramCourse" class="spinner-border spinner-border-sm me-2"></span>
              {{ isSavingProgramCourse ? 'Saving...' : (selectedProgramCourse ? 'Update Mapping' : 'Assign Course') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" :class="{ show: showCatalogModal }" :style="{ display: showCatalogModal ? 'block' : 'none' }" tabindex="-1">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content border-0 course-modal">
          <div class="modal-header border-0 pb-0">
            <div>
              <h5 class="modal-title fw-bold text-staff-primary">Course Catalog</h5>
              <p class="text-muted mb-0">Manage the shared course definitions reused across program variants.</p>
            </div>
            <button type="button" class="btn-close" @click="closeCatalogModal"></button>
          </div>
          <div class="modal-body px-4 pb-4">
            <div class="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
              <input v-model="catalogSearchQuery" type="text" class="form-control catalog-search" placeholder="Search catalog by code or title..." />
              <button class="btn btn-staff-primary" @click="openCourseFormModal()">
                <i class="bi bi-plus-circle me-2"></i>Add Course
              </button>
            </div>

            <div v-if="isCatalogLoading" class="text-center py-5">
              <div class="spinner-border text-staff-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="mt-3 text-muted mb-0">Loading course catalog...</p>
            </div>

            <div v-else class="table-responsive">
              <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Code</th>
                    <th>Title</th>
                    <th>Description</th>
                    <th class="text-center">Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="courseCatalog.length === 0">
                    <td colspan="5" class="text-center py-5 text-muted">
                      No courses found in the catalog.
                    </td>
                  </tr>
                  <tr v-for="course in courseCatalog" :key="course.id">
                    <td><code class="text-staff-primary">{{ course.code }}</code></td>
                    <td class="fw-medium">{{ course.title }}</td>
                    <td>{{ course.description || '—' }}</td>
                    <td class="text-center">
                      <span class="badge rounded-pill" :class="getStatusBadgeClass(course.active)">
                        {{ course.active ? 'ACTIVE' : 'INACTIVE' }}
                      </span>
                    </td>
                    <td>
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-success" @click="openCourseFormModal(course)">
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger" @click="confirmDeleteCourse(course)">
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="d-flex justify-content-center mt-3" v-if="catalogTotalPages > 1">
              <ul class="pagination pagination-sm mb-0">
                <li class="page-item" :class="{ disabled: catalogCurrentPage === 1 }">
                  <button class="page-link" :disabled="catalogCurrentPage === 1" @click="catalogCurrentPage -= 1">Previous</button>
                </li>
                <li v-for="page in catalogTotalPages" :key="page" class="page-item" :class="{ active: catalogCurrentPage === page }">
                  <button class="page-link" @click="catalogCurrentPage = page">{{ page }}</button>
                </li>
                <li class="page-item" :class="{ disabled: catalogCurrentPage === catalogTotalPages }">
                  <button class="page-link" :disabled="catalogCurrentPage === catalogTotalPages" @click="catalogCurrentPage += 1">Next</button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      :class="{ show: showCourseFormModal, 'stacked-course-modal': showCatalogModal && showCourseFormModal }"
      :style="{ display: showCourseFormModal ? 'block' : 'none' }"
      tabindex="-1"
    >
      <div class="modal-dialog modal-lg">
        <div class="modal-content border-0 course-modal">
          <div class="modal-header border-0 pb-0">
            <div>
              <h5 class="modal-title fw-bold text-staff-primary">{{ courseForm.id ? 'Edit Course' : 'Add Course' }}</h5>
              <p class="text-muted mb-0">Shared course details live here and can be reused across multiple program variants.</p>
            </div>
            <button type="button" class="btn-close" @click="closeCourseFormModal"></button>
          </div>
          <div class="modal-body px-4 pb-4">
            <div class="row g-3">
              <div class="col-md-4">
                <label class="form-label">Course Code</label>
                <input v-model="courseForm.code" type="text" class="form-control text-uppercase" placeholder="e.g. NUR101" />
              </div>
              <div class="col-md-8">
                <label class="form-label">Course Title</label>
                <input v-model="courseForm.title" type="text" class="form-control" placeholder="Enter course title" />
              </div>
              <div class="col-12">
                <label class="form-label">Description</label>
                <textarea v-model="courseForm.description" class="form-control" rows="4" placeholder="Brief description of the course"></textarea>
              </div>
              <div class="col-12">
                <div class="form-check course-toggle-card">
                  <input v-model="courseForm.active" class="form-check-input" type="checkbox" id="courseCatalogActive" />
                  <label class="form-check-label fw-semibold" for="courseCatalogActive">Active catalog course</label>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer border-0 pt-0">
            <button type="button" class="btn btn-outline-secondary" @click="closeCourseFormModal">Cancel</button>
            <button type="button" class="btn btn-staff-primary" @click="saveCourse" :disabled="isSavingCourse">
              <span v-if="isSavingCourse" class="spinner-border spinner-border-sm me-2"></span>
              {{ isSavingCourse ? 'Saving...' : (courseForm.id ? 'Update Course' : 'Create Course') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal-backdrop fade"
      :class="{ show: showProgramCourseModal || showCatalogModal || showCourseFormModal }"
      v-if="showProgramCourseModal || showCatalogModal || showCourseFormModal"
    ></div>
    <div
      v-if="showCatalogModal && showCourseFormModal"
      class="modal-backdrop fade show stacked-course-backdrop"
    ></div>
  </div>
</template>

<style scoped>
.table th {
  font-weight: 600;
  color: var(--staff-primary);
  border-bottom: 2px solid var(--staff-light);
}

.table td {
  vertical-align: middle;
}

.pagination .page-link {
  color: var(--staff-primary);
  border-color: var(--staff-light);
}

.pagination .page-item.active .page-link {
  background-color: var(--staff-primary);
  border-color: var(--staff-primary);
  color: white;
}

.course-modal {
  border-radius: 18px;
}

.stacked-course-modal {
  z-index: 1057;
}

.stacked-course-backdrop {
  z-index: 1056;
}

.catalog-preview-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(26, 95, 95, 0.12);
  border-radius: 14px;
  background: rgba(26, 95, 95, 0.04);
}

.curriculum-chip {
  width: fit-content;
}

.catalog-search {
  max-width: 420px;
}

.course-toggle-card {
  padding: 1rem;
  border-radius: 14px;
  background: rgba(248, 249, 250, 0.8);
}

code {
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: var(--staff-light);
}

@media (max-width: 767.98px) {
  .catalog-preview-panel {
    flex-direction: column;
    align-items: flex-start;
  }

  .catalog-search {
    max-width: 100%;
  }
}
</style>
