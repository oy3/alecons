<script>
import { apiService } from "../../../services/api.js";
import { logger } from "@shared/utils/logger";
import QuestionFormModal from "./QuestionFormModal.vue";
import QuestionViewModal from "./QuestionViewModal.vue";
import RichContentDisplay from "../../../components/RichContentDisplay.vue";

export default {
  name: "QuestionBankLibrary",
  components: { QuestionFormModal, QuestionViewModal, RichContentDisplay },
  data() {
    return {
      items: [],
      summary: {},
      facets: { subjects: [], topics: [], creators: [] },
      loading: false,
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
      filters: {
        search: "",
        type: "all",
        subject: "all",
        topic: "all",
        status: "all",
        difficulty: "all",
        used: "all",
        createdBy: "",
      },
      selectedIds: [],
      showQuestionForm: false,
      showQuestionView: false,
      selectedQuestion: null,
      importFile: null,
      importFormat: "excel",
      importing: false,
    };
  },
  computed: {
    pageIds() {
      return this.items.map((item) => item._id);
    },
    allPageSelected() {
      return (
        this.pageIds.length > 0 &&
        this.pageIds.every((id) => this.selectedIds.includes(id))
      );
    },
    somePageSelected() {
      return (
        this.pageIds.some((id) => this.selectedIds.includes(id)) &&
        !this.allPageSelected
      );
    },
    showingStart() {
      return this.total ? (this.page - 1) * this.limit + 1 : 0;
    },
    showingEnd() {
      return Math.min(this.page * this.limit, this.total);
    },
    visiblePages() {
      const start = Math.max(1, this.page - 2);
      const end = Math.min(this.totalPages, start + 4);
      return Array.from(
        { length: Math.max(0, end - start + 1) },
        (_, index) => start + index,
      );
    },
    maxTypeCount() {
      return Math.max(
        1,
        ...(this.summary.types || []).map((item) => item.count),
      );
    },
  },
  async mounted() {
    await Promise.all([
      this.loadItems(),
      this.loadSummary(),
      this.loadFacets(),
    ]);
  },
  methods: {
    async loadItems() {
      this.loading = true;
      try {
        const response = await apiService.getQuestionBank({
          ...this.filters,
          page: this.page,
          limit: this.limit,
        });
        const data = response.data || {};
        this.items = data.items || [];
        this.total = data.total || 0;
        this.totalPages = data.totalPages || 1;
      } catch (error) {
        logger.error("Could not load question bank", error);
        this.$swal.fire(
          "Error",
          error.message || "Could not load the question bank.",
          "error",
        );
      } finally {
        this.loading = false;
      }
    },
    async loadSummary() {
      try {
        this.summary = (await apiService.getQuestionBankSummary()).data || {};
      } catch (error) {
        logger.warn("Could not load question bank summary", error);
      }
    },
    async loadFacets() {
      try {
        this.facets =
          (await apiService.getQuestionBankFacets()).data || this.facets;
      } catch (error) {
        logger.warn("Could not load question bank filters", error);
      }
    },
    applyFilters() {
      this.page = 1;
      this.loadItems();
    },
    resetFilters() {
      this.filters = {
        search: "",
        type: "all",
        subject: "all",
        topic: "all",
        status: "all",
        difficulty: "all",
        used: "all",
        createdBy: "",
      };
      this.applyFilters();
    },
    changePage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.page = page;
        this.loadItems();
      }
    },
    changeLimit() {
      this.page = 1;
      this.loadItems();
    },
    togglePageSelection(event) {
      if (event.target.checked)
        this.selectedIds = [...new Set([...this.selectedIds, ...this.pageIds])];
      else
        this.selectedIds = this.selectedIds.filter(
          (id) => !this.pageIds.includes(id),
        );
    },
    toggleItem(id) {
      this.selectedIds = this.selectedIds.includes(id)
        ? this.selectedIds.filter((value) => value !== id)
        : [...this.selectedIds, id];
    },
    createQuestion() {
      this.selectedQuestion = null;
      this.showQuestionForm = true;
    },
    editQuestion(item) {
      this.selectedQuestion = { ...item, mark: item.defaultMark };
      this.showQuestionForm = true;
    },
    viewQuestion(item) {
      this.selectedQuestion = { ...item, mark: item.defaultMark };
      this.showQuestionView = true;
    },
    async saveQuestion(payload) {
      try {
        const data = { ...payload, defaultMark: payload.mark };
        if (this.selectedQuestion?._id)
          await apiService.updateQuestionBankItem(
            this.selectedQuestion._id,
            data,
          );
        else await apiService.createQuestionBankItem(data);
        this.showQuestionForm = false;
        this.selectedQuestion = null;
        await Promise.all([
          this.loadItems(),
          this.loadSummary(),
          this.loadFacets(),
        ]);
        this.$swal.fire({
          icon: "success",
          title: "Question saved",
          timer: 1400,
          showConfirmButton: false,
        });
      } catch (error) {
        this.$swal.fire("Could not save question", error.message, "error");
      }
    },
    async setStatus(ids, status) {
      const action = status === "archived" ? "archive" : "restore";
      const confirmation = await this.$swal.fire({
        icon: "warning",
        title: `${action[0].toUpperCase()}${action.slice(1)} ${ids.length} question${ids.length === 1 ? "" : "s"}?`,
        text:
          status === "archived"
            ? "Archived questions remain in previous exams but cannot be newly reused."
            : "",
        showCancelButton: true,
        confirmButtonText: action[0].toUpperCase() + action.slice(1),
        confirmButtonColor: "#1a5f5f",
      });
      if (!confirmation.isConfirmed) return;
      try {
        await apiService.setQuestionBankStatus(ids, status);
        this.selectedIds = [];
        await Promise.all([this.loadItems(), this.loadSummary()]);
      } catch (error) {
        this.$swal.fire("Action failed", error.message, "error");
      }
    },
    async showUsage(item) {
      try {
        const rows =
          (await apiService.getQuestionBankUsage(item._id)).data || [];
        const html = rows.length
          ? rows
              .map(
                (row) =>
                  `<div class="border-bottom py-2"><strong>${this.escapeHtml(row.examId?.title || "Exam")}</strong><br><small>${this.escapeHtml(row.examId?.academicSession?.sessionYear || "")} · ${row.mark} mark(s) · version ${row.bankVersion || 1}</small></div>`,
              )
              .join("")
          : '<p class="text-muted mb-0">This question has not been used in an exam.</p>';
        await this.$swal.fire({
          title: "Question usage",
          html: `<div class="text-start">${html}</div>`,
          confirmButtonColor: "#1a5f5f",
        });
      } catch (error) {
        this.$swal.fire("Could not load usage", error.message, "error");
      }
    },
    async importQuestions(event) {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const extension = file.name.split(".").pop()?.toLowerCase();
      const formats = {
        xlsx: "excel",
        xls: "excel",
        csv: "csv",
        pdf: "pdf",
        docx: "docx",
      };
      this.importFormat = formats[extension];
      if (!this.importFormat)
        return this.$swal.fire(
          "Unsupported file",
          "Use Excel, CSV, PDF, or Word format.",
          "error",
        );
      this.importing = true;
      try {
        const preview = (
          await apiService.bulkImportPreview(file, this.importFormat)
        ).preview;
        const valid = (preview?.questions || []).filter(
          (question) => question.isValid,
        );
        if (!valid.length)
          throw new Error("No valid questions were found in this file.");
        const confirm = await this.$swal.fire({
          icon: "question",
          title: "Import questions?",
          text: `${valid.length} valid question${valid.length === 1 ? "" : "s"} will be added. Exact duplicates will be skipped.`,
          showCancelButton: true,
          confirmButtonText: `Import ${valid.length}`,
          confirmButtonColor: "#1a5f5f",
        });
        if (!confirm.isConfirmed) return;
        const result = (await apiService.bulkCreateQuestionBankItems(valid))
          .data;
        await Promise.all([
          this.loadItems(),
          this.loadSummary(),
          this.loadFacets(),
        ]);
        this.$swal.fire(
          "Import complete",
          `${result.created} added, ${result.duplicates} duplicates skipped, ${result.errors.length} invalid.`,
          "success",
        );
      } catch (error) {
        this.$swal.fire("Import failed", error.message, "error");
      } finally {
        this.importing = false;
      }
    },
    formatType(type) {
      return (
        { mcq: "Multiple Choice", multi: "Multi-Select", essay: "Essay" }[
          type
        ] || type
      );
    },
    typeClass(type) {
      return (
        {
          mcq: "text-bg-primary",
          multi: "text-bg-info",
          essay: "text-bg-warning",
        }[type] || "text-bg-secondary"
      );
    },
    difficultyClass(value) {
      return (
        {
          easy: "text-bg-success",
          medium: "text-bg-warning",
          hard: "text-bg-danger",
        }[value] || "text-bg-secondary"
      );
    },
    activityLabel(action, count = 1) {
      return (
        {
          created: "New question added",
          imported: `Imported ${count} questions`,
          updated: "Question updated",
          archived: "Question archived",
          restored: "Question restored",
          reused: `Reused ${count} questions`,
          duplicates_merged: "Duplicate questions merged",
          migrated: "Questions migrated",
        }[action] || action
      );
    },
    relativeTime(date) {
      if (!date) return "";
      const seconds = Math.max(
        1,
        Math.floor((Date.now() - new Date(date).getTime()) / 1000),
      );
      if (seconds < 60) return `${seconds}s ago`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    },
    formatDate(date) {
      return date
        ? new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }).format(new Date(date))
        : "—";
    },
    actorName(actor) {
      return actor
        ? [actor.firstName, actor.lastName].filter(Boolean).join(" ")
        : "System";
    },
    escapeHtml(value) {
      const div = document.createElement("div");
      div.textContent = String(value);
      return div.innerHTML;
    },
  },
};
</script>

<template>
  <section class="question-bank-library">
    <div class="staff-card overflow-hidden">
      <div
        class="d-flex flex-wrap align-items-center justify-content-between gap-3 p-3 border-bottom"
      >
        <div class="d-flex align-items-center gap-3">
          <span class="section-icon"><i class="bi bi-bank"></i></span>
          <div>
            <h2 class="h5 mb-1">Question Bank</h2>
            <p class="text-muted mb-0">
              Build a reusable collection of questions for all exams.
            </p>
          </div>
        </div>
        <div class="d-flex gap-2">
          <label
            class="btn btn-outline-staff-primary mb-0"
            :class="{ disabled: importing }"
          >
            <span
              v-if="importing"
              class="spinner-border spinner-border-sm me-1"
            ></span
            ><i v-else class="bi bi-upload me-1"></i>
            {{ importing ? "Importing..." : "Import Questions" }}
            <input
              class="visually-hidden"
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,.docx"
              :disabled="importing"
              @change="importQuestions"
            />
          </label>
          <button class="btn btn-staff-primary" @click="createQuestion">
            <i class="bi bi-plus-circle me-1"></i>Add Question
          </button>
        </div>
      </div>

      <div class="row g-2 p-3 summary-grid">
        <div class="col-6 col-lg">
          <div class="metric">
            <span
              class="metric-icon text-success bg-success-subtle d-flex align-items-center justify-content-center"
            >
              <i class="bi bi-file-earmark-text h3 mb-0"></i>
            </span>
            <div>
              <small>Total Questions</small
              ><strong>{{ summary.total || 0 }}</strong
              ><span>Across all subjects</span>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg">
          <div class="metric">
            <span
              class="metric-icon text-primary bg-primary-subtle d-flex align-items-center justify-content-center"
              ><i class="bi bi-check2-circle h3 mb-0"></i
            ></span>
            <div>
              <small>Active Questions</small
              ><strong>{{ summary.active || 0 }}</strong
              ><span>{{ summary.activePercentage || 0 }}% of total</span>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg">
          <div class="metric">
            <span
              class="metric-icon text-warning bg-warning-subtle d-flex align-items-center justify-content-center"
              ><i class="bi bi-journal-text h3 mb-0"></i
            ></span>
            <div>
              <small>Subjects</small
              ><strong>{{ summary.subjectCount || 0 }}</strong
              ><span>In question bank</span>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg">
          <div class="metric">
            <span
              class="metric-icon text-info bg-info-subtle d-flex align-items-center justify-content-center"
              ><i class="bi bi-bar-chart h3 mb-0"></i
            ></span>
            <div>
              <small>Top Subject</small
              ><strong class="metric-word">{{
                summary.topSubject?._id || "—"
              }}</strong
              ><span>{{ summary.topSubject?.count || 0 }} questions</span>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg">
          <div class="metric">
            <span
              class="metric-icon text-danger bg-danger-subtle d-flex align-items-center justify-content-center"
              ><i class="bi bi-clock h3 mb-0"></i
            ></span>
            <div>
              <small>Last Added</small
              ><strong class="metric-word">{{
                formatDate(summary.lastAdded?.createdAt)
              }}</strong
              ><span>By {{ actorName(summary.lastAdded?.createdBy) }}</span>
            </div>
          </div>
        </div>
      </div>

      <form
        class="filter-band border-top border-bottom p-3"
        @submit.prevent="applyFilters"
      >
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <label class="visually-hidden" for="bankSearch"
            >Search questions</label
          >
          <div class="input-group bank-search">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input
              id="bankSearch"
              v-model="filters.search"
              class="form-control"
              placeholder="Search questions..."
            />
          </div>

          <div class="dropdown ms-auto">
            <button
              type="button"
              class="btn btn-outline-secondary dropdown-toggle"
              data-bs-toggle="dropdown"
              data-bs-auto-close="outside"
              aria-expanded="false"
            >
              <i class="bi bi-funnel me-1"></i>Filters
            </button>
            <div
              class="dropdown-menu dropdown-menu-end filter-menu p-3 shadow-sm"
            >
              <div
                class="d-flex justify-content-between align-items-center mb-3"
              >
                <h3 class="dropdown-header p-0 fw-bold small">
                  Filter Questions
                </h3>
                <button
                  type="button"
                  class="btn btn-link btn-sm text-decoration-none"
                  @click="resetFilters"
                >
                  Reset
                </button>
              </div>
              <div class="mb-3">
                <label class="form-label small text-muted mb-1"
                  >Question type</label
                ><select
                  v-model="filters.type"
                  class="form-select form-select-sm"
                >
                  <option value="all">All Types</option>
                  <option value="mcq">Multiple Choice</option>
                  <option value="multi">Multi-Select</option>
                  <option value="essay">Essay</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label small text-muted mb-1">Subject</label
                ><select
                  v-model="filters.subject"
                  class="form-select form-select-sm"
                >
                  <option value="all">All Subjects</option>
                  <option
                    v-for="subject in facets.subjects"
                    :key="subject"
                    :value="subject"
                  >
                    {{ subject }}
                  </option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label small text-muted mb-1">Topic</label
                ><select
                  v-model="filters.topic"
                  class="form-select form-select-sm"
                >
                  <option value="all">All Topics</option>
                  <option
                    v-for="topic in facets.topics"
                    :key="topic"
                    :value="topic"
                  >
                    {{ topic }}
                  </option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label small text-muted mb-1">Status</label
                ><select
                  v-model="filters.status"
                  class="form-select form-select-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label small text-muted mb-1"
                  >Difficulty</label
                ><select
                  v-model="filters.difficulty"
                  class="form-select form-select-sm"
                >
                  <option value="all">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label small text-muted mb-1">Usage</label
                ><select
                  v-model="filters.used"
                  class="form-select form-select-sm"
                >
                  <option value="all">Used and Unused</option>
                  <option value="yes">Previously Used</option>
                  <option value="no">Never Used</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label small text-muted mb-1"
                  >Created by</label
                ><select
                  v-model="filters.createdBy"
                  class="form-select form-select-sm"
                >
                  <option value="">All Creators</option>
                  <option
                    v-for="creator in facets.creators"
                    :key="creator._id"
                    :value="creator._id"
                  >
                    {{ creator.name }}
                  </option>
                </select>
              </div>
              <button type="submit" class="btn btn-staff-primary w-100">
                <i class="bi bi-check2 me-1"></i>Apply Filters
              </button>
            </div>
          </div>
          <button type="submit" class="btn btn-staff-primary">
            <i class="bi bi-search me-1"></i>Search
          </button>
        </div>
      </form>

      <div
        v-if="selectedIds.length"
        class="selection-toolbar d-flex flex-wrap align-items-center justify-content-between gap-2 mx-3 mt-3 p-2"
      >
        <strong>{{ selectedIds.length }} selected</strong>
        <div class="d-flex gap-2">
          <button
            class="btn btn-sm btn-outline-secondary"
            @click="selectedIds = []"
          >
            Clear</button
          ><button
            class="btn btn-sm btn-outline-success"
            @click="setStatus(selectedIds, 'active')"
          >
            <i class="bi bi-arrow-counterclockwise me-1"></i>Restore</button
          ><button
            class="btn btn-sm btn-outline-danger"
            @click="setStatus(selectedIds, 'archived')"
          >
            <i class="bi bi-archive me-1"></i>Archive
          </button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>
                <input
                  class="form-check-input"
                  type="checkbox"
                  :checked="allPageSelected"
                  :indeterminate.prop="somePageSelected"
                  aria-label="Select page"
                  @change="togglePageSelection"
                />
              </th>
              <th>#</th>
              <th>Question</th>
              <th>Type</th>
              <th>Subject</th>
              <th>Topic</th>
              <th>Difficulty</th>
              <th>Default Mark</th>
              <th>Usage</th>
              <th>Status</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="11" class="text-center py-5">
                <span class="spinner-border text-staff-primary"></span>
                <p class="text-muted mt-2 mb-0">Loading questions...</p>
              </td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="11" class="text-center py-5">
                <i class="bi bi-question-circle fs-1 text-muted"></i>
                <h3 class="h6 mt-2">No questions found</h3>
                <p class="text-muted mb-0">
                  Adjust the filters or add the first reusable question.
                </p>
              </td>
            </tr>
            <tr v-for="(item, index) in items" v-else :key="item._id">
              <td>
                <input
                  class="form-check-input"
                  type="checkbox"
                  :checked="selectedIds.includes(item._id)"
                  :aria-label="`Select question ${index + 1}`"
                  @change="toggleItem(item._id)"
                />
              </td>
              <td>{{ showingStart + index }}</td>
              <td class="question-cell">
                <RichContentDisplay :content="item.questionText" />
              </td>
              <td>
                <span
                  class="badge rounded-pill"
                  :class="typeClass(item.type)"
                  >{{ formatType(item.type) }}</span
                >
              </td>
              <td>{{ item.metadata?.subject || "—" }}</td>
              <td>{{ item.metadata?.topic || "—" }}</td>
              <td>
                <span
                  class="badge rounded-pill"
                  :class="difficultyClass(item.metadata?.difficulty)"
                  >{{ item.metadata?.difficulty || "—" }}</span
                >
              </td>
              <td>{{ item.defaultMark }}</td>
              <td>{{ item.usageCount || 0 }}</td>
              <td>
                <span
                  class="badge rounded-pill"
                  :class="
                    item.status === 'active'
                      ? 'text-bg-success'
                      : 'text-bg-secondary'
                  "
                  >{{ item.status }}</span
                >
              </td>
              <td class="text-end text-nowrap">
                <button
                  class="btn btn-sm btn-outline-staff-primary me-1"
                  title="View question"
                  @click="viewQuestion(item)"
                >
                  <i class="bi bi-eye"></i>
                </button>
                <div class="dropdown d-inline-block">
                  <button
                    class="btn btn-sm btn-outline-secondary"
                    data-bs-toggle="dropdown"
                    title="Question actions"
                  >
                    <i class="bi bi-three-dots"></i>
                  </button>
                  <ul class="dropdown-menu dropdown-menu-end">
                    <li>
                      <button class="dropdown-item" @click="editQuestion(item)">
                        <i class="bi bi-pencil me-2"></i>Edit
                      </button>
                    </li>
                    <li>
                      <button class="dropdown-item" @click="showUsage(item)">
                        <i class="bi bi-bar-chart me-2"></i>View usage
                      </button>
                    </li>
                    <li><hr class="dropdown-divider" /></li>
                    <li>
                      <button
                        class="dropdown-item"
                        :class="
                          item.status === 'active'
                            ? 'text-danger'
                            : 'text-success'
                        "
                        @click="
                          setStatus(
                            [item._id],
                            item.status === 'active' ? 'archived' : 'active',
                          )
                        "
                      >
                        <i
                          class="bi me-2"
                          :class="
                            item.status === 'active'
                              ? 'bi-archive'
                              : 'bi-arrow-counterclockwise'
                          "
                        ></i
                        >{{ item.status === "active" ? "Archive" : "Restore" }}
                      </button>
                    </li>
                  </ul>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        class="d-flex flex-wrap justify-content-between align-items-center gap-3 p-3 border-bottom"
      >
        <span class="text-muted small"
          >Showing {{ showingStart }}–{{ showingEnd }} of
          {{ total }} questions</span
        >
        <div class="d-flex align-items-center gap-2">
          <label class="small text-muted" for="bankRows">Rows per page</label
          ><select
            id="bankRows"
            v-model.number="limit"
            class="form-select form-select-sm rows-select"
            @change="changeLimit"
          >
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option></select
          ><button
            class="btn btn-sm btn-outline-secondary"
            :disabled="page === 1"
            @click="changePage(page - 1)"
          >
            <i class="bi bi-chevron-left"></i></button
          ><button
            v-for="value in visiblePages"
            :key="value"
            class="btn btn-sm"
            :class="
              value === page ? 'btn-staff-primary' : 'btn-outline-secondary'
            "
            @click="changePage(value)"
          >
            {{ value }}</button
          ><button
            class="btn btn-sm btn-outline-secondary"
            :disabled="page === totalPages"
            @click="changePage(page + 1)"
          >
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>

      <div class="row g-3 p-3 bank-insights">
        <div class="col-12 col-lg-4">
          <div class="insight-panel">
            <h3>
              <i class="bi bi-bar-chart-line me-2 text-staff-primary"></i>Most
              Used Questions
            </h3>
            <ol
              v-if="summary.mostUsed?.length"
              class="list-group list-group-numbered list-group-flush"
            >
              <li
                v-for="item in summary.mostUsed"
                :key="item._id"
                class="list-group-item d-flex justify-content-between gap-2 px-0"
              >
                <span class="text-truncate">{{
                  item.questionText.replace(/<[^>]*>/g, "")
                }}</span
                ><small class="text-muted text-nowrap"
                  >{{ item.usageCount }} uses</small
                >
              </li>
            </ol>
            <p v-else class="text-muted small mb-0">
              Usage will appear after questions are reused.
            </p>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="insight-panel">
            <h3>
              <i class="bi bi-pie-chart me-2 text-staff-primary"></i>Question
              Types
            </h3>
            <div
              v-for="item in summary.types || []"
              :key="item._id"
              class="type-row"
            >
              <span>{{ formatType(item._id) }}</span
              ><strong>{{ item.count }}</strong>
              <div class="progress">
                <div
                  class="progress-bar bg-staff-primary"
                  :style="{ width: `${(item.count / maxTypeCount) * 100}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="insight-panel">
            <h3>
              <i class="bi bi-clock-history me-2 text-staff-primary"></i>Recent
              Activity
            </h3>
            <div
              v-for="activity in summary.recentActivity || []"
              :key="activity._id"
              class="activity-row"
            >
              <span
                ><i class="bi bi-caret-right-fill me-2"></i
                >{{
                  activityLabel(activity.action, activity.affectedCount)
                }}</span
              ><small>{{ relativeTime(activity.createdAt) }}</small>
            </div>
            <p
              v-if="!summary.recentActivity?.length"
              class="text-muted small mb-0"
            >
              No question-bank activity yet.
            </p>
          </div>
        </div>
      </div>
    </div>

    <QuestionFormModal
      :show="showQuestionForm"
      :question="selectedQuestion"
      @save="saveQuestion"
      @close="
        showQuestionForm = false;
        selectedQuestion = null;
      "
    />
    <QuestionViewModal
      :show="showQuestionView"
      :question="selectedQuestion"
      @close="showQuestionView = false"
      @edit="
        showQuestionView = false;
        editQuestion($event);
      "
    />
  </section>
</template>

<style scoped>
.staff-card {
  background: #fff;
  border: 1px solid #e5e9ec;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(20, 70, 70, 0.06);
}
.section-icon,
.metric-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 8px;
}
.section-icon {
  width: 48px;
  height: 48px;
  color: var(--staff-primary);
  background: var(--staff-light);
  font-size: 1.4rem;
}
.metric {
  min-height: 92px;
  padding: 0.85rem;
  border: 1px solid #e6eaed;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.metric-icon {
  width: 42px;
  height: 42px;
  font-size: 1.15rem;
}
.metric small,
.metric span {
  display: block;
  color: #6c757d;
  font-size: 0.72rem;
}
.metric strong {
  display: block;
  font-size: 1.25rem;
  line-height: 1.25;
}
.metric-word {
  font-size: 0.95rem !important;
}
.filter-band {
  background: #fbfcfc;
}
.bank-search {
  flex: 1 1 360px;
  max-width: 680px;
}
.filter-menu {
  width: min(320px, calc(100vw - 2rem));
  /* max-height: min(620px, calc(100vh - 8rem)); */
  max-height: 320px;
  overflow-y: auto;
}
.selection-toolbar {
  border: 1px solid rgba(26, 95, 95, 0.25);
  background: rgba(26, 95, 95, 0.06);
  border-radius: 6px;
}
.question-cell {
  width: 28%;
  max-width: 360px;
}
.question-cell :deep(.rich-content-display) {
  max-height: 54px;
  overflow: hidden;
  font-size: 0.875rem;
}
.rows-select {
  width: 74px;
}
.insight-panel {
  height: 100%;
  border: 1px solid #e4e8eb;
  border-radius: 6px;
  padding: 1rem;
}
.insight-panel h3 {
  font-size: 0.95rem;
  margin-bottom: 0.75rem;
}
.type-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.35rem 0.75rem;
  align-items: center;
  padding: 0.35rem 0;
  font-size: 0.8rem;
}
.type-row .progress {
  grid-column: 1 / -1;
  height: 7px;
}
.activity-row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid #edf0f2;
  font-size: 0.8rem;
}
.activity-row small {
  color: #6c757d;
  white-space: nowrap;
}
@media (max-width: 767.98px) {
  .question-cell {
    min-width: 260px;
  }
  .summary-grid > div:last-child {
    width: 100%;
  }
}
</style>
