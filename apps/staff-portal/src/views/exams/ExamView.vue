<script>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiService } from '../../services/api'
import { logger } from '@shared/utils/logger'
import Swal from 'sweetalert2'

export default {
  name: 'ExamView',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const exam = ref(null)
    const loading = ref(true)
    const error = ref(null)

    const loadExam = async () => {
      try {
        loading.value = true
        error.value = null
        const response = await apiService.getExam(route.params.id)
        
        if (response.success) {
          exam.value = response.exam
        } else {
          error.value = 'Failed to load exam details'
        }
      } catch (err) {
        logger.error('Error loading exam:', err)
        error.value = err.message || 'An error occurred while loading the exam'
      } finally {
        loading.value = false
      }
    }

    const formatDate = (date) => {
      if (!date) return 'N/A'
      return new Date(date).toLocaleString()
    }

    const getStatusBadgeClass = (status) => {
      const classes = {
        draft: 'badge bg-secondary',
        published: 'badge bg-success',
        active: 'badge bg-primary',
        completed: 'badge bg-info',
        cancelled: 'badge bg-danger'
      }
      return classes[status] || 'badge bg-secondary'
    }

    const goBack = () => {
      router.push('/exams')
    }

    const editExam = () => {
      // TODO: Implement edit functionality
      Swal.fire({
        title: 'Edit Exam',
        text: 'This feature is coming soon!',
        icon: 'info'
      })
    }

    const manageQuestions = () => {
      // TODO: Implement questions management
      Swal.fire({
        title: 'Manage Questions',
        text: 'This feature is coming soon!',
        icon: 'info'
      })
    }

    const viewResults = () => {
      // TODO: Implement results view
      Swal.fire({
        title: 'View Results',
        text: 'This feature is coming soon!',
        icon: 'info'
      })
    }

    onMounted(() => {
      loadExam()
    })

    return {
      exam,
      loading,
      error,
      formatDate,
      getStatusBadgeClass,
      goBack,
      editExam,
      manageQuestions,
      viewResults
    }
  }
}
</script>

<template>
  <div class="exam-view">
    <div class="container-fluid">
      <div class="row">
        <div class="col-12">
          <div class="card p-0">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h4 class="card-title">{{ exam?.title || 'Loading...' }}</h4>
              <button class="btn btn-secondary" @click="goBack">
                <i class="bi bi-arrow-left"></i> Back to Exams
              </button>
            </div>
            <div class="card-body">
              <div v-if="loading" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>
              <div v-else-if="error" class="alert alert-danger">
                {{ error }}
              </div>
              <div v-else>
                <div class="row mb-4">
                  <div class="col-md-6">
                    <h5>Exam Details</h5>
                    <table class="table">
                      <tbody>
                        <tr>
                          <th>Description:</th>
                          <td>{{ exam.description }}</td>
                        </tr>
                        <tr>
                          <th>Academic Session:</th>
                          <td>{{ exam.academicSession?.sessionYear || 'N/A' }}</td>
                        </tr>
                        <tr>
                          <th>Date:</th>
                          <td>{{ formatDate(exam.examTimestamp) }}</td>
                        </tr>
                        <tr>
                          <th>Duration:</th>
                          <td>{{ exam.duration }} minutes</td>
                        </tr>
                        <tr>
                          <th>Total Questions:</th>
                          <td>{{ exam.totalQuestions }}</td>
                        </tr>
                        <tr>
                          <th>Total Mark:</th>
                          <td>{{ exam.totalMark }}</td>
                        </tr>
                        <tr>
                          <th>Cut Off Mark:</th>
                          <td>{{ exam.cutOffMark }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="col-md-6">
                    <h5>Settings</h5>
                    <table class="table">
                      <tbody>
                        <tr>
                          <th>Status:</th>
                          <td>
                            <span :class="getStatusBadgeClass(exam.status)">
                              {{ exam.status }}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <th>Target:</th>
                          <td>{{ exam.target?.type || 'N/A' }}</td>
                        </tr>
                        <tr>
                          <th>Attempt Limit:</th>
                          <td>{{ exam.attemptLimit }}</td>
                        </tr>
                        <tr>
                          <th>Grading Mode:</th>
                          <td>{{ exam.gradingMode }}</td>
                        </tr>
                        <tr>
                          <th>Allow Resume:</th>
                          <td>{{ exam.allowResume ? 'Yes' : 'No' }}</td>
                        </tr>
                        <tr>
                          <th>Proctored:</th>
                          <td>{{ exam.proctored ? 'Yes' : 'No' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div class="mt-4">
                  <h5>Security Settings</h5>
                  <table class="table">
                    <tbody>
                      <tr>
                        <th>Disable Right Click:</th>
                        <td>{{ exam.securitySettings?.disableRightClick ? 'Yes' : 'No' }}</td>
                        <th>Disable Copy:</th>
                        <td>{{ exam.securitySettings?.disableCopy ? 'Yes' : 'No' }}</td>
                      </tr>
                      <tr>
                        <th>Full Screen Required:</th>
                        <td>{{ exam.securitySettings?.fullScreenRequired ? 'Yes' : 'No' }}</td>
                        <th>Tab Switch Limit:</th>
                        <td>{{ exam.securitySettings?.tabSwitchLimit || 'N/A' }}</td>
                      </tr>
                      <tr>
                        <th>Blur Limit:</th>
                        <td>{{ exam.securitySettings?.blurLimit || 'N/A' }}</td>
                        <th></th>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- <div class="mt-4">
                  <h5>Actions</h5>
                  <div class="btn-group">
                    <button class="btn btn-primary" @click="editExam" :disabled="loading">
                      <i class="bi bi-pencil"></i> Edit Exam
                    </button>
                    <button class="btn btn-success" @click="manageQuestions" :disabled="loading">
                      <i class="bi bi-list-check"></i> Manage Questions
                    </button>
                    <button class="btn btn-info" @click="viewResults" :disabled="loading">
                      <i class="bi bi-graph-up"></i> View Results
                    </button>
                  </div>
                </div> -->
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exam-view {
  padding: 20px;
}

.card {
  margin-bottom: 20px;
}

.btn-group {
}

.btn-group .btn {
  margin: 0;
}

table th {
  width: 200px;
}
</style>