<script lang="js">
import { useAuthStore } from "../../stores/auth.js";
import { apiService } from "../../services/api.js";
import { useRoute, useRouter } from "vue-router";
import { logger } from "@shared/utils/logger";
import TodoList from "./components/TodoList.vue";
import BiodataCard from "./components/BiodataCard.vue";
import ProgressCard from "./components/ProgressCard.vue";
import EmailVerificationAlert from "./components/EmailVerificationAlert.vue";
import Swal from "sweetalert2";

export default {
  name: "Dashboard",
  setup() {
    const authStore = useAuthStore();
    const route = useRoute();
    const router = useRouter();
    return { authStore, route, router };
  },
  data() {
    return {
      application: null,
      loadingApplication: true,
    };
  },
  async mounted() {
    window.addEventListener("focus", this.onEmailVerificationFocus);
    await this.loadApplication();
  },
  beforeUnmount() {
    window.removeEventListener("focus", this.onEmailVerificationFocus);
  },
  methods: {
    async loadApplication() {
      const id = this.route.params.id;

      // Fast path: try the store list first
      const cached = this.authStore.getApplicationFromList(id);
      if (cached) {
        this.application = cached;
        this.loadingApplication = false;
      }

      // Always fetch fresh from API
      try {
        const response = await apiService.getApplication(id);
        if (response.success) {
          this.application = response.data;
        } else {
          throw new Error(response.error || "Failed to load application");
        }
      } catch (error) {
        logger.error("Failed to load application, redirecting:", error);
        this.router.push({ name: "MyApplications" });
      } finally {
        this.loadingApplication = false;
      }
    },

    async onEmailVerificationFocus() {
      if (
        this.authStore.isAuthenticated &&
        this.authStore.user &&
        this.authStore.user.isEmailVerified === false
      ) {
        try {
          await this.authStore.refreshUserData();
        } catch (error) {
          logger.error(
            "Failed to refresh email verification status on focus:",
            error,
          );
        }
      }
    },

    showExamScreeningModal() {
      const application = this.application;
      let modalContent = '<div class="text-start">';

      if (application?.entranceExam) {
        const exam = application.entranceExam;
        modalContent += `
          <h6 class="text-primary mb-3"><i class="bi bi-laptop me-2"></i>Entrance Exam Details</h6>
          <div class="mb-3 p-3 bg-light rounded">
            <p class="mb-2"><strong>Date:</strong> ${new Date(exam.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            <p class="mb-2"><strong>Time:</strong> ${exam.time}</p>
            ${exam.link ? `<p class="mb-2"><strong>Exam Link:</strong> <a href="${exam.link}" target="_blank" class="text-decoration-none">${exam.link}</a></p>` : ""}
            ${exam.score !== undefined ? `<p class="mb-0"><strong>Score:</strong> <span class="badge bg-success">${exam.score}%</span></p>` : ""}
          </div>
        `;
      }

      if (application?.screening) {
        const screening = application.screening;
        modalContent += `
          <h6 class="text-info mb-3"><i class="bi bi-people me-2"></i>Screening & Interview Details</h6>
          <div class="mb-3 p-3 bg-light rounded">
            <p class="mb-2"><strong>Date:</strong> ${new Date(screening.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            <p class="mb-2"><strong>Time:</strong> ${screening.time}</p>
            <p class="mb-2"><strong>Venue:</strong> ${screening.venue}</p>
            <p class="mb-0"><strong>Status:</strong> <span class="badge ${screening.completed ? "bg-success" : "bg-warning"}">${screening.completed ? "Completed" : "Scheduled"}</span></p>
          </div>
        `;
      }

      modalContent += "</div>";
      Swal.fire({
        title: "Exam & Screening Information",
        html: modalContent,
        confirmButtonText: "Close",
        confirmButtonColor: "#1a5f5f",
        width: "600px",
      });
    },

    redirectToStudentPortal() {
      Swal.fire({
        icon: "info",
        title: "Access Student Portal",
        text: "You will be redirected to the student portal. Make sure you have received your matriculation number via email.",
        showCancelButton: true,
        confirmButtonText: "Continue to Student Portal",
        cancelButtonText: "Stay Here",
        confirmButtonColor: "#8B2C2C",
        cancelButtonColor: "#6c757d",
      }).then((result) => {
        if (result.isConfirmed) {
          window.open(import.meta.env.VITE_APP_STUDENT_PORTAL_URL, "_blank");
        }
      });
    },
  },
  watch: {
    "route.params.id"() {
      this.loadApplication();
    },
  },
  computed: {
    user() {
      return this.authStore.user;
    },
    admissionFlow() {
      return (
        this.application?.admissionFlow || {
          entranceExamEnabled: true,
          screeningEnabled: true,
        }
      );
    },
    allStageDefinitions() {
      return [
        {
          stage: 1,
          label: "Registration",
          title: "Verify Email Address",
          description: "Check your email and click the verification link",
          paymentStage: false,
        },
        {
          stage: 2,
          label: "Form Fee",
          title: "Pay Form Fee",
          description: "Pay the application form fee to proceed",
          paymentStage: true,
        },
        {
          stage: 3,
          label: "Application Form",
          title: "Complete Application Form",
          description: "Fill out your application details and upload documents",
          paymentStage: false,
        },
        {
          stage: 4,
          label: "Entrance Exam",
          title: "Await Entrance Exam Scheduling",
          description: "Wait for admin to schedule your online entrance exam",
          paymentStage: false,
        },
        {
          stage: 5,
          label: "Admission Decision",
          title: "Await Admission Decision",
          description: "Your application is under review for admission",
          paymentStage: false,
        },
        {
          stage: 6,
          label: "Screening",
          title: "Await Screening & Interview",
          description: "Wait for physical screening and interview scheduling",
          paymentStage: false,
        },
        {
          stage: 7,
          label: "Acceptance Fee",
          title: "Pay Acceptance Fee",
          description: "Pay acceptance fee to confirm your admission",
          paymentStage: true,
        },
        {
          stage: 8,
          label: "Sundry Fee",
          title: "Pay Sundry Fees",
          description: "Pay administrative and sundry charges",
          paymentStage: true,
        },
        {
          stage: 9,
          label: "School Fees",
          title: "Pay School Fees",
          description: "Pay tuition and other school fees",
          paymentStage: true,
        },
        {
          stage: 10,
          label: "Completed",
          title: "Application Complete",
          description:
            "Welcome! Check your email for matriculation number and portal access details",
          paymentStage: false,
        },
      ];
    },
    visibleStageDefinitions() {
      return this.allStageDefinitions.filter((definition) => {
        if (definition.stage === 4)
          return this.admissionFlow.entranceExamEnabled;
        if (definition.stage === 6) return this.admissionFlow.screeningEnabled;
        return true;
      });
    },
    stages() {
      return this.visibleStageDefinitions.map((definition) => definition.label);
    },
    currentStage() {
      return this.application?.currentStage;
    },
    currentVisibleStage() {
      const currentStageIndex = this.visibleStageDefinitions.findIndex(
        (definition) => definition.stage === this.currentStage,
      );
      if (currentStageIndex !== -1) return currentStageIndex + 1;
      if (!this.currentStage) return 0;
      return (
        this.visibleStageDefinitions.filter(
          (definition) => definition.stage < this.currentStage,
        ).length + 1
      );
    },
    userDisplayName() {
      return (
        this.user?.fullName ||
        `${this.user?.firstName || ""} ${this.user?.lastName || ""}`.trim() ||
        "Loading..."
      );
    },
    userPhone() {
      return this.user?.phone || "N/A";
    },
    userLocation() {
      return (
        this.application?.nationality ||
        this.application?.stateOfOrigin ||
        "N/A"
      );
    },
    todos() {
      const currentStage = this.currentStage;
      return this.visibleStageDefinitions.map((def) => ({
        stage: def.stage,
        title: def.title,
        description: def.description,
        paymentStage: def.paymentStage,
        status:
          def.stage < currentStage
            ? "completed"
            : def.stage === currentStage
              ? "active"
              : "inactive",
      }));
    },
    isApplicationLocked() {
      const status = this.application?.status;
      return status === "expired" || status === "rejected";
    },
    lockedBannerConfig() {
      const status = this.application?.status;
      if (status === "expired") {
        return {
          icon: "bi-clock-history",
          variant: "alert-warning",
          title: "Application Expired",
          message:
            "This application has expired and can no longer be progressed. You may start a new application from My Applications.",
        };
      }
      if (status === "rejected") {
        return {
          icon: "bi-x-circle",
          variant: "alert-danger",
          title: "Application Rejected",
          message:
            "This application has been rejected. Please contact the admissions office for more information or start a new application.",
        };
      }
      return null;
    },
    resumeButtonConfig() {
      if (this.isApplicationLocked) {
        return {
          text: "Application Unavailable",
          route: null,
          disabled: true,
          variant: "btn-secondary",
        };
      }
      const id = this.route.params.id;
      const stage = this.currentStage;
      if ([2, 7, 8, 9].includes(stage)) {
        return {
          text: "Make Payment",
          route: `/applications/${id}/payment`,
          disabled: false,
          variant: "btn-acon-secondary",
        };
      }
      if (stage === 3) {
        return {
          text: "Complete Application",
          route: `/applications/${id}/application-form`,
          disabled: false,
          variant: "btn-acon-secondary",
        };
      }
      if ([4, 6].includes(stage) && this.hasExamOrScreeningInfo) {
        return {
          text: "View Details",
          route: null,
          disabled: false,
          variant: "btn-acon-secondary",
          showModal: true,
        };
      }
      if ([1, 4, 5, 6].includes(stage)) {
        const waitingMessages = {
          1: "Check Your Email",
          4: "Awaiting Exam Scheduling",
          5: "Awaiting Admission Decision",
          6: "Awaiting Screening Schedule",
        };
        return {
          text: waitingMessages[stage],
          route: null,
          disabled: true,
          variant: "btn-secondary",
        };
      }
      if (stage === 10) {
        return {
          text: "Access Student Portal",
          route: null,
          disabled: false,
          variant: "btn-acon-primary",
          action: "redirectToStudentPortal",
        };
      }
      return {
        text: "Continue",
        route: null,
        disabled: true,
        variant: "btn-secondary",
      };
    },
    hasExamOrScreeningInfo() {
      return !!(this.application?.entranceExam || this.application?.screening);
    },
  },
  components: { TodoList, BiodataCard, ProgressCard, EmailVerificationAlert },
};
</script>

<template>
  <div class="dashboard-page container px-3 px-md-5 py-5">
    <div v-if="loadingApplication && !application" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2 text-muted">Loading application...</p>
    </div>

    <div v-else-if="application" class="row gy-5 mx-0">
      <div class="col-md-8">
        <!-- Locked application banner -->
        <div
          v-if="isApplicationLocked && lockedBannerConfig"
          class="alert d-flex align-items-start gap-3 mb-4"
          :class="lockedBannerConfig.variant"
          role="alert"
        >
          <i
            :class="['bi', lockedBannerConfig.icon, 'fs-5 mt-1 flex-shrink-0']"
          ></i>
          <div>
            <strong>{{ lockedBannerConfig.title }}</strong>
            <p class="mb-1 mt-1">{{ lockedBannerConfig.message }}</p>
            <router-link
              to="/my-applications"
              class="alert-link small d-flex align-items-center"
            >
              <i class="bi bi-arrow-left-circle fs-6 me-2"></i> Back to My
              Applications
            </router-link>
          </div>
        </div>

        <router-link
          v-else
          to="/my-applications"
          class="small d-flex align-items-center mb-3"
        >
          <i class="bi bi-arrow-left-circle fs-6 me-2"></i> Back to My
          Applications
        </router-link>

        <!-- Email Verification Alert -->
        <EmailVerificationAlert
          v-if="user && user.isEmailVerified === false"
          :user="user"
        />

        <ProgressCard
          class="mb-4"
          :stages="stages"
          :currentStage="currentVisibleStage"
          :userName="user?.firstName || ''"
          :resumeConfig="resumeButtonConfig"
          :locked="isApplicationLocked"
          @show-modal="showExamScreeningModal"
          @redirectToStudentPortal="redirectToStudentPortal"
        />

        <TodoList
          :todos="todos"
          :locked="isApplicationLocked"
        />
      </div>

      <div class="col-md-4">
        <BiodataCard
          :profileImage="
            application?.profileImageUrl || 'https://placehold.co/100?text=IMG'
          "
          :name="userDisplayName || ''"
          :appNo="application?.applicationNumber || 'N/A'"
          :email="user?.email || 'N/A'"
          :phone="userPhone || 'N/A'"
          :gender="user?.gender || 'N/A'"
          :location="userLocation"
          :dob ="new Date(user?.dob).toLocaleDateString() || 'N/A'"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* .dashboard-page {
  background: #f8f9fa;
} */

.dashboard-page,
.dashboard-page > .row,
.dashboard-page > .row > [class*="col-"] {
  min-width: 0;
}
</style>
