<script lang="js">
import Swal from "sweetalert2";
import { useAuthStore } from "../../stores/auth.js";
import { apiService } from "../../services/api.js";
import { logger } from "@shared/utils/logger";

const createDefaultFilters = () => ({
  search: "",
  dateFrom: "",
  dateTo: "",
  status: "",
  paymentId: "",
  method: "",
  programId: "",
  academicSessionId: "",
});

const createDefaultRemittanceModalState = () => ({
  activeTab: "unremitted",
  search: "",
  dateFrom: "",
  dateTo: "",
  currentPage: 1,
  perPage: 10,
  totalItems: 0,
  totalPages: 1,
  totalAmount: 0,
  records: [],
  isLoading: false,
  error: "",
  syncSummary: null,
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
      exportingFormat: "",
      paymentStats: {
        totalRevenue: 0,
        awaitingVerification: 0,
        todaysRevenue: 0,
        pendingRemittance: 0,
      },
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
      isSyncingRemittance: false,
      remittanceModalOpen: false,
      remittanceModalState: createDefaultRemittanceModalState(),
      remittanceSearchTimeout: null,
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

    await Promise.all([
      this.loadFilterOptions(),
      this.loadPayments(),
      this.loadPaymentStats(),
    ]);
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
    "filters.dateFrom"() {
      this.handleFilterChange();
    },
    "filters.dateTo"() {
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
      this.handleAcademicSessionFilterChange();
    },
    currentPage() {
      this.loadPayments();
    },
  },
  methods: {
    buildPaymentQueryParams(overrides = {}) {
      const params = {
        page: this.currentPage,
        limit: this.perPage,
        sortBy: "paidAt",
        sortOrder: "desc",
      };

      if (this.filters.search.trim()) {
        params.search = this.filters.search.trim();
      }
      if (this.filters.dateFrom) {
        params.dateFrom = this.filters.dateFrom;
      }
      if (this.filters.dateTo) {
        params.dateTo = this.filters.dateTo;
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

      return {
        ...params,
        ...overrides,
      };
    },

    handleFilterChange() {
      const shouldReloadImmediately = this.currentPage === 1;
      this.currentPage = 1;

      if (shouldReloadImmediately) {
        this.loadPayments();
      }
    },

    handleAcademicSessionFilterChange() {
      const shouldReloadImmediately = this.currentPage === 1;
      this.currentPage = 1;

      void this.loadPaymentStats();

      if (shouldReloadImmediately) {
        this.loadPayments();
      }
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

        const params = this.buildPaymentQueryParams();

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

    async loadPaymentStats() {
      try {
        const params = {};

        if (this.filters.academicSessionId) {
          params.academicSessionId = this.filters.academicSessionId;
        }

        logger.info("Loading student payment stats...", { params });

        const response = await apiService.getStudentPaymentsStats(params);

        if (!response.success) {
          throw new Error(
            response.message || "Failed to load student payment stats",
          );
        }

        this.paymentStats = {
          totalRevenue: Number(response.data?.totalRevenue || 0),
          awaitingVerification: Number(
            response.data?.awaitingVerification || 0,
          ),
          todaysRevenue: Number(response.data?.todaysRevenue || 0),
          pendingRemittance: Number(response.data?.pendingRemittance || 0),
        };
      } catch (error) {
        logger.error("Failed to load student payment stats:", error);
        this.paymentStats = {
          totalRevenue: 0,
          awaitingVerification: 0,
          todaysRevenue: 0,
          pendingRemittance: 0,
        };
      }
    },

    buildRemittanceQueryParams(stateOverrides = {}) {
      const state = {
        ...this.remittanceModalState,
        ...stateOverrides,
      };
      const params = {
        tab: state.activeTab,
        page: state.currentPage,
        limit: state.perPage,
        sortBy: "remittanceDate",
        sortOrder: "desc",
      };

      if (state.search.trim()) {
        params.search = state.search.trim();
      }
      if (state.dateFrom) {
        params.dateFrom = state.dateFrom;
      }
      if (state.dateTo) {
        params.dateTo = state.dateTo;
      }
      if (this.filters.academicSessionId) {
        params.academicSessionId = this.filters.academicSessionId;
      }

      return params;
    },

    getRemittanceStatusBadgeClass(status) {
      const classes = {
        success: "bg-success-subtle text-success-emphasis",
        processing: "bg-info-subtle text-info-emphasis",
        pending: "bg-warning-subtle text-warning-emphasis",
        failed: "bg-danger-subtle text-danger-emphasis",
      };

      return classes[status] || "bg-light text-dark";
    },

    getRemittanceSyncSummaryText() {
      const summary = this.remittanceModalState.syncSummary;

      if (!summary) {
        return "Showing locally stored remittance state.";
      }

      return `Last synced ${this.formatDateTime(summary.lastSyncedAt)}. Matched ${summary.matchedCount || 0} of ${summary.scannedCount || 0} successful Paystack payment record(s).`;
    },

    renderRemittanceModalRows() {
      if (this.remittanceModalState.isLoading) {
        return `
          <tr>
            <td colspan="6" class="text-center py-5 text-muted">
              <div class="spinner-border spinner-border-sm text-staff-primary me-2" role="status"></div>
              Loading remittance records...
            </td>
          </tr>
        `;
      }

      if (!this.remittanceModalState.records.length) {
        return `
          <tr>
            <td colspan="6" class="text-center py-5 text-muted">
              No ${this.escapeHtml(this.remittanceModalState.activeTab)} remittance records match the current filters.
            </td>
          </tr>
        `;
      }

      return this.remittanceModalState.records
        .map((record) => {
          const statusClass = this.getRemittanceStatusBadgeClass(
            record.remittanceStatus,
          );

          return `
            <tr>
              <td class="align-top">
                <div class="fw-semibold">${this.escapeHtml(this.getUserDisplayName(record))}</div>
                <div class="small text-muted">${this.escapeHtml(this.getIdentifierValue(record))}</div>
              </td>
              <td class="align-top">
                <div class="fw-medium">${this.escapeHtml(this.getProgramDisplay(record))}</div>
                <div class="small text-muted">${this.escapeHtml(this.safeDisplay(record.academicSessionLabel))}</div>
              </td>
              <td class="align-top">
                <div class="fw-semibold">${this.escapeHtml(this.safeDisplay(record.paymentName))}</div>
                <code class="payment-reference mt-1">${this.escapeHtml(this.getReferenceDisplay(record.reference))}</code>
              </td>
              <td class="align-top">
                <div class="fw-semibold">${this.escapeHtml(this.formatCurrency(record.amount))}</div>
                <div class="small text-muted">Remittance: ${this.escapeHtml(this.formatCurrency(record.remittanceAmount || record.amount || 0))}</div>
              </td>
              <td class="align-top">
                <span class="badge rounded-pill ${statusClass} px-3 py-2">${this.escapeHtml(this.formatLabel(record.remittanceStatus))}</span>
                <div class="small text-muted mt-2">Settlement: ${this.escapeHtml(this.safeDisplay(record.remittanceSettlementId))}</div>
              </td>
              <td class="align-top">
                <div class="small"><span class="text-muted fw-semibold">Paid:</span> ${this.escapeHtml(this.formatDateTime(record.effectivePaidAt))}</div>
                <div class="small"><span class="text-muted fw-semibold">Settled:</span> ${this.escapeHtml(this.formatDateTime(record.remittanceSettledAt))}</div>
                <div class="small"><span class="text-muted fw-semibold">Last Sync:</span> ${this.escapeHtml(this.formatDateTime(record.remittanceLastSyncedAt))}</div>
              </td>
            </tr>
          `;
        })
        .join("");
    },

    renderRemittancePagination() {
      if (this.remittanceModalState.totalPages <= 1) {
        return "";
      }

      const currentPage = this.remittanceModalState.currentPage;
      const totalPages = this.remittanceModalState.totalPages;
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, startPage + 4);
      const pages = [];

      for (let page = startPage; page <= endPage; page += 1) {
        pages.push(`
          <li class="page-item ${page === currentPage ? "active" : ""}">
            <button type="button" class="page-link" data-remittance-page="${page}">${page}</button>
          </li>
        `);
      }

      return `
        <nav aria-label="Remittance pagination">
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item ${currentPage <= 1 ? "disabled" : ""}">
              <button type="button" class="page-link" data-remittance-page="${Math.max(1, currentPage - 1)}" ${currentPage <= 1 ? "disabled" : ""}>Previous</button>
            </li>
            ${pages.join("")}
            <li class="page-item ${currentPage >= totalPages ? "disabled" : ""}">
              <button type="button" class="page-link" data-remittance-page="${Math.min(totalPages, currentPage + 1)}" ${currentPage >= totalPages ? "disabled" : ""}>Next</button>
            </li>
          </ul>
        </nav>
      `;
    },

    renderRemittanceModalHtml() {
      const activeTab = this.remittanceModalState.activeTab;
      const summaryText = this.getRemittanceSyncSummaryText();
      const sessionLabel = this.getSelectedAcademicSessionLabel();

      return `
        <div class="text-start remittance-modal-shell">
          <div class="d-flex flex-column flex-lg-row justify-content-between align-items-start gap-3 mb-3 remittance-modal-summary">
            <div>
              <div class="small text-muted text-uppercase fw-semibold mb-1">Academic Session</div>
              <div class="fw-semibold">${this.escapeHtml(sessionLabel)}</div>
              <div class="small text-muted mt-1">${this.escapeHtml(summaryText)}</div>
            </div>
            <div class="text-lg-end">
              <div class="small text-muted text-uppercase fw-semibold mb-1">Visible Total</div>
              <div class="h5 mb-1 fw-bold">${this.escapeHtml(this.formatCurrency(this.remittanceModalState.totalAmount))}</div>
              <div class="small text-muted">${this.remittanceModalState.totalItems} record(s)</div>
            </div>
          </div>

                    <div class="row g-2 mb-3">
            <div class="col-12 col-lg-6">
              <label for="remittance-search-input" class="form-label small">Search</label>
              <input
                id="remittance-search-input"
                type="text"
                class="form-control"
                placeholder="Search by student name, reference id, application or matric no..."
                value="${this.escapeHtml(this.remittanceModalState.search)}"
              />
            </div>
            <div class="col-6 col-lg-3">
              <label for="remittance-date-from" class="form-label small">Date From</label>
              <input
                id="remittance-date-from"
                type="date"
                class="form-control"
                value="${this.escapeHtml(this.remittanceModalState.dateFrom)}"
                max="${this.escapeHtml(this.remittanceModalState.dateTo || "")}" /> 
            </div>
            <div class="col-6 col-lg-3">
              <label for="remittance-date-to" class="form-label small">Date To</label>
              <input
                id="remittance-date-to"
                type="date"
                class="form-control"
                value="${this.escapeHtml(this.remittanceModalState.dateTo)}"
                min="${this.escapeHtml(this.remittanceModalState.dateFrom || "")}" />
            </div>
          </div>


          <ul class="nav nav-tabs remittance-tabs mb-3">
            <li class="nav-item">
              <a href="#" class="nav-link ${activeTab === "unremitted" ? "active" : ""}" data-remittance-tab="unremitted">Unremitted</a>
            </li>
            <li class="nav-item">
              <a href="#" class="nav-link ${activeTab === "remitted" ? "active" : ""}" data-remittance-tab="remitted">Remitted</a>
            </li>
          </ul>

          ${this.remittanceModalState.error ? `<div class="alert alert-danger py-2 px-3">${this.escapeHtml(this.remittanceModalState.error)}</div>` : ""}

          <div class="table-responsive remittance-table-wrap border rounded-3">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>Student</th>
                  <th>Program</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Dates</th>
                </tr>
              </thead>
              <tbody>
                ${this.renderRemittanceModalRows()}
              </tbody>
            </table>
          </div>

          <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mt-3">
            <div class="small text-muted">
              Showing page ${this.remittanceModalState.currentPage} of ${this.remittanceModalState.totalPages}
            </div>
            ${this.renderRemittancePagination()}
          </div>
        </div>
      `;
    },

    bindRemittanceModalEvents() {
      const popup = Swal.getPopup();

      if (!popup) {
        return;
      }

      popup.querySelectorAll("[data-remittance-tab]").forEach((button) => {
        button.addEventListener("click", () => {
          const nextTab = button.getAttribute("data-remittance-tab");

          if (!nextTab || nextTab === this.remittanceModalState.activeTab) {
            return;
          }

          void this.loadRemittanceRecords({
            activeTab: nextTab,
            currentPage: 1,
          });
        });
      });

      const searchInput = popup.querySelector("#remittance-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (event) => {
          const value = event.target.value || "";
          this.remittanceModalState = {
            ...this.remittanceModalState,
            search: value,
          };

          if (this.remittanceSearchTimeout) {
            clearTimeout(this.remittanceSearchTimeout);
          }

          this.remittanceSearchTimeout = setTimeout(() => {
            void this.loadRemittanceRecords({
              search: value,
              currentPage: 1,
            });
          }, 350);
        });
      }

      const dateFromInput = popup.querySelector("#remittance-date-from");
      if (dateFromInput) {
        dateFromInput.addEventListener("change", (event) => {
          void this.loadRemittanceRecords({
            dateFrom: event.target.value || "",
            currentPage: 1,
          });
        });
      }

      const dateToInput = popup.querySelector("#remittance-date-to");
      if (dateToInput) {
        dateToInput.addEventListener("change", (event) => {
          void this.loadRemittanceRecords({
            dateTo: event.target.value || "",
            currentPage: 1,
          });
        });
      }

      popup.querySelectorAll("[data-remittance-page]").forEach((button) => {
        button.addEventListener("click", () => {
          const nextPage = Number(button.getAttribute("data-remittance-page"));

          if (
            Number.isNaN(nextPage) ||
            nextPage === this.remittanceModalState.currentPage
          ) {
            return;
          }

          void this.loadRemittanceRecords({
            currentPage: nextPage,
          });
        });
      });
    },

    refreshRemittanceModalContent() {
      if (!this.remittanceModalOpen) {
        return;
      }

      const htmlContainer = Swal.getHtmlContainer();

      if (!htmlContainer) {
        return;
      }

      htmlContainer.innerHTML = this.renderRemittanceModalHtml();
      this.bindRemittanceModalEvents();
    },

    async loadRemittanceRecords(stateOverrides = {}) {
      const nextState = {
        ...this.remittanceModalState,
        ...stateOverrides,
      };

      this.remittanceModalState = {
        ...nextState,
        isLoading: true,
        error: "",
      };
      this.refreshRemittanceModalContent();

      try {
        const response = await apiService.getStudentPaymentRemittanceRecords(
          this.buildRemittanceQueryParams(nextState),
        );

        if (!response.success) {
          throw new Error(
            response.message || "Failed to load remittance records",
          );
        }

        this.remittanceModalState = {
          ...nextState,
          records: response.data?.records || [],
          totalItems: response.data?.pagination?.totalItems || 0,
          totalPages: response.data?.pagination?.totalPages || 1,
          currentPage: response.data?.pagination?.currentPage || 1,
          perPage: response.data?.pagination?.limit || nextState.perPage,
          totalAmount: Number(response.data?.totalAmount || 0),
          isLoading: false,
          error: "",
        };
      } catch (error) {
        logger.error("Failed to load remittance records:", error);
        this.remittanceModalState = {
          ...nextState,
          records: [],
          totalItems: 0,
          totalPages: 1,
          totalAmount: 0,
          isLoading: false,
          error: error.message || "Failed to load remittance records.",
        };
      }

      this.refreshRemittanceModalContent();
    },

    showPendingRemittanceModal() {
      const isMobile = window.matchMedia("(max-width: 991.98px)").matches;

      void Swal.fire({
        title: "Pending Remittance",
        html: this.renderRemittanceModalHtml(),
        width: isMobile ? "98%" : 1200,
        showConfirmButton: false,
        showCloseButton: true,
        heightAuto: false,
        customClass: {
          popup: "remittance-swal",
          htmlContainer: "remittance-html-container",
        },
        didOpen: () => {
          this.remittanceModalOpen = true;
          this.refreshRemittanceModalContent();
        },
        willClose: () => {
          this.remittanceModalOpen = false;
          if (this.remittanceSearchTimeout) {
            clearTimeout(this.remittanceSearchTimeout);
            this.remittanceSearchTimeout = null;
          }
        },
      });
    },

    async openPendingRemittanceModal() {
      if (this.isSyncingRemittance) {
        return;
      }

      try {
        this.isSyncingRemittance = true;

        Swal.fire({
          title: "Syncing remittance records...",
          text: "Checking Paystack settlement status for successful Paystack payments.",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const payload = this.filters.academicSessionId
          ? { academicSessionId: this.filters.academicSessionId }
          : {};
        const response = await apiService.syncStudentPaymentRemittance(payload);

        if (!response.success) {
          throw new Error(
            response.message || "Failed to sync remittance records",
          );
        }

        this.remittanceModalState = {
          ...createDefaultRemittanceModalState(),
          syncSummary: response.data || null,
        };

        await this.loadRemittanceRecords();
        await this.loadPaymentStats();

        Swal.close();
        this.showPendingRemittanceModal();
      } catch (error) {
        logger.error("Failed to sync remittance records:", error);
        Swal.close();
        await this.$swal.fire({
          icon: "error",
          title: "Remittance sync failed",
          text: error.message || "Failed to sync remittance records.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.isSyncingRemittance = false;
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

    hasExportPermission() {
      return this.authStore.hasPermission("payments", "export");
    },

    getSelectedPaymentLabel() {
      if (!this.filters.paymentId) return "All Payments";
      const selectedPayment = this.paymentOptions.find(
        (payment) => payment.id === this.filters.paymentId,
      );
      return selectedPayment?.name || "Selected Payment";
    },

    getSelectedProgramLabel() {
      if (!this.filters.programId) return "All Programs";
      const selectedProgram = this.programOptions.find(
        (program) => program.id === this.filters.programId,
      );
      return this.getProgramOptionLabel(selectedProgram);
    },

    getSelectedAcademicSessionLabel() {
      if (!this.filters.academicSessionId) return "All Academic Sessions";
      const selectedSession = this.academicSessions.find(
        (session) => session._id === this.filters.academicSessionId,
      );
      return selectedSession?.sessionYear || "Selected Session";
    },

    getExportFilterSummary() {
      return [
        { label: "Search", value: this.filters.search.trim() || "All Records" },
        {
          label: "Status",
          value: this.filters.status
            ? this.formatLabel(this.filters.status)
            : "All Statuses",
        },
        {
          label: "Method",
          value: this.filters.method
            ? this.formatLabel(this.filters.method)
            : "All Methods",
        },
        { label: "Payment Type", value: this.getSelectedPaymentLabel() },
        { label: "Program", value: this.getSelectedProgramLabel() },
        {
          label: "Academic Session",
          value: this.getSelectedAcademicSessionLabel(),
        },
        { label: "Date Range", value: this.getSelectedDateRangeLabel() },
      ];
    },

    getSelectedDateRangeLabel() {
      const { dateFrom, dateTo } = this.filters;

      if (dateFrom && dateTo) {
        return `${dateFrom} to ${dateTo}`;
      }

      if (dateFrom) {
        return `From ${dateFrom}`;
      }

      if (dateTo) {
        return `Up to ${dateTo}`;
      }

      return "All Dates";
    },

    getPaymentExportRows(payments) {
      return payments.map((payment) => ({
        user: this.getUserDisplayName(payment),
        identifier: this.getIdentifierValue(payment),
        email: payment.email || "N/A",
        program: this.getProgramDisplay(payment),
        session: payment.academicSessionLabel || "N/A",
        paymentName: payment.paymentName || "N/A",
        reference: this.getReferenceDisplay(payment.reference),
        amount: this.formatCurrency(payment.amount),
        method: this.formatLabel(payment.method),
        status: this.formatLabel(payment.status),
        datePaid: this.formatDateTime(this.getEffectivePaidDate(payment)),
        channel: this.formatLabel(payment.channel),
        remarks: this.safeDisplay(payment.remarks),
        verificationRemarks: this.safeDisplay(payment.verificationRemarks),
      }));
    },

    escapeCsvValue(value) {
      const normalized = String(value ?? "").replace(/"/g, '""');
      return `"${normalized}"`;
    },

    downloadBlob(content, type, fileName) {
      const blob = new Blob([content], { type });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },

    buildExportFileName(extension) {
      const dateStamp = new Date().toISOString().slice(0, 10);
      return `student-payments-${dateStamp}.${extension}`;
    },

    async fetchAllFilteredPaymentsForExport() {
      const exportPageSize = 250;
      let page = 1;
      let totalPages = 1;
      const allPayments = [];

      do {
        const response = await apiService.getStudentPayments(
          this.buildPaymentQueryParams({
            page,
            limit: exportPageSize,
          }),
        );

        if (!response.success) {
          throw new Error(
            response.error ||
              response.message ||
              "Failed to load payments for export",
          );
        }

        const exportData = response.data?.payments || [];
        const pagination = response.data?.pagination || {};

        allPayments.push(...exportData);
        totalPages = pagination.totalPages || 1;
        page += 1;
      } while (page <= totalPages);

      return allPayments;
    },

    async exportStudentPayments(format) {
      if (this.exportingFormat) {
        return;
      }

      if (!this.hasExportPermission()) {
        await this.$swal.fire({
          icon: "error",
          title: "Access Denied",
          text: "You do not have permission to export payment records.",
          confirmButtonColor: "#1a5f5f",
        });
        return;
      }

      try {
        this.exportingFormat = format;

        Swal.fire({
          title: `Preparing ${format.toUpperCase()} Export...`,
          text: "Please wait while we gather the filtered payment records.",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const exportParams = this.buildPaymentQueryParams();

        const exportPayments = await this.fetchAllFilteredPaymentsForExport();

        if (!exportPayments.length) {
          Swal.close();
          await this.$swal.fire({
            icon: "info",
            title: "Nothing to Export",
            text: "No student payments match the current filters.",
            confirmButtonColor: "#1a5f5f",
          });
          return;
        }

        if (format === "pdf") {
          await apiService.exportStudentPaymentsPDF(exportParams);

          Swal.close();
          await this.$swal.fire({
            icon: "success",
            title: "PDF Export Ready",
            text: "The filtered student payments PDF has been generated and downloaded.",
            confirmButtonColor: "#1a5f5f",
          });
          return;
        }
        const exportRows = this.getPaymentExportRows(exportPayments);

        if (format === "csv") {
          const headers = [
            "User",
            "Identifier",
            "Email",
            "Program",
            "Academic Session",
            "Payment",
            "Reference",
            "Amount",
            "Method",
            "Status",
            "Date Paid",
            "Channel",
            "Remarks",
            "Verification Remarks",
          ];

          const csvRows = [
            headers.map((header) => this.escapeCsvValue(header)).join(","),
            ...exportRows.map((row) =>
              [
                row.user,
                row.identifier,
                row.email,
                row.program,
                row.session,
                row.paymentName,
                row.reference,
                row.amount,
                row.method,
                row.status,
                row.datePaid,
                row.channel,
                row.remarks,
                row.verificationRemarks,
              ]
                .map((value) => this.escapeCsvValue(value))
                .join(","),
            ),
          ].join("\n");

          this.downloadBlob(
            csvRows,
            "text/csv;charset=utf-8;",
            this.buildExportFileName("csv"),
          );

          Swal.close();
          await this.$swal.fire({
            icon: "success",
            title: "CSV Export Ready",
            text: `${exportRows.length} filtered payment record(s) exported successfully.`,
            confirmButtonColor: "#1a5f5f",
          });
          return;
        }
      } catch (error) {
        logger.error("Failed to export student payments:", error);
        Swal.close();
        await this.$swal.fire({
          icon: "error",
          title: "Export Failed",
          text: error.message || "Failed to export student payments.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.exportingFormat = "";
      }
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
      const normalized =
        value === null || value === undefined ? "" : String(value).trim();
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
                  item.valueHtml ||
                  this.escapeHtml(this.safeDisplay(item.value))
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

        await Promise.all([this.loadPayments(), this.loadPaymentStats()]);

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

        await Promise.all([this.loadPayments(), this.loadPaymentStats()]);

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
      void this.loadPaymentStats();
      this.loadPayments();
    },

    async refreshPayments() {
      await Promise.all([
        this.loadFilterOptions(),
        this.loadPayments(),
        this.loadPaymentStats(),
      ]);
    },
  },
};
</script>

<template>
  <div class="container-fluid p-4 payments-page">
    <div class="d-flex flex-row gap-3 mb-4">
      <div>
        <h2 class="fw-bold text-staff-primary mb-1">Payments Management</h2>
        <p class="text-muted mb-0">
          Search, filter, and manage student payment records across academic
          sessions and programmes.
        </p>
      </div>
      <div class="d-flex ms-auto gap-2 align-items-end">
        <div>
          <button class="btn btn-staff-primary btn-sm" @click="refreshPayments">
            <i class="bi bi-arrow-clockwise me-2"></i>Refresh
          </button>
        </div>
        <div class="dropdown">
          <button
            class="btn btn-secondary btn-sm dropdown-toggle"
            type="button"
            data-bs-toggle="dropdown"
            :disabled="!!exportingFormat || isLoading"
            aria-expanded="false"
          >
            <span
              v-if="exportingFormat"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            <i v-else class="bi bi-download me-2"></i>Export
          </button>
          <ul class="dropdown-menu">
            <li>
              <a
                class="dropdown-item"
                href="#"
                :class="{ disabled: !!exportingFormat || isLoading }"
                :aria-disabled="!!exportingFormat || isLoading"
                @click.prevent="exportStudentPayments('csv')"
                ><i class="bi bi-filetype-csv"></i> Export as CSV</a
              >
            </li>
            <li>
              <a
                class="dropdown-item"
                href="#"
                :class="{ disabled: !!exportingFormat || isLoading }"
                :aria-disabled="!!exportingFormat || isLoading"
                @click.prevent="exportStudentPayments('pdf')"
                ><i class="bi bi-file-earmark-pdf"></i> Export as PDF</a
              >
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="col-lg-3 col-md-6 mb-3">
      <!-- <label class="form-label">Session</label> -->
      <select
        v-model="filters.academicSessionId"
        class="form-select form-select-sm"
      >
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

    <!-- Stats Cards Row -->
    <div class="row mb-4" v-if="authStore.hasPermission('payments', 'manage')">
      <!-- Total Revenue -->
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card p-0 h-100 border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-center">
              <div
                class="bg-success-subtle text-success rounded-circle d-flex align-items-center justify-content-center"
                style="width: 60px; height: 60px"
              >
                <i class="bi bi-piggy-bank fs-4"></i>
              </div>
              <div class="ms-3">
                <h6 class="card-title text-body-secondary">Total Revenue</h6>
                <h3 class="fw-bold text-dark mb-0">
                  {{ formatCurrency(paymentStats.totalRevenue) }}
                </h3>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Awaiting Verification -->
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card p-0 h-100 border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-center">
              <div
                class="bg-warning-subtle text-warning rounded-circle d-flex align-items-center justify-content-center"
                style="width: 60px; height: 60px"
              >
                <i class="bi bi-hourglass-split fs-4"></i>
              </div>
              <div class="ms-3">
                <h6 class="card-title text-body-secondary">
                  Awaiting Verification
                </h6>
                <h3 class="fw-bold text-dark mb-0">
                  {{ formatCurrency(paymentStats.awaitingVerification) }}
                </h3>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pending Remittance -->
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card p-0 h-100 border-0 shadow-sm pending-remittance-card">
          <div class="card-body position-relative">
            <button
              type="button"
              class="btn btn-outline-secondary rounded-circle btn-sm pending-remittance-trigger"
              :disabled="isSyncingRemittance"
              title="Sync and view remittance records"
              @click="openPendingRemittanceModal"
            >
              <span
                v-if="isSyncingRemittance"
                class="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
              <i v-else class="bi bi-eye"></i>
            </button>
            <div class="d-flex align-items-center justify-content-center">
              <div
                class="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center"
                style="width: 60px; height: 60px"
              >
                <i class="bi bi-bank fs-4"></i>
              </div>
              <div class="ms-3">
                <h6 class="card-title text-body-secondary">
                  Pending Remittance
                </h6>
                <h3 class="fw-bold text-dark mb-0">
                  {{ formatCurrency(paymentStats.pendingRemittance) }}
                </h3>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Today’s Revenue -->
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card p-0 h-100 border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-center">
              <div
                class="bg-info-subtle text-info rounded-circle d-flex align-items-center justify-content-center"
                style="width: 60px; height: 60px"
              >
                <i class="bi bi-calendar-check fs-4"></i>
              </div>
              <div class="ms-3">
                <h6 class="card-title text-body-secondary">Today’s Revenue</h6>
                <h3 class="fw-bold text-dark mb-0">
                  {{ formatCurrency(paymentStats.todaysRevenue) }}
                </h3>
                <small class="text-body-tertiary">{{
                  new Date().toLocaleDateString()
                }}</small>
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

    <div class="card border-0 shadow-sm p-0">
      <div class="card-header">
        <div class="d-flex gap-2 align-items-center">
          <input
            v-model="filters.search"
            type="text"
            class="form-control w-75 w-md-50"
            placeholder="Search by user, payment, application or matric number..."
          />
          <div class="dropdown ms-auto">
            <button
              class="btn btn-outline-secondary btn-sm dropdown-toggle"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i class="bi bi-sliders"></i> filters
            </button>

            <ul class="dropdown-menu p-3 shadow-sm" style="min-width: 300px">
              <div
                class="d-flex justify-content-between align-items-center mb-3"
              >
                <h6 class="dropdown-header p-0 fw-bold">Filter Payments</h6>
                <button class="btn btn-link btn-sm" @click="resetFilters">
                  Reset
                </button>
              </div>
              <div class="mb-3">
                <label class="form-label small text-muted mb-1">
                  Date Range
                </label>
                <div class="row g-2">
                  <div class="col-6">
                    <input
                      v-model="filters.dateFrom"
                      type="date"
                      class="form-control form-control-sm"
                      :max="filters.dateTo || undefined"
                    />
                  </div>
                  <div class="col-6">
                    <input
                      v-model="filters.dateTo"
                      type="date"
                      class="form-control form-control-sm"
                      :min="filters.dateFrom || undefined"
                    />
                  </div>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label small text-muted mb-1">Status</label>
                <select
                  v-model="filters.status"
                  class="form-select form-select-sm"
                >
                  <option
                    v-for="option in statusOptions"
                    :key="option.value || 'all-statuses'"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label small text-muted mb-1">
                  Methods
                </label>
                <select
                  v-model="filters.method"
                  class="form-select form-select-sm"
                >
                  <option
                    v-for="option in methodOptions"
                    :key="option.value || 'all-methods'"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label small text-muted mb-1">
                  Payment Types
                </label>
                <select
                  v-model="filters.paymentId"
                  class="form-select form-select-sm"
                >
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
              <div class="mb-3">
                <label class="form-label small text-muted mb-1">
                  Programs
                </label>
                <select
                  v-model="filters.programId"
                  class="form-select form-select-sm"
                >
                  <option value="">All Programs</option>
                  <option
                    v-for="program in programOptions"
                    :key="program.id"
                    :value="program.id"
                  >
                    {{ getProgramOptionLabel(program) }}
                  </option>
                </select>
              </div>
            </ul>
          </div>
        </div>
      </div>
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
            <table class="table table-hover mb-0 align-middle payments-table">
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
                    <div class="small text-muted text-break d-none d-xxl-block">
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
                    <div class="d-flex flex-wrap justify-content-center gap-2">
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
                              :class="{
                                disabled: isProcessingPayment(payment._id),
                              }"
                              :aria-disabled="isProcessingPayment(payment._id)"
                            >
                              <span
                                v-if="isProcessingPayment(payment._id)"
                                class="spinner-border spinner-border-sm me-1"
                              ></span>
                              <i v-else class="bi bi-check-circle-fill me-1"></i
                              >Verify
                            </a>
                          </li>
                          <li v-if="canReviewManualTransfer(payment)">
                            <a
                              class="dropdown-item text-danger"
                              href="#"
                              :class="{
                                disabled: isProcessingPayment(payment._id),
                              }"
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
                            :class="{
                              disabled: isProcessingPayment(payment._id),
                            }"
                            :aria-disabled="isProcessingPayment(payment._id)"
                          >
                            <span
                              v-if="isProcessingPayment(payment._id)"
                              class="spinner-border spinner-border-sm me-1"
                            ></span>
                            <i v-else class="bi bi-check-circle-fill me-1"></i
                            >Verify
                          </a>
                        </li>
                        <li v-if="canReviewManualTransfer(payment)">
                          <a
                            class="dropdown-item text-danger"
                            href="#"
                            :class="{
                              disabled: isProcessingPayment(payment._id),
                            }"
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
                      <div class="small text-uppercase text-muted fw-semibold">
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
                      <div class="small text-uppercase text-muted fw-semibold">
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

.pending-remittance-card {
  overflow: hidden;
}

.pending-remittance-trigger {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  text-decoration: none;
}

/* .pending-remittance-trigger:hover,
.pending-remittance-trigger:focus {
  color: var(--staff-primary);
} */

:deep(.payment-details-swal) {
  max-height: 90vh;
}

:deep(.payment-details-swal .swal2-title) {
  padding-bottom: 0.35rem;
}

:deep(.payment-details-html) {
  margin-top: 0.25rem;
}

:deep(.remittance-swal) {
  max-height: 92vh;
}

:deep(.remittance-html-container) {
  margin-top: 0.25rem;
  max-height: calc(92vh - 160px);
  overflow-y: auto;
}

:deep(.remittance-modal-summary) {
  padding: 0.9rem 1rem;
  border-radius: 14px;
  background: rgba(26, 95, 95, 0.05);
  border: 1px solid rgba(26, 95, 95, 0.08);
}

:deep(.remittance-tabs .nav-link) {
  color: var(--staff-primary);
}

:deep(.remittance-tabs .nav-link.active) {
  color: var(--staff-primary);
  font-weight: 600;
}

:deep(.remittance-table-wrap th) {
  white-space: nowrap;
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

  :deep(.remittance-html-container) {
    max-height: calc(92vh - 130px);
  }
}
</style>
