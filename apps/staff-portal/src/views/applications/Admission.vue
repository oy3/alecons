<script>
import { useAuthStore } from "../../stores/auth.js";
import { apiService } from "../../services/api.js";
import { logger } from "@shared/utils/logger";
import { Modal, Dropdown } from "bootstrap";

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
        5: "Screening & Interview",
        6: "Admission Decision",
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
        examLink: "",
      },
      examFormProcessing: false,

      screeningForm: {
        screeningDate: "",
        screeningTime: "",
        venue: "",
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

      // Modal instances
      scheduleExamModal: null,
      scheduleScreeningModal: null,
      examScoreModal: null,
      admissionDecisionModal: null,
      applicationDetailsModal: null,

      // Application details
      selectedApplicationDetails: null,
      detailsLoading: false,
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
        (item, index, array) => array.indexOf(item) === index
      );
    },
  },
  updated() {
    // Reinitialize dropdowns when component updates (like when applications load)
    this.initializeDropdowns();
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

    if (
      !this.authStore.hasAnyPermission([
        "applications:manage",
        "staff",
        "admin",
      ])
    ) {
      this.$swal.fire({
        icon: "error",
        title: "Access Denied",
        text: "You do not have permission to manage admissions",
        confirmButtonColor: "#1a5f5f",
      });
      return;
    }

    // Initialize modals
    this.initializeModals();

    // Load data
    await Promise.all([this.loadPrograms(), this.loadApplications()]);
  },
  methods: {
    initializeModals() {
      this.$nextTick(() => {
        this.scheduleExamModal = new Modal(
          document.getElementById("scheduleExamModal")
        );
        this.scheduleScreeningModal = new Modal(
          document.getElementById("scheduleScreeningModal")
        );
        this.examScoreModal = new Modal(
          document.getElementById("examScoreModal")
        );
        this.admissionDecisionModal = new Modal(
          document.getElementById("admissionDecisionModal")
        );
        this.applicationDetailsModal = new Modal(
          document.getElementById("applicationDetailsModal")
        );

        // Initialize dropdowns
        this.initializeDropdowns();
      });
    },

    initializeDropdowns() {
      this.$nextTick(() => {
        try {
          // Check if Bootstrap is available
          if (
            typeof window.bootstrap === "undefined" ||
            typeof Dropdown === "undefined"
          ) {
            logger.warn(
              "Bootstrap not fully loaded, retrying dropdown initialization..."
            );
            setTimeout(() => this.initializeDropdowns(), 100);
            return;
          }

          // Initialize all dropdown toggles
          const dropdownElementList =
            document.querySelectorAll(".dropdown-toggle");
          dropdownElementList.forEach((dropdownToggleEl) => {
            // Dispose any existing dropdown instance first
            const existingDropdown = Dropdown.getInstance(dropdownToggleEl);
            if (existingDropdown) {
              existingDropdown.dispose();
            }
            // Create new dropdown instance
            new Dropdown(dropdownToggleEl);
          });

          logger.info("Dropdowns initialized successfully", {
            count: dropdownElementList.length,
          });
        } catch (error) {
          logger.error("Failed to initialize dropdowns:", error);
        }
      });
    },

    // Manual dropdown toggle as fallback
    toggleDropdown(event) {
      try {
        event.preventDefault();
        event.stopPropagation();

        const dropdownToggle = event.currentTarget;
        console.log("Dropdown toggle clicked:", dropdownToggle);

        // Try using Bootstrap's Dropdown class
        if (typeof Dropdown !== "undefined") {
          const dropdown = Dropdown.getOrCreateInstance(dropdownToggle);
          dropdown.toggle();
        } else {
          // Fallback: manually toggle the dropdown
          const dropdownMenu = dropdownToggle.nextElementSibling;
          if (dropdownMenu) {
            dropdownMenu.classList.toggle("show");
            dropdownToggle.setAttribute(
              "aria-expanded",
              dropdownMenu.classList.contains("show")
            );
          }
        }
      } catch (error) {
        logger.error("Failed to toggle dropdown manually:", error);
      }
    },

    async loadPrograms() {
      try {
        // This would be an API call to get programs
        this.programs = ["Nursing Science", "Midwifery", "Public Health"];
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
          sortBy: "createdAt",
          sortOrder: "desc",
          status: "pending", // Always filter for pending applications only
        };

        if (this.programFilter && this.programFilter !== "all") {
          params.program = this.programFilter;
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
            programName: app.programName,
            status: app.status,
            admissionDecision: app.admissionDecision,
            currentStage: app.currentStage,
            entranceExam: app.entranceExam,
            screening: app.screening,
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

    async viewApplication(application) {
      try {
        this.detailsLoading = true;
        this.selectedApplicationDetails = null;
        this.applicationDetailsModal.show();

        const response = await apiService.getApplication(application.id);

        if (response.success) {
          this.selectedApplicationDetails = response.data.application;
          logger.info(
            "Application details loaded:",
            this.selectedApplicationDetails
          );
        } else {
          this.$swal.fire({
            icon: "error",
            title: "Failed to Load",
            text: "Could not load application details. Please try again.",
            confirmButtonColor: "#1a5f5f",
          });
          this.applicationDetailsModal.hide();
        }
      } catch (error) {
        logger.error("Failed to load application details:", error);
        this.$swal.fire({
          icon: "error",
          title: "Error",
          text: "An error occurred while loading application details.",
          confirmButtonColor: "#1a5f5f",
        });
        this.applicationDetailsModal.hide();
      } finally {
        this.detailsLoading = false;
      }
    },

    scheduleExam(application) {
      this.selectedApplication = application;
      this.examForm = {
        examDate: "",
        examTime: "",
        examLink: "",
      };
      this.scheduleExamModal.show();
    },

    async submitExamSchedule() {
      try {
        this.examFormProcessing = true;

        const response = await apiService.scheduleExam(
          this.selectedApplication.id,
          {
            examDate: this.examForm.examDate,
            examTime: this.examForm.examTime,
            examLink: this.examForm.examLink,
          }
        );

        if (response.success) {
          this.$swal.fire({
            icon: "success",
            title: "Exam Scheduled",
            text: "Entrance exam has been scheduled successfully. Student will be notified via email.",
            confirmButtonColor: "#1a5f5f",
          });

          this.scheduleExamModal.hide();
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
      this.examScoreModal.show();
    },

    async submitExamScore() {
      try {
        this.scoreFormProcessing = true;

        const response = await apiService.updateExamScore(
          this.selectedApplication.id,
          {
            score: parseInt(this.scoreForm.score),
            passed: this.scoreForm.passed,
          }
        );

        if (response.success) {
          this.$swal.fire({
            icon: "success",
            title: "Score Updated",
            text: "Exam score has been updated successfully.",
            confirmButtonColor: "#1a5f5f",
          });

          this.examScoreModal.hide();
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
        venue: "",
      };
      this.scheduleScreeningModal.show();
    },

    async submitScreeningSchedule() {
      try {
        this.screeningFormProcessing = true;

        const response = await apiService.scheduleScreening(
          this.selectedApplication.id,
          {
            screeningDate: this.screeningForm.screeningDate,
            screeningTime: this.screeningForm.screeningTime,
            venue: this.screeningForm.venue,
          }
        );

        if (response.success) {
          this.$swal.fire({
            icon: "success",
            title: "Screening Scheduled",
            text: "Screening has been scheduled successfully. Student will be notified via email.",
            confirmButtonColor: "#1a5f5f",
          });

          this.scheduleScreeningModal.hide();
          await this.loadApplications();
        }
      } catch (error) {
        logger.error("Failed to schedule screening:", error);
        this.$swal.fire({
          icon: "error",
          title: "Failed",
          text: "Failed to schedule screening. Please try again.",
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
        admissionLetterUrl: "",
        reason: "",
      };
      this.admissionDecisionModal.show();
    },

    async submitAdmissionDecision() {
      try {
        this.decisionFormProcessing = true;

        const response = await apiService.makeAdmissionDecision(
          this.selectedApplication.id,
          {
            decision: this.decisionForm.decision,
            admissionLetterUrl: this.decisionForm.admissionLetterUrl,
            reason: this.decisionForm.reason,
          }
        );

        if (response.success) {
          this.$swal.fire({
            icon: "success",
            title: "Decision Made",
            text: `Student has been ${this.decisionForm.decision}. Email notification will be sent.`,
            confirmButtonColor: "#1a5f5f",
          });

          this.admissionDecisionModal.hide();
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
                    :key="program"
                    :value="program"
                  >
                    {{ program }}
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
            <table class="table table-hover mb-0">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Applicant</th>
                  <th>Program</th>
                  <th>Current Stage</th>
                  <th>Status</th>
                  <th>Exam Status</th>
                  <th>Screening Status</th>
                  <th>Actions</th>
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
                        <small class="text-muted">{{
                          application.email
                        }}</small>
                      </div>
                    </div>
                  </td>
                  <td>{{ application.programName }}</td>
                  <td>
                    <span class="badge bg-info">
                      {{
                        application.currentStage
                          ? `Stage ${application.currentStage} - ${getStageName(
                              application.currentStage
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
                    <small v-else class="text-muted">Not Scheduled</small>
                  </td>
                  <td>
                    <div class="dropdown">
                      <button
                        :id="`dropdownMenuButton-${application.id}`"
                        type="button"
                        class="btn btn-outline-primary btn-sm dropdown-toggle"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        aria-haspopup="true"
                        @click="toggleDropdown"
                      >
                        Actions
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
                        <li v-if="!application.entranceExam">
                          <a
                            class="dropdown-item"
                            href="#"
                            @click.prevent="scheduleExam(application)"
                          >
                            <i class="bi bi-calendar-plus me-2"></i>Schedule
                            Exam
                          </a>
                        </li>
                        <li
                          v-if="
                            application.entranceExam &&
                            application.entranceExam.score === undefined
                          "
                        >
                          <a
                            class="dropdown-item"
                            href="#"
                            @click.prevent="inputExamScore(application)"
                          >
                            <i class="bi bi-pencil-square me-2"></i>Input Exam
                            Score
                          </a>
                        </li>
                        <li
                          v-if="
                            application.entranceExam &&
                            application.entranceExam.score !== undefined &&
                            !application.screening
                          "
                        >
                          <a
                            class="dropdown-item"
                            href="#"
                            @click.prevent="scheduleScreening(application)"
                          >
                            <i class="bi bi-calendar-check me-2"></i>Schedule
                            Screening
                          </a>
                        </li>
                        <li
                          v-if="
                            application.screening &&
                            !application.screening.completed
                          "
                        >
                          <a
                            class="dropdown-item"
                            href="#"
                            @click.prevent="completeScreening(application)"
                          >
                            <i class="bi bi-check-circle me-2"></i>Mark
                            Screening Complete
                          </a>
                        </li>
                        <li
                          v-if="
                            application.screening &&
                            application.screening.completed &&
                            application.admissionDecision == 'pending'
                          "
                        >
                          <a
                            class="dropdown-item"
                            href="#"
                            @click.prevent="makeAdmissionDecision(application)"
                          >
                            <i class="bi bi-award me-2"></i>Make Admission
                            Decision
                          </a>
                        </li>
                      </ul>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

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
              <label for="examLink" class="form-label">Exam Link</label>
              <input
                id="examLink"
                v-model="examForm.examLink"
                type="url"
                class="form-control"
                placeholder="https://cbt.platform.com/exam/123"
                required
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
              <label for="screeningDate" class="form-label"
                >Screening Date</label
              >
              <input
                id="screeningDate"
                v-model="screeningForm.screeningDate"
                type="date"
                class="form-control"
                required
              />
            </div>
            <div class="mb-3">
              <label for="screeningTime" class="form-label"
                >Screening Time</label
              >
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
              <label for="admissionLetterUrl" class="form-label"
                >Admission Letter URL</label
              >
              <input
                id="admissionLetterUrl"
                v-model="decisionForm.admissionLetterUrl"
                type="url"
                class="form-control"
                placeholder="https://portal.acon.edu.ng/admission-letters/..."
              />
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
             :disabled="decisionFormProcessing" @click="submitAdmissionDecision"
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
             :disabled="decisionFormProcessing" @click="submitAdmissionDecision"
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
                        {{
                          selectedApplicationDetails.userId?.firstName +
                            " " +
                            selectedApplicationDetails.userId?.lastName || "N/A"
                        }}
                      </p>
                    </div>
                    <div class="col-12">
                      <label class="form-label fw-semibold">Email</label>
                      <p class="form-control-plaintext">
                        {{ selectedApplicationDetails.userId.email || "N/A" }}
                      </p>
                    </div>
                    <div class="col-12">
                      <label class="form-label fw-semibold">Phone Number</label>
                      <p class="form-control-plaintext">
                        {{ selectedApplicationDetails.phone || "N/A" }}
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
                                selectedApplicationDetails.dob
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
                        {{ selectedApplicationDetails.programId.name || "N/A" }}
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
                            selectedApplicationDetails.currentStage
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
                              selectedApplicationDetails.status
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
                          selectedApplicationDetails.entryAcademicSession ||
                          "N/A"
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
                                selectedApplicationDetails.createdAt
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
                                selectedApplicationDetails.updatedAt
                              ).toLocaleString()
                            : "N/A"
                        }}
                      </p>
                    </div>
                  </div>
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
                        {{ selectedApplicationDetails.nextOfKin.name || "N/A" }}
                      </p>
                    </div>
                    <div class="col-12">
                      <label class="form-label fw-semibold"
                        >Emergency Contact Phone</label
                      >
                      <p class="form-control-plaintext">
                        {{
                          selectedApplicationDetails.nextOfKin.phone || "N/A"
                        }}
                      </p>
                    </div>
                    <div class="col-12">
                      <label class="form-label fw-semibold"
                        >Emergency Contact Relationship</label
                      >
                      <p class="form-control-plaintext">
                        {{
                          selectedApplicationDetails.nextOfKin.relationship ||
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
                                    selectedApplicationDetails.entranceExam.date
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
                                    selectedApplicationDetails.screening.date
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
                              :href="result"
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
                              :href="letter"
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
                                selectedApplicationDetails.admissionDecisionDate
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
            @click="window.print()"
          >
            <i class="bi bi-printer me-2"></i>Print Details
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
</style>
