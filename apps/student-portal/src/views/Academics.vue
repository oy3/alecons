<script>
import { Popover } from "bootstrap";
import { useAuthStore } from "../stores/auth.js";
import { apiService } from "../services/api.js";
import Swal from "sweetalert2";
import { logger } from "@shared/utils/logger";

export default {
  name: "Academics",
  data() {
    return {
      isLoading: true,
      isSavingDraft: false,
      isSubmitting: false,
      registrationContext: null,
      selectedLevel: null,
      selectedSemester: null,
      selectedCourseIds: [],
      courseSearchQuery: "",
      feedback: null,
      reviewReasonPopover: null,
    };
  },
  setup() {
    const auth = useAuthStore();
    return { auth };
  },
  computed: {
    availableCourses() {
      return this.registrationContext?.availableCourses || [];
    },
    currentRegistration() {
      return this.registrationContext?.registration || null;
    },
    savedRegistrationCourses() {
      return (this.currentRegistration?.items || [])
        .map((item) => item.programCourse)
        .filter(Boolean);
    },
    isCurrentSelectedPeriod() {
      const currentLevel =
        Number(this.registrationContext?.student?.currentLevel) || 1;
      const currentSemester =
        Number(this.registrationContext?.student?.currentSemester) || 1;
      const selectedLevel =
        Number(
          this.selectedLevel ||
            this.registrationContext?.student?.selectedLevel,
        ) || currentLevel;
      const selectedSemester =
        Number(
          this.selectedSemester ||
            this.registrationContext?.student?.selectedSemester,
        ) || currentSemester;

      return (
        selectedLevel === currentLevel && selectedSemester === currentSemester
      );
    },
    eligibility() {
      return (
        this.registrationContext?.eligibility || {
          eligible: false,
          reason: null,
        }
      );
    },
    sessionTotals() {
      return (
        this.registrationContext?.sessionTotals || {
          currentSemesterUnits: 0,
          otherSemesterUnits: 0,
          totalRegisteredUnits: 0,
        }
      );
    },
    selectedUnits() {
      return this.availableCourses
        .filter((course) => this.selectedCourseIds.includes(course.id))
        .reduce((sum, course) => sum + course.units, 0);
    },
    compulsoryCourseIds() {
      return this.availableCourses
        .filter((course) => course.category === "compulsory")
        .map((course) => course.id);
    },
    selectedCourseCount() {
      return this.selectedCourseIds.length;
    },
    currentCoursesCount() {
      return (
        this.currentRegistration?.items?.length || this.selectedCourseCount
      );
    },
    displayedCourses() {
      if (this.canEditRegistration) {
        return this.availableCourses;
      }

      return this.savedRegistrationCourses;
    },
    showClosedRegistrationPlaceholder() {
      return (
        this.isCurrentSelectedPeriod &&
        !this.canEditRegistration &&
        !this.currentRegistration
      );
    },
    filteredDisplayedCourses() {
      const query = this.courseSearchQuery.trim().toLowerCase();

      if (!query) {
        return this.displayedCourses;
      }

      return this.displayedCourses.filter((course) => {
        const lecturerNames = (course.lecturers || [])
          .map((lecturer) =>
            [lecturer.firstName, lecturer.otherName, lecturer.lastName]
              .filter(Boolean)
              .join(" "),
          )
          .join(" ");

        const haystack = [
          course.course?.title,
          course.course?.code,
          course.course?.description,
          course.category,
          lecturerNames,
          `level ${course.level}`,
          `semester ${course.semester}`,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      });
    },
    totalFilteredCourses() {
      return this.filteredDisplayedCourses.length;
    },
    registrationPeriodOptions() {
      const programType =
        this.registrationContext?.program?.programType || "Level";
      const currentLevel =
        Number(this.registrationContext?.student?.currentLevel) || 1;
      const durationYears = Math.max(
        Number(this.registrationContext?.program?.durationYears) || 0,
        currentLevel,
      );
      const options = [];

      for (let level = 1; level <= durationYears; level += 1) {
        for (let semester = 1; semester <= 2; semester += 1) {
          options.push({
            value: `${level}-${semester}`,
            level,
            semester,
            label: `${programType} ${level} Semester ${semester}`,
          });
        }
      }

      return options;
    },
    selectedPeriodValue() {
      const level =
        this.selectedLevel ||
        this.registrationContext?.student?.selectedLevel ||
        this.registrationContext?.student?.currentLevel ||
        1;
      const semester =
        this.selectedSemester ||
        this.registrationContext?.student?.selectedSemester ||
        1;

      return `${level}-${semester}`;
    },
    selectedPeriodLabel() {
      const selectedOption = this.registrationPeriodOptions.find(
        (option) => option.value === this.selectedPeriodValue,
      );

      return selectedOption?.label || "Selected registration period";
    },
    selectedPeriodMessage() {
      if (!this.isCurrentSelectedPeriod) {
        if (this.currentRegistration) {
          return `Viewing saved registration for ${this.selectedPeriodLabel.toLowerCase()}.`;
        }

        return `No saved registration was found for ${this.selectedPeriodLabel.toLowerCase()}.`;
      }

      return (
        this.eligibility.reason ||
        `Course registration for ${this.selectedPeriodLabel.toLowerCase()} is ${this.eligibility.eligible ? "open" : "currently unavailable"}.`
      );
    },
    emptyStateTitle() {
      if (this.showClosedRegistrationPlaceholder) {
        return "Course Registration Not Open";
      }

      return this.isCurrentSelectedPeriod
        ? "No Courses Registered"
        : "No Registration Found";
    },
    emptyStateMessage() {
      if (this.showClosedRegistrationPlaceholder) {
        return (
          this.eligibility.reason ||
          `Course registration is currently unavailable for ${this.selectedPeriodLabel.toLowerCase()}.`
        );
      }

      return this.isCurrentSelectedPeriod
        ? "You haven't registered for any courses yet."
        : "There is no course registration for this level and semester yet.";
    },
    emptyStateDetail() {
      if (this.showClosedRegistrationPlaceholder) {
        return "Courses will appear here once registration opens, or when you already have a saved registration for this semester.";
      }

      return this.isCurrentSelectedPeriod
        ? "No courses are available yet for your current level and semester."
        : "Historical registrations will appear here when data exists.";
    },
    canEditRegistration() {
      if (!this.isCurrentSelectedPeriod || !this.eligibility.eligible) {
        return false;
      }

      return (
        !this.currentRegistration ||
        ["draft", "rejected"].includes(this.currentRegistration.status)
      );
    },
    canSubmitRegistration() {
      return (
        this.canEditRegistration &&
        this.selectedCourseCount > 0 &&
        !this.isSubmitting
      );
    },
    advisorName() {
      const advisor = this.registrationContext?.program?.courseAdvisor;
      if (!advisor) {
        return "Not assigned";
      }

      return [advisor.firstName, advisor.otherName, advisor.lastName]
        .filter(Boolean)
        .join(" ");
    },
    statusBadgeClass() {
      const status = this.currentRegistration?.status;
      if (status === "submitted") {
        return "bg-primary-subtle text-primary-emphasis";
      }
      if (status === "approved") {
        return "bg-success-subtle text-success";
      }
      if (status === "rejected") {
        return "bg-danger-subtle text-danger";
      }
      return "bg-warning-subtle text-warning";
    },
    showReviewReason() {
      return (
        ["approved", "rejected"].includes(this.currentRegistration?.status) &&
        !!this.currentRegistration?.reviewComment
      );
    },
  },
  async mounted() {
    await this.loadRegistrationContext();
  },
  beforeUnmount() {
    this.disposeReviewPopover();
  },
  methods: {
    async loadRegistrationContext() {
      try {
        this.isLoading = true;
        this.feedback = null;

        const response = await apiService.getCourseRegistration(
          this.selectedLevel,
          this.selectedSemester,
        );
        if (!response.success) {
          throw new Error(
            response.error || "Failed to load course registration",
          );
        }

        this.registrationContext = response.data;
        this.selectedLevel =
          response.data.student?.selectedLevel ||
          this.selectedLevel ||
          response.data.student?.currentLevel ||
          1;
        this.selectedSemester =
          response.data.student?.selectedSemester || this.selectedSemester || 1;
        this.initializeSelections();
        this.$nextTick(() => {
          this.initializeReviewPopover();
        });
      } catch (error) {
        logger.error(
          "Academics: failed to load course registration context",
          error,
        );
        this.feedback = {
          type: "danger",
          message: error.message || "Failed to load course registration data.",
        };
      } finally {
        this.isLoading = false;
      }
    },
    disposeReviewPopover() {
      if (this.reviewReasonPopover) {
        this.reviewReasonPopover.dispose();
        this.reviewReasonPopover = null;
      }
    },
    initializeReviewPopover() {
      this.disposeReviewPopover();

      if (!this.showReviewReason) {
        return;
      }

      const trigger = this.$refs.reviewReasonTrigger;
      if (!trigger) {
        return;
      }

      this.reviewReasonPopover = new Popover(trigger, {
        container: "body",
        placement: "bottom",
        trigger: "focus",
        html: true,
        sanitize: false,
        title: "Review Reason",
        content: this.getReviewPopoverContent(),
      });
    },
    escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },
    getReviewerName() {
      const reviewer = this.currentRegistration?.reviewedBy;
      if (!reviewer) {
        return "Course advisor";
      }

      return [reviewer.firstName, reviewer.lastName]
        .filter(Boolean)
        .join(" ");
    },
    getReviewedAtLabel() {
      if (!this.currentRegistration?.reviewedAt) {
        return "Not available";
      }

      return new Date(this.currentRegistration.reviewedAt).toLocaleString();
    },
    getReviewPopoverContent() {
      const comment = this.escapeHtml(this.currentRegistration?.reviewComment || "No review comment provided.");
      const reviewer = this.escapeHtml(this.getReviewerName());
      const reviewedAt = this.escapeHtml(this.getReviewedAtLabel());

      return `
        <div class="small">
          <div class="mb-2">${comment}</div>
          <div class="text-muted"><strong>Reviewed by:</strong> ${reviewer}</div>
          <div class="text-muted"><strong>Reviewed at:</strong> ${reviewedAt}</div>
        </div>
      `;
    },
    initializeSelections() {
      if (this.currentRegistration?.items?.length) {
        this.selectedCourseIds = this.currentRegistration.items
          .map((item) => item.programCourseId)
          .filter(Boolean);
        return;
      }

      this.selectedCourseIds = [];
    },
    isCompulsory(course) {
      return course.category === "compulsory";
    },
    isSelected(courseId) {
      return this.selectedCourseIds.includes(courseId);
    },
    toggleCourse(courseId) {
      if (!this.canEditRegistration) {
        return;
      }

      if (this.selectedCourseIds.includes(courseId)) {
        this.selectedCourseIds = this.selectedCourseIds.filter(
          (id) => id !== courseId,
        );
      } else {
        this.selectedCourseIds = [...this.selectedCourseIds, courseId];
      }
    },
    async changeRegistrationPeriod(event) {
      const [level, semester] = String(event.target.value)
        .split("-")
        .map((value) => Number(value));

      this.selectedLevel = level;
      this.selectedSemester = semester;
      await this.loadRegistrationContext();
    },
    async saveDraft() {
      try {
        this.isSavingDraft = true;
        this.feedback = null;

        const response = await apiService.saveCourseRegistrationDraft({
          level: this.selectedLevel,
          semester: this.selectedSemester,
          items: this.selectedCourseIds,
        });

        if (!response.success) {
          throw new Error(
            response.error || "Failed to save registration draft",
          );
        }

        this.feedback = {
          type: "success",
          message:
            response.message || "Course registration draft saved successfully.",
        };

        await this.loadRegistrationContext();
      } catch (error) {
        logger.error("Academics: failed to save registration draft", error);
        this.feedback = {
          type: "danger",
          message: error.message || "Failed to save registration draft.",
        };
      } finally {
        this.isSavingDraft = false;
      }
    },
    async submitRegistration() {
      const result = await Swal.fire({
        icon: "question",
        title: "Submit Course Registration?",
        text: "You will not be able to edit it again until it is reviewed.",
        showCancelButton: true,
        confirmButtonText: "Submit",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#198754",
        cancelButtonColor: "#6c757d",
      });

      if (!result.isConfirmed) {
        return;
      }

      try {
        this.isSubmitting = true;
        this.feedback = null;

        const response = await apiService.submitCourseRegistration({
          level: this.selectedLevel,
          semester: this.selectedSemester,
          items: this.selectedCourseIds,
        });

        if (!response.success) {
          throw new Error(
            response.error || "Failed to submit course registration",
          );
        }

        this.feedback = {
          type: "success",
          message:
            response.message || "Course registration submitted successfully.",
        };

        await this.loadRegistrationContext();
      } catch (error) {
        logger.error("Academics: failed to submit registration", error);
        this.feedback = {
          type: "danger",
          message: error.message || "Failed to submit course registration.",
        };
      } finally {
        this.isSubmitting = false;
      }
    },
    getLecturerNames(course) {
      if (!course.lecturers?.length) {
        return "Not assigned";
      }

      return course.lecturers
        .map((lecturer) =>
          [lecturer.firstName, lecturer.lastName].filter(Boolean).join(" "),
        )
        .join(", ");
    },
    formatStatus(status) {
      if (!status) {
        return "Draft";
      }

      return status.charAt(0).toUpperCase() + status.slice(1);
    },
  },
};
</script>

<template>
  <div class="academics p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div
          class="d-flex justify-content-between align-items-center flex-wrap"
        >
          <div class="mb-2 mb-md-0">
            <h2 class="h3 fw-bold text-dark mb-1">
              <i class="bi bi-book me-2 text-primary"></i>
              Academic Dashboard
            </h2>
            <p class="text-muted mb-0">
              Manage your courses, assignments, and academic progress.
            </p>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-sm btn-outline-primary" disabled>
              <i class="bi bi-download me-1"></i
              ><span class="d-none d-sm-inline">Export Transcript</span
              ><span class="d-sm-none">Export</span>
            </button>
            <!-- <button class="btn btn-primary btn-sm" disabled>
              <i class="bi bi-calendar-plus me-1"></i
              ><span class="d-none d-sm-inline">Add Course</span
              ><span class="d-sm-none">Add</span>
            </button> -->
          </div>
        </div>
      </div>
    </div>

    <!-- Academic Stats -->
    <div class="row mb-4">
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm text-center h-100">
          <div class="card-body">
            <div
              class="bg-primary bg-opacity-10 rounded-circle mx-auto mb-3"
              style="
                width: 60px;
                height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
              "
            >
              <i class="bi bi-mortarboard text-white fs-3"></i>
            </div>
            <h4 class="fw-bold text-muted">
              {{ auth.cumulativeGPA ? auth.cumulativeGPA.toFixed(2) : "-" }}
            </h4>
            <p class="text-muted mb-0">Cumulative GPA</p>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm text-center h-100">
          <div class="card-body">
            <div
              class="bg-success bg-opacity-10 rounded-circle mx-auto mb-3"
              style="
                width: 60px;
                height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
              "
            >
              <i class="bi bi-book-half text-success fs-3"></i>
            </div>
            <h4 class="fw-bold text-muted">{{ currentCoursesCount || "-" }}</h4>
            <p class="text-muted mb-0">Current Courses</p>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm text-center h-100">
          <div class="card-body">
            <div
              class="bg-warning bg-opacity-10 rounded-circle mx-auto mb-3"
              style="
                width: 60px;
                height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
              "
            >
              <i class="bi bi-list-check text-warning fs-3"></i>
            </div>
            <h4 class="fw-bold text-warning">-</h4>
            <p class="text-muted mb-0">Pending Assignments</p>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm text-center h-100">
          <div class="card-body">
            <div
              class="bg-info bg-opacity-10 rounded-circle mx-auto mb-3"
              style="
                width: 60px;
                height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
              "
            >
              <i class="bi bi-calendar-check text-info fs-3"></i>
            </div>
            <h4 class="fw-bold text-info">-</h4>
            <p class="text-muted mb-0">Attendance Rate</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="feedback" class="alert mb-4" :class="`alert-${feedback.type}`">
      {{ feedback.message }}
    </div>

    <div v-if="isLoading" class="card border-0 shadow-sm">
      <div class="card-body text-center py-5">
        <div class="spinner-border text-primary mb-3"></div>
        <p class="text-muted mb-0">Loading course registration...</p>
      </div>
    </div>

    <template v-else>
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-white border-0 py-3">
          <div
            class="d-flex justify-content-between align-items-center flex-wrap"
          >
            <div>
              <h5 class="fw-bold mb-0 mb-2 mb-md-0">
                Current Semester Courses
              </h5>
              <p class="text-light opacity-75 small fw-medium mb-0 mt-1">
                {{ selectedPeriodMessage }}
              </p>
            </div>
            <div class="d-flex gap-2 flex-wrap">
              <select
                class="form-select form-select-sm"
                style="width: auto"
                :value="selectedPeriodValue"
                @change="changeRegistrationPeriod"
                :disabled="isLoading"
              >
                <option
                  v-for="option in registrationPeriodOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
        <div class="card-body p-0 courses-card-body">
          <div
            v-if="!displayedCourses.length"
            class="courses-empty-state text-center"
          >
            <i class="bi bi-book text-muted" style="font-size: 4rem"></i>
            <h5 class="text-muted mt-4 mb-3">{{ emptyStateTitle }}</h5>
            <p class="text-muted">{{ emptyStateMessage }}</p>
            <p class="text-muted small">{{ emptyStateDetail }}</p>
            <button
              v-if="canEditRegistration"
              class="btn btn-primary mt-3"
              :disabled="!canSubmitRegistration"
            >
              <i class="bi bi-plus-circle me-2"></i>Register for Courses
            </button>
          </div>

          <div v-else class="courses-table-layout">
            <div
              class="p-3 d-flex gap-3 align-items-center justify-content-between"
            >
              <div class="input-group w-75">
                <span class="input-group-text bg-white border-end-0">
                  <i class="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  class="form-control border-start-0"
                  v-model.trim="courseSearchQuery"
                  placeholder="Search here..."
                />
              </div>
              <div class="py-2 d-grid gap-2">
                <span
                  v-if="currentRegistration"
                  class="badge rounded-pill p-2"
                  :class="statusBadgeClass"
                >
                  {{ formatStatus(currentRegistration.status) }}
                </span>
                <button
                  type="button"
                  ref="reviewReasonTrigger"
                  v-if="showReviewReason"
                  class="btn btn-sm btn-link p-0 border-0 shadow-none small link-primary link-offset-2 link-underline-opacity-25 link-underline-opacity-100-hover"
                  data-bs-container="body"
                  data-bs-toggle="popover"
                  data-bs-placement="bottom"
                >
                  View reason
                </button>
              </div>
            </div>
            <div
              v-if="!filteredDisplayedCourses.length"
              class="courses-empty-search text-center px-4"
            >
              <i class="bi bi-search text-muted" style="font-size: 3rem"></i>
              <h5 class="text-muted mt-3 mb-2">No Matching Courses</h5>
              <p class="text-muted mb-0">
                Try a different keyword to find the courses you need.
              </p>
            </div>
            <template v-else>
              <div class="courses-table-scroll">
                <table class="table table-hover mb-0">
                  <thead class="table-light sticky-top">
                    <tr>
                      <th class="border-0 fw-bold">Course</th>
                      <th class="border-0 fw-bold d-none d-md-table-cell">
                        Instructor
                      </th>
                      <th
                        class="border-0 fw-bold d-none d-lg-table-cell text-center"
                      >
                        Credits
                      </th>
                      <th class="border-0 fw-bold text-center">Status</th>
                      <!-- <th class="border-0 fw-bold d-none d-sm-table-cell">Selection</th> -->
                      <th v-if="canEditRegistration" class="border-0 fw-bold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="course in filteredDisplayedCourses"
                      :key="course.id"
                    >
                      <td class="">
                        <div class="fw-semibold text-dark">
                          {{ course.course?.title }}
                        </div>
                        <small class="text-muted">
                          {{ course.course?.code }}
                          <!-- ·
                          {{ registrationContext?.program?.programType || 'N/A' }} {{ course.level }} · Semester
                          {{ course.semester }} -->
                        </small>
                      </td>
                      <td class="d-none d-md-table-cell">
                        {{ getLecturerNames(course) }}
                      </td>
                      <td class="d-none d-lg-table-cell text-center">
                        {{ course.units }}
                      </td>
                      <td class="text-center">
                        <span
                          class="badge rounded-pill"
                          :class="
                            isCompulsory(course)
                              ? 'bg-danger-subtle text-danger'
                              : 'bg-secondary-subtle text-secondary'
                          "
                        >
                          {{ isCompulsory(course) ? "Compulsory" : "Elective" }}
                        </span>
                      </td>
                      <!-- <td class="py-3 d-none d-sm-table-cell">
                        <small :class="isSelected(course.id) ? 'text-success fw-semibold' : 'text-muted'">
                          {{ isSelected(course.id) ? 'Selected' : 'Not selected' }}
                        </small>
                      </td> -->
                      <td v-if="canEditRegistration" class="py-3">
                        <div class="form-check mb-0">
                          <input
                            class="form-check-input"
                            type="checkbox"
                            :checked="isSelected(course.id)"
                            :disabled="!canEditRegistration"
                            @change="toggleCourse(course.id)"
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div
                class="courses-table-footer px-3 py-2 border-top bg-white d-flex justify-content-between align-items-center flex-wrap gap-3"
              >
                <span class="small text-muted">
                  Showing {{ totalFilteredCourses }} courses
                </span>
                <div
                  v-if="canEditRegistration"
                  class="d-flex align-items-center gap-2 flex-wrap"
                >
                  <div class="d-flex gap-2">
                    <button
                      class="btn btn-sm btn-info"
                      @click="saveDraft"
                      :disabled="
                        !canEditRegistration ||
                        isSavingDraft ||
                        isSubmitting ||
                        !canSubmitRegistration
                      "
                    >
                      <span
                        v-if="isSavingDraft"
                        class="spinner-border spinner-border-sm me-1"
                      ></span>
                      Save Draft
                    </button>
                    <button
                      class="btn btn-sm btn-success"
                      @click="submitRegistration"
                      :disabled="!canSubmitRegistration || isSavingDraft"
                    >
                      <span
                        v-if="isSubmitting"
                        class="spinner-border spinner-border-sm me-1"
                      ></span>
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- COMMENTED OUT: Mock course data - uncomment when backend is ready -->
          <!-- <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th class="border-0 fw-bold">Course</th>
                  <th class="border-0 fw-bold d-none d-md-table-cell">Instructor</th>
                  <th class="border-0 fw-bold d-none d-lg-table-cell">Credits</th>
                  <th class="border-0 fw-bold">Grade</th>
                  <th class="border-0 fw-bold d-none d-sm-table-cell">Progress</th>
                  <th class="border-0 fw-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                [All course table rows commented out for future use]
              </tbody>
            </table>
          </div>
          -->
        </div>
      </div>

      <div class="row">
        <div class="col-lg-7 mb-4">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-header bg-white border-0 py-3">
              <h5 class="fw-bold mb-0">Recent Assignments</h5>
            </div>
            <div class="card-body">
              <!-- TODO: Replace with actual assignment data when assignment system is implemented -->
              <!--
              <div class="assignment-item mb-3 p-3 border rounded">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <h6 class="fw-bold mb-0">Assignment Title</h6>
                  <span class="badge bg-danger">Due Date</span>
                </div>
                <p class="text-muted small mb-2">Course Code - Instructor Name</p>
                <div class="d-flex justify-content-between align-items-center">
                  <div class="progress flex-grow-1 me-3" style="height: 6px;">
                    <div class="progress-bar" style="width: 0%"></div>
                  </div>
                  <small class="text-muted">Progress</small>
                </div>
              </div>
              -->
              <div class="text-center py-5">
                <i
                  class="bi bi-list-check text-muted mb-3"
                  style="font-size: 3rem"
                ></i>
                <h5 class="text-muted">No Assignments Available</h5>
                <p class="text-muted mb-0">
                  Assignments will appear here when courses are active.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-5 mb-4">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-header bg-white border-0 py-3">
              <h5 class="fw-bold mb-0">Grade Summary</h5>
            </div>
            <div class="card-body">
              <!-- TODO: Replace with actual grade data when grading system is implemented -->
              <!--
              <div class="grade-item d-flex justify-content-between align-items-center py-2 border-bottom">
                <div>
                  <div class="fw-bold">Course Name</div>
                  <small class="text-muted">Course Code</small>
                </div>
                <div class="text-end">
                  <div class="badge bg-success fs-6">Grade</div>
                  <div class="small text-muted">GPA Points</div>
                </div>
              </div>
              -->
              <div class="text-center py-4">
                <i
                  class="bi bi-graph-up text-muted mb-3"
                  style="font-size: 3rem"
                ></i>
                <h5 class="text-muted">No Grades Available</h5>
                <p class="text-muted mb-4">
                  Grade information will appear here when courses are completed.
                </p>
              </div>

              <div class="mt-4 p-3 bg-light rounded">
                <div class="row text-center">
                  <div class="col-6">
                    <div class="fw-bold text-muted fs-4">-</div>
                    <div class="small text-muted">Current GPA</div>
                  </div>
                  <div class="col-6">
                    <div class="fw-bold text-muted fs-4">-</div>
                    <div class="small text-muted">Credits Earned</div>
                  </div>
                </div>
              </div>

              <div class="text-center mt-3">
                <button class="btn btn-outline-secondary btn-sm" disabled>
                  View Full Transcript
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.academics {
  background: linear-gradient(180deg, #f8f9fa 0%, #eef4f3 100%);
  min-height: calc(100vh - 70px);
}

.courses-card-body {
  height: 34rem;
}

.courses-empty-state,
.courses-empty-search {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.courses-table-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.courses-toolbar {
  flex: 0 0 auto;
}

.courses-table-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}

.courses-table-footer {
  flex: 0 0 auto;
}

.sticky-top {
  top: 0;
  z-index: 1;
}

.assignment-item {
  transition: all 0.2s ease;
}

.assignment-item:hover {
  background-color: #f8f9fa;
}

.grade-item:last-child {
  border-bottom: none !important;
}
</style>
