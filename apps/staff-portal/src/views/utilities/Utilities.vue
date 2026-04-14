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
      isRepairing: false,
      counterStats: null,
      counterRecord: null,
      utilityCards: [
        {
          id: 'application-counter-repair',
          title: 'Application Counter Repair',
          icon: 'bi-hammer',
          variant: 'primary',
          description: 'Inspect the application counter for the selected year and repair it when the stored sequence falls behind the highest issued application number.',
          actionLabel: 'Repair Counter'
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

        const [statsResponse, counterResponse] = await Promise.all([
          apiService.getApplicationNumberStats(this.selectedYear),
          apiService.getApplicationCounterStatus({ academicSessionId: this.selectedAcademicSessionId })
        ])

        if (!statsResponse.success) {
          throw new Error(statsResponse.error || 'Failed to load application number stats')
        }

        if (!counterResponse.success) {
          throw new Error(counterResponse.error || 'Failed to load counter status')
        }

        this.counterStats = statsResponse.data
        this.counterRecord = counterResponse.data

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
        this.isRepairing = true
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
        this.isRepairing = false
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
        <button class="btn btn-outline-secondary" :disabled="isLoading || isRepairing" @click="loadUtilityState">
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

            <div class="mt-auto d-flex flex-wrap gap-2">
              <button
                v-if="utility.id === 'application-counter-repair'"
                class="btn btn-primary"
                :disabled="isLoading || isRepairing"
                @click="runCounterRepair"
              >
                <span v-if="isRepairing" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-wrench-adjustable-circle me-2"></i>
                {{ isRepairing ? 'Repairing...' : utility.actionLabel }}
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