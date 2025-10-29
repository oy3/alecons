<script>
import { useAuthStore } from "../../../stores/auth.js";
import { apiService } from "../../../services/api.js";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";

export default {
  name: "ExamResults",
  setup() {
    const authStore = useAuthStore();
    return { authStore };
  },
  data() {
    return {
      // Data
      exams: [],
      results: [],
      statistics: null,

      // Filters
      selectedExamId: "",
      statusFilter: "",
      searchTerm: "",

      // Pagination
      currentPage: 1,
      perPage: 10,

      // UI State
      loading: false,
      error: null,
    };
  },
  computed: {
    filteredResults() {
      let filtered = [...this.results];

      // Filter by status
      if (this.statusFilter) {
        filtered = filtered.filter(
          (result) => result.status === this.statusFilter
        );
      }

      // Filter by search term
      if (this.searchTerm) {
        const term = this.searchTerm.toLowerCase();
        filtered = filtered.filter((result) => {
          try {
            const userName = this.getUserDisplayName(
              result.userId
            ).toLowerCase();
            const userEmail = result.userId?.email?.toLowerCase() || "";
            const resultId = result._id?.toString().toLowerCase() || "";

            return (
              userName.includes(term) ||
              userEmail.includes(term) ||
              resultId.includes(term)
            );
          } catch (error) {
            logger.warn("Error filtering result:", {
              error: error.message,
              result,
            });
            return false; // Skip this result if there's an error
          }
        });
      }

      // Sort by percentage score (highest to lowest)
      filtered.sort((a, b) => {
        const scoreA = a.percentage || 0;
        const scoreB = b.percentage || 0;
        return scoreB - scoreA; // Descending order (highest first)
      });

      // Log sorting verification for debugging
      if (filtered.length > 0) {
        logger.info("Results sorted by score (highest to lowest):", {
          topScore: filtered[0]?.percentage || 0,
          bottomScore: filtered[filtered.length - 1]?.percentage || 0,
          totalResults: filtered.length,
          sampleScores: filtered.slice(0, 5).map((r) => r.percentage),
        });
      }

      return filtered;
    },

    paginatedResults() {
      const start = (this.currentPage - 1) * this.perPage;
      const end = start + this.perPage;
      return this.filteredResults.slice(start, end);
    },

    totalPages() {
      return Math.ceil(this.filteredResults.length / this.perPage);
    },

    visiblePages() {
      const pages = [];
      const total = this.totalPages;
      const current = this.currentPage;

      // Show up to 5 pages
      let start = Math.max(1, current - 2);
      let end = Math.min(total, start + 4);

      // Adjust start if we're near the end
      if (end - start < 4) {
        start = Math.max(1, end - 4);
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      return pages;
    },
  },
  watch: {
    searchTerm() {
      this.currentPage = 1;
    },
    statusFilter() {
      this.currentPage = 1;
    },
  },
  async mounted() {
    await this.loadExams();
  },
  methods: {
    async loadExams() {
      try {
        this.loading = true;
        this.error = null;
        logger.info("Loading exams...");
        const response = await apiService.getExams();
        logger.info("Exams response:", response);
        this.exams = response.exams || [];
        logger.info("Loaded exams count:", this.exams.length);
      } catch (error) {
        logger.error("Failed to load exams:", error);
        logger.error("Exam loading error details:", {
          error: error.message,
          stack: error.stack,
        });
        this.error =
          "Failed to load exams: " + (error.message || "Unknown error");
      } finally {
        this.loading = false;
      }
    },

    async loadExamResults() {
      if (!this.selectedExamId) {
        this.results = [];
        this.statistics = null;
        return;
      }

      try {
        this.loading = true;
        this.error = null;

        logger.info("Loading exam results for exam:", this.selectedExamId);
        const response = await apiService.getExamResults(this.selectedExamId);
        logger.info("Exam results response:", response);

        this.results = response.results || [];
        this.statistics = response.statistics || {
          totalStudents: 0,
          averageScore: 0,
          passRate: 0,
          highestScore: 0,
        };

        logger.info("Loaded results count:", this.results.length);
        logger.info("Statistics:", this.statistics);

        this.currentPage = 1;
      } catch (error) {
        logger.error("Failed to load exam results:", error);
        logger.error("Exam results loading error details:", {
          error: error.message,
          stack: error.stack,
          examId: this.selectedExam?._id,
        });
        this.error =
          "Failed to load exam results: " + (error.message || "Unknown error");
        this.results = [];
        this.statistics = null;
      } finally {
        this.loading = false;
      }
    },

    getUserDisplayName(userId) {
      // In a real app, you'd look this up from a user service
      // For now, return the userId or a formatted version
      if (!userId) return "Unknown User";
      if (typeof userId === "object" && userId.firstName && userId.lastName) {
        return `${userId.firstName} ${userId.lastName}`;
      }
      if (typeof userId === "object" && userId.email) {
        return userId.email;
      }
      return userId.toString() || "Unknown User";
    },

    getUserId(userObj) {
      // Extract the actual user ID from user object
      if (!userObj) return null;
      if (typeof userObj === "string") return userObj;
      if (typeof userObj === "object") {
        // For populated user objects from MongoDB, use _id
        return userObj._id || userObj.id || userObj.userId || null;
      }
      return null;
    },

    getExamTitle(examId) {
      // Get exam title from the exams array using examId
      if (!examId) return "Unknown Exam";

      // Handle both string IDs and object IDs
      const searchId =
        typeof examId === "object" ? examId._id || examId.toString() : examId;

      const exam = this.exams.find(
        (exam) => exam._id === searchId || exam.id === searchId
      );

      return exam?.title || "Unknown Exam";
    },

    getSerialNumber(index) {
      // Calculate the serial number based on current page and index
      return (this.currentPage - 1) * this.perPage + index + 1;
    },

    getGradeClass(status) {
      switch (status?.toLowerCase()) {
        case "pass":
          return "bg-success";
        case "fail":
          return "bg-danger";
        default:
          return "bg-secondary";
      }
    },

    getStatusClass(status) {
      switch (status?.toLowerCase()) {
        case "pass":
          return "bg-success";
        case "fail":
          return "bg-danger";
        default:
          return "bg-secondary";
      }
    },

    formatDate(dateString) {
      if (!dateString) return "-";
      return new Date(dateString).toLocaleString();
    },

    changePage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
      }
    },

    async exportResults() {
      try {
        this.loading = true;

        // Show confirmation dialog
        const { isConfirmed } = await Swal.fire({
          title: "Export Results?",
          text: "This will generate a PDF with all exam results for download.",
          icon: "question",
          showCancelButton: true,
          confirmButtonColor: "#007bff",
          cancelButtonColor: "#6c757d",
          confirmButtonText: "Yes, export results!",
          cancelButtonText: "Cancel",
        });

        if (!isConfirmed) {
          return;
        }

        // Show loading message
        Swal.fire({
          title: "Generating PDF...",
          text: "Please wait while we prepare your exam results export.",
          icon: "info",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        await apiService.exportExamResultsPDF(this.selectedExamId);

        // Show success message
        await Swal.fire({
          title: "Success!",
          text: "Exam results PDF has been downloaded successfully!",
          icon: "success",
          confirmButtonColor: "#007bff",
          timer: 3000,
          timerProgressBar: true,
        });
      } catch (error) {
        logger.error("Failed to export results:", error);

        await Swal.fire({
          title: "Error!",
          text: "Failed to export results. Please try again.",
          icon: "error",
          confirmButtonColor: "#007bff",
        });
      } finally {
        this.loading = false;
      }
    },

    async releaseResults() {
      const { isConfirmed } = await Swal.fire({
        title: "Release Results?",
        text: "This will make all exam results visible to students and send email notifications to each student with their results. Are you sure?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#007bff",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Yes, release them!",
        cancelButtonText: "Cancel",
      });

      if (!isConfirmed) {
        return;
      }

      try {
        this.loading = true;
        await apiService.post(`/exams/${this.selectedExamId}/release-results`);

        await Swal.fire({
          title: "Success!",
          text: "Results have been released to students and email notifications have been sent!",
          icon: "success",
          confirmButtonColor: "#007bff",
          timer: 4000,
          timerProgressBar: true,
        });

        await this.loadExamResults(); // Refresh data
      } catch (error) {
        logger.error("Failed to release results:", error);

        await Swal.fire({
          title: "Error!",
          text: "Failed to release results. Please try again.",
          icon: "error",
          confirmButtonColor: "#007bff",
        });
      } finally {
        this.loading = false;
      }
    },

    viewDetails(result) {
      // Create detailed result display modal
      logger.info("View details for result:", {
        resultId: result._id,
        userId: result.userId?._id,
      });

      const studentName = this.getUserDisplayName(result.userId);
      const examTitle = this.getExamTitle(result.examId);
      const submittedAt = result.attemptId?.submittedAt
        ? this.formatDate(result.attemptId.submittedAt)
        : "Not available";
      const gradedAt = result.gradedAt
        ? this.formatDate(result.gradedAt)
        : "Not available";

      const htmlContent = `
        <div class="text-start">
          <div class="row mb-3">
            <div class="col-5"><strong>Student:</strong></div>
            <div class="col-7">${studentName}</div>
          </div>
          <div class="row mb-3">
            <div class="col-5"><strong>Email:</strong></div>
            <div class="col-7">${result.userId?.email || "Not available"}</div>
          </div>
          <div class="row mb-3">
            <div class="col-5"><strong>Exam:</strong></div>
            <div class="col-7">${examTitle}</div>
          </div>
          <div class="row mb-3">
            <div class="col-5"><strong>Score:</strong></div>
            <div class="col-7">
              <span class="badge bg-${
                result.status === "pass" ? "success" : "danger"
              } fs-6">
                ${result.correctAnswers}/${result.totalQuestions} (${
        result.percentage
      }%)
              </span>
            </div>
          </div>
          <div class="row mb-3">
            <div class="col-5"><strong>Status:</strong></div>
            <div class="col-7">
              <span class="badge bg-${
                result.status === "pass" ? "success" : "danger"
              }">
                ${result.status.toUpperCase()}
              </span>
            </div>
          </div>
          <div class="row mb-3">
            <div class="col-5"><strong>Submitted:</strong></div>
            <div class="col-7">${submittedAt}</div>
          </div>
          <div class="row mb-3">
            <div class="col-5"><strong>Graded:</strong></div>
            <div class="col-7">${gradedAt}</div>
          </div>
          <div class="row mb-3">
            <div class="col-5"><strong>Result ID:</strong></div>
            <div class="col-7"><code>${result._id}</code></div>
          </div>
        </div>
      `;

      Swal.fire({
        title: `<i class="bi bi-person-circle me-2"></i>Exam Result Details`,
        html: htmlContent,
        icon: null,
        width: "600px",
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-download me-1"></i>Download PDF',
        cancelButtonText: "Close",
        confirmButtonColor: "#007bff",
        cancelButtonColor: "#6c757d",
        customClass: {
          popup: "text-start",
        },
      }).then((swalResult) => {
        if (swalResult.isConfirmed) {
          this.downloadResult(result);
        }
      });
    },

    async downloadResult(result) {
      try {
        this.loading = true;
        const response = await apiService.downloadExamResultPDF(result._id);

        // Show success message
        await Swal.fire({
          title: "Success!",
          text: "Exam result PDF has been downloaded successfully!",
          icon: "success",
          confirmButtonColor: "#007bff",
          timer: 2000,
          timerProgressBar: true,
        });
      } catch (error) {
        logger.error("Failed to download result:", error);

        await Swal.fire({
          title: "Error!",
          text: "Failed to download result. Please try again.",
          icon: "error",
          confirmButtonColor: "#007bff",
        });
      } finally {
        this.loading = false;
      }
    },

    async regrade(result) {
      const actualUserId = this.getUserId(result.userId);
      if (!actualUserId) {
        await Swal.fire({
          title: "Error!",
          text: "Unable to identify user for regrading.",
          icon: "error",
          confirmButtonColor: "#007bff",
        });
        return;
      }

      const { isConfirmed } = await Swal.fire({
        title: "Confirm Regrade",
        text: `Are you sure you want to regrade ${this.getUserDisplayName(
          result.userId
        )}'s exam?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#007bff",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Yes, regrade it!",
        cancelButtonText: "Cancel",
      });

      if (!isConfirmed) {
        return;
      }

      try {
        this.loading = true;
        const response = await apiService.regradeUserExam(
          this.selectedExamId,
          actualUserId
        );

        // Use the message from the backend response
        const message =
          response.message || "Exam has been regraded successfully!";
        const isImmediate = response.processedSynchronously;

        await Swal.fire({
          title: "Success!",
          text: message,
          icon: "success",
          confirmButtonColor: "#007bff",
          timer: isImmediate ? 4000 : 3000, // Longer timer for immediate processing messages
          timerProgressBar: true,
        });

        await this.loadExamResults(); // Refresh data
      } catch (error) {
        logger.error("Failed to regrade exam:", error);

        await Swal.fire({
          title: "Error!",
          text: "Failed to regrade exam. Please try again.",
          icon: "error",
          confirmButtonColor: "#007bff",
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <div class="exam-results">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h4>
        <i class="bi bi-trophy me-2"></i>
        Exam Results
      </h4>
      <div class="d-flex gap-2" v-if="selectedExamId">
        <button
          class="btn btn-outline-acon-primary"
          @click="exportResults"
          :disabled="filteredResults.length === 0"
        >
          <i class="bi bi-download me-1"></i>
          Export Results
        </button>
        <button
          class="btn btn-acon-primary"
          @click="releaseResults"
          :disabled="filteredResults.length === 0"
        >
          <i class="bi bi-send me-1"></i>
          Release Results
        </button>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="row mb-4">
      <div class="col-md-4">
        <select
          v-model="selectedExamId"
          class="form-select"
          @change="loadExamResults"
        >
          <option value="">-- Select Exam --</option>
          <option v-for="exam in exams" :key="exam._id" :value="exam._id">
            {{ exam.title }}
          </option>
        </select>
        <!-- Show error if loading exams failed -->
        <div v-if="error" class="text-danger small mt-1">
          {{ error }}
        </div>
      </div>
      <div class="col-md-2">
        <select v-model="statusFilter" class="form-select">
          <option value="">All Status</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
        </select>
      </div>
      <div class="col-md-6">
        <div class="input-group">
          <span class="input-group-text">
            <i class="bi bi-search"></i>
          </span>
          <input
            v-model="searchTerm"
            type="text"
            class="form-control"
            placeholder="Search by student name or email..."
          />
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="row mb-4" v-if="selectedExamId && statistics">
      <div class="col-md-3">
        <div class="card p-0 border-0 bg-light">
          <div class="card-body text-center">
            <h3 class="mb-1 fw-bold text-secondary">
              {{ statistics.totalStudents }}
            </h3>
            <small class="text-muted">Total Students</small>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card p-0 border-0 bg-light">
          <div class="card-body text-center">
            <h3 class="mb-1 fw-bold text-secondary">
              {{ statistics.averageScore }}%
            </h3>
            <small class="text-muted">Average Score</small>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card p-0 border-0 bg-light">
          <div class="card-body text-center">
            <h3
              class="mb-1 fw-bold text-secondary"
              :class="
                statistics.passRate > 50.0 ? `text-success` : `text-danger`
              "
            >
              {{ statistics.passRate }}%
            </h3>
            <small class="text-muted">Pass Rate</small>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card p-0 border-0 bg-light">
          <div class="card-body text-center">
            <h3 class="mb-1 fw-bold text-secondary">
              {{ statistics.highestScore }}%
            </h3>
            <small class="text-muted">Highest Score</small>
          </div>
        </div>
      </div>
    </div>

    <!-- No Exam Selected -->
    <div v-if="!selectedExamId" class="text-center py-5">
      <i class="bi bi-clipboard-data display-4 text-muted"></i>
      <h5 class="mt-3 text-muted">Select an Exam</h5>
      <p class="text-muted">
        Choose an exam from the dropdown above to view results
      </p>
    </div>

    <!-- Loading State -->
    <div v-else-if="loading" class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2 text-muted">Loading exam results...</p>
    </div>

    <!-- No Results -->
    <div v-else-if="results.length === 0" class="text-center py-4">
      <i class="bi bi-inbox display-4 text-muted"></i>
      <h5 class="mt-3 text-muted">No Results Available</h5>
      <p class="text-muted">
        This exam has no results yet. Results will appear here once students
        complete the exam and it's graded.
      </p>
    </div>

    <!-- Results Table -->
    <div v-else-if="results.length > 0" class="card p-0 bg-light border-0">
      <div class="card-body">
        <div v-if="filteredResults.length === 0" class="text-center py-4">
          <i class="bi bi-search display-4 text-muted"></i>
          <h5 class="mt-3 text-muted">No Results Match Your Filter</h5>
          <p class="text-muted">
            Try adjusting your search or filter criteria.
          </p>
        </div>

        <div v-else>
          <table class="table table-light table-hover table-borderless caption-top">
            <caption>
              <!-- Show sorting info when exam is selected -->
              <div
                v-if="selectedExamId && results.length > 0"
                class="text-muted small"
              >
                <i class="bi bi-info-circle me-1"></i>
                Results are automatically sorted by highest to lowest score
              </div>
            </caption>
            <thead class="border-bottom">
              <tr>
                <th>#</th>
                <th>User</th>
                <th>
                  Score
                  <i
                    class="bi bi-sort-down text-primary"
                    title="Sorted by highest to lowest score"
                  ></i>
                </th>
                <th>Grade</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(result, index) in paginatedResults" :key="result._id">
                <td>
                  <span class="fw-semibold text-muted">{{
                    getSerialNumber(index)
                  }}</span>
                </td>
                <td>
                  <div class="d-flex align-items-center">
                    <div
                      class="avatar-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2"
                    >
                      {{
                        (getUserDisplayName(result.userId) || "U")
                          .charAt(0)
                          .toUpperCase()
                      }}
                    </div>
                    <div>
                      <div class="fw-semibold">
                        {{ getUserDisplayName(result.userId) }}
                      </div>
                      <small class="text-muted">{{
                        result.userId.email
                      }}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="fw-semibold">{{ result.percentage }}%</span>
                  <small class="text-muted d-block"
                    >{{ result.correctAnswers }}/{{
                      result.totalQuestions
                    }}</small
                  >
                </td>
                <td>
                  <span class="badge" :class="getGradeClass(result.status)">
                    {{ result.status.toUpperCase() }}
                  </span>
                </td>
                <td>
                  <span class="badge" :class="getStatusClass(result.status)">
                    {{ result.status }}
                  </span>
                </td>
                <td>
                  <span v-if="result.attemptId?.submittedAt">{{
                    formatDate(result.attemptId.submittedAt)
                  }}</span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <div class="dropdown">
                    <button
                      class="btn btn-sm btn-outline-secondary dropdown-toggle"
                      type="button"
                      data-bs-toggle="dropdown"
                    >
                      Actions
                    </button>
                    <ul class="dropdown-menu">
                      <li>
                        <a
                          class="dropdown-item"
                          href="#"
                          @click="viewDetails(result)"
                        >
                          <i class="bi bi-eye me-2"></i>View Details
                        </a>
                      </li>
                      <li>
                        <a
                          class="dropdown-item"
                          href="#"
                          @click="downloadResult(result)"
                        >
                          <i class="bi bi-download me-2"></i>Download PDF
                        </a>
                      </li>
                      <li><hr class="dropdown-divider" /></li>
                      <li>
                        <a
                          class="dropdown-item text-warning"
                          href="#"
                          @click="regrade(result)"
                        >
                          <i class="bi bi-arrow-clockwise me-2"></i>Regrade
                        </a>
                      </li>
                    </ul>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination -->
          <nav v-if="totalPages > 1" class="mt-4">
            <ul class="pagination pagination-sm justify-content-center">
              <li class="page-item" :class="{ disabled: currentPage === 1 }">
                <a
                  class="page-link"
                  href="#"
                  @click.prevent="changePage(currentPage - 1)"
                  >Previous</a
                >
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
                  @click.prevent="changePage(page)"
                  >{{ page }}</a
                >
              </li>
              <li
                class="page-item"
                :class="{ disabled: currentPage === totalPages }"
              >
                <a
                  class="page-link"
                  href="#"
                  @click.prevent="changePage(currentPage + 1)"
                  >Next</a
                >
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.avatar-sm {
  width: 32px;
  height: 32px;
  font-size: 14px;
}

.table th {
  border-top: none;
  font-weight: 600;
  color: #495057;
}

.dropdown-toggle::after {
  margin-left: 0.5em;
}

.exam-results {
  min-height: 400px;
}
</style>
