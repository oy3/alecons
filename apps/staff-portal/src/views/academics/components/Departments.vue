<template>
  <div>
    <!-- Search and Add Button -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body">
            <div class="row g-3 align-items-end">
              <div class="col-md-8">
                <label class="form-label">Search Departments</label>
                <input
                  v-model="searchQuery"
                  type="text"
                  class="form-control"
                  placeholder="Search by department code, name, or description..."
                >
              </div>
              <div class="col-md-4">
                <button
                  class="btn btn-staff-primary w-100"
                  @click="showAddDepartmentModal"
                >
                  <i class="bi bi-plus-circle me-2"></i>Add New Department
                </button>
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
      <p class="mt-3 text-muted">Loading departments...</p>
    </div>

    <!-- Departments Table -->
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
                    <th>Description</th>
                    <th class="text-center">Programs</th>
                    <th class="text-center">Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="paginatedDepartments.length === 0">
                    <td colspan="6" class="text-center py-5">
                      <div class="text-muted">
                        <i class="bi bi-building-x fs-1 mb-3 d-block"></i>
                        <h5 class="mb-2">No Departments Found</h5>
                        <p class="mb-0" v-if="searchQuery">
                          No departments match your search criteria.
                        </p>
                        <p class="mb-0" v-else>
                          No departments have been created yet.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <tr v-for="department in paginatedDepartments" :key="department.id">
                    <td>
                      <code class="text-staff-primary">{{ department.code }}</code>
                    </td>
                    <td>
                      <div class="fw-medium">{{ department.name }}</div>
                      <small class="text-muted">{{ department.shortName }}</small>
                    </td>
                    <td>
                      <span class="text-muted">{{ department.description || 'No description' }}</span>
                    </td>
                    <td class="text-center">
                      <span class="badge bg-info rounded-pill">
                        {{ department.programsCount || 0 }}
                      </span>
                    </td>
                    <td class="text-center">
                      <span
                        class="badge rounded-pill"
                        :class="department.isActive ? 'bg-success' : 'bg-secondary'"
                      >
                        {{ department.isActive ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                    <td>
                      <div class="btn-group btn-group-sm">
                        <button
                          class="btn btn-outline-success btn-sm"
                          @click="editDepartment(department)"
                          title="Edit Department"
                        >
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button
                          class="btn btn-outline-danger btn-sm"
                          @click="deleteDepartment(department)"
                          title="Delete Department"
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
  name: 'Departments',
  data() {
    return {
      departments: [],
      isLoading: true,
      searchQuery: '',
      currentPage: 1,
      perPage: 10
    }
  },
  computed: {
    filteredDepartments() {
      if (!this.searchQuery) return this.departments

      return this.departments.filter(department =>
        department.code.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        department.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (department.description && department.description.toLowerCase().includes(this.searchQuery.toLowerCase()))
      )
    },

    paginatedDepartments() {
      const start = (this.currentPage - 1) * this.perPage
      const end = start + this.perPage
      return this.filteredDepartments.slice(start, end)
    },

    totalPages() {
      return Math.ceil(this.filteredDepartments.length / this.perPage)
    }
  },
  watch: {
    searchQuery() {
      this.currentPage = 1
    }
  },
  async mounted() {
    await this.loadDepartments()
  },
  methods: {
    async loadDepartments() {
      try {
        this.isLoading = true
        logger.info('Loading departments...')

        // Mock data for now - replace with actual API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        this.departments = [
          {
            id: '1',
            code: 'NURS',
            name: 'Nursing Sciences',
            shortName: 'Nursing',
            description: 'Department of Nursing Sciences and Clinical Practice',
            isActive: true,
            programsCount: 3
          },
          {
            id: '2',
            code: 'MIDW',
            name: 'Midwifery',
            shortName: 'Midwifery',
            description: 'Department of Midwifery and Maternal Health',
            isActive: true,
            programsCount: 2
          },
          {
            id: '3',
            code: 'PUBH',
            name: 'Public Health',
            shortName: 'Public Health',
            description: 'Department of Community and Public Health',
            isActive: true,
            programsCount: 1
          },
          {
            id: '4',
            code: 'PHTH',
            name: 'Physiotherapy',
            shortName: 'Physiotherapy',
            description: 'Department of Physiotherapy and Rehabilitation',
            isActive: false,
            programsCount: 0
          }
        ]

        logger.info('Departments loaded successfully', { count: this.departments.length })
      } catch (error) {
        logger.error('Failed to load departments:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to load departments',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        this.isLoading = false
      }
    },

    async showAddDepartmentModal() {
      const { value: formValues } = await this.$swal.fire({
        title: 'Add New Department',
        html: `
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label text-start d-block">Department Code</label>
              <input id="departmentCode" class="swal2-input" placeholder="e.g., NURS" maxlength="10">
            </div>
            <div class="col-12">
              <label class="form-label text-start d-block">Department Name</label>
              <input id="departmentName" class="swal2-input" placeholder="e.g., Nursing Sciences">
            </div>
            <div class="col-12">
              <label class="form-label text-start d-block">Short Name</label>
              <input id="shortName" class="swal2-input" placeholder="e.g., Nursing">
            </div>
            <div class="col-12">
              <label class="form-label text-start d-block">Description</label>
              <textarea id="description" class="swal2-textarea" placeholder="Department description..."></textarea>
            </div>
            <div class="col-12">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="isActive" checked>
                <label class="form-check-label" for="isActive">Active Department</label>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Add Department',
        confirmButtonColor: '#1a5f5f',
        preConfirm: () => {
          const departmentCode = document.getElementById('departmentCode').value
          const departmentName = document.getElementById('departmentName').value
          const shortName = document.getElementById('shortName').value
          const description = document.getElementById('description').value
          const isActive = document.getElementById('isActive').checked

          if (!departmentCode || !departmentName) {
            this.$swal.showValidationMessage('Please fill in all required fields')
            return false
          }

          // Check if code already exists
          if (this.departments.some(dept => dept.code.toLowerCase() === departmentCode.toLowerCase())) {
            this.$swal.showValidationMessage('Department code already exists')
            return false
          }

          return {
            departmentCode: departmentCode.toUpperCase(),
            departmentName,
            shortName,
            description,
            isActive
          }
        }
      })

      if (formValues) {
        await this.addDepartment(formValues)
      }
    },

    async addDepartment(departmentData) {
      try {
        logger.info('Adding new department:', departmentData)

        // Mock API call - replace with actual implementation
        const newDepartment = {
          id: Date.now().toString(),
          code: departmentData.departmentCode,
          name: departmentData.departmentName,
          shortName: departmentData.shortName,
          description: departmentData.description,
          isActive: departmentData.isActive,
          programsCount: 0
        }

        this.departments.unshift(newDepartment)

        this.$swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Department added successfully',
          timer: 2000,
          showConfirmButton: false
        })

        this.$emit('refresh')
      } catch (error) {
        logger.error('Failed to add department:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to add department',
          confirmButtonColor: '#1a5f5f'
        })
      }
    },

    async editDepartment(department) {
      const { value: formValues } = await this.$swal.fire({
        title: 'Edit Department',
        html: `
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label text-start d-block">Department Code</label>
              <input id="departmentCode" class="swal2-input" value="${department.code}" maxlength="10">
            </div>
            <div class="col-12">
              <label class="form-label text-start d-block">Department Name</label>
              <input id="departmentName" class="swal2-input" value="${department.name}">
            </div>
            <div class="col-12">
              <label class="form-label text-start d-block">Short Name</label>
              <input id="shortName" class="swal2-input" value="${department.shortName || ''}">
            </div>
            <div class="col-12">
              <label class="form-label text-start d-block">Description</label>
              <textarea id="description" class="swal2-textarea">${department.description || ''}</textarea>
            </div>
            <div class="col-12">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="isActive" ${department.isActive ? 'checked' : ''}>
                <label class="form-check-label" for="isActive">Active Department</label>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Update Department',
        confirmButtonColor: '#1a5f5f',
        preConfirm: () => {
          const departmentCode = document.getElementById('departmentCode').value
          const departmentName = document.getElementById('departmentName').value
          const shortName = document.getElementById('shortName').value
          const description = document.getElementById('description').value
          const isActive = document.getElementById('isActive').checked

          if (!departmentCode || !departmentName) {
            this.$swal.showValidationMessage('Please fill in all required fields')
            return false
          }

          // Check if code already exists (excluding current department)
          if (this.departments.some(dept => dept.id !== department.id && dept.code.toLowerCase() === departmentCode.toLowerCase())) {
            this.$swal.showValidationMessage('Department code already exists')
            return false
          }

          return {
            departmentCode: departmentCode.toUpperCase(),
            departmentName,
            shortName,
            description,
            isActive
          }
        }
      })

      if (formValues) {
        await this.updateDepartment(department.id, formValues)
      }
    },

    async updateDepartment(departmentId, departmentData) {
      try {
        logger.info('Updating department:', { departmentId, departmentData })

        // Mock API call - replace with actual implementation
        const departmentIndex = this.departments.findIndex(d => d.id === departmentId)
        if (departmentIndex !== -1) {
          this.departments[departmentIndex] = {
            ...this.departments[departmentIndex],
            code: departmentData.departmentCode,
            name: departmentData.departmentName,
            shortName: departmentData.shortName,
            description: departmentData.description,
            isActive: departmentData.isActive
          }
        }

        this.$swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Department updated successfully',
          timer: 2000,
          showConfirmButton: false
        })

        this.$emit('refresh')
      } catch (error) {
        logger.error('Failed to update department:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to update department',
          confirmButtonColor: '#1a5f5f'
        })
      }
    },

    async deleteDepartment(department) {
      if (department.programsCount > 0) {
        this.$swal.fire({
          icon: 'warning',
          title: 'Cannot Delete',
          text: `This department has ${department.programsCount} programs. Please remove or reassign programs before deleting.`,
          confirmButtonColor: '#1a5f5f'
        })
        return
      }

      const result = await this.$swal.fire({
        title: 'Delete Department',
        text: `Are you sure you want to delete "${department.name}"? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it!'
      })

      if (result.isConfirmed) {
        try {
          logger.info('Deleting department:', department.id)

          // Mock API call - replace with actual implementation
          this.departments = this.departments.filter(d => d.id !== department.id)

          this.$swal.fire({
            icon: 'success',
            title: 'Deleted!',
            text: 'Department has been deleted.',
            timer: 2000,
            showConfirmButton: false
          })

          this.$emit('refresh')
        } catch (error) {
          logger.error('Failed to delete department:', error)
          this.$swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to delete department',
            confirmButtonColor: '#1a5f5f'
          })
        }
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
</style>