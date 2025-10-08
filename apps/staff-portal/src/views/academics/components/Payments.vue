<template>
  <div>
    <!-- Search and Add Button -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body">
            <div class="row g-3 align-items-end">
              <div class="col-md-8">
                <label class="form-label">Search Payments</label>
                <input
                  v-model="searchQuery"
                  type="text"
                  class="form-control"
                  placeholder="Search by payment name, description, or amount..."
                >
              </div>
              <div class="col-md-4">
                <button
                  class="btn btn-staff-primary w-100"
                  @click="showAddPaymentModal"
                >
                  <i class="bi bi-plus-circle me-2"></i>Add New Payment
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
      <p class="mt-3 text-muted">Loading payments...</p>
    </div>

    <!-- Payments Table -->
    <div v-else class="row">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Payment Name</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th width="150">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="payment in paginatedPayments" :key="payment.id">
                    <td>
                      <div class="fw-semibold">{{ payment.name }}</div>
                    </td>
                    <td>
                      <div class="text-muted">{{ payment.description || 'No description' }}</div>
                    </td>
                    <td>
                      <div class="fw-semibold text-success">
                        ₦{{ formatAmount(payment.amount) }}
                      </div>
                    </td>
                    <td>
                      <span 
                        :class="payment.isActive ? 'badge bg-success' : 'badge bg-danger'"
                      >
                        {{ payment.isActive ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                    <td>
                      <div class="btn-group" role="group">
                        <button
                          class="btn btn-sm btn-outline-staff-primary"
                          @click="editPayment(payment)"
                          title="Edit Payment"
                        >
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button
                          class="btn btn-sm"
                          :class="payment.isActive ? 'btn-outline-warning' : 'btn-outline-success'"
                          @click="togglePaymentStatus(payment)"
                          :title="payment.isActive ? 'Deactivate Payment' : 'Activate Payment'"
                        >
                          <i :class="payment.isActive ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                        </button>
                        <button
                          class="btn btn-sm btn-outline-danger"
                          @click="deletePayment(payment)"
                          title="Delete Payment"
                        >
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="paginatedPayments.length === 0">
                    <td colspan="5" class="text-center py-4 text-muted">
                      <i class="bi bi-credit-card display-6 d-block mb-2"></i>
                      {{ searchQuery ? 'No payments found matching your search.' : 'No payments available. Create one to get started.' }}
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
        <nav aria-label="Payments pagination">
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
  name: 'Payments',
  data() {
    return {
      payments: [],
      isLoading: true,
      searchQuery: '',
      currentPage: 1,
      perPage: 10
    }
  },
  computed: {
    filteredPayments() {
      if (!this.searchQuery) return this.payments

      return this.payments.filter(payment =>
        payment.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (payment.description && payment.description.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
        payment.amount.toString().includes(this.searchQuery)
      )
    },

    paginatedPayments() {
      const start = (this.currentPage - 1) * this.perPage
      const end = start + this.perPage
      return this.filteredPayments.slice(start, end)
    },

    totalPages() {
      return Math.ceil(this.filteredPayments.length / this.perPage)
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
    await this.loadPayments()
  },
  methods: {
    async loadPayments() {
      try {
        this.isLoading = true
        logger.info('Loading payments...')

        // Mock data for now - replace with actual API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        this.payments = [
          {
            id: 1,
            name: 'Application Fee',
            description: 'Fee for submitting university application',
            amount: 25000,
            isActive: true,
            createdAt: new Date('2024-01-15')
          },
          {
            id: 2,
            name: 'Tuition Fee - Semester 1',
            description: 'First semester tuition payment',
            amount: 350000,
            isActive: true,
            createdAt: new Date('2024-01-20')
          },
          {
            id: 3,
            name: 'Library Fee',
            description: 'Annual library access and maintenance fee',
            amount: 15000,
            isActive: true,
            createdAt: new Date('2024-01-25')
          },
          {
            id: 4,
            name: 'Laboratory Fee',
            description: 'Laboratory equipment and usage fee',
            amount: 45000,
            isActive: false,
            createdAt: new Date('2024-02-01')
          },
          {
            id: 5,
            name: 'Examination Fee',
            description: 'Fee for semester examinations',
            amount: 20000,
            isActive: true,
            createdAt: new Date('2024-02-05')
          }
        ]

        logger.info(`Loaded ${this.payments.length} payments`)
      } catch (error) {
        logger.error('Error loading payments:', error)
        Swal.fire({
          title: 'Error!',
          text: 'Failed to load payments. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: '#dc3545'
        })
      } finally {
        this.isLoading = false
      }
    },

    async showAddPaymentModal() {
      const { value: formValues } = await Swal.fire({
        title: 'Add New Payment',
        html: `
          <div class="row g-3">
            <div class="col-12">
              <label for="swal-payment-name" class="form-label text-start w-100">Payment Name</label>
              <input id="swal-payment-name" class="swal2-input" placeholder="e.g., Application Fee" required>
            </div>
            <div class="col-12">
              <label for="swal-payment-description" class="form-label text-start w-100">Description</label>
              <textarea id="swal-payment-description" class="swal2-textarea" placeholder="Brief description of the payment" rows="3"></textarea>
            </div>
            <div class="col-12">
              <label for="swal-payment-amount" class="form-label text-start w-100">Amount (₦)</label>
              <input id="swal-payment-amount" class="swal2-input" type="number" placeholder="0.00" min="0" step="0.01" required>
            </div>
            <div class="col-12">
              <div class="form-check text-start">
                <input id="swal-payment-active" class="form-check-input" type="checkbox" checked>
                <label for="swal-payment-active" class="form-check-label">
                  Set as active
                </label>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Create Payment',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#198754',
        cancelButtonColor: '#6c757d',
        preConfirm: () => {
          const name = document.getElementById('swal-payment-name').value
          const description = document.getElementById('swal-payment-description').value
          const amount = document.getElementById('swal-payment-amount').value
          const isActive = document.getElementById('swal-payment-active').checked

          if (!name || !amount) {
            Swal.showValidationMessage('Please fill in all required fields')
            return false
          }

          if (parseFloat(amount) < 0) {
            Swal.showValidationMessage('Amount cannot be negative')
            return false
          }

          return { name, description, amount: parseFloat(amount), isActive }
        }
      })

      if (formValues) {
        await this.createPayment(formValues)
      }
    },

    async createPayment(paymentData) {
      try {
        logger.info('Creating payment:', paymentData)

        // Mock API call - replace with actual implementation
        const newPayment = {
          id: Date.now(),
          ...paymentData,
          createdAt: new Date()
        }

        this.payments.unshift(newPayment)

        Swal.fire({
          title: 'Success!',
          text: 'Payment created successfully.',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#198754'
        })

        logger.info('Payment created successfully')
      } catch (error) {
        logger.error('Error creating payment:', error)
        Swal.fire({
          title: 'Error!',
          text: 'Failed to create payment. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: '#dc3545'
        })
      }
    },

    async editPayment(payment) {
      const { value: formValues } = await Swal.fire({
        title: 'Edit Payment',
        html: `
          <div class="row g-3">
            <div class="col-12">
              <label for="swal-edit-name" class="form-label text-start w-100">Payment Name</label>
              <input id="swal-edit-name" class="swal2-input" value="${payment.name}" required>
            </div>
            <div class="col-12">
              <label for="swal-edit-description" class="form-label text-start w-100">Description</label>
              <textarea id="swal-edit-description" class="swal2-textarea" rows="3">${payment.description || ''}</textarea>
            </div>
            <div class="col-12">
              <label for="swal-edit-amount" class="form-label text-start w-100">Amount (₦)</label>
              <input id="swal-edit-amount" class="swal2-input" type="number" value="${payment.amount}" min="0" step="0.01" required>
            </div>
            <div class="col-12">
              <div class="form-check text-start">
                <input id="swal-edit-active" class="form-check-input" type="checkbox" ${payment.isActive ? 'checked' : ''}>
                <label for="swal-edit-active" class="form-check-label">
                  Set as active
                </label>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Update Payment',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#198754',
        cancelButtonColor: '#6c757d',
        preConfirm: () => {
          const name = document.getElementById('swal-edit-name').value
          const description = document.getElementById('swal-edit-description').value
          const amount = document.getElementById('swal-edit-amount').value
          const isActive = document.getElementById('swal-edit-active').checked

          if (!name || !amount) {
            Swal.showValidationMessage('Please fill in all required fields')
            return false
          }

          if (parseFloat(amount) < 0) {
            Swal.showValidationMessage('Amount cannot be negative')
            return false
          }

          return { name, description, amount: parseFloat(amount), isActive }
        }
      })

      if (formValues) {
        await this.updatePayment(payment.id, formValues)
      }
    },

    async updatePayment(paymentId, updateData) {
      try {
        logger.info('Updating payment:', paymentId, updateData)

        // Mock API call - replace with actual implementation
        const index = this.payments.findIndex(p => p.id === paymentId)
        if (index !== -1) {
          this.payments[index] = { ...this.payments[index], ...updateData }
        }

        Swal.fire({
          title: 'Success!',
          text: 'Payment updated successfully.',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#198754'
        })

        logger.info('Payment updated successfully')
      } catch (error) {
        logger.error('Error updating payment:', error)
        Swal.fire({
          title: 'Error!',
          text: 'Failed to update payment. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: '#dc3545'
        })
      }
    },

    async togglePaymentStatus(payment) {
      const action = payment.isActive ? 'deactivate' : 'activate'
      
      const result = await Swal.fire({
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} Payment?`,
        text: `Are you sure you want to ${action} "${payment.name}"?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: `Yes, ${action}`,
        cancelButtonText: 'Cancel',
        confirmButtonColor: payment.isActive ? '#ffc107' : '#198754',
        cancelButtonColor: '#6c757d'
      })

      if (result.isConfirmed) {
        try {
          logger.info(`${action}ing payment:`, payment.id)

          // Mock API call - replace with actual implementation
          const index = this.payments.findIndex(p => p.id === payment.id)
          if (index !== -1) {
            this.payments[index].isActive = !this.payments[index].isActive
          }

          Swal.fire({
            title: 'Success!',
            text: `Payment ${action}d successfully.`,
            icon: 'success',
            confirmButtonText: 'OK',
            confirmButtonColor: '#198754'
          })

          logger.info(`Payment ${action}d successfully`)
        } catch (error) {
          logger.error(`Error ${action}ing payment:`, error)
          Swal.fire({
            title: 'Error!',
            text: `Failed to ${action} payment. Please try again.`,
            icon: 'error',
            confirmButtonText: 'OK',
            confirmButtonColor: '#dc3545'
          })
        }
      }
    },

    async deletePayment(payment) {
      const result = await Swal.fire({
        title: 'Delete Payment?',
        text: `Are you sure you want to delete "${payment.name}"? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d'
      })

      if (result.isConfirmed) {
        try {
          logger.info('Deleting payment:', payment.id)

          // Mock API call - replace with actual implementation
          this.payments = this.payments.filter(p => p.id !== payment.id)

          Swal.fire({
            title: 'Deleted!',
            text: 'Payment deleted successfully.',
            icon: 'success',
            confirmButtonText: 'OK',
            confirmButtonColor: '#198754'
          })

          logger.info('Payment deleted successfully')
        } catch (error) {
          logger.error('Error deleting payment:', error)
          Swal.fire({
            title: 'Error!',
            text: 'Failed to delete payment. Please try again.',
            icon: 'error',
            confirmButtonText: 'OK',
            confirmButtonColor: '#dc3545'
          })
        }
      }
    },

    formatAmount(amount) {
      return new Intl.NumberFormat('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount)
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
</style>