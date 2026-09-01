<script lang="js">
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import NotificationCenter from '@shared/components/NotificationCenter.vue'
import { apiService } from '../services/api.js'

export default {
  name: 'StaffNavbar',
  components: { NotificationCenter },
  setup() {
    const authStore = useAuthStore()
    const router = useRouter()

    const logout = async () => {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'You will be logged out of the staff portal.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#1a5f5f',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, logout'
      })

      if (result.isConfirmed) {
        await authStore.logout()
        router.push({ name: 'Login' }).then(() => {
          authStore.completeLogout()
        })

        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Logged out successfully.",
          showConfirmButton: false,
          timer: 2000,
        })
      }
    }

    return {
      authStore,
      logout,
      apiService,
    }
  }
}
</script>

<template>
  <nav
    class="staff-navbar navbar navbar-expand-lg navbar-light px-3 border-bottom"
  >
    <div class="w-100 d-flex align-items-center justify-content-between">
      <!-- Mobile Sidebar Toggle -->
      <button
        class="btn d-md-none me-2"
        data-bs-toggle="offcanvas"
        data-bs-target="#staffMobileSidebar"
        aria-controls="staffMobileSidebar"
      >
        <i class="bi bi-list fs-5"></i>
      </button>

      <!-- Page Title or Search -->
      <div class="d-flex align-items-center flex-grow-1">
        <!-- <h5 class="mb-0 d-none d-md-block text-staff-primary fw-bold">
          {{ $route.meta.title || $route.name || 'Staff Portal' }}
        </h5> -->

        <!-- Search Bar -->
        <form class="d-flex me-auto d-none d-lg-flex" style="width: 500px">
          <div class="input-group border rounded">
            <span class="input-group-text border-0 bg-white">
              <i class="bi bi-search text-muted"></i>
            </span>

            <input
              type="text"
              class="form-control border-0 bg-white"
              placeholder="What do you need?"
            />
          </div>
        </form>
      </div>

      <!-- Right Side Icons -->
      <div class="d-flex align-items-center gap-2">
        <!-- Notifications -->
        <NotificationCenter :api="apiService" accent-color="var(--staff-primary, #1a5f5f)"/>

        <!-- User Profile -->
        <div class="d-flex align-items-center">
          <div
            class="bg-staff-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2"
            style="width: 40px; height: 40px"
          >
            <i class="bi bi-person-fill"></i>
          </div>

          <div class="d-grid">
            <span class="fw-bold d-none d-sm-inline text-dark">
              {{ authStore.user?.firstName || "Staff" }}
            </span>
            <span class="small text-muted">
              {{ authStore.user?.position || "N/A" }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
/* .staff-navbar { */
  /* background-color: white !important; */
  /* box-shadow: 0 2px 4px rgba(26, 95, 95, 0.1); */
  /* border-bottom: 1px solid var(--staff-light); */
/* } */

.form-control:focus {
  border-color: var(--staff-primary);
  box-shadow: 0 0 0 0.25rem rgba(26, 95, 95, 0.25);
}
</style>
