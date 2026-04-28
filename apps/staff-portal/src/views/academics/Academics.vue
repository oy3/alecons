<script>
import { useAuthStore } from '../../stores/auth.js'
import { logger } from '@shared/utils/logger'
import AcademicSessions from './components/AcademicSessions.vue'
import Departments from './components/Departments.vue'
import Programs from './components/Programs.vue'
import Courses from './components/Courses.vue'
import Payments from './components/Payments.vue'

export default {
  name: 'AcademicsManagement',
  components: {
    AcademicSessions,
    Departments,
    Programs,
    Courses,
    Payments
  },
  setup() {
    const authStore = useAuthStore()
    return {
      authStore
    }
  },
  data() {
    return {
      activeTab: 'sessions'
    }
  },
  async mounted() {
    await this.authStore.initialize()

    // Check permissions
    if (!this.authStore.hasModuleAccess('academics')) {
      this.$swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'You do not have permission to manage academics',
        confirmButtonColor: '#1a5f5f'
      })
      this.$router.push('/dashboard')
      return
    }

    logger.info('Academics management page loaded')
  },
  methods: {
    setActiveTab(tab) {
      this.activeTab = tab
      logger.info('Switched to tab:', tab)
    },

    refreshCurrentTab() {
      this.$emit('refresh')
      logger.info('Refreshing current tab:', this.activeTab)
    }
  }
}
</script>

<template>
  <div class="container-fluid p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h2 class="fw-bold text-staff-primary mb-1">
              Academics Management
            </h2>
            <p class="text-muted mb-0">
              Manage academic sessions, departments, programs, and more
            </p>
          </div>
          <button
            class="btn btn-staff-primary btn-sm"
            @click="refreshCurrentTab"
          >
            <i class="bi bi-arrow-clockwise me-2"></i>Refresh
          </button>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="row mb-4">
      <div class="col-12">
        <ul class="nav nav-tabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: activeTab === 'sessions' }"
              @click="setActiveTab('sessions')"
              type="button"
            >
              <i class="bi bi-calendar-event me-2"></i>Academic Sessions
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: activeTab === 'departments' }"
              @click="setActiveTab('departments')"
              type="button"
            >
              <i class="bi bi-building me-2"></i>Departments
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: activeTab === 'programs' }"
              @click="setActiveTab('programs')"
              type="button"
            >
              <i class="bi bi-book me-2"></i>Programs
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: activeTab === 'courses' }"
              @click="setActiveTab('courses')"
              type="button"
            >
              <i class="bi bi-journal-text me-2"></i>Courses
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: activeTab === 'payments' }"
              type="button"
              @click="activeTab = 'payments'"
            >
              <i class="bi bi-credit-card me-2"></i>Payments
            </button>
          </li>
        </ul>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Academic Sessions Tab -->
      <div
        v-show="activeTab === 'sessions'"
        class="tab-pane fade"
        :class="{ 'show active': activeTab === 'sessions' }"
      >
        <AcademicSessions @refresh="refreshCurrentTab" />
      </div>

      <!-- Departments Tab -->
      <div
        v-show="activeTab === 'departments'"
        class="tab-pane fade"
        :class="{ 'show active': activeTab === 'departments' }"
      >
        <Departments @refresh="refreshCurrentTab" />
      </div>

      <!-- Programs Tab -->
      <div
        v-show="activeTab === 'programs'"
        class="tab-pane fade"
        :class="{ 'show active': activeTab === 'programs' }"
      >
        <Programs @refresh="refreshCurrentTab" />
      </div>

      <div
        v-show="activeTab === 'courses'"
        class="tab-pane fade"
        :class="{ 'show active': activeTab === 'courses' }"
      >
        <Courses @refresh="refreshCurrentTab" />
      </div>

      <!-- Payments Tab -->
      <div
        v-show="activeTab === 'payments'"
        class="tab-pane fade"
        :class="{ 'show active': activeTab === 'payments' }"
      >
        <Payments @refresh="refreshCurrentTab" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.nav-tabs {
  border-bottom: 2px solid #dee2e6;
}

.nav-tabs .nav-link {
  color: #6c757d;
  border: none;
  border-bottom: 3px solid transparent;
  font-weight: 500;
  padding: 1rem 1.5rem;
}

.nav-tabs .nav-link:hover {
  color: var(--staff-primary);
  border-bottom-color: var(--staff-light);
}

.nav-tabs .nav-link.active {
  color: var(--staff-primary);
  background-color: transparent;
  border-bottom-color: var(--staff-primary);
}

.nav-tabs .nav-link.disabled {
  color: #adb5bd;
  cursor: not-allowed;
}

.tab-content {
  min-height: 500px;
}
</style>