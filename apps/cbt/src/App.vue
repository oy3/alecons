<template>
  <div id="app">
    <router-view />
    <IdleSessionModal
      v-if="isIdleModalVisible"
      :mode="idleModalMode"
      :grace-seconds-remaining="graceSecondsRemaining"
      @continue="handleIdleContinue"
      @logout="handleIdleLogout"
    />
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import IdleSessionModal from './components/IdleSessionModal.vue'
import { authStore } from './stores/auth.js'
import { examStore } from './stores/exam.js'
import { apiService } from './services/api.js'
import { logger } from '@shared/utils/logger'

const IDLE_WARNING_MS = 15 * 60 * 1000
const NON_EXAM_GRACE_SECONDS = 60
const EXAM_WARNING_SUPPRESSION_SECONDS = 5 * 60
const ACTIVITY_THROTTLE_MS = 1000
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'mousemove']

export default {
  name: 'App',
  components: {
    IdleSessionModal
  },
  setup() {
    const route = useRoute()
    const isIdleModalVisible = ref(false)
    const idleModalMode = ref('protected')
    const graceSecondsRemaining = ref(NON_EXAM_GRACE_SECONDS)
    const lastTrackedActivityAt = ref(Date.now())

    let idleWarningTimer = null
    let graceLogoutTimer = null
    let graceCountdownTimer = null

    const isProtectedRoute = computed(() => {
      return Boolean(authStore.isAuthenticated && route.meta?.requiresAuth)
    })

    const hasActiveExamSession = computed(() => {
      return Boolean(
        route.meta?.idlePolicy === 'exam' &&
        examStore.currentExamId &&
        examStore.currentAttemptId &&
        !examStore.isSubmitted
      )
    })

    const isExamWarningSuppressed = computed(() => {
      return Boolean(
        hasActiveExamSession.value &&
        examStore.timeRemaining > 0 &&
        examStore.timeRemaining <= EXAM_WARNING_SUPPRESSION_SECONDS
      )
    })

    const activeIdleMode = computed(() => {
      if (!isProtectedRoute.value) {
        return 'none'
      }

      if (route.meta?.idlePolicy === 'exam') {
        if (!hasActiveExamSession.value || isExamWarningSuppressed.value) {
          return 'none'
        }

        return 'exam'
      }

      return 'protected'
    })

    const clearIdleWarningTimer = () => {
      if (idleWarningTimer) {
        clearTimeout(idleWarningTimer)
        idleWarningTimer = null
      }
    }

    const clearGraceWindow = () => {
      if (graceLogoutTimer) {
        clearTimeout(graceLogoutTimer)
        graceLogoutTimer = null
      }

      if (graceCountdownTimer) {
        clearInterval(graceCountdownTimer)
        graceCountdownTimer = null
      }
    }

    const unlockBodyScroll = () => {
      document.body.classList.remove('idle-modal-open')
    }

    const lockBodyScroll = () => {
      document.body.classList.add('idle-modal-open')
    }

    const hideIdleModal = () => {
      isIdleModalVisible.value = false
      clearGraceWindow()
      unlockBodyScroll()
    }

    const clearAllIdleTimers = () => {
      clearIdleWarningTimer()
      clearGraceWindow()
    }

    const armIdleWarningTimer = () => {
      clearIdleWarningTimer()

      if (activeIdleMode.value === 'none' || isIdleModalVisible.value) {
        return
      }

      idleWarningTimer = window.setTimeout(() => {
        if (activeIdleMode.value === 'none') {
          clearIdleWarningTimer()
          return
        }

        if (
          activeIdleMode.value === 'exam' &&
          (examStore.isSubmitted || examStore.timeRemaining <= EXAM_WARNING_SUPPRESSION_SECONDS)
        ) {
          clearIdleWarningTimer()
          return
        }

        idleModalMode.value = activeIdleMode.value
        isIdleModalVisible.value = true
        lockBodyScroll()

        if (activeIdleMode.value === 'protected') {
          const graceDeadline = Date.now() + NON_EXAM_GRACE_SECONDS * 1000
          graceSecondsRemaining.value = NON_EXAM_GRACE_SECONDS

          clearGraceWindow()
          graceCountdownTimer = window.setInterval(() => {
            const secondsLeft = Math.max(
              0,
              Math.ceil((graceDeadline - Date.now()) / 1000)
            )

            graceSecondsRemaining.value = secondsLeft

            if (secondsLeft <= 0) {
              clearGraceWindow()
            }
          }, 250)

          graceLogoutTimer = window.setTimeout(() => {
            logger.info('Idle session grace window expired - logging out user')
            hideIdleModal()
            authStore.logout()
          }, NON_EXAM_GRACE_SECONDS * 1000)
        }
      }, IDLE_WARNING_MS)
    }

    const registerActivity = ({ force = false, source = 'user' } = {}) => {
      if (activeIdleMode.value === 'none' || isIdleModalVisible.value) {
        return
      }

      const now = Date.now()
      if (!force && now - lastTrackedActivityAt.value < ACTIVITY_THROTTLE_MS) {
        return
      }

      lastTrackedActivityAt.value = now
      armIdleWarningTimer()

      if (source !== 'mousemove') {
        logger.debug('Idle session activity registered', {
          source,
          mode: activeIdleMode.value
        })
      }
    }

    const handleUserActivity = (event) => {
      registerActivity({ source: event.type })
    }

    const sendExamHeartbeat = async () => {
      if (!examStore.currentExamId || !examStore.currentAttemptId) {
        return
      }

      try {
        await apiService.sendHeartbeat(
          examStore.currentExamId,
          examStore.currentAttemptId
        )
      } catch (error) {
        logger.warn('Failed to send heartbeat while resuming idle exam session', error)
      }
    }

    const handleIdleContinue = async () => {
      const mode = idleModalMode.value

      hideIdleModal()
      lastTrackedActivityAt.value = Date.now()

      if (mode === 'exam') {
        await sendExamHeartbeat()
      }

      armIdleWarningTimer()
    }

    const handleIdleLogout = () => {
      hideIdleModal()
      authStore.logout()
    }

    watch(
      activeIdleMode,
      (newMode, oldMode) => {
        if (newMode === oldMode) {
          return
        }

        hideIdleModal()
        clearIdleWarningTimer()

        if (newMode !== 'none') {
          lastTrackedActivityAt.value = Date.now()
          armIdleWarningTimer()
          return
        }

        clearAllIdleTimers()
      },
      { immediate: true }
    )

    watch(
      () => route.fullPath,
      () => {
        if (activeIdleMode.value !== 'none' && !isIdleModalVisible.value) {
          registerActivity({ force: true, source: 'route-change' })
        }
      }
    )

    watch(
      () => examStore.isSubmitted,
      (isSubmitted) => {
        if (isSubmitted) {
          hideIdleModal()
          clearAllIdleTimers()
        }
      }
    )

    onMounted(() => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.addEventListener(eventName, handleUserActivity, { passive: true })
      })
    })

    onUnmounted(() => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity)
      })

      clearAllIdleTimers()
      unlockBodyScroll()
    })

    return {
      graceSecondsRemaining,
      handleIdleContinue,
      handleIdleLogout,
      idleModalMode,
      isIdleModalVisible
    }
  }
}
</script>

<style>
/* Global styles for CBT portal */
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f8f9fa;
}

body.idle-modal-open {
  overflow: hidden;
}

/* Full-screen exam mode */
.exam-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: white;
  z-index: 9999;
  overflow: hidden;
}

/* Security warnings */
.security-warning {
  background: #ff6b6b;
  color: white;
  padding: 10px;
  text-align: center;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
  animation: pulse 1s infinite;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.security-warning .btn {
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 0.85rem;
}

.security-warning .btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.7);
  color: white;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

/* Timer styles */
.exam-timer {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #007bff;
  color: white;
  padding: 10px 20px;
  border-radius: 25px;
  font-weight: bold;
  z-index: 1000;
}

.exam-timer.warning {
  background: #ffc107;
  color: #212529;
}

.exam-timer.danger {
  background: #dc3545;
  animation: pulse 1s infinite;
}

/* Question navigation */
.question-nav {
  max-height: 250px;
  overflow-y: auto;
}

.question-nav-item {
  min-width: 40px;
  height: 40px;
  margin: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
}

.question-nav-item.answered {
  background: #28a745;
  color: white;
}

.question-nav-item.current {
  background: #007bff !important;
  color: white;
  transform: scale(1.1);
}

.question-nav-item.unanswered {
  background: #6c757d;
  color: white;
}

/* Exam interface */
.exam-interface {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.exam-header {
  background: #343a40;
  color: white;
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.exam-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.question-panel {
  flex: 1;
  padding: 30px;
  overflow-y: auto;
}

.navigation-panel {
  width: 300px;
  background: #f8f9fa;
  border-left: 1px solid #dee2e6;
  padding: 20px;
}

.exam-footer {
  background: #f8f9fa;
  padding: 20px;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Auto-save indicator */
.autosave-indicator {
  position: fixed;
  top: 70px;
  right: 20px;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.8rem;
  z-index: 1000;
}

.autosave-indicator.saving {
  background: #ffc107;
  color: #212529;
}

.autosave-indicator.saved {
  background: #28a745;
  color: white;
}

.autosave-indicator.error {
  background: #dc3545;
  color: white;
}
</style>