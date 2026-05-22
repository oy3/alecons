<template>
  <div
    class="idle-session-overlay"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="titleId"
    :aria-describedby="descriptionId"
  >
    <div class="idle-session-modal card shadow-lg" @click.stop>
      <div class="card-body p-4 p-md-4">
        <div class="d-flex flex-column align-items-center">
          <div class="text-center">
            <div class="idle-session-icon" :class="modeClass">
              <i :class="iconClass"></i>
            </div>
            <h4 :id="titleId" class="mb-3">{{ title }}</h4>
          </div>
          
          <p :id="descriptionId" class="text-muted mb-3">
            {{ description }}
          </p>

          <div v-if="isProtectedMode" class="alert alert-warning mb-4">
            <div class="fw-semibold mb-1">Session will end soon</div>
            <div>
              You will be logged out automatically in
              <span class="countdown-badge">{{ formattedGraceSeconds }}</span>
              if you do not confirm.
            </div>
          </div>

          <div v-else class="alert alert-info mb-4">
            Your exam clock is still running. Click Continue Exam when you are
            ready to resume.
          </div>

          <div class="d-flex flex-wrap gap-2 justify-content-end">
            <button
              v-if="isProtectedMode"
              type="button"
              class="btn btn-outline-secondary"
              @click="$emit('logout')"
            >
              Logout Now
            </button>
            <button
              type="button"
              class="btn btn-primary"
              @click="$emit('continue')"
            >
              {{ continueLabel }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from "vue";

export default {
  name: "IdleSessionModal",
  props: {
    mode: {
      type: String,
      required: true,
      validator: (value) => ["protected", "exam"].includes(value),
    },
    graceSecondsRemaining: {
      type: Number,
      default: 60,
    },
  },
  emits: ["continue", "logout"],
  setup(props) {
    const isProtectedMode = computed(() => props.mode === "protected");
    const title = computed(() =>
      isProtectedMode.value ? "Session Timeout Warning" : "Exam Activity Check",
    );
    const description = computed(() =>
      isProtectedMode.value
        ? "You have been inactive for 15 minutes. Click Continue Session to stay signed in."
        : "You have been inactive for 15 minutes during this exam. Click Continue Exam to keep working.",
    );
    const continueLabel = computed(() =>
      isProtectedMode.value ? "Continue Session" : "Continue Exam",
    );
    const iconClass = computed(() =>
      isProtectedMode.value ? "bi bi-hourglass-split" : "bi bi-journal-check",
    );
    const modeClass = computed(() =>
      isProtectedMode.value ? "is-warning" : "is-info",
    );
    const formattedGraceSeconds = computed(() => {
      const totalSeconds = Math.max(0, props.graceSecondsRemaining);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      return `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    });

    return {
      continueLabel,
      description,
      formattedGraceSeconds,
      iconClass,
      isProtectedMode,
      modeClass,
      title,
      titleId: "idle-session-modal-title",
      descriptionId: "idle-session-modal-description",
    };
  },
};
</script>

<style scoped>
.idle-session-overlay {
  position: fixed;
  inset: 0;
  z-index: 11000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(15, 23, 42, 0.62);
  backdrop-filter: blur(4px);
}

.idle-session-modal {
  width: min(100%, 32rem);
  border: 0;
  border-radius: 1rem;
}

.idle-session-icon {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  flex-shrink: 0;
}

.idle-session-icon.is-warning {
  background: rgba(255, 193, 7, 0.18);
  color: #9a6700;
}

.idle-session-icon.is-info {
  background: rgba(13, 110, 253, 0.16);
  color: #0d6efd;
}

.countdown-badge {
  display: inline-block;
  min-width: 4.5rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(255, 193, 7, 0.2);
  color: #7a5600;
  font-weight: 700;
  text-align: center;
}
</style>
