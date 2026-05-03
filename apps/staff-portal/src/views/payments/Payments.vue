<script lang="js">
import Swal from "sweetalert2";
import { useAuthStore } from "../../stores/auth.js";
import { apiService } from "../../services/api.js";
import { logger } from "@shared/utils/logger";

const createDefaultFilters = () => ({
  search: "",
  date: "",
  status: "",
  paymentId: "",
  method: "",
  programId: "",
  academicSessionId: "",
});

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "successful", label: "Successful" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const methodOptions = [
  { value: "", label: "All Methods" },
  { value: "paystack", label: "Paystack" },
  { value: "manual_transfer", label: "Manual Transfer" },
];

export default {
  name: "StaffPaymentsManagement",
  setup() {
    const authStore = useAuthStore();
    return { authStore };
  },
  data() {
    return {
      isLoading: true,
      payments: [],
      filters: createDefaultFilters(),
      searchTimeout: null,
      currentPage: 1,
      perPage: 10,
      totalPayments: 0,
      apiTotalPages: 1,
      paymentOptions: [],
      programOptions: [],
      academicSessions: [],
      processingPaymentId: null,
      statusOptions,
      methodOptions,
    };
  },
  async mounted() {
    await this.authStore.initialize();

    if (!this.authStore.hasModuleAccess("payments")) {
      await this.$swal.fire({
        icon: "error",
        title: "Access Denied",
        text: "You do not have permission to view student payments.",
        confirmButtonColor: "#1a5f5f",
      });
      return;
    }

    await Promise.all([this.loadFilterOptions(), this.loadPayments()]);
  },
  computed: {
    hasActiveFilters() {
      return Object.values(this.filters).some((value) =>
        String(value || "").trim(),
      );
    },
  },
  watch: {
    "filters.search"() {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.currentPage = 1;
        this.loadPayments();
      }, 350);
    },
    "filters.date"() {
      this.handleFilterChange();
    },
    "filters.status"() {
      this.handleFilterChange();
    },
    "filters.paymentId"() {
      this.handleFilterChange();
    },
    "filters.method"() {
      this.handleFilterChange();
    },
    "filters.programId"() {
      this.handleFilterChange();
    },
    "filters.academicSessionId"() {
      this.handleFilterChange();
    },
    currentPage() {
      this.loadPayments();
    },
  },
  methods: {
    handleFilterChange() {
      this.currentPage = 1;
      this.loadPayments();
    },

    async loadFilterOptions() {
      try {
        const [paymentsResponse, programsResponse, academicSessionsResponse] =
          await Promise.all([
            apiService.getPayments({
              page: 1,
              limit: 500,
              active: true,
              sortBy: "name",
              sortOrder: "asc",
            }),
            apiService.getPrograms({ page: 1, limit: 500, active: true }),
            apiService.getAcademicSessions({ page: 1, limit: 200 }),
          ]);

        this.paymentOptions = paymentsResponse.success
          ? paymentsResponse.data?.payments || []
          : [];

        this.programOptions = programsResponse.success
          ? programsResponse.data || []
          : [];

        this.academicSessions = academicSessionsResponse.success
          ? academicSessionsResponse.data?.sessions || []
          : [];
      } catch (error) {
        logger.error("Failed to load payment filter options:", error);
        this.paymentOptions = [];
        this.programOptions = [];
        this.academicSessions = [];
      }
    },

    async loadPayments() {
      try {
        this.isLoading = true;

        const params = {
          page: this.currentPage,
          limit: this.perPage,
          sortBy: "paidAt",
          sortOrder: "desc",
        };

        if (this.filters.search.trim()) {
          params.search = this.filters.search.trim();
        }
        if (this.filters.date) {
          params.date = this.filters.date;
        }
        if (this.filters.status) {
          params.status = this.filters.status;
        }
        if (this.filters.paymentId) {
          params.paymentId = this.filters.paymentId;
        }
        if (this.filters.method) {
          params.method = this.filters.method;
        }
        if (this.filters.programId) {
          params.programId = this.filters.programId;
        }
        if (this.filters.academicSessionId) {
          params.academicSessionId = this.filters.academicSessionId;
        }

        logger.info("Loading student payments for management...", { params });

        const response = await apiService.getStudentPayments(params);

        if (!response.success) {
          throw new Error(
            response.message || "Failed to load student payments",
          );
        }

        this.payments = response.data?.payments || [];
        this.totalPayments = response.data?.pagination?.totalItems || 0;
        this.currentPage = response.data?.pagination?.currentPage || 1;
        this.apiTotalPages = response.data?.pagination?.totalPages || 1;
      } catch (error) {
        logger.error("Failed to load student payments:", error);
        await this.$swal.fire({
          icon: "error",
          title: "Load Failed",
          text: error.message || "Failed to load student payments.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.isLoading = false;
      }
    },

    getProgramDisplay(payment) {
      return (
        [
          payment.programTypeLabel,
          payment.programModeLabel,
          payment.programName,
        ]
          .filter((value) => value && value !== "N/A")
          .join(" ") || "N/A"
      );
    },

    getProgramOptionLabel(program) {
      const type =
        program?.programType?.type ||
        program?.programType ||
        program?.programTypeLabel;
      const mode =
        program?.programMode?.mode ||
        program?.programMode ||
        program?.programModeLabel;
      return (
        [type, mode, program?.name].filter(Boolean).join(" ") ||
        program?.name ||
        "N/A"
      );
    },

    getUserDisplayName(payment) {
      return payment.userName || "Unknown User";
    },

    getIdentifierLabel(payment) {
      if (payment.matriculationNumber) return "Matric No.";
      if (payment.applicationNumber) return "Application No.";
      return "Identifier";
    },

    getIdentifierValue(payment) {
      return payment.matriculationNumber || payment.applicationNumber || "N/A";
    },

    getReferenceDisplay(reference) {
      return reference || "N/A";
    },

    getEffectivePaidDate(payment) {
      return payment.paidAt || payment.effectivePaidAt || payment.createdAt;
    },

    formatDateTime(dateString) {
      if (!dateString) return "N/A";
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return "N/A";
      return date.toLocaleString();
    },

    formatCurrency(amount) {
      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        minimumFractionDigits: 2,
      }).format(Number(amount || 0));
    },

    formatLabel(value) {
      if (!value) return "N/A";
      return String(value)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
    },

    escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },

    safeDisplay(value) {
      const normalized = value === null || value === undefined ? "" : String(value).trim();
      return normalized || "N/A";
    },

    async openPaymentDetails(payment) {
      const isMobile = window.matchMedia("(max-width: 575.98px)").matches;
      const statusClass = this.getStatusBadgeClass(payment.status);
      const methodClass = this.getMethodBadgeClass(payment.method);
      const receiptActionId = `receipt-view-${payment._id || "payment"}`;

      const renderRows = (rows) =>
        rows
          .map(
            (item) => `
              <li class="list-group-item d-flex flex-column flex-sm-row justify-content-between align-items-start gap-1 gap-sm-3 px-0 py-2">
                <span class="text-muted small fw-semibold text-uppercase">${this.escapeHtml(item.label)}</span>
                <span class="text-end small fw-medium">${
                  item.valueHtml || this.escapeHtml(this.safeDisplay(item.value))
                }</span>
              </li>
            `,
          )
          .join("");

      const identityRows = [
        {
          label: "Student",
          value: this.getUserDisplayName(payment),
        },
        {
          label: "Email",
          value: payment.email,
        },
        {
          label: this.getIdentifierLabel(payment),
          value: this.getIdentifierValue(payment),
        },
      ];

      const paymentRows = [
        {
          label: "Payment",
          value: payment.paymentName,
        },
        {
          label: "Programme",
          value: this.getProgramDisplay(payment),
        },
        {
          label: "Session",
          value: payment.academicSessionLabel,
        },
      ];

      const timelineRows = [
        {
          label: "Date Paid",
          value: this.formatDateTime(this.getEffectivePaidDate(payment)),
        },
        {
          label: "Receipt File",
          valueHtml: payment.receiptUrl
            ? `${this.escapeHtml(this.safeDisplay(payment.receiptOriginalName))} <a href="#" id="${this.escapeHtml(receiptActionId)}" class="ms-2 small fw-semibold">View</a>`
            : this.escapeHtml(this.safeDisplay(payment.receiptOriginalName)),
        },
        {
          label: "Receipt Uploaded",
          value: this.formatDateTime(payment.receiptUploadedAt),
        },
        {
          label: "Channel",
          value: this.formatLabel(payment.channel),
        },
      ];

      const detailsHtml = `
        <div class="container-fluid px-0 px-sm-1 text-start">
          <div class="card border-0 bg-light mb-3">
            <div class="card-body py-2 py-sm-3 px-2 px-sm-3">
              <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2 gap-sm-3">
                <div>
                  <div class="small text-muted text-uppercase fw-semibold mb-1">Reference</div>
                  <code class="fw-semibold">${this.escapeHtml(this.getReferenceDisplay(payment.reference))}</code>
                </div>
                <div class="text-sm-end">
                  <div class="small text-muted text-uppercase fw-semibold mb-1">Amount</div>
                  <div class="h5 mb-0 fw-bold">${this.escapeHtml(this.formatCurrency(payment.amount))}</div>
                </div>
              </div>
              <div class="d-flex flex-wrap gap-2 mt-2 mt-sm-3">
                <span class="badge rounded-pill ${statusClass} px-3 py-2">${this.escapeHtml(this.formatLabel(payment.status))}</span>
                <span class="badge rounded-pill ${methodClass} px-3 py-2">${this.escapeHtml(this.formatLabel(payment.method))}</span>
              </div>
            </div>
          </div>

          <div class="row g-2 g-sm-3">
            <div class="col-12 col-md-6">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-body p-2 p-sm-3">
                  <h6 class="fw-bold mb-2 mb-sm-3">Identity</h6>
                  <ul class="list-group list-group-flush">
                    ${renderRows(identityRows)}
                  </ul>
                </div>
              </div>
            </div>

            <div class="col-12 col-md-6">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-body p-2 p-sm-3">
                  <h6 class="fw-bold mb-2 mb-sm-3">Payment Info</h6>
                  <ul class="list-group list-group-flush">
                    ${renderRows(paymentRows)}
                  </ul>
                </div>
              </div>
            </div>

            <div class="col-12">
              <div class="card border-0 shadow-sm">
                <div class="card-body p-2 p-sm-3">
                  <h6 class="fw-bold mb-2 mb-sm-3">Timeline & Receipt</h6>
                  <ul class="list-group list-group-flush">
                    ${renderRows(timelineRows)}
                  </ul>
                </div>
              </div>
            </div>

            <div class="col-12">
              <div class="card border-0 shadow-sm">
                <div class="card-body p-2 p-sm-3">
                  <h6 class="fw-bold mb-2 mb-sm-3">Remarks</h6>
                  <div class="small text-muted text-uppercase fw-semibold mb-1">General</div>
                  <p class="mb-3">${this.escapeHtml(this.safeDisplay(payment.remarks))}</p>
                  <div class="small text-muted text-uppercase fw-semibold mb-1">Verification</div>
                  <p class="mb-0">${this.escapeHtml(this.safeDisplay(payment.verificationRemarks))}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      await Swal.fire({
        title: "Payment Details",
        html: detailsHtml,
        width: isMobile ? "96%" : 900,
        heightAuto: false,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: {
          popup: "payment-details-swal",
          htmlContainer: "payment-details-html",
        },
        didOpen: (popup) => {
          popup.style.height = isMobile ? "92vh" : "90vh";

          const htmlContainer = Swal.getHtmlContainer();
          if (htmlContainer) {
            htmlContainer.style.maxHeight = isMobile
              ? "calc(92vh - 120px)"
              : "calc(90vh - 170px)";
            htmlContainer.style.overflowY = "auto";
            htmlContainer.style.overflowX = "hidden";
          }

          if (!payment.receiptUrl) {
            return;
          }

          const receiptLink = popup.querySelector(`#${receiptActionId}`);

          if (receiptLink) {
            receiptLink.addEventListener("click", (event) => {
              event.preventDefault();
              Swal.close();
              void this.previewReceipt(payment);
            });
          }
        },
      });
    },

    getStatusBadgeClass(status) {
      const classes = {
        successful: "bg-success-subtle text-success-emphasis",
        pending: "bg-warning-subtle text-warning-emphasis",
        failed: "bg-danger-subtle text-danger-emphasis",
        cancelled: "bg-secondary-subtle text-secondary-emphasis",
      };
      return classes[status] || "bg-light text-dark";
    },

    getMethodBadgeClass(method) {
      const classes = {
        paystack: "bg-primary-subtle text-primary-emphasis",
        manual_transfer: "bg-info-subtle text-info-emphasis",
      };
      return classes[method] || "bg-light text-dark";
    },

    isManualTransferPayment(payment) {
      return payment.method === "manual_transfer";
    },

    canReviewManualTransfer(payment) {
      return (
        this.isManualTransferPayment(payment) &&
        payment.status === "pending" &&
        !!payment.receiptUrl
      );
    },

    isProcessingPayment(paymentId) {
      return this.processingPaymentId === paymentId;
    },

    getReceiptExtension(payment) {
      const source = (
        payment?.receiptOriginalName ||
        payment?.receiptUrl ||
        ""
      ).split("?")[0];
      const parts = source.split(".");
      return parts.length > 1 ? parts.pop().toLowerCase() : "";
    },

    async previewReceipt(payment) {
      if (!payment?.receiptUrl) {
        await Swal.fire({
          icon: "info",
          title: "Receipt unavailable",
          text: "No uploaded receipt is available for this payment record.",
          confirmButtonColor: "#1a5f5f",
        });
        return;
      }

      const extension = this.getReceiptExtension(payment);
      let html = "";

      if (["png", "jpg", "jpeg", "webp"].includes(extension)) {
        html = `<img src="${payment.receiptUrl}" alt="Receipt preview" style="max-width:100%; max-height:70vh; border-radius:12px;" />`;
      } else if (extension === "pdf") {
        html = `<iframe src="${payment.receiptUrl}" title="Receipt preview" style="width:100%; height:70vh; border:0; border-radius:12px;"></iframe>`;
      } else {
        html = `
          <div class="text-center py-4">
            <i class="bi bi-file-earmark-text fs-1 text-muted d-block mb-3"></i>
            <p class="mb-0">Preview is not available for this receipt type.</p>
          </div>
        `;
      }

      const result = await Swal.fire({
        title: "Payment Receipt",
        html,
        width: 960,
        showCancelButton: true,
        cancelButtonText: "Close",
        confirmButtonText: "Open in New Tab",
        confirmButtonColor: "#1a5f5f",
        cancelButtonColor: "#6c757d",
        customClass: {
          popup: "payment-receipt-swal",
        },
      });

      if (result.isConfirmed) {
        window.open(payment.receiptUrl, "_blank", "noopener,noreferrer");
      }
    },

    async verifyManualTransferPayment(payment) {
      try {
        if (this.isProcessingPayment(payment._id)) {
          return;
        }

        if (
          !this.authStore.hasPermission("payments", "manage") &&
          !this.authStore.hasPermission("payments", "edit")
        ) {
          await this.$swal.fire({
            icon: "error",
            title: "Access Denied",
            text: "You do not have permission to verify manual transfer payments.",
            confirmButtonColor: "#1a5f5f",
          });
          return;
        }

        const result = await this.$swal.fire({
          title: "Verify manual transfer?",
          text: `Confirm ${payment.paymentName || "this payment"} as received in the bank account.`,
          input: "textarea",
          inputLabel: "Verification remarks (optional)",
          inputPlaceholder: "e.g. Payment confirmed from bank statement",
          showCancelButton: true,
          confirmButtonText: "Verify payment",
          confirmButtonColor: "#1a5f5f",
          cancelButtonColor: "#6c757d",
        });

        if (!result.isConfirmed) {
          return;
        }

        this.processingPaymentId = payment._id;

        const response = await apiService.verifyManualTransferPayment(
          payment._id,
          {
            remarks: result.value?.trim() || undefined,
          },
        );

        if (!response.success) {
          throw new Error(response.message || "Failed to verify payment");
        }

        await this.loadPayments();

        await this.$swal.fire({
          icon: "success",
          title: "Payment verified",
          text:
            response.message ||
            "Manual transfer payment verified successfully.",
          confirmButtonColor: "#1a5f5f",
        });
      } catch (error) {
        logger.error("Failed to verify manual transfer payment:", error);
        await this.$swal.fire({
          icon: "error",
          title: "Verification failed",
          text: error.message || "Failed to verify manual transfer payment.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.processingPaymentId = null;
      }
    },

    async rejectManualTransferPayment(payment) {
      try {
        if (this.isProcessingPayment(payment._id)) {
          return;
        }

        if (
          !this.authStore.hasPermission("payments", "manage") &&
          !this.authStore.hasPermission("payments", "edit")
        ) {
          await this.$swal.fire({
            icon: "error",
            title: "Access Denied",
            text: "You do not have permission to reject manual transfer payments.",
            confirmButtonColor: "#1a5f5f",
          });
          return;
        }

        const result = await this.$swal.fire({
          title: "Reject manual transfer?",
          text: "Provide a reason so the student can correct the payment submission.",
          input: "textarea",
          inputLabel: "Rejection reason",
          inputPlaceholder: "e.g. Amount does not match bank statement",
          inputValidator: (value) => {
            if (!value || !value.trim()) {
              return "A rejection reason is required";
            }
            return null;
          },
          showCancelButton: true,
          confirmButtonText: "Reject payment",
          confirmButtonColor: "#dc3545",
          cancelButtonColor: "#6c757d",
        });

        if (!result.isConfirmed) {
          return;
        }

        this.processingPaymentId = payment._id;

        const response = await apiService.rejectManualTransferPayment(
          payment._id,
          {
            remarks: result.value.trim(),
          },
        );

        if (!response.success) {
          throw new Error(response.message || "Failed to reject payment");
        }

        await this.loadPayments();

        await this.$swal.fire({
          icon: "success",
          title: "Payment rejected",
          text:
            response.message ||
            "Manual transfer payment rejected successfully.",
          confirmButtonColor: "#1a5f5f",
        });
      } catch (error) {
        logger.error("Failed to reject manual transfer payment:", error);
        await this.$swal.fire({
          icon: "error",
          title: "Rejection failed",
          text: error.message || "Failed to reject manual transfer payment.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.processingPaymentId = null;
      }
    },

    resetFilters() {
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = null;
      }

      this.filters = createDefaultFilters();
      this.currentPage = 1;
      this.loadPayments();
    },

    async refreshPayments() {
      await Promise.all([this.loadFilterOptions(), this.loadPayments()]);
    },
  },
};
</script>

<template>
  <div class="container-fluid p-4 payments-page">
    <div class="row mb-4">
      <div class="col-12">
        <div
          class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3"
        >
          <div>
            <h2 class="fw-bold text-staff-primary mb-1">Payments Management</h2>
            <p class="text-muted mb-0">
              Search, filter, and manage student payment records across academic
              sessions and programmes.
            </p>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <button
              class="btn btn-outline-staff-primary btn-sm"
              @click="resetFilters"
            >
              <i class="bi bi-arrow-counterclockwise me-2"></i>Reset Filters
            </button>
            <button
              class="btn btn-staff-primary btn-sm"
              @click="refreshPayments"
            >
              <i class="bi bi-arrow-clockwise me-2"></i>Refresh
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="row mb-4">
      <div class="col-12">
        <div class="card border-0 shadow-sm p-0">
          <div class="card-body">
            <div class="row g-3">
              <div class="col-xl-4 col-lg-6">
                <label class="form-label">Search</label>
                <input
                  v-model="filters.search"
                  type="text"
                  class="form-control"
                  placeholder="Search by user, payment, application or matric number..."
                />
              </div>
              <div class="col-xl-2 col-md-4 col-sm-6">
                <label class="form-label">Date Paid</label>
                <input
                  v-model="filters.date"
                  type="date"
                  class="form-control"
                />
              </div>
              <div class="col-xl-2 col-md-4 col-sm-6">
                <label class="form-label">Status</label>
                <select v-model="filters.status" class="form-select">
                  <option
                    v-for="option in statusOptions"
                    :key="option.value || 'all-statuses'"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </div>
              <div class="col-xl-2 col-md-4 col-sm-6">
                <label class="form-label">Method</label>
                <select v-model="filters.method" class="form-select">
                  <option
                    v-for="option in methodOptions"
                    :key="option.value || 'all-methods'"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </div>
              <div class="col-xl-2 col-md-6 col-sm-6">
                <label class="form-label">Payment</label>
                <select v-model="filters.paymentId" class="form-select">
                  <option value="">All Payments</option>
                  <option
                    v-for="payment in paymentOptions"
                    :key="payment.id"
                    :value="payment.id"
                  >
                    {{ payment.name }}
                  </option>
                </select>
              </div>
            </div>

            <div class="row g-3 mt-1">
              <div class="col-lg-5">
                <label class="form-label">Programme</label>
                <select v-model="filters.programId" class="form-select">
                  <option value="">All Programmes</option>
                  <option
                    v-for="program in programOptions"
                    :key="program.id"
                    :value="program.id"
                  >
                    {{ getProgramOptionLabel(program) }}
                  </option>
                </select>
              </div>
              <div class="col-lg-4 col-md-8">
                <label class="form-label">Academic Session</label>
                <select v-model="filters.academicSessionId" class="form-select">
                  <option value="">All Academic Sessions</option>
                  <option
                    v-for="session in academicSessions"
                    :key="session._id"
                    :value="session._id"
                  >
                    {{ session.sessionYear }}
                  </option>
                </select>
              </div>
              <div class="col-lg-3 col-md-4 d-flex align-items-end">
                <div class="filter-summary-panel w-100">
                  <div class="small text-muted text-uppercase fw-semibold">
                    Records
                  </div>
                  <div class="fw-bold text-staff-primary fs-5">
                    {{ totalPayments }}
                  </div>
                  <small class="text-muted">{{
                    hasActiveFilters
                      ? "Matching current filters"
                      : "All available payment records"
                  }}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-staff-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-3 text-muted mb-0">Loading student payment records...</p>
    </div>

    <div v-else class="row">
      <div class="col-12">
        <div class="card border-0 shadow-sm p-0">
          <div class="card-body p-0">
            <div v-if="payments.length === 0" class="text-center py-5">
              <div class="text-muted px-3">
                <i class="bi bi-credit-card-2-front fs-1 mb-3 d-block"></i>
                <h5 class="mb-2">No Payment Records Found</h5>
                <p class="mb-0">
                  {{
                    hasActiveFilters
                      ? "No student payments match your current filters."
                      : "Student payment records will appear here once payments are created."
                  }}
                </p>
              </div>
            </div>

            <template v-else>
              <div class="table-responsive d-none d-lg-block">
                <table
                  class="table table-hover mb-0 align-middle payments-table"
                >
                  <thead class="table-light">
                    <tr>
                      <th>User</th>
                      <th>Program</th>
                      <th>Session</th>
                      <th>Payment</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Date Paid</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="payment in payments" :key="payment._id">
                      <td class="user-cell">
                        <div class="fw-semibold">
                          {{ getUserDisplayName(payment) }}
                        </div>
                        <div class="small text-muted">
                          <!-- {{ getIdentifierLabel(payment) }}:  -->
                          {{ getIdentifierValue(payment) }}
                        </div>
                        <div
                          class="small text-muted text-break d-none d-xxl-block"
                        >
                          {{ payment.email || "No email available" }}
                        </div>
                      </td>
                      <td class="program-cell">
                        <div class="fw-medium">
                          {{ getProgramDisplay(payment) }}
                        </div>
                      </td>
                      <td>
                        <span class="badge bg-light text-dark border">{{
                          payment.academicSessionLabel || "N/A"
                        }}</span>
                      </td>
                      <td>
                        <div class="fw-semibold">
                          {{ payment.paymentName || "N/A" }}
                        </div>
                        <code class="payment-reference mt-1">{{
                          getReferenceDisplay(payment.reference)
                        }}</code>
                      </td>
                      <td>
                        <div class="fw-semibold">
                          {{ formatCurrency(payment.amount) }}
                        </div>
                      </td>
                      <td>
                        <span
                          class="badge rounded-pill"
                          :class="getMethodBadgeClass(payment.method)"
                        >
                          {{ formatLabel(payment.method) }}
                        </span>
                      </td>
                      <td>
                        <span
                          class="badge rounded-pill"
                          :class="getStatusBadgeClass(payment.status)"
                        >
                          {{ formatLabel(payment.status) }}
                        </span>
                      </td>
                      <td>
                        <div>
                          {{ formatDateTime(getEffectivePaidDate(payment)) }}
                        </div>
                        <div
                          v-if="!payment.paidAt && payment.createdAt"
                          class="small text-muted"
                        >
                          Initiated record
                        </div>
                      </td>
                      <td>
                        <div
                          class="d-flex flex-wrap justify-content-center gap-2"
                        >
                          <div class="dropdown">
                            <a
                              class="h5 dropdown-toggle no-caret"
                              href="#"
                              role="button"
                              data-bs-toggle="dropdown"
                              aria-expanded="false"
                            >
                              <i class="bi bi-three-dots-vertical"></i>
                            </a>
                            <ul class="dropdown-menu">
                              <li>
                                <a
                                  class="dropdown-item"
                                  href="#"
                                  @click.prevent="openPaymentDetails(payment)"
                                >
                                  <i class="bi bi-eye me-1"></i>View
                                </a>
                              </li>
                              <li v-if="payment.receiptUrl">
                                <a
                                  class="dropdown-item"
                                  href="#"
                                  @click.prevent="previewReceipt(payment)"
                                >
                                  <i class="bi bi-receipt me-1"></i>Receipt
                                </a>
                              </li>
                              <li v-if="canReviewManualTransfer(payment)">
                                <a
                                  @click.prevent="
                                    verifyManualTransferPayment(payment)
                                  "
                                  class="dropdown-item text-success"
                                  href="#"
                                  :class="{ disabled: isProcessingPayment(payment._id) }"
                                  :aria-disabled="isProcessingPayment(payment._id)"
                                >
                                  <span
                                    v-if="isProcessingPayment(payment._id)"
                                    class="spinner-border spinner-border-sm me-1"
                                  ></span>
                                  <i
                                    v-else
                                    class="bi bi-check-circle-fill me-1"
                                  ></i
                                  >Verify
                                </a>
                              </li>
                              <li v-if="canReviewManualTransfer(payment)">
                                <a
                                  class="dropdown-item text-danger"
                                  href="#"
                                  :class="{ disabled: isProcessingPayment(payment._id) }"
                                  :aria-disabled="isProcessingPayment(payment._id)"
                                  @click.prevent="
                                    rejectManualTransferPayment(payment)
                                  "
                                >
                                  <i class="bi bi-x-circle-fill me-1"></i>Reject
                                </a>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="d-lg-none p-3">
                <div class="row g-3">
                  <div
                    v-for="payment in payments"
                    :key="`mobile-${payment._id}`"
                    class="col-12"
                  >
                    <div class="payment-mobile-card h-100">
                      <div class="d-flex gap-3 mb-3">
                        <div class="me-auto">
                          <div class="fw-semibold text-staff-primary">
                            {{ getUserDisplayName(payment) }}
                          </div>
                          <div class="small text-muted">
                            <!-- {{ getIdentifierLabel(payment) }}:  -->
                            {{ getIdentifierValue(payment) }}
                          </div>
                        </div>
                        <div class="text-end">
                          <div class="fw-semibold">
                            {{ formatCurrency(payment.amount) }}
                          </div>
                          <small class="text-muted">{{
                            formatDateTime(getEffectivePaidDate(payment))
                          }}</small>
                        </div>
                        <div class="dropdown">
                          <a
                            class="dropdown-toggle no-caret bg-dark-subtle text-dark-emphasis rounded-circle d-flex align-items-center justify-content-center"
                            href="#"
                            role="button"
                            style="width: 32px; height: 32px"
                            data-bs-toggle="dropdown"
                            aria-expanded="false"
                          >
                            <i class="bi bi-three-dots-vertical"></i>
                          </a>
                          <ul class="dropdown-menu">
                            <li>
                              <a
                                class="dropdown-item"
                                href="#"
                                @click.prevent="openPaymentDetails(payment)"
                                ><i class="bi bi-eye me-1"></i>View</a
                              >
                            </li>
                            <li v-if="payment.receiptUrl">
                              <a
                                class="dropdown-item"
                                href="#"
                                @click.prevent="previewReceipt(payment)"
                                ><i class="bi bi-receipt me-1"></i>Receipt</a
                              >
                            </li>
                            <li v-if="canReviewManualTransfer(payment)">
                              <a
                                class="dropdown-item text-success"
                                href="#"
                                @click.prevent="
                                  verifyManualTransferPayment(payment)
                                "
                                :class="{ disabled: isProcessingPayment(payment._id) }"
                                :aria-disabled="isProcessingPayment(payment._id)"
                              >
                                <span
                                  v-if="isProcessingPayment(payment._id)"
                                  class="spinner-border spinner-border-sm me-1"
                                ></span>
                                <i
                                  v-else
                                  class="bi bi-check-circle-fill me-1"
                                ></i
                                >Verify
                              </a>
                            </li>
                            <li v-if="canReviewManualTransfer(payment)">
                              <a
                                class="dropdown-item text-danger"
                                href="#"
                                :class="{ disabled: isProcessingPayment(payment._id) }"
                                :aria-disabled="isProcessingPayment(payment._id)"
                                @click.prevent="
                                  rejectManualTransferPayment(payment)
                                "
                              >
                                <i class="bi bi-x-circle-fill me-1"></i>Reject
                              </a>
                            </li>
                          </ul>
                        </div>
                      </div>

                      <div class="payment-mobile-meta d-grid gap-2 mb-3">
                        <div>
                          <div
                            class="small text-uppercase text-muted fw-semibold"
                          >
                            Program
                          </div>
                          <div>{{ getProgramDisplay(payment) }}</div>
                        </div>
                        <div class="row g-2">
                          <div class="col-12 col-sm-6">
                            <div
                              class="small text-uppercase text-muted fw-semibold"
                            >
                              Session
                            </div>
                            <div>
                              {{ payment.academicSessionLabel || "N/A" }}
                            </div>
                          </div>
                          <div class="col-12 col-sm-6">
                            <div
                              class="small text-uppercase text-muted fw-semibold"
                            >
                              Payment
                            </div>
                            <div>{{ payment.paymentName || "N/A" }}</div>
                          </div>
                        </div>
                        <div>
                          <div
                            class="small text-uppercase text-muted fw-semibold"
                          >
                            Reference
                          </div>
                          <code class="payment-reference mt-1">{{
                            getReferenceDisplay(payment.reference)
                          }}</code>
                        </div>
                      </div>

                      <div class="d-flex flex-wrap gap-2 mb-3">
                        <span
                          class="badge rounded-pill"
                          :class="getMethodBadgeClass(payment.method)"
                        >
                          {{ formatLabel(payment.method) }}
                        </span>
                        <span
                          class="badge rounded-pill"
                          :class="getStatusBadgeClass(payment.status)"
                        >
                          {{ formatLabel(payment.status) }}
                        </span>
                        <span
                          v-if="!payment.paidAt && payment.createdAt"
                          class="badge bg-light text-dark border"
                        >
                          Initiated record
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <div class="card-footer bg-transparent border-top-0">
            <nav>
              <ul
                class="pagination pagination-sm mb-0 justify-content-center flex-wrap gap-1"
              >
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <button
                    class="page-link"
                    :disabled="currentPage === 1"
                    @click="currentPage = currentPage - 1"
                  >
                    Previous
                  </button>
                </li>
                <li
                  v-for="page in apiTotalPages"
                  :key="page"
                  class="page-item"
                  :class="{ active: currentPage === page }"
                >
                  <button class="page-link" @click="currentPage = page">
                    {{ page }}
                  </button>
                </li>
                <li
                  class="page-item"
                  :class="{ disabled: currentPage >= apiTotalPages }"
                >
                  <button
                    class="page-link"
                    :disabled="currentPage >= apiTotalPages"
                    @click="currentPage = currentPage + 1"
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
.payments-table th {
  font-weight: 600;
  color: var(--staff-primary);
  white-space: nowrap;
}

.payments-table td {
  vertical-align: middle;
}

.user-cell {
  min-width: 210px;
}

.program-cell {
  min-width: 100px;
}

.payment-reference {
  font-size: 0.82rem;
  color: var(--staff-primary);
  background: var(--staff-light);
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
  display: inline-block;
  max-width: 180px;
  overflow-wrap: anywhere;
}

.payment-mobile-card {
  border: 1px solid rgba(26, 95, 95, 0.1);
  border-radius: 16px;
  padding: 1rem;
  background: #fff;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
}

.payment-mobile-meta {
  border-top: 1px solid rgba(26, 95, 95, 0.08);
  border-bottom: 1px solid rgba(26, 95, 95, 0.08);
  padding-top: 0.85rem;
  padding-bottom: 0.85rem;
}

.filter-summary-panel {
  border: 1px solid rgba(26, 95, 95, 0.08);
  background: rgba(26, 95, 95, 0.04);
  border-radius: 14px;
  padding: 0.85rem 1rem;
}

:deep(.payment-details-swal) {
  max-height: 90vh;
}

:deep(.payment-details-swal .swal2-title) {
  padding-bottom: 0.35rem;
}

:deep(.payment-details-html) {
  margin-top: 0.25rem;
}

.pagination .page-link {
  color: var(--staff-primary);
  border-color: var(--staff-light);
}

.pagination .page-item.active .page-link {
  background-color: var(--staff-primary);
  border-color: var(--staff-primary);
  color: #fff;
}

@media (max-width: 991.98px) {
  .payments-page {
    padding-left: 1rem !important;
    padding-right: 1rem !important;
  }
}

@media (max-width: 767.98px) {
  .filter-summary-panel {
    min-height: auto;
  }

  .payment-mobile-card {
    padding: 0.9rem;
  }

  .payment-reference {
    max-width: 100%;
  }
}
</style>
