<script lang="js">
import Swal from "sweetalert2";
import { useAuthStore } from "../../stores/auth.js";
import { apiService } from "../../services/api.js";
import { logger } from "@shared/utils/logger";
import { toTitleCase } from "@shared/utils/string";

const createDefaultFilters = () => ({
  search: "",
  state: "",
  level: "",
  semester: "",
});

const createEmptyStats = () => ({
  totalStudents: 0,
  registeredStudents: 0,
  approvedStudents: 0,
  pendingStudents: 0,
  rejectedStudents: 0,
  draftStudents: 0,
  notRegisteredStudents: 0,
});

const stateOptions = [
  { value: "", label: "All Records" },
  { value: "submitted", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" },
  { value: "not_registered", label: "Not Registered" },
];

export default {
  name: "CourseRegistrationsManagement",
  setup() {
    const authStore = useAuthStore();
    return { authStore };
  },
  data() {
    return {
      isLoading: true,
      isLoadingPrograms: true,
      isLoadingDetails: false,
      isSavingDecision: false,
      programs: [],
      selectedProgramId: "",
      stats: createEmptyStats(),
      registrations: [],
      currentPage: 1,
      perPage: 10,
      totalItems: 0,
      totalPages: 0,
      filters: createDefaultFilters(),
      searchTimeout: null,
      stateOptions,
      selectedRegistration: null,
      selectedRegistrationDetails: null,
      reviewComment: "",
      filterMenuOpen: false,
      levelOptions: [],
      semesterOptions: [
        { value: "", label: "All Semesters" },
        { value: "1", label: "Semester 1" },
        { value: "2", label: "Semester 2" },
      ],
    };
  },
  async mounted() {
    await this.authStore.initialize();

    if (!this.authStore.hasModuleAccess("courseRegistrations")) {
      await this.$swal.fire({
        icon: "error",
        title: "Access Denied",
        text: "You do not have permission to manage course registrations.",
        confirmButtonColor: "#1a5f5f",
      });
      this.$router.push("/dashboard");
      return;
    }

    await this.loadPrograms();
  },
  computed: {
    selectedProgram() {
      return (
        this.programs.find(
          (program) => program.id === this.selectedProgramId,
        ) || null
      );
    },
    selectedProgramLabel() {
      if (!this.selectedProgram) {
        return "No program selected";
      }

      return this.formatProgramLabel(this.selectedProgram);
    },
    hasActiveFilters() {
      return Object.values(this.filters).some((value) =>
        String(value || "").trim(),
      );
    },
    canReviewSelectedRegistration() {
      return this.canApproveSelectedRegistration || this.canRejectSelectedRegistration;
    },
    canApproveSelectedRegistration() {
      return (
        this.selectedRegistrationDetails?.state === "submitted" &&
        this.authStore.hasPermission("courseRegistrations", "approve")
      );
    },
    canRejectSelectedRegistration() {
      return (
        this.selectedRegistrationDetails?.state === "submitted" &&
        this.authStore.hasPermission("courseRegistrations", "reject")
      );
    },
    hasInstitutionWideAccess() {
      return (
        this.authStore.isAdmin ||
        this.authStore.hasPermission("courseRegistrations", "manage")
      );
    },
    selectedRegistrationBadgeClass() {
      const state = this.selectedRegistrationDetails?.state || "not_registered";
      if (state === "approved") return "bg-success text-white";
      if (state === "rejected") return "bg-danger text-white";
      if (state === "submitted") return "bg-primary text-white";
      if (state === "draft") return "bg-warning text-dark";
      return "bg-secondary text-white";
    },
    selectedRegistrationStatusLabel() {
      const state = this.selectedRegistrationDetails?.state || "not_registered";
      return state === "not_registered"
        ? "Not Registered"
        : state.replace(/_/g, " ");
    },
    filteredLevelOptions() {
      const maxLevel = Math.max(
        Number(this.selectedProgram?.durationYears) || 0,
        1,
      );
      const options = [{ value: "", label: "All Levels" }];

      for (let level = 1; level <= maxLevel; level += 1) {
        options.push({ value: String(level), label: `${level}` });
      }

      return options;
    },
    statsCards() {
      return [
        {
          label: "Total Students",
          value: this.stats.totalStudents,
          icon: "bi-people",
          tone: "neutral",
        },
        {
          label: "Registered",
          value: this.stats.registeredStudents,
          icon: "bi-journal-check",
          tone: "info",
        },
        {
          label: "Pending Review",
          value: this.stats.pendingStudents,
          icon: "bi-hourglass-split",
          tone: "warning",
        },
        {
          label: "Approved",
          value: this.stats.approvedStudents,
          icon: "bi-check2-circle",
          tone: "success",
        },
        {
          label: "Rejected",
          value: this.stats.rejectedStudents,
          icon: "bi-x-circle",
          tone: "danger",
        },
        {
          label: "Not Registered",
          value: this.stats.notRegisteredStudents,
          icon: "bi-dash-circle",
          tone: "secondary",
        },
      ];
    },
  },
  watch: {
    selectedProgramId() {
      this.currentPage = 1;
      this.loadRegistrations();
    },
    "filters.state"() {
      this.handleFilterChange();
    },
    "filters.level"() {
      this.handleFilterChange();
    },
    "filters.semester"() {
      this.handleFilterChange();
    },
    "filters.search"() {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.currentPage = 1;
        this.loadRegistrations();
      }, 350);
    },
    currentPage() {
      this.loadRegistrations();
    },
  },
  methods: {
    createFilterPayload() {
      return {
        programId: this.selectedProgramId || undefined,
        search: this.filters.search.trim() || undefined,
        state: this.filters.state || undefined,
        level: this.filters.level || undefined,
        semester: this.filters.semester || undefined,
        page: this.currentPage,
        limit: this.perPage,
      };
    },
    handleFilterChange() {
      const shouldReloadImmediately = this.currentPage === 1;
      this.currentPage = 1;
      if (shouldReloadImmediately) {
        this.loadRegistrations();
      }
    },
    async loadPrograms() {
      try {
        this.isLoadingPrograms = true;
        const response =
          await apiService.getAdvisorCourseRegistrationPrograms();

        if (!response.success) {
          throw new Error(
            response.message || "Failed to load advisor programs",
          );
        }

        this.programs = response.data || [];
        this.selectedProgramId = this.programs[0]?.id || "";

        if (!this.selectedProgramId) {
          this.stats = createEmptyStats();
          this.registrations = [];
          return;
        }

        this.levelOptions = this.filteredLevelOptions;
        await this.loadRegistrations();
      } catch (error) {
        logger.error("Failed to load advisor programs:", error);
        await this.$swal.fire({
          icon: "error",
          title: "Load Failed",
          text: error.message || "Failed to load advisor programs.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.isLoadingPrograms = false;
        this.isLoading = false;
      }
    },
    async loadRegistrations() {
      if (!this.selectedProgramId) {
        return;
      }

      try {
        this.isLoading = true;
        const response = await apiService.getAdvisorCourseRegistrations(
          this.createFilterPayload(),
        );

        if (!response.success) {
          throw new Error(
            response.message || "Failed to load course registrations",
          );
        }

        this.programs = response.data?.programs || this.programs;
        this.stats = response.data?.stats || createEmptyStats();
        this.registrations = response.data?.registrations || [];
        this.totalItems = response.data?.pagination?.totalItems || 0;
        this.totalPages = response.data?.pagination?.totalPages || 0;
        this.currentPage = response.data?.pagination?.page || this.currentPage;
        this.levelOptions = this.filteredLevelOptions;
      } catch (error) {
        logger.error("Failed to load course registrations:", error);
        await this.$swal.fire({
          icon: "error",
          title: "Load Failed",
          text: error.message || "Failed to load course registrations.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.isLoading = false;
      }
    },
    formatPersonName(person) {
      if (!person) {
        return "Unknown";
      }

      return toTitleCase(
        [person.firstName, person.lastName]
          .filter(Boolean)
          .join(" "),
      );
    },
    formatProgramLabel(program) {
      if (!program) {
        return "Unknown program";
      }

      const programType = program.programType?.type || "";
      const programMode = this.formatProgramModeLabel(
        program.programMode?.mode,
      );
      const programName = program.name || "";
      return [programType, programMode, programName].filter(Boolean).join(" ");
    },
    formatProgramModeLabel(mode) {
      if (!mode) {
        return "";
      }

      const normalized = String(mode).trim();
      if (!normalized) {
        return "";
      }

      if (/^(ft|pt)$/i.test(normalized)) {
        return normalized.toUpperCase();
      }

      if (/\s/.test(normalized)) {
        return normalized
          .split(/\s+/)
          .map((part) => part.charAt(0).toUpperCase())
          .join("");
      }

      return normalized.slice(0, 2).toUpperCase();
    },
    formatLevelLabel(record) {
      const programType = record?.program?.programType?.type || "";
      const level = record?.level || "";
      const semester = record?.semester || "";
      return `${programType}${level} Semester ${semester}`.trim();
    },
    getStatusBadgeClass(state) {
      if (state === "approved") return "bg-success text-white";
      if (state === "rejected") return "bg-danger text-white";
      if (state === "submitted") return "bg-primary text-white";
      if (state === "draft") return "bg-warning text-dark";
      return "bg-secondary text-white";
    },
    getRecordSummary(record) {
      if (record.state === "not_registered") {
        return "Not registered yet";
      }
      return `${record.courseCount || 0} course${record.courseCount === 1 ? "" : "s"}`;
    },
    formatDateTime(value) {
      if (!value) {
        return "Not available";
      }

      return new Date(value).toLocaleString();
    },
    formatHistoryActionLabel(action) {
      if (!action) {
        return "Update";
      }

      return toTitleCase(String(action).replace(/_/g, " "));
    },
    getHistoryBadgeClass(action) {
      if (action === "approved") return "bg-success-subtle text-success-emphasis";
      if (action === "rejected") return "bg-danger-subtle text-danger-emphasis";
      return "bg-primary-subtle text-primary-emphasis";
    },
    getHistoryEntryClass(action) {
      if (action === "approved") return "history-entry action-approved";
      if (action === "rejected") return "history-entry action-rejected";
      return "history-entry action-submitted";
    },
    getHistoryActorLabel(entry) {
      if (entry?.performedBy) {
        return this.formatPersonName(entry.performedBy);
      }

      if (entry?.actorRole) {
        return toTitleCase(String(entry.actorRole).replace(/_/g, " "));
      }

      return "System";
    },
    getHistoryActionDescription(entry) {
      const actor = this.getHistoryActorLabel(entry);

      if (entry?.action === "approved") {
        return `${actor} approved this registration.`;
      }

      if (entry?.action === "rejected") {
        return `${actor} rejected this registration for correction.`;
      }

      if (entry?.action === "resubmitted") {
        return `${actor} resubmitted an updated registration.`;
      }

      return `${actor} submitted this registration.`;
    },
    async openRegistration(record) {
      this.selectedRegistration = record;
      this.reviewComment = "";
      this.selectedRegistrationDetails = null;

      if (!record?.id) {
        return;
      }

      try {
        this.isLoadingDetails = true;
        const response = await apiService.getAdvisorCourseRegistration(
          record.id,
        );

        if (!response.success) {
          throw new Error(
            response.message || "Failed to load registration details",
          );
        }

        this.selectedRegistrationDetails = response.data?.registration || null;
        this.reviewComment =
          this.selectedRegistrationDetails?.reviewComment || "";
      } catch (error) {
        logger.error("Failed to load registration details:", error);
        await this.$swal.fire({
          icon: "error",
          title: "Details Failed",
          text: error.message || "Failed to load registration details.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.isLoadingDetails = false;
      }
    },
    closeRegistrationModal() {
      this.selectedRegistration = null;
      this.selectedRegistrationDetails = null;
      this.reviewComment = "";
    },
    async confirmDecision(action) {
      if (!this.selectedRegistrationDetails?.id) {
        return;
      }

      const result = await Swal.fire({
        title:
          action === "approve"
            ? "Approve registration?"
            : "Reject registration?",
        text:
          action === "approve"
            ? "This will approve the student course registration."
            : "This will reject the student course registration and allow the student to revise it.",
        icon: action === "approve" ? "question" : "warning",
        showCancelButton: true,
        confirmButtonColor: action === "approve" ? "#198754" : "#dc3545",
        cancelButtonColor: "#6c757d",
        confirmButtonText: action === "approve" ? "Approve" : "Reject",
      });

      if (!result.isConfirmed) {
        return;
      }

      try {
        this.isSavingDecision = true;
        const payload = {
          reviewComment: this.reviewComment?.trim() || undefined,
        };

        const response =
          action === "approve"
            ? await apiService.approveAdvisorCourseRegistration(
                this.selectedRegistrationDetails.id,
                payload,
              )
            : await apiService.rejectAdvisorCourseRegistration(
                this.selectedRegistrationDetails.id,
                payload,
              );

        if (!response.success) {
          throw new Error(response.message || "Failed to save review decision");
        }

        await Swal.fire({
          icon: "success",
          title: action === "approve" ? "Approved" : "Rejected",
          text: response.message || "Registration updated successfully.",
          confirmButtonColor: "#1a5f5f",
        });

        await this.loadRegistrations();
        await this.openRegistration({
          id: this.selectedRegistrationDetails.id,
        });
      } catch (error) {
        logger.error("Failed to update registration review:", error);
        await Swal.fire({
          icon: "error",
          title: "Update Failed",
          text: error.message || "Failed to update registration review.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.isSavingDecision = false;
      }
    },
  },
};
</script>

<template>
  <div class="course-registration-management">
    <div
      class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4"
    >
      <div>
        <h1 class="h3 fw-bold mb-1">Course Registration Management</h1>
        <p class="text-muted mb-0">
          Review student registrations by program, approve valid submissions,
          and send corrections back for revision.
        </p>
      </div>
      <button
        class="btn btn-outline-secondary"
        @click="loadRegistrations"
        :disabled="isLoading || !selectedProgramId"
      >
        <i class="bi bi-arrow-clockwise me-1"></i>
        Refresh
      </button>
    </div>

    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body py-3">
        <div class="row align-items-center g-3">
          <div class="col-12 col-lg-8">
            <label class="form-label fw-semibold mb-2">Program Offering</label>
            <select v-model="selectedProgramId" class="form-select">
              <option value="" disabled>Select a program</option>
              <option
                v-for="program in programs"
                :key="program.id"
                :value="program.id"
              >
                {{ formatProgramLabel(program) }}
              </option>
            </select>
          </div>
          <div class="col-12 col-lg-4 text-lg-end">
            <div class="small text-muted mb-1">
              {{ hasInstitutionWideAccess ? "Institution-wide access" : "Advisor-owned programs only" }}
            </div>
            <div class="fw-semibold">{{ selectedProgramLabel }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3 mb-3">
      <div v-for="card in statsCards" :key="card.label" class="col-6 col-xl-2">
        <div
          class="stat-card card border-0 shadow-sm h-100"
          :class="`tone-${card.tone}`"
        >
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <span class="stat-icon"><i :class="card.icon"></i></span>
              <span class="text-muted small">{{ card.label }}</span>
            </div>
            <div class="display-6 fw-bold mb-0">{{ card.value }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div
          class="d-flex flex-column flex-xl-row gap-3 align-items-xl-center justify-content-between"
        >
          <div class="flex-grow-1">
            <label class="form-label fw-semibold">Search</label>
            <div class="input-group">
              <span class="input-group-text bg-white"
                ><i class="bi bi-search"></i
              ></span>
              <input
                v-model="filters.search"
                type="text"
                class="form-control"
                placeholder="Search student name, matric number, program, or comment"
              />
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-end">
            <div>
              <label class="form-label fw-semibold">Level</label>
              <select v-model="filters.level" class="form-select">
                <option
                  v-for="option in filteredLevelOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="form-label fw-semibold">Semester</label>
              <select v-model="filters.semester" class="form-select">
                <option
                  v-for="option in semesterOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="form-label fw-semibold">Status</label>
              <select v-model="filters.state" class="form-select">
                <option
                  v-for="option in stateOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
            <button
              class="btn btn-outline-secondary"
              @click="
                filters = { ...filters, state: '', level: '', semester: '' }
              "
              :disabled="!hasActiveFilters"
            >
              <i class="bi bi-funnel me-1"></i>
              Reset Filters
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="card-body p-0">
        <div v-if="isLoading" class="p-5 text-center text-muted">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <div>Loading course registrations...</div>
        </div>

        <div v-else-if="!selectedProgramId" class="p-5 text-center text-muted">
          No program offering is assigned to you as course advisor yet.
        </div>

        <div v-else class="table-responsive">
          <table class="table align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Student</th>
                <th>Program</th>
                <th>Level</th>
                <th>Courses</th>
                <th>Total Units</th>
                <th>Status</th>
                <th class="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="record in registrations"
                :key="record.id || `${record.student?.id}-${record.state}`"
                class="clickable-row"
                @click="openRegistration(record)"
              >
                <td>
                  <div class="fw-semibold">
                    {{ formatPersonName(record.student) }}
                  </div>
                  <div class="text-muted small">
                    {{ record.student?.matriculationNumber }}
                  </div>
                </td>
                <td>
                  <div class="fw-semibold">
                    {{ formatProgramLabel(record.program) }}
                  </div>
                  <div class="text-muted small">
                    {{
                      record.program?.programType?.type || "Program offering"
                    }}
                  </div>
                </td>
                <td>{{ formatLevelLabel(record) }}</td>
                <td>{{ getRecordSummary(record) }}</td>
                <td>{{ record.totalUnits }}</td>
                <td>
                  <span
                    class="badge"
                    :class="getStatusBadgeClass(record.state)"
                  >
                    {{
                      record.state === "not_registered"
                        ? "Not Registered"
                        : record.state.replace(/_/g, " ")
                    }}
                  </span>
                </td>
                <td class="text-end">
                  <button
                    class="btn btn-sm btn-outline-primary"
                    @click.stop="openRegistration(record)"
                  >
                    Review
                  </button>
                </td>
              </tr>
              <tr v-if="!registrations.length">
                <td colspan="7" class="text-center py-5 text-muted">
                  No course registrations matched the current filters.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div
        v-if="totalPages > 1"
        class="card-footer bg-white d-flex justify-content-between align-items-center"
      >
        <div class="text-muted small">
          Showing {{ totalItems }} record{{ totalItems === 1 ? "" : "s" }}
        </div>
        <div class="btn-group btn-group-sm">
          <button
            class="btn btn-outline-secondary"
            :disabled="currentPage === 1"
            @click="currentPage -= 1"
          >
            Previous
          </button>
          <button class="btn btn-outline-secondary" disabled>
            Page {{ currentPage }} of {{ totalPages }}
          </button>
          <button
            class="btn btn-outline-secondary"
            :disabled="currentPage === totalPages"
            @click="currentPage += 1"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <div v-if="selectedRegistration" class="modal-backdrop fade show"></div>

    <div
      class="modal fade"
      :class="{ show: !!selectedRegistration }"
      :style="{ display: selectedRegistration ? 'block' : 'none' }"
      tabindex="-1"
      role="dialog"
      v-if="selectedRegistration"
    >
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content shadow">
          <div class="modal-header border-0">
            <div>
              <h5 class="modal-title fw-bold mb-1">Registration Review</h5>
              <div class="text-muted small">
                {{ formatPersonName(selectedRegistration.student) }} ·
                {{ selectedRegistration.student?.matriculationNumber }}
              </div>
            </div>
            <button
              type="button"
              class="btn-close"
              @click="closeRegistrationModal"
            ></button>
          </div>

          <div class="modal-body pt-0">
            <div v-if="isLoadingDetails" class="text-center py-5 text-muted">
              <div class="spinner-border text-primary mb-3" role="status"></div>
              <div>Loading registration details...</div>
            </div>

            <template v-else>
              <div v-if="selectedRegistrationDetails">
                <div class="row g-3 mb-4">
                  <div class="col-12 col-lg-4">
                    <div class="detail-card">
                      <div class="label">Program</div>
                      <div class="value">
                        {{
                          formatProgramLabel(
                            selectedRegistrationDetails.program,
                          )
                        }}
                      </div>
                    </div>
                  </div>
                  <div class="col-12 col-lg-4">
                    <div class="detail-card">
                      <div class="label">Level</div>
                      <div class="value">
                        {{ formatLevelLabel(selectedRegistrationDetails) }}
                      </div>
                    </div>
                  </div>
                  <div class="col-12 col-lg-4">
                    <div class="detail-card">
                      <div class="label">Status</div>
                      <span
                        class="badge mt-1"
                        :class="selectedRegistrationBadgeClass"
                        >{{ selectedRegistrationStatusLabel }}</span
                      >
                    </div>
                  </div>
                </div>

                <div class="row g-3 mb-4">
                  <div class="col-12 col-lg-3">
                    <div class="detail-card">
                      <div class="label">Courses</div>
                      <div class="value">
                        {{ selectedRegistrationDetails.items?.length || 0 }}
                      </div>
                    </div>
                  </div>
                  <div class="col-12 col-lg-3">
                    <div class="detail-card">
                      <div class="label">Total Units</div>
                      <div class="value">
                        {{ selectedRegistrationDetails.totalUnits }}
                      </div>
                      <div v-if="selectedRegistrationDetails.resitLimitSnapshot" class="text-muted small mt-1">
                        Semester resit limit: {{ selectedRegistrationDetails.resitLimitSnapshot }} courses
                      </div>
                    </div>
                  </div>
                  <div class="col-12 col-lg-3">
                    <div class="detail-card">
                      <div class="label">Submitted At</div>
                      <div class="value small">
                        {{
                          formatDateTime(
                            selectedRegistrationDetails.submittedAt,
                          )
                        }}
                      </div>
                    </div>
                  </div>
                  <div class="col-12 col-lg-3">
                    <div class="detail-card">
                      <div class="label">Reviewed At</div>
                      <div class="value small">
                        {{
                          selectedRegistrationDetails.reviewedAt
                            ? formatDateTime(
                                selectedRegistrationDetails.reviewedAt,
                              )
                            : "Not reviewed yet"
                        }}
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mb-4">
                  <div
                    class="d-flex justify-content-between align-items-center mb-2"
                  >
                    <h6 class="fw-bold mb-0">Registered Courses</h6>
                    <span class="text-muted small">Scrollable list</span>
                  </div>
                  <div class="course-list">
                    <div
                      v-for="item in selectedRegistrationDetails.items"
                      :key="item.programCourseId"
                      class="course-item"
                    >
                      <div
                        class="d-flex justify-content-between align-items-start gap-3"
                      >
                        <div>
                          <div class="fw-semibold">
                            {{ item.programCourse?.course?.code }} -
                            {{ item.programCourse?.course?.title }}
                          </div>
                          <div class="text-muted small">
                            {{ item.programCourse?.category }} ·
                            {{ item.programCourse?.units }} unit{{
                              item.programCourse?.units === 1 ? "" : "s"
                            }}
                          </div>
                          <div
                            class="text-muted small"
                            v-if="item.programCourse?.lecturers?.length"
                          >
                            Lecturer:
                            {{
                              item.programCourse.lecturers
                                .map((lecturer) => formatPersonName(lecturer))
                                .join(", ")
                            }}
                          </div>
                        </div>
                        <span class="badge bg-light text-dark">{{
                          item.programCourse?.semester
                            ? `Semester ${item.programCourse.semester}`
                            : "Course"
                        }}</span>
                      </div>
                    </div>
                    <div
                      v-if="!selectedRegistrationDetails.items?.length"
                      class="text-center text-muted py-4"
                    >
                      No courses attached to this registration.
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold"
                    >Review Comment / Correction Notes</label
                  >
                  <textarea
                    v-model="reviewComment"
                    class="form-control"
                    rows="4"
                    :readonly="!canReviewSelectedRegistration"
                    placeholder="Add comments for approval, correction, or rejection..."
                  ></textarea>
                  <div class="form-text">
                    When rejected, the student can revise and resubmit the
                    registration from the student portal.
                  </div>
                </div>

                <div class="mb-3">
                  <div
                    class="d-flex justify-content-between align-items-center mb-2"
                  >
                    <h6 class="fw-bold mb-0">Review Timeline</h6>
                    <span class="text-muted small">
                      {{ selectedRegistrationDetails.history?.length || 0 }}
                      event{{
                        (selectedRegistrationDetails.history?.length || 0) === 1
                          ? ""
                          : "s"
                      }}
                    </span>
                  </div>

                  <div
                    v-if="selectedRegistrationDetails.history?.length"
                    class="history-timeline"
                  >
                    <div
                      v-for="(entry, index) in selectedRegistrationDetails.history"
                      :key="`${entry.action}-${entry.createdAt}-${index}`"
                      :class="getHistoryEntryClass(entry.action)"
                    >
                      <div
                        class="d-flex flex-column flex-lg-row justify-content-between gap-2 mb-2"
                      >
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                          <span
                            class="badge rounded-pill"
                            :class="getHistoryBadgeClass(entry.action)"
                          >
                            {{ formatHistoryActionLabel(entry.action) }}
                          </span>
                          <span class="text-muted small">
                            Submission {{ entry.submissionVersion || 1 }}
                          </span>
                        </div>
                        <div class="text-muted small">
                          {{ formatDateTime(entry.createdAt) }}
                        </div>
                      </div>

                      <div class="fw-semibold mb-1">
                        {{ getHistoryActionDescription(entry) }}
                      </div>

                      <div class="text-muted small mb-2">
                        {{ entry.snapshot?.courseCount || 0 }} courses ·
                        {{ entry.snapshot?.totalUnits || 0 }} units
                        <span v-if="entry.snapshot?.resitLimitSnapshot">
                          · resit limit {{ entry.snapshot.resitLimitSnapshot }}
                        </span>
                      </div>

                      <div
                        v-if="entry.comment"
                        class="history-comment small"
                      >
                        {{ entry.comment }}
                      </div>
                    </div>
                  </div>

                  <div
                    v-else
                    class="border rounded-4 bg-light-subtle text-muted text-center py-4 px-3 small"
                  >
                    No workflow history has been recorded for this registration
                    yet.
                  </div>
                </div>

                <div
                  v-if="
                    !selectedRegistrationDetails.history?.length &&
                    selectedRegistrationDetails.reviewedBy
                  "
                  class="alert alert-light border small"
                >
                  Reviewed by
                  <strong>{{
                    formatPersonName(selectedRegistrationDetails.reviewedBy)
                  }}</strong>
                  <span v-if="selectedRegistrationDetails.reviewComment">
                    · {{ selectedRegistrationDetails.reviewComment }}</span
                  >
                </div>
              </div>

              <div v-else class="text-center py-5 text-muted">
                <i class="bi bi-dash-circle display-6 d-block mb-3"></i>
                <div class="fw-semibold">
                  This student has not submitted course registration yet.
                </div>
                <div class="small">
                  There is no registration record to review for this row.
                </div>
              </div>
            </template>
          </div>

          <div
            class="modal-footer border-0 d-flex justify-content-between flex-wrap gap-2"
          >
            <div
              class="text-muted small"
              v-if="selectedRegistrationDetails?.state === 'rejected'"
            >
              Rejected registrations are editable again in the student portal.
            </div>
            <div class="d-flex gap-2 justify-content-between w-100">
              <!-- <button class="btn btn-outline-secondary" @click="closeRegistrationModal">Close</button> -->
              <button
                v-if="canRejectSelectedRegistration"
                class="btn btn-danger"
                :disabled="isSavingDecision"
                @click="confirmDecision('reject')"
              >
                <span
                  v-if="isSavingDecision"
                  class="spinner-border spinner-border-sm me-1"
                ></span>
                Reject
              </button>
              <button
                v-if="canApproveSelectedRegistration"
                class="btn btn-success"
                :disabled="isSavingDecision"
                @click="confirmDecision('approve')"
              >
                <span
                  v-if="isSavingDecision"
                  class="spinner-border spinner-border-sm me-1"
                ></span>
                Approve
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.course-registration-management {
  padding: 1.5rem;
}

.stat-card {
  border-radius: 1rem;
}

.stat-card .stat-icon {
  width: 2.25rem;
  height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.04);
}

.tone-neutral {
  background: linear-gradient(180deg, #ffffff, #fafafa);
}
.tone-info {
  background: linear-gradient(180deg, #eff7ff, #ffffff);
}
.tone-warning {
  background: linear-gradient(180deg, #fff8e8, #ffffff);
}
.tone-success {
  background: linear-gradient(180deg, #eefaf1, #ffffff);
}
.tone-danger {
  background: linear-gradient(180deg, #fff0f1, #ffffff);
}
.tone-secondary {
  background: linear-gradient(180deg, #f5f7fa, #ffffff);
}

.clickable-row {
  cursor: pointer;
}

.clickable-row:hover {
  background: rgba(26, 95, 95, 0.04);
}

.detail-card {
  background: #f8fafb;
  border: 1px solid #e8ecef;
  border-radius: 0.9rem;
  padding: 1rem;
  min-height: 100%;
}

.detail-card .label {
  color: #6c757d;
  font-size: 0.8rem;
  margin-bottom: 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.detail-card .value {
  font-weight: 600;
}

.course-list {
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid #e9ecef;
  border-radius: 0.9rem;
  padding: 0.75rem;
  background: #fff;
}

.course-item {
  border: 1px solid #eef1f4;
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
  margin-bottom: 0.75rem;
  background: #fcfcfd;
}

.course-item:last-child {
  margin-bottom: 0;
}

.history-timeline {
  display: grid;
  gap: 0.85rem;
}

.history-entry {
  border: 1px solid #e8ecef;
  border-left-width: 4px;
  border-radius: 0.9rem;
  padding: 1rem;
  background: #fff;
}

.history-entry.action-submitted {
  border-left-color: #0d6efd;
  background: linear-gradient(180deg, #f8fbff, #ffffff);
}

.history-entry.action-approved {
  border-left-color: #198754;
  background: linear-gradient(180deg, #f4fcf7, #ffffff);
}

.history-entry.action-rejected {
  border-left-color: #dc3545;
  background: linear-gradient(180deg, #fff7f8, #ffffff);
}

.history-comment {
  border-radius: 0.75rem;
  background: rgba(26, 95, 95, 0.05);
  padding: 0.75rem 0.85rem;
  color: #244141;
}
</style>
