<script>
export default {
  name: "ProgressCard",
  props: {
    stages: Array,
    currentStage: Number,
    name: { type: String, default: "John" }
  },
  computed: {
    progressPercent() {
      return (this.currentStage / (this.stages.length - 1)) * 100;
    }
  }
};
</script>

<template>
  <div class="card shadow border-0 py-3 px-5 rounded-5">
    <div class="card-body">
      <h5 class="card-title mb-4">Your Progress</h5>

      <p class="mb-4">
        <span class="acon-text-dark fw-bold">Hi {{ name }}</span>, You have
        completed {{ progressPercent.toFixed(0) }}% of your application process. Keep going.
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
          <div class="dots-overlay d-flex justify-content-between position-absolute start-0 w-100">
            <div
              v-for="(stage, index) in stages"
              :key="index"
              class="d-flex flex-column align-items-center"
              style="width: 0"
            >
              <span class="dot" :class="{ completed: index <= currentStage }"></span>
              <small class="text-muted text-center">{{ stage }}</small>
            </div>
          </div>
        </div>
      </div>

      <button class="btn btn-acon-secondary btn-sm rounded-4 px-4 mt-3">
        Resume
      </button>
    </div>
  </div>
</template>

<style scoped>
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
  background-color: var(--bs-secondary-bg);
  flex-shrink: 0;
  transform: translateY(-50%);
}
.dot.completed {
  background-color: #2d7d7d;
}
</style>
