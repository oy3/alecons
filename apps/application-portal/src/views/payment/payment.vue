<script>
import { paymentService } from "../../services/payment.js";
import { useAuthStore } from "../../stores/auth.js";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";

const ALLOWED_RECEIPT_TYPES = ["image/png", "image/jpeg", "application/pdf"];
const MAX_RECEIPT_SIZE = 1024 * 1024;

export default {
  name: "Payment",
  setup() {
    const authStore = useAuthStore();
    return { authStore };
  },
  computed: {
    user() {
      return this.authStore.user;
    },
    application() {
      return this.authStore.application;
    },
    isAuthenticated() {
      return this.authStore.isAuthenticated;
    },
    paymentMethods() {
      return paymentService.getAvailablePaymentMethods();
    },
    canUseManualTransfer() {
      const details = this.paymentMethods.manualTransferDetails;
      return this.paymentMethods.manualTransferEnabled && details.accountName && details.accountNumber && details.bankName;
    },
    canUsePaystack() {
      return this.paymentMethods.paystackEnabled;
    },
    hasAvailablePaymentMethods() {
      return this.canUsePaystack || this.canUseManualTransfer;
    },
    canSubmitManualTransfer() {
      return this.selectedPaymentMethod === "manual_transfer" && this.manualTransferConfirmed && !!this.manualTransferReceipt && !this.manualTransferSubmitting;
    },
  },
  data() {
    return {
      loading: true,
      error: null,
      paidFees: [],
      pendingFees: [],
      unpaidFees: [],
      totalPaid: 0,
      totalPending: 0,
      totalUnpaid: 0,
      selectedReceipt: null,
      paymentLoading: {},
      showPaymentMethodModal: false,
      selectedFee: null,
      selectedPaymentMethod: "",
      manualTransferConfirmed: false,
      manualTransferReceipt: null,
      manualTransferReceiptName: "",
      manualTransferSubmitting: false,
    };
  },
  async mounted() {
    if (!this.application && this.isAuthenticated) {
      try {
        await this.authStore.fetchUserData();
      } catch (error) {
        logger.error("Failed to refresh user data:", error);
      }
    }

    await this.fetchPayments();
    document.addEventListener("keydown", this.handleKeydown);
  },
  beforeUnmount() {
    document.removeEventListener("keydown", this.handleKeydown);
  },
  methods: {
    async fetchPayments() {
      try {
        this.loading = true;
        this.error = null;

        const result = await paymentService.getPaymentsSummary();

        if (result.success) {
          this.paidFees = result.data.paidFees || [];
          this.pendingFees = result.data.pendingFees || [];
          this.unpaidFees = result.data.unpaidFees || [];
          this.totalPaid = result.data.totalPaid || 0;
          this.totalPending = result.data.totalPending || 0;
          this.totalUnpaid = result.data.totalUnpaid || 0;
        } else {
          this.error = result.message || "Failed to load payment data";
        }
      } catch (error) {
        this.error = "An error occurred while loading payment data";
        logger.error("Error in fetchPayments:", error);
      } finally {
        this.loading = false;
      }
    },

    openPaymentMethodModal(fee) {
      if (!this.hasAvailablePaymentMethods) {
        Swal.fire({
          icon: "info",
          title: "Payments unavailable",
          text: "No payment methods are currently enabled for this session. Please contact support or try again later.",
        });
        return;
      }

      this.selectedFee = fee;
      this.selectedPaymentMethod = this.canUsePaystack ? "paystack" : this.canUseManualTransfer ? "manual_transfer" : "";
      this.manualTransferConfirmed = false;
      this.manualTransferReceipt = null;
      this.manualTransferReceiptName = "";
      this.showPaymentMethodModal = true;
    },

    closePaymentMethodModal() {
      if (this.manualTransferSubmitting) {
        return;
      }

      this.showPaymentMethodModal = false;
      this.selectedFee = null;
      this.selectedPaymentMethod = "";
      this.manualTransferConfirmed = false;
      this.manualTransferReceipt = null;
      this.manualTransferReceiptName = "";
    },

    async proceedWithSelectedMethod() {
      if (!this.selectedFee) {
        return;
      }

      if (this.selectedPaymentMethod === "paystack") {
        await this.initiatePaystackPayment(this.selectedFee);
      } else if (this.selectedPaymentMethod === "manual_transfer") {
        await this.submitManualTransfer();
      }
    },

    async initiatePaystackPayment(fee) {
      try {
        this.paymentLoading[fee.id] = true;
        this.error = null;

        if (!this.user?.email) {
          this.error = "User email not found. Please log in again.";
          return;
        }

        const result = await paymentService.launchPaystackPayment({
          amount: fee.amount,
          email: this.user.email,
          firstName: this.user.firstName || "Student",
          lastName: this.user.lastName || "",
          paymentType: fee.id,
          description: fee.name,
        });

        if (result.success) {
          try {
            await this.authStore.fetchUserData();
          } catch (refreshError) {
            logger.warn("Failed to refresh user data after payment:", refreshError);
          }

          await this.fetchPayments();
          this.closePaymentMethodModal();

          Swal.fire({
            toast: true,
            position: "top-end",
            icon: "success",
            title: `Payment for ${fee.name} completed successfully!`,
            text: `Reference: ${result.data.reference}`,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        } else {
          this.error = result.message || "Payment failed. Please try again.";
        }
      } catch (error) {
        logger.error("Error initiating payment:", error);
        this.error = "Failed to initiate payment. Please try again.";
      } finally {
        this.paymentLoading[fee.id] = false;
      }
    },

    onReceiptSelected(event) {
      const file = event.target.files?.[0];
      if (!file) {
        this.manualTransferReceipt = null;
        this.manualTransferReceiptName = "";
        return;
      }

      if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {
        Swal.fire({ icon: "error", title: "Invalid file type", text: "Receipt must be PNG, JPG, or PDF." });
        event.target.value = "";
        return;
      }

      if (file.size > MAX_RECEIPT_SIZE) {
        Swal.fire({ icon: "error", title: "File too large", text: "Receipt file must not be more than 1MB." });
        event.target.value = "";
        return;
      }

      this.manualTransferReceipt = file;
      this.manualTransferReceiptName = file.name;
    },

    async submitManualTransfer() {
      if (!this.selectedFee || !this.manualTransferReceipt) {
        return;
      }

      try {
        this.manualTransferSubmitting = true;
        this.paymentLoading[this.selectedFee.id] = true;

        const result = await paymentService.submitManualTransferReceipt(this.selectedFee.id, this.manualTransferReceipt);

        if (!result.success) {
          throw new Error(result.message || "Failed to submit manual transfer receipt");
        }

        await this.fetchPayments();
        this.closePaymentMethodModal();

        Swal.fire({
          icon: "success",
          title: "Receipt Submitted",
          text: "Your payment receipt has been submitted and is awaiting staff verification.",
          confirmButtonText: "OK",
        });
      } catch (error) {
        logger.error("Error submitting manual transfer receipt:", error);
        Swal.fire({ icon: "error", title: "Submission Failed", text: error.message || "Failed to submit manual transfer receipt." });
      } finally {
        this.manualTransferSubmitting = false;
        if (this.selectedFee?.id) {
          this.paymentLoading[this.selectedFee.id] = false;
        }
      }
    },

    viewReceipt(fee) {
      this.selectedReceipt = fee;
    },

    downloadReceipt(fee) {
      if (!fee?.receiptUrl) {
        Swal.fire({ icon: "info", title: "Receipt unavailable", text: "No uploaded receipt is available for this payment." });
        return;
      }

      paymentService.openReceipt(fee.receiptUrl);
    },

    formatCurrency(amount) {
      return paymentService.formatCurrency(amount);
    },

    formatDate(date) {
      return paymentService.formatDate(date);
    },

    getStatusBadgeClass(status) {
      return paymentService.getStatusBadgeClass(status);
    },

    getStatusText(status) {
      return paymentService.getStatusText(status);
    },

    isPaymentLoading(feeId) {
      return this.paymentLoading[feeId] || false;
    },

    isPaymentAvailable(fee) {
      const paymentStageMap = { formFee: 2, acceptanceFee: 7, sundryFee: 8, schoolFee: 9, accommodationFee: 10 };
      const requiredStage = paymentStageMap[fee.paymentCode];
      return requiredStage && this.application?.currentStage === requiredStage;
    },

    getMethodLabel(fee) {
      if (fee.method === "manual_transfer") {
        return "Manual Transfer";
      }
      if (fee.channel) {
        return fee.channel.replace(/_/g, " ");
      }
      return "Paystack";
    },

    handleKeydown(event) {
      if (event.key === "Escape" && this.showPaymentMethodModal) {
        this.closePaymentMethodModal();
      }
    },
  },
};
</script>

<template>
  <div class="mt-3 p-5">
    <h5>Payments</h5>
    <hr />

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Loading payment information...</p>
    </div>

    <div v-else-if="error" class="alert alert-danger" role="alert">
      <i class="bi bi-exclamation-triangle"></i>
      {{ error }}
      <button @click="fetchPayments" class="btn btn-outline-danger btn-sm ms-2">Try Again</button>
    </div>

    <div v-else class="row">
      <div class="col-md-9 mx-auto">
        <div class="mb-5">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h6 class="fw-bold mb-0">Unpaid Charges <span v-if="unpaidFees.length > 0" class="badge bg-warning text-dark ms-2">{{ unpaidFees.length }}</span></h6>
            <span v-if="totalUnpaid > 0" class="small text-muted">Outstanding: {{ formatCurrency(totalUnpaid) }}</span>
          </div>

          <div v-if="unpaidFees.length === 0 && pendingFees.length === 0 && paidFees.length === 0" class="alert alert-info"><i class="bi bi-info-circle"></i> No fees available for your account at this time.</div>
          <div v-else-if="unpaidFees.length === 0" class="alert alert-success"><i class="bi bi-check-circle"></i> No unpaid charges at the moment.</div>

          <ul v-else class="list-unstyled">
            <li v-for="fee in unpaidFees" :key="fee.id" class="d-flex justify-content-between align-items-center mb-4">
              <div class="d-grid">
                <span>{{ fee.name }}</span>
                <span class="fw-bold">{{ formatCurrency(fee.amount) }}</span>
                <small v-if="!isPaymentAvailable(fee)" class="text-warning"><i class="bi bi-info-circle"></i> Not available yet</small>
                <small v-else-if="!hasAvailablePaymentMethods" class="text-warning"><i class="bi bi-info-circle"></i> No payment methods enabled for this session</small>
              </div>
              <button @click="openPaymentMethodModal(fee)" :disabled="isPaymentLoading(fee.id) || !isPaymentAvailable(fee) || !hasAvailablePaymentMethods" :class="['btn', 'btn-acon-primary', 'btn-sm', { loading: isPaymentLoading(fee.id) }]">
                <span v-if="isPaymentLoading(fee.id)" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {{ isPaymentLoading(fee.id) ? "Processing..." : "Pay Now" }}
              </button>
            </li>
          </ul>
        </div>

        <div class="mb-5">
          <h6 class="fw-bold">Pending Verification <span v-if="pendingFees.length > 0" class="badge bg-warning text-dark ms-2">{{ pendingFees.length }}</span></h6>
          <div v-if="pendingFees.length === 0" class="alert alert-light border"><i class="bi bi-clock-history"></i> No payments are awaiting staff verification.</div>
          <ul v-else class="list-unstyled">
            <li v-for="fee in pendingFees" :key="`pending-${fee.reference}`" class="d-flex justify-content-between align-items-center mb-3 p-3 border rounded bg-warning-subtle">
              <div class="d-grid gap-1">
                <span>{{ fee.name }}</span>
                <span class="fw-bold">{{ formatCurrency(fee.amount) }}</span>
                <small class="text-muted">{{ fee.remarks || "Payment successful but not verified by staff." }}</small>
                <small class="text-muted">Reference: {{ fee.reference }}</small>
              </div>
              <div class="d-flex flex-column align-items-end gap-2">
                <span class="badge rounded-pill" :class="getStatusBadgeClass(fee.status)">{{ getStatusText(fee.status) }}</span>
                <button v-if="fee.receiptUrl" @click="downloadReceipt(fee)" class="btn btn-outline-secondary btn-sm" type="button">View Uploaded Receipt</button>
              </div>
            </li>
          </ul>
        </div>

        <div class="mb-5">
          <h6 class="fw-bold">Paid Charges <span v-if="paidFees.length > 0" class="badge bg-success ms-2">{{ paidFees.length }}</span></h6>
          <div v-if="paidFees.length === 0" class="alert alert-info"><i class="bi bi-info-circle"></i> No verified payments have been recorded yet.</div>
          <ul v-else class="list-unstyled">
            <li v-for="fee in paidFees" :key="fee.reference || fee.id" class="d-flex justify-content-between align-items-center mb-3 p-3 border rounded bg-light">
              <div class="d-grid">
                <span>{{ fee.name }}</span>
                <span class="fw-bold">{{ formatCurrency(fee.amount) }}</span>
              </div>
              <button @click="viewReceipt(fee)" class="btn btn-outline-secondary btn-sm" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasViewReceipt" aria-controls="offcanvasViewReceipt">View Receipt</button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="offcanvas offcanvas-end" tabindex="-1" id="offcanvasViewReceipt" aria-labelledby="offcanvasViewReceiptLabel">
      <div class="offcanvas-header">
        <h5 class="offcanvas-title fw-bold" id="offcanvasViewReceiptLabel">Payment Receipt</h5>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
      </div>
      <div class="offcanvas-body" v-if="selectedReceipt">
        <div class="d-grid text-center mb-5">
          <h5 class="fw-bold acon-text-primary">{{ formatCurrency(selectedReceipt.amount) }}</h5>
          <span>{{ selectedReceipt.name }}</span>
          <small class="text-body-secondary">on {{ formatDate(selectedReceipt.paidAt || selectedReceipt.receiptUploadedAt) }}</small>
        </div>

        <div class="mb-5">
          <ul class="list-group list-group-flush">
            <li class="list-group-item d-grid"><small>Description</small><span class="fw-bold">{{ selectedReceipt.description || selectedReceipt.name }}</span></li>
            <li class="list-group-item d-flex justify-content-between">
              <div class="d-grid"><small>Payment Method</small><span class="fw-bold text-capitalize">{{ getMethodLabel(selectedReceipt) }}</span></div>
              <div class="d-grid text-center"><small>Fees</small><span class="badge rounded-pill acon-bg-secondary">{{ formatCurrency(selectedReceipt.fee || 0) }}</span></div>
            </li>
            <li class="list-group-item"><div class="d-grid"><small>Reference</small><span class="fw-bold">{{ selectedReceipt.reference }}</span></div></li>
            <li class="list-group-item"><div class="d-flex flex-column align-items-start"><small>Status</small><span class="badge rounded-pill mt-2" :class="getStatusBadgeClass(selectedReceipt.status)">{{ getStatusText(selectedReceipt.status) }}</span></div></li>
            <li v-if="selectedReceipt.remarks" class="list-group-item d-grid"><small>Remarks</small><span class="fw-bold">{{ selectedReceipt.remarks }}</span></li>
          </ul>
        </div>

        <div class="d-grid gap-2 d-md-flex justify-content-md-end">
          <button v-if="selectedReceipt.receiptUrl" class="btn btn-acon-primary me-md-2" type="button" @click="downloadReceipt(selectedReceipt)">View Uploaded Receipt</button>
        </div>
      </div>
    </div>

    <div class="modal fade" :class="{ show: showPaymentMethodModal }" :style="{ display: showPaymentMethodModal ? 'block' : 'none' }" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-wallet2 me-2 text-primary"></i> Choose Payment Method</h5>
            <button type="button" class="btn-close" @click="closePaymentMethodModal"></button>
          </div>
          <div class="modal-body" v-if="selectedFee">
            <div class="alert alert-light border d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
              <div><div class="fw-bold">{{ selectedFee.name }}</div><small class="text-muted">{{ selectedFee.description }}</small></div>
              <div class="fw-bold text-primary">{{ formatCurrency(selectedFee.amount) }}</div>
            </div>

            <div class="row g-3 mb-4">
              <div class="col-md-6">
                <button class="btn w-100 payment-method-card" :class="selectedPaymentMethod === 'paystack' ? 'btn-primary' : 'btn-outline-primary'" :disabled="!canUsePaystack" @click="selectedPaymentMethod = 'paystack'">
                  <i class="bi bi-credit-card-2-front me-2"></i> Paystack
                  <small class="d-block mt-1 opacity-75">Pay instantly online</small>
                </button>
              </div>
              <div class="col-md-6">
                <button class="btn w-100 payment-method-card" :class="selectedPaymentMethod === 'manual_transfer' ? 'btn-success' : 'btn-outline-success'" :disabled="!canUseManualTransfer" @click="selectedPaymentMethod = 'manual_transfer'">
                  <i class="bi bi-bank me-2"></i> Manual Transfer
                  <small class="d-block mt-1 opacity-75">Transfer and upload receipt</small>
                </button>
              </div>
            </div>

            <div v-if="!hasAvailablePaymentMethods" class="alert alert-warning mb-0">
              <i class="bi bi-exclamation-circle me-2"></i>
              No payment methods are currently enabled for this session.
            </div>

            <div v-if="selectedPaymentMethod === 'paystack'" class="alert alert-info mb-0"><i class="bi bi-info-circle me-2"></i> You will be redirected to the Paystack popup to complete this payment.</div>

            <div v-if="selectedPaymentMethod === 'manual_transfer'" class="manual-transfer-panel border rounded p-3 bg-light">
              <h6 class="fw-bold mb-3">Transfer to the account below</h6>
              <div class="row g-3 mb-3">
                <div class="col-md-4"><small class="text-muted d-block">Account Name</small><span class="fw-semibold">{{ paymentMethods.manualTransferDetails.accountName }}</span></div>
                <div class="col-md-4"><small class="text-muted d-block">Account Number</small><span class="fw-semibold">{{ paymentMethods.manualTransferDetails.accountNumber }}</span></div>
                <div class="col-md-4"><small class="text-muted d-block">Bank Name</small><span class="fw-semibold">{{ paymentMethods.manualTransferDetails.bankName }}</span></div>
              </div>

              <div class="alert alert-warning small mb-3"><i class="bi bi-exclamation-circle me-2"></i> {{ paymentMethods.manualTransferDetails.note }}</div>

              <div class="form-check mb-3">
                <input id="manualTransferConfirmed" v-model="manualTransferConfirmed" class="form-check-input" type="checkbox" />
                <label class="form-check-label" for="manualTransferConfirmed">I have completed the transfer and I want to upload the payment receipt.</label>
              </div>

              <div v-if="manualTransferConfirmed" class="mb-2">
                <label class="form-label fw-semibold">Upload receipt (PNG, JPG, or PDF, max 1MB)</label>
                <input class="form-control" type="file" accept=".png,.jpg,.jpeg,.pdf" @change="onReceiptSelected" />
                <small v-if="manualTransferReceiptName" class="text-muted d-block mt-2">Selected: {{ manualTransferReceiptName }}</small>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" @click="closePaymentMethodModal">Cancel</button>
            <button v-if="selectedPaymentMethod === 'paystack'" type="button" class="btn btn-primary" :disabled="!selectedFee || isPaymentLoading(selectedFee.id)" @click="proceedWithSelectedMethod">Continue to Paystack</button>
            <button v-else-if="selectedPaymentMethod === 'manual_transfer'" type="button" class="btn btn-success" :disabled="!canSubmitManualTransfer" @click="proceedWithSelectedMethod"><span v-if="manualTransferSubmitting" class="spinner-border spinner-border-sm me-2"></span>Submit Receipt</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showPaymentMethodModal" class="modal-backdrop fade show" @click="closePaymentMethodModal"></div>
  </div>
</template>

<style scoped>
.btn.loading {
  opacity: 0.7;
  cursor: not-allowed;
  position: relative;
  animation: pulse 1.5s ease-in-out infinite;
}

.btn.loading:hover {
  transform: none;
}

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

.payment-method-card {
  min-height: 96px;
}

.manual-transfer-panel {
  border-style: dashed;
}

@keyframes pulse {
  0% { opacity: 0.7; }
  50% { opacity: 0.5; }
  100% { opacity: 0.7; }
}
</style>
