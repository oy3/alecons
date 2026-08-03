<script>
import { apiService } from '../../../services/api.js'
import RichContentDisplay from '../../../components/RichContentDisplay.vue'
import { logger } from '@shared/utils/logger'
import Swal from 'sweetalert2'

export default {
  name: 'ManualScoringModal',
  components: {
    RichContentDisplay
  },
  props: {
    show: {
      type: Boolean,
      default: false
    },
    examId: {
      type: String,
      default: ''
    },
    result: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'saved'],
  data() {
    return {
      isLoading: false,
      isSaving: false,
      error: '',
      review: null,
      manualQuestions: [],
      overallFeedback: ''
    }
  },
  computed: {
    studentName() {
      if (!this.review?.student) return 'Student'

      const { firstName, lastName, email } = this.review.student
      if (firstName && lastName) {
        return `${firstName} ${lastName}`
      }

      return email || 'Student'
    },

    objectiveQuestions() {
      return this.review?.questions?.filter((question) => !question.requiresManualScoring) || []
    },

    hasObjectiveQuestions() {
      return this.objectiveQuestions.length > 0
    },

    canFinalize() {
      if (this.manualQuestions.length === 0) return false

      return this.manualQuestions.every((question) => question.isScored)
    },

    pendingManualCount() {
      return this.manualQuestions.filter((question) => !question.isScored).length
    }
  },
  watch: {
    show: {
      immediate: true,
      async handler(value) {
        if (value && this.examId && this.result?._id) {
          await this.loadReview()
        }

        if (!value) {
          this.resetState()
        }
      }
    },
    examId() {
      if (this.show && this.examId && this.result?._id) {
        this.loadReview()
      }
    },
    result: {
      deep: false,
      handler() {
        if (this.show && this.examId && this.result?._id) {
          this.loadReview()
        }
      }
    }
  },
  methods: {
    resetState() {
      this.isLoading = false
      this.isSaving = false
      this.error = ''
      this.review = null
      this.manualQuestions = []
      this.overallFeedback = ''
    },

    async loadReview() {
      try {
        this.isLoading = true
        this.error = ''

        const response = await apiService.getManualReviewPayload(
          this.examId,
          this.result._id
        )

        this.review = response.data || null
        this.overallFeedback = this.review?.result?.overallFeedback || ''
        this.manualQuestions = (this.review?.questions || [])
          .filter((question) => question.requiresManualScoring)
          .map((question) => ({
            questionId: question.questionId,
            order: question.order,
            questionText: question.questionText,
            metadata: question.metadata || null,
            userAnswer: question.userAnswer,
            maxPoints: question.maxPoints,
            pointsAwarded: Number(question.pointsAwarded || 0),
            feedback: question.feedback || '',
            isScored: Boolean(question.isScored),
            gradedAt: question.gradedAt,
          }))
      } catch (error) {
        logger.error('Failed to load manual review payload:', error)
        this.error = error.message || 'Failed to load scoring review data.'
      } finally {
        this.isLoading = false
      }
    },

    markQuestionScored(question) {
      question.isScored = true
    },

    formatAnswer(answer) {
      if (Array.isArray(answer)) {
        return answer.join(', ')
      }

      if (answer === null || answer === undefined || answer === '') {
        return 'No response submitted.'
      }

      return String(answer)
    },

    formatDate(value) {
      if (!value) return '-'
      return new Date(value).toLocaleString()
    },

    getQuestionTypeBadgeClass(type) {
      const classes = {
        essay: 'bg-warning text-dark',
        mcq: 'bg-primary',
        multi: 'bg-info text-dark'
      }

      return classes[type] || 'bg-secondary'
    },

    async saveScores(finalize = false) {
      const invalidQuestion = this.manualQuestions.find(
        (question) =>
          Number.isNaN(Number(question.pointsAwarded)) ||
          Number(question.pointsAwarded) < 0 ||
          Number(question.pointsAwarded) > Number(question.maxPoints)
      )

      if (invalidQuestion) {
        await Swal.fire({
          title: 'Invalid Score',
          text: `Question ${invalidQuestion.order} score must be between 0 and ${invalidQuestion.maxPoints}.`,
          icon: 'error',
          confirmButtonColor: '#007bff'
        })
        return
      }

      if (finalize && !this.canFinalize) {
        await Swal.fire({
          title: 'Manual Scoring Incomplete',
          text: 'Score every essay question before finalizing this result.',
          icon: 'warning',
          confirmButtonColor: '#007bff'
        })
        return
      }

      try {
        this.isSaving = true

        const response = await apiService.saveManualExamScores(this.examId, this.result._id, {
          questionUpdates: this.manualQuestions.map((question) => ({
            questionId: question.questionId,
            pointsAwarded: Number(question.pointsAwarded),
            feedback: question.feedback?.trim() || ''
          })),
          overallFeedback: this.overallFeedback?.trim() || '',
          finalize
        })

        await Swal.fire({
          title: finalize ? 'Result Finalized' : 'Scores Saved',
          text: response.message || (finalize ? 'Manual scoring finalized successfully.' : 'Manual scoring saved successfully.'),
          icon: 'success',
          confirmButtonColor: '#007bff',
          timer: 2500,
          timerProgressBar: true
        })

        this.$emit('saved', response.data || null)
      } catch (error) {
        logger.error('Failed to save manual scores:', error)
        await Swal.fire({
          title: 'Save Failed',
          text: error.message || 'Failed to save manual scores.',
          icon: 'error',
          confirmButtonColor: '#007bff'
        })
      } finally {
        this.isSaving = false
      }
    },

    close() {
      if (this.isSaving) return
      this.$emit('close')
    }
  }
}
</script>

<template>
  <div
    class="modal fade"
    :class="{ show: show }"
    :style="{ display: show ? 'block' : 'none' }"
    tabindex="-1"
  >
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <h5 class="modal-title mb-1">
              <i class="bi bi-journal-check me-2"></i>
              Manual Essay Scoring
            </h5>
            <small v-if="review" class="text-muted">
              {{ review.exam.title }} for {{ studentName }}
            </small>
          </div>
          <button type="button" class="btn-close" @click="close"></button>
        </div>

        <div class="modal-body manual-scoring-body">
          <div v-if="isLoading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-3 mb-0">Loading manual scoring review...</p>
          </div>

          <div v-else-if="error" class="alert alert-danger mb-0">
            <i class="bi bi-exclamation-triangle me-2"></i>
            {{ error }}
          </div>

          <div v-else-if="review">
            <div class="row g-3 mb-4">
              <div class="col-md-3">
                <div class="summary-card">
                  <small class="text-muted d-block">Current Score</small>
                  <strong>{{ review.result.totalScore }}/{{ review.result.maxScore }}</strong>
                  <div class="text-muted small">{{ review.result.percentage }}%</div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="summary-card">
                  <small class="text-muted d-block">Grading Status</small>
                  <strong class="text-capitalize">{{ review.result.gradingStatus }}</strong>
                  <div class="text-muted small">{{ pendingManualCount }} essay question(s) pending</div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="summary-card">
                  <small class="text-muted d-block">Submitted</small>
                  <strong>{{ formatDate(review.attempt.submittedAt) }}</strong>
                  <div class="text-muted small">Time spent: {{ review.attempt.timeSpent || 0 }}s</div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="summary-card">
                  <small class="text-muted d-block">Student</small>
                  <strong>{{ studentName }}</strong>
                  <div class="text-muted small">{{ review.student?.email || 'No email' }}</div>
                </div>
              </div>
            </div>

            <div class="alert alert-info d-flex align-items-start gap-2">
              <i class="bi bi-info-circle mt-1"></i>
              <div>
                Objective questions remain read-only here. Score the essay questions below, save progress as needed, and finalize once every essay response has been reviewed.
              </div>
            </div>

            <div class="mb-4">
              <label class="form-label fw-semibold">Overall Feedback</label>
              <textarea
                v-model="overallFeedback"
                class="form-control"
                rows="3"
                maxlength="2000"
                placeholder="Optional overall feedback for this candidate"
              ></textarea>
            </div>

            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="mb-0">Essay Questions</h6>
              <span class="badge bg-light text-dark border">
                {{ manualQuestions.length - pendingManualCount }}/{{ manualQuestions.length }} scored
              </span>
            </div>

            <div v-if="manualQuestions.length === 0" class="alert alert-secondary">
              This result does not contain essay questions that require manual scoring.
            </div>

            <div v-else class="question-list">
              <div v-for="question in manualQuestions" :key="question.questionId" class="question-card">
                <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <div class="fw-semibold mb-1">Question {{ question.order }}</div>
                    <span class="badge" :class="getQuestionTypeBadgeClass('essay')">Essay</span>
                    <span v-if="question.isScored" class="badge bg-success ms-2">Scored</span>
                    <span v-else class="badge bg-warning text-dark ms-2">Pending</span>
                  </div>
                  <div class="text-end text-muted small">
                    Max {{ question.maxPoints }} mark(s)
                    <div v-if="question.gradedAt">Last scored {{ formatDate(question.gradedAt) }}</div>
                  </div>
                </div>

                <div class="fw-semibold mb-2">
                  <RichContentDisplay :content="question.questionText" max-width="100%" max-height="220px" />
                </div>

                <div v-if="question.metadata?.topic || question.metadata?.difficulty" class="text-muted small mb-3">
                  <span v-if="question.metadata?.topic">Topic: {{ question.metadata.topic }}</span>
                  <span v-if="question.metadata?.topic && question.metadata?.difficulty"> | </span>
                  <span v-if="question.metadata?.difficulty">Difficulty: {{ question.metadata.difficulty }}</span>
                </div>

                <div class="answer-panel mb-3">
                  <div class="small text-muted text-uppercase fw-semibold mb-2">Student Answer</div>
                  <div class="answer-text">{{ formatAnswer(question.userAnswer) }}</div>
                </div>

                <div class="row g-3">
                  <div class="col-md-3">
                    <label class="form-label">Score Awarded</label>
                    <input
                      v-model.number="question.pointsAwarded"
                      type="number"
                      class="form-control"
                      min="0"
                      :max="question.maxPoints"
                      step="1"
                      @input="markQuestionScored(question)"
                    />
                  </div>
                  <div class="col-md-9">
                    <label class="form-label">Feedback</label>
                    <textarea
                      v-model="question.feedback"
                      class="form-control"
                      rows="3"
                      maxlength="1000"
                      placeholder="Optional feedback for this essay response"
                      @input="markQuestionScored(question)"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="hasObjectiveQuestions" class="mt-4">
              <h6 class="mb-3">Objective Questions</h6>
              <div class="objective-list">
                <div v-for="question in objectiveQuestions" :key="question.questionId" class="objective-card">
                  <div class="d-flex justify-content-between align-items-start gap-3">
                    <div>
                      <div class="fw-semibold">Question {{ question.order }}</div>
                      <div class="text-muted small objective-question-text">
                        <RichContentDisplay :content="question.questionText" max-width="100%" max-height="180px" />
                      </div>
                    </div>
                    <div class="text-end small">
                      <span class="badge" :class="getQuestionTypeBadgeClass(question.type)">
                        {{ question.type.toUpperCase() }}
                      </span>
                      <div class="mt-2">{{ question.pointsAwarded }}/{{ question.maxPoints }} mark(s)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer justify-content-between">
          <div class="text-muted small">
            <span v-if="review">
              Release remains unavailable until the exam reaches fully graded status.
            </span>
          </div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-secondary" @click="close" :disabled="isSaving">
              Close
            </button>
            <button type="button" class="btn btn-outline-primary" @click="saveScores(false)" :disabled="isSaving || isLoading || !review">
              <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
              Save Progress
            </button>
            <button type="button" class="btn btn-primary" @click="saveScores(true)" :disabled="isSaving || isLoading || !review || !canFinalize">
              <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
              Finalize Result
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal.show {
  background: rgba(0, 0, 0, 0.5);
}

.manual-scoring-body {
  max-height: 75vh;
}

.summary-card {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 0.75rem;
  padding: 1rem;
  height: 100%;
}

.question-list,
.objective-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.question-card,
.objective-card {
  border: 1px solid #dee2e6;
  border-radius: 0.9rem;
  background: #fff;
  padding: 1rem;
}

.answer-panel {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 0.75rem;
  padding: 0.875rem;
}

.answer-text {
  white-space: pre-wrap;
  line-height: 1.5;
}
</style>