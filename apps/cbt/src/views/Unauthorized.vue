<template>
  <div class="container py-5">
    <div class="row justify-content-center">
      <div class="col-md-8">
        <div class="card shadow">
          <div class="card-header bg-danger text-white text-center">
            <h4 class="mb-0">
              <i class="bi bi-shield-x me-2"></i>
              Access Denied
            </h4>
          </div>
          <div class="card-body text-center py-5">
            <i class="bi bi-lock text-danger" style="font-size: 4rem;"></i>
            <h3 class="mt-4 mb-3">Unauthorized Access</h3>
            <p class="text-muted mb-4">
              You don't have permission to access this resource. 
              Please contact your administrator if you believe this is an error.
            </p>
            <div class="d-flex justify-content-center gap-3">
              <button 
                class="btn btn-primary"
                @click="goToDashboard"
              >
                <i class="bi bi-house me-1"></i>
                Go to Dashboard
              </button>
              <button 
                class="btn btn-outline-secondary"
                @click="goBack"
              >
                <i class="bi bi-arrow-left me-1"></i>
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useRouter } from 'vue-router'

export default {
  name: 'Unauthorized',
  setup() {
    const router = useRouter()

    const goToDashboard = () => {
      router.push('/dashboard')
    }

    const goBack = () => {
      router.go(-1)
    }

    return {
      goToDashboard,
      goBack
    }
  }
}
</script>

<style scoped>
.card {
  border: none;
  border-radius: 15px;
}

.card-header {
  border-radius: 15px 15px 0 0 !important;
}
</style>