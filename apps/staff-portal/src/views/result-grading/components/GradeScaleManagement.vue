<script>
import { apiService } from '../../../services/api.js'

export default {
  name: 'GradeScaleManagement',
  data() {
    return { scales: [], loading: false, showForm: false, saving: false, form: { name: '', gpaScale: 4, bands: [] } }
  },
  computed: {
    orderedBands() { return [...this.form.bands].sort((a, b) => Number(a.minScore) - Number(b.minScore)) },
    hasValidBands() {
      const bands = this.orderedBands
      if (!bands.length || Number(bands[0]?.minScore) !== 0 || Number(bands.at(-1)?.maxScore) !== 100) return false
      return bands.every((band, index) => band.letter?.trim() && Number(band.minScore) <= Number(band.maxScore) && Number(band.gradePoint) >= 0 && Number(band.gradePoint) <= Number(this.form.gpaScale) && (index === 0 || Number(band.minScore) === Number(bands[index - 1].maxScore) + 1))
    },
  },
  async mounted() { await this.load() },
  methods: {
    async load() {
      this.loading = true
      try {
        const scales = await apiService.getAcademicResultGradeScales()
        this.scales = scales.data || []
      } catch (error) { this.$swal.fire('Could not load grade scales', error.message || 'Please try again.', 'error') }
      finally { this.loading = false }
    },
    openForm() { this.form = { name: '', gpaScale: 4, bands: [] }; this.showForm = true },
    useAleconsDefault() { this.form.bands = [['F', 0, 29, 0, false], ['E', 30, 39, 0.5, false], ['D', 40, 49, 1, false], ['C', 50, 59, 2, true], ['B', 60, 69, 3, true], ['A', 70, 100, 4, true]].map(([letter, minScore, maxScore, gradePoint, isPass], index) => ({ letter, minScore, maxScore, gradePoint, isPass, displayOrder: index + 1 })) },
    addBand() { const previous = this.orderedBands.at(-1); const minScore = previous ? Number(previous.maxScore) + 1 : 0; if (minScore > 100) return; this.form.bands.push({ letter: '', minScore, maxScore: minScore, gradePoint: 0, isPass: false, displayOrder: this.form.bands.length + 1 }) },
    removeBand(index) { this.form.bands.splice(index, 1); this.form.bands.forEach((band, bandIndex) => { band.displayOrder = bandIndex + 1 }) },
    async save() {
      if (!this.form.name.trim() || !this.hasValidBands) return
      this.saving = true
      try { await apiService.createAcademicResultGradeScale({ ...this.form, status: 'draft', bands: this.orderedBands }); this.showForm = false; await this.load(); this.$swal.fire('Draft created', 'Review the ranges, then activate this version when it should apply to new results.', 'success') }
      catch (error) { this.$swal.fire('Could not save grade scale', error.message || 'Please try again.', 'error') }
      finally { this.saving = false }
    },
    async setStatus(scale, status) {
      const activating = status === 'active'
      const confirmation = await this.$swal.fire({
        title: activating ? `Activate ${scale.name}?` : `Retire ${scale.name}?`,
        text: activating ? 'The currently active scale will be retired. Existing results keep their original scale snapshot.' : 'New results cannot be created until another scale is active.',
        icon: 'warning', showCancelButton: true, confirmButtonText: activating ? 'Activate' : 'Retire',
      })
      if (!confirmation.isConfirmed) return
      try { await apiService.updateAcademicResultGradeScaleStatus(scale._id, status); await this.load(); this.$swal.fire(activating ? 'Grade scale activated' : 'Grade scale retired', '', 'success') }
      catch (error) { this.$swal.fire('Could not update grade scale', error.message || 'Please try again.', 'error') }
    },
  },
}
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-1">Grade Scales</h5><p class="text-muted mb-0">Versioned grade policies are preserved with the results that use them.</p></div><button class="btn btn-staff-primary" @click="openForm"><i class="bi bi-plus-lg me-1"></i>New Grade Scale</button></div>
    <div class="card border-0 shadow-sm p-0"><div class="table-responsive"><table class="table align-middle mb-0"><thead class="table-light"><tr><th>Name</th><th>GPA Scale</th><th>Version</th><th>Status</th><th>Ranges</th><th class="text-end">Action</th></tr></thead><tbody><tr v-for="scale in scales" :key="scale._id"><td class="fw-semibold">{{ scale.name }}</td><td>{{ Number(scale.gpaScale).toFixed(1) }}</td><td>v{{ scale.version }}</td><td><span class="badge" :class="scale.status === 'active' ? 'text-bg-success' : 'text-bg-secondary'">{{ scale.status }}</span></td><td>{{ scale.bands.map((band) => `${band.letter}: ${band.minScore}-${band.maxScore}`).join(' · ') }}</td><td class="text-end"><button v-if="scale.status !== 'active'" class="btn btn-sm btn-outline-success" @click="setStatus(scale, 'active')">Activate</button><span v-else class="small text-success fw-semibold"><i class="bi bi-check-circle me-1"></i>Current</span></td></tr><tr v-if="!loading && !scales.length"><td colspan="6" class="text-center text-muted py-4">No grade scales configured.</td></tr></tbody></table></div></div>
    <div v-if="showForm" class="modal d-block" tabindex="-1" role="dialog" aria-modal="true"><div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">New Grade Scale</h5><button type="button" class="btn-close" @click="showForm = false"></button></div><div class="modal-body"><div class="row g-3 mb-3"><div class="col-md-8"><label class="form-label">Name</label><input v-model.trim="form.name" class="form-control" placeholder="e.g. ALECONS 4.0 Scale"></div><div class="col-md-4"><label class="form-label">GPA Scale</label><input v-model.number="form.gpaScale" class="form-control" type="number" min="0.1" max="10" step="0.1"></div></div><div class="d-flex justify-content-between align-items-center mb-2"><div><span class="fw-semibold">Grade bands</span><small class="text-muted ms-2">Must cover 0-100 without gaps or overlaps.</small></div><div class="d-flex gap-2"><button class="btn btn-sm btn-outline-secondary" @click="useAleconsDefault">Use ALECONS default</button><button class="btn btn-sm btn-outline-primary" title="Add grade band" @click="addBand"><i class="bi bi-plus-lg"></i></button></div></div><div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Letter</th><th>Minimum</th><th>Maximum</th><th>Grade Point</th><th>Pass</th><th></th></tr></thead><tbody><tr v-for="(band, index) in form.bands" :key="band.displayOrder"><td><input v-model.trim="band.letter" class="form-control form-control-sm" maxlength="4"></td><td><input v-model.number="band.minScore" class="form-control form-control-sm" type="number" min="0" max="100"></td><td><input v-model.number="band.maxScore" class="form-control form-control-sm" type="number" min="0" max="100"></td><td><input v-model.number="band.gradePoint" class="form-control form-control-sm" type="number" min="0" :max="form.gpaScale" step="0.1"></td><td class="text-center"><input v-model="band.isPass" class="form-check-input" type="checkbox"></td><td><button class="btn btn-sm btn-outline-danger" title="Remove grade band" @click="removeBand(index)"><i class="bi bi-trash"></i></button></td></tr></tbody></table></div><div class="small" :class="hasValidBands ? 'text-success' : 'text-danger'"><i class="bi me-1" :class="hasValidBands ? 'bi-check-circle' : 'bi-exclamation-circle'"></i>{{ hasValidBands ? 'Ranges are valid and cover 0-100.' : 'Add contiguous ranges from 0 through 100 before activation.' }}</div></div><div class="modal-footer"><button class="btn btn-outline-secondary" @click="showForm = false">Cancel</button><button class="btn btn-staff-primary" :disabled="saving || !form.name || !hasValidBands" @click="save">Save Draft</button></div></div></div></div><div v-if="showForm" class="modal-backdrop show"></div>
  </div>
</template>
