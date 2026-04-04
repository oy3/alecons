<script lang="js">
import { useAuthStore } from '../stores/auth.js'
import BrandLogo from './BrandLogo.vue'
import { logger } from '@shared/utils/logger'
import Swal from 'sweetalert2'
import { staffNavigationItems } from '../services/navigation.js'

export default {
  name: 'StaffMobileSidebar',
  setup() {
    const authStore = useAuthStore()
    return {
      authStore
    }
  },
  computed: {
    menuItems() {
      return staffNavigationItems.filter(item => 
        this.authStore.hasAnyPermission(item.permissions)
      )
    }
  },
  components: {
    BrandLogo
  },
  methods: {
    closeOffcanvas() {
      const offcanvasElement = document.getElementById('staffMobileSidebar')

      if (!offcanvasElement) {
        return
      }

      const closeButton = offcanvasElement.querySelector('.btn-close')
      if (closeButton) {
        closeButton.click()
      }
    },

    async logout() {
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
        logger.info('User confirmed logout from staff mobile sidebar')
        await this.authStore.logout()

        this.$router.push({ name: 'Login' }).then(() => {
          this.authStore.completeLogout()
          this.closeOffcanvas()
        })

        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Logged out successfully.',
          showConfirmButton: false,
          timer: 2000,
        })
      }
    }
  }
}
</script>

<template>
  <!-- Mobile Offcanvas Sidebar -->
  <div
    class="offcanvas offcanvas-start"
    tabindex="-1"
    id="staffMobileSidebar"
    aria-labelledby="staffMobileSidebarLabel"
  >
    <div class="offcanvas-header bg-staff-primary text-white">
      <BrandLogo id="staffMobileSidebarLabel" class="text-white" />
      <button
        type="button"
        class="btn-close btn-close-white"
        data-bs-dismiss="offcanvas"
        aria-label="Close"
      ></button>
    </div>
    
    <div class="offcanvas-body p-0">
      <!-- Navigation Menu -->
      <div class="p-3">
        <ul class="nav flex-column">
          <li class="nav-item" v-for="item in menuItems" :key="item.route">
            <router-link
              :to="item.route"
              class="nav-link d-flex align-items-center py-2 px-3 rounded"
              :class="{ 'active bg-staff-light text-staff-primary': $route.path === item.route }"
              @click="closeOffcanvas"
            >
              <i :class="item.icon" class="me-3"></i>
              <span>{{ item.title }}</span>
            </router-link>
          </li>
          <li class="nav-item mt-2 pt-2 border-top">
            <button
              type="button"
              class="nav-link nav-button d-flex align-items-center py-2 px-3 rounded w-100 border-0 bg-transparent"
              @click="logout"
            >
              <i class="bi bi-box-arrow-right me-3"></i>
              <span>Logout</span>
            </button>
          </li>
        </ul>
      </div>

      <!-- User Info Section -->
      <div class="mt-auto p-3 border-top">
        <div class="d-flex align-items-center">
          <div class="bg-staff-primary text-white rounded-circle p-2 me-3">
            <i class="bi bi-person-circle fs-5"></i>
          </div>
          <div class="flex-grow-1">
            <div class="fw-medium">{{ authStore.user?.firstName || 'Staff' }}</div>
            <div class="text-muted small">{{ authStore.userRole || 'Role' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nav-link {
  color: #6c757d;
  transition: all 0.3s ease;
  text-decoration: none;
}

.nav-link:hover {
  background-color: var(--staff-light);
  color: var(--staff-primary);
}

.nav-link.active {
  background-color: var(--staff-light);
  color: var(--staff-primary);
  font-weight: 500;
}

.nav-link i {
  width: 20px;
  text-align: center;
}

.nav-button {
  text-align: left;
}

.offcanvas-header {
  background: linear-gradient(135deg, var(--staff-primary) 0%, var(--staff-secondary) 100%);
}
</style>