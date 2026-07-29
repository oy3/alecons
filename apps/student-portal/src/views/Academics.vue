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
      academicResults: [],
      academicSummary: null,
      isLoadingResults: false,
      showResultsModal: false,
      resultSessionFilter: '',
      resultSemesterFilter: '',
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
    academicProgression() {
      return this.registrationContext?.academicProgression || null;
    },
    selectedSemesterProgression() {
      return (this.academicProgression?.semesterProgressions || []).find(
        (item) => Number(item.semester) === Number(this.selectedSemester || 1),
      ) || null;
    },
    resitCourseIds() {
      return new Set(
        (this.selectedSemesterProgression?.resitProgramCourseIds || []).map((id) =>
          String(id?._id || id),
        ),
      );
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
    gradePreview() {
      const currentSession = String(this.registrationContext?.student?.academicSessionId || '');
      return this.academicResults.filter((result) => String(result.academicSessionId?._id || result.academicSessionId) === currentSession && (!this.selectedSemester || Number(result.semester) === Number(this.selectedSemester))).slice(0, 6);
    },
    resultSessions() {
      const seen = new Map();
      this.academicResults.forEach((result) => {
        const session = result.academicSessionId;
        const id = String(session?._id || session || '');
        if (id) seen.set(id, session?.title || session?.sessionYear || id);
      });
      return [...seen].map(([id, title]) => ({ id, title }));
    },
    filteredFullResults() {
      return this.academicResults.filter((result) => (!this.resultSessionFilter || String(result.academicSessionId?._id || result.academicSessionId) === this.resultSessionFilter) && (!this.resultSemesterFilter || Number(result.semester) === Number(this.resultSemesterFilter)));
    },
    gradePeriodSummary() {
      const periods = this.academicSummary?.periods || [];
      const sessionId = String(this.registrationContext?.student?.academicSessionId || '');
      const semester = Number(this.selectedSemester || this.registrationContext?.student?.selectedSemester || 1);
      return periods.find((period) => period.academicSessionId === sessionId && Number(period.semester) === semester) || {
        isComplete: false,
        expectedCourses: 0,
        publishedCourses: 0,
      };
    },
    modalPeriodSummary() {
      const periods = this.academicSummary?.periods || [];
      const selected = periods.filter((period) =>
        (!this.resultSessionFilter || period.academicSessionId === this.resultSessionFilter) &&
        (!this.resultSemesterFilter || Number(period.semester) === Number(this.resultSemesterFilter)),
      );
      if (!this.resultSessionFilter && !this.resultSemesterFilter) return this.academicSummary;
      if (selected.length === 1) return selected[0];
      if (!selected.length) return null;
      const isComplete = selected.every((period) => period.isComplete);
      const applicableUnits = isComplete ? selected.reduce((sum, period) => sum + Number(period.applicableUnits || 0), 0) : null;
      const qualityPoints = isComplete ? selected.reduce((sum, period) => sum + Number(period.qualityPoints || 0), 0) : null;
      return {
        isComplete,
        expectedCourses: selected.reduce((sum, period) => sum + period.expectedCourses, 0),
        publishedCourses: selected.reduce((sum, period) => sum + period.publishedCourses, 0),
        qualityPoints,
        semesterGPA: applicableUnits ? qualityPoints / applicableUnits : null,
      };
    },
    modalGpaLabel() { return this.resultSemesterFilter ? 'Semester GPA' : 'Selected GPA' },
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

      const matches = this.displayedCourses.filter((course) => {
        if (!query) return true;
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
      return matches.sort((left, right) => Number(this.isResitCourse(right)) - Number(this.isResitCourse(left)));
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
    isResitCourse(course) {
      return this.resitCourseIds.has(String(course.id || course._id || ''));
    },
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
        await this.loadAcademicResults();
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
    async loadAcademicResults() {
      try {
        this.isLoadingResults = true;
        const [response] = await Promise.all([
          apiService.getAcademicResults(),
          this.auth.loadStudentData(),
        ]);
        if (!response.success) throw new Error(response.error || 'Failed to load published results');
        this.academicResults = response.data?.results || [];
        this.academicSummary = response.data?.summary || null;
      } catch (error) {
        logger.error('Academics: failed to load published results', error);
        this.academicResults = [];
        this.academicSummary = null;
      } finally {
        this.isLoadingResults = false;
      }
    },
    formatGpa(value) {
      return Number(value || 0).toFixed(2);
    },
    gradeBadgeClass(result) {
      return result.isPass ? 'bg-success' : 'bg-danger';
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
              <template v-if="auth.hasCumulativeGPA">{{ formatGpa(auth.cumulativeGPA) }}</template>
              <span v-else class="fs-6">N/A</span>
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
      <div v-if="academicProgression?.isRepeatYear" class="alert alert-warning d-flex gap-3 align-items-start mb-4">
        <i class="bi bi-arrow-repeat fs-5"></i>
        <div>
          <div class="fw-semibold">Repeat Year</div>
          <div class="small">You are repeating this level and must complete the full approved course load. Resits are not available during a repeat year.</div>
        </div>
      </div>
      <div
        v-else-if="['repeat_year_required', 'academic_review'].includes(academicProgression?.annualOutcome)"
        class="alert alert-danger d-flex gap-3 align-items-start mb-4"
      >
        <i class="bi bi-exclamation-triangle fs-5"></i>
        <div>
          <div class="fw-semibold">{{ academicProgression.annualOutcome === 'academic_review' ? 'Academic Review Required' : 'Repeat Year Required' }}</div>
          <div class="small">Your completed semester results require formal progression review before the next academic session.</div>
        </div>
      </div>
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
                            isResitCourse(course)
                              ? 'bg-warning-subtle text-warning-emphasis'
                              : isCompulsory(course)
                              ? 'bg-danger-subtle text-danger'
                              : 'bg-secondary-subtle text-secondary'
                          "
                        >
                          {{ isResitCourse(course) ? "Resit Required" : isCompulsory(course) ? "Compulsory" : "Elective" }}
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
              <div v-if="isLoadingResults" class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Loading grades...</div>
              <div v-else-if="gradePreview.length" class="grade-summary-list overflow-auto">
              <div v-for="result in gradePreview" :key="result._id" class="grade-item d-flex justify-content-between align-items-center py-2 border-bottom gap-3">
                <div>
                  <div class="fw-bold">{{ result.courseTitleSnapshot }}</div>
                  <small class="text-muted">{{ result.courseCodeSnapshot }}<span v-if="result.attemptType !== 'initial'"> · {{ result.attemptType }}</span></small>
                </div>
                <div class="text-end">
                  <div class="badge fs-6" :class="gradeBadgeClass(result)">{{ result.gradeLetter }}</div>
                  <div class="small text-muted">{{ formatGpa(result.gradePoint) }} points</div>
                </div>
              </div>
              </div>

              <div v-else class="text-center py-4">
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
                <div v-if="gradePeriodSummary && !gradePeriodSummary.isComplete" class="text-center mb-2">
                  <span class="badge bg-warning-subtle text-warning-emphasis">{{ gradePeriodSummary.expectedCourses ? `Results pending · ${gradePeriodSummary.publishedCourses || 0}/${gradePeriodSummary.expectedCourses} published` : 'Awaiting approved course registration' }}</span>
                </div>
                <div class="row text-center">
                  <div class="col-6">
                    <div v-if="gradePeriodSummary?.isComplete" class="fw-bold text-muted fs-4">{{ formatGpa(gradePeriodSummary.semesterGPA) }}</div>
                    <div v-else class="placeholder-glow summary-placeholder" aria-label="Semester GPA pending"><span class="placeholder col-5"></span></div>
                    <div class="small text-muted">Semester GPA</div>
                  </div>
                  <div class="col-6">
                    <div v-if="gradePeriodSummary?.isComplete" class="fw-bold text-muted fs-4">{{ gradePeriodSummary.earnedUnits }}</div>
                    <div v-else class="placeholder-glow summary-placeholder" aria-label="Credits earned pending"><span class="placeholder col-5"></span></div>
                    <div class="small text-muted">Credits Earned</div>
                  </div>
                </div>
              </div>

              <div class="text-center mt-3">
                <button class="btn btn-outline-secondary btn-sm" :disabled="!academicResults.length" @click="showResultsModal = true">
                  View Full Results
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
  <div v-if="showResultsModal" class="modal d-block" tabindex="-1" role="dialog" aria-modal="true">
    <div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content">
      <div class="modal-header"><div><h5 class="modal-title">Published Results</h5><small v-if="modalPeriodSummary?.isComplete" class="text-muted">{{ modalGpaLabel }} {{ formatGpa(modalPeriodSummary.semesterGPA) }} · Quality Points {{ formatGpa(modalPeriodSummary.qualityPoints) }}<template v-if="auth.hasCumulativeGPA"> · Official CGPA {{ formatGpa(auth.cumulativeGPA) }}</template></small><small v-else class="text-warning-emphasis">Results pending · {{ modalPeriodSummary?.publishedCourses || 0 }}/{{ modalPeriodSummary?.expectedCourses || 0 }} published</small></div><button type="button" class="btn-close" aria-label="Close" @click="showResultsModal = false"></button></div>
      <div class="modal-body"><div class="row g-2 mb-3"><div class="col-sm-7"><select v-model="resultSessionFilter" class="form-select form-select-sm"><option value="">All academic sessions</option><option v-for="session in resultSessions" :key="session.id" :value="session.id">{{ session.title }}</option></select></div><div class="col-sm-5"><select v-model="resultSemesterFilter" class="form-select form-select-sm"><option value="">Both semesters</option><option value="1">First semester</option><option value="2">Second semester</option></select></div></div><div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead class="table-light"><tr><th>Course</th><th>Attempt</th><th>Units</th><th>Score</th><th>Grade</th><th>Grade Point</th><th>Quality Points</th></tr></thead><tbody><tr v-for="result in filteredFullResults" :key="result._id"><td><div class="fw-semibold">{{ result.courseTitleSnapshot }}</div><small class="text-muted">{{ result.courseCodeSnapshot }} · {{ result.academicSessionId?.title || result.academicSessionId?.sessionYear }} · Semester {{ result.semester || '-' }}</small></td><td class="text-capitalize">{{ result.attemptType }}</td><td>{{ result.unitsSnapshot }}</td><td>{{ result.finalScore == null ? '-' : Number(result.finalScore).toFixed(2) }}</td><td><span class="badge" :class="gradeBadgeClass(result)">{{ result.gradeLetter || result.specialStatus }}</span></td><td>{{ result.gradePoint == null ? '-' : formatGpa(result.gradePoint) }}</td><td>{{ result.qualityPoints == null ? '-' : formatGpa(result.qualityPoints) }}</td></tr><tr v-if="!filteredFullResults.length"><td colspan="7" class="text-center text-muted py-4">No published results match these filters.</td></tr></tbody></table></div></div>
      <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" @click="showResultsModal = false">Close</button></div>
    </div></div>
  </div><div v-if="showResultsModal" class="modal-backdrop show"></div>
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
.grade-summary-list { max-height: 15.5rem; }
.summary-placeholder {
  min-height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
