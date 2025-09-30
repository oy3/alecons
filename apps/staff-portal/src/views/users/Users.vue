<script lang="js">
import { useAuthStore } from '../../stores/auth.js'
import { apiService } from '../../services/api.js'
import { logger } from '@shared/utils/logger'

export default {
  name: 'UsersManagement',
  setup() {
    const authStore = useAuthStore()
    return {
      authStore
    }
  },
  data() {
    return {
      users: [],
      isLoading: true,
      searchQuery: '',
      roleFilter: 'all',
      statusFilter: 'all',
      currentPage: 1,
      perPage: 10,
      totalUsers: 0,
      showUserModal: false,
      selectedUser: null,
      
      userForm: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: 'staff',
        department: '',
        position: '',
        status: 'active'
      },

      roleOptions: [
        { value: 'all', label: 'All Roles' },
        { value: 'admin', label: 'Administrator' },
        { value: 'manager', label: 'Manager' },
        { value: 'staff', label: 'Staff' },
        { value: 'student', label: 'Student' }
      ],

      statusOptions: [
        { value: 'all', label: 'All Statuses' },
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'suspended', label: 'Suspended' }
      ],

      departments: [
        'Admissions',
        'Academic Affairs',
        'Student Services',
        'Finance',
        'IT Support',
        'Administration'
      ],

      positions: [
        'Administrator',
        'Manager',
        'Staff',
        'Supervisor',
        'Assistant'
      ]
    }
  },
  async mounted() {
    await this.loadUsers()
  },
  computed: {
    filteredUsers() {
      let filtered = this.users

      // Search filter
      if (this.searchQuery) {
        filtered = filtered.filter(user => 
          user.firstName.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          user.lastName.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(this.searchQuery.toLowerCase())
        )
      }

      // Role filter
      if (this.roleFilter !== 'all') {
        filtered = filtered.filter(user => user.role === this.roleFilter)
      }

      // Status filter
      if (this.statusFilter !== 'all') {
        filtered = filtered.filter(user => user.status === this.statusFilter)
      }

      return filtered
    },

    paginatedUsers() {
      const start = (this.currentPage - 1) * this.perPage
      const end = start + this.perPage
      return this.filteredUsers.slice(start, end)
    },

    totalPages() {
      return Math.ceil(this.filteredUsers.length / this.perPage)
    }
  },
  methods: {
    async loadUsers() {
      try {
        this.isLoading = true
        logger.info('Loading users...')

        // Mock data - replace with actual API call
        await new Promise(resolve => setTimeout(resolve, 1000))

        this.users = [
          {
            id: '1',
            firstName: 'John',
            lastName: 'Admin',
            email: 'john.admin@acons.edu',
            phone: '+1-555-0100',
            role: 'admin',
            department: 'Administration',
            position: 'Administrator',
            status: 'active',
            lastLogin: '2025-01-16T09:30:00Z',
            createdAt: '2024-08-01T10:00:00Z'
          },
          {
            id: '2',
            firstName: 'Sarah',
            lastName: 'Manager',
            email: 'sarah.manager@acons.edu',
            phone: '+1-555-0101',
            role: 'manager',
            department: 'Admissions',
            position: 'Manager',
            status: 'active',
            lastLogin: '2025-01-16T08:15:00Z',
            createdAt: '2024-09-15T14:30:00Z'
          },
          {
            id: '3',
            firstName: 'Mike',
            lastName: 'Staff',
            email: 'mike.staff@acons.edu',
            phone: '+1-555-0102',
            role: 'staff',
            department: 'Academic Affairs',
            position: 'Staff',
            status: 'active',
            lastLogin: '2025-01-15T16:45:00Z',
            createdAt: '2024-10-01T09:00:00Z'
          },
          {
            id: '4',
            firstName: 'Jane',
            lastName: 'Student',
            email: 'jane.student@email.com',
            phone: '+1-555-0103',
            role: 'student',
            department: null,
            position: null,
            status: 'active',
            lastLogin: '2025-01-16T07:20:00Z',
            createdAt: '2024-11-01T12:00:00Z'
          },
          {
            id: '5',
            firstName: 'Bob',
            lastName: 'Inactive',
            email: 'bob.inactive@acons.edu',
            phone: '+1-555-0104',
            role: 'staff',
            department: 'IT Support',
            position: 'Staff',
            status: 'inactive',
            lastLogin: '2024-12-01T10:30:00Z',
            createdAt: '2024-07-01T08:00:00Z'
          }
        ]

        this.totalUsers = this.users.length

        logger.info('Users loaded successfully')
      } catch (error) {
        logger.error('Failed to load users:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Load Failed',
          text: 'Failed to load users'
        })
      } finally {
        this.isLoading = false
      }
    },

    getRoleBadgeClass(role) {
      const roleClasses = {
        admin: 'bg-danger text-white',
        manager: 'bg-primary text-white',
        staff: 'bg-info text-white',
        student: 'bg-secondary text-white'
      }
      return roleClasses[role] || 'bg-secondary text-white'
    },

    getStatusBadgeClass(status) {
      const statusClasses = {
        active: 'bg-success text-white',
        inactive: 'bg-warning text-dark',
        suspended: 'bg-danger text-white'
      }
      return statusClasses[status] || 'bg-secondary text-white'
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString()
    },

    formatDateTime(dateString) {
      return new Date(dateString).toLocaleString()
    },

    viewUser(user) {
      this.selectedUser = { ...user }
      this.showUserModal = true
    },

    editUser(user) {
      this.selectedUser = { ...user }
      this.userForm = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department || '',
        position: user.position || '',
        status: user.status
      }
      this.showUserModal = true
    },

    async saveUser() {
      try {
        logger.info('Saving user...')

        // Validate form
        if (!this.userForm.firstName || !this.userForm.lastName || !this.userForm.email) {
          this.$swal.fire({
            icon: 'warning',
            title: 'Validation Error',
            text: 'Please fill in all required fields'
          })
          return
        }

        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 1000))

        if (this.selectedUser.id) {
          // Update existing user
          const index = this.users.findIndex(u => u.id === this.selectedUser.id)
          if (index !== -1) {
            this.users[index] = {
              ...this.users[index],
              ...this.userForm
            }
          }
        } else {
          // Add new user
          const newUser = {
            id: Date.now().toString(),
            ...this.userForm,
            lastLogin: null,
            createdAt: new Date().toISOString()
          }
          this.users.push(newUser)
        }

        this.showUserModal = false
        this.selectedUser = null
        this.resetForm()

        this.$swal.fire({
          icon: 'success',
          title: 'User Saved',
          text: 'User has been saved successfully',
          timer: 2000,
          showConfirmButton: false
        })

        logger.info('User saved successfully')
      } catch (error) {
        logger.error('Failed to save user:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: 'Failed to save user'
        })
      }
    },

    async updateUserStatus(user, newStatus) {
      try {
        logger.info(`Updating user ${user.id} status to ${newStatus}`)

        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 500))

        // Update local data
        const index = this.users.findIndex(u => u.id === user.id)
        if (index !== -1) {
          this.users[index].status = newStatus
        }

        this.$swal.fire({
          icon: 'success',
          title: 'Status Updated',
          text: `User status updated to ${newStatus.toUpperCase()}`,
          timer: 2000,
          showConfirmButton: false
        })

        logger.info('User status updated successfully')
      } catch (error) {
        logger.error('Failed to update user status:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Update Failed',
          text: 'Failed to update user status'
        })
      }
    },

    addNewUser() {
      this.selectedUser = null
      this.resetForm()
      this.showUserModal = true
    },

    resetForm() {
      this.userForm = {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: 'staff',
        department: '',
        position: '',
        status: 'active'
      }
    },

    closeModal() {
      this.showUserModal = false
      this.selectedUser = null
      this.resetForm()
    },

    exportUsers() {
      this.$swal.fire({
        title: 'Export Users',
        text: 'This feature will be implemented soon',
        icon: 'info',
        confirmButtonColor: '#1a5f5f'
      })
    }
  }
}
</script>

<template>
  <div class="container-fluid p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h2 class="fw-bold text-staff-primary mb-1">Users Management</h2>
            <p class="text-muted mb-0">Manage system users and permissions</p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-staff-primary btn-sm" @click="exportUsers">
              <i class="bi bi-download me-2"></i>Export
            </button>
            <button class="btn btn-staff-primary btn-sm" @click="addNewUser">
              <i class="bi bi-plus me-2"></i>Add User
            </button>
            <button class="btn btn-outline-staff-secondary btn-sm" @click="loadUsers">
              <i class="bi bi-arrow-clockwise me-2"></i>Refresh
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="staff-card">
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-4">
                <label for="searchQuery" class="form-label">Search</label>
                <input
                  type="text"
                  class="form-control"
                  id="searchQuery"
                  placeholder="Search by name or email..."
                  v-model="searchQuery"
                >
              </div>
              <div class="col-md-3">
                <label for="roleFilter" class="form-label">Role</label>
                <select class="form-select" id="roleFilter" v-model="roleFilter">
                  <option v-for="role in roleOptions" :key="role.value" :value="role.value">
                    {{ role.label }}
                  </option>
                </select>
              </div>
              <div class="col-md-3">
                <label for="statusFilter" class="form-label">Status</label>
                <select class="form-select" id="statusFilter" v-model="statusFilter">
                  <option v-for="status in statusOptions" :key="status.value" :value="status.value">
                    {{ status.label }}
                  </option>
                </select>
              </div>
              <div class="col-md-2 d-flex align-items-end">
                <button class="btn btn-outline-staff-primary w-100" @click="loadUsers">
                  <i class="bi bi-funnel me-2"></i>Filter
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
      <p class="mt-3 text-muted">Loading users...</p>
    </div>

    <!-- Users Table -->
    <div v-else class="row">
      <div class="col-12">
        <div class="staff-card">
          <div class="card-header bg-transparent border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="mb-0 fw-bold">
                Users ({{ filteredUsers.length }} of {{ totalUsers }})
              </h5>
            </div>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>User</th>
                    <th>Contact</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="user in paginatedUsers" :key="user.id">
                    <td>
                      <div class="d-flex align-items-center">
                        <div class="bg-staff-light rounded-circle p-2 me-2">
                          <i class="bi bi-person text-staff-primary"></i>
                        </div>
                        <div>
                          <div class="fw-medium">{{ user.firstName }} {{ user.lastName }}</div>
                          <div class="small text-muted">ID: {{ user.id }}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div class="small">{{ user.email }}</div>
                        <div class="small text-muted">{{ user.phone }}</div>
                      </div>
                    </td>
                    <td>
                      <span class="badge rounded-pill" :class="getRoleBadgeClass(user.role)">
                        {{ user.role.toUpperCase() }}
                      </span>
                    </td>
                    <td>
                      <div>
                        <div class="small">{{ user.department || '-' }}</div>
                        <div class="small text-muted">{{ user.position || '-' }}</div>
                      </div>
                    </td>
                    <td>
                      <span class="badge rounded-pill" :class="getStatusBadgeClass(user.status)">
                        {{ user.status.toUpperCase() }}
                      </span>
                    </td>
                    <td>
                      <div class="small">
                        {{ user.lastLogin ? formatDateTime(user.lastLogin) : 'Never' }}
                      </div>
                    </td>
                    <td>
                      <div class="btn-group btn-group-sm">
                        <button 
                          class="btn btn-outline-staff-primary btn-sm" 
                          @click="viewUser(user)"
                          title="View Details"
                        >
                          <i class="bi bi-eye"></i>
                        </button>
                        <button 
                          class="btn btn-outline-staff-secondary btn-sm" 
                          @click="editUser(user)"
                          title="Edit User"
                          v-if="authStore.hasPermission('edit') || authStore.hasPermission('users:edit')"
                        >
                          <i class="bi bi-pencil"></i>
                        </button>
                        <div class="btn-group" role="group">
                          <button 
                            type="button" 
                            class="btn btn-outline-warning btn-sm dropdown-toggle" 
                            data-bs-toggle="dropdown"
                            title="Update Status"
                            v-if="authStore.hasPermission('manage') || authStore.hasPermission('users:manage')"
                          >
                            <i class="bi bi-gear"></i>
                          </button>
                          <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="#" @click.prevent="updateUserStatus(user, 'active')">
                              <i class="bi bi-check-circle text-success me-2"></i>Activate
                            </a></li>
                            <li><a class="dropdown-item" href="#" @click.prevent="updateUserStatus(user, 'inactive')">
                              <i class="bi bi-pause-circle text-warning me-2"></i>Deactivate
                            </a></li>
                            <li><a class="dropdown-item" href="#" @click.prevent="updateUserStatus(user, 'suspended')">
                              <i class="bi bi-ban text-danger me-2"></i>Suspend
                            </a></li>
                          </ul>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Pagination -->
          <div class="card-footer bg-transparent" v-if="totalPages > 1">
            <nav>
              <ul class="pagination pagination-sm mb-0 justify-content-center">
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <button class="page-link" @click="currentPage = currentPage - 1" :disabled="currentPage === 1">
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
                <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                  <button class="page-link" @click="currentPage = currentPage + 1" :disabled="currentPage === totalPages">
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>

    <!-- User Modal -->
    <div class="modal fade" :class="{ show: showUserModal }" :style="{ display: showUserModal ? 'block' : 'none' }" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              {{ selectedUser?.id ? 'Edit User' : 'Add New User' }}
            </h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveUser">
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="firstName" class="form-label">First Name *</label>
                  <input type="text" class="form-control" id="firstName" v-model="userForm.firstName" required>
                </div>
                <div class="col-md-6 mb-3">
                  <label for="lastName" class="form-label">Last Name *</label>
                  <input type="text" class="form-control" id="lastName" v-model="userForm.lastName" required>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="email" class="form-label">Email *</label>
                  <input type="email" class="form-control" id="email" v-model="userForm.email" required>
                </div>
                <div class="col-md-6 mb-3">
                  <label for="phone" class="form-label">Phone</label>
                  <input type="tel" class="form-control" id="phone" v-model="userForm.phone">
                </div>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="role" class="form-label">Role *</label>
                  <select class="form-select" id="role" v-model="userForm.role" required>
                    <option value="admin">Administrator</option>
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                    <option value="student">Student</option>
                  </select>
                </div>
                <div class="col-md-6 mb-3">
                  <label for="status" class="form-label">Status *</label>
                  <select class="form-select" id="status" v-model="userForm.status" required>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              <div class="row" v-if="userForm.role !== 'student'">
                <div class="col-md-6 mb-3">
                  <label for="department" class="form-label">Department</label>
                  <select class="form-select" id="department" v-model="userForm.department">
                    <option value="">Select Department</option>
                    <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
                  </select>
                </div>
                <div class="col-md-6 mb-3">
                  <label for="position" class="form-label">Position</label>
                  <select class="form-select" id="position" v-model="userForm.position">
                    <option value="">Select Position</option>
                    <option v-for="pos in positions" :key="pos" :value="pos">{{ pos }}</option>
                  </select>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button type="button" class="btn btn-staff-primary" @click="saveUser">
              {{ selectedUser?.id ? 'Update User' : 'Add User' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Backdrop -->
    <div class="modal-backdrop fade" :class="{ show: showUserModal }" v-if="showUserModal"></div>
  </div>
</template>

<style scoped>
.staff-card {
  border: none;
  box-shadow: 0 2px 10px rgba(26, 95, 95, 0.1);
  border-radius: 12px;
  transition: all 0.3s ease;
}

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
}

.dropdown-menu {
  border: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.modal-backdrop {
  background-color: rgba(0, 0, 0, 0.5);
}

.modal.show {
  animation: modalFadeIn 0.3s ease-out;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>