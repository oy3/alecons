<script>
import { useAuthStore } from "../../../stores/auth.js";
import { apiService } from "../../../services/api.js";
import { logger } from "@shared/utils/logger";
import QuestionFormatGuide from "./QuestionFormatGuide.vue";
import QuestionFormModal from "./QuestionFormModal.vue";
import QuestionViewModal from "./QuestionViewModal.vue";
import RichContentDisplay from "../../../components/RichContentDisplay.vue";

export default {
  name: "QuestionBank",
  components: {
    QuestionFormatGuide,
    QuestionFormModal,
    QuestionViewModal,
    RichContentDisplay,
  },
  setup() {
    const authStore = useAuthStore();
    return { authStore };
  },
  data() {
    return {
      exams: [],
      questions: [],
      selectedExamId: "",
      isLoading: false,
      searchQuery: "",
      currentPage: 1,
      perPage: 10,

      // Modals
      showImportModal: false,
      showFormatGuide: false,
      showCreateQuestionModal: false,
      showEditQuestionModal: false,
      showViewQuestionModal: false,
      showReuseModal: false,
      selectedQuestion: null,
      reusableQuestions: [],
      reuseSelectedIds: [],
      reuseSelectedItems: {},
      reuseLoading: false,
      reuseSaving: false,
      reusePage: 1,
      reuseLimit: 10,
      reuseTotal: 0,
      reuseTotalPages: 1,
      reuseFilters: { search: "", type: "all", subject: "all", topic: "all" },
      reuseFacets: { subjects: [], topics: [] },

      // Import
      importFormat: "excel",
      selectedFile: null,
      isImporting: false,

      formatInstructions: {
        excel: {
          title: "Excel Format Requirements",
          description:
            "Use columns: Question, Type (mcq/multi/essay), Option_A, Option_B, Option_C, Option_D, Option_E, Answer, Mark, Tags",
        },
        csv: {
          title: "CSV Format Requirements",
          description:
            "Same as Excel but in CSV format. Use semicolons (;) for multiple answers and tags.",
        },
        pdf: {
          title: "PDF Format Requirements",
          description:
            "Use AI parsing. Format questions clearly with numbers (1., 2., etc.) and answer choices (a), b), c), d).",
        },
        docx: {
          title: "Word Document Format Requirements",
          description:
            "Similar to PDF. Use numbered questions with clear answer choices. AI will parse the content.",
        },
      },
    };
  },
  computed: {
    selectedExam() {
      return (
        this.exams.find((exam) => exam._id === this.selectedExamId) || null
      );
    },

    canEditQuestions() {
      if (!this.selectedExam) return false;
      return (
        this.selectedExam.status === "draft" ||
        this.selectedExam.status === "scheduled"
      );
    },

    existingBankItemIds() {
      return new Set(this.questions.map(question => String(question.questionBankItemId || '')).filter(Boolean));
    },

    remainingQuestionSlots() {
      const activeQuestionCount = this.questions.filter(question => question.status !== "inactive").length;
      return Math.max(0, Number(this.selectedExam?.totalQuestions || 0) - activeQuestionCount);
    },

    reusePageEligibleIds() {
      return this.reusableQuestions.filter(item => !this.existingBankItemIds.has(String(item._id))).map(item => item._id);
    },

    allReusePageSelected() {
      return this.reusePageEligibleIds.length > 0 && this.reusePageEligibleIds.every(id => this.reuseSelectedIds.includes(id));
    },

    someReusePageSelected() {
      return this.reusePageEligibleIds.some(id => this.reuseSelectedIds.includes(id)) && !this.allReusePageSelected;
    },

    currentExamMarks() {
      return this.questions
        .filter(question => question.status !== "inactive")
        .reduce((total, question) => total + Number(question.mark || 0), 0);
    },

    selectedReuseMarks() {
      return this.reuseSelectedIds.reduce((total, id) => total + Number(this.reuseSelectedItems[id]?.defaultMark || 0), 0);
    },

    filteredQuestions() {
      if (!this.searchQuery) return this.questions;

      const query = this.searchQuery.toLowerCase();
      return this.questions.filter(
        (question) =>
          question.questionText.toLowerCase().includes(query) ||
          question.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    },

    paginatedQuestions() {
      const start = (this.currentPage - 1) * this.perPage;
      const end = start + this.perPage;
      return this.filteredQuestions.slice(start, end);
    },

    totalPages() {
      return Math.ceil(this.filteredQuestions.length / this.perPage);
    },

    visiblePages() {
      const total = this.totalPages;
      const current = this.currentPage;
      const delta = 2;
      const range = [];

      for (
        let i = Math.max(1, current - delta);
        i <= Math.min(total, current + delta);
        i++
      ) {
        range.push(i);
      }

      return range;
    },
  },
  async mounted() {
    await this.loadExams();
  },

  methods: {
    async loadExams() {
      try {
        const response = await apiService.getExams();
        if (response.success) {
          this.exams = response.exams || [];
        }
      } catch (error) {
        logger.error("Error loading exams:", error);
        this.$swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to load exams. Please try again.",
          confirmButtonColor: "#dc3545",
        });
      }
    },

    handleAddQuestion() {
      if (!this.selectedExamId) {
        this.$swal.fire({
          icon: "warning",
          title: "Select an Exam",
          text: "Please select an exam first before adding questions.",
          confirmButtonColor: "#1a5f5f",
        });
        return;
      }

      if (!this.canEditQuestions) {
        this.$swal.fire({
          icon: "error",
          title: "Cannot Add Questions",
          text: `This exam has status "${this.selectedExam.status}" and cannot be modified. Only exams with status "draft" or "scheduled" can have questions added.`,
          confirmButtonColor: "#dc3545",
        });
        return;
      }

      // Clear any previously selected question to ensure fresh form
      this.selectedQuestion = null;
      this.showCreateQuestionModal = true;
    },

    async loadQuestions() {
      if (!this.selectedExamId) {
        this.questions = [];
        return;
      }

      try {
        this.isLoading = true;
        this.questions = [];
        const response = await apiService.getQuestions(this.selectedExamId);
        if (response.success) {
          this.questions = response.questions || [];
          if (this.questions.length === 0) {
            this.$swal.fire({
              icon: "info",
              title: "No Questions",
              text: this.canEditQuestions
                ? "No questions found for this exam. Add questions using the actions above."
                : "No questions were recorded for this exam.",
              confirmButtonColor: "#1a5f5f",
            });
          }
        } else {
          throw new Error(response.message || "Failed to load questions");
        }
      } catch (error) {
        logger.error("Error loading questions:", error);
        this.$swal.fire({
          icon: "error",
          title: "Loading Failed",
          text: "Failed to load questions.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.isLoading = false;
      }
    },

    async openReuseModal() {
      if (!this.selectedExamId || !this.canEditQuestions || !this.remainingQuestionSlots) return;
      this.showReuseModal = true;
      this.reuseSelectedIds = [];
      this.reuseSelectedItems = {};
      this.reusePage = 1;
      try {
        const facets = await apiService.getQuestionBankFacets();
        this.reuseFacets = facets.data || this.reuseFacets;
      } catch (error) {
        logger.warn("Could not load reusable question filters", error);
      }
      await this.loadReusableQuestions();
    },

    async loadReusableQuestions() {
      this.reuseLoading = true;
      try {
        const response = await apiService.getQuestionBank({
          ...this.reuseFilters,
          status: "active",
          page: this.reusePage,
          limit: this.reuseLimit,
        });
        const data = response.data || {};
        this.reusableQuestions = data.items || [];
        this.reuseTotal = data.total || 0;
        this.reuseTotalPages = data.totalPages || 1;
      } catch (error) {
        this.$swal.fire("Could not load question bank", error.message, "error");
      } finally {
        this.reuseLoading = false;
      }
    },

    applyReuseFilters() {
      this.reusePage = 1;
      this.loadReusableQuestions();
    },

    changeReusePage(page) {
      if (page < 1 || page > this.reuseTotalPages) return;
      this.reusePage = page;
      this.loadReusableQuestions();
    },

    toggleReuseQuestion(item) {
      if (this.existingBankItemIds.has(String(item._id))) return;
      if (this.reuseSelectedIds.includes(item._id)) {
        this.reuseSelectedIds = this.reuseSelectedIds.filter(id => id !== item._id);
        delete this.reuseSelectedItems[item._id];
        return;
      }
      if (this.reuseSelectedIds.length >= this.remainingQuestionSlots) {
        this.$swal.fire("Question limit reached", `Only ${this.remainingQuestionSlots} question slots are available.`, "info");
        return;
      }
      this.reuseSelectedItems[item._id] = item;
      this.reuseSelectedIds.push(item._id);
    },

    toggleReusePage(event) {
      if (!event.target.checked) {
        this.reusePageEligibleIds.forEach(id => delete this.reuseSelectedItems[id]);
        this.reuseSelectedIds = this.reuseSelectedIds.filter(id => !this.reusePageEligibleIds.includes(id));
        return;
      }
      const available = this.remainingQuestionSlots - this.reuseSelectedIds.length;
      const additions = this.reusePageEligibleIds.filter(id => !this.reuseSelectedIds.includes(id)).slice(0, available);
      this.reusableQuestions.filter(item => additions.includes(item._id)).forEach(item => { this.reuseSelectedItems[item._id] = item; });
      this.reuseSelectedIds = [...new Set([...this.reuseSelectedIds, ...additions])];
    },

    async selectAllMatchingReuse() {
      this.reuseLoading = true;
      try {
        const ids = [];
        const selectedItems = {};
        let page = 1;
        let pages = 1;
        do {
          const response = await apiService.getQuestionBank({ ...this.reuseFilters, status: "active", page, limit: 100 });
          const data = response.data || {};
          pages = data.totalPages || 1;
          for (const item of data.items || []) {
            if (!this.existingBankItemIds.has(String(item._id))) { ids.push(item._id); selectedItems[item._id] = item; }
            if (ids.length >= this.remainingQuestionSlots) break;
          }
          page++;
        } while (page <= pages && ids.length < this.remainingQuestionSlots);
        this.reuseSelectedIds = [...new Set(ids)];
        this.reuseSelectedItems = selectedItems;
      } catch (error) {
        this.$swal.fire("Selection failed", error.message, "error");
      } finally {
        this.reuseLoading = false;
      }
    },

    async reuseSelectedQuestions() {
      if (!this.reuseSelectedIds.length) return;
      this.reuseSaving = true;
      try {
        const response = await apiService.reuseQuestionBankItems(this.selectedExamId, this.reuseSelectedIds);
        await this.loadQuestions();
        this.showReuseModal = false;
        this.$swal.fire({ icon: "success", title: `${response.data?.added || 0} questions added`, timer: 1600, showConfirmButton: false });
      } catch (error) {
        this.$swal.fire("Could not reuse questions", error.message, "error");
      } finally {
        this.reuseSaving = false;
      }
    },

    clearReuseSelection() {
      this.reuseSelectedIds = [];
      this.reuseSelectedItems = {};
    },

    changePage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
      }
    },

    // Import methods
    getFileAccept() {
      const accepts = {
        excel: ".xlsx,.xls",
        csv: ".csv",
        pdf: ".pdf",
        docx: ".docx",
      };
      return accepts[this.importFormat] || "*";
    },

    handleFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          this.$swal.fire({
            icon: "error",
            title: "File Too Large",
            text: "Please select a file smaller than 10MB.",
            confirmButtonColor: "#dc3545",
          });
          this.$refs.fileInput.value = "";
          return;
        }
        this.selectedFile = file;
      }
    },

    async importQuestions() {
      if (!this.selectedFile || !this.selectedExamId) return;

      if (!this.canEditQuestions) {
        this.$swal.fire({
          icon: "error",
          title: "Cannot Import Questions",
          text: `This exam has status "${this.selectedExam.status}" and cannot be modified. Only exams with status "draft" or "scheduled" can have questions imported.`,
          confirmButtonColor: "#dc3545",
        });
        return;
      }

      try {
        this.isImporting = true;

        // Step 1: Generate preview
        const previewResponse = await apiService.bulkImportPreview(
          this.selectedFile,
          this.importFormat
        );

        if (previewResponse.success) {
          // Show preview modal with the parsed questions
          await this.showImportPreview(previewResponse.preview);
        }
      } catch (error) {
        this.$swal.fire({
          icon: "error",
          title: "Import Failed",
          text: error.message || "Failed to import questions.",
          confirmButtonColor: "#dc3545",
        });
      } finally {
        this.isImporting = false;
      }
    },

    async showImportPreview(previewData) {
      const {
        filename,
        totalQuestions,
        validQuestions,
        invalidQuestions,
        questions,
      } = previewData;

      // Create preview table HTML
      const createPreviewTable = (questionsToShow, page = 0, perPage = 5) => {
        const start = page * perPage;
        const end = start + perPage;
        const pageQuestions = questionsToShow.slice(start, end);

        let tableRows = pageQuestions
          .map((q) => {
            const validationStatus = q.isValid
              ? '<span class="badge bg-success">Valid</span>'
              : '<span class="badge bg-danger">Invalid</span>';

            const optionsHtml = Object.entries(q.options || {})
              .map(
                ([key, value]) =>
                  `<strong>${key.toUpperCase()})</strong> ${value}`
              )
              .join("<br>");

            const errorsHtml =
              q.validationErrors && q.validationErrors.length > 0
                ? `<br><small class="text-danger">${q.validationErrors.join(
                    ", "
                  )}</small>`
                : "";

            return `
            <tr class="${!q.isValid ? "table-warning" : ""}">
              <td>${q.rowNumber}</td>
              <td>${q.questionText || "N/A"}</td>
              <td>${optionsHtml}</td>
              <td>${q.correctAnswer || "N/A"}</td>
              <td>${validationStatus}${errorsHtml}</td>
            </tr>
          `;
          })
          .join("");

        const totalPages = Math.ceil(questionsToShow.length / perPage);
        const pagination =
          totalPages > 1
            ? `
          <div class="d-flex justify-content-between align-items-center mt-3">
            <div>
              Showing ${start + 1}-${Math.min(
                end,
                questionsToShow.length
              )} of ${questionsToShow.length} questions
            </div>
            <div>
              ${
                page > 0
                  ? `<button class="btn btn-sm btn-outline-primary me-2" onclick="showPage(${
                      page - 1
                    })">Previous</button>`
                  : ""
              }
              ${
                page + 1 < totalPages
                  ? `<button class="btn btn-sm btn-outline-primary" onclick="showPage(${
                      page + 1
                    })">Next</button>`
                  : ""
              }
            </div>
          </div>
        `
            : "";

        return `
          <div class="table-responsive">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th width="8%">#</th>
                  <th width="35%">Question</th>
                  <th width="25%">Options</th>
                  <th width="12%">Answer</th>
                  <th width="20%">Status</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
            ${pagination}
          </div>
        `;
      };

      let currentPage = 0;
      const perPage = 5;

      // Show the preview modal
      const result = await this.$swal.fire({
        title: `Import Preview: ${filename}`,
        html: `
          <div class="text-start">
            <div class="alert alert-info">
              <strong>File:</strong> ${filename}<br>
              <strong>Total Questions:</strong> ${totalQuestions}<br>
              <strong>Valid Questions:</strong> <span class="text-success">${validQuestions}</span><br>
              <strong>Invalid Questions:</strong> <span class="text-danger">${invalidQuestions}</span>
            </div>
            <div id="preview-table">
              ${createPreviewTable(questions, currentPage, perPage)}
            </div>
          </div>
        `,
        width: "90%",
        showCancelButton: true,
        confirmButtonText:
          validQuestions > 0
            ? `Import ${validQuestions} Valid Questions`
            : "No Valid Questions",
        cancelButtonText: "Cancel",
        confirmButtonColor: validQuestions > 0 ? "#1a5f5f" : "#6c757d",
        allowOutsideClick: false,
        didOpen: () => {
          // Add pagination functionality
          window.showPage = (page) => {
            currentPage = page;
            document.getElementById("preview-table").innerHTML =
              createPreviewTable(questions, currentPage, perPage);
          };
        },
        preConfirm: () => {
          if (validQuestions === 0) {
            this.$swal.showValidationMessage("No valid questions to import");
            return false;
          }
          return true;
        },
      });

      // Clean up global function
      if (window.showPage) {
        delete window.showPage;
      }

      if (result.isConfirmed && validQuestions > 0) {
        await this.saveImportedQuestions(questions.filter((q) => q.isValid));
      }
    },

    async saveImportedQuestions(validQuestions) {
      try {
        this.isImporting = true;

        const saveResponse = await apiService.saveBulkImportQuestions(
          this.selectedExamId,
          validQuestions
        );

        if (saveResponse.success) {
          await this.$swal.fire({
            icon: "success",
            title: "Import Successful",
            text: `Successfully imported ${saveResponse.result.successCount} questions.`,
            confirmButtonColor: "#1a5f5f",
          });
          this.closeImportModal();
          this.loadQuestions();
        }
      } catch (error) {
        await this.$swal.fire({
          icon: "error",
          title: "Save Failed",
          text: error.message || "Failed to save questions.",
          confirmButtonColor: "#dc3545",
        });
      } finally {
        this.isImporting = false;
      }
    },

    closeImportModal() {
      this.showImportModal = false;
      this.selectedFile = null;
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = "";
      }
    },

    // Question CRUD methods
    viewQuestion(question) {
      this.selectedQuestion = question;
      this.showViewQuestionModal = true;
    },

    editQuestion(question) {
      if (!this.canEditQuestions) {
        this.$swal.fire({
          icon: "error",
          title: "Cannot Edit Question",
          text: `This exam has status "${this.selectedExam.status}" and cannot be modified. Only exams with status "draft" or "scheduled" can have questions edited.`,
          confirmButtonColor: "#dc3545",
        });
        return;
      }

      this.selectedQuestion = question;
      this.showEditQuestionModal = true;
    },

    async deleteQuestion(question) {
      if (!this.canEditQuestions) {
        this.$swal.fire({
          icon: "error",
          title: "Cannot Delete Question",
          text: `This exam has status "${this.selectedExam.status}" and cannot be modified. Only exams with status "draft" or "scheduled" can have questions deleted.`,
          confirmButtonColor: "#dc3545",
        });
        return;
      }

      const result = await this.$swal.fire({
        title: "Delete Question",
        text: "Are you sure you want to delete this question?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, Delete",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#dc3545",
      });

      if (result.isConfirmed) {
        try {
          const response = await apiService.deleteQuestion(question._id);
          if (response.success) {
            // Show success alert first
            await this.$swal.fire({
              icon: "success",
              title: "Question Deleted",
              text: "Question has been successfully deleted.",
              confirmButtonColor: "#1a5f5f",
              timer: 2000,
              showConfirmButton: false,
            });
            // Then reload questions (this will show "No Questions" alert if needed)
            this.loadQuestions();
          }
        } catch (error) {
          this.$swal.fire({
            icon: "error",
            title: "Delete Failed",
            text: error.message || "Failed to delete question.",
            confirmButtonColor: "#dc3545",
          });
        }
      }
    },

    closeQuestionModal() {
      this.showCreateQuestionModal = false;
      this.showEditQuestionModal = false;
      this.selectedQuestion = null;
    },

    async handleQuestionSave(questionData) {
      if (!this.canEditQuestions) {
        this.$swal.fire({
          icon: "error",
          title: "Cannot Save Question",
          text: `This exam has status "${this.selectedExam.status}" and cannot be modified. Only exams with status "draft" or "scheduled" can have questions saved.`,
          confirmButtonColor: "#dc3545",
        });
        return;
      }

      try {
        if (this.selectedQuestion) {
          // Update existing question
          const response = await apiService.updateQuestion(
            this.selectedQuestion._id,
            questionData
          );
          if (response.success) {
            this.$swal.fire({
              icon: "success",
              title: "Question Updated",
              text: "The question has been updated successfully.",
              timer: 1500,
              showConfirmButton: false,
            });
          }
        } else {
          // Create new question
          const response = await apiService.createQuestion(
            this.selectedExamId,
            questionData
          );
          if (response.success) {
            this.$swal.fire({
              icon: "success",
              title: "Question Added",
              text: "The question has been added successfully.",
              timer: 1500,
              showConfirmButton: false,
            });
          }
        }
        this.closeQuestionModal();
        await this.loadQuestions();
      } catch (error) {
        this.$swal.fire({
          icon: "error",
          title: "Error",
          text: error.message || "Failed to save question. Please try again.",
          confirmButtonColor: "#dc3545",
        });
      }
    },

    // Utility methods
    formatFileSize(bytes) {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    },

    formatQuestionType(type) {
      const types = {
        mcq: "Multiple Choice",
        multi: "Multi-Select",
        essay: "Essay",
      };
      return types[type] || type;
    },

    getQuestionTypeBadge(type) {
      const badges = {
        mcq: "bg-primary",
        multi: "bg-info",
        essay: "bg-warning text-dark",
      };
      return badges[type] || "bg-secondary";
    },
  },
};
</script>

<template>
  <div class="question-bank">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h4 class="mb-1">Exam Questions</h4>
        <p class="text-muted mb-0">
          Build the selected exam from new, imported, or reusable questions
        </p>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-info" @click="showFormatGuide = true">
          <i class="bi bi-info-circle me-1"></i>
          Import Format Guide
        </button>
        <button
          v-if="canEditQuestions && remainingQuestionSlots > 0"
          class="btn btn-outline-success"
          @click="openReuseModal"
        >
          <i class="bi bi-bank me-1"></i>
          Reuse from Bank
        </button>
        <button
          v-if="canEditQuestions"
          class="btn btn-outline-primary"
          @click="showImportModal = true"
        >
          <i class="bi bi-upload me-1"></i>
          Bulk Import
        </button>
        <button
          v-if="canEditQuestions"
          class="btn btn-primary"
          @click="handleAddQuestion"
        >
          <i class="bi bi-plus-circle me-1"></i>
          Add Question
        </button>
      </div>
    </div>

    <!-- Exam Selection -->
    <div class="row mb-4">
      <div class="col-md-6">
        <label class="form-label">Select Exam</label>
        <select
          class="form-select"
          v-model="selectedExamId"
          @change="loadQuestions"
        >
          <option value="">Choose an exam...</option>
          <option v-for="exam in exams" :key="exam._id" :value="exam._id">
            {{ exam.title }} - {{ exam.academicSession?.sessionYear }}
          </option>
        </select>
      </div>
      <div class="col-md-6" v-if="selectedExamId">
        <label class="form-label">Search Questions</label>
        <div class="input-group">
          <span class="input-group-text">
            <i class="bi bi-search"></i>
          </span>
          <input
            type="text"
            class="form-control"
            placeholder="Search questions..."
            v-model="searchQuery"
          />
        </div>
      </div>
    </div>

    <!-- Exam Status Information -->
    <div
      v-if="selectedExam && !canEditQuestions"
      class="alert alert-warning mb-4"
    >
      <i class="bi bi-exclamation-triangle me-2"></i>
      <strong>Questions cannot be modified:</strong>
      This exam has status "{{ selectedExam.status }}" and is no longer
      editable. Only exams with status "draft" or "scheduled" can have questions
      added, edited, or removed.
    </div>

    <!-- Questions List -->
    <div v-if="selectedExamId">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-3">Loading questions...</p>
      </div>

      <!-- Questions Table -->
      <div v-else-if="filteredQuestions.length > 0" class="card p-0">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th width="5%">#</th>
                  <th width="40%">Question</th>
                  <th width="15%">Type</th>
                  <th width="10%">Mark</th>
                  <th width="10%">Status</th>
                  <th width="20%">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(question, index) in paginatedQuestions"
                  :key="question._id"
                >
                  <td>{{ (currentPage - 1) * perPage + index + 1 }}</td>
                  <td>
                    <div class="question-preview">
                      <div class="question-text">
                        <RichContentDisplay
                          :content="question.questionText"
                        />
                      </div>
                      <div
                        v-if="['mcq', 'multi'].includes(question.type) && question.options"
                        class="options-preview mt-2"
                      >
                        <small class="text-muted">Options: </small>
                        <span class="options-inline">
                          <span
                            v-for="(optionText, key, index) in question.options"
                            :key="key"
                            v-show="index < 2"
                            class="option-preview me-2"
                          >
                            <strong>{{ key.toUpperCase() }}:</strong>
                            <span class="option-content-inline">
                              <RichContentDisplay
                                :content="optionText"
                                max-width="150px"
                                max-height="30px"
                                style="font-size: 0.75rem; display: inline;"
                              />
                            </span> ; 
                          </span>
                          <span v-if="Object.keys(question.options).length > 2" class="text-muted">
                            ... ({{ Object.keys(question.options).length }} total)
                          </span>
                        </span>
                      </div>
                      <div v-if="question.tags?.length > 0" class="tags mt-1">
                        <span
                          v-for="tag in question.tags.slice(0, 3)"
                          :key="tag"
                          class="badge bg-light text-dark me-1"
                        >
                          {{ tag }}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      class="badge"
                      :class="getQuestionTypeBadge(question.type)"
                    >
                      {{ formatQuestionType(question.type) }}
                    </span>
                  </td>
                  <td>
                    <strong>{{ question.mark }}</strong>
                  </td>
                  <td>
                    <span
                      class="badge"
                      :class="
                        question.status === 'active'
                          ? 'bg-success'
                          : 'bg-secondary'
                      "
                    >
                      {{ question.status }}
                    </span>
                  </td>
                  <td>
                    <div class="btn-group">
                      <button
                        class="btn btn-sm btn-outline-primary"
                        @click="viewQuestion(question)"
                        title="View Details"
                      >
                        <i class="bi bi-eye"></i>
                      </button> 
                      <button
                        v-if="canEditQuestions"
                        class="btn btn-sm btn-outline-success"
                        @click="editQuestion(question)"
                        title="Edit Question"
                      >
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button
                        v-if="canEditQuestions"
                        class="btn btn-sm btn-outline-danger"
                        @click="deleteQuestion(question)"
                        title="Delete Question"
                      >
                        <i class="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pagination -->
        <div class="card-footer">
          <span class="small text-end">
            Showing
            {{ (currentPage - 1) * perPage + 1 }}
            -
            {{ Math.min(currentPage * perPage, filteredQuestions.length) }}
            of
            {{ filteredQuestions.length }}
            Questions
          </span>
          <nav v-if="totalPages > 1" aria-label="Questions pagination">
            <ul class="pagination pagination-sm justify-content-center mb-0">
              <li class="page-item" :class="{ disabled: currentPage === 1 }">
                <button class="page-link" @click="changePage(currentPage - 1)">
                  <i class="bi bi-chevron-left"></i>
                </button>
              </li>
              <li
                v-for="page in visiblePages"
                :key="page"
                class="page-item"
                :class="{ active: page === currentPage }"
              >
                <button class="page-link" @click="changePage(page)">
                  {{ page }}
                </button>
              </li>
              <li
                class="page-item"
                :class="{ disabled: currentPage === totalPages }"
              >
                <button class="page-link" @click="changePage(currentPage + 1)">
                  <i class="bi bi-chevron-right"></i>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-5">
        <i class="bi bi-question-circle text-muted" style="font-size: 4rem"></i>
        <h4 class="text-muted mt-3">No Questions Found</h4>
        <p class="text-muted">
          {{ canEditQuestions
            ? "Add questions manually or import from a file."
            : "No questions were recorded for this exam." }}
        </p>
        <div v-if="canEditQuestions" class="d-flex gap-2 justify-content-center">
          <button
            class="btn btn-primary"
            @click="handleAddQuestion"
          >
            <i class="bi bi-plus-circle me-1"></i>
            Add Question
          </button>
          <button
            class="btn btn-outline-primary"
            @click="showImportModal = true"
          >
            <i class="bi bi-upload me-1"></i>
            Import Questions
          </button>
        </div>
      </div>
    </div>

    <!-- No Exam Selected -->
    <div v-else class="text-center py-5">
      <i class="bi bi-mortarboard text-muted" style="font-size: 4rem"></i>
      <h4 class="text-muted mt-3">Select an Exam</h4>
      <p class="text-muted">Choose an exam to manage its questions.</p>
    </div>

    <!-- Bulk Import Modal -->
    <div
      class="modal fade"
      :class="{ show: showImportModal }"
      :style="{ display: showImportModal ? 'block' : 'none' }"
      tabindex="-1"
    >
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-upload me-2"></i>
              Bulk Import Questions
            </h5>
            <button
              type="button"
              class="btn-close"
              @click="closeImportModal"
            ></button>
          </div>
          <div class="modal-body">
            <div v-if="!selectedExamId" class="alert alert-warning">
              <i class="bi bi-exclamation-triangle me-2"></i>
              Please select an exam first before importing questions.
            </div>
            <div v-else-if="!canEditQuestions" class="alert alert-danger">
              <i class="bi bi-exclamation-triangle me-2"></i>
              <strong>Cannot Import Questions:</strong>
              The selected exam has status "{{ selectedExam?.status }}" and
              cannot be modified. Only exams with status "draft" or "scheduled"
              can have questions imported.
            </div>
            <div v-else>
              <div class="mb-3">
                <label class="form-label">Select File Format</label>
                <select class="form-select" v-model="importFormat">
                  <option value="excel">Excel (.xlsx, .xls)</option>
                  <option value="csv">CSV (.csv)</option>
                  <option value="pdf">PDF (.pdf)</option>
                  <option value="docx">Word Document (.docx)</option>
                </select>
              </div>

              <div class="mb-3">
                <label class="form-label">Choose File</label>
                <input
                  type="file"
                  class="form-control"
                  ref="fileInput"
                  :accept="getFileAccept()"
                  @change="handleFileSelect"
                />
                <small class="form-text text-muted">
                  Maximum file size: 10MB
                </small>
              </div>

              <div v-if="selectedFile" class="mb-3">
                <div class="alert alert-info">
                  <strong>Selected:</strong> {{ selectedFile.name }} ({{
                    formatFileSize(selectedFile.size)
                  }})
                </div>
              </div>

              <!-- Format Instructions -->
              <div class="alert alert-light">
                <strong>{{ formatInstructions[importFormat]?.title }}</strong>
                <p class="mb-0 mt-2">
                  {{ formatInstructions[importFormat]?.description }}
                </p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary"
              @click="closeImportModal"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              @click="importQuestions"
              :disabled="
                !selectedFile ||
                !selectedExamId ||
                isImporting ||
                !canEditQuestions
              "
            >
              <span
                v-if="isImporting"
                class="spinner-border spinner-border-sm me-2"
              ></span>
              {{ isImporting ? "Importing..." : "Import Questions" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Format Guide Modal -->
    <QuestionFormatGuide
      :show="showFormatGuide"
      @close="showFormatGuide = false"
    />

    <!-- Question Form Modal -->
    <QuestionFormModal
      :show="showCreateQuestionModal || showEditQuestionModal"
      :question="selectedQuestion"
      :examId="selectedExamId"
      @close="closeQuestionModal"
      @save="handleQuestionSave"
    />

    <!-- Question View Modal -->
    <QuestionViewModal
      :show="showViewQuestionModal"
      :question="selectedQuestion"
      @close="showViewQuestionModal = false"
      @edit="editQuestion"
    />

    <div v-if="showReuseModal" class="modal fade show reuse-modal" style="display: block" tabindex="-1" role="dialog" aria-modal="true">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <div><h5 class="modal-title">Reuse Questions from Bank</h5><p class="text-muted small mb-0">Choose independent snapshots for {{ selectedExam?.title }}.</p></div>
            <button type="button" class="btn-close" aria-label="Close" @click="showReuseModal = false"></button>
          </div>
          <div class="modal-body p-0">
            <form class="reuse-filters p-3 border-bottom" @submit.prevent="applyReuseFilters">
              <div class="row g-2">
                <div class="col-12 col-lg"><div class="input-group"><span class="input-group-text"><i class="bi bi-search"></i></span><input v-model="reuseFilters.search" class="form-control" placeholder="Search reusable questions..." /></div></div>
                <div class="col-6 col-lg-2"><select v-model="reuseFilters.type" class="form-select"><option value="all">All Types</option><option value="mcq">Multiple Choice</option><option value="multi">Multi-Select</option><option value="essay">Essay</option></select></div>
                <div class="col-6 col-lg-2"><select v-model="reuseFilters.subject" class="form-select"><option value="all">All Subjects</option><option v-for="subject in reuseFacets.subjects" :key="subject" :value="subject">{{ subject }}</option></select></div>
                <div class="col-6 col-lg-2"><select v-model="reuseFilters.topic" class="form-select"><option value="all">All Topics</option><option v-for="topic in reuseFacets.topics" :key="topic" :value="topic">{{ topic }}</option></select></div>
                <div class="col-auto"><button class="btn btn-staff-primary"><i class="bi bi-search"></i><span class="visually-hidden">Search</span></button></div>
              </div>
              <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
                <span class="small text-muted">{{ reuseTotal }} matching · {{ remainingQuestionSlots }} slots available</span>
                <div class="d-flex gap-2"><button type="button" class="btn btn-sm btn-outline-staff-primary" @click="selectAllMatchingReuse">Select all eligible matching</button><button type="button" class="btn btn-sm btn-outline-secondary" :disabled="!reuseSelectedIds.length" @click="clearReuseSelection">Clear selection</button></div>
              </div>
            </form>
            <div class="table-responsive">
              <table class="table table-hover align-middle mb-0">
                <thead class="table-light sticky-top"><tr><th><input class="form-check-input" type="checkbox" :checked="allReusePageSelected" :indeterminate.prop="someReusePageSelected" @change="toggleReusePage" /></th><th>Question</th><th>Type</th><th>Subject</th><th>Topic</th><th>Difficulty</th><th>Mark</th><th>Usage</th></tr></thead>
                <tbody>
                  <tr v-if="reuseLoading"><td colspan="8" class="text-center py-5"><span class="spinner-border text-staff-primary"></span></td></tr>
                  <tr v-else-if="!reusableQuestions.length"><td colspan="8" class="text-center text-muted py-5">No reusable questions match these filters.</td></tr>
                  <tr v-for="item in reusableQuestions" v-else :key="item._id" :class="{ 'table-light text-muted': existingBankItemIds.has(String(item._id)) }">
                    <td><input class="form-check-input" type="checkbox" :checked="reuseSelectedIds.includes(item._id)" :disabled="existingBankItemIds.has(String(item._id))" @change="toggleReuseQuestion(item)" /></td>
                    <td class="reuse-question"><RichContentDisplay :content="item.questionText" /><span v-if="existingBankItemIds.has(String(item._id))" class="badge text-bg-secondary">Already added</span></td>
                    <td>{{ formatQuestionType(item.type) }}</td><td>{{ item.metadata?.subject || '—' }}</td><td>{{ item.metadata?.topic || '—' }}</td><td class="text-capitalize">{{ item.metadata?.difficulty || '—' }}</td><td>{{ item.defaultMark }}</td><td>{{ item.usageCount || 0 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="d-flex justify-content-end align-items-center gap-2 p-3 border-top"><button class="btn btn-sm btn-outline-secondary" :disabled="reusePage === 1" @click="changeReusePage(reusePage - 1)"><i class="bi bi-chevron-left"></i></button><span class="small">Page {{ reusePage }} of {{ reuseTotalPages }}</span><button class="btn btn-sm btn-outline-secondary" :disabled="reusePage === reuseTotalPages" @click="changeReusePage(reusePage + 1)"><i class="bi bi-chevron-right"></i></button></div>
          </div>
          <div class="modal-footer justify-content-between">
            <div><strong>{{ reuseSelectedIds.length }} selected</strong><span class="text-muted ms-2">{{ (selectedExam?.totalQuestions || 0) - remainingQuestionSlots + reuseSelectedIds.length }}/{{ selectedExam?.totalQuestions }} questions · {{ currentExamMarks + selectedReuseMarks }}/{{ selectedExam?.totalMark }} marks</span></div>
            <div class="d-flex gap-2"><button class="btn btn-secondary" @click="showReuseModal = false">Cancel</button><button class="btn btn-staff-primary" :disabled="!reuseSelectedIds.length || reuseSaving" @click="reuseSelectedQuestions"><span v-if="reuseSaving" class="spinner-border spinner-border-sm me-1"></span>Add {{ reuseSelectedIds.length }} Questions</button></div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showReuseModal" class="modal-backdrop fade show"></div>
  </div>
</template>

<style scoped>
.question-bank {
  min-height: 500px;
}

.reuse-modal { z-index: 1060; }
.reuse-modal + .modal-backdrop { z-index: 1055; }
.reuse-filters { background: #fbfcfc; }
.reuse-question { min-width: 300px; max-width: 460px; }
.reuse-question :deep(.rich-content-display) { max-height: 58px; overflow: hidden; font-size: .875rem; }

.question-preview {
  max-width: 400px;
}

.question-text {
  font-size: 0.875rem;
  line-height: 1.4;
}

.options-preview {
  font-size: 0.75rem;
}

.options-inline {
  display: inline;
}

.option-preview {
  display: inline-flex;
  margin-right: 8px;
  font-size: 0.75rem;
}

.option-content-inline {
  display: inline;
}

/* Ensure option images are very small in preview */
.option-content-inline :deep(img) {
  max-width: 20px !important;
  max-height: 15px !important;
  object-fit: contain;
  margin: 0 1px;
  vertical-align: middle;
}

/* Truncate long text in options */
.option-content-inline :deep(p) {
  margin: 0;
  display: inline;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

/* Handle formulas in compact view */
.option-content-inline :deep(.katex) {
  font-size: 0.7rem !important;
  display: inline !important;
}

.tags .badge {
  font-size: 0.65rem;
}

.modal.show {
  background: rgba(0, 0, 0, 0.5);
}

.pagination-sm .page-link {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.table th {
  border-top: none;
  font-weight: 600;
  color: #495057;
  font-size: 0.875rem;
}

.table td {
  vertical-align: middle;
  font-size: 0.875rem;
}

/* .btn-group .btn {
  padding: 0.25rem 0.5rem;
} */
</style>
