<script lang="js">
import { useAuthStore } from '../../stores/auth.js'
import { apiService } from '../../services/api.js'
import { logger } from '@shared/utils/logger'

const createEmptyPaymentHistory = () => ({
  payments: [],
  totalCount: 0,
  totalPaid: 0,
  successfulCount: 0,
  pendingCount: 0,
  failedCount: 0,
  cancelledCount: 0
})

const stageLabels = {
  1: 'Registration',
  2: 'Form Fee',
  3: 'Application Form',
  4: 'Entrance Exam',
  5: 'Admission Decision',
  6: 'Screening',
  7: 'Acceptance Fee',
  8: 'Sundry Fee',
  9: 'School Fees',
  10: 'Completed'
}

export default {
  name: 'ApplicationsManagement',
  setup() {
    const authStore = useAuthStore()
    return {
      authStore
    }
  },
  data() {
    return {
      applications: [],
      isLoading: true,
      searchQuery: '',
      searchTimeout: null,
      statusFilter: 'all',
      programFilter: 'all',
      currentPage: 1,
      perPage: 10,
      totalApplications: 0,
      apiTotalPages: 0,
      showDetailsModal: false,
      isLoadingDetails: false,
      selectedApplication: null,
      selectedApplicationId: null,
      selectedPaymentHistory: createEmptyPaymentHistory(),
      selectedPaymentReceipt: null,
      showPaymentReceiptModal: false,
      processingPaymentId: null,

      statusOptions: [
        { value: 'all', label: 'All Statuses' },
        { value: 'pending', label: 'Pending' },
        { value: 'admitted', label: 'Admitted' },
        { value: 'cleared', label: 'Cleared' },
        { value: 'completed', label: 'Completed' },
        { value: 'rejected', label: 'Rejected' }
      ],

      programs: []
    }
  },
  async mounted() {
    await this.authStore.initialize()

    if (!this.authStore.hasModuleAccess('applications')) {
      this.$swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'You do not have permission to view applications',
        confirmButtonColor: '#1a5f5f'
      })
      return
    }

    await Promise.all([
      this.loadPrograms(),
      this.loadApplications()
    ])
  },
  computed: {
    filteredApplications() {
      // All filtering (status, program, search) is handled server-side in loadApplications().
      // Returning applications directly avoids double-filtering bugs.
      return this.applications
    },

    paginatedApplications() {
      // Server already paginates; just return the current page's data directly
      return this.filteredApplications
    },

    totalPages() {
      // Always use the server-returned total pages
      return Math.max(1, this.apiTotalPages)
    },

    documentSections() {
      return this.getDocumentSections(this.selectedApplication)
    }
  },
  watch: {
    statusFilter() {
      this.currentPage = 1
      this.loadApplications()
    },
    programFilter() {
      this.currentPage = 1
      this.loadApplications()
    },
    searchQuery() {
      clearTimeout(this.searchTimeout)
      this.searchTimeout = setTimeout(() => {
        this.currentPage = 1
        this.loadApplications()
      }, 500)
    },
    currentPage() {
      this.loadApplications()
    }
  },
  methods: {
    async loadApplications() {
      try {
        this.isLoading = true

        logger.info('Authentication state:', {
          isAuthenticated: this.authStore.isAuthenticated,
          hasUser: !!this.authStore.user,
          hasToken: !!this.authStore.token,
          userRole: this.authStore.userRole
        })

        logger.info('Loading applications...', {
          filters: {
            status: this.statusFilter,
            program: this.programFilter,
            search: this.searchQuery,
            page: this.currentPage,
            limit: this.perPage
          }
        })

        const params = {
          page: this.currentPage,
          limit: this.perPage,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        }

        if (this.statusFilter && this.statusFilter !== 'all') {
          params.status = this.statusFilter
        }

        if (this.programFilter && this.programFilter !== 'all') {
          params.programId = this.programFilter
        }

        if (this.searchQuery && this.searchQuery.trim()) {
          params.search = this.searchQuery.trim()
        }

        const response = await apiService.getApplications(params)

        if (response.success) {
          this.applications = response.data.applications.map(app => ({
            id: app._id,
            applicationNumber: app.applicationNumber,
            applicantName: app.applicantName,
            email: app.email,
            phone: app.phone || 'N/A',
            program: app.programName,
            programDisplay: [app.programTypeLabel, app.programModeLabel, app.programName]
              .filter(Boolean)
              .join(' ') || 'N/A',
            status: app.status,
            currentStage: app.currentStage,
            profileImageUrl: app.profileImageUrl,
            submittedAt: app.createdAt,
            lastUpdated: app.updatedAt,
            matriculationNumber: app.matriculationNumber
          }))

          this.totalApplications = response.data.pagination.totalItems
          this.currentPage = response.data.pagination.currentPage
          this.apiTotalPages = response.data.pagination.totalPages

          logger.info('Applications loaded successfully', {
            count: this.applications.length,
            total: this.totalApplications,
            page: this.currentPage
          })
        } else {
          throw new Error(response.message || 'Failed to load applications')
        }
      } catch (error) {
        logger.error('Failed to load applications:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Load Failed',
          text: error.message || 'Failed to load applications',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        this.isLoading = false
      }
    },

    getStatusBadgeClass(status) {
      const statusClasses = {
        pending: 'bg-warning text-dark',
        admitted: 'bg-success text-white',
        cleared: 'bg-info text-white',
        completed: 'bg-primary text-white',
        rejected: 'bg-danger text-white'
      }
      return statusClasses[status] || 'bg-secondary text-white'
    },

    getDecisionBadgeClass(decision) {
      const decisionClasses = {
        pending: 'bg-warning-subtle text-warning-emphasis',
        admitted: 'bg-success-subtle text-success-emphasis',
        rejected: 'bg-danger-subtle text-danger-emphasis'
      }
      return decisionClasses[decision] || 'bg-secondary-subtle text-secondary-emphasis'
    },

    getPaymentStatusBadgeClass(status) {
      const statusClasses = {
        successful: 'bg-success-subtle text-success-emphasis',
        pending: 'bg-warning-subtle text-warning-emphasis',
        failed: 'bg-danger-subtle text-danger-emphasis',
        cancelled: 'bg-secondary-subtle text-secondary-emphasis'
      }
      return statusClasses[status] || 'bg-light text-dark'
    },

    formatDate(dateString) {
      if (!dateString) return 'N/A'
      const date = new Date(dateString)
      if (Number.isNaN(date.getTime())) return 'N/A'
      return date.toLocaleDateString()
    },

    formatDateTime(dateString) {
      if (!dateString) return 'N/A'
      const date = new Date(dateString)
      if (Number.isNaN(date.getTime())) return 'N/A'
      return date.toLocaleString()
    },

    formatCurrency(amount) {
      const normalizedAmount = Number(amount || 0)
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2
      }).format(normalizedAmount)
    },

    formatLabel(value) {
      if (!value) return 'N/A'
      return String(value)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase())
    },

    calculateAge(dateOfBirth) {
      if (!dateOfBirth) return 'N/A'

      const today = new Date()
      const birthDate = new Date(dateOfBirth)

      if (Number.isNaN(birthDate.getTime())) {
        return 'N/A'
      }

      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age -= 1
      }

      return age
    },

    getApplicantFullName(application) {
      const user = application?.userId || {}
      const fullName = [user.firstName, user.otherName, user.lastName].filter(Boolean).join(' ')
      return fullName || application?.applicantName || 'N/A'
    },

    getProgramName(application) {
      return application?.programId?.name || application?.program || 'N/A'
    },

    getApplicationProgramDisplay(application) {
      const programType = application?.programTypeLabel || this.getProgramTypeLabel(application)
      const studyMode = application?.programModeLabel || this.getStudyModeLabel(application)
      const programName = this.getProgramName(application)

      return [programType, studyMode, programName]
        .filter(value => value && value !== 'N/A')
        .join(' ') || 'N/A'
    },

    getAcademicSessionLabel(application) {
      const session = application?.entryAcademicSession
      if (!session) return 'N/A'
      if (typeof session === 'string') return session
      return session.sessionYear || 'N/A'
    },

    getPaymentAcademicSessionLabel(payment) {
      return payment?.academicSession?.sessionYear || 'N/A'
    },

    getProgramTypeLabel(application) {
      const programType = application?.programTypeId
      if (!programType) return 'N/A'
      if (typeof programType === 'string') return programType
      return programType.type || programType.name || programType.description || 'N/A'
    },

    getStudyModeLabel(application) {
      const studyMode = application?.programModeId
      if (!studyMode) return 'N/A'
      if (typeof studyMode === 'string') return studyMode
      return studyMode.description || studyMode.name || studyMode.mode || 'N/A'
    },

    getApplicationStatusLabel(application) {
      return `Status: ${this.formatLabel(application?.status)}`
    },

    getAdmissionDecisionLabel(application) {
      const decision = application?.admissionDecision
      if (!decision || decision === 'pending') {
        return 'Decision Pending'
      }

      return `Decision: ${this.formatLabel(decision)}`
    },

    getAdmissionDecisionValue(application) {
      const decision = application?.admissionDecision
      if (!decision) return 'N/A'
      if (decision === 'pending') return 'Pending Review'
      return this.formatLabel(decision)
    },

    getStageLabel(stage) {
      return stageLabels[stage] || `Stage ${stage || 'N/A'}`
    },

    getProfileImage(application) {
      return application?.profileImageUrl || application?.documents?.profilePicture?.url || 'https://placehold.co/160x160?text=Applicant'
    },

    getDocumentSections(application) {
      if (!application?.documents) {
        return []
      }

      const sections = []
      const profilePicture = application.documents.profilePicture
      const olevelResults = Array.isArray(application.documents.olevelResults)
        ? application.documents.olevelResults
        : []
      const referenceLetters = Array.isArray(application.documents.referenceLetters)
        ? application.documents.referenceLetters
        : []

      if (profilePicture?.url) {
        sections.push({
          title: 'Profile Picture',
          documents: [{
            label: this.formatLabel(profilePicture.type || 'Profile Picture'),
            url: profilePicture.url,
            uploadedAt: profilePicture.uploadedAt
          }]
        })
      }

      if (olevelResults.length) {
        sections.push({
          title: 'O-Level Results',
          documents: olevelResults.map((document, index) => ({
            label: document.type ? this.formatLabel(document.type) : `Result ${index + 1}`,
            url: document.url,
            uploadedAt: document.uploadedAt
          }))
        })
      }

      if (referenceLetters.length) {
        sections.push({
          title: 'Reference Letters',
          documents: referenceLetters.map((document, index) => ({
            label: document.type ? this.formatLabel(document.type) : `Reference ${index + 1}`,
            url: document.url,
            uploadedAt: document.uploadedAt
          }))
        })
      }

      return sections
    },

    getDocumentCount(application) {
      return this.getDocumentSections(application).reduce((count, section) => count + section.documents.length, 0)
    },

    closeDetailsModal() {
      this.showDetailsModal = false
      this.isLoadingDetails = false
      this.selectedApplication = null
      this.selectedApplicationId = null
      this.selectedPaymentHistory = createEmptyPaymentHistory()
      this.selectedPaymentReceipt = null
      this.showPaymentReceiptModal = false
      this.processingPaymentId = null
    },

    isManualTransferPayment(payment) {
      return payment?.method === 'manual_transfer'
    },

    canReviewManualTransfer(payment) {
      return this.isManualTransferPayment(payment) && payment?.status === 'pending'
    },

    isProcessingPayment(paymentId) {
      return this.processingPaymentId === paymentId
    },

    openPaymentReceipt(payment) {
      if (!payment?.receiptUrl) {
        this.$swal.fire({
          icon: 'info',
          title: 'Receipt unavailable',
          text: 'No uploaded receipt is available for this payment record.',
          confirmButtonColor: '#1a5f5f'
        })
        return
      }

      this.selectedPaymentReceipt = payment
      this.showPaymentReceiptModal = true
    },

    closePaymentReceiptModal() {
      this.showPaymentReceiptModal = false
      this.selectedPaymentReceipt = null
    },

    getReceiptSource(receipt = this.selectedPaymentReceipt) {
      return receipt?.receiptUrl || ''
    },

    getReceiptFilename(receipt = this.selectedPaymentReceipt) {
      return receipt?.receiptOriginalName || receipt?.receiptUrl || 'receipt'
    },

    getReceiptExtension(receipt = this.selectedPaymentReceipt) {
      const source = this.getReceiptFilename(receipt).split('?')[0]
      const segments = source.split('.')
      return segments.length > 1 ? segments.pop().toLowerCase() : ''
    },

    isPdfReceipt(receipt = this.selectedPaymentReceipt) {
      return this.getReceiptExtension(receipt) === 'pdf'
    },

    isImageReceipt(receipt = this.selectedPaymentReceipt) {
      return ['png', 'jpg', 'jpeg', 'webp'].includes(this.getReceiptExtension(receipt))
    },

    async reloadSelectedApplicationDetails() {
      if (!this.selectedApplicationId) {
        return
      }

      const response = await apiService.getApplication(this.selectedApplicationId)

      if (!response.success || !response.data?.application) {
        throw new Error(response.message || 'Failed to refresh application details')
      }

      this.selectedApplication = response.data.application
      this.selectedPaymentHistory = response.data.paymentHistory || createEmptyPaymentHistory()
    },

    async viewApplication(application) {
      try {
        logger.info('Viewing application details:', {
          applicationId: application.id,
          applicationNumber: application.applicationNumber
        })

        this.showDetailsModal = true
        this.isLoadingDetails = true
        this.selectedApplicationId = application.id
        this.selectedApplication = null
        this.selectedPaymentHistory = createEmptyPaymentHistory()

        const response = await apiService.getApplication(application.id)

        if (response.success && response.data?.application) {
          this.selectedApplication = response.data.application
          this.selectedPaymentHistory = response.data.paymentHistory || createEmptyPaymentHistory()
          logger.info('Application details displayed successfully')
        } else {
          throw new Error(response.message || 'Failed to load application details')
        }
      } catch (error) {
        this.closeDetailsModal()
        logger.error('Failed to view application details:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to load application details',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        this.isLoadingDetails = false
      }
    },

    async verifyManualTransferPayment(payment) {
      try {
        if (!this.authStore.hasPermission('applications', 'edit')) {
          this.$swal.fire({
            icon: 'error',
            title: 'Access Denied',
            text: 'You do not have permission to verify manual transfer payments',
            confirmButtonColor: '#1a5f5f'
          })
          return
        }

        const result = await this.$swal.fire({
          title: 'Verify manual transfer?',
          text: `Confirm ${payment.payment?.name || 'this payment'} as received in the bank account.`,
          input: 'textarea',
          inputLabel: 'Verification remarks (optional)',
          inputPlaceholder: 'e.g. Payment confirmed from bank statement',
          showCancelButton: true,
          confirmButtonText: 'Verify payment',
          confirmButtonColor: '#1a5f5f',
          cancelButtonColor: '#6c757d'
        })

        if (!result.isConfirmed) {
          return
        }

        this.processingPaymentId = payment.id

        const response = await apiService.verifyManualTransferPayment(payment.id, {
          remarks: result.value?.trim() || undefined
        })

        if (!response.success) {
          throw new Error(response.message || 'Failed to verify payment')
        }

        await this.reloadSelectedApplicationDetails()

        this.$swal.fire({
          icon: 'success',
          title: 'Payment verified',
          text: response.message || 'Manual transfer payment verified successfully.',
          confirmButtonColor: '#1a5f5f'
        })
      } catch (error) {
        logger.error('Failed to verify manual transfer payment:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Verification failed',
          text: error.message || 'Failed to verify manual transfer payment',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        this.processingPaymentId = null
      }
    },

    async rejectManualTransferPayment(payment) {
      try {
        if (!this.authStore.hasPermission('applications', 'edit')) {
          this.$swal.fire({
            icon: 'error',
            title: 'Access Denied',
            text: 'You do not have permission to reject manual transfer payments',
            confirmButtonColor: '#1a5f5f'
          })
          return
        }

        const result = await this.$swal.fire({
          title: 'Reject manual transfer?',
          text: 'Provide a reason for rejecting this receipt so the applicant or student can correct it.',
          input: 'textarea',
          inputLabel: 'Rejection reason',
          inputPlaceholder: 'e.g. Amount does not match bank statement',
          inputValidator: (value) => {
            if (!value || !value.trim()) {
              return 'A rejection reason is required'
            }
            return null
          },
          showCancelButton: true,
          confirmButtonText: 'Reject payment',
          confirmButtonColor: '#dc3545',
          cancelButtonColor: '#6c757d'
        })

        if (!result.isConfirmed) {
          return
        }

        this.processingPaymentId = payment.id

        const response = await apiService.rejectManualTransferPayment(payment.id, {
          remarks: result.value.trim()
        })

        if (!response.success) {
          throw new Error(response.message || 'Failed to reject payment')
        }

        await this.reloadSelectedApplicationDetails()

        this.$swal.fire({
          icon: 'success',
          title: 'Payment rejected',
          text: response.message || 'Manual transfer payment rejected successfully.',
          confirmButtonColor: '#1a5f5f'
        })
      } catch (error) {
        logger.error('Failed to reject manual transfer payment:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Rejection failed',
          text: error.message || 'Failed to reject manual transfer payment',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        this.processingPaymentId = null
      }
    },

    async updateApplicationStatus(application, newStatus) {
      try {
        // Check permissions
        if (!this.authStore.hasPermission('applications', 'edit')) {
          this.$swal.fire({
            icon: 'error',
            title: 'Access Denied',
            text: 'You do not have permission to update application status',
            confirmButtonColor: '#1a5f5f'
          })
          return
        }

        logger.info('Updating application status:', {
          applicationId: application.id,
          applicationNumber: application.applicationNumber,
          oldStatus: application.status,
          newStatus
        })

        // Show confirmation dialog
        const result = await this.$swal.fire({
          title: 'Confirm Status Update',
          text: `Change status from ${application.status.toUpperCase()} to ${newStatus.toUpperCase()}?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#1a5f5f',
          cancelButtonColor: '#6c757d',
          confirmButtonText: 'Yes, update it!'
        })

        if (!result.isConfirmed) {
          return
        }

        // Make API call to update status
        const response = await apiService.updateApplicationStatus(
          application.id,
          newStatus
        )

        if (response.success) {
          // Update local data
          const index = this.applications.findIndex(app => app.id === application.id)
          if (index !== -1) {
            this.applications[index].status = newStatus
            this.applications[index].lastUpdated = new Date().toISOString()
          }

          this.$swal.fire({
            icon: 'success',
            title: 'Status Updated',
            text: `Application status updated to ${newStatus.toUpperCase()}`,
            timer: 2000,
            showConfirmButton: false
          })

          logger.info('Application status updated successfully', {
            applicationId: application.id,
            newStatus
          })
        } else {
          throw new Error(response.message || 'Failed to update status')
        }
      } catch (error) {
        logger.error('Failed to update application status:', error)
        this.$swal.fire({
          icon: 'error',
          title: 'Update Failed',
          text: error.message || 'Failed to update application status',
          confirmButtonColor: '#1a5f5f'
        })
      }
    },

    exportApplications() {
      // Check permissions
      if (!this.authStore.hasPermission('applications', 'export')) {
        this.$swal.fire({
          icon: 'error',
          title: 'Access Denied',
          text: 'You do not have permission to export applications',
          confirmButtonColor: '#1a5f5f'
        })
        return
      }

      this.$swal.fire({
        title: 'Export Applications',
        text: 'This feature will be implemented soon',
        icon: 'info',
        confirmButtonColor: '#1a5f5f'
      })
    },

    async loadPrograms() {
      try {
        logger.info('Loading programs for filter...')

        const response = await apiService.getPrograms({ limit: 100 })

        if (response.success && response.data) {
          this.programs = response.data.map(p => ({
            label: [p.programType, p.programModeDescription, p.name].filter(Boolean).join(' '),
            value: p.id
          }))
          logger.info('Programs loaded successfully', { count: response.data.length })
        }
      } catch (error) {
        logger.error('Failed to load programs:', error)
      }
    },

    resetFilters() {
      logger.info('Resetting all filters')

      // Reset all filter values
      this.searchQuery = ''
      this.statusFilter = 'all'
      this.programFilter = 'all'
      this.currentPage = 1

      // Clear any pending search timeout
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
        this.searchTimeout = null
      }

      // Reload applications with reset filters
      this.loadApplications()

      logger.info('Filters reset successfully')
    },

    async sendMatriculationEmail(application) {
      try {
        // Show confirmation dialog
        const result = await this.$swal.fire({
          icon: 'question',
          title: 'Send Matriculation Email',
          text: `Send matriculation email to ${application.applicantName}?`,
          showCancelButton: true,
          confirmButtonText: 'Send Email',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#1a5f5f',
          cancelButtonColor: '#6c757d'
        })

        if (!result.isConfirmed) {
          return
        }

        // Show loading
        this.$swal.fire({
          title: 'Sending Email...',
          text: 'Please wait while we send the matriculation email.',
          allowOutsideClick: false,
          showConfirmButton: false,
          willOpen: () => {
            this.$swal.showLoading()
          }
        })

        // Make API call
        const response = await apiService.sendMatriculationEmail(application.id)

        if (response.success) {
          this.$swal.fire({
            icon: 'success',
            title: 'Email Sent Successfully!',
            text: `Matriculation email sent to ${application.email}`,
            confirmButtonColor: '#1a5f5f'
          })

          logger.info('Matriculation email sent successfully:', {
            applicationId: application.id,
            email: application.email,
            matricNumber: response.data?.matriculationNumber
          })
        } else {
          throw new Error(response.message || 'Failed to send email')
        }

      } catch (error) {
        logger.error('Error sending matriculation email:', error)

        this.$swal.fire({
          icon: 'error',
          title: 'Failed to Send Email',
          text: error.message || 'An error occurred while sending the matriculation email',
          confirmButtonColor: '#dc3545'
        })
      }
    },

    async handleMatriculationAction(application) {
      if (application.matriculationNumber) {
        // If matriculation number exists, send email
        await this.sendMatriculationEmail(application)
      } else {
        // If matriculation number doesn't exist, generate it first
        await this.generateMatriculationNumber(application)
      }
    },

    async generateMatriculationNumber(application) {
      try {
        // Show confirmation dialog
        const result = await this.$swal.fire({
          icon: 'question',
          title: 'Recover Matriculation Number',
          text: `Recover the missing matriculation number for ${application.applicantName}? This will also send the email automatically.`,
          showCancelButton: true,
          confirmButtonText: 'Recover',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#1a5f5f',
          cancelButtonColor: '#6c757d'
        })

        if (!result.isConfirmed) {
          return
        }

        // Show loading
        this.$swal.fire({
          title: 'Recovering Matriculation Number...',
          text: 'Please wait while we recover the matriculation number and send the email.',
          allowOutsideClick: false,
          showConfirmButton: false,
          willOpen: () => {
            this.$swal.showLoading()
          }
        })

        // Make API call
        const response = await apiService.generateMatriculationNumber(application.id)

        if (response.success) {
          this.$swal.fire({
            icon: 'success',
            title: 'Matriculation Number Recovered!',
            text: `Matriculation number recovered and email sent to ${application.email}`,
            confirmButtonColor: '#1a5f5f'
          })

          logger.info('Matriculation number generated successfully:', {
            applicationId: application.id,
            email: application.email,
            matricNumber: response.data?.matriculationNumber
          })

          // Refresh the applications list to show updated data
          await this.loadApplications()
        } else {
          throw new Error(response.message || 'Failed to generate matriculation number')
        }

      } catch (error) {
        logger.error('Error generating matriculation number:', error)

        this.$swal.fire({
          icon: 'error',
          title: 'Failed to Recover Matriculation Number',
          text: error.message || 'An error occurred while recovering the matriculation number',
          confirmButtonColor: '#dc3545'
        })
      }
    }
  }
}
</script>

<template>
  <div class="container-fluid p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h2 class="fw-bold text-staff-primary mb-1">
              Applications Management
            </h2>
            <p class="text-muted mb-0">
              Review and manage student applications
            </p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-staff-primary btn-sm" @click="exportApplications">
              <i class="bi bi-download me-2"></i>Export
            </button>
            <button class="btn btn-staff-primary btn-sm" @click="loadApplications">
              <i class="bi bi-arrow-clockwise me-2"></i>Refresh
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-4">
                <label for="searchQuery" class="form-label">Search</label>
                <input type="text" class="form-control" id="searchQuery"
                  placeholder="Search by name, email, or application number..." v-model="searchQuery" />
              </div>
              <div class="col-md-3">
                <label for="statusFilter" class="form-label">Status</label>
                <select class="form-select" id="statusFilter" v-model="statusFilter">
                  <option v-for="status in statusOptions" :key="status.value" :value="status.value">
                    {{ status.label }}
                  </option>
                </select>
              </div>
              <div class="col-md-3">
                <label for="programFilter" class="form-label">Program</label>
                <select class="form-select" id="programFilter" v-model="programFilter">
                  <option value="all">All Programs</option>
                  <option v-for="program in programs" :key="program.value" :value="program.value">
                    {{ program.label }}
                  </option>
                </select>
              </div>
              <div class="col-md-2 d-flex align-items-end">
                <button class="btn btn-outline-staff-primary w-100" @click="resetFilters">
                  <i class="bi bi-funnel-fill me-2"></i>Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-staff-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-3 text-muted">Loading applications...</p>
    </div>

    <!-- Applications Table -->
    <div v-else class="row">
      <div class="col-12">
        <div class="card border-0 p-0 shadow-sm">
          <!-- <div class="card-header bg-transparent border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="mb-0 fw-bold">
                Applications ({{ filteredApplications.length }} of {{ totalApplications }})
              </h5>
            </div>
          </div> -->
          <div class="card-body p-0">
            <div class="table-responsive d-none d-lg-block">
              <table class="table table-hover mb-0">
                <thead class="">
                  <tr>
                    <th>#</th>
                    <th>Applicant</th>
                    <th>Contact</th>
                    <th>Program</th>
                    <th class="text-center">Stage</th>
                    <th class="text-center">Status</th>
                    <th class="text-center">Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <!-- No data message when no applications found -->
                  <tr v-if="paginatedApplications.length === 0">
                    <td colspan="8" class="text-center py-5">
                      <div class="text-muted">
                        <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
                        <h5 class="mb-2">No Applications Found</h5>
                        <p class="mb-0" v-if="
                          searchQuery ||
                          statusFilter !== 'all' ||
                          programFilter !== 'all'
                        ">
                          No applications match your current filters.
                          <button class="btn btn-link p-0 text-staff-primary" @click="resetFilters">
                            Reset filters
                          </button>
                          to see all applications.
                        </p>
                        <p class="mb-0" v-else>
                          No applications have been submitted yet.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <!-- Application rows -->
                  <tr v-for="app in paginatedApplications" :key="app.id">
                    <td>
                      <code class="text-staff-primary">{{
                        app.applicationNumber
                      }}</code>
                    </td>
                    <td>
                      <div class="d-flex align-items-center">
                        <div v-if="app.profileImageUrl"
                          class="border border-staff-primary bg-staff-light rounded-circle me-2 d-flex align-items-center justify-content-center">
                          <img :src="app.profileImageUrl" alt="" class="rounded-circle" width="40" height="40" />
                        </div>
                        <div v-else style="height: 40px; width: 40px"
                          class="border border-staff-primary bg-staff-light rounded-circle me-2 d-flex align-items-center justify-content-center">
                          <i class="bi bi-person text-staff-primary fs-4"></i>
                        </div>

                        <span class="fw-medium">{{ app.applicantName }}</span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div class="small">{{ app.email }}</div>
                        <div class="small text-muted">{{ app.phone }}</div>
                      </div>
                    </td>
                    <td>{{ app.programDisplay }}</td>
                    <td class="text-center">{{ getStageLabel(app.currentStage) }}</td>
                    <td class="text-center">
                      <span class="badge rounded-pill" :class="getStatusBadgeClass(app.status)">
                        {{ app.status.replace("_", " ").toUpperCase() }}
                      </span>
                    </td>
                    <td class="text-center">
                      {{ formatDate(app.submittedAt) }}
                    </td>
                    <td>
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-staff-primary btn-sm" @click="viewApplication(app)"
                          title="View Details">
                          <i class="bi bi-eye"></i>
                        </button>
                        <div class="btn-group" role="group">
                          <button type="button" class="btn btn-outline-success btn-sm dropdown-toggle"
                            data-bs-toggle="dropdown" title="Update Status">
                            <i class="bi bi-three-dots-vertical"></i>
                          </button>
                          <ul class="dropdown-menu">
                            <li v-if="app.status === 'completed'" class="">
                              <a class="dropdown-item" href="#" @click.prevent="handleMatriculationAction(app)">
                                <i class="bi bi-envelope text-success me-2" v-if="app.matriculationNumber"></i>
                                <i class="bi bi-arrow-repeat text-primary me-2" v-else></i>
                                {{ app.matriculationNumber ? 'Send matric no.' : 'Recover matric no.' }}
                              </a>
                            </li>
                            <!-- 
                            <li>
                              <a
                                class="dropdown-item"
                                href="#"
                                @click.prevent="
                                  updateApplicationStatus(app, 'pending')
                                "
                              >
                                <i class="bi bi-clock text-warning me-2"></i
                                >Pending
                              </a>
                            </li>
                            <li>
                              <a
                                class="dropdown-item"
                                href="#"
                                @click.prevent="
                                  updateApplicationStatus(app, 'admitted')
                                "
                              >
                                <i
                                  class="bi bi-check-circle text-success me-2"
                                ></i
                                >Admitted
                              </a>
                            </li>
                            <li>
                              <a
                                class="dropdown-item"
                                href="#"
                                @click.prevent="
                                  updateApplicationStatus(app, 'cleared')
                                "
                              >
                                <i class="bi bi-shield-check text-info me-2"></i
                                >Cleared
                              </a>
                            </li>
                            <li>
                              <a
                                class="dropdown-item"
                                href="#"
                                @click.prevent="
                                  updateApplicationStatus(app, 'completed')
                                "
                              >
                                <i class="bi bi-check-all text-primary me-2"></i
                                >Completed
                              </a>
                            </li>
                            <li>
                              <a
                                class="dropdown-item"
                                href="#"
                                @click.prevent="
                                  updateApplicationStatus(app, 'rejected')
                                "
                              >
                                <i class="bi bi-x-circle text-danger me-2"></i
                                >Rejected
                              </a>
                            </li> -->


                          </ul>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="d-lg-none p-3">
              <div v-if="paginatedApplications.length === 0" class="text-center py-4">
                <div class="text-muted">
                  <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
                  <h5 class="mb-2">No Applications Found</h5>
                  <p class="mb-0" v-if="
                    searchQuery ||
                    statusFilter !== 'all' ||
                    programFilter !== 'all'
                  ">
                    No applications match your current filters.
                    <button class="btn btn-link p-0 text-staff-primary" @click="resetFilters">
                      Reset filters
                    </button>
                    to see all applications.
                  </p>
                  <p class="mb-0" v-else>
                    No applications have been submitted yet.
                  </p>
                </div>
              </div>

              <div v-else class="row g-3">
                <div v-for="app in paginatedApplications" :key="`mobile-${app.id}`" class="col-12">
                  <div class="applications-mobile-card h-100">
                    <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                      <div class="d-flex align-items-center gap-2">
                        <div v-if="app.profileImageUrl"
                          class="border border-staff-primary bg-staff-light rounded-circle d-flex align-items-center justify-content-center flex-shrink-0">
                          <img :src="app.profileImageUrl" alt="" class="rounded-circle"
                            style="height: 40px; width: 40px"/>
                        </div>
                        <div v-else
                          class="border border-staff-primary bg-staff-light rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style="height: 40px; width: 40px">
                          <i class="bi bi-person text-staff-primary fs-4"></i>
                        </div>
                        <div>
                          <div class="fw-semibold text-staff-primary">
                            {{ app.applicantName }}
                          </div>
                          <div class="small text-muted text-break">{{ app.email }}</div>
                          <div class="small text-muted">{{ app.phone }}</div>
                        </div>
                      </div>

                      <div class="text-end flex-shrink-0">
                        <div class="small text-muted">Application No.</div>
                        <code class="text-staff-primary">{{ app.applicationNumber }}</code>
                      </div>
                    </div>

                    <div class="applications-mobile-meta d-grid gap-2 mb-3">
                      <div>
                        <div class="small text-uppercase text-muted fw-semibold">Program</div>
                        <div>{{ app.programDisplay }}</div>
                      </div>
                      <div class="row g-2">
                        <div class="col-12 col-sm-6">
                          <div class="small text-uppercase text-muted fw-semibold">Stage</div>
                          <div>{{ getStageLabel(app.currentStage) }}</div>
                        </div>
                        <div class="col-12 col-sm-6">
                          <div class="small text-uppercase text-muted fw-semibold">Submitted</div>
                          <div>{{ formatDate(app.submittedAt) }}</div>
                        </div>
                      </div>
                    </div>

                    <div class="d-flex flex-wrap gap-2 mb-3">
                      <span class="badge rounded-pill" :class="getStatusBadgeClass(app.status)">
                        {{ app.status.replace("_", " ").toUpperCase() }}
                      </span>
                    </div>

                    <div class="d-flex flex-wrap gap-2">
                      <button type="button" class="btn btn-sm btn-outline-staff-primary" @click="viewApplication(app)"
                        title="View Details">
                        <i class="bi bi-eye me-1"></i>Details
                      </button>
                      <button v-if="app.status === 'completed'" type="button" class="btn btn-sm btn-outline-success"
                        @click="handleMatriculationAction(app)">
                        <i class="bi bi-envelope me-1" v-if="app.matriculationNumber"></i>
                        <i class="bi bi-arrow-repeat me-1" v-else></i>
                        {{ app.matriculationNumber ? 'Send matric no.' : 'Recover matric no.' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div class="card-footer border-top-0 bg-transparent">
            <nav>
              <ul class="pagination pagination-sm mb-0 justify-content-center">
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <button class="page-link" @click="currentPage = currentPage - 1" :disabled="currentPage === 1">
                    Previous
                  </button>
                </li>
                <li class="page-item" :class="{ active: currentPage === page }" v-for="page in totalPages" :key="page">
                  <button class="page-link" @click="currentPage = page">
                    {{ page }}
                  </button>
                </li>
                <li class="page-item"
                  :class="{ disabled: currentPage >= totalPages || filteredApplications.length === 0 }">
                  <button class="page-link" @click="currentPage = currentPage + 1"
                    :disabled="currentPage >= totalPages || filteredApplications.length === 0">
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" :class="{ show: showDetailsModal }"
      :style="{ display: showDetailsModal ? 'block' : 'none' }" tabindex="-1">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content application-details-modal">
          <div class="modal-header border-0 pb-0">
            <div>
              <h5 class="modal-title fw-bold text-staff-primary">Application Details</h5>
              <p v-if="selectedApplication" class="text-muted mb-0">
                {{ selectedApplication.applicationNumber }} · {{ getApplicantFullName(selectedApplication) }}
              </p>
            </div>
            <button type="button" class="btn-close" @click="closeDetailsModal"></button>
          </div>

          <div class="modal-body px-4 pb-4">
            <div v-if="isLoadingDetails" class="text-center py-5">
              <div class="spinner-border text-staff-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="text-muted mt-3 mb-0">Loading complete application details...</p>
            </div>

            <div v-else-if="selectedApplication">
              <div class="application-hero card border-0 shadow-sm mb-4">
                <div class="card-body p-4">
                  <div class="row g-4 align-items-start">
                    <div class="col-lg-8">
                      <div class="d-flex flex-column flex-md-row align-items-md-start gap-3">
                        <img :src="getProfileImage(selectedApplication)" alt="Applicant profile"
                          class="application-avatar" />
                        <div class="flex-grow-1">
                          <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                            <h4 class="fw-bold mb-0">{{ getApplicantFullName(selectedApplication) }}</h4>
                            <span class="badge rounded-pill" :class="getStatusBadgeClass(selectedApplication.status)">
                              {{ getApplicationStatusLabel(selectedApplication) }}
                            </span>
                            <span class="badge rounded-pill"
                              :class="getDecisionBadgeClass(selectedApplication.admissionDecision)">
                              {{ getAdmissionDecisionLabel(selectedApplication) }}
                            </span>
                          </div>

                          <p class="text-muted mb-3">
                            {{ getApplicationProgramDisplay(selectedApplication) }}
                            <!-- <span v-if="selectedApplication.programId?.code">({{ selectedApplication.programId.code }})</span> -->
                          </p>

                          <div class="d-flex flex-wrap gap-2 mb-3">
                            <span class="detail-chip">
                              <i class="bi bi-envelope-at me-1"></i>{{ selectedApplication.userId?.email || 'N/A' }}
                            </span>
                            <span class="detail-chip">
                              <i class="bi bi-telephone me-1"></i>{{ selectedApplication.userId?.phone || 'N/A' }}
                            </span>
                            <span class="detail-chip">
                              <i class="bi bi-mortarboard me-1"></i>{{ getAcademicSessionLabel(selectedApplication) }}
                            </span>
                          </div>

                          <div class="details-grid compact-grid">
                            <div>
                              <span class="details-label">Current Stage</span>
                              <span class="details-value">{{ getStageLabel(selectedApplication.currentStage) }}</span>
                            </div>
                            <div>
                              <span class="details-label">Age</span>
                              <span class="details-value">{{ calculateAge(selectedApplication.dob) }}</span>
                            </div>
                            <div>
                              <span class="details-label">Submitted</span>
                              <span class="details-value">{{ formatDateTime(selectedApplication.createdAt) }}</span>
                            </div>
                            <div>
                              <span class="details-label">Last Updated</span>
                              <span class="details-value">{{ formatDateTime(selectedApplication.updatedAt) }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="col-lg-4">
                      <div class="summary-panel h-100">
                        <div class="summary-stat">
                          <span class="summary-value">{{ getDocumentCount(selectedApplication) }}</span>
                          <span class="summary-label">Documents</span>
                        </div>
                        <div class="summary-stat">
                          <span class="summary-value">{{ selectedPaymentHistory.totalCount }}</span>
                          <span class="summary-label">Payments</span>
                        </div>
                        <div class="summary-stat">
                          <span class="summary-value">{{ formatCurrency(selectedPaymentHistory.totalPaid) }}</span>
                          <span class="summary-label">Successful Payments</span>
                        </div>
                        <div class="summary-stat">
                          <span class="summary-value">{{ selectedApplication.matriculationNumber || 'Pending' }}</span>
                          <span class="summary-label">Matriculation</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="row g-4">
                <div class="col-lg-8">
                  <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                      <h6 class="section-title">Application Overview</h6>
                      <div class="details-grid">
                        <div>
                          <span class="details-label">Application Number</span>
                          <span class="details-value">{{ selectedApplication.applicationNumber }}</span>
                        </div>
                        <div>
                          <span class="details-label">Applicant Role</span>
                          <span class="details-value">{{ formatLabel(selectedApplication.userId?.role) }}</span>
                        </div>
                        <div>
                          <span class="details-label">Program Type</span>
                          <span class="details-value">{{ getProgramTypeLabel(selectedApplication) }}</span>
                        </div>
                        <div>
                          <span class="details-label">Study Mode</span>
                          <span class="details-value">{{ getStudyModeLabel(selectedApplication) }}</span>
                        </div>
                        <div>
                          <span class="details-label">State of Origin</span>
                          <span class="details-value">{{ selectedApplication.stateOfOrigin || 'N/A' }}</span>
                        </div>
                        <div>
                          <span class="details-label">Local Government</span>
                          <span class="details-value">{{ selectedApplication.lga || 'N/A' }}</span>
                        </div>
                        <div>
                          <span class="details-label">Nationality</span>
                          <span class="details-value">{{ selectedApplication.nationality || 'N/A' }}</span>
                        </div>
                        <div>
                          <span class="details-label">Gender</span>
                          <span class="details-value">{{ selectedApplication.gender || 'N/A' }}</span>
                        </div>
                        <div>
                          <span class="details-label">Marital Status</span>
                          <span class="details-value">{{ selectedApplication.maritalStatus || 'N/A' }}</span>
                        </div>
                        <div>
                          <span class="details-label">Religion</span>
                          <span class="details-value">{{ selectedApplication.religion || 'N/A' }}</span>
                        </div>
                      </div>

                      <div class="mt-3">
                        <span class="details-label">Home Address</span>
                        <p class="details-value mb-0">{{ selectedApplication.address || 'N/A' }}</p>
                      </div>
                    </div>
                  </div>

                  <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                      <h6 class="section-title">Guardian & Next of Kin</h6>
                      <div class="row g-4">
                        <div class="col-md-6">
                          <div class="info-block h-100">
                            <h6 class="info-block-title">Guardian</h6>
                            <p class="mb-1"><strong>Name:</strong> {{ selectedApplication.guardian?.name || 'N/A' }}</p>
                            <p class="mb-1"><strong>Phone:</strong> {{ selectedApplication.guardian?.phone || 'N/A' }}
                            </p>
                            <p class="mb-1"><strong>Email:</strong> {{ selectedApplication.guardian?.email || 'N/A' }}
                            </p>
                            <p class="mb-1"><strong>Relationship:</strong> {{ selectedApplication.guardian?.relationship
                              || 'N/A' }}</p>
                            <p class="mb-0"><strong>Address:</strong> {{ selectedApplication.guardian?.address || 'N/A'
                            }}</p>
                          </div>
                        </div>
                        <div class="col-md-6">
                          <div class="info-block h-100">
                            <h6 class="info-block-title">Next of Kin</h6>
                            <p class="mb-1"><strong>Name:</strong> {{ selectedApplication.nextOfKin?.name || 'N/A' }}
                            </p>
                            <p class="mb-1"><strong>Phone:</strong> {{ selectedApplication.nextOfKin?.phone || 'N/A' }}
                            </p>
                            <p class="mb-1"><strong>Email:</strong> {{ selectedApplication.nextOfKin?.email || 'N/A' }}
                            </p>
                            <p class="mb-1"><strong>Relationship:</strong> {{
                              selectedApplication.nextOfKin?.relationship || 'N/A' }}</p>
                            <p class="mb-0"><strong>Address:</strong> {{ selectedApplication.nextOfKin?.address || 'N/A'
                            }}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                      <h6 class="section-title">Academic Background</h6>
                      <div class="row g-4">
                        <div class="col-md-6">
                          <div class="info-block h-100">
                            <h6 class="info-block-title">Primary Education</h6>
                            <p class="mb-1"><strong>School:</strong> {{
                              selectedApplication.academicBackground?.primary?.name || 'N/A' }}</p>
                            <p class="mb-1"><strong>Start:</strong> {{
                              selectedApplication.academicBackground?.primary?.startDate || 'N/A' }}</p>
                            <p class="mb-0"><strong>End:</strong> {{
                              selectedApplication.academicBackground?.primary?.endDate || 'N/A' }}</p>
                          </div>
                        </div>
                        <div class="col-md-6">
                          <div class="info-block h-100">
                            <h6 class="info-block-title">Secondary Education</h6>
                            <p class="mb-1"><strong>School:</strong> {{
                              selectedApplication.academicBackground?.secondary?.name || 'N/A' }}</p>
                            <p class="mb-1"><strong>Start:</strong> {{
                              selectedApplication.academicBackground?.secondary?.startDate || 'N/A' }}</p>
                            <p class="mb-0"><strong>End:</strong> {{
                              selectedApplication.academicBackground?.secondary?.endDate || 'N/A' }}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                        <h6 class="section-title mb-0">Examination Records</h6>
                        <span class="badge bg-light text-dark">{{ selectedApplication.examinations?.length || 0 }}
                          records</span>
                      </div>

                      <div v-if="selectedApplication.examinations?.length" class="d-flex flex-column gap-3">
                        <div v-for="(exam, examIndex) in selectedApplication.examinations"
                          :key="`${exam.examType}-${examIndex}`" class="info-block">
                          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                            <h6 class="info-block-title mb-0">{{ exam.examType || 'Exam Record' }}</h6>
                            <span class="text-muted small">{{ exam.examYear || 'N/A' }} · {{ exam.examNumber || 'No Number' }}</span>
                          </div>
                          <div v-if="exam.subjects?.length" class="d-flex flex-wrap gap-2">
                            <span v-for="(subject, subjectIndex) in exam.subjects"
                              :key="`${subject.subject}-${subjectIndex}`" class="detail-chip soft-chip">
                              {{ subject.subject || 'Subject' }}: {{ subject.grade || 'N/A' }}
                            </span>
                          </div>
                          <p v-else class="text-muted mb-0">No subject breakdown submitted.</p>
                        </div>
                      </div>
                      <p v-else class="text-muted mb-0">No examination records submitted.</p>
                    </div>
                  </div>

                  <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                        <h6 class="section-title mb-0">Referees</h6>
                        <span class="badge bg-light text-dark">{{ selectedApplication.referees?.length || 0 }}
                          listed</span>
                      </div>
                      <div v-if="selectedApplication.referees?.length" class="row g-3">
                        <div v-for="(referee, refereeIndex) in selectedApplication.referees"
                          :key="`${referee.email}-${refereeIndex}`" class="col-md-6">
                          <div class="info-block h-100">
                            <h6 class="info-block-title">{{ referee.name || `Referee ${refereeIndex + 1}` }}</h6>
                            <p class="mb-1"><strong>Email:</strong> {{ referee.email || 'N/A' }}</p>
                            <p class="mb-0"><strong>Phone:</strong> {{ referee.phone || 'N/A' }}</p>
                          </div>
                        </div>
                      </div>
                      <p v-else class="text-muted mb-0">No referees submitted.</p>
                    </div>
                  </div>

                  <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                        <h6 class="section-title mb-0">Documents</h6>
                        <span class="badge bg-light text-dark">{{ getDocumentCount(selectedApplication) }}
                          uploaded</span>
                      </div>

                      <div v-if="documentSections.length" class="row g-3">
                        <div v-for="section in documentSections" :key="section.title" class="col-md-6">
                          <div class="info-block h-100">
                            <h6 class="info-block-title">{{ section.title }}</h6>
                            <div class="d-flex flex-column gap-2">
                              <a v-for="document in section.documents" :key="`${section.title}-${document.url}`"
                                :href="document.url" target="_blank" rel="noopener noreferrer" class="document-link">
                                <span>
                                  <i class="bi bi-box-arrow-up-right me-2"></i>{{ document.label }}
                                </span>
                                <small class="text-muted">{{ formatDate(document.uploadedAt) }}</small>
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p v-else class="text-muted mb-0">No uploaded documents available.</p>
                    </div>
                  </div>
                </div>

                <div class="col-lg-4">
                  <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                      <h6 class="section-title">Admission Flow</h6>
                      <div class="details-grid single-column-grid">
                        <div>
                          <span class="details-label">Current Stage</span>
                          <span class="details-value">{{ getStageLabel(selectedApplication.currentStage) }}</span>
                        </div>
                        <div>
                          <span class="details-label">Entrance Exam</span>
                          <span class="details-value">
                            {{ selectedApplication.admissionFlow?.entranceExamEnabled === false ? 'Skipped for session'
                              : 'Required' }}
                          </span>
                        </div>
                        <div>
                          <span class="details-label">Screening</span>
                          <span class="details-value">
                            {{ selectedApplication.admissionFlow?.screeningEnabled === false ? 'Skipped for session' :
                              'Required' }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                      <h6 class="section-title">Entrance Exam</h6>
                      <div class="details-grid single-column-grid">
                        <div>
                          <span class="details-label">Date</span>
                          <span class="details-value">{{ formatDate(selectedApplication.entranceExam?.date) }}</span>
                        </div>
                        <div>
                          <span class="details-label">Time</span>
                          <span class="details-value">{{ selectedApplication.entranceExam?.time || 'N/A' }}</span>
                        </div>
                        <div>
                          <span class="details-label">Score</span>
                          <span class="details-value">{{ selectedApplication.entranceExam?.score ?? 'N/A' }}</span>
                        </div>
                        <div>
                          <span class="details-label">Link</span>
                          <a v-if="selectedApplication.entranceExam?.link" :href="selectedApplication.entranceExam.link"
                            target="_blank" rel="noopener noreferrer" class="document-link compact-link">
                            Open exam link
                          </a>
                          <span v-else class="details-value">N/A</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                      <h6 class="section-title">Screening</h6>
                      <div class="details-grid single-column-grid">
                        <div>
                          <span class="details-label">Date</span>
                          <span class="details-value">{{ formatDate(selectedApplication.screening?.date) }}</span>
                        </div>
                        <div>
                          <span class="details-label">Time</span>
                          <span class="details-value">{{ selectedApplication.screening?.time || 'N/A' }}</span>
                        </div>
                        <div>
                          <span class="details-label">Venue</span>
                          <span class="details-value">{{ selectedApplication.screening?.venue || 'N/A' }}</span>
                        </div>
                        <div>
                          <span class="details-label">Completed</span>
                          <span class="details-value">{{ selectedApplication.screening?.completed ? 'Yes' : 'No'
                          }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                      <h6 class="section-title">Admission Decision</h6>
                      <div class="details-grid single-column-grid">
                        <div>
                          <span class="details-label">Decision</span>
                          <span class="details-value">{{ getAdmissionDecisionValue(selectedApplication) }}</span>
                        </div>
                        <div>
                          <span class="details-label">Admission Date</span>
                          <span class="details-value">{{ formatDate(selectedApplication.admissionDate) }}</span>
                        </div>
                        <div>
                          <span class="details-label">Provisional Offer</span>
                          <a v-if="selectedApplication.admissionLetter" :href="selectedApplication.admissionLetter"
                            target="_blank" rel="noopener noreferrer" class="document-link compact-link">
                            Open document
                          </a>
                          <span v-else class="details-value">Not generated</span>
                        </div>
                        <div v-if="selectedApplication.rejectionReason">
                          <span class="details-label">Rejection Reason</span>
                          <p class="details-value mb-0">{{ selectedApplication.rejectionReason }}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                      <h6 class="section-title">Payments Summary</h6>
                      <div class="payment-summary-grid">
                        <div class="summary-tile success-tile">
                          <span class="summary-value">{{ selectedPaymentHistory.successfulCount }}</span>
                          <span class="summary-label">Successful</span>
                        </div>
                        <div class="summary-tile warning-tile">
                          <span class="summary-value">{{ selectedPaymentHistory.pendingCount }}</span>
                          <span class="summary-label">Pending</span>
                        </div>
                        <div class="summary-tile danger-tile">
                          <span class="summary-value">{{ selectedPaymentHistory.failedCount }}</span>
                          <span class="summary-label">Failed</span>
                        </div>
                        <div class="summary-tile secondary-tile">
                          <span class="summary-value">{{ selectedPaymentHistory.cancelledCount }}</span>
                          <span class="summary-label">Cancelled</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="card border-0 shadow-sm">
                <div class="card-body">
                  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                    <h6 class="section-title mb-0">Linked Payment History</h6>
                    <span class="badge bg-light text-dark">{{ selectedPaymentHistory.totalCount }} records</span>
                  </div>

                  <div v-if="selectedPaymentHistory.payments.length" class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Payment</th>
                          <th>Reference</th>
                          <th>Status</th>
                          <th>Amount</th>
                          <th>Session</th>
                          <th>Paid At</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="payment in selectedPaymentHistory.payments" :key="payment.id">
                          <td>
                            <div class="fw-semibold">{{ payment.payment?.name || 'Unknown Payment' }}</div>
                            <div class="small text-muted">{{ payment.payment?.paymentCode || 'No code' }}</div>
                          </td>
                          <td>
                            <div class="small fw-semibold">{{ payment.reference }}</div>
                            <div class="small text-muted">{{ payment.channel || 'N/A' }}</div>
                          </td>
                          <td>
                            <span class="badge rounded-pill" :class="getPaymentStatusBadgeClass(payment.status)">
                              {{ formatLabel(payment.status) }}
                            </span>
                          </td>
                          <td>
                            <div class="fw-semibold">{{ formatCurrency(payment.amount) }}</div>
                            <div class="small text-muted" v-if="payment.fee">Fee: {{ formatCurrency(payment.fee) }}
                            </div>
                          </td>
                          <td>{{ getPaymentAcademicSessionLabel(payment) }}</td>
                          <td>
                            <div>{{ formatDateTime(payment.paidAt || payment.createdAt) }}</div>
                            <div class="small text-muted" v-if="payment.remarks">{{ payment.remarks }}</div>
                            <div class="small text-muted" v-if="payment.verificationRemarks">{{
                              payment.verificationRemarks }}</div>
                          </td>
                          <td>
                            <div class="d-flex flex-wrap gap-2 justify-content-end">
                              <button v-if="payment.receiptUrl" type="button" class="btn btn-sm btn-outline-secondary"
                                @click="openPaymentReceipt(payment)">
                                <i class="bi bi-receipt me-1"></i>Receipt
                              </button>

                              <template v-if="canReviewManualTransfer(payment)">
                                <button type="button" class="btn btn-sm btn-success"
                                  :disabled="isProcessingPayment(payment.id)"
                                  @click="verifyManualTransferPayment(payment)">
                                  <span v-if="isProcessingPayment(payment.id)"
                                    class="spinner-border spinner-border-sm me-1"></span>
                                  <i v-else class="bi bi-check-circle me-1"></i>Verify
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-danger"
                                  :disabled="isProcessingPayment(payment.id)"
                                  @click="rejectManualTransferPayment(payment)">
                                  <i class="bi bi-x-circle me-1"></i>Reject
                                </button>
                              </template>

                              <span v-else-if="payment.method === 'manual_transfer' && payment.status === 'successful'"
                                class="badge bg-success-subtle text-success-emphasis align-self-center">
                                Verified
                              </span>

                              <span v-else-if="payment.method === 'manual_transfer' && payment.status === 'failed'"
                                class="badge bg-danger-subtle text-danger-emphasis align-self-center">
                                Rejected
                              </span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p v-else class="text-muted mb-0">No payment records linked to this applicant yet.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer border-0 pt-0">
            <button type="button" class="btn btn-outline-secondary" @click="closeDetailsModal">Close</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade receipt-preview-layer" :class="{ show: showPaymentReceiptModal }"
      :style="{ display: showPaymentReceiptModal ? 'block' : 'none' }" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-centered receipt-preview-dialog">
        <div class="modal-content receipt-preview-modal">
          <div class="modal-header border-0 pb-0">
            <div>
              <h6 class="modal-title fw-bold text-staff-primary">Uploaded Receipt</h6>
              <p v-if="selectedPaymentReceipt" class="text-muted mb-0 small">
                {{ selectedPaymentReceipt.payment?.name || 'Payment Receipt' }} · {{ getReceiptFilename() }}
              </p>
            </div>
            <button type="button" class="btn-close" @click="closePaymentReceiptModal"></button>
          </div>

          <div class="modal-body pt-3" v-if="selectedPaymentReceipt">
            <div class="receipt-preview-shell">
              <img v-if="isImageReceipt()" :src="getReceiptSource()" :alt="getReceiptFilename()"
                class="receipt-preview-image" />

              <iframe v-else-if="isPdfReceipt()" :src="getReceiptSource()" title="Uploaded receipt preview"
                class="receipt-preview-frame"></iframe>

              <div v-else class="receipt-preview-fallback text-center">
                <i class="bi bi-file-earmark-text fs-1 mb-3 d-block text-muted"></i>
                <h6 class="fw-bold">Preview unavailable</h6>
                <p class="text-muted mb-0">This receipt format cannot be previewed inline.</p>
              </div>
            </div>
          </div>

          <div class="modal-footer border-0 pt-0">
            <button type="button" class="btn btn-outline-secondary" @click="closePaymentReceiptModal">Close</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-backdrop fade" :class="{ show: showDetailsModal }"
      v-if="showDetailsModal && !showPaymentReceiptModal"></div>
    <div class="modal-backdrop fade receipt-preview-backdrop" :class="{ show: showPaymentReceiptModal }"
      v-if="showPaymentReceiptModal" @click="closePaymentReceiptModal"></div>
  </div>
</template>

<style scoped>
.staff-card {
  border: none;
  box-shadow: 0 2px 10px rgba(26, 95, 95, 0.1);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.table th {
  font-weight: 600;
  color: var(--staff-primary);
  border-bottom: 2px solid var(--staff-light);
}

.table td {
  vertical-align: middle;
}

.pagination .page-link {
  color: var(--staff-primary);
  border-color: var(--staff-light);
}

.pagination .page-item.active .page-link {
  background-color: var(--staff-primary);
  border-color: var(--staff-primary);
  color: white;
}

.dropdown-menu {
  border: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

code {
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: var(--staff-light);
}

.application-details-modal {
  border: none;
  border-radius: 20px;
}

.application-hero {
  background: linear-gradient(135deg, rgba(26, 95, 95, 0.08), rgba(13, 110, 253, 0.05));
}

.application-avatar {
  width: 112px;
  height: 112px;
  object-fit: cover;
  border-radius: 24px;
  border: 3px solid rgba(26, 95, 95, 0.15);
  background: #fff;
}

.detail-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.45rem 0.85rem;
  background: rgba(26, 95, 95, 0.08);
  color: var(--staff-primary);
  border-radius: 999px;
  font-size: 0.875rem;
}

.soft-chip {
  background: rgba(13, 110, 253, 0.08);
  color: #0d6efd;
}

.summary-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.summary-stat,
.summary-tile {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 1rem;
  border-radius: 16px;
  background: #fff;
  border: 1px solid rgba(26, 95, 95, 0.08);
}

.summary-value {
  font-weight: 700;
  color: var(--staff-primary);
  line-height: 1.2;
}

.summary-label {
  font-size: 0.85rem;
  color: #6c757d;
}

.payment-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.success-tile {
  background: rgba(25, 135, 84, 0.08);
}

.warning-tile {
  background: rgba(255, 193, 7, 0.12);
}

.danger-tile {
  background: rgba(220, 53, 69, 0.08);
}

.secondary-tile {
  background: rgba(108, 117, 125, 0.08);
}

.section-title {
  font-weight: 700;
  color: var(--staff-primary);
  margin-bottom: 1rem;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.compact-grid {
  gap: 0.75rem;
}

.single-column-grid {
  grid-template-columns: 1fr;
}

.details-label {
  display: block;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6c757d;
  margin-bottom: 0.25rem;
}

.details-value {
  display: block;
  font-weight: 600;
  color: #212529;
}

.info-block {
  padding: 1rem;
  border-radius: 16px;
  background: rgba(248, 249, 250, 0.8);
}

.info-block-title {
  color: var(--staff-primary);
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.document-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.9rem;
  border-radius: 12px;
  background: rgba(26, 95, 95, 0.05);
  color: var(--staff-primary);
  text-decoration: none;
}

.document-link:hover {
  background: rgba(26, 95, 95, 0.1);
  color: var(--staff-primary);
}

.applications-mobile-card {
  border: 1px solid rgba(26, 95, 95, 0.1);
  border-radius: 16px;
  padding: 1rem;
  background: #fff;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
}

.applications-mobile-meta {
  border-top: 1px solid rgba(26, 95, 95, 0.08);
  border-bottom: 1px solid rgba(26, 95, 95, 0.08);
  padding-top: 0.85rem;
  padding-bottom: 0.85rem;
}

.compact-link {
  padding: 0.5rem 0.75rem;
  justify-content: flex-start;
}

.receipt-preview-dialog {
  max-width: 1100px;
}

.receipt-preview-layer {
  z-index: 1070;
}

.receipt-preview-modal {
  border: none;
  border-radius: 20px;
  height: min(92vh, 920px);
  max-height: calc(100vh - 2rem);
}

.receipt-preview-shell {
  height: 100%;
  min-height: 60vh;
  border-radius: 1.25rem;
  background: #f8f9fb;
  border: 1px solid rgba(26, 95, 95, 0.08);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.receipt-preview-image {
  width: 100%;
  height: 100%;
  max-height: 70vh;
  object-fit: contain;
  background: #fff;
}

.receipt-preview-frame {
  width: 100%;
  height: 100%;
  min-height: 70vh;
  border: 0;
  background: #fff;
}

.receipt-preview-fallback {
  max-width: 28rem;
  padding: 2rem;
}

.receipt-preview-backdrop {
  z-index: 1060;
}

@media (max-width: 991.98px) {

  .details-grid,
  .summary-panel,
  .payment-summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 575.98px) {
  .applications-mobile-card {
    padding: 0.9rem;
  }

  .receipt-preview-dialog {
    max-width: none;
    margin: 0.5rem;
  }

  .receipt-preview-modal {
    height: calc(100vh - 1rem);
    max-height: calc(100vh - 1rem);
  }

  .receipt-preview-shell {
    min-height: calc(100vh - 10rem);
  }

  .receipt-preview-image,
  .receipt-preview-frame {
    max-height: calc(100vh - 12rem);
    min-height: calc(100vh - 12rem);
  }
}
</style>
