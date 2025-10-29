<template>
  <div>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
      <div class="container">
        <a class="navbar-brand" href="#">
          <i class="bi bi-mortarboard-fill me-2"></i>
          Student Portal
        </a>
        
        <button 
          class="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
        >
          <span class="navbar-toggler-icon"></span>
        </button>
        
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <a class="nav-link active" href="#dashboard">
                <i class="bi bi-speedometer2 me-1"></i>Dashboard
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="#courses">
                <i class="bi bi-book me-1"></i>Courses
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="#assignments">
                <i class="bi bi-list-task me-1"></i>Assignments
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="#grades">
                <i class="bi bi-bar-chart me-1"></i>Grades
              </a>
            </li>
          </ul>
          
          <div class="navbar-nav">
            <div class="nav-item dropdown">
              <a 
                class="nav-link dropdown-toggle" 
                href="#" 
                role="button" 
                data-bs-toggle="dropdown"
              >
                <i class="bi bi-person-circle me-1"></i>
                {{ auth.userName }}
              </a>
              <ul class="dropdown-menu">
                <li>
                  <a class="dropdown-item" href="#profile">
                    <i class="bi bi-person me-2"></i>Profile
                  </a>
                </li>
                <li>
                  <a class="dropdown-item" href="#settings">
                    <i class="bi bi-gear me-2"></i>Settings
                  </a>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <a class="dropdown-item text-danger" href="#" @click.prevent="logout">
                    <i class="bi bi-box-arrow-right me-2"></i>Logout
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <div class="container">
        <div class="row align-items-center">
          <div class="col-md-8">
            <h1 class="mb-2">
              <i class="bi bi-sun me-3"></i>
              Good {{ timeOfDay }}, {{ auth.user?.firstName }}!
            </h1>
            <p class="mb-0 opacity-75">
              Welcome back to your learning journey. Here's what's happening today.
            </p>
          </div>
          <div class="col-md-4 text-md-end">
            <div class="text-white-50">
              <i class="bi bi-calendar-event me-2"></i>
              {{ currentDate }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="container my-5">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-3">Loading your dashboard...</p>
      </div>

      <!-- Dashboard Content -->
      <div v-else>
        <!-- Stats Cards -->
        <div class="row g-4 mb-5">
          <div class="col-md-3 col-sm-6">
            <div class="stats-card border-primary">
              <i class="bi bi-book-fill text-primary stats-icon"></i>
              <div class="stats-number text-primary">{{ stats.totalCourses }}</div>
              <div class="stats-label">Total Courses</div>
            </div>
          </div>
          <div class="col-md-3 col-sm-6">
            <div class="stats-card border-success">
              <i class="bi bi-check-circle-fill text-success stats-icon"></i>
              <div class="stats-number text-success">{{ stats.completedAssignments }}</div>
              <div class="stats-label">Completed</div>
            </div>
          </div>
          <div class="col-md-3 col-sm-6">
            <div class="stats-card border-warning">
              <i class="bi bi-clock-fill text-warning stats-icon"></i>
              <div class="stats-number text-warning">{{ stats.pendingAssignments }}</div>
              <div class="stats-label">Pending</div>
            </div>
          </div>
          <div class="col-md-3 col-sm-6">
            <div class="stats-card border-info">
              <i class="bi bi-trophy-fill text-info stats-icon"></i>
              <div class="stats-number text-info">{{ stats.averageGrade }}%</div>
              <div class="stats-label">Average Grade</div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="row g-4 mb-5">
          <div class="col-md-6">
            <div class="card h-100">
              <div class="card-header">
                <i class="bi bi-lightning-charge me-2"></i>
                Quick Actions
              </div>
              <div class="card-body">
                <div class="d-grid gap-3">
                  <a href="#courses" class="quick-action">
                    <i class="bi bi-book"></i>
                    <div>
                      <strong>View Courses</strong>
                      <br>
                      <small class="text-muted">Access your enrolled courses</small>
                    </div>
                  </a>
                  <a href="#assignments" class="quick-action">
                    <i class="bi bi-list-task"></i>
                    <div>
                      <strong>Check Assignments</strong>
                      <br>
                      <small class="text-muted">Review pending tasks</small>
                    </div>
                  </a>
                  <a href="#exams" class="quick-action">
                    <i class="bi bi-pencil-square"></i>
                    <div>
                      <strong>Upcoming Exams</strong>
                      <br>
                      <small class="text-muted">Prepare for tests</small>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class="col-md-6">
            <div class="card h-100">
              <div class="card-header">
                <i class="bi bi-bell me-2"></i>
                Recent Activities
              </div>
              <div class="card-body">
                <div v-if="recentActivities.length === 0" class="text-center text-muted py-4">
                  <i class="bi bi-inbox" style="font-size: 2rem;"></i>
                  <p class="mt-3 mb-0">No recent activities</p>
                </div>
                <div v-else class="d-grid gap-2">
                  <div 
                    v-for="activity in recentActivities" 
                    :key="activity.id"
                    class="d-flex align-items-center p-2 border-start border-3 border-primary"
                  >
                    <i :class="activity.icon" class="text-primary me-3"></i>
                    <div class="flex-grow-1">
                      <div class="fw-medium">{{ activity.title }}</div>
                      <small class="text-muted">{{ activity.description }}</small>
                    </div>
                    <small class="text-muted">{{ activity.time }}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Upcoming Deadlines -->
        <div class="row">
          <div class="col-12">
            <div class="card">
              <div class="card-header">
                <i class="bi bi-calendar-check me-2"></i>
                Upcoming Deadlines
              </div>
              <div class="card-body">
                <div v-if="upcomingDeadlines.length === 0" class="text-center text-muted py-4">
                  <i class="bi bi-calendar-x" style="font-size: 2rem;"></i>
                  <p class="mt-3 mb-0">No upcoming deadlines</p>
                </div>
                <div v-else class="row g-3">
                  <div 
                    v-for="deadline in upcomingDeadlines" 
                    :key="deadline.id"
                    class="col-md-4"
                  >
                    <div class="card border-0 bg-light">
                      <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                          <h6 class="card-title mb-0">{{ deadline.title }}</h6>
                          <span 
                            class="badge"
                            :class="getDeadlineBadgeClass(deadline.daysLeft)"
                          >
                            {{ deadline.daysLeft }} days
                          </span>
                        </div>
                        <p class="card-text text-muted small">{{ deadline.course }}</p>
                        <p class="card-text">
                          <small class="text-muted">
                            <i class="bi bi-calendar me-1"></i>
                            Due: {{ deadline.dueDate }}
                          </small>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { authStore } from '../stores/auth.js'
import { apiService } from '../services/api.js'
import Swal from 'sweetalert2'

export default {
  name: 'Dashboard',
  setup() {
    const auth = authStore()
    const loading = ref(true)
    
    const stats = ref({
      totalCourses: 0,
      activeCourses: 0,
      completedAssignments: 0,
      pendingAssignments: 0,
      upcomingExams: 0,
      averageGrade: 0
    })

    const recentActivities = ref([
      {
        id: 1,
        title: 'Assignment Submitted',
        description: 'Mathematics Quiz 1',
        time: '2 hours ago',
        icon: 'bi bi-check-circle-fill text-success'
      },
      {
        id: 2,
        title: 'New Course Material',
        description: 'Physics Chapter 5 uploaded',
        time: '1 day ago',
        icon: 'bi bi-book-fill text-primary'
      },
      {
        id: 3,
        title: 'Grade Released',
        description: 'Chemistry Lab Report - A',
        time: '2 days ago',
        icon: 'bi bi-trophy-fill text-warning'
      }
    ])

    const upcomingDeadlines = ref([
      {
        id: 1,
        title: 'Final Project',
        course: 'Computer Science 101',
        dueDate: 'Oct 30, 2025',
        daysLeft: 8
      },
      {
        id: 2,
        title: 'Research Paper',
        course: 'English Literature',
        dueDate: 'Nov 5, 2025',
        daysLeft: 14
      },
      {
        id: 3,
        title: 'Lab Report',
        course: 'Biology',
        dueDate: 'Oct 25, 2025',
        daysLeft: 3
      }
    ])

    const timeOfDay = computed(() => {
      const hour = new Date().getHours()
      if (hour < 12) return 'morning'
      if (hour < 17) return 'afternoon'
      return 'evening'
    })

    const currentDate = computed(() => {
      return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    })

    const getDeadlineBadgeClass = (daysLeft) => {
      if (daysLeft <= 3) return 'bg-danger'
      if (daysLeft <= 7) return 'bg-warning'
      return 'bg-success'
    }

    const loadDashboardData = async () => {
      try {
        loading.value = true
        
        // Load dashboard stats
        const statsResponse = await apiService.getDashboardStats()
        if (statsResponse.success) {
          stats.value = { ...stats.value, ...statsResponse.data }
        }

        // Note: In a real application, you would load actual data
        // For now, we're using mock data
        
      } catch (error) {
        console.error('Error loading dashboard data:', error)
        await Swal.fire({
          icon: 'error',
          title: 'Loading Error',
          text: 'Failed to load dashboard data. Please refresh the page.',
          confirmButtonColor: '#1a5f5f'
        })
      } finally {
        loading.value = false
      }
    }

    const logout = async () => {
      const result = await Swal.fire({
        title: 'Sign Out',
        text: 'Are you sure you want to sign out?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#1a5f5f',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, sign out'
      })

      if (result.isConfirmed) {
        auth.logout()
      }
    }

    onMounted(() => {
      loadDashboardData()
    })

    return {
      auth,
      loading,
      stats,
      recentActivities,
      upcomingDeadlines,
      timeOfDay,
      currentDate,
      getDeadlineBadgeClass,
      logout
    }
  }
}
</script>

<style scoped>
.dashboard-header {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  color: white;
  padding: 3rem 0;
}

.stats-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  height: 100%;
  border-left: 4px solid transparent;
  transition: all 0.3s ease;
}

.stats-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
}

.stats-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  opacity: 0.8;
}

.stats-number {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.stats-label {
  font-size: 0.9rem;
  color: var(--text-muted);
  font-weight: 500;
}

.quick-action {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-dark);
  transition: all 0.3s ease;
  border-left: 3px solid var(--primary-color);
}

.quick-action:hover {
  background: #e9ecef;
  transform: translateX(5px);
  color: var(--text-dark);
}

.quick-action i {
  font-size: 1.5rem;
  color: var(--primary-color);
  margin-right: 1rem;
  width: 30px;
  text-align: center;
}

@media (max-width: 768px) {
  .dashboard-header {
    padding: 2rem 0;
  }
  
  .stats-number {
    font-size: 2rem;
  }
  
  .stats-card {
    padding: 1.5rem;
  }
}
</style>