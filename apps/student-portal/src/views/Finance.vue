<script>
import { studentPaymentService } from '../services/payment.js';
import { apiService } from '../services/api.js';
import { logger } from '@shared/utils/logger';
import { useAuthStore } from '../stores/auth.js';
import Swal from 'sweetalert2';

export default {
  name: 'Finance',
  data() {
    return {
      // Academic sessions
      academicSessions: [],
      selectedSessionId: '',
      
      // Payment data
      paymentSummary: {
        paidFees: [],
        unpaidFees: [],
        totalPaid: 0,
        totalUnpaid: 0
      },
      paymentHistory: [],
      availablePayments: [],
      
      // UI state
      isLoading: true,
      isHistoryLoading: false,
      isPaymentLoading: false,
      error: null,
      
      // Pagination
      currentPage: 1,
      totalPages: 1,
      perPage: 10,
      
      // User data
      user: null,
      
      // Modal
      showPaymentModal: false
    }
  },
  
  computed: {
    accountBalance() {
      return this.paymentSummary?.totalUnpaid || 0;
    },
    
    totalPaidThisYear() {
      return this.paymentSummary?.totalPaid || 0;
    },
    
    pendingAmount() {
      return this.paymentSummary?.totalUnpaid || 0;
    },
    
    hasOutstandingPayments() {
      return (this.paymentSummary?.unpaidFees?.length || 0) > 0;
    }
  },
  
  async mounted() {
    await this.initializePage();
    
    // Add ESC key listener for modal
    document.addEventListener('keydown', this.handleKeydown);
  },
  
  beforeUnmount() {
    // Remove ESC key listener
    document.removeEventListener('keydown', this.handleKeydown);
  },
  
  methods: {
    async initializePage() {
      try {
        this.isLoading = true;
        this.error = null;
        
        // Get user data from auth store
        const authStore = useAuthStore();
        this.user = authStore.user;
        
        // Load academic sessions
        await this.loadAcademicSessions();
        
        // Load initial payment data
        if (this.academicSessions.length > 0) {
          // Default to the most recent session
          this.selectedSessionId = this.academicSessions[0].id;
          await this.loadPaymentData();
        }
        
      } catch (error) {
        logger.error('Error initializing finance page:', error);
        this.error = 'Failed to load financial data';
      } finally {
        this.isLoading = false;
      }
    },
    
    async loadAcademicSessions() {
      try {
        logger.info('Loading academic sessions');
        const response = await studentPaymentService.getAcademicSessions();
        
        if (response.success) {
          // The response.data contains the result from academicSessionsService.findAll()
          const sessions = response.data.sessions || [];
          this.academicSessions = sessions.map(session => ({
            id: session._id,
            name: session.sessionYear,
            value: session._id
          }));
          logger.info('Loaded academic sessions:', this.academicSessions.length);
        } else {
          throw new Error(response.message);
        }
      } catch (error) {
        logger.error('Error loading academic sessions:', error);
        this.academicSessions = [];
      }
    },
    
    async loadPaymentData() {
      try {
        logger.info('Loading payment data for session:', this.selectedSessionId);
        
        // Load payment summary
        const summaryResponse = await studentPaymentService.getPaymentSummary(this.selectedSessionId);
        if (summaryResponse.success) {
          this.paymentSummary = summaryResponse.data;
          logger.info('Loaded payment summary');
        }
        
        // Load payment history
        await this.loadPaymentHistory();
        
        // Load available payments
        await this.loadAvailablePayments();
        
      } catch (error) {
        logger.error('Error loading payment data:', error);
        this.error = 'Failed to load payment data';
      }
    },
    
    async loadPaymentHistory() {
      try {
        this.isHistoryLoading = true;
        
        const response = await studentPaymentService.getPaymentHistory(
          this.selectedSessionId,
          this.currentPage,
          this.perPage
        );
        
        if (response.success) {
          this.paymentHistory = response.data.payments;
          this.totalPages = response.data.pagination.totalPages;
          logger.info('Loaded payment history:', this.paymentHistory.length);
        }
      } catch (error) {
        logger.error('Error loading payment history:', error);
      } finally {
        this.isHistoryLoading = false;
      }
    },
    
    async loadAvailablePayments() {
      try {
        const response = await studentPaymentService.getAvailablePayments(this.selectedSessionId);
        
        if (response.success) {
          this.availablePayments = response.data;
          logger.info('Loaded available payments:', this.availablePayments.length);
        }
      } catch (error) {
        logger.error('Error loading available payments:', error);
        this.availablePayments = [];
      }
    },
    
    async onSessionChange() {
      logger.info('Academic session changed to:', this.selectedSessionId);
      await this.loadPaymentData();
    },
    
    async makePayment(paymentId) {
      try {
        if (!this.user?.email) {
          throw new Error('User email not found');
        }
        
        this.isPaymentLoading = true;
        logger.info('Initiating payment:', paymentId);
        
        // Initialize payment
        const response = await studentPaymentService.initializePayment(
          paymentId,
          this.user.email,
          this.selectedSessionId
        );
        
        if (response.success) {
          // Launch Paystack popup
          try {
            const paymentResult = await studentPaymentService.launchPaystackPayment(response.data);
            
            if (paymentResult.success) {
              // Close modal if open
              this.closePaymentModal();
              
              // Payment completed, reload data
              await this.loadPaymentData();
              
              // Show success message
              Swal.fire({
                icon: 'success',
                title: 'Payment Successful!',
                text: 'Your payment has been processed successfully.',
                confirmButtonText: 'OK',
                timer: 3000,
                timerProgressBar: true
              });
            }
            
          } catch (paymentError) {
            if (!paymentError.cancelled) {
              throw paymentError;
            } else {
              // Payment was cancelled by user
              Swal.fire({
                icon: 'info',
                title: 'Payment Cancelled',
                text: 'You cancelled the payment process.',
                confirmButtonText: 'OK'
              });
            }
          }
        } else {
          throw new Error(response.message);
        }
        
      } catch (error) {
        logger.error('Error making payment:', error);
        
        Swal.fire({
          icon: 'error',
          title: 'Payment Failed',
          text: error.message || 'Payment failed. Please try again.',
          confirmButtonText: 'OK'
        });
      } finally {
        this.isPaymentLoading = false;
      }
    },
    
    async downloadReceipt(payment) {
      try {
        logger.info('Downloading receipt for payment:', payment.reference);
        // TODO: Implement receipt download functionality
        Swal.fire({
          icon: 'info',
          title: 'Coming Soon',
          text: 'Receipt download functionality will be implemented soon.',
          confirmButtonText: 'OK'
        });
      } catch (error) {
        logger.error('Error downloading receipt:', error);
      }
    },
    
    async exportStatement() {
      try {
        logger.info('Exporting financial statement');
        // TODO: Implement statement export functionality
        Swal.fire({
          icon: 'info',
          title: 'Coming Soon',
          text: 'Statement export functionality will be implemented soon.',
          confirmButtonText: 'OK'
        });
      } catch (error) {
        logger.error('Error exporting statement:', error);
      }
    },
    
    formatCurrency(amount) {
      return studentPaymentService.formatCurrency(amount);
    },
    
    formatDate(date) {
      return studentPaymentService.formatDate(date);
    },
    
    getStatusBadgeClass(status) {
      return studentPaymentService.getStatusBadgeClass(status);
    },
    
    getStatusText(status) {
      return studentPaymentService.getStatusText(status);
    },
    
    getPaymentReference(payment) {
      return payment.reference || 'Not generated';
    },
    
    showPaymentOptions() {
      const unpaidFees = this.paymentSummary?.unpaidFees || [];
      if (unpaidFees.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'No Outstanding Payments',
          text: 'You have no pending payments at this time.',
          confirmButtonText: 'OK'
        });
        return;
      }
      
      // Open the payment modal
      this.showPaymentModal = true;
    },
    
    closePaymentModal() {
      this.showPaymentModal = false;
    },
    
    async makePaymentFromModal(paymentId) {
      // Use the same payment method but with modal-specific handling
      await this.makePayment(paymentId);
    },
    
    handleKeydown(event) {
      if (event.key === 'Escape' && this.showPaymentModal) {
        this.closePaymentModal();
      }
    }
  }
}
</script>

<template>
  <div class="finance p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center flex-wrap">
          <div class="mb-2 mb-md-0">
            <h2 class="h3 fw-bold text-dark mb-1">
              <i class="bi bi-credit-card me-2 text-primary"></i>
              Financial Dashboard
            </h2>
            <p class="text-muted mb-0">Manage your tuition, fees, and payment history.</p>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-primary btn-sm" @click="exportStatement" :disabled="isLoading">
              <i class="bi bi-download me-1"></i><span class="d-none d-sm-inline">Export Statement</span><span class="d-sm-none">Export</span>
            </button>
            <button class="btn btn-success btn-sm" 
              @click="showPaymentOptions"
              :disabled="isLoading || !hasOutstandingPayments"
              v-if="hasOutstandingPayments"
            >
              <i class="bi bi-credit-card me-1"></i><span class="d-none d-sm-inline">Make Payment</span><span class="d-sm-none">Pay</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Financial Summary Cards -->
    <div class="row mb-4">
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center">
              <div class="flex-shrink-0">
                <div class="bg-success bg-opacity-10 rounded-3 p-3">
                  <i class="bi bi-check-circle text-success fs-4"></i>
                </div>
              </div>
              <div class="flex-grow-1 ms-3">
                <h6 class="fw-bold text-dark mb-1">Account Balance</h6>
                <h4 class="fw-bold mb-0" :class="accountBalance > 0 ? 'text-danger' : 'text-success'">
                  {{ formatCurrency(accountBalance) }}
                </h4>
                <small :class="accountBalance > 0 ? 'text-danger' : 'text-success'">
                  {{ accountBalance > 0 ? 'Outstanding balance' : 'All payments current' }}
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center">
              <div class="flex-shrink-0">
                <div class="bg-primary bg-opacity-10 rounded-3 p-3">
                  <i class="bi bi-currency-exchange text-white fs-4"></i>
                </div>
              </div>
              <div class="flex-grow-1 ms-3">
                <h6 class="fw-bold text-dark mb-1">Total Paid</h6>
                <h4 class="fw-bold text-primary mb-0">{{ formatCurrency(totalPaidThisYear) }}</h4>
                <small class="text-muted">Selected session</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center">
              <div class="flex-shrink-0">
                <div class="bg-warning bg-opacity-10 rounded-3 p-3">
                  <i class="bi bi-clock text-warning fs-4"></i>
                </div>
              </div>
              <div class="flex-grow-1 ms-3">
                <h6 class="fw-bold text-dark mb-1">Pending</h6>
                <h4 class="fw-bold text-warning mb-0">{{ formatCurrency(pendingAmount) }}</h4>
                <small class="text-muted">{{ paymentSummary?.unpaidFees?.length || 0 }} payment(s) due</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center">
              <div class="flex-shrink-0">
                <div class="bg-info bg-opacity-10 rounded-3 p-3">
                  <i class="bi bi-calendar-check text-info fs-4"></i>
                </div>
              </div>
              <div class="flex-grow-1 ms-3">
                <h6 class="fw-bold text-dark mb-1">Next Due</h6>
                <h4 class="fw-bold text-info mb-0">Jan 15</h4>
                <small class="text-muted">Spring semester</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row">
      <!-- Payment History -->
      <div class="col-lg-8 mb-4">
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white border-0 py-3">
            <div class="d-flex justify-content-between align-items-center flex-wrap">
              <h5 class="fw-bold mb-0 mb-2 mb-md-0">Payment History</h5>
              <div class="d-flex gap-2">
                <select 
                  class="form-select form-select-sm" 
                  style="width: auto;"
                  v-model="selectedSessionId"
                  @change="onSessionChange"
                  :disabled="isLoading"
                >
                  <option value="">All Sessions</option>
                  <option 
                    v-for="session in academicSessions" 
                    :key="session.id" 
                    :value="session.id"
                  >
                    {{ session.name }}
                  </option>
                </select>
              </div>
            </div>
          </div>
          <div class="card-body p-0">
            <!-- Loading State -->
            <div v-if="isLoading || isHistoryLoading" class="text-center py-5">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="mt-3 text-muted">Loading payment history...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="text-center py-5">
              <i class="bi bi-exclamation-triangle text-warning mb-3" style="font-size: 3rem;"></i>
              <h5 class="text-muted">{{ error }}</h5>
              <button class="btn btn-primary mt-3" @click="loadPaymentData">
                <i class="bi bi-arrow-clockwise me-2"></i>Retry
              </button>
            </div>

            <!-- Payment History Table -->
            <div v-else class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th class="border-0 fw-bold">Transaction</th>
                    <th class="border-0 fw-bold d-none d-md-table-cell">Amount</th>
                    <th class="border-0 fw-bold">Status</th>
                    <th class="border-0 fw-bold d-none d-lg-table-cell">Reference</th>
                    <th class="border-0 fw-bold d-none d-sm-table-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <!-- Paid Transactions -->
                  <tr v-for="payment in paymentHistory" :key="payment.id">
                    <td class="py-3">
                      <div>
                        <div class="fw-bold">{{ payment.paymentId.name }}</div>
                        <small class="text-muted">{{ payment.paymentId.description }}</small>
                        <div class="d-md-none">
                          <small class="text-muted">
                            {{ formatDate(payment.paidAt) }} • {{ formatCurrency(payment.amount) }} • {{ payment.reference }}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 d-none d-md-table-cell">
                      <span class="fw-bold text-success">{{ formatCurrency(payment.amount) }}</span>
                    </td>
                    <td class="py-3">
                      <span class="badge" :class="getStatusBadgeClass(payment.status)">
                        {{ getStatusText(payment.status) }}
                      </span>
                    </td>
                    <td class="py-3 d-none d-lg-table-cell">
                      <code class="small">{{ payment.reference }}</code>
                    </td>
                    <td class="py-3 d-none d-sm-table-cell">
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" title="View Receipt" @click="downloadReceipt(payment)">
                          <i class="bi bi-receipt"></i>
                        </button>
                        <button class="btn btn-outline-secondary" title="Download" @click="downloadReceipt(payment)">
                          <i class="bi bi-download"></i>
                        </button>
                      </div>
                    </td>
                  </tr>

                  <!-- Unpaid Transactions -->
                  <tr 
                    v-for="unpaidFee in (paymentSummary?.unpaidFees || [])" 
                    :key="'unpaid-' + unpaidFee.id"
                    class="table-warning"
                  >
                    <td class="py-3">
                      <div>
                        <div class="fw-bold">{{ unpaidFee.name }}</div>
                        <small class="text-muted">{{ unpaidFee.description }}</small>
                        <div class="d-md-none">
                          <small class="text-muted">
                            Pending • {{ formatCurrency(unpaidFee.amount) }} • Due now
                          </small>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 d-none d-md-table-cell">
                      <span class="fw-bold text-warning">{{ formatCurrency(unpaidFee.amount) }}</span>
                    </td>
                    <td class="py-3">
                      <span class="badge bg-warning">Pending</span>
                    </td>
                    <td class="py-3 d-none d-lg-table-cell">
                      <small class="text-muted">Not generated</small>
                    </td>
                    <td class="py-3 d-none d-sm-table-cell">
                      <button 
                        class="btn btn-sm btn-success px-3 py-2" 
                        @click="makePayment(unpaidFee.id)"
                        :disabled="isPaymentLoading"
                      >
                        <span v-if="isPaymentLoading" class="spinner-border spinner-border-sm me-1"></span>
                        <i v-else class="bi bi-credit-card me-1"></i>
                        Pay Now
                      </button>
                    </td>
                  </tr>

                  <!-- Empty State -->
                  <tr v-if="paymentHistory.length === 0 && (paymentSummary?.unpaidFees?.length || 0) === 0">
                    <td colspan="5" class="text-center py-5">
                      <i class="bi bi-receipt text-muted mb-3" style="font-size: 3rem;"></i>
                      <h5 class="text-muted">No Payment History</h5>
                      <p class="text-muted mb-0">No payments found for the selected academic session.</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div class="col-lg-4">
        <!-- Payment Summary -->
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Payment Summary</h5>
          </div>
          <div class="card-body">
            <!-- Paid Fees -->
            <div 
              v-for="paidFee in (paymentSummary?.paidFees || [])" 
              :key="paidFee.id"
              class="payment-summary-item d-flex justify-content-between py-2 border-bottom"
            >
              <span class="text-muted">{{ paidFee.name }}</span>
              <span class="fw-bold text-success">{{ formatCurrency(paidFee.amount) }}</span>
            </div>

            <!-- Unpaid Fees -->
            <div 
              v-for="unpaidFee in (paymentSummary?.unpaidFees || [])" 
              :key="unpaidFee.id"
              class="payment-summary-item d-flex justify-content-between py-2 border-bottom"
            >
              <span class="text-muted">{{ unpaidFee.name }}</span>
              <span class="fw-bold text-warning">{{ formatCurrency(unpaidFee.amount) }}</span>
            </div>

            <!-- Summary -->
            <div class="payment-summary-item d-flex justify-content-between py-3 bg-light rounded mt-2">
              <span class="fw-bold">Total Paid</span>
              <span class="fw-bold text-success fs-5">{{ formatCurrency(paymentSummary?.totalPaid || 0) }}</span>
            </div>
            
            <div 
              v-if="(paymentSummary?.totalUnpaid || 0) > 0"
              class="payment-summary-item d-flex justify-content-between py-2 text-warning"
            >
              <span class="fw-bold">Outstanding</span>
              <span class="fw-bold">{{ formatCurrency(paymentSummary?.totalUnpaid || 0) }}</span>
            </div>

            <!-- Empty State -->
            <div v-if="(paymentSummary?.paidFees?.length || 0) === 0 && (paymentSummary?.unpaidFees?.length || 0) === 0" class="text-center py-4">
              <i class="bi bi-receipt text-muted mb-3" style="font-size: 2rem;"></i>
              <p class="text-muted mb-0">No payment information available for the selected session.</p>
            </div>
          </div>
        </div>

        <!-- Payment Methods -->
        <!-- <div class="card border-0 shadow-sm mb-4">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Payment Methods</h5>
          </div>
          <div class="card-body">
            <div class="d-grid gap-2">
              <button class="btn btn-primary d-flex align-items-center justify-content-between">
                <span>
                  <i class="bi bi-credit-card me-2"></i>
                  Debit/Credit Card
                </span>
                <i class="bi bi-arrow-right"></i>
              </button>
              <button class="btn btn-outline-success d-flex align-items-center justify-content-between">
                <span>
                  <i class="bi bi-bank me-2"></i>
                  Bank Transfer
                </span>
                <i class="bi bi-arrow-right"></i>
              </button>
              <button class="btn btn-outline-info d-flex align-items-center justify-content-between">
                <span>
                  <i class="bi bi-phone me-2"></i>
                  Mobile Payment
                </span>
                <i class="bi bi-arrow-right"></i>
              </button>
            </div>
          </div>
        </div> -->

        <!-- Quick Actions -->
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Quick Actions</h5>
          </div>
          <div class="card-body">
            <div class="d-grid gap-2">
              <button class="btn btn-outline-primary">
                <i class="bi bi-receipt me-2"></i>View All Receipts
              </button>
              <button class="btn btn-outline-secondary">
                <i class="bi bi-file-earmark-pdf me-2"></i>Fee Structure
              </button>
              <button class="btn btn-outline-info">
                <i class="bi bi-question-circle me-2"></i>Payment Help
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Outstanding Payments Modal -->
    <div 
      class="modal fade" 
      id="paymentModal" 
      tabindex="-1" 
      aria-labelledby="paymentModalLabel" 
      aria-hidden="true"
      :class="{ show: showPaymentModal }"
      :style="{ display: showPaymentModal ? 'block' : 'none' }"
    >
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="paymentModalLabel">
              <i class="bi bi-credit-card me-2 text-primary"></i>
              Outstanding Payments
            </h5>
            <button 
              type="button" 
              class="btn-close" 
              @click="closePaymentModal"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <div class="alert alert-warning d-flex align-items-center" role="alert">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                <div>
                  You have <strong>{{ paymentSummary?.unpaidFees?.length || 0 }}</strong> 
                  outstanding payment(s) totaling 
                  <strong>{{ formatCurrency(paymentSummary?.totalUnpaid || 0) }}</strong>
                </div>
              </div>
            </div>

            <div class="table-responsive">
              <table class="table table-hover">
                <thead class="table-light">
                  <tr>
                    <th class="fw-bold">Payment Description</th>
                    <th class="fw-bold text-end">Amount</th>
                    <th class="fw-bold text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="unpaidFee in (paymentSummary?.unpaidFees || [])" :key="unpaidFee.id">
                    <td class="py-3">
                      <div>
                        <div class="fw-bold text-dark">{{ unpaidFee.name }}</div>
                        <small class="text-muted">{{ unpaidFee.description }}</small>
                      </div>
                    </td>
                    <td class="py-3 text-end">
                      <span class="fw-bold text-warning fs-5">{{ formatCurrency(unpaidFee.amount) }}</span>
                    </td>
                    <td class="py-3 text-center">
                      <button 
                        class="btn btn-success px-4 py-2" 
                        @click="makePaymentFromModal(unpaidFee.id)"
                        :disabled="isPaymentLoading"
                      >
                        <span v-if="isPaymentLoading" class="spinner-border spinner-border-sm me-2"></span>
                        <i v-else class="bi bi-credit-card me-2"></i>
                        Pay Now
                      </button>
                    </td>
                  </tr>
                </tbody>
                <tfoot class="table-light">
                  <tr>
                    <th class="py-3">Total Outstanding</th>
                    <th class="py-3 text-end">
                      <span class="fw-bold text-danger fs-4">{{ formatCurrency(paymentSummary?.totalUnpaid || 0) }}</span>
                    </th>
                    <th class="py-3"></th>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Empty State -->
            <div v-if="(paymentSummary?.unpaidFees?.length || 0) === 0" class="text-center py-5">
              <i class="bi bi-check-circle text-success mb-3" style="font-size: 3rem;"></i>
              <h5 class="text-success">All Payments Up to Date!</h5>
              <p class="text-muted mb-0">You have no outstanding payments at this time.</p>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closePaymentModal">
              Close
            </button>
            <button 
              type="button" 
              class="btn btn-primary"
              @click="closePaymentModal"
              v-if="(paymentSummary?.unpaidFees?.length || 0) > 0"
            >
              <i class="bi bi-arrow-left me-2"></i>
              Continue Later
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Backdrop -->
    <div 
      v-if="showPaymentModal" 
      class="modal-backdrop fade show"
      @click="closePaymentModal"
    ></div>
  </div>
</template>

<style scoped>
.finance {
  background-color: #f8f9fa;
  min-height: calc(100vh - 70px);
}

.payment-summary-item:last-child.border-bottom {
  border-bottom: none !important;
}

.card {
  transition: transform 0.2s ease-in-out;
}

.card:hover {
  transform: translateY(-2px);
}

.table-warning {
  background-color: rgba(255, 193, 7, 0.1);
}

code {
  background-color: #f8f9fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.875em;
}

/* Modal Styles */
.modal {
  z-index: 1050;
}

.modal-backdrop {
  z-index: 1040;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal.show {
  display: block !important;
}

.modal-dialog-centered {
  display: flex;
  align-items: center;
  min-height: calc(100vh - 3.5rem);
}

/* Payment modal specific styles */
.modal-body .table th {
  border-top: none;
}

.modal-body .alert {
  border-radius: 8px;
}

.btn-success:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>