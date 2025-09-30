<script lang="js">
import { useAuthStore } from "../../stores/auth.js";
import { logger } from '@shared/utils/logger';
import TodoList from "./components/TodoList.vue";
import BiodataCard from "./components/BiodataCard.vue";
import ProgressCard from "./components/ProgressCard.vue";
import EmailVerificationAlert from "./components/EmailVerificationAlert.vue";

export default {
  name: "Dashboard",
  setup() {
    const authStore = useAuthStore();
    return {
      authStore
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
      userData: this.authStore.user,
      applicationData: this.authStore.application,
    });

    // Note: General data refresh is now handled by App.vue
    // Only add email verification specific listener
    window.addEventListener('focus', this.onEmailVerificationFocus);
  },
  
  beforeUnmount() {
    // Clean up event listener
    window.removeEventListener('focus', this.onEmailVerificationFocus);
  },

  methods: {
    async onEmailVerificationFocus() {
      // Refresh user data when window regains focus specifically to check email verification status
      if (this.authStore.isAuthenticated && this.user && this.user.isEmailVerified === false) {
        logger.info('Window focused, checking for email verification updates...');
        try {
          await this.authStore.refreshUserData();
          logger.info('Email verification status refreshed');
        } catch (error) {
          logger.error('Failed to refresh email verification status on focus:', error);
        }
      }
    }
  },
  computed: {
    user() {
      return this.authStore.user;
    },
    application() {
      return this.authStore.application;
    },
    isAuthenticated() {
      return this.authStore.isAuthenticated;
    },
    progressPercent() {
      return ((this.application?.currentStage) / (this.stages.length - 1)) * 100;
    },

    currentStage() {
      return this.application?.currentStage;
    },

    // Computed properties for BiodataCard data
    userDisplayName() {
      return this.user?.fullName || 
             `${this.user?.firstName || ''} ${this.user?.lastName || ''}`.trim() || 
             'Loading...';
    },

    userPhone() {
      // Phone number is stored in application object
      const applicationPhone = this.application?.phone;
      
      logger.info('Phone data check:', {
        applicationPhone,
        hasApplication: !!this.application,
        applicationKeys: this.application ? Object.keys(this.application) : []
      });
      
      return applicationPhone || 'N/A';
    },

    userLocation() {
      // Check application nationality field
      const nationality = this.application?.nationality;
      const stateOfOrigin = this.application?.stateOfOrigin;
      const location = nationality || stateOfOrigin;
      
      logger.info('Location data check:', {
        applicationNationality: nationality,
        applicationStateOfOrigin: stateOfOrigin,
        finalLocation: location,
        applicationKeys: this.application ? Object.keys(this.application) : []
      });
      
      return location || 'N/A';
    },

    todos() {
      const currentStage = this.currentStage;
      const stageDefinitions = [
        {
          stage: 1,
          title: "Verify Email Address", 
          description: "Check your email and click the verification link",
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
          1: 'Check Your Email',
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
  components: { TodoList, BiodataCard, ProgressCard, EmailVerificationAlert },
};
</script>

<template>
  <div class="container mt-3 px-3 px-md-5 py-5">
    <div class="row gy-5">
      <div class="col-md-8">
        <!-- Email Verification Alert -->
        <EmailVerificationAlert v-if="user && user.isEmailVerified === false" :user="user" />
        
        <ProgressCard
          class="mb-4"
          :stages="stages"
          :currentStage="application?.currentStage || 0"
          :name="user?.firstName || 'Student'"
          :resumeConfig="resumeButtonConfig"
        />

        <!-- To-do List -->
          <TodoList :todos="todos" />
      </div>

      <!-- Bio Data Card -->
      <div class="col-md-4">
        <BiodataCard
          :profileImage="application?.profileImageUrl || 'https://placehold.co/100?text=IMG'"
          :name="userDisplayName"
          :appNo="application?.applicationNumber || 'Not Started'"
          :email="user?.email || 'Loading...'"
          :phone="userPhone"
          :gender="application?.gender || 'N/A'"
          :location="userLocation"
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
