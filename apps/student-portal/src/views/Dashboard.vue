<script>
import { useAuthStore } from '../stores/auth.js'

export default {
    name: 'Dashboard',
    setup() {
        const auth = useAuthStore()
        return {
            auth
        }
    }
}
</script>

<template>
  <div class="dashboard p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h2 class="h3 fw-bold text-dark mb-1">Welcome back, {{ auth.userFirstName }}! 👋</h2>
            <p class="text-muted mb-0">Here's what's happening with your studies today.</p>
          </div>
          <div class="d-none d-md-flex">
            <span class="badge bg-success fs-6 px-3 py-2">
              <i class="bi bi-person-check me-1"></i>Active
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="row mb-4">
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex align-items-center">
              <div class="flex-shrink-0">
                <div class="bg-primary bg-opacity-10 rounded-3 p-3">
                  <i class="bi bi-book text-white fs-4"></i>
                </div>
              </div>
              <div class="flex-grow-1 ms-3">
                <h6 class="fw-bold text-dark mb-1">Courses</h6>
                <h4 class="fw-bold text-primary mb-0">0</h4>
                <small class="text-muted">No courses registered</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex align-items-center">
              <div class="flex-shrink-0">
                <div class="bg-success bg-opacity-10 rounded-3 p-3">
                  <i class="bi bi-award text-success fs-4"></i>
                </div>
              </div>
              <div class="flex-grow-1 ms-3">
                <h6 class="fw-bold text-dark mb-1">GPA</h6>
                <h4 class="fw-bold text-muted mb-0">-</h4>
                <small class="text-muted">Not available</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex align-items-center">
              <div class="flex-shrink-0">
                <div class="bg-warning bg-opacity-10 rounded-3 p-3">
                  <i class="bi bi-calendar-check text-warning fs-4"></i>
                </div>
              </div>
              <div class="flex-grow-1 ms-3">
                <h6 class="fw-bold text-dark mb-1">Attendance</h6>
                <h4 class="fw-bold text-muted mb-0">-</h4>
                <small class="text-muted">Not available</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex align-items-center">
              <div class="flex-shrink-0">
                <div class="bg-info bg-opacity-10 rounded-3 p-3">
                  <i class="bi bi-credit-card text-info fs-4"></i>
                </div>
              </div>
              <div class="flex-grow-1 ms-3">
                <h6 class="fw-bold text-dark mb-1">Balance</h6>
                <h4 class="fw-bold text-info mb-0">₦0</h4>
                <small class="text-success">All paid</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="row">
      <!-- Left Column -->
      <div class="col-lg-8 mb-4">
        <!-- Recent Courses -->
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-header bg-white border-0 py-3">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="fw-bold mb-0">Current Courses</h5>
              <router-link to="/academics" class="btn btn-sm btn-outline-primary text-white">
                View All <i class="bi bi-arrow-right ms-1"></i>
              </router-link>
            </div>
          </div>
          <div class="card-body">
            <!-- TODO: Replace with actual course data from backend when course registration system is implemented -->
            <div class="text-center py-5">
              <i class="bi bi-book text-muted" style="font-size: 3rem;"></i>
              <h6 class="text-muted mt-3">No Courses Available</h6>
              <p class="text-muted small">Course registration and enrollment system will be available soon.</p>
            </div>
            
            <!-- COMMENTED OUT: Mock course data - uncomment when backend is ready
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th class="border-0 fw-bold text-dark">Course</th>
                    <th class="border-0 fw-bold text-dark">Instructor</th>
                    <th class="border-0 fw-bold text-dark">Schedule</th>
                    <th class="border-0 fw-bold text-dark">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="py-3">
                      <div>
                        <div class="fw-bold text-dark">Anatomy & Physiology</div>
                        <small class="text-muted">ANA 201</small>
                      </div>
                    </td>
                    <td class="py-3">Dr. Sarah Johnson</td>
                    <td class="py-3">Mon, Wed, Fri - 9:00 AM</td>
                    <td class="py-3">
                      <div class="progress" style="height: 8px;">
                        <div class="progress-bar bg-primary" style="width: 75%"></div>
                      </div>
                      <small class="text-muted">75% Complete</small>
                    </td>
                  </tr>
                  <tr>
                    <td class="py-3">
                      <div>
                        <div class="fw-bold text-dark">Fundamentals of Nursing</div>
                        <small class="text-muted">NUR 101</small>
                      </div>
                    </td>
                    <td class="py-3">Prof. Michael Brown</td>
                    <td class="py-3">Tue, Thu - 2:00 PM</td>
                    <td class="py-3">
                      <div class="progress" style="height: 8px;">
                        <div class="progress-bar bg-primary" style="width: 60%"></div>
                      </div>
                      <small class="text-muted">60% Complete</small>
                    </td>
                  </tr>
                  <tr>
                    <td class="py-3">
                      <div>
                        <div class="fw-bold text-dark">Medical Terminology</div>
                        <small class="text-muted">MED 150</small>
                      </div>
                    </td>
                    <td class="py-3">Dr. Emily Davis</td>
                    <td class="py-3">Mon, Wed - 11:00 AM</td>
                    <td class="py-3">
                      <div class="progress" style="height: 8px;">
                        <div class="progress-bar bg-primary" style="width: 45%"></div>
                      </div>
                      <small class="text-muted">45% Complete</small>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            -->
          </div>
        </div>

        <!-- Recent Assignments -->
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Upcoming Assignments</h5>
          </div>
          <div class="card-body">
            <!-- TODO: Replace with actual assignment data from backend when assignment system is implemented -->
            <div class="text-center py-4">
              <i class="bi bi-clipboard-check text-muted" style="font-size: 3rem;"></i>
              <h6 class="text-muted mt-3">No Assignments Available</h6>
              <p class="text-muted small">Assignment tracking system will be available once courses are set up.</p>
            </div>
            
            <!-- COMMENTED OUT: Mock assignment data - uncomment when backend is ready
            <div class="d-flex align-items-center p-3 bg-light rounded mb-3">
              <div class="me-3">
                <div class="bg-danger bg-opacity-10 rounded-circle p-2">
                  <i class="bi bi-exclamation-triangle text-danger"></i>
                </div>
              </div>
              <div class="flex-grow-1">
                <h6 class="fw-bold mb-1">Case Study Analysis</h6>
                <p class="text-muted mb-1">Due: Tomorrow, 11:59 PM</p>
                <small class="text-danger">High Priority</small>
              </div>
            </div>
            
            <div class="d-flex align-items-center p-3 bg-light rounded mb-3">
              <div class="me-3">
                <div class="bg-warning bg-opacity-10 rounded-circle p-2">
                  <i class="bi bi-clock text-warning"></i>
                </div>
              </div>
              <div class="flex-grow-1">
                <h6 class="fw-bold mb-1">Lab Report - Vital Signs</h6>
                <p class="text-muted mb-1">Due: Dec 5, 2024</p>
                <small class="text-warning">Medium Priority</small>
              </div>
            </div>
            
            <div class="d-flex align-items-center p-3 bg-light rounded">
              <div class="me-3">
                <div class="bg-success bg-opacity-10 rounded-circle p-2">
                  <i class="bi bi-check-circle text-success"></i>
                </div>
              </div>
              <div class="flex-grow-1">
                <h6 class="fw-bold mb-1">Chapter 5 Quiz</h6>
                <p class="text-muted mb-1">Due: Dec 10, 2024</p>
                <small class="text-success">Low Priority</small>
              </div>
            </div>
            -->
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div class="col-lg-4">
        <!-- Calendar Widget -->
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Today's Schedule</h5>
          </div>
          <div class="card-body">
            <!-- TODO: Replace with actual schedule data from backend when timetable system is implemented -->
            <div class="text-center py-4">
              <i class="bi bi-calendar3 text-muted" style="font-size: 3rem;"></i>
              <h6 class="text-muted mt-3">No Schedule Available</h6>
              <p class="text-muted small">Class timetable system will be available once courses are registered.</p>
            </div>
            
            <!-- COMMENTED OUT: Mock schedule data - uncomment when backend is ready
            <div class="d-flex align-items-center mb-3 p-3 bg-primary text-white bg-opacity-10 rounded">
              <div class="me-3">
                <strong class="">9:00 AM</strong>
              </div>
              <div>
                <div class="fw-bold">Anatomy Lecture</div>
                <small class="">Room 204</small>
              </div>
            </div>
            
            <div class="d-flex align-items-center mb-3 p-3 bg-success bg-opacity-10 rounded">
              <div class="me-3">
                <strong class="text-primary">2:00 PM</strong>
              </div>
              <div>
                <div class="fw-bold">Clinical Practice</div>
                <small class="text-muted">Hospital Wing A</small>
              </div>
            </div>
            
            <div class="d-flex align-items-center p-3  bg-success bg-opacity-10 rounded">
              <div class="me-3">
                <strong class="text-primary">4:00 PM</strong>
              </div>
              <div>
                <div class="fw-bold">Study Group</div>
                <small class="text-muted">Library - Room 301</small>
              </div>
            </div>
            -->
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Quick Actions</h5>
          </div>
          <div class="card-body">
            <div class="d-grid gap-3">
              <router-link to="/academics" class="btn btn-primary">
                <i class="bi bi-book me-2"></i>View Courses
              </router-link>
              <router-link to="/resources" class="btn btn-outline-primary">
                <i class="bi bi-download me-2"></i>Download Resources
              </router-link>
              <router-link to="/finance" class="btn btn-outline-success">
                <i class="bi bi-credit-card me-2"></i>Pay Fees
              </router-link>
              <router-link to="/settings" class="btn btn-outline-secondary">
                <i class="bi bi-gear me-2"></i>Account Settings
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  background-color: #f8f9fa;
  min-height: calc(100vh - 70px);
}

.card {
  transition: transform 0.2s ease-in-out;
}

.card:hover {
  transform: translateY(-2px);
}

.progress {
  border-radius: 10px;
}

.table tbody tr:hover {
  background-color: rgba(0, 123, 255, 0.05);
}
</style>