<script>
import { apiService } from '../../../services/api.js'
import { logger } from '@shared/utils/logger'
import Swal from 'sweetalert2'

export default {
  name: 'Payments',
  data() {
    return {
      allPayments: [], // Store all payments from server
      payments: [], // Displayed payments after filtering
      isLoading: true,
      searchQuery: '',
      currentPage: 1,
      perPage: 10
    }
  },
  computed: {
    filteredPayments() {
      if (!this.searchQuery) return this.allPayments

      return this.allPayments.filter(payment =>
        payment.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (payment.description && payment.description.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
        (payment.paymentCode && payment.paymentCode.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
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

        // Load all payments at once (no pagination for simplicity)
        const response = await apiService.getPayments({
          limit: 1000 // Load all payments
        })

        logger.info('API Response:', response)

        if (response.success) {
          this.allPayments = response.data.payments.map(payment => ({
            id: payment.id,
            name: payment.name,
            description: payment.description,
            amount: payment.amount,
            isActive: payment.isActive,
            paymentCode: payment.paymentCode,
            createdAt: new Date(payment.createdAt)
          }))

          logger.info(`Loaded ${this.allPayments.length} payments`)
          console.log('All payments loaded:', this.allPayments)
        } else {
          throw new Error(response.message || 'Failed to load payments')
        }
      } catch (error) {
        logger.error('Error loading payments:', error)
        console.error('Full error details:', error)
        
        // Show more detailed error information
        let errorMessage = 'Failed to load payments. Please try again.'
        if (error.message.includes('Unauthorized')) {
          errorMessage = 'You are not authorized to view payments. Please check your permissions.'
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network error. Please check your connection.'
        }
        
        // For now, add some fallback data so we can test the UI
        logger.warn('Using fallback payment data for testing')
        this.allPayments = [
          {
            id: 1,
            name: 'Application Fee',
            description: 'Fee for submitting university application',
            amount: 25000,
            isActive: true,
            paymentCode: 'APP_FEE',
            createdAt: new Date('2024-01-15')
          },
          {
            id: 2,
            name: 'Tuition Fee - Semester 1',
            description: 'First semester tuition payment',
            amount: 350000,
            isActive: true,
            paymentCode: 'TUITION_S1',
            createdAt: new Date('2024-01-20')
          },
          {
            id: 3,
            name: 'Library Fee',
            description: 'Annual library access and maintenance fee',
            amount: 15000,
            isActive: true,
            paymentCode: 'LIBRARY_FEE',
            createdAt: new Date('2024-01-25')
          }
        ]
        
        Swal.fire({
          title: 'Warning!',
          text: errorMessage + ' (Using sample data for now)',
          icon: 'warning',
          confirmButtonText: 'OK',
          confirmButtonColor: '#ffc107'
        })
      } finally {
        this.isLoading = false
      }
    },

    async showAddPaymentModal() {
      const { value: formValues } = await Swal.fire({
        title: 'Add New Payment',
        html: `
          <div class="row g-3 text-start">
            <div class="col-12">
              <label for="swal-payment-name" class="form-label">Payment Name</label>
              <input id="swal-payment-name" class="form-control" placeholder="e.g., Application Fee" required>
            </div>
            <div class="col-12">
              <label for="swal-payment-code" class="form-label">Payment Code</label>
              <input id="swal-payment-code" class="form-control" placeholder="e.g., formFee" required>
              <div class="form-text">Unique code to identify this payment type</div>
            </div>
            <div class="col-12">
              <label for="swal-payment-description" class="form-label">Description</label>
              <textarea id="swal-payment-description" class="form-control" placeholder="Brief description of the payment" rows="3"></textarea>
            </div>
            <div class="col-12">
              <label for="swal-payment-amount" class="form-label">Amount (₦)</label>
              <input id="swal-payment-amount" class="form-control" type="number" placeholder="0.00" min="0" step="0.01" required>
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
          const paymentCode = document.getElementById('swal-payment-code').value
          const description = document.getElementById('swal-payment-description').value
          const amount = document.getElementById('swal-payment-amount').value
          const isActive = document.getElementById('swal-payment-active').checked

          if (!name || !paymentCode || !amount) {
            Swal.showValidationMessage('Please fill in all required fields')
            return false
          }

          // Validate payment code format (alphanumeric only)
          const codePattern = /^[A-Za-z0-9]+$/
          if (!codePattern.test(paymentCode)) {
            Swal.showValidationMessage('Payment code should contain only letters and numbers (no spaces or special characters)')
            return false
          }

          if (parseFloat(amount) < 0) {
            Swal.showValidationMessage('Amount cannot be negative')
            return false
          }

          return { name, paymentCode, description, amount: parseFloat(amount), isActive }
        }
      })

      if (formValues) {
        await this.createPayment(formValues)
      }
    },

    async createPayment(paymentData) {
      try {
        logger.info('Creating payment:', paymentData)

        const response = await apiService.createPayment(paymentData)

        if (response.success) {
          // Reload payments to get updated list
          await this.loadPayments()

          Swal.fire({
            title: 'Success!',
            text: 'Payment created successfully.',
            icon: 'success',
            confirmButtonText: 'OK',
            confirmButtonColor: '#198754'
          })

          logger.info('Payment created successfully')
        } else {
          throw new Error(response.message || 'Failed to create payment')
        }
      } catch (error) {
        logger.error('Error creating payment:', error)
        
        let errorMessage = 'Failed to create payment. Please try again.'
        if (error.message.includes('already exists')) {
          errorMessage = 'A payment with this name already exists.'
        }

        Swal.fire({
          title: 'Error!',
          text: errorMessage,
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
          <div class="row g-3 text-start">
            <div class="col-12">
              <label for="swal-edit-name" class="form-label">Payment Name</label>
              <input id="swal-edit-name" class="form-control" value="${payment.name}" required>
            </div>
            <div class="col-12">
              <label for="swal-edit-code" class="form-label">Payment Code</label>
              <input id="swal-edit-code" class="form-control" value="${payment.paymentCode || ''}" required>
              <div class="form-text">Unique code to identify this payment type</div>
            </div>
            <div class="col-12">
              <label for="swal-edit-description" class="form-label">Description</label>
              <textarea id="swal-edit-description" class="form-control" rows="3">${payment.description || ''}</textarea>
            </div>
            <div class="col-12">
              <label for="swal-edit-amount" class="form-label">Amount (₦)</label>
              <input id="swal-edit-amount" class="form-control" type="number" value="${payment.amount}" min="0" step="0.01" required>
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
          const paymentCode = document.getElementById('swal-edit-code').value
          const description = document.getElementById('swal-edit-description').value
          const amount = document.getElementById('swal-edit-amount').value
          const isActive = document.getElementById('swal-edit-active').checked

          if (!name || !paymentCode || !amount) {
            Swal.showValidationMessage('Please fill in all required fields')
            return false
          }

          // Validate payment code format (alphanumeric only)
          const codePattern = /^[A-Za-z0-9]+$/
          if (!codePattern.test(paymentCode)) {
            Swal.showValidationMessage('Payment code should contain only letters and numbers (no spaces or special characters)')
            return false
          }

          if (parseFloat(amount) < 0) {
            Swal.showValidationMessage('Amount cannot be negative')
            return false
          }

          return { name, paymentCode, description, amount: parseFloat(amount), isActive }
        }
      })

      if (formValues) {
        await this.updatePayment(payment.id, formValues)
      }
    },

    async updatePayment(paymentId, updateData) {
      try {
        logger.info('Updating payment:', paymentId, updateData)

        const response = await apiService.updatePayment(paymentId, updateData)

        if (response.success) {
          // Reload payments to get updated list
          await this.loadPayments()

          Swal.fire({
            title: 'Success!',
            text: 'Payment updated successfully.',
            icon: 'success',
            confirmButtonText: 'OK',
            confirmButtonColor: '#198754'
          })

          logger.info('Payment updated successfully')
        } else {
          throw new Error(response.message || 'Failed to update payment')
        }
      } catch (error) {
        logger.error('Error updating payment:', error)
        
        let errorMessage = 'Failed to update payment. Please try again.'
        if (error.message.includes('already exists')) {
          errorMessage = 'A payment with this name already exists.'
        }

        Swal.fire({
          title: 'Error!',
          text: errorMessage,
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

          const response = await apiService.togglePaymentStatus(payment.id)

          if (response.success) {
            // Reload payments to get updated list
            await this.loadPayments()

            Swal.fire({
              title: 'Success!',
              text: `Payment ${action}d successfully.`,
              icon: 'success',
              confirmButtonText: 'OK',
              confirmButtonColor: '#198754'
            })

            logger.info(`Payment ${action}d successfully`)
          } else {
            throw new Error(response.message || `Failed to ${action} payment`)
          }
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

          const response = await apiService.deletePayment(payment.id)

          if (response.success) {
            // Reload payments to get updated list
            await this.loadPayments()

            Swal.fire({
              title: 'Deleted!',
              text: 'Payment deleted successfully.',
              icon: 'success',
              confirmButtonText: 'OK',
              confirmButtonColor: '#198754'
            })

            logger.info('Payment deleted successfully')
          } else {
            throw new Error(response.message || 'Failed to delete payment')
          }
        } catch (error) {
          logger.error('Error deleting payment:', error)
          
          let errorMessage = 'Failed to delete payment. Please try again.'
          if (error.message.includes('been used by students')) {
            errorMessage = 'Cannot delete payment that has been used by students.'
          }

          Swal.fire({
            title: 'Error!',
            text: errorMessage,
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
                  placeholder="Search by payment name, code, description, or amount..."
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
                    <th>Payment Code</th>
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
                      <code class="text-primary">{{ payment.paymentCode || 'N/A' }}</code>
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
                    <td colspan="6" class="text-center py-4 text-muted">
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
    <div v-if="totalPages > 0" class="row mt-4">
      <div class="col-12">
        <nav aria-label="Payments pagination">
          <ul class="pagination pagination-sm justify-content-center mb-0">
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <button class="page-link" @click="currentPage = 1" :disabled="currentPage === 1">
                <<
              </button>
            </li>
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <button class="page-link" @click="currentPage--" :disabled="currentPage === 1">
                <
              </button>
            </li>
            <li 
              v-for="page in visiblePages" 
              :key="page" 
              class="page-item" 
              :class="{ active: page === currentPage }"
            >
              <button class="page-link text-white" @click="currentPage = page">{{ page }}</button>
            </li>
            <li class="page-item" :class="{ disabled: currentPage === totalPages }">
              <button class="page-link" @click="currentPage++" :disabled="currentPage === totalPages">
                >
              </button>
            </li>
            <li class="page-item" :class="{ disabled: currentPage === totalPages }">
              <button class="page-link" @click="currentPage = totalPages" :disabled="currentPage === totalPages">
                >>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </div>
</template>

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