<script>
import { paymentService } from "../../services/payment.js";
import { useAuth } from "../../services/auth.js";
import { logger } from "@shared/utils/logger";

export default {
  name: "Payment",
  setup() {
    const { user, isAuthenticated, application } = useAuth();
    return {
      user,
      isAuthenticated,
      application,
    };
  },
  data() {
    return {
      loading: true,
      error: null,
      paidFees: [],
      unpaidFees: [],
      totalPaid: 0,
      totalUnpaid: 0,
      selectedReceipt: null,
      paymentLoading: {}, // Track loading state for each payment button
    };
  },
  async mounted() {
    await this.fetchPayments();
  },
  methods: {
    async fetchPayments() {
      try {
        this.loading = true;
        this.error = null;

        logger.info("Fetching payment data for user:", this.user?.id);
        const result = await paymentService.getPaymentsSummary();

        if (result.success) {
          this.paidFees = result.data.paidFees || [];
          this.unpaidFees = result.data.unpaidFees || [];
          this.totalPaid = result.data.totalPaid || 0;
          this.totalUnpaid = result.data.totalUnpaid || 0;

          logger.info("Payment data loaded:", {
            paidCount: this.paidFees.length,
            unpaidCount: this.unpaidFees.length,
            totalPaid: this.totalPaid,
            totalUnpaid: this.totalUnpaid,
          });
        } else {
          this.error = result.message || "Failed to load payment data";
          logger.error("Failed to fetch payments:", result);
        }
      } catch (error) {
        this.error = "An error occurred while loading payment data";
        logger.error("Error in fetchPayments:", error);
      } finally {
        this.loading = false;
      }
    },

    async initiatePayment(fee) {
      try {
        // Set loading state for this specific payment
        this.paymentLoading[fee.id] = true;

        // Clear any previous errors
        this.error = null;

        logger.info("Initiating payment for fee:", fee);

        if (!this.user?.email) {
          this.error = "User email not found. Please log in again.";
          return;
        }

        // Launch Paystack payment popup
        const result = await paymentService.launchPaystackPayment({
          amount: fee.amount,
          email: this.user.email,
          firstName: this.user.firstName || "Student",
          lastName: this.user.lastName || "",
          paymentType: fee.id,
          description: fee.name,
        });

        if (result.success) {
          logger.info("Payment completed successfully:", result);

          // Refresh payment data to show updated status
          await this.fetchPayments();

          // Show success message
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
          logger.error("Payment failed:", result);
          this.error = result.message || "Payment failed. Please try again.";
        }
      } catch (error) {
        logger.error("Error initiating payment:", error);
        this.error = "Failed to initiate payment. Please try again.";
      } finally {
        // Clear loading state for this payment
        this.paymentLoading[fee.id] = false;
      }
    },

    viewReceipt(fee) {
      this.selectedReceipt = fee;
      logger.info("Viewing receipt for:", fee);
    },

    formatCurrency(amount) {
      return paymentService.formatCurrency(amount);
    },

    formatDate(date) {
      return paymentService.formatDate(date);
    },

    isPaymentLoading(feeId) {
      return this.paymentLoading[feeId] || false;
    },

    isPaymentAvailable(fee) {
      // Map payment codes to their required stages
      const paymentStageMap = {
        portalFee: 2, // Portal fee (Form fee) available at stage 2
        acceptanceFee: 5, // Acceptance fee available at stage 5
        administrativeFee: 7, // Administrative fee available at stage 7
        schoolFee: 8, // School fee available at stage 8
      };

      const requiredStage = paymentStageMap[fee.paymentCode];
      return requiredStage && this.application?.currentStage === requiredStage;
    },

    getRequiredStage(paymentCode) {
      const paymentStageMap = {
        portalFee: 2, // Portal fee (Form fee) available at stage 2
        acceptanceFee: 5, // Acceptance fee available at stage 5
        administrativeFee: 7, // Administrative fee available at stage 7
        schoolFee: 8, // School fee available at stage 8
      };
      return paymentStageMap[paymentCode] || "Unknown";
    },
  },
  components: {},
};
</script>
<template>
  <div class="mt-3 p-5">
    <h5>Payments</h5>
    <hr />

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Loading payment information...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-danger" role="alert">
      <i class="bi bi-exclamation-triangle"></i>
      {{ error }}
      <button @click="fetchPayments" class="btn btn-outline-danger btn-sm ms-2">
        Try Again
      </button>
    </div>

    <!-- Payment Data -->
    <div v-else class="row">
      <div class="col-md-8 mx-auto">
        <!-- Unpaid Charges -->
        <div class="mb-5">
          <h6 class="fw-bold">
            Unpaid Charges
            <span
              v-if="unpaidFees.length > 0"
              class="badge bg-warning text-dark ms-2"
            >
              {{ unpaidFees.length }}
            </span>
          </h6>

          <div
            v-if="unpaidFees.length === 0"
            class="alert alert-success"
            role="alert"
          >
            <i class="bi bi-check-circle"></i>
            All fees have been paid!
          </div>

          <ul v-else class="list-unstyled">
            <li
              v-for="fee in unpaidFees"
              :key="fee.id"
              class="d-flex justify-content-between align-items-center mb-4"
            >
              <div class="d-grid">
                <span>{{ fee.name }}</span>
                <span class="fw-bold">{{ formatCurrency(fee.amount) }}</span>
                <small v-if="!isPaymentAvailable(fee)" class="text-warning">
                  <i class="bi bi-info-circle"></i>
                  <!-- Available at stage {{ getRequiredStage(fee.paymentCode) }} -->
                  Not available yet
                </small>
              </div>
              <button
                @click="initiatePayment(fee)"
                :disabled="isPaymentLoading(fee.id) || !isPaymentAvailable(fee)"
                :class="[
                  'btn',
                  'btn-acon-primary',
                  'btn-sm',
                  { loading: isPaymentLoading(fee.id) },
                ]"
              >
                <span
                  v-if="isPaymentLoading(fee.id)"
                  class="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                {{ isPaymentLoading(fee.id) ? "Processing..." : "Pay Now" }}
              </button>
            </li>
          </ul>

          <!-- <div v-if="unpaidFees.length > 0" class="mt-3">
            <strong>Total Unpaid: {{ formatCurrency(totalUnpaid) }}</strong>
          </div> -->
        </div>

        <!-- Paid Charges -->
        <div class="mb-5">
          <h6 class="fw-bold">
            Paid Charges
            <span v-if="paidFees.length > 0" class="badge bg-success ms-2">
              {{ paidFees.length }}
            </span>
          </h6>

          <div
            v-if="paidFees.length === 0"
            class="alert alert-info"
            role="alert"
          >
            <i class="bi bi-info-circle"></i>
            No payments have been made yet.
          </div>

          <ul v-else class="list-unstyled">
            <li
              v-for="fee in paidFees"
              :key="fee.id"
              class="d-flex justify-content-between align-items-center mb-3 p-3 border rounded bg-light"
            >
              <div class="d-grid">
                <span>{{ fee.name }}</span>
                <span class="fw-bold">{{ formatCurrency(fee.amount) }}</span>
                <!-- <small v-if="fee.paidAt" class="text-success">
                  <i class="bi bi-check-circle"></i>
                  Paid on {{ formatDate(fee.paidAt) }}
                </small> -->
              </div>
              <button
                @click="viewReceipt(fee)"
                class="btn btn-outline-secondary btn-sm"
                type="button"
                data-bs-toggle="offcanvas"
                data-bs-target="#offcanvasViewReceipt"
                aria-controls="offcanvasViewReceipt"
              >
                View Receipt
              </button>
            </li>
          </ul>

          <!-- <div v-if="paidFees.length > 0" class="mt-3">
            <strong>Total Paid: {{ formatCurrency(totalPaid) }}</strong>
          </div> -->
        </div>
      </div>
    </div>

    <!-- View Receipt OffCanvas -->
    <div
      class="offcanvas offcanvas-end"
      tabindex="-1"
      id="offcanvasViewReceipt"
      aria-labelledby="offcanvasViewReceiptLabel"
    >
      <div class="offcanvas-header">
        <h5 class="offcanvas-title fw-bold" id="offcanvasViewReceiptLabel">
          Payment Receipt
        </h5>
        <button
          type="button"
          class="btn-close"
          data-bs-dismiss="offcanvas"
          aria-label="Close"
        ></button>
      </div>
      <div class="offcanvas-body" v-if="selectedReceipt">
        <div class="d-grid text-center mb-5">
          <h5 class="fw-bold acon-text-primary">
            {{ formatCurrency(selectedReceipt.amount) }}
          </h5>
          <span>{{ selectedReceipt.name }}</span>
          <small class="text-body-secondary">
            on {{ formatDate(selectedReceipt.paidAt) }}
          </small>
        </div>

        <div class="mb-5">
          <ul class="list-group list-group-flush">
            <li class="list-group-item d-grid">
              <small>Description</small>
              <span class="fw-bold">{{
                selectedReceipt.description || selectedReceipt.name
              }}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <div class="d-grid">
                <small>Payment Method</small>
                <span class="fw-bold">{{
                  selectedReceipt.channel || "Paystack"
                }}</span>
              </div>
              <div class="d-grid text-center">
                <small>fees</small>
                <span class="badge rounded-pill acon-bg-secondary">{{
                  formatCurrency(selectedReceipt.fee || 0)
                }}</span>
              </div>
            </li>
            <li class="list-group-item">
              <div class="d-grid">
                <small>Reference</small>
                <span class="fw-bold">{{ selectedReceipt.reference }}</span>
              </div>
            </li>
            <li class="list-group-item">
              <div class="d-flex flex-column align-items-start">
                <small>Status</small>
                <span class="text-success fs-6 fw-bolder mt-2">{{
                  selectedReceipt.status || "Successful"
                }}</span>
              </div>
            </li>
          </ul>
        </div>

        <div class="d-grid gap-2 d-md-flex justify-content-md-end">
          <button class="btn btn-acon-primary me-md-2" type="button">
            Download PDF
          </button>
          <button class="btn btn-outline-acon-primary" type="button">
            Send to mail
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn.loading {
  opacity: 0.7;
  cursor: not-allowed;
  position: relative;
}

.btn.loading:hover {
  transform: none;
}

/* Optional: Add a subtle pulse animation to the loading button */
.btn.loading {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0% {
    opacity: 0.7;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 0.7;
  }
}
</style>
