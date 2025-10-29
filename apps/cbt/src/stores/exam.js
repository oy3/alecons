import { reactive } from 'vue'

export const examStore = reactive({
    // Session identifiers for secure access
    currentExamId: null,
    currentAttemptId: null,

    // Exam data
    currentExam: null,
    currentAttempt: null,
    questions: [],
    answers: {},
    currentQuestionIndex: 0,
    timeRemaining: 0,
    isSubmitted: false,
    isFullscreen: false,
    autoSaveStatus: 'saved', // 'saving', 'saved', 'error'
    tabSwitchCount: 0,
    blurCount: 0,
    timeUpTriggered: null, // Timestamp for reactivity triggering

    // Security tracking
    securityViolations: [],

    setExam(exam) {
        this.currentExam = exam
        // Only set default time if not already set by attempt
        if (this.timeRemaining === 0) {
            this.timeRemaining = exam.duration * 60 // Convert minutes to seconds
        }
    },

    setAttempt(attempt) {
        this.currentAttempt = attempt

        // Convert answers array to object format if needed
        if (attempt.answers && Array.isArray(attempt.answers)) {
            const answersObj = {}
            attempt.answers.forEach(answer => {
                answersObj[answer.questionId] = {
                    questionId: answer.questionId,
                    selected: answer.selected,
                    answeredAt: answer.answeredAt
                }
            })
            this.answers = answersObj
        } else {
            this.answers = attempt.answers || {}
        }

        // Set time remaining from attempt timing if available
        if (attempt.timing) {
            this.timeRemaining = attempt.timing.timeRemaining
        }
    },

    setQuestions(questions) {
        // Ensure questions don't contain answers for security
        this.questions = questions.map(q => ({
            _id: q._id,
            questionText: q.questionText,
            type: q.type,
            options: q.options,
            mark: q.mark,
            mediaUrls: q.mediaUrls || []
            // Note: 'answer' field is intentionally excluded for security
        }))
    },

    setAnswer(questionId, selectedAnswer) {
        this.answers[questionId] = {
            questionId,
            selected: selectedAnswer,
            answeredAt: new Date()
        }
    },

    getAnswer(questionId) {
        return this.answers[questionId]?.selected
    },

    isQuestionAnswered(questionIndex) {
        const question = this.questions[questionIndex]
        return question && this.answers[question._id]
    },

    getAnsweredCount() {
        return Object.keys(this.answers).length
    },

    goToQuestion(index) {
        if (index >= 0 && index < this.questions.length) {
            this.currentQuestionIndex = index
        }
    },

    nextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++
        }
    },

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--
        }
    },

    startTimer() {
        this.timer = setInterval(() => {
            if (this.timeRemaining > 0) {
                this.timeRemaining--
            } else {
                this.timeUp()
            }
        }, 1000)
    },

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = null
        }
    },

    timeUp() {
        this.stopTimer()
        this.timeRemaining = 0
        // Auto-submit exam when time is up
        this.isSubmitted = true
        // Force reactivity trigger by updating a timestamp
        this.timeUpTriggered = Date.now()
        // Note: The actual submission should be handled by the component
        // This just marks the state as time up
    },

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        }
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    },

    get timeRemainingFormatted() {
        return this.formatTime(this.timeRemaining)
    },

    get timeStatus() {
        if (this.timeRemaining <= 60) return 'danger' // Last minute
        if (this.timeRemaining <= 300) return 'warning' // Last 5 minutes
        return 'normal'
    },

    recordSecurityViolation(type, details = {}) {
        const violation = {
            type, // 'tab_switch', 'window_blur', 'right_click', 'key_combination'
            timestamp: new Date(),
            details
        }
        this.securityViolations.push(violation)

        // Track specific violation counts
        if (type === 'tab_switch') this.tabSwitchCount++
        if (type === 'window_blur') this.blurCount++
    },

    enterFullscreen() {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen()
        }
        this.isFullscreen = true
    },

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen()
        }
        this.isFullscreen = false
    },

    reset() {
        // Clear session identifiers
        this.currentExamId = null
        this.currentAttemptId = null

        // Clear exam data
        this.currentExam = null
        this.currentAttempt = null
        this.questions = []
        this.answers = {}
        this.currentQuestionIndex = 0
        this.timeRemaining = 0
        this.isSubmitted = false
        this.isFullscreen = false
        this.autoSaveStatus = 'saved'
        this.tabSwitchCount = 0
        this.blurCount = 0
        this.securityViolations = []
        this.stopTimer()
    },

    // Clear session data for security when exam is completed or user leaves
    clearSession() {
        this.currentExamId = null
        this.currentAttemptId = null
        this.currentExam = null
        this.currentAttempt = null
        this.questions = []
        this.answers = {}
        this.currentQuestionIndex = 0
        this.timeRemaining = 0
        this.isSubmitted = true
        this.isFullscreen = false
        this.autoSaveStatus = 'saved'
        this.tabSwitchCount = 0
        this.blurCount = 0
        this.timeUpTriggered = null
        this.securityViolations = []
    }
})