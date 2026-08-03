<script>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { authStore } from "../stores/auth.js";
import { examStore } from "../stores/exam.js";
import { apiService } from "../services/api.js";
import ExamCard from "../components/ExamCard.vue";
import StartExamModal from "../components/StartExamModal.vue";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";

export default {
  name: "Dashboard",
  components: {
    ExamCard,
    StartExamModal,
  },
  setup() {
    const router = useRouter();
    const isLoading = ref(true);
    const isRefreshing = ref(false);
    const lastRefresh = ref(null);
    const allExams = ref([]);
    const examHistory = ref([]);
    const showModal = ref(false);
    const selectedExam = ref(null);

    // Smart refresh intervals
    let smartRefreshTimer = null;
    let visibilityRefreshTimer = null;
    let releasedResultsTimer = null;

    // Computed properties for exam categories - using server-provided category flags
    const availableExams = computed(() => {
      if (!allExams.value || !Array.isArray(allExams.value)) return [];
      return allExams.value.filter(
        (exam) =>
          exam.category === "available" ||
          (exam.isStartable && !exam.isResumable)
      );
    });

    const inProgressExams = computed(() => {
      if (!allExams.value || !Array.isArray(allExams.value)) return [];
      return allExams.value.filter(
        (exam) => exam.category === "in-progress" || exam.isResumable
      );
    });

    const upcomingExams = computed(() => {
      if (!allExams.value || !Array.isArray(allExams.value)) return [];
      return allExams.value.filter((exam) => exam.category === "upcoming");
    });

    const completedExams = computed(() => {
      if (!allExams.value || !Array.isArray(allExams.value)) return [];
      
      const completed = allExams.value.filter((exam) => exam.category === "completed");
      
      // Sort by most recent completion date first
      return completed.sort((a, b) => {
        // Try multiple possible date fields for completion
        const getCompletionDate = (exam) => {
          // Priority order: submittedAt, completedAt, endedAt, userAttempt.submittedAt, examTimestamp
          const dateFields = [
            exam.submittedAt,
            exam.completedAt, 
            exam.endedAt,
            exam.userAttempt?.submittedAt,
            exam.userAttempt?.completedAt,
            exam.userAttempt?.endedAt,
            exam.examTimestamp // Fallback to exam date
          ];
          
          // Find the first valid date
          for (const dateField of dateFields) {
            if (dateField) {
              const date = new Date(dateField);
              if (!isNaN(date.getTime())) {
                return date;
              }
            }
          }
          
          // If no completion date found, use current time (least priority)
          return new Date(0);
        };
        
        const dateA = getCompletionDate(a);
        const dateB = getCompletionDate(b);
        
        // Sort in descending order (most recent first)
        return dateB.getTime() - dateA.getTime();
      });
    });

    const missedExams = computed(() => {
      if (!examHistory.value || !Array.isArray(examHistory.value)) return [];
      return examHistory.value.filter((exam) => exam.category === "missed");
    });

    // Formatted last refresh time
    const lastRefreshFormatted = computed(() => {
      if (!lastRefresh.value) return null;
      return lastRefresh.value.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    });

    const loadExams = async (isManualRefresh = false) => {
      try {
        if (isManualRefresh) {
          isRefreshing.value = true;
        } else {
          isLoading.value = true;
        }

        // Clear any residual exam store data when loading dashboard
        // This prevents issues when returning from completed exams
        if (examStore.isSubmitted) {
          logger.info("Clearing residual exam store data on dashboard load");
          examStore.clearSession();
        }

        logger.debug("Loading exams... Auth state:", {
          isAuthenticated: authStore.isAuthenticated,
          user: authStore.user,
          token: !!authStore.token,
          isManualRefresh,
        });

        // Load both available exams and history concurrently
        const [examsResponse, historyResponse] = await Promise.allSettled([
          apiService.getAvailableExams(),
          apiService.getExamHistory(),
        ]);

        // Process available exams
        if (examsResponse.status === "fulfilled") {
          allExams.value = examsResponse.value.data || [];
          
          // Debug: Log completed exams structure to understand available date fields
          const completedExams = allExams.value.filter(exam => exam.category === "completed");
          if (completedExams.length > 0) {
            logger.debug("Completed exams structure for date sorting:", 
              completedExams.map(exam => ({
                id: exam.id,
                title: exam.title,
                category: exam.category,
                submittedAt: exam.submittedAt,
                completedAt: exam.completedAt,
                endedAt: exam.endedAt,
                examTimestamp: exam.examTimestamp,
                userAttempt: exam.userAttempt ? {
                  submittedAt: exam.userAttempt.submittedAt,
                  completedAt: exam.userAttempt.completedAt,
                  endedAt: exam.userAttempt.endedAt
                } : null
              }))
            );
          }
          
          logger.info(
            "Loaded available exams:",
            allExams.value.length,
            "exams"
          );
        } else {
          logger.error(
            "Available exams API error:",
            examsResponse.reason || examsResponse.value?.message
          );
        }

        // Process exam history
        if (historyResponse.status === "fulfilled") {
          examHistory.value = historyResponse.value.data || [];
          logger.info(
            "Loaded exam history:",
            examHistory.value.length,
            "exams"
          );
        } else {
          logger.warn(
            "Exam history API error (non-critical):",
            historyResponse.reason || historyResponse.value?.message
          );
          examHistory.value = []; // Set to empty array if history fails
        }

        // Fail only if available exams failed
        if (
          examsResponse.status === "rejected" ||
          !examsResponse.value?.success
        ) {
          throw new Error(
            examsResponse.reason?.message || "Failed to load available exams"
          );
        }

        // Update last refresh time
        lastRefresh.value = new Date();

        // Show success message for manual refresh
        if (isManualRefresh) {
          Swal.fire({
            icon: "success",
            title: "Updated!",
            text: "Dashboard has been refreshed with latest data.",
            timer: 2000,
            showConfirmButton: false,
            position: "top-end",
            toast: true,
          });
        }
      } catch (error) {
        logger.error("Error loading exams:", error);
        Swal.fire({
          icon: "error",
          title: "Loading Failed",
          text: "Failed to load exams. Please try refreshing again.",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        isLoading.value = false;
        isRefreshing.value = false;
      }
    };

    // Manual refresh function
    const refreshDashboard = async () => {
      if (isRefreshing.value) return; // Prevent double refresh
      await loadExams(true);
    };

    // Handle when an exam becomes available
    const handleExamBecameAvailable = async (examId) => {
      logger.info(`Dashboard: Received examBecameAvailable event for exam ${examId} - refreshing dashboard`);
      if (!isRefreshing.value) {
        await loadExams(true);
      } else {
        logger.info(`Dashboard: Already refreshing, skipping refresh for exam ${examId}`);
      }
    };

    // Check if any completed exams have newly released results
    const checkForReleasedResults = async () => {
      try {
        if (completedExams.value && completedExams.value.length > 0) {
          logger.debug("Checking for newly released exam results");
          // This will cause a refresh if any results were just released
          // The backend should handle updating the exam status appropriately
          await loadExams(true);
        }
      } catch (error) {
        logger.debug("Error checking for released results:", error);
      }
    };

    // Smart refresh logic - only refresh when exam status might change (upcoming → available)
    const setupSmartRefresh = () => {
      // Check if there are upcoming exams that might become available soon
      const hasUpcomingExams =
        upcomingExams.value && upcomingExams.value.length > 0;

      if (hasUpcomingExams) {
        // Find the next exam start time - check both startTime and examTimestamp
        const nextExamTime = upcomingExams.value.reduce((earliest, exam) => {
          const startTime = exam.startTime ? new Date(exam.startTime) : null;
          const examTime = exam.examTimestamp ? new Date(exam.examTimestamp) : null;
          const examStartTime = examTime || startTime;
          
          if (examStartTime) {
            return !earliest || examStartTime < earliest ? examStartTime : earliest;
          }
          return earliest;
        }, null);

        if (nextExamTime) {
          const timeUntilStart = nextExamTime.getTime() - Date.now();

          // Only set up refresh if exam becomes available within next 30 minutes
          if (timeUntilStart > 0 && timeUntilStart <= 30 * 60 * 1000) {
            let refreshInterval;
            let initialDelay;

            if (timeUntilStart <= 5 * 60 * 1000) {
              // If exam starts within 5 minutes, refresh every 30 seconds
              refreshInterval = 30000;
              initialDelay = Math.min(timeUntilStart, 30000);
            } else if (timeUntilStart <= 10 * 60 * 1000) {
              // If exam starts within 10 minutes, refresh every minute
              refreshInterval = 60000;
              initialDelay = Math.min(timeUntilStart - 5 * 60 * 1000, 60000);
            } else {
              // For exams starting in 10-30 minutes, refresh every 2 minutes
              refreshInterval = 120000;
              initialDelay = Math.max(timeUntilStart - 10 * 60 * 1000, 60000);
            }

            smartRefreshTimer = setTimeout(() => {
              logger.info(
                "Smart refresh: Checking for exam status change (upcoming → available)"
              );
              loadExams();

              // Set up recurring refresh with appropriate interval
              smartRefreshTimer = setInterval(() => {
                loadExams();
              }, refreshInterval);
            }, initialDelay);

            logger.info(
              `Smart refresh scheduled: Status check in ${Math.round(
                initialDelay / 1000
              )}s, then every ${Math.round(refreshInterval / 1000)}s for upcoming exam`
            );
          }
        }
      }
    };

    // Page visibility refresh - refresh when user comes back after being away
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && lastRefresh.value) {
        const timeSinceLastRefresh = Date.now() - lastRefresh.value.getTime();

        // If user was away for more than 5 minutes, refresh automatically
        if (timeSinceLastRefresh > 5 * 60 * 1000) {
          logger.info(
            "Page visibility refresh: User returned after 5+ minutes"
          );
          loadExams();
        }
      }
    };

    const showStartModal = (exam) => {
      selectedExam.value = exam;
      showModal.value = true;
    };

    const hideStartModal = () => {
      showModal.value = false;
      selectedExam.value = null;
    };

    const startExam = async (examId, password) => {
      try {
        const response = await apiService.startExam(examId, password);

        if (response.success) {
          hideStartModal();
          // Store exam and attempt data in the store for secure access
          const attemptId = response.attemptId || response.data?.attemptId;
          if (!attemptId) {
            throw new Error("No attempt ID received from server");
          }
          
          // Store the exam session data securely in the store
          examStore.currentExamId = examId;
          examStore.currentAttemptId = attemptId;
          examStore.isSubmitted = false;
          
          // Navigate to secure exam interface route (no IDs in URL)
          logger.info('Navigating to exam interface with secure route...');
          router.push('/exam/take');
        } else {
          throw new Error(response.message);
        }
      } catch (error) {
        logger.error("Error starting exam:", error);
        Swal.fire({
          icon: "error",
          title: "Start Failed",
          text: error.message || "Failed to start exam. Please try again.",
          confirmButtonColor: "#1a5f5f",
        });
      }
    };

    const continueExam = (exam) => {
      if (exam.userAttempt) {
        const attemptId = exam.userAttempt._id || exam.userAttempt.id;
        if (!attemptId) {
          logger.error(
            "No attempt ID found for continuing exam:",
            exam.userAttempt
          );
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "Unable to continue exam. Please refresh the page and try again.",
            confirmButtonColor: "#1a5f5f",
          });
          return;
        }
        
        // Store the exam session data securely in the store
        examStore.currentExamId = exam.id;
        examStore.currentAttemptId = attemptId;
        examStore.isSubmitted = false;
        
        // Navigate to secure exam interface route (no IDs in URL)
        logger.info('Continuing exam with secure route...');
        router.push('/exam/take');
      }
    };

    const viewResults = async (exam) => {
      try {
        // Check if results are released
        const response = await apiService.getExamResults(exam.id);
        logger.info(`Checking results for exam ${exam.id}:`, response);
        
        if (response.success && response.data) {
          const { result, hasResult, released } = response.data;
          
          // Check if results are released and available
          if (hasResult && released && result) {
            // Results are released, navigate to results page
            logger.info(`Results are released for exam ${exam.id}, navigating to results page`);
            window.location.href = `/cbt/exam/${exam.id}/results`;
          } else {
            // Results not released or not available yet
            logger.info(`Results not available for exam ${exam.id} - hasResult: ${hasResult}, released: ${released}`);
            await Swal.fire({
              icon: "info",
              title: "Results Not Available",
              html: `
                <p>Your exam results are not yet available.</p>
                <p>Please check back later or contact your instructor.</p>
              `,
              confirmButtonColor: "#1a5f5f",
            });
          }
        } else {
          // No results found yet
          logger.info(`No results data found for exam ${exam.id}`);
          await Swal.fire({
            icon: "info", 
            title: "Results Not Available",
            html: `
              <p>Your exam results are not yet available.</p>
              <p>Please check back later or contact your instructor.</p>
            `,
            confirmButtonColor: "#1a5f5f",
          });
        }
      } catch (error) {
        logger.error("Error checking exam results:", error);
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: "Unable to check exam results. Please try again later.",
          confirmButtonColor: "#1a5f5f",
        });
      }
    };

    const logout = async () => {
      const result = await Swal.fire({
        title: "Confirm Logout",
        text: "Are you sure you want to logout?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#dc3545",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Yes, logout",
        cancelButtonText: "Cancel",
      });

      if (result.isConfirmed) {
        authStore.logout();
        Swal.fire({
          title: "Logged Out",
          text: "You have been successfully logged out.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      }
    };

    onMounted(() => {
      loadExams();

      // Set up page visibility change listener
      document.addEventListener("visibilitychange", handleVisibilityChange);

      // Set up smart refresh after initial load (with a delay to ensure data is loaded)
      setTimeout(() => {
        setupSmartRefresh();
      }, 1000);

      // Set up periodic check for released results every 2 minutes
      // This helps notify users when results become available
      releasedResultsTimer = setInterval(() => {
        checkForReleasedResults();
      }, 2 * 60 * 1000);
    });

    onUnmounted(() => {
      // Cleanup timers and listeners
      if (smartRefreshTimer) {
        clearInterval(smartRefreshTimer);
      }
      if (visibilityRefreshTimer) {
        clearTimeout(visibilityRefreshTimer);
      }
      if (releasedResultsTimer) {
        clearInterval(releasedResultsTimer);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    });

    return {
      authStore,
      isLoading,
      isRefreshing,
      lastRefresh,
      lastRefreshFormatted,
      allExams,
      examHistory,
      availableExams,
      inProgressExams,
      upcomingExams,
      completedExams,
      missedExams,
      showModal,
      selectedExam,
      refreshDashboard,
      showStartModal,
      hideStartModal,
      startExam,
      continueExam,
      viewResults,
      logout,
    };
  },
};
</script>

<template>
  <div class="container-fluid p-0">
    <!-- Header -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
      <div class="container">
        <a class="navbar-brand" href="#">
          <i class="bi bi-mortarboard me-2"></i>
          CBT Portal
        </a>
        <div class="navbar-nav ms-auto">
          <span class="navbar-text me-3">
            Welcome, {{ authStore.userName }}
          </span>
          <button
            class="btn btn-outline-light btn-sm me-2"
            @click="refreshDashboard"
            :disabled="isRefreshing"
            title="Refresh dashboard data"
          >
            <i
              class="bi"
              :class="
                isRefreshing ? 'bi-arrow-clockwise spin' : 'bi-arrow-clockwise'
              "
            ></i>
            <span class="d-none d-md-inline ms-1">{{
              isRefreshing ? "Refreshing..." : "Refresh"
            }}</span>
          </button>
          <button class="btn btn-outline-light btn-sm" @click="logout">
            <i class="bi bi-box-arrow-right me-1"></i>
            Logout
          </button>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="container my-5">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-3">Loading your exams...</p>
      </div>

      <!-- Dashboard Content -->
      <div v-else>
        <!-- Last refresh indicator -->
        <div v-if="lastRefreshFormatted" class="text-muted text-end mb-2 small">
          <i class="bi bi-clock me-1"></i>
          Last updated: {{ lastRefreshFormatted }}
        </div>

        <!-- Stats Cards -->
        <div class="row d-flex justify-content-evenly g-4 mb-4">
          <div class="col-md-2 col-4">
            <div class="card p-0 text-center border-primary">
              <div class="card-body">
                <i class="bi bi-clock-history text-primary fs-1"></i>
                <h5 class="card-title mt-2">{{ availableExams.length }}</h5>
                <p class="card-text text-muted">Available</p>
              </div>
            </div>
          </div>
          <div class="col-md-2 col-4">
            <div class="card p-0 text-center border-success">
              <div class="card-body">
                <i class="bi bi-check-circle text-success fs-1"></i>
                <h5 class="card-title mt-2">{{ completedExams.length }}</h5>
                <p class="card-text text-muted">Completed</p>
              </div>
            </div>
          </div>
          <div class="col-md-2 col-4">
            <div class="card p-0 text-center border-warning">
              <div class="card-body">
                <i class="bi bi-play-circle text-warning fs-1"></i>
                <h5 class="card-title mt-2">{{ inProgressExams.length }}</h5>
                <p class="card-text text-muted">In Progress</p>
              </div>
            </div>
          </div>
          <div class="col-md-2 col-4">
            <div class="card p-0 text-center border-info">
              <div class="card-body">
                <i class="bi bi-calendar-event text-info fs-1"></i>
                <h5 class="card-title mt-2">{{ upcomingExams.length }}</h5>
                <p class="card-text text-muted">Upcoming</p>
              </div>
            </div>
          </div>
          <div class="col-md-2 col-4">
            <div class="card p-0 text-center border-danger">
              <div class="card-body">
                <i class="bi bi-x-circle text-danger fs-1"></i>
                <h5 class="card-title mt-2">{{ missedExams.length }}</h5>
                <p class="card-text text-muted">Missed</p>
              </div>
            </div>
          </div>
        </div>

        <!-- In Progress Exams -->
        <div v-if="inProgressExams.length > 0" class="mb-5">
          <h4 class="mb-3">
            <i class="bi bi-play-fill text-warning me-2"></i>
            Continue Exam
          </h4>
          <div class="exam-cards-scroll">
            <div class="d-flex gap-3 py-2">
              <div
                v-for="exam in inProgressExams"
                :key="exam.id"
                class="exam-card-container"
              >
                <ExamCard
                  :exam="exam"
                  type="continue"
                  @continue="continueExam"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Available Exams -->
        <div v-if="availableExams.length > 0" class="mb-5">
          <h4 class="mb-3">
            <i class="bi bi-clock text-primary me-2"></i>
            Available Exams
          </h4>
          <div class="exam-cards-scroll">
            <div class="d-flex gap-3 py-2">
              <div
                v-for="exam in availableExams"
                :key="exam.id"
                class="exam-card-container"
              >
                <ExamCard
                  :exam="exam"
                  type="available"
                  @start="showStartModal"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Upcoming Exams -->
        <div v-if="upcomingExams.length > 0" class="mb-5">
          <h4 class="mb-3">
            <i class="bi bi-calendar-event text-info me-2"></i>
            Upcoming Exams
          </h4>
          <div class="exam-cards-scroll">
            <div class="d-flex gap-3 py-2">
              <div
                v-for="exam in upcomingExams"
                :key="exam.id"
                class="exam-card-container"
              >
                <ExamCard 
                  :exam="exam" 
                  type="upcoming" 
                  @examBecameAvailable="handleExamBecameAvailable"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Completed Exams -->
        <div v-if="completedExams.length > 0" class="mb-5">
          <h4 class="mb-3">
            <i class="bi bi-check-circle text-success me-2"></i>
            Completed Exams
          </h4>
          <div class="exam-cards-scroll">
            <div class="d-flex gap-3 py-2">
              <div
                v-for="exam in completedExams"
                :key="exam.id"
                class="exam-card-container"
              >
                <ExamCard
                  :exam="exam"
                  type="completed"
                  @viewResults="viewResults"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Missed Exams -->
        <div v-if="missedExams.length > 0" class="mb-5">
          <h4 class="mb-3">
            <i class="bi bi-x-circle text-danger me-2"></i>
            Missed Exams
          </h4>
          <div class="exam-cards-scroll">
            <div class="d-flex gap-3 py-2">
              <div
                v-for="exam in missedExams"
                :key="exam.id"
                class="exam-card-container"
              >
                <ExamCard :exam="exam" type="missed" />
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="allExams.length === 0" class="text-center py-5">
          <i class="bi bi-inbox text-muted" style="font-size: 4rem"></i>
          <h4 class="text-muted mt-3">No Exams Available</h4>
          <p class="text-muted">
            There are currently no exams scheduled for you.
          </p>
        </div>
      </div>
    </div>

    <!-- Start Exam Modal -->
    <StartExamModal
      :show="showModal"
      :exam="selectedExam"
      @close="hideStartModal"
      @start="startExam"
    />
  </div>
</template>

<style scoped>
.card {
  transition: transform 0.2s ease-in-out;
}

.card:hover {
  transform: translateY(-5px);
}

.navbar-brand {
  font-weight: bold;
}

/* Refresh button animation */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Refresh button styling */
.btn-outline-light:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Horizontal scrolling exam cards */
.exam-cards-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  position: relative;
}

/* Add a subtle shadow on the right to indicate more content */
.exam-cards-scroll::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: 30px;
  height: 100%;
  /* background: linear-gradient(to left, rgba(255, 255, 255, 0.8), transparent); */
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.exam-cards-scroll:hover::after {
  opacity: 1;
}

.exam-cards-scroll::-webkit-scrollbar {
  height: 8px;
}

.exam-cards-scroll::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.exam-cards-scroll::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.exam-cards-scroll::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.exam-card-container {
  min-width: 350px;
  max-width: 350px;
  flex-shrink: 0;
}

/* Add smooth scrolling behavior */
.exam-cards-scroll {
  scroll-behavior: smooth;
}

/* Scroll hint for touch devices */
@media (max-width: 767px) {
  .exam-cards-scroll::before {
    content: "Swipe to see more →";
    position: absolute;
    top: -25px;
    right: 0;
    font-size: 0.8rem;
    color: #6c757d;
    opacity: 0.7;
    pointer-events: none;
  }
}

/* On larger screens, make cards slightly bigger */
@media (min-width: 768px) {
  .exam-card-container {
    min-width: 400px;
    max-width: 400px;
  }
}

/* On very large screens, make cards even bigger */
@media (min-width: 1200px) {
  .exam-card-container {
    min-width: 450px;
    max-width: 450px;
  }
}
</style>