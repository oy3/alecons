<script lang="js">
import Swal from 'sweetalert2'
import { apiService } from '../../services/api.js'
import { logger } from '@shared/utils/logger'

export default {
  name: 'StaffUtilities',
  data() {
    return {
      academicSessions: [],
      selectedAcademicSessionId: '',
      isLoading: false,
      isRepairingCounter: false,
      isRepairingProgramDrift: false,
      isBackfillingVerificationTokens: false,
      isRepairingAcademicSessions: false,
      isMigratingDemographics: false,
      counterStats: null,
      counterRecord: null,
      programDriftSummary: null,
      utilityCards: [
        {
          id: 'repair-academic-sessions',
          title: 'Repair Academic Sessions',
          icon: 'bi-tools',
          variant: 'info',
          description: 'Detect legacy unique index on academic session year and optionally drop it to allow free-text titles and multiple batches per year.',
          actionLabel: 'Run Repair'
        },
        {
          id: 'application-counter-repair',
          title: 'Application Counter Repair',
          icon: 'bi-hammer',
          variant: 'primary',
          description: 'Inspect the application counter for the selected year and repair it when the stored sequence falls behind the highest issued application number.',
          actionLabel: 'Repair Counter'
        },
        {
          id: 'program-drift-repair',
          title: 'Program Drift Repair',
          icon: 'bi-diagram-3',
          variant: 'warning',
          description: 'Remove legacy program type/mode fields from Application and Student records and report broken program links so programId remains the only source of truth.',
          actionLabel: 'Inspect & Repair Drift'
        },
        {
          id: 'public-verification-backfill',
          title: 'Public Verification Token Backfill',
          icon: 'bi-upc-scan',
          variant: 'success',
          description: 'Generate missing public verification tokens for existing student and staff records so ID card QR codes can be issued without opening each profile individually.',
          actionLabel: 'Backfill Tokens'
        },
        {
          id: 'migrate-user-demographics',
          title: 'Migrate User Demographics',
          icon: 'bi-person-lines-fill',
          variant: 'primary',
          description: 'Copy missing dob and gender into User profiles, then migrate enrolled-student profile photos into matriculation-number student storage.',
          actionLabel: 'Inspect & Migrate'
        },
        {
          id: 'future-utilities',
          title: 'More Utilities Coming',
          icon: 'bi-stars',
          variant: 'secondary',
          description: 'This module is reserved for future admin utilities such as data integrity checks, one-off repair tools, and operational maintenance actions.',
          actionLabel: 'Coming Soon',
          disabled: true
        }
      ]
    }
  },
  async mounted() {
    await this.loadAcademicSessions()
    await this.loadUtilityState()
  },
  computed: {
    selectedSession() {
      return this.academicSessions.find(session => session._id === this.selectedAcademicSessionId) || null
    },
    selectedSessionYear() {
      return this.selectedSession?.sessionYear || 'N/A'
    },
    selectedYear() {
      const sessionYear = this.selectedSession?.sessionYear || ''
      const match = sessionYear.match(/\d{4}/)
      return match ? Number(match[0]) : new Date().getFullYear()
    },
    counterHealth() {
      if (!this.counterStats?.counter) {
        return {
          label: this.counterStats?.totalApplications ? 'Counter Missing' : 'No Data Yet',
          className: this.counterStats?.totalApplications ? 'bg-danger-subtle text-danger' : 'bg-secondary-subtle text-secondary',
          icon: this.counterStats?.totalApplications ? 'bi-exclamation-triangle' : 'bi-database'
        }
      }

      if (this.counterStats.counter.status === 'healthy') {
        return {
          label: 'Healthy',
          className: 'bg-success-subtle text-success',
          icon: 'bi-check-circle'
        }
      }

      return {
        label: 'Needs Repair',
        className: 'bg-warning-subtle text-warning-emphasis',
        icon: 'bi-tools'
      }
    },
    highestSequence() {
      return this.counterStats?.highestSequence || 0
    },
    currentSequence() {
      return this.counterStats?.counter?.sequence || 0
    },
    sequenceDrift() {
      return this.counterStats?.counter?.drift || 0
    },
    hasRepairableDrift() {
      if (!this.counterStats) return false
      if (!this.counterStats.totalApplications) return false
      if (!this.counterStats.counter) return true
      return this.counterStats.counter.status !== 'healthy'
    },
    programDriftHealth() {
      if (!this.programDriftSummary) {
        return {
          label: 'Unknown',
          className: 'bg-secondary-subtle text-secondary',
          icon: 'bi-question-circle'
        }
      }

      const hasIssues = Boolean(
        this.programDriftSummary.drifted ||
        this.programDriftSummary.missingProgram ||
        this.programDriftSummary.missingProgramConfig
      )

      if (!hasIssues) {
        return {
          label: 'Healthy',
          className: 'bg-success-subtle text-success',
          icon: 'bi-check-circle'
        }
      }

      return {
        label: 'Needs Repair',
        className: 'bg-warning-subtle text-warning-emphasis',
        icon: 'bi-exclamation-triangle'
      }
    }
  },
  methods: {
    async loadAcademicSessions() {
      try {
        const response = await apiService.getAcademicSessions()

        if (!response.success) {
          throw new Error(response.error || 'Failed to load academic sessions')
        }

        this.academicSessions = response.data.sessions || []

        if (!this.selectedAcademicSessionId && this.academicSessions.length) {
          const preferredSession = this.academicSessions.find(session => session.active || session.status === 'open')
          this.selectedAcademicSessionId = preferredSession?._id || this.academicSessions[0]._id
        }
      } catch (error) {
        logger.error('Failed to load academic sessions for utilities:', error)
        throw error
      }
    },
    async loadUtilityState() {
      try {
        this.isLoading = true

        if (!this.selectedAcademicSessionId) {
          this.counterStats = null
          this.counterRecord = null
          return
        }

        logger.info('Loading utility dashboard state...', {
          academicSessionId: this.selectedAcademicSessionId,
          sessionYear: this.selectedSessionYear,
          year: this.selectedYear
        })

        const [statsResponse, counterResponse, driftResponse] = await Promise.all([
          apiService.getApplicationNumberStats(this.selectedYear),
          apiService.getApplicationCounterStatus({ academicSessionId: this.selectedAcademicSessionId }),
          apiService.getProgramDriftSummary(10)
        ])

        if (!statsResponse.success) {
          throw new Error(statsResponse.error || 'Failed to load application number stats')
        }

        if (!counterResponse.success) {
          throw new Error(counterResponse.error || 'Failed to load counter status')
        }

        if (!driftResponse.success) {
          throw new Error(driftResponse.error || 'Failed to load program drift summary')
        }

        this.counterStats = statsResponse.data
        this.counterRecord = counterResponse.data
        this.programDriftSummary = driftResponse.data

        logger.info('Utility dashboard state loaded', {
          academicSessionId: this.selectedAcademicSessionId,
          sessionYear: this.selectedSessionYear,
          totalApplications: this.counterStats?.totalApplications,
          highestSequence: this.counterStats?.highestSequence,
          counterSequence: this.counterStats?.counter?.sequence
        })
      } catch (error) {
        logger.error('Failed to load utility dashboard state:', error)
        await Swal.fire({
          icon: 'error',
          title: 'Load Failed',
          text: error.message || 'Failed to load utility data.'
        })
      } finally {
        this.isLoading = false
      }
    },
    async onYearChanged() {
      await this.loadUtilityState()
    },
    async runCounterRepair() {
      const detailsHtml = `
        <div class="text-start utility-confirmation">
          <div class="mb-3">
            <div class="small text-muted">Selected academic session</div>
            <div class="fw-semibold">${this.selectedSessionYear}</div>
          </div>
          <div class="row g-2 text-center mb-3">
            <div class="col-4">
              <div class="utility-stat-card">
                <div class="small text-muted">Counter</div>
                <div class="fw-semibold">${this.currentSequence}</div>
              </div>
            </div>
            <div class="col-4">
              <div class="utility-stat-card">
                <div class="small text-muted">Highest Issued</div>
                <div class="fw-semibold">${this.highestSequence}</div>
              </div>
            </div>
            <div class="col-4">
              <div class="utility-stat-card">
                <div class="small text-muted">Drift</div>
                <div class="fw-semibold">${this.sequenceDrift}</div>
              </div>
            </div>
          </div>
          <p class="small text-muted mb-0">This utility updates the yearly application counter to match the highest issued application sequence. It does not modify applicant records.</p>
        </div>
      `

      const result = await Swal.fire({
        title: 'Repair Application Counter?',
        html: detailsHtml,
        icon: this.hasRepairableDrift ? 'warning' : 'info',
        showCancelButton: true,
        confirmButtonText: this.hasRepairableDrift ? 'Run Repair' : 'Run Check Anyway',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#1a5f5f',
        customClass: {
          popup: 'utility-swal-popup'
        }
      })

      if (!result.isConfirmed) {
        return
      }

      try {
        this.isRepairingCounter = true
        logger.info('Running application counter repair utility', {
          academicSessionId: this.selectedAcademicSessionId,
          sessionYear: this.selectedSessionYear,
          year: this.selectedYear
        })

        const response = await apiService.repairApplicationCounters(this.selectedYear)
        if (!response.success) {
          throw new Error(response.error || 'Counter repair failed')
        }

        const repaired = response.data?.repaired || []
        const repairSummary = repaired.length
          ? repaired.map(item => `<li><strong>${item.counterId}</strong>: ${item.previousSequence} → ${item.newSequence}</li>`).join('')
          : '<li>No repair was needed. Counter is already aligned.</li>'

        await Swal.fire({
          icon: repaired.length ? 'success' : 'info',
          title: repaired.length ? 'Repair Complete' : 'No Repair Needed',
          html: `<ul class="text-start mb-0">${repairSummary}</ul>`,
          confirmButtonColor: '#1a5f5f'
        })

        await this.loadUtilityState()
      } catch (error) {
        logger.error('Application counter repair utility failed:', error)
        await Swal.fire({
          icon: 'error',
          title: 'Repair Failed',
          text: error.message || 'Unable to complete counter repair.'
        })
      } finally {
        this.isRepairingCounter = false
      }
    },
    formatDriftSampleRows(sample = []) {
      if (!sample.length) {
        return '<li>No drifted records found in the sample.</li>'
      }

      return sample
        .map(item => {
          if (item.issueType === 'legacy-fields-present') {
            return `<li><strong>${item.entityType}</strong> ${item.recordLabel}: remove legacy type ${item.currentProgramTypeId || 'null'} and mode ${item.currentProgramModeId || 'null'} fields. Program expects ${item.expectedProgramTypeId || 'n/a'} / ${item.expectedProgramModeId || 'n/a'}.</li>`
          }

          if (item.issueType === 'missing-program-config') {
            return `<li><strong>${item.entityType}</strong> ${item.recordLabel}: linked program ${item.programId || 'null'} is missing type or mode configuration.</li>`
          }

          return `<li><strong>${item.entityType}</strong> ${item.recordLabel}: missing or invalid program link.</li>`
        })
        .join('')
    },
    async runProgramDriftRepair() {
      try {
        this.isRepairingProgramDrift = true

        const previewResponse = await apiService.repairProgramDrift({ apply: false, sampleLimit: 10 })
        if (!previewResponse.success) {
          throw new Error(previewResponse.error || 'Program drift preview failed')
        }

        const preview = previewResponse.data || {}
        const result = await Swal.fire({
          title: 'Run Program Drift Repair?',
          icon: (preview.drifted || preview.missingProgram || preview.missingProgramConfig) ? 'warning' : 'info',
          html: `
            <div class="text-start utility-confirmation">
              <p class="small text-muted mb-2">This utility removes legacy top-level program type/mode fields from Application and Student records and reports broken program relations that still need manual cleanup.</p>
              <ul class="small mb-3">
                <li>Scanned: <strong>${preview.scanned || 0}</strong></li>
                <li>Application records scanned: <strong>${preview.applications?.scanned || 0}</strong></li>
                <li>Student records scanned: <strong>${preview.students?.scanned || 0}</strong></li>
                <li>Legacy fields found: <strong>${preview.drifted || 0}</strong></li>
                <li>Missing Program: <strong>${preview.missingProgram || 0}</strong></li>
                <li>Missing Program Config: <strong>${preview.missingProgramConfig || 0}</strong></li>
              </ul>
              <div class="small text-muted mb-1">Sample drifted records</div>
              <ul class="small mb-0 text-break">${this.formatDriftSampleRows(preview.sample || [])}</ul>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: preview.drifted ? 'Apply Repair' : 'Run Check Again',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#1a5f5f',
          customClass: { popup: 'utility-swal-popup' }
        })

        if (!result.isConfirmed) {
          return
        }

        if (!preview.drifted) {
          await Swal.fire({
            icon: preview.missingProgram || preview.missingProgramConfig ? 'warning' : 'info',
            title: preview.missingProgram || preview.missingProgramConfig ? 'Manual Cleanup Required' : 'Already Healthy',
            text: preview.missingProgram || preview.missingProgramConfig
              ? 'No legacy fields needed removal, but some records still reference missing or incomplete programs.'
              : 'No drifted records were detected, so no repair was applied.',
            confirmButtonColor: '#1a5f5f'
          })
          await this.loadUtilityState()
          return
        }

        const applyResponse = await apiService.repairProgramDrift({ apply: true, sampleLimit: 10 })
        if (!applyResponse.success) {
          throw new Error(applyResponse.error || 'Program drift repair failed')
        }

        const summary = applyResponse.data || {}
        await Swal.fire({
          icon: summary.modified ? 'success' : 'info',
          title: summary.modified ? 'Program Drift Repaired' : 'No Repair Needed',
          html: `
            <ul class="text-start mb-0">
              <li>Scanned: <strong>${summary.scanned || 0}</strong></li>
              <li>Records with legacy fields targeted: <strong>${summary.drifted || 0}</strong></li>
              <li>Matched: <strong>${summary.matched || 0}</strong></li>
              <li>Modified: <strong>${summary.modified || 0}</strong></li>
              <li>Missing Program: <strong>${summary.missingProgram || 0}</strong></li>
              <li>Missing Program Config: <strong>${summary.missingProgramConfig || 0}</strong></li>
              <li>Legacy records still remaining: <strong>${summary.remainingLegacyRecords || 0}</strong></li>
            </ul>
          `,
          confirmButtonColor: '#1a5f5f'
        })

        await this.loadUtilityState()
      } catch (error) {
        logger.error('Program drift repair utility failed:', error)
        await Swal.fire({
          icon: 'error',
          title: 'Repair Failed',
          text: error.message || 'Unable to complete program drift repair.'
        })
      } finally {
        this.isRepairingProgramDrift = false
      }
    },
    async runPublicVerificationBackfill() {
      const result = await Swal.fire({
        title: 'Generate Missing Verification Tokens?',
        html: `
          <div class="text-start utility-confirmation">
            <p class="small text-muted mb-2">This utility creates public verification tokens for existing students with matric numbers and staff with staff IDs when their token is still missing.</p>
            <ul class="small mb-0">
              <li>Existing tokens are left unchanged.</li>
              <li>Only records missing a token are updated.</li>
              <li>Generated tokens power QR links like <strong>https://alecons.edu.ng/verify/v1/&lt;token&gt;</strong>.</li>
            </ul>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Generate Tokens',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#1a5f5f',
        customClass: {
          popup: 'utility-swal-popup'
        }
      })

      if (!result.isConfirmed) {
        return
      }

      try {
        this.isBackfillingVerificationTokens = true

        const response = await apiService.backfillPublicVerificationTokens()
        if (!response.success) {
          throw new Error(response.error || 'Public verification token backfill failed')
        }

        const summary = response.data || {}

        await Swal.fire({
          icon: summary.totalTokensGenerated ? 'success' : 'info',
          title: summary.totalTokensGenerated ? 'Backfill Complete' : 'No Tokens Needed',
          html: `
            <ul class="text-start mb-0">
              <li>Student tokens generated: <strong>${summary.studentTokensGenerated || 0}</strong></li>
              <li>Staff tokens generated: <strong>${summary.staffTokensGenerated || 0}</strong></li>
              <li>Total tokens generated: <strong>${summary.totalTokensGenerated || 0}</strong></li>
            </ul>
          `,
          confirmButtonColor: '#1a5f5f'
        })
      } catch (error) {
        logger.error('Public verification token backfill failed:', error)
        await Swal.fire({
          icon: 'error',
          title: 'Backfill Failed',
          text: error.message || 'Unable to backfill public verification tokens.'
        })
      } finally {
        this.isBackfillingVerificationTokens = false
      }
    },

    async runMigrateUserDemographics() {
      const preview = await Swal.fire({
        title: 'Inspect User Demographics Migration?',
        html: `<div class="text-start utility-confirmation"><p class="small text-muted mb-2">This utility copies missing <strong>dob</strong> and <strong>gender</strong> values into User profiles, then copies enrolled-student profile photos into their matriculation-number storage folder.</p><ul class="small mb-0"><li>A dry run will count user updates and profile images to copy.</li><li>Apply updates User and Student records only after an image copy succeeds.</li></ul></div>`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Run Dry Run First',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#0d6efd',
        customClass: { popup: 'utility-swal-popup' }
      })

      if (!preview.isConfirmed) return

      try {
        this.isMigratingDemographics = true
        const dryRun = await apiService.migrateUserDemographics({ apply: false })
        if (!dryRun.success) throw new Error(dryRun.error || 'Dry run failed')

        const d = dryRun.data || {}
        const pendingMigrationCount = (d.migrated || 0) + (d.profileImagesEligible || 0)
        const confirm = await Swal.fire({
          title: pendingMigrationCount ? `${pendingMigrationCount} migration(s) ready` : 'Nothing to migrate',
          html: `<ul class="text-start mb-0 small"><li>Applications scanned: <strong>${d.scanned || 0}</strong></li><li>User demographics to migrate: <strong>${d.migrated || 0}</strong></li><li>Profile images to copy: <strong>${d.profileImagesEligible || 0}</strong></li><li>Profile images already migrated: <strong>${d.profileImagesAlreadySet || 0}</strong></li><li>Skipped: <strong>${(d.skipped || 0) + (d.profileImagesSkipped || 0)}</strong></li></ul>`,
          icon: pendingMigrationCount ? 'warning' : 'info',
          showCancelButton: true,
          confirmButtonText: pendingMigrationCount ? 'Apply Migration' : 'Close',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#0d6efd',
          customClass: { popup: 'utility-swal-popup' }
        })

        if (!confirm.isConfirmed || (!d.migrated && !d.profileImagesEligible)) return

        const apply = await apiService.migrateUserDemographics({ apply: true })
        if (!apply.success) throw new Error(apply.error || 'Migration failed')

        const a = apply.data || {}
        await Swal.fire({
          icon: 'success',
          title: 'Migration Complete',
          html: `<ul class="text-start mb-0 small"><li>Demographics migrated: <strong>${a.migrated || 0}</strong></li><li>Profile images copied: <strong>${a.profileImagesMigrated || 0}</strong></li><li>Profile images already migrated: <strong>${a.profileImagesAlreadySet || 0}</strong></li><li>Profile image failures: <strong>${a.profileImagesFailed || 0}</strong></li></ul>`,
          confirmButtonColor: '#1a5f5f'
        })
      } catch (error) {
        logger.error('User demographics migration failed:', error)
        await Swal.fire({ icon: 'error', title: 'Migration Failed', text: error.message || 'Unable to complete migration.' })
      } finally {
        this.isMigratingDemographics = false
      }
    },

    async runRepairAcademicSessions() {
      const result = await Swal.fire({
        title: 'Inspect Academic Sessions?',
        html: `<div class="text-start utility-confirmation"><p class="small text-muted mb-2">This utility checks for a legacy unique index on the academic session year field that blocks creating sessions with the same derived year. You may inspect results first, then choose to drop the index.</p></div>`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Run Check',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#0d6efd',
        customClass: { popup: 'utility-swal-popup' }
      })

      if (!result.isConfirmed) return

      try {
        this.isRepairingAcademicSessions = true
        const resp = await apiService.repairAcademicSessions({ apply: false })
        if (!resp.success) throw new Error(resp.error || 'Repair check failed')

        const data = resp.data || {}
        const dupCount = data.duplicateCount || 0
        const legacy = data.legacyIndexName || 'none'

        const confirmDrop = await Swal.fire({
          title: dupCount ? `Found ${dupCount} duplicate(s)` : 'No duplicates found',
          html: `<div class="text-start"><p class="small text-muted">Legacy index: <strong>${legacy}</strong></p><p class="small text-muted">Duplicates sample: ${data.duplicatesSample && data.duplicatesSample.length ? '<ul>' + data.duplicatesSample.map(d=>`<li>${d.sessionYear} — ${d.id}</li>`).join('') + '</ul>' : 'None'}</p></div>`,
          icon: dupCount ? 'warning' : 'info',
          showCancelButton: true,
          confirmButtonText: 'Drop Legacy Index',
          cancelButtonText: 'Keep Index',
          confirmButtonColor: '#dc3545',
          customClass: { popup: 'utility-swal-popup' }
        })

        if (confirmDrop.isConfirmed) {
          const applyResp = await apiService.repairAcademicSessions({ apply: true })
          if (!applyResp.success) throw new Error(applyResp.error || 'Failed to apply repair')

          await Swal.fire({
            icon: 'success',
            title: 'Legacy index dropped',
            html: `<div class="text-start small">Dropped: <strong>${applyResp.data?.dropped ? 'yes' : 'no'}</strong></div>`,
            confirmButtonColor: '#1a5f5f'
          })
        }

        await this.loadUtilityState()
      } catch (error) {
        logger.error('Academic session repair utility failed:', error)
        await Swal.fire({ icon: 'error', title: 'Repair Failed', text: error.message || 'Unable to complete repair.' })
      } finally {
        this.isRepairingAcademicSessions = false
      }
    }
  }
}
</script>

<template>
  <div class="utilities-page container-fluid py-4">
    <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
      <div>
        <h2 class="mb-1">Utilities</h2>
        <p class="text-muted mb-0">Operational tools for system checks, repair actions, and future maintenance utilities.</p>
      </div>

      <div class="d-flex flex-wrap gap-2 align-items-center">
        <label for="utilitySession" class="form-label mb-0 small text-muted">Academic Session</label>
        <select
          id="utilitySession"
          v-model="selectedAcademicSessionId"
          class="form-select session-select"
          @change="onYearChanged"
        >
          <option value="" disabled>Select Academic Session</option>
          <option v-for="session in academicSessions" :key="session._id" :value="session._id">
            {{ session.sessionYear }}
          </option>
        </select>
        <button class="btn btn-outline-secondary" :disabled="isLoading || isRepairingCounter || isRepairingProgramDrift || isBackfillingVerificationTokens" @click="loadUtilityState">
          <i class="bi bi-arrow-clockwise me-2"></i>
          Refresh
        </button>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-12 col-md-6 col-xl-3">
        <div class="summary-card card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small mb-1">Counter Health</div>
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="badge rounded-pill" :class="counterHealth.className">
                <i :class="counterHealth.icon" class="me-1"></i>{{ counterHealth.label }}
              </span>
            </div>
            <div class="summary-value">{{ currentSequence }}</div>
            <div class="text-muted small">Current counter sequence</div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-3">
        <div class="summary-card card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small mb-1">Highest Issued</div>
            <div class="summary-value">{{ highestSequence }}</div>
            <div class="text-muted small">Highest application sequence seen for {{ selectedSessionYear }}</div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-3">
        <div class="summary-card card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small mb-1">Applications</div>
            <div class="summary-value">{{ counterStats?.totalApplications || 0 }}</div>
            <div class="text-muted small">Total records found for the selected year</div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-3">
        <div class="summary-card card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small mb-1">Drift</div>
            <div class="summary-value">{{ sequenceDrift }}</div>
            <div class="text-muted small">Positive values mean the counter is behind</div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-4">
      <div v-for="utility in utilityCards" :key="utility.id" class="col-12 col-xl-6">
        <div class="card utility-card border-0 shadow-sm h-100">
          <div class="card-body d-flex flex-column">
            <div class="d-flex align-items-start justify-content-between gap-3 mb-3">
              <div class="d-flex gap-3 align-items-start">
                <div class="utility-icon" :class="`bg-${utility.variant}-subtle text-${utility.variant}`">
                  <i :class="['bi', utility.icon]"></i>
                </div>
                <div>
                  <h5 class="mb-1">{{ utility.title }}</h5>
                  <p class="text-muted mb-0">{{ utility.description }}</p>
                </div>
              </div>

              <span v-if="utility.id === 'application-counter-repair'" class="badge rounded-pill" :class="counterHealth.className">
                {{ counterHealth.label }}
              </span>
              <span v-else-if="utility.id === 'program-drift-repair'" class="badge rounded-pill" :class="programDriftHealth.className">
                <i :class="programDriftHealth.icon" class="me-1"></i>{{ programDriftHealth.label }}
              </span>
            </div>

            <div v-if="utility.id === 'application-counter-repair'" class="utility-details mb-4">
              <div class="row g-3">
                <div class="col-sm-6">
                  <div class="detail-box">
                    <div class="small text-muted">Counter record</div>
                    <div class="fw-semibold">{{ counterRecord?._id || counterStats?.counter?.id || 'Not found' }}</div>
                  </div>
                </div>
                <div class="col-sm-6">
                  <div class="detail-box">
                    <div class="small text-muted">Next sequence</div>
                    <div class="fw-semibold">{{ counterStats?.counter?.nextSequence || 1 }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else-if="utility.id === 'program-drift-repair'" class="utility-details mb-4">
              <div class="row g-3">
                <div class="col-sm-6">
                  <div class="detail-box">
                    <div class="small text-muted">Application Drift</div>
                    <div class="fw-semibold">{{ programDriftSummary?.applications?.drifted || 0 }}</div>
                  </div>
                </div>
                <div class="col-sm-6">
                  <div class="detail-box">
                    <div class="small text-muted">Student Drift</div>
                    <div class="fw-semibold">{{ programDriftSummary?.students?.drifted || 0 }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-auto d-flex flex-wrap gap-2">
              <button
                v-if="utility.id === 'repair-academic-sessions'"
                class="btn btn-info"
                :disabled="isLoading || isRepairingAcademicSessions || isRepairingCounter || isRepairingProgramDrift || isBackfillingVerificationTokens"
                @click="runRepairAcademicSessions"
              >
                <span v-if="isRepairingAcademicSessions" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-tools me-2"></i>
                {{ isRepairingAcademicSessions ? 'Working...' : utility.actionLabel }}
              </button>

              <button
                v-else-if="utility.id === 'application-counter-repair'"
                class="btn btn-primary"
                :disabled="isLoading || isRepairingCounter || isRepairingProgramDrift || isBackfillingVerificationTokens"
                @click="runCounterRepair"
              >
                <span v-if="isRepairingCounter" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-wrench-adjustable-circle me-2"></i>
                {{ isRepairingCounter ? 'Repairing...' : utility.actionLabel }}
              </button>

              <button
                v-else-if="utility.id === 'program-drift-repair'"
                class="btn btn-warning"
                :disabled="isLoading || isRepairingCounter || isRepairingProgramDrift || isBackfillingVerificationTokens"
                @click="runProgramDriftRepair"
              >
                <span v-if="isRepairingProgramDrift" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-diagram-3 me-2"></i>
                {{ isRepairingProgramDrift ? 'Repairing...' : utility.actionLabel }}
              </button>

              <button
                v-else-if="utility.id === 'public-verification-backfill'"
                class="btn btn-success"
                :disabled="isLoading || isRepairingCounter || isRepairingProgramDrift || isBackfillingVerificationTokens"
                @click="runPublicVerificationBackfill"
              >
                <span v-if="isBackfillingVerificationTokens" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-upc-scan me-2"></i>
                {{ isBackfillingVerificationTokens ? 'Generating...' : utility.actionLabel }}
              </button>

              <button
                v-else-if="utility.id === 'migrate-user-demographics'"
                class="btn btn-primary"
                :disabled="isLoading || isMigratingDemographics || isRepairingCounter || isRepairingProgramDrift || isBackfillingVerificationTokens"
                @click="runMigrateUserDemographics"
              >
                <span v-if="isMigratingDemographics" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-person-lines-fill me-2"></i>
                {{ isMigratingDemographics ? 'Migrating...' : utility.actionLabel }}
              </button>

              <button v-else class="btn btn-outline-secondary" disabled>
                <i class="bi bi-clock-history me-2"></i>
                {{ utility.actionLabel }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.year-input {
  width: 120px;
}

.session-select {
  max-width: 150px;
}

.summary-card,
.utility-card {
  border-radius: 1rem;
}

.summary-value {
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1.1;
}

.utility-icon {
  width: 80px;
  height: 50px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.9rem;
  font-size: 1.25rem;
}

.detail-box,
:deep(.utility-stat-card) {
  background: rgba(26, 95, 95, 0.06);
  border: 1px solid rgba(26, 95, 95, 0.08);
  border-radius: 0.9rem;
  padding: 0.9rem;
}

:deep(.utility-swal-popup) {
  border-radius: 1rem;
}
</style>
