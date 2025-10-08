<template>
  <div>
    <!-- Search and Add Button -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body">
            <div class="row g-3 align-items-end">
              <div class="col-md-6">
                <label class="form-label">Search Programs</label>
                <input
                  v-model="searchQuery"
                  type="text"
                  class="form-control"
                  placeholder="Search by program code, name, or department..."
                >
              </div>
              <div class="col-md-3">
                <button
                  class="btn btn-staff-primary w-100"
                  @click="showAddProgramModal"
                >
                  <i class="bi bi-plus-circle me-2"></i>Add New Program
                </button>
              </div>
              <div class="col-md-3">
                <div class="btn-group w-100">
                  <button
                    class="btn btn-outline-staff-primary"
                    @click="manageProgramTypes"
                  >
                    <i class="bi bi-tags me-1"></i>Types
                  </button>
                  <button
                    class="btn btn-outline-staff-primary"
                    @click="manageProgramModes"
                  >
                    <i class="bi bi-gear me-1"></i>Modes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-staff-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-3 text-muted">Loading programs...</p>
    </div>

    <!-- Programs Table -->
    <div v-else class="row">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Program Offerings</th>
                    <th>Duration</th>
                    <th class="text-center">Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="paginatedPrograms.length === 0">
                    <td colspan="7" class="text-center py-5">
                      <div class="text-muted">
                        <i class="bi bi-book-x fs-1 mb-3 d-block"></i>
                        <h5 class="mb-2">No Programs Found</h5>
                        <p class="mb-0" v-if="searchQuery">
                          No programs match your search criteria.
                        </p>
                        <p class="mb-0" v-else>
                          No programs have been created yet.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <tr v-for="program in paginatedPrograms" :key="program.id">
                    <td>
                      <code class="text-staff-primary">{{ program.code }}</code>
                    </td>
                    <td>
                      <div class="fw-medium">{{ program.name }}</div>
                      <small class="text-muted">{{ program.shortName }}</small>
                    </td>
                    <td>
                      <span class="badge bg-secondary">{{ program.department }}</span>
                    </td>
                    <td>
                      <div class="d-flex flex-wrap gap-1">
                        <span
                          v-for="offering in program.offerings"
                          :key="offering"
                          class="badge bg-info text-white small"
                        >
                          {{ offering }}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span class="text-muted">{{ program.duration }}</span>
                    </td>
                    <td class="text-center">
                      <span
                        class="badge rounded-pill"
                        :class="program.isActive ? 'bg-success' : 'bg-secondary'"
                      >
                        {{ program.isActive ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                    <td>
                      <div class="btn-group btn-group-sm">
                        <button
                          class="btn btn-outline-success btn-sm"
                          @click="editProgram(program)"
                          title="Edit Program"
                        >
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button
                          class="btn btn-outline-danger btn-sm"
                          @click="deleteProgram(program)"
                          title="Delete Program"
                        >
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Pagination -->
          <div class="card-footer border-top-0 bg-transparent">
            <nav>
              <ul class="pagination pagination-sm mb-0 justify-content-center">
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <button
                    class="page-link"
                    @click="currentPage = currentPage - 1"
                    :disabled="currentPage === 1"
                  >
                    Previous
                  </button>
                </li>
                <li
                  class="page-item"
                  :class="{ active: currentPage === page }"
                  v-for="page in totalPages"
                  :key="page"
                >
                  <button class="page-link" @click="currentPage = page">
                    {{ page }}
                  </button>
                </li>
                <li
                  class="page-item"
                  :class="{ disabled: currentPage === totalPages }"
                >
                  <button
                    class="page-link"
                    @click="currentPage = currentPage + 1"
                    :disabled="currentPage === totalPages"
                  >
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { apiService } from '../../../services/api.js'
import { logger } from '@shared/utils/logger'

export default {
  name: 'Programs',
  data() {
    return {
      programs: [],
      departments: [],
      programTypes: [],
      programModes: [],
      isLoading: true,
      searchQuery: '',
      currentPage: 1,
      perPage: 10
    }
  },
  computed: {
    filteredPrograms() {
      if (!this.searchQuery) return this.programs

      return this.programs.filter(program =>
        program.code.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        program.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        program.department.toLowerCase().includes(this.searchQuery.toLowerCase())
      )
    },

    paginatedPrograms() {
      const start = (this.currentPage - 1) * this.perPage
      const end = start + this.perPage
      return this.filteredPrograms.slice(start, end)
    },

    totalPages() {
      return Math.ceil(this.filteredPrograms.length / this.perPage)
    }
  },
  watch: {
    searchQuery() {
      this.currentPage = 1
    }
  },
  async mounted() {
    await this.loadData()
  },
  methods: {
    async loadData() {
      await Promise.all([
        this.loadPrograms(),
        this.loadDepartments(),
        this.loadProgramTypes(),
        this.loadProgramModes()
      ])
    },

    async loadPrograms() {
      try {
        this.isLoading = true
        logger.info('Loading programs...')

        // Mock data for now - replace with actual API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        this.programs = [
          {
            id: '1',
            code: 'BSN',
            name: 'Bachelor of Science in Nursing',
            shortName: 'B.Sc Nursing',
            department: 'Nursing Sciences',
            departmentId: '1',
            offerings: ['Full-time', 'Direct Entry'],
            duration: '4 years',
            isActive: true
          },
          {
            id: '2',
            code: 'RNM',
            name: 'Registered Nurse Midwifery',
            shortName: 'RN/RM',
            department: 'Midwifery',
            departmentId: '2',
            offerings: ['Full-time', 'Part-time'],
            duration: '3 years',
            isActive: true
          },
          {
            id: '3',
            code: 'CHEW',
            name: 'Community Health Extension Worker',
            shortName: 'CHEW',
            department: 'Public Health',
            departmentId: '3',
            offerings: ['Full-time'],
            duration: '2 years',
            isActive: true
          }
        ]

        logger.info('Programs loaded successfully', { count: this.programs.length })
      } catch (error) {
        logger.error('Failed to load programs:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to load programs',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        this.isLoading = false
      }
    },

    async loadDepartments() {
      try {
        this.departments = [
          { id: '1', name: 'Nursing Sciences', code: 'NURS' },
          { id: '2', name: 'Midwifery', code: 'MIDW' },
          { id: '3', name: 'Public Health', code: 'PUBH' },
          { id: '4', name: 'Physiotherapy', code: 'PHTH' }
        ]
      } catch (error) {
        logger.error('Failed to load departments:', error)
      }
    },

    async loadProgramTypes() {
      try {
        this.programTypes = [
          { id: '1', type: 'Direct Entry', description: 'For O-Level graduates', isActive: true },
          { id: '2', type: 'Post-Basic', description: 'For RN certificate holders', isActive: true },
          { id: '3', type: 'Advanced Diploma', description: 'Advanced certification program', isActive: false }
        ]
      } catch (error) {
        logger.error('Failed to load program types:', error)
      }
    },

    async loadProgramModes() {
      try {
        this.programModes = [
          { id: '1', mode: 'Full-time', description: 'Regular full-time study', isActive: true },
          { id: '2', mode: 'Part-time', description: 'Evening and weekend classes', isActive: true },
          { id: '3', mode: 'Distance Learning', description: 'Online and remote study', isActive: false }
        ]
      } catch (error) {
        logger.error('Failed to load program modes:', error)
      }
    },

    async showAddProgramModal() {
      const departmentOptions = this.departments.map(dept => 
        `<option value="${dept.id}">${dept.name}</option>`
      ).join('')

      const typeOptions = this.programTypes.filter(type => type.isActive).map(type => 
        `<option value="${type.type}">${type.type}</option>`
      ).join('')

      const modeOptions = this.programModes.filter(mode => mode.isActive).map(mode => 
        `<option value="${mode.mode}">${mode.mode}</option>`
      ).join('')

      const { value: formValues } = await this.$swal.fire({
        title: 'Add New Program',
        html: `
          <div class="row g-3">
            <div class="col-6">
              <label class="form-label text-start d-block">Program Code</label>
              <input id="programCode" class="swal2-input" placeholder="e.g., BSN" maxlength="10">
            </div>
            <div class="col-6">
              <label class="form-label text-start d-block">Short Name</label>
              <input id="shortName" class="swal2-input" placeholder="e.g., B.Sc Nursing">
            </div>
            <div class="col-12">
              <label class="form-label text-start d-block">Program Name</label>
              <input id="programName" class="swal2-input" placeholder="e.g., Bachelor of Science in Nursing">
            </div>
            <div class="col-12">
              <label class="form-label text-start d-block">Department</label>
              <select id="department" class="swal2-select">
                <option value="">Select Department</option>
                ${departmentOptions}
              </select>
            </div>
            <div class="col-6">
              <label class="form-label text-start d-block">Program Types</label>
              <select id="programTypes" class="swal2-select" multiple>
                ${typeOptions}
              </select>
            </div>
            <div class="col-6">
              <label class="form-label text-start d-block">Program Modes</label>
              <select id="programModes" class="swal2-select" multiple>
                ${modeOptions}
              </select>
            </div>
            <div class="col-12">
              <label class="form-label text-start d-block">Duration</label>
              <input id="duration" class="swal2-input" placeholder="e.g., 4 years">
            </div>
            <div class="col-12">
              <label class="form-label text-start d-block">Description</label>
              <textarea id="description" class="swal2-textarea" placeholder="Program description..."></textarea>
            </div>
            <div class="col-12">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="isActive" checked>
                <label class="form-check-label" for="isActive">Active Program</label>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Add Program',
        confirmButtonColor: '#1a5f5f',
        width: '700px',
        preConfirm: () => {
          const programCode = document.getElementById('programCode').value
          const programName = document.getElementById('programName').value
          const shortName = document.getElementById('shortName').value
          const department = document.getElementById('department').value
          const programTypes = Array.from(document.getElementById('programTypes').selectedOptions).map(opt => opt.value)
          const programModes = Array.from(document.getElementById('programModes').selectedOptions).map(opt => opt.value)
          const duration = document.getElementById('duration').value
          const description = document.getElementById('description').value
          const isActive = document.getElementById('isActive').checked

          if (!programCode || !programName || !department) {
            this.$swal.showValidationMessage('Please fill in all required fields')
            return false
          }

          if (programTypes.length === 0 || programModes.length === 0) {
            this.$swal.showValidationMessage('Please select at least one type and one mode')
            return false
          }

          return {
            programCode: programCode.toUpperCase(),
            programName,
            shortName,
            department,
            programTypes,
            programModes,
            duration,
            description,
            isActive
          }
        }
      })

      if (formValues) {
        await this.addProgram(formValues)
      }
    },

    async addProgram(programData) {
      try {
        logger.info('Adding new program:', programData)

        const department = this.departments.find(d => d.id === programData.department)
        const offerings = [...programData.programTypes, ...programData.programModes]

        const newProgram = {
          id: Date.now().toString(),
          code: programData.programCode,
          name: programData.programName,
          shortName: programData.shortName,
          department: department.name,
          departmentId: programData.department,
          offerings: offerings,
          duration: programData.duration,
          description: programData.description,
          isActive: programData.isActive
        }

        this.programs.unshift(newProgram)

        this.$swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Program added successfully',
          timer: 2000,
          showConfirmButton: false
        })

        this.$emit('refresh')
      } catch (error) {
        logger.error('Failed to add program:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to add program',
          confirmButtonColor: '#1a5f5f'
        })
      }
    },

    async editProgram(program) {
      // Similar to add but with pre-filled values
      const departmentOptions = this.departments.map(dept => 
        `<option value="${dept.id}" ${dept.id === program.departmentId ? 'selected' : ''}>${dept.name}</option>`
      ).join('')

      const { value: formValues } = await this.$swal.fire({
        title: 'Edit Program',
        html: `
          <div class="row g-3">
            <div class="col-6">
              <label class="form-label text-start d-block">Program Code</label>
              <input id="programCode" class="swal2-input" value="${program.code}" maxlength="10">
            </div>
            <div class="col-6">
              <label class="form-label text-start d-block">Short Name</label>
              <input id="shortName" class="swal2-input" value="${program.shortName || ''}">
            </div>
            <div class="col-12">
              <label class="form-label text-start d-block">Program Name</label>
              <input id="programName" class="swal2-input" value="${program.name}">
            </div>
            <div class="col-12">
              <label class="form-label text-start d-block">Department</label>
              <select id="department" class="swal2-select">
                ${departmentOptions}
              </select>
            </div>
            <div class="col-12">
              <label class="form-label text-start d-block">Duration</label>
              <input id="duration" class="swal2-input" value="${program.duration || ''}">
            </div>
            <div class="col-12">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="isActive" ${program.isActive ? 'checked' : ''}>
                <label class="form-check-label" for="isActive">Active Program</label>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Update Program',
        confirmButtonColor: '#1a5f5f',
        width: '700px',
        preConfirm: () => {
          const programCode = document.getElementById('programCode').value
          const programName = document.getElementById('programName').value
          const shortName = document.getElementById('shortName').value
          const department = document.getElementById('department').value
          const duration = document.getElementById('duration').value
          const isActive = document.getElementById('isActive').checked

          if (!programCode || !programName || !department) {
            this.$swal.showValidationMessage('Please fill in all required fields')
            return false
          }

          return {
            programCode: programCode.toUpperCase(),
            programName,
            shortName,
            department,
            duration,
            isActive
          }
        }
      })

      if (formValues) {
        await this.updateProgram(program.id, formValues)
      }
    },

    async updateProgram(programId, programData) {
      try {
        logger.info('Updating program:', { programId, programData })

        const department = this.departments.find(d => d.id === programData.department)
        const programIndex = this.programs.findIndex(p => p.id === programId)
        
        if (programIndex !== -1) {
          this.programs[programIndex] = {
            ...this.programs[programIndex],
            code: programData.programCode,
            name: programData.programName,
            shortName: programData.shortName,
            department: department.name,
            departmentId: programData.department,
            duration: programData.duration,
            isActive: programData.isActive
          }
        }

        this.$swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Program updated successfully',
          timer: 2000,
          showConfirmButton: false
        })

        this.$emit('refresh')
      } catch (error) {
        logger.error('Failed to update program:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to update program',
          confirmButtonColor: '#1a5f5f'
        })
      }
    },

    async deleteProgram(program) {
      const result = await this.$swal.fire({
        title: 'Delete Program',
        text: `Are you sure you want to delete "${program.name}"? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it!'
      })

      if (result.isConfirmed) {
        try {
          logger.info('Deleting program:', program.id)
          this.programs = this.programs.filter(p => p.id !== program.id)

          this.$swal.fire({
            icon: 'success',
            title: 'Deleted!',
            text: 'Program has been deleted.',
            timer: 2000,
            showConfirmButton: false
          })

          this.$emit('refresh')
        } catch (error) {
          logger.error('Failed to delete program:', error)
          this.$swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to delete program',
            confirmButtonColor: '#1a5f5f'
          })
        }
      }
    },

    async manageProgramTypes() {
      await this.showManagementModal('types', 'Program Types', this.programTypes)
    },

    async manageProgramModes() {
      await this.showManagementModal('modes', 'Program Modes', this.programModes)
    },

    async showManagementModal(type, title, items) {
      const isTypes = type === 'types'
      const itemName = isTypes ? 'Type' : 'Mode'
      
      const generateTable = () => {
        return items.map(item => `
          <tr>
            <td>${isTypes ? item.type : item.mode}</td>
            <td>${item.description}</td>
            <td class="text-center">
              <span class="badge ${item.isActive ? 'bg-success' : 'bg-secondary'}">
                ${item.isActive ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td class="text-center">
              <button class="btn btn-sm btn-outline-primary me-1" onclick="editItem('${item.id}')">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-secondary me-1" onclick="toggleItem('${item.id}')">
                <i class="bi bi-toggle-${item.isActive ? 'on' : 'off'}"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteItem('${item.id}')">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `).join('')
      }

      await this.$swal.fire({
        title: `Manage ${title}`,
        html: `
          <div class="text-start">
            <!-- Add New Form -->
            <div class="card mb-3">
              <div class="card-body">
                <div class="row g-2">
                  <div class="col-md-4">
                    <input type="text" id="new${itemName}" class="form-control form-control-sm" placeholder="${itemName}">
                  </div>
                  <div class="col-md-6">
                    <input type="text" id="newDescription" class="form-control form-control-sm" placeholder="Description">
                  </div>
                  <div class="col-md-2">
                    <button class="btn btn-sm btn-primary w-100" onclick="addNew${itemName}()">
                      <i class="bi bi-plus"></i> Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Search Bar -->
            <div class="mb-3">
              <input type="text" id="searchItems" class="form-control form-control-sm" placeholder="Search ${title.toLowerCase()}...">
            </div>
            
            <!-- Table -->
            <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
              <table class="table table-sm table-hover">
                <thead class="table-light sticky-top">
                  <tr>
                    <th>${itemName}</th>
                    <th>Description</th>
                    <th class="text-center">Status</th>
                    <th class="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody id="itemsTableBody">
                  ${generateTable()}
                </tbody>
              </table>
            </div>
          </div>
        `,
        showCloseButton: true,
        showConfirmButton: false,
        width: '900px',
        didOpen: () => {
          // Add search functionality
          const searchInput = document.getElementById('searchItems')
          searchInput.addEventListener('input', (e) => {
            console.log('Searching:', e.target.value)
          })

          // Global functions for button actions
          window.addNewType = () => this.addNewItem(type, itemName)
          window.addNewMode = () => this.addNewItem(type, itemName)
          window.editItem = (id) => this.editItem(type, id)
          window.toggleItem = (id) => this.toggleItem(type, id)
          window.deleteItem = (id) => this.deleteItem(type, id)
        }
      })
    },

    async addNewItem(type, itemName) {
      const nameInput = document.getElementById(`new${itemName}`)
      const descInput = document.getElementById('newDescription')
      
      const name = nameInput.value.trim()
      const description = descInput.value.trim()
      
      if (!name) {
        this.$swal.showValidationMessage(`Please enter a ${itemName.toLowerCase()}`)
        return
      }

      const items = type === 'types' ? this.programTypes : this.programModes
      const newItem = {
        id: Date.now().toString(),
        [type === 'types' ? 'type' : 'mode']: name,
        description: description,
        isActive: true
      }

      items.unshift(newItem)
      
      // Clear inputs
      nameInput.value = ''
      descInput.value = ''
      
      this.$swal.fire({
        icon: 'success',
        title: 'Added!',
        text: `${itemName} added successfully`,
        timer: 1500,
        showConfirmButton: false
      })
    },

    async editItem(type, id) {
      console.log('Edit item:', type, id)
    },

    async toggleItem(type, id) {
      const items = type === 'types' ? this.programTypes : this.programModes
      const item = items.find(i => i.id === id)
      if (item) {
        item.isActive = !item.isActive
      }
    },

    async deleteItem(type, id) {
      const items = type === 'types' ? this.programTypes : this.programModes
      const index = items.findIndex(i => i.id === id)
      if (index !== -1) {
        items.splice(index, 1)
      }
    }
  }
}
</script>

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

code {
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: var(--staff-light);
}

.badge {
  font-size: 0.75rem;
}

.badge.small {
  font-size: 0.65rem;
}
</style>