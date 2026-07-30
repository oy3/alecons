<script>
import { apiService } from '../../../services/api.js'
import { useAuthStore } from '../../../stores/auth.js'

export default {
  name: 'ResultReviewQueue',
  props: { queue: { type: String, required: true } },
  data() {
    return {
      loading: false,
      reviewing: false,
      resultGroups: [],
      selectedGroup: null,
      report: null,
      groupSearch: '',
      sessionFilter: '',
      attemptFilter: '',
    }
  },
  setup() { return { authStore: useAuthStore() } },
  computed: {
    title() {
      return this.queue === 'hod' ? 'HOD Review Queue'
        : this.queue === 'hod-ready' ? 'Ready for Provost'
          : this.queue === 'provost' ? 'Provost Review Queue'
            : this.queue === 'published' ? 'Published Results'
              : 'Publication Queue'
    },
    description() {
      return this.queue === 'hod' ? 'Submitted course results from departments you lead.'
        : this.queue === 'hod-ready' ? 'HOD-approved course results ready for institutional submission.'
          : this.queue === 'provost' ? 'HOD-approved course results awaiting institutional review.'
            : this.queue === 'published' ? 'Published course results, approval history, exports, and controlled amendments.'
              : 'Provost-approved course results ready to be released to students.'
    },
    gradeDistribution() {
      return Object.entries(this.report?.grades || {}).sort(([left], [right]) => left.localeCompare(right))
    },
    canAmend() { return this.authStore.hasPermission('academicResults', 'amend') },
    canExport() { return this.authStore.hasPermission('academicResults', 'export') },
    sessionOptions() {
      const sessions = new Map()
      this.resultGroups.forEach((group) => {
        if (group.academicSessionId) sessions.set(String(group.academicSessionId), group.academicSession)
      })
      return [...sessions.entries()].sort((left, right) => String(right[1]?.title || right[1]?.sessionYear || '').localeCompare(String(left[1]?.title || left[1]?.sessionYear || '')))
    },
    filteredGroups() {
      const query = this.groupSearch.trim().toLowerCase()
      return this.resultGroups.filter((group) => {
        if (this.sessionFilter && String(group.academicSessionId) !== this.sessionFilter) return false
        if (this.attemptFilter && group.attemptType !== this.attemptFilter) return false
        if (!query) return true
        return [group.courseCodeSnapshot, group.courseTitleSnapshot, group.program?.name, group.departmentId?.name]
          .some((value) => String(value || '').toLowerCase().includes(query))
      })
    },
  },
  watch: { queue: { immediate: true, handler() { this.closeReview(); this.load() } } },
  methods: {
    async load() {
      this.loading = true
      try {
        const response = await apiService.getAcademicResultsQueue(this.queue)
        this.resultGroups = response.data || []
      } catch (error) {
        this.$swal.fire('Could not load review queue', error.message || 'Please try again.', 'error')
      } finally { this.loading = false }
    },
    async openReview(group) {
      this.reviewing = true
      this.selectedGroup = group
      try {
        const response = await apiService.getAcademicResultContextReport(group)
        this.report = response.data || response
      } catch (error) {
        this.closeReview()
        this.$swal.fire('Could not load course results', error.message || 'Please try again.', 'error')
      } finally { this.reviewing = false }
    },
    closeReview() { this.selectedGroup = null; this.report = null },
    studentName(result) {
      const user = result.studentId?.userId
      return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '-'
    },
    actorName(audit) {
      const actor = audit.actorUserId
      return [actor?.firstName, actor?.otherName, actor?.lastName].filter(Boolean).join(' ') || audit.actorRole || 'Staff'
    },
    formatAction(action) {
      return String(action || '').split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
    },
    formatDate(value) { return value ? new Date(value).toLocaleString() : '-' },
    async amendPublished(result) {
      const components = result.componentScores || []
      const rows = components.map((component, index) => `
        <div class="row g-2 align-items-center mb-2 text-start">
          <div class="col-7"><label class="form-label small mb-0">${this.escapeHtml(component.componentTitle || `Component ${index + 1}`)}</label><div class="small text-muted">Maximum ${Number(component.maximumMarkSnapshot || 0)}</div></div>
          <div class="col-5"><input id="amend-mark-${index}" type="number" class="form-control" min="0" max="${Number(component.maximumMarkSnapshot || 0)}" step="0.01" value="${component.obtainedMark ?? ''}"></div>
        </div>`).join('')
      const decision = await this.$swal.fire({
        title: `Amend ${this.studentName(result)}`,
        html: `${rows}<div class="text-start mt-3"><label class="form-label">Reason for amendment</label><textarea id="amend-reason" class="form-control" rows="3" maxlength="2000"></textarea></div>`,
        width: 680,
        showCancelButton: true,
        confirmButtonText: 'Save amendment',
        focusConfirm: false,
        preConfirm: () => {
          const reason = document.getElementById('amend-reason')?.value?.trim()
          if (!reason) { this.$swal.showValidationMessage('Enter the reason for this amendment.'); return false }
          const componentScores = components.map((component, index) => ({
            componentOrder: Number(component.componentOrder),
            rawMark: Number(document.getElementById(`amend-mark-${index}`)?.value),
            absent: false,
          }))
          const invalid = componentScores.some((score, index) => !Number.isFinite(score.rawMark) || score.rawMark < 0 || score.rawMark > Number(components[index].maximumMarkSnapshot))
          if (invalid) { this.$swal.showValidationMessage('Each mark must be within its component maximum.'); return false }
          return { reason, componentScores }
        },
      })
      if (!decision.isConfirmed) return
      try {
        await apiService.amendPublishedAcademicResult(result._id, { version: result.__v || 0, ...decision.value })
        await this.openReview(this.selectedGroup)
        await this.load()
        this.$swal.fire('Result amended', 'The result, GPA summary, and audit history were updated.', 'success')
      } catch (error) { this.$swal.fire('Amendment failed', error.message || 'Please try again.', 'error') }
    },
    escapeHtml(value) {
      const element = document.createElement('div')
      element.textContent = String(value || '')
      return element.innerHTML
    },
    exportCsv() {
      if (!this.report?.results?.length) return
      const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
      const rows = [['Matric Number', 'Student', 'Course Code', 'Attempt', 'Units', 'Score', 'Grade', 'Grade Point', 'Quality Points', 'Outcome']]
      this.report.results.forEach((result) => rows.push([
        result.studentId?.matriculationNumber,
        this.studentName(result),
        result.courseCodeSnapshot,
        result.attemptType,
        result.unitsSnapshot,
        result.finalScore,
        result.gradeLetter,
        result.gradePoint,
        result.qualityPoints,
        result.specialStatus === 'normal' ? (result.isPass ? 'Pass' : 'Fail') : result.specialStatus,
      ]))
      const blob = new Blob([rows.map((row) => row.map(quote).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${this.selectedGroup.courseCodeSnapshot || 'course'}-${this.selectedGroup.attemptType || 'results'}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
    },
    async review(group, approved) {
      if (this.queue === 'publish') {
        const confirmation = await this.$swal.fire({ title: 'Publish course results?', text: 'Students will be able to view these academic records.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Publish' })
        if (!confirmation.isConfirmed) return
        try { await apiService.publishAcademicResults(group); this.closeReview(); await this.load(); this.$swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Results published', showConfirmButton: false, timer: 1800 }) } catch (error) { this.$swal.fire('Publishing failed', error.message || 'Please try again.', 'error') }
        return
      }
      if (this.queue === 'hod-ready') {
        try { await apiService.submitAcademicResultsToProvost(group); this.closeReview(); await this.load(); this.$swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Submitted to Provost', showConfirmButton: false, timer: 1800 }) } catch (error) { this.$swal.fire('Submission failed', error.message || 'Please try again.', 'error') }
        return
      }
      let comment
      if (!approved) {
        const result = await this.$swal.fire({ title: 'Return course results', input: 'textarea', inputLabel: 'Required correction comment', inputValidator: (value) => !value?.trim() && 'Enter a correction comment.', showCancelButton: true, confirmButtonText: 'Return' })
        if (!result.isConfirmed) return
        comment = result.value
      }
      try {
        if (this.queue === 'hod') await apiService.reviewAcademicResultsAsHod(group, { approved, comment })
        else await apiService.reviewAcademicResultsAsProvost(group, { approved, comment })
        this.closeReview()
        await this.load()
        this.$swal.fire({ toast: true, position: 'top-end', icon: 'success', title: approved ? 'Course results approved' : 'Course results returned', showConfirmButton: false, timer: 1800 })
      } catch (error) { this.$swal.fire('Review could not be completed', error.message || 'Please try again.', 'error') }
    },
  },
}
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div><h5 class="mb-1">{{ title }}</h5><p class="text-muted mb-0">{{ description }}</p></div>
      <button class="btn btn-outline-secondary" :disabled="loading" title="Refresh queue" @click="load"><i class="bi bi-arrow-clockwise"></i></button>
    </div>

    <div v-if="queue === 'published'" class="row g-2 mb-3">
      <div class="col-lg-5"><div class="input-group input-group-sm"><span class="input-group-text bg-white"><i class="bi bi-search"></i></span><input v-model="groupSearch" class="form-control" placeholder="Search course, program, or department"></div></div>
      <div class="col-lg-4 col-md-6"><select v-model="sessionFilter" class="form-select form-select-sm"><option value="">All academic sessions</option><option v-for="([id, session]) in sessionOptions" :key="id" :value="id">{{ session?.title || session?.sessionYear }}</option></select></div>
      <div class="col-lg-3 col-md-6"><select v-model="attemptFilter" class="form-select form-select-sm"><option value="">All attempts</option><option value="initial">Initial</option><option value="resit">Resit</option><option value="repeat">Repeat</option></select></div>
    </div>

    <div class="card border-0 shadow-sm p-0">
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead class="table-light"><tr><th>Course</th><th>Program</th><th>Department</th><th>Cohort</th><th>Students</th><th class="text-end">Action</th></tr></thead>
          <tbody>
            <tr v-for="group in filteredGroups" :key="group.contextKey">
              <td><div class="fw-semibold">{{ group.courseCodeSnapshot }}</div><small class="text-muted">{{ group.courseTitleSnapshot }}</small></td>
              <td>{{ group.program?.name || '-' }}</td>
              <td>{{ group.departmentId?.name || '-' }}</td>
              <td>{{ group.academicSession?.title || group.academicSession?.sessionYear || '-' }}<small class="d-block text-muted">Year {{ group.level }} · Semester {{ group.semester }} · {{ group.attemptType }}</small></td>
              <td>{{ group.pendingStudents }}</td>
              <td class="text-end"><button class="btn btn-sm btn-outline-primary" @click="openReview(group)"><i class="bi bi-eye me-1"></i>Review</button></td>
            </tr>
            <tr v-if="!loading && !filteredGroups.length"><td colspan="6" class="text-center text-muted py-4">{{ queue === 'published' ? 'No published course results match these filters.' : 'No course result groups are waiting for review.' }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="selectedGroup" class="modal d-block" tabindex="-1" role="dialog" aria-modal="true">
      <div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content">
        <div class="modal-header"><div><h5 class="modal-title">{{ selectedGroup.courseCodeSnapshot }} - {{ selectedGroup.courseTitleSnapshot }}</h5><small class="text-muted">{{ selectedGroup.academicSession?.title || selectedGroup.academicSession?.sessionYear }} · Year {{ selectedGroup.level }} · Semester {{ selectedGroup.semester }}</small></div><button type="button" class="btn-close" @click="closeReview"></button></div>
        <div class="modal-body">
          <div v-if="reviewing" class="text-center py-5"><span class="spinner-border text-primary"></span></div>
          <template v-else-if="report">
            <div class="d-flex flex-wrap gap-2 mb-3"><span v-for="([grade, count]) in gradeDistribution" :key="grade" class="badge text-bg-light border">{{ grade }}: {{ count }}</span></div>
            <div class="table-responsive"><table class="table table-sm align-middle"><thead class="table-light"><tr><th>Student</th><th>Matric Number</th><th>Score</th><th>Grade</th><th>Point</th><th>Outcome</th><th>Status</th><th v-if="queue === 'published' && canAmend" class="text-end">Action</th></tr></thead><tbody><tr v-for="result in report.results" :key="result._id"><td>{{ studentName(result) }}</td><td>{{ result.studentId?.matriculationNumber || '-' }}</td><td>{{ result.finalScore ?? '-' }}</td><td>{{ result.gradeLetter || '-' }}</td><td>{{ result.gradePoint ?? '-' }}</td><td><span v-if="result.specialStatus === 'normal'" class="badge" :class="result.isPass ? 'text-bg-success' : 'text-bg-danger'">{{ result.isPass ? 'Pass' : 'Fail' }}</span><span v-else class="badge text-bg-warning">{{ result.specialStatus }}</span></td><td>{{ result.workflowStatus }}</td><td v-if="queue === 'published' && canAmend" class="text-end"><button class="btn btn-sm btn-outline-warning" title="Amend published result" @click="amendPublished(result)"><i class="bi bi-pencil-square"></i></button></td></tr></tbody></table></div>
            <div v-if="report.audits?.length" class="mt-4">
              <h6 class="fw-bold">Approval Timeline</h6>
              <div class="list-group list-group-flush border rounded">
                <div v-for="audit in report.audits" :key="audit._id" class="list-group-item">
                  <div class="d-flex justify-content-between gap-3"><span class="fw-semibold">{{ formatAction(audit.action) }}</span><small class="text-muted">{{ formatDate(audit.createdAt) }}</small></div>
                  <div class="small text-muted">{{ actorName(audit) }}<span v-if="audit.previousState || audit.newState"> · {{ audit.previousState || '-' }} → {{ audit.newState || '-' }}</span></div>
                  <div v-if="audit.comment" class="small mt-1">{{ audit.comment }}</div>
                </div>
              </div>
            </div>
          </template>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" @click="closeReview">Close</button><template v-if="queue === 'published'"><button v-if="canExport" class="btn btn-outline-primary" @click="exportCsv"><i class="bi bi-download me-1"></i>Export CSV</button></template><template v-else-if="queue === 'publish'"><button class="btn btn-success" @click="review(selectedGroup, true)">Publish</button></template><template v-else-if="queue === 'hod-ready'"><button class="btn btn-primary" @click="review(selectedGroup, true)">Send to Provost</button></template><template v-else><button class="btn btn-outline-danger" @click="review(selectedGroup, false)">Return</button><button class="btn btn-success" @click="review(selectedGroup, true)">Approve</button></template></div>
      </div></div>
    </div>
    <div v-if="selectedGroup" class="modal-backdrop show"></div>
  </div>
</template>
