<script>
import RichContentDisplay from "../../../components/RichContentDisplay.vue";

export default {
  name: "QuestionViewModal",
  components: {
    RichContentDisplay,
  },
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    question: {
      type: Object,
      default: null,
    },
  },
  emits: ["edit", "close"],
  methods: {
    formatType(type) {
      const types = {
        mcq: "Multiple Choice",
        multi: "Multi-Select",
        essay: "Essay",
      };
      return types[type] || type;
    },
    getDifficultyClass(difficulty) {
      const classes = {
        easy: "bg-success",
        medium: "bg-warning text-dark",
        hard: "bg-danger",
      };
      return classes[difficulty?.toLowerCase()] || "bg-secondary";
    },
    isCorrectAnswer(optionKey) {
      if (!this.question?.answer) return false;

      if (this.question.type === "mcq") {
        return this.question.answer === optionKey;
      } else if (this.question.type === "multi") {
        return (
          Array.isArray(this.question.answer) &&
          this.question.answer.includes(optionKey)
        );
      }
      return false;
    },
    formatDate(date) {
      return new Date(date).toLocaleDateString();
    },
    edit() {
      this.$emit("edit", this.question);
    },
    close() {
      this.$emit("close");
    },
  },
};
</script>

<template>
  <div
    class="modal fade"
    :class="{ show: show }"
    :style="{ display: show ? 'block' : 'none' }"
    tabindex="-1"
  >
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi bi-eye me-2"></i>
            Question Details
          </h5>
          <button type="button" class="btn-close" @click="close"></button>
        </div>

        <div class="modal-body">
          <div v-if="question">
            <div class="mb-4">
              <h6>Question Text</h6>
              <div class="border p-3 rounded bg-light question-content">
                <RichContentDisplay 
                  :content="question.questionText"
                  max-width="100%"
                  max-height="200px"
                />
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-md-5">
                <strong>Type:</strong>
                <span class="badge bg-primary ms-1">{{
                  formatType(question.type)
                }}</span>
              </div>
              <div class="col-md-3">
                <strong>Mark:</strong> {{ question.mark }}
              </div>
              <div class="col-md-4">
                <strong>Difficulty:</strong>
                <span
                  class="badge"
                  :class="getDifficultyClass(question.metadata?.difficulty)"
                >
                  {{ question.metadata?.difficulty || "N/A" }}
                </span>
              </div>
            </div>

            <div v-if="['mcq', 'multi'].includes(question.type)" class="">
              <h6>Options</h6>
              <div
                v-for="(optionText, key) in question.options"
                :key="key"
                class="mb-2"
              >
                <div class="d-flex align-items-center">
                  <span class="badge bg-secondary me-2">
                    {{ key.toUpperCase() }}
                  </span>
                    <RichContentDisplay 
                      :content="optionText"
                      max-width="100%"
                      max-height="100px"
                    />
                  <i
                    v-if="isCorrectAnswer(key)"
                    class="bi bi-check-circle-fill text-success ms-2"
                    :title="'Correct Answer'"
                  ></i>
                </div>
              </div>
            </div>

            <div v-if="question.createdAt" class="text-muted small mt-3">
              Created: {{ formatDate(question.createdAt) }}
            </div>
          </div>

          <div v-else class="text-center py-5">
            <i
              class="bi bi-question-circle text-muted"
              style="font-size: 4rem"
            ></i>
            <h4 class="text-muted mt-3">No Question Selected</h4>
          </div>
        </div>

        <!-- <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="close">
            Close
          </button>
          <button 
            v-if="question" 
            type="button" 
            class="btn btn-primary" 
            @click="edit"
          >
            <i class="bi bi-pencil me-1"></i>
            Edit Question
          </button>
        </div> -->
      </div>
    </div>
  </div>
</template>

<style scoped>
.question-content {
  max-height: 60vh;
  overflow-y: auto;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.question-content p img {
  max-width: 100% !important;
  height: auto !important;
}

.modal-body {
  max-height: 80vh;
  overflow-y: auto;
}

.modal.show {
  background: rgba(0, 0, 0, 0.5);
}
</style>
