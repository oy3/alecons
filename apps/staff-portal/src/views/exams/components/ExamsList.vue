<script>
import { useAuthStore } from "../../../stores/auth.js";
import { apiService } from "../../../services/api.js";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";

export default {
  name: "ExamsList",
  emits: ["edit-exam", "view-statistics", "create-exam"],
  setup() {
    const authStore = useAuthStore();
    return { authStore };
  },
  data() {
    return {
      exams: [],
      examGradingStatuses: {}, // Store grading status for each exam
      academicSessions: [],
      isLoading: true,
      searchQuery: "",
      searchTimeout: null,
      statusFilter: "all",
      sessionFilter: "all",
      currentPage: 1,
      perPage: 10,
      totalExams: 0,
    };
  },
  computed: {
    filteredExams() {
      let filtered = this.exams || [];

      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (exam) =>
            exam.title.toLowerCase().includes(query) ||
            exam.description.toLowerCase().includes(query)
        );
      }

      if (this.statusFilter !== "all") {
        filtered = filtered.filter((exam) => exam.status === this.statusFilter);
      }

      if (this.sessionFilter !== "all") {
        filtered = filtered.filter(
          (exam) => exam.academicSession?._id === this.sessionFilter
        );
      }

      return filtered;
    },

    paginatedExams() {
      const start = (this.currentPage - 1) * this.perPage;
      const end = start + this.perPage;
      const paginated = this.filteredExams.slice(start, end);

      return paginated;
    },

    totalPages() {
      return Math.ceil(this.filteredExams.length / this.perPage);
    },

    visiblePages() {
      const total = this.totalPages;
      const current = this.currentPage;
      const delta = 2;
      const range = [];
      const rangeWithDots = [];

      for (
        let i = Math.max(2, current - delta);
        i <= Math.min(total - 1, current + delta);
        i++
      ) {
        range.push(i);
      }

      if (current - delta > 2) {
        rangeWithDots.push(1, "...");
      } else {
        rangeWithDots.push(1);
      }

      rangeWithDots.push(...range);

      if (current + delta < total - 1) {
        rangeWithDots.push("...", total);
      } else {
        rangeWithDots.push(total);
      }

      return rangeWithDots;
    },
  },
  async mounted() {
    await this.loadData();
  },
  methods: {
    async loadData() {
      await Promise.all([this.loadAcademicSessions(), this.loadExams()]);
    },

    async loadAcademicSessions() {
      try {
        const response = await apiService.getAcademicSessions();
        if (response.success) {
          this.academicSessions = response.data.sessions || [];
        }
      } catch (error) {
        logger.error("Error loading academic sessions:", error);
      }
    },

    async loadExams() {
      try {
        logger.info("Loading exams with auth token:", !!this.authStore.token);
        this.isLoading = true;
        const params = {
          page: this.currentPage,
          limit: this.perPage,
        };

        if (this.statusFilter !== "all") {
          params.status = this.statusFilter;
        }
        if (this.sessionFilter !== "all") {
          params.academicSession = this.sessionFilter;
        }

        const response = await apiService.getExams(params);

        if (response.success) {
          this.exams = response.exams || [];
          this.totalExams = response.total || response.exams?.length || 0;
          logger.info("Exams loaded successfully:", this.exams.length, "exams");
          
          // Load grading status for completed exams
          this.loadGradingStatusForExams();
        } else {
          logger.error("API returned unsuccessful response:", response);
        }
      } catch (error) {
        logger.error("Error loading exams:", error);

        // Handle authentication errors
        if (
          error.message.includes("Unauthorized") ||
          error.message.includes("401")
        ) {
          this.authStore.handleAuthError();
          return;
        }

        Swal.fire({
          icon: "error",
          title: "Loading Failed",
          text: error.message || "Failed to load exams. Please try again.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.isLoading = false;
      }
    },

    handleSearch() {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.currentPage = 1; // Reset to first page
      }, 500);
    },

    refreshExams() {
      this.currentPage = 1;
      this.loadExams();
    },

    changePage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
      }
    },

    viewExam(exam) {
      // Navigate to exam details page or show modal
      this.$router.push(`/exams/${exam._id}`);
    },

    editExam(exam) {
      this.$emit("edit-exam", exam);
    },

    viewStatistics(exam) {
      this.$emit("view-statistics", exam);
    },

    async loadGradingStatus(examId) {
      try {
        // Ensure API service has the latest token
        if (this.authStore.token) {
          apiService.setToken(this.authStore.token);
        }
        
        const response = await apiService.getExamGradingStatus(examId);
        if (response.success) {
          // Use Vue 3 reactive assignment instead of this.$set
          this.examGradingStatuses[examId] = response.data;
          return response.data;
        } else {
          logger.error(`Failed to get grading status for exam ${examId}:`, response);
          return null;
        }
      } catch (error) {
        logger.error(`Error loading grading status for exam ${examId}:`, error.message || error);
        return null;
      }
    },

    async loadGradingStatusForExams() {
      // Ensure authentication is ready before loading grading status
      if (!this.authStore.token) {
        logger.warn('Cannot load grading status: no auth token available');
        return;
      }

      // Load grading status for completed exams in parallel
      const completedExams = this.exams.filter(exam => exam.status === 'completed');
      if (completedExams.length === 0) {
        logger.info('No completed exams found, skipping grading status check');
        return;
      }

      logger.info(`Loading grading status for ${completedExams.length} completed exams`);
      
      const statusPromises = completedExams.map(exam => this.loadGradingStatus(exam._id));
      
      try {
        await Promise.all(statusPromises);
        logger.info('Grading status loaded for all completed exams');
      } catch (error) {
        logger.error("Error loading grading statuses:", error);
      }
    },

    async gradeExam(exam) {
      // Get grading status to determine the appropriate action
      const status = await this.loadGradingStatus(exam._id);
      
      const isRegrade = status && status.recommendedAction === 'regrade-all';
      const actionText = isRegrade ? 'regrade' : 'grade';
      const actionTextCap = isRegrade ? 'Regrade' : 'Grade';

      const result = await Swal.fire({
        title: `${actionTextCap} All Attempts`,
        text: `This will ${actionText} all attempts for "${exam.title}". Continue?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: `Yes, ${actionTextCap} All`,
        cancelButtonText: "Cancel",
        confirmButtonColor: "#1a5f5f",
      });

      if (result.isConfirmed) {
        // Show loading indicator
        const loadingAlert = Swal.fire({
          title: `${actionTextCap}ing in Progress...`,
          text: `Please wait while we ${actionText} all attempts for "${exam.title}"`,
          icon: "info",
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        try {
          logger.info(`Starting ${actionText} process for exam ${exam._id}`);
          
          const response = isRegrade 
            ? await apiService.regradeExam(exam._id)
            : await apiService.gradeExam(exam._id);
            
          logger.info(`${actionTextCap} API response:`, response);
          
          // Close loading alert
          Swal.close();
            
          if (response.success) {
            const message = response.message || `${actionTextCap}ing job has been queued. Results will be available shortly.`;
            const processedCount = response.attemptsProcessed || 0;
            const totalCount = response.totalAttempts || 0;
            
            Swal.fire({
              icon: "success",
              title: `${actionTextCap}ing Completed`,
              text: `${message} (${processedCount}/${totalCount} attempts processed)`,
              confirmButtonColor: "#1a5f5f",
            });
            this.loadExams();
          } else {
            logger.error(`${actionTextCap} failed:`, response);
            Swal.fire({
              icon: "warning",
              title: `${actionTextCap}ing Incomplete`,
              text: response.message || `Some ${actionText}ing jobs may have failed.`,
              confirmButtonColor: "#f39c12",
            });
          }
        } catch (error) {
          // Close loading alert in case of error
          Swal.close();
          
          logger.error(`${actionTextCap} error:`, error);
          Swal.fire({
            icon: "error",
            title: `${actionTextCap}ing Failed`,
            text: `Failed to start ${actionText}ing process: ${error.message || error}`,
            confirmButtonColor: "#dc3545",
          });
        }
      }
    },

    getGradingButtonText(exam) {
      const status = this.examGradingStatuses[exam._id];
      if (!status) return 'Grade All';
      
      return status.recommendedAction === 'regrade-all' ? 'Regrade All' : 'Grade All';
    },

    shouldShowGradingButton(exam) {
      if (exam.status !== 'completed') return false;
      
      const status = this.examGradingStatuses[exam._id];
      if (!status) return true; // Show button while loading status
      
      return status.canGrade || status.canRegrade;
    },

    async releaseResults(exam) {
      const result = await Swal.fire({
        title: "Release Results",
        text: `Release results for "${exam.title}" to students?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes, Release",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#1a5f5f",
      });

      if (result.isConfirmed) {
        try {
          const response = await apiService.releaseExamResults(exam._id);
          if (response.success) {
            Swal.fire({
              icon: "success",
              title: "Results Released",
              text: "Results have been released to students.",
              confirmButtonColor: "#1a5f5f",
            });
            this.loadExams();
          }
        } catch (error) {
          Swal.fire({
            icon: "error",
            title: "Release Failed",
            text: "Failed to release results.",
            confirmButtonColor: "#dc3545",
          });
        }
      }
    },

    async deleteExam(exam) {
      const result = await Swal.fire({
        title: "Delete Exam",
        text: `Are you sure you want to delete "${exam.title}"? This action cannot be undone.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, Delete",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#dc3545",
      });

      if (result.isConfirmed) {
        try {
          const response = await apiService.deleteExam(exam._id);
          if (response.success) {
            Swal.fire({
              icon: "success",
              title: "Exam Deleted",
              text: "Exam has been deleted successfully.",
              confirmButtonColor: "#1a5f5f",
            });
            this.loadExams();
          }
        } catch (error) {
          Swal.fire({
            icon: "error",
            title: "Delete Failed",
            text: "Failed to delete exam.",
            confirmButtonColor: "#dc3545",
          });
        }
      }
    },

    async regeneratePassword(exam) {
      const result = await Swal.fire({
        title: "Regenerate Exam Password",
        html: `
          <p>Are you sure you want to regenerate the password for "<strong>${exam.title}</strong>"?</p>
          <div class="alert alert-warning text-start mt-3">
            <i class="bi bi-exclamation-triangle me-2"></i>
            <strong>Important:</strong>
            <ul class="mb-0 mt-2">
              <li>The current password will be deactivated</li>
              <li>A new password will be generated and sent to all target users</li>
              <li>Only exams with status: draft, scheduled, or in-progress can have passwords regenerated</li>
            </ul>
          </div>
        `,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes, Regenerate",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#ffc107",
        width: "500px",
      });

      if (result.isConfirmed) {
        try {
          // Show loading state
          Swal.fire({
            title: "Regenerating Password...",
            html: "Please wait while we regenerate the password and send notifications.",
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });

          const response = await apiService.regenerateExamPassword(exam._id);

          if (response.success) {
            Swal.fire({
              icon: "success",
              title: "Password Regenerated!",
              html: `
                <p>New password has been generated successfully.</p>
                <div class="alert alert-info text-start mt-3">
                  <i class="bi bi-info-circle me-2"></i>
                  <strong>New Password:</strong>
                  <div class="mt-2">
                    <code style="font-size: 18px; font-weight: bold; color: #0066cc; background: #f8f9fa; padding: 8px; border-radius: 4px; display: block; text-align: center;">${response.password}</code>
                  </div>
                  <small class="text-muted mt-2 d-block">Password notifications have been sent to all target users.</small>
                </div>
              `,
              confirmButtonColor: "#28a745",
              width: "500px",
            });

            // Refresh exams list to show updated status
            this.loadExams();
          } else {
            throw new Error(response.message);
          }
        } catch (error) {
          Swal.fire({
            icon: "error",
            title: "Regeneration Failed",
            text:
              error.message ||
              "Failed to regenerate exam password. Please check the exam status and try again.",
            confirmButtonColor: "#dc3545",
          });
        }
      }
    },

    async sendEmailNotifications(exam) {
      const result = await Swal.fire({
        title: "Send Exam Reminder",
        icon: "question",
        html: `
          <p>Send exam reminder notifications to all target users for "<strong>${exam.title}</strong>"?</p>
          <div style="text-align: left; margin: 15px 0;">
            <strong>This will send:</strong>
            <ul style="margin-top: 5px;">
              <li>Exam schedule and details</li>
              <li>Important instructions and reminders</li>
              <li>Portal login instructions (login 15 minutes early)</li>
              <li>No password included (use "Regenerate Password" if needed)</li>
            </ul>
          </div>
        `,
        showCancelButton: true,
        confirmButtonColor: "#0066cc",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Yes, Send Reminders",
        cancelButtonText: "Cancel",
      });

      if (result.isConfirmed) {
        try {
          // Show loading
          Swal.fire({
            title: "Sending Reminders...",
            html: "Please wait while we send exam reminder emails to all target users.",
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });

          const response = await apiService.sendScheduledExamEmail(exam._id);

          if (response.success) {
            Swal.fire({
              icon: "success",
              title: "Reminders Sent!",
              html: `
                <p>Exam reminder emails sent successfully.</p>
                <div style="text-align: left; margin: 15px 0;">
                  <strong>Summary:</strong>
                  <ul style="margin-top: 5px;">
                    <li><strong>Emails sent:</strong> ${response.emailsSent}/${
                response.recipientCount
              }</li>
                    ${
                      response.errors && response.errors.length > 0
                        ? `<li><strong>Errors:</strong> ${response.errors.length}</li>`
                        : ""
                    }
                  </ul>
                </div>
                ${
                  response.errors && response.errors.length > 0
                    ? `
                  <div style="text-align: left; margin-top: 10px;">
                    <details>
                      <summary>View Errors</summary>
                      <ul style="font-size: 12px; margin-top: 5px;">
                        ${response.errors
                          .map((error) => `<li>${error}</li>`)
                          .join("")}
                      </ul>
                    </details>
                  </div>
                `
                    : ""
                }
              `,
              confirmButtonColor: "#0066cc",
              confirmButtonText: "OK",
            });

            // Refresh exams list to show any updates
            this.loadExams();
          } else {
            throw new Error(response.message || "Failed to send notifications");
          }
        } catch (error) {
          Swal.fire({
            icon: "error",
            title: "Sending Failed",
            text:
              error.message ||
              "Failed to send exam reminder emails. Please check the exam status and try again.",
            confirmButtonColor: "#dc3545",
          });
        }
      }
    },

    // Utility methods
    formatDateTime(dateString) {
      return new Date(dateString).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },

    formatTargetType(type) {
      const types = {
        applicants: "Applicants",
        students: "Students",
        staff: "Staff",
        custom: "Custom",
      };
      return types[type] || type;
    },

    getStatusBadgeClass(status) {
      const classes = {
        draft: "bg-secondary",
        scheduled: "bg-primary",
        "in-progress": "bg-warning text-dark",
        completed: "bg-info",
        graded: "bg-success",
      };
      return classes[status] || "bg-secondary";
    },

    canEditExam(exam) {
      return (
        ["draft", "scheduled"].includes(exam.status) &&
        this.authStore.hasPermission("exams", "edit")
      );
    },

    canDeleteExam(exam) {
      return (
        exam.status === "draft" &&
        this.authStore.hasPermission("exams", "delete")
      );
    },

    canRegeneratePassword(exam) {
      return (
        ["draft", "scheduled", "in-progress"].includes(exam.status) &&
        this.authStore.hasPermission("exams", "manage")
      );
    },
  },
};
</script>

<template>
  <div class="exams-list">
    <!-- Filters and Search -->
    <div class="row mb-4">
      <div class="col-md-4">
        <div class="input-group">
          <span class="input-group-text">
            <i class="bi bi-search"></i>
          </span>
          <input
            type="text"
            class="form-control"
            placeholder="Search exams..."
            v-model="searchQuery"
            @input="handleSearch"
          />
        </div>
      </div>
      <div class="col-md-3">
        <select class="form-select" v-model="statusFilter" @change="loadExams">
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="graded">Graded</option>
        </select>
      </div>
      <div class="col-md-3">
        <select class="form-select" v-model="sessionFilter" @change="loadExams">
          <option value="all">All Sessions</option>
          <option
            v-for="session in academicSessions"
            :key="session._id"
            :value="session._id"
          >
            {{ session.sessionYear }}
          </option>
        </select>
      </div>
      <div class="col-md-2">
        <button class="btn btn-outline-secondary w-100" @click="refreshExams">
          <i class="bi bi-arrow-clockwise me-1"></i>
          Refresh
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-3">Loading exams...</p>
    </div>

    <!-- Exams Table -->
    <div v-else-if="exams && exams.length > 0" class="card p-0">
      <div class="card-body p-0">
        <table class="table table-hover mb-0">
          <thead class="table-light">
            <tr>
              <th>Title</th>
              <th>Session</th>
              <th>Target</th>
              <th>Schedule</th>
              <th>Duration</th>
              <th>Questions</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="exam in paginatedExams" :key="exam._id">
              <td>
                <div>
                  <strong>{{ exam.title }}</strong>
                  <br />
                  <small class="text-muted"
                    >{{ exam.description.substring(0, 60)
                    }}{{ exam.description.length > 60 ? "..." : "" }}</small
                  >
                </div>
              </td>
              <td>
                <span class="badge bg-light text-dark">
                  {{ exam.academicSession?.sessionYear || "N/A" }}
                </span>
              </td>
              <td>
                <div>
                  <small class="text-muted d-block">{{
                    formatTargetType(exam.target.type)
                  }}</small>
                  <span
                    v-if="exam.target?.filter?.programs?.length > 0"
                    class="badge bg-info"
                  >
                    {{ exam.target.filter.programs.length }} Program(s)
                  </span>
                </div>
              </td>
              <td>
                <div>
                  <strong>{{ formatDateTime(exam.examTimestamp) }}</strong>
                  <br />
                  <small class="text-muted">{{
                    formatDate(exam.examTimestamp)
                  }}</small>
                </div>
              </td>
              <td>
                <span class="badge bg-secondary">{{ exam.duration }}min</span>
              </td>
              <td>
                <div class="text-center">
                  <strong>{{ exam.totalQuestions }}</strong>
                  <br />
                  <small class="text-muted">{{ exam.totalMark }} marks</small>
                </div>
              </td>
              <td>
                <span class="badge" :class="getStatusBadgeClass(exam.status)">
                  {{
                    exam.status.charAt(0).toUpperCase() + exam.status.slice(1)
                  }}
                </span>
              </td>
              <td>
                <div class="btn-group">
                  <button
                    class="btn btn-sm btn-outline-primary"
                    @click="viewExam(exam)"
                    title="View Details"
                  >
                    <i class="bi bi-eye"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-outline-success"
                    @click="editExam(exam)"
                    title="Edit Exam"
                    v-if="canEditExam(exam)"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <div class="btn-group dropdown">
                    <button
                      class="btn btn-sm btn-outline-secondary dropdown-toggle"
                      data-bs-toggle="dropdown"
                    >
                      <!-- <i class="bi bi-three-dots"></i> -->
                    </button>
                    <ul class="dropdown-menu">
                      <li>
                        <button
                          class="dropdown-item"
                          @click="viewStatistics(exam)"
                        >
                          <i class="bi bi-graph-up me-2"></i>
                          Statistics
                        </button>
                      </li>
                      <li v-if="shouldShowGradingButton(exam)">
                        <button class="dropdown-item" @click="gradeExam(exam)">
                          <i class="bi bi-check-circle me-2"></i>
                          {{ getGradingButtonText(exam) }}
                        </button>
                      </li>
                      <li v-if="exam.status === 'graded'">
                        <button
                          class="dropdown-item"
                          @click="releaseResults(exam)"
                        >
                          <i class="bi bi-send me-2"></i>
                          Release Results
                        </button>
                      </li>
                      <li v-if="canRegeneratePassword(exam)">
                        <hr class="dropdown-divider" />
                        <button
                          class="dropdown-item text-warning"
                          @click="regeneratePassword(exam)"
                        >
                          <i class="bi bi-arrow-clockwise me-2"></i>
                          Regenerate Password
                        </button>
                      </li>
                      <li v-if="exam.status === 'scheduled'">
                        <button
                          class="dropdown-item text-info"
                          @click="sendEmailNotifications(exam)"
                        >
                          <i class="bi bi-envelope me-2"></i>
                          Send Exam Reminder
                        </button>
                      </li>
                      <li v-if="canDeleteExam(exam)">
                        <hr class="dropdown-divider" />
                        <button
                          class="dropdown-item text-danger"
                          @click="deleteExam(exam)"
                        >
                          <i class="bi bi-trash me-2"></i>
                          Delete
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-5">
      <i class="bi bi-file-text text-muted" style="font-size: 4rem"></i>
      <h4 class="text-muted mt-3">No Exams Found</h4>
      <p class="text-muted">Create your first exam to get started.</p>
      <button class="btn btn-primary" @click="$emit('create-exam')">
        <i class="bi bi-plus-circle me-1"></i>
        Create Exam
      </button>
    </div>

    <!-- Pagination -->
    <nav v-if="totalPages > 1" class="mt-4" aria-label="Exams pagination">
      <ul class="pagination justify-content-center">
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <button
            class="page-link"
            @click="changePage(currentPage - 1)"
            :disabled="currentPage === 1"
          >
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
        <li class="page-item" :class="{ disabled: currentPage === totalPages }">
          <button
            class="page-link"
            @click="changePage(currentPage + 1)"
            :disabled="currentPage === totalPages"
          >
            <i class="bi bi-chevron-right"></i>
          </button>
        </li>
      </ul>
    </nav>
  </div>
</template>

<style scoped>
.exams-list {
  min-height: 400px;
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

.btn-group .btn {
  padding: 0.25rem 0.5rem;
}

.pagination .page-link {
  color: #1a5f5f;
  border-color: #dee2e6;
}

.pagination .page-item.active .page-link {
  background-color: #1a5f5f;
  border-color: #1a5f5f;
}

.pagination .page-link:hover {
  background-color: #f8f9fa;
  border-color: #1a5f5f;
}
</style>
