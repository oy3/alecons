<template>
  <div class="id-card-generator p-5">

    <!-- Page header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1 class="h3 mb-0 fw-bold">ID Card Generator</h1>
        <p class="text-muted mb-0">Generate and export student &amp; staff ID cards</p>
      </div>
    </div>

    <!-- ── Filters panel ── -->
    <div class="card rounded-3 shadow-sm mb-4">
      <div class="card-body p-4">
        <h6 class="fw-bold mb-3">
          <i class="bi bi-funnel me-2 text-danger"></i>Select Person
        </h6>

        <div class="row g-3">

          <!-- User type -->
          <div class="col-12 col-md-3">
            <label class="form-label fw-semibold">User Type</label>
            <select class="form-select" v-model="filters.userType" @change="onUserTypeChange">
              <option value="">— Select type —</option>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
            </select>
          </div>

          <!-- ─ Student filters ─ -->
          <template v-if="filters.userType === 'student'">
            <div class="col-12 col-md-3">
              <label class="form-label fw-semibold">Program Type</label>
              <select class="form-select" v-model="filters.programTypeId" @change="onProgramTypeChange" :disabled="loadingFilters">
                <option value="">All Types</option>
                <option v-for="pt in programTypes" :key="pt._id" :value="pt._id">{{ pt.type }}</option>
              </select>
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label fw-semibold">Program Mode</label>
              <select class="form-select" v-model="filters.programModeId" @change="onProgramModeChange" :disabled="loadingFilters">
                <option value="">All Modes</option>
                <option v-for="pm in programModes" :key="pm._id" :value="pm._id">{{ pm.mode }}</option>
              </select>
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label fw-semibold">Program</label>
              <select class="form-select" v-model="filters.programId" @change="onProgramChange" :disabled="loadingFilters || !programs.length">
                <option value="">All Programs</option>
                <option v-for="p in programs" :key="p._id" :value="p._id">{{ p.name }}</option>
              </select>
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label fw-semibold">Year / Level</label>
              <select class="form-select" v-model="filters.level" @change="loadStudents" :disabled="!filters.programId">
                <option value="">All Levels</option>
                <option v-for="y in availableLevels" :key="y" :value="y">Year {{ y }}</option>
              </select>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label fw-semibold">Select Student</label>
              <select class="form-select" v-model="filters.selectedStudentId" @change="onStudentSelected" :disabled="loadingStudents">
                <option value="">— Choose student —</option>
                <option v-for="s in students" :key="s._id" :value="s._id">
                  {{ s.displayName }} ({{ s.matriculationNumber }})
                </option>
              </select>
              <div v-if="loadingStudents" class="form-text">
                <span class="spinner-border spinner-border-sm me-1"></span> Loading students…
              </div>
            </div>
          </template>

          <!-- ─ Staff filters ─ -->
          <template v-else-if="filters.userType === 'staff'">
            <div class="col-12 col-md-4">
              <label class="form-label fw-semibold">Department</label>
              <select class="form-select" v-model="filters.staffDepartment" @change="loadStaff" :disabled="loadingFilters">
                <option value="">All Departments</option>
                <option v-for="d in staffDepartments" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
            <div class="col-12 col-md-5">
              <label class="form-label fw-semibold">Select Staff</label>
              <select class="form-select" v-model="filters.selectedStaffId" @change="onStaffSelected" :disabled="loadingStaff">
                <option value="">— Choose staff member —</option>
                <option v-for="s in staffList" :key="s._id" :value="s._id">
                  {{ s.displayName }} — {{ s.position }}
                </option>
              </select>
              <div v-if="loadingStaff" class="form-text">
                <span class="spinner-border spinner-border-sm me-1"></span> Loading staff…
              </div>
            </div>
          </template>

          <div class="col-12 col-md-3 d-flex align-items-end">
            <button
              class="btn btn-danger w-100"
              :disabled="!canGeneratePreview"
              @click="generatePreview"
            >
              <span v-if="generatingPreview" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="bi bi-magic me-1"></i>
              Generate Preview
            </button>
          </div>

        </div><!-- /row -->
      </div>
    </div>

    <!-- ── Preview panel ── -->
    <template v-if="cardData">

      <!-- Token warning -->
      <div v-if="!cardData.publicVerificationToken" class="alert alert-danger d-flex align-items-center mb-3">
        <i class="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
        <div>
          <strong>Export blocked:</strong> This person does not have a public verification token.
          Run the backfill utility or generate a token before exporting.
        </div>
      </div>

      <!-- Generation log badge -->
      <div v-if="generationLog" class="alert alert-info d-flex align-items-center mb-3 py-2">
        <i class="bi bi-info-circle me-2"></i>
        <span>
          Card generated <strong>{{ generationLog.generationCount }}×</strong> —
          first on <strong>{{ formatDateDisplay(generationLog.firstGeneratedAt) }}</strong>,
          last on <strong>{{ formatDateDisplay(generationLog.lastGeneratedAt) }}</strong>.
        </span>
      </div>

      <!-- Card previews -->
      <div class="row g-4 mb-4">
        <!-- Front -->
        <div class="col-12 col-md-6 d-flex flex-column align-items-center">
          <h6 class="fw-bold mb-3 text-muted text-uppercase small letter-spacing-1">Front</h6>
          <StudentIdCardFront
            v-if="filters.userType === 'student'"
            :cardData="previewCardData"
            :dateOfIssue="exportOptions.dateOfIssue"
            :validUntil="exportOptions.validUntil"
            :scale="cardScale"
            :logoSrc="logoSrc"
            @update:photoOverride="onPhotoOverride"
          />
          <StaffIdCardFront
            v-else
            :cardData="previewCardData"
            :dateOfIssue="exportOptions.dateOfIssue"
            :dateOfBirth="exportOptions.dateOfBirth"
            :scale="cardScale"
            :logoSrc="logoSrc"
            @update:photoOverride="onPhotoOverride"
          />
        </div>

        <!-- Back -->
        <div class="col-12 col-md-6 d-flex flex-column align-items-center">
          <h6 class="fw-bold mb-3 text-muted text-uppercase small letter-spacing-1">Back</h6>
          <StudentIdCardBack
            v-if="filters.userType === 'student'"
            :cardData="previewCardData"
            :scale="cardScale"
            :logoSrc="logoSrc"
            :signatureSrc="signatureSrc"
          />
          <StaffIdCardBack
            v-else
            :cardData="previewCardData"
            :scale="cardScale"
            :logoSrc="logoSrc"
            :signatureSrc="signatureSrc"
          />
        </div>
      </div>

      <!-- ── Export options ── -->
      <div class="card rounded-3 shadow-sm mb-4">
        <div class="card-body p-4">
          <h6 class="fw-bold mb-3">
            <i class="bi bi-sliders me-2 text-danger"></i>Export Options
          </h6>

          <div class="form-check form-switch mb-3">
            <input
              id="true-size-preview-toggle"
              class="form-check-input"
              type="checkbox"
              :checked="previewMode === 'true-size'"
              @change="onPreviewModeToggle"
            />
            <label class="form-check-label" for="true-size-preview-toggle">
              True-size preview (matches export canvas scale)
            </label>
          </div>

          <div class="row g-3 mb-4">

            <!-- Date of issue -->
            <div class="col-12 col-md-4">
              <label class="form-label fw-semibold">Date of Issue</label>
              <input type="date" class="form-control" v-model="exportOptions.dateOfIssue" @change="onIssueDateChange" />
            </div>

            <!-- Valid until (student) -->
            <div v-if="filters.userType === 'student'" class="col-12 col-md-4">
              <label class="form-label fw-semibold">Valid Until</label>
              <input type="date" class="form-control" v-model="exportOptions.validUntil" />
            </div>

            <!-- Date of birth (staff) -->
            <div v-if="filters.userType === 'staff'" class="col-12 col-md-4">
              <label class="form-label fw-semibold">Date of Birth</label>
              <input type="date" class="form-control" v-model="exportOptions.dateOfBirth" />
            </div>

          </div>

          <!-- Missing field warnings -->
          <div v-if="exportBlockReasons.length" class="alert alert-warning py-2 mb-3">
            <strong>Export blocked:</strong>
            <ul class="mb-0 ps-3 mt-1">
              <li v-for="r in exportBlockReasons" :key="r">{{ r }}</li>
            </ul>
          </div>

          <!-- Export buttons -->
          <div class="d-flex flex-wrap gap-2">
            <button
              class="btn btn-outline-danger"
              :disabled="!canExport || exporting === 'front-png'"
              @click="doExport('front', 'png')"
            >
              <span v-if="exporting === 'front-png'" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="bi bi-image me-1"></i>
              Download Front (PNG)
            </button>
            <button
              class="btn btn-outline-danger"
              :disabled="!canExport || exporting === 'back-png'"
              @click="doExport('back', 'png')"
            >
              <span v-if="exporting === 'back-png'" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="bi bi-image me-1"></i>
              Download Back (PNG)
            </button>
            <button
              class="btn btn-danger"
              :disabled="!canExport || exporting === 'pdf'"
              @click="doExportPdf"
            >
              <span v-if="exporting === 'pdf'" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="bi bi-file-earmark-pdf me-1"></i>
              Download PDF (Both Sides)
            </button>
          </div>

        </div>
      </div>

      <div class="export-stage" aria-hidden="true">
        <div ref="frontExportNode" class="export-card-node">
          <StudentIdCardFront
            v-if="filters.userType === 'student'"
            :cardData="previewCardData"
            :dateOfIssue="exportOptions.dateOfIssue"
            :validUntil="exportOptions.validUntil"
            :scale="1"
            :logoSrc="logoSrc"
          />
          <StaffIdCardFront
            v-else
            :cardData="previewCardData"
            :dateOfIssue="exportOptions.dateOfIssue"
            :dateOfBirth="exportOptions.dateOfBirth"
            :scale="1"
            :logoSrc="logoSrc"
          />
        </div>

        <div ref="backExportNode" class="export-card-node">
          <StudentIdCardBack
            v-if="filters.userType === 'student'"
            :cardData="previewCardData"
            :scale="1"
            :logoSrc="logoSrc"
            :signatureSrc="signatureSrc"
          />
          <StaffIdCardBack
            v-else
            :cardData="previewCardData"
            :scale="1"
            :logoSrc="logoSrc"
            :signatureSrc="signatureSrc"
          />
        </div>
      </div>

    </template>

    <!-- Empty state -->
    <div v-else-if="filters.userType" class="text-center py-5 text-muted">
      <i class="bi bi-person-badge fs-1 d-block mb-2 opacity-25"></i>
      <p class="mb-0">Select a {{ filters.userType }} and click Generate Preview.</p>
    </div>

  </div>
</template>

<script>
import Swal from 'sweetalert2'
import { useAuthStore } from '../../stores/auth.js'
import { apiService } from '../../services/api.js'
import { logger } from '@shared/utils/logger'
import StudentIdCardFront from './components/StudentIdCardFront.vue'
import StudentIdCardBack from './components/StudentIdCardBack.vue'
import StaffIdCardFront from './components/StaffIdCardFront.vue'
import StaffIdCardBack from './components/StaffIdCardBack.vue'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import logoAsset from '@shared/assets/logo.png'
import signatureAsset from '@shared/assets/provost-sign.png'

const ID_CARD_PREVIEW_SCALE = {
  fit: 0.52,
  trueSize: 1,
}

const today = () => new Date().toISOString().slice(0, 10)
const addYears = (dateStr, years) => {
  const d = new Date(dateStr)
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().slice(0, 10)
}

export default {
  name: 'IdCardGenerator',

  components: { StudentIdCardFront, StudentIdCardBack, StaffIdCardFront, StaffIdCardBack },

  setup() {
    return { authStore: useAuthStore() }
  },

  data() {
    return {
      // Filters
      filters: {
        userType: '',
        programTypeId: '',
        programModeId: '',
        programId: '',
        level: '',
        selectedStudentId: '',
        staffDepartment: '',
        selectedStaffId: '',
      },

      // Filter options
      programTypes: [],
      programModes: [],
      programs: [],
      staffDepartments: [],
      students: [],
      staffList: [],

      // Loading states
      loadingFilters: false,
      loadingStudents: false,
      loadingStaff: false,

      // Card state
      cardData: null,
      generationLog: null,
      photoOverrideDataUrl: null,
      generatingPreview: false,

      // Export options
      exportOptions: {
        dateOfIssue: today(),
        validUntil: addYears(today(), 4),
        dateOfBirth: '',
      },

      // Export state
      exporting: null,    // 'front-png' | 'back-png' | 'pdf' | null

      // Preview behavior
      previewMode: 'fit', // 'fit' | 'true-size'

      // Assets (loaded as data URLs for preview)
      logoSrc: logoAsset,
      signatureSrc: signatureAsset,
    }
  },

  computed: {
    cardScale() {
      return this.previewMode === 'true-size'
        ? ID_CARD_PREVIEW_SCALE.trueSize
        : ID_CARD_PREVIEW_SCALE.fit
    },

    availableLevels() {
      if (!this.filters.programId) return []
      const prog = this.programs.find(p => p._id === this.filters.programId)
      if (!prog?.durationYears) return []
      return Array.from({ length: prog.durationYears }, (_, i) => i + 1)
    },

    previewCardData() {
      if (!this.cardData) return null
      return {
        ...this.cardData,
        photoUrl: this.photoOverrideDataUrl || this.cardData.photoUrl || null,
      }
    },

    canGeneratePreview() {
      const selectedId = this.filters.userType === 'student'
        ? this.filters.selectedStudentId
        : this.filters.selectedStaffId
      return Boolean(this.filters.userType && selectedId && !this.generatingPreview)
    },

    exportBlockReasons() {
      const r = []
      if (!this.cardData) return r
      if (!this.cardData.publicVerificationToken) {
        r.push('Public verification token is missing for this person.')
      }
      if (!this.exportOptions.dateOfIssue) {
        r.push('Date of issue is required.')
      }
      if (this.filters.userType === 'student' && !this.exportOptions.validUntil) {
        r.push('Valid until date is required.')
      }
      return r
    },

    canExport() {
      return this.exportBlockReasons.length === 0 && !this.exporting
    },

    filenamePrefix() {
      if (!this.cardData) return 'id-card'
      return this.filters.userType === 'student'
        ? (this.cardData.matricNumber ?? this.filters.selectedStudentId)
        : (this.cardData.staffId ?? this.filters.selectedStaffId)
    },
  },

  async mounted() {
    await this.authStore.initialize()
    if (!this.authStore.hasModuleAccess('idCards')) {
      await Swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'You do not have permission to access ID card generation.',
        confirmButtonColor: '#8B1515',
      })
      this.$router.push('/dashboard')
      return
    }
    logger.info('ID Card Generator mounted')
  },

  methods: {

    // ── Filter change handlers ──────────────────────────────────────────────

    async onUserTypeChange() {
      this.resetFilters()
      this.cardData = null
      this.generationLog = null
      if (this.filters.userType === 'student') {
        await this.loadStudentFilters()
      } else if (this.filters.userType === 'staff') {
        await this.loadStaffFilters()
      }
    },

    async loadStudentFilters() {
      this.loadingFilters = true
      try {
        const [typesRes, modesRes, progsRes] = await Promise.all([
          apiService.getIdCardProgramTypes(),
          apiService.getIdCardProgramModes(),
          apiService.getIdCardPrograms(),
        ])
        this.programTypes = typesRes.data ?? []
        this.programModes = modesRes.data ?? []
        this.programs = progsRes.data ?? []
        await this.loadStudents()
      } catch (err) {
        logger.error('Failed to load student filters', err)
      } finally {
        this.loadingFilters = false
      }
    },

    async loadStaffFilters() {
      this.loadingFilters = true
      try {
        const res = await apiService.getIdCardStaffDepartments()
        this.staffDepartments = res.data ?? []
        await this.loadStaff()
      } catch (err) {
        logger.error('Failed to load staff filters', err)
      } finally {
        this.loadingFilters = false
      }
    },

    async onProgramTypeChange() {
      this.filters.programId = ''
      this.filters.level = ''
      await this.reloadPrograms()
      await this.loadStudents()
    },

    async onProgramModeChange() {
      this.filters.programId = ''
      this.filters.level = ''
      await this.reloadPrograms()
      await this.loadStudents()
    },

    async reloadPrograms() {
      this.loadingFilters = true
      try {
        const res = await apiService.getIdCardPrograms({
          programTypeId: this.filters.programTypeId || undefined,
          programModeId: this.filters.programModeId || undefined,
        })
        this.programs = res.data ?? []
      } catch (err) {
        logger.error('Failed to load programs', err)
      } finally {
        this.loadingFilters = false
      }
    },

    async onProgramChange() {
      this.filters.level = ''
      await this.loadStudents()
    },

    async loadStudents() {
      this.loadingStudents = true
      this.students = []
      try {
        const res = await apiService.getIdCardStudents({
          programId: this.filters.programId || undefined,
          level: this.filters.level || undefined,
        })
        this.students = res.data ?? []
      } catch (err) {
        logger.error('Failed to load students', err)
      } finally {
        this.loadingStudents = false
      }
    },

    async loadStaff() {
      this.loadingStaff = true
      this.staffList = []
      try {
        const res = await apiService.getIdCardStaff({
          department: this.filters.staffDepartment || undefined,
        })
        this.staffList = res.data ?? []
      } catch (err) {
        logger.error('Failed to load staff', err)
      } finally {
        this.loadingStaff = false
      }
    },

    // ── Selection handlers ──────────────────────────────────────────────────

    async onStudentSelected() {
      this.cardData = null
      this.generationLog = null
      if (!this.filters.selectedStudentId) {
        return
      }
      this.photoOverrideDataUrl = null
    },

    async onStaffSelected() {
      this.cardData = null
      this.generationLog = null
      if (!this.filters.selectedStaffId) {
        return
      }
      this.photoOverrideDataUrl = null
    },

    async generatePreview() {
      if (!this.canGeneratePreview) return

      const entityType = this.filters.userType
      const entityId = entityType === 'student'
        ? this.filters.selectedStudentId
        : this.filters.selectedStaffId

      this.generatingPreview = true
      try {
        await this.fetchCardData(entityType, entityId)
        const generateRes = await apiService.generateIdCard(entityType, entityId)
        this.generationLog = generateRes?.data ?? this.generationLog
      } catch (err) {
        logger.error('ID card preview generation failed', err)
        Swal.fire('Generation Failed', err.message || 'Failed to generate ID card preview.', 'error')
      } finally {
        this.generatingPreview = false
      }
    },

    async fetchCardData(type, id) {
      try {
        const res = type === 'student'
          ? await apiService.getStudentCardPreviewData(id)
          : await apiService.getStaffCardPreviewData(id)
        this.cardData = res.data
        this.photoOverrideDataUrl = null

        // Load generation log
        if (this.cardData?.userId) {
          const logRes = await apiService.getIdCardGenerationLog(this.cardData.userId)
          this.generationLog = logRes.data
        }
      } catch (err) {
        logger.error(`Failed to load ${type} card data`, err)
        Swal.fire('Error', err.message || `Failed to load ${type} card data.`, 'error')
        this.cardData = null
      }
    },

    // ── Export date handling ─────────────────────────────────────────────────

    onIssueDateChange() {
      if (this.filters.userType === 'student' && this.exportOptions.dateOfIssue) {
        this.exportOptions.validUntil = addYears(this.exportOptions.dateOfIssue, 4)
      }
    },

    onPreviewModeToggle(event) {
      this.previewMode = event?.target?.checked ? 'true-size' : 'fit'
    },

    // ── Photo override ───────────────────────────────────────────────────────

    onPhotoOverride(dataUrl) {
      this.photoOverrideDataUrl = dataUrl
      logger.info('Photo override set from file picker')
    },

    // ── Export ───────────────────────────────────────────────────────────────

    async doExport(side, format) {
      if (!this.canExport) return
      const key = `${side}-${format}`
      this.exporting = key
      try {
        if (format === 'png') {
          await this.exportPng(side)
        }
      } catch (err) {
        logger.error('ID card export failed', err)
        Swal.fire('Export Failed', err.message || 'Failed to export ID card.', 'error')
      } finally {
        this.exporting = null
      }
    },

    async doExportPdf() {
      if (!this.canExport) return
      this.exporting = 'pdf'
      try {
        await this.exportPdfBothSides()
      } catch (err) {
        logger.error('PDF export failed', err)
        Swal.fire('Export Failed', err.message || 'Failed to export PDF.', 'error')
      } finally {
        this.exporting = null
      }
    },

    async exportPng(side) {
      const node = side === 'front' ? this.$refs.frontExportNode : this.$refs.backExportNode
      const canvas = await this.captureExportNode(node)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Failed to generate PNG export.')
      const fileName = `${this.filenamePrefix}-id-card-${side}.png`
      this.downloadBlob(blob, fileName)
    },

    async exportPdfBothSides() {
      const frontCanvas = await this.captureExportNode(this.$refs.frontExportNode)
      const backCanvas = await this.captureExportNode(this.$refs.backExportNode)

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 12
      const gap = 10

      const cardRatio = frontCanvas.width / frontCanvas.height
      const maxCardH = pageH - (margin * 2)
      const cardH = maxCardH
      const cardW = cardH * cardRatio
      const totalW = (cardW * 2) + gap
      const startX = (pageW - totalW) / 2
      const y = (pageH - cardH) / 2

      pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', startX, y, cardW, cardH)
      pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', startX + cardW + gap, y, cardW, cardH)
      pdf.save(`${this.filenamePrefix}-id-card.pdf`)
    },

    async captureExportNode(node) {
      if (!node) throw new Error('Export surface not ready.')
      logger.info('[Export] captureExportNode start', {
        nodeTag: node.tagName,
        nodeWidth: node.offsetWidth,
        nodeHeight: node.offsetHeight,
        imgCount: node.querySelectorAll('img').length,
      })
      await this.waitForExportAssets(node)
      await this.convertImagesToDataUrls(node)

      // Log final state of all images before html2canvas
      const finalImgs = Array.from(node.querySelectorAll('img'))
      finalImgs.forEach((img, i) => {
        logger.info(`[Export] img[${i}] before html2canvas`, {
          src: img.src?.substring(0, 80),
          isDataUrl: img.src?.startsWith('data:'),
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          complete: img.complete,
          display: window.getComputedStyle(img).display,
          visibility: window.getComputedStyle(img).visibility,
        })
      })

      return html2canvas(node, {
        allowTaint: false,
        useCORS: true,
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        onclone: (clonedDoc, clonedNode) => {
          // Ensure SVGs have explicit dimensions for proper rendering
          const originalSvgs = node.querySelectorAll('svg')
          const clonedSvgs = clonedNode.querySelectorAll('svg')
          
          originalSvgs.forEach((originalSvg, index) => {
            const clonedSvg = clonedSvgs[index]
            if (clonedSvg) {
              const rect = originalSvg.getBoundingClientRect()
              clonedSvg.setAttribute('width', rect.width)
              clonedSvg.setAttribute('height', rect.height)
              // Preserve viewBox if it exists
              if (originalSvg.hasAttribute('viewBox')) {
                clonedSvg.setAttribute('viewBox', originalSvg.getAttribute('viewBox'))
              }
            }
          })
        }
      })
    },

    async waitForExportAssets(node) {
      if (document.fonts?.ready) {
        await document.fonts.ready
      }

      const images = Array.from(node.querySelectorAll('img'))
      logger.info('[Export] waitForExportAssets', { imageCount: images.length })
      images.forEach((img, i) => {
        logger.info(`[Export] waitForAssets img[${i}]`, {
          src: img.src?.substring(0, 80),
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        })
      })

      await Promise.all(images.map((img, i) => {
        if (img.complete && img.naturalWidth > 0) {
          logger.info(`[Export] img[${i}] already loaded OK`)
          if (img.decode) return img.decode().catch(() => {})
          return Promise.resolve()
        }
        logger.info(`[Export] img[${i}] forcing reload (complete=${img.complete}, naturalWidth=${img.naturalWidth})`)
        // Force reload if image was not properly loaded (e.g. was in hidden container)
        return new Promise((resolve) => {
          img.onload = () => {
            logger.info(`[Export] img[${i}] reload onload (naturalWidth=${img.naturalWidth})`)
            resolve()
          }
          img.onerror = (err) => {
            logger.error(`[Export] img[${i}] reload onerror`, err)
            resolve()
          }
          if (img.src) {
            const src = img.src
            img.src = ''
            img.src = src
          }
        })
      }))
    },

    async convertImagesToDataUrls(node) {
      const images = Array.from(node.querySelectorAll('img'))
      logger.info('[Export] convertImagesToDataUrls', { imageCount: images.length })
      await Promise.all(images.map(async (img, i) => {
        const originalSrc = img.src
        // Skip if already a data URL
        if (img.src.startsWith('data:')) {
          logger.info(`[Export] img[${i}] already data URL, skipping`)
          return
        }

        logger.info(`[Export] img[${i}] converting`, { src: originalSrc?.substring(0, 100) })
        try {
          const dataUrl = await this.imageToDataUrl(img)
          if (dataUrl) {
            img.src = dataUrl
            logger.info(`[Export] img[${i}] converted OK (length=${dataUrl.length})`)
          } else {
            logger.warn(`[Export] img[${i}] imageToDataUrl returned null`)
          }
        } catch (err) {
          logger.error(`[Export] img[${i}] FAILED to convert`, { src: originalSrc?.substring(0, 100), error: err.message })
        }
      }))
    },

    async imageToDataUrl(img) {
      const src = img.src
      if (!src) {
        logger.warn('[Export] imageToDataUrl called with no src')
        return null
      }

      logger.info('[Export] imageToDataUrl fetching', { src: src.substring(0, 100) })
      // Fetch the image as blob and convert to data URL.
      // This avoids canvas taint issues with cross-origin images.
      const res = await fetch(src)
      if (!res.ok) {
        logger.error('[Export] imageToDataUrl fetch failed', { status: res.status, statusText: res.statusText })
        throw new Error(`Failed to fetch image: ${res.status}`)
      }
      const blob = await res.blob()
      logger.info('[Export] imageToDataUrl blob received', { type: blob.type, size: blob.size })

      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          logger.info('[Export] imageToDataUrl FileReader done', { resultLength: reader.result?.length })
          resolve(reader.result)
        }
        reader.onerror = () => {
          logger.error('[Export] imageToDataUrl FileReader error')
          reject(new Error('Failed to read image blob'))
        }
        reader.readAsDataURL(blob)
      })
    },

    downloadBlob(blob, fileName) {
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    },

    // ── Utilities ────────────────────────────────────────────────────────────

    resetFilters() {
      Object.assign(this.filters, {
        programTypeId: '',
        programModeId: '',
        programId: '',
        level: '',
        selectedStudentId: '',
        staffDepartment: '',
        selectedStaffId: '',
      })
      this.students = []
      this.staffList = []
      this.programTypes = []
      this.programModes = []
      this.programs = []
      this.staffDepartments = []
      this.photoOverrideDataUrl = null
      this.generatingPreview = false
      this.cardData = null
      this.generationLog = null
      this.exportOptions.dateOfIssue = today()
      this.exportOptions.validUntil = addYears(today(), 4)
      this.exportOptions.dateOfBirth = ''
    },

    formatDateDisplay(iso) {
      if (!iso) return '—'
      try {
        return new Date(iso).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        })
      } catch {
        return iso
      }
    },
  },
}
</script>

<style scoped>
.id-card-generator {
  padding: 0 0 3rem;
}

/* Make previews scroll horizontally on small screens */
.preview-scroll {
  overflow-x: auto;
}

.export-stage {
  position: fixed;
  top: 0;
  left: -9999px;
  width: 540px;
  height: 856px;
  pointer-events: none;
  opacity: 0;
}

.export-card-node {
  width: 540px;
  height: 856px;
}
</style>
