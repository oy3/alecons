<script lang="js">
import { useAuthStore } from "../../stores/auth.js";
import { logger } from '@shared/utils/logger';
import TodoList from "./components/TodoList.vue";
import BiodataCard from "./components/BiodataCard.vue";
import ProgressCard from "./components/ProgressCard.vue";
import EmailVerificationAlert from "./components/EmailVerificationAlert.vue";
import Swal from 'sweetalert2';

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
        "Form Fee",
        "Application Form",
        "Entrance Exam",
        "Screening",
        "Admission Decision",
        "Acceptance Fee",
        "Sundry Fee",
        "School Fees",
        "Completed",
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
          description: "Fill out your application details and upload documents",
          paymentStage: false
        },
        {
          stage: 4,
          title: "Await Entrance Exam Scheduling",
          description: "Wait for admin to schedule your online entrance exam",
          paymentStage: false
        },
        {
          stage: 5,
          title: "Await Screening & Interview",
          description: "Wait for physical screening and interview scheduling",
          paymentStage: false
        },
        {
          stage: 6,
          title: "Await Admission Decision",
          description: "Your application is under review for admission",
          paymentStage: false
        },
        {
          stage: 7,
          title: "Pay Acceptance Fee",
          description: "Pay acceptance fee to confirm your admission",
          paymentStage: true
        },
        {
          stage: 8,
          title: "Pay Sundry Fees",
          description: "Pay administrative and sundry charges",
          paymentStage: true
        },
        {
          stage: 9,
          title: "Pay School Fees",
          description: "Pay tuition and other school fees",
          paymentStage: true
        },
        {
          stage: 10,
          title: "Application Complete",
          description: "Welcome! Check your email for matriculation number and portal access details",
          paymentStage: false
        },
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

      // Payment stages: 2, 7, 8, 9
      if ([2, 7, 8, 9].includes(stage)) {
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

      // Stages with exam/screening info available
      if ([4, 5].includes(stage) && this.hasExamOrScreeningInfo) {
        return {
          text: 'View Details',
          route: null,
          disabled: false,
          variant: 'btn-info',
          showModal: true
        };
      }

      // Waiting stages: 1, 4, 5, 6
      if ([1, 4, 5, 6].includes(stage)) {
        const waitingMessages = {
          1: 'Check Your Email',
          4: 'Awaiting Exam Scheduling',
          5: 'Awaiting Screening Schedule',
          6: 'Awaiting Admission Decision'
        };

        return {
          text: waitingMessages[stage],
          route: null,
          disabled: true,
          variant: 'btn-secondary'
        };
      }

      // Stage 10: Application Complete - Redirect to Student Portal
      if (stage === 10) {
        return {
          text: 'Access Student Portal',
          route: null,
          disabled: false,
          variant: 'btn-success',
          action: 'redirectToStudentPortal'
        };
      }

      // Default
      return {
        text: 'Continue',
        route: '/dashboard',
        disabled: false,
        variant: 'btn-acon-secondary'
      };
    },

    hasExamOrScreeningInfo() {
      return !!(this.application?.entranceExam || this.application?.screening);
    }
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
    },

    showExamScreeningModal() {
      // Show modal with exam/screening details
      const application = this.application;
      let modalContent = '<div class="text-start">';
      
      if (application?.entranceExam) {
        const exam = application.entranceExam;
        modalContent += `
          <h6 class="text-primary mb-3"><i class="bi bi-laptop me-2"></i>Entrance Exam Details</h6>
          <div class="mb-3 p-3 bg-light rounded">
            <p class="mb-2"><strong>Date:</strong> ${new Date(exam.date).toLocaleDateString('en-US', { 
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })}</p>
            <p class="mb-2"><strong>Time:</strong> ${exam.time}</p>
            ${exam.link ? `<p class="mb-2"><strong>Exam Link:</strong> <a href="${exam.link}" target="_blank" class="text-decoration-none">${exam.link}</a></p>` : ''}
            ${exam.score !== undefined ? `<p class="mb-0"><strong>Score:</strong> <span class="badge bg-success">${exam.score}%</span></p>` : ''}
          </div>
        `;
      }
      
      if (application?.screening) {
        const screening = application.screening;
        modalContent += `
          <h6 class="text-info mb-3"><i class="bi bi-people me-2"></i>Screening & Interview Details</h6>
          <div class="mb-3 p-3 bg-light rounded">
            <p class="mb-2"><strong>Date:</strong> ${new Date(screening.date).toLocaleDateString('en-US', { 
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })}</p>
            <p class="mb-2"><strong>Time:</strong> ${screening.time}</p>
            <p class="mb-2"><strong>Venue:</strong> ${screening.venue}</p>
            <p class="mb-0"><strong>Status:</strong> 
              <span class="badge ${screening.completed ? 'bg-success' : 'bg-warning'}">${screening.completed ? 'Completed' : 'Scheduled'}</span>
            </p>
          </div>
        `;
      }
      
      modalContent += '</div>';
      
      Swal.fire({
        title: 'Exam & Screening Information',
        html: modalContent,
        confirmButtonText: 'Close',
        confirmButtonColor: '#1a5f5f',
        width: '600px'
      });
    },

    redirectToStudentPortal() {
      // Show confirmation before redirecting
      Swal.fire({
        icon: 'info',
        title: 'Access Student Portal',
        text: 'You will be redirected to the student portal. Make sure you have received your matriculation number via email.',
        showCancelButton: true,
        confirmButtonText: 'Continue to Student Portal',
        cancelButtonText: 'Stay Here',
        confirmButtonColor: '#1a5f5f',
        cancelButtonColor: '#6c757d'
      }).then((result) => {
        if (result.isConfirmed) {
          // Get student portal URL from environment or use default
          const studentPortalUrl = import.meta.env.VITE_APP_STUDENT_PORTAL_URL || 'http://localhost:3000/student-portal';
          window.open(studentPortalUrl, '_blank');
        }
      });
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
          @show-modal="showExamScreeningModal"
          @redirectToStudentPortal="redirectToStudentPortal"
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
