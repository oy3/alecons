<template>
  <div 
    class="modal fade" 
    :class="{ show: show }" 
    :style="{ display: show ? 'block' : 'none' }" 
    tabindex="-1"
  >
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi bi-graph-up me-2"></i>
            Exam Statistics
          </h5>
          <button type="button" class="btn-close" @click="close"></button>
        </div>
        
        <div class="modal-body">
          <div v-if="isLoading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-3">Loading statistics...</p>
          </div>
          
          <div v-else>
            <!-- Statistics content -->
            <div class="text-center py-5">
              <i class="bi bi-graph-up text-muted" style="font-size: 4rem;"></i>
              <h4 class="text-muted mt-3">Exam Statistics</h4>
              <p class="text-muted">Detailed statistics will be displayed here.</p>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="close">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ExamStatisticsModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    exam: {
      type: Object,
      default: null
    }
  },
  emits: ['close'],
  data() {
    return {
      isLoading: false
    }
  },
  methods: {
    close() {
      this.$emit('close')
    }
  }
}
</script>

<style scoped>
.modal.show {
  background: rgba(0, 0, 0, 0.5);
}
</style>