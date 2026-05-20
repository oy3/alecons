<script>
import { useAuthStore } from "../../stores/auth.js";
import { apiService } from "../../services/api.js";
import { logger } from "@shared/utils/logger";
import { Modal } from "bootstrap";

const CBT_APP_URL = import.meta.env.VITE_APP_CBT_URL || "N/A";
const SCHOOL_ADDRESS = import.meta.env.VITE_APP_SCHOOL_ADDRESS || "N/A";

export default {
  name: "AdmissionManagement",
  setup() {
    const authStore = useAuthStore();
    return {
      authStore,
    };
  },
  data() {
    return {
      applications: [],
      programs: [],
      isLoading: true,
      searchQuery: "",
      statusFilter: "pending",
      programFilter: "all",
      stageNames: {
        1: "Email Verification",
        2: "Form Fee Payment",
        3: "Application Form",
        4: "Entrance Exam",
        5: "Admission Decision",
        6: "Screening & Interview",
        7: "Acceptance Fee Payment",
        8: "Sundry Fees Payment",
        9: "School Fees Payment",
        10: "Submission Complete",
      },
      currentPage: 1,
      perPage: 10,
      totalApplications: 0,
      apiTotalPages: 0,

      // Modal forms
      selectedApplication: null,
      examForm: {
        examDate: "",
        examTime: "",
        examLinkType: "cbt",
        examLink: "",
      },
      examFormProcessing: false,

      screeningForm: {
        screeningDate: "",
        screeningTime: "",
        venue: SCHOOL_ADDRESS,
      },
      screeningFormProcessing: false,

      scoreForm: {
        score: "",
        passed: false,
      },
      scoreFormProcessing: false,

      decisionForm: {
        decision: "",
        admissionLetterUrl: "",
        reason: "",
      },
      decisionFormProcessing: false,

      // Application details
      selectedApplicationDetails: null,
      detailsLoading: false,
      detailsExporting: false,
    };
  },
  computed: {
    paginatedApplications() {
      return this.applications;
    },

    totalPages() {
      const calculated = Math.ceil(this.totalApplications / this.perPage);
      return this.apiTotalPages || Math.max(1, calculated);
    },

    cbtExamUrl() {
      return CBT_APP_URL;
    },

    defaultScreeningVenue() {
      return SCHOOL_ADDRESS;
    },

    visiblePages() {
      // Handle edge case where there are no pages or only 1 page
      if (this.totalPages <= 1) {
        return [1];
      }

      const delta = 2;
      const range = [];
      const rangeWithDots = [];

      for (
        let i = Math.max(2, this.currentPage - delta);
        i <= Math.min(this.totalPages - 1, this.currentPage + delta);
        i++
      ) {
        range.push(i);
      }

      if (this.currentPage - delta > 2) {
        rangeWithDots.push(1, "...");
      } else {
        rangeWithDots.push(1);
      }

      rangeWithDots.push(...range);

      if (this.currentPage + delta < this.totalPages - 1) {
        rangeWithDots.push("...", this.totalPages);
      } else if (this.totalPages > 1) {
        rangeWithDots.push(this.totalPages);
      }

      return rangeWithDots.filter(
        (item, index, array) => array.indexOf(item) === index,
      );
    },
  },

  watch: {
    programFilter() {
      this.currentPage = 1;
      this.loadApplications();
    },
    currentPage() {
      this.loadApplications();
    },
  },
  async mounted() {
    await this.authStore.initialize();

    if (!this.authStore.hasModuleAccess("admissions")) {
      this.$swal.fire({
        icon: "error",
        title: "Access Denied",
        text: "You do not have permission to manage admissions",
        confirmButtonColor: "#1a5f5f",
      });
      return;
    }

    this.registerModalA11yHandlers();

    // Load data
    await Promise.all([this.loadPrograms(), this.loadApplications()]);
  },
  beforeUnmount() {
    this.unregisterModalA11yHandlers();
  },
  methods: {
    registerModalA11yHandlers() {
      this._modalLastFocusedElements = new WeakMap();

      this._onModalShow = (event) => {
        const modalElement = event.target;
        if (!modalElement?.classList?.contains("modal")) {
          return;
        }

        this._modalLastFocusedElements.set(
          modalElement,
          event.relatedTarget || document.activeElement,
        );
      };

      this._onModalHide = (event) => {
        const modalElement = event.target;
        if (!modalElement?.classList?.contains("modal")) {
          return;
        }

        const activeElement = document.activeElement;
        if (
          activeElement &&
          modalElement.contains(activeElement) &&
          typeof activeElement.blur === "function"
        ) {
          activeElement.blur();
        }
      };

      this._onModalHidden = (event) => {
        const modalElement = event.target;
        if (!modalElement?.classList?.contains("modal")) {
          return;
        }

        const lastFocusedElement =
          this._modalLastFocusedElements.get(modalElement);
        if (
          lastFocusedElement &&
          typeof lastFocusedElement.focus === "function" &&
          document.contains(lastFocusedElement)
        ) {
          lastFocusedElement.focus();
        }
      };

      document.addEventListener("show.bs.modal", this._onModalShow);
      document.addEventListener("hide.bs.modal", this._onModalHide);
      document.addEventListener("hidden.bs.modal", this._onModalHidden);
    },

    unregisterModalA11yHandlers() {
      if (this._onModalShow) {
        document.removeEventListener("show.bs.modal", this._onModalShow);
      }
      if (this._onModalHide) {
        document.removeEventListener("hide.bs.modal", this._onModalHide);
      }
      if (this._onModalHidden) {
        document.removeEventListener("hidden.bs.modal", this._onModalHidden);
      }

      this._onModalShow = null;
      this._onModalHide = null;
      this._onModalHidden = null;
      this._modalLastFocusedElements = null;
    },

    showModal(modalId) {
      const modalElement = document.getElementById(modalId);
      if (!modalElement) {
        logger.warn("Modal element not found", { modalId });
        return;
      }

      Modal.getOrCreateInstance(modalElement).show();
    },

    hideModal(modalId) {
      const modalElement = document.getElementById(modalId);
      if (!modalElement) {
        return;
      }

      const activeElement = document.activeElement;
      if (
        activeElement &&
        modalElement.contains(activeElement) &&
        typeof activeElement.blur === "function"
      ) {
        activeElement.blur();
      }

      Modal.getOrCreateInstance(modalElement).hide();
    },

    async loadPrograms() {
      try {
        const response = await apiService.getPrograms({ limit: 100 });
        if (response.success && response.data) {
          this.programs = response.data.map((p) => ({
            label: [p.programType, p.programModeDescription, p.name]
              .filter(Boolean)
              .join(" "),
            value: p.id,
          }));
        }
      } catch (error) {
        logger.error("Failed to load programs:", error);
      }
    },

    async loadApplications() {
      try {
        this.isLoading = true;

        const params = {
          page: this.currentPage,
          limit: this.perPage,
          sortBy: "jambScore",
          sortOrder: "desc",
          status: "pending", // Always filter for pending applications only
        };

        if (this.programFilter && this.programFilter !== "all") {
          params.programId = this.programFilter;
        }

        if (this.searchQuery && this.searchQuery.trim()) {
          params.search = this.searchQuery.trim();
        }

        const response = await apiService.getApplications(params);

        if (response.success) {
          this.applications = response.data.applications.map((app) => ({
            id: app._id,
            applicationNumber: app.applicationNumber,
            applicantName: app.applicantName,
            email: app.email,
            phone: app.phone || "N/A",
            programDisplay:
              app.programDisplay ||
              [app.programTypeLabel, app.programModeLabel, app.programName]
                .filter(Boolean)
                .join(" ") ||
              "N/A",
            status: app.status,
            admissionDecision: app.admissionDecision,
            currentStage: app.currentStage,
            isJambExempt: app.isJambExempt === true,
            jambRegistrationNumber: app.jambRegistrationNumber,
            jambScore: app.jambScore,
            entranceExam: app.entranceExam,
            screening: app.screening,
            admissionFlow: app.admissionFlow || {
              entranceExamEnabled: true,
              screeningEnabled: true,
            },
            entryAcademicSession: app.entryAcademicSession,
            profileImageUrl: app.profileImageUrl,
            submittedAt: app.createdAt,
            lastUpdated: app.updatedAt,
          }));

          this.totalApplications = response.data.pagination.totalItems;
          this.currentPage = response.data.pagination.currentPage;
          this.apiTotalPages = response.data.pagination.totalPages;

          logger.info("Applications loaded successfully", {
            count: this.applications.length,
            total: this.totalApplications,
          });
        }
      } catch (error) {
        logger.error("Failed to load applications:", error);
        this.$swal.fire({
          icon: "error",
          title: "Load Failed",
          text: "Failed to load applications",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.isLoading = false;
      }
    },

    searchApplications() {
      this.currentPage = 1;
      this.loadApplications();
    },

    getStatusBadgeClass(status) {
      const statusClasses = {
        pending: "badge bg-warning text-dark",
        exam_scheduled: "badge bg-info text-white",
        screening_scheduled: "badge bg-primary text-white",
        awaiting_decision: "badge bg-secondary text-white",
        admitted: "badge bg-success text-white",
        rejected: "badge bg-danger text-white",
        completed: "badge bg-dark text-white",
      };
      return statusClasses[status] || "badge bg-secondary text-white";
    },

    getStageName(stageNumber) {
      return this.stageNames[stageNumber] || "Unknown Stage";
    },

    isEntranceExamEnabled(application) {
      return application?.admissionFlow?.entranceExamEnabled !== false;
    },

    isScreeningEnabled(application) {
      return application?.admissionFlow?.screeningEnabled !== false;
    },

    canScheduleExam(application) {
      return (
        this.isEntranceExamEnabled(application) &&
        application.currentStage === 4 &&
        !application.entranceExam
      );
    },

    canInputExamScore(application) {
      return (
        this.isEntranceExamEnabled(application) &&
        application.currentStage === 4 &&
        application.entranceExam &&
        application.entranceExam.score === undefined
      );
    },

    canScheduleScreening(application) {
      return (
        this.isScreeningEnabled(application) &&
        application.currentStage === 6 &&
        !application.screening
      );
    },

    canCompleteScreening(application) {
      return (
        this.isScreeningEnabled(application) &&
        application.currentStage === 6 &&
        application.screening &&
        !application.screening.completed
      );
    },

    canMakeAdmissionDecision(application) {
      return (
        application.currentStage === 5 &&
        application.admissionDecision === "pending"
      );
    },

    getApplicantFullName(applicationDetails) {
      const firstName = applicationDetails?.userId?.firstName || "";
      const lastName = applicationDetails?.userId?.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || "N/A";
    },

    getAcademicSessionLabel(applicationDetails) {
      const session = applicationDetails?.entryAcademicSession;

      if (!session) {
        return "N/A";
      }

      if (typeof session === "string") {
        return session;
      }

      return session.sessionYear || session.name || "N/A";
    },

    getProgramDisplayLabel(applicationDetails) {
      if (applicationDetails?.programDisplay) {
        return applicationDetails.programDisplay;
      }

      const program = applicationDetails?.programId;

      return (
        [
          program?.programTypeId?.type,
          program?.programModeId?.description || program?.programModeId?.mode,
          program?.name,
        ]
          .filter(Boolean)
          .join(" ") || "N/A"
      );
    },

    getDocumentUrl(document) {
      if (!document) {
        return null;
      }

      if (typeof document === "string") {
        return document;
      }

      return document.url || null;
    },

    getSittingLabel(examIndex) {
      const sittingNumber = examIndex + 1;
      if (sittingNumber <= 2) {
        return `Sitting ${sittingNumber}`;
      }

      return `Additional Sitting ${sittingNumber}`;
    },

    getExamBySitting(sittingNumber) {
      const exams = this.selectedApplicationDetails?.examinations || [];
      return exams[sittingNumber - 1] || null;
    },

    async viewApplication(application) {
      try {
        this.detailsLoading = true;
        this.selectedApplicationDetails = null;
        this.showModal("applicationDetailsModal");

        const response = await apiService.getApplication(application.id);

        if (response.success) {
          this.selectedApplicationDetails = response.data.application;
          logger.info(
            "Application details loaded:",
            this.selectedApplicationDetails,
          );
        } else {
          this.$swal.fire({
            icon: "error",
            title: "Failed to Load",
            text: "Could not load application details. Please try again.",
            confirmButtonColor: "#1a5f5f",
          });
          this.hideModal("applicationDetailsModal");
        }
      } catch (error) {
        logger.error("Failed to load application details:", error);
        this.$swal.fire({
          icon: "error",
          title: "Error",
          text: "An error occurred while loading application details.",
          confirmButtonColor: "#1a5f5f",
        });
        this.hideModal("applicationDetailsModal");
      } finally {
        this.detailsLoading = false;
      }
    },

    scheduleExam(application) {
      this.selectedApplication = application;
      this.examForm = {
        examDate: "",
        examTime: "",
        examLinkType: "cbt",
        examLink: "",
      };
      this.showModal("scheduleExamModal");
    },

    getResolvedExamLink() {
      if (this.examForm.examLinkType === "custom") {
        return this.examForm.examLink.trim();
      }

      return this.cbtExamUrl;
    },

    async submitExamSchedule() {
      try {
        const resolvedExamLink = this.getResolvedExamLink();

        if (!this.examForm.examDate || !this.examForm.examTime) {
          this.$swal.fire({
            icon: "warning",
            title: "Missing Details",
            text: "Exam date and time are required.",
            confirmButtonColor: "#1a5f5f",
          });
          return;
        }

        if (!resolvedExamLink) {
          this.$swal.fire({
            icon: "warning",
            title: "Missing Exam Link",
            text: "Select ALECONS Online CBT or provide a custom exam link.",
            confirmButtonColor: "#1a5f5f",
          });
          return;
        }

        this.examFormProcessing = true;

        const response = await apiService.scheduleExam(
          this.selectedApplication.id,
          {
            examDate: this.examForm.examDate,
            examTime: this.examForm.examTime,
            examLink: resolvedExamLink,
          },
        );

        if (response.success) {
          this.$swal.fire({
            icon: "success",
            title: "Exam Scheduled",
            text: "Entrance exam has been scheduled successfully. Student will be notified via email.",
            confirmButtonColor: "#1a5f5f",
          });

          this.hideModal("scheduleExamModal");
          await this.loadApplications();
        }
      } catch (error) {
        logger.error("Failed to schedule exam:", error);
        this.$swal.fire({
          icon: "error",
          title: "Failed",
          text: "Failed to schedule exam. Please try again.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.examFormProcessing = false;
      }
    },

    inputExamScore(application) {
      this.selectedApplication = application;
      this.scoreForm = {
        score: "",
        passed: false,
      };
      this.showModal("examScoreModal");
    },

    async submitExamScore() {
      try {
        this.scoreFormProcessing = true;

        const response = await apiService.updateExamScore(
          this.selectedApplication.id,
          {
            score: parseInt(this.scoreForm.score),
            passed: this.scoreForm.passed,
          },
        );

        if (response.success) {
          this.$swal.fire({
            icon: "success",
            title: "Score Updated",
            text: "Exam score has been updated successfully.",
            confirmButtonColor: "#1a5f5f",
          });

          this.hideModal("examScoreModal");
          await this.loadApplications();
        }
      } catch (error) {
        logger.error("Failed to update exam score:", error);
        this.$swal.fire({
          icon: "error",
          title: "Failed",
          text: "Failed to update exam score. Please try again.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.scoreFormProcessing = false;
      }
    },

    scheduleScreening(application) {
      this.selectedApplication = application;
      this.screeningForm = {
        screeningDate: "",
        screeningTime: "",
        venue: this.defaultScreeningVenue,
      };
      this.showModal("scheduleScreeningModal");
    },

    async submitScreeningSchedule() {
      try {
        const venue = this.screeningForm.venue.trim();

        if (!this.screeningForm.screeningDate || !this.screeningForm.screeningTime) {
          this.$swal.fire({
            icon: "warning",
            title: "Missing Details",
            text: "Screening date and time are required.",
            confirmButtonColor: "#1a5f5f",
          });
          return;
        }

        if (!venue) {
          this.$swal.fire({
            icon: "warning",
            title: "Missing Venue",
            text: "Screening venue is required.",
            confirmButtonColor: "#1a5f5f",
          });
          return;
        }

        this.screeningFormProcessing = true;

        const response = await apiService.scheduleScreening(
          this.selectedApplication.id,
          {
            screeningDate: this.screeningForm.screeningDate,
            screeningTime: this.screeningForm.screeningTime,
            venue,
          },
        );

        if (response.success) {
          this.$swal.fire({
            icon: "success",
            title: "Screening Scheduled",
            text: "Screening has been scheduled successfully. Student will be notified via email.",
            confirmButtonColor: "#1a5f5f",
          });

          this.hideModal("scheduleScreeningModal");
          await this.loadApplications();
        }
      } catch (error) {
        logger.error("Failed to schedule screening:", error);
        this.$swal.fire({
          icon: "error",
          title: "Failed",
          text: error.message || "Failed to schedule screening. Please try again.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.screeningFormProcessing = false;
      }
    },

    async completeScreening(application) {
      try {
        const response = await apiService.completeScreening(application.id);

        if (response.success) {
          this.$swal.fire({
            icon: "success",
            title: "Screening Completed",
            text: "Screening has been marked as completed.",
            confirmButtonColor: "#1a5f5f",
          });

          await this.loadApplications();
        }
      } catch (error) {
        logger.error("Failed to complete screening:", error);
        this.$swal.fire({
          icon: "error",
          title: "Failed",
          text: "Failed to complete screening. Please try again.",
          confirmButtonColor: "#1a5f5f",
        });
      }
    },

    makeAdmissionDecision(application) {
      this.selectedApplication = application;
      this.decisionForm = {
        decision: "",
        sendProvisionalOffer: false,
        reason: "",
      };
      this.showModal("admissionDecisionModal");
    },

    async submitAdmissionDecision() {
      try {
        this.decisionFormProcessing = true;

        const response = await apiService.makeAdmissionDecision(
          this.selectedApplication.id,
          {
            decision: this.decisionForm.decision,
            sendProvisionalOffer: this.decisionForm.sendProvisionalOffer,
            reason: this.decisionForm.reason,
          },
        );

        if (response.success) {
          this.$swal.fire({
            icon: "success",
            title: "Decision Made",
            text:
              this.decisionForm.decision === "admitted"
                ? this.decisionForm.sendProvisionalOffer
                  ? "Student admitted. Admission email and provisional offer have been sent."
                  : "Student admitted. Admission email has been sent without provisional offer attachment."
                : "Student rejected. Email notification has been sent.",
            confirmButtonColor: "#1a5f5f",
          });

          this.hideModal("admissionDecisionModal");
          await this.loadApplications();
        }
      } catch (error) {
        logger.error("Failed to make admission decision:", error);
        this.$swal.fire({
          icon: "error",
          title: "Failed",
          text: "Failed to make admission decision. Please try again.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.decisionFormProcessing = false;
      }
    },

    async exportApplicationDetailsPdf() {
      if (!this.selectedApplicationDetails || this.detailsExporting) {
        return;
      }

      this.detailsExporting = true;

      try {
        const applicationId =
          this.selectedApplicationDetails.id ||
          this.selectedApplicationDetails._id;

        if (!applicationId) {
          throw new Error("Application identifier is missing for export");
        }

        await apiService.exportApplicationDetailsPDF(applicationId);

        this.$swal.fire({
          icon: "success",
          title: "Export Ready",
          text: "Application details PDF has been exported and downloaded.",
          confirmButtonColor: "#1a5f5f",
        });
      } catch (error) {
        logger.error("Failed to export application details PDF", error);
        this.$swal.fire({
          icon: "error",
          title: "Export Failed",
          text: "Could not export application details. Please try again.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.detailsExporting = false;
      }
    },
  },
};
</script>

<template>
  <div class="container-fluid p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h2 class="fw-bold text-staff-primary mb-1">
              Admission Management
            </h2>
            <p class="text-muted mb-0">
              Review and manage student applications
            </p>
          </div>
          <button
            class="btn btn-staff-primary btn-sm"
            @click="loadApplications"
          >
            <i class="bi bi-arrow-clockwise me-2"></i>Refresh
          </button>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-4">
                <label class="form-label">Program Filter</label>
                <select
                  v-model="programFilter"
                  class="form-select form-select-sm"
                >
                  <option value="all">All Programs</option>
                  <option
                    v-for="program in programs"
                    :key="program.value"
                    :value="program.value"
                  >
                    {{ program.label }}
                  </option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Search</label>
                <input
                  v-model="searchQuery"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Search by name, email, or application number..."
                />
              </div>
              <div class="col-md-2 d-flex align-items-end">
                <button
                  class="btn btn-outline-staff-primary btn-sm w-100"
                  @click="searchApplications"
                >
                  <i class="bi bi-search me-1"></i>
                  Search
                </button>
                <!-- <button
                  class="btn btn-outline-staff-primary w-100"
                  @click="resetFilters"
                >
                  <i class="bi bi-funnel-fill me-2"></i>Reset
                </button> -->
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Info Alert -->
    <div class="alert alert-info" role="alert">
      <i class="bi bi-info-circle me-2"></i>
      Showing only applications with <strong>Pending</strong> status, sorted by
      latest submissions.
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2 text-muted">Loading applications...</p>
    </div>

    <!-- Applications Table -->
    <div v-else class="row">
      <div class="col-12">
        <div class="card rounded-3 border-0 p-0 shadow-sm">
          <div class="card-body p-0">
            <div class="table-responsive-lg d-none d-lg-block">
              <table class="table table-hover mb-0">
                <thead>
                  <tr>
                    <th class="text-center">#</th>
                    <th class="text-center">Applicant</th>
                    <th>Program</th>
                    <th>Current Stage</th>
                    <th>Status</th>
                    <th>Exam Status</th>
                    <th>Screening Status</th>
                    <th class="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="application in paginatedApplications"
                    :key="application.id"
                  >
                    <td>
                      <strong>{{ application.applicationNumber }}</strong>
                    </td>
                    <td>
                      <div class="d-flex align-items-center">
                        <img
                          :src="
                            application.profileImageUrl ||
                            'https://placehold.co/40'
                          "
                          class="rounded-circle me-2"
                          width="40"
                          height="40"
                          alt="Profile"
                        />
                        <div>
                          <div class="fw-semibold">
                            {{ application.applicantName }}
                          </div>
                          <!-- <small class="text-muted">{{
                            application.email
                          }}</small> <br /> -->
                          <small class="text-muted">{{
                            application.phone
                          }}</small>
                        </div>
                      </div>
                    </td>
                    <td>{{ application.programDisplay }}</td>
                    <td>
                      <span class="badge bg-info">
                        {{
                          application.currentStage
                            ? `Stage ${application.currentStage} - ${getStageName(
                                application.currentStage,
                              )}`
                            : "N/A"
                        }}
                      </span>
                    </td>
                    <td>
                      <span :class="getStatusBadgeClass(application.status)">
                        {{ application.status.toUpperCase() }}
                      </span>
                    </td>
                    <td>
                      <div v-if="application.entranceExam">
                        <small class="text-success">
                          <i class="bi bi-check-circle me-1"></i>
                          Scheduled
                        </small>
                        <div
                          v-if="application.entranceExam.score !== undefined"
                          class="small"
                        >
                          Score: {{ application.entranceExam.score }}
                        </div>
                      </div>
                      <small
                        v-else-if="!isEntranceExamEnabled(application)"
                        class="text-muted"
                        >Skipped (Disabled)</small
                      >
                      <small v-else class="text-muted">Not Scheduled</small>
                    </td>
                    <td>
                      <div v-if="application.screening">
                        <small class="text-success">
                          <i class="bi bi-check-circle me-1"></i>
                          Scheduled
                        </small>
                        <div
                          v-if="application.screening.completed"
                          class="small text-primary"
                        >
                          Completed
                        </div>
                      </div>
                      <small
                        v-else-if="!isScreeningEnabled(application)"
                        class="text-muted"
                        >Skipped (Disabled)</small
                      >
                      <small v-else class="text-muted">Not Scheduled</small>
                    </td>
                    <td>
                      <div class="dropdown">
                        <button
                          :id="`dropdownMenuButton-${application.id}`"
                          type="button"
                          class="btn p-0 border-0 bg-transparent dropdown-toggle no-caret"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                          aria-haspopup="true"
                        >
                          <i class="bi bi-three-dots-vertical fs-5"></i>
                        </button>

                        <ul
                          class="dropdown-menu"
                          :aria-labelledby="`dropdownMenuButton-${application.id}`"
                        >
                          <li>
                            <a
                              class="dropdown-item"
                              href="#"
                              @click.prevent="viewApplication(application)"
                            >
                              <i class="bi bi-eye me-2"></i>View Details
                            </a>
                          </li>
                          <li v-if="canScheduleExam(application)">
                            <a
                              class="dropdown-item"
                              href="#"
                              @click.prevent="scheduleExam(application)"
                            >
                              <i class="bi bi-calendar-plus me-2"></i>Schedule
                              Exam
                            </a>
                          </li>
                          <li v-if="canInputExamScore(application)">
                            <a
                              class="dropdown-item"
                              href="#"
                              @click.prevent="inputExamScore(application)"
                            >
                              <i class="bi bi-pencil-square me-2"></i>Input Exam
                              Score
                            </a>
                          </li>
                          <li v-if="canScheduleScreening(application)">
                            <a
                              class="dropdown-item"
                              href="#"
                              @click.prevent="scheduleScreening(application)"
                            >
                              <i class="bi bi-calendar-check me-2"></i>Schedule
                              Screening
                            </a>
                          </li>
                          <li v-if="canCompleteScreening(application)">
                            <a
                              class="dropdown-item"
                              href="#"
                              @click.prevent="completeScreening(application)"
                            >
                              <i class="bi bi-check-circle me-2"></i>Mark
                              Screening Complete
                            </a>
                          </li>
                          <li v-if="canMakeAdmissionDecision(application)">
                            <a
                              class="dropdown-item"
                              href="#"
                              @click.prevent="
                                makeAdmissionDecision(application)
                              "
                            >
                              <i class="bi bi-award me-2"></i>Admission Decision
                            </a>
                          </li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="d-lg-none p-3">
              <div class="row g-3">
                <div
                  v-for="application in paginatedApplications"
                  :key="`mobile-${application.id}`"
                  class="col-12"
                >
                  <div class="admission-mobile-card h-100">
                    <div
                      class="d-flex justify-content-between align-items-start gap-3 mb-3"
                    >
                      <div class="d-flex align-items-center gap-2">
                        <div>
                          <div class="fw-semibold text-staff-primary">
                            {{ application.applicantName }}
                          </div>
                          <div class="fw-semibold">
                            {{ application.applicationNumber }}
                          </div>

                          <div class="d-flex flex-wrap gap-2 mt-2">
                            <span
                              :class="getStatusBadgeClass(application.status)"
                            >
                              {{ application.status.toUpperCase() }}
                            </span>
                            <span class="badge bg-info">
                              {{
                                application.currentStage
                                  ? `Stage ${application.currentStage}`
                                  : "N/A"
                              }}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div class="text-end flex-shrink-0">
                        <div
                          class="d-flex align-items-center flex-wrap gap-2 text-light-emphasis bg-light-subtle border border-light-subtle rounded-pill ps-3 pe-2 py-1"
                        >
                          <!-- <button
                            type="button"
                            class="btn btn-sm btn-dark rounded-circle"
                            style="width: 32px; height: 32px; padding: 0"
                            @click="viewApplication(application)"
                          >
                            <i class="bi bi-eye"></i>
                          </button> -->

                          <span @click="viewApplication(application)">
                            view
                          </span>

                          <div class="dropdown">
                            <button
                              type="button"
                              class="btn p-0 border-0 bg-transparent dropdown-toggle no-caret text-dark-emphasis"
                              data-bs-toggle="dropdown"
                              aria-expanded="false"
                            >
                              <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu">
                              <li v-if="canScheduleExam(application)">
                                <a
                                  class="dropdown-item"
                                  href="#"
                                  @click.prevent="scheduleExam(application)"
                                >
                                  <i class="bi bi-calendar-plus me-1"></i
                                  >Schedule Exam
                                </a>
                              </li>
                              <li v-if="canInputExamScore(application)">
                                <a
                                  class="dropdown-item"
                                  href="#"
                                  @click.prevent="inputExamScore(application)"
                                >
                                  <i class="bi bi-pencil-square me-1"></i>Exam
                                  Score
                                </a>
                              </li>
                              <li v-if="canScheduleScreening(application)">
                                <a
                                  class="dropdown-item"
                                  href="#"
                                  @click.prevent="
                                    scheduleScreening(application)
                                  "
                                >
                                  <i class="bi bi-calendar-check me-1"></i
                                  >Screening
                                </a>
                              </li>
                              <li v-if="canCompleteScreening(application)">
                                <a
                                  class="dropdown-item"
                                  href="#"
                                  @click.prevent="
                                    completeScreening(application)
                                  "
                                >
                                  <i class="bi bi-check-circle me-1"></i
                                  >Complete Screening
                                </a>
                              </li>
                              <li v-if="canMakeAdmissionDecision(application)">
                                <a
                                  class="dropdown-item"
                                  href="#"
                                  @click.prevent="
                                    makeAdmissionDecision(application)
                                  "
                                >
                                  <i class="bi bi-award me-1"></i>Admission
                                  Decision
                                </a>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="admission-mobile-meta d-grid gap-2 mb-3">
                      <div>
                        <div
                          class="small text-uppercase text-muted fw-semibold"
                        >
                          Program
                        </div>
                        <div>{{ application.programDisplay }}</div>
                      </div>
                      <div>
                        <div
                          class="small text-uppercase text-muted fw-semibold"
                        >
                          Current Stage
                        </div>
                        <div>
                          {{
                            application.currentStage
                              ? `Stage ${application.currentStage} - ${getStageName(
                                  application.currentStage,
                                )}`
                              : "N/A"
                          }}
                        </div>
                      </div>
                      <div class="row g-2">
                        <div class="col-12 col-sm-6">
                          <div
                            class="small text-uppercase text-muted fw-semibold"
                          >
                            Exam Status
                          </div>
                          <div v-if="application.entranceExam">
                            <span class="text-success fw-semibold"
                              >Scheduled</span
                            >
                            <div
                              v-if="
                                application.entranceExam.score !== undefined
                              "
                              class="small text-muted"
                            >
                              Score: {{ application.entranceExam.score }}
                            </div>
                          </div>
                          <div
                            v-else-if="!isEntranceExamEnabled(application)"
                            class="text-muted"
                          >
                            Skipped (Disabled)
                          </div>
                          <div v-else class="text-muted">Not Scheduled</div>
                        </div>
                        <div class="col-12 col-sm-6">
                          <div
                            class="small text-uppercase text-muted fw-semibold"
                          >
                            Screening Status
                          </div>
                          <div v-if="application.screening">
                            <span class="text-success fw-semibold"
                              >Scheduled</span
                            >
                            <div
                              v-if="application.screening.completed"
                              class="small text-primary"
                            >
                              Completed
                            </div>
                          </div>
                          <div
                            v-else-if="!isScreeningEnabled(application)"
                            class="text-muted"
                          >
                            Skipped (Disabled)
                          </div>
                          <div v-else class="text-muted">Not Scheduled</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- Empty State -->
            <div v-if="applications.length === 0" class="text-center py-5">
              <i class="bi bi-inbox display-1 text-muted"></i>
              <h5 class="mt-3 text-muted">No applications found</h5>
              <p class="text-muted">
                Try adjusting your filters or search criteria.
              </p>
            </div>
          </div>
          <div class="card-footer bg-transparent">
            <!-- Pagination -->
            <nav>
              <ul class="pagination pagination-sm mb-0 justify-content-center">
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <a
                    class="page-link"
                    href="#"
                    @click.prevent="currentPage = 1"
                  >
                    <i class="bi bi-chevron-double-left"></i>
                  </a>
                </li>
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <a class="page-link" href="#" @click.prevent="currentPage--">
                    <i class="bi bi-chevron-left"></i>
                  </a>
                </li>
                <li
                  v-for="page in visiblePages"
                  :key="page"
                  class="page-item"
                  :class="{ active: page === currentPage }"
                >
                  <a
                    class="page-link"
                    href="#"
                    @click.prevent="currentPage = page"
                  >
                    {{ page }}
                  </a>
                </li>
                <li
                  class="page-item"
                  :class="{
                    disabled:
                      currentPage >= totalPages || applications.length === 0,
                  }"
                >
                  <a class="page-link" href="#" @click.prevent="currentPage++">
                    <i class="bi bi-chevron-right"></i>
                  </a>
                </li>
                <li
                  class="page-item"
                  :class="{
                    disabled:
                      currentPage >= totalPages || applications.length === 0,
                  }"
                >
                  <a
                    class="page-link"
                    href="#"
                    @click.prevent="currentPage = totalPages"
                  >
                    <i class="bi bi-chevron-double-right"></i>
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Schedule Exam Modal -->
  <div
    id="scheduleExamModal"
    class="modal fade"
    tabindex="-1"
    aria-labelledby="scheduleExamModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 id="scheduleExamModalLabel" class="modal-title">
            Schedule Entrance Exam
          </h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="submitExamSchedule">
            <div class="mb-3">
              <label for="examDate" class="form-label">Exam Date</label>
              <input
                id="examDate"
                v-model="examForm.examDate"
                type="date"
                class="form-control"
                required
              />
            </div>
            <div class="mb-3">
              <label for="examTime" class="form-label">Exam Time</label>
              <input
                id="examTime"
                v-model="examForm.examTime"
                type="time"
                class="form-control"
                required
              />
            </div>
            <div class="mb-3">
              <label for="examLinkType" class="form-label">Exam Link</label>
              <select
                id="examLinkType"
                v-model="examForm.examLinkType"
                class="form-select"
              >
                <option value="cbt">ALECONS's Online CBT</option>
                <option value="custom">Custom Link</option>
              </select>
            </div>
            <div v-if="examForm.examLinkType === 'cbt'" class="mb-3">
              <input
                id="cbtExamLink"
                :value="cbtExamUrl"
                type="url"
                class="form-control"
                readonly
              />
              <small class="text-muted">
                This will use the default CBT link.
              </small>
            </div>
            <div v-else class="mb-3">
              <input
                id="examLink"
                v-model="examForm.examLink"
                type="url"
                class="form-control"
                placeholder="https://cbt.platform.com/exam/123"
              />
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            data-bs-dismiss="modal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="examFormProcessing"
            @click="submitExamSchedule"
          >
            <span
              v-if="examFormProcessing"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Schedule Exam
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Schedule Screening Modal -->
  <div
    id="scheduleScreeningModal"
    class="modal fade"
    tabindex="-1"
    aria-labelledby="scheduleScreeningModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 id="scheduleScreeningModalLabel" class="modal-title">
            Schedule Screening & Interview
          </h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="submitScreeningSchedule">
            <div class="mb-3">
              <label for="screeningDate" class="form-label">
                Screening Date
              </label>
              <input
                id="screeningDate"
                v-model="screeningForm.screeningDate"
                type="date"
                class="form-control"
                required
              />
            </div>
            <div class="mb-3">
              <label for="screeningTime" class="form-label">
                Screening Time
              </label>
              <input
                id="screeningTime"
                v-model="screeningForm.screeningTime"
                type="time"
                class="form-control"
                required
              />
            </div>
            <div class="mb-3">
              <label for="venue" class="form-label">Venue</label>
              <textarea
                id="venue"
                v-model="screeningForm.venue"
                class="form-control"
                rows="3"
                placeholder="Examination Hall, Alebiosu College of Nursing Services..."
                required
              ></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            data-bs-dismiss="modal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="screeningFormProcessing"
            @click="submitScreeningSchedule"
          >
            <span
              v-if="screeningFormProcessing"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Schedule Screening
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Exam Score Modal -->
  <div
    id="examScoreModal"
    class="modal fade"
    tabindex="-1"
    aria-labelledby="examScoreModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 id="examScoreModalLabel" class="modal-title">Input Exam Score</h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="submitExamScore">
            <div class="mb-3">
              <label for="examScore" class="form-label">Exam Score (%)</label>
              <input
                id="examScore"
                v-model="scoreForm.score"
                type="number"
                class="form-control"
                min="0"
                max="100"
                required
              />
            </div>
            <div class="mb-3">
              <div class="form-check">
                <input
                  id="examPassed"
                  v-model="scoreForm.passed"
                  class="form-check-input"
                  type="checkbox"
                />
                <label class="form-check-label" for="examPassed">
                  Student passed the exam
                </label>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            data-bs-dismiss="modal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="scoreFormProcessing"
            @click="submitExamScore"
          >
            <span
              v-if="scoreFormProcessing"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Save Score
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Admission Decision Modal -->
  <div
    id="admissionDecisionModal"
    class="modal fade"
    tabindex="-1"
    aria-labelledby="admissionDecisionModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 id="admissionDecisionModalLabel" class="modal-title">
            Make Admission Decision
          </h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="submitAdmissionDecision">
            <div class="mb-3">
              <label class="form-label">Decision</label>
              <div class="form-check">
                <input
                  id="admitStudent"
                  v-model="decisionForm.decision"
                  class="form-check-input"
                  type="radio"
                  value="admitted"
                />
                <label class="form-check-label" for="admitStudent">
                  <span class="text-success fw-semibold">Admit Student</span>
                </label>
              </div>
              <div class="form-check">
                <input
                  id="rejectStudent"
                  v-model="decisionForm.decision"
                  class="form-check-input"
                  type="radio"
                  value="rejected"
                />
                <label class="form-check-label" for="rejectStudent">
                  <span class="text-danger fw-semibold">Reject Student</span>
                </label>
              </div>
            </div>
            <div v-if="decisionForm.decision === 'admitted'" class="mb-3">
              <div class="form-check">
                <input
                  id="sendProvisionalOffer"
                  v-model="decisionForm.sendProvisionalOffer"
                  class="form-check-input"
                  type="checkbox"
                />
                <label class="form-check-label" for="sendProvisionalOffer">
                  Generate and send
                  <strong>PROVISIONAL OFFER OF ADMISSION</strong>
                </label>
              </div>
              <small class="text-muted d-block mt-2">
                If unchecked, the student will still receive the admission
                email, but without the provisional offer PDF attachment. JAMB
                will send the official admission letter directly.
              </small>
            </div>
            <div v-if="decisionForm.decision === 'rejected'" class="mb-3">
              <label for="rejectionReason" class="form-label"
                >Rejection Reason</label
              >
              <textarea
                id="rejectionReason"
                v-model="decisionForm.reason"
                class="form-control"
                rows="3"
                placeholder="Explain the reason for rejection..."
              ></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            data-bs-dismiss="modal"
          >
            Cancel
          </button>

          <button
            v-if="decisionForm.decision === 'admitted'"
            type="button"
            class="btn btn-success"
            :disabled="decisionFormProcessing"
            @click="submitAdmissionDecision"
          >
            <span
              v-if="decisionFormProcessing"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Admit Student
          </button>

          <button
            v-if="decisionForm.decision === 'rejected'"
            type="button"
            class="btn btn-danger"
            :disabled="decisionFormProcessing"
            @click="submitAdmissionDecision"
          >
            <span
              v-if="decisionFormProcessing"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Reject Student
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Application Details Modal -->
  <div
    id="applicationDetailsModal"
    class="modal fade"
    tabindex="-1"
    aria-labelledby="applicationDetailsModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-xl">
      <div class="modal-content">
        <div class="modal-header">
          <h5 id="applicationDetailsModalLabel" class="modal-title">
            <i class="bi bi-file-person me-2"></i>
            Application Details
            <span
              v-if="selectedApplicationDetails"
              class="badge bg-primary ms-2"
            >
              {{ selectedApplicationDetails.applicationNumber }}
            </span>
          </h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>

        <div class="modal-body" style="max-height: 70vh; overflow-y: auto">
          <!-- Loading State -->
          <div v-if="detailsLoading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2 text-muted">Loading application details...</p>
          </div>

          <!-- Application Details Content -->
          <div v-else-if="selectedApplicationDetails" class="row g-4">
            <!-- Personal Information -->
            <div class="col-md-6">
              <div class="card p-0 h-100">
                <div class="card-header">
                  <h6 class="card-title mb-0">
                    <i class="bi bi-person me-2"></i>Personal Information
                  </h6>
                </div>
                <div class="card-body">
                  <div class="row g-3">
                    <div class="col-12 text-center">
                      <img
                        :src="
                          selectedApplicationDetails.profileImageUrl ||
                          'https://placehold.co/120x120'
                        "
                        class="rounded-circle mb-3"
                        width="120"
                        height="120"
                        alt="Profile Photo"
                      />
                    </div>
                    <div class="col-12">
                      <label class="form-label fw-semibold">Full Name</label>
                      <p class="form-control-plaintext">
                        {{ getApplicantFullName(selectedApplicationDetails) }}
                      </p>
                    </div>
                    <div class="col-12">
                      <label class="form-label fw-semibold">Email</label>
                      <p class="form-control-plaintext">
                        {{ selectedApplicationDetails.userId?.email || "N/A" }}
                      </p>
                    </div>
                    <div class="col-12">
                      <label class="form-label fw-semibold">Phone Number</label>
                      <p class="form-control-plaintext">
                        {{ selectedApplicationDetails.userId?.phone || "N/A" }}
                      </p>
                    </div>
                    <div class="col-12">
                      <label class="form-label fw-semibold"
                        >Date of Birth</label
                      >
                      <p class="form-control-plaintext">
                        {{
                          selectedApplicationDetails.dob
                            ? new Date(
                                selectedApplicationDetails.dob,
                              ).toLocaleDateString()
                            : "N/A"
                        }}
                      </p>
                    </div>
                    <div class="col-6">
                      <label class="form-label fw-semibold">Gender</label>
                      <p class="form-control-plaintext">
                        {{ selectedApplicationDetails.gender || "N/A" }}
                      </p>
                    </div>
                    <div class="col-6">
                      <label class="form-label fw-semibold"
                        >Marital Status</label
                      >
                      <p class="form-control-plaintext">
                        {{ selectedApplicationDetails.maritalStatus || "N/A" }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Application Information -->
            <div class="col-md-6">
              <div class="card p-0 h-100">
                <div class="card-header">
                  <h6 class="card-title mb-0">
                    <i class="bi bi-clipboard-data me-2"></i>Application
                    Information
                  </h6>
                </div>
                <div class="card-body">
                  <div class="row g-3">
                    <div class="col-12">
                      <label class="form-label fw-semibold"
                        >Program Applied For</label
                      >
                      <p class="form-control-plaintext">
                        {{ getProgramDisplayLabel(selectedApplicationDetails) }}
                      </p>
                    </div>
                    <div class="col-12">
                      <label class="form-label fw-semibold"
                        >Current Stage</label
                      >
                      <p class="form-control-plaintext">
                        <span class="badge bg-info">
                          {{
                            selectedApplicationDetails.currentStage
                              ? `Stage ${
                                  selectedApplicationDetails.currentStage
                                } -
                          ${getStageName(
                            selectedApplicationDetails.currentStage,
                          )}`
                              : "N/A"
                          }}
                        </span>
                      </p>
                    </div>
                    <div class="col-12">
                      <label class="form-label fw-semibold"
                        >Application Status</label
                      >
                      <p class="form-control-plaintext">
                        <span
                          :class="
                            getStatusBadgeClass(
                              selectedApplicationDetails.status,
                            )
                          "
                        >
                          {{
                            selectedApplicationDetails.status?.toUpperCase() ||
                            "N/A"
                          }}
                        </span>
                      </p>
                    </div>
                    <div class="col-12">
                      <label class="form-label fw-semibold"
                        >Academic Session</label
                      >
                      <p class="form-control-plaintext">
                        {{
                          getAcademicSessionLabel(selectedApplicationDetails)
                        }}
                      </p>
                    </div>
                    <!-- <div class="col-6">
                      <label class="form-label fw-semibold"
                        >JAMB Requirement</label
                      >
                      <p class="form-control-plaintext">
                        {{
                          selectedApplicationDetails.isJambExempt
                            ? "Not a direct JAMB applicant"
                            : "Direct JAMB applicant"
                        }}
                      </p>
                    </div> -->
                    <div class="col-6">
                      <label class="form-label fw-semibold"
                        >JAMB Registration Number</label
                      >
                      <p class="form-control-plaintext">
                        {{
                          selectedApplicationDetails.isJambExempt
                            ? "Not applicable"
                            : selectedApplicationDetails.jambRegistrationNumber ||
                              "N/A"
                        }}
                      </p>
                    </div>
                    <div class="col-6">
                      <label class="form-label fw-semibold">JAMB Score</label>
                      <p class="form-control-plaintext">
                        {{
                          selectedApplicationDetails.isJambExempt
                            ? "Not applicable"
                            : (selectedApplicationDetails.jambScore ?? "N/A")
                        }}
                      </p>
                    </div>
                    <div class="col-6">
                      <label class="form-label fw-semibold"
                        >Submitted Date</label
                      >
                      <p class="form-control-plaintext">
                        {{
                          selectedApplicationDetails.createdAt
                            ? new Date(
                                selectedApplicationDetails.createdAt,
                              ).toLocaleString()
                            : "N/A"
                        }}
                      </p>
                    </div>
                    <div class="col-6">
                      <label class="form-label fw-semibold">Last Updated</label>
                      <p class="form-control-plaintext">
                        {{
                          selectedApplicationDetails.updatedAt
                            ? new Date(
                                selectedApplicationDetails.updatedAt,
                              ).toLocaleString()
                            : "N/A"
                        }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Examination Records -->
            <div class="col-md-12">
              <div class="card p-0">
                <div
                  class="card-header d-flex justify-content-between align-items-center"
                >
                  <h6 class="card-title mb-0">
                    <i class="bi bi-journal-check me-2"></i>Examination Records
                  </h6>
                  <span class="badge bg-light text-dark">
                    {{ selectedApplicationDetails.examinations?.length || 0 }}
                    {{
                      (selectedApplicationDetails.examinations?.length || 0) ===
                      1
                        ? "sitting"
                        : "sittings"
                    }}
                  </span>
                </div>
                <div class="card-body">
                  <div
                    v-if="selectedApplicationDetails.examinations?.length"
                    class="row g-3"
                  >
                    <div class="col-md-6">
                      <div
                        v-if="getExamBySitting(1)"
                        class="border rounded p-3 h-100"
                      >
                        <div
                          class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3"
                        >
                          <div>
                            <h6 class="fw-semibold mb-1">
                              {{
                                getExamBySitting(1).examType || "Exam Record"
                              }}
                            </h6>
                            <small class="text-muted">Sitting 1</small>
                          </div>
                          <div class="text-md-end">
                            <div>
                              <small class="text-muted me-1">Year:</small>
                              <span class="fw-semibold">{{
                                getExamBySitting(1).examYear || "N/A"
                              }}</span>
                            </div>
                            <div>
                              <small class="text-muted me-1">Number:</small>
                              <span class="fw-semibold">{{
                                getExamBySitting(1).examNumber || "N/A"
                              }}</span>
                            </div>
                          </div>
                        </div>

                        <div
                          v-if="getExamBySitting(1).subjects?.length"
                          class="table-responsive"
                        >
                          <table class="table table-sm align-middle mb-0">
                            <thead>
                              <tr>
                                <th scope="col">Subject</th>
                                <th scope="col" class="text-end">Grade</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr
                                v-for="(
                                  subject, subjectIndex
                                ) in getExamBySitting(1).subjects"
                                :key="`${subject.subject || 'subject'}-${subjectIndex}`"
                              >
                                <td>{{ subject.subject || "N/A" }}</td>
                                <td class="text-end fw-semibold">
                                  {{ subject.grade || "N/A" }}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p v-else class="text-muted mb-0">
                          No subject breakdown submitted for this sitting.
                        </p>
                      </div>
                      <div
                        v-else
                        class="border rounded p-3 h-100 d-flex align-items-center"
                      >
                        <p class="text-muted mb-0">
                          No Sitting 1 result submitted.
                        </p>
                      </div>
                    </div>

                    <div class="col-md-6">
                      <div
                        v-if="getExamBySitting(2)"
                        class="border rounded p-3 h-100"
                      >
                        <div
                          class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3"
                        >
                          <div>
                            <h6 class="fw-semibold mb-1">
                              {{
                                getExamBySitting(2).examType || "Exam Record"
                              }}
                            </h6>
                            <small class="text-muted">Sitting 2</small>
                          </div>
                          <div class="text-md-end">
                            <div>
                              <small class="text-muted me-1">Year:</small>
                              <span class="fw-semibold">{{
                                getExamBySitting(2).examYear || "N/A"
                              }}</span>
                            </div>
                            <div>
                              <small class="text-muted me-1">Number:</small>
                              <span class="fw-semibold">{{
                                getExamBySitting(2).examNumber || "N/A"
                              }}</span>
                            </div>
                          </div>
                        </div>

                        <div
                          v-if="getExamBySitting(2).subjects?.length"
                          class="table-responsive"
                        >
                          <table class="table table-sm align-middle mb-0">
                            <thead>
                              <tr>
                                <th scope="col">Subject</th>
                                <th scope="col" class="text-end">Grade</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr
                                v-for="(
                                  subject, subjectIndex
                                ) in getExamBySitting(2).subjects"
                                :key="`${subject.subject || 'subject'}-${subjectIndex}`"
                              >
                                <td>{{ subject.subject || "N/A" }}</td>
                                <td class="text-end fw-semibold">
                                  {{ subject.grade || "N/A" }}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p v-else class="text-muted mb-0">
                          No subject breakdown submitted for this sitting.
                        </p>
                      </div>
                      <div
                        v-else
                        class="border rounded p-3 h-100 d-flex align-items-center"
                      >
                        <p class="text-muted mb-0">
                          No Sitting 2 result submitted.
                        </p>
                      </div>
                    </div>
                  </div>
                  <p v-else class="text-muted mb-0">
                    No examination records submitted.
                  </p>
                </div>
              </div>
            </div>

            <!-- Contact Information -->
            <div class="col-md-6">
              <div class="card p-0 h-100">
                <div class="card-header">
                  <h6 class="card-title mb-0">
                    <i class="bi bi-geo-alt me-2"></i>Contact Information
                  </h6>
                </div>
                <div class="card-body">
                  <div class="row g-3">
                    <div class="col-12">
                      <label class="form-label fw-semibold">Home Address</label>
                      <p class="form-control-plaintext">
                        {{ selectedApplicationDetails.address || "N/A" }}
                      </p>
                    </div>
                    <div class="col-6">
                      <label class="form-label fw-semibold">State</label>
                      <p class="form-control-plaintext">
                        {{ selectedApplicationDetails.stateOfOrigin || "N/A" }}
                      </p>
                    </div>
                    <div class="col-6">
                      <label class="form-label fw-semibold">LGA</label>
                      <p class="form-control-plaintext">
                        {{ selectedApplicationDetails.lga || "N/A" }}
                      </p>
                    </div>
                    <div class="col-12">
                      <label class="form-label fw-semibold"
                        >Emergency Contact Name</label
                      >
                      <p class="form-control-plaintext">
                        {{
                          selectedApplicationDetails.nextOfKin?.name || "N/A"
                        }}
                      </p>
                    </div>
                    <div class="col-12">
                      <label class="form-label fw-semibold"
                        >Emergency Contact Phone</label
                      >
                      <p class="form-control-plaintext">
                        {{
                          selectedApplicationDetails.nextOfKin?.phone || "N/A"
                        }}
                      </p>
                    </div>
                    <div class="col-12">
                      <label class="form-label fw-semibold"
                        >Emergency Contact Relationship</label
                      >
                      <p class="form-control-plaintext">
                        {{
                          selectedApplicationDetails.nextOfKin?.relationship ||
                          "N/A"
                        }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Entrance Exam & Screening Information -->
            <div class="col-md-6">
              <div class="card p-0 h-100">
                <div class="card-header">
                  <h6 class="card-title mb-0">
                    <i class="bi bi-clipboard-check me-2"></i>Exam & Screening
                  </h6>
                </div>
                <div class="card-body">
                  <!-- Entrance Exam -->
                  <div class="mb-4">
                    <h6 class="fw-semibold text-primary">Entrance Exam</h6>
                    <div v-if="selectedApplicationDetails.entranceExam">
                      <div class="row g-2">
                        <div class="col-6">
                          <small class="text-muted">Date:</small>
                          <p class="mb-1">
                            {{
                              selectedApplicationDetails.entranceExam.date
                                ? new Date(
                                    selectedApplicationDetails.entranceExam
                                      .date,
                                  ).toLocaleDateString()
                                : "N/A"
                            }}
                          </p>
                        </div>
                        <div class="col-6">
                          <small class="text-muted">Time:</small>
                          <p class="mb-1">
                            {{
                              selectedApplicationDetails.entranceExam.time ||
                              "N/A"
                            }}
                          </p>
                        </div>
                        <div class="col-12">
                          <small class="text-muted">Exam Link:</small>
                          <p class="mb-1">
                            <a
                              v-if="
                                selectedApplicationDetails.entranceExam.link
                              "
                              :href="
                                selectedApplicationDetails.entranceExam.link
                              "
                              target="_blank"
                              class="text-decoration-none"
                            >
                              {{ selectedApplicationDetails.entranceExam.link }}
                              <i class="bi bi-box-arrow-up-right ms-1"></i>
                            </a>
                            <span v-else>N/A</span>
                          </p>
                        </div>
                        <div class="col-12">
                          <small class="text-muted">Score:</small>
                          <p class="mb-1">
                            <span
                              v-if="
                                selectedApplicationDetails.entranceExam
                                  .score !== undefined
                              "
                              :class="
                                selectedApplicationDetails.entranceExam.score >=
                                50
                                  ? 'text-success fw-bold'
                                  : 'text-danger fw-bold'
                              "
                            >
                              {{
                                selectedApplicationDetails.entranceExam.score
                              }}%
                            </span>
                            <span v-else class="text-muted">Not Available</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    <p
                      v-else-if="
                        !isEntranceExamEnabled(selectedApplicationDetails)
                      "
                      class="text-muted"
                    >
                      Skipped for this session
                    </p>
                    <p v-else class="text-muted">Not scheduled</p>
                  </div>

                  <!-- Screening -->
                  <div>
                    <h6 class="fw-semibold text-primary">
                      Screening & Interview
                    </h6>
                    <div v-if="selectedApplicationDetails.screening">
                      <div class="row g-2">
                        <div class="col-6">
                          <small class="text-muted">Date:</small>
                          <p class="mb-1">
                            {{
                              selectedApplicationDetails.screening.date
                                ? new Date(
                                    selectedApplicationDetails.screening.date,
                                  ).toLocaleDateString()
                                : "N/A"
                            }}
                          </p>
                        </div>
                        <div class="col-6">
                          <small class="text-muted">Time:</small>
                          <p class="mb-1">
                            {{
                              selectedApplicationDetails.screening.time || "N/A"
                            }}
                          </p>
                        </div>
                        <div class="col-12">
                          <small class="text-muted">Venue:</small>
                          <p class="mb-1">
                            {{
                              selectedApplicationDetails.screening.venue ||
                              "N/A"
                            }}
                          </p>
                        </div>
                        <div class="col-12">
                          <small class="text-muted">Status:</small>
                          <p class="mb-1">
                            <span
                              :class="
                                selectedApplicationDetails.screening.completed
                                  ? 'badge bg-success'
                                  : 'badge bg-warning'
                              "
                            >
                              {{
                                selectedApplicationDetails.screening.completed
                                  ? "Completed"
                                  : "Pending"
                              }}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                    <p
                      v-else-if="
                        !isScreeningEnabled(selectedApplicationDetails)
                      "
                      class="text-muted"
                    >
                      Skipped for this session
                    </p>
                    <p v-else class="text-muted">Not scheduled</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Documents -->
            <div class="col-12">
              <div class="card p-0">
                <div class="card-header">
                  <h6 class="card-title mb-0">
                    <i class="bi bi-file-earmark-text me-2"></i>Documents
                  </h6>
                </div>
                <div class="card-body">
                  <div class="row g-3">
                    <!-- O'Level Results -->
                    <div class="col-md-6">
                      <h6 class="fw-semibold text-primary">O'Level Results</h6>
                      <div
                        v-if="
                          selectedApplicationDetails.documents?.olevelResults
                            ?.length
                        "
                      >
                        <div
                          v-for="(result, index) in selectedApplicationDetails
                            .documents.olevelResults"
                          :key="index"
                          class="border rounded p-2 mb-2"
                        >
                          <small class="text-muted"
                            >Result {{ index + 1 }}:</small
                          >
                          <p class="mb-1">
                            <a
                              :href="getDocumentUrl(result)"
                              target="_blank"
                              class="text-decoration-none"
                            >
                              View Document
                              <i class="bi bi-box-arrow-up-right ms-1"></i>
                            </a>
                          </p>
                        </div>
                      </div>
                      <p v-else class="text-muted">
                        No O'Level results uploaded
                      </p>
                    </div>

                    <!-- Reference Letters -->
                    <div class="col-md-6">
                      <h6 class="fw-semibold text-primary">
                        Reference Letters
                      </h6>
                      <div
                        v-if="
                          selectedApplicationDetails.documents?.referenceLetters
                            ?.length
                        "
                      >
                        <div
                          v-for="(letter, index) in selectedApplicationDetails
                            .documents.referenceLetters"
                          :key="index"
                          class="border rounded p-2 mb-2"
                        >
                          <small class="text-muted"
                            >Letter {{ index + 1 }}:</small
                          >
                          <p class="mb-1">
                            <a
                              :href="getDocumentUrl(letter)"
                              target="_blank"
                              class="text-decoration-none"
                            >
                              View Letter
                              <i class="bi bi-box-arrow-up-right ms-1"></i>
                            </a>
                          </p>
                        </div>
                      </div>
                      <p v-else class="text-muted">
                        No reference letters uploaded
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Admission Decision -->
            <div
              v-if="selectedApplicationDetails.admissionDecision"
              class="col-12"
            >
              <div class="card p-0">
                <div class="card-header">
                  <h6 class="card-title mb-0">
                    <i class="bi bi-award me-2"></i>Admission Decision
                  </h6>
                </div>
                <div class="card-body">
                  <div class="row g-3">
                    <div class="col-md-4">
                      <label class="form-label fw-semibold">Decision</label>
                      <p class="form-control-plaintext">
                        <span
                          :class="
                            selectedApplicationDetails.admissionDecision ===
                            'admitted'
                              ? 'badge bg-success'
                              : 'badge bg-danger'
                          "
                        >
                          {{
                            selectedApplicationDetails.admissionDecision?.toUpperCase() ||
                            "N/A"
                          }}
                        </span>
                      </p>
                    </div>
                    <div class="col-md-4">
                      <label class="form-label fw-semibold">
                        Decision Date
                      </label>
                      <p class="form-control-plaintext">
                        {{
                          selectedApplicationDetails.admissionDecisionDate
                            ? new Date(
                                selectedApplicationDetails.admissionDecisionDate,
                              ).toLocaleDateString()
                            : "N/A"
                        }}
                      </p>
                    </div>
                    <div
                      v-if="selectedApplicationDetails.admissionLetterUrl"
                      class="col-md-4"
                    >
                      <label class="form-label fw-semibold">
                        Admission Letter
                      </label>
                      <p class="form-control-plaintext">
                        <a
                          :href="selectedApplicationDetails.admissionLetterUrl"
                          target="_blank"
                          class="text-decoration-none"
                        >
                          View Letter
                          <i class="bi bi-box-arrow-up-right ms-1"></i>
                        </a>
                      </p>
                    </div>
                    <div
                      v-if="selectedApplicationDetails.rejectionReason"
                      class="col-12"
                    >
                      <label class="form-label fw-semibold">
                        Rejection Reason
                      </label>
                      <p class="form-control-plaintext">
                        {{ selectedApplicationDetails.rejectionReason }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Error State -->
          <div v-else class="text-center py-5">
            <i class="bi bi-exclamation-triangle display-1 text-warning"></i>
            <h5 class="mt-3 text-muted">No Details Available</h5>
            <p class="text-muted">Unable to load application details.</p>
          </div>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            data-bs-dismiss="modal"
          >
            Close
          </button>
          <button
            v-if="selectedApplicationDetails"
            type="button"
            class="btn btn-primary"
            :disabled="detailsExporting"
            @click="exportApplicationDetailsPdf"
          >
            <span
              v-if="detailsExporting"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            <i v-else class="bi bi-download me-2"></i>Export Details PDF
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table thead th {
  font-weight: 600;
  color: var(--staff-primary);
  border-bottom: 2px solid var(--staff-light);
}

.table tbody tr:hover {
  background-color: #f8f9fa;
}

.pagination .page-link {
  color: var(--staff-primary);
  border-color: var(--staff-light);
}

.pagination .page-item.active .page-link {
  background-color: var(--staff-primary);
  border-color: var(--staff-primary);
  color: white;
}

.modal-content {
  border: none;
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.175);
}

.modal-header {
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.badge {
  font-size: 0.75rem;
  font-weight: 500;
}

.admission-mobile-card {
  border: 1px solid rgba(26, 95, 95, 0.1);
  border-radius: 16px;
  padding: 1rem;
  background: #fff;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
}

.admission-mobile-meta {
  border-top: 1px solid rgba(26, 95, 95, 0.08);
  /* border-bottom: 1px solid rgba(26, 95, 95, 0.08); */
  padding-top: 0.85rem;
  /* padding-bottom: 0.85rem; */
}

@media (max-width: 767.98px) {
  .admission-mobile-card {
    padding: 0.9rem;
  }
}
</style>
