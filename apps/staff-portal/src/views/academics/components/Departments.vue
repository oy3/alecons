
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
      searchTimeout: null,
      currentPage: 1,
      perPage: 10,
      totalDepartments: 0,
      apiTotalPages: 0
    }
  },
  computed: {
    filteredDepartments() {
      return this.departments
    },

    paginatedDepartments() {
      return this.departments
    },

    totalPages() {
      const calculated = Math.ceil(this.totalDepartments / this.perPage)
      return this.apiTotalPages || Math.max(1, calculated)
    }
  },
  watch: {
    searchQuery() {
      this.currentPage = 1
      this.debouncedLoadDepartments()
    },
    currentPage() {
      this.loadDepartments()
    }
  },
  async mounted() {
    await this.loadDepartments()
  },
  methods: {
    debouncedLoadDepartments() {
      clearTimeout(this.searchTimeout)
      this.searchTimeout = setTimeout(() => {
        this.loadDepartments()
      }, 500)
    },

    async loadDepartments() {
      try {
        this.isLoading = true
        logger.info('Loading departments...')

        const params = {
          page: this.currentPage,
          limit: this.perPage,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        }

        if (this.searchQuery && this.searchQuery.trim()) {
          params.search = this.searchQuery.trim()
        }

        const response = await apiService.getDepartments(params)

        if (response.success) {
          this.departments = response.data.departments.map(dept => ({
            id: dept._id,
            code: dept.code,
            name: dept.name,
            description: dept.description || '',
            isActive: dept.active,
            programsCount: dept.programsCount || 0,
            createdAt: dept.createdAt,
            updatedAt: dept.updatedAt
          }))

          this.totalDepartments = response.data.pagination.totalItems
          this.currentPage = response.data.pagination.currentPage
          this.apiTotalPages = response.data.pagination.totalPages

          logger.info('Departments loaded successfully', { 
            count: this.departments.length,
            total: this.totalDepartments 
          })
        } else {
          throw new Error(response.message || 'Failed to load departments')
        }
      } catch (error) {
        logger.error('Failed to load departments:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to load departments',
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
          <div class="row g-3 text-start">
            <div class="col-12">
              <label class="form-label">Department Code</label>
              <input id="departmentCode" class="form-control" placeholder="e.g., NUR" maxlength="3">
              <small class="text-muted">Maximum 3 characters</small>
            </div>
            <div class="col-12">
              <label class="form-label">Department Name</label>
              <input id="departmentName" class="form-control" placeholder="e.g., Nursing Sciences">
            </div>
            <div class="col-12">
              <label class="form-label">Description (Optional)</label>
              <textarea id="description" class="form-control" placeholder="Department description..." rows="3"></textarea>
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
          const departmentCode = document.getElementById('departmentCode').value.trim()
          const departmentName = document.getElementById('departmentName').value.trim()
          const description = document.getElementById('description').value.trim()
          const isActive = document.getElementById('isActive').checked

          if (!departmentCode || !departmentName) {
            this.$swal.showValidationMessage('Please fill in all required fields')
            return false
          }

          if (departmentCode.length < 2 || departmentCode.length > 3) {
            this.$swal.showValidationMessage('Department code must be 2-3 characters')
            return false
          }

          // Check if code already exists
          if (this.departments.some(dept => dept.code.toLowerCase() === departmentCode.toLowerCase())) {
            this.$swal.showValidationMessage('Department code already exists')
            return false
          }

          return {
            code: departmentCode.toUpperCase(),
            name: departmentName,
            description: description || undefined,
            active: isActive
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

        const response = await apiService.createDepartment(departmentData)

        if (response.success) {
          this.$swal.fire({
            icon: 'success',
            title: 'Success',
            text: 'Department added successfully',
            timer: 2000,
            showConfirmButton: false
          })

          await this.loadDepartments()
          this.$emit('refresh')
        } else {
          throw new Error(response.message)
        }
      } catch (error) {
        logger.error('Failed to add department:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to add department',
          confirmButtonColor: '#1a5f5f'
        })
      }
    },

    async editDepartment(department) {
      const { value: formValues } = await this.$swal.fire({
        title: 'Edit Department',
        html: `
          <div class="row g-3 text-start">
            <div class="col-12">
              <label class="form-label">Department Code</label>
              <input id="departmentCode" class="form-control" value="${department.code}" maxlength="3">
              <small class="text-muted">Maximum 3 characters</small>
            </div>
            <div class="col-12">
              <label class="form-label">Department Name</label>
              <input id="departmentName" class="form-control" value="${department.name}">
            </div>
            <div class="col-12">
              <label class="form-label">Description (Optional)</label>
              <textarea id="description" class="form-control" rows="3">${department.description || ''}</textarea>
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
          const departmentCode = document.getElementById('departmentCode').value.trim()
          const departmentName = document.getElementById('departmentName').value.trim()
          const description = document.getElementById('description').value.trim()
          const isActive = document.getElementById('isActive').checked

          if (!departmentCode || !departmentName) {
            this.$swal.showValidationMessage('Please fill in all required fields')
            return false
          }

          if (departmentCode.length < 2 || departmentCode.length > 3) {
            this.$swal.showValidationMessage('Department code must be 2-3 characters')
            return false
          }

          // Check if code already exists (excluding current department)
          if (this.departments.some(dept => dept.id !== department.id && dept.code.toLowerCase() === departmentCode.toLowerCase())) {
            this.$swal.showValidationMessage('Department code already exists')
            return false
          }

          return {
            code: departmentCode.toUpperCase(),
            name: departmentName,
            description: description || undefined,
            active: isActive
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

        const response = await apiService.updateDepartment(departmentId, departmentData)

        if (response.success) {
          this.$swal.fire({
            icon: 'success',
            title: 'Success',
            text: 'Department updated successfully',
            timer: 2000,
            showConfirmButton: false
          })

          await this.loadDepartments()
          this.$emit('refresh')
        } else {
          throw new Error(response.message)
        }
      } catch (error) {
        logger.error('Failed to update department:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to update department',
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

          const response = await apiService.deleteDepartment(department.id)

          if (response.success) {
            this.$swal.fire({
              icon: 'success',
              title: 'Deleted!',
              text: 'Department has been deleted.',
              timer: 2000,
              showConfirmButton: false
            })

            await this.loadDepartments()
            this.$emit('refresh')
          } else {
            throw new Error(response.message)
          }
        } catch (error) {
          logger.error('Failed to delete department:', error)
          this.$swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Failed to delete department',
            confirmButtonColor: '#1a5f5f'
          })
        }
      }
    }
  }
}
</script>

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
                  :class="{ disabled: currentPage >= totalPages || departments.length === 0 }"
                >
                  <button
                    class="page-link"
                    @click="currentPage = currentPage + 1"
                    :disabled="currentPage >= totalPages || departments.length === 0"
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