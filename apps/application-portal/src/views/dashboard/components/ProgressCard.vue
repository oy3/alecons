<script>
export default {
  name: "ProgressCard",
  props: {
    stages: Array,
    currentStage: Number,
    userName: { type: String, default: "" },
    resumeConfig: {
      type: Object,
      default: () => ({
        text: "Continue",
        route: "/dashboard",
        disabled: false,
        variant: "btn-acon-secondary",
      }),
    },
    locked: { type: Boolean, default: false },
  },
  computed: {
    progressPercent() {
      // Progress should show completed stages, not current stage
      // If currentStage = 3 (working on stage 3), then 2 stages are completed
      const completedStages = Math.max(0, this.currentStage - 1);
      return (completedStages / (this.stages.length - 1)) * 100;
    },
  },
  methods: {
    handleResumeClick() {
      if (this.resumeConfig.showModal) {
        this.$emit("show-modal");
      } else if (this.resumeConfig.action) {
        // Handle custom actions
        this.$emit(this.resumeConfig.action);
      } else if (this.resumeConfig.route) {
        this.$router.push(this.resumeConfig.route);
      }
    },
  },
};
</script>

<template>
  <div class="card shadow border-0 py-3 px-5 rounded-5">
    <div class="card-body">
      <h5 class="card-title mb-4">Your Progress</h5>

      <p class="mb-4">
        <span class="acon-text-primary fw-bold">Hi  <span class="text-capitalize">{{ userName }}</span></span
        >, You have completed {{ progressPercent.toFixed(0) }}% of your
        application process. Keep going.
      </p>

      <div class="position-relative mb-5">
        <div
          class="progress"
          role="progressbar"
          :aria-valuenow="progressPercent"
          aria-valuemin="0"
          aria-valuemax="100"
          style="height: 2px"
        >
          <div
            class="progress-bar acon-bg-primary"
            :style="{ width: progressPercent + '%' }"
          ></div>

          <!-- Dots -->
          <div
            class="dots-overlay d-flex justify-content-between position-absolute start-0 w-100"
          >
            <div
              v-for="(stage, index) in stages"
              :key="index"
              class="d-flex flex-column align-items-center"
              style="width: 0"
            >
              <span
                class="dot"
                :class="{ completed: index < Math.max(0, currentStage) }"
              ></span>
              <small
                class="text-muted text-center stage-label"
                :class="{ 'current-stage': index === currentStage - 1 }"
              >
                {{ stage }}
              </small>
            </div>
          </div>
        </div>
      </div>

      <button
        v-if="!resumeConfig.disabled && !locked"
        @click="handleResumeClick"
        :class="[
          'btn',
          'btn-sm',
          'rounded-4',
          'px-4',
          'mt-3',
          resumeConfig.variant,
        ]"
      >
        {{ resumeConfig.text || "Resume" }}
      </button>

      <button
        v-else-if="!locked"
        :disabled="resumeConfig.disabled"
        :class="[
          'btn',
          'btn-sm',
          'rounded-4',
          'px-4',
          'mt-3',
          resumeConfig.variant,
        ]"
      >
        {{ resumeConfig.text || "Resume" }}
      </button>
    </div>
  </div>
</template>

<style scoped>
@media screen and (max-width: 768px) {
  /* Hide all stage labels on mobile */
  .stage-label {
    display: none;
  }

  /* Only show the current stage label on mobile */
  .stage-label.current-stage {
    display: block;
  }
}

.dots-overlay {
  top: 50%;
  transform: translateY(-50%);
  height: 0;
  overflow: visible;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--bs-secondary-bg) !important;
  flex-shrink: 0;
  transform: translateY(-50%);
}
.dot.completed {
  background-color: var(--acon-primary) !important;
}
</style>
