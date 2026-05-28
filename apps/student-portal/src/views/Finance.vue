<script>
import { studentPaymentService } from "../services/payment.js";
import { tenancyAgreementService } from "../services/tenancyAgreement.js";
import { logger } from "@shared/utils/logger";
import { useAuthStore } from "../stores/auth.js";
import Swal from "sweetalert2";

const ALLOWED_RECEIPT_TYPES = ["image/png", "image/jpeg", "application/pdf"];
const MAX_RECEIPT_SIZE = 1024 * 1024;

export default {
  name: "Finance",
  data() {
    return {
      // Academic sessions
      academicSessions: [],
      selectedSessionId: "",

      // Payment data
      paymentSummary: {
        paidFees: [],
        pendingFees: [],
        unpaidFees: [],
        totalPaid: 0,
        totalPending: 0,
        totalUnpaid: 0,
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
      showPaymentModal: false,
      selectedFee: null,
      selectedPaymentMethod: "",
      manualTransferConfirmed: false,
      manualTransferReceipt: null,
      manualTransferReceiptName: "",
      manualTransferSubmitting: false,
    };
  },

  computed: {
    paymentMethods() {
      return studentPaymentService.getAvailablePaymentMethods();
    },

    accountBalance() {
      return this.paymentSummary?.totalUnpaid || 0;
    },

    totalPaidThisYear() {
      return this.paymentSummary?.totalPaid || 0;
    },

    pendingAmount() {
      return this.paymentSummary?.totalPending || 0;
    },

    hasOutstandingPayments() {
      return (this.paymentSummary?.unpaidFees?.length || 0) > 0;
    },

    canUsePaystack() {
      return this.paymentMethods.paystackEnabled;
    },

    canUseManualTransfer() {
      return (this.paymentSummary?.unpaidFees || []).some((fee) =>
        this.canUseManualTransferForFee(fee),
      );
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

    selectedManualTransferDetails() {
      return this.getManualTransferDetailsForFee(this.selectedFee);
    },
  },

  async mounted() {
    await this.initializePage();

    document.addEventListener("keydown", this.handleKeydown);
  },

  beforeUnmount() {
    document.removeEventListener("keydown", this.handleKeydown);
  },

  methods: {
    getStudentEntryYear() {
      const authStore = useAuthStore();
      const admissionYear = authStore.student?.admissionYear;

      if (typeof admissionYear === "number" && !Number.isNaN(admissionYear)) {
        return admissionYear;
      }

      return this.getSessionStartYear(
        authStore.student?.academicSession?.sessionYear ||
          authStore.application?.entryAcademicSession?.sessionYear,
      );
    },

    getSessionStartYear(sessionLabel) {
      const match = String(sessionLabel || "").match(/\d{4}/);
      return match ? Number(match[0]) : null;
    },

    filterEligibleAcademicSessions(sessions) {
      const entryYear = this.getStudentEntryYear();
      if (!entryYear) {
        return sessions;
      }

      return sessions.filter((session) => {
        const sessionYear = this.getSessionStartYear(session.sessionYear);
        return !sessionYear || sessionYear >= entryYear;
      });
    },

    async initializePage() {
      try {
        this.isLoading = true;
        this.error = null;

        const authStore = useAuthStore();
        this.user = authStore.user;

        await this.loadAcademicSessions();

        if (this.academicSessions.length > 0) {
          this.selectedSessionId = this.academicSessions[0].id;
          await this.loadPaymentData();
        }
      } catch (error) {
        logger.error("Error initializing finance page:", error);
        this.error = "Failed to load financial data";
      } finally {
        this.isLoading = false;
      }
    },

    async loadAcademicSessions() {
      try {
        logger.info("Loading academic sessions");
        const response = await studentPaymentService.getAcademicSessions();

        if (response.success) {
          const sessions = this.filterEligibleAcademicSessions(
            response.data.sessions || [],
          );
          this.academicSessions = sessions.map((session) => ({
            id: session._id,
            name: session.sessionYear,
            value: session._id,
          }));
          logger.info(
            "Loaded academic sessions:",
            this.academicSessions.length,
          );
        } else {
          throw new Error(response.message);
        }
      } catch (error) {
        logger.error("Error loading academic sessions:", error);
        this.academicSessions = [];
      }
    },

    async loadPaymentData() {
      try {
        logger.info(
          "Loading payment data for session:",
          this.selectedSessionId,
        );

        const summaryResponse = await studentPaymentService.getPaymentSummary(
          this.selectedSessionId,
        );
        if (summaryResponse.success) {
          this.paymentSummary = summaryResponse.data;
          logger.info("Loaded payment summary");
        }

        await this.loadPaymentHistory();
        await this.loadAvailablePayments();
      } catch (error) {
        logger.error("Error loading payment data:", error);
        this.error = "Failed to load payment data";
      }
    },

    async loadPaymentHistory() {
      try {
        this.isHistoryLoading = true;

        const response = await studentPaymentService.getPaymentHistory(
          this.selectedSessionId,
          this.currentPage,
          this.perPage,
        );

        if (response.success) {
          this.paymentHistory = response.data.payments;
          this.totalPages = response.data.pagination.totalPages;
          logger.info("Loaded payment history:", this.paymentHistory.length);
        }
      } catch (error) {
        logger.error("Error loading payment history:", error);
      } finally {
        this.isHistoryLoading = false;
      }
    },

    async loadAvailablePayments() {
      try {
        const response = await studentPaymentService.getAvailablePayments(
          this.selectedSessionId,
        );

        if (response.success) {
          this.availablePayments = response.data;
          logger.info(
            "Loaded available payments:",
            this.availablePayments.length,
          );
        }
      } catch (error) {
        logger.error("Error loading available payments:", error);
        this.availablePayments = [];
      }
    },

    async onSessionChange() {
      logger.info("Academic session changed to:", this.selectedSessionId);
      await this.loadPaymentData();
    },

    async makePayment(paymentId, paymentCode = null) {
      try {
        if (!this.hasAvailablePaymentMethods) {
          throw new Error(
            "No payment methods are currently enabled for this session.",
          );
        }

        if (!this.user?.email) {
          throw new Error("User email not found");
        }

        let payment = null;
        if (!paymentCode) {
          payment =
            this.paymentSummary?.unpaidFees?.find(
              (fee) => fee.id === paymentId,
            ) || this.availablePayments?.find((item) => item.id === paymentId);
          paymentCode = payment?.paymentCode || "";
        }

        this.isPaymentLoading = true;
        logger.info("Initiating payment:", paymentId);

        const response = await studentPaymentService.initializePayment(
          paymentId,
          this.user.email,
          this.selectedSessionId,
        );

        if (response.success) {
          try {
            const paymentResult =
              await studentPaymentService.launchPaystackPayment(response.data);

            if (paymentResult.success) {
              this.closePaymentModal();
              await this.loadPaymentData();

              Swal.fire({
                icon: "success",
                title: "Payment Successful!",
                text: "Your payment has been processed successfully.",
                confirmButtonText: "OK",
                timer: 3000,
                timerProgressBar: true,
              });
            }
          } catch (paymentError) {
            if (!paymentError.cancelled) {
              throw paymentError;
            }

            Swal.fire({
              icon: "info",
              title: "Payment Cancelled",
              text: "You cancelled the payment process.",
              confirmButtonText: "OK",
            });
          }
        } else {
          throw new Error(response.message);
        }
      } catch (error) {
        logger.error("Error making payment:", error);

        Swal.fire({
          icon: "error",
          title: "Payment Failed",
          text: error.message || "Payment failed. Please try again.",
          confirmButtonText: "OK",
        });
      } finally {
        this.isPaymentLoading = false;
      }
    },

    async ensureAccommodationPaymentAllowed(paymentCode) {
      if (!tenancyAgreementService.isAccommodationPayment(paymentCode)) {
        return true;
      }

      logger.info(
        "Checking tenancy agreement before opening payment methods for accommodation payment",
      );

      const eligibilityCheck =
        await tenancyAgreementService.canMakeAccommodationPayment();

      if (eligibilityCheck.canPay) {
        return true;
      }

      const result = await Swal.fire({
        icon: "warning",
        title: "Tenancy Agreement Required",
        text: "You must complete and sign the tenancy agreement before making accommodation fee payments.",
        showCancelButton: true,
        confirmButtonText: "Sign Agreement",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#28a745",
        cancelButtonColor: "#6c757d",
      });

      if (result.isConfirmed) {
        this.$router.push("/tenancy-agreement");
      }

      return false;
    },

    async openPaymentMethodStep(fee) {
      if (!this.hasAvailablePaymentMethodsForFee(fee)) {
        Swal.fire({
          icon: "info",
          title: "Payments unavailable",
          text: "No payment methods are currently enabled for this session. Please contact support or try again later.",
          confirmButtonText: "OK",
        });
        return;
      }

      if (!(await this.ensureAccommodationPaymentAllowed(fee?.paymentCode))) {
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
      this.showPaymentModal = true;
    },

    resetPaymentMethodStep() {
      this.selectedFee = null;
      this.selectedPaymentMethod = "";
      this.manualTransferConfirmed = false;
      this.manualTransferReceipt = null;
      this.manualTransferReceiptName = "";
    },

    backToOutstandingList() {
      if (this.manualTransferSubmitting) {
        return;
      }

      this.resetPaymentMethodStep();
    },

    async proceedWithSelectedMethod() {
      if (!this.selectedFee) {
        return;
      }

      if (this.selectedPaymentMethod === "paystack") {
        await this.makePayment(
          this.selectedFee.id,
          this.selectedFee.paymentCode,
        );
      } else if (this.selectedPaymentMethod === "manual_transfer") {
        await this.submitManualTransfer();
      }
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

      try {
        this.manualTransferSubmitting = true;
        this.isPaymentLoading = true;

        const result = await studentPaymentService.submitManualTransferReceipt(
          this.selectedFee.id,
          this.manualTransferReceipt,
          this.selectedSessionId,
        );

        if (!result.success) {
          throw new Error(
            result.message || "Failed to submit manual transfer receipt",
          );
        }

        await this.loadPaymentData();
        this.closePaymentModal();

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
        this.isPaymentLoading = false;
      }
    },

    async downloadReceipt(payment) {
      try {
        if (!payment?.receiptUrl) {
          Swal.fire({
            icon: "info",
            title: "Receipt unavailable",
            text: "No uploaded receipt is available for this payment.",
            confirmButtonText: "OK",
          });
          return;
        }

        logger.info("Opening receipt for payment:", payment.reference);
        studentPaymentService.openReceipt(payment.receiptUrl);
      } catch (error) {
        logger.error("Error downloading receipt:", error);
      }
    },

    async exportStatement() {
      try {
        logger.info("Exporting financial statement");
        // TODO: Implement statement export functionality
        Swal.fire({
          icon: "info",
          title: "Coming Soon",
          text: "Statement export functionality will be implemented soon.",
          confirmButtonText: "OK",
        });
      } catch (error) {
        logger.error("Error exporting statement:", error);
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
      return payment.reference || "Not generated";
    },

    showPaymentOptions() {
      const unpaidFees = this.paymentSummary?.unpaidFees || [];
      if (unpaidFees.length === 0) {
        Swal.fire({
          icon: "info",
          title: "No Outstanding Payments",
          text: "You have no pending payments at this time.",
          confirmButtonText: "OK",
        });
        return;
      }

      if (!this.hasAvailablePaymentMethods) {
        Swal.fire({
          icon: "info",
          title: "Payments unavailable",
          text: "No payment methods are currently enabled for this session. Please contact support or try again later.",
          confirmButtonText: "OK",
        });
        return;
      }

      // Open the payment modal
      this.showPaymentModal = true;
      this.resetPaymentMethodStep();
    },

    closePaymentModal() {
      if (this.manualTransferSubmitting) {
        return;
      }

      this.showPaymentModal = false;
      this.resetPaymentMethodStep();
    },

    async makePaymentFromModal(paymentId, paymentCode) {
      const fee =
        this.paymentSummary?.unpaidFees?.find(
          (item) => item.id === paymentId,
        ) || this.availablePayments?.find((item) => item.id === paymentId);

      await this.openPaymentMethodStep(
        fee || {
          id: paymentId,
          paymentCode,
        },
      );
    },

    getMethodLabel(payment) {
      if (payment?.method === "manual_transfer") {
        return "Manual Transfer";
      }

      if (payment?.channel) {
        return payment.channel.replace(/_/g, " ");
      }

      return "Paystack";
    },

    handleKeydown(event) {
      if (event.key === "Escape" && this.showPaymentModal) {
        this.closePaymentModal();
      }
    },
  },
};
</script>

<template>
  <div class="finance p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div
          class="d-flex justify-content-between align-items-center flex-wrap"
        >
          <div class="mb-2 mb-md-0">
            <h2 class="h3 fw-bold text-dark mb-1">
              <i class="bi bi-credit-card me-2 text-primary"></i>
              Financial Dashboard
            </h2>
            <p class="text-muted mb-0">
              Manage your tuition, fees, and payment history.
            </p>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <button
              class="btn btn-outline-primary btn-sm"
              @click="exportStatement"
              :disabled="isLoading"
            >
              <i class="bi bi-download me-1"></i
              ><span class="d-none d-sm-inline">Export Statement</span
              ><span class="d-sm-none">Export</span>
            </button>
            <button
              class="btn btn-success btn-sm"
              @click="showPaymentOptions"
              :disabled="
                isLoading ||
                !hasOutstandingPayments ||
                !hasAvailablePaymentMethods
              "
              v-if="hasOutstandingPayments"
            >
              <i class="bi bi-credit-card me-1"></i
              ><span class="d-none d-sm-inline">Make Payment</span
              ><span class="d-sm-none">Pay</span>
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
                <div
                  class="bg-opacity-10 rounded-3 p-3"
                  :class="accountBalance > 0 ? 'bg-danger' : 'bg-success'"
                >
                  <i
                    class="bi fs-4"
                    :class="
                      accountBalance > 0
                        ? 'bi-exclamation-triangle text-danger'
                        : 'bi-check-circle text-success'
                    "
                  ></i>
                </div>
              </div>
              <div class="flex-grow-1 ms-3">
                <h6 class="fw-bold text-dark mb-1">Balance</h6>
                <h4
                  class="fw-bold mb-0"
                  :class="accountBalance > 0 ? 'text-danger' : 'text-success'"
                >
                  {{ formatCurrency(accountBalance) }}
                </h4>
                <small
                  :class="accountBalance > 0 ? 'text-danger' : 'text-success'"
                >
                  {{ accountBalance > 0 ? "Outstanding" : "" }}
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
                <h4 class="fw-bold text-primary mb-0">
                  {{ formatCurrency(totalPaidThisYear) }}
                </h4>
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
                <h4 class="fw-bold text-warning mb-0">
                  {{ formatCurrency(pendingAmount) }}
                </h4>
                <!-- <small class="text-muted">
                  {{ paymentSummary?.pendingFees?.length || 0 }} payment(s)
                  awaiting verification
                </small> -->
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
                <h4 class="fw-bold text-info mb-0">N/A</h4>
                <small class="text-muted">N/A</small>
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
            <div
              class="d-flex justify-content-between align-items-center flex-wrap"
            >
              <h5 class="fw-bold mb-0 mb-2 mb-md-0">Payment History</h5>
              <div class="d-flex gap-2">
                <select
                  class="form-select form-select-sm"
                  style="width: auto"
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
              <i
                class="bi bi-exclamation-triangle text-warning mb-3"
                style="font-size: 3rem"
              ></i>
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
                    <th class="border-0 fw-bold d-none d-md-table-cell">
                      Amount
                    </th>
                    <th class="border-0 fw-bold">Status</th>
                    <th class="border-0 fw-bold d-none d-lg-table-cell">
                      Reference
                    </th>
                    <th class="border-0 fw-bold d-none d-sm-table-cell">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <!-- Paid Transactions -->
                  <tr v-for="payment in paymentHistory" :key="payment.id">
                    <td class="py-3">
                      <div>
                        <div class="fw-bold">{{ payment.paymentId.name }}</div>
                        <small class="text-muted">{{
                          payment.paymentId.description
                        }}</small>
                        <div class="d-md-none">
                          <small class="text-muted">
                            {{ formatDate(payment.paidAt) }} •
                            {{ formatCurrency(payment.amount) }} •
                            {{ payment.reference }}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 d-none d-md-table-cell">
                      <span
                        class="fw-bold"
                        :class="
                          payment.status === 'successful'
                            ? 'text-success'
                            : 'text-warning'
                        "
                        >{{ formatCurrency(payment.amount) }}</span
                      >
                    </td>
                    <td class="py-3">
                      <span
                        class="badge"
                        :class="getStatusBadgeClass(payment.status)"
                      >
                        {{ getStatusText(payment.status) }}
                      </span>
                    </td>
                    <td class="py-3 d-none d-lg-table-cell">
                      <code class="small">{{ payment.reference }}</code>
                    </td>
                    <td class="py-3 d-none d-sm-table-cell">
                      <div class="btn-group btn-group-sm">
                        <button
                          class="btn btn-outline-primary"
                          :title="
                            payment.receiptUrl
                              ? 'View Receipt'
                              : 'Receipt unavailable'
                          "
                          @click="downloadReceipt(payment)"
                        >
                          <i class="bi bi-receipt"></i>
                        </button>
                        <button
                          v-if="payment.receiptUrl"
                          class="btn btn-outline-secondary"
                          title="Download"
                          @click="downloadReceipt(payment)"
                        >
                          <i class="bi bi-download"></i>
                        </button>
                      </div>
                    </td>
                  </tr>

                  <!-- Unpaid Transactions -->
                  <tr
                    v-for="unpaidFee in paymentSummary?.unpaidFees || []"
                    :key="'unpaid-' + unpaidFee.id"
                    class="table-warning"
                  >
                    <td class="py-3">
                      <div>
                        <div class="fw-bold">{{ unpaidFee.name }}</div>
                        <small class="text-muted">{{
                          unpaidFee.description
                        }}</small>
                        <div class="d-md-none">
                          <small class="text-muted">
                            Pending • {{ formatCurrency(unpaidFee.amount) }} •
                            Due now
                          </small>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 d-none d-md-table-cell">
                      <span class="fw-bold text-warning">{{
                        formatCurrency(unpaidFee.amount)
                      }}</span>
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
                        @click="
                          makePaymentFromModal(
                            unpaidFee.id,
                            unpaidFee.paymentCode,
                          )
                        "
                        :disabled="
                          isPaymentLoading ||
                          !hasAvailablePaymentMethodsForFee(unpaidFee)
                        "
                      >
                        <span
                          v-if="isPaymentLoading"
                          class="spinner-border spinner-border-sm me-1"
                        ></span>
                        <i v-else class="bi bi-wallet2 me-1"></i>
                        Pay Now
                      </button>
                    </td>
                  </tr>

                  <!-- Empty State -->
                  <tr
                    v-if="
                      paymentHistory.length === 0 &&
                      (paymentSummary?.unpaidFees?.length || 0) === 0
                    "
                  >
                    <td colspan="5" class="text-center py-5">
                      <i
                        class="bi bi-receipt text-muted mb-3"
                        style="font-size: 3rem"
                      ></i>
                      <h5 class="text-muted">No Payment History</h5>
                      <p class="text-muted mb-0">
                        No payments found for the selected academic session.
                      </p>
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
              v-for="paidFee in paymentSummary?.paidFees || []"
              :key="paidFee.id"
              class="payment-summary-item d-flex justify-content-between py-2 border-bottom"
            >
              <span class="text-muted">{{ paidFee.name }}</span>
              <span class="fw-bold text-dark">{{
                formatCurrency(paidFee.amount)
              }}</span>
            </div>

            <!-- Unpaid Fees -->
            <div
              v-for="pendingFee in paymentSummary?.pendingFees || []"
              :key="`pending-summary-${pendingFee.reference}`"
              class="payment-summary-item d-flex justify-content-between py-2 border-bottom"
            >
              <span class="text-muted">{{ pendingFee.name }}</span>
              <span class="fw-bold text-warning">{{
                formatCurrency(pendingFee.amount)
              }}</span>
            </div>

            <div
              v-for="unpaidFee in paymentSummary?.unpaidFees || []"
              :key="unpaidFee.id"
              class="payment-summary-item d-flex justify-content-between py-2 border-bottom"
            >
              <span class="text-muted">{{ unpaidFee.name }}</span>
              <span class="fw-bold text-warning">{{
                formatCurrency(unpaidFee.amount)
              }}</span>
            </div>

            <!-- Summary -->
            <div
              class="payment-summary-item d-flex justify-content-between py-3 bg-light rounded mt-2"
            >
              <span class="fw-bold">Total Paid</span>
              <span class="fw-bold text-success fs-5">{{
                formatCurrency(paymentSummary?.totalPaid || 0)
              }}</span>
            </div>

            <div
              v-if="(paymentSummary?.totalPending || 0) > 0"
              class="payment-summary-item d-flex justify-content-between py-2 text-warning"
            >
              <span class="fw-bold">Pending Verification</span>
              <span class="fw-bold">{{
                formatCurrency(paymentSummary?.totalPending || 0)
              }}</span>
            </div>

            <div
              v-if="(paymentSummary?.totalUnpaid || 0) > 0"
              class="payment-summary-item d-flex justify-content-between py-2 text-warning"
            >
              <span class="fw-bold">Outstanding</span>
              <span class="fw-bold">{{
                formatCurrency(paymentSummary?.totalUnpaid || 0)
              }}</span>
            </div>

            <!-- Empty State -->
            <div
              v-if="
                (paymentSummary?.paidFees?.length || 0) === 0 &&
                (paymentSummary?.unpaidFees?.length || 0) === 0
              "
              class="text-center py-4"
            >
              <i
                class="bi bi-receipt text-muted mb-3"
                style="font-size: 2rem"
              ></i>
              <p class="text-muted mb-0">
                No payment information available for the selected session.
              </p>
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
              {{
                selectedFee ? "Choose Payment Method" : "Outstanding Payments"
              }}
            </h5>
            <button
              type="button"
              class="btn-close"
              @click="closePaymentModal"
              aria-label="Close"
            ></button>
          </div>
          <div
            class="modal-body"
            :class="
              selectedFee ? 'payment-modal-body' : 'outstanding-payments-body'
            "
          >
            <div v-if="!selectedFee" class="mb-3">
              <div class="payment-modal-summary">
                <div>
                  <small
                    class="text-uppercase text-body-secondary d-block mb-1"
                  >
                    Outstanding payments
                  </small>
                  <div class="fw-bold fs-6">
                    {{ paymentSummary?.unpaidFees?.length || 0 }} pending
                    charge(s)
                  </div>
                </div>
                <div class="payment-modal-amount">
                  <small
                    class="text-uppercase text-body-secondary d-block mb-1"
                  >
                    Total due
                  </small>
                  <div class="fw-bold text-primary fs-6">
                    {{ formatCurrency(paymentSummary?.totalUnpaid || 0) }}
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="
                !selectedFee && (paymentSummary?.unpaidFees?.length || 0) > 0
              "
              class="table-responsive outstanding-payments-table-wrap"
            >
              <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th class="fw-bold">Payment Description</th>
                    <th class="fw-bold text-end">Amount</th>
                    <th class="fw-bold text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="unpaidFee in paymentSummary?.unpaidFees || []"
                    :key="unpaidFee.id"
                  >
                    <td class="py-3">
                      <div>
                        <div class="fw-bold text-dark">
                          {{ unpaidFee.name }}
                        </div>
                        <small class="text-muted">{{
                          unpaidFee.description
                        }}</small>
                      </div>
                    </td>
                    <td class="py-3 text-end">
                      <span class="fw-bold text-warning fs-5">
                        {{ formatCurrency(unpaidFee.amount) }}
                      </span>
                    </td>
                    <td class="py-3 text-center">
                      <button
                        class="btn btn-success px-4 py-2"
                        @click="openPaymentMethodStep(unpaidFee)"
                        :disabled="
                          isPaymentLoading ||
                          !hasAvailablePaymentMethodsForFee(unpaidFee)
                        "
                      >
                        <span
                          v-if="isPaymentLoading"
                          class="spinner-border spinner-border-sm me-2"
                        ></span>
                        <i v-else class="bi bi-wallet2 me-2"></i>
                        Pay Now
                      </button>
                    </td>
                  </tr>
                </tbody>
                <tfoot class="table-light">
                  <tr>
                    <th class="py-3">Total Outstanding</th>
                    <th class="py-3 text-end">
                      <span class="fw-bold text-danger fs-4">
                        {{ formatCurrency(paymentSummary?.totalUnpaid || 0) }}
                      </span>
                    </th>
                    <th class="py-3"></th>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div v-else-if="!selectedFee" class="text-center py-5">
              <i
                class="bi bi-check-circle text-success mb-3"
                style="font-size: 3rem"
              ></i>
              <h5 class="text-success">All Payments Up to Date!</h5>
              <p class="text-muted mb-0">
                You have no outstanding payments at this time.
              </p>
            </div>

            <div v-else class="payment-method-panel">
              <button
                type="button"
                class="btn btn-link px-0 mb-3 text-decoration-none"
                @click="backToOutstandingList"
              >
                <i class="bi bi-arrow-left me-2"></i>Back to outstanding
                payments
              </button>

              <div class="payment-modal-summary mb-4">
                <div>
                  <small
                    class="text-uppercase text-body-secondary d-block mb-1"
                  >
                    Selected fee
                  </small>
                  <div class="fw-bold fs-6">{{ selectedFee.name }}</div>
                  <small
                    v-if="selectedFee.description"
                    class="text-muted d-block mt-1"
                  >
                    {{ selectedFee.description }}
                  </small>
                </div>
                <div class="payment-modal-amount">
                  <small
                    class="text-uppercase text-body-secondary d-block mb-1"
                  >
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
                        <span class="payment-method-option-title"
                          >Paystack</span
                        >
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
                                Use your preferred card, bank, or transfer
                                option in the popup.
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
                            <small class="payment-detail-label"
                              >Bank Name</small
                            >
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
                          id="studentManualTransferConfirmed"
                          v-model="manualTransferConfirmed"
                          class="form-check-input"
                          type="checkbox"
                        />
                        <label
                          class="form-check-label fw-medium"
                          for="studentManualTransferConfirmed"
                        >
                          I have completed the transfer and I want to upload the
                          payment receipt.
                        </label>
                      </div>

                      <div
                        v-if="manualTransferConfirmed"
                        class="receipt-upload-panel"
                      >
                        <label class="form-label h6 text-dark"
                          >Upload receipt</label
                        >
                        <input
                          class="form-control"
                          type="file"
                          accept=".png,.jpg,.jpeg,.pdf"
                          @change="onReceiptSelected"
                        />
                        <div class="small text-body-secondary mt-2">
                          Accepted formats: PNG, JPG, PDF. Maximum file size:
                          1MB.
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
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="closePaymentModal"
            >
              {{ selectedFee ? "Cancel" : "Close" }}
            </button>
            <button
              v-if="selectedFee && selectedPaymentMethod === 'paystack'"
              type="button"
              class="btn btn-primary"
              :disabled="isPaymentLoading"
              @click="proceedWithSelectedMethod"
            >
              <span
                v-if="isPaymentLoading"
                class="spinner-border spinner-border-sm me-2"
              ></span>
              Continue to Paystack
            </button>
            <button
              v-else-if="
                selectedFee && selectedPaymentMethod === 'manual_transfer'
              "
              type="button"
              class="btn btn-success"
              :disabled="!canSubmitManualTransfer"
              @click="proceedWithSelectedMethod"
            >
              <span
                v-if="manualTransferSubmitting"
                class="spinner-border spinner-border-sm me-2"
              ></span>
              Submit Receipt
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

.modal-dialog {
  max-width: 920px;
}

.modal-dialog-centered {
  display: flex;
  align-items: center;
  min-height: calc(100vh - 3.5rem);
}

.modal-content {
  height: min(780px, calc(100vh - 3rem));
  max-height: calc(100vh - 3rem);
  overflow: hidden;
}

.outstanding-payments-body,
.payment-modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.outstanding-payments-body {
  background: #fbfcfe;
}

.payment-modal-body {
  background: linear-gradient(180deg, #fcfdff 0%, #f8fafc 100%);
}

/* Payment modal specific styles */
.modal-body .table th {
  border-top: none;
}

.modal-body .alert {
  border-radius: 8px;
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

.outstanding-payments-table-wrap {
  border: 1px solid #e9ecef;
  border-radius: 1rem;
  background: #fff;
  overflow: hidden;
}

.btn-success:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  background: linear-gradient(180deg, #f7fbff 0%, #eef6ff 100%);
  font-weight: 700;
}

.payment-method-option.active .payment-method-option-icon {
  background: rgba(13, 110, 253, 0.12);
  color: #0d6efd;
}

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
  color: #212529;
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
}
</style>
