<script>
import { apiService } from "../../../services/api.js";

const emptyFilters = () => ({
  programTypeId: "",
  programModeId: "",
  programId: "",
  level: "",
  programCourseId: "",
});

export default {
  name: "AcademicResults",
  data() {
    return {
      loading: false,
      saving: false,
      dirty: false,
      options: { programs: [] },
      filters: emptyFilters(),
      courses: [],
      scoreSheet: null,
      selectedAttemptType: "initial",
      studentSearch: "",
      currentPage: 1,
      pageSize: 50,
    };
  },
  computed: {
    programTypes() {
      const values = new Map();
      this.options.programs.forEach((program) => {
        if (program.programTypeId?._id)
          values.set(program.programTypeId._id, program.programTypeId);
      });
      return [...values.values()].sort((a, b) => a.type.localeCompare(b.type));
    },
    programModes() {
      const values = new Map();
      this.options.programs.forEach((program) => {
        if (program.programModeId?._id)
          values.set(program.programModeId._id, program.programModeId);
      });
      return [...values.values()].sort((a, b) => a.mode.localeCompare(b.mode));
    },
    filteredPrograms() {
      return this.options.programs.filter(
        (program) =>
          (!this.filters.programTypeId ||
            program.programTypeId?._id === this.filters.programTypeId) &&
          (!this.filters.programModeId ||
            program.programModeId?._id === this.filters.programModeId),
      );
    },
    selectedProgram() {
      return (
        this.options.programs.find(
          (program) => program._id === this.filters.programId,
        ) || null
      );
    },
    availableLevels() {
      return Array.from(
        { length: Number(this.selectedProgram?.durationYears || 0) },
        (_, index) => index + 1,
      );
    },
    components() {
      return this.scoreSheet?.assessmentComponents || [];
    },
    attemptLabel() {
      return this.selectedAttemptType === "initial"
        ? "Initial"
        : this.selectedAttemptType === "resit"
          ? "Resit"
          : "Repeat";
    },
    reviewFeedback() {
      const seen = new Set();
      return (this.scoreSheet?.students || [])
        .map((student) => student.result?.reviewFeedback)
        .filter((feedback) => feedback?.comment)
        .filter((feedback) => {
          const key = `${feedback.action}:${feedback.comment}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    },
    filteredStudents() {
      const query = this.studentSearch.trim().toLowerCase();
      const students = this.scoreSheet?.students || [];
      if (!query) return students;
      return students.filter((student) =>
        [student.name, student.matriculationNumber]
          .some((value) => String(value || "").toLowerCase().includes(query)),
      );
    },
    totalPages() {
      return Math.max(1, Math.ceil(this.filteredStudents.length / this.pageSize));
    },
    displayedStudents() {
      const start = (this.currentPage - 1) * this.pageSize;
      return this.filteredStudents.slice(start, start + this.pageSize);
    },
  },
  watch: {
    "filters.programTypeId"() {
      this.resetBelow("type");
    },
    "filters.programModeId"() {
      this.resetBelow("mode");
    },
    "filters.programId"() {
      this.filters.level = "";
      this.filters.programCourseId = "";
      this.courses = [];
      this.scoreSheet = null;
    },
    "filters.level"() {
      this.filters.programCourseId = "";
      this.scoreSheet = null;
      if (this.filters.programId && this.filters.level) this.loadCourses();
    },
    "filters.programCourseId"() {
      if (this.filters.programCourseId) this.loadScoreSheet();
      else this.scoreSheet = null;
    },
    selectedAttemptType() {
      if (this.filters.programCourseId) this.loadScoreSheet();
    },
    studentSearch() { this.currentPage = 1; },
  },
  async mounted() {
    window.addEventListener("beforeunload", this.preventUnload);
    try {
      const response = await apiService.getStaffStudentFilterOptions();
      this.options = response.data || this.options;
    } catch (error) {
      this.$swal.fire(
        "Could not load result filters",
        error.message || "Please try again.",
        "error",
      );
    }
  },
  beforeUnmount() {
    window.removeEventListener("beforeunload", this.preventUnload);
  },
  async beforeRouteLeave(to, from, next) {
    if (!this.dirty) return next();
    const result = await this.$swal.fire({
      title: "Discard unsaved scores?",
      text: "Your latest score changes have not been saved.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Discard Changes",
    });
    next(Boolean(result.isConfirmed));
  },
  methods: {
    preventUnload(event) {
      if (!this.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    },
    isEditableResult(student) {
      if (!student.result) return this.selectedAttemptType === "initial";
      return (
        !student.result._id ||
        ["draft", "returned_by_hod", "returned_by_provost"].includes(
          student.result.workflowStatus,
        )
      );
    },
    resetBelow() {
      this.filters.programId = "";
      this.filters.level = "";
      this.filters.programCourseId = "";
      this.courses = [];
      this.scoreSheet = null;
    },
    async loadCourses() {
      this.loading = true;
      try {
        const response = await apiService.getAcademicResultLecturerCourses({
          programId: this.filters.programId,
          level: this.filters.level,
        });
        this.courses = response.data || [];
      } catch (error) {
        this.$swal.fire(
          "Could not load courses",
          error.message || "Please try again.",
          "error",
        );
      } finally {
        this.loading = false;
      }
    },
    async loadScoreSheet() {
      this.loading = true;
      try {
        const response = await apiService.getAcademicResultScoreSheet(
          this.filters.programCourseId,
          this.selectedAttemptType,
        );
        this.scoreSheet = response.data || response;
        for (const student of this.scoreSheet.students || []) {
          if (!student.result && this.selectedAttemptType === "initial")
            student.result = { componentScores: [], specialStatus: "normal" };
        }
        this.dirty = false;
        this.studentSearch = "";
        this.currentPage = 1;
      } catch (error) {
        this.scoreSheet = null;
        this.$swal.fire(
          "Could not load score sheet",
          error.message || "Please try again.",
          "error",
        );
      } finally {
        this.loading = false;
      }
    },
    scoreFor(student, component) {
      return (
        student.result?.componentScores?.find(
          (score) =>
            Number(score.componentOrder) === Number(component.displayOrder),
        )?.rawMark ?? ""
      );
    },
    setScore(student, component, value) {
      const scores =
        student.result.componentScores || (student.result.componentScores = []);
      const existing = scores.find(
        (score) =>
          Number(score.componentOrder) === Number(component.displayOrder),
      );
      const rawMark = value === "" ? "" : Number(value);
      if (existing) {
        existing.rawMark = rawMark;
        existing.absent = false;
      } else {
        scores.push({ componentOrder: component.displayOrder, rawMark, absent: false });
      }
      this.dirty = true;
    },
    isAbsent(student, component) {
      return Boolean(
        student.result?.componentScores?.find(
          (score) => Number(score.componentOrder) === Number(component.displayOrder),
        )?.absent,
      );
    },
    setAbsent(student, component, absent) {
      const scores = student.result.componentScores || (student.result.componentScores = []);
      const existing = scores.find(
        (score) => Number(score.componentOrder) === Number(component.displayOrder),
      );
      if (existing) {
        existing.absent = absent;
        if (absent) existing.rawMark = "";
      } else {
        scores.push({ componentOrder: component.displayOrder, rawMark: "", absent });
      }
      this.dirty = true;
    },
    markDirty() {
      this.dirty = true;
    },
    focusNextMarkInput(event) {
      const inputs = [...document.querySelectorAll('[data-score-mark]:not(:disabled)')];
      const index = inputs.indexOf(event.target);
      if (index >= 0 && inputs[index + 1]) inputs[index + 1].focus();
    },
    weightedContribution(student, component) {
      if (this.isAbsent(student, component)) return 0;
      const raw = this.scoreFor(student, component);
      if (raw === "") return 0;
      return (
        (Number(raw) / Number(component.maximumMark)) *
        Number(component.weightPercent)
      );
    },
    finalPreview(student) {
      return this.components
        .reduce(
          (total, component) =>
            total + this.weightedContribution(student, component),
          0,
        )
        .toFixed(2);
    },
    componentScoreInputs(student) {
      return (student.result.componentScores || []).map((score) => ({
        componentOrder: Number(score.componentOrder),
        rawMark: score.absent ? undefined : score.rawMark,
        absent: Boolean(score.absent),
      }));
    },
    async createAttempt(student) {
      const attemptType = student.nextAttemptType;
      const confirmation = await this.$swal.fire({
        title: `Create ${attemptType} attempt?`,
        text: `${student.name} will receive one ${attemptType} score record for this course.`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: `Create ${attemptType}`,
      });
      if (!confirmation.isConfirmed) return;
      try {
        await apiService.createAcademicResultAttempt({
          studentId: student.studentId,
          programCourseId: this.filters.programCourseId,
          attemptType,
        });
        await this.loadScoreSheet();
        this.$swal.fire({ toast: true, position: "top-end", icon: "success", title: `${this.attemptLabel} attempt created`, showConfirmButton: false, timer: 1800 });
      } catch (error) {
        this.$swal.fire("Could not create attempt", error.message || "Please try again.", "error");
      }
    },
    async saveScores() {
      if (!this.scoreSheet) return;
      this.saving = true;
      try {
        await apiService.saveAcademicResultScores(
          this.filters.programCourseId,
          {
            attemptType: this.selectedAttemptType,
            scores: this.scoreSheet.students
              .filter((student) => this.isEditableResult(student))
              .map((student) => ({
                studentId: student.studentId,
                ...(student.result?._id ? { version: student.result.__v || 0 } : {}),
                specialStatus: student.result.specialStatus || "normal",
                componentScores: this.componentScoreInputs(student),
              })),
          },
        );
        await this.loadScoreSheet();
        this.$swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Scores saved",
          showConfirmButton: false,
          timer: 1800,
        });
      } catch (error) {
        this.$swal.fire(
          "Could not save scores",
          error.message || "Check the marks and try again.",
          "error",
        );
      } finally {
        this.saving = false;
      }
    },
    async submitToHod() {
      const confirmation = await this.$swal.fire({
        title: "Submit results to HOD?",
        text: "Every approved student registration in each current cohort must have a complete result.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Submit",
      });
      if (!confirmation.isConfirmed) return;
      try {
        await apiService.submitAcademicResultsToHod(
          this.filters.programCourseId,
          this.selectedAttemptType,
        );
        await this.loadScoreSheet();
        this.$swal.fire(
          "Submitted",
          "The result groups have been sent to the relevant HOD.",
          "success",
        );
      } catch (error) {
        this.$swal.fire(
          "Submission failed",
          error.message || "Please try again.",
          "error",
        );
      }
    },
  },
};
</script>

<template>
  <div>
    <div class="row g-3 mb-4">
      <div class="col-lg col-md-4">
        <label class="form-label small fw-semibold">Program Type</label
        ><select v-model="filters.programTypeId" class="form-select" :disabled="dirty">
          <option value="">Select type</option>
          <option
            v-for="type in programTypes"
            :key="type._id"
            :value="type._id"
          >
            {{ type.type }}
          </option>
        </select>
      </div>
      <div class="col-lg col-md-4">
        <label class="form-label small fw-semibold">Program Mode</label
        ><select v-model="filters.programModeId" class="form-select" :disabled="dirty">
          <option value="">Select mode</option>
          <option
            v-for="mode in programModes"
            :key="mode._id"
            :value="mode._id"
          >
            {{ mode.mode }}
          </option>
        </select>
      </div>
      <div class="col-lg col-md-4">
        <label class="form-label small fw-semibold">Program</label
        ><select
          v-model="filters.programId"
          class="form-select"
          :disabled="dirty || !filters.programTypeId || !filters.programModeId"
        >
          <option value="">Select program</option>
          <option
            v-for="program in filteredPrograms"
            :key="program._id"
            :value="program._id"
          >
            {{ program.name }}
          </option>
        </select>
      </div>
      <div class="col-lg col-md-4">
        <label class="form-label small fw-semibold">Year</label
        ><select
          v-model="filters.level"
          class="form-select"
          :disabled="dirty || !filters.programId"
        >
          <option value="">Select year</option>
          <option v-for="level in availableLevels" :key="level" :value="level">
            Year {{ level }}
          </option>
        </select>
      </div>
      <div class="col-lg col-md-8">
        <label class="form-label small fw-semibold">Course</label
        ><select
          v-model="filters.programCourseId"
          class="form-select"
          :disabled="dirty || !filters.level || loading"
        >
          <option value="">Select course</option>
          <option
            v-for="course in courses"
            :key="course._id"
            :value="course._id"
          >
            {{ course.courseId?.code }} - {{ course.courseId?.title }} (Semester
            {{ course.semester }})
          </option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="text-center py-5">
      <span class="spinner-border text-staff-primary"></span>
    </div>
    <div v-else-if="scoreSheet" class="card border-0 shadow-sm p-0">
      <div
        class="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2"
      >
        <div>
          <div class="fw-bold">
            {{ scoreSheet.programCourse.courseId?.code }} -
            {{ scoreSheet.programCourse.courseId?.title }}
          </div>
          <small class="text-muted"
            >{{ scoreSheet.students.length }} approved current
            registration(s)</small
          >
          <span v-if="dirty" class="badge text-bg-warning ms-2">Unsaved changes</span>
        </div>
        <div class="btn-group btn-group-sm" role="group" aria-label="Result attempt type">
          <button
            v-for="attempt in ['initial', 'resit', 'repeat']"
            :key="attempt"
            type="button"
            class="btn text-capitalize"
            :class="selectedAttemptType === attempt ? 'btn-staff-primary' : 'btn-outline-secondary'"
            :disabled="dirty || saving"
            @click="selectedAttemptType = attempt"
          >{{ attempt }}</button>
        </div>
        <div class="d-flex gap-2">
          <button
            v-if="dirty"
            class="btn btn-sm btn-outline-secondary"
            :disabled="saving"
            @click="loadScoreSheet"
          >Discard</button>
          <button
            class="btn btn-sm btn-outline-primary"
            :disabled="saving || !scoreSheet.students.length || !dirty"
            @click="saveScores"
          >
            <i class="bi bi-save me-1"></i>Save Draft</button
          ><button
            class="btn btn-sm btn-primary"
            :disabled="saving || !scoreSheet.students.length || dirty"
            @click="submitToHod"
          >
            Submit {{ attemptLabel }} to HOD
          </button>
        </div>
      </div>
      <div v-if="reviewFeedback.length" class="alert alert-warning rounded-0 border-start-0 border-end-0 mb-0">
        <div class="fw-semibold mb-1"><i class="bi bi-arrow-counterclockwise me-2"></i>Review corrections requested</div>
        <div v-for="feedback in reviewFeedback" :key="`${feedback.action}-${feedback.comment}`" class="small">
          {{ feedback.action === 'returned_by_hod' ? 'HOD' : 'Provost' }}: {{ feedback.comment }}
        </div>
      </div>
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 py-2 border-bottom">
        <div class="input-group input-group-sm student-search">
          <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
          <input v-model="studentSearch" class="form-control" placeholder="Search student or matric number" aria-label="Search score sheet">
        </div>
        <small class="text-muted">Showing {{ displayedStudents.length }} of {{ filteredStudents.length }} student(s)</small>
      </div>
      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th class="student-column">Student</th>
              <th v-for="component in components" :key="component.displayOrder">
                {{ component.title
                }}<small class="d-block text-muted"
                  >Max {{ component.maximumMark }} ·
                  {{ component.weightPercent }}%</small
                >
              </th>
              <th>Status</th>
              <th>Total</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in displayedStudents" :key="student.studentId">
              <td>
                <div class="fw-semibold text-capitalize">{{ student.name }}</div>
                <small class="text-muted"
                  >{{ student.matriculationNumber }} ·
                  {{
                    student.academicSession?.title ||
                    student.academicSession?.sessionYear
                  }}</small
                >
                <span
                  v-if="student.result && !isEditableResult(student)"
                  class="badge text-bg-light border d-block mt-1"
                >{{ student.result.workflowStatus }}</span>
                <button
                  v-if="student.canCreateAttempt"
                  class="btn btn-sm btn-outline-primary d-block mt-2 text-capitalize"
                  @click="createAttempt(student)"
                >Create {{ student.nextAttemptType }}</button>
              </td>
              <td v-for="component in components" :key="component.displayOrder">
                <input
                  class="form-control form-control-sm mark-input"
                  type="number"
                  min="0"
                  :max="component.maximumMark"
                  step="0.01"
                  :value="scoreFor(student, component)"
                  :disabled="!isEditableResult(student) || isAbsent(student, component)"
                  data-score-mark
                  @input="setScore(student, component, $event.target.value)"
                  @keydown.enter.prevent="focusNextMarkInput"
                />
                <div v-if="component.absenceAllowed" class="form-check mt-1">
                  <input
                    :id="`absent-${student.studentId}-${component.displayOrder}`"
                    class="form-check-input"
                    type="checkbox"
                    :checked="isAbsent(student, component)"
                    :disabled="!isEditableResult(student)"
                    @change="setAbsent(student, component, $event.target.checked)"
                  />
                  <label class="form-check-label small" :for="`absent-${student.studentId}-${component.displayOrder}`">Absent</label>
                </div>
                <small class="text-muted"
                  >{{
                    weightedContribution(student, component).toFixed(2)
                  }}
                  weighted</small
                >
              </td>
              <td>
                <template v-if="student.result">
                  <select
                    v-model="student.result.specialStatus"
                    class="form-select form-select-sm"
                    :disabled="!isEditableResult(student)"
                    @change="markDirty"
                  >
                    <option value="normal">Normal</option>
                  </select>
                  <small v-if="student.result.specialStatus !== 'normal'" class="d-block text-warning mt-1">Reset to Normal before submission</small>
                </template>
                <span v-else class="badge text-bg-light border">Attempt not created</span>
              </td>
              <td class="fw-semibold">
                {{ student.result ? (student.result.finalScore ?? finalPreview(student)) : "-" }}
              </td>
              <td>
                <span class="badge text-bg-secondary">{{
                  student.result?.gradeLetter || "-"
                }}</span>
              </td>
            </tr>
            <tr v-if="!scoreSheet.students.length">
              <td
                :colspan="components.length + 4"
                class="text-center text-muted py-5"
              >
                No active students have an approved current registration for
                this course.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="totalPages > 1" class="card-footer bg-white d-flex justify-content-between align-items-center">
        <button class="btn btn-sm btn-outline-secondary" :disabled="currentPage === 1" @click="currentPage--"><i class="bi bi-chevron-left me-1"></i>Previous</button>
        <small class="text-muted">Page {{ currentPage }} of {{ totalPages }}</small>
        <button class="btn btn-sm btn-outline-secondary" :disabled="currentPage === totalPages" @click="currentPage++">Next<i class="bi bi-chevron-right ms-1"></i></button>
      </div>
    </div>
    <div v-else class="text-center text-muted py-5">
      Select a program, year, and assigned course to load the score sheet.
    </div>
  </div>
</template>

<style scoped>
.student-column {
  min-width: 15rem;
}
.mark-input {
  min-width: 6rem;
}
.student-search {
  max-width: 22rem;
}
</style>
