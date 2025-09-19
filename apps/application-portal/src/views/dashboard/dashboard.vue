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
      todos: [
        { title: "Submit Application", description: "Complete and submit your form" },
        { title: "Make Payment", description: "Pay the application fee" },
        { title: "Upload Documents", description: "Upload all required credentials" },
        { title: "Check Status", description: "Track your application progress" },
        { title: "Attend Interview", description: "Be available for the scheduled interview" },
      ],
      stages: [
        "Registration",
        "Form Fee",
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
      userId: this.user?.id,
      email: this.user?.email,
      application: this.application,
      applicationNumber: this.application?.applicationNumber,
      currentStage: this.application?.currentStage
    });

    // Check if user has an application
    if (!this.application && this.user?.role === 'applicant') {
      logger.warn('User is an applicant but has no application record');
      // Optionally redirect to application form or show a prompt
      this.$nextTick(() => {
        Swal.fire({
          icon: 'info',
          title: 'Complete Your Application',
          text: 'You need to complete your application form to continue.',
          confirmButtonText: 'Go to Application Form',
          confirmButtonColor: '#2d7d7d',
        }).then((result) => {
          if (result.isConfirmed) {
            this.$router.push({ name: 'ApplicationForm' });
          }
        });
      });
    }
  },
  methods: {
    logout() {
      logger.info('User initiated logout');
      authManager.clearAuth();
      this.$router.push({ name: 'Login' });
    },
  },
  computed: {
    progressPercent() {
      return ((this.application?.currentStage || 1) / (this.stages.length - 1)) * 100;
    },
  },
  components: { TodoList, BiodataCard, ProgressCard },
};
</script>

<template>
  <div class="container-fluid mt-3 p-5">
    <!-- User Welcome Header -->
    <!-- <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h2 class="mb-0">Welcome back, {{ user?.firstName }}!</h2>
            <p class="text-muted mb-0">Application Number: {{ applicationNumber || 'Loading...' }}</p>
          </div>
          <button @click="logout" class="btn btn-outline-danger">
            <i class="bi bi-box-arrow-right"></i> Logout
          </button>
        </div>
      </div>
    </div> -->

    <div class="row g-5">
      <div class="col-lg-8 col-12">
        <ProgressCard
          class="mb-4"
          :stages="stages"
          :currentStage="application?.currentStage || 1"
          :name="user?.firstName || 'Student'"
        />

        <!-- To-do -->
        <TodoList :todos="todos" />
      </div>

      <!-- Bio Data Card -->
      <div class="col-lg-4 col-12">
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
        <div v-if="!application && user?.role === 'applicant'" class="mt-3">
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
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
