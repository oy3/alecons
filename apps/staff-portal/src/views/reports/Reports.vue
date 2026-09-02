<script>
import Swal from "sweetalert2";
import ReportChart from "../../components/reports/ReportChart.vue";
import { apiService } from "../../services/api.js";
import { useAuthStore } from "../../stores/auth.js";
import { logger } from "@shared/utils/logger";

const emptySchedule = () => ({
  name: "",
  reportType: "overview",
  format: "pdf",
  frequency: "weekly",
  dayOfWeek: 1,
  dayOfMonth: 1,
  time: "08:00",
  recipients: "",
});

export default {
  name: "ReportsAnalytics",
  components: { ReportChart },
  setup() {
    return { authStore: useAuthStore() };
  },
  data() {
    return {
      activeTab: "overview",
      report: null,
      website: null,
      options: {
        academicSessions: [],
        programs: [],
        programTypes: [],
        programModes: [],
        departments: [],
      },
      filters: {
        academicSessionId: "",
        dateFrom: "",
        dateTo: "",
        programTypeId: "",
        programModeId: "",
        programId: "",
        departmentId: "",
        level: "",
        semester: "",
        compare: false,
      },
      loading: true,
      error: "",
      exportFormat: "pdf",
      exporting: false,
      showScheduleModal: false,
      scheduleForm: emptySchedule(),
      schedules: [],
      exportHistory: [],
      savingSchedule: false,
      selectedBreakdown: null,
    };
  },
  computed: {
    tabs() {
      const definitions = [
        ["overview", "Overview", "view"],
        ["admissions", "Admissions", "view_admissions"],
        ["students", "Students", "view_students"],
        ["finance", "Finance", "view_finance"],
        ["academics", "Academics", "view_academics"],
        ["exams", "Examinations", "view_exams"],
        ["communications", "Communications", "view_communications"],
        ["activity", "Activity", "view_activity"],
      ];
      const allowed = definitions
        .filter(([, , permission]) =>
          this.authStore.hasPermission("reports", permission),
        )
        .map(([id, label]) => ({ id, label }));
      if (this.authStore.hasPermission("reports", "export"))
        allowed.push({ id: "reportCenter", label: "Report Center" });
      return allowed;
    },
    filteredPrograms() {
      return this.options.programs.filter(
        (program) =>
          (!this.filters.programTypeId ||
            String(program.programTypeId?._id || program.programTypeId) ===
              this.filters.programTypeId) &&
          (!this.filters.programModeId ||
            String(program.programModeId?._id || program.programModeId) ===
              this.filters.programModeId) &&
          (!this.filters.departmentId ||
            String(program.departmentId?._id || program.departmentId) ===
              this.filters.departmentId),
      );
    },
    selectedProgram() {
      return this.options.programs.find(
        (program) => String(program._id) === this.filters.programId,
      );
    },
    levels() {
      return Array.from(
        { length: Number(this.selectedProgram?.durationYears || 0) },
        (_, index) => index + 1,
      );
    },
    kpis() {
      const map = {
        overview: [
          [
            "Applications",
            this.report?.kpis?.applications,
            "bi-file-earmark-text",
            "primary",
          ],
          [
            "Admission rate",
            this.percentValue(this.report?.kpis?.admissionRate),
            "bi-person-check",
            "success",
          ],
          [
            "Active students",
            this.report?.kpis?.activeStudents,
            "bi-mortarboard",
            "info",
          ],
          [
            "Collections",
            this.currency(this.report?.kpis?.collections),
            "bi-credit-card",
            "warning",
          ],
          [
            "Results published",
            this.percentValue(this.report?.kpis?.resultPublicationRate),
            "bi-clipboard-data",
            "success",
          ],
          [
            "Academic interventions",
            this.report?.kpis?.academicInterventions,
            "bi-exclamation-triangle",
            "danger",
          ],
          [
            "Active portal users",
            this.report?.kpis?.activePortalUsers,
            "bi-activity",
            "primary",
          ],
        ],
        admissions: [
          [
            "Applications",
            this.report?.kpis?.totalApplications,
            "bi-file-earmark-text",
            "primary",
          ],
          ["Pending", this.report?.kpis?.pending, "bi-hourglass", "warning"],
          [
            "Admitted",
            this.report?.kpis?.admitted,
            "bi-person-check",
            "success",
          ],
          [
            "Admission rate",
            this.percentValue(this.report?.kpis?.admissionRate),
            "bi-graph-up",
            "info",
          ],
        ],
        students: [
          ["Students", this.report?.kpis?.total, "bi-people", "primary"],
          ["Active", this.report?.kpis?.active, "bi-person-check", "success"],
          [
            "Suspended",
            this.report?.kpis?.suspended,
            "bi-person-dash",
            "warning",
          ],
          ["Graduated", this.report?.kpis?.graduated, "bi-mortarboard", "info"],
          [
            "Portal disabled",
            this.report?.kpis?.portalDisabled,
            "bi-lock",
            "danger",
          ],
        ],
        finance: [
          [
            "Collections",
            this.currency(this.report?.kpis?.successfulCollections),
            "bi-cash-stack",
            "success",
          ],
          [
            "Expected student fees",
            this.currency(this.report?.kpis?.expectedStudentFees),
            "bi-receipt",
            "primary",
          ],
          [
            "Outstanding",
            this.currency(this.report?.kpis?.outstandingStudentFees),
            "bi-exclamation-circle",
            "danger",
          ],
          [
            "Collection rate",
            this.percentValue(this.report?.kpis?.collectionRate),
            "bi-graph-up",
            "info",
          ],
          [
            "Pending transactions",
            this.report?.kpis?.pendingTransactions,
            "bi-hourglass",
            "warning",
          ],
        ],
        academics: [
          [
            "Published results",
            this.report?.kpis?.published,
            "bi-clipboard-check",
            "success",
          ],
          [
            "Publication rate",
            this.percentValue(this.report?.kpis?.publicationRate),
            "bi-graph-up",
            "primary",
          ],
          [
            "Pass rate",
            this.percentValue(this.report?.kpis?.passRate),
            "bi-award",
            "info",
          ],
          [
            "Review backlog",
            this.report?.kpis?.reviewBacklog,
            "bi-clock-history",
            "warning",
          ],
          [
            "Resit required",
            this.report?.kpis?.resitRequired,
            "bi-arrow-repeat",
            "danger",
          ],
          [
            "Repeat required",
            this.report?.kpis?.repeatRequired,
            "bi-calendar2-x",
            "danger",
          ],
        ],
        exams: [
          ["Exams", this.report?.kpis?.totalExams, "bi-file-text", "primary"],
          [
            "Attempts",
            this.report?.kpis?.totalAttempts,
            "bi-pencil-square",
            "info",
          ],
          [
            "Completion rate",
            this.percentValue(this.report?.kpis?.completionRate),
            "bi-check2-circle",
            "success",
          ],
          [
            "Average score",
            this.percentValue(this.report?.kpis?.averageScore),
            "bi-bar-chart",
            "warning",
          ],
          [
            "Pass rate",
            this.percentValue(this.report?.kpis?.passRate),
            "bi-award",
            "success",
          ],
        ],
        communications: [
          ["Campaigns", this.report?.kpis?.total, "bi-megaphone", "primary"],
          ["Sent", this.report?.kpis?.sent, "bi-send-check", "success"],
          ["Recipients", this.report?.kpis?.recipients, "bi-people", "info"],
          [
            "Read rate",
            this.percentValue(this.report?.kpis?.readRate),
            "bi-check2-all",
            "success",
          ],
          [
            "Delivery issues",
            this.report?.kpis?.failed,
            "bi-exclamation-circle",
            "danger",
          ],
        ],
        activity: [
          [
            "Portal events",
            this.report?.kpis?.events,
            "bi-activity",
            "primary",
          ],
          [
            "Active users",
            this.report?.kpis?.activeUsers,
            "bi-people",
            "success",
          ],
          [
            "Website visitors",
            this.websiteMetric("visitors"),
            "bi-globe",
            "info",
          ],
          [
            "Website pageviews",
            this.websiteMetric("pageviews"),
            "bi-eye",
            "warning",
          ],
        ],
      };
      return (map[this.activeTab] || []).map(([label, value, icon, color]) => ({
        label,
        value: value ?? 0,
        icon,
        color,
      }));
    },
    primaryBreakdown() {
      const map = {
        admissions: "byProgram",
        students: "byProgram",
        finance: "byFee",
        academics: "workflow",
        exams: "byStatus",
        communications: "byStatus",
        activity: "byRoute",
      };
      return this.report?.[map[this.activeTab]] || [];
    },
    secondaryBreakdown() {
      const map = {
        admissions: "byStatus",
        students: "demographics",
        finance: "byMethod",
        academics: "gradeDistribution",
        communications: "byCategory",
        activity: "byPortal",
      };
      return this.report?.[map[this.activeTab]] || [];
    },
    trendItems() {
      if (this.activeTab === "overview")
        return this.report?.trends?.collections || [];
      return this.report?.monthlyTrend || this.report?.dailyTrend || [];
    },
    websiteTrendItems() {
      const trend = this.website?.trend;
      return Array.isArray(trend) ? trend : trend?.pageviews || [];
    },
    websiteTopPages() {
      return Array.isArray(this.website?.topPages) ? this.website.topPages : [];
    },
  },
  watch: {
    "filters.programTypeId"() {
      this.resetProgram();
    },
    "filters.programModeId"() {
      this.resetProgram();
    },
    "filters.departmentId"() {
      this.resetProgram();
    },
    "filters.programId"() {
      this.filters.level = "";
    },
  },
  async mounted() {
    try {
      await this.loadOptions();
      if (!this.tabs.some((tab) => tab.id === this.activeTab))
        this.activeTab = this.tabs[0]?.id || "reportCenter";
      await this.loadActiveTab();
    } catch (error) {
      this.handleError(error);
    }
  },
  methods: {
    async loadOptions() {
      const response = await apiService.getReportFilterOptions();
      this.options = response.data || this.options;
      const preferred =
        this.options.academicSessions.find((session) =>
          ["open", "ongoing"].includes(session.status),
        ) || this.options.academicSessions[0];
      this.filters.academicSessionId = preferred?._id || "";
    },
    async selectTab(tab) {
      this.activeTab = tab;
      this.selectedBreakdown = null;
      await this.loadActiveTab();
    },
    async loadActiveTab(refresh = false) {
      if (this.activeTab === "reportCenter") return this.loadReportCenter();
      this.loading = true;
      this.error = "";
      try {
        const response = await apiService.getAnalyticsReport(
          this.activeTab,
          this.cleanFilters(),
          refresh,
        );
        this.report = response.data || null;
        if (this.activeTab === "activity") {
          try {
            this.website = (
              await apiService.getWebsiteAnalytics(this.cleanFilters())
            ).data;
          } catch {
            this.website = { configured: false };
          }
        }
      } catch (error) {
        this.handleError(error);
      } finally {
        this.loading = false;
      }
    },
    async loadReportCenter() {
      this.loading = true;
      this.error = "";
      try {
        const [schedules, history] = await Promise.all([
          apiService.getReportSchedules(),
          apiService.getReportExportHistory(),
        ]);
        this.schedules = schedules.data || [];
        this.exportHistory = history.data?.items || [];
      } catch (error) {
        this.handleError(error);
      } finally {
        this.loading = false;
      }
    },
    async exportReport() {
      if (this.activeTab === "reportCenter") return;
      this.exporting = true;
      try {
        await apiService.exportAnalyticsReport({
          ...this.cleanFilters(),
          reportType: this.activeTab,
          format: this.exportFormat,
        });
      } catch (error) {
        this.handleError(error, "Export failed");
      } finally {
        this.exporting = false;
      }
    },
    openSchedule() {
      this.scheduleForm = {
        ...emptySchedule(),
        reportType:
          this.activeTab === "reportCenter" ? "overview" : this.activeTab,
      };
      this.showScheduleModal = true;
    },
    async saveSchedule() {
      this.savingSchedule = true;
      try {
        const recipients = this.scheduleForm.recipients
          .split(/[;,\n]/)
          .map((item) => item.trim())
          .filter(Boolean);
        await apiService.createReportSchedule({
          ...this.cleanFilters(),
          ...this.scheduleForm,
          recipients,
        });
        this.showScheduleModal = false;
        await Swal.fire({
          icon: "success",
          title: "Schedule created",
          text: "The report will be generated and emailed automatically.",
        });
        if (this.activeTab === "reportCenter") await this.loadReportCenter();
      } catch (error) {
        this.handleError(error, "Could not create schedule");
      } finally {
        this.savingSchedule = false;
      }
    },
    async toggleSchedule(schedule) {
      try {
        await apiService.updateReportSchedule(schedule._id, {
          active: !schedule.active,
        });
        await this.loadReportCenter();
      } catch (error) {
        this.handleError(error, "Could not update schedule");
      }
    },
    async syncObligations() {
      if (!this.filters.academicSessionId) return;
      try {
        const response = await apiService.syncFeeObligations(
          this.filters.academicSessionId,
        );
        await Swal.fire({
          icon: "success",
          title: "Fee obligations synchronized",
          text: `${response.data?.created || 0} obligations added and ${response.data?.paid || 0} reconciled.`,
        });
        await this.loadActiveTab(true);
      } catch (error) {
        this.handleError(error, "Synchronization failed");
      }
    },
    cleanFilters() {
      return Object.fromEntries(
        Object.entries(this.filters).filter(
          ([, value]) => value !== "" && value !== null && value !== false,
        ),
      );
    },
    resetProgram() {
      this.filters.programId = "";
      this.filters.level = "";
    },
    handleError(error, title = "Could not load reports") {
      logger.error(title, error);
      this.error = error.message || title;
      if (title !== "Could not load reports")
        Swal.fire({ icon: "error", title, text: this.error });
    },
    currency(value) {
      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(Number(value || 0));
    },
    percentValue(value) {
      return `${Number(value || 0).toFixed(1)}%`;
    },
    websiteMetric(key) {
      if (!this.website?.configured) return "Not configured";
      const metric = this.website?.stats?.[key];
      return Number(metric?.value ?? metric ?? 0).toLocaleString();
    },
    formatDate(value) {
      return value
        ? new Intl.DateTimeFormat("en-NG", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(value))
        : "Never";
    },
    label(value) {
      return String(value ?? "Not specified")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    },
    breakdownLabel(item) {
      return (
        item.label ||
        item.routeName ||
        item.key ||
        item.period ||
        "Not specified"
      );
    },
    breakdownValue(item) {
      return item.amount !== undefined
        ? this.currency(item.amount)
        : Number(item.count || 0).toLocaleString();
    },
    comparisonChange(label) {
      const keys = {
        overview: {
          Applications: "applications",
          "Admission rate": "admissionRate",
          "Active students": "activeStudents",
          Collections: "collections",
          "Results published": "resultPublicationRate",
          "Academic interventions": "academicInterventions",
          "Active portal users": "activePortalUsers",
        },
        admissions: {
          Applications: "totalApplications",
          Pending: "pending",
          Admitted: "admitted",
          "Admission rate": "admissionRate",
        },
        students: {
          Students: "total",
          Active: "active",
          Suspended: "suspended",
          Graduated: "graduated",
          "Portal disabled": "portalDisabled",
        },
        finance: {
          Collections: "successfulCollections",
          "Expected student fees": "expectedStudentFees",
          Outstanding: "outstandingStudentFees",
          "Collection rate": "collectionRate",
          "Pending transactions": "pendingTransactions",
        },
        academics: {
          "Published results": "published",
          "Publication rate": "publicationRate",
          "Pass rate": "passRate",
          "Review backlog": "reviewBacklog",
          "Resit required": "resitRequired",
          "Repeat required": "repeatRequired",
        },
        exams: {
          Exams: "totalExams",
          Attempts: "totalAttempts",
          "Completion rate": "completionRate",
          "Average score": "averageScore",
          "Pass rate": "passRate",
        },
        communications: {
          Campaigns: "total",
          Sent: "sent",
          Recipients: "recipients",
          "Read rate": "readRate",
          "Delivery issues": "failed",
        },
        activity: { "Portal events": "events", "Active users": "activeUsers" },
      };
      const key = keys[this.activeTab]?.[label];
      return key ? this.report?.comparison?.changes?.[key] : null;
    },
  },
};
</script>

<template>
  <div class="container-fluid reports-page p-3 p-lg-4">
    <header
      class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4"
    >
      <div>
        <h2 class="fw-bold text-staff-primary mb-1">Reports & Analytics</h2>
        <p class="text-muted mb-0">
          Institutional performance, operational trends and governed exports.
        </p>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button
          v-if="
            activeTab === 'finance' &&
            authStore.hasPermission('reports', 'manage')
          "
          class="btn btn-outline-staff-primary btn-sm"
          @click="syncObligations"
        >
          <i class="bi bi-arrow-repeat me-1"></i>Sync obligations
        </button>
        <button
          v-if="authStore.hasPermission('reports', 'export')"
          class="btn btn-outline-staff-primary btn-sm"
          @click="openSchedule"
        >
          <i class="bi bi-clock me-1"></i>Schedule
        </button>
        <div
          v-if="
            activeTab !== 'reportCenter' &&
            authStore.hasPermission('reports', 'export')
          "
          class="input-group input-group-sm export-control"
        >
          <select
            v-model="exportFormat"
            class="form-select"
            aria-label="Export format"
          >
            <option value="csv">CSV</option>
            <option value="xlsx">Excel</option>
            <option value="pdf">PDF</option>
          </select>
          <button
            class="btn btn-staff-primary"
            :disabled="exporting"
            @click="exportReport"
          >
            <i class="bi bi-download me-1"></i
            >{{ exporting ? "Preparing" : "Export" }}
          </button>
        </div>
        <button
          v-if="activeTab !== 'reportCenter'"
          class="btn btn-outline-secondary btn-sm"
          @click="loadActiveTab(true)"
          title="Refresh report"
        >
          <i class="bi bi-arrow-clockwise"></i>
        </button>
      </div>
    </header>

    <nav class="report-tabs mb-3" aria-label="Report areas">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="report-tab"
        :class="{ active: activeTab === tab.id }"
        @click="selectTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <section
      v-if="activeTab !== 'reportCenter'"
      class="filter-band mb-4"
      aria-label="Report filters"
    >
      <div class="row g-2">
        <div class="col-xl-2 col-md-4">
          <label class="form-label">Academic session</label
          ><select
            v-model="filters.academicSessionId"
            class="form-select form-select-sm"
          >
            <option value="">All sessions</option>
            <option
              v-for="session in options.academicSessions"
              :key="session._id"
              :value="session._id"
            >
              {{ session.title || session.sessionYear }}
            </option>
          </select>
        </div>
        <div class="col-xl-2 col-md-4">
          <label class="form-label">Program type</label
          ><select
            v-model="filters.programTypeId"
            class="form-select form-select-sm"
          >
            <option value="">All types</option>
            <option
              v-for="item in options.programTypes"
              :key="item._id"
              :value="item._id"
            >
              {{ item.type }}
            </option>
          </select>
        </div>
        <div class="col-xl-2 col-md-4">
          <label class="form-label">Program mode</label
          ><select
            v-model="filters.programModeId"
            class="form-select form-select-sm"
          >
            <option value="">All modes</option>
            <option
              v-for="item in options.programModes"
              :key="item._id"
              :value="item._id"
            >
              {{ item.mode }}
            </option>
          </select>
        </div>
        <div class="col-xl-2 col-md-4">
          <label class="form-label">Program</label
          ><select
            v-model="filters.programId"
            class="form-select form-select-sm"
          >
            <option value="">All programs</option>
            <option
              v-for="program in filteredPrograms"
              :key="program._id"
              :value="program._id"
            >
              {{ program.name }}
            </option>
          </select>
        </div>
        <div class="col-xl-2 col-md-4">
          <label class="form-label">Department</label
          ><select
            v-model="filters.departmentId"
            class="form-select form-select-sm"
          >
            <option value="">All departments</option>
            <option
              v-for="item in options.departments"
              :key="item._id"
              :value="item._id"
            >
              {{ item.name }}
            </option>
          </select>
        </div>
        <div class="col-xl-1 col-md-2">
          <label class="form-label">Level</label
          ><select
            v-model="filters.level"
            class="form-select form-select-sm"
            :disabled="!filters.programId"
          >
            <option value="">All</option>
            <option v-for="level in levels" :key="level" :value="level">
              {{ level }}
            </option>
          </select>
        </div>
        <div class="col-xl-1 col-md-2">
          <label class="form-label">Semester</label
          ><select
            v-model="filters.semester"
            class="form-select form-select-sm"
          >
            <option value="">All</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label">From</label
          ><input
            v-model="filters.dateFrom"
            type="date"
            class="form-control form-control-sm"
          />
        </div>
        <div class="col-md-3">
          <label class="form-label">To</label
          ><input
            v-model="filters.dateTo"
            type="date"
            class="form-control form-control-sm"
          />
        </div>
        <div class="col-md-auto align-self-end">
          <div class="form-check form-switch pb-1">
            <input
              id="compare-reports"
              v-model="filters.compare"
              class="form-check-input"
              type="checkbox"
            /><label class="form-check-label small" for="compare-reports"
              >Compare previous</label
            >
          </div>
        </div>
        <div class="col-md-auto align-self-end">
          <button class="btn btn-staff-primary btn-sm" @click="loadActiveTab()">
            <i class="bi bi-funnel me-1"></i>Apply filters
          </button>
        </div>
        <div class="col align-self-end text-md-end">
          <small v-if="report?.cache" class="text-muted"
            >Updated {{ formatDate(report.cache.generatedAt)
            }}<span v-if="report.cache.hit"> · cached</span></small
          >
        </div>
      </div>
    </section>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-staff-primary" role="status">
        <span class="visually-hidden">Loading reports</span>
      </div>
      <p class="text-muted mt-3">Calculating report…</p>
    </div>
    <div v-else-if="error" class="alert alert-danger">
      <i class="bi bi-exclamation-triangle me-2"></i>{{ error
      }}<button
        class="btn btn-sm btn-outline-danger ms-3"
        @click="loadActiveTab(true)"
      >
        Retry
      </button>
    </div>

    <template v-else-if="activeTab !== 'reportCenter'">
      <section class="row g-3 mb-4" aria-label="Key metrics">
        <div
          v-for="item in kpis"
          :key="item.label"
          class="col-6 col-md-4 col-xl"
        >
          <div class="metric-card h-100">
            <div
              class="metric-icon"
              :class="`text-${item.color} bg-${item.color}-subtle`"
            >
              <i :class="`bi ${item.icon}`"></i>
            </div>
            <div class="min-w-0">
              <div class="metric-value">{{ item.value }}</div>
              <div class="metric-label">{{ item.label }}</div>
              <small
                v-if="
                  comparisonChange(item.label) !== null &&
                  comparisonChange(item.label) !== undefined
                "
                :class="
                  comparisonChange(item.label) >= 0
                    ? 'text-success'
                    : 'text-danger'
                "
                ><i
                  :class="`bi ${comparisonChange(item.label) >= 0 ? 'bi-arrow-up' : 'bi-arrow-down'}`"
                ></i
                >{{ Math.abs(comparisonChange(item.label)) }}% vs
                previous</small
              >
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'overview'" class="row g-4 mb-4">
        <div class="col-lg-8">
          <div class="section-heading">
            <h5>Collection trend</h5>
            <span>Successful payments over time</span>
          </div>
          <ReportChart
            type="line"
            :items="trendItems"
            label-key="period"
            value-key="amount"
            dataset-label="Collections"
            currency
          />
        </div>
        <div class="col-lg-4">
          <div class="section-heading">
            <h5>Workflow attention</h5>
            <span>Items requiring staff action</span>
          </div>
          <div class="list-group list-group-flush  shadow-sm rounded-3">
            <div
              v-for="(value, key) in report.workflow"
              :key="key"
              class="list-group-item d-flex justify-content-between"
            >
              <span>{{ label(key) }}</span
              ><strong>{{ Number(value).toLocaleString() }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section v-else class="row g-4 mb-4">
        <div class="col-lg-7">
          <div class="section-heading">
            <h5>Primary breakdown</h5>
            <span>Click a chart item to inspect its value</span>
          </div>
          <ReportChart
            :type="activeTab === 'communications' ? 'doughnut' : 'bar'"
            :items="primaryBreakdown"
            :label-key="
              activeTab === 'activity'
                ? 'routeName'
                : primaryBreakdown[0]?.label
                  ? 'label'
                  : 'key'
            "
            :value-key="activeTab === 'finance' ? 'amount' : 'count'"
            :dataset-label="label(activeTab)"
            :horizontal="primaryBreakdown.length > 6"
            :currency="activeTab === 'finance'"
            @select="selectedBreakdown = $event"
          />
        </div>
        <div class="col-lg-5">
          <div class="section-heading">
            <h5>Distribution</h5>
            <span>Current filtered population</span>
          </div>
          <ReportChart
            type="doughnut"
            :items="secondaryBreakdown"
            :label-key="secondaryBreakdown[0]?.label ? 'label' : 'key'"
            value-key="count"
            dataset-label="Distribution"
            @select="selectedBreakdown = $event"
          />
        </div>
      </section>

      <section
        v-if="activeTab === 'activity' && website?.configured"
        class="row g-4 mb-4"
        aria-label="Public website analytics"
      >
        <div class="col-lg-7">
          <div class="section-heading">
            <h5>Website pageviews</h5>
            <span>Public website traffic from Umami</span>
          </div>
          <ReportChart
            type="line"
            :items="websiteTrendItems"
            label-key="x"
            value-key="y"
            dataset-label="Pageviews"
          />
        </div>
        <div class="col-lg-5">
          <div class="section-heading">
            <h5>Top website pages</h5>
            <span>Most viewed public routes</span>
          </div>
          <ReportChart
            type="bar"
            :items="websiteTopPages"
            label-key="x"
            value-key="y"
            dataset-label="Pageviews"
            horizontal
          />
        </div>
      </section>

      <section class="report-table-section">
        <div class="section-heading d-flex justify-content-between">
          <div>
            <h5>Breakdown table</h5>
            <span>Exact values behind the visual summary</span>
          </div>
          <span v-if="selectedBreakdown" class="badge text-bg-light border"
            >Selected: {{ breakdownLabel(selectedBreakdown) }}</span
          >
        </div>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Category</th>
                <th class="text-end">Records</th>
                <th v-if="activeTab === 'finance'" class="text-end">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in primaryBreakdown" :key="breakdownLabel(item)">
                <td>{{ label(breakdownLabel(item)) }}</td>
                <td class="text-end">
                  {{ Number(item.count || 0).toLocaleString() }}
                </td>
                <td v-if="activeTab === 'finance'" class="text-end fw-semibold">
                  {{ currency(item.amount) }}
                </td>
              </tr>
              <tr v-if="!primaryBreakdown.length">
                <td colspan="3" class="text-center text-muted py-4">
                  No data matched the selected filters.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <template v-else>
      <section
        class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"
      >
        <div class="section-heading mb-0">
          <h5>Scheduled reports</h5>
          <span>Automatic governed delivery to approved recipients</span>
        </div>
        <button class="btn btn-staff-primary btn-sm" @click="openSchedule">
          <i class="bi bi-plus-lg me-1"></i>New schedule
        </button>
      </section>
      <div class="table-responsive report-table-section mb-5">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Name</th>
              <th>Report</th>
              <th>Frequency</th>
              <th>Next run</th>
              <th>Status</th>
              <th class="text-end">Active</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in schedules" :key="item._id">
              <td>
                <strong>{{ item.name }}</strong>
                <div class="small text-muted">
                  {{ item.recipients.join(", ") }}
                </div>
              </td>
              <td>
                {{ label(item.reportType) }} · {{ item.format.toUpperCase() }}
              </td>
              <td>{{ label(item.frequency) }} at {{ item.time }}</td>
              <td>{{ formatDate(item.nextRunAt) }}</td>
              <td>
                <span
                  class="badge"
                  :class="
                    item.lastRunStatus === 'failed'
                      ? 'text-bg-danger'
                      : item.lastRunStatus === 'success'
                        ? 'text-bg-success'
                        : 'text-bg-light'
                  "
                  >{{ label(item.lastRunStatus) }}</span
                >
              </td>
              <td class="text-end">
                <div class="form-check form-switch d-inline-block">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :checked="item.active"
                    @change="toggleSchedule(item)"
                    :aria-label="`Toggle ${item.name}`"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!schedules.length">
              <td colspan="6" class="text-center text-muted py-4">
                No scheduled reports yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="section-heading">
        <h5>Export history</h5>
        <span>Audit trail for downloaded and delivered reports</span>
      </div>
      <div class="table-responsive report-table-section">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Report</th>
              <th>Format</th>
              <th>Rows</th>
              <th>Generated by</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in exportHistory" :key="item._id">
              <td>{{ label(item.reportType) }}</td>
              <td>{{ item.format.toUpperCase() }}</td>
              <td>{{ item.rowCount.toLocaleString() }}</td>
              <td>
                {{ item.actorUserId?.firstName }}
                {{ item.actorUserId?.lastName }}
              </td>
              <td>{{ formatDate(item.createdAt) }}</td>
            </tr>
            <tr v-if="!exportHistory.length">
              <td colspan="5" class="text-center text-muted py-4">
                No exports have been generated.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div
      v-if="showScheduleModal"
      class="modal-backdrop-custom"
      @click.self="showScheduleModal = false"
    >
      <div
        class="modal-dialog-custom"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-title"
      >
        <div class="modal-header">
          <div>
            <h5 id="schedule-title" class="mb-1">Schedule report</h5>
            <p class="small text-muted mb-0">
              Reports use the currently selected filters.
            </p>
          </div>
          <button
            class="btn-close"
            @click="showScheduleModal = false"
            aria-label="Close"
          ></button>
        </div>
        <form @submit.prevent="saveSchedule">
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label">Schedule name</label
                ><input
                  v-model.trim="scheduleForm.name"
                  class="form-control"
                  required
                  maxlength="120"
                />
              </div>
              <div class="col-md-6">
                <label class="form-label">Report</label
                ><select v-model="scheduleForm.reportType" class="form-select">
                  <option
                    v-for="tab in tabs.filter(
                      (item) => !['reportCenter'].includes(item.id),
                    )"
                    :key="tab.id"
                    :value="tab.id"
                  >
                    {{ tab.label }}
                  </option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Format</label
                ><select v-model="scheduleForm.format" class="form-select">
                  <option value="csv">CSV</option>
                  <option value="xlsx">Excel</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Frequency</label
                ><select v-model="scheduleForm.frequency" class="form-select">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Time</label
                ><input
                  v-model="scheduleForm.time"
                  type="time"
                  class="form-control"
                  required
                />
              </div>
              <div v-if="scheduleForm.frequency === 'weekly'" class="col-12">
                <label class="form-label">Day</label
                ><select
                  v-model.number="scheduleForm.dayOfWeek"
                  class="form-select"
                >
                  <option
                    v-for="(day, index) in [
                      'Sunday',
                      'Monday',
                      'Tuesday',
                      'Wednesday',
                      'Thursday',
                      'Friday',
                      'Saturday',
                    ]"
                    :key="day"
                    :value="index"
                  >
                    {{ day }}
                  </option>
                </select>
              </div>
              <div v-if="scheduleForm.frequency === 'monthly'" class="col-12">
                <label class="form-label">Day of month</label
                ><input
                  v-model.number="scheduleForm.dayOfMonth"
                  type="number"
                  min="1"
                  max="28"
                  class="form-control"
                />
              </div>
              <div class="col-12">
                <label class="form-label">Recipients</label
                ><textarea
                  v-model="scheduleForm.recipients"
                  class="form-control"
                  rows="3"
                  required
                  placeholder="finance@alecons.edu.ng, provost@alecons.edu.ng"
                ></textarea>
                <div class="form-text">
                  Separate multiple email addresses with commas.
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="showScheduleModal = false"
            >
              Cancel</button
            ><button class="btn btn-staff-primary" :disabled="savingSchedule">
              <i class="bi bi-calendar-check me-1"></i
              >{{ savingSchedule ? "Saving…" : "Create schedule" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reports-page {
  min-width: 0;
}
.export-control {
  width: 190px;
}
.report-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  border-bottom: 1px solid #dee2e6;
  scrollbar-width: thin;
}
.report-tab {
  flex: 0 0 auto;
  padding: 10px 14px;
  border: 0;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: #5d6369;
  font-weight: 600;
}
.report-tab:hover,
.report-tab:focus-visible {
  color: var(--staff-primary, #1f6f78);
}
.report-tab.active {
  color: var(--staff-primary, #1f6f78);
  border-bottom-color: var(--staff-primary, #1f6f78);
  border-radius: 0;
}
.filter-band {
  padding: 16px;
  background: #fff;
  border: 1px solid #e5e8eb;
  border-radius: 6px;
}
.filter-band .form-label {
  margin-bottom: 4px;
  color: #5f666d;
  font-size: 0.75rem;
  font-weight: 600;
}
.metric-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border: 1px solid #e8ebed;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(22, 34, 44, 0.05);
}
.metric-icon {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 1.1rem;
}
.metric-value {
  font-size: 1.25rem;
  line-height: 1.15;
  font-weight: 700;
  white-space: nowrap;
}
.metric-label {
  margin-top: 3px;
  color: #6c757d;
  font-size: 0.78rem;
}
.min-w-0 {
  min-width: 0;
}
.section-heading {
  margin-bottom: 12px;
}
.section-heading h5 {
  margin: 0;
  font-weight: 700;
}
.section-heading span {
  color: #6c757d;
  font-size: 0.8rem;
}
.report-table-section {
  overflow: hidden;
  background: #fff;
  border: 1px solid #e5e8eb;
  border-radius: 6px;
}
.report-table-section > .section-heading {
  padding: 16px 16px 0;
}
.report-table-section th {
  white-space: nowrap;
  background: #f7f8f9;
  font-size: 0.8rem;
}
.modal-backdrop-custom {
  position: fixed;
  inset: 0;
  z-index: 1060;
  display: grid;
  place-items: center;
  padding: 16px;
  overflow-y: auto;
  background: rgba(15, 23, 32, 0.55);
}
.modal-dialog-custom {
  width: min(100%, 650px);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
}
.modal-header,
.modal-body,
.modal-footer {
  padding: 16px 20px;
}
.modal-header,
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5e8eb;
}
.modal-footer {
  justify-content: flex-end;
  border-top: 1px solid #e5e8eb;
  border-bottom: 0;
}
@media (max-width: 575.98px) {
  .reports-page {
    padding-left: 12px !important;
    padding-right: 12px !important;
  }
  .export-control {
    width: 100%;
  }
  .metric-card {
    padding: 12px;
    align-items: flex-start;
  }
  .metric-icon {
    width: 36px;
    height: 36px;
    flex-basis: 36px;
  }
  .metric-value {
    font-size: 1.05rem;
  }
}
</style>
