<script>
import { useAuthStore } from "../../../stores/auth.js";
import { apiService } from "../../../services/api.js";
import { logger } from "@shared/utils/logger";

export default {
  name: "ExamAnalytics",
  setup() {
    const authStore = useAuthStore();
    return { authStore };
  },
  data() {
    return {
      analytics: null,
      academicSessions: [],
      subjects: [],
      isLoading: false,
      selectedSession: "",
      selectedSubject: "",
      selectedStatus: "",
    };
  },
  async mounted() {
    await this.loadAnalytics();
  },
  methods: {
    async loadAnalytics() {
      try {
        this.isLoading = true;
        // Simulate loading
        setTimeout(() => {
          this.analytics = {
            totalExams: 12,
            totalStudents: 245,
            totalAttempts: 287,
            averageScore: 78.5,
            passRate: 85.2,
            averageTime: 3600,
          };
          this.isLoading = false;
        }, 1000);
      } catch (error) {
        logger.error("Error loading analytics:", error);
        this.isLoading = false;
      }
    },

    formatTime(seconds) {
      if (!seconds) return "0m";
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    },
  },
};
</script>

<template>
  <div class="exam-analytics">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h4 class="mb-1">Exam Analytics</h4>
        <p class="text-muted mb-0">
          Comprehensive analytics and insights for exams
        </p>
      </div>
      <div class="d-flex gap-2">
        <!-- <button class="btn btn-outline-secondary">
          <i class="bi bi-calendar-range me-1"></i>
          Date Range
        </button> -->
        <button class="btn btn-outline-acon-primary">
          <i class="bi bi-download me-1"></i>
          Export Report
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="row mb-4">
      <div class="col-md-4">
        <label class="form-label">Academic Session</label>
        <select
          class="form-select"
          v-model="selectedSession"
          @change="loadAnalytics"
        >
          <option value="" disabled>-- Select Session --</option>
          <option
            v-for="session in academicSessions"
            :key="session._id"
            :value="session._id"
          >
            {{ session.sessionYear }}
          </option>
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label">Exam</label>
        <select
          class="form-select"
          v-model="selectedSubject"
          @change="loadAnalytics"
        >
          <option value="" disabled>-- Select Exam --</option>
          <option v-for="subject in subjects" :key="subject" :value="subject">
            {{ subject }}
          </option>
        </select>
      </div>
      <!-- <div class="col-md-4">
        <label class="form-label">Status</label>
        <select
          class="form-select"
          v-model="selectedStatus"
          @change="loadAnalytics"
        >
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="graded">Graded</option>
          <option value="in-progress">In Progress</option>
        </select>
      </div> -->
    </div>

    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-3">Loading analytics...</p>
    </div>

    <div v-else-if="analytics">
      <!-- Summary Cards -->
      <div class="row mb-4">
        <div class="col-md-2">
          <div class="card p-0 border-0 bg-light">
            <div class="card-body text-center">
              <h3 class="fw-bold text-secondary">
                {{ analytics.totalExams || 0 }}
              </h3>
              <small class="text-muted">Total Exams</small>
            </div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="card p-0 border-0 bg-light">
            <div class="card-body text-center">
              <h3 class="fw-bold text-secondary">
                {{ analytics.totalStudents || 0 }}
              </h3>
              <small class="text-muted">Total Students</small>
            </div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="card p-0 border-0 bg-light">
            <div class="card-body text-center">
              <h3 class="fw-bold text-secondary">
                {{ analytics.totalAttempts || 0 }}
              </h3>
              <small class="text-muted">Total Attempts</small>
            </div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="card p-0 border-0 bg-light">
            <div class="card-body text-center">
              <h3 class="fw-bold text-secondary">
                {{ Math.round(analytics.averageScore || 0) }}%
              </h3>
              <small class="text-muted">Avg Score</small>
            </div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="card p-0 border-0 bg-light">
            <div class="card-body text-center">
              <h3
                class="fw-bold text-secondary"
                :class="
                  Math.round(analytics.passRate || 0) > 50.0
                    ? `text-success`
                    : `text-danger`
                "
              >
                {{ Math.round(analytics.passRate || 0) }}%
              </h3>
              <small class="text-muted">Pass Rate</small>
            </div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="card p-0 border-0 bg-secondary text-white">
            <div class="card-body text-center">
              <h3 class="fw-bold">{{ formatTime(analytics.averageTime) }}</h3>
              <small>Avg Time</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts and detailed analytics would go here -->
      <div class="row">
        <div class="col-12">
          <div class="card p-0">
            <div class="card-header">
              <h6 class="mb-0">
                <i class="bi bi-graph-up me-2"></i>
                Analytics Dashboard
              </h6>
            </div>
            <div class="card-body">
              <div class="text-center py-5">
                <i
                  class="bi bi-graph-up text-muted"
                  style="font-size: 4rem"
                ></i>
                <h4 class="text-muted mt-3">Analytics Dashboard</h4>
                <p class="text-muted">
                  Detailed analytics and charts will be displayed here.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-5">
      <i class="bi bi-graph-up text-muted" style="font-size: 4rem"></i>
      <h4 class="text-muted mt-3">No Analytics Data</h4>
      <p class="text-muted">
        Analytics will be available once exams are completed.
      </p>
    </div>
  </div>
</template>

<style scoped>
.exam-analytics {
  min-height: 500px;
}

.card {
}

.card-header {
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  padding: 0.75rem 1rem;
}

.card-header h6 {
  color: #495057;
  font-weight: 600;
}
</style>
