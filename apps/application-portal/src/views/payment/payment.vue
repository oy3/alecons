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
    selectedManualTransferDetails() {
      return (
        this.selectedFee?.manualTransferDetails ||
        this.paymentMethods.manualTransferDetails
      );
    },
    canUseManualTransfer() {
      const details = this.selectedManualTransferDetails;
      return (
        this.paymentMethods.manualTransferEnabled &&
        details.accountName &&
        details.accountNumber &&
        details.bankName
      );
    },
    canUsePaystack() {
      return this.paymentMethods.paystackEnabled;
    },
    hasAvailablePaymentMethods() {
      return this.canUsePaystack || this.canUseManualTransfer;
    },
    canSubmitManualTransfer() {
      return (
        this.selectedPaymentMethod === "manual_transfer" &&
        this.manualTransferConfirmed &&
        !!this.manualTransferReceipt &&
        !this.manualTransferSubmitting
      );
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
      showReceiptPreviewModal: false,
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
      if (!this.hasAvailablePaymentMethodsForFee(fee)) {
        Swal.fire({
          icon: "info",
          title: "Payments unavailable",
          text: "No payment methods are currently enabled for this session. Please contact support or try again later.",
        });
        return;
      }

      this.selectedFee = fee;
      this.selectedPaymentMethod = this.canUsePaystackForFee(fee)
        ? "paystack"
        : this.canUseManualTransferForFee(fee)
          ? "manual_transfer"
          : "";
      this.manualTransferConfirmed = false;
      this.manualTransferReceipt = null;
      this.manualTransferReceiptName = "";
      this.showPaymentMethodModal = true;
    },

    closePaymentMethodModal(force = false) {
      if (this.manualTransferSubmitting && !force) {
        return;
      }

      this.showPaymentMethodModal = false;
      this.selectedFee = null;
      this.selectedPaymentMethod = "";
      this.manualTransferConfirmed = false;
      this.manualTransferReceipt = null;
      this.manualTransferReceiptName = "";
    },

    openReceiptPreview(fee) {
      if (!fee?.receiptUrl) {
        Swal.fire({
          icon: "info",
          title: "Receipt unavailable",
          text: "No uploaded receipt is available for this payment.",
        });
        return;
      }

      this.selectedReceipt = fee;
      this.showReceiptPreviewModal = true;
    },

    closeReceiptPreviewModal() {
      this.showReceiptPreviewModal = false;
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
            logger.warn(
              "Failed to refresh user data after payment:",
              refreshError,
            );
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
        Swal.fire({
          icon: "error",
          title: "Invalid file type",
          text: "Receipt must be PNG, JPG, or PDF.",
        });
        event.target.value = "";
        return;
      }

      if (file.size > MAX_RECEIPT_SIZE) {
        Swal.fire({
          icon: "error",
          title: "File too large",
          text: "Receipt file must not be more than 1MB.",
        });
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

      const selectedFeeId = this.selectedFee.id;

      try {
        this.manualTransferSubmitting = true;
        this.paymentLoading[selectedFeeId] = true;

        const result = await paymentService.submitManualTransferReceipt(
          selectedFeeId,
          this.manualTransferReceipt,
        );

        if (!result.success) {
          throw new Error(
            result.message || "Failed to submit manual transfer receipt",
          );
        }

        await this.fetchPayments();
        this.closePaymentMethodModal(true);

        Swal.fire({
          icon: "success",
          title: "Receipt Submitted",
          text: "Your payment receipt has been submitted and is awaiting staff verification.",
          confirmButtonText: "OK",
        });
      } catch (error) {
        logger.error("Error submitting manual transfer receipt:", error);
        Swal.fire({
          icon: "error",
          title: "Submission Failed",
          text: error.message || "Failed to submit manual transfer receipt.",
        });
      } finally {
        this.manualTransferSubmitting = false;
        this.paymentLoading[selectedFeeId] = false;
      }
    },

    viewReceipt(fee) {
      this.selectedReceipt = fee;
    },

    escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },

    formatDateTime(date) {
      if (!date) {
        return "N/A";
      }

      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
        return "N/A";
      }

      return parsedDate.toLocaleString("en-NG", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    },

    showRejectedPaymentDetails(fee) {
      const rejection = fee?.latestRejectedManualTransfer;
      if (!rejection) {
        return;
      }

      const destinationParts = [
        rejection.destinationAccountName,
        rejection.destinationBankName,
        rejection.destinationAccountNumber,
      ].filter(Boolean);

      const receiptHtml = rejection.receiptUrl
        ? `<a href="${this.escapeHtml(rejection.receiptUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-secondary btn-sm mt-2"><i class="bi bi-receipt me-1"></i>View Uploaded Receipt</a>`
        : `<div class="small text-muted mt-2">No receipt link available.</div>`;

      const html = `
        <div class="text-start">
          <div class="mb-3">
            <div class="fw-bold">${this.escapeHtml(fee.name)}</div>
            <div class="text-muted small">Reference: ${this.escapeHtml(rejection.reference || "N/A")}</div>
          </div>
          <div class="mb-2"><strong>Amount:</strong> ${this.escapeHtml(this.formatCurrency(rejection.amount || fee.amount || 0))}</div>
          <div class="mb-2"><strong>Paid At:</strong> ${this.escapeHtml(this.formatDateTime(rejection.paidAt))}</div>
          <div class="mb-2"><strong>Rejected At:</strong> ${this.escapeHtml(this.formatDateTime(rejection.rejectedAt))}</div>
          <div class="mb-2"><strong>Paid To:</strong> ${this.escapeHtml(destinationParts.join(" • ") || "N/A")}</div>
          <div class="mb-2"><strong>Receipt Uploaded:</strong> ${this.escapeHtml(this.formatDateTime(rejection.receiptUploadedAt))}</div>
          <div class="mb-2"><strong>Status:</strong> ${this.escapeHtml(this.getStatusText(rejection.status))}</div>
          <div class="mb-2"><strong>Reason:</strong><div class="mt-1 text-danger">${this.escapeHtml(rejection.verificationRemarks || rejection.remarks || "No rejection reason was provided.")}</div></div>
          ${receiptHtml}
        </div>
      `;

      Swal.fire({
        title: "Rejected Payment Details",
        html,
        confirmButtonText: "Close",
        confirmButtonColor: "#1a5f5f",
        width: 640,
      });
    },

    downloadReceipt(fee) {
      this.openReceiptPreview(fee);
    },

    getReceiptSource(receipt = this.selectedReceipt) {
      return receipt?.receiptUrl || "";
    },

    getReceiptFilename(receipt = this.selectedReceipt) {
      return receipt?.receiptOriginalName || receipt?.receiptUrl || "receipt";
    },

    getReceiptExtension(receipt = this.selectedReceipt) {
      const source = this.getReceiptFilename(receipt).split("?")[0];
      const segments = source.split(".");
      return segments.length > 1 ? segments.pop().toLowerCase() : "";
    },

    isPdfReceipt(receipt = this.selectedReceipt) {
      return this.getReceiptExtension(receipt) === "pdf";
    },

    isImageReceipt(receipt = this.selectedReceipt) {
      return ["png", "jpg", "jpeg", "webp"].includes(
        this.getReceiptExtension(receipt),
      );
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

    getManualTransferDetailsForFee(fee) {
      return (
        fee?.manualTransferDetails || this.paymentMethods.manualTransferDetails
      );
    },

    canUseManualTransferForFee(fee) {
      const details = this.getManualTransferDetailsForFee(fee);
      return (
        this.paymentMethods.manualTransferEnabled &&
        details.accountName &&
        details.accountNumber &&
        details.bankName
      );
    },

    canUsePaystackForFee() {
      return this.paymentMethods.paystackEnabled;
    },

    hasAvailablePaymentMethodsForFee(fee) {
      return (
        this.canUsePaystackForFee(fee) || this.canUseManualTransferForFee(fee)
      );
    },

    isPaymentAvailable(fee) {
      const paymentStageMap = {
        formFee: 2,
        acceptanceFee: 7,
        sundryFee: 8,
        schoolFee: 9,
        accommodationFee: 10,
      };
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
      if (event.key === "Escape" && this.showReceiptPreviewModal) {
        this.closeReceiptPreviewModal();
        return;
      }

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
      <button @click="fetchPayments" class="btn btn-outline-danger btn-sm ms-2">
        Try Again
      </button>
    </div>

    <div v-else class="row">
      <div class="col-md-9 mx-auto">
        <div class="mb-5">
          <div
            class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"
          >
            <h6 class="fw-bold mb-0">
              Unpaid Charges
              <span
                v-if="unpaidFees.length > 0"
                class="badge bg-warning text-dark ms-2"
                >{{ unpaidFees.length }}</span
              >
            </h6>
            <!-- <span v-if="totalUnpaid > 0" class="small text-muted">Outstanding: {{ formatCurrency(totalUnpaid) }}</span> -->
          </div>

          <div
            v-if="
              unpaidFees.length === 0 &&
              pendingFees.length === 0 &&
              paidFees.length === 0
            "
            class="alert alert-info"
          >
            <i class="bi bi-info-circle"></i> No fees available for your account
            at this time.
          </div>
          <div v-else-if="unpaidFees.length === 0" class="alert alert-success">
            <i class="bi bi-check-circle"></i> No unpaid charges at the moment.
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
                <div
                  v-if="fee.latestRejectedManualTransfer"
                  class="small text-danger d-flex flex-wrap align-items-center gap-2"
                >
                  <span>
                    <i class="bi bi-exclamation-octagon me-1"></i>Payment Rejected...
                  </span>
                  <button
                    type="button"
                    class="btn btn-link btn-sm text-danger p-0 text-decoration-underline"
                    @click="showRejectedPaymentDetails(fee)"
                  >
                    View why
                  </button>
                </div>
                <small v-if="!isPaymentAvailable(fee)" class="text-warning"
                  ><i class="bi bi-info-circle"></i> Not available yet</small
                >
                <small
                  v-else-if="!hasAvailablePaymentMethodsForFee(fee)"
                  class="text-warning"
                  ><i class="bi bi-info-circle"></i> No payment methods enabled
                  for this session</small
                >
              </div>
              <button
                @click="openPaymentMethodModal(fee)"
                :disabled="
                  isPaymentLoading(fee.id) ||
                  !isPaymentAvailable(fee) ||
                  !hasAvailablePaymentMethodsForFee(fee)
                "
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
        </div>

        <div class="mb-5">
          <h6 class="fw-bold">
            Pending Verification
            <span
              v-if="pendingFees.length > 0"
              class="badge bg-warning text-dark ms-2"
              >{{ pendingFees.length }}</span
            >
          </h6>
          <div v-if="pendingFees.length === 0" class="alert alert-light border">
            <i class="bi bi-clock-history"></i> No payments are awaiting staff
            verification.
          </div>
          <ul v-else class="list-unstyled">
            <li
              v-for="fee in pendingFees"
              :key="`pending-${fee.reference}`"
              class="d-flex justify-content-between align-items-center mb-3 p-3 border rounded bg-warning-subtle"
            >
              <div class="d-grid gap-1">
                <span>{{ fee.name }}</span>
                <span class="fw-bold">{{ formatCurrency(fee.amount) }}</span>
                <small class="text-muted">{{
                  fee.remarks || "Payment successful but not verified by staff."
                }}</small>
                <small class="text-muted">Reference: {{ fee.reference }}</small>
              </div>
              <div class="d-flex flex-column align-items-end gap-2">
                <span
                  class="badge rounded-pill"
                  :class="getStatusBadgeClass(fee.status)"
                  >{{ getStatusText(fee.status) }}</span
                >
                <button
                  v-if="fee.receiptUrl"
                  @click="openReceiptPreview(fee)"
                  class="btn btn-outline-secondary btn-sm"
                  type="button"
                >
                  View Uploaded Receipt
                </button>
              </div>
            </li>
          </ul>
        </div>

        <div class="mb-5">
          <h6 class="fw-bold">
            Paid Charges
            <span v-if="paidFees.length > 0" class="badge bg-success ms-2">{{
              paidFees.length
            }}</span>
          </h6>
          <div v-if="paidFees.length === 0" class="alert alert-info">
            <i class="bi bi-info-circle"></i> No verified payments have been
            recorded yet.
          </div>
          <ul v-else class="list-unstyled">
            <li
              v-for="fee in paidFees"
              :key="fee.reference || fee.id"
              class="d-flex justify-content-between align-items-center mb-3 p-3 border rounded bg-light"
            >
              <div class="d-grid">
                <span>{{ fee.name }}</span>
                <span class="fw-bold">{{ formatCurrency(fee.amount) }}</span>
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
        </div>
      </div>
    </div>

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
          <small class="text-body-secondary"
            >on
            {{
              formatDate(
                selectedReceipt.paidAt || selectedReceipt.receiptUploadedAt,
              )
            }}</small
          >
        </div>

        <div class="mb-5">
          <ul class="list-group list-group-flush">
            <li class="list-group-item d-grid">
              <small>Description</small
              ><span class="fw-bold">{{
                selectedReceipt.description || selectedReceipt.name
              }}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <div class="d-grid">
                <small>Payment Method</small
                ><span class="fw-bold text-capitalize">{{
                  getMethodLabel(selectedReceipt)
                }}</span>
              </div>
              <div class="d-grid text-center">
                <small>Fees</small
                ><span class="badge rounded-pill acon-bg-secondary">{{
                  formatCurrency(selectedReceipt.fee || 0)
                }}</span>
              </div>
            </li>
            <li class="list-group-item">
              <div class="d-grid">
                <small>Reference</small
                ><span class="fw-bold">{{ selectedReceipt.reference }}</span>
              </div>
            </li>
            <li class="list-group-item">
              <div class="d-flex flex-column align-items-start">
                <small>Status</small
                ><span
                  class="badge rounded-pill mt-2"
                  :class="getStatusBadgeClass(selectedReceipt.status)"
                  >{{ getStatusText(selectedReceipt.status) }}</span
                >
              </div>
            </li>
            <li v-if="selectedReceipt.remarks" class="list-group-item d-grid">
              <small>Remarks</small
              ><span class="fw-bold">{{ selectedReceipt.remarks }}</span>
            </li>
          </ul>
        </div>

        <div class="d-grid gap-2 d-md-flex justify-content-md-end">
          <button
            v-if="selectedReceipt.receiptUrl"
            class="btn btn-acon-primary me-md-2"
            type="button"
            @click="openReceiptPreview(selectedReceipt)"
          >
            View Uploaded Receipt
          </button>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      :class="{ show: showReceiptPreviewModal }"
      :style="{ display: showReceiptPreviewModal ? 'block' : 'none' }"
      tabindex="-1"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-xl modal-dialog-centered receipt-preview-dialog">
        <div class="modal-content receipt-preview-modal">
          <div class="modal-header border-0 pb-0">
            <div>
              <h6 class="modal-title fw-bold">Uploaded Receipt</h6>
              <p class="text-body-secondary mb-0 small" v-if="selectedReceipt">
                {{ selectedReceipt.name }} · {{ getReceiptFilename() }}
              </p>
            </div>
            <button
              type="button"
              class="btn-close"
              @click="closeReceiptPreviewModal"
            ></button>
          </div>

          <div class="modal-body pt-3" v-if="selectedReceipt">
            <div class="receipt-preview-shell">
              <img
                v-if="isImageReceipt()"
                :src="getReceiptSource()"
                :alt="getReceiptFilename()"
                class="receipt-preview-image"
              />

              <iframe
                v-else-if="isPdfReceipt()"
                :src="getReceiptSource()"
                title="Uploaded receipt preview"
                class="receipt-preview-frame"
              ></iframe>

              <div v-else class="receipt-preview-fallback text-center">
                <i class="bi bi-file-earmark-text fs-1 mb-3 d-block text-muted"></i>
                <h6 class="fw-bold">Preview unavailable</h6>
                <p class="text-body-secondary mb-0">
                  This receipt format cannot be previewed inline.
                </p>
              </div>
            </div>
          </div>

          <div class="modal-footer border-0 pt-0">
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="closeReceiptPreviewModal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      :class="{ show: showPaymentMethodModal }"
      :style="{ display: showPaymentMethodModal ? 'block' : 'none' }"
      tabindex="-1"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h6 class="modal-title">
              <i class="bi bi-wallet2 me-2 text-primary"></i> Choose Payment
              Method
            </h6>
            <button
              type="button"
              class="btn-close"
              @click="closePaymentMethodModal"
            ></button>
          </div>
          <div class="modal-body payment-modal-body" v-if="selectedFee">
            <div class="payment-modal-summary mb-4">
              <div>
                <small class="text-uppercase text-body-secondary d-block mb-1">
                  Selected fee
                </small>
                <div class="fw-bold fs-6">{{ selectedFee.name }}</div>
              </div>
              <div class="payment-modal-amount">
                <small class="text-uppercase text-body-secondary d-block mb-1">
                  Amount
                </small>
                <div class="fw-bold text-primary fs-6">
                  {{ formatCurrency(selectedFee.amount) }}
                </div>
              </div>
            </div>

            <div
              v-if="!hasAvailablePaymentMethodsForFee(selectedFee)"
              class="alert alert-warning mb-0"
            >
              <i class="bi bi-exclamation-circle me-2"></i>
              No payment methods are currently enabled for this session.
            </div>

            <div
              v-else
              class="payment-method-layout row g-0 overflow-hidden rounded-4 bg-white"
            >
              <div class="col-lg-4 payment-method-sidebar border-end">
                <div class="payment-method-sidebar-inner p-3 p-lg-4">
                  <small
                    class="text-uppercase text-body-secondary d-block mb-3"
                  >
                    Payment options
                  </small>

                  <button
                    class="payment-method-option w-100 text-start mb-3"
                    :class="{
                      active: selectedPaymentMethod === 'paystack',
                      disabled: !canUsePaystackForFee(selectedFee),
                    }"
                    :disabled="!canUsePaystackForFee(selectedFee)"
                    @click="selectedPaymentMethod = 'paystack'"
                  >
                    <span class="payment-method-option-icon paystack">
                      <i class="bi bi-credit-card-2-front"></i>
                    </span>
                    <span class="payment-method-option-copy">
                      <span class="payment-method-option-title">Paystack</span>
                      <!-- <small class="payment-method-option-text"
                        >Pay instantly online with card, transfer, or bank
                        options.</small
                      > -->
                    </span>
                  </button>

                  <button
                    class="payment-method-option w-100 text-start"
                    :class="{
                      active: selectedPaymentMethod === 'manual_transfer',
                      disabled: !canUseManualTransferForFee(selectedFee),
                    }"
                    :disabled="!canUseManualTransferForFee(selectedFee)"
                    @click="selectedPaymentMethod = 'manual_transfer'"
                  >
                    <span class="payment-method-option-icon transfer">
                      <i class="bi bi-bank"></i>
                    </span>
                    <span class="payment-method-option-copy">
                      <span class="payment-method-option-title"
                        >Manual Transfer</span
                      >
                      <!-- <small class="payment-method-option-text"
                        >Transfer to the assigned account, then upload your
                        receipt for review.</small
                      > -->
                    </span>
                  </button>
                </div>
              </div>

              <div class="col-lg-8 payment-method-details">
                <div
                  v-if="selectedPaymentMethod === 'paystack'"
                  class="p-3 p-lg-4 h-100 d-flex flex-column justify-content-between gap-4"
                >
                  <div>
                    <div class="d-flex align-items-start gap-3 mb-4">
                      <div class="payment-details-icon info">
                        <i class="bi bi-lightning-charge-fill"></i>
                      </div>
                      <div>
                        <h6 class="fw-bold mb-1">Fast online payment</h6>
                        <p class="text-body-secondary mb-0">
                          You will be redirected to the Paystack popup to
                          complete this payment securely.
                        </p>
                      </div>
                    </div>

                    <div class="row g-3">
                      <div class="col-md-12">
                        <div
                          class="payment-step-card h-100 d-flex align-items-start gap-3"
                        >
                          <span class="payment-step-number">1</span>
                          <div>
                            <h6>Select method</h6>
                            <p>
                              Continue with Paystack for an instant online
                              checkout.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div class="col-md-12">
                        <div
                          class="payment-step-card h-100 d-flex align-items-start gap-3"
                        >
                          <span class="payment-step-number">2</span>
                          <div>
                            <h6>Complete payment</h6>
                            <p>
                              Use your preferred card, bank, or transfer option
                              in the popup.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div class="col-md-12">
                        <div
                          class="payment-step-card h-100 d-flex align-items-start gap-3"
                        >
                          <span class="payment-step-number">3</span>
                          <div>
                            <h6>Get confirmation</h6>
                            <p>
                              Your payment record updates immediately after a
                              successful charge.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="payment-help-note info">
                    <i class="bi bi-shield-check me-2"></i>
                    Secure checkout powered by Paystack.
                  </div>
                </div>

                <div
                  v-else-if="selectedPaymentMethod === 'manual_transfer'"
                  class="p-3 p-lg-4 h-100 d-flex flex-column gap-4"
                >
                  <div>
                    <div class="d-flex align-items-start gap-3 mb-4">
                      <div class="payment-details-icon success">
                        <i class="bi bi-bank2"></i>
                      </div>
                      <div>
                        <h6 class="fw-bold mb-1">
                          Transfer to the account below
                        </h6>
                        <p class="text-body-secondary mb-0">
                          Use the assigned account details exactly as shown,
                          then upload your receipt for staff verification.
                        </p>
                      </div>
                    </div>

                    <div class="row g-3 mb-3">
                      <div class="col-md-6">
                        <div class="payment-detail-card h-100">
                          <small class="payment-detail-label"
                            >Account Number</small
                          >
                          <div class="payment-detail-value">
                            {{ selectedManualTransferDetails.accountNumber }}
                          </div>
                        </div>
                      </div>
                      <div class="col-md-6">
                        <div class="payment-detail-card h-100">
                          <small class="payment-detail-label">Bank Name</small>
                          <div class="payment-detail-value">
                            {{ selectedManualTransferDetails.bankName }}
                          </div>
                        </div>
                      </div>
                      <div class="col-md-12">
                        <div class="payment-detail-card h-100">
                          <small class="payment-detail-label"
                            >Account Name</small
                          >
                          <div class="payment-detail-value">
                            {{ selectedManualTransferDetails.accountName }}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="payment-help-note warning">
                      <i class="bi bi-exclamation-circle me-2"></i>
                      {{ selectedManualTransferDetails.note }}
                    </div>
                  </div>

                  <div
                    class="manual-transfer-actions border rounded-4 p-3 p-lg-4 bg-light-subtle"
                  >
                    <div class="form-check mb-3">
                      <input
                        id="manualTransferConfirmed"
                        v-model="manualTransferConfirmed"
                        class="form-check-input"
                        type="checkbox"
                      />
                      <label
                        class="form-check-label fw-medium"
                        for="manualTransferConfirmed"
                        >I have completed the transfer and I want to upload the
                        payment receipt.</label
                      >
                    </div>

                    <div
                      v-if="manualTransferConfirmed"
                      class="receipt-upload-panel"
                    >
                      <label class="form-label fw-semibold h6"
                        >Upload receipt</label
                      >
                      <input
                        class="form-control"
                        type="file"
                        accept=".png,.jpg,.jpeg,.pdf"
                        @change="onReceiptSelected"
                      />
                      <div class="small text-body-secondary mt-2">
                        Accepted formats: PNG, JPG, PDF. Maximum file size: 1MB.
                      </div>
                      <div
                        v-if="manualTransferReceiptName"
                        class="selected-receipt-chip mt-3"
                      >
                        <i class="bi bi-paperclip me-2"></i>
                        Selected: {{ manualTransferReceiptName }}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  v-else
                  class="p-4 h-100 d-flex align-items-center justify-content-center text-center text-body-secondary"
                >
                  <div>
                    <i class="bi bi-wallet2 fs-1 d-block mb-3"></i>
                    <p class="mb-0">
                      Select a payment option to view the next step.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="closePaymentMethodModal"
            >
              Cancel
            </button>
            <button
              v-if="selectedPaymentMethod === 'paystack'"
              type="button"
              class="btn btn-primary"
              :disabled="!selectedFee || isPaymentLoading(selectedFee.id)"
              @click="proceedWithSelectedMethod"
            >
              Continue to Paystack
            </button>
            <button
              v-else-if="selectedPaymentMethod === 'manual_transfer'"
              type="button"
              class="btn btn-success"
              :disabled="!canSubmitManualTransfer"
              @click="proceedWithSelectedMethod"
            >
              <span
                v-if="manualTransferSubmitting"
                class="spinner-border spinner-border-sm me-2"
              ></span
              >Submit Receipt
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showPaymentMethodModal"
      class="modal-backdrop fade show"
      @click="closePaymentMethodModal"
    ></div>

    <div
      v-if="showReceiptPreviewModal"
      class="modal-backdrop fade show"
      @click="closeReceiptPreviewModal"
    ></div>
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

.modal-dialog {
  max-width: 920px;
}

.modal-content {
  height: min(780px, calc(100vh - 3rem));
  max-height: calc(100vh - 3rem);
  overflow: hidden;
}

.payment-modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: linear-gradient(180deg, #fcfdff 0%, #f8fafc 100%);
}

.payment-modal-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid rgba(13, 110, 253, 0.12);
  border-radius: 1rem;
  background: #f8fbff;
}

.payment-modal-amount {
  text-align: right;
}

.payment-method-sidebar {
  background: #fff;
}

.payment-method-sidebar-inner {
  height: 100%;
}

.payment-method-option {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem;
  border: 1px solid #dee2e6;
  border-radius: 1rem;
  background: #fff;
  transition: all 0.2s ease;
}

.payment-method-option:hover:not(:disabled) {
  border-color: rgba(13, 110, 253, 0.35);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.payment-method-option.active {
  border-color: transparent;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
}

.payment-method-option.active .payment-method-option-icon {
  background: rgba(13, 110, 253, 0.12);
  color: #0d6efd;
}

/* .payment-method-option.active .payment-method-option-icon.transfer {
  background: rgba(25, 135, 84, 0.12);
  color: #198754;
} */

.payment-method-option.active {
  background: linear-gradient(180deg, #f7fbff 0%, #eef6ff 100%);
  font-weight: 700;
}

/* .payment-method-option.active:last-of-type {
  background: linear-gradient(180deg, #f8fff9 0%, #eefaf2 100%);
} */

.payment-method-option.disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.payment-method-option-icon,
.payment-details-icon {
  width: 2.75rem;
  height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.9rem;
  font-size: 1.15rem;
  flex-shrink: 0;
}

.payment-method-option-icon {
  background: #f1f3f5;
  color: #495057;
}

.payment-details-icon.info {
  background: rgba(13, 110, 253, 0.12);
  color: #0d6efd;
}

.payment-details-icon.success {
  background: rgba(25, 135, 84, 0.12);
  color: #198754;
}

.payment-method-option-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.payment-method-option-title {
  display: block;
  /* font-weight: 500; */
  color: #212529;
  /* margin-bottom: 0.25rem; */
}

.payment-method-option-text {
  display: block;
  color: #6c757d;
  line-height: 1.45;
}

.payment-detail-card {
  border: 1px solid #e9ecef;
  border-radius: 1rem;
  padding: 1rem;
  background: #fff;
}

.payment-step-card h6,
.payment-detail-card .payment-detail-value {
  margin-bottom: 0;
}

.payment-step-card p {
  margin: 0.5rem 0 0;
  color: #6c757d;
  font-size: 0.925rem;
  line-height: 1.45;
}

.payment-step-number {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(13, 110, 253, 0.1);
  color: #0d6efd;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.payment-detail-label {
  display: block;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6c757d;
  margin-bottom: 0.4rem;
}

.payment-detail-value {
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.35;
  word-break: break-word;
}

.payment-help-note {
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  font-size: 0.95rem;
}

.payment-help-note.info {
  background: rgba(13, 110, 253, 0.08);
  color: #084298;
}

.payment-help-note.warning {
  background: #fff3cd;
  color: #997404;
  border: 1px solid #ffe69c;
}

.receipt-preview-dialog {
  max-width: 1100px;
}

.receipt-preview-modal {
  height: min(92vh, 920px);
  max-height: calc(100vh - 2rem);
}

.receipt-preview-shell {
  height: 100%;
  min-height: 60vh;
  border-radius: 1.25rem;
  background: #f8f9fb;
  border: 1px solid #e9ecef;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.receipt-preview-image {
  width: 100%;
  height: 100%;
  max-height: 70vh;
  object-fit: contain;
  background: #fff;
}

.receipt-preview-frame {
  width: 100%;
  height: 100%;
  min-height: 70vh;
  border: 0;
  background: #fff;
}

.receipt-preview-fallback {
  max-width: 28rem;
  padding: 2rem;
}

.manual-transfer-actions {
  border-color: #e9ecef !important;
}

.receipt-upload-panel {
  padding-top: 0.5rem;
}

.selected-receipt-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.625rem 0.875rem;
  border-radius: 999px;
  background: rgba(25, 135, 84, 0.1);
  color: #146c43;
  font-size: 0.9rem;
  font-weight: 600;
}

@media (max-width: 991.98px) {
  .payment-method-sidebar {
    border-right: 0 !important;
    border-bottom: 1px solid #dee2e6;
  }
}

@media (max-width: 575.98px) {
  .modal-dialog {
    max-width: none;
    margin: 0.75rem;
  }

  .modal-content {
    height: calc(100vh - 1.5rem);
    max-height: calc(100vh - 1.5rem);
  }

  .payment-modal-summary {
    flex-direction: column;
    align-items: flex-start;
  }

  .payment-modal-amount {
    text-align: left;
  }

  .receipt-preview-dialog {
    margin: 0.5rem;
  }

  .receipt-preview-modal {
    height: calc(100vh - 1rem);
    max-height: calc(100vh - 1rem);
  }

  .receipt-preview-shell {
    min-height: calc(100vh - 10rem);
  }

  .receipt-preview-image,
  .receipt-preview-frame {
    max-height: calc(100vh - 12rem);
    min-height: calc(100vh - 12rem);
  }
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
