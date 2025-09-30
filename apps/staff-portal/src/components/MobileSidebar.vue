<script lang="js">
import { useAuthStore } from '../stores/auth.js'
import BrandLogo from './BrandLogo.vue'

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
      const items = [
        {
          title: 'Dashboard',
          icon: 'bi-house-door',
          route: '/dashboard',
          permissions: ['view', 'dashboard:view']
        },
        {
          title: 'Applications',
          icon: 'bi-file-earmark-text',
          route: '/applications',
          permissions: ['view', 'applications:view']
        },
        {
          title: 'Users',
          icon: 'bi-people',
          route: '/users',
          permissions: ['view', 'users:view']
        },
        {
          title: 'Reports',
          icon: 'bi-graph-up',
          route: '/reports',
          permissions: ['view', 'reports:view']
        },
        {
          title: 'Settings',
          icon: 'bi-gear',
          route: '/settings',
          permissions: ['view', 'settings:view']
        }
      ]

      // Filter menu items based on user permissions
      return items.filter(item => 
        this.authStore.hasAnyPermission(item.permissions)
      )
    }
  },
  components: {
    BrandLogo
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
              data-bs-dismiss="offcanvas"
            >
              <i :class="item.icon" class="me-3"></i>
              <span>{{ item.title }}</span>
            </router-link>
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

.offcanvas-header {
  background: linear-gradient(135deg, var(--staff-primary) 0%, var(--staff-secondary) 100%);
}
</style>