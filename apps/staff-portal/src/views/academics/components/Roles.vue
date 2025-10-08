<template>
  <div>
    <!-- Search and Add Button -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body">
            <div class="row g-3 align-items-end">
              <div class="col-md-8">
                <label class="form-label">Search Roles</label>
                <input
                  v-model="searchQuery"
                  type="text"
                  class="form-control"
                  placeholder="Search by role name, description, or modules..."
                >
              </div>
              <div class="col-md-4">
                <button
                  class="btn btn-staff-primary w-100"
                  @click="showAddRoleModal"
                >
                  <i class="bi bi-plus-circle me-2"></i>Add New Role
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
      <p class="mt-3 text-muted">Loading roles...</p>
    </div>

    <!-- Roles Table -->
    <div v-else class="row">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Role Name</th>
                    <th>Description</th>
                    <th>Modules</th>
                    <th>Permissions</th>
                    <th width="120">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="role in paginatedRoles" :key="role.id">
                    <td>
                      <div class="fw-semibold">{{ role.name }}</div>
                    </td>
                    <td>
                      <div class="text-muted">{{ role.description || 'No description' }}</div>
                    </td>
                    <td>
                      <div class="d-flex flex-wrap gap-1">
                        <span 
                          v-for="module in role.modules" 
                          :key="module"
                          class="badge bg-primary"
                        >
                          {{ formatModuleName(module) }}
                        </span>
                        <span v-if="role.modules.length === 0" class="text-muted small">
                          No modules assigned
                        </span>
                      </div>
                    </td>
                    <td>
                      <div class="d-flex flex-wrap gap-1">
                        <span 
                          v-for="permission in getUniquePermissions(role.permissions)" 
                          :key="permission"
                          class="badge bg-success"
                        >
                          {{ formatPermissionName(permission) }}
                        </span>
                        <span v-if="getUniquePermissions(role.permissions).length === 0" class="text-muted small">
                          No permissions assigned
                        </span>
                      </div>
                    </td>
                    <td>
                      <div class="btn-group" role="group">
                        <button
                          class="btn btn-sm btn-outline-staff-primary"
                          @click="editRole(role)"
                          title="Edit Role"
                        >
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button
                          class="btn btn-sm btn-outline-danger"
                          @click="deleteRole(role)"
                          title="Delete Role"
                          :disabled="role.isSystem"
                        >
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="paginatedRoles.length === 0">
                    <td colspan="5" class="text-center py-4 text-muted">
                      <i class="bi bi-person-badge display-6 d-block mb-2"></i>
                      {{ searchQuery ? 'No roles found matching your search.' : 'No roles available. Create one to get started.' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="row mt-4">
      <div class="col-12">
        <nav aria-label="Roles pagination">
          <ul class="pagination justify-content-center mb-0">
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <button class="page-link" @click="currentPage = 1" :disabled="currentPage === 1">
                First
              </button>
            </li>
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <button class="page-link" @click="currentPage--" :disabled="currentPage === 1">
                Previous
              </button>
            </li>
            <li 
              v-for="page in visiblePages" 
              :key="page" 
              class="page-item" 
              :class="{ active: page === currentPage }"
            >
              <button class="page-link" @click="currentPage = page">{{ page }}</button>
            </li>
            <li class="page-item" :class="{ disabled: currentPage === totalPages }">
              <button class="page-link" @click="currentPage++" :disabled="currentPage === totalPages">
                Next
              </button>
            </li>
            <li class="page-item" :class="{ disabled: currentPage === totalPages }">
              <button class="page-link" @click="currentPage = totalPages" :disabled="currentPage === totalPages">
                Last
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </div>
</template>

<script>
import { apiService } from '../../../services/api.js'
import { logger } from '@shared/utils/logger'
import Swal from 'sweetalert2'

export default {
  name: 'Roles',
  data() {
    return {
      roles: [],
      isLoading: true,
      searchQuery: '',
      currentPage: 1,
      perPage: 10,
      availableModules: [
        { value: 'applications', label: 'Applications' },
        { value: 'admissions', label: 'Admissions' },
        { value: 'academics', label: 'Academics' },
        { value: 'users', label: 'Users' },
        { value: 'reports', label: 'Reports' },
        { value: 'settings', label: 'Settings' },
        { value: 'students', label: 'Students' },
        { value: 'staffs', label: 'Staffs' },
        { value: 'payments', label: 'Payments' },
        { value: 'dashboard', label: 'Dashboard' }
      ],
      availablePermissions: [
        { value: 'create', label: 'Create' },
        { value: 'read', label: 'Read/View' },
        { value: 'update', label: 'Update/Edit' },
        { value: 'delete', label: 'Delete' },
        { value: 'manage', label: 'Manage All' },
        { value: 'approve', label: 'Approve' },
        { value: 'review', label: 'Review' },
        { value: 'export', label: 'Export' }
      ]
    }
  },
  computed: {
    filteredRoles() {
      if (!this.searchQuery) return this.roles

      return this.roles.filter(role => {
        const query = this.searchQuery.toLowerCase()
        return (
          role.name.toLowerCase().includes(query) ||
          (role.description && role.description.toLowerCase().includes(query)) ||
          role.modules.some(module => this.formatModuleName(module).toLowerCase().includes(query)) ||
          this.getUniquePermissions(role.permissions).some(permission => 
            this.formatPermissionName(permission).toLowerCase().includes(query)
          )
        )
      })
    },

    paginatedRoles() {
      const start = (this.currentPage - 1) * this.perPage
      const end = start + this.perPage
      return this.filteredRoles.slice(start, end)
    },

    totalPages() {
      return Math.ceil(this.filteredRoles.length / this.perPage)
    },

    visiblePages() {
      const pages = []
      const start = Math.max(1, this.currentPage - 2)
      const end = Math.min(this.totalPages, this.currentPage + 2)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      return pages
    }
  },
  watch: {
    searchQuery() {
      this.currentPage = 1
    }
  },
  async mounted() {
    await this.loadRoles()
  },
  methods: {
    async loadRoles() {
      try {
        this.isLoading = true
        logger.info('Loading roles...')

        // Mock data for now - replace with actual API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        this.roles = [
          {
            id: 1,
            name: 'Super Admin',
            description: 'Full system access and control',
            modules: ['applications', 'admissions', 'academics', 'users', 'reports', 'settings', 'students', 'staffs', 'payments', 'dashboard'],
            permissions: {
              applications: ['create', 'read', 'update', 'delete', 'manage', 'approve', 'review', 'export'],
              admissions: ['create', 'read', 'update', 'delete', 'manage', 'approve', 'review', 'export'],
              academics: ['create', 'read', 'update', 'delete', 'manage', 'export'],
              users: ['create', 'read', 'update', 'delete', 'manage'],
              reports: ['read', 'export'],
              settings: ['read', 'update', 'manage'],
              students: ['create', 'read', 'update', 'delete', 'manage'],
              staffs: ['create', 'read', 'update', 'delete', 'manage'],
              payments: ['create', 'read', 'update', 'delete', 'manage'],
              dashboard: ['read']
            },
            isSystem: true,
            createdAt: new Date('2024-01-01')
          },
          {
            id: 2,
            name: 'Admissions Manager',
            description: 'Manages application and admission processes',
            modules: ['applications', 'admissions', 'students', 'reports', 'dashboard'],
            permissions: {
              applications: ['read', 'update', 'approve', 'review', 'export'],
              admissions: ['create', 'read', 'update', 'manage', 'approve'],
              students: ['read', 'update'],
              reports: ['read', 'export'],
              dashboard: ['read']
            },
            isSystem: false,
            createdAt: new Date('2024-01-10')
          },
          {
            id: 3,
            name: 'Academic Staff',
            description: 'Manages academic programs and sessions',
            modules: ['academics', 'students', 'reports', 'dashboard'],
            permissions: {
              academics: ['create', 'read', 'update', 'manage'],
              students: ['read', 'update'],
              reports: ['read', 'export'],
              dashboard: ['read']
            },
            isSystem: false,
            createdAt: new Date('2024-01-15')
          },
          {
            id: 4,
            name: 'Finance Officer',
            description: 'Manages payments and financial records',
            modules: ['payments', 'students', 'reports', 'dashboard'],
            permissions: {
              payments: ['create', 'read', 'update', 'manage', 'export'],
              students: ['read'],
              reports: ['read', 'export'],
              dashboard: ['read']
            },
            isSystem: false,
            createdAt: new Date('2024-01-20')
          },
          {
            id: 5,
            name: 'Staff Manager',
            description: 'Manages staff accounts and permissions',
            modules: ['users', 'staffs', 'reports', 'dashboard'],
            permissions: {
              users: ['create', 'read', 'update', 'delete'],
              staffs: ['create', 'read', 'update', 'manage'],
              reports: ['read', 'export'],
              dashboard: ['read']
            },
            isSystem: false,
            createdAt: new Date('2024-01-25')
          }
        ]

        logger.info(`Loaded ${this.roles.length} roles`)
      } catch (error) {
        logger.error('Error loading roles:', error)
        Swal.fire({
          title: 'Error!',
          text: 'Failed to load roles. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: '#dc3545'
        })
      } finally {
        this.isLoading = false
      }
    },

    async showAddRoleModal() {
      await this.showRoleModal()
    },

    async editRole(role) {
      await this.showRoleModal(role)
    },

    async showRoleModal(existingRole = null) {
      const isEdit = !!existingRole
      const selectedModules = existingRole ? [...existingRole.modules] : []
      const rolePermissions = existingRole ? { ...existingRole.permissions } : {}

      const moduleCheckboxes = this.availableModules.map(module => `
        <div class="col-6 col-md-4 mb-2">
          <div class="form-check">
            <input 
              class="form-check-input module-checkbox" 
              type="checkbox" 
              value="${module.value}" 
              id="module-${module.value}"
              ${selectedModules.includes(module.value) ? 'checked' : ''}
            >
            <label class="form-check-label" for="module-${module.value}">
              ${module.label}
            </label>
          </div>
        </div>
      `).join('')

      const result = await Swal.fire({
        title: isEdit ? 'Edit Role' : 'Add New Role',
        html: `
          <div class="row g-3">
            <div class="col-12">
              <label for="swal-role-name" class="form-label text-start w-100">Role Name</label>
              <input 
                id="swal-role-name" 
                class="swal2-input" 
                placeholder="e.g., Academic Coordinator" 
                value="${existingRole ? existingRole.name : ''}"
                required
              >
            </div>
            <div class="col-12">
              <label for="swal-role-description" class="form-label text-start w-100">Description</label>
              <textarea 
                id="swal-role-description" 
                class="swal2-textarea" 
                placeholder="Brief description of the role" 
                rows="3"
              >${existingRole ? existingRole.description : ''}</textarea>
            </div>
            <div class="col-12">
              <label class="form-label text-start w-100">Select Modules</label>
              <div class="row">
                ${moduleCheckboxes}
              </div>
            </div>
            <div class="col-12">
              <label class="form-label text-start w-100">Permissions for Selected Modules</label>
              <div id="permissions-container" class="border rounded p-3" style="max-height: 300px; overflow-y: auto;">
                <p class="text-muted mb-0">Select modules above to configure permissions</p>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: isEdit ? 'Update Role' : 'Create Role',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#198754',
        cancelButtonColor: '#6c757d',
        width: '800px',
        didOpen: () => {
          this.setupModulePermissionHandlers(rolePermissions)
        },
        preConfirm: () => {
          const name = document.getElementById('swal-role-name').value
          const description = document.getElementById('swal-role-description').value
          const selectedModules = Array.from(document.querySelectorAll('.module-checkbox:checked')).map(cb => cb.value)
          
          const permissions = {}
          selectedModules.forEach(module => {
            const modulePermissions = Array.from(document.querySelectorAll(`input[name="permissions-${module}"]:checked`)).map(cb => cb.value)
            if (modulePermissions.length > 0) {
              permissions[module] = modulePermissions
            }
          })

          if (!name) {
            Swal.showValidationMessage('Please enter a role name')
            return false
          }

          if (selectedModules.length === 0) {
            Swal.showValidationMessage('Please select at least one module')
            return false
          }

          return { name, description, modules: selectedModules, permissions }
        }
      })

      if (result.isConfirmed) {
        if (isEdit) {
          await this.updateRole(existingRole.id, result.value)
        } else {
          await this.createRole(result.value)
        }
      }
    },

    setupModulePermissionHandlers(existingPermissions = {}) {
      const moduleCheckboxes = document.querySelectorAll('.module-checkbox')
      const permissionsContainer = document.getElementById('permissions-container')

      const updatePermissionsDisplay = () => {
        const selectedModules = Array.from(document.querySelectorAll('.module-checkbox:checked')).map(cb => cb.value)
        
        if (selectedModules.length === 0) {
          permissionsContainer.innerHTML = '<p class="text-muted mb-0">Select modules above to configure permissions</p>'
          return
        }

        const permissionsHTML = selectedModules.map(moduleValue => {
          const module = this.availableModules.find(m => m.value === moduleValue)
          const modulePerms = existingPermissions[moduleValue] || []
          
          const permissionCheckboxes = this.availablePermissions.map(permission => `
            <div class="col-6 col-lg-4 mb-1">
              <div class="form-check form-check-sm">
                <input 
                  class="form-check-input" 
                  type="checkbox" 
                  name="permissions-${moduleValue}"
                  value="${permission.value}" 
                  id="perm-${moduleValue}-${permission.value}"
                  ${modulePerms.includes(permission.value) ? 'checked' : ''}
                >
                <label class="form-check-label small" for="perm-${moduleValue}-${permission.value}">
                  ${permission.label}
                </label>
              </div>
            </div>
          `).join('')

          return `
            <div class="border-bottom pb-2 mb-3">
              <h6 class="mb-2">${module.label}</h6>
              <div class="row">
                ${permissionCheckboxes}
              </div>
            </div>
          `
        }).join('')

        permissionsContainer.innerHTML = permissionsHTML
      }

      moduleCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updatePermissionsDisplay)
      })

      updatePermissionsDisplay()
    },

    async createRole(roleData) {
      try {
        logger.info('Creating role:', roleData)

        // Mock API call - replace with actual implementation
        const newRole = {
          id: Date.now(),
          ...roleData,
          isSystem: false,
          createdAt: new Date()
        }

        this.roles.unshift(newRole)

        Swal.fire({
          title: 'Success!',
          text: 'Role created successfully.',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#198754'
        })

        logger.info('Role created successfully')
      } catch (error) {
        logger.error('Error creating role:', error)
        Swal.fire({
          title: 'Error!',
          text: 'Failed to create role. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: '#dc3545'
        })
      }
    },

    async updateRole(roleId, updateData) {
      try {
        logger.info('Updating role:', roleId, updateData)

        // Mock API call - replace with actual implementation
        const index = this.roles.findIndex(r => r.id === roleId)
        if (index !== -1) {
          this.roles[index] = { ...this.roles[index], ...updateData }
        }

        Swal.fire({
          title: 'Success!',
          text: 'Role updated successfully.',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#198754'
        })

        logger.info('Role updated successfully')
      } catch (error) {
        logger.error('Error updating role:', error)
        Swal.fire({
          title: 'Error!',
          text: 'Failed to update role. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: '#dc3545'
        })
      }
    },

    async deleteRole(role) {
      if (role.isSystem) {
        Swal.fire({
          title: 'Cannot Delete',
          text: 'System roles cannot be deleted.',
          icon: 'warning',
          confirmButtonText: 'OK',
          confirmButtonColor: '#198754'
        })
        return
      }

      const result = await Swal.fire({
        title: 'Delete Role?',
        text: `Are you sure you want to delete "${role.name}"? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d'
      })

      if (result.isConfirmed) {
        try {
          logger.info('Deleting role:', role.id)

          // Mock API call - replace with actual implementation
          this.roles = this.roles.filter(r => r.id !== role.id)

          Swal.fire({
            title: 'Deleted!',
            text: 'Role deleted successfully.',
            icon: 'success',
            confirmButtonText: 'OK',
            confirmButtonColor: '#198754'
          })

          logger.info('Role deleted successfully')
        } catch (error) {
          logger.error('Error deleting role:', error)
          Swal.fire({
            title: 'Error!',
            text: 'Failed to delete role. Please try again.',
            icon: 'error',
            confirmButtonText: 'OK',
            confirmButtonColor: '#dc3545'
          })
        }
      }
    },

    formatModuleName(moduleValue) {
      const module = this.availableModules.find(m => m.value === moduleValue)
      return module ? module.label : moduleValue
    },

    formatPermissionName(permissionValue) {
      const permission = this.availablePermissions.find(p => p.value === permissionValue)
      return permission ? permission.label : permissionValue
    },

    getUniquePermissions(permissions) {
      const allPermissions = Object.values(permissions).flat()
      return [...new Set(allPermissions)]
    }
  }
}
</script>

<style scoped>
.btn-staff-primary {
  background-color: #198754;
  border-color: #198754;
  color: white;
}

.btn-staff-primary:hover {
  background-color: #157347;
  border-color: #146c43;
}

.btn-outline-staff-primary {
  color: #198754;
  border-color: #198754;
}

.btn-outline-staff-primary:hover {
  background-color: #198754;
  border-color: #198754;
  color: white;
}

.text-staff-primary {
  color: #198754 !important;
}

.page-link {
  color: #198754;
}

.page-item.active .page-link {
  background-color: #198754;
  border-color: #198754;
}

.table th {
  background-color: #f8f9fa;
  border-bottom: 2px solid #dee2e6;
  font-weight: 600;
}

.card {
  border-radius: 0.5rem;
}

.btn-group .btn {
  border-radius: 0.25rem;
  margin-right: 0.25rem;
}

.btn-group .btn:last-child {
  margin-right: 0;
}

.badge {
  font-size: 0.75em;
  margin-right: 0.25rem;
}

.form-check-sm .form-check-input {
  width: 0.875rem;
  height: 0.875rem;
}

.form-check-sm .form-check-label {
  font-size: 0.875rem;
}

:deep(.swal2-html-container) {
  text-align: left;
}

:deep(.swal2-input),
:deep(.swal2-textarea) {
  margin: 0.375rem 0;
  border: 1px solid #ced4da;
  border-radius: 0.375rem;
}

:deep(.swal2-input:focus),
:deep(.swal2-textarea:focus) {
  border-color: #198754;
  box-shadow: 0 0 0 0.2rem rgba(25, 135, 84, 0.25);
}
</style>