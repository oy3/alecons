<template>
  <div class="card h-100" :class="cardClass">
    <div class="card-header d-flex justify-content-between align-items-center">
      <h6 class="card-title mb-0">{{ exam.title }}</h6>
      <span :class="statusBadgeClass">{{ statusText }}</span>
    </div>
    <div class="card-body">
      <p class="card-text text-muted small">{{ exam.description }}</p>
      
      <!-- Exam Details -->
      <div class="exam-details mb-3">
        <div class="row text-center">
          <div class="col-4">
            <i class="bi bi-clock text-muted"></i>
            <div class="small">{{ exam.duration }} min</div>
          </div>
          <div class="col-4">
            <i class="bi bi-question-circle text-muted"></i>
            <div class="small">{{ exam.totalQuestions }} questions</div>
          </div>
          <div class="col-4">
            <i class="bi bi-award text-muted"></i>
            <div class="small">{{ exam.totalMark }} marks</div>
          </div>
        </div>
      </div>

      <!-- Exam Time -->
      <div class="mb-3">
        <small class="text-muted">
          <i class="bi bi-calendar me-1"></i>
          {{ formatDateTime(exam.examTimestamp) }}
        </small>
      </div>

      <!-- Progress for in-progress exams -->
      <div v-if="type === 'continue' && exam.userAttempt" class="mb-3">
        <div class="progress">
          <div 
            class="progress-bar bg-warning" 
            :style="{ width: progressPercentage + '%' }"
          ></div>
        </div>
        <small class="text-muted">
          {{ answeredQuestions }}/{{ exam.totalQuestions }} answered
        </small>
      </div>

      <!-- Time remaining for upcoming exams -->
      <div v-if="type === 'upcoming'" class="mb-3">
        <div class="alert alert-info small py-2 mb-0">
          <i class="bi bi-info-circle me-1"></i>
          Starts {{ timeUntilExam }}
        </div>
      </div>

      <!-- Results summary for completed exams -->
      <div v-if="type === 'completed' && exam.result" class="mb-3">
        <div class="row text-center">
          <div class="col-6">
            <div class="small text-muted">Score</div>
            <div class="fw-bold" :class="scoreClass">
              {{ exam.result.percentage }}%
            </div>
          </div>
          <div class="col-6">
            <div class="small text-muted">Status</div>
            <div class="fw-bold" :class="exam.result.status === 'pass' ? 'text-success' : 'text-danger'">
              {{ exam.result.status.toUpperCase() }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="card-footer bg-transparent">
      <button 
        v-if="type === 'available'" 
        @click="$emit('start', exam)"
        class="btn btn-primary w-100"
      >
        <i class="bi bi-play-fill me-1"></i>
        Start Exam
      </button>

      <button 
        v-if="type === 'continue'" 
        @click="$emit('continue', exam)"
        class="btn btn-warning w-100"
      >
        <i class="bi bi-arrow-right-circle me-1"></i>
        Continue Exam
      </button>

      <button 
        v-if="type === 'completed'" 
        @click="$emit('viewResults', exam)"
        class="btn btn-outline-success w-100"
      >
        <i class="bi bi-eye me-1"></i>
        View Results
      </button>

      <button 
        v-if="type === 'upcoming'" 
        class="btn btn-secondary w-100"
        disabled
      >
        <i class="bi bi-clock me-1"></i>
        Not Yet Available
      </button>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'ExamCard',
  props: {
    exam: {
      type: Object,
      required: true
    },
    type: {
      type: String,
      required: true,
      validator: value => ['available', 'continue', 'upcoming', 'completed'].includes(value)
    }
  },
  emits: ['start', 'continue', 'viewResults'],
  setup(props) {
    const cardClass = computed(() => {
      switch (props.type) {
        case 'available': return 'border-primary'
        case 'continue': return 'border-warning'
        case 'upcoming': return 'border-info'
        case 'completed': return 'border-success'
        default: return ''
      }
    })

    const statusBadgeClass = computed(() => {
      switch (props.type) {
        case 'available': return 'badge bg-primary'
        case 'continue': return 'badge bg-warning'
        case 'upcoming': return 'badge bg-info'
        case 'completed': return 'badge bg-success'
        default: return 'badge bg-secondary'
      }
    })

    const statusText = computed(() => {
      switch (props.type) {
        case 'available': return 'Available'
        case 'continue': return 'In Progress'
        case 'upcoming': return 'Upcoming'
        case 'completed': return 'Completed'
        default: return 'Unknown'
      }
    })

    const progressPercentage = computed(() => {
      if (props.exam.userAttempt && props.exam.userAttempt.answers) {
        return Math.round((props.exam.userAttempt.answers.length / props.exam.totalQuestions) * 100)
      }
      return 0
    })

    const answeredQuestions = computed(() => {
      return props.exam.userAttempt?.answers?.length || 0
    })

    const scoreClass = computed(() => {
      if (!props.exam.result) return ''
      return props.exam.result.percentage >= 70 ? 'text-success' : 
             props.exam.result.percentage >= 50 ? 'text-warning' : 'text-danger'
    })

    const timeUntilExam = computed(() => {
      const now = new Date()
      const examTime = new Date(props.exam.examTimestamp)
      const diff = examTime - now
      
      if (diff <= 0) return 'now'
      
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      
      if (hours > 24) {
        const days = Math.floor(hours / 24)
        return `in ${days} day${days > 1 ? 's' : ''}`
      } else if (hours > 0) {
        return `in ${hours}h ${minutes}m`
      } else {
        return `in ${minutes} minutes`
      }
    })

    const formatDateTime = (dateStr) => {
      const date = new Date(dateStr)
      return date.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    return {
      cardClass,
      statusBadgeClass,
      statusText,
      progressPercentage,
      answeredQuestions,
      scoreClass,
      timeUntilExam,
      formatDateTime
    }
  }
}
</script>

<style scoped>
.card {
  transition: all 0.3s ease;
}

.card:hover {
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.exam-details .bi {
  font-size: 1.2rem;
  margin-bottom: 0.25rem;
}
</style>