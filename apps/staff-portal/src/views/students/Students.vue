<script lang="js">
import Swal from "sweetalert2";
import { useAuthStore } from "../../stores/auth.js";
import { apiService } from "../../services/api.js";
import { logger } from "@shared/utils/logger";
import {
  appendProgramAvailability,
  sortOptionsByActive,
  sortProgramsByAvailability,
} from "../../utils/programAvailability.js";

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
      shouldScrollAfterPageChange: false,
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
      return sortOptionsByActive([...unique.values()], "type");
    },
    programModes() {
      const unique = new Map();
      this.options.programs.forEach((program) => {
        const mode = program.programModeId;
        if (mode?._id) unique.set(mode._id, mode);
      });
      return sortOptionsByActive([...unique.values()], "mode");
    },
    hasFilters() {
      return Object.values(this.filters).some(Boolean);
    },
    paginationItems() {
      const total = Math.max(1, this.totalPages);
      const visiblePages = new Set([1, 2, total - 1, total]);

      for (let page = this.currentPage - 1; page <= this.currentPage + 1; page += 1) {
        if (page >= 1 && page <= total) visiblePages.add(page);
      }

      const pages = [...visiblePages]
        .filter((page) => page >= 1 && page <= total)
        .sort((left, right) => left - right);
      const items = [];

      pages.forEach((page, index) => {
        const previousPage = pages[index - 1];
        if (previousPage && page - previousPage > 1) {
          items.push({
            type: "ellipsis",
            key: `ellipsis-${previousPage}-${page}`,
          });
        }
        items.push({ type: "page", key: `page-${page}`, page });
      });

      return items;
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
    async currentPage() {
      if (this.isInitializing) return;
      await this.loadStudents();

      if (this.shouldScrollAfterPageChange) {
        await this.$nextTick();
        this.$refs.studentsTable?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        this.shouldScrollAfterPageChange = false;
      }
    },
  },
  async mounted() {
    await this.authStore.initialize();
    const response = await apiService.getStaffStudentFilterOptions();
    this.options = response.data || this.options;
    this.options.programs = sortProgramsByAvailability(this.options.programs);
    this.isInitializing = false;
    await Promise.all([this.loadStudents(), this.loadStats()]);
  },
  methods: {
    goToPage(page) {
      const targetPage = Number(page);
      if (
        !Number.isInteger(targetPage) ||
        targetPage < 1 ||
        targetPage > this.totalPages ||
        targetPage === this.currentPage
      ) {
        return;
      }

      this.shouldScrollAfterPageChange = true;
      this.currentPage = targetPage;
    },

    programTypeLabel(type) {
      return `${type.type}${type.active === false ? " (Inactive)" : ""}`;
    },
    programModeLabel(mode) {
      return `${mode.mode}${mode.active === false ? " (Inactive)" : ""}`;
    },
    programLabel(program) {
      return appendProgramAvailability(program.name, program);
    },
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

    <section
      ref="studentsTable"
      class="card border-0 shadow-sm p-0 students-table-anchor"
    >
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
                {{ programTypeLabel(type) }}
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
                {{ programModeLabel(mode) }}
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
                {{ programLabel(program) }}
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
        v-if="totalItems > 0"
        class="card-body d-flex flex-wrap justify-content-between align-items-center gap-3 border-top"
      >
        <small class="text-muted">
          Page {{ currentPage }} of {{ totalPages }}
        </small>
        <nav
          v-if="totalPages > 1"
          class="management-pagination-scroll"
          aria-label="Students pagination"
        >
          <ul class="pagination pagination-sm mb-0 justify-content-center flex-nowrap">
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <button
                type="button"
                class="page-link"
                :disabled="currentPage === 1"
                aria-label="Go to first page"
                title="First page"
                @click="goToPage(1)"
              >
                <span aria-hidden="true">&laquo;</span>
              </button>
            </li>
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <button
                type="button"
                class="page-link"
                :disabled="currentPage === 1"
                aria-label="Go to previous page"
                @click="goToPage(currentPage - 1)"
              >
                Prev
              </button>
            </li>
            <template v-for="item in paginationItems" :key="item.key">
              <li
                v-if="item.type === 'page'"
                class="page-item"
                :class="{ active: currentPage === item.page }"
                :aria-current="currentPage === item.page ? 'page' : undefined"
              >
                <button
                  type="button"
                  class="page-link"
                  :aria-label="`Go to page ${item.page}`"
                  @click="goToPage(item.page)"
                >
                  {{ item.page }}
                </button>
              </li>
              <li
                v-else
                class="page-item disabled pagination-ellipsis"
                aria-hidden="true"
              >
                <span class="page-link">&hellip;</span>
              </li>
            </template>
            <li
              class="page-item"
              :class="{ disabled: currentPage >= totalPages }"
            >
              <button
                type="button"
                class="page-link"
                :disabled="currentPage >= totalPages"
                aria-label="Go to next page"
                @click="goToPage(currentPage + 1)"
              >
                Next
              </button>
            </li>
            <li
              class="page-item"
              :class="{ disabled: currentPage >= totalPages }"
            >
              <button
                type="button"
                class="page-link"
                :disabled="currentPage >= totalPages"
                aria-label="Go to last page"
                title="Last page"
                @click="goToPage(totalPages)"
              >
                <span aria-hidden="true">&raquo;</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </section>
  </main>
</template>

<style scoped>
.students-table-anchor {
  scroll-margin-top: 1rem;
}

.management-pagination-scroll {
  max-width: 100%;
  overflow-x: auto;
  padding: 0.15rem 0;
  scrollbar-width: thin;
}

.pagination .page-link {
  min-width: 2.25rem;
  min-height: 2.1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--staff-primary);
  border-color: var(--staff-light);
  white-space: nowrap;
}

.pagination .page-item.active .page-link {
  color: #fff;
  background-color: var(--staff-primary);
  border-color: var(--staff-primary);
}

.pagination-ellipsis .page-link {
  min-width: 2rem;
  color: #6c757d;
  background: transparent;
  cursor: default;
}
</style>
