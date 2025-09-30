<script lang="js">
import { useAuthStore } from '../stores/auth.js'
import BrandLogo from './BrandLogo.vue'

export default {
  name: 'StaffSidebar',
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
  <nav class="staff-sidebar d-none d-md-flex flex-column">
    <!-- Brand Logo -->
    <div class="p-3 border-bottom border-light border-opacity-25">
      <BrandLogo class="text-white" />
    </div>

    <!-- Navigation Menu -->
    <div class="flex-grow-1 p-3">
      <ul class="nav flex-column">
        <li class="nav-item" v-for="item in menuItems" :key="item.route">
          <router-link
            :to="item.route"
            class="nav-link d-flex align-items-center py-2 px-3"
            :class="{ 'active': $route.path === item.route }"
          >
            <i :class="item.icon" class="me-3"></i>
            <span>{{ item.title }}</span>
          </router-link>
        </li>
      </ul>
    </div>

    <!-- User Info Section -->
    <div class="p-3 border-top border-light border-opacity-25">
      <div class="d-flex align-items-center text-white">
        <div class="bg-white bg-opacity-25 rounded-circle p-2 me-3">
          <i class="bi bi-person-circle fs-5"></i>
        </div>
        <div class="flex-grow-1">
          <div class="fw-medium small">{{ authStore.user?.firstName || 'Staff' }}</div>
          <div class="text-white-50" style="font-size: 0.75rem;">
            {{ authStore.userRole || 'Role' }}
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.staff-sidebar {
  background: linear-gradient(180deg, var(--staff-primary) 0%, var(--staff-dark) 100%);
  min-height: 100vh;
  width: 280px;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  overflow-y: auto;
}

.nav-link {
  color: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  margin: 2px 0;
  transition: all 0.3s ease;
  text-decoration: none;
}

.nav-link:hover,
.nav-link.active {
  background-color: rgba(255, 255, 255, 0.15);
  color: white;
}

.nav-link i {
  width: 20px;
  text-align: center;
}

.staff-sidebar::-webkit-scrollbar {
  width: 6px;
}

.staff-sidebar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
}

.staff-sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.staff-sidebar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style>