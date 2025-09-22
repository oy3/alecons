<script lang="js">
import { useAuth, authManager } from "../../services/auth.js";
import { logger } from '@shared/utils/logger';
import TodoList from "./components/TodoList.vue";
import BiodataCard from "./components/BiodataCard.vue";
import ProgressCard from "./components/ProgressCard.vue";

export default {
  name: "Dashboard",
  setup() {
    const { user, isAuthenticated, application } = useAuth();
    return {
      user,
      isAuthenticated,
      application
    };
  },
  data() {
    return {
      stages: [
        "Registration",
        "Portal Fee",
        "Application Form",
        "Admission",
        "Acceptance Fee",
        "Clearance",
        "Admin Fee",
        "School Fees",
        "Done",
      ],
    };
  },
  mounted() {
    // Log dashboard access
    logger.info('Dashboard accessed by user:', {
      userData: this.user,
      applicationData: this.application,
    });


  },
  methods: { },
  computed: {
    progressPercent() {
      return ((this.application?.currentStage) / (this.stages.length - 1)) * 100;
    },

    currentStage() {
      return this.application?.currentStage;
    },

    todos() {
      const currentStage = this.currentStage;
      const stageDefinitions = [
        {
          stage: 1,
          title: "Complete Registration",
          description: "Create your account and verify email",
          paymentStage: false
        },
        {
          stage: 2,
          title: "Pay Form Fee",
          description: "Pay the application form fee to proceed",
          paymentStage: true
        },
        {
          stage: 3,
          title: "Complete Application Form",
          description: "Fill out your application details",
          paymentStage: false
        },
        {
          stage: 4,
          title: "Await Admission Decision",
          description: "Your application is under review",
          paymentStage: false
        },
        {
          stage: 5,
          title: "Pay Acceptance Fee",
          description: "Pay acceptance fee to confirm admission",
          paymentStage: true
        },
        {
          stage: 6,
          title: "Await Clearance",
          description: "Document verification in progress",
          paymentStage: false
        },
        {
          stage: 7,
          title: "Pay Administrative Fee",
          description: "Pay administrative processing fee",
          paymentStage: true
        },
        {
          stage: 8,
          title: "Pay School Fees",
          description: "Pay tuition and other school fees",
          paymentStage: true
        },
        {
          stage: 9,
          title: "Application Complete",
          description: "Welcome! Your application process is complete",
          paymentStage: false
        }
      ];

      return stageDefinitions.map(def => ({
        stage: def.stage,
        title: def.title,
        description: def.description,
        paymentStage: def.paymentStage,
        status: def.stage < currentStage ? 'completed' :
                def.stage === currentStage ? 'active' : 'inactive'
      }));
    },

    resumeButtonConfig() {
      const stage = this.currentStage;

      // Payment stages: 2, 5, 7, 8
      if ([2, 5, 7, 8].includes(stage)) {
        return {
          text: 'Make Payment',
          route: '/payment',
          disabled: false,
          variant: 'btn-acon-secondary'
        };
      }

      // Application form stage: 3
      if (stage === 3) {
        return {
          text: 'Complete Application',
          route: '/application-form',
          disabled: false,
          variant: 'btn-acon-secondary'
        };
      }

      // Waiting stages: 1, 4, 6, 9
      if ([1, 4, 6, 9].includes(stage)) {
        const waitingMessages = {
          1: 'Registration Complete',
          4: 'Awaiting Admission Decision',
          6: 'Awaiting Clearance',
          9: 'Application Complete!'
        };

        return {
          text: waitingMessages[stage],
          route: null,
          disabled: true,
          variant: 'btn-secondary'
        };
      }

      // Default
      return {
        text: 'Continue',
        route: '/dashboard',
        disabled: false,
        variant: 'btn-acon-secondary'
      };
    }
  },
  components: { TodoList, BiodataCard, ProgressCard },
};
</script>

<template>
  <div class="container mt-3 px-3 px-md-5 py-5">
    <div class="row g-5">
      <div class="col-md-8">
        <ProgressCard
          class="mb-4"
          :stages="stages"
          :currentStage="application?.currentStage || 0"
          :name="user?.firstName || 'Student'"
          :resumeConfig="resumeButtonConfig"
        />

        <!-- To-do List -->
          <!-- <TodoList :todos="todos" /> -->
      </div>

      <!-- Bio Data Card -->
      <div class="col-md-4">
        <BiodataCard
          profileImage="https://placehold.co/100"
          :name="user?.fullName || 'Loading...'"
          :appNo="application?.applicationNumber || 'Not Started'"
          :email="user?.email || 'Loading...'"
          :phone="user?.phone || 'N/A'"
          gender="N/A"
          location="N/A"
        />

        <!-- Show application prompt if no application -->
        <!-- <div v-if="!application && user?.role === 'applicant'" class="mt-3">
          <div class="card border-warning">
            <div class="card-body text-center">
              <i class="bi bi-exclamation-triangle text-warning mb-2" style="font-size: 2rem;"></i>
              <h6 class="card-title">Application Not Started</h6>
              <p class="card-text text-muted">Complete your application to get started.</p>
              <button @click="$router.push({ name: 'ApplicationForm' })" class="btn btn-warning btn-sm">
                Start Application
              </button>
            </div>
          </div>
        </div> -->
      </div>
    </div>
  </div>
</template>

<style scoped></style>
