<script>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { examStore } from "../stores/exam.js";
import { apiService } from "../services/api.js";
import SubmitConfirmationModal from "../components/SubmitConfirmationModal.vue";
import ExamCompletionModal from "../components/ExamCompletionModal.vue";
import RichContentDisplay from "../components/RichContentDisplay.vue";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";

export default {
  name: "ExamInterface",
  components: {
    SubmitConfirmationModal,
    ExamCompletionModal,
    RichContentDisplay,
  },
  setup() {
    const route = useRoute();
    const router = useRouter();

    const exam = ref(null);
    const questions = ref([]);
    const currentQuestionIndex = ref(0);
    const currentAnswer = ref(null);
    const answers = ref({});
    const isFullscreen = ref(false);
    const showSubmitModal = ref(false);
    const showCompletionModal = ref(false);
    const autoSaveStatus = ref("saved");
    const isSubmitting = ref(false);
    const completionData = ref({
      gradingMessage: "",
      isAutoSubmit: false,
    });

    // Auto-save timer
    let autoSaveTimer = null;
    let heartbeatTimer = null;
    let timeCheckTimer = null; // Safety timer to check for expiry
    let securityWarningTimer = null;

    // Computed properties
    const currentQuestion = computed(() => {
      return questions.value[currentQuestionIndex.value] || null;
    });

    const currentQuestionNumber = computed(() => {
      return currentQuestionIndex.value + 1;
    });

    const totalQuestions = computed(() => {
      return questions.value.length;
    });

    const answeredCount = computed(() => {
      return Object.keys(answers.value).length;
    });

    const unansweredCount = computed(() => {
      return totalQuestions.value - answeredCount.value;
    });

    const timeRemainingFormatted = computed(() => {
      return examStore.timeRemainingFormatted;
    });

    const timerClass = computed(() => {
      return examStore.timeStatus === "danger"
        ? "danger"
        : examStore.timeStatus === "warning"
        ? "warning"
        : "";
    });

    const autoSaveText = computed(() => {
      switch (autoSaveStatus.value) {
        case "saving":
          return "Saving...";
        case "saved":
          return "Saved";
        case "error":
          return "Save failed";
        default:
          return "";
      }
    });

    // Security and lifecycle methods
    const enterFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          await document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) {
          await document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.msRequestFullscreen) {
          await document.documentElement.msRequestFullscreen();
        }
        isFullscreen.value = true;
        examStore.isFullscreen = true;
        logger.info("Successfully entered fullscreen mode");
      } catch (error) {
        logger.error("Failed to enter fullscreen:", error);
        // The overlay will continue to show until fullscreen is successful
      }
    };

    const exitFullscreen = async () => {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        isFullscreen.value = false;
        examStore.isFullscreen = false;
      } catch (error) {
        logger.error("Failed to exit fullscreen:", error);
      }
    };

    const handleFullscreenChange = () => {
      const isInFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      // Update the reactive state
      isFullscreen.value = isInFullscreen;
      examStore.isFullscreen = isInFullscreen;

      if (!isInFullscreen && examStore.currentExam) {
        // User exited fullscreen - record security violation
        recordSecurityViolation("fullscreen_exit");
        logger.warn("User exited fullscreen mode - overlay will be shown");
      } else if (isInFullscreen) {
        // Successfully entered fullscreen
        logger.info("Successfully in fullscreen mode - overlay hidden");
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordSecurityViolation("window_blur");
      }
    };

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue =
        "Are you sure you want to leave? Your exam progress will be lost.";
      return event.returnValue;
    };

    const recordSecurityViolation = async (type, details = {}) => {
      try {
        const attemptId = examStore.currentAttemptId;
        const examId = examStore.currentExamId;

        // Validate required parameters
        if (!attemptId || attemptId === "undefined" || attemptId === "null") {
          logger.warn("Cannot record security violation: invalid attempt ID", {
            attemptId,
            examId,
            violationType: type,
          });
          return;
        }

        if (!examId) {
          logger.warn("Cannot record security violation: invalid exam ID", {
            attemptId,
            examId,
            violationType: type,
          });
          return;
        }

        // Check if exam is loaded to avoid early violations
        if (!exam.value) {
          logger.debug(
            "Delaying security violation recording until exam loads",
            {
              type,
              details,
            }
          );
          // Could implement a queue here if needed, but for now just skip early violations
          return;
        }

        await apiService.reportSecurityViolation(examId, attemptId, {
          type,
          details,
          timestamp: new Date(),
        });

        logger.info(`Security violation recorded: ${type}`, {
          attemptId,
          details,
        });
      } catch (error) {
        logger.error("Failed to record security violation:", error);
      }
    };

    // Utility method to safely remove beforeunload listener
    const removeBeforeUnloadListener = () => {
      try {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        logger.info("Beforeunload listener removed successfully");
      } catch (error) {
        logger.warn("Error removing beforeunload listener:", error);
      }
    };

    // Exam logic methods
    const loadExamData = async () => {
      // If exam is already submitted, don't reload data
      if (examStore.isSubmitted) {
        logger.info("Exam already submitted, skipping data load");
        return;
      }

      try {
        // Get exam and attempt IDs from secure store instead of URL
        const examId = examStore.currentExamId;
        const attemptId = examStore.currentAttemptId;

        // Validate that we have the required session data
        if (!examId) {
          logger.error(
            "No exam ID found in session - redirecting to dashboard"
          );
          await Swal.fire({
            icon: "warning",
            title: "Session Invalid",
            text: "No active exam session found. Please start an exam from the dashboard.",
            confirmButtonColor: "#1a5f5f",
            allowOutsideClick: false,
            allowEscapeKey: false,
          });
          router.push("/dashboard");
          return;
        }

        if (!attemptId) {
          logger.error(
            "No attempt ID found in session - redirecting to dashboard"
          );
          await Swal.fire({
            icon: "warning",
            title: "Session Invalid",
            text: "No active exam attempt found. Please start an exam from the dashboard.",
            confirmButtonColor: "#1a5f5f",
            allowOutsideClick: false,
            allowEscapeKey: false,
          });
          router.push("/dashboard");
          return;
        }

        logger.info(
          `Loading exam data for exam ${examId}, attempt ${attemptId}`
        );

        // Load exam details
        const examResponse = await apiService.getExamDetails(examId);
        logger.debug("Exam details response:", examResponse);

        if (!examResponse || !examResponse.success) {
          throw new Error(
            examResponse?.message || "Failed to load exam details"
          );
        }

        // Extract exam data - try different possible structures
        exam.value = examResponse.exam || examResponse.data || examResponse;
        logger.debug("Loaded exam:", exam.value);

        if (!exam.value || typeof exam.value !== "object") {
          logger.error("Invalid exam data structure:", {
            examResponse,
            exam: exam.value,
          });
          throw new Error("Invalid exam data received from server");
        }

        // Validate required exam properties
        if (!exam.value.duration) {
          logger.error("Exam missing duration property:", exam.value);
          throw new Error("Exam data is missing required properties");
        }

        // Load questions
        const questionsResponse = await apiService.getExamQuestions(
          examId,
          attemptId
        );
        logger.debug("Questions response:", questionsResponse);

        if (!questionsResponse || !questionsResponse.success) {
          throw new Error(
            questionsResponse?.message || "Failed to load exam questions"
          );
        }

        // Extract questions data - try different possible structures
        questions.value =
          questionsResponse.questions || questionsResponse.data || [];
        logger.info("Loaded questions:", questions.value?.length, "questions");

        if (
          !questions.value ||
          !Array.isArray(questions.value) ||
          questions.value.length === 0
        ) {
          logger.error("Invalid questions data:", {
            questionsResponse,
            questions: questions.value,
          });
          throw new Error("No valid questions received from server");
        }

        // Set up exam store
        logger.debug("Setting exam in store:", exam.value);
        examStore.setExam(exam.value);
        examStore.setQuestions(questions.value);
        examStore.startTimer();

        // Start safety timer to check for time expiry every 5 seconds
        // This provides backup in case the main timer fails due to browser issues
        timeCheckTimer = setInterval(() => {
          if (
            examStore.timeRemaining <= 0 &&
            !isSubmitting.value &&
            !examStore.isSubmitted
          ) {
            logger.warn(
              "Safety timer detected time expiry - triggering auto-submit"
            );
            autoSubmitExam();
          }
        }, 5000);

        // Load existing answers and timing information
        const attemptResponse = await apiService.getAttemptDetails(
          examStore.currentExamId,
          examStore.currentAttemptId
        );

        if (attemptResponse.success && attemptResponse.data) {
          const attemptData = attemptResponse.data;

          // Check if attempt is already submitted - redirect to dashboard
          if (
            attemptData.status === "submitted" ||
            attemptData.status === "auto-submitted"
          ) {
            logger.warn(
              `Attempt ${attemptId} is already ${attemptData.status} - redirecting to dashboard`
            );
            await Swal.fire({
              icon: "info",
              title: "Exam Already Submitted",
              text: "This exam has already been submitted. Redirecting to dashboard.",
              confirmButtonColor: "#1a5f5f",
              allowOutsideClick: false,
              allowEscapeKey: false,
            });
            router.push("/dashboard");
            return;
          }

          // Load existing answers
          if (attemptData.answers && Array.isArray(attemptData.answers)) {
            attemptData.answers.forEach((answer) => {
              answers.value[answer.questionId] = answer.selected;
            });
            examStore.answers = answers.value;
            logger.info(
              "Loaded existing answers:",
              Object.keys(answers.value).length,
              "questions answered"
            );
          }

          // Set the attempt data in store for timing calculations
          examStore.setAttempt(attemptData);

          // Calculate proper time remaining based on start time
          if (attemptData.timing) {
            examStore.timeRemaining = attemptData.timing.timeRemaining;
            logger.info("Set timer based on exam scheduled start time:", {
              timeRemaining: attemptData.timing.timeRemaining,
              examScheduledStart: attemptData.timing.examScheduledStart,
              userStartedAt: attemptData.startedAt,
              isTimeUp: attemptData.timing.isTimeUp,
            });

            if (attemptData.timing.isTimeUp) {
              logger.warn("Exam time has expired!");
              // Auto-submit if time is up
              examStore.timeUp();
              await autoSubmitExam();
              return;
            }
          }
        } else {
          logger.warn("No attempt data found, using default timer");
        }

        // Set current answer for first question
        if (currentQuestion.value) {
          currentAnswer.value =
            answers.value[currentQuestion.value._id] || getDefaultAnswer();
        }
      } catch (error) {
        logger.error("Error loading exam data:", error);
        Swal.fire({
          icon: "error",
          title: "Loading Failed",
          text: error.message || "Failed to load exam data",
          confirmButtonColor: "#1a5f5f",
        }).then(() => {
          router.push("/dashboard");
        });
      }
    };

    const getDefaultAnswer = () => {
      if (!currentQuestion.value) return null;

      switch (currentQuestion.value.type) {
        case "mcq":
          return null;
        case "multi":
          return [];
        case "essay":
          return "";
        default:
          return null;
      }
    };

    const handleAnswerChange = () => {
      if (!currentQuestion.value) return;

      answers.value[currentQuestion.value._id] = currentAnswer.value;
      examStore.setAnswer(currentQuestion.value._id, currentAnswer.value);

      // Trigger auto-save
      scheduleAutoSave();
    };

    const scheduleAutoSave = () => {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);

      autoSaveTimer = setTimeout(async () => {
        await saveAnswers();
      }, 2000); // Save after 2 seconds of inactivity
    };

    const saveAnswers = async () => {
      try {
        autoSaveStatus.value = "saving";

        const formattedAnswers = Object.entries(answers.value).map(
          ([questionId, selected]) => ({
            questionId,
            selected,
            answeredAt: new Date(),
          })
        );

        const response = await apiService.saveAnswers(
          examStore.currentExamId,
          examStore.currentAttemptId,
          formattedAnswers
        );

        autoSaveStatus.value = response.success ? "saved" : "error";
      } catch (error) {
        logger.error("Auto-save failed:", error);
        autoSaveStatus.value = "error";
      }
    };

    const isQuestionAnswered = (index) => {
      const question = questions.value[index];
      return (
        question &&
        answers.value[question._id] !== undefined &&
        answers.value[question._id] !== null &&
        answers.value[question._id] !== ""
      );
    };

    const goToQuestion = (index) => {
      if (index >= 0 && index < questions.value.length) {
        currentQuestionIndex.value = index;
        const question = questions.value[index];
        currentAnswer.value = answers.value[question._id] || getDefaultAnswer();
      }
    };

    const nextQuestion = () => {
      if (currentQuestionIndex.value < questions.value.length - 1) {
        goToQuestion(currentQuestionIndex.value + 1);
      }
    };

    const previousQuestion = () => {
      if (currentQuestionIndex.value > 0) {
        goToQuestion(currentQuestionIndex.value - 1);
      }
    };

    const showSubmitConfirmation = () => {
      showSubmitModal.value = true;
    };

    const hideSubmitModal = () => {
      showSubmitModal.value = false;
    };

    const handleCompletionContinue = async () => {
      logger.info("User clicked continue from completion modal");

      try {
        // Exit fullscreen mode first
        await exitFullscreen();

        // Clear all exam store data immediately
        examStore.currentExam = null;
        examStore.currentAttempt = null;
        examStore.questions = [];
        examStore.answers = {};
        examStore.currentQuestionIndex = 0;
        examStore.timeRemaining = 0;
        examStore.isSubmitted = true;
        examStore.isFullscreen = false;
        examStore.autoSaveStatus = "saved";
        examStore.tabSwitchCount = 0;
        examStore.blurCount = 0;
        examStore.timeUpTriggered = null;
        examStore.securityViolations = [];

        // Clear session data for security
        examStore.clearSession();

        // Stop all timers
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
          autoSaveTimer = null;
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (timeCheckTimer) {
          clearInterval(timeCheckTimer);
          timeCheckTimer = null;
        }
        if (securityWarningTimer) {
          clearTimeout(securityWarningTimer);
          securityWarningTimer = null;
        }

        // Hide the completion modal
        showCompletionModal.value = false;

        // Longer delay to ensure all cleanup is complete and component unmounting
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Navigate to dashboard with clean history
        logger.info("Navigating to dashboard from completion modal");
        router.replace("/dashboard");
      } catch (error) {
        logger.error("Error during completion continue:", error);
        // Force navigation even if there's an error
        router.replace("/dashboard");
      }
    };

    const submitExam = async () => {
      if (isSubmitting.value) return; // Prevent double submission

      try {
        isSubmitting.value = true;
        hideSubmitModal(); // Close the submit confirmation modal

        // Show loading state immediately
        const loadingAlert = Swal.fire({
          title: "Submitting Exam...",
          text: "Please wait while we process your submission.",
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        // Final save before submission
        await saveAnswers();

        const formattedAnswers = Object.entries(answers.value).map(
          ([questionId, selected]) => ({
            questionId,
            selected,
            answeredAt: new Date(),
          })
        );

        const response = await apiService.submitExam(
          examStore.currentExamId,
          examStore.currentAttemptId,
          formattedAnswers,
          examStore.securityViolations
        );

        logger.info("Submit exam response:", response);

        // Close loading alert
        Swal.close();

        if (response && response.success) {
          logger.info(
            "Submission successful, cleaning up and showing completion modal"
          );

          // Stop timer and cleanup
          examStore.stopTimer();
          if (timeCheckTimer) {
            clearInterval(timeCheckTimer);
            timeCheckTimer = null;
          }

          // IMPORTANT: Remove beforeunload listener to prevent navigation warnings
          removeBeforeUnloadListener();

          // Clear exam store to prevent any state issues
          examStore.currentExam = null;
          examStore.currentAttempt = null;
          examStore.questions = [];
          examStore.answers = {};
          examStore.isSubmitted = true;

          // Set completion data for the modal
          completionData.value = {
            gradingMessage:
              response.data?.gradingMessage || "Your exam is being graded.",
            isAutoSubmit: false,
          };

          // Show completion modal instead of SweetAlert
          showCompletionModal.value = true;
        } else {
          logger.error("Submission failed with response:", response);
          throw new Error(response?.message || "Unknown submission error");
        }
      } catch (error) {
        logger.error("Error submitting exam:", error);
        Swal.close(); // Make sure loading is closed

        // Show detailed error information
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          "Failed to submit exam. Please try again.";
        logger.error("Detailed error info:", {
          message: errorMessage,
          response: error.response?.data,
          status: error.response?.status,
          stack: error.stack,
        });

        Swal.fire({
          icon: "error",
          title: "Submission Failed",
          html: `
            <p>${errorMessage}</p>
            <p><small>If this problem persists, please contact support.</small></p>
          `,
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        isSubmitting.value = false;
      }
    };

    const autoSubmitExam = async () => {
      try {
        logger.warn("Auto-submitting exam due to time expiry");

        // Clean up timers
        if (timeCheckTimer) {
          clearInterval(timeCheckTimer);
          timeCheckTimer = null;
        }

        // Check if already submitting to prevent duplicate submissions
        if (isSubmitting.value) {
          logger.warn("Auto-submit prevented: submission already in progress");
          return;
        }

        isSubmitting.value = true;

        // Final save before auto-submission
        await saveAnswers();

        // Stop timer and cleanup
        examStore.stopTimer();

        const formattedAnswers = Object.entries(answers.value).map(
          ([questionId, selected]) => ({
            questionId,
            selected,
            answeredAt: new Date(),
          })
        );

        const response = await apiService.submitExam(
          examStore.currentExamId,
          examStore.currentAttemptId,
          formattedAnswers,
          examStore.securityViolations,
          true // isAutoSubmit = true
        );

        if (response.success) {
          // IMPORTANT: Remove beforeunload listener to prevent navigation warnings
          removeBeforeUnloadListener();

          // Clear exam store to prevent any state issues
          examStore.currentExam = null;
          examStore.currentAttempt = null;
          examStore.questions = [];
          examStore.answers = {};
          examStore.isSubmitted = true;

          // Set completion data for auto-submit modal
          completionData.value = {
            gradingMessage:
              "Your answers have been saved and your exam has been automatically submitted.",
            isAutoSubmit: true,
          };

          // Show completion modal
          showCompletionModal.value = true;
        } else {
          throw new Error(response.message);
        }
      } catch (error) {
        logger.error("Error auto-submitting exam:", error);

        // IMPORTANT: Remove beforeunload listener to prevent navigation warnings
        removeBeforeUnloadListener();

        // Even if auto-submit fails, we should still show completion modal
        // since the time is up. The backend scheduler will catch expired attempts.
        completionData.value = {
          gradingMessage:
            "Time expired. Your answers have been saved and will be automatically processed.",
          isAutoSubmit: true,
        };

        showCompletionModal.value = true;
      } finally {
        isSubmitting.value = false;
      }
    };

    const startHeartbeat = () => {
      heartbeatTimer = setInterval(async () => {
        try {
          const attemptId = examStore.currentAttemptId;
          if (!attemptId) {
            logger.warn("Cannot send heartbeat: invalid attempt ID");
            return;
          }
          await apiService.sendHeartbeat(examStore.currentExamId, attemptId);
        } catch (error) {
          logger.error("Heartbeat failed:", error);
        }
      }, 30000); // Every 30 seconds
    };

    const stopHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    // Media type checkers
    const isImage = (url) => {
      return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
    };

    const isVideo = (url) => {
      return /\.(mp4|webm|ogg)$/i.test(url);
    };

    const isAudio = (url) => {
      return /\.(mp3|wav|ogg)$/i.test(url);
    };

    // Lifecycle hooks
    onMounted(async () => {
      // First check if exam is already submitted to prevent unauthorized access
      if (examStore.isSubmitted) {
        logger.warn(
          "Attempted to access exam interface after submission - redirecting"
        );
        await Swal.fire({
          icon: "info",
          title: "Exam Already Submitted",
          text: "This exam has already been submitted. Redirecting to dashboard.",
          confirmButtonColor: "#1a5f5f",
          allowOutsideClick: false,
          allowEscapeKey: false,
        });
        router.push("/dashboard");
        return;
      }

      // Check current fullscreen state
      const isInFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      // Update state - the overlay will show if not in fullscreen
      isFullscreen.value = isInFullscreen;
      examStore.isFullscreen = isInFullscreen;

      if (isInFullscreen) {
        logger.info("Exam interface loaded in fullscreen mode");
      } else {
        logger.info("Exam interface loaded - fullscreen overlay will be shown");
      }

      // Add event listeners
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      document.addEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.addEventListener("mozfullscreenchange", handleFullscreenChange);
      document.addEventListener("MSFullscreenChange", handleFullscreenChange);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("beforeunload", handleBeforeUnload);

      // Disable right-click
      document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        recordSecurityViolation("right_click");
      });

      // Disable certain key combinations but allow F11 for fullscreen
      document.addEventListener("keydown", (e) => {
        // Allow F11 for fullscreen toggle
        if (e.key === "F11") {
          // Let F11 work naturally for fullscreen
          return;
        }

        if (
          (e.ctrlKey &&
            (e.key === "c" ||
              e.key === "v" ||
              e.key === "x" ||
              e.key === "a")) ||
          e.key === "F12" ||
          (e.ctrlKey && e.shiftKey && e.key === "I")
        ) {
          e.preventDefault();
          recordSecurityViolation("key_combination", {
            key: e.key,
            ctrlKey: e.ctrlKey,
          });
        }
      });

      // Load exam data
      await loadExamData();

      // Start heartbeat
      startHeartbeat();
    });

    onUnmounted(() => {
      // Cleanup
      examStore.stopTimer();
      stopHeartbeat();

      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      if (securityWarningTimer) clearTimeout(securityWarningTimer);
      if (timeCheckTimer) clearInterval(timeCheckTimer);

      // Remove event listeners
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    });

    // Watch for timer expiry to trigger auto-submit
    watch(
      () => examStore.timeRemaining,
      (newTime) => {
        if (
          newTime === 0 &&
          !isSubmitting.value &&
          !showCompletionModal.value &&
          examStore.currentExamId
        ) {
          logger.warn("Timer reached 0 - triggering auto-submit");
          autoSubmitExam();
        }
      }
    );

    // Watch for manual timeUp trigger from store
    watch(
      () => examStore.isSubmitted,
      (isSubmitted) => {
        if (
          isSubmitted &&
          examStore.timeRemaining === 0 &&
          !isSubmitting.value &&
          !showCompletionModal.value &&
          examStore.currentExamId
        ) {
          logger.warn("TimeUp state detected - triggering auto-submit");
          autoSubmitExam();
        }
      }
    );

    // Watch for timeUp trigger timestamp for additional reactivity
    watch(
      () => examStore.timeUpTriggered,
      (timestamp) => {
        if (
          timestamp &&
          examStore.timeRemaining === 0 &&
          !isSubmitting.value &&
          !showCompletionModal.value &&
          examStore.currentExamId
        ) {
          logger.warn("TimeUp timestamp detected - triggering auto-submit");
          autoSubmitExam();
        }
      }
    );

    return {
      exam,
      questions,
      currentQuestion,
      currentQuestionIndex,
      currentQuestionNumber,
      currentAnswer,
      answers,
      totalQuestions,
      answeredCount,
      unansweredCount,
      isFullscreen,
      showSubmitModal,
      showCompletionModal,
      completionData,
      autoSaveStatus,
      autoSaveText,
      timeRemainingFormatted,
      timerClass,
      isSubmitting,
      handleAnswerChange,
      isQuestionAnswered,
      goToQuestion,
      nextQuestion,
      previousQuestion,
      showSubmitConfirmation,
      hideSubmitModal,
      handleCompletionContinue,
      submitExam,
      autoSubmitExam,
      enterFullscreen,
      isImage,
      isVideo,
      isAudio,
    };
  },
};
</script>

<template>
  <div class="exam-interface" :class="{ 'exam-fullscreen': isFullscreen }">
    <!-- Fullscreen Required Overlay -->
    <div v-if="!isFullscreen" class="fullscreen-overlay">
      <div class="fullscreen-modal">
        <div class="fullscreen-icon">
          <i class="bi bi-arrows-fullscreen"></i>
        </div>
        <h3 class="mb-3">Fullscreen Mode Required</h3>
        <p class="mb-4">
          For exam security and integrity, you must enter fullscreen mode to
          continue taking this exam.
        </p>
        <div class="security-features mb-4">
          <div class="security-item">
            <i class="bi bi-shield-check text-success me-2"></i>
            Prevents tab switching
          </div>
          <div class="security-item">
            <i class="bi bi-eye-slash text-success me-2"></i>
            Blocks external distractions
          </div>
          <div class="security-item">
            <i class="bi bi-lock text-success me-2"></i>
            Ensures exam integrity
          </div>
        </div>
        <button
          @click="enterFullscreen"
          class="btn btn-primary btn-lg fullscreen-btn"
        >
          <i class="bi bi-fullscreen me-2"></i>
          Enter Fullscreen Mode
        </button>
        <p class="fullscreen-help mt-3">
          <small class="text-muted">
            You can also press <kbd>F11</kbd> to enter fullscreen mode
          </small>
        </p>
      </div>
    </div>

    <!-- Auto-save Indicator -->
    <div class="autosave-indicator" :class="autoSaveStatus">
      <i
        v-if="autoSaveStatus === 'saving'"
        class="bi bi-arrow-clockwise spinning me-1"
      ></i>
      <i
        v-else-if="autoSaveStatus === 'saved'"
        class="bi bi-check-circle me-1"
      ></i>
      <i
        v-else-if="autoSaveStatus === 'error'"
        class="bi bi-exclamation-circle me-1"
      ></i>
      {{ autoSaveText }}
    </div>

    <!-- Timer -->
    <div class="exam-timer" :class="timerClass">
      <i class="bi bi-clock me-2"></i>
      {{ timeRemainingFormatted }}
    </div>

    <!-- Exam Header -->
    <div class="exam-header">
      <div class="d-flex justify-content-between align-items-center w-50">
        <div>
          <h5 class="mb-0">{{ exam?.title }}</h5>
          <small>{{ exam?.description }}</small>
        </div>
        <div class="text-center">
          <div>
            Question {{ currentQuestionNumber }} of {{ totalQuestions }}
          </div>
          <small>{{ answeredCount }} answered</small>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="exam-content">
      <!-- Question Panel -->
      <div class="question-panel">
        <div v-if="currentQuestion" class="question-container">
          <!-- Question Text -->
          <div class="question-text mb-4">
            <h6 class="question-number">
              Question {{ currentQuestionNumber }}
            </h6>
            <RichContentDisplay
              :content="currentQuestion.questionText"
              class="question-content"
            />

            <!-- Question Media -->
            <div
              v-if="
                currentQuestion.mediaUrls &&
                currentQuestion.mediaUrls.length > 0
              "
              class="question-media mt-3"
            >
              <div
                v-for="(url, index) in currentQuestion.mediaUrls"
                :key="index"
                class="media-item"
              >
                <img
                  v-if="isImage(url)"
                  :src="url"
                  class="img-fluid"
                  alt="Question media"
                />
                <video
                  v-else-if="isVideo(url)"
                  :src="url"
                  controls
                  class="video-fluid"
                ></video>
                <audio v-else-if="isAudio(url)" :src="url" controls></audio>
              </div>
            </div>
          </div>

          <!-- Answer Options -->
          <div class="answer-options">
            <!-- MCQ Options -->
            <div v-if="currentQuestion.type === 'mcq'" class="mcq-options">
              <div
                v-for="(option, key) in currentQuestion.options"
                :key="key"
                class="option-item mb-3"
              >
                <div class="form-check">
                  <input
                    :id="`option-${key}`"
                    v-model="currentAnswer"
                    :value="key"
                    type="radio"
                    class="form-check-input"
                    :name="`question-${currentQuestion._id}`"
                    @change="handleAnswerChange"
                  />
                  <label :for="`option-${key}`" class="form-check-label d-flex">
                    <span class="option-letter">{{ key.toUpperCase() }}.</span>
                    <RichContentDisplay :content="option" class="option-text" />
                  </label>
                </div>
              </div>
            </div>

            <!-- Multi-select Options -->
            <div
              v-else-if="currentQuestion.type === 'multi'"
              class="multi-options"
            >
              <p class="text-muted small">Select all that apply:</p>
              <div
                v-for="(option, key) in currentQuestion.options"
                :key="key"
                class="option-item mb-3"
              >
                <div class="form-check">
                  <input
                    :id="`multi-option-${key}`"
                    v-model="currentAnswer"
                    :value="key"
                    type="checkbox"
                    class="form-check-input"
                    @change="handleAnswerChange"
                  />
                  <label :for="`multi-option-${key}`" class="form-check-label">
                    <span class="option-letter">{{ key.toUpperCase() }}.</span>
                    <RichContentDisplay :content="option" class="option-text" />
                  </label>
                </div>
              </div>
            </div>

            <!-- Essay Answer -->
            <div
              v-else-if="currentQuestion.type === 'essay'"
              class="essay-answer"
            >
              <textarea
                v-model="currentAnswer"
                class="form-control"
                rows="10"
                placeholder="Type your answer here..."
                @input="handleAnswerChange"
              ></textarea>
              <div class="text-end mt-2">
                <small class="text-muted"
                  >{{ currentAnswer?.length || 0 }} characters</small
                >
              </div>
            </div>
          </div>

          <!-- Question Mark -->
          <div class="question-mark mt-4">
            <span class="badge bg-info"
              >{{ currentQuestion.mark }} mark{{
                currentQuestion.mark > 1 ? "s" : ""
              }}</span
            >
          </div>
        </div>

        <div v-else class="loading-container">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading question...</span>
          </div>
        </div>
      </div>

      <!-- Navigation Panel -->
      <div class="navigation-panel">
        <!-- Question Navigator -->
        <div class="question-navigator mb-4">
          <h6><i class="bi bi-grid me-2"></i>Question Navigator</h6>
          <div class="question-nav">
            <button
              v-for="(question, index) in questions"
              :key="question._id"
              class="question-nav-item"
              :class="{
                current: index === currentQuestionIndex,
                answered: isQuestionAnswered(index),
                unanswered: !isQuestionAnswered(index),
              }"
              @click="goToQuestion(index)"
            >
              {{ index + 1 }}
            </button>
          </div>
        </div>

        <!-- Exam Summary -->
        <div class="exam-summary mb-4">
          <h6><i class="bi bi-info-circle me-2"></i>Summary</h6>
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-value text-success">{{ answeredCount }}</span>
              <span class="stat-label">Answered</span>
            </div>
            <div class="stat-item">
              <span class="stat-value text-warning">{{ unansweredCount }}</span>
              <span class="stat-label">Unanswered</span>
            </div>
            <div class="stat-item">
              <span class="stat-value text-info">{{ totalQuestions }}</span>
              <span class="stat-label">Total</span>
            </div>
          </div>
        </div>

        <!-- Instructions -->
        <div class="instructions">
          <h6><i class="bi bi-info-square me-2"></i>Instructions</h6>
          <ul class="instruction-list pb-5">
            <li>Click on question numbers to navigate</li>
            <li>Your answers are saved automatically</li>
            <li>You can change answers before submitting</li>
            <li>Submit the exam before time runs out</li>
            <li>Use F11 to toggle fullscreen mode</li>
            <li>Avoid switching tabs or leaving the exam window</li>
            <li>Ensure stable internet connection</li>
            <li>Contact support if you encounter technical issues</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Exam Footer -->
    <div class="exam-footer">
      <div class="d-flex justify-content-between align-items-center w-100">
        <!-- Navigation Buttons -->
        <div>
          <button
            class="btn btn-outline-secondary me-2"
            :disabled="currentQuestionIndex === 0"
            @click="previousQuestion"
          >
            <i class="bi bi-arrow-left me-1"></i>
            Previous
          </button>
          <button
            class="btn btn-outline-secondary"
            :disabled="currentQuestionIndex === questions.length - 1"
            @click="nextQuestion"
          >
            Next
            <i class="bi bi-arrow-right ms-1"></i>
          </button>
        </div>

        <!-- Submit Button -->
        <!-- <div class="exam-controls"> -->
        <button
          v-if="!isFullscreen"
          @click="enterFullscreen"
          class="btn btn-sm btn-warning me-2 pulse-animation"
          title="Enter Fullscreen - Required for Exam Security"
        >
          <i class="bi bi-fullscreen me-1"></i>
          Fullscreen
        </button>
        <!-- </div> -->
        <button
          v-else
          class="btn btn-danger"
          @click="showSubmitConfirmation"
          :disabled="isSubmitting"
        >
          <i v-if="!isSubmitting" class="bi bi-check-circle me-1"></i>
          <i v-else class="bi bi-hourglass-split me-1"></i>
          {{ isSubmitting ? "Submitting..." : "Submit Exam" }}
        </button>
      </div>
    </div>

    <!-- Submit Confirmation Modal -->
    <SubmitConfirmationModal
      :show="showSubmitModal"
      :answered-count="answeredCount"
      :total-questions="totalQuestions"
      @confirm="submitExam"
      @cancel="hideSubmitModal"
    />

    <!-- Exam Completion Modal -->
    <ExamCompletionModal
      :show="showCompletionModal"
      :answered-count="answeredCount"
      :total-questions="totalQuestions"
      :grading-message="completionData.gradingMessage"
      :is-auto-submit="completionData.isAutoSubmit"
      @continue="handleCompletionContinue"
    />
  </div>
</template>

<style scoped>
/* Fullscreen Overlay Styles */
.fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(10px);
}

.fullscreen-modal {
  background: white;
  padding: 3rem;
  border-radius: 20px;
  text-align: center;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideInScale 0.5s ease-out;
}

.fullscreen-icon {
  font-size: 4rem;
  color: #1a5f5f;
  margin-bottom: 1.5rem;
}

.fullscreen-modal h3 {
  color: #2c3e50;
  font-weight: 600;
  margin-bottom: 1rem;
}

.fullscreen-modal p {
  color: #6c757d;
  font-size: 1.1rem;
  line-height: 1.6;
}

.security-features {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 1.5rem;
  margin: 1.5rem 0;
}

.security-item {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
  font-size: 1rem;
  color: #495057;
}

.security-item:last-child {
  margin-bottom: 0;
}

.fullscreen-btn {
  background: linear-gradient(135deg, #1a5f5f 0%, #2d7d7d 100%);
  border: none;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 50px;
  transition: all 0.3s ease;
  box-shadow: 0 8px 25px rgba(26, 95, 95, 0.3);
}

.fullscreen-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 35px rgba(26, 95, 95, 0.4);
  background: linear-gradient(135deg, #2d7d7d 0%, #1a5f5f 100%);
}

.fullscreen-help kbd {
  background: #e9ecef;
  color: #495057;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.9rem;
}

@keyframes slideInScale {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes spinning {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.spinning {
  animation: spinning 1s linear infinite;
}

.exam-controls {
  display: flex;
  align-items: center;
}

.exam-controls .btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.pulse-animation {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.7);
  }
  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(255, 193, 7, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 193, 7, 0);
  }
}

.question-container {
  max-width: 800px;
}

.question-number {
  color: #1a5f5f;
  font-weight: bold;
  margin-bottom: 1rem;
}

.question-content {
  font-size: 1.1rem;
  line-height: 1.6;
}

.question-content p img {
  max-height: 300px !important;
  max-width: 100% !important;
  height: auto !important;
  object-fit: contain;
}

.option-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
  padding: 0.75rem;
  border-radius: 0.5rem;
}

.option-item:hover {
  background-color: #f8f9fa;
}

.option-letter {
  font-weight: bold;
  margin-right: 0.5rem;
  color: #1a5f5f;
}

.option-text {
  font-size: 1rem;
}

/* Ensure all images in exam content are properly sized */
.question-content :deep(img),
.option-text :deep(img) {
  max-height: 300px !important;
  max-width: 100% !important;
  height: auto !important;
  object-fit: contain;
}

.form-check-input:checked ~ .form-check-label {
  color: #1a5f5f;
}

.summary-stats {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
}

.stat-label {
  font-size: 0.8rem;
  color: #6c757d;
}

.instructions {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e9ecef;
}

.instructions h6 {
  margin-bottom: 0.75rem;
  color: #495057;
}

.instruction-list {
  font-size: 0.9rem;
  padding-left: 1.2rem;
  max-height: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  margin-bottom: 0;
  scrollbar-width: thin;
  scrollbar-color: #1a5f5f #f1f1f1;
}

.instruction-list::-webkit-scrollbar {
  width: 6px;
}

.instruction-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.instruction-list::-webkit-scrollbar-thumb {
  background: #1a5f5f;
  border-radius: 3px;
}

.instruction-list::-webkit-scrollbar-thumb:hover {
  background: #2d7d7d;
}

.instruction-list li {
  margin-bottom: 0.5rem;
  line-height: 1.4;
  color: #6c757d;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.question-media .media-item {
  margin-bottom: 1rem;
}

.question-media img,
.question-media video {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
}

.video-fluid {
  width: 100%;
  max-width: 600px;
}
</style>
