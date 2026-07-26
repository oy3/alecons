<script lang="js">
import Swal from "sweetalert2";
import { useAuthStore } from "../../stores/auth.js";
import { apiService } from "../../services/api.js";
import { logger } from "@shared/utils/logger";

const defaultFilters = () => ({
  search: "",
  programId: "",
  programTypeId: "",
  programModeId: "",
  level: "",
  status: "",
  portalAccess: "",
});

export default {
  name: "Students",
  setup() {
    return { authStore: useAuthStore() };
  },
  data() {
    return {
      isLoading: true,
      filters: defaultFilters(),
      students: [],
      stats: {
        totalEnrolled: 0,
        activeStudents: 0,
        suspendedStudents: 0,
        portalAccessDisabled: 0,
      },
      options: { programs: [], statuses: [] },
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      perPage: 10,
      searchTimeout: null,
      isInitializing: true,
    };
  },
  computed: {
    filteredPrograms() {
      return this.options.programs.filter((program) => {
        const typeId = program.programTypeId?._id || program.programTypeId;
        const modeId = program.programModeId?._id || program.programModeId;
        return (
          (!this.filters.programTypeId ||
            typeId === this.filters.programTypeId) &&
          (!this.filters.programModeId || modeId === this.filters.programModeId)
        );
      });
    },
    selectedProgram() {
      return (
        this.options.programs.find(
          (program) => program._id === this.filters.programId,
        ) || null
      );
    },
    availableLevels() {
      const durationYears = Number(this.selectedProgram?.durationYears || 0);
      return Array.from({ length: durationYears }, (_, index) => index + 1);
    },
    programTypes() {
      const unique = new Map();
      this.options.programs.forEach((program) => {
        const type = program.programTypeId;
        if (type?._id) unique.set(type._id, type);
      });
      return [...unique.values()].sort((a, b) => a.type.localeCompare(b.type));
    },
    programModes() {
      const unique = new Map();
      this.options.programs.forEach((program) => {
        const mode = program.programModeId;
        if (mode?._id) unique.set(mode._id, mode);
      });
      return [...unique.values()].sort((a, b) => a.mode.localeCompare(b.mode));
    },
    hasFilters() {
      return Object.values(this.filters).some(Boolean);
    },
  },
  watch: {
    "filters.search"() {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => this.resetAndLoad(), 350);
    },
    "filters.programTypeId"() {
      this.filters.programId = "";
      this.filters.level = "";
      this.resetAndLoad();
    },
    "filters.programModeId"() {
      this.filters.programId = "";
      this.filters.level = "";
      this.resetAndLoad();
    },
    "filters.programId"() {
      this.filters.level = "";
      this.resetAndLoad();
    },
    "filters.level"() {
      this.resetAndLoad();
    },
    "filters.status"() {
      this.resetAndLoad();
    },
    "filters.portalAccess"() {
      this.resetAndLoad();
    },
    currentPage() {
      if (!this.isInitializing) this.loadStudents();
    },
  },
  async mounted() {
    await this.authStore.initialize();
    const response = await apiService.getStaffStudentFilterOptions();
    this.options = response.data || this.options;
    this.isInitializing = false;
    await Promise.all([this.loadStudents(), this.loadStats()]);
  },
  methods: {
    buildParams() {
      return { ...this.filters, page: this.currentPage, limit: this.perPage };
    },
    async resetAndLoad() {
      if (this.isInitializing) return;
      const wasFirstPage = this.currentPage === 1;
      this.currentPage = 1;
      await this.loadStats();
      if (wasFirstPage) await this.loadStudents();
    },
    async loadStudents() {
      try {
        this.isLoading = true;
        const response = await apiService.getStaffStudents(this.buildParams());
        if (!response.success)
          throw new Error(response.message || "Could not load students");
        const data = response.data || {};
        this.students = data.students || [];
        this.totalItems = data.pagination?.totalItems || 0;
        this.totalPages = data.pagination?.totalPages || 1;
      } catch (error) {
        logger.error("Failed to load students", error);
        await Swal.fire({
          icon: "error",
          title: "Load Failed",
          text: error.message || "Could not load students.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.isLoading = false;
      }
    },
    async loadStats() {
      try {
        const { page, limit, search, ...params } = this.buildParams();
        const response = await apiService.getStaffStudentStats(params);
        if (response.success) this.stats = { ...this.stats, ...response.data };
      } catch (error) {
        logger.error("Failed to load student stats", error);
      }
    },
    resetFilters() {
      this.filters = defaultFilters();
    },
    studentName(student) {
      const user = student.userId || {};
      return (
        [user.firstName, user.otherName, user.lastName]
          .filter(Boolean)
          .join(" ") || "Unnamed student"
      );
    },
    sessionLabel(session) {
      return session?.title || session?.sessionYear || "Not assigned";
    },
    statusClass(status) {
      return (
        {
          active: "bg-success-subtle text-success-emphasis",
          suspended: "bg-warning-subtle text-warning-emphasis",
          graduated: "bg-primary-subtle text-primary-emphasis",
          withdrawn: "bg-danger-subtle text-danger-emphasis",
        }[status] || "bg-secondary-subtle text-secondary-emphasis"
      );
    },
    goToStudent(student) {
      this.$router.push({ name: "StudentDetail", params: { id: student._id } });
    },
  },
};
</script>

<template>
  <main class="container-fluid py-4 px-lg-4">
    <div
      class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4"
    >
      <div>
        <h2 class="fw-bold text-staff-primary mb-1">Students Management</h2>
        <p class="text-muted mb-0">
          Manage enrolled student records, programme placement, and portal
          access.
        </p>
      </div>
      <div class="text-muted small">
        <i class="bi bi-database me-1"></i>{{ totalItems }} record{{
          totalItems === 1 ? "" : "s"
        }}
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-sm-6 col-xl-3">
        <button
          type="button"
          class="card border-0 shadow-sm h-100 w-100 text-start p-0"
          @click="filters.status = ''"
        >
          <div class="card-body">
            <div class="text-muted small">Enrolled Students</div>
            <div class="h3 mb-0 text-primary">{{ stats.totalEnrolled }}</div>
          </div>
        </button>
      </div>
      <div class="col-sm-6 col-xl-3">
        <button
          type="button"
          class="card border-0 shadow-sm h-100 w-100 text-start p-0"
          @click="filters.status = 'active'"
        >
          <div class="card-body">
            <div class="text-muted small">Active Students</div>
            <div class="h3 mb-0 text-success">{{ stats.activeStudents }}</div>
          </div>
        </button>
      </div>
      <div class="col-sm-6 col-xl-3">
        <button
          type="button"
          class="card border-0 shadow-sm h-100 w-100 text-start p-0"
          @click="filters.status = 'suspended'"
        >
          <div class="card-body">
            <div class="text-muted small">Suspended Students</div>
            <div class="h3 mb-0 text-warning">
              {{ stats.suspendedStudents }}
            </div>
          </div>
        </button>
      </div>
      <div class="col-sm-6 col-xl-3">
        <button
          type="button"
          class="card border-0 shadow-sm h-100 w-100 text-start p-0"
          @click="filters.portalAccess = 'disabled'"
        >
          <div class="card-body">
            <div class="text-muted small">Portal Access Disabled</div>
            <div class="h3 mb-0 text-danger">
              {{ stats.portalAccessDisabled }}
            </div>
          </div>
        </button>
      </div>
    </div>

    <section class="card border-0 shadow-sm p-0">
      <div class="card-body border-bottom">
        <div class="row g-3 align-items-end">
          <div class="col-lg-11">
            <label class="form-label small"> Search </label>
            <input
              v-model="filters.search"
              class="form-control"
              placeholder="Name, email, phone or matric no."
            />
          </div>
          <div class="col-lg-auto d-flex gap-2">
            <button
              class="btn btn-dark flex-grow-1"
              :disabled="!hasFilters"
              @click="resetFilters"
            >
              <i class="bi bi-x-circle"></i>
            </button>
          </div>
          <div class="col-lg-2">
            <label class="form-label small">Program Type</label
            ><select v-model="filters.programTypeId" class="form-select">
              <option value="">All types</option>
              <option
                v-for="type in programTypes"
                :key="type._id"
                :value="type._id"
              >
                {{ type.type }}
              </option>
            </select>
          </div>
          <div class="col-lg-2">
            <label class="form-label small">Program Mode</label
            ><select v-model="filters.programModeId" class="form-select">
              <option value="">All modes</option>
              <option
                v-for="mode in programModes"
                :key="mode._id"
                :value="mode._id"
              >
                {{ mode.mode }}
              </option>
            </select>
          </div>
          <div class="col-lg-2">
            <label class="form-label small">Program</label
            ><select
              v-model="filters.programId"
              class="form-select"
              :disabled="!filters.programTypeId || !filters.programModeId"
            >
              <option value="">
                {{
                  filters.programTypeId && filters.programModeId
                    ? "All matching programs"
                    : "Select type and mode first"
                }}
              </option>
              <option
                v-for="program in filteredPrograms"
                :key="program._id"
                :value="program._id"
              >
                {{ program.name }}
              </option>
            </select>
          </div>
          <div class="col-lg-2">
            <label class="form-label small">Year</label
            ><select
              v-model="filters.level"
              class="form-select"
              :disabled="!filters.programId"
            >
              <option value="">
                {{ filters.programId ? "All year" : "Select a program first" }}
              </option>
              <option
                v-for="level in availableLevels"
                :key="level"
                :value="level"
              >
                Year {{ level }}
              </option>
            </select>
          </div>
          <div class="col-lg-2">
            <label class="form-label small">Student Status</label
            ><select v-model="filters.status" class="form-select">
              <option value="">All statuses</option>
              <option
                v-for="status in options.statuses"
                :key="status"
                :value="status"
              >
                {{ status }}
              </option>
            </select>
          </div>
          <div class="col-lg-2">
            <label class="form-label small">Portal Access</label
            ><select v-model="filters.portalAccess" class="form-select">
              <option value="">All access</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Student</th>
              <th>Matriculation No.</th>
              <th>Program</th>
              <th>Level</th>
              <th>Current Session</th>
              <th>Status</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="7" class="text-center py-5 text-muted">
                <span class="spinner-border spinner-border-sm me-2"></span>
                Loading students...
              </td>
            </tr>
            <tr v-else-if="!students.length">
              <td colspan="7" class="text-center py-5 text-muted">
                No students match the selected filters.
              </td>
            </tr>
            <tr v-for="student in students" :key="student._id">
              <td>
                <div class="d-flex align-items-center gap-2">
                  <img
                    :src="
                      student.profileImageUrl ||
                      student.userId?.profileImageUrl ||
                      'https://placehold.co/40x40?text=IMG'
                    "
                    class="rounded-circle object-fit-cover"
                    width="40"
                    height="40"
                    alt=""
                  />
                  <div>
                    <div class="fw-semibold text-capitalize">
                      {{ studentName(student) }}
                    </div>
                    <div class="small text-muted">
                      {{ student.userId?.email }}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <code>{{ student.matriculationNumber }}</code>
              </td>
              <td>
                <div class="small text-muted">
                  {{ student.programId?.programTypeId?.type }}
                  {{ student.programId?.programModeId?.mode }}
                </div>
                <div>{{ student.programId?.name || "Not assigned" }}</div>
              </td>
              <td class="small">
                Year {{ student.currentLevel }} · Semester
                {{ student.currentSemester }}
              </td>
              <td class="small">
                <div>{{ sessionLabel(student.academicSession) }}</div>
                <div class="small text-muted">
                  Entry: {{ sessionLabel(student.entryAcademicSession) }}
                </div>
              </td>
              <td>
                <span
                  class="badge rounded-pill"
                  :class="statusClass(student.status)"
                  >{{ student.status }}</span
                >
                <div
                  class="small mt-1"
                  :class="student.isActive ? 'text-success' : 'text-danger'"
                >
                  Portal {{ student.isActive ? "enabled" : "disabled" }}
                </div>
              </td>
              <td class="text-end">
                <button
                  class="btn btn-sm btn-outline-primary"
                  title="View student record"
                  @click="goToStudent(student)"
                >
                  <i class="bi bi-eye"></i
                  ><span class="visually-hidden">View student record</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        class="card-body d-flex flex-wrap justify-content-between align-items-center gap-2 border-top"
      >
        <small class="text-muted">
          Page {{ currentPage }} of {{ totalPages }}
        </small>
        <div class="btn-group">
          <button
            class="btn btn-outline-secondary btn-sm"
            :disabled="currentPage <= 1"
            @click="currentPage--"
          >
            Previous</button
          ><button
            class="btn btn-outline-secondary btn-sm"
            :disabled="currentPage >= totalPages"
            @click="currentPage++"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  </main>
</template>
